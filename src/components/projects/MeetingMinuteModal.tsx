import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Sparkles, Save, Printer, ArrowLeft, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { useCompany } from '@/contexts/CompanyContext';
import { useUpdateMeeting } from '@/lib/api';
import { composeBodyHtml, legacyToBodyHtml, splitLines, parseActionItem } from '@/lib/meetingMinutes';
import type { MinuteContext } from '@/lib/meetingMinutes';
import type { MeetingMinute, MinuteActionItem, Project, ProjectMeeting } from '@/types/database';
import { MeetingMinutePrint } from './MeetingMinutePrint';

interface Props {
  meeting: ProjectMeeting;
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}

export function MeetingMinuteModal({ meeting, project, onClose, onSaved }: Props) {
  const { company } = useCompany();
  const { update, loading: saving } = useUpdateMeeting();
  const existing = meeting.minutes;

  const dateText = useMemo(
    () => format(parseISO(meeting.scheduled_at), "EEEE d 'de' MMMM 'de' yyyy, HH:mm 'h'", { locale: es }),
    [meeting.scheduled_at]
  );
  const ctx: MinuteContext = {
    companyName: company.commercial_name || company.legal_name,
    clientName: project.client_name,
    projectName: project.name,
    projectId: project.id,
    meetingTitle: meeting.title,
    meetingType: meeting.meeting_type,
    dateText,
  };

  const [phase, setPhase] = useState<'input' | 'edit'>(existing ? 'edit' : 'input');
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markRealized, setMarkRealized] = useState(meeting.status === 'Programada');

  // Datos de entrada ("prompt") / semillas para (re)generar
  const [purpose, setPurpose] = useState(existing?.purpose ?? '');
  const [discussion, setDiscussion] = useState(existing?.discussion ?? '');
  const [attendeesText, setAttendeesText] = useState(
    (existing?.attendees ?? meeting.attendees ?? []).join(', ')
  );
  const [agreementsText, setAgreementsText] = useState((existing?.agreements ?? []).join('\n'));
  const [actionsText, setActionsText] = useState(
    (existing?.actionItems ?? [])
      .map(a => [a.task, a.owner, a.due].filter(Boolean).join(' — '))
      .join('\n')
  );
  const [location, setLocation] = useState(existing?.location ?? '');

  // Documento (metadatos estructurados + cuerpo enriquecido)
  const [title, setTitle] = useState(existing?.title ?? `Minuta — ${meeting.title}`);
  const [attendees, setAttendees] = useState<string[]>(existing?.attendees ?? meeting.attendees ?? []);
  const [agreements, setAgreements] = useState<string[]>(existing?.agreements ?? []);
  const [actionItems, setActionItems] = useState<MinuteActionItem[]>(existing?.actionItems ?? []);
  const [bodyHtml, setBodyHtml] = useState<string>(
    existing?.bodyHtml ?? (existing ? legacyToBodyHtml(existing) : '')
  );
  const [bodyKey, setBodyKey] = useState(0);

  const parseAttendees = (s: string) => s.split(/[\n,]/).map(a => a.trim()).filter(Boolean);

  const handleGenerate = () => {
    const att = parseAttendees(attendeesText);
    const agr = splitLines(agreementsText);
    const acts = splitLines(actionsText).map(parseActionItem);
    setAttendees(att);
    setAgreements(agr);
    setActionItems(acts);
    setBodyHtml(composeBodyHtml({ purpose, discussion, attendees: att, agreements: agr, actionItems: acts, location }, ctx));
    setBodyKey(k => k + 1);
    setPhase('edit');
  };

  const handleRegenerate = () => {
    if (
      bodyHtml.trim() &&
      !window.confirm('Esto reemplazará el cuerpo actual con una redacción nueva basada en los datos capturados. ¿Continuar?')
    ) {
      return;
    }
    setBodyHtml(composeBodyHtml({ purpose, discussion, attendees, agreements, actionItems, location }, ctx));
    setBodyKey(k => k + 1);
  };

  const currentMinute = (): MeetingMinute => ({
    purpose,
    discussion,
    attendees,
    agreements,
    actionItems,
    location: location || undefined,
    title,
    intro: '',
    topics: '',
    closing: '',
    bodyHtml,
    generatedAt: existing?.generatedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const handleSave = async () => {
    setError(null);
    try {
      await update(meeting.id, {
        minutes: currentMinute(),
        ...(markRealized && meeting.status === 'Programada' ? { status: 'Realizada' as const } : {}),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.6)] overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl my-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-app-border)] sticky top-0 bg-white rounded-t-xl z-20">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-app-text)] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-app-primary)]" />
                Minuta de junta
              </h2>
              <p className="text-xs text-[var(--color-app-text-muted)] truncate">
                {meeting.title} · {meeting.meeting_type} · {project.name}
              </p>
            </div>
            <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-app-surface-alt)]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-4 p-2.5 bg-[var(--color-app-danger-soft)] border border-[var(--color-app-danger)]/30 rounded-md text-sm text-[var(--color-app-danger)]">
              {error}
            </div>
          )}

          {phase === 'input' ? (
            <div className="p-6 space-y-4">
              <p className="text-sm text-[var(--color-app-text-muted)]">
                Describe la junta como si se lo contaras a un colega. Generamos un borrador
                profesional y empático que luego podrás <strong>dar formato</strong> (negritas, listas,
                tablas, imágenes) antes de exportar a PDF.
              </p>

              <Field label="Propósito de la junta">
                <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2}
                  placeholder="Ej. revisar el avance de fabricación del lote IBA-02 y definir la fecha de entrega."
                  className={inputCls} />
              </Field>

              <Field label="¿Qué se discutió? (contexto y detalles)">
                <textarea value={discussion} onChange={e => setDiscussion(e.target.value)} rows={5}
                  placeholder={'Escribe libremente o una idea por línea:\n- Se presentó el avance del 60% en producción\n- El cliente solicitó adelantar la inspección dimensional'}
                  className={inputCls} />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Acuerdos (uno por línea)">
                  <textarea value={agreementsText} onChange={e => setAgreementsText(e.target.value)} rows={4}
                    placeholder={'Entregar reporte dimensional el viernes\nCongelar cambios de ingeniería'}
                    className={inputCls} />
                </Field>
                <Field label="Compromisos / próximos pasos">
                  <textarea value={actionsText} onChange={e => setActionsText(e.target.value)} rows={4}
                    placeholder={'tarea — responsable — fecha\nEnviar muestras — Mario — 20 jun'}
                    className={inputCls} />
                  <p className="text-[10px] text-[var(--color-app-text-subtle)] mt-1">
                    Formato por línea: <strong>compromiso — responsable — fecha</strong>
                  </p>
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Participantes (separados por coma)">
                  <input value={attendeesText} onChange={e => setAttendeesText(e.target.value)} placeholder="PM, Cliente, Producción" className={inputCls} />
                </Field>
                <Field label="Lugar / modalidad (opcional)">
                  <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Videollamada / Sala de juntas" className={inputCls} />
                </Field>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleGenerate}>
                  <Wand2 className="h-4 w-4 mr-1.5" /> Generar minuta
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button onClick={() => setPhase('input')} className="inline-flex items-center gap-1 text-sm text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]">
                  <ArrowLeft className="h-3.5 w-3.5" /> Editar datos
                </button>
                <Button variant="outline" size="sm" onClick={handleRegenerate}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Regenerar redacción
                </Button>
              </div>

              <Field label="Título del documento">
                <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Participantes (coma)">
                  <input
                    value={attendees.join(', ')}
                    onChange={e => setAttendees(parseAttendees(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Lugar / modalidad">
                  <input value={location} onChange={e => setLocation(e.target.value)} className={inputCls} />
                </Field>
              </div>

              <Field label="Cuerpo de la minuta">
                <RichTextEditor initialHtml={bodyHtml} resetKey={bodyKey} onChange={setBodyHtml} minHeight={320} />
                <p className="text-[10px] text-[var(--color-app-text-subtle)] mt-1">
                  Usa la barra para negritas, títulos, listas, alineación, e insertar tablas o imágenes.
                </p>
              </Field>

              {meeting.status === 'Programada' && (
                <label className="flex items-center gap-2 text-sm text-[var(--color-app-text)]">
                  <input type="checkbox" checked={markRealized} onChange={e => setMarkRealized(e.target.checked)} />
                  Marcar la junta como <strong>realizada</strong> al guardar
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-app-border)]">
                <Button variant="outline" onClick={() => setPrinting(true)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Exportar PDF
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Guardar minuta
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {printing && (
        <MeetingMinutePrint
          minute={currentMinute()}
          meeting={meeting}
          project={project}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>,
    document.body
  );
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm text-[var(--color-app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--color-app-text)]">{label}</label>
      {children}
    </div>
  );
}
