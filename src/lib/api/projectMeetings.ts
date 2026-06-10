import { useCallback, useState } from 'react';
import { addDays, addWeeks, addMonths, format, parseISO, isBefore } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { ProjectMeeting, MeetingType, MeetingStatus, Department } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_KEY = 'koji_demo_project_meetings';

function readDemo(): ProjectMeeting[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as ProjectMeeting[]) : [];
  } catch {
    return [];
  }
}

function writeDemo(items: ProjectMeeting[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function newId(prefix: string): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================================
// CONFIGURACIÓN DE JUNTAS — preset para el wizard
// ============================================================================

export interface MeetingTemplateConfig {
  type: MeetingType;
  enabled: boolean;
  title: string;
  description: string;
  attendees: string[];
  duration_minutes: number;
  /** generación: 'once' = una sola vez al hito relativo; 'recurring' = todas las semanas/meses durante el plan */
  frequency: 'once-start' | 'once-end' | 'weekly' | 'biweekly' | 'monthly';
  /** Para recurrentes: día de la semana 0-6 (0=domingo) */
  weekday?: number;
  /** Hora HH:mm */
  time: string;
}

export const DEFAULT_MEETING_CONFIGS: MeetingTemplateConfig[] = [
  {
    type: 'Kick-off',
    enabled: true,
    title: 'Kick-off del proyecto',
    description: 'Junta inicial para alinear alcance, fechas y responsables.',
    attendees: ['Producción', 'Diseño', 'Compras', 'Calidad'],
    duration_minutes: 60,
    frequency: 'once-start',
    time: '10:00',
  },
  {
    type: 'Semanal',
    enabled: true,
    title: 'Status semanal interno',
    description: 'Avance, bloqueos y prioridades de la semana.',
    attendees: ['Producción', 'Calidad'],
    duration_minutes: 30,
    frequency: 'weekly',
    weekday: 1, // lunes
    time: '09:00',
  },
  {
    type: 'Quincenal',
    enabled: true,
    title: 'Status quincenal con cliente',
    description: 'Reporte ejecutivo y resolución de pendientes con cliente.',
    attendees: ['Producción', 'Cliente', 'PM'],
    duration_minutes: 45,
    frequency: 'biweekly',
    weekday: 3, // miércoles
    time: '11:00',
  },
  {
    type: 'Cierre',
    enabled: true,
    title: 'Junta de cierre',
    description: 'Lessons learned, entrega formal y aceptación final.',
    attendees: ['Producción', 'Calidad', 'Cliente', 'PM'],
    duration_minutes: 60,
    frequency: 'once-end',
    time: '11:00',
  },
];

/**
 * Genera la lista de fechas para una configuración entre dos fechas.
 */
export function generateMeetingDates(
  config: MeetingTemplateConfig,
  baselineStart: Date,
  baselineEnd: Date
): Date[] {
  const out: Date[] = [];
  const [hh, mm] = config.time.split(':').map(Number);
  const setTime = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(hh, mm, 0, 0);
    return copy;
  };

  if (config.frequency === 'once-start') {
    out.push(setTime(baselineStart));
    return out;
  }
  if (config.frequency === 'once-end') {
    out.push(setTime(baselineEnd));
    return out;
  }

  // Recurrentes
  let cursor = new Date(baselineStart);
  // Mover al primer día de semana correcto si aplica
  if (config.weekday != null) {
    while (cursor.getDay() !== config.weekday) {
      cursor = addDays(cursor, 1);
    }
  }

  while (!isBefore(baselineEnd, cursor)) {
    out.push(setTime(cursor));
    if (config.frequency === 'weekly') cursor = addWeeks(cursor, 1);
    else if (config.frequency === 'biweekly') cursor = addWeeks(cursor, 2);
    else if (config.frequency === 'monthly') cursor = addMonths(cursor, 1);
    else break;
    if (out.length > 100) break; // safety
  }

  return out;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useProjectMeetings(projectId: string | undefined): AsyncState<ProjectMeeting[]> {
  return useAsync<ProjectMeeting[]>(
    async () => {
      if (!projectId) return [];
      if (!supabase) {
        return readDemo()
          .filter(m => m.project_id === projectId)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      }
      const { data, error } = await supabase
        .from('project_meetings')
        .select('*')
        .eq('project_id', projectId)
        .order('scheduled_at');
      if (error) throw error;
      return (data ?? []) as ProjectMeeting[];
    },
    [],
    [projectId]
  );
}

interface CreateMeetingInput {
  project_id: string;
  master_plan_id?: string | null;
  title: string;
  meeting_type: MeetingType;
  scheduled_at: string;
  duration_minutes?: number;
  attendees?: string[];
  notes?: string | null;
}

export function useCreateMeetings() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (inputs: CreateMeetingInput[]): Promise<number> => {
    if (inputs.length === 0) return 0;
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const rows: ProjectMeeting[] = inputs.map(input => ({
        id: newId('mtg'),
        project_id: input.project_id,
        master_plan_id: input.master_plan_id ?? null,
        title: input.title,
        meeting_type: input.meeting_type,
        scheduled_at: input.scheduled_at,
        duration_minutes: input.duration_minutes ?? 30,
        attendees: input.attendees ?? [],
        status: 'Programada' as MeetingStatus,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      }));

      if (!supabase) {
        writeDemo([...readDemo(), ...rows]);
        setState({ loading: false, error: null });
        return rows.length;
      }
      const { error } = await supabase.from('project_meetings').insert(rows);
      if (error) throw error;
      setState({ loading: false, error: null });
      return rows.length;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { create, ...state };
}

export function useUpdateMeetingStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(
    async (meetingId: string, status: MeetingStatus, notes?: string): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        const now = new Date().toISOString();
        const patch: Partial<ProjectMeeting> = { status, updated_at: now };
        if (notes !== undefined) patch.notes = notes;

        if (!supabase) {
          const all = readDemo();
          const idx = all.findIndex(m => m.id === meetingId);
          if (idx >= 0) {
            all[idx] = { ...all[idx], ...patch } as ProjectMeeting;
            writeDemo(all);
          }
          setState({ loading: false, error: null });
          return;
        }
        const { data, error } = await supabase
          .from('project_meetings')
          .update(patch)
          .eq('id', meetingId)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('No se pudo actualizar la junta. Verifica permisos en profiles.role.');
        }
        setState({ loading: false, error: null });
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );

  return { update, ...state };
}

export function useDeleteMeeting() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (meetingId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        writeDemo(readDemo().filter(m => m.id !== meetingId));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('project_meetings').delete().eq('id', meetingId);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { remove, ...state };
}

/** Helper para formatear ISO local sin problemas de timezone */
export function localToISO(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
