import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { PmoReport, PmoReportType } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_KEY = 'koji_demo_pmo_reports';

function readDemo(): PmoReport[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as PmoReport[]) : [];
  } catch {
    return [];
  }
}

function writeDemo(items: PmoReport[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/**
 * Lista reportes PMO. Opcionalmente filtra por proyecto.
 */
export function usePmoReports(projectId?: string): AsyncState<PmoReport[]> {
  return useAsync<PmoReport[]>(
    async () => {
      if (!supabase) {
        const all = readDemo();
        return projectId ? all.filter(r => r.project_id === projectId) : all;
      }
      let query = supabase.from('pmo_reports').select('*').order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PmoReport[];
    },
    [],
    [projectId]
  );
}

interface CreatePmoInput {
  project_id: string;
  report_type: PmoReportType;
  period_start?: string;
  period_end?: string;
  progress_snapshot?: number;
  summary?: string;
  pdf_url?: string;
}

/**
 * Crea un nuevo reporte PMO (snapshot).
 */
export function useCreatePmoReport() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreatePmoInput): Promise<PmoReport> => {
    setState({ loading: true, error: null });
    try {
      const id = (crypto?.randomUUID && crypto.randomUUID()) || `pmo-${Date.now()}`;
      const now = new Date().toISOString();

      const draft: PmoReport = {
        id,
        project_id: input.project_id,
        report_type: input.report_type,
        period_start: input.period_start ?? null,
        period_end: input.period_end ?? null,
        progress_snapshot: input.progress_snapshot ?? null,
        summary: input.summary ?? null,
        pdf_url: input.pdf_url ?? null,
        sent_to_client: false,
        sent_at: null,
        generated_by: null,
        created_at: now,
      };

      if (!supabase) {
        const existing = readDemo();
        writeDemo([draft, ...existing]);
        setState({ loading: false, error: null });
        return draft;
      }

      const { data, error } = await supabase.from('pmo_reports').insert(draft).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as PmoReport;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { create, ...state };
}

/**
 * Marca el reporte como enviado al cliente. Dispara el trigger `pmo.report_sent`
 * en automation_events, que n8n puede consumir para mandar el correo.
 */
export function useMarkReportSent() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const markSent = useCallback(async (reportId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();

      if (!supabase) {
        const all = readDemo();
        const idx = all.findIndex(r => r.id === reportId);
        if (idx >= 0) {
          all[idx] = { ...all[idx], sent_to_client: true, sent_at: now };
          writeDemo(all);
        }
        setState({ loading: false, error: null });
        return;
      }

      const { error } = await supabase
        .from('pmo_reports')
        .update({ sent_to_client: true, sent_at: now })
        .eq('id', reportId);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { markSent, ...state };
}
