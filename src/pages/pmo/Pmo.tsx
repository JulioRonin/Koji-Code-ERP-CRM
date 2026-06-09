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
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import type { PmoReportType, Project, PmoReport } from '@/types/database';
import { ProjectReport } from '@/components/projects/ProjectReport';

const GANTT_MOCK = [
  { id: 't1', name: 'Procura de Acero',  department: 'Compras' as const,    startDay: 0,  duration: 5,  progress: 100, status: 'completed' as const },
  { id: 't2', name: 'Diseño CAD/CAM',     department: 'Diseño' as const,     startDay: 2,  duration: 8,  progress: 100, status: 'completed' as const },
  { id: 't3', name: 'Maquinado CNC',      department: 'Producción' as const, startDay: 10, duration: 12, progress: 65,  status: 'in-progress' as const },
  { id: 't4', name: 'Tratamiento térmico', department: 'Producción' as const, startDay: 22, duration: 4,  progress: 0,   status: 'pending' as const },
  { id: 't5', name: 'Inspección final',   department: 'Calidad' as const,    startDay: 26, duration: 3,  progress: 0,   status: 'pending' as const },
];

const reportTypeLabel: Record<PmoReportType, string> = {
  Semanal:   'Semanal',
  Quincenal: 'Quincenal',
  Mensual:   'Mensual',
  Cierre:    'Cierre de proyecto',
  'Ad-hoc':  'Ad-hoc',
};

export function Pmo() {
  const { data: projects } = useProjects();
  const { data: reports, refetch: refetchReports } = usePmoReports();
  const { create: createReport, loading: creating } = useCreatePmoReport();
  const { markSent } = useMarkReportSent();

  const [showCreate, setShowCreate] = useState(false);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);

  const [draft, setDraft] = useState<{
    projectId: string;
    type: PmoReportType;
    summary: string;
  }>({
    projectId: '',
    type: 'Semanal',
    summary: '',
  });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reportes PMO</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Snapshots ejecutivos enviados al cliente. Cada reporte enviado dispara
            una notificación a la cola de automatizaciones (n8n).
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Generar reporte
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={FileBarChart} label="Total reportes"   value={String(stats.total)} />
        <Kpi icon={Send}          label="Enviados al cliente" value={String(stats.sent)} tone="success" />
        <Kpi icon={Clock}         label="Pendientes envío"     value={String(stats.pending)} tone="warning" />
        <Kpi icon={Calendar}      label="Este mes"             value={String(stats.thisMonth)} />
      </div>

      {/* Tabla de reportes */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle>Historial de reportes</CardTitle>
          <CardDescription>Los reportes enviados se notifican automáticamente vía n8n.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-app-text-muted)]">
              No hay reportes generados. Crea el primero arriba.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporte</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead>Generado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(r => {
                  const p = projectFor(r.project_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {p ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-[var(--color-app-text-muted)] font-mono">{p.id}</span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs">{r.project_id}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{reportTypeLabel[r.report_type]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{r.progress_snapshot ?? '—'}%</TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)] text-sm">
                        {format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        {r.sent_to_client ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Enviado
                          </Badge>
                        ) : (
                          <Badge variant="warning">Borrador</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {p && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewProject(p)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {!r.sent_to_client && (
                            <Button variant="outline" size="sm" onClick={() => handleSend(r.id)}>
                              <Mail className="h-3.5 w-3.5 mr-1.5" /> Enviar
                            </Button>
                          )}
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
          <div>
            <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
            <p
              className={
                tone === 'success'
                  ? 'text-2xl font-semibold mt-1 text-[var(--color-app-success)]'
                  : tone === 'warning'
                  ? 'text-2xl font-semibold mt-1 text-[var(--color-app-warning)]'
                  : 'text-2xl font-semibold mt-1'
              }
            >
              {value}
            </p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
        </div>
      </CardContent>
    </Card>
  );
}
