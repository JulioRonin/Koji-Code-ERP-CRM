import React, { useMemo, useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  CalendarRange,
  AlertTriangle,
  ListChecks,
  Sparkles,
  Flag,
  Zap,
  Users,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import {
  MASTER_PLAN_TEMPLATES,
  scheduleTasks,
  projectEndDate,
  useCreateMasterPlan,
  useCreateMeetings,
  DEFAULT_MEETING_CONFIGS,
  generateMeetingDates,
  type MasterPlanTemplate,
  type MeetingTemplateConfig,
} from '@/lib/api';
import type { Project, MasterPlanMethodology, MasterPlanTask } from '@/types/database';
import { cn } from '@/lib/utils';

interface MasterPlanWizardProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onCreated?: (planId: string) => void;
}

const STEPS = [
  { id: 1, label: 'Plantilla',  icon: ClipboardList },
  { id: 2, label: 'Cronograma', icon: CalendarRange },
  { id: 3, label: 'Riesgos',    icon: AlertTriangle },
  { id: 4, label: 'Juntas',     icon: Users },
  { id: 5, label: 'Revisar',    icon: Check },
] as const;

const DEPT_COLORS: Record<string, string> = {
  Compras:    '#7c3aed',
  Diseño:     '#0ea5e9',
  Producción: '#0369a1',
  Calidad:    '#15803d',
  Embarque:   '#0d9488',
};

export function MasterPlanWizard({ project, open, onClose, onCreated }: MasterPlanWizardProps) {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<MasterPlanTemplate>(MASTER_PLAN_TEMPLATES[0]);
  const [methodology, setMethodology] = useState<MasterPlanMethodology>('PMI-Predictivo');
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [riskSummary, setRiskSummary] = useState<string>(MASTER_PLAN_TEMPLATES[0].defaultRiskSummary);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingConfigs, setMeetingConfigs] = useState<MeetingTemplateConfig[]>(
    DEFAULT_MEETING_CONFIGS.map(c => ({ ...c }))
  );

  const { create } = useCreateMasterPlan();
  const { create: createMeetings } = useCreateMeetings();

  // Cronograma calculado en vivo
  const scheduled = useMemo(() => {
    return scheduleTasks(template, parseISO(startDate));
  }, [template, startDate]);

  const calculatedEnd = useMemo(() => projectEndDate(scheduled), [scheduled]);
  const projectDeadline = parseISO(project.deadline);
  const slackDays = Math.round((projectDeadline.getTime() - calculatedEnd.getTime()) / (1000 * 60 * 60 * 24));

  const criticalCount = scheduled.filter(t => t.is_critical).length;
  const milestoneCount = scheduled.filter(t => t.is_milestone).length;

  const handleTemplateChange = (t: MasterPlanTemplate) => {
    setTemplate(t);
    setRiskSummary(t.defaultRiskSummary);
  };

  const handleSubmit = async () => {
    setCreating(true);
    setError(null);
    try {
      const tasks: Omit<MasterPlanTask, 'id' | 'master_plan_id' | 'created_at' | 'updated_at'>[] = scheduled.map(
        (t, i) => ({
          wbs_code: t.wbs,
          name: t.name,
          department: t.department,
          start_date: format(t.start_date, 'yyyy-MM-dd'),
          end_date: format(t.end_date, 'yyyy-MM-dd'),
          progress: 0,
          is_milestone: t.is_milestone,
          is_critical_path: t.is_critical ?? false,
          dependencies: t.depends_on,
          assigned_to: null,
          notes: null,
          sort_order: i,
        })
      );

      const plan = await create({
        project_id: project.id,
        template_used: template.id,
        methodology,
        baseline_start: startDate,
        risk_summary: riskSummary,
        tasks,
      });

      // Generar juntas si hay configuraciones habilitadas
      const enabledMeetings = meetingConfigs.filter(c => c.enabled);
      if (enabledMeetings.length > 0) {
        const baselineStart = parseISO(startDate);
        const baselineEnd = calculatedEnd;
        const meetingsToCreate = enabledMeetings.flatMap(config => {
          const dates = generateMeetingDates(config, baselineStart, baselineEnd);
          return dates.map((d, idx) => ({
            project_id: project.id,
            master_plan_id: plan.id,
            title:
              dates.length > 1
                ? `${config.title} #${idx + 1}`
                : config.title,
            meeting_type: config.type,
            scheduled_at: d.toISOString(),
            duration_minutes: config.duration_minutes,
            attendees: config.attendees,
          }));
        });
        try {
          if (meetingsToCreate.length > 0) {
            await createMeetings(meetingsToCreate);
          }
        } catch (mtgErr) {
          console.warn('No se pudieron crear las juntas', mtgErr);
        }
      }

      // Cierra primero, después callback en background — así si onCreated
      // (refetch + agregar nota) tira un error, el plan ya quedó publicado.
      onClose();
      setStep(1);
      try {
        await onCreated?.(plan.id);
      } catch (cbErr) {
        console.warn('onCreated callback failed (master plan ya fue publicado)', cbErr);
      }
    } catch (err) {
      const e = err as Error & { message?: string; code?: string; details?: string };
      console.error('Master Plan publish failed', e);
      let msg = e.message || 'No se pudo publicar el master plan.';
      // Pista útil cuando las tablas no existen aún
      if (msg.includes('master_plans') || msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('not exist')) {
        msg =
          'Las tablas master_plans / master_plan_tasks no existen en la base de datos. ' +
          'Re-corre database_schema.sql en el SQL editor de Supabase y vuelve a intentar.';
      } else if (msg.includes('row-level security') || msg.includes('policy')) {
        msg = 'No tienes permisos para crear el master plan (RLS). Verifica que tu profile.department sea Administrador o Administración / PM.';
      }
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const canGoNext = (() => {
    if (step === 1) return !!template;
    if (step === 2) return scheduled.length > 0;
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--color-app-border)] shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-app-primary)]" />
            Generar Master Plan
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{project.name}</span> · {project.client_name} · entrega{' '}
            {format(projectDeadline, 'dd MMM yyyy', { locale: es })}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-[var(--color-app-border)] flex items-center gap-2 overflow-x-auto shrink-0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors shrink-0',
                  step === s.id
                    ? 'bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
                    : step > s.id
                    ? 'text-[var(--color-app-success)]'
                    : 'text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]'
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                    step === s.id
                      ? 'bg-[var(--color-app-primary)] text-white'
                      : step > s.id
                      ? 'bg-[var(--color-app-success)] text-white'
                      : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]'
                  )}
                >
                  {step > s.id ? <Check className="h-3 w-3" /> : s.id}
                </span>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-[var(--color-app-border)] min-w-2" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* STEP 1 — TEMPLATE */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold mb-1">¿Qué tipo de proyecto es?</h3>
                <p className="text-sm text-[var(--color-app-text-muted)]">
                  Elige la plantilla que más se parezca. Después podrás ajustar duraciones, hitos y dependencias.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {MASTER_PLAN_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateChange(t)}
                    className={cn(
                      'text-left p-4 rounded-lg border-2 transition-all',
                      template.id === t.id
                        ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)]/30'
                        : 'border-[var(--color-app-border)] hover:border-[var(--color-app-primary)]/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-[var(--color-app-text-muted)] mt-1 leading-snug">
                          {t.description}
                        </p>
                      </div>
                      {template.id === t.id && (
                        <Check className="h-4 w-4 text-[var(--color-app-primary)] shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-app-text-muted)]">
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-3 w-3" /> {t.tasks.length} actividades
                      </span>
                      <span className="flex items-center gap-1">
                        <Flag className="h-3 w-3" /> {t.tasks.filter(x => x.is_milestone).length} hitos
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Metodología</label>
                  <select
                    value={methodology}
                    onChange={e => setMethodology(e.target.value as MasterPlanMethodology)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                  >
                    <option value="PMI-Predictivo">PMI · Predictivo (cascada)</option>
                    <option value="Ágil">Ágil</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fecha de inicio</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — CRONOGRAMA */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Cronograma calculado</h3>
                <p className="text-sm text-[var(--color-app-text-muted)]">
                  Las dependencias entre actividades determinan las fechas. Las marcadas{' '}
                  <Badge variant="destructive" className="ml-1">crítica</Badge> están en la ruta crítica.
                </p>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Actividades" value={String(scheduled.length)} />
                <StatCard label="En ruta crítica" value={String(criticalCount)} tone="danger" />
                <StatCard label="Hitos" value={String(milestoneCount)} />
                <StatCard
                  label={slackDays >= 0 ? 'Holgura' : 'Atraso vs deadline'}
                  value={`${Math.abs(slackDays)}d`}
                  tone={slackDays >= 0 ? 'success' : 'danger'}
                />
              </div>

              {/* Gantt schematic */}
              <Card className="p-0 overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <GanttPreview tasks={scheduled} startDate={parseISO(startDate)} />
                </div>
              </Card>

              {slackDays < 0 && (
                <div className="p-3 bg-[var(--color-app-danger-soft)] rounded-md flex gap-2 text-sm text-[var(--color-app-danger)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    El plan termina <strong>{Math.abs(slackDays)} días después</strong> del deadline del proyecto
                    ({format(projectDeadline, 'dd MMM', { locale: es })}). Considera arrancar antes o reducir duraciones.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — RIESGOS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Riesgos identificados</h3>
                <p className="text-sm text-[var(--color-app-text-muted)]">
                  Documenta los riesgos típicos del proyecto. Aparecerán en los reportes PMO al cliente.
                </p>
              </div>

              <textarea
                value={riskSummary}
                onChange={e => setRiskSummary(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                placeholder="Riesgos típicos..."
              />

              <div className="p-3 bg-[var(--color-app-info-soft)]/50 rounded-md text-xs text-[var(--color-app-text-muted)] flex gap-2">
                <Zap className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-app-info)]" />
                <div>
                  <strong>Tip:</strong> próximamente añadiremos sugerencias automáticas con IA basadas en la
                  plantilla, materiales y deadline. Mientras tanto, ajusta el texto a tu contexto.
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — JUNTAS */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Calendario de juntas</h3>
                <p className="text-sm text-[var(--color-app-text-muted)]">
                  Define las reuniones de seguimiento que se calendarizarán automáticamente
                  entre el inicio y el fin del proyecto. Generan el <em>readiness</em> formal del PMI.
                </p>
              </div>

              <div className="space-y-3">
                {meetingConfigs.map((config, idx) => {
                  const previewDates = config.enabled
                    ? generateMeetingDates(config, parseISO(startDate), calculatedEnd)
                    : [];
                  return (
                    <Card key={config.type} className="p-0">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setMeetingConfigs(prev =>
                                prev.map((c, i) => (i === idx ? { ...c, enabled: !c.enabled } : c))
                              )
                            }
                            className={cn(
                              'h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                              config.enabled
                                ? 'bg-[var(--color-app-primary)] border-[var(--color-app-primary)]'
                                : 'border-[var(--color-app-border-strong)] bg-white'
                            )}
                          >
                            {config.enabled && <Check className="h-3 w-3 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{config.type}</Badge>
                              <span className="font-medium text-sm">{config.title}</span>
                            </div>
                            <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                              {config.description}
                            </p>
                          </div>
                        </div>

                        {config.enabled && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-8">
                            <div>
                              <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                                Hora
                              </label>
                              <Input
                                type="time"
                                value={config.time}
                                onChange={e =>
                                  setMeetingConfigs(prev =>
                                    prev.map((c, i) => (i === idx ? { ...c, time: e.target.value } : c))
                                  )
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                                Duración (min)
                              </label>
                              <Input
                                type="number"
                                min={15}
                                step={15}
                                value={config.duration_minutes}
                                onChange={e =>
                                  setMeetingConfigs(prev =>
                                    prev.map((c, i) =>
                                      i === idx ? { ...c, duration_minutes: Number(e.target.value) || 30 } : c
                                    )
                                  )
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            {(config.frequency === 'weekly' ||
                              config.frequency === 'biweekly' ||
                              config.frequency === 'monthly') && (
                              <div>
                                <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                                  Día semana
                                </label>
                                <select
                                  value={config.weekday ?? 1}
                                  onChange={e =>
                                    setMeetingConfigs(prev =>
                                      prev.map((c, i) =>
                                        i === idx ? { ...c, weekday: Number(e.target.value) } : c
                                      )
                                    )
                                  }
                                  className="w-full h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs"
                                >
                                  <option value={1}>Lunes</option>
                                  <option value={2}>Martes</option>
                                  <option value={3}>Miércoles</option>
                                  <option value={4}>Jueves</option>
                                  <option value={5}>Viernes</option>
                                </select>
                              </div>
                            )}
                            <div className="col-span-2 sm:col-span-1">
                              <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">
                                Sesiones
                              </label>
                              <div className="h-8 px-2 flex items-center text-xs font-medium text-[var(--color-app-text-muted)]">
                                {previewDates.length}{' '}
                                {previewDates.length === 1 ? 'junta' : 'juntas'}
                              </div>
                            </div>
                          </div>
                        )}

                        {config.enabled && previewDates.length > 0 && (
                          <div className="pl-8 flex flex-wrap gap-1.5">
                            {previewDates.slice(0, 6).map((d, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                                {format(d, "d MMM HH:mm", { locale: es })}
                              </Badge>
                            ))}
                            {previewDates.length > 6 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{previewDates.length - 6}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="p-3 bg-[var(--color-app-info-soft)]/50 rounded-md text-xs text-[var(--color-app-text-muted)] flex gap-2">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-[var(--color-app-info)]" />
                <div>
                  Las juntas se generan al publicar el master plan. Después podrás marcarlas como
                  realizadas o canceladas desde el proyecto.
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 — REVISAR */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Revisar y publicar</h3>
                <p className="text-sm text-[var(--color-app-text-muted)]">
                  Al publicar, el master plan queda activo y aparecerá en el proyecto y en PMO.
                </p>
              </div>

              <Card className="p-0">
                <CardContent className="p-5 space-y-3 text-sm">
                  <ReviewRow label="Proyecto"           value={`${project.name} (${project.id})`} />
                  <ReviewRow label="Cliente"            value={project.client_name} />
                  <ReviewRow label="Plantilla"          value={template.name} />
                  <ReviewRow label="Metodología"        value={methodology} />
                  <ReviewRow label="Inicio"             value={format(parseISO(startDate), 'dd MMM yyyy', { locale: es })} />
                  <ReviewRow label="Fin calculado"      value={format(calculatedEnd, 'dd MMM yyyy', { locale: es })} />
                  <ReviewRow label="Deadline cliente"   value={format(projectDeadline, 'dd MMM yyyy', { locale: es })} />
                  <ReviewRow label="Holgura"            value={`${slackDays} días`}              tone={slackDays >= 0 ? 'success' : 'danger'} />
                  <ReviewRow label="Actividades"        value={`${scheduled.length} (${criticalCount} críticas, ${milestoneCount} hitos)`} />
                  <ReviewRow
                    label="Juntas a programar"
                    value={(() => {
                      const enabled = meetingConfigs.filter(c => c.enabled);
                      if (enabled.length === 0) return 'Ninguna';
                      const total = enabled.reduce(
                        (acc, c) =>
                          acc + generateMeetingDates(c, parseISO(startDate), calculatedEnd).length,
                        0
                      );
                      return `${total} sesiones en ${enabled.length} tipos`;
                    })()}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Error inline */}
        {error && (
          <div className="px-6 pb-3 shrink-0">
            <div className="flex gap-2 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-app-border)] flex items-center justify-between shrink-0">
          <Button
            variant="outline"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1 || creating}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Anterior
          </Button>
          {step < STEPS.length ? (
            <Button onClick={() => setStep(s => Math.min(STEPS.length, s + 1))} disabled={!canGoNext}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={creating}>
              {creating ? 'Publicando...' : 'Publicar Master Plan'}
              <Check className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="p-3 rounded-md border border-[var(--color-app-border)] bg-white">
      <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold mt-0.5 tabular-nums',
          tone === 'success' && 'text-[var(--color-app-success)]',
          tone === 'danger' && 'text-[var(--color-app-danger)]'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ReviewRow({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-[var(--color-app-text-muted)] col-span-1">{label}</span>
      <span
        className={cn(
          'col-span-2 font-medium',
          tone === 'success' && 'text-[var(--color-app-success)]',
          tone === 'danger' && 'text-[var(--color-app-danger)]'
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// GANTT PREVIEW — visualización rápida en el wizard
// ============================================================================

function GanttPreview({
  tasks,
  startDate,
}: {
  tasks: ReturnType<typeof scheduleTasks>;
  startDate: Date;
}) {
  const projectStart = startDate;
  const projectEnd = tasks.reduce((max, t) => (t.end_date > max ? t.end_date : max), startDate);
  const totalDays = Math.max(
    1,
    Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="text-sm">
      <div className="px-4 py-2 bg-[var(--color-app-surface-alt)] border-b border-[var(--color-app-border)] flex items-center gap-2 text-xs font-medium text-[var(--color-app-text-muted)]">
        <span>{format(projectStart, 'dd MMM', { locale: es })}</span>
        <div className="h-px bg-[var(--color-app-border-strong)] flex-1" />
        <span>{format(projectEnd, 'dd MMM', { locale: es })}</span>
      </div>

      <div className="divide-y divide-[var(--color-app-border)]">
        {tasks.map(task => {
          const startOffset =
            (task.start_date.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
          const widthDays = Math.max(
            1,
            (task.end_date.getTime() - task.start_date.getTime()) / (1000 * 60 * 60 * 24)
          );
          const leftPct = (startOffset / totalDays) * 100;
          const widthPct = Math.max(2, (widthDays / totalDays) * 100);
          const color = DEPT_COLORS[task.department] ?? '#94a3b8';

          return (
            <div key={task.wbs} className="grid grid-cols-[140px_1fr] gap-2 items-center px-4 py-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[var(--color-app-text-muted)]">
                    {task.wbs}
                  </span>
                  {task.is_milestone && <Flag className="h-3 w-3 text-[var(--color-app-warning)]" />}
                  {task.is_critical && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-danger)]"
                      title="Ruta crítica"
                    />
                  )}
                </div>
                <p className="text-xs truncate" title={task.name}>
                  {task.name}
                </p>
              </div>
              <div className="relative h-5 bg-[var(--color-app-surface-alt)] rounded-sm">
                <div
                  className="absolute top-0 bottom-0 rounded-sm"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: task.is_critical ? '#b91c1c' : color,
                    opacity: task.is_critical ? 0.95 : 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-[var(--color-app-border)] flex flex-wrap gap-3 text-[10px] text-[var(--color-app-text-muted)]">
        {Object.entries(DEPT_COLORS).map(([dept, color]) => (
          <span key={dept} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
            {dept}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[var(--color-app-danger)]" />
          Crítica
        </span>
        <span className="flex items-center gap-1">
          <Flag className="h-3 w-3 text-[var(--color-app-warning)]" />
          Hito
        </span>
      </div>
    </div>
  );
}
