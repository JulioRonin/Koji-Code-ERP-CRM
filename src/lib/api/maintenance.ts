import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';
import type {
  EquipmentFamily,
  MaintenanceChecklist,
  MaintenanceOrder,
  MaintenanceTask,
} from '@/types/database';
import { newOrderId } from '@/lib/maintenance';

/**
 * Mantenimiento preventivo (PR-MTO-001): plan de tareas por máquina, órdenes
 * y checklist diario (FR-MTO-001). Tablas en db/2026_maintenance.sql.
 * En modo demo se guardan en localStorage.
 */

const TASK_KEY = 'kanri_demo_mto_tasks';
const ORDER_KEY = 'kanri_demo_mto_orders';
const CHECK_KEY = 'kanri_demo_mto_checklists';
const FAMILY_KEY = 'kanri_demo_mto_families';

function read<T>(k: string): T[] { try { return JSON.parse(localStorage.getItem(k) || '[]') as T[]; } catch { return []; } }
function write<T>(k: string, v: T[]) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
function uuid(p: string) { return (crypto?.randomUUID && crypto.randomUUID()) || `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function friendly(err: { message?: string } | null | undefined): Error {
  const msg = err?.message ?? 'Error desconocido';
  if (/does not exist|could not find the table|schema cache|equipment_family/i.test(msg)) {
    return new Error('Falta habilitar Mantenimiento: ejecuta db/2026_maintenance.sql en Supabase (SQL Editor).');
  }
  return new Error(msg);
}

function mutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  // Envuelve una función async con estado loading/error (patrón de la capa de datos).
  return function useMutation() {
    const [state, setState] = useState<MutationState>({ loading: false, error: null });
    const run = useCallback(async (...args: A): Promise<R> => {
      setState({ loading: true, error: null });
      try {
        const r = await fn(...args);
        setState({ loading: false, error: null });
        return r;
      } catch (e) {
        const err = e as Error;
        setState({ loading: false, error: err });
        throw err;
      }
    }, []);
    return { run, ...state };
  };
}

// ============================================================================
// Familia de equipo (columna machines.equipment_family)
// ============================================================================

/** En modo demo la familia se guarda aparte (las máquinas demo son fijas). */
export function readDemoFamilies(): Record<string, EquipmentFamily> {
  try { return JSON.parse(localStorage.getItem(FAMILY_KEY) || '{}'); } catch { return {}; }
}

export const useSetMachineFamily = mutation(async (machineId: string, family: EquipmentFamily | null): Promise<void> => {
  if (!supabase) {
    const map = readDemoFamilies();
    if (family) map[machineId] = family; else delete map[machineId];
    try { localStorage.setItem(FAMILY_KEY, JSON.stringify(map)); } catch { /* ignore */ }
    return;
  }
  const { error } = await supabase
    .from('machines')
    .update({ equipment_family: family, updated_at: new Date().toISOString() })
    .eq('id', machineId);
  if (error) throw friendly(error);
});

// ============================================================================
// Plan de mantenimiento (tareas)
// ============================================================================

export function useMaintenanceTasks(machineId?: string): AsyncState<MaintenanceTask[]> {
  return useAsync<MaintenanceTask[]>(
    async () => {
      const sort = (a: MaintenanceTask, b: MaintenanceTask) =>
        a.machine_id.localeCompare(b.machine_id) || (a.sort_order - b.sort_order);
      if (!supabase) {
        const all = read<MaintenanceTask>(TASK_KEY).sort(sort);
        return machineId ? all.filter(t => t.machine_id === machineId) : all;
      }
      let q = scopeByTenant(supabase.from('maintenance_tasks').select('*'))
        .order('machine_id', { ascending: true })
        .order('sort_order', { ascending: true });
      if (machineId) q = q.eq('machine_id', machineId);
      const { data, error } = await q;
      if (error) throw friendly(error);
      return (data ?? []) as MaintenanceTask[];
    },
    [],
    [machineId]
  );
}

export type MaintenanceTaskInput = Omit<MaintenanceTask, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>;

async function saveTask(id: string | null, input: MaintenanceTaskInput): Promise<MaintenanceTask> {
  const now = new Date().toISOString();
  const payload = { ...input, updated_at: now };
  if (!supabase) {
    const all = read<MaintenanceTask>(TASK_KEY);
    let row: MaintenanceTask;
    if (id) {
      const i = all.findIndex(t => t.id === id);
      row = { ...all[i], ...payload };
      all[i] = row;
    } else {
      row = { id: uuid('mt'), created_at: now, ...payload };
      all.push(row);
    }
    write(TASK_KEY, all);
    return row;
  }
  const { data, error } = id
    ? await supabase.from('maintenance_tasks').update(payload).eq('id', id).select('*').single()
    : await supabase.from('maintenance_tasks').insert(payload).select('*').single();
  if (error) throw friendly(error);
  return data as MaintenanceTask;
}

export const useUpsertMaintenanceTask = mutation(saveTask);

export const useBulkInsertMaintenanceTasks = mutation(async (rows: MaintenanceTaskInput[]): Promise<number> => {
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  if (!supabase) {
    const all = read<MaintenanceTask>(TASK_KEY);
    rows.forEach(r => all.push({ id: uuid('mt'), created_at: now, updated_at: now, ...r }));
    write(TASK_KEY, all);
    return rows.length;
  }
  const { error } = await supabase.from('maintenance_tasks').insert(rows.map(r => ({ ...r, updated_at: now })));
  if (error) throw friendly(error);
  return rows.length;
});

export const useDeleteMaintenanceTask = mutation(async (id: string): Promise<void> => {
  if (!supabase) { write(TASK_KEY, read<MaintenanceTask>(TASK_KEY).filter(t => t.id !== id)); return; }
  const { error } = await supabase.from('maintenance_tasks').delete().eq('id', id);
  if (error) throw friendly(error);
});

/** Marca tareas como realizadas hoy y recalcula su próxima fecha. */
export const useMarkTasksDone = mutation(async (updates: { id: string; last_done: string; next_due: string }[]): Promise<void> => {
  if (updates.length === 0) return;
  const now = new Date().toISOString();
  if (!supabase) {
    const all = read<MaintenanceTask>(TASK_KEY);
    updates.forEach(u => {
      const i = all.findIndex(t => t.id === u.id);
      if (i >= 0) all[i] = { ...all[i], last_done: u.last_done, next_due: u.next_due, updated_at: now };
    });
    write(TASK_KEY, all);
    return;
  }
  for (const u of updates) {
    const { error } = await supabase.from('maintenance_tasks')
      .update({ last_done: u.last_done, next_due: u.next_due, updated_at: now })
      .eq('id', u.id);
    if (error) throw friendly(error);
  }
});

// ============================================================================
// Órdenes de mantenimiento
// ============================================================================

export function useMaintenanceOrders(machineId?: string): AsyncState<MaintenanceOrder[]> {
  return useAsync<MaintenanceOrder[]>(
    async () => {
      if (!supabase) {
        const all = read<MaintenanceOrder>(ORDER_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
        return machineId ? all.filter(o => o.machine_id === machineId) : all;
      }
      let q = scopeByTenant(supabase.from('maintenance_orders').select('*')).order('created_at', { ascending: false });
      if (machineId) q = q.eq('machine_id', machineId);
      const { data, error } = await q;
      if (error) throw friendly(error);
      return (data ?? []) as MaintenanceOrder[];
    },
    [],
    [machineId]
  );
}

export type MaintenanceOrderInput = Omit<MaintenanceOrder, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>;

export const useUpsertMaintenanceOrder = mutation(async (id: string | null, input: MaintenanceOrderInput): Promise<MaintenanceOrder> => {
  const now = new Date().toISOString();
  const payload = { ...input, updated_at: now };
  if (!supabase) {
    const all = read<MaintenanceOrder>(ORDER_KEY);
    let row: MaintenanceOrder;
    if (id) {
      const i = all.findIndex(o => o.id === id);
      row = { ...all[i], ...payload };
      all[i] = row;
    } else {
      row = { id: newOrderId(), created_at: now, ...payload };
      all.unshift(row);
    }
    write(ORDER_KEY, all);
    return row;
  }
  const { data, error } = id
    ? await supabase.from('maintenance_orders').update(payload).eq('id', id).select('*').single()
    : await supabase.from('maintenance_orders').insert({ id: newOrderId(), ...payload }).select('*').single();
  if (error) throw friendly(error);
  return data as MaintenanceOrder;
});

export const useDeleteMaintenanceOrder = mutation(async (id: string): Promise<void> => {
  if (!supabase) { write(ORDER_KEY, read<MaintenanceOrder>(ORDER_KEY).filter(o => o.id !== id)); return; }
  const { error } = await supabase.from('maintenance_orders').delete().eq('id', id);
  if (error) throw friendly(error);
});

// ============================================================================
// Checklist diario (FR-MTO-001)
// ============================================================================

export function useMaintenanceChecklists(machineId?: string): AsyncState<MaintenanceChecklist[]> {
  return useAsync<MaintenanceChecklist[]>(
    async () => {
      if (!supabase) {
        const all = read<MaintenanceChecklist>(CHECK_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
        return machineId ? all.filter(c => c.machine_id === machineId) : all;
      }
      let q = scopeByTenant(supabase.from('maintenance_checklists').select('*'))
        .order('check_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300);
      if (machineId) q = q.eq('machine_id', machineId);
      const { data, error } = await q;
      if (error) throw friendly(error);
      return (data ?? []) as MaintenanceChecklist[];
    },
    [],
    [machineId]
  );
}

export type MaintenanceChecklistInput = Omit<MaintenanceChecklist, 'id' | 'created_at' | 'tenant_id'>;

export const useSaveMaintenanceChecklist = mutation(async (input: MaintenanceChecklistInput): Promise<MaintenanceChecklist> => {
  const now = new Date().toISOString();
  if (!supabase) {
    const row: MaintenanceChecklist = { id: uuid('mc'), created_at: now, ...input };
    write(CHECK_KEY, [row, ...read<MaintenanceChecklist>(CHECK_KEY)]);
    return row;
  }
  const { data, error } = await supabase.from('maintenance_checklists').insert(input).select('*').single();
  if (error) throw friendly(error);
  return data as MaintenanceChecklist;
});

export const useLinkChecklistOrder = mutation(async (checklistId: string, orderId: string): Promise<void> => {
  if (!supabase) {
    const all = read<MaintenanceChecklist>(CHECK_KEY);
    const i = all.findIndex(c => c.id === checklistId);
    if (i >= 0) { all[i] = { ...all[i], order_id: orderId }; write(CHECK_KEY, all); }
    return;
  }
  const { error } = await supabase.from('maintenance_checklists').update({ order_id: orderId }).eq('id', checklistId);
  if (error) throw friendly(error);
});
