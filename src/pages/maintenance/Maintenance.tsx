import { useMemo, useState, type ComponentType } from 'react';
import {
  Wrench, LayoutDashboard, ListChecks, ClipboardCheck, Settings2, Plus, Pencil, Trash2, Wand2,
  AlertTriangle, Timer, CalendarCheck, Gauge, Activity, CalendarClock, BookOpenCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useMachines,
  useMaintenanceTasks,
  useMaintenanceOrders,
  useMaintenanceChecklists,
  useUpsertMaintenanceTask,
  useDeleteMaintenanceTask,
  useBulkInsertMaintenanceTasks,
  useSetMachineFamily,
  type MaintenanceTaskInput,
} from '@/lib/api';
import {
  addDays, daysUntil, dueLabel, dueState, FAMILIES, familyLabel, FREQ_DAYS, FREQUENCIES, MTO_DOC, TEMPLATES, todayStr,
} from '@/lib/maintenance';
import type {
  EquipmentFamily, Machine, MaintenanceOrder, MaintenanceOrderStatus, MaintenanceOrderType, MaintenanceTask,
} from '@/types/database';
import { MaintenanceOrderModal } from '@/components/maintenance/MaintenanceOrderModal';
import { DailyChecklistModal } from '@/components/maintenance/DailyChecklistModal';
import { DUE_TEXT, DUE_VARIANT, effectiveFamily, nextDueFor, ORDER_STATUS_VARIANT } from '@/components/maintenance/shared';

const tabs = [
  { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard },
  { id: 'plan', label: 'Equipos y plan', icon: Settings2 },
  { id: 'orders', label: 'Órdenes', icon: ListChecks },
  { id: 'checklists', label: 'Checklist diario', icon: ClipboardCheck },
] as const;
type Tab = (typeof tabs)[number]['id'];

const SELECT = 'h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40';

/**
 * Mantenimiento preventivo (PR-MTO-001): plan por equipo, órdenes preventivas
 * y correctivas, checklist diario del operador (FR-MTO-001) e indicadores.
 */
export function Maintenance() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { data: machines, refetch: refetchMachines } = useMachines();
  const { data: tasks, refetch: refetchTasks, error: tasksError } = useMaintenanceTasks();
  const { data: orders, refetch: refetchOrders } = useMaintenanceOrders();
  const { data: checklists, refetch: refetchChecklists } = useMaintenanceChecklists();

  const [orderModal, setOrderModal] = useState<{ open: boolean; order: MaintenanceOrder | null; machineId?: string | null; type?: MaintenanceOrderType }>({ open: false, order: null });
  const [checkModal, setCheckModal] = useState<{ open: boolean; machineId?: string | null }>({ open: false });

  const refreshAll = async () => { await Promise.all([refetchTasks(), refetchOrders(), refetchChecklists(), refetchMachines()]); };

  const openOrder = (o: MaintenanceOrder) => setOrderModal({ open: true, order: o });
  const newOrder = (machineId?: string | null, type: MaintenanceOrderType = 'Preventivo') => setOrderModal({ open: true, order: null, machineId, type });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)] flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[var(--color-app-text-muted)]" /> Mantenimiento
          </h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Preventivo, correctivo y checklist diario de equipos · {MTO_DOC.code} / {MTO_DOC.form}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCheckModal({ open: true })}>
            <ClipboardCheck className="h-4 w-4 mr-1.5" /> Checklist de arranque
          </Button>
          <Button variant="outline" onClick={() => newOrder(null, 'Correctivo')}>
            <AlertTriangle className="h-4 w-4 mr-1.5" /> Reportar falla
          </Button>
          <Button onClick={() => newOrder(null, 'Preventivo')}>
            <Plus className="h-4 w-4 mr-1.5" /> Orden preventiva
          </Button>
        </div>
      </div>

      {tasksError && (
        <p className="text-sm rounded-md border border-[var(--color-app-warning)]/40 bg-[var(--color-app-warning-soft)]/30 px-3 py-2">{tasksError.message}</p>
      )}

      <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit max-w-full overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md whitespace-nowrap',
              tab === t.id ? 'bg-white text-[var(--color-app-text)] shadow-sm' : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <DashboardTab
          machines={machines} tasks={tasks} orders={orders} checklists={checklists}
          onChecklist={id => setCheckModal({ open: true, machineId: id })}
          onNewOrder={id => newOrder(id, 'Preventivo')}
          onOpenOrder={openOrder}
        />
      )}
      {tab === 'plan' && (
        <PlanTab machines={machines} tasks={tasks} onChanged={refreshAll} onNewOrder={id => newOrder(id, 'Preventivo')} />
      )}
      {tab === 'orders' && (
        <OrdersTab machines={machines} orders={orders} onOpen={openOrder} onNew={type => newOrder(null, type)} />
      )}
      {tab === 'checklists' && (
        <ChecklistsTab machines={machines} checklists={checklists} orders={orders} onNew={() => setCheckModal({ open: true })} onOpenOrder={openOrder} />
      )}

      <MaintenanceOrderModal
        open={orderModal.open}
        order={orderModal.order}
        machines={machines}
        tasks={tasks}
        defaultMachineId={orderModal.machineId}
        defaultType={orderModal.type}
        onClose={() => setOrderModal({ open: false, order: null })}
        onChanged={refreshAll}
      />
      <DailyChecklistModal
        open={checkModal.open}
        machines={machines}
        defaultMachineId={checkModal.machineId}
        onClose={() => setCheckModal({ open: false })}
        onSaved={refreshAll}
      />
    </div>
  );
}

// ============================================================================
// Tablero
// ============================================================================

function DashboardTab({ machines, tasks, orders, checklists, onChecklist, onNewOrder, onOpenOrder }: {
  machines: Machine[];
  tasks: MaintenanceTask[];
  orders: MaintenanceOrder[];
  checklists: import('@/types/database').MaintenanceChecklist[];
  onChecklist: (machineId: string) => void;
  onNewOrder: (machineId: string) => void;
  onOpenOrder: (o: MaintenanceOrder) => void;
}) {
  const today = todayStr();
  const month = today.slice(0, 7);

  const kpis = useMemo(() => {
    const prevMonth = orders.filter(o => o.order_type === 'Preventivo' && o.status !== 'Cancelada' && (o.scheduled_date ?? '').startsWith(month));
    const onTime = prevMonth.filter(o => o.status === 'Completada' && o.completed_at && o.completed_at.slice(0, 10) <= (o.scheduled_date ?? ''));
    const overdueTasks = tasks.filter(t => t.active && dueState(t.next_due) === 'overdue').length;
    const open = orders.filter(o => o.status === 'Programada' || o.status === 'En proceso').length;
    const correctiveDone = orders.filter(o => o.order_type === 'Correctivo' && o.status === 'Completada' && o.completed_at);
    const downtimeMonth = correctiveDone.filter(o => (o.completed_at ?? '').startsWith(month)).reduce((s, o) => s + (o.downtime_hours ?? 0), 0);
    const last90 = correctiveDone.filter(o => (daysUntil((o.completed_at ?? '').slice(0, 10)) ?? -999) >= -90);
    const mttr = last90.length ? last90.reduce((s, o) => s + (o.downtime_hours ?? 0), 0) / last90.length : null;
    return {
      compliance: prevMonth.length ? Math.round((onTime.length / prevMonth.length) * 100) : null,
      onTime: onTime.length, scheduled: prevMonth.length, overdueTasks, open, downtimeMonth, mttr, failures90: last90.length,
    };
  }, [orders, tasks, month]);

  const rows = useMemo(() => machines.map(m => {
    const next = nextDueFor(m.id, tasks);
    const last = checklists.find(c => c.machine_id === m.id) ?? null;
    const openOrder = orders.find(o => o.machine_id === m.id && (o.status === 'Programada' || o.status === 'En proceso')) ?? null;
    const planCount = tasks.filter(t => t.machine_id === m.id && t.active).length;
    return { m, next, state: planCount ? dueState(next) : ('unknown' as const), last, openOrder, planCount };
  }).sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999')), [machines, tasks, checklists, orders]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={CalendarCheck} label="Cumplimiento del programa" value={kpis.compliance == null ? '—' : `${kpis.compliance} %`}
          hint={kpis.scheduled ? `${kpis.onTime} de ${kpis.scheduled} a tiempo este mes` : 'sin preventivos este mes'}
          tone={kpis.compliance == null ? 'neutral' : kpis.compliance >= 95 ? 'success' : 'warning'} />
        <Kpi icon={AlertTriangle} label="Preventivos vencidos" value={String(kpis.overdueTasks)} hint="tareas del plan · meta 0" tone={kpis.overdueTasks > 0 ? 'danger' : 'success'} />
        <Kpi icon={ListChecks} label="Órdenes abiertas" value={String(kpis.open)} hint="programadas y en proceso" tone="neutral" />
        <Kpi icon={Timer} label="Paros no programados" value={`${kpis.downtimeMonth.toFixed(1)} h`} hint="correctivos este mes" tone={kpis.downtimeMonth > 0 ? 'warning' : 'neutral'} />
        <Kpi icon={Gauge} label="MTTR (90 días)" value={kpis.mttr == null ? '—' : `${kpis.mttr.toFixed(1)} h`} hint={`${kpis.failures90} falla(s) en 90 días`} tone="neutral" />
      </div>

      <Card className="p-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Estado de los equipos</CardTitle>
          <CardDescription>Próximo preventivo por equipo, último checklist de arranque y órdenes abiertas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {machines.length === 0 ? (
            <p className="text-sm text-center py-10 text-[var(--color-app-text-muted)]">Sin equipos. Dalos de alta en Producción → Parque de máquinas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipo</TableHead>
                  <TableHead className="hidden md:table-cell">Familia</TableHead>
                  <TableHead>Próximo preventivo</TableHead>
                  <TableHead className="hidden lg:table-cell">Último checklist</TableHead>
                  <TableHead className="hidden md:table-cell">Orden abierta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ m, next, state, last, openOrder, planCount }) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold">{m.id}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)]">{m.type} · {m.status === 'Fuera_Servicio' ? 'Fuera de servicio' : m.status}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{familyLabel(effectiveFamily(m))}</TableCell>
                    <TableCell>
                      <Badge variant={DUE_VARIANT[state]}>{DUE_TEXT[state]}</Badge>
                      <p className="text-[11px] text-[var(--color-app-text-muted)] mt-0.5">
                        {planCount ? `${next ?? '—'} · ${dueLabel(next)}` : 'Carga su plan en Equipos y plan'}
                      </p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {last ? (
                        <span className="inline-flex items-center gap-1.5">
                          {last.check_date}
                          <Badge variant={last.has_anomaly ? 'destructive' : 'success'} className="text-[10px]">{last.has_anomaly ? 'Anomalía' : 'OK'}</Badge>
                        </span>
                      ) : <span className="text-[var(--color-app-text-subtle)]">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {openOrder ? (
                        <button className="text-left" onClick={() => onOpenOrder(openOrder)}>
                          <span className="font-mono text-xs text-[var(--color-app-primary)] hover:underline">{openOrder.id}</span>
                          <p className="text-[11px] text-[var(--color-app-text-muted)]">{openOrder.order_type} · {openOrder.status}</p>
                        </button>
                      ) : <span className="text-[var(--color-app-text-subtle)] text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => onChecklist(m.id)}>
                          <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Checklist
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => onNewOrder(m.id)}>
                          <Wrench className="h-3.5 w-3.5 mr-1" /> Orden
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-app-border)] bg-white p-4 text-sm">
        <BookOpenCheck className="h-5 w-5 text-[var(--color-app-text-muted)] shrink-0 mt-0.5" />
        <div className="text-[var(--color-app-text-muted)]">
          <b className="text-[var(--color-app-text)]">{MTO_DOC.code} · {MTO_DOC.title}.</b> El operador llena el checklist de arranque
          ({MTO_DOC.form}) en cada turno; una anomalía genera una orden correctiva. Todo mantenimiento se hace con bloqueo y etiquetado
          (LOTO). Un preventivo se reprograma una sola vez y máximo 7 días. Si la intervención puede afectar la calidad, la máquina
          vuelve a producir solo con la 1a pieza liberada por Calidad (PR-CAL-001).
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; hint: string; tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const color = tone === 'success' ? 'var(--color-app-success)' : tone === 'warning' ? 'var(--color-app-warning)' : tone === 'danger' ? 'var(--color-app-danger)' : 'var(--color-app-text)';
  return (
    <div className="rounded-xl border border-[var(--color-app-border)] bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-app-text-muted)]"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</p>
      <p className="text-[10.5px] text-[var(--color-app-text-subtle)]">{hint}</p>
    </div>
  );
}

// ============================================================================
// Equipos y plan
// ============================================================================

function PlanTab({ machines, tasks, onChanged, onNewOrder }: {
  machines: Machine[]; tasks: MaintenanceTask[]; onChanged: () => void; onNewOrder: (machineId: string) => void;
}) {
  const [machineId, setMachineId] = useState<string>(machines[0]?.id ?? '');
  const [, setTick] = useState(0);
  const machine = machines.find(m => m.id === machineId) ?? machines[0] ?? null;
  const family = machine ? effectiveFamily(machine) : null;
  const machineTasks = useMemo(() => (machine ? tasks.filter(t => t.machine_id === machine.id) : []), [tasks, machine]);

  const { run: setFamily } = useSetMachineFamily();
  const { run: bulkInsert, loading: loadingTpl } = useBulkInsertMaintenanceTasks();
  const { run: removeTask } = useDeleteMaintenanceTask();
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: MaintenanceTask | null }>({ open: false, task: null });
  const [msg, setMsg] = useState<string | null>(null);

  const changeFamily = async (f: string) => {
    if (!machine) return;
    setMsg(null);
    try { await setFamily(machine.id, (f || null) as EquipmentFamily | null); setTick(t => t + 1); onChanged(); }
    catch (e) { setMsg((e as Error).message); }
  };

  const loadTemplate = async () => {
    if (!machine || !family) return;
    const tpl = TEMPLATES[family];
    if (!window.confirm(`Se agregarán ${tpl.length} tareas de la plantilla "${familyLabel(family)}" (PR-MTO-001, sección 8). La primera fecha de cada una se calcula desde hoy. ¿Continuar?`)) return;
    const base = machineTasks.length;
    const today = todayStr();
    try {
      await bulkInsert(tpl.map((t, i): MaintenanceTaskInput => ({
        machine_id: machine.id,
        description: t.description,
        level: t.level,
        frequency: t.frequency,
        performer: t.performer,
        last_done: null,
        next_due: addDays(today, FREQ_DAYS[t.frequency]),
        active: true,
        sort_order: base + i + 1,
      })));
      onChanged();
    } catch (e) { setMsg((e as Error).message); }
  };

  const handleDelete = async (t: MaintenanceTask) => {
    if (!window.confirm(`¿Eliminar la tarea "${t.description}" del plan?`)) return;
    try { await removeTask(t.id); onChanged(); } catch (e) { setMsg((e as Error).message); }
  };

  if (machines.length === 0) {
    return <p className="text-sm text-center py-10 text-[var(--color-app-text-muted)]">Sin equipos. Dalos de alta en Producción → Parque de máquinas.</p>;
  }

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4">
      <Card className="p-0 h-fit">
        <CardContent className="p-2 space-y-1">
          {machines.map(m => {
            const next = nextDueFor(m.id, tasks);
            const count = tasks.filter(t => t.machine_id === m.id && t.active).length;
            const st = count ? dueState(next) : 'unknown';
            return (
              <button
                key={m.id}
                onClick={() => setMachineId(m.id)}
                className={cn('w-full text-left rounded-md px-3 py-2 transition-colors', machine?.id === m.id ? 'bg-[var(--color-app-surface-alt)]' : 'hover:bg-[var(--color-app-surface-alt)]/60')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{m.id}</span>
                  <span className={cn('h-2 w-2 rounded-full', st === 'overdue' ? 'bg-[var(--color-app-danger)]' : st === 'due_soon' ? 'bg-[var(--color-app-warning)]' : st === 'ok' ? 'bg-[var(--color-app-success)]' : 'bg-[var(--color-app-border-strong)]')} />
                </div>
                <p className="text-[11px] text-[var(--color-app-text-muted)] truncate">{m.type} · {count} tarea(s)</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {machine && (
        <Card className="p-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base"><span className="font-mono">{machine.id}</span> · {machine.type}</CardTitle>
                <CardDescription>Plan de mantenimiento preventivo del equipo. Lo diario se revisa en el checklist de arranque.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className={SELECT} value={family ?? ''} onChange={e => changeFamily(e.target.value)} title="Familia de equipo">
                  <option value="">Familia…</option>
                  {FAMILIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <Button variant="outline" size="sm" className="h-9" onClick={loadTemplate} disabled={!family || loadingTpl}>
                  <Wand2 className="h-4 w-4 mr-1.5" /> Cargar plantilla
                </Button>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setTaskModal({ open: true, task: null })}>
                  <Plus className="h-4 w-4 mr-1.5" /> Tarea
                </Button>
                <Button size="sm" className="h-9" onClick={() => onNewOrder(machine.id)} disabled={machineTasks.length === 0}>
                  <Wrench className="h-4 w-4 mr-1.5" /> Orden preventiva
                </Button>
              </div>
            </div>
            {msg && <p className="text-sm text-[var(--color-app-danger)] mt-2">{msg}</p>}
          </CardHeader>
          <CardContent className="p-0">
            {machineTasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)] space-y-1">
                <p>Este equipo aún no tiene plan.</p>
                <p className="text-xs">{family ? 'Usa “Cargar plantilla” para arrancar con las tareas del PR-MTO-001.' : 'Primero asigna su familia de equipo.'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarea</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead className="hidden md:table-cell">Quién</TableHead>
                    <TableHead className="hidden md:table-cell">Última</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead className="w-20 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machineTasks.map(t => {
                    const st = dueState(t.next_due);
                    return (
                      <TableRow key={t.id} className={cn(!t.active && 'opacity-50')}>
                        <TableCell>
                          <p className="text-sm font-medium">{t.description}</p>
                          <p className="text-[11px] text-[var(--color-app-text-muted)]">{t.level}{!t.active && ' · inactiva'}</p>
                        </TableCell>
                        <TableCell className="text-sm">{t.frequency}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{t.performer}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{t.last_done ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={DUE_VARIANT[st]} className="text-[10px]">{dueLabel(t.next_due)}</Badge>
                          <p className="text-[11px] text-[var(--color-app-text-muted)]">{t.next_due ?? ''}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTaskModal({ open: true, task: t })}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-app-danger)]" onClick={() => handleDelete(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {machine && (
        <TaskModal
          open={taskModal.open}
          task={taskModal.task}
          machineId={machine.id}
          sortOrder={machineTasks.length + 1}
          onClose={() => setTaskModal({ open: false, task: null })}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

function TaskModal({ open, task, machineId, sortOrder, onClose, onSaved }: {
  open: boolean; task: MaintenanceTask | null; machineId: string; sortOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { run: save, loading } = useUpsertMaintenanceTask();
  const blank = (): MaintenanceTaskInput => ({
    machine_id: machineId, description: '', level: 'Preventivo', frequency: 'Mensual', performer: 'Técnico',
    last_done: null, next_due: addDays(todayStr(), FREQ_DAYS.Mensual), active: true, sort_order: sortOrder,
  });
  const [form, setForm] = useState<MaintenanceTaskInput>(blank);
  const [error, setError] = useState<string | null>(null);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      if (task) { const { id: _i, created_at: _c, updated_at: _u, tenant_id: _t, ...rest } = task; setForm(rest); }
      else setForm(blank());
    }
  }

  const set = <K extends keyof MaintenanceTaskInput>(k: K, v: MaintenanceTaskInput[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description.trim()) { setError('Describe la tarea.'); return; }
    try { await save(task?.id ?? null, { ...form, description: form.description.trim() }); onSaved(); onClose(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarea' : 'Nueva tarea del plan'}</DialogTitle>
          <DialogDescription>Frecuencia según el manual del fabricante.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Tarea *</label>
            <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ej. Cambio de aceite hidráulico" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Frecuencia</label>
              <select className={cn(SELECT, 'w-full')} value={form.frequency} onChange={e => {
                const f = e.target.value as MaintenanceTaskInput['frequency'];
                setForm(p => ({ ...p, frequency: f, next_due: task ? p.next_due : addDays(todayStr(), FREQ_DAYS[f]) }));
              }}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Nivel</label>
              <select className={cn(SELECT, 'w-full')} value={form.level} onChange={e => set('level', e.target.value as MaintenanceTaskInput['level'])}>
                <option value="Preventivo">Preventivo</option>
                <option value="Mayor">Mayor</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Quién</label>
              <select className={cn(SELECT, 'w-full')} value={form.performer} onChange={e => set('performer', e.target.value as MaintenanceTaskInput['performer'])}>
                <option value="Técnico">Técnico</option>
                <option value="Proveedor">Proveedor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Próxima fecha</label>
              <Input type="date" value={form.next_due ?? ''} onChange={e => set('next_due', e.target.value || null)} className="h-9" />
            </div>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} /> Activa
            </label>
          </div>
          {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Órdenes
// ============================================================================

function OrdersTab({ machines, orders, onOpen, onNew }: {
  machines: Machine[]; orders: MaintenanceOrder[]; onOpen: (o: MaintenanceOrder) => void; onNew: (type: MaintenanceOrderType) => void;
}) {
  const [status, setStatus] = useState<MaintenanceOrderStatus | 'ABIERTAS' | 'TODAS'>('ABIERTAS');
  const [type, setType] = useState<MaintenanceOrderType | 'TODOS'>('TODOS');
  const [machineId, setMachineId] = useState('');

  const rows = orders.filter(o => {
    if (status === 'ABIERTAS' && !(o.status === 'Programada' || o.status === 'En proceso')) return false;
    if (status !== 'ABIERTAS' && status !== 'TODAS' && o.status !== status) return false;
    if (type !== 'TODOS' && o.order_type !== type) return false;
    if (machineId && o.machine_id !== machineId) return false;
    return true;
  });

  return (
    <Card className="p-0">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Órdenes de mantenimiento</CardTitle>
            <CardDescription>Preventivas del plan y correctivas por falla o anomalía del checklist.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={SELECT} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              <option value="ABIERTAS">Abiertas</option>
              <option value="TODAS">Todas</option>
              {(['Programada', 'En proceso', 'Completada', 'Cancelada'] as const).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={SELECT} value={type} onChange={e => setType(e.target.value as typeof type)}>
              <option value="TODOS">Preventivo y correctivo</option>
              <option value="Preventivo">Preventivo</option>
              <option value="Correctivo">Correctivo</option>
            </select>
            <select className={SELECT} value={machineId} onChange={e => setMachineId(e.target.value)}>
              <option value="">Todos los equipos</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select>
            <Button variant="outline" size="sm" className="h-9" onClick={() => onNew('Correctivo')}>Correctiva</Button>
            <Button size="sm" className="h-9" onClick={() => onNew('Preventivo')}><Plus className="h-4 w-4 mr-1" /> Preventiva</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-sm text-center py-10 text-[var(--color-app-text-muted)]">{orders.length === 0 ? 'Sin órdenes de mantenimiento.' : 'Sin resultados para el filtro actual.'}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Programada</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="hidden md:table-cell">Realizó</TableHead>
                <TableHead className="hidden md:table-cell text-right">Paro (h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(o => {
                const late = o.status === 'Programada' && dueState(o.scheduled_date, 0) === 'overdue';
                return (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => onOpen(o)}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold">{o.machine_id}</p>
                      <p className="text-[11px] text-[var(--color-app-text-muted)] truncate max-w-[220px]">
                        {o.order_type === 'Correctivo' ? (o.problem ?? '').split('\n')[0] : `${o.tasks.length} tarea(s)`}
                      </p>
                    </TableCell>
                    <TableCell><Badge variant={o.order_type === 'Correctivo' ? 'destructive' : 'secondary'}>{o.order_type}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span className={cn(late && 'text-[var(--color-app-danger)] font-medium')}>{o.scheduled_date ?? '—'}</span>
                      {o.original_date && <span title={`Reprogramada desde ${o.original_date}`}><CalendarClock className="inline h-3.5 w-3.5 ml-1 text-[var(--color-app-warning)]" /></span>}
                      {late && <p className="text-[10px] text-[var(--color-app-danger)]">atrasada</p>}
                    </TableCell>
                    <TableCell><Badge variant={ORDER_STATUS_VARIANT[o.status]}>{o.status}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{o.performed_by ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-sm">{o.downtime_hours ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Checklist diario
// ============================================================================

function ChecklistsTab({ machines, checklists, orders, onNew, onOpenOrder }: {
  machines: Machine[];
  checklists: import('@/types/database').MaintenanceChecklist[];
  orders: MaintenanceOrder[];
  onNew: () => void;
  onOpenOrder: (o: MaintenanceOrder) => void;
}) {
  const [machineId, setMachineId] = useState('');
  const rows = checklists.filter(c => !machineId || c.machine_id === machineId);
  const machineType = (id: string) => machines.find(m => m.id === id)?.type ?? '';

  return (
    <Card className="p-0">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Checklist diario de arranque · {MTO_DOC.form}</CardTitle>
            <CardDescription>El operador lo llena en cada turno. Cada anomalía genera una orden correctiva.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={SELECT} value={machineId} onChange={e => setMachineId(e.target.value)}>
              <option value="">Todos los equipos</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select>
            <Button size="sm" className="h-9" onClick={onNew}><ClipboardCheck className="h-4 w-4 mr-1.5" /> Registrar checklist</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-sm text-center py-10 text-[var(--color-app-text-muted)]">Sin checklists registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="hidden md:table-cell">Operador</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="hidden md:table-cell">Orden correctiva</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(c => {
                const fails = c.items.filter(i => i.result === 'fail');
                const order = c.order_id ? orders.find(o => o.id === c.order_id) : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm whitespace-nowrap">{c.check_date}<p className="text-[11px] text-[var(--color-app-text-muted)]">{c.shift}</p></TableCell>
                    <TableCell><p className="font-mono text-xs font-semibold">{c.machine_id}</p><p className="text-[11px] text-[var(--color-app-text-muted)]">{machineType(c.machine_id)}</p></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{c.operator_name ?? '—'}</TableCell>
                    <TableCell className="max-w-sm">
                      <Badge variant={c.has_anomaly ? 'destructive' : 'success'}>{c.has_anomaly ? `${fails.length} anomalía(s)` : 'Todo OK'}</Badge>
                      {c.anomalies && <p className="text-[11px] text-[var(--color-app-text-muted)] mt-0.5 line-clamp-2">{c.anomalies}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {order ? (
                        <button onClick={() => onOpenOrder(order)} className="font-mono text-xs text-[var(--color-app-primary)] hover:underline">{order.id}</button>
                      ) : <span className="text-[var(--color-app-text-subtle)] text-sm">{c.order_id ?? '—'}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
