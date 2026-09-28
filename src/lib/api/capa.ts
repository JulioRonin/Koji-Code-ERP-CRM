import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';
import type {
  ControlPlan,
  ControlPlanItem,
  CorrectiveAction,
  CaStatus,
} from '@/types/database';

/**
 * Calidad avanzada: plan de control por proyecto y acciones correctivas (CAPA).
 * Tablas: control_plans, control_plan_items, corrective_actions
 * (db/2026_quality_capa.sql). En modo demo se guardan en localStorage.
 */

// ── Demo storage ─────────────────────────────────────────────────────────
const CP_KEY = 'kanri_demo_control_plans';
const CPI_KEY = 'kanri_demo_control_plan_items';
const CA_KEY = 'kanri_demo_corrective_actions';
function read<T>(k: string): T[] { try { return JSON.parse(localStorage.getItem(k) || '[]') as T[]; } catch { return []; } }
function write<T>(k: string, v: T[]) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
function uuid(p: string) { return (crypto?.randomUUID && crypto.randomUUID()) || `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/** Folio legible para acciones correctivas: CA-2026-123456. */
export function newCaId(): string {
  return `CA-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

/** Traduce "tabla inexistente" a una instrucción accionable. */
function friendly(err: { message?: string } | null | undefined): Error {
  const msg = err?.message ?? 'Error desconocido';
  if (/does not exist|could not find the table|schema cache/i.test(msg)) {
    return new Error('Falta habilitar Calidad avanzada: ejecuta db/2026_quality_capa.sql en Supabase (SQL Editor).');
  }
  return new Error(msg);
}

// ── Estatus derivado ─────────────────────────────────────────────────────
export function isCaOverdue(ca: Pick<CorrectiveAction, 'due_date' | 'status'>): boolean {
  if (!ca.due_date || ca.status === 'Cerrada' || ca.status === 'Cancelada') return false;
  const due = new Date(`${ca.due_date}T23:59:59`);
  return due.getTime() < Date.now();
}

export const CA_OPEN_STATUSES: CaStatus[] = ['Abierta', 'En proceso', 'En verificación'];

// ============================================================================
// PLAN DE CONTROL
// ============================================================================

export function useControlPlan(projectId: string | undefined): AsyncState<ControlPlan | null> {
  return useAsync<ControlPlan | null>(
    async () => {
      if (!projectId) return null;
      if (!supabase) return read<ControlPlan>(CP_KEY).find(p => p.project_id === projectId) ?? null;
      const { data, error } = await scopeByTenant(supabase.from('control_plans').select('*'))
        .eq('project_id', projectId)
        .limit(1)
        .maybeSingle();
      if (error) throw friendly(error);
      return (data as ControlPlan) ?? null;
    },
    null,
    [projectId]
  );
}

export type ControlPlanInput = Partial<Omit<ControlPlan, 'id' | 'created_at' | 'updated_at'>> & { project_id: string };

export function useUpsertControlPlan() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (existingId: string | null, input: ControlPlanInput): Promise<ControlPlan> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = {
        project_id: input.project_id,
        phase: input.phase ?? 'Producción',
        revision: input.revision ?? 'A',
        prepared_by: input.prepared_by ?? null,
        approved_by: input.approved_by ?? null,
        key_contact: input.key_contact ?? null,
        notes: input.notes ?? null,
        updated_at: now,
      };
      if (!supabase) {
        const all = read<ControlPlan>(CP_KEY);
        const i = all.findIndex(p => p.project_id === input.project_id);
        const row: ControlPlan = i >= 0
          ? { ...all[i], ...payload }
          : { id: uuid('cp'), created_at: now, ...payload };
        if (i >= 0) all[i] = row; else all.unshift(row);
        write(CP_KEY, all);
        setState({ loading: false, error: null });
        return row;
      }
      const { data, error } = existingId
        ? await supabase.from('control_plans').update(payload).eq('id', existingId).select('*').single()
        : await supabase.from('control_plans').insert(payload).select('*').single();
      if (error) throw friendly(error);
      setState({ loading: false, error: null });
      return data as ControlPlan;
    } catch (e) {
      const err = e as Error;
      setState({ loading: false, error: err });
      throw err;
    }
  }, []);
  return { save, ...state };
}

export function useControlPlanItems(projectId: string | undefined): AsyncState<ControlPlanItem[]> {
  return useAsync<ControlPlanItem[]>(
    async () => {
      if (!projectId) return [];
      const sortFn = (a: ControlPlanItem, b: ControlPlanItem) =>
        (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at);
      if (!supabase) return read<ControlPlanItem>(CPI_KEY).filter(i => i.project_id === projectId).sort(sortFn);
      const { data, error } = await scopeByTenant(supabase.from('control_plan_items').select('*'))
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw friendly(error);
      return (data ?? []) as ControlPlanItem[];
    },
    [],
    [projectId]
  );
}

export type ControlPlanItemInput = Omit<ControlPlanItem, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>;

export function useUpsertControlPlanItem() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (id: string | null, input: ControlPlanItemInput): Promise<ControlPlanItem> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = { ...input, updated_at: now };
      if (!supabase) {
        const all = read<ControlPlanItem>(CPI_KEY);
        let row: ControlPlanItem;
        if (id) {
          const i = all.findIndex(r => r.id === id);
          row = { ...all[i], ...payload };
          all[i] = row;
        } else {
          row = { id: uuid('cpi'), created_at: now, ...payload };
          all.push(row);
        }
        write(CPI_KEY, all);
        setState({ loading: false, error: null });
        return row;
      }
      const { data, error } = id
        ? await supabase.from('control_plan_items').update(payload).eq('id', id).select('*').single()
        : await supabase.from('control_plan_items').insert(payload).select('*').single();
      if (error) throw friendly(error);
      setState({ loading: false, error: null });
      return data as ControlPlanItem;
    } catch (e) {
      const err = e as Error;
      setState({ loading: false, error: err });
      throw err;
    }
  }, []);
  return { save, ...state };
}

export function useDeleteControlPlanItem() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        write(CPI_KEY, read<ControlPlanItem>(CPI_KEY).filter(r => r.id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('control_plan_items').delete().eq('id', id);
      if (error) throw friendly(error);
      setState({ loading: false, error: null });
    } catch (e) {
      const err = e as Error;
      setState({ loading: false, error: err });
      throw err;
    }
  }, []);
  return { remove, ...state };
}

// ============================================================================
// ACCIONES CORRECTIVAS (CAPA)
// ============================================================================

/** Acciones correctivas de la empresa; con projectId, solo las de ese proyecto. */
export function useCorrectiveActions(projectId?: string): AsyncState<CorrectiveAction[]> {
  return useAsync<CorrectiveAction[]>(
    async () => {
      if (!supabase) {
        const all = read<CorrectiveAction>(CA_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
        return projectId ? all.filter(a => a.project_id === projectId) : all;
      }
      let q = scopeByTenant(supabase.from('corrective_actions').select('*')).order('created_at', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw friendly(error);
      return (data ?? []) as CorrectiveAction[];
    },
    [],
    [projectId]
  );
}

export type CorrectiveActionInput = Omit<CorrectiveAction, 'id' | 'created_at' | 'updated_at' | 'tenant_id' | 'closed_at'> & {
  closed_at?: string | null;
};

export function useUpsertCorrectiveAction() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (id: string | null, input: CorrectiveActionInput): Promise<CorrectiveAction> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      // Al cerrar se sella la fecha; al reabrir se limpia.
      const closed_at = input.status === 'Cerrada' ? (input.closed_at ?? now) : null;
      const payload = { ...input, closed_at, updated_at: now };
      if (!supabase) {
        const all = read<CorrectiveAction>(CA_KEY);
        let row: CorrectiveAction;
        if (id) {
          const i = all.findIndex(r => r.id === id);
          row = { ...all[i], ...payload };
          all[i] = row;
        } else {
          row = { id: newCaId(), created_at: now, ...payload };
          all.unshift(row);
        }
        write(CA_KEY, all);
        setState({ loading: false, error: null });
        return row;
      }
      const { data, error } = id
        ? await supabase.from('corrective_actions').update(payload).eq('id', id).select('*').single()
        : await supabase.from('corrective_actions').insert({ id: newCaId(), ...payload }).select('*').single();
      if (error) throw friendly(error);
      setState({ loading: false, error: null });
      return data as CorrectiveAction;
    } catch (e) {
      const err = e as Error;
      setState({ loading: false, error: err });
      throw err;
    }
  }, []);
  return { save, ...state };
}

export function useDeleteCorrectiveAction() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        write(CA_KEY, read<CorrectiveAction>(CA_KEY).filter(r => r.id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('corrective_actions').delete().eq('id', id);
      if (error) throw friendly(error);
      setState({ loading: false, error: null });
    } catch (e) {
      const err = e as Error;
      setState({ loading: false, error: err });
      throw err;
    }
  }, []);
  return { remove, ...state };
}
