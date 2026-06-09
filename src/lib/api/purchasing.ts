import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_REQUISITIONS, MOCK_SUPPLIERS } from './mocks';
import type { Requisition, Supplier } from '@/types/database';
import type { AsyncState } from './types';

export function useRequisitions(): AsyncState<Requisition[]> {
  return useAsync<Requisition[]>(
    async () => {
      if (!supabase) return MOCK_REQUISITIONS;
      const { data, error } = await supabase
        .from('requisitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Requisition[];
    },
    MOCK_REQUISITIONS,
    []
  );
}

export function useSuppliers(): AsyncState<Supplier[]> {
  return useAsync<Supplier[]>(
    async () => {
      if (!supabase) return MOCK_SUPPLIERS;
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
    MOCK_SUPPLIERS,
    []
  );
}
