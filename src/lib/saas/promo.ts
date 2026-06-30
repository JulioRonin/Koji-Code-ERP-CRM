import type { PlanDef, PlanKey } from './types';

/**
 * Oferta de lanzamiento por tiempo limitado: el plan Profesional a precio
 * reducido hasta una fecha límite fija. Al vencer, regresa a su precio normal.
 * Solo aplica al plan Profesional.
 */
export const PROMO = {
  planKey: 'profesional' as PlanKey,
  label: 'Oferta de lanzamiento',
  /** Precio mensual promocional (MXN). Normal: $12,000. */
  promoPriceMxn: 8500,
  /** Precio anual promocional (≈ 2 meses gratis sobre el mensual promo). */
  promoPriceMxnAnnual: 85000,
  /** Fin de la oferta (fecha límite fija, 25 días desde el lanzamiento). */
  endsAt: '2026-07-25T23:59:59',
};

export interface PromoCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function promoEndsAtMs(): number {
  return new Date(PROMO.endsAt).getTime();
}

export function isPromoActive(nowMs: number = Date.now()): boolean {
  return nowMs < promoEndsAtMs();
}

export function promoTimeLeft(nowMs: number = Date.now()): PromoCountdown {
  const total = Math.max(0, promoEndsAtMs() - nowMs);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
    total,
  };
}

/** ¿Aplica la promo a este plan? (solo Profesional, mientras esté vigente). */
export function promoAppliesTo(planKey: PlanKey, nowMs: number = Date.now()): boolean {
  return planKey === PROMO.planKey && isPromoActive(nowMs);
}

export interface EffectivePrice {
  /** Precio de lista (sin promo). */
  list: number | null;
  /** Precio efectivo a cobrar (con promo si aplica). */
  price: number | null;
  /** % de descuento (0 si no hay promo). */
  discountPct: number;
  /** true si el precio mostrado es promocional. */
  promo: boolean;
}

/** Precio efectivo de un plan/ciclo, con la promo aplicada si corresponde. */
export function effectivePrice(plan: PlanDef, annual: boolean, nowMs: number = Date.now()): EffectivePrice {
  const list = annual ? plan.priceMxnAnnual : plan.priceMxn;
  if (list == null || !promoAppliesTo(plan.key, nowMs)) {
    return { list, price: list, discountPct: 0, promo: false };
  }
  const promoPrice = annual ? PROMO.promoPriceMxnAnnual : PROMO.promoPriceMxn;
  return {
    list,
    price: promoPrice,
    discountPct: Math.round((1 - promoPrice / list) * 100),
    promo: true,
  };
}
