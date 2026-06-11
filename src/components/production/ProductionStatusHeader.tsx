import React from 'react';
import { CheckCircle2, Clock, Target, Box } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
  const totalParts = productionItems.length;
  const assignedParts = productionItems.filter(b => b.manufacturing_status !== 'PENDIENTE').length;
  const finishedParts = productionItems.filter(b => b.manufacturing_status === 'TERMINADO').length;
  const progress = totalParts > 0 ? (finishedParts / totalParts) * 100 : 0;

  return (
    <Card className="p-0">
      <CardContent className="p-5">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          {/* Project selector */}
          <div className="w-full xl:w-1/3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-[var(--color-app-text-muted)]">
              <Target className="h-3.5 w-3.5" />
              <span>Monitoreo por proyecto</span>
            </div>
            <select
              value={selectedProjectId}
              onChange={e => onSelectProject(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm text-[var(--color-app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] transition-colors"
            >
              {projects.length === 0 && <option value="">No hay proyectos</option>}
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 w-full">
            <Kpi icon={Box}          label="Total piezas" value={totalParts}    suffix="items" />
            <Kpi icon={Clock}        label="Asignadas"    value={assignedParts} suffix="WIP" />
            <Kpi icon={CheckCircle2} label="Terminadas"   value={finishedParts} suffix="listo" tone="success" />
            <div className="space-y-2 rounded-md bg-[var(--color-app-surface-alt)] p-3 border border-[var(--color-app-border)]">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--color-app-text-muted)]">Progreso global</span>
                <span className="text-sm font-semibold">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
  tone?: 'success';
}) {
  return (
    <div className="rounded-md bg-[var(--color-app-surface-alt)] p-3 border border-[var(--color-app-border)]">
      <div className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={
            tone === 'success'
              ? 'text-xl font-semibold text-[var(--color-app-success)]'
              : 'text-xl font-semibold text-[var(--color-app-text)]'
          }
        >
          {value}
        </span>
        <span className="text-xs text-[var(--color-app-text-muted)]">{suffix}</span>
      </div>
    </div>
  );
}
