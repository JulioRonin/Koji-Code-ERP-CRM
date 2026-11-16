/**
 * Color de marca (acento) de la empresa. El rediseño usa tinta (#16181D) para
 * botones y texto, y el color de la empresa solo como ACENTO (tarjetas
 * destacadas, punto activo, barra resaltada). Como el acento puede ser claro
 * (p. ej. lima), estas utilidades dan el color de texto legible encima y una
 * versión para texto sobre blanco.
 */
export const INK = '#16181D';
export const DEFAULT_ACCENT = '#E4F47C'; // Lima (default del rediseño)

/** Paletas sugeridas en Configuración (las del diseño). */
export const ACCENT_PRESETS = [
  { name: 'Lima', value: '#E4F47C' },
  { name: 'Bermellón', value: '#E2401F' },
  { name: 'Cobalto', value: '#2F5BEA' },
  { name: 'Turquesa', value: '#62CABF' },
];

export function isHex(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa (0 negro – 1 blanco). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mezcla con blanco (amount 0–1). */
export function tint(hex: string, amount: number): string {
  return '#' + rgb(hex).map(c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('');
}

/** Oscurece (amount 0–1). */
export function shadeDark(hex: string, amount: number): string {
  return '#' + rgb(hex).map(c => Math.round(c * (1 - amount)).toString(16).padStart(2, '0')).join('');
}

export function resolveAccent(color: string | null | undefined): string {
  return isHex(color) ? color : DEFAULT_ACCENT;
}

/** Texto legible SOBRE el acento (tinta en acentos claros, blanco en oscuros). */
export function accentInk(accent: string): string {
  return luminance(accent) > 0.45 ? INK : '#FFFFFF';
}

/** Versión del acento para usar como color de TEXTO/borde sobre blanco. */
export function accentOnWhite(accent: string): string {
  return luminance(accent) > 0.45 ? INK : accent;
}

/** Fondo suave del acento (para tarjetas destacadas). */
export function accentSoft(accent: string): string {
  return tint(accent, 0.55);
}
