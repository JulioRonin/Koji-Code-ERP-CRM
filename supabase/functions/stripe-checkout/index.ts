// ============================================================================
// KANRI · Edge Function: stripe-checkout
// ----------------------------------------------------------------------------
// Crea una sesión de Stripe Checkout (modo suscripción) para el plan elegido.
// Calcula el precio en el servidor (incluida la oferta del plan Profesional) y
// reutiliza/crea el customer de Stripe ligado al tenant.
//
// Despliega con:  supabase functions deploy stripe-checkout
// Secrets requeridos:
//   STRIPE_SECRET_KEY            (sk_live_… o sk_test_…)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (presentes por defecto)
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

// Catálogo de precios (MXN). Debe coincidir con src/lib/saas/plans.ts y promo.ts.
const PRICES: Record<string, { monthly: number; annual: number; label: string }> = {
  basico: { monthly: 5500, annual: 55000, label: 'KANRI Básico' },
  profesional: { monthly: 12000, annual: 120000, label: 'KANRI Profesional' },
};
const PROMO = { plan: 'profesional', monthly: 8500, annual: 85000, endsAt: '2026-07-25T23:59:59' };

function inPromo(plan: string): boolean {
  return plan === PROMO.plan && Date.now() < new Date(PROMO.endsAt).getTime();
}

function amountFor(plan: string, cycle: 'monthly' | 'annual'): number | null {
  const base = PRICES[plan];
  if (!base) return null;
  if (inPromo(plan)) return cycle === 'annual' ? PROMO.annual : PROMO.monthly;
  return cycle === 'annual' ? base.annual : base.monthly;
}

/**
 * Price ID de Stripe para un plan/ciclo, tomado de los secrets (si existe).
 * Nombres esperados:
 *   STRIPE_PRICE_BASICO_MONTHLY / STRIPE_PRICE_BASICO_ANNUAL
 *   STRIPE_PRICE_PROFESIONAL_MONTHLY / STRIPE_PRICE_PROFESIONAL_ANNUAL
 *   (opcional promo) STRIPE_PRICE_PROFESIONAL_PROMO_MONTHLY / _ANNUAL
 */
function priceIdFor(plan: string, cycle: 'monthly' | 'annual'): string | undefined {
  const suffix = cycle === 'annual' ? 'ANNUAL' : 'MONTHLY';
  if (inPromo(plan)) {
    const promo = Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_PROMO_${suffix}`);
    if (promo) return promo;
  }
  return Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}_${suffix}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Stripe no está configurado (falta STRIPE_SECRET_KEY).' }, 500);

  const { plan, cycle = 'monthly', returnUrl } = await req.json().catch(() => ({}));
  if (!PRICES[plan]) return json({ error: 'Plan no válido para pago en línea.' }, 400);
  const priceId = priceIdFor(plan, cycle);        // tu Price ID de Stripe (si lo configuraste)
  const amount = amountFor(plan, cycle);          // respaldo: monto calculado

  // 1) Identifica al usuario por su JWT y resuelve su tenant.
  const authHeader = req.headers.get('Authorization') ?? '';
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userData.user;
  if (!user) return json({ error: 'Sesión no válida.' }, 401);

  const { data: profile } = await admin.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
  const tenantId = profile?.tenant_id as string | undefined;
  if (!tenantId) return json({ error: 'No se encontró la empresa del usuario.' }, 400);
  const { data: tenant } = await admin.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  if (!tenant) return json({ error: 'Empresa no encontrada.' }, 404);

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });

  // 2) Customer de Stripe (reutiliza el guardado o crea uno nuevo).
  let customerId = tenant.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: tenant.name,
      metadata: { tenant_id: tenantId },
    });
    customerId = customer.id;
    await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenantId);
  }

  // 3) Sesión de checkout (suscripción). Usa tu Price ID de Stripe si está
  //    configurado; si no, cae al precio calculado en el servidor.
  const base = returnUrl || `${req.headers.get('origin') ?? ''}/subscription`;
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: 'mxn',
          product_data: { name: `${PRICES[plan].label} (${cycle === 'annual' ? 'anual' : 'mensual'})` },
          unit_amount: (amount ?? 0) * 100,
          recurring: { interval: cycle === 'annual' ? 'year' : 'month' },
        },
      };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [lineItem],
    allow_promotion_codes: true,
    success_url: `${base}?checkout=success`,
    cancel_url: `${base}?checkout=cancel`,
    metadata: { tenant_id: tenantId, plan, cycle },
    subscription_data: { metadata: { tenant_id: tenantId, plan, cycle } },
  });

  return json({ url: session.url });
});
