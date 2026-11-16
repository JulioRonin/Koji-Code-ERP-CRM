import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format, isSameMonth, startOfWeek, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Link2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowButton, BigNumber, Delta, GrowBar, PageHeader, Panel, Pill, ProgressLine, Segmented, TONE, toneFor, useAppeared,
} from '@/components/kanri';
import { ShareClientLinkModal } from '@/components/client-portal/ShareClientLinkModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFileDownloadUrl, useBomItems, useCorrectiveActions, useInspections, useInvoices, useMachines,
  useMaintenanceTasks, useNcrs, useProjectFiles, useProjects, useQuotes, useReceivablePayments,
} from '@/lib/api';
import { nextDueFor } from '@/components/maintenance/shared';
import { daysUntil } from '@/lib/maintenance';
import { canAccessPath, canSeeAmounts } from '@/lib/permissions';
import { toLocalDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { BomItem, Project, ProjectStatus, QualityInspection } from '@/types/database';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const STAGES: { status: ProjectStatus; label: string }[] = [
  { status: 'Diseño', label: 'Diseño' },
  { status: 'Compras', label: 'Compras' },
  { status: 'En Producción', label: 'Producción' },
  { status: 'Calidad', label: 'Calidad' },
  { status: 'Embarque', label: 'Embarque' },
];
const PIPE: { status: ProjectStatus; label: string }[] = [{ status: 'Cotización', label: 'Cotización' }, ...STAGES];
const active = (p: Project) => p.status !== 'Entregado' && p.status !== 'Cancelado';
const daysTo = (d: string) => Math.ceil((toLocalDate(d).getTime() - Date.now()) / 86_400_000);
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isDone = (b: BomItem) => b.manufacturing_status === 'TERMINADO' || b.manufacturing_status === 'CALIDAD';
const pieces = (b: BomItem) => Number(b.production_quantity ?? b.quantity ?? 0);

function shiftLabel(d = new Date()) {
  const h = d.getHours();
  return h >= 6 && h < 15 ? 'Turno matutino' : h >= 15 && h < 23 ? 'Turno vespertino' : 'Turno nocturno';
}

/** Tablero de planta (rediseño): proyecto destacado, producción, pipeline, alertas, calidad, máquinas, entregas y facturación. */
export function PlantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const showMoney = canSeeAmounts(user?.role, user?.isPlatformOwner);
  const can = (p: string) => canAccessPath(user?.role, p, user?.permissions);

  const { data: projects } = useProjects();
  const { data: bom } = useBomItems();
  const { data: inspections } = useInspections();
  const { data: ncrs } = useNcrs();
  const { data: capas } = useCorrectiveActions();
  const { data: machines } = useMachines();
  const { data: mtoTasks } = useMaintenanceTasks();

  // Semana visible (0 = actual, -1 = anterior…)
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => DAYS.map((_, i) => addDays(weekStart, i)), [weekStart]);
  const prevStart = addDays(weekStart, -7);
  const weekLabel = `${format(weekStart, 'd', { locale: es })}–${format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}`;
  const todayIdx = weekOffset === 0 ? (new Date().getDay() + 6) % 7 : -1;

  // ── Producción: piezas que llegaron a Calidad/Terminado por día ────────
  const production = useMemo(() => {
    const inRange = (from: Date) => {
      const to = addDays(from, 7);
      return bom.filter(b => isDone(b) && b.updated_at && new Date(b.updated_at) >= from && new Date(b.updated_at) < to);
    };
    const cur = inRange(weekStart);
    const prev = inRange(prevStart).reduce((s, b) => s + pieces(b), 0);
    const byDay = weekDays.map(d => cur.filter(b => dayKey(new Date(b.updated_at)) === dayKey(d)).reduce((s, b) => s + pieces(b), 0));
    const total = byDay.reduce((a, b) => a + b, 0);
    const delta = prev > 0 ? ((total - prev) / prev) * 100 : null;
    return { byDay, total, delta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bom, weekStart]);

  // ── Pipeline por etapa ─────────────────────────────────────────────────
  const pipeline = useMemo(() => {
    const act = projects.filter(active);
    const rows = PIPE.map(s => ({ ...s, n: act.filter(p => p.status === s.status).length }));
    const max = Math.max(1, ...rows.map(r => r.n));
    const newThisMonth = projects.filter(p => isSameMonth(new Date(p.created_at), new Date())).length;
    return { total: act.length, rows, max, newThisMonth };
  }, [projects]);

  // ── Calidad: aprobación por día de la semana ───────────────────────────
  const quality = useMemo(() => {
    const rate = (list: QualityInspection[]) => list.length ? (list.filter(i => i.result === 'Aprobado').length / list.length) * 100 : null;
    const inWeek = (from: Date) => inspections.filter(i => { const d = toLocalDate(i.inspection_date.slice(0, 10)); return d >= from && d < addDays(from, 7); });
    const cur = inWeek(weekStart);
    const prevRate = rate(inWeek(prevStart));
    const weekRate = rate(cur);
    const byDay = weekDays.map(d => rate(cur.filter(i => i.inspection_date.slice(0, 10) === dayKey(d))));
    const open = ncrs.filter(n => n.status !== 'Cerrada');
    const high = open.filter(n => n.severity === 'Alta' || n.severity === 'Crítica').length;
    const capaOpen = capas.filter(c => c.status !== 'Cerrada' && c.status !== 'Cancelada').length;
    return { weekRate, prevRate, byDay, open: open.length, high, capaOpen, count: cur.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspections, ncrs, capas, weekStart]);

  // ── Máquinas ───────────────────────────────────────────────────────────
  const fleet = useMemo(() => {
    const total = machines.length;
    const operando = machines.filter(m => m.status === 'Operando').length;
    const setup = machines.filter(m => m.status === 'Setup').length;
    const paro = machines.filter(m => m.status === 'Mantenimiento' || m.status === 'Fuera_Servicio').length;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return { total, operando, setup, paro, disponibles: total - operando - setup - paro, pOp: pct(operando), pSet: pct(setup), pParo: pct(paro) };
  }, [machines]);

  // ── Alertas ────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const out: { id: string; title: string; detail: string; tone: 'red' | 'amber'; to: string }[] = [];
    machines.filter(m => m.status === 'Fuera_Servicio' || m.status === 'Mantenimiento').forEach(m =>
      out.push({ id: 'm-' + m.id, title: m.status === 'Fuera_Servicio' ? 'Máquina parada' : 'Máquina en mantenimiento', detail: `${m.id} · ${m.type}`, tone: m.status === 'Fuera_Servicio' ? 'red' : 'amber', to: '/maintenance' }));
    ncrs.filter(n => n.status !== 'Cerrada' && (n.severity === 'Alta' || n.severity === 'Crítica')).forEach(n =>
      out.push({ id: 'n-' + n.id, title: `NCR ${n.severity.toLowerCase()} · ${n.project_id}`, detail: n.issue_description, tone: 'red', to: '/quality' }));
    machines.forEach(m => {
      const due = nextDueFor(m.id, mtoTasks);
      const d = daysUntil(due);
      if (due && d != null && d <= 3) out.push({ id: 'p-' + m.id, title: d < 0 ? 'Preventivo vencido' : d === 0 ? 'Preventivo hoy' : `Preventivo en ${d} día${d === 1 ? '' : 's'}`, detail: `${m.id} · ${format(toLocalDate(due), 'd MMM yyyy', { locale: es })}`, tone: d < 0 ? 'red' : 'amber', to: '/maintenance' });
    });
    projects.filter(active).forEach(p => {
      const d = daysTo(p.deadline);
      if (d <= 3) out.push({ id: 'd-' + p.id, title: d < 0 ? `Entrega vencida · ${p.id}` : `Entrega en ${d} día${d === 1 ? '' : 's'}`, detail: `${p.name} · ${p.client_name}`, tone: d < 0 ? 'red' : 'amber', to: `/projects/${p.id}` });
    });
    return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'red' ? -1 : 1));
  }, [machines, ncrs, mtoTasks, projects]);

  return (
    <div>
      <PageHeader
        title="Tablero de planta"
        subtitle={`${format(new Date(), "EEEE d MMM yyyy", { locale: es }).replace(/^./, c => c.toUpperCase())} · ${shiftLabel()}`}
        actions={
          <>
            <div className="flex items-center h-[52px] rounded-full bg-[var(--color-app-surface-alt)] p-1">
              <button onClick={() => setWeekOffset(w => w - 1)} className="h-11 w-11 rounded-full hover:bg-white flex items-center justify-center" aria-label="Semana anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[15px] whitespace-nowrap">{weekLabel}</span>
              <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset === 0} className="h-11 w-11 rounded-full hover:bg-white disabled:opacity-30 flex items-center justify-center" aria-label="Semana siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {can('/pmo') && <Button variant="outline" size="lg" onClick={() => navigate('/pmo')}>Crear reporte</Button>}
            {can('/projects') && (
              <Button size="lg" onClick={() => navigate('/projects/new')}><Plus className="h-4 w-4 mr-1.5" /> Nuevo proyecto</Button>
            )}
          </>
        }
      />

      <div className="mt-9 k-dash-wrap"><div className="k-dash">
        {/* A · Proyecto destacado */}
        <FeaturedProject projects={projects} canOpen={can('/projects')} />

        {/* B · Producción */}
        <Panel title="Producción" index={1} actions={can('/production') && <ArrowButton to="/production" label="Abrir Producción" />} className="min-h-[360px]">
          <p className="text-sm text-[var(--color-app-text-muted)]">Piezas terminadas {weekOffset === 0 ? 'esta semana' : 'en la semana'}</p>
          <BigNumber value={production.total.toLocaleString('en-US')} unit="pzs" size="xl" className="mt-1" />
          <div className="mt-1.5">
            {production.delta == null ? <Delta dir="flat">Sin datos de la semana anterior</Delta>
              : <Delta dir={production.delta >= 0 ? 'up' : 'down'}>{Math.abs(production.delta).toFixed(1)} % vs. semana anterior</Delta>}
          </div>
          <WeekBars values={production.byDay} highlight={todayIdx >= 0 ? todayIdx : production.byDay.indexOf(Math.max(...production.byDay))} />
        </Panel>

        {/* C · Pipeline */}
        <Panel title="Pipeline por etapa" index={2} actions={can('/projects') && <ArrowButton to="/projects" label="Abrir Proyectos" />} className="min-h-[360px]">
          <p className="text-sm text-[var(--color-app-text-muted)]">Proyectos activos</p>
          <BigNumber value={pipeline.total} size="xl" className="mt-1" />
          <div className="mt-1.5"><Delta dir={pipeline.newThisMonth ? 'up' : 'flat'}>{pipeline.newThisMonth} nuevo{pipeline.newThisMonth === 1 ? '' : 's'} este mes</Delta></div>
          <div className="mt-auto pt-5 space-y-1.5">
            {pipeline.rows.map((r, i) => {
              const t = TONE[toneFor(r.label === 'Producción' ? 'producción' : r.label)];
              return (
                <div key={r.status} className="grid grid-cols-[86px_1fr] items-center gap-2.5">
                  <span className="text-[13px] text-[#474C55]">{r.label}</span>
                  <GrowBar pct={(r.n / pipeline.max) * 100} bg={t.bg} fg={t.fg} delay={i * 70} minPct={18}>{r.n}</GrowBar>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* D · Alertas */}
        <AlertsPanel alerts={alerts} />

        {/* E · Calidad */}
        <Panel index={4} className="k-e min-h-[300px]">
          <div className="flex flex-wrap gap-6 h-full">
            <div className="flex-[1_1_200px] flex flex-col">
              <h2 className="text-[22px] font-normal leading-tight">Calidad</h2>
              <p className="mt-6 text-sm text-[var(--color-app-text-muted)]">Aprobación QA · semana</p>
              {quality.weekRate == null ? (
                <p className="mt-2 text-[15px] text-[var(--color-app-text-muted)]">Sin inspecciones en la semana.</p>
              ) : (
                <>
                  <BigNumber value={quality.weekRate.toFixed(1)} unit="%" size="xl" className="mt-1" />
                  <div className="mt-1.5">
                    {quality.prevRate == null ? <Delta dir="flat">{quality.count} inspecciones</Delta>
                      : <Delta dir={quality.weekRate >= quality.prevRate ? 'up' : 'down'}>{Math.abs(quality.weekRate - quality.prevRate).toFixed(1)} pts vs. semana anterior</Delta>}
                  </div>
                </>
              )}
              <div className="mt-auto pt-5 space-y-1.5">
                <button onClick={() => can('/quality') && navigate('/quality')} className="w-full flex items-center gap-3 rounded-[14px] bg-[var(--color-app-surface-muted)] px-3.5 py-2.5 text-left hover:bg-[var(--color-app-surface-alt)] transition-colors">
                  <span className="text-lg font-mono">{quality.open}</span><span className="text-sm text-[#474C55]">NCR abiertas</span>
                  {quality.high > 0 && <span className="ml-auto text-xs text-[#B91C1C]">{quality.high} alta</span>}
                </button>
                <div className="flex items-center gap-3 rounded-[14px] bg-[var(--color-app-surface-muted)] px-3.5 py-2.5">
                  <span className="text-lg font-mono">{quality.capaOpen}</span><span className="text-sm text-[#474C55]">CAPA en curso</span>
                </div>
              </div>
            </div>
            <div className="flex-[2_1_280px] flex flex-col min-h-[220px]">
              <div className="flex justify-end">{can('/quality') && <ArrowButton to="/quality" label="Abrir Calidad" />}</div>
              <QaLine values={quality.byDay} />
            </div>
          </div>
        </Panel>

        {/* F · Máquinas */}
        <Panel title="Máquinas" index={5} actions={can('/production') && <ArrowButton to="/production" label="Piso de fábrica" />} className="min-h-[300px]">
          {fleet.total === 0 ? (
            <p className="text-sm text-[var(--color-app-text-muted)]">Sin máquinas registradas.</p>
          ) : (
            <>
              <Bubbles op={fleet.pOp} setup={fleet.pSet} paro={fleet.pParo} />
              <div className="grid grid-cols-3 mt-3">
                {[['Operando', fleet.operando], ['Setup', fleet.setup], ['Paro', fleet.paro]].map(([l, n], i) => (
                  <div key={l as string} className={cn('flex flex-col gap-0.5', i > 0 && 'border-l border-[#E7E9ED] pl-3')}>
                    <BigNumber value={n as number} size="md" />
                    <span className="text-[13px] text-[var(--color-app-text-muted)]">{l}</span>
                  </div>
                ))}
              </div>
              {fleet.disponibles > 0 && <p className="mt-2 text-xs text-[var(--color-app-text-subtle)]">{fleet.disponibles} disponible{fleet.disponibles === 1 ? '' : 's'}</p>}
            </>
          )}
        </Panel>

        {/* G · Próximas entregas */}
        <DeliveriesPanel projects={projects} showMoney={showMoney} className={showMoney ? 'k-g' : 'k-g-full'} />

        {/* H · Facturación (solo roles con montos) */}
        {showMoney && can('/billing') && <BillingPanel />}
      </div></div>
    </div>
  );
}

/* ── A · Proyecto destacado ─────────────────────────────────────────────── */
function FeaturedProject({ projects, canOpen }: { projects: Project[]; canOpen: boolean }) {
  const navigate = useNavigate();
  const list = useMemo(
    () => projects.filter(active).sort((a, b) => toLocalDate(a.deadline).getTime() - toLocalDate(b.deadline).getTime()),
    [projects],
  );
  const [id, setId] = useState<string | null>(null);
  const p = list.find(x => x.id === id) ?? list.find(x => x.status === 'En Producción') ?? list[0] ?? null;
  const [share, setShare] = useState(false);
  const { data: bom } = useBomItems(p?.id);
  const { data: files } = useProjectFiles(p?.id);
  const [img, setImg] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setImg(null);
    const f = files.find(x => x.category === 'Foto' || x.mime_type?.startsWith('image/'));
    if (f) getFileDownloadUrl(f.storage_path).then(u => { if (!cancel) setImg(u); });
    return () => { cancel = true; };
  }, [files]);

  if (!p) {
    return (
      <Panel title="Proyecto" tone="slate" className="k-a min-h-[560px]" index={0}>
        <p className="text-sm text-[var(--color-app-text-muted)]">No hay proyectos activos.</p>
      </Panel>
    );
  }

  const prodParts = bom.filter(b => b.production_relevant !== false);
  const done = prodParts.filter(b => b.manufacturing_status === 'TERMINADO').length;
  const stageIdx = p.status === 'Entregado' ? 5 : STAGES.findIndex(s => s.status === p.status);
  const days = daysTo(p.deadline);

  return (
    <section className="k-rise k-a rounded-[30px] bg-[#E4E7EF] flex flex-col overflow-hidden min-h-[560px]" style={{ ['--i' as string]: 0 }}>
      <div className="px-6 pt-6 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-normal">Proyecto</h2>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 h-10 px-3.5 rounded-full bg-white font-mono text-xs whitespace-nowrap hover:bg-[var(--color-app-surface-muted)] transition-colors">
            {p.id} <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            {list.map(x => (
              <DropdownMenuItem key={x.id} onClick={() => setId(x.id)} className="flex-col items-start gap-0">
                <span className="font-mono text-[11px] text-[var(--color-app-text-muted)]">{x.id}</span>
                <span>{x.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className="mx-6 mt-4 flex-1 min-h-[180px] rounded-[22px] flex items-end p-3.5 bg-cover bg-center"
        style={img ? { backgroundImage: `url(${img})` } : { background: 'repeating-linear-gradient(135deg,#D6DAE4 0 2px,transparent 2px 12px)' }}
      >
        {!img && <span className="font-mono text-[11px] text-[var(--color-app-text-muted)] bg-white/70 px-2 py-1 rounded-lg">sin foto · súbela en el proyecto</span>}
      </div>
      <div key={p.id} className="k-rise m-3 rounded-[24px] bg-white/75 p-5 flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-xl leading-tight">{p.name}</p>
            <p className="text-sm text-[var(--color-app-text-muted)] mt-1 truncate">{p.client_name}</p>
          </div>
          <span className={cn('shrink-0 h-[30px] px-3 rounded-full text-[13px] flex items-center', days < 0 ? 'bg-[#FBE4E1] text-[#9B1C1C]' : 'bg-[var(--color-app-accent)] text-[var(--color-app-accent-ink)]')}>
            {days < 0 ? `vencido ${-days} d` : `${days} día${days === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <BigNumber value={p.progress} unit="%" size="xl" />
          {prodParts.length > 0 && <span className="ml-auto text-[13px] text-[var(--color-app-text-muted)]">{done} / {prodParts.length} piezas</span>}
        </div>
        <StageSegments stageIdx={stageIdx} />
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <span className="text-sm text-[var(--color-app-text-muted)]">
            Entrega <span className="text-[var(--color-app-text)]">{format(toLocalDate(p.deadline), 'd MMM yyyy', { locale: es })}</span>
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShare(true)} className="h-[52px] w-[52px] rounded-full bg-white flex items-center justify-center hover:bg-[var(--color-app-surface-muted)] transition-colors" title="Compartir avance con el cliente" aria-label="Compartir con el cliente">
              <Link2 className="h-4 w-4" />
            </button>
            {canOpen && (
              <button onClick={() => navigate(`/projects/${p.id}`)} className="group/open flex items-center gap-3.5 h-[52px] pl-5 pr-1.5 rounded-full bg-white text-[15px] shadow-[0_4px_14px_rgba(22,24,29,.06)]">
                Abrir proyecto
                <span className="h-10 w-10 rounded-full bg-[var(--color-app-ink)] flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4 text-white transition-transform duration-300 group-hover/open:rotate-45" strokeWidth={1.8} />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
      {share && <ShareClientLinkModal project={p} open onClose={() => setShare(false)} />}
    </section>
  );
}

function StageSegments({ stageIdx }: { stageIdx: number }) {
  const ready = useAppeared();
  return (
    <div className="grid grid-cols-5 gap-1">
      {STAGES.map((s, i) => {
        const color = i < stageIdx ? 'var(--color-app-ink)' : i === stageIdx ? 'var(--color-app-accent)' : '#D3D7DF';
        return (
          <div key={s.status} className="flex flex-col gap-1.5">
            <div className="h-2 rounded bg-[#D3D7DF] overflow-hidden">
              <div className="h-full rounded" style={{ background: color, width: ready ? '100%' : '0%', transition: `width 500ms cubic-bezier(.2,.7,.2,1) ${i * 120}ms` }} />
            </div>
            <span className={cn('text-[11px] truncate', i <= stageIdx ? 'text-[var(--color-app-text)]' : 'text-[#8A9099]')} title={s.label}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── B · Barras de la semana ────────────────────────────────────────────── */
function WeekBars({ values, highlight }: { values: number[]; highlight: number }) {
  const ready = useAppeared();
  const max = Math.max(1, ...values);
  return (
    <div className="flex-1 grid grid-cols-7 gap-1.5 items-end mt-5 min-h-[150px]">
      {values.map((v, i) => {
        const hl = i === highlight && v > 0;
        return (
          <div key={i} className="flex flex-col items-center justify-end gap-2 h-full">
            {hl && <span className="font-mono text-xs px-2 py-1 rounded-full bg-[var(--color-app-accent)] text-[var(--color-app-accent-ink)]">{v.toLocaleString('en-US')}</span>}
            <div
              className="w-full rounded-xl"
              title={`${v.toLocaleString('en-US')} pzs`}
              style={{
                height: ready ? `${Math.max(6, (v / max) * 100)}%` : '6%',
                background: hl ? 'var(--color-app-accent)' : '#F2F3F6',
                transition: `height 800ms cubic-bezier(.2,.7,.2,1) ${i * 60}ms`,
              }}
            />
            <span className="text-xs text-[var(--color-app-text-muted)]">{DAYS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── E · Línea de aprobación QA ─────────────────────────────────────────── */
function QaLine({ values }: { values: (number | null)[] }) {
  const ready = useAppeared();
  const pts = values.map((v, i) => (v == null ? null : { x: ((i + 0.5) / 7) * 100, v }));
  const valid = pts.filter((p): p is { x: number; v: number } => !!p);
  if (valid.length === 0) {
    return <div className="flex-1 mt-6 rounded-2xl border border-dashed border-[var(--color-app-border-strong)] flex items-center justify-center text-sm text-[var(--color-app-text-muted)]">Sin inspecciones registradas</div>;
  }
  const lo = Math.min(...valid.map(p => p.v)), hi = Math.max(...valid.map(p => p.v));
  const min = Math.max(0, Math.min(lo - 3, hi - 8)), max = Math.min(100, Math.max(hi + 2, min + 8));
  const y = (v: number) => (1 - (v - min) / (max - min)) * 100;
  const xy = valid.map(p => ({ x: p.x, y: y(p.v), v: p.v }));
  const line = 'M' + xy.map(p => `${p.x} ${p.y}`).join(' L');
  const area = `${line} L${xy[xy.length - 1].x} 100 L${xy[0].x} 100 Z`;
  const worst = xy.reduce((a, b) => (b.v < a.v ? b : a), xy[0]);
  return (
    <>
      <div className="relative flex-1 mt-6 min-h-[150px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          <path d={area} fill="#F2F3F6" style={{ opacity: ready ? 1 : 0, transition: 'opacity 700ms ease 200ms' }} />
          <path
            d={line} fill="none" stroke="var(--color-app-ink)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" pathLength={1}
            style={{ strokeDasharray: 1, strokeDashoffset: ready ? 0 : 1, transition: 'stroke-dashoffset 1100ms cubic-bezier(.2,.7,.2,1)' }}
          />
        </svg>
        <div className="absolute bottom-0 border-l-[1.5px] border-dashed border-[#C9CDD5]" style={{ left: `${worst.x}%`, top: `${worst.y}%` }} />
        {xy.map((p, i) => (
          <div
            key={i}
            className="absolute h-[9px] w-[9px] -ml-[4.5px] -mt-[4.5px] rounded-full bg-[var(--color-app-ink)] border-2 border-white"
            style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: ready ? 1 : 0, transform: ready ? 'scale(1)' : 'scale(0)', transition: `all 300ms ease ${500 + i * 80}ms` }}
            title={`${p.v.toFixed(1)} %`}
          />
        ))}
        <span
          className="absolute font-mono text-xs px-2 py-1 rounded-full bg-[var(--color-app-accent)] text-[var(--color-app-accent-ink)] whitespace-nowrap"
          style={{ left: `${worst.x}%`, top: `${worst.y}%`, transform: 'translate(-50%,-150%)', opacity: ready ? 1 : 0, transition: 'opacity 400ms ease 1000ms' }}
        >
          {worst.v.toFixed(1)} %
        </span>
      </div>
      <div className="grid grid-cols-7 mt-3 text-xs text-[var(--color-app-text-muted)] text-center">
        {DAYS.map(d => <span key={d}>{d}</span>)}
      </div>
    </>
  );
}

/* ── F · Burbujas de máquinas ───────────────────────────────────────────── */
function Bubbles({ op, setup, paro }: { op: number; setup: number; paro: number }) {
  const ready = useAppeared();
  const size = (p: number, base: number) => Math.round(base * Math.sqrt(Math.max(p, 4) / 100));
  const big = Math.max(90, size(op, 170));
  const b = (style: React.CSSProperties, delay: number) => ({
    ...style,
    transform: `${style.transform ?? ''} scale(${ready ? 1 : 0.4})`,
    opacity: ready ? 1 : 0,
    transition: `transform 700ms cubic-bezier(.2,.9,.3,1.2) ${delay}ms, opacity 400ms ease ${delay}ms`,
  });
  return (
    <div className="relative flex-1 min-h-[180px] mt-2">
      <div className="absolute left-1/2 top-1/2 rounded-full bg-[#CDEBD8] flex items-center justify-center"
        style={b({ width: big, height: big, transform: 'translate(-55%,-45%)' }, 0)}>
        <span className="text-[40px] font-light text-[#0F5A2B] leading-none">{op}<span className="text-lg">%</span></span>
      </div>
      {setup > 0 && (
        <div className="absolute left-1/2 top-1/2 rounded-full bg-[#FBE9C9] border-4 border-white flex items-center justify-center text-[17px] text-[#7A4205]"
          style={b({ width: Math.max(56, size(setup, 150)), height: Math.max(56, size(setup, 150)), transform: 'translate(30%,-115%)' }, 150)}>
          {setup}%
        </div>
      )}
      {paro > 0 && (
        <div className="absolute left-1/2 top-1/2 rounded-full bg-[#F8D9D6] border-4 border-white flex items-center justify-center text-[15px] text-[#8E1616]"
          style={b({ width: Math.max(52, size(paro, 140)), height: Math.max(52, size(paro, 140)), transform: 'translate(-150%,45%)' }, 280)}>
          {paro}%
        </div>
      )}
    </div>
  );
}

/* ── D · Alertas ────────────────────────────────────────────────────────── */
function AlertsPanel({ alerts }: { alerts: { id: string; title: string; detail: string; tone: 'red' | 'amber'; to: string }[] }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const shown = all ? alerts : alerts.slice(0, 3);
  return (
    <Panel
      tone="accent-soft"
      index={3}
      className="min-h-[360px]"
      title="Alertas"
      actions={<span className="h-9 w-9 rounded-full bg-[var(--color-app-ink)] text-white flex items-center justify-center text-sm font-mono">{alerts.length}</span>}
    >
      {alerts.length === 0 ? (
        <p className="text-sm text-[var(--color-app-text-muted)]">Todo en orden: sin paros, NCR altas ni entregas en riesgo.</p>
      ) : (
        <div className={cn('flex flex-col gap-2', all && 'max-h-[420px] overflow-y-auto pr-1')}>
          {shown.map((a, i) => (
            <button
              key={a.id}
              onClick={() => navigate(a.to)}
              className="k-rise text-left bg-white rounded-[20px] px-4 py-3.5 flex gap-3 hover:-translate-y-px transition-transform"
              style={{ ['--i' as string]: i + 4 }}
            >
              <span className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" style={{ background: a.tone === 'red' ? '#B91C1C' : '#B45309' }} />
              <span className="min-w-0">
                <span className="block text-[15px]">{a.title}</span>
                <span className="block text-[13px] text-[var(--color-app-text-muted)] mt-0.5 line-clamp-2">{a.detail}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {alerts.length > 3 && (
        <button onClick={() => setAll(v => !v)} className="mt-auto pt-3 self-start">
          <span className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/70 hover:bg-white text-sm transition-colors">
            {all ? 'Ver menos' : `Ver todas (${alerts.length})`} <ChevronRight className={cn('h-3 w-3 transition-transform', all && 'rotate-90')} />
          </span>
        </button>
      )}
    </Panel>
  );
}

/* ── G · Próximas entregas ──────────────────────────────────────────────── */
function DeliveriesPanel(props: { projects: Project[]; showMoney: boolean; className?: string }) {
  return props.showMoney ? <DeliveriesWithAmounts {...props} /> : <DeliveriesTable {...props} amounts={null} />;
}

/** Solo para roles con montos: trae cotizaciones para el monto de cada proyecto. */
function DeliveriesWithAmounts(props: { projects: Project[]; showMoney: boolean; className?: string }) {
  const { data: quotes } = useQuotes();
  const amounts = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const p of props.projects) m[p.id] = p.quote_amount ?? quotes.find(q => q.converted_project_id === p.id)?.total ?? null;
    return m;
  }, [props.projects, quotes]);
  return <DeliveriesTable {...props} amounts={amounts} />;
}

function DeliveriesTable({ projects, showMoney, className, amounts }: { projects: Project[]; showMoney: boolean; className?: string; amounts: Record<string, number | null> | null }) {
  const navigate = useNavigate();
  const [range, setRange] = useState<'14' | '30'>('14');
  const rows = useMemo(
    () => projects.filter(active).map(p => ({ p, days: daysTo(p.deadline) })).filter(r => r.days <= Number(range)).sort((a, b) => a.days - b.days).slice(0, 8),
    [projects, range],
  );
  return (
    <Panel
      index={6}
      className={className}
      title="Próximas entregas"
      actions={<Segmented<'14' | '30'> size="sm" value={range} onChange={setRange} items={[{ id: '14', label: '14 días' }, { id: '30', label: '30 días' }]} />}
    >
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm min-w-[620px] border-separate border-spacing-0">
          <thead>
            <tr className="text-xs text-[var(--color-app-text-muted)] text-left">
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)] rounded-l-xl">Folio</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)]">Proyecto · cliente</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)]">Etapa</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)]">Avance</th>
              <th className={cn('font-normal px-3 py-2.5 bg-[var(--color-app-bg)] text-right', !showMoney && 'rounded-r-xl')}>Entrega</th>
              {showMoney && <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)] text-right rounded-r-xl">Monto</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[var(--color-app-text-muted)]">Sin entregas en los próximos {range} días.</td></tr>
            )}
            {rows.map(({ p, days }, i) => (
              <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="cursor-pointer hover:bg-[var(--color-app-surface-muted)] transition-colors">
                <td className="px-3 py-3 border-b border-[#EEF0F3] font-mono text-xs whitespace-nowrap">{p.id}</td>
                <td className="px-3 py-3 border-b border-[#EEF0F3]"><div>{p.name}</div><div className="text-xs text-[var(--color-app-text-muted)]">{p.client_name}</div></td>
                <td className="px-3 py-3 border-b border-[#EEF0F3]"><Pill tone={toneFor(p.status)}>{p.status === 'En Producción' ? 'Producción' : p.status}</Pill></td>
                <td className="px-3 py-3 border-b border-[#EEF0F3]">
                  <div className="flex items-center gap-2.5"><ProgressLine pct={p.progress} className="min-w-[60px]" delay={i * 60} /><span className="font-mono text-xs w-9 text-right">{p.progress}%</span></div>
                </td>
                <td className="px-3 py-3 border-b border-[#EEF0F3] text-right whitespace-nowrap">
                  <div>{format(toLocalDate(p.deadline), 'd MMM', { locale: es })}</div>
                  <div className={cn('text-xs', days < 0 || days <= 3 ? 'text-[#B91C1C]' : days <= 7 ? 'text-[#B45309]' : 'text-[var(--color-app-text-muted)]')}>
                    {days < 0 ? `vencido hace ${-days} d` : days === 0 ? 'hoy' : `en ${days} días`}
                  </div>
                </td>
                {showMoney && (
                  <td className="px-3 py-3 border-b border-[#EEF0F3] text-right font-mono text-[13px] whitespace-nowrap">
                    {amounts?.[p.id] != null ? money(amounts[p.id] as number) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ── H · Facturación ────────────────────────────────────────────────────── */
function BillingPanel() {
  const { data: invoices } = useInvoices();
  const { data: payments } = useReceivablePayments();
  const now = new Date();
  const valid = invoices.filter(i => !/cancel/i.test(i.status ?? ''));
  const month = valid.filter(i => isSameMonth(new Date(i.created_at), now)).reduce((s, i) => s + (i.total || 0), 0);
  const prev = valid.filter(i => isSameMonth(new Date(i.created_at), subMonths(now, 1))).reduce((s, i) => s + (i.total || 0), 0);
  const cobrado = payments.filter(p => isSameMonth(toLocalDate(p.paid_date), now)).reduce((s, p) => s + (p.amount || 0), 0);
  const base = Math.max(month, cobrado);
  const pc = base > 0 ? Math.round((cobrado / base) * 100) : 0;
  const [int, dec] = month.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  return (
    <Panel title="Facturación" index={7} actions={<ArrowButton to="/billing" label="Abrir Facturación" />} className="min-h-[300px]">
      <p className="text-sm text-[var(--color-app-text-muted)]">Facturado en {format(now, 'MMMM', { locale: es })} · MXN</p>
      <div className="flex items-baseline flex-wrap mt-1">
        <span className="text-xl text-[var(--color-app-text-muted)]">$</span>
        <BigNumber value={int} size="lg" />
        <span className="text-[26px] font-light text-[var(--color-app-text-subtle)]">.{dec}</span>
      </div>
      <div className="mt-1.5">
        {prev > 0 || month > 0
          ? <Delta dir={month >= prev ? 'up' : 'down'}>{money(Math.abs(month - prev))} vs. {format(subMonths(now, 1), 'MMMM', { locale: es })}</Delta>
          : <Delta dir="flat">Sin facturas aún</Delta>}
      </div>
      <div className="mt-auto pt-5 space-y-1.5">
        <div className="grid grid-cols-[80px_1fr] items-center gap-2.5">
          <span className="text-[13px] text-[#474C55]">Cobrado</span>
          <GrowBar pct={pc} bg={TONE.green.bg} fg={TONE.green.fg} minPct={22}>{pc}%</GrowBar>
        </div>
        <div className="grid grid-cols-[80px_1fr] items-center gap-2.5">
          <span className="text-[13px] text-[#474C55]">Por cobrar</span>
          <GrowBar pct={100 - pc} bg={TONE.amber.bg} fg={TONE.amber.fg} minPct={22} delay={120}>{base > 0 ? 100 - pc : 0}%</GrowBar>
        </div>
      </div>
    </Panel>
  );
}
