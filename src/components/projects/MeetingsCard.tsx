import React, { useMemo, useState } from 'react';
import { format, isPast, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useProjectMeetings,
  useUpdateMeetingStatus,
} from '@/lib/api';
import type { ProjectMeeting, MeetingStatus } from '@/types/database';
import { cn } from '@/lib/utils';

const typeColor: Record<string, string> = {
  'Kick-off':  '#0369a1',
  Semanal:     '#0ea5e9',
  Quincenal:   '#7c3aed',
  Mensual:     '#15803d',
  Hito:        '#b45309',
  Cierre:      '#0d9488',
};

interface Props {
  projectId: string;
}

export function MeetingsCard({ projectId }: Props) {
  const { data: meetings, refetch } = useProjectMeetings(projectId);
  const { update } = useUpdateMeetingStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const { upcoming, past } = useMemo(() => {
    const upcoming: ProjectMeeting[] = [];
    const past: ProjectMeeting[] = [];
    meetings.forEach(m => {
      const d = parseISO(m.scheduled_at);
      if (isPast(d) && m.status === 'Programada') {
        upcoming.push(m); // las pendientes vencidas siguen como upcoming para actuar sobre ellas
      } else if (m.status === 'Programada' && !isPast(d)) {
        upcoming.push(m);
      } else {
        past.push(m);
      }
    });
    return { upcoming, past };
  }, [meetings]);

  const handleSetStatus = async (m: ProjectMeeting, status: MeetingStatus) => {
    const notes = notesDraft[m.id];
    try {
      await update(m.id, status, notes);
      await refetch();
      setNotesDraft(prev => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      setExpandedId(null);
    } catch (err) {
      console.error('No se pudo actualizar la junta', err);
      alert((err as Error).message);
    }
  };

  if (meetings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Juntas de seguimiento
        </CardTitle>
        <CardDescription>
          {upcoming.length} próximas · {past.length} pasadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcoming.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase text-[var(--color-app-text-muted)] tracking-wide font-medium">
              Próximas
            </p>
            {upcoming.slice(0, 8).map(m => (
              <MeetingRow
                key={m.id}
                meeting={m}
                isExpanded={expandedId === m.id}
                draft={notesDraft[m.id] ?? ''}
                onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                onChangeDraft={v => setNotesDraft(prev => ({ ...prev, [m.id]: v }))}
                onMarkRealized={() => handleSetStatus(m, 'Realizada')}
                onMarkCancelled={() => handleSetStatus(m, 'Cancelada')}
              />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <details className="space-y-1.5">
            <summary className="text-[10px] uppercase text-[var(--color-app-text-muted)] tracking-wide font-medium cursor-pointer hover:text-[var(--color-app-text)]">
              Pasadas ({past.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {past.slice(0, 12).map(m => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  isPast
                  isExpanded={expandedId === m.id}
                  draft={notesDraft[m.id] ?? ''}
                  onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  onChangeDraft={v => setNotesDraft(prev => ({ ...prev, [m.id]: v }))}
                  onMarkRealized={() => handleSetStatus(m, 'Realizada')}
                  onMarkCancelled={() => handleSetStatus(m, 'Cancelada')}
                />
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function MeetingRow({
  meeting,
  isPast,
  isExpanded,
  draft,
  onToggle,
  onChangeDraft,
  onMarkRealized,
  onMarkCancelled,
}: {
  meeting: ProjectMeeting;
  isPast?: boolean;
  isExpanded: boolean;
  draft: string;
  onToggle: () => void;
  onChangeDraft: (v: string) => void;
  onMarkRealized: () => void;
  onMarkCancelled: () => void;
}) {
  const d = parseISO(meeting.scheduled_at);
  const color = typeColor[meeting.meeting_type] ?? '#94a3b8';
  const isOverdue = meeting.status === 'Programada' && isPast === undefined && new Date() > d;

  return (
    <div
      className={cn(
        'rounded-md border bg-white',
        meeting.status === 'Realizada' && 'border-[var(--color-app-success)]/30 bg-[var(--color-app-success-soft)]/30',
        meeting.status === 'Cancelada' && 'opacity-60',
        isOverdue && 'border-[var(--color-app-warning)]/50'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--color-app-surface-alt)]/40 rounded-md"
      >
        <div className="shrink-0">
          {meeting.status === 'Realizada' ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--color-app-success)]" />
          ) : meeting.status === 'Cancelada' ? (
            <XCircle className="h-4 w-4 text-[var(--color-app-danger)]" />
          ) : (
            <Clock className="h-4 w-4 text-[var(--color-app-text-muted)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: `${color}40`, color }}
            >
              {meeting.meeting_type}
            </Badge>
            <span className="font-medium text-sm truncate">{meeting.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-app-text-muted)]">
            <span>{format(d, "EEE d MMM HH:mm", { locale: es })}</span>
            <span>·</span>
            <span>{meeting.duration_minutes} min</span>
            {meeting.attendees.length > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {meeting.attendees.join(', ')}
                </span>
              </>
            )}
          </div>
        </div>

        {meeting.status === 'Programada' && (
          <span className="text-[10px] text-[var(--color-app-text-muted)] shrink-0 hidden sm:inline">
            {formatDistanceToNow(d, { locale: es, addSuffix: true })}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[var(--color-app-text-subtle)] shrink-0 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--color-app-border)] space-y-2.5">
          {/* Existing notes */}
          {meeting.notes && (
            <div className="p-2.5 rounded-md bg-[var(--color-app-surface-alt)]/60 text-xs whitespace-pre-wrap">
              {meeting.notes}
            </div>
          )}

          {meeting.status === 'Programada' && (
            <>
              <div>
                <label className="block text-[10px] uppercase text-[var(--color-app-text-muted)] mb-1">
                  Notas / minuta
                </label>
                <textarea
                  rows={2}
                  value={draft}
                  onChange={e => onChangeDraft(e.target.value)}
                  placeholder="Acuerdos, próximos pasos..."
                  className="w-full px-2 py-1.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={onMarkRealized} size="sm" className="flex-1">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Marcar realizada
                </Button>
                <Button onClick={onMarkCancelled} variant="outline" size="sm">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
