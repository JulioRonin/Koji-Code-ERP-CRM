import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Plus, X, CalendarRange, Trash2, CheckCircle2, Circle, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAddProjectTask, useUpdateProjectTask, useDeleteProjectTask } from '@/lib/api';
import type { ProjectTask, Department } from '@/types/database';
import { cn } from '@/lib/utils';

const DEPT_COLORS: Record<string, string> = {
  Compras:    '#7c3aed',
  Diseño:     '#0ea5e9',
  Producción: '#0369a1',
  Calidad:    '#15803d',
  Embarque:   '#0d9488',
};

const DEPARTMENTS: Department[] = ['Compras', 'Diseño', 'Producción', 'Calidad', 'Embarque'];

interface Props {
  projectId: string;
  tasks: ProjectTask[];
  onChanged?: () => Promise<void> | void;
}

export function AdHocTaskForm({ projectId, tasks, onChanged }: Props) {
  const { add, loading: adding } = useAddProjectTask();
  const { update } = useUpdateProjectTask();
  const { remove } = useDeleteProjectTask();

  const [draft, setDraft] = useState<{
    name: string;
    department: Department | '';
    start: string;
    duration: number;
  }>({
    name: '',
    department: '',
    start: format(new Date(), 'yyyy-MM-dd'),
    duration: 2,
  });
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!draft.name.trim()) return;
    setError(null);
    const start = draft.start;
    const end = format(addDays(new Date(draft.start), Math.max(0, draft.duration - 1)), 'yyyy-MM-dd');

    try {
      await add(projectId, {
        name: draft.name.trim(),
        department: draft.department || null,
        start_date: start,
        end_date: end,
        scheduled_date: start,
      });
      setDraft(prev => ({ ...prev, name: '' }));
      await onChanged?.();
    } catch (err) {
      setError((err as Error).message || 'No se pudo crear la tarea.');
    }
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statusFromProgress = (p: number): ProjectTask['status'] =>
    p >= 100 ? 'completed' : p > 0 ? 'in-progress' : 'pending';

  const handleSetProgress = async (task: ProjectTask, p: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(p)));
    setError(null);
    try {
      await update(task.id, { progress: clamped, status: statusFromProgress(clamped) });
      await onChanged?.();
    } catch (err) {
      setError((err as Error).message || 'No se pudo actualizar el progreso.');
    }
  };

  const handlePatchTask = async (
    task: ProjectTask,
    patch: Partial<Pick<ProjectTask, 'name' | 'department' | 'start_date' | 'end_date'>>
  ) => {
    setError(null);
    try {
      await update(task.id, patch);
      await onChanged?.();
    } catch (err) {
      setError((err as Error).message || 'No se pudo actualizar la tarea.');
    }
  };

  const handleDelete = async (taskId: string) => {
    await remove(taskId);
    await onChanged?.();
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-snug flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="space-y-2 p-3 rounded-md bg-[var(--color-app-surface-alt)]/40">
        <input
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Nombre de la tarea..."
          className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
              Departamento
            </label>
            <select
              value={draft.department}
              onChange={e => setDraft({ ...draft, department: e.target.value as Department | '' })}
              className="w-full h-9 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
            >
              <option value="">— Sin asignar —</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
              Inicio
            </label>
            <input
              type="date"
              value={draft.start}
              onChange={e => setDraft({ ...draft, start: e.target.value })}
              className="w-full h-9 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
              Duración (días)
            </label>
            <input
              type="number"
              min={1}
              value={draft.duration}
              onChange={e => setDraft({ ...draft, duration: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full h-9 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
            />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!draft.name.trim() || adding} size="sm" className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {adding ? 'Añadiendo...' : 'Añadir tarea'}
        </Button>
      </div>

      {/* List */}
      {tasks.length === 0 ? (
        <p className="text-xs text-[var(--color-app-text-muted)] text-center py-3">
          Sin tareas ad-hoc.
        </p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(task => {
            const color = task.department ? DEPT_COLORS[task.department] : '#94a3b8';
            const isOpen = expandedId === task.id;
            return (
              <div
                key={task.id}
                className={cn(
                  'rounded-md border bg-white transition-colors',
                  task.status === 'completed'
                    ? 'border-[var(--color-app-success)]/30 bg-[var(--color-app-success-soft)]/30'
                    : 'border-[var(--color-app-border)]'
                )}
              >
                <div className="flex items-center gap-2.5 p-2.5">
                  <button
                    onClick={() =>
                      handleSetProgress(task, task.progress >= 100 ? 0 : task.progress >= 50 ? 100 : 50)
                    }
                    className="shrink-0"
                    title="Avanzar / completar"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--color-app-success)]" />
                    ) : task.status === 'in-progress' ? (
                      <div className="h-4 w-4 rounded-full border-2 border-[var(--color-app-primary)] border-t-transparent animate-spin" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--color-app-text-subtle)]" />
                    )}
                  </button>

                  <button
                    onClick={() => setExpandedId(isOpen ? null : task.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        task.status === 'completed' && 'text-[var(--color-app-text-muted)] line-through'
                      )}
                    >
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-app-text-muted)] flex-wrap">
                      {task.department && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {task.department}
                        </span>
                      )}
                      {task.start_date && task.end_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarRange className="h-3 w-3" />
                          {task.start_date} → {task.end_date}
                        </span>
                      )}
                    </div>
                  </button>

                  <Badge variant="outline" className="shrink-0 hidden sm:inline-flex tabular-nums">
                    {task.progress}%
                  </Badge>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-[var(--color-app-text-subtle)] transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="shrink-0 p-1 text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--color-app-border)] p-3 space-y-3 bg-[var(--color-app-surface-alt)]/30">
                    {/* Progreso */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] uppercase tracking-wide text-[var(--color-app-text-muted)]">
                          Progreso
                        </label>
                        <span className="text-xs font-medium tabular-nums">{task.progress}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={task.progress}
                          onChange={e => handleSetProgress(task, Number(e.target.value))}
                          className="flex-1 accent-[var(--color-app-primary)]"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={task.progress}
                          onChange={e => handleSetProgress(task, Number(e.target.value) || 0)}
                          className="w-16 h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-sm text-right tabular-nums"
                        />
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        {[0, 25, 50, 75, 100].map(v => (
                          <button
                            key={v}
                            onClick={() => handleSetProgress(task, v)}
                            className={cn(
                              'text-[11px] px-2 py-0.5 rounded border tabular-nums',
                              task.progress === v
                                ? 'bg-[var(--color-app-primary)] text-white border-[var(--color-app-primary)]'
                                : 'bg-white border-[var(--color-app-border)] text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
                            )}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Datos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
                          Nombre
                        </label>
                        <input
                          defaultValue={task.name}
                          onBlur={e =>
                            e.target.value !== task.name && handlePatchTask(task, { name: e.target.value })
                          }
                          className="w-full h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
                          Departamento
                        </label>
                        <select
                          value={task.department ?? ''}
                          onChange={e =>
                            handlePatchTask(task, {
                              department: (e.target.value || null) as Department | null,
                            })
                          }
                          className="w-full h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-sm"
                        >
                          <option value="">— Sin asignar —</option>
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
                            Inicio
                          </label>
                          <input
                            type="date"
                            defaultValue={task.start_date ?? ''}
                            onBlur={e =>
                              e.target.value !== (task.start_date ?? '') &&
                              handlePatchTask(task, { start_date: e.target.value || null })
                            }
                            className="w-full h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
                            Fin
                          </label>
                          <input
                            type="date"
                            defaultValue={task.end_date ?? ''}
                            onBlur={e =>
                              e.target.value !== (task.end_date ?? '') &&
                              handlePatchTask(task, { end_date: e.target.value || null })
                            }
                            className="w-full h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
