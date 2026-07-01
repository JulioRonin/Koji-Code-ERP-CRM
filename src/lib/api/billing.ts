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

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;   // centavos
  amount_due: number;
  currency: string;
  created: number;       // epoch seconds
  period_start: number;
  period_end: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

/**
 * Historial de pagos (facturas de Stripe). Sin tenantId devuelve las de la
 * empresa del usuario; el dueño de plataforma puede pasar un tenantId.
 * Devuelve [] si Stripe aún no está configurado (no rompe la UI).
 */
export async function listInvoices(tenantId?: string): Promise<StripeInvoice[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.functions.invoke('stripe-invoices', {
      body: tenantId ? { tenantId } : {},
    });
    if (error) return [];
    return (data?.invoices ?? []) as StripeInvoice[];
  } catch {
    return [];
  }
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
