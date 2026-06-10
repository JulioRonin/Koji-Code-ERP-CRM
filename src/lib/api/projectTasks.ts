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

export function useAddProjectTask() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const add = useCallback(
    async (projectId: string, name: string, scheduledDate?: string | null): Promise<ProjectTask> => {
      setState({ loading: true, error: null });
      try {
        const now = new Date().toISOString();
        const task: ProjectTask = {
          id: newId('task'),
          project_id: projectId,
          name,
          scheduled_date: scheduledDate ?? null,
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
        const { data, error } = await supabase.from('project_tasks').insert(task).select('*').single();
        if (error) throw error;
        setState({ loading: false, error: null });
        return data as ProjectTask;
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

export function useUpdateProjectTaskStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (taskId: string, status: ProjectTaskStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        const all = readDemo<ProjectTask>(DEMO_TASKS_KEY);
        const idx = all.findIndex(t => t.id === taskId);
        if (idx >= 0) {
          all[idx] = { ...all[idx], status, updated_at: now };
          writeDemo(DEMO_TASKS_KEY, all);
        }
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase
        .from('project_tasks')
        .update({ status, updated_at: now })
        .eq('id', taskId);
      if (error) throw error;
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
