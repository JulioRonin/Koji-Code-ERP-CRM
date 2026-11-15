import type { Quote } from '@/types/database';

/** Una cotización cuenta como venta cuando está aprobada o ya convertida. */
export function isWonQuote(q: Pick<Quote, 'status'>): boolean {
  return q.status === 'Aprobada' || q.status === 'Convertida';
}

/**
 * Fecha de la venta: cuándo se aprobó (approved_at, la fija la base al
 * aprobar). Si aún no se corre db/2026_quote_approved_at.sql, cae a
 * updated_at como antes.
 */
export function quoteSaleDate(q: Pick<Quote, 'approved_at' | 'updated_at' | 'created_at'>): Date {
  return new Date(q.approved_at || q.updated_at || q.created_at);
}
