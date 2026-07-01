import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CalendarClock, Boxes, Factory, ShieldCheck, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useBomItems, useWorkOrders, useInspections, useNcrs, summarizePurchasing } from '@/lib/api';
import type { Project, ProjectStatus } from '@/types/database';

const STAGES: ProjectStatus[] = ['Cotización', 'Diseño', 'Compras', 'En Producción', 'Calidad', 'Embarque', 'Entregado'];

const COMPRAS_COLORS: Record<string, string> = {
  Pendiente: '#f59e0b', Solicitado: '#0ea5e9', Tránsito: '#6366f1', Recibido: '#15803d',
};

export function ProjectSpotlight({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { data: bom } = useBomItems(project.id);
  const { data: allWos } = useWorkOrders();
  const { data: inspections } = useInspections(project.id);
  const { data: ncrs } = useNcrs(project.id);

  const wos = useMemo(() => allWos.filter(w => w.project_id === project.id), [allWos, project.id]);
  const purchasing = useMemo(() => summarizePurchasing(bom), [bom]);

  const prod = useMemo(() => {
    const total = wos.reduce((s, w) => s + Number(w.quantity || 0), 0);
    const done = wos.reduce((s, w) => s + Number(w.completed_qty || 0), 0);
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [wos]);

  const quality = useMemo(() => {
    const approved = inspections.filter(i => i.result === 'Aprobado').length;
    const rejected = inspections.filter(i => i.result === 'Rechazado').length;
    const openNcrs = ncrs.filter(n => n.status !== 'Cerrada').length;
    const rate = inspections.length > 0 ? Math.round((approved / inspections.length) * 100) : 100;
    return { approved, rejected, openNcrs, rate, total: inspections.length };
  }, [inspections, ncrs]);

  const comprasData = useMemo(() => ([
    { name: 'Pendiente', value: purchasing.pending_items },
    { name: 'Solicitado', value: purchasing.requested_items },
    { name: 'Tránsito', value: purchasing.in_transit_items },
    { name: 'Recibido', value: purchasing.received_items },
  ].filter(d => d.value > 0)), [purchasing]);

  const deadline = new Date(project.deadline);
  const daysLeft = isValid(deadline) ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000) : null;
  const currentStage = STAGES.indexOf(project.status);
  const cancelled = project.status === 'Cancelado';

  return (
    <div className="space-y-4">
      {/* Encabezado del proyecto */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-app-primary), var(--color-app-primary-hover))' }} />
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold truncate">{project.name}</h3>
                <Badge variant={cancelled ? 'outline' : 'default'}>{project.status}</Badge>
              </div>
              <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
                <span className="font-mono">{project.id}</span> · {project.client_name}
              </p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1 justify-end"><CalendarClock className="h-3.5 w-3.5" /> Entrega</p>
                <p className="text-sm font-medium">{isValid(deadline) ? format(deadline, 'dd MMM yyyy', { locale: es }) : '—'}</p>
                {daysLeft != null && (
                  <p className={cn('text-xs', daysLeft < 0 ? 'text-[var(--color-app-danger)]' : daysLeft <= 7 ? 'text-[var(--color-app-warning)]' : 'text-[var(--color-app-text-muted)]')}>
                    {daysLeft < 0 ? `Vencido ${Math.abs(daysLeft)}d` : `${daysLeft} días restantes`}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${project.id}`)} className="gap-1">
                Abrir <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Avance general */}
          <div className="mt-4 flex items-center gap-3">
            <Progress value={project.progress} className="h-2 flex-1" />
            <span className="text-sm font-semibold tabular-nums w-12 text-right">{project.progress}%</span>
          </div>

          {/* Stepper de etapas */}
          <div className="mt-5 flex items-center">
            {STAGES.map((stage, i) => {
              const done = !cancelled && i < currentStage;
              const active = !cancelled && i === currentStage;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && (
                    <span className={cn('absolute top-3 right-1/2 w-full h-0.5', done || active ? 'bg-[var(--color-app-primary)]' : 'bg-[var(--color-app-border)]')} />
                  )}
                  <span className={cn(
                    'relative z-10 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                    done ? 'bg-[var(--color-app-primary)] text-white'
                      : active ? 'bg-white border-2 border-[var(--color-app-primary)] text-[var(--color-app-primary)]'
                      : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-subtle)]'
                  )}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Clock className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn('text-[10px] mt-1 text-center leading-tight', active ? 'text-[var(--color-app-primary)] font-medium' : 'text-[var(--color-app-text-muted)]')}>
                    {stage}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* KPIs del proyecto */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini icon={Boxes} label="Partidas (BOM)" value={String(purchasing.total_items)} sub={`${purchasing.progress_pct}% surtido`} />
        <Mini icon={Factory} label="Producción" value={`${prod.pct}%`} sub={`${prod.done}/${prod.total} piezas`} />
        <Mini icon={ShieldCheck} label="Aprobación QA" value={`${quality.rate}%`} sub={`${quality.total} inspecciones`} />
        <Mini icon={ShieldCheck} label="NCRs abiertas" value={String(quality.openNcrs)} sub={quality.openNcrs > 0 ? 'requieren acción' : 'sin pendientes'} tone={quality.openNcrs > 0 ? 'danger' : undefined} />
      </div>

      {/* Gráficas por etapa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compras */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Compras (BOM)</CardTitle>
            <CardDescription>Estatus de surtido de partidas</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {comprasData.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Sin partidas registradas.</p>
            ) : (
              <>
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={comprasData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={3} strokeWidth={0}>
                        {comprasData.map(d => <Cell key={d.name} fill={COMPRAS_COLORS[d.name] ?? '#94a3b8'} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-2">
                  {comprasData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-[var(--color-app-text-muted)]">
                        <span className="h-2 w-2 rounded-full" style={{ background: COMPRAS_COLORS[d.name] ?? '#94a3b8' }} />{d.name}
                      </span>
                      <span className="font-medium tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Producción */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Producción</CardTitle>
            <CardDescription>Piezas completadas vs pendientes</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {prod.total === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Sin órdenes de trabajo.</p>
            ) : (
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: 'Piezas', Completadas: prod.done, Pendientes: Math.max(0, prod.total - prod.done) }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
                    <Bar dataKey="Completadas" stackId="a" fill="var(--color-app-primary)" radius={[4, 4, 0, 0]} barSize={60} />
                    <Bar dataKey="Pendientes" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calidad */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calidad</CardTitle>
            <CardDescription>Inspecciones y no conformidades</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            <QRow label="Aprobadas" value={quality.approved} tone="success" />
            <QRow label="Rechazadas" value={quality.rejected} tone={quality.rejected > 0 ? 'danger' : undefined} />
            <QRow label="NCRs abiertas" value={quality.openNcrs} tone={quality.openNcrs > 0 ? 'danger' : undefined} />
            <div className="pt-2 border-t border-[var(--color-app-border)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-app-text-muted)]">Tasa de aprobación</span>
                <span className="font-semibold">{quality.rate}%</span>
              </div>
              <Progress value={quality.rate} className="h-1.5 mt-1.5" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; tone?: 'danger';
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-app-text-muted)] truncate">{label}</p>
            <p className={cn('text-xl font-semibold mt-0.5', tone === 'danger' && 'text-[var(--color-app-danger)]')}>{value}</p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        </div>
        <p className="text-[11px] text-[var(--color-app-text-muted)] mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function QRow({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-app-text-muted)]">{label}</span>
      <span className={cn('font-semibold tabular-nums', tone === 'success' && 'text-[var(--color-app-success)]', tone === 'danger' && 'text-[var(--color-app-danger)]')}>{value}</span>
    </div>
  );
}
