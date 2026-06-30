import { useEffect, useState } from 'react';
import { Flame, Timer } from 'lucide-react';
import { PROMO, promoTimeLeft, isPromoActive, type PromoCountdown as TL } from '@/lib/saas';
import { cn } from '@/lib/utils';

/** Hook que recalcula el tiempo restante de la promo cada segundo. */
export function usePromoCountdown(): { active: boolean; tl: TL } {
  const [tl, setTl] = useState<TL>(() => promoTimeLeft());
  useEffect(() => {
    const id = setInterval(() => setTl(promoTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);
  return { active: tl.total > 0, tl };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Bloque numérico de un segmento del contador (dd / hh / mm / ss). */
function Seg({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono font-bold tabular-nums text-sm md:text-base leading-none">{pad(value)}</span>
      <span className="text-[9px] uppercase tracking-wider opacity-80">{label}</span>
    </div>
  );
}

/**
 * Barra de oferta con contador regresivo. Se muestra en todas las pantallas de
 * precios mientras la promo del plan Profesional esté vigente.
 */
export function PromoBanner({ className }: { className?: string }) {
  const { active, tl } = usePromoCountdown();
  if (!active) return null;
  const discount = Math.round((1 - PROMO.promoPriceMxn / 12000) * 100);

  return (
    <div
      className={cn(
        'rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-white',
        className,
      )}
      style={{ background: 'linear-gradient(90deg, var(--color-app-primary), var(--color-app-primary-hover))' }}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-center">
        <Flame className="h-4 w-4 shrink-0" />
        <span>
          {PROMO.label}: <strong>Profesional</strong> a{' '}
          <strong>${PROMO.promoPriceMxn.toLocaleString('es-MX')}/mes</strong>{' '}
          <span className="inline-block px-1.5 py-0.5 rounded bg-white/25 text-[11px] font-bold">−{discount}%</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 opacity-90" />
        <div className="flex items-center gap-2.5">
          <Seg value={tl.days} label="días" />
          <span className="opacity-60">:</span>
          <Seg value={tl.hours} label="hrs" />
          <span className="opacity-60">:</span>
          <Seg value={tl.minutes} label="min" />
          <span className="opacity-60">:</span>
          <Seg value={tl.seconds} label="seg" />
        </div>
      </div>
    </div>
  );
}

/** Versión compacta (chip) para encabezados pequeños. */
export function PromoCountdownChip({ className }: { className?: string }) {
  const { active, tl } = usePromoCountdown();
  if (!active) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white', className)}
      style={{ background: 'var(--color-app-primary)' }}
    >
      <Flame className="h-3.5 w-3.5" />
      Oferta termina en {tl.days}d {pad(tl.hours)}:{pad(tl.minutes)}:{pad(tl.seconds)}
    </span>
  );
}

export { isPromoActive };
