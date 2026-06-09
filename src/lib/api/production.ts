import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_MACHINES, MOCK_WORK_ORDERS } from './mocks';
import type { Machine, WorkOrder } from '@/types/database';
import type { AsyncState } from './types';

export function useMachines(): AsyncState<Machine[]> {
  return useAsync<Machine[]>(
    async () => {
      if (!supabase) return MOCK_MACHINES;
      const { data, error } = await supabase.from('machines').select('*').order('id');
      if (error) throw error;
      return (data ?? []) as Machine[];
    },
    MOCK_MACHINES,
    []
  );
}

export function useWorkOrders(filters?: { technicianId?: string; status?: string }): AsyncState<WorkOrder[]> {
  return useAsync<WorkOrder[]>(
    async () => {
      if (!supabase) {
        let result = MOCK_WORK_ORDERS;
        if (filters?.technicianId)
          result = result.filter(w => w.assigned_technician_id === filters.technicianId);
        if (filters?.status) result = result.filter(w => w.status === filters.status);
        return result;
      }
      let query = supabase.from('work_orders').select('*').order('created_at', { ascending: false });
      if (filters?.technicianId) query = query.eq('assigned_technician_id', filters.technicianId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WorkOrder[];
    },
    MOCK_WORK_ORDERS,
    [filters?.technicianId, filters?.status]
  );
}
