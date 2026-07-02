import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import { MOCK_INSPECTIONS, MOCK_NCRS, MOCK_INSTRUMENTS } from './mocks';
import type {
  QualityInspection,
  Ncr,
  MeasurementInstrument,
  InstrumentStatus,
  NcrSeverity,
} from '@/types/database';
import type { AsyncState, MutationState } from './types';

/** Estado de calibración según la próxima fecha (con umbral de aviso en días). */
export type CalibrationState = 'ok' | 'due_soon' | 'overdue' | 'unknown';
export function calibrationState(next: string | null | undefined, warnDays = 30): CalibrationState {
  if (!next) return 'unknown';
  const days = Math.ceil((new Date(next).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days <= warnDays) return 'due_soon';
  return 'ok';
}

export function useInspections(projectId?: string): AsyncState<QualityInspection[]> {
  return useAsync<QualityInspection[]>(
    async () => {
      if (!supabase) {
        return projectId
          ? MOCK_INSPECTIONS.filter(i => i.project_id === projectId)
          : MOCK_INSPECTIONS;
      }
      let query = scopeByTenant(supabase
        .from('quality_inspections')
        .select('*'))
        .order('inspection_date', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as QualityInspection[];
    },
    projectId ? MOCK_INSPECTIONS.filter(i => i.project_id === projectId) : MOCK_INSPECTIONS,
    [projectId]
  );
}

export function useNcrs(projectId?: string): AsyncState<Ncr[]> {
  return useAsync<Ncr[]>(
    async () => {
      if (!supabase) {
        return projectId ? MOCK_NCRS.filter(n => n.project_id === projectId) : MOCK_NCRS;
      }
      let query = scopeByTenant(supabase.from('ncrs').select('*')).order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Ncr[];
    },
    projectId ? MOCK_NCRS.filter(n => n.project_id === projectId) : MOCK_NCRS,
    [projectId]
  );
}

export function useInstruments(): AsyncState<MeasurementInstrument[]> {
  return useAsync<MeasurementInstrument[]>(
    async () => {
      if (!supabase) return MOCK_INSTRUMENTS;
      const { data, error } = await scopeByTenant(supabase
        .from('measurement_instruments')
        .select('*'))
        .order('id');
      if (error) throw error;
      return (data ?? []) as MeasurementInstrument[];
    },
    MOCK_INSTRUMENTS,
    []
  );
}

export interface InstrumentInput {
  id?: string;
  name: string;
  brand?: string | null;
  serial_number?: string | null;
  last_calibration?: string | null;
  next_calibration?: string | null;
  status?: InstrumentStatus;
  notes?: string | null;
}

export function useUpsertInstrument() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (input: InstrumentInput): Promise<MeasurementInstrument | null> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      // Estado de calibración derivado de la próxima fecha si no se fija a mano.
      const derived: InstrumentStatus = input.status
        ?? (calibrationState(input.next_calibration) === 'overdue' ? 'Vencido'
          : calibrationState(input.next_calibration) === 'due_soon' ? 'Por Calibrar' : 'Calibrado');
      const payload = {
        name: input.name, brand: input.brand ?? null, serial_number: input.serial_number ?? null,
        last_calibration: input.last_calibration ?? null, next_calibration: input.next_calibration ?? null,
        status: derived, notes: input.notes ?? null, updated_at: now,
      };
      if (!supabase) { setState({ loading: false, error: null }); return null; }
      const { data, error } = input.id
        ? await supabase.from('measurement_instruments').update(payload).eq('id', input.id).select('*').single()
        : await supabase.from('measurement_instruments').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as MeasurementInstrument;
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { save, ...state };
}

export function useDeleteInstrument() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) { setState({ loading: false, error: null }); return; }
      const { error } = await supabase.from('measurement_instruments').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { remove, ...state };
}

interface CreateNcrInput {
  project_id: string;
  bom_item_id: string;
  issue_description: string;
  severity: NcrSeverity;
  inspection_id?: string | null;
  notify_customer?: boolean;
}

export function useCreateNcr() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateNcrInput): Promise<Ncr> => {
    setState({ loading: true, error: null });
    try {
      const year = new Date().getFullYear();
      const id = `NCR-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
      const now = new Date().toISOString();

      const draft: Ncr = {
        id,
        project_id: input.project_id,
        bom_item_id: input.bom_item_id,
        inspection_id: input.inspection_id ?? null,
        issue_description: input.issue_description,
        severity: input.severity,
        status: 'Abierta',
        root_cause: null,
        action_plan: null,
        notify_customer: input.notify_customer ?? false,
        created_by: null,
        closed_by: null,
        created_at: now,
        closed_at: null,
      };

      if (!supabase) {
        setState({ loading: false, error: null });
        return draft;
      }

      const { data, error } = await supabase.from('ncrs').insert(draft).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Ncr;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { create, ...state };
}
