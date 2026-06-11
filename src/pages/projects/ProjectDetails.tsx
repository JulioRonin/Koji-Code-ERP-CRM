import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Share2,
  Sparkles,
  Loader2,
  Flag,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';
import { format, isValid, parseISO, differenceInDays } from 'date-fns';
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
import { MasterPlanWizard } from '@/components/projects/MasterPlanWizard';
import { MasterPlanTaskList } from '@/components/projects/MasterPlanTaskList';
import { AdHocTaskForm } from '@/components/projects/AdHocTaskForm';
import { MeetingsCard } from '@/components/projects/MeetingsCard';
import { ShareClientLinkModal } from '@/components/client-portal/ShareClientLinkModal';
import {
  useProject,
  useUpdateProjectStatus,
  useProjectTasks,
  useAddProjectTask,
  useUpdateProjectTaskStatus,
  useProjectNotes,
  useAddProjectNote,
  useMasterPlan,
  useMasterPlanTasks,
  useBomItems,
  summarizePurchasing,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ProjectStatus, MasterPlanTask, ProjectTask } from '@/types/database';

const statusVariant: Record<ProjectStatus, 'default' | 'secondary' | 'success' | 'outline' | 'warning'> = {
  Cotización:     'warning',
  Diseño:         'secondary',
  Compras:        'secondary',
  'En Producción': 'default',
  Calidad:        'success',
  Embarque:       'success',
  Entregado:      'outline',
  Cancelado:      'outline',
};

const taskBadge: Record<ProjectTask['status'], 'success' | 'default' | 'secondary' | 'outline'> = {
  completed: 'success',
  'in-progress': 'default',
  pending: 'secondary',
  cancelled: 'outline',
};

const DEPT_COLORS: Record<string, string> = {
  Compras:    '#7c3aed',
  Diseño:     '#0ea5e9',
  Producción: '#0369a1',
  Calidad:    '#15803d',
  Embarque:   '#0d9488',
};

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const { data: project, loading: loadingProject, refetch: refetchProject } = useProject(id);
  const { update: updateStatus } = useUpdateProjectStatus();
  const { data: bomItems } = useBomItems(id);

  const { data: tasks, refetch: refetchTasks } = useProjectTasks(id);
  const { add: addTask } = useAddProjectTask();
  const { update: updateTaskStatus } = useUpdateProjectTaskStatus();

  const { data: notes, refetch: refetchNotes } = useProjectNotes(id);
  const { add: addNote } = useAddProjectNote();

  const { data: masterPlan, refetch: refetchMasterPlan } = useMasterPlan(id);
  const { data: masterPlanTasks, refetch: refetchMasterPlanTasks } = useMasterPlanTasks(masterPlan?.id);

  const [newNote, setNewNote] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [isMasterPlanOpen, setIsMasterPlanOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(searchParams.get('wizard') === '1');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Limpia el query string una vez consumido
  React.useEffect(() => {
    if (searchParams.get('wizard') === '1' && isWizardOpen) {
      const next = new URLSearchParams(searchParams);
      next.delete('wizard');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cálculos derivados ──────────────────────────────────────────────────
  const completedTasks = useMemo(() => tasks.filter(t => t.status === 'completed').length, [tasks]);
  const purchasingSummary = useMemo(() => summarizePurchasing(bomItems), [bomItems]);

  const ganttTasks = useMemo(() => {
    if (!masterPlan && tasks.filter(t => t.start_date && t.end_date).length === 0) return [];

    const planStart = masterPlan
      ? parseISO(masterPlan.baseline_start)
      : (() => {
          const dated = tasks
            .filter(t => t.start_date)
            .map(t => parseISO(t.start_date!))
            .sort((a, b) => a.getTime() - b.getTime());
          return dated[0] ?? parseISO(project?.start_date ?? new Date().toISOString());
        })();

    const fromPlan = masterPlanTasks.map(t => {
      const start = parseISO(t.start_date);
      const end = parseISO(t.end_date);
      const startDay = Math.max(0, differenceInDays(start, planStart));
      const duration = Math.max(1, differenceInDays(end, start));
      let status: 'pending' | 'in-progress' | 'completed' = 'pending';
      if (t.progress >= 100) status = 'completed';
      else if (t.progress > 0) status = 'in-progress';
      return {
        id: t.id,
        name: t.name,
        department: (t.department ?? 'Producción') as 'Compras' | 'Diseño' | 'Producción' | 'Calidad',
        startDay,
        duration,
        progress: t.progress,
        status,
      };
    });

    const fromTasks = tasks
      .filter(t => t.start_date && t.end_date)
      .map(t => {
        const start = parseISO(t.start_date!);
        const end = parseISO(t.end_date!);
        const startDay = Math.max(0, differenceInDays(start, planStart));
        const duration = Math.max(1, differenceInDays(end, start));
        let status: 'pending' | 'in-progress' | 'completed' = 'pending';
        if (t.status === 'completed' || t.progress >= 100) status = 'completed';
        else if (t.status === 'in-progress' || t.progress > 0) status = 'in-progress';
        return {
          id: t.id,
          name: `★ ${t.name}`, // marca visual de tarea ad-hoc
          department: ((t.department as string) ?? 'Producción') as 'Compras' | 'Diseño' | 'Producción' | 'Calidad',
          startDay,
          duration,
          progress: t.progress,
          status,
        };
      });

    return [...fromPlan, ...fromTasks];
  }, [masterPlan, masterPlanTasks, tasks, project?.start_date]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;
    await addNote({
      project_id: id,
      user_id: user?.id ?? null,
      user_name: user?.name ?? 'Usuario',
      action: `agregó una nota: "${newNote}"`,
      note_type: 'note',
    });
    setNewNote('');
    await refetchNotes();
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!id) return;
    setFeedback(null);
    try {
      await updateStatus(id, newStatus);
      // Solo registramos la nota si el update sí pasó
      try {
        await addNote({
          project_id: id,
          user_id: user?.id ?? null,
          user_name: user?.name ?? 'Usuario',
          action: `cambió el estado a "${newStatus}"`,
          note_type: 'status_change',
        });
      } catch {
        /* ignore note failure */
      }
      await Promise.all([refetchProject(), refetchNotes()]);
      setFeedback({ tone: 'success', text: `Estado actualizado a "${newStatus}".` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ tone: 'error', text: (err as Error).message });
    }
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim() || !id) return;
    setIsAddingTask(true);
    try {
      await addTask(id, newTaskName);
      setNewTaskName('');
      await refetchTasks();
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleTask = async (task: ProjectTask) => {
    const next: ProjectTask['status'] =
      task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in-progress' : 'completed';
    await updateTaskStatus(task.id, next);
    await refetchTasks();
  };

  // ── Render guards ──────────────────────────────────────────────────────
  if (loadingProject) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[var(--color-app-text-muted)]">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando proyecto...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-app-text-muted)]">
          No se encontró el proyecto <code className="font-mono">{id}</code>.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/projects')}>
          ← Volver a proyectos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-semibold truncate">{project.name}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                    <Badge variant={statusVariant[project.status] ?? 'default'} className="cursor-pointer">
                      {project.status}
                      <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(statusVariant) as ProjectStatus[]).map(s => (
                    <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
              <span className="font-mono">{project.id}</span> · Cliente: {project.client_name}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {masterPlan ? (
            <Button variant="outline" onClick={() => setIsMasterPlanOpen(true)}>
              <BarChart3 className="h-4 w-4 mr-1.5" /> Master plan
            </Button>
          ) : (
            <Button onClick={() => setIsWizardOpen(true)}>
              <Sparkles className="h-4 w-4 mr-1.5" /> Generar master plan
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsReportOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Reporte
          </Button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={cn(
            'flex items-start gap-2 p-3 rounded-md text-sm',
            feedback.tone === 'success'
              ? 'bg-[var(--color-app-success-soft)] text-[var(--color-app-success)]'
              : 'bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]'
          )}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <div className="leading-snug flex-1">{feedback.text}</div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        {/* Left: overview & tasks */}
        <div className="lg:col-span-2 space-y-5 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Resumen del proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem icon={User} label="Manager" value={project.manager_id ?? '—'} />
                <SummaryItem
                  icon={Calendar}
                  label="Inicio"
                  value={isValid(parseISO(project.start_date)) ? format(parseISO(project.start_date), 'dd MMM yyyy', { locale: es }) : '—'}
                />
                <SummaryItem
                  icon={Clock}
                  label="Entrega"
                  value={isValid(parseISO(project.deadline)) ? format(parseISO(project.deadline), 'dd MMM yyyy', { locale: es }) : '—'}
                />
                <SummaryItem icon={Flag} label="Partes BOM" value={String(bomItems.length)} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-app-text-muted)]">Progreso general</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>

              {bomItems.length > 0 && (
                <div className="p-3 rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)]/40 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-[var(--color-app-text-muted)]">
                      <ShoppingCart className="h-3.5 w-3.5" /> Avance de compras
                    </span>
                    <span className="font-medium">
                      {purchasingSummary.progress_pct}%{' '}
                      <span className="text-xs text-[var(--color-app-text-muted)] font-normal">
                        ({purchasingSummary.received_items}/{purchasingSummary.total_items})
                      </span>
                    </span>
                  </div>
                  <Progress value={purchasingSummary.progress_pct} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs text-[var(--color-app-text-muted)]">
                    <span>
                      Presupuesto:{' '}
                      <strong className="text-[var(--color-app-text)]">
                        {purchasingSummary.total_cost.toLocaleString('es-MX', {
                          style: 'currency',
                          currency: purchasingSummary.currency || 'MXN',
                          maximumFractionDigits: 0,
                        })}
                      </strong>
                    </span>
                    {purchasingSummary.late_items > 0 ? (
                      <span className="text-[var(--color-app-warning)] flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {purchasingSummary.late_items} atrasadas
                      </span>
                    ) : (
                      <span>Sin atrasos</span>
                    )}
                  </div>
                </div>
              )}

              {project.description && (
                <div className="p-4 rounded-md bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)]">
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-1.5">
                    <FileText className="h-3.5 w-3.5" /> Descripción
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Master Plan summary */}
          {masterPlan ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--color-app-primary)]" /> Master Plan{' '}
                    <Badge variant="success" className="ml-1">{masterPlan.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {masterPlan.template_used} · {masterPlan.methodology} · v{masterPlan.version}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsMasterPlanOpen(true)}>
                  Ver Gantt
                </Button>
              </CardHeader>
              <CardContent>
                <MasterPlanSummary tasks={masterPlanTasks} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[var(--color-app-primary-soft)] flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-[var(--color-app-primary)]" />
                </div>
                <div>
                  <p className="font-medium">Este proyecto aún no tiene Master Plan</p>
                  <p className="text-sm text-[var(--color-app-text-muted)] mt-1 max-w-md">
                    Genera un plan formal PMI con fechas, Gantt, hitos y ruta crítica para presentarlo al cliente.
                  </p>
                </div>
                <Button onClick={() => setIsWizardOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-1.5" /> Generar master plan
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Calendario de juntas (si existen) */}
          <MeetingsCard projectId={project.id} />

          {/* Plan de trabajo — si hay master plan, muestra sus activities editables;
              si no, las tareas ad-hoc del proyecto. */}
          {masterPlan && masterPlanTasks.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Plan de trabajo
                </CardTitle>
                <CardDescription>
                  {masterPlanTasks.filter(t => t.progress >= 100).length} de{' '}
                  {masterPlanTasks.length} actividades completadas · click en cualquier actividad
                  para actualizar su avance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MasterPlanTaskList
                  tasks={masterPlanTasks}
                  onUpdated={async () => {
                    // Refresca tareas (fechas / avance), el plan (baseline_end)
                    // y el proyecto (% global recalculado).
                    await Promise.all([
                      refetchMasterPlanTasks(),
                      refetchMasterPlan(),
                      refetchProject(),
                    ]);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Plan de trabajo
                </CardTitle>
                <CardDescription>
                  Sin Master Plan formal aún. Mientras tanto, registra tareas con fechas y se
                  verán en el Gantt y el reporte.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdHocTaskForm
                  projectId={project.id}
                  tasks={tasks}
                  onChanged={async () => {
                    await refetchTasks();
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Tareas adicionales — con fechas, duración y departamento;
              aparecen en el Gantt y el reporte */}
          {masterPlan && (
            <details className="rounded-xl border border-[var(--color-app-border)] bg-white" open={tasks.length > 0}>
              <summary className="cursor-pointer p-4 text-sm font-medium flex items-center justify-between hover:bg-[var(--color-app-surface-alt)]/40 rounded-xl">
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                  Tareas adicionales · {tasks.length}
                </span>
                <span className="text-xs text-[var(--color-app-text-muted)] hidden sm:inline">
                  Aparecen en el Gantt y reporte
                </span>
              </summary>
              <div className="p-4 pt-0 border-t border-[var(--color-app-border)]">
                <AdHocTaskForm
                  projectId={project.id}
                  tasks={tasks}
                  onChanged={async () => {
                    await refetchTasks();
                  }}
                />
              </div>
            </details>
          )}
        </div>

        {/* Right: activity & docs */}
        <div className="space-y-5 md:space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Portal del cliente
              </CardTitle>
              <CardDescription>
                {project.client_portal_token
                  ? 'Enlace activo · compartir vía QR, correo o WhatsApp.'
                  : 'Genera un enlace seguro de solo lectura para tu cliente.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setIsShareOpen(true)}
                className="w-full"
                variant={project.client_portal_token ? 'outline' : 'default'}
              >
                <Share2 className="h-4 w-4 mr-1.5" />
                {project.client_portal_token ? 'Compartir con el cliente' : 'Generar enlace'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Actividad y notas
              </CardTitle>
              <CardDescription>Historial real del proyecto</CardDescription>
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

              {notes.length === 0 ? (
                <p className="text-sm text-[var(--color-app-text-muted)] text-center py-4">
                  Sin actividad registrada aún.
                </p>
              ) : (
                <div className="relative border-l border-[var(--color-app-border)] ml-2 space-y-4 pt-2">
                  {notes.map(item => (
                    <div key={item.id} className="relative pl-5">
                      <span
                        className={cn(
                          'absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white',
                          item.note_type === 'note' && 'bg-[var(--color-app-info)]',
                          item.note_type === 'status_change' && 'bg-[var(--color-app-warning)]',
                          item.note_type === 'milestone' && 'bg-[var(--color-app-success)]',
                          item.note_type === 'system' && 'bg-[var(--color-app-primary)]'
                        )}
                      />
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{item.user_name ?? 'Sistema'}</span>{' '}
                        <span className="text-[var(--color-app-text-muted)]">{item.action}</span>
                      </p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                        {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Master Plan dialog (Gantt completo) */}
      <Dialog open={isMasterPlanOpen} onOpenChange={setIsMasterPlanOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle>Master Plan · Gantt</DialogTitle>
            <DialogDescription>
              {masterPlan
                ? `${masterPlan.template_used} · ${masterPlan.methodology} · ${project.id}`
                : 'Sin plan generado'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            {ganttTasks.length > 0 ? (
              <GanttChart startDate={masterPlan?.baseline_start ?? project.start_date} tasks={ganttTasks} />
            ) : (
              <p className="text-sm text-[var(--color-app-text-muted)] text-center py-8">
                Aún no hay actividades en el Master Plan.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProjectReport
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        project={{
          id: project.id,
          name: project.name,
          client: project.client_name,
          status: project.status,
          progress: project.progress,
          startDate: project.start_date,
          deadline: project.deadline,
          manager: project.manager_id ?? '—',
          description: project.description ?? '',
          tasks: [],
        }}
        ganttTasks={ganttTasks}
      />

      <ShareClientLinkModal
        project={project}
        open={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />

      <MasterPlanWizard
        project={project}
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCreated={async () => {
          try {
            await refetchMasterPlan();
            await addNote({
              project_id: project.id,
              user_id: user?.id ?? null,
              user_name: user?.name ?? 'Usuario',
              action: 'generó el Master Plan del proyecto',
              note_type: 'milestone',
            });
            await refetchNotes();
          } catch (err) {
            // No bloquea la publicación del plan
            console.warn('Post-publish actions failed', err);
          }
        }}
      />
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="text-sm font-medium mt-1 truncate">{value}</p>
    </div>
  );
}

function MasterPlanSummary({ tasks }: { tasks: MasterPlanTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-[var(--color-app-text-muted)]">Sin actividades.</p>;
  }

  const milestones = tasks.filter(t => t.is_milestone);
  const critical = tasks.filter(t => t.is_critical_path);
  const avgProgress = Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Actividades" value={String(tasks.length)} />
        <Stat label="Críticas" value={String(critical.length)} tone="danger" />
        <Stat label="Hitos" value={String(milestones.length)} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-app-text-muted)]">Avance del plan</span>
          <span className="font-medium">{avgProgress}%</span>
        </div>
        <Progress value={avgProgress} className="h-2" />
      </div>

      {milestones.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--color-app-text-muted)] uppercase mb-2">Próximos hitos</p>
          <div className="space-y-1.5">
            {milestones.slice(0, 4).map(m => {
              const date = parseISO(m.end_date);
              const daysLeft = differenceInDays(date, new Date());
              return (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <Flag
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      m.progress >= 100 ? 'text-[var(--color-app-success)]' : 'text-[var(--color-app-warning)]'
                    )}
                  />
                  <span className="font-mono text-xs text-[var(--color-app-text-muted)]">{m.wbs_code}</span>
                  <span className="truncate flex-1">{m.name}</span>
                  <span
                    className={cn(
                      'text-xs shrink-0',
                      daysLeft < 0
                        ? 'text-[var(--color-app-danger)]'
                        : daysLeft <= 7
                        ? 'text-[var(--color-app-warning)]'
                        : 'text-[var(--color-app-text-muted)]'
                    )}
                  >
                    {m.progress >= 100
                      ? format(date, 'dd MMM', { locale: es })
                      : daysLeft >= 0
                      ? `${daysLeft}d`
                      : `${-daysLeft}d atraso`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {critical.length > 0 && (
        <div className="p-3 bg-[var(--color-app-danger-soft)]/40 rounded-md text-xs text-[var(--color-app-text-muted)] flex gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--color-app-danger)]" />
          <div>
            <strong className="text-[var(--color-app-danger)]">Ruta crítica:</strong> cualquier retraso en{' '}
            {critical.length} actividad{critical.length === 1 ? '' : 'es'} impacta directamente la fecha de entrega.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="p-3 rounded-md border border-[var(--color-app-border)]">
      <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold mt-0.5 tabular-nums',
          tone === 'danger' && 'text-[var(--color-app-danger)]'
        )}
      >
        {value}
      </p>
    </div>
  );
}
