import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_MACHINES, MOCK_WORK_ORDERS } from './mocks';
import type { Machine, MachineStatus, WorkOrder } from '@/types/database';
import type { AsyncState, MutationState } from './types';

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

interface MachineInput {
  id: string;
  type: string;
  status?: MachineStatus;
  location?: string | null;
  notes?: string | null;
}

/** Da de alta una máquina en el catálogo. El id es el código (ej. CNC-001). */
export function useCreateMachine() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const create = useCallback(async (input: MachineInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('machines').insert({
        id: input.id.trim(),
        type: input.type.trim(),
        status: input.status ?? 'Disponible',
        location: input.location ?? null,
        notes: input.notes ?? null,
      });
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('duplicate') || m.includes('primary key')) {
          throw new Error(`Ya existe una máquina con el código "${input.id}".`);
        }
        if (m.includes('row-level security') || m.includes('policy')) {
          throw new Error('No tienes permisos para registrar máquinas. Verifica que tu profiles.role sea "Administrador".');
        }
        throw error;
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);
  return { create, ...state };
}

/** Actualiza datos/estatus de una máquina. */
export function useUpdateMachine() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const update = useCallback(
    async (id: string, patch: Partial<Omit<Machine, 'id' | 'created_at' | 'updated_at'>>): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        if (!supabase) {
          setState({ loading: false, error: null });
          return;
        }
        const { data, error } = await supabase
          .from('machines')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('No se actualizó la máquina. Verifica permisos (profiles.role).');
        }
        setState({ loading: false, error: null });
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );
  return { update, ...state };
}

/** Elimina una máquina del catálogo. */
export function useDeleteMachine() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('machines').delete().eq('id', id);
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

export function useWorkOrders(filters?: { technicianId?: string; status?: string }): AsyncState<WorkOrder[]> {
  return useAsync<WorkOrder[]>(
    async () => {
      if (!supabase) {
        let result = [...readDemoWorkOrders(), ...MOCK_WORK_ORDERS];
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

// ── Work orders: persistencia demo (localStorage) ──
const WO_DEMO_KEY = 'koji_demo_work_orders';
function readDemoWorkOrders(): WorkOrder[] {
  try {
    const raw = localStorage.getItem(WO_DEMO_KEY);
    return raw ? (JSON.parse(raw) as WorkOrder[]) : [];
  } catch {
    return [];
  }
}
function writeDemoWorkOrders(rows: WorkOrder[]): void {
  try {
    localStorage.setItem(WO_DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export interface CreateWorkOrderInput {
  project_id: string;
  bom_item_id: string;
  machine_id?: string | null;
  assigned_technician_id?: string | null;
  quantity: number;
  priority?: WorkOrder['priority'];
  status?: WorkOrder['status'];
  notes?: string | null;
}

/** Crea una orden de trabajo (al asignar máquina/técnico en el plan). */
export function useCreateWorkOrder() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const create = useCallback(async (input: CreateWorkOrderInput): Promise<WorkOrder> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const id = `WO-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
      const record: WorkOrder = {
        id,
        project_id: input.project_id,
        bom_item_id: input.bom_item_id,
        machine_id: input.machine_id ?? null,
        assigned_technician_id: input.assigned_technician_id ?? null,
        quantity: input.quantity,
        completed_qty: 0,
        priority: input.priority ?? 'Normal',
        status: input.status ?? 'En Proceso',
        planned_start: null,
        planned_end: null,
        actual_start: now,
        actual_end: null,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      };

      if (!supabase) {
        writeDemoWorkOrders([record, ...readDemoWorkOrders()]);
        setState({ loading: false, error: null });
        return record;
      }

      const { data, error } = await supabase.from('work_orders').insert(record).select('*').single();
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('row-level security') || m.includes('policy')) {
          throw new Error('No tienes permisos para crear órdenes de trabajo (profiles.role).');
        }
        throw error;
      }
      setState({ loading: false, error: null });
      return data as WorkOrder;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);
  return { create, ...state };
}

/** Actualiza una orden de trabajo (avance, estatus, liberar máquina, etc.). */
export function useUpdateWorkOrder() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const update = useCallback(
    async (id: string, patch: Partial<Omit<WorkOrder, 'id' | 'created_at'>>): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        const merged = { ...patch, updated_at: new Date().toISOString() };
        if (!supabase) {
          writeDemoWorkOrders(
            readDemoWorkOrders().map(w => (w.id === id ? { ...w, ...merged } : w))
          );
          setState({ loading: false, error: null });
          return;
        }
        const { data, error } = await supabase
          .from('work_orders')
          .update(merged)
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('No se actualizó la orden de trabajo. Verifica permisos.');
        }
        setState({ loading: false, error: null });
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );
  return { update, ...state };
}
