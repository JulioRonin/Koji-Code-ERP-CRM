import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { ProjectTask, ProjectTaskStatus, ProjectNote } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_TASKS_KEY = 'koji_demo_project_tasks';
const DEMO_NOTES_KEY = 'koji_demo_project_notes';

function readDemo<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeDemo<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function newId(prefix: string): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================================
// TASKS
// ============================================================================

export function useProjectTasks(projectId: string | undefined): AsyncState<ProjectTask[]> {
  return useAsync<ProjectTask[]>(
    async () => {
      if (!projectId) return [];
      if (!supabase) {
        return readDemo<ProjectTask>(DEMO_TASKS_KEY)
          .filter(t => t.project_id === projectId)
          .sort((a, b) => a.sort_order - b.sort_order);
      }
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as ProjectTask[];
    },
    [],
    [projectId]
  );
}

interface AddTaskInput {
  name: string;
  scheduled_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  department?: string | null;
}

export function useAddProjectTask() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const add = useCallback(
    async (projectId: string, input: AddTaskInput | string): Promise<ProjectTask> => {
      setState({ loading: true, error: null });
      try {
        const now = new Date().toISOString();
        const payload: AddTaskInput =
          typeof input === 'string' ? { name: input } : input;

        const task: ProjectTask = {
          id: newId('task'),
          project_id: projectId,
          name: payload.name,
          scheduled_date: payload.scheduled_date ?? null,
          start_date: payload.start_date ?? null,
          end_date: payload.end_date ?? null,
          department: payload.department ?? null,
          progress: 0,
          status: 'pending',
          sort_order: Date.now(),
          created_at: now,
          updated_at: now,
        };

        if (!supabase) {
          const all = readDemo<ProjectTask>(DEMO_TASKS_KEY);
          writeDemo(DEMO_TASKS_KEY, [...all, task]);
          setState({ loading: false, error: null });
          return task;
        }
        const { data, error } = await supabase
          .from('project_tasks')
          .insert(task)
          .select('*');
        if (error) {
          // Mensajes accionables para errores comunes
          const msg = error.message || '';
          if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')) {
            throw new Error(
              'No se pudo crear la tarea. RLS bloqueó la operación — verifica que tu profile.role sea "Administrador" o "Administración / PM" en Supabase.'
            );
          }
          if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('not exist')) {
            throw new Error(
              'La tabla project_tasks no existe. Re-corre database_schema.sql en el SQL editor de Supabase.'
            );
          }
          throw error;
        }
        if (!data || data.length === 0) {
          throw new Error(
            'La tarea no se guardó. Verifica que tu profile.role tenga permisos en Supabase.'
          );
        }
        setState({ loading: false, error: null });
        return data[0] as ProjectTask;
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );

  return { add, ...state };
}

export function useUpdateProjectTask() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(
    async (taskId: string, patch: Partial<ProjectTask>): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        const now = new Date().toISOString();
        if (!supabase) {
          const all = readDemo<ProjectTask>(DEMO_TASKS_KEY);
          const idx = all.findIndex(t => t.id === taskId);
          if (idx >= 0) {
            all[idx] = { ...all[idx], ...patch, updated_at: now };
            writeDemo(DEMO_TASKS_KEY, all);
          }
          setState({ loading: false, error: null });
          return;
        }
        const { data, error } = await supabase
          .from('project_tasks')
          .update({ ...patch, updated_at: now })
          .eq('id', taskId)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('No se actualizó la tarea. Verifica permisos en profiles.role.');
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

export function useDeleteProjectTask() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (taskId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        writeDemo(
          DEMO_TASKS_KEY,
          readDemo<ProjectTask>(DEMO_TASKS_KEY).filter(t => t.id !== taskId)
        );
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
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

export function useUpdateProjectTaskStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (taskId: string, status: ProjectTaskStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const progress =
        status === 'completed' ? 100 : status === 'in-progress' ? 50 : status === 'cancelled' ? 0 : 0;

      if (!supabase) {
        const all = readDemo<ProjectTask>(DEMO_TASKS_KEY);
        const idx = all.findIndex(t => t.id === taskId);
        if (idx >= 0) {
          all[idx] = { ...all[idx], status, progress, updated_at: now };
          writeDemo(DEMO_TASKS_KEY, all);
        }
        setState({ loading: false, error: null });
        return;
      }
      const { data, error } = await supabase
        .from('project_tasks')
        .update({ status, progress, updated_at: now })
        .eq('id', taskId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No se actualizó la tarea. Verifica permisos en profiles.role.');
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { update, ...state };
}

// ============================================================================
// NOTES / ACTIVITY
// ============================================================================

export function useProjectNotes(projectId: string | undefined): AsyncState<ProjectNote[]> {
  return useAsync<ProjectNote[]>(
    async () => {
      if (!projectId) return [];
      if (!supabase) {
        return readDemo<ProjectNote>(DEMO_NOTES_KEY)
          .filter(n => n.project_id === projectId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      const { data, error } = await supabase
        .from('project_notes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ProjectNote[];
    },
    [],
    [projectId]
  );
}

interface AddNoteInput {
  project_id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  note_type?: ProjectNote['note_type'];
}

export function useAddProjectNote() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const add = useCallback(async (input: AddNoteInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const note: ProjectNote = {
        id: newId('note'),
        project_id: input.project_id,
        user_id: input.user_id ?? null,
        user_name: input.user_name ?? null,
        action: input.action,
        note_type: input.note_type ?? 'note',
        created_at: now,
      };

      if (!supabase) {
        const all = readDemo<ProjectNote>(DEMO_NOTES_KEY);
        writeDemo(DEMO_NOTES_KEY, [note, ...all]);
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('project_notes').insert(note);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { add, ...state };
}
