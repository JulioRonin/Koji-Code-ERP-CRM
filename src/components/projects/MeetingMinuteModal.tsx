import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  X,
  Sparkles,
  Save,
  Printer,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/CompanyContext';
import { useUpdateMeeting } from '@/lib/api';
import { composeMinute, splitLines, parseActionItem } from '@/lib/meetingMinutes';
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

  // ── Datos de entrada ("prompt") ──
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

  // ── Documento generado / editable ──
  const [title, setTitle] = useState(existing?.title ?? '');
  const [intro, setIntro] = useState(existing?.intro ?? '');
  const [topics, setTopics] = useState(existing?.topics ?? '');
  const [closing, setClosing] = useState(existing?.closing ?? '');
  const [agreements, setAgreements] = useState<string[]>(existing?.agreements ?? []);
  const [actionItems, setActionItems] = useState<MinuteActionItem[]>(existing?.actionItems ?? []);
  const [attendees, setAttendees] = useState<string[]>(existing?.attendees ?? meeting.attendees ?? []);

  const parseAttendees = (s: string) =>
    s.split(/[\n,]/).map(a => a.trim()).filter(Boolean);

  const handleGenerate = () => {
    const att = parseAttendees(attendeesText);
    const agr = splitLines(agreementsText);
    const acts = splitLines(actionsText).map(parseActionItem);
    const doc = composeMinute(
      { purpose, discussion, attendees: att, agreements: agr, actionItems: acts, location },
      ctx
    );
    setTitle(doc.title);
    setIntro(doc.intro);
    setTopics(doc.topics);
    setClosing(doc.closing);
    setAgreements(agr);
    setActionItems(acts);
    setAttendees(att);
    setPhase('edit');
  };

  const handleRegenerate = () => {
    const doc = composeMinute(
      { purpose, discussion, attendees, agreements, actionItems, location },
      ctx
    );
    setIntro(doc.intro);
    setTopics(doc.topics);
    setClosing(doc.closing);
  };

  const currentMinute = (): MeetingMinute => ({
    purpose,
    discussion,
    attendees,
    agreements,
    actionItems,
    location: location || undefined,
    title,
    intro,
    topics,
    closing,
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

  // ── Editores de listas ──
  const setAgreement = (i: number, v: string) =>
    setAgreements(prev => prev.map((a, idx) => (idx === i ? v : a)));
  const setAction = (i: number, patch: Partial<MinuteActionItem>) =>
    setActionItems(prev => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[rgba(15,23,42,0.6)] overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl my-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-app-border)] sticky top-0 bg-white rounded-t-xl z-10">
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
                Describe la junta como si se lo contaras a un colega. Con esos datos generamos una
                minuta profesional y empática que podrás <strong>editar</strong> antes de exportar a PDF.
              </p>

              <Field label="Propósito de la junta">
                <textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  rows={2}
                  placeholder="Ej. revisar el avance de fabricación del lote IBA-02 y definir la fecha de entrega."
                  className={inputCls}
                />
              </Field>

              <Field label="¿Qué se discutió? (contexto y detalles)">
                <textarea
                  value={discussion}
                  onChange={e => setDiscussion(e.target.value)}
                  rows={5}
                  placeholder={'Escribe libremente o una idea por línea:\n- Se presentó el avance del 60% en producción\n- El cliente solicitó adelantar la inspección dimensional\n- Se revisaron los planos rev. C'}
                  className={inputCls}
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Acuerdos (uno por línea)">
                  <textarea
                    value={agreementsText}
                    onChange={e => setAgreementsText(e.target.value)}
                    rows={4}
                    placeholder={'Entregar reporte dimensional el viernes\nCongelar cambios de ingeniería'}
                    className={inputCls}
                  />
                </Field>
                <Field label="Compromisos / próximos pasos">
                  <textarea
                    value={actionsText}
                    onChange={e => setActionsText(e.target.value)}
                    rows={4}
                    placeholder={'tarea — responsable — fecha\nEnviar muestras — Mario — 20 jun'}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Participantes (separados por coma)">
                  <input
                    value={attendeesText}
                    onChange={e => setAttendeesText(e.target.value)}
                    placeholder="PM, Cliente, Producción"
                    className={inputCls}
                  />
                </Field>
                <Field label="Lugar / modalidad (opcional)">
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Videollamada / Sala de juntas"
                    className={inputCls}
                  />
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
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => setPhase('input')}
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Editar datos
                </button>
                <Button variant="outline" size="sm" onClick={handleRegenerate}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Regenerar redacción
                </Button>
              </div>

              <Field label="Título">
                <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
              </Field>

              <Field label="Introducción">
                <textarea value={intro} onChange={e => setIntro(e.target.value)} rows={4} className={inputCls} />
              </Field>

              <Field label="Temas tratados">
                <textarea value={topics} onChange={e => setTopics(e.target.value)} rows={6} className={inputCls} />
                <p className="text-[10px] text-[var(--color-app-text-subtle)] mt-1">
                  Separa con una línea en blanco para crear párrafos.
                </p>
              </Field>

              {/* Acuerdos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Acuerdos</label>
                  <button onClick={() => setAgreements(p => [...p, ''])} className="text-xs text-[var(--color-app-primary)] inline-flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                </div>
                <div className="space-y-1.5">
                  {agreements.length === 0 && <p className="text-xs text-[var(--color-app-text-subtle)]">Sin acuerdos.</p>}
                  {agreements.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-app-text-muted)] w-4 text-right">{i + 1}.</span>
                      <input value={a} onChange={e => setAgreement(i, e.target.value)} className={inputCls} />
                      <button onClick={() => setAgreements(p => p.filter((_, idx) => idx !== i))} className="text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compromisos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Compromisos y próximos pasos</label>
                  <button onClick={() => setActionItems(p => [...p, { task: '' }])} className="text-xs text-[var(--color-app-primary)] inline-flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                </div>
                <div className="space-y-1.5">
                  {actionItems.length === 0 && <p className="text-xs text-[var(--color-app-text-subtle)]">Sin compromisos.</p>}
                  {actionItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={it.task} onChange={e => setAction(i, { task: e.target.value })} placeholder="Compromiso" className={`${inputCls} flex-[2]`} />
                      <input value={it.owner ?? ''} onChange={e => setAction(i, { owner: e.target.value })} placeholder="Responsable" className={`${inputCls} flex-1`} />
                      <input value={it.due ?? ''} onChange={e => setAction(i, { due: e.target.value })} placeholder="Fecha" className={`${inputCls} w-24`} />
                      <button onClick={() => setActionItems(p => p.filter((_, idx) => idx !== i))} className="text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Conclusión">
                <textarea value={closing} onChange={e => setClosing(e.target.value)} rows={4} className={inputCls} />
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
const labelCls = 'block text-xs font-medium text-[var(--color-app-text)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
