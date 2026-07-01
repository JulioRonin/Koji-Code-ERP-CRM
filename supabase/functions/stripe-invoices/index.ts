// ============================================================================
// KANRI · Edge Function: stripe-invoices
// ----------------------------------------------------------------------------
// Devuelve el historial de pagos (facturas de Stripe) de una empresa.
//   • Un usuario normal ve las facturas de SU empresa.
//   • El dueño de plataforma puede pasar { tenantId } para ver las de cualquier
//     empresa (panel de administración).
//
// Despliega con:  supabase functions deploy stripe-invoices
// Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Stripe no está configurado.' }, 500);

  const { tenantId } = await req.json().catch(() => ({}));
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Identifica al usuario y resuelve QUÉ empresa puede consultar.
  const authHeader = req.headers.get('Authorization') ?? '';
  const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userData.user;
  if (!user) return json({ error: 'Sesión no válida.' }, 401);
  const { data: me } = await admin.from('profiles').select('tenant_id, is_platform_owner').eq('id', user.id).maybeSingle();

  // El dueño de plataforma puede pedir cualquier empresa; el resto, solo la suya.
  const targetTenant = (me?.is_platform_owner && tenantId) ? tenantId : (me?.tenant_id as string | undefined);
  if (!targetTenant) return json({ invoices: [] });

  const { data: tenant } = await admin.from('tenants').select('stripe_customer_id').eq('id', targetTenant).maybeSingle();
  if (!tenant?.stripe_customer_id) return json({ invoices: [] });

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
  const list = await stripe.invoices.list({ customer: tenant.stripe_customer_id as string, limit: 24 });

  const invoices = list.data.map(inv => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amount_paid: inv.amount_paid,     // en centavos
    amount_due: inv.amount_due,
    currency: inv.currency,
    created: inv.created,             // epoch seconds
    period_start: inv.period_start,
    period_end: inv.period_end,
    hosted_invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
  }));

  return json({ invoices });
});
