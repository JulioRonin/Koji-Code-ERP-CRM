import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Factory,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Share2,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjects, useWorkOrders, useNcrs, useInspections, useMachines } from '@/lib/api';
import type { Project, ProjectStatus } from '@/types/database';
import { ShareClientLinkModal } from '@/components/client-portal/ShareClientLinkModal';

const statusBadge: Partial<Record<ProjectStatus, { variant: 'default' | 'success' | 'warning' | 'secondary' | 'outline'; label: string }>> = {
  'En Producción': { variant: 'default',   label: 'En producción' },
  'Diseño':        { variant: 'secondary', label: 'Diseño' },
  'Compras':       { variant: 'secondary', label: 'Compras' },
  'Calidad':       { variant: 'success',   label: 'Calidad' },
  'Embarque':      { variant: 'success',   label: 'Embarque' },
  'Cotización':    { variant: 'warning',   label: 'Cotización' },
  'Entregado':     { variant: 'outline',   label: 'Entregado' },
  'Cancelado':     { variant: 'outline',   label: 'Cancelado' },
};

const STATUS_COLORS: Record<string, string> = {
  'Cotización':     '#b45309',
  'Diseño':         '#7c3aed',
  'Compras':        '#0ea5e9',
  'En Producción':  '#0369a1',
  'Calidad':        '#15803d',
  'Embarque':       '#0d9488',
  'Entregado':      '#94a3b8',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: workOrders } = useWorkOrders();
  const { data: ncrs } = useNcrs();
  const { data: inspections } = useInspections();
  const { data: machines } = useMachines();
  const [shareProject, setShareProject] = useState<Project | null>(null);

  // ── KPIs principales ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = projects.filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado');
    const partsWip = workOrders
      .filter(w => w.status === 'En Proceso' || w.status === 'Setup')
      .reduce((acc, w) => acc + Number(w.quantity || 0), 0);
    const approved = inspections.filter(i => i.result === 'Aprobado').length;
    const qaRate = inspections.length > 0 ? (approved / inspections.length) * 100 : 100;
    const openNcrs = ncrs.filter(n => n.status !== 'Cerrada').length;

    return [
      { label: 'Proyectos activos',    value: String(active.length),     sub: 'en pipeline',          icon: Factory,       trend: 'up' as const,   spark: [3, 5, 4, 6, 5, active.length] },
      { label: 'Piezas en producción', value: partsWip.toLocaleString(), sub: 'WO activas',           icon: Package,       trend: 'up' as const,   spark: [400, 900, 1400, 2800, 4100, partsWip] },
      { label: 'Aprobación QA',        value: `${qaRate.toFixed(0)}%`,   sub: `${approved}/${inspections.length} inspecciones`, icon: ShieldCheck, trend: qaRate >= 90 ? ('up' as const) : ('down' as const), spark: [88, 92, 90, 95, 93, qaRate] },
      { label: 'NCRs abiertas',        value: String(openNcrs),          sub: 'requieren acción',     icon: AlertTriangle, trend: openNcrs > 0 ? ('down' as const) : ('up' as const), spark: [4, 3, 5, 2, 3, openNcrs] },
    ];
  }, [projects, workOrders, inspections, ncrs]);

  // ── Distribución de proyectos por etapa (donut) ───────────────────────
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    projects
      .filter(p => p.status !== 'Cancelado')
      .forEach(p => {
        counts[p.status] = (counts[p.status] || 0) + 1;
      });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [projects]);

  // ── Producción semanal (área, sintético sobre WOs reales) ─────────────
  const productionTrend = useMemo(() => {
    const totalQty = workOrders.reduce((acc, w) => acc + Number(w.completed_qty || 0), 0);
    const base = Math.max(totalQty / 6, 10);
    return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => ({
      day,
      piezas: Math.round(base * (0.7 + (i % 3) * 0.25) + i * base * 0.08),
    }));
  }, [workOrders]);

  // ── Carga por máquina (barras) ─────────────────────────────────────────
  const machineLoad = useMemo(() => {
    return machines.map(m => {
      const wos = workOrders.filter(w => w.machine_id === m.id);
      const total = wos.reduce((acc, w) => acc + Number(w.quantity || 0), 0);
      const done = wos.reduce((acc, w) => acc + Number(w.completed_qty || 0), 0);
      return {
        name: m.id,
        completado: done,
        pendiente: Math.max(total - done, 0),
        status: m.status,
      };
    });
  }, [machines, workOrders]);

  // ── Proyectos próximos a vencer ────────────────────────────────────────
  const upcoming = useMemo(() => {
    return [...projects]
      .filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado')
      .map(p => ({
        ...p,
        daysLeft: Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [projects]);

  // ── Alertas críticas ──────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const out: { id: string; text: string; tone: 'danger' | 'warning'; action?: () => void }[] = [];
    ncrs
      .filter(n => n.status !== 'Cerrada' && (n.severity === 'Alta' || n.severity === 'Crítica'))
      .slice(0, 2)
      .forEach(n =>
        out.push({
          id: `ncr-${n.id}`,
          text: `NCR ${n.severity.toLowerCase()} · ${n.project_id} · ${n.issue_description.slice(0, 60)}…`,
          tone: 'danger',
          action: () => navigate('/quality'),
        })
      );
    upcoming
      .filter(p => p.daysLeft <= 7 && p.daysLeft >= 0)
      .slice(0, 2)
      .forEach(p =>
        out.push({
          id: `deadline-${p.id}`,
          text: `${p.name} vence en ${p.daysLeft} día${p.daysLeft === 1 ? '' : 's'}`,
          tone: 'warning',
          action: () => navigate(`/projects/${p.id}`),
        })
      );
    machines
      .filter(m => m.status === 'Mantenimiento' || m.status === 'Fuera_Servicio')
      .slice(0, 1)
      .forEach(m =>
        out.push({
          id: `machine-${m.id}`,
          text: `${m.id} fuera de operación (${m.status.toLowerCase().replace('_', ' ')})`,
          tone: 'warning',
          action: () => navigate('/production'),
        })
      );
    return out.slice(0, 4);
  }, [ncrs, upcoming, machines, navigate]);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-[var(--color-app-text)]">Resumen operativo</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })} · vista en tiempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="md:h-9" onClick={() => navigate('/projects')}>
            Ver proyectos
          </Button>
          <Button size="sm" className="md:h-9" onClick={() => navigate('/projects/new')}>
            Nuevo proyecto
          </Button>
        </div>
      </div>

      {/* Alertas críticas */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {alerts.map(a => (
            <button
              key={a.id}
              onClick={a.action}
              className={cn(
                'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-colors',
                a.tone === 'danger'
                  ? 'bg-[var(--color-app-danger-soft)] border-[var(--color-app-danger)]/20 hover:border-[var(--color-app-danger)]/40'
                  : 'bg-[var(--color-app-warning-soft)] border-[var(--color-app-warning)]/20 hover:border-[var(--color-app-warning)]/40'
              )}
            >
              <AlertTriangle
                className={cn(
                  'h-4 w-4 shrink-0',
                  a.tone === 'danger' ? 'text-[var(--color-app-danger)]' : 'text-[var(--color-app-warning)]'
                )}
              />
              <span className="text-xs md:text-sm font-medium truncate">{a.text}</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0 text-[var(--color-app-text-subtle)]" />
            </button>
          ))}
        </div>
      )}

      {/* KPIs con sparkline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="p-0 overflow-hidden">
            <CardContent className="p-4 md:p-5 relative">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <span className="text-xs text-[var(--color-app-text-muted)] block truncate">{kpi.label}</span>
                  <span className="text-xl md:text-2xl font-semibold text-[var(--color-app-text)] mt-0.5 block">
                    {kpi.value}
                  </span>
                </div>
                <div className="h-8 w-8 md:h-9 md:w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center shrink-0">
                  <kpi.icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="flex items-center gap-1 text-xs min-w-0">
                  {kpi.trend === 'up' ? (
                    <TrendingUp className="h-3.5 w-3.5 text-[var(--color-app-success)] shrink-0" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-[var(--color-app-danger)] shrink-0" />
                  )}
                  <span className="text-[var(--color-app-text-muted)] truncate">{kpi.sub}</span>
                </div>
                <MiniSparkline data={kpi.spark} positive={kpi.trend === 'up'} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fila de gráficas: tendencia + distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Producción semanal */}
        <Card className="lg:col-span-2 p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Producción semanal</CardTitle>
            <CardDescription>Piezas completadas por día</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[220px] md:h-[260px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionTrend}>
                  <defs>
                    <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0369a1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#0369a1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} width={45} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                    formatter={(v: number) => [`${v.toLocaleString()} pzas`, 'Producción']}
                  />
                  <Area
                    type="monotone"
                    dataKey="piezas"
                    stroke="#0369a1"
                    strokeWidth={2.5}
                    fill="url(#prodGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribución por etapa */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline de proyectos</CardTitle>
            <CardDescription>Distribución por etapa</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {statusDistribution.map(entry => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {statusDistribution.map(s => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[var(--color-app-text-muted)]">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[s.name] ?? '#94a3b8' }}
                    />
                    {s.name}
                  </span>
                  <span className="font-medium tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila: carga máquinas + próximos vencimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Carga por máquina */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Carga por máquina</CardTitle>
            <CardDescription>Piezas completadas vs pendientes</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[220px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={machineLoad} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} width={64} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="completado" stackId="a" fill="#0369a1" radius={[0, 0, 0, 0]} barSize={16} />
                  <Bar dataKey="pendiente"  stackId="a" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Próximos a vencer */}
        <Card className="lg:col-span-2 p-0">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                Próximas entregas
              </CardTitle>
              <CardDescription>Ordenado por urgencia</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1 hidden sm:flex">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--color-app-border)]">
              {upcoming.map(p => {
                const badge = statusBadge[p.status] ?? { variant: 'secondary' as const, label: p.status };
                const urgency =
                  p.daysLeft < 0 ? 'overdue' : p.daysLeft <= 7 ? 'critical' : p.daysLeft <= 14 ? 'warning' : 'ok';
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-[var(--color-app-surface-alt)]/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    {/* Days indicator */}
                    <div
                      className={cn(
                        'h-11 w-11 rounded-lg flex flex-col items-center justify-center shrink-0 leading-none',
                        urgency === 'overdue'  && 'bg-[var(--color-app-danger)] text-white',
                        urgency === 'critical' && 'bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]',
                        urgency === 'warning'  && 'bg-[var(--color-app-warning-soft)] text-[var(--color-app-warning)]',
                        urgency === 'ok'       && 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]'
                      )}
                    >
                      <span className="text-base font-bold tabular-nums">
                        {p.daysLeft < 0 ? '!' : p.daysLeft}
                      </span>
                      <span className="text-[9px] uppercase">{p.daysLeft < 0 ? 'vencido' : 'días'}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        <Badge variant={badge.variant} className="hidden sm:inline-flex">{badge.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--color-app-text-muted)] font-mono">{p.id}</span>
                        <span className="text-xs text-[var(--color-app-text-muted)]">· {p.client_name}</span>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-2 w-36 shrink-0">
                      <Progress value={p.progress} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium tabular-nums w-9 text-right">{p.progress}%</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Compartir con el cliente"
                      onClick={e => {
                        e.stopPropagation();
                        setShareProject(p);
                      }}
                    >
                      <Share2 className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    </Button>
                  </div>
                );
              })}
              {upcoming.length === 0 && (
                <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-[var(--color-app-success)]" />
                  No hay proyectos activos con entregas próximas.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share modal */}
      {shareProject && (
        <ShareClientLinkModal
          project={shareProject}
          open={!!shareProject}
          onClose={() => setShareProject(null)}
        />
      )}
    </div>
  );
}

/** Sparkline SVG mínimo — sin dependencias adicionales. */
function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const w = 64;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const color = positive ? '#15803d' : '#b91c1c';
  return (
    <svg width={w} height={h} className="shrink-0 hidden sm:block" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}
