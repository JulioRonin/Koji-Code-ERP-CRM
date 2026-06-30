import type { DimensionalCharacteristic, DimensionalReading } from '@/types/database';

/** ¿Es una verificación por atributo (rosca/dowel, OK/NOK) en vez de cota? */
export function isAttribute(c: Pick<DimensionalCharacteristic, 'kind'>): boolean {
  return c.kind === 'rosca' || c.kind === 'dowel';
}

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

/** ¿La lectura cae dentro de los límites (o es OK en atributo)? null si falta
 *  información. */
export function readingPasses(
  c: Pick<DimensionalCharacteristic, 'nominal' | 'tolPlus' | 'tolMinus' | 'kind'>,
  reading: DimensionalReading
): boolean | null {
  if (reading == null) return null;
  // Rosca / dowel: pasa/no pasa directo.
  if (isAttribute(c)) {
    if (reading === 'OK') return true;
    if (reading === 'NOK') return false;
    return null;
  }
  if (typeof reading !== 'number') return null;
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

/** Texto compacto de la especificación. */
export function specText(c: DimensionalCharacteristic): string {
  if (isAttribute(c)) {
    const tipo = c.kind === 'rosca' ? 'Rosca' : 'Dowel';
    return `${tipo} · calibre pasa/no pasa`;
  }
  if (c.nominal == null) return '—';
  const plus = c.tolPlus == null ? '' : ` +${Math.abs(c.tolPlus)}`;
  const minus = c.tolMinus == null ? '' : ` -${Math.abs(c.tolMinus)}`;
  return `${c.nominal}${plus}${minus} ${c.unit}`.trim();
}
