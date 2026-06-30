import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { Customer } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const CUST_KEY = 'kanri_demo_customers';

function read(): Customer[] {
  try {
    const raw = localStorage.getItem(CUST_KEY);
    return raw ? (JSON.parse(raw) as Customer[]) : [];
  } catch {
    return [];
  }
}

function write(items: Customer[]): void {
  try {
    localStorage.setItem(CUST_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function newId(): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useCustomers(): AsyncState<Customer[]> {
  return useAsync<Customer[]>(
    async () => {
      if (!supabase) return read().sort((a, b) => a.name.localeCompare(b.name));
      const { data, error } = await supabase.from('customers').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
    [],
    []
  );
}

export interface CustomerInput {
  id?: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export function useUpsertCustomer() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const save = useCallback(async (input: CustomerInput): Promise<Customer> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = {
        name: input.name,
        contact_name: input.contact_name ?? null,
        contact_email: input.contact_email ?? null,
        phone: input.phone ?? null,
        tax_id: input.tax_id ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        is_active: input.is_active ?? true,
      };

      if (!supabase) {
        const all = read();
        if (input.id) {
          const idx = all.findIndex(c => c.id === input.id);
          if (idx >= 0) all[idx] = { ...all[idx], ...payload, updated_at: now };
          write(all);
          setState({ loading: false, error: null });
          return all[idx];
        }
        const created: Customer = { id: newId(), ...payload, created_at: now, updated_at: now };
        write([created, ...all]);
        setState({ loading: false, error: null });
        return created;
      }

      if (input.id) {
        const { data, error } = await supabase
          .from('customers')
          .update({ ...payload, updated_at: now })
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw error;
        setState({ loading: false, error: null });
        return data as Customer;
      }
      const { data, error } = await supabase.from('customers').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Customer;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { save, ...state };
}

export function useDeleteCustomer() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        write(read().filter(c => c.id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { remove, ...state };
}
