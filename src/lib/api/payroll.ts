import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';
import type { Periodicity } from '@/lib/payroll';

export interface PayrollItem {
  profile_id: string;
  name: string;
  monthly_salary: number;
  absences: number;
  bonus: number;
  deductions: number;
  perceptions: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  tenant_id?: string | null;
  period_label: string;
  periodicity: Periodicity;
  status: 'borrador' | 'dispersada';
  total_net: number;
  items: PayrollItem[];
  created_at: string;
}

const KEY = 'kanri_demo_payroll_runs';

function read(): PayrollRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PayrollRun[]) : [];
  } catch {
    return [];
  }
}
function write(rows: PayrollRun[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}
function rid(): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function usePayrollRuns(): AsyncState<PayrollRun[]> {
  return useAsync<PayrollRun[]>(
    async () => {
      if (!supabase) return read().sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await scopeByTenant(supabase.from('payroll_runs').select('*'))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PayrollRun[];
    },
    [],
    []
  );
}

export interface SavePayrollInput {
  period_label: string;
  periodicity: Periodicity;
  status: 'borrador' | 'dispersada';
  items: PayrollItem[];
}

export function useSavePayrollRun() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const save = useCallback(async (input: SavePayrollInput): Promise<PayrollRun> => {
    setState({ loading: true, error: null });
    try {
      const total_net = input.items.reduce((s, i) => s + i.net, 0);
      const now = new Date().toISOString();
      const payload = {
        period_label: input.period_label,
        periodicity: input.periodicity,
        status: input.status,
        total_net,
        items: input.items,
      };

      if (!supabase) {
        const run: PayrollRun = { id: rid(), tenant_id: null, created_at: now, ...payload };
        write([run, ...read()]);
        setState({ loading: false, error: null });
        return run;
      }
      const { data, error } = await supabase.from('payroll_runs').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as PayrollRun;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { save, ...state };
}
