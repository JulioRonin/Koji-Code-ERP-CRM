// ============================================================================
// KANRI · Edge Function: facturapi-connect
// ----------------------------------------------------------------------------
// Valida y guarda la llave de Facturapi de la empresa (por tenant). La llave se
// guarda con service_role; el frontend nunca la vuelve a leer.
//
// Despliega:  supabase functions deploy facturapi-connect
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (presentes por defecto)
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const { key, test = true } = await req.json().catch(() => ({}));
  if (!key || typeof key !== 'string') return json({ error: 'Falta la llave de Facturapi.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await admin.auth.getUser((req.headers.get('Authorization') ?? '').replace('Bearer ', ''));
  const user = userData.user;
  if (!user) return json({ error: 'Sesión no válida.' }, 401);
  const { data: prof } = await admin.from('profiles').select('tenant_id, role').eq('id', user.id).maybeSingle();
  const tenantId = prof?.tenant_id as string | undefined;
  if (!tenantId) return json({ error: 'Empresa no encontrada.' }, 400);
  if (!/admin/i.test(String(prof?.role ?? ''))) return json({ error: 'Solo un administrador puede conectar Facturapi.' }, 403);

  // Valida la llave contra Facturapi (organización).
  const auth = 'Basic ' + btoa(`${key}:`);
  const res = await fetch('https://www.facturapi.io/v2/organizations', { headers: { Authorization: auth } })
    .catch(() => null);
  // /organizations existe con llave de usuario; con llave de org probamos /customers.
  let orgName: string | null = null;
  let ok = false;
  if (res && res.ok) { ok = true; }
  else {
    const r2 = await fetch('https://www.facturapi.io/v2/customers?limit=1', { headers: { Authorization: auth } }).catch(() => null);
    ok = !!(r2 && r2.ok);
  }
  if (!ok) return json({ error: 'La llave de Facturapi no es válida (verifica que sea la Secret Key).' }, 400);

  const { error } = await admin.from('tenant_integrations').upsert({
    tenant_id: tenantId, facturapi_key: key, facturapi_test: !!test, facturapi_org: orgName, connected: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, connected: true });
});
