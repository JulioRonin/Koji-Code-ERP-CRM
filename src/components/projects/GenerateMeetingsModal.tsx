import React, { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarClock,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useMasterPlan,
  useCreateMeetings,
  DEFAULT_MEETING_CONFIGS,
  generateMeetingDates,
  type MeetingTemplateConfig,
} from '@/lib/api';
import type { MeetingType, Project } from '@/types/database';
import { cn } from '@/lib/utils';

const TYPE_COLOR: Record<string, string> = {
  'Kick-off': '#0369a1',
  Semanal: '#0ea5e9',
  Quincenal: '#7c3aed',
  Mensual: '#15803d',
  Hito: '#b45309',
  Cierre: '#0d9488',
};

const MEETING_TYPES: MeetingType[] = [
  'Kick-off',
  'Semanal',
  'Quincenal',
  'Mensual',
  'Hito',
  'Cierre',
];

interface DraftSession {
  uid: string;
  title: string;
  type: MeetingType;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  duration_minutes: number;
  attendees: string[];
}

interface Props {
  project: Project;
  open: boolean;
  onClose: () => void;
  onCreated?: () => Promise<void> | void;
}

/**
 * Modal para generar (o adjuntar) el calendario de juntas de seguimiento PMI
 * de forma independiente al wizard del master plan. Permite configurar los
 * tipos y el rango, generar las sesiones, y EDITAR fecha/día/hora de cada
 * una antes de crearlas.
 */
export function GenerateMeetingsModal({ project, open, onClose, onCreated }: Props) {
  const { data: masterPlan } = useMasterPlan(project.id);
  const { create: createMeetings, loading: creating } = useCreateMeetings();

  // Rango por defecto: baseline del master plan si existe, si no las fechas del proyecto.
  const defaultStart = masterPlan?.baseline_start ?? project.start_date;
  const defaultEnd = masterPlan?.baseline_end ?? project.deadline;

  const [rangeStart, setRangeStart] = useState(defaultStart);
  const [rangeEnd, setRangeEnd] = useState(defaultEnd);
  const [configs, setConfigs] = useState<MeetingTemplateConfig[]>(
    DEFAULT_MEETING_CONFIGS.map(c => ({ ...c }))
  );
  const [sessions, setSessions] = useState<DraftSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-hidrata el rango cuando carga el master plan
  React.useEffect(() => {
    setRangeStart(masterPlan?.baseline_start ?? project.start_date);
    setRangeEnd(masterPlan?.baseline_end ?? project.deadline);
  }, [masterPlan?.baseline_start, masterPlan?.baseline_end, project.start_date, project.deadline]);

  const buildSessions = () => {
    const start = parseISO(rangeStart);
    const end = parseISO(rangeEnd);
    if (!isValid(start) || !isValid(end)) {
      setError('Captura un rango de fechas válido.');
      return;
    }
    if (end < start) {
      setError('La fecha de fin debe ser posterior a la de inicio.');
      return;
    }
    setError(null);
    const out: DraftSession[] = [];
    configs
      .filter(c => c.enabled)
      .forEach(config => {
        const dates = generateMeetingDates(config, start, end);
        dates.forEach((d, idx) => {
          out.push({
            uid: `s-${config.type}-${idx}-${d.getTime()}`,
            title: dates.length > 1 ? `${config.title} #${idx + 1}` : config.title,
            type: config.type,
            date: format(d, 'yyyy-MM-dd'),
            time: config.time,
            duration_minutes: config.duration_minutes,
            attendees: config.attendees,
          });
        });
      });
    out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    setSessions(out);
  };

  const patchSession = (uid: string, patch: Partial<DraftSession>) => {
    setSessions(prev => (prev ? prev.map(s => (s.uid === uid ? { ...s, ...patch } : s)) : prev));
  };
  const removeSession = (uid: string) => {
    setSessions(prev => (prev ? prev.filter(s => s.uid !== uid) : prev));
  };
  const addSession = () => {
    setSessions(prev => [
      ...(prev ?? []),
      {
        uid: `s-custom-${Date.now()}`,
        title: 'Junta adicional',
        type: 'Hito',
        date: rangeStart,
        time: '10:00',
        duration_minutes: 30,
        attendees: [],
      },
    ]);
  };

  const handleCreate = async () => {
    if (!sessions || sessions.length === 0) return;
    setError(null);
    try {
      const inputs = sessions.map(s => {
        const dt = new Date(`${s.date}T${s.time || '10:00'}:00`);
        return {
          project_id: project.id,
          master_plan_id: masterPlan?.id ?? null,
          title: s.title,
          meeting_type: s.type,
          scheduled_at: dt.toISOString(),
          duration_minutes: s.duration_minutes,
          attendees: s.attendees,
        };
      });
      await createMeetings(inputs);
      await onCreated?.();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'No se pudieron crear las juntas.');
    }
  };

  const enabledCount = configs.filter(c => c.enabled).length;

  const sessionsByType = useMemo(() => {
    const map = new Map<string, number>();
    (sessions ?? []).forEach(s => map.set(s.type, (map.get(s.type) ?? 0) + 1));
    return map;
  }, [sessions]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl h-[88vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--color-app-border)] shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-app-primary)]" />
            Generar calendario de juntas
          </DialogTitle>
          <DialogDescription>
            {project.name} · {project.client_name}
            {masterPlan ? ' · se vincularán al master plan activo' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Rango */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Inicio del calendario</label>
              <Input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fin del calendario</label>
              <Input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
            </div>
          </div>

          {/* Configuración de tipos */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Tipos de junta</p>
            {configs.map((config, idx) => (
              <div
                key={config.type}
                className="rounded-md border border-[var(--color-app-border)] p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setConfigs(prev =>
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
                      <Badge variant="outline" style={{ borderColor: `${TYPE_COLOR[config.type]}55`, color: TYPE_COLOR[config.type] }}>
                        {config.type}
                      </Badge>
                      <span className="text-sm font-medium">{config.title}</span>
                    </div>
                  </div>
                </div>
                {config.enabled && (
                  <div className="grid grid-cols-3 gap-2 pl-8">
                    <div>
                      <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">Hora</label>
                      <Input
                        type="time"
                        value={config.time}
                        onChange={e =>
                          setConfigs(prev => prev.map((c, i) => (i === idx ? { ...c, time: e.target.value } : c)))
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">Min.</label>
                      <Input
                        type="number"
                        min={15}
                        step={15}
                        value={config.duration_minutes}
                        onChange={e =>
                          setConfigs(prev =>
                            prev.map((c, i) => (i === idx ? { ...c, duration_minutes: Number(e.target.value) || 30 } : c))
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    {(config.frequency === 'weekly' ||
                      config.frequency === 'biweekly' ||
                      config.frequency === 'monthly') && (
                      <div>
                        <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-0.5">Día</label>
                        <select
                          value={config.weekday ?? 1}
                          onChange={e =>
                            setConfigs(prev =>
                              prev.map((c, i) => (i === idx ? { ...c, weekday: Number(e.target.value) } : c))
                            )
                          }
                          className="w-full h-8 px-1.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs"
                        >
                          <option value={1}>Lun</option>
                          <option value={2}>Mar</option>
                          <option value={3}>Mié</option>
                          <option value={4}>Jue</option>
                          <option value={5}>Vie</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={buildSessions} disabled={enabledCount === 0} className="w-full">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {sessions ? 'Regenerar sesiones' : 'Generar sesiones'}
          </Button>

          {error && (
            <div className="p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sesiones editables */}
          {sessions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                  {sessions.length} sesiones
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from(sessionsByType.entries()).map(([t, n]) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}: {n}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border border-[var(--color-app-border)] rounded-md divide-y divide-[var(--color-app-border)] max-h-72 overflow-y-auto">
                {sessions.map(s => (
                  <div key={s.uid} className="p-2.5 grid grid-cols-[1fr_auto] gap-2 items-center">
                    <div className="space-y-1.5 min-w-0">
                      <input
                        value={s.title}
                        onChange={e => patchSession(s.uid, { title: e.target.value })}
                        className="w-full h-7 px-2 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:outline-none text-xs font-medium"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                          value={s.type}
                          onChange={e => patchSession(s.uid, { type: e.target.value as MeetingType })}
                          className="h-7 px-1.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-[11px]"
                        >
                          {MEETING_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={s.date}
                          onChange={e => patchSession(s.uid, { date: e.target.value })}
                          className="h-7 px-1.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-[11px]"
                        />
                        <input
                          type="time"
                          value={s.time}
                          onChange={e => patchSession(s.uid, { time: e.target.value })}
                          className="h-7 px-1.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-[11px]"
                        />
                        <span className="text-[10px] text-[var(--color-app-text-muted)]">
                          {(() => {
                            try {
                              return format(parseISO(s.date), 'EEE', { locale: es });
                            } catch {
                              return '';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSession(s.uid)}
                      className="p-1.5 rounded hover:bg-[var(--color-app-danger-soft)] text-[var(--color-app-text-muted)] hover:text-[var(--color-app-danger)]"
                      title="Quitar sesión"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="p-4 text-center text-xs text-[var(--color-app-text-muted)]">
                    Sin sesiones. Ajusta los tipos o agrega una manual.
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" onClick={addSession} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar sesión manual
              </Button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-app-border)] flex items-center justify-between shrink-0">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            <X className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creating || !sessions || sessions.length === 0}>
            {creating ? 'Creando…' : `Crear ${sessions?.length ?? 0} juntas`}
            <Check className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
