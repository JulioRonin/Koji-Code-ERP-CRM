import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { WorkOrder, WorkOrderStage, StageStatus, TimeEntry } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_STAGES_KEY = 'koji_demo_stages';
const DEMO_TIME_KEY = 'koji_demo_time_entries';

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

/** Etapas por defecto para una pieza CNC. Útil al crear una WO nueva. */
export const DEFAULT_STAGE_TEMPLATES = [
  { name: 'Preparación / Setup', estimated_minutes: 30 },
  { name: 'Desbaste',             estimated_minutes: 60 },
  { name: 'Acabado',              estimated_minutes: 45 },
  { name: 'Taladrado',            estimated_minutes: 20 },
  { name: 'Inspección dimensional', estimated_minutes: 15 },
];

/**
 * Lista etapas de una Work Order ordenadas por secuencia.
 */
export function useWorkOrderStages(workOrderId: string | undefined): AsyncState<WorkOrderStage[]> {
  return useAsync<WorkOrderStage[]>(
    async () => {
      if (!workOrderId) return [];
      if (!supabase) {
        const all = readDemo<WorkOrderStage>(DEMO_STAGES_KEY);
        return all.filter(s => s.work_order_id === workOrderId).sort((a, b) => a.sequence - b.sequence);
      }
      const { data, error } = await supabase
        .from('work_order_stages')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('sequence');
      if (error) throw error;
      return (data ?? []) as WorkOrderStage[];
    },
    [],
    [workOrderId]
  );
}

interface CreateStagesInput {
  work_order_id: string;
  stages: { name: string; estimated_minutes?: number | null }[];
}

/**
 * Crea las etapas iniciales de una WO en lote.
 */
export function useCreateWorkOrderStages() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateStagesInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const rows: WorkOrderStage[] = input.stages.map((s, i) => ({
        id: (crypto?.randomUUID && crypto.randomUUID()) || `stage-${Date.now()}-${i}`,
        work_order_id: input.work_order_id,
        sequence: i + 1,
        name: s.name,
        status: 'Pendiente' as StageStatus,
        estimated_minutes: s.estimated_minutes ?? null,
        actual_minutes: null,
        started_at: null,
        completed_at: null,
        operator_id: null,
        notes: null,
        created_at: now,
        updated_at: now,
      }));

      if (!supabase) {
        const existing = readDemo<WorkOrderStage>(DEMO_STAGES_KEY);
        writeDemo(DEMO_STAGES_KEY, [...existing, ...rows]);
        setState({ loading: false, error: null });
        return;
      }

      const { error } = await supabase.from('work_order_stages').insert(rows);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { create, ...state };
}

interface StageActionInput {
  stage_id: string;
  operator_id?: string | null;
}

/**
 * Inicia la etapa: marca status = "En Proceso" y abre un time_entry.
 */
export function useStartStage() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const start = useCallback(async ({ stage_id, operator_id }: StageActionInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();

      if (!supabase) {
        // Actualiza etapa
        const stages = readDemo<WorkOrderStage>(DEMO_STAGES_KEY);
        const idx = stages.findIndex(s => s.id === stage_id);
        if (idx >= 0) {
          stages[idx] = {
            ...stages[idx],
            status: 'En Proceso',
            started_at: stages[idx].started_at ?? now,
            operator_id: operator_id ?? stages[idx].operator_id,
            updated_at: now,
          };
          writeDemo(DEMO_STAGES_KEY, stages);
        }
        // Abre time entry
        const entries = readDemo<TimeEntry>(DEMO_TIME_KEY);
        const stage = stages.find(s => s.id === stage_id);
        if (stage) {
          entries.push({
            id: (crypto?.randomUUID && crypto.randomUUID()) || `te-${Date.now()}`,
            work_order_id: stage.work_order_id,
            stage_id: stage_id,
            operator_id: operator_id ?? null,
            started_at: now,
            ended_at: null,
            duration_minutes: null,
            notes: null,
            created_at: now,
          });
          writeDemo(DEMO_TIME_KEY, entries);
        }
        setState({ loading: false, error: null });
        return;
      }

      const { data: stageRow, error: fetchErr } = await supabase
        .from('work_order_stages')
        .select('*')
        .eq('id', stage_id)
        .single();
      if (fetchErr) throw fetchErr;

      const { error: updErr } = await supabase
        .from('work_order_stages')
        .update({
          status: 'En Proceso',
          started_at: (stageRow as WorkOrderStage).started_at ?? now,
          operator_id: operator_id ?? (stageRow as WorkOrderStage).operator_id,
          updated_at: now,
        })
        .eq('id', stage_id);
      if (updErr) throw updErr;

      const { error: insErr } = await supabase.from('time_entries').insert({
        work_order_id: (stageRow as WorkOrderStage).work_order_id,
        stage_id: stage_id,
        operator_id: operator_id ?? null,
        started_at: now,
      });
      if (insErr) throw insErr;

      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { start, ...state };
}

/**
 * Pausa la etapa: cierra el time_entry abierto y deja status = "Pausado".
 */
export function usePauseStage() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const pause = useCallback(async ({ stage_id }: { stage_id: string }): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();

      if (!supabase) {
        const stages = readDemo<WorkOrderStage>(DEMO_STAGES_KEY);
        const idx = stages.findIndex(s => s.id === stage_id);
        if (idx >= 0) {
          stages[idx] = { ...stages[idx], status: 'Pausado', updated_at: now };
          writeDemo(DEMO_STAGES_KEY, stages);
        }
        const entries = readDemo<TimeEntry>(DEMO_TIME_KEY);
        const openIdx = entries.findIndex(e => e.stage_id === stage_id && !e.ended_at);
        if (openIdx >= 0) {
          const entry = entries[openIdx];
          const duration = Math.round(
            (new Date(now).getTime() - new Date(entry.started_at).getTime()) / 60000
          );
          entries[openIdx] = { ...entry, ended_at: now, duration_minutes: duration };
          writeDemo(DEMO_TIME_KEY, entries);
        }
        setState({ loading: false, error: null });
        return;
      }

      await supabase
        .from('work_order_stages')
        .update({ status: 'Pausado', updated_at: now })
        .eq('id', stage_id);

      await supabase.rpc('close_open_time_entry', { p_stage_id: stage_id }).then(
        () => {},
        async () => {
          // Si la RPC no existe, hacemos el cierre manual
          const { data: openEntries } = await supabase
            .from('time_entries')
            .select('*')
            .eq('stage_id', stage_id)
            .is('ended_at', null);
          for (const entry of (openEntries ?? []) as TimeEntry[]) {
            const duration = Math.round(
              (new Date(now).getTime() - new Date(entry.started_at).getTime()) / 60000
            );
            await supabase
              .from('time_entries')
              .update({ ended_at: now, duration_minutes: duration })
              .eq('id', entry.id);
          }
        }
      );

      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { pause, ...state };
}

/**
 * Completa la etapa: cierra time_entry abierto y suma actual_minutes.
 */
export function useCompleteStage() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const complete = useCallback(async ({ stage_id }: { stage_id: string }): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();

      if (!supabase) {
        const entries = readDemo<TimeEntry>(DEMO_TIME_KEY);
        // Cierra cualquier entry abierto
        let modified = false;
        const updatedEntries = entries.map(e => {
          if (e.stage_id === stage_id && !e.ended_at) {
            modified = true;
            const duration = Math.round(
              (new Date(now).getTime() - new Date(e.started_at).getTime()) / 60000
            );
            return { ...e, ended_at: now, duration_minutes: duration };
          }
          return e;
        });
        if (modified) writeDemo(DEMO_TIME_KEY, updatedEntries);

        // Suma total de actual_minutes
        const stages = readDemo<WorkOrderStage>(DEMO_STAGES_KEY);
        const total = updatedEntries
          .filter(e => e.stage_id === stage_id && e.duration_minutes)
          .reduce((acc, e) => acc + (e.duration_minutes || 0), 0);
        const idx = stages.findIndex(s => s.id === stage_id);
        if (idx >= 0) {
          stages[idx] = {
            ...stages[idx],
            status: 'Completado',
            completed_at: now,
            actual_minutes: total || stages[idx].actual_minutes,
            updated_at: now,
          };
          writeDemo(DEMO_STAGES_KEY, stages);
        }
        setState({ loading: false, error: null });
        return;
      }

      // Cierra entries abiertos
      const { data: openEntries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('stage_id', stage_id)
        .is('ended_at', null);
      for (const entry of (openEntries ?? []) as TimeEntry[]) {
        const duration = Math.round(
          (new Date(now).getTime() - new Date(entry.started_at).getTime()) / 60000
        );
        await supabase
          .from('time_entries')
          .update({ ended_at: now, duration_minutes: duration })
          .eq('id', entry.id);
      }

      // Suma total
      const { data: allEntries } = await supabase
        .from('time_entries')
        .select('duration_minutes')
        .eq('stage_id', stage_id);
      const total = ((allEntries ?? []) as { duration_minutes: number | null }[]).reduce(
        (acc, e) => acc + (e.duration_minutes || 0),
        0
      );

      await supabase
        .from('work_order_stages')
        .update({
          status: 'Completado',
          completed_at: now,
          actual_minutes: total,
          updated_at: now,
        })
        .eq('id', stage_id);

      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { complete, ...state };
}

/**
 * Helper: detecta si una WO ya tiene etapas demo creadas; si no, genera desde el template.
 */
export function ensureDefaultStagesForDemo(workOrder: WorkOrder): WorkOrderStage[] {
  if (supabase) return [];
  const all = readDemo<WorkOrderStage>(DEMO_STAGES_KEY);
  const existing = all.filter(s => s.work_order_id === workOrder.id);
  if (existing.length > 0) return existing.sort((a, b) => a.sequence - b.sequence);

  const now = new Date().toISOString();
  const created: WorkOrderStage[] = DEFAULT_STAGE_TEMPLATES.map((t, i) => ({
    id: `demo-stage-${workOrder.id}-${i + 1}`,
    work_order_id: workOrder.id,
    sequence: i + 1,
    name: t.name,
    status: 'Pendiente' as StageStatus,
    estimated_minutes: t.estimated_minutes,
    actual_minutes: null,
    started_at: null,
    completed_at: null,
    operator_id: null,
    notes: null,
    created_at: now,
    updated_at: now,
  }));
  writeDemo(DEMO_STAGES_KEY, [...all, ...created]);
  return created;
}
