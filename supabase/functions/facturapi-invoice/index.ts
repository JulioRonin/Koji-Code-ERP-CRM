// ============================================================================
// KANRI · Edge Function: facturapi-invoice
// ----------------------------------------------------------------------------
// Emite un CFDI 4.0 con Facturapi usando la llave de la empresa (por tenant) y
// guarda la factura en la tabla `invoices`.
//
// Despliega:  supabase functions deploy facturapi-invoice
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Item { description: string; quantity: number; price: number; product_key?: string; unit_key?: string; }
interface Payload {
  receptor: { legal_name: string; tax_id: string; tax_system: string; zip: string; email?: string };
  items: Item[];
  use?: string;          // uso CFDI, ej. G03
  payment_form?: string; // forma de pago, ej. 03
  payment_method?: string; // PUE / PPD
  project_id?: string;
  quote_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const p: Payload = await req.json().catch(() => ({} as Payload));
  if (!p.receptor?.tax_id || !p.items?.length) return json({ error: 'Faltan datos del receptor o partidas.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace('Bearer ', ''));
  const user = userData.user;
  if (!user) return json({ error: 'Sesión no válida.' }, 401);
  const { data: prof } = await admin.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
  const tenantId = prof?.tenant_id as string | undefined;
  if (!tenantId) return json({ error: 'Empresa no encontrada.' }, 400);

  const { data: integ } = await admin.from('tenant_integrations').select('facturapi_key').eq('tenant_id', tenantId).maybeSingle();
  const key = integ?.facturapi_key as string | undefined;
  if (!key) return json({ error: 'Facturapi no está conectado. Conéctalo en Facturación → Conexión.' }, 400);

  const auth = 'Basic ' + btoa(`${key}:`);
  const body = {
    customer: {
      legal_name: p.receptor.legal_name,
      tax_id: p.receptor.tax_id,
      tax_system: p.receptor.tax_system,
      email: p.receptor.email || undefined,
      address: { zip: p.receptor.zip },
    },
    items: p.items.map(it => ({
      quantity: it.quantity,
      product: {
        description: it.description,
        product_key: it.product_key || '01010101', // "No existe en el catálogo" genérico
        unit_key: it.unit_key || 'H87',            // pieza
        price: it.price,
      },
    })),
    use: p.use || 'G03',
    payment_form: p.payment_form || '03',
    payment_method: p.payment_method || 'PUE',
  };

  const res = await fetch('https://www.facturapi.io/v2/invoices', {
    method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const inv = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: inv?.message || 'Facturapi rechazó la factura.' }, 400);

  const base = `https://www.facturapi.io/v2/invoices/${inv.id}`;
  const total = Number(inv.total ?? p.items.reduce((s, i) => s + i.quantity * i.price, 0));
  await admin.from('invoices').insert({
    tenant_id: tenantId, facturapi_id: inv.id, folio: String(inv.folio_number ?? ''), uuid: inv.uuid ?? null,
    receptor_name: p.receptor.legal_name, receptor_rfc: p.receptor.tax_id, total, currency: inv.currency || 'MXN',
    status: inv.status || 'valid', pdf_url: `${base}/pdf`, xml_url: `${base}/xml`,
    project_id: p.project_id ?? null, quote_id: p.quote_id ?? null, created_by: user.id,
  });

  return json({ ok: true, id: inv.id, uuid: inv.uuid, folio: inv.folio_number, total, pdf: `${base}/pdf`, xml: `${base}/xml` });
});
