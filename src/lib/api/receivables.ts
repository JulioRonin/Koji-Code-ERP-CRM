import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';

export interface Receivable {
  id: string;
  tenant_id?: string | null;
  project_id: string | null;
  customer_name: string;
  concept: string | null;
  total_amount: number;
  currency: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

export type PaymentKind = 'anticipo' | 'abono' | 'liquidacion';

export interface ReceivablePayment {
  id: string;
  tenant_id?: string | null;
  receivable_id: string;
  amount: number;
  paid_date: string;
  method: string | null;
  kind: PaymentKind;
  notes: string | null;
  created_at: string;
}

export type ReceivableStatus = 'pendiente' | 'parcial' | 'liquidado' | 'vencido';

/** Estatus derivado de lo pagado vs total y la fecha de vencimiento. */
export function receivableStatus(total: number, paid: number, dueDate: string | null): ReceivableStatus {
  if (paid >= total && total > 0) return 'liquidado';
  const overdue = dueDate ? new Date(dueDate) < new Date() : false;
  if (overdue) return 'vencido';
  return paid > 0 ? 'parcial' : 'pendiente';
}

// ── Demo storage ──
const R_KEY = 'kanri_demo_receivables';
const P_KEY = 'kanri_demo_receivable_payments';
function read<T>(k: string): T[] { try { return JSON.parse(localStorage.getItem(k) || '[]') as T[]; } catch { return []; } }
function write<T>(k: string, v: T[]) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
function newId(p: string) { return (crypto?.randomUUID && crypto.randomUUID()) || `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export function useReceivables(): AsyncState<Receivable[]> {
  return useAsync<Receivable[]>(
    async () => {
      if (!supabase) return read<Receivable>(R_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await scopeByTenant(supabase.from('receivables').select('*')).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Receivable[];
    }, [], []
  );
}

/** Todos los pagos de la empresa (para Cobranza y Finanzas). */
export function useReceivablePayments(): AsyncState<ReceivablePayment[]> {
  return useAsync<ReceivablePayment[]>(
    async () => {
      if (!supabase) return read<ReceivablePayment>(P_KEY);
      const { data, error } = await scopeByTenant(supabase.from('receivable_payments').select('*')).order('paid_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReceivablePayment[];
    }, [], []
  );
}

export interface ReceivableInput {
  id?: string;
  project_id?: string | null;
  customer_name: string;
  concept?: string | null;
  total_amount: number;
  due_date?: string | null;
  notes?: string | null;
}

export function useUpsertReceivable() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (input: ReceivableInput): Promise<Receivable> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = {
        project_id: input.project_id ?? null, customer_name: input.customer_name, concept: input.concept ?? null,
        total_amount: input.total_amount, due_date: input.due_date ?? null, notes: input.notes ?? null, updated_at: now,
      };
      if (!supabase) {
        const all = read<Receivable>(R_KEY);
        if (input.id) { const i = all.findIndex(r => r.id === input.id); if (i >= 0) all[i] = { ...all[i], ...payload }; write(R_KEY, all); setState({ loading: false, error: null }); return all[i]; }
        const created: Receivable = { id: newId('rec'), tenant_id: null, currency: 'MXN', created_at: now, ...payload };
        write(R_KEY, [created, ...all]); setState({ loading: false, error: null }); return created;
      }
      const { data, error } = input.id
        ? await supabase.from('receivables').update(payload).eq('id', input.id).select('*').single()
        : await supabase.from('receivables').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Receivable;
    } catch (e) { const err = e as Error; setState({ loading: false, error: err }); throw err; }
  }, []);
  return { save, ...state };
}

export function useDeleteReceivable() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        write(R_KEY, read<Receivable>(R_KEY).filter(r => r.id !== id));
        write(P_KEY, read<ReceivablePayment>(P_KEY).filter(p => p.receivable_id !== id));
        setState({ loading: false, error: null }); return;
      }
      await supabase.from('receivable_payments').delete().eq('receivable_id', id);
      const { error } = await supabase.from('receivables').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (e) { const err = e as Error; setState({ loading: false, error: err }); throw err; }
  }, []);
  return { remove, ...state };
}

export interface PaymentInput {
  receivable_id: string;
  amount: number;
  paid_date: string;
  method?: string | null;
  kind?: PaymentKind;
  notes?: string | null;
}

export function useAddPayment() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const add = useCallback(async (input: PaymentInput): Promise<ReceivablePayment> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = {
        receivable_id: input.receivable_id, amount: input.amount, paid_date: input.paid_date,
        method: input.method ?? null, kind: input.kind ?? 'abono', notes: input.notes ?? null,
      };
      if (!supabase) {
        const created: ReceivablePayment = { id: newId('pay'), tenant_id: null, created_at: now, ...payload };
        write(P_KEY, [created, ...read<ReceivablePayment>(P_KEY)]); setState({ loading: false, error: null }); return created;
      }
      const { data, error } = await supabase.from('receivable_payments').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as ReceivablePayment;
    } catch (e) { const err = e as Error; setState({ loading: false, error: err }); throw err; }
  }, []);
  return { add, ...state };
}

export function useDeletePayment() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) { write(P_KEY, read<ReceivablePayment>(P_KEY).filter(p => p.id !== id)); setState({ loading: false, error: null }); return; }
      const { error } = await supabase.from('receivable_payments').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (e) { const err = e as Error; setState({ loading: false, error: err }); throw err; }
  }, []);
  return { remove, ...state };
}
