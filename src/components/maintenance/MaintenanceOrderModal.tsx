import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Wrench, Play, CheckCircle2, CalendarClock, Printer, XCircle, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useUpsertMaintenanceOrder,
  useMarkTasksDone,
  useUpdateMachine,
  type MaintenanceOrderInput,
} from '@/lib/api';
import {
  addDays, dueLabel, dueState, FREQ_DAYS, MAX_REPROGRAM_DAYS, MTO_DOC, todayStr,
} from '@/lib/maintenance';
import type {
  Machine, MaintenanceOrder, MaintenanceOrderTask, MaintenanceOrderType, MaintenanceTask,
} from '@/types/database';
import { NcrFormModal } from '@/components/quality/NcrFormModal';
import { DUE_VARIANT, ORDER_STATUS_VARIANT } from './shared';

const SELECT = 'w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 disabled:opacity-60';

interface Props {
  open: boolean;
  onClose: () => void;
  order: MaintenanceOrder | null;
  machines: Machine[];
  tasks: MaintenanceTask[];
  defaultMachineId?: string | null;
  defaultType?: MaintenanceOrderType;
  onChanged?: () => void;
}

function emptyOrder(): MaintenanceOrderInput {
  return {
    machine_id: '',
    order_type: 'Preventivo',
    status: 'Programada',
    scheduled_date: todayStr(),
    original_date: null,
    reprogram_reason: null,
    problem: null,
    tasks: [],
    performed_by: null,
    loto_applied: false,
    loto_removed: false,
    findings: null,
    parts_used: null,
    downtime_hours: null,
    test_ok: false,
    affects_quality: false,
    first_piece_released: false,
    ncr_id: null,
    checklist_id: null,
    started_at: null,
    completed_at: null,
    created_by: null,
  };
}

/**
 * Orden de mantenimiento (PR-MTO-001 · FR-MTO-001 sección D): alta, ejecución
 * con bloqueo y etiquetado (LOTO), prueba, liga con Calidad y cierre.
 */
export function MaintenanceOrderModal({ open, onClose, order, machines, tasks, defaultMachineId, defaultType, onChanged }: Props) {
  const { user } = useAuth();
  const { company } = useCompany();
  const { run: saveOrder, loading } = useUpsertMaintenanceOrder();
  const { run: markDone } = useMarkTasksDone();
  const { update: updateMachine } = useUpdateMachine();

  const [form, setForm] = useState<MaintenanceOrderInput>(emptyOrder);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reprog, setReprog] = useState<{ open: boolean; date: string; reason: string }>({ open: false, date: '', reason: '' });
  const [ncrOpen, setNcrOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = !order;
  const machine = machines.find(m => m.id === form.machine_id) ?? null;
  const machineTasks = useMemo(() => tasks.filter(t => t.machine_id === form.machine_id && t.active), [tasks, form.machine_id]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setReprog({ open: false, date: '', reason: '' });
    if (order) {
      const { id: _i, created_at: _c, updated_at: _u, tenant_id: _t, ...rest } = order;
      setForm(rest);
    } else {
      setForm({ ...emptyOrder(), machine_id: defaultMachineId ?? machines[0]?.id ?? '', order_type: defaultType ?? 'Preventivo', created_by: user?.name ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  // Al crear una preventiva, preselecciona las tareas vencidas o por vencer.
  useEffect(() => {
    if (!isNew) return;
    setSelected(new Set(machineTasks.filter(t => dueState(t.next_due) !== 'ok').map(t => t.id)));
  }, [isNew, form.machine_id, machineTasks]);

  const set = <K extends keyof MaintenanceOrderInput>(k: K, v: MaintenanceOrderInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const setTask = (i: number, patch: Partial<MaintenanceOrderTask>) =>
    setForm(f => ({ ...f, tasks: f.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));

  const safeMachineStatus = async (status: 'Mantenimiento' | 'Disponible') => {
    try { await updateMachine(form.machine_id, { status }); } catch { /* sin permiso o demo: no bloquea la orden */ }
  };

  const persist = async (patch: Partial<MaintenanceOrderInput> = {}) => {
    const saved = await saveOrder(order?.id ?? null, { ...form, ...patch });
    onChanged?.();
    return saved;
  };

  // ── Alta ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setError(null);
    if (!form.machine_id) { setError('Selecciona el equipo.'); return; }
    if (!form.scheduled_date) { setError('Indica la fecha programada.'); return; }
    let orderTasks: MaintenanceOrderTask[] = [];
    if (form.order_type === 'Preventivo') {
      orderTasks = machineTasks.filter(t => selected.has(t.id)).map(t => ({ task_id: t.id, description: t.description, done: false, notes: null }));
      if (orderTasks.length === 0) { setError('Selecciona al menos una tarea del plan.'); return; }
    } else if (!form.problem?.trim()) {
      setError('Describe la falla o anomalía.'); return;
    }
    try {
      await saveOrder(null, { ...form, tasks: orderTasks, created_by: user?.name ?? null });
      onChanged?.();
      onClose();
    } catch (e) { setError((e as Error).message); }
  };

  // ── Transiciones ────────────────────────────────────────────────────────
  const handleStart = async () => {
    setError(null);
    try {
      const patch = { status: 'En proceso' as const, started_at: new Date().toISOString(), performed_by: form.performed_by || user?.name || null };
      await persist(patch);
      setForm(f => ({ ...f, ...patch }));
      await safeMachineStatus('Mantenimiento');
    } catch (e) { setError((e as Error).message); }
  };

  const handleSaveProgress = async () => {
    setError(null);
    try { await persist(); } catch (e) { setError((e as Error).message); }
  };

  const handleReprogram = async () => {
    setError(null);
    const base = form.scheduled_date ?? todayStr();
    const max = addDays(base, MAX_REPROGRAM_DAYS);
    if (!reprog.date || reprog.date <= base) { setError('La nueva fecha debe ser posterior a la programada.'); return; }
    if (reprog.date > max) { setError(`Máximo ${MAX_REPROGRAM_DAYS} días de reprogramación (hasta ${max}).`); return; }
    if (!reprog.reason.trim()) { setError('Indica el motivo de la reprogramación.'); return; }
    try {
      const patch = { original_date: base, scheduled_date: reprog.date, reprogram_reason: reprog.reason.trim() };
      await persist(patch);
      setForm(f => ({ ...f, ...patch }));
      setReprog({ open: false, date: '', reason: '' });
    } catch (e) { setError((e as Error).message); }
  };

  const handleCancel = async () => {
    if (!window.confirm('¿Cancelar esta orden de mantenimiento?')) return;
    try {
      const wasRunning = form.status === 'En proceso';
      await persist({ status: 'Cancelada' });
      if (wasRunning) await safeMachineStatus('Disponible');
      onClose();
    } catch (e) { setError((e as Error).message); }
  };

  const handleComplete = async () => {
    setError(null);
    const missing: string[] = [];
    if (!form.performed_by?.trim()) missing.push('quién realizó');
    if (!form.loto_applied) missing.push('bloqueo y etiquetado (LOTO) aplicado');
    if (form.order_type === 'Preventivo' && form.tasks.some(t => !t.done)) missing.push('todas las tareas realizadas');
    if (form.order_type === 'Correctivo' && !form.findings?.trim()) missing.push('hallazgos / causa de la falla');
    if (form.order_type === 'Correctivo' && (form.downtime_hours == null || Number.isNaN(form.downtime_hours))) missing.push('horas de paro');
    if (!form.test_ok) missing.push('prueba de funcionamiento');
    if (!form.loto_removed) missing.push('retiro del LOTO');
    if (form.affects_quality && !form.first_piece_released) missing.push('1a pieza liberada por Calidad');
    if (missing.length) { setError(`Para completar falta: ${missing.join(', ')}.`); return; }
    try {
      const today = todayStr();
      await persist({ status: 'Completada', completed_at: new Date().toISOString() });
      // Actualiza el plan: fecha de realización y próximo vencimiento.
      const updates = form.tasks
        .filter(t => t.done && t.task_id)
        .map(t => {
          const plan = tasks.find(p => p.id === t.task_id);
          return plan ? { id: plan.id, last_done: today, next_due: addDays(today, FREQ_DAYS[plan.frequency]) } : null;
        })
        .filter((u): u is { id: string; last_done: string; next_due: string } => !!u);
      await markDone(updates);
      await safeMachineStatus('Disponible');
      onChanged?.();
      onClose();
    } catch (e) { setError((e as Error).message); }
  };

  const printOrder = () => {
    const e = (s: unknown) => String(s ?? '—').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const brand = company.legal_name || company.commercial_name || 'KANRI';
    const yes = (b: boolean) => (b ? '☑' : '☐');
    const rows = form.tasks.map(t => `<tr><td>${yes(t.done)}</td><td>${e(t.description)}</td><td>${e(t.notes)}</td></tr>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(order?.id)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:24px;font-size:12px}h1{font-size:17px;margin:0}h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 6px;color:#374151;border-bottom:1px solid #111827;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #D1D5DB;padding:5px 7px;text-align:left;vertical-align:top}th{background:#F3F4F6}
.head{display:flex;justify-content:space-between;border-bottom:3px solid #111827;padding-bottom:8px}.sig{display:flex;gap:30px;margin-top:40px}.sig div{flex:1;border-top:1px solid #999;padding-top:4px;text-align:center;color:#374151}</style></head><body>
<div class="head"><div><h1>Orden de mantenimiento ${e(form.order_type.toLowerCase())}</h1><div>${e(brand)} · ${MTO_DOC.form} sección D · ${MTO_DOC.code}</div></div>
<div style="text-align:right"><b style="font-size:15px">${e(order?.id)}</b><div>Estatus: ${e(form.status)}</div></div></div>
<h2>Datos</h2><table><tr><th>Equipo</th><td>${e(form.machine_id)} · ${e(machine?.type)}</td><th>Fecha programada</th><td>${e(form.scheduled_date)}</td></tr>
<tr><th>Realizó</th><td>${e(form.performed_by)}</td><th>Horas de paro</th><td>${e(form.downtime_hours)}</td></tr>
${form.original_date ? `<tr><th>Reprogramada desde</th><td>${e(form.original_date)}</td><th>Motivo</th><td>${e(form.reprogram_reason)}</td></tr>` : ''}
${form.problem ? `<tr><th>Falla reportada</th><td colspan="3">${e(form.problem)}</td></tr>` : ''}</table>
<h2>Tareas</h2>${rows ? `<table><tr><th style="width:30px"></th><th>Tarea</th><th>Notas</th></tr>${rows}</table>` : '<p>—</p>'}
<h2>Ejecución</h2><table><tr><td>${yes(form.loto_applied)} LOTO aplicado</td><td>${yes(form.test_ok)} Prueba de funcionamiento correcta</td><td>${yes(form.loto_removed)} Se retiró el LOTO</td></tr>
<tr><td>${yes(form.affects_quality)} Afecta la calidad</td><td>${yes(form.first_piece_released)} 1a pieza liberada por Calidad</td><td>NCR: ${e(form.ncr_id)}</td></tr></table>
<h2>Hallazgos y refacciones</h2><table><tr><th style="width:25%">Hallazgos</th><td>${e(form.findings)}</td></tr><tr><th>Refacciones / materiales</th><td>${e(form.parts_used)}</td></tr></table>
<div class="sig"><div>Técnico / proveedor</div><div>Jefe de Producción</div><div>Calidad (si aplica)</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const status = form.status;
  const running = status === 'En proceso';
  const closed = status === 'Completada' || status === 'Cancelada';
  const canReprogram = status === 'Programada' && !form.original_date;
  const doneCount = form.tasks.filter(t => t.done).length;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--color-app-primary)]" />
            {isNew ? 'Nueva orden de mantenimiento' : <span className="font-mono">{order?.id}</span>}
            {!isNew && <Badge variant={ORDER_STATUS_VARIANT[status]}>{status}</Badge>}
            {!isNew && <Badge variant={form.order_type === 'Correctivo' ? 'destructive' : 'secondary'}>{form.order_type}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {MTO_DOC.form} sección D · {machine ? `${machine.id} · ${machine.type}` : 'Selecciona el equipo'}
          </DialogDescription>
        </DialogHeader>

        {isNew ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Equipo">
                <select className={SELECT} value={form.machine_id} onChange={e => set('machine_id', e.target.value)}>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.id} · {m.type}</option>)}
                </select>
              </Field>
              <Field label="Tipo">
                <select className={SELECT} value={form.order_type} onChange={e => set('order_type', e.target.value as MaintenanceOrderType)}>
                  <option value="Preventivo">Preventivo</option>
                  <option value="Correctivo">Correctivo</option>
                </select>
              </Field>
              <Field label="Fecha programada">
                <Input type="date" value={form.scheduled_date ?? ''} onChange={e => set('scheduled_date', e.target.value)} className="h-9" />
              </Field>
            </div>

            {form.order_type === 'Preventivo' ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-app-text-muted)]">Tareas del plan del equipo (preseleccionadas las vencidas o por vencer en 7 días):</p>
                {machineTasks.length === 0 ? (
                  <p className="text-sm text-center py-6 rounded-lg border border-dashed border-[var(--color-app-border)] text-[var(--color-app-text-muted)]">
                    Este equipo no tiene plan. Cárgalo en “Equipos y plan”.
                  </p>
                ) : (
                  <div className="rounded-lg border border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
                    {machineTasks.map(t => {
                      const st = dueState(t.next_due);
                      return (
                        <label key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer">
                          <span className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.has(t.id)}
                              onChange={e => setSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })}
                            />
                            {t.description}
                            <span className="text-[11px] text-[var(--color-app-text-muted)]">· {t.frequency}</span>
                          </span>
                          <Badge variant={DUE_VARIANT[st]} className="text-[10px] shrink-0">{dueLabel(t.next_due)}</Badge>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Field label="Falla o anomalía reportada *">
                <Textarea rows={3} value={form.problem ?? ''} onChange={e => set('problem', e.target.value || null)} placeholder="Qué falla presenta el equipo, desde cuándo, qué se observa…" />
              </Field>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Info label="Programada" value={form.scheduled_date ?? '—'} />
              <Info label="Reprogramada desde" value={form.original_date ?? '—'} />
              <Info label="Inicio" value={form.started_at ? new Date(form.started_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
              <Info label="Cierre" value={form.completed_at ? new Date(form.completed_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
            </div>
            {form.problem && (
              <div className="rounded-lg border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)]/30 p-3 text-sm whitespace-pre-line">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-app-text-muted)]">Falla reportada</p>
                {form.problem}
              </div>
            )}
            {form.reprogram_reason && <p className="text-xs text-[var(--color-app-text-muted)]">Motivo de reprogramación: {form.reprogram_reason}</p>}

            {canReprogram && reprog.open && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-[var(--color-app-warning)]/40 bg-[var(--color-app-warning-soft)]/20 p-3">
                <Field label={`Nueva fecha (máx. ${MAX_REPROGRAM_DAYS} días)`}>
                  <Input type="date" value={reprog.date} min={form.scheduled_date ?? undefined} max={form.scheduled_date ? addDays(form.scheduled_date, MAX_REPROGRAM_DAYS) : undefined} onChange={e => setReprog(r => ({ ...r, date: e.target.value }))} className="h-9" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Motivo (autoriza Jefe de Producción)">
                    <Input value={reprog.reason} onChange={e => setReprog(r => ({ ...r, reason: e.target.value }))} className="h-9" placeholder="Pedido urgente en la máquina, falta refacción…" />
                  </Field>
                </div>
              </div>
            )}

            {(running || closed) && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Realizó (técnico / proveedor) *">
                    <Input value={form.performed_by ?? ''} onChange={e => set('performed_by', e.target.value || null)} disabled={closed} className="h-9" />
                  </Field>
                  <Field label={form.order_type === 'Correctivo' ? 'Horas de paro *' : 'Horas de paro'}>
                    <Input type="number" min={0} step="0.25" value={form.downtime_hours ?? ''} onChange={e => set('downtime_hours', e.target.value === '' ? null : Number(e.target.value))} disabled={closed} className="h-9" />
                  </Field>
                  <div className="flex items-end">
                    <Check label="Bloqueo y etiquetado (LOTO) aplicado" checked={form.loto_applied} onChange={v => set('loto_applied', v)} disabled={closed} strong />
                  </div>
                </div>

                {form.tasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--color-app-text-muted)]">Tareas · {doneCount}/{form.tasks.length} realizadas</p>
                    <div className="rounded-lg border border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
                      {form.tasks.map((t, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2">
                          <label className={cn('flex items-center gap-2 text-sm flex-1', t.done && 'text-[var(--color-app-text-muted)] line-through')}>
                            <input type="checkbox" checked={t.done} onChange={e => setTask(i, { done: e.target.checked })} disabled={closed} />
                            {t.description}
                          </label>
                          <Input value={t.notes ?? ''} onChange={e => setTask(i, { notes: e.target.value || null })} placeholder="Notas" disabled={closed} className="h-8 sm:w-56" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={form.order_type === 'Correctivo' ? 'Hallazgos / causa de la falla *' : 'Hallazgos'}>
                    <Textarea rows={2} value={form.findings ?? ''} onChange={e => set('findings', e.target.value || null)} disabled={closed} />
                  </Field>
                  <Field label="Refacciones / materiales usados">
                    <Textarea rows={2} value={form.parts_used ?? ''} onChange={e => set('parts_used', e.target.value || null)} disabled={closed} />
                  </Field>
                </div>

                <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] p-3 space-y-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Check label="Prueba de funcionamiento correcta" checked={form.test_ok} onChange={v => set('test_ok', v)} disabled={closed} />
                    <Check label="Se retiró el LOTO" checked={form.loto_removed} onChange={v => set('loto_removed', v)} disabled={closed} />
                    <Check label="La intervención puede afectar la calidad de las piezas" checked={form.affects_quality} onChange={v => set('affects_quality', v)} disabled={closed} />
                  </div>
                  {form.affects_quality && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-app-border)] pt-2">
                      <Check label="1a pieza liberada por Calidad (PR-CAL-001, paso 3)" checked={form.first_piece_released} onChange={v => set('first_piece_released', v)} disabled={closed} strong />
                      {form.ncr_id ? (
                        <Badge variant="destructive">NCR {form.ncr_id}</Badge>
                      ) : (
                        !closed && (
                          <Button variant="outline" size="sm" onClick={() => setNcrOpen(true)}>
                            <AlertOctagon className="h-3.5 w-3.5 mr-1.5" /> Registrar NCR (producto afectado)
                          </Button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {!isNew && (
            <Button variant="outline" onClick={printOrder}><Printer className="h-4 w-4 mr-1.5" /> Imprimir</Button>
          )}
          <div className="flex-1" />
          {isNew && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={loading}>{loading ? 'Guardando…' : 'Crear orden'}</Button>
            </>
          )}
          {!isNew && status === 'Programada' && (
            <>
              <Button variant="outline" onClick={handleCancel}><XCircle className="h-4 w-4 mr-1.5" /> Cancelar orden</Button>
              {canReprogram && (
                reprog.open
                  ? <Button variant="outline" onClick={handleReprogram} disabled={loading}><CalendarClock className="h-4 w-4 mr-1.5" /> Confirmar reprogramación</Button>
                  : <Button variant="outline" onClick={() => setReprog(r => ({ ...r, open: true }))}><CalendarClock className="h-4 w-4 mr-1.5" /> Reprogramar</Button>
              )}
              <Button onClick={handleStart} disabled={loading}><Play className="h-4 w-4 mr-1.5" /> Iniciar</Button>
            </>
          )}
          {!isNew && running && (
            <>
              <Button variant="outline" onClick={handleCancel}>Cancelar orden</Button>
              <Button variant="outline" onClick={handleSaveProgress} disabled={loading}>Guardar avance</Button>
              <Button onClick={handleComplete} disabled={loading} className="bg-[var(--color-app-success)] hover:bg-[var(--color-app-success)]/90">
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Completar y liberar equipo
              </Button>
            </>
          )}
          {!isNew && closed && <Button variant="outline" onClick={onClose}>Cerrar</Button>}
        </DialogFooter>

        <NcrFormModal
          open={ncrOpen}
          onClose={() => setNcrOpen(false)}
          detectedArea="Producción"
          onCreated={async ncr => {
            set('ncr_id', ncr.id);
            try { await saveOrder(order?.id ?? null, { ...form, ncr_id: ncr.id }); onChanged?.(); } catch { /* se guarda al completar */ }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <label className="text-xs font-medium text-[var(--color-app-text-muted)]">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-app-border)] bg-white px-2.5 py-1.5">
      <p className="text-[10px] text-[var(--color-app-text-muted)]">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Check({ label, checked, onChange, disabled, strong }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; strong?: boolean;
}) {
  return (
    <label className={cn('flex items-center gap-2 text-sm', strong && 'font-medium')}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
      {label}
    </label>
  );
}
