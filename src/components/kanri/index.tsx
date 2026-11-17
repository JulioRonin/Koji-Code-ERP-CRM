import type { CSSProperties, ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedValue, useAppeared } from './motion';

export { AnimatedValue, useAppeared, useCountUp, useMediaQuery } from './motion';

/* ─────────────────────────────────────────────────────────────────────────
   Kit visual del rediseño KANRI: tarjetas de indicador, paneles, encabezado,
   segmentos, chips y pastillas de estado. Todos con el mismo lenguaje:
   tarjetas blancas de 28–30 px, títulos Outfit ligeros, tinta y acento.
   ───────────────────────────────────────────────────────────────────────── */

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'gray';

export const TONE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  green: { bg: '#DDF3E4', fg: '#146C35', dot: '#15803D' },
  blue: { bg: '#E1E9FB', fg: '#1D46B8', dot: '#1D4ED8' },
  amber: { bg: '#FDF0D5', fg: '#8A4B06', dot: '#B45309' },
  red: { bg: '#FBE4E1', fg: '#9B1C1C', dot: '#B91C1C' },
  gray: { bg: '#ECEDF0', fg: '#474C55', dot: '#A3A8B1' },
};

/** Tono por estado (proyectos, máquinas, compras, calidad…). */
export function toneFor(status: string | null | undefined): Tone {
  const s = (status ?? '').toLowerCase();
  if (/cotiz|negoci|setup|solicit|pendiente de pago|parcial|vacacion|borrador de|por calibrar|media|ámbar|amber/.test(s)) return 'amber';
  if (/rechaz|vencid|paro|fuera|atrasad|cancelad.*no|alta|crítica|critica|incapac|error/.test(s)) return 'red';
  if (/mantenimiento|producci|operando|tránsito|transito|enviada|timbrada|en proceso|en calidad|proceso|programad.*no|info/.test(s)) return 'blue';
  if (/calidad|embarque|aprobad|recibid|pagad|liquidad|completad|terminad|activo|realizad|lista|ok|calibrado|entregado/.test(s)) return 'green';
  return 'gray';
}

/** Pastilla de estado con fondo suave. */
export function Pill({ children, tone = 'gray', dot = false, className, style }: {
  children: ReactNode; tone?: Tone; dot?: boolean; className?: string; style?: CSSProperties;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-xs whitespace-nowrap', className)}
      style={{ background: t.bg, color: t.fg, ...style }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />}
      {children}
    </span>
  );
}

/** Botón redondo con flecha ↗ (abrir módulo/detalle). */
export function ArrowButton({ to, onClick, label = 'Abrir', className }: { to?: string; onClick?: () => void; label?: string; className?: string }) {
  const cls = cn(
    'group/arrow h-10 w-10 shrink-0 rounded-full bg-[var(--color-app-surface-muted)] flex items-center justify-center transition-colors hover:bg-[var(--color-app-ink)] hover:text-white',
    className,
  );
  const icon = <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/arrow:rotate-45" strokeWidth={1.7} />;
  return to ? (
    <Link to={to} className={cls} aria-label={label} title={label}>{icon}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} aria-label={label} title={label}>{icon}</button>
  );
}

/** Panel/tarjeta de sección: título ligero + acciones a la derecha. */
export function Panel({ title, actions, children, className, tone = 'white', style, index, bodyClassName }: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'white' | 'accent' | 'accent-soft' | 'muted' | 'slate';
  style?: CSSProperties;
  /** Posición para escalonar la animación de entrada. */
  index?: number;
}) {
  const bg = {
    white: 'bg-white',
    accent: 'bg-[var(--color-app-accent)] text-[var(--color-app-accent-ink)]',
    'accent-soft': 'bg-[var(--color-app-accent-soft)]',
    muted: 'bg-[var(--color-app-surface-alt)]',
    slate: 'bg-[#E4E7EF]',
  }[tone];
  return (
    <section className={cn('k-rise rounded-[30px] p-6 min-w-0 flex flex-col', bg, className)} style={index != null ? { ...style, ['--i' as string]: index } : style}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-[22px] font-normal leading-tight tracking-[-0.01em] min-w-0">{title}</h2>}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn(title || actions ? 'mt-5' : '', 'flex-1 min-h-0 flex flex-col', bodyClassName)}>{children}</div>
    </section>
  );
}

export type StatTone = 'default' | 'accent' | 'accent-soft' | 'danger' | 'warning' | 'success' | 'muted';

/** Número grande ligero con unidad (el "scoreboard" del diseño). */
export function BigNumber({ value, unit, size = 'lg', className, fit = false }: {
  value: ReactNode; unit?: ReactNode; size?: 'md' | 'lg' | 'xl'; className?: string;
  /** Ajusta el tamaño al ancho disponible (el padre debe ser contenedor: `@container`). */
  fit?: boolean;
}) {
  const fs = { md: 'text-[32px]', lg: 'text-[40px] sm:text-[44px]', xl: 'text-[48px]' }[size];
  const max = { md: 32, lg: 44, xl: 48 }[size];
  // Largo del texto (cifra + unidad) para encogerlo y que nunca se salga de la tarjeta.
  const len = (typeof value === 'string' || typeof value === 'number' ? String(value).length : 4) + (typeof unit === 'string' ? unit.length * 0.45 : 0);
  const fitStyle = fit ? { fontSize: `min(${max}px, calc(168cqi / ${Math.max(len, 2.5)}))` } : undefined;
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-1 min-w-0', className)}>
      <span className={cn(!fit && fs, 'font-light leading-none tracking-[-0.02em] whitespace-nowrap')} style={fitStyle}>
        {typeof value === 'string' || typeof value === 'number' ? <AnimatedValue value={value} /> : value}
      </span>
      {unit && <span className="text-[18px] sm:text-[20px] text-[var(--color-app-text-subtle)] min-w-0">{unit}</span>}
    </div>
  );
}

/** Tendencia ↗ / ↘ en verde o rojo. */
export function Delta({ children, dir = 'up', good }: { children: ReactNode; dir?: 'up' | 'down' | 'flat'; good?: boolean }) {
  const ok = good ?? dir !== 'down';
  return (
    <span className={cn('text-[13px]', dir === 'flat' ? 'text-[var(--color-app-text-muted)]' : ok ? 'text-[#146C35]' : 'text-[#B91C1C]')}>
      {dir === 'up' ? '↗ ' : dir === 'down' ? '↘ ' : ''}{children}
    </span>
  );
}

/**
 * Tarjeta de indicador (KPI). El valor cuenta hasta su cifra al aparecer.
 * `tone` resalta: acento (lima), suave, rojo (atrasos), ámbar.
 */
export function StatTile({ label, value, unit, sub, icon: Icon, tone = 'default', index, onClick, className, progress }: {
  label: ReactNode;
  value: string | number;
  unit?: ReactNode;
  sub?: ReactNode;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: StatTone;
  index?: number;
  onClick?: () => void;
  className?: string;
  /** Barra de avance opcional (0–100) al pie de la tarjeta. */
  progress?: number;
}) {
  const t = {
    default: { bg: 'bg-white', label: 'text-[var(--color-app-text-muted)]', value: '' },
    muted: { bg: 'bg-[var(--color-app-surface-alt)]', label: 'text-[var(--color-app-text-muted)]', value: '' },
    accent: { bg: 'bg-[var(--color-app-accent)]', label: 'text-[var(--color-app-accent-ink)]', value: 'text-[var(--color-app-accent-ink)]' },
    'accent-soft': { bg: 'bg-[var(--color-app-accent-soft)]', label: 'text-[var(--color-app-text-muted)]', value: '' },
    danger: { bg: 'bg-[#FBE4E1]', label: 'text-[#9B1C1C]', value: 'text-[#9B1C1C]' },
    warning: { bg: 'bg-[#FDF0D5]', label: 'text-[#8A4B06]', value: 'text-[#8A4B06]' },
    success: { bg: 'bg-white', label: 'text-[var(--color-app-text-muted)]', value: 'text-[#146C35]' },
  }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'k-rise group relative text-left rounded-[24px] p-5 min-w-0 flex flex-col justify-between gap-3 min-h-[112px] transition-transform duration-300',
        onClick && 'hover:-translate-y-0.5',
        t.bg, className,
      )}
      style={index != null ? { ['--i' as string]: index } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-sm leading-tight min-w-0 break-words', t.label)}>{label}</span>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0 opacity-60', t.label)} strokeWidth={1.7} />}
      </div>
      <div className={cn('[container-type:inline-size]', t.value)}>
        <BigNumber value={value} unit={unit} fit />
        {sub && <div className={cn('mt-1.5 text-[13px] truncate', tone === 'default' || tone === 'muted' || tone === 'success' ? 'text-[var(--color-app-text-muted)]' : t.label)}>{sub}</div>}
        {progress != null && <ProgressLine pct={progress} className="mt-3" color={tone === 'accent' ? 'var(--color-app-accent-ink)' : undefined} />}
      </div>
    </Comp>
  );
}

/** Rejilla de indicadores que se adapta a la cantidad (2–6). */
export function StatGrid({ children, cols, className }: { children: ReactNode; cols?: number; className?: string }) {
  const c = cols ?? 4;
  const lg = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }[c] ?? 'lg:grid-cols-4';
  return <div className={cn('grid grid-cols-2 gap-3', lg, className)}>{children}</div>;
}

/** Encabezado de página: título grande, subtítulo y acciones (se acomoda en móvil). */
export function PageHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-5 gap-y-4', className)}>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-3 text-base text-[var(--color-app-text-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Control segmentado (pestañas en píldora). */
export function Segmented<T extends string>({ items, value, onChange, size = 'md', className }: {
  items: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full overflow-x-auto gap-1 rounded-full bg-[var(--color-app-surface-alt)] p-1', className)}>
      {items.map(it => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.id)}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-full transition-all duration-200',
              size === 'sm' ? 'h-9 px-3.5 text-sm' : 'h-11 px-5 text-[15px]',
              on ? 'bg-white text-[var(--color-app-text)] shadow-[0_1px_2px_rgba(22,24,29,.06)]' : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]',
            )}
          >
            {it.label}
            {it.count != null && <span className="font-mono text-[11px] text-[var(--color-app-text-subtle)]">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Chips de filtro (negro = activo). */
export function Chips<T extends string>({ items, value, onChange, className }: {
  items: { id: T; label: ReactNode; count?: number; tone?: Tone }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map(it => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={cn(
              'inline-flex items-center gap-2 h-10 px-4 rounded-full text-[15px] transition-colors',
              on ? 'bg-[var(--color-app-ink)] text-white' : 'bg-[var(--color-app-surface-alt)] hover:bg-[var(--color-app-border-strong)]/60',
            )}
          >
            {it.tone && <span className="h-[7px] w-[7px] rounded-full" style={{ background: TONE[it.tone].dot }} />}
            {it.label}
            {it.count != null && <span className={cn('font-mono text-[11px]', on ? 'text-white/60' : 'text-[var(--color-app-text-subtle)]')}>{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Barra horizontal que crece al aparecer (pipeline, cobranza, categorías). */
export function GrowBar({ pct, children, bg, fg, minPct = 14, delay = 0, height = 30 }: {
  pct: number; children?: ReactNode; bg: string; fg?: string; minPct?: number; delay?: number; height?: number;
}) {
  const ready = useAppeared();
  const w = Math.max(minPct, Math.min(100, pct));
  return (
    <div
      className="rounded-xl flex items-center px-2.5 font-mono text-sm overflow-hidden whitespace-nowrap"
      style={{
        height, background: bg, color: fg, width: ready ? `${w}%` : `${minPct}%`,
        transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Barra de progreso delgada en tinta que se llena al aparecer. */
export function ProgressLine({ pct, className, color = 'var(--color-app-ink)', delay = 0 }: { pct: number; className?: string; color?: string; delay?: number }) {
  const ready = useAppeared();
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-[#EEF0F3] overflow-hidden', className)}>
      <div
        className="h-full rounded-full"
        style={{ width: ready ? `${Math.max(0, Math.min(100, pct))}%` : 0, background: color, transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${delay}ms` }}
      />
    </div>
  );
}
