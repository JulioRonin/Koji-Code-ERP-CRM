import React from 'react';
import { CheckCircle2, Clock, Target, Box, ShieldCheck, Factory, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { BomItem, Project } from '@/types/database';

interface Props {
  projects: Project[];
  bomItems: BomItem[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
}

export function ProductionStatusHeader({
  projects,
  bomItems,
  selectedProjectId,
  onSelectProject,
}: Props) {
  // Sólo contamos piezas marcadas para fabricar (excluye hardware, consumibles, etc.)
  const productionItems = bomItems.filter(b => b.production_relevant !== false);
  const total = productionItems.length;

  const count = (s: string) => productionItems.filter(b => b.manufacturing_status === s).length;
  const pending = count('PENDIENTE');
  const wip = count('EN PROCESO');
  const quality = count('CALIDAD');
  const done = count('TERMINADO');
  const rejected = count('RECHAZADO');
  const assigned = productionItems.filter(b => b.assigned_technician_id != null).length;

  // ── Producción real: lo que YA salió de máquina = en calidad + terminado.
  //    Es el indicador real de avance productivo (dejó de estar en el piso).
  const realProduced = quality + done;
  const realPct = total > 0 ? Math.round((realProduced / total) * 100) : 0;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  // Segmentos de la barra de distribución (en orden del flujo de producción).
  const segments = [
    { key: 'PENDIENTE', label: 'Pendientes', value: pending, color: 'var(--color-app-text-muted)' },
    { key: 'EN PROCESO', label: 'En proceso', value: wip, color: 'var(--color-app-primary)' },
    { key: 'CALIDAD', label: 'En calidad', value: quality, color: 'var(--color-app-warning)' },
    { key: 'TERMINADO', label: 'Terminadas', value: done, color: 'var(--color-app-success)' },
    { key: 'RECHAZADO', label: 'Rechazadas', value: rejected, color: 'var(--color-app-danger)' },
  ].filter(s => s.value > 0);

  return (
    <Card className="p-0 overflow-hidden">
      <CardContent className="p-5">
        {/* Fila 1: selector + medidor radial de Producción real */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Project selector */}
          <div className="w-full lg:w-72 space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-app-text-muted)]">
              <Target className="h-3.5 w-3.5" />
              <span>Monitoreo por proyecto</span>
            </div>
            <select
              value={selectedProjectId}
              onChange={e => onSelectProject(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-app-border-strong)] bg-white text-sm text-[var(--color-app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] transition-colors"
            >
              {projects.length === 0 && <option value="">No hay proyectos</option>}
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-snug text-[var(--color-app-text-muted)]">
              <strong className="text-[var(--color-app-text)]">Producción real</strong> = piezas en
              calidad + terminadas (lo que ya salió de máquina).
            </p>
          </div>

          {/* Medidor radial protagonista: Producción real */}
          <div className="flex items-center gap-4 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] px-5 py-4 shrink-0">
            <RadialGauge percent={realPct} />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-app-text-muted)]">
                <Factory className="h-3.5 w-3.5" /> Producción real
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums text-[var(--color-app-text)]">{realProduced}</span>
                <span className="text-sm text-[var(--color-app-text-muted)]">/ {total} pzas</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 text-[var(--color-app-warning)]">
                  <ShieldCheck className="h-3 w-3" /> {quality} en calidad
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--color-app-success)]">
                  <CheckCircle2 className="h-3 w-3" /> {done} terminadas
                </span>
              </div>
            </div>
          </div>

          {/* KPIs secundarios */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
            <Kpi icon={Box}          tone="neutral"  label="Total piezas" value={total}    suffix="a fabricar" />
            <Kpi icon={Target}       tone="neutral"  label="Con técnico"  value={assigned} suffix={total > 0 ? `${Math.round((assigned / total) * 100)}%` : 'asignadas'} />
            <Kpi icon={Clock}        tone="primary"  label="En proceso"   value={wip}      suffix="WIP" />
            <Kpi icon={CheckCircle2} tone="success"  label="Terminadas"   value={done}     suffix={`${donePct}%`} />
          </div>
        </div>

        {/* Fila 2: barra segmentada del pipeline + leyenda */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--color-app-text-muted)]">Distribución del pipeline de producción</span>
            {rejected > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-app-danger)]">
                <XCircle className="h-3 w-3" /> {rejected} rechazada{rejected === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-app-surface-alt)]">
            {total === 0 ? (
              <div className="h-full w-full" />
            ) : (
              segments.map(s => (
                <div
                  key={s.key}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-300"
                  style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
                  title={`${s.label}: ${s.value}`}
                />
              ))
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { label: 'Pendientes', value: pending, color: 'var(--color-app-text-muted)' },
              { label: 'En proceso', value: wip, color: 'var(--color-app-primary)' },
              { label: 'En calidad', value: quality, color: 'var(--color-app-warning)' },
              { label: 'Terminadas', value: done, color: 'var(--color-app-success)' },
              { label: 'Rechazadas', value: rejected, color: 'var(--color-app-danger)' },
            ].map(l => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-app-text-muted)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label} <strong className="text-[var(--color-app-text)] tabular-nums">{l.value}</strong>
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Anillo de progreso SVG (autocontenido) para el % de producción real. */
function RadialGauge({ percent }: { percent: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-app-border)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--color-app-primary)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-[var(--color-app-text)]">{clamped}%</span>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix: string;
  tone: 'success' | 'primary' | 'neutral';
}) {
  const toneColor =
    tone === 'success'
      ? 'var(--color-app-success)'
      : tone === 'primary'
      ? 'var(--color-app-primary)'
      : 'var(--color-app-text)';
  const chipBg =
    tone === 'success'
      ? 'color-mix(in srgb, var(--color-app-success) 14%, transparent)'
      : tone === 'primary'
      ? 'color-mix(in srgb, var(--color-app-primary) 14%, transparent)'
      : 'var(--color-app-surface-alt)';

  return (
    <div className="rounded-xl bg-white p-3 border border-[var(--color-app-border)] flex items-center gap-3">
      <span
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: chipBg, color: toneColor }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-[var(--color-app-text-muted)] truncate">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums" style={{ color: toneColor }}>{value}</span>
          <span className="text-[11px] text-[var(--color-app-text-muted)]">{suffix}</span>
        </div>
      </div>
    </div>
  );
}
