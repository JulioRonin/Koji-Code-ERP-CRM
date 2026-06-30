import { supabase } from '@/lib/supabase';
import type { PlanKey } from '@/lib/saas';

/**
 * Inicia el checkout de Stripe para suscribirse a un plan. Invoca la Edge
 * Function `stripe-checkout` (que valida la sesión, crea/recupera el customer y
 * genera la sesión de pago) y redirige a la URL de Stripe.
 *
 * Si Stripe aún no está configurado/desplegado, lanza un error legible.
 */
export async function startCheckout(plan: PlanKey, cycle: 'monthly' | 'annual'): Promise<void> {
  if (!supabase) {
    throw new Error('El pago en línea requiere el backend configurado.');
  }
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { plan, cycle, returnUrl: window.location.origin + '/subscription' },
  });
  if (error) {
    throw new Error(
      'El pago en línea aún no está disponible (falta configurar Stripe). ' +
        'Mientras tanto, contacta a ventas para activar tu plan.'
    );
  }
  if (data?.url) {
    window.location.href = data.url as string;
    return;
  }
  throw new Error(data?.error || 'No se pudo iniciar el pago.');
}

/** Abre el portal de facturación de Stripe (cambiar tarjeta, cancelar, facturas). */
export async function openBillingPortal(): Promise<void> {
  if (!supabase) throw new Error('Requiere backend configurado.');
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { returnUrl: window.location.origin + '/subscription' },
  });
  if (error || !data?.url) throw new Error('El portal de facturación aún no está disponible.');
  window.location.href = data.url as string;
}
