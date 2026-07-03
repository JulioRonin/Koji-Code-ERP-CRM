import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';

export type TxKind = 'income' | 'expense';

export interface FinanceTransaction {
  id: string;
  tenant_id?: string | null;
  kind: TxKind;
  category: string | null;
  description: string | null;
  amount: number;
  tx_date: string;
  project_id: string | null;
  created_at: string;
}

const KEY = 'kanri_demo_finance_tx';
function read(): FinanceTransaction[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as FinanceTransaction[]; } catch { return []; }
}
function write(rows: FinanceTransaction[]) { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ } }
function newId(): string { return (crypto?.randomUUID && crypto.randomUUID()) || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export function useFinanceTransactions(): AsyncState<FinanceTransaction[]> {
  return useAsync<FinanceTransaction[]>(
    async () => {
      if (!supabase) return read().sort((a, b) => b.tx_date.localeCompare(a.tx_date));
      const { data, error } = await scopeByTenant(supabase.from('finance_transactions').select('*'))
        .order('tx_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceTransaction[];
    },
    [],
    []
  );
}

export interface TransactionInput {
  id?: string;
  kind: TxKind;
  category?: string | null;
  description?: string | null;
  amount: number;
  tx_date: string;
  project_id?: string | null;
}

export function useUpsertTransaction() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (input: TransactionInput): Promise<FinanceTransaction> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = {
        kind: input.kind, category: input.category ?? null, description: input.description ?? null,
        amount: input.amount, tx_date: input.tx_date, project_id: input.project_id ?? null,
      };
      if (!supabase) {
        const all = read();
        if (input.id) {
          const idx = all.findIndex(t => t.id === input.id);
          if (idx >= 0) all[idx] = { ...all[idx], ...payload };
          write(all); setState({ loading: false, error: null }); return all[idx];
        }
        const created: FinanceTransaction = { id: newId(), tenant_id: null, created_at: now, ...payload };
        write([created, ...all]); setState({ loading: false, error: null }); return created;
      }
      const { data, error } = input.id
        ? await supabase.from('finance_transactions').update(payload).eq('id', input.id).select('*').single()
        : await supabase.from('finance_transactions').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as FinanceTransaction;
    } catch (e) { const err = e as Error; setState({ loading: false, error: err }); throw err; }
  }, []);
  return { save, ...state };
}

export function useDeleteTransaction() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) { write(read().filter(t => t.id !== id)); setState({ loading: false, error: null }); return; }
      const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (e) { const err = e as Error; setState({ loading: false, error: err }); throw err; }
  }, []);
  return { remove, ...state };
}
