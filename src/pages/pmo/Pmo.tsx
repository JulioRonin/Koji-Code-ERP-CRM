import React, { useMemo, useState } from 'react';
import {
  FileBarChart,
  Plus,
  Send,
  CheckCircle2,
  Eye,
  Calendar,
  Mail,
  Clock,
  Share2,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ResponsiveContainer,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  usePmoReports,
  useCreatePmoReport,
  useMarkReportSent,
  useProjects,
} from '@/lib/api';
import type { PmoReportType, Project } from '@/types/database';
import { ProjectReport } from '@/components/projects/ProjectReport';
import { ShareClientLinkModal } from '@/components/client-portal/ShareClientLinkModal';
import { cn } from '@/lib/utils';

const GANTT_MOCK = [
  { id: 't1', name: 'Procura de Acero',    department: 'Compras' as const,    startDay: 0,  duration: 5,  progress: 100, status: 'completed' as const },
  { id: 't2', name: 'Diseño CAD/CAM',       department: 'Diseño' as const,     startDay: 2,  duration: 8,  progress: 100, status: 'completed' as const },
  { id: 't3', name: 'Maquinado CNC',        department: 'Producción' as const, startDay: 10, duration: 12, progress: 65,  status: 'in-progress' as const },
  { id: 't4', name: 'Tratamiento térmico',  department: 'Producción' as const, startDay: 22, duration: 4,  progress: 0,   status: 'pending' as const },
  { id: 't5', name: 'Inspección final',     department: 'Calidad' as const,    startDay: 26, duration: 3,  progress: 0,   status: 'pending' as const },
];

const reportTypeLabel: Record<PmoReportType, string> = {
  Semanal:   'Semanal',
  Quincenal: 'Quincenal',
  Mensual:   'Mensual',
  Cierre:    'Cierre de proyecto',
  'Ad-hoc':  'Ad-hoc',
};

const TYPE_COLORS: Record<PmoReportType, string> = {
  Semanal:   '#0369a1',
  Quincenal: '#0ea5e9',
  Mensual:   '#7c3aed',
  Cierre:    '#15803d',
  'Ad-hoc':  '#b45309',
};

export function Pmo() {
  const { data: projects } = useProjects();
  const { data: reports, refetch: refetchReports } = usePmoReports();
  const { create: createReport, loading: creating } = useCreatePmoReport();
  const { markSent } = useMarkReportSent();

  const [showCreate, setShowCreate] = useState(false);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [shareProject, setShareProject] = useState<Project | null>(null);

  const [draft, setDraft] = useState<{
    projectId: string;
    type: PmoReportType;
    summary: string;
  }>({
    projectId: '',
    type: 'Semanal',
    summary: '',
  });

  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado'),
    [projects]
  );

  const stats = useMemo(() => {
    const total = reports.length;
    const sent = reports.filter(r => r.sent_to_client).length;
    const pending = total - sent;
    const thisMonth = reports.filter(r => {
      const d = new Date(r.created_at);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
    }).length;
    return { total, sent, pending, thisMonth };
  }, [reports]);

  // ── Reportes por mes (últimos 6 meses) ────────────────────────────────
  const reportsByMonth = useMemo(() => {
    const months: { key: string; label: string; generados: number; enviados: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: format(d, 'MMM', { locale: es }),
        generados: 0,
        enviados: 0,
      });
    }
    reports.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find(m => m.key === key);
      if (bucket) {
        bucket.generados += 1;
        if (r.sent_to_client) bucket.enviados += 1;
      }
    });
    return months;
  }, [reports]);

  // ── Distribución por tipo ──────────────────────────────────────────────
  const reportsByType = useMemo(() => {
    const counts: Partial<Record<PmoReportType, number>> = {};
    reports.forEach(r => {
      counts[r.report_type] = (counts[r.report_type] || 0) + 1;
    });
    return (Object.entries(counts) as [PmoReportType, number][]).map(([name, value]) => ({
      name,
      value,
    }));
  }, [reports]);

  // ── Cobertura: proyectos activos con/sin reporte este mes ─────────────
  const coverage = useMemo(() => {
    const now = new Date();
    const reportedThisMonth = new Set(
      reports
        .filter(r => {
          const d = new Date(r.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .map(r => r.project_id)
    );
    return activeProjects.map(p => ({
      project: p,
      hasReport: reportedThisMonth.has(p.id),
      lastReport: reports
        .filter(r => r.project_id === p.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0],
    }));
  }, [activeProjects, reports]);

  const handleCreate = async () => {
    if (!draft.projectId) return;
    const project = projects.find(p => p.id === draft.projectId);
    if (!project) return;
    await createReport({
      project_id: draft.projectId,
      report_type: draft.type,
      progress_snapshot: project.progress,
      summary: draft.summary || `Reporte ${draft.type.toLowerCase()} · ${project.name}`,
      period_end: new Date().toISOString().split('T')[0],
    });
    setShowCreate(false);
    setDraft({ projectId: '', type: 'Semanal', summary: '' });
    await refetchReports();
  };

  const handleSend = async (reportId: string) => {
    await markSent(reportId);
    await refetchReports();
  };

  const projectFor = (id: string) => projects.find(p => p.id === id);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Oficina de proyectos (PMO)</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Reportes ejecutivos y comunicación con clientes.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Generar reporte
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={FileBarChart} label="Total reportes"       value={String(stats.total)} />
        <Kpi icon={Send}          label="Enviados al cliente"  value={String(stats.sent)}     tone="success" />
        <Kpi icon={Clock}         label="Pendientes de envío"  value={String(stats.pending)}  tone={stats.pending > 0 ? 'warning' : undefined} />
        <Kpi icon={Calendar}      label="Este mes"             value={String(stats.thisMonth)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actividad de reportes</CardTitle>
            <CardDescription>Generados vs enviados · últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[200px] md:h-[240px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} className="capitalize" />
                  <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar dataKey="generados" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={18} name="Generados" />
                  <Bar dataKey="enviados"  fill="#0369a1" radius={[4, 4, 0, 0]} barSize={18} name="Enviados" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--color-app-text-muted)] mt-1 ml-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#cbd5e1]" /> Generados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#0369a1]" /> Enviados
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por tipo de reporte</CardTitle>
            <CardDescription>Distribución histórica</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {reportsByType.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-[var(--color-app-text-muted)]">
                Sin datos aún
              </div>
            ) : (
              <>
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportsByType}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {reportsByType.map(entry => (
                          <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {reportsByType.map(t => (
                    <div key={t.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-[var(--color-app-text-muted)]">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[t.name] }} />
                        {reportTypeLabel[t.name]}
                      </span>
                      <span className="font-medium tabular-nums">{t.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cobertura por proyecto — corazón del PMO */}
      <Card className="p-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-app-text-muted)]" />
            Cobertura de comunicación por proyecto
          </CardTitle>
          <CardDescription>
            Cada proyecto activo debería tener al menos un reporte enviado este mes.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--color-app-border)]">
            {coverage.length === 0 && (
              <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">
                No hay proyectos activos.
              </div>
            )}
            {coverage.map(({ project, hasReport, lastReport }) => (
              <div
                key={project.id}
                className="flex items-center gap-3 px-4 md:px-5 py-3"
              >
                {/* Indicador de cobertura */}
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                    hasReport
                      ? 'bg-[var(--color-app-success-soft)]'
                      : 'bg-[var(--color-app-warning-soft)]'
                  )}
                >
                  {hasReport ? (
                    <CheckCircle2 className="h-4.5 w-4.5 h-5 w-5 text-[var(--color-app-success)]" />
                  ) : (
                    <Clock className="h-5 w-5 text-[var(--color-app-warning)]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{project.name}</span>
                    <span className="text-xs text-[var(--color-app-text-muted)] font-mono hidden sm:inline">{project.id}</span>
                  </div>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                    {project.client_name} ·{' '}
                    {lastReport
                      ? `último reporte ${format(new Date(lastReport.created_at), 'dd MMM', { locale: es })}`
                      : 'sin reportes aún'}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
                  <Progress value={project.progress} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium tabular-nums w-9 text-right">{project.progress}%</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Compartir portal con el cliente"
                    onClick={() => setShareProject(project)}
                  >
                    <Share2 className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraft({ projectId: project.id, type: 'Semanal', summary: '' });
                      setShowCreate(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 hidden sm:block" /> Reporte
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="p-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historial de reportes</CardTitle>
          <CardDescription>Los envíos disparan notificación automática vía n8n.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="text-center py-10 text-sm text-[var(--color-app-text-muted)]">
              No hay reportes generados. Crea el primero desde la cobertura de arriba.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-app-border)]">
              {reports.map(r => {
                const p = projectFor(r.project_id);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 md:px-5 py-3">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${TYPE_COLORS[r.report_type]}18` }}
                    >
                      <FileBarChart className="h-4 w-4" style={{ color: TYPE_COLORS[r.report_type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {p?.name ?? r.project_id}
                        </span>
                        <Badge variant="secondary">{reportTypeLabel[r.report_type]}</Badge>
                      </div>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                        {format(new Date(r.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                        {r.progress_snapshot != null && ` · avance ${r.progress_snapshot}%`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.sent_to_client ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Enviado</span>
                        </Badge>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleSend(r.id)}>
                          <Mail className="h-3.5 w-3.5 sm:mr-1.5" />
                          <span className="hidden sm:inline">Enviar</span>
                        </Button>
                      )}
                      {p && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewProject(p)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar reporte PMO</DialogTitle>
            <DialogDescription>
              Genera un snapshot del avance del proyecto. Después podrás enviarlo al cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Proyecto</label>
              <select
                value={draft.projectId}
                onChange={e => setDraft({ ...draft, projectId: e.target.value })}
                className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              >
                <option value="">Seleccionar...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de reporte</label>
              <select
                value={draft.type}
                onChange={e => setDraft({ ...draft, type: e.target.value as PmoReportType })}
                className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              >
                {(['Semanal', 'Quincenal', 'Mensual', 'Cierre', 'Ad-hoc'] as PmoReportType[]).map(t => (
                  <option key={t} value={t}>
                    {reportTypeLabel[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Resumen ejecutivo (opcional)</label>
              <textarea
                value={draft.summary}
                onChange={e => setDraft({ ...draft, summary: e.target.value })}
                placeholder="Si lo dejas en blanco se autogenera."
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!draft.projectId || creating}>
              {creating ? 'Generando...' : 'Generar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      {previewProject && (
        <ProjectReport
          isOpen={!!previewProject}
          onClose={() => setPreviewProject(null)}
          project={{
            id: previewProject.id,
            name: previewProject.name,
            client: previewProject.client_name,
            status: previewProject.status,
            progress: previewProject.progress,
            startDate: previewProject.start_date,
            deadline: previewProject.deadline,
            manager: previewProject.manager_id ?? '—',
            description: previewProject.description ?? '',
            tasks: [],
          }}
          ganttTasks={GANTT_MOCK}
        />
      )}

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

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'success' | 'warning';
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-app-text-muted)] truncate">{label}</p>
            <p
              className={cn(
                'text-xl md:text-2xl font-semibold mt-1',
                tone === 'success' && 'text-[var(--color-app-success)]',
                tone === 'warning' && 'text-[var(--color-app-warning)]'
              )}
            >
              {value}
            </p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
