// ============================================================================
// KANRI · Edge Function: stripe-webhook
// ----------------------------------------------------------------------------
// Recibe los eventos de Stripe y sincroniza el estado de la suscripción en la
// tabla `tenants` (status, current_period_end, stripe_subscription_id…).
//
// Despliega SIN verificación de JWT (lo llama Stripe, no un usuario):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets requeridos:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (presentes por defecto)
//
// En el dashboard de Stripe crea un endpoint apuntando a la URL de esta función
// y suscríbelo a: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/** Mapea el estado de Stripe al estado interno del tenant. */
function mapStatus(s: string): string {
  switch (s) {
    case 'active':
    case 'trialing': return 'active';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled':
    case 'incomplete_expired': return 'canceled';
    default: return 'past_due';
  }
}

async function tenantIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin.from('tenants').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return (data?.id as string) ?? null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const tenantId =
    (sub.metadata?.tenant_id as string | undefined) ??
    (await tenantIdForCustomer(typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null));
  if (!tenantId) return;

  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const cycle = sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
  const plan = (sub.metadata?.plan as string | undefined) ?? undefined;

  await admin.from('tenants').update({
    status: mapStatus(sub.status),
    current_period_end: periodEnd,
    trial_ends_at: null,
    billing_cycle: cycle,
    stripe_subscription_id: sub.id,
    ...(plan ? { plan } : {}),
  }).eq('id', tenantId);
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!sig || !secret) return new Response('Falta firma o secret del webhook.', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, cryptoProvider);
  } catch (err) {
    return new Response(`Firma inválida: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          // Conserva el tenant_id de la sesión por si la suscripción no lo trae.
          if (!sub.metadata?.tenant_id && session.metadata?.tenant_id) {
            sub.metadata = { ...sub.metadata, tenant_id: session.metadata.tenant_id, plan: session.metadata.plan ?? '' };
          }
          await syncSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const tenantId = await tenantIdForCustomer(typeof inv.customer === 'string' ? inv.customer : null);
        if (tenantId) await admin.from('tenants').update({ status: 'past_due' }).eq('id', tenantId);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return new Response(`Error al procesar: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
