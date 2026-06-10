import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Flag,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUpdateMasterPlanTaskProgress } from '@/lib/api';
import type { MasterPlanTask } from '@/types/database';
import { cn } from '@/lib/utils';

const DEPT_COLORS: Record<string, string> = {
  Compras:    '#7c3aed',
  Diseño:     '#0ea5e9',
  Producción: '#0369a1',
  Calidad:    '#15803d',
  Embarque:   '#0d9488',
};

const QUICK_VALUES = [0, 25, 50, 75, 100];

interface Props {
  tasks: MasterPlanTask[];
  onUpdated?: () => Promise<void> | void;
}

/**
 * Lista editable de actividades del Master Plan.
 * Click en cualquier fila → expande con slider y quick buttons de avance.
 * El avance del proyecto se recalcula automáticamente (ver useUpdateMasterPlanTaskProgress).
 */
export function MasterPlanTaskList({ tasks, onUpdated }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { update } = useUpdateMasterPlanTaskProgress();

  // Optimistic UI: progreso local mientras llega la respuesta
  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});

  const getProgress = (t: MasterPlanTask) => localProgress[t.id] ?? t.progress;

  const handleSet = async (task: MasterPlanTask, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setLocalProgress(prev => ({ ...prev, [task.id]: clamped }));
    setSavingId(task.id);
    try {
      await update(task.id, clamped);
      await onUpdated?.();
    } catch (err) {
      console.error('No se pudo actualizar el avance', err);
      // Revierte el optimistic
      setLocalProgress(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--color-app-text-muted)] text-center py-6">
        Sin actividades en el plan.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {tasks.map(task => {
        const progress = getProgress(task);
        const isExpanded = expandedId === task.id;
        const isSaving = savingId === task.id;
        const isDone = progress >= 100;
        const isInProgress = progress > 0 && progress < 100;
        const color = task.department ? DEPT_COLORS[task.department] : '#94a3b8';

        return (
          <div
            key={task.id}
            className={cn(
              'border rounded-md bg-white transition-colors',
              isDone
                ? 'border-[var(--color-app-success)]/30 bg-[var(--color-app-success-soft)]/30'
                : isInProgress
                ? 'border-[var(--color-app-primary)]/30'
                : 'border-[var(--color-app-border)]'
            )}
          >
            {/* Row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--color-app-surface-alt)]/40 transition-colors rounded-md"
            >
              {/* Status icon */}
              <div className="shrink-0">
                {isSaving ? (
                  <Loader2 className="h-5 w-5 text-[var(--color-app-primary)] animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-app-success)]" />
                ) : isInProgress ? (
                  <div className="relative h-5 w-5">
                    <Circle className="h-5 w-5 text-[var(--color-app-primary)]/30 absolute" />
                    <Circle
                      className="h-5 w-5 text-[var(--color-app-primary)] absolute"
                      style={{
                        clipPath: `inset(0 ${100 - progress}% 0 0)`,
                      }}
                    />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-[var(--color-app-text-subtle)]" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-[var(--color-app-text-muted)]">
                    {task.wbs_code}
                  </span>
                  {task.is_milestone && (
                    <Flag
                      className={cn(
                        'h-3 w-3 shrink-0',
                        isDone ? 'text-[var(--color-app-success)]' : 'text-[var(--color-app-warning)]'
                      )}
                    />
                  )}
                  {task.is_critical_path && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-danger)]"
                      title="Ruta crítica"
                    />
                  )}
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      isDone && 'text-[var(--color-app-text-muted)] line-through'
                    )}
                  >
                    {task.name}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-app-text-muted)]">
                  {task.department && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {task.department}
                    </span>
                  )}
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">
                    {format(parseISO(task.start_date), 'dd MMM', { locale: es })} –{' '}
                    {format(parseISO(task.end_date), 'dd MMM', { locale: es })}
                  </span>
                </div>
              </div>

              {/* Progress bar mini + % */}
              <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-xs font-medium tabular-nums w-9 text-right">{progress}%</span>
              </div>

              {/* % only on mobile */}
              <span className="sm:hidden text-xs font-medium tabular-nums w-9 text-right shrink-0">
                {progress}%
              </span>

              <ChevronDown
                className={cn(
                  'h-4 w-4 text-[var(--color-app-text-subtle)] shrink-0 transition-transform',
                  isExpanded && 'rotate-180'
                )}
              />
            </button>

            {/* Expanded controls */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-[var(--color-app-border)] space-y-3">
                {/* Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--color-app-text-muted)]">
                    <span>Avance</span>
                    <span className="font-medium text-[var(--color-app-text)]">{progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    onChange={e =>
                      setLocalProgress(prev => ({ ...prev, [task.id]: Number(e.target.value) }))
                    }
                    onMouseUp={e => handleSet(task, Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={e => handleSet(task, Number((e.target as HTMLInputElement).value))}
                    className="w-full accent-[var(--color-app-primary)]"
                  />
                </div>

                {/* Quick buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_VALUES.map(v => (
                    <button
                      key={v}
                      onClick={() => handleSet(task, v)}
                      className={cn(
                        'h-7 px-2.5 rounded-md border text-xs font-medium transition-colors',
                        progress === v
                          ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary)] text-white'
                          : 'border-[var(--color-app-border)] bg-white hover:border-[var(--color-app-primary)]/40'
                      )}
                    >
                      {v}%
                    </button>
                  ))}
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-app-text-muted)] pt-1">
                  <div>
                    <span className="block text-[10px] uppercase">Inicio</span>
                    <span className="text-[var(--color-app-text)] font-medium">
                      {format(parseISO(task.start_date), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Fin</span>
                    <span className="text-[var(--color-app-text)] font-medium">
                      {format(parseISO(task.end_date), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                  {task.dependencies && task.dependencies.length > 0 && (
                    <div className="col-span-2">
                      <span className="block text-[10px] uppercase mb-1">Depende de</span>
                      <div className="flex flex-wrap gap-1">
                        {task.dependencies.map(d => (
                          <Badge key={d} variant="outline" className="font-mono text-[10px]">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
