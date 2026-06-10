import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  BarChart3,
  Plus,
  Send,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GanttChart } from '@/components/projects/GanttChart';
import { ProjectReport } from '@/components/projects/ProjectReport';
import { useClientPortalToken } from '@/lib/api';
import { Share2 } from 'lucide-react';
import { ShareClientLinkModal } from '@/components/client-portal/ShareClientLinkModal';
import type { Project } from '@/types/database';

const getMockProject = (id: string) => ({
  id,
  name: 'Eje Principal Ensamblaje',
  client: 'BRP',
  status: 'En Producción',
  progress: 75,
  startDate: '2026-03-01',
  deadline: '2026-04-15',
  manager: 'Carlos M.',
  description:
    'Fabricación de 500 ejes principales para el nuevo modelo de motor. Requiere maquinado CNC de alta precisión y tratamiento térmico.',
  tasks: [
    { id: 1, name: 'Revisión de planos',           status: 'completed',   date: '2026-03-02' },
    { id: 2, name: 'Compra de material (Acero 4140)', status: 'completed', date: '2026-03-05' },
    { id: 3, name: 'Programación CAM',             status: 'completed',   date: '2026-03-10' },
    { id: 4, name: 'Maquinado CNC (Fase 1)',       status: 'in-progress', date: '2026-03-15' },
    { id: 5, name: 'Tratamiento térmico',          status: 'pending',     date: '2026-03-25' },
    { id: 6, name: 'Inspección de calidad final',  status: 'pending',     date: '2026-04-05' },
  ],
  history: [
    { id: 1, user: 'Carlos M.', action: 'creó el proyecto',                          date: '2026-03-01T09:00:00Z', type: 'system' },
    { id: 2, user: 'Ana G.',     action: 'aprobó los planos de diseño',              date: '2026-03-02T14:30:00Z', type: 'system' },
    { id: 3, user: 'Luis R.',    action: 'generó la orden de compra PO-2026-089',    date: '2026-03-05T11:15:00Z', type: 'system' },
    { id: 4, user: 'Sistema',    action: 'cambió el estado a "En Producción"',       date: '2026-03-15T08:00:00Z', type: 'system' },
  ],
});

const GANTT_MOCK_DATA = [
  { id: 't1', name: 'Procura de Acero 4140',   department: 'Compras' as const,    startDay: 0,  duration: 5,  progress: 100, status: 'completed' as const },
  { id: 't2', name: 'Diseño CAD/CAM',           department: 'Diseño' as const,     startDay: 2,  duration: 8,  progress: 100, status: 'completed' as const },
  { id: 't3', name: 'Maquinado CNC Fase 1',    department: 'Producción' as const, startDay: 10, duration: 12, progress: 65,  status: 'in-progress' as const },
  { id: 't4', name: 'Tratamiento Térmico',     department: 'Producción' as const, startDay: 22, duration: 4,  progress: 0,   status: 'pending' as const },
  { id: 't5', name: 'Inspección No Destructiva', department: 'Calidad' as const,  startDay: 26, duration: 3,  progress: 0,   status: 'pending' as const },
  { id: 't6', name: 'Empaque y Logística',      department: 'Producción' as const, startDay: 29, duration: 2,  progress: 0,   status: 'pending' as const },
];

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'outline' | 'warning'> = {
  'Cotización':     'warning',
  'Diseño':         'secondary',
  'En Producción':  'default',
  'Calidad':        'success',
  'Entregado':      'outline',
};

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const initialProject = getMockProject(id || 'IMC-2026-042');
  const [status, setStatus] = useState(initialProject.status);
  const [history, setHistory] = useState(initialProject.history);
  const [newNote, setNewNote] = useState('');
  const [isMasterPlanOpen, setIsMasterPlanOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const { data: portalToken } = useClientPortalToken(initialProject.id);

  // Shape mínimo compatible con ShareClientLinkModal
  const projectForShare = {
    id: initialProject.id,
    name: initialProject.name,
    client_name: initialProject.client,
  } as Project;

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const noteEntry = {
      id: history.length + 1,
      user: 'Usuario actual',
      action: `agregó una nota: "${newNote}"`,
      date: new Date().toISOString(),
      type: 'note',
    };

    setHistory([noteEntry, ...history]);
    setNewNote('');
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const statusEntry = {
      id: history.length + 1,
      user: 'Usuario actual',
      action: `cambió el estado a "${newStatus}"`,
      date: new Date().toISOString(),
      type: 'system',
    };
    setHistory([statusEntry, ...history]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[var(--color-app-text)]">{initialProject.name}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                    <Badge variant={statusVariant[status] ?? 'default'} className="cursor-pointer">
                      {status}
                      <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.keys(statusVariant).map(s => (
                    <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
              <span className="font-mono">{initialProject.id}</span> · Cliente: {initialProject.client}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsMasterPlanOpen(true)}>
            <BarChart3 className="h-4 w-4 mr-1.5" /> Master plan
          </Button>
          <Button onClick={() => setIsReportOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Generar reporte
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: overview & tasks */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Resumen del proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Manager
                  </p>
                  <p className="text-sm font-medium mt-1">{initialProject.manager}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Inicio
                  </p>
                  <p className="text-sm font-medium mt-1">28 feb 2026</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Entrega
                  </p>
                  <p className="text-sm font-medium mt-1">14 abr 2026</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-app-text-muted)]">Progreso general</span>
                  <span className="font-medium">{initialProject.progress}%</span>
                </div>
                <Progress value={initialProject.progress} className="h-2" />
              </div>

              <div className="p-4 rounded-md bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)]">
                <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-1.5">
                  <FileText className="h-3.5 w-3.5" /> Descripción
                </p>
                <p className="text-sm leading-relaxed">{initialProject.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Plan de trabajo
                </CardTitle>
                <CardDescription>Tareas y fases del proyecto</CardDescription>
              </div>
              <Button variant="outline" size="sm">Añadir tarea</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {initialProject.tasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-md border border-[var(--color-app-border)] bg-white hover:border-[var(--color-app-primary)]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-[var(--color-app-success)]" />
                      ) : task.status === 'in-progress' ? (
                        <div className="h-5 w-5 rounded-full border-2 border-[var(--color-app-primary)] border-t-transparent animate-spin" />
                      ) : (
                        <Circle className="h-5 w-5 text-[var(--color-app-text-subtle)]" />
                      )}
                      <div>
                        <p
                          className={cn(
                            'text-sm font-medium',
                            task.status === 'completed' ? 'text-[var(--color-app-text-muted)] line-through' : 'text-[var(--color-app-text)]'
                          )}
                        >
                          {task.name}
                        </p>
                        <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                          Programado: {format(new Date(task.date), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        task.status === 'completed' ? 'success' : task.status === 'in-progress' ? 'default' : 'secondary'
                      }
                    >
                      {task.status === 'completed'
                        ? 'Completado'
                        : task.status === 'in-progress'
                        ? 'En proceso'
                        : 'Pendiente'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: activity & docs */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Actividad y notas
              </CardTitle>
              <CardDescription>Historial de cambios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Escribir una nota..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
                <Button onClick={handleAddNote} disabled={!newNote.trim()} className="w-full">
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Agregar nota
                </Button>
              </div>

              <div className="relative border-l border-[var(--color-app-border)] ml-2 space-y-4 pt-2">
                {history.map(item => (
                  <div key={item.id} className="relative pl-5">
                    <span
                      className={cn(
                        'absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white',
                        item.type === 'note' ? 'bg-[var(--color-app-info)]' : 'bg-[var(--color-app-primary)]'
                      )}
                    />
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{item.user}</span>{' '}
                      <span className="text-[var(--color-app-text-muted)]">{item.action}</span>
                    </p>
                    <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                      {format(new Date(item.date), "dd MMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Portal del cliente
              </CardTitle>
              <CardDescription>
                {portalToken
                  ? 'Enlace activo · QR, correo y WhatsApp disponibles.'
                  : 'Genera un enlace seguro de solo lectura para tu cliente.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsShareOpen(true)} className="w-full" variant={portalToken ? 'outline' : 'default'}>
                <Share2 className="h-4 w-4 mr-1.5" />
                {portalToken ? 'Compartir con el cliente' : 'Generar enlace'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: 'Planos_V2.pdf', size: '2.4 MB', when: 'hace 2 días' },
                { name: 'Cotización.pdf', size: '1.1 MB', when: 'hace 1 semana' },
              ].map(doc => (
                <div
                  key={doc.name}
                  className="flex items-center gap-3 p-2.5 rounded-md hover:bg-[var(--color-app-surface-alt)] cursor-pointer transition-colors"
                >
                  <div className="p-2 bg-[var(--color-app-primary-soft)] rounded-md">
                    <FileText className="h-4 w-4 text-[var(--color-app-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-[var(--color-app-text-muted)]">
                      {doc.size} · {doc.when}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Master plan dialog */}
      <Dialog open={isMasterPlanOpen} onOpenChange={setIsMasterPlanOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Master plan · Gantt</DialogTitle>
            <DialogDescription>
              Cronograma integrado · {initialProject.id}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            <GanttChart startDate={initialProject.startDate} tasks={GANTT_MOCK_DATA} />
          </div>
        </DialogContent>
      </Dialog>

      <ProjectReport
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        project={{ ...initialProject, status }}
        ganttTasks={GANTT_MOCK_DATA}
      />

      <ShareClientLinkModal
        project={projectForShare}
        open={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}
