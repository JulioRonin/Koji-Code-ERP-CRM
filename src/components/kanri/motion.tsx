import { useEffect, useRef, useState } from 'react';

/**
 * Movimiento sutil del rediseño: números que cuentan hasta su valor y barras
 * que crecen al aparecer. Respeta "reducir movimiento" del sistema.
 */

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Anima un número desde su valor anterior (o 0 al montar) hasta `target`. */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(prefersReducedMotion() ? target : 0);

  useEffect(() => {
    if (!Number.isFinite(target)) { setValue(target); return; }
    if (prefersReducedMotion()) { setValue(target); fromRef.current = target; return; }
    const from = fromRef.current;
    if (from === target) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (target - from) * easeOutCubic(t);
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = target;
    };
  }, [target, duration]);

  return value;
}

/** Parte un texto como "$1,284,560.00", "96.4 %" o "118 / 142" en prefijo/número/sufijo. */
function splitNumeric(text: string): { prefix: string; num: number; decimals: number; grouped: boolean; suffix: string } | null {
  const m = /^([^\d-]*?)(-?\d[\d,]*(?:\.\d+)?)([\s\S]*)$/.exec(text);
  if (!m) return null;
  const raw = m[2];
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  const num = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  return { prefix: m[1], num, decimals, grouped: raw.includes(','), suffix: m[3] };
}

/**
 * Muestra un valor (número o texto con número) contando hasta él. Conserva el
 * formato original: separador de miles, decimales, prefijo ($) y sufijo (%, pzs).
 */
export function AnimatedValue({ value, duration }: { value: string | number; duration?: number }) {
  const text = typeof value === 'number' ? value.toLocaleString('es-MX') : value;
  const parts = splitNumeric(text);
  const n = useCountUp(parts ? parts.num : 0, duration);
  if (!parts) return <>{text}</>;
  const shown = n.toLocaleString('en-US', {
    minimumFractionDigits: parts.decimals,
    maximumFractionDigits: parts.decimals,
    useGrouping: parts.grouped || Math.abs(parts.num) >= 10000,
  });
  return <>{parts.prefix}{shown}{parts.suffix}</>;
}

/** true un cuadro después de montar: permite transicionar de 0 → valor. */
export function useAppeared(): boolean {
  const [ready, setReady] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (ready) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, [ready]);
  return ready;
}
