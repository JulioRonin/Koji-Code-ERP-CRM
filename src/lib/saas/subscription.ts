import type { Tenant } from './types';

export type SubState = 'trial' | 'trial_expired' | 'active' | 'past_due' | 'canceled';

const DAY = 86_400_000;

/** Días restantes de la demo / periodo actual (puede ser negativo si venció). */
export function daysLeft(tenant: Tenant): number {
  const end = tenant.subscription.currentPeriodEnd;
  if (!end) return 0;
  return Math.ceil((new Date(end).getTime() - Date.now()) / DAY);
}

/** Estado efectivo de la suscripción. */
export function subState(tenant: Tenant): SubState {
  const s = tenant.subscription.status;
  if (s === 'active') return 'active';
  if (s === 'canceled') return 'canceled';
  if (s === 'past_due' || s === 'paused') return 'past_due';
  // trialing
  return daysLeft(tenant) >= 0 ? 'trial' : 'trial_expired';
}

/** ¿El acceso a la app debe bloquearse por suscripción? */
export function isBlocked(tenant: Tenant): boolean {
  const st = subState(tenant);
  return st === 'trial_expired' || st === 'canceled' || st === 'past_due';
}

/** ¿Mostrar el aviso de demo (en prueba, aún con días)? */
export function isOnTrial(tenant: Tenant): boolean {
  return subState(tenant) === 'trial';
}
