import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_INSPECTIONS, MOCK_NCRS, MOCK_INSTRUMENTS } from './mocks';
import type {
  QualityInspection,
  Ncr,
  MeasurementInstrument,
  NcrSeverity,
} from '@/types/database';
import type { AsyncState, MutationState } from './types';

export function useInspections(projectId?: string): AsyncState<QualityInspection[]> {
  return useAsync<QualityInspection[]>(
    async () => {
      if (!supabase) {
        return projectId
          ? MOCK_INSPECTIONS.filter(i => i.project_id === projectId)
          : MOCK_INSPECTIONS;
      }
      let query = supabase
        .from('quality_inspections')
        .select('*')
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
      let query = supabase.from('ncrs').select('*').order('created_at', { ascending: false });
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
      const { data, error } = await supabase
        .from('measurement_instruments')
        .select('*')
        .order('id');
      if (error) throw error;
      return (data ?? []) as MeasurementInstrument[];
    },
    MOCK_INSTRUMENTS,
    []
  );
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
