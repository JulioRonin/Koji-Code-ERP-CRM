// ============================================================================
// KANRI · Edge Function: stripe-portal
// ----------------------------------------------------------------------------
// Abre el portal de facturación de Stripe (cambiar tarjeta, ver facturas,
// cancelar) para el customer del tenant del usuario autenticado.
//
// Despliega con:  supabase functions deploy stripe-portal
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

  const { returnUrl } = await req.json().catch(() => ({}));
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const authHeader = req.headers.get('Authorization') ?? '';
  const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userData.user;
  if (!user) return json({ error: 'Sesión no válida.' }, 401);

  const { data: profile } = await admin.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
  const { data: tenant } = await admin.from('tenants').select('stripe_customer_id, name').eq('id', profile?.tenant_id ?? '').maybeSingle();
  if (!tenant?.stripe_customer_id) {
    return json({ error: 'Aún no hay una suscripción activa para gestionar.' }, 400);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id as string,
    return_url: returnUrl || `${req.headers.get('origin') ?? ''}/subscription`,
  });

  return json({ url: session.url });
});
