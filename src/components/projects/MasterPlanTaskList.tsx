import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Flag,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  useUpdateMasterPlanTaskProgress,
  useUpdateMasterPlanTaskDates,
  useUpdateMasterPlanTaskDependencies,
} from '@/lib/api';
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
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null); // task.id que acaba de guardarse
  const { update } = useUpdateMasterPlanTaskProgress();
  const { update: updateDates, loading: savingDates } = useUpdateMasterPlanTaskDates();
  const { update: updateDeps } = useUpdateMasterPlanTaskDependencies();

  // Optimistic UI: progreso local mientras llega la respuesta
  const [localProgress, setLocalProgress] = useState<Record<string, number>>({});
  const [editingDates, setEditingDates] = useState<Record<string, { start: string; end: string }>>({});
  const [depBusyId, setDepBusyId] = useState<string | null>(null);

  // Quita una dependencia de una tarea y persiste.
  const handleRemoveDependency = async (task: MasterPlanTask, depWbs: string) => {
    setDepBusyId(task.id);
    setError(null);
    try {
      const next = (task.dependencies ?? []).filter(d => d !== depWbs);
      await updateDeps(task.id, next);
      await onUpdated?.();
    } catch (err) {
      setError((err as Error).message || 'No se pudo quitar la dependencia.');
    } finally {
      setDepBusyId(null);
    }
  };

  // Agrega una dependencia (otra actividad del plan) y persiste.
  const handleAddDependency = async (task: MasterPlanTask, depWbs: string) => {
    if (!depWbs) return;
    const current = task.dependencies ?? [];
    if (current.includes(depWbs)) return;
    setDepBusyId(task.id);
    setError(null);
    try {
      await updateDeps(task.id, [...current, depWbs]);
      await onUpdated?.();
    } catch (err) {
      setError((err as Error).message || 'No se pudo agregar la dependencia.');
    } finally {
      setDepBusyId(null);
    }
  };

  /** Duración en días entre dos fechas YYYY-MM-DD (inclusive). */
  const durationDays = (start: string, end: string): number => {
    try {
      const s = parseISO(start);
      const e = parseISO(end);
      return Math.max(1, differenceInCalendarDays(e, s));
    } catch {
      return 1;
    }
  };

  /** Helpers para sincronizar fechas al editar duración (mantiene start, ajusta end). */
  const setDuration = (taskId: string, currentStart: string, durationD: number) => {
    const start = parseISO(currentStart);
    const end = format(addDays(start, Math.max(1, durationD)), 'yyyy-MM-dd');
    setEditingDates(prev => ({
      ...prev,
      [taskId]: { start: currentStart, end },
    }));
  };

  /** Detecta si la nueva fecha de inicio viola alguna dependencia. */
  const violatesDependency = (task: MasterPlanTask, newStart: string): string | null => {
    if (!task.dependencies || task.dependencies.length === 0) return null;
    const newStartDate = parseISO(newStart);
    for (const depWbs of task.dependencies) {
      const dep = tasks.find(t => t.wbs_code === depWbs);
      if (!dep) continue;
      const depEnd = parseISO(dep.end_date);
      if (newStartDate < depEnd) {
        return `Depende de ${depWbs} que termina ${format(depEnd, 'dd MMM yyyy', { locale: es })}.`;
      }
    }
    return null;
  };

  const getProgress = (t: MasterPlanTask) => localProgress[t.id] ?? t.progress;

  const handleSaveDates = async (task: MasterPlanTask) => {
    const draft = editingDates[task.id];
    if (!draft) return;
    if (!draft.start || !draft.end) {
      setError('Captura fechas válidas de inicio y fin.');
      return;
    }
    if (new Date(draft.end) < new Date(draft.start)) {
      setError('La fecha de fin debe ser igual o posterior a la de inicio.');
      return;
    }
    if (draft.start === task.start_date.slice(0, 10) && draft.end === task.end_date.slice(0, 10)) {
      // No hay cambio real, solo descartamos el borrador
      setEditingDates(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      return;
    }
    setSavingId(task.id);
    setError(null);
    try {
      await updateDates(tasks, task.id, draft.start, draft.end);
      // Limpia el draft ANTES del refetch para que el nuevo valor venga del backend
      setEditingDates(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      await onUpdated?.();
      // Flash visual de éxito
      setSavedFlash(task.id);
      setTimeout(() => setSavedFlash(v => (v === task.id ? null : v)), 2200);
    } catch (err) {
      setError((err as Error).message || 'No se pudieron guardar las fechas.');
    } finally {
      setSavingId(null);
    }
  };

  const handleSet = async (task: MasterPlanTask, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setLocalProgress(prev => ({ ...prev, [task.id]: clamped }));
    setSavingId(task.id);
    setError(null);
    try {
      await update(task.id, clamped);
      await onUpdated?.();
    } catch (err) {
      console.error('No se pudo actualizar el avance', err);
      setError((err as Error).message || 'No se pudo guardar el avance.');
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
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-snug flex-1">{error}</div>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      )}
      {savedFlash && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-[var(--color-app-success-soft)] text-sm text-[var(--color-app-success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="leading-snug">Fechas actualizadas. Las dependientes se reacomodaron en automático.</span>
        </div>
      )}
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

                {/* Fechas y duración editables con cascada */}
                {(() => {
                  // Normalizar las fechas guardadas a yyyy-MM-dd (puede venir con hora)
                  const taskStart = task.start_date.slice(0, 10);
                  const taskEnd = task.end_date.slice(0, 10);
                  const currentStart = editingDates[task.id]?.start ?? taskStart;
                  const currentEnd = editingDates[task.id]?.end ?? taskEnd;
                  const currentDuration = durationDays(currentStart, currentEnd);
                  const hasChange = currentStart !== taskStart || currentEnd !== taskEnd;
                  const depViolation = hasChange ? violatesDependency(task, currentStart) : null;

                  return (
                    <div className="pt-3 border-t border-[var(--color-app-border)] space-y-2">
                      <p className="text-[10px] uppercase text-[var(--color-app-text-muted)] flex items-center justify-between">
                        Fechas y duración
                        <span className="text-[var(--color-app-text-subtle)] normal-case font-normal">
                          Cambiar mueve las dependientes automáticamente
                        </span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                            Inicio
                          </label>
                          <input
                            type="date"
                            value={currentStart}
                            onChange={e => {
                              const newStart = e.target.value;
                              // Mantén la duración actual al cambiar el inicio
                              const dur = durationDays(currentStart, currentEnd);
                              const newEnd = format(addDays(parseISO(newStart), dur), 'yyyy-MM-dd');
                              setEditingDates(prev => ({
                                ...prev,
                                [task.id]: { start: newStart, end: newEnd },
                              }));
                            }}
                            className="w-full h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                            Duración (días)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={currentDuration}
                            onChange={e => {
                              const days = Math.max(1, Number(e.target.value) || 1);
                              setDuration(task.id, currentStart, days);
                            }}
                            className="w-full h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                            Fin
                          </label>
                          <input
                            type="date"
                            value={currentEnd}
                            onChange={e =>
                              setEditingDates(prev => ({
                                ...prev,
                                [task.id]: { start: currentStart, end: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                          />
                        </div>
                      </div>

                      {depViolation && (
                        <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-app-warning)] bg-[var(--color-app-warning-soft)]/60 p-2 rounded-md">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                          <span>
                            <strong>Conflicto:</strong> {depViolation} Si guardas, la tarea iniciará antes de que termine su predecesora.
                          </span>
                        </div>
                      )}

                      {hasChange && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveDates(task)}
                            disabled={savingDates || savingId === task.id}
                            className="h-7 px-2.5 rounded-md text-xs font-medium bg-[var(--color-app-primary)] text-white hover:bg-[var(--color-app-primary-hover)] disabled:opacity-50"
                          >
                            {savingId === task.id ? 'Guardando…' : 'Guardar y propagar'}
                          </button>
                          <button
                            onClick={() =>
                              setEditingDates(prev => {
                                const next = { ...prev };
                                delete next[task.id];
                                return next;
                              })
                            }
                            disabled={savingId === task.id}
                            className="h-7 px-2.5 rounded-md text-xs font-medium border border-[var(--color-app-border)] hover:bg-[var(--color-app-surface-alt)] disabled:opacity-50"
                          >
                            Descartar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Dependencias — editables: quitar con la X, agregar con el selector */}
                <div className="pt-2 border-t border-[var(--color-app-border)]">
                  <span className="flex items-center justify-between text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
                    Depende de
                    {depBusyId === task.id && (
                      <Loader2 className="h-3 w-3 animate-spin text-[var(--color-app-primary)]" />
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {(task.dependencies ?? []).length === 0 && (
                      <span className="text-[10px] text-[var(--color-app-text-subtle)] italic">
                        Sin dependencias
                      </span>
                    )}
                    {(task.dependencies ?? []).map(d => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md border border-[var(--color-app-border)] bg-white font-mono text-[10px]"
                      >
                        {d}
                        <button
                          type="button"
                          onClick={() => handleRemoveDependency(task, d)}
                          disabled={depBusyId === task.id}
                          title={`Quitar dependencia ${d}`}
                          className="p-0.5 rounded hover:bg-[var(--color-app-danger-soft)] text-[var(--color-app-text-muted)] hover:text-[var(--color-app-danger)] disabled:opacity-50"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}

                    {/* Agregar dependencia: actividades del plan que aún no son dependencia
                        y que no son la propia tarea */}
                    {(() => {
                      const candidates = tasks.filter(
                        t =>
                          t.wbs_code !== task.wbs_code &&
                          !(task.dependencies ?? []).includes(t.wbs_code)
                      );
                      if (candidates.length === 0) return null;
                      return (
                        <select
                          value=""
                          onChange={e => {
                            handleAddDependency(task, e.target.value);
                            e.target.value = '';
                          }}
                          disabled={depBusyId === task.id}
                          className="h-6 px-1.5 rounded-md border border-dashed border-[var(--color-app-border-strong)] bg-white text-[10px] text-[var(--color-app-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 disabled:opacity-50"
                          title="Agregar dependencia"
                        >
                          <option value="">+ dependencia</option>
                          {candidates.map(c => (
                            <option key={c.id} value={c.wbs_code}>
                              {c.wbs_code} · {c.name.slice(0, 28)}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] text-[var(--color-app-text-subtle)] mt-1 leading-snug">
                    Quitar una dependencia libera la actividad; ajusta las fechas si lo necesitas.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
