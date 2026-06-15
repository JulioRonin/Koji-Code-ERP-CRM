import type { DimensionalCharacteristic } from '@/types/database';

/** Límites de especificación a partir de nominal + tolerancias (magnitudes). */
export function specLimits(c: Pick<DimensionalCharacteristic, 'nominal' | 'tolPlus' | 'tolMinus'>): {
  lsl: number | null;
  usl: number | null;
} {
  if (c.nominal == null) return { lsl: null, usl: null };
  const usl = c.tolPlus == null ? null : c.nominal + Math.abs(c.tolPlus);
  const lsl = c.tolMinus == null ? null : c.nominal - Math.abs(c.tolMinus);
  return { lsl, usl };
}

const EPS = 1e-9;

/** ¿La lectura cae dentro de los límites? null si no hay datos suficientes. */
export function readingPasses(
  c: Pick<DimensionalCharacteristic, 'nominal' | 'tolPlus' | 'tolMinus'>,
  reading: number | null
): boolean | null {
  if (reading == null) return null;
  const { lsl, usl } = specLimits(c);
  if (lsl == null && usl == null) return null;
  if (lsl != null && reading < lsl - EPS) return false;
  if (usl != null && reading > usl + EPS) return false;
  return true;
}

/** Resultado global de una característica: OK si todas las lecturas capturadas
 *  pasan; NG si alguna falla; null si aún no hay lecturas evaluables. */
export function characteristicResult(c: DimensionalCharacteristic): boolean | null {
  let any = false;
  for (const r of c.readings) {
    const res = readingPasses(c, r);
    if (res === false) return false;
    if (res === true) any = true;
  }
  return any ? true : null;
}

/** Texto compacto de la especificación, ej. "10.00 +0.05 / -0.05". */
export function specText(c: DimensionalCharacteristic): string {
  if (c.nominal == null) return '—';
  const plus = c.tolPlus == null ? '' : ` +${Math.abs(c.tolPlus)}`;
  const minus = c.tolMinus == null ? '' : ` -${Math.abs(c.tolMinus)}`;
  return `${c.nominal}${plus}${minus} ${c.unit}`.trim();
}
