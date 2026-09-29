import type { EquipmentFamily, Machine, MaintenanceOrderStatus, MaintenanceTask } from '@/types/database';
import { inferFamily, dueState, type DueState } from '@/lib/maintenance';
import { readDemoFamilies } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

/** Familia efectiva: la guardada, la de demo o la inferida del tipo. */
export function effectiveFamily(m: Machine): EquipmentFamily | null {
  if (m.equipment_family) return m.equipment_family;
  if (!supabase) {
    const demo = readDemoFamilies()[m.id];
    if (demo) return demo;
  }
  return inferFamily(m.type);
}

/** Próximo vencimiento (el más cercano) de las tareas activas de una máquina. */
export function nextDueFor(machineId: string, tasks: MaintenanceTask[]): string | null {
  const dates = tasks.filter(t => t.machine_id === machineId && t.active && t.next_due).map(t => t.next_due as string).sort();
  return dates[0] ?? null;
}

export const DUE_VARIANT: Record<DueState, BadgeVariant> = {
  overdue: 'destructive',
  due_soon: 'warning',
  ok: 'success',
  unknown: 'secondary',
};

export const DUE_TEXT: Record<DueState, string> = {
  overdue: 'Vencido',
  due_soon: 'Por vencer',
  ok: 'Al día',
  unknown: 'Sin plan',
};

export const ORDER_STATUS_VARIANT: Record<MaintenanceOrderStatus, BadgeVariant> = {
  Programada: 'secondary',
  'En proceso': 'warning',
  Completada: 'success',
  Cancelada: 'outline',
};

export { dueState };
