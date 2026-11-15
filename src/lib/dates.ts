/**
 * Fechas "solo día" (YYYY-MM-DD) de la base: `new Date('2026-11-01')` las lee
 * como medianoche UTC, que en México (UTC-6) es el día ANTERIOR. Este helper
 * las interpreta en la zona local; timestamps completos pasan tal cual.
 */
export function toLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}
