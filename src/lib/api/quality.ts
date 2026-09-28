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

// ── NCR: persistencia en modo demo + tolerancia a migración pendiente ──
const DEMO_NCR_KEY = 'kanri_demo_ncrs';
function readDemoNcrs(): Ncr[] {
  try { return JSON.parse(localStorage.getItem(DEMO_NCR_KEY) || '[]') as Ncr[]; } catch { return []; }
}
function writeDemoNcrs(v: Ncr[]) {
  try { localStorage.setItem(DEMO_NCR_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
function allDemoNcrs(): Ncr[] {
  const saved = readDemoNcrs();
  const ids = new Set(saved.map(n => n.id));
  return [...saved, ...MOCK_NCRS.filter(n => !ids.has(n.id))];
}
/** Columnas agregadas por db/2026_quality_capa.sql (si aún no se corre, se omiten). */
const NCR_V2_COLS = [
  'part_number', 'quantity_affected', 'detected_area', 'defect_type', 'containment', 'disposition',
  'disposition_notes', 'disposition_by', 'disposition_at', 'why_analysis', 'verification',
  'effective', 'cost_impact', 'updated_at',
] as const;
const NCR_V2_RE = new RegExp(NCR_V2_COLS.join('|'), 'i');
function stripNcrV2<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  NCR_V2_COLS.forEach(c => delete copy[c]);
  return copy as T;
}

export function useNcrs(projectId?: string): AsyncState<Ncr[]> {
  return useAsync<Ncr[]>(
    async () => {
      if (!supabase) {
        const all = allDemoNcrs();
        return projectId ? all.filter(n => n.project_id === projectId) : all;
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
      // El id de measurement_instruments es TEXT sin default: se genera al crear.
      const newId = `INS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const { data, error } = input.id
        ? await supabase.from('measurement_instruments').update(payload).eq('id', input.id).select('*').single()
        : await supabase.from('measurement_instruments').insert({ id: newId, ...payload }).select('*').single();
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

export interface CreateNcrInput {
  project_id: string;
  bom_item_id?: string | null;
  issue_description: string;
  severity: NcrSeverity;
  inspection_id?: string | null;
  notify_customer?: boolean;
  part_number?: string | null;
  quantity_affected?: number | null;
  detected_area?: string | null;
  defect_type?: string | null;
  containment?: string | null;
  created_by?: string | null;
}

export function useCreateNcr() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateNcrInput): Promise<Ncr> => {
    setState({ loading: true, error: null });
    try {
      const year = new Date().getFullYear();
      // Folio legible y prácticamente único (evita choques del antiguo 100-999).
      const id = `NCR-${year}-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      const draft: Ncr = {
        id,
        project_id: input.project_id,
        bom_item_id: input.bom_item_id ?? null,
        inspection_id: input.inspection_id ?? null,
        issue_description: input.issue_description,
        severity: input.severity,
        status: 'Abierta',
        root_cause: null,
        action_plan: null,
        notify_customer: input.notify_customer ?? false,
        created_by: null, // FK a profiles: lo dejamos nulo (no siempre hay perfil)
        closed_by: null,
        created_at: now,
        closed_at: null,
        part_number: input.part_number ?? null,
        quantity_affected: input.quantity_affected ?? null,
        detected_area: input.detected_area ?? null,
        defect_type: input.defect_type ?? null,
        containment: input.containment ?? null,
        updated_at: now,
      };

      if (!supabase) {
        writeDemoNcrs([draft, ...readDemoNcrs()]);
        setState({ loading: false, error: null });
        return draft;
      }

      let { data, error } = await supabase.from('ncrs').insert(draft).select('*').single();
      if (error && NCR_V2_RE.test(error.message)) {
        ({ data, error } = await supabase.from('ncrs').insert(stripNcrV2(draft as unknown as Record<string, unknown>)).select('*').single());
      }
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

/** Actualiza una NCR (contención, disposición, causa raíz, verificación, estatus). */
export function useUpdateNcr() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (id: string, patch: Partial<Ncr>): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const full: Partial<Ncr> = { ...patch, updated_at: now };
      if (!supabase) {
        const all = allDemoNcrs();
        const i = all.findIndex(n => n.id === id);
        if (i >= 0) all[i] = { ...all[i], ...full };
        writeDemoNcrs(all);
        setState({ loading: false, error: null });
        return;
      }
      let { error } = await supabase.from('ncrs').update(full).eq('id', id);
      if (error && NCR_V2_RE.test(error.message)) {
        const stripped = stripNcrV2(full as Record<string, unknown>);
        if (Object.keys(stripped).length === 0) {
          throw new Error('Para guardar el procedimiento completo ejecuta db/2026_quality_capa.sql en Supabase.');
        }
        ({ error } = await supabase.from('ncrs').update(stripped).eq('id', id));
      }
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { update, ...state };
}

export function useDeleteNcr() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        writeDemoNcrs(allDemoNcrs().filter(n => n.id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('ncrs').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);
  return { remove, ...state };
}
