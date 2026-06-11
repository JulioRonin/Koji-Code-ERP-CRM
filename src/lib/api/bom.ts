import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_BOM_ITEMS } from './mocks';
import type { BomItem, BomStatus, ManufacturingStatus } from '@/types/database';
import type { AsyncState, MutationState } from './types';

/**
 * Lista todos los BOM items, opcionalmente filtrados por proyecto.
 */
export function useBomItems(projectId?: string): AsyncState<BomItem[]> {
  return useAsync<BomItem[]>(
    async () => {
      if (!supabase) {
        return projectId
          ? MOCK_BOM_ITEMS.filter(b => b.project_id === projectId)
          : MOCK_BOM_ITEMS;
      }
      let query = supabase.from('bom_items').select('*').order('part_number');
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BomItem[];
    },
    projectId ? MOCK_BOM_ITEMS.filter(b => b.project_id === projectId) : MOCK_BOM_ITEMS,
    [projectId]
  );
}

/**
 * Actualiza el estatus de compra de un BOM item.
 */
export function useUpdateBomStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (itemId: string, status: BomStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase
        .from('bom_items')
        .update({ bom_status: status, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { update, ...state };
}

/**
 * Actualiza el estatus de manufactura de un BOM item.
 */
export function useUpdateManufacturingStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (itemId: string, status: ManufacturingStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { data, error } = await supabase
        .from('bom_items')
        .update({ manufacturing_status: status, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'No se actualizó el estatus. Verifica que tu profiles.role sea "Administrador" en Supabase.'
        );
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { update, ...state };
}

interface BulkInsertBomItem {
  project_id: string;
  part_number: string;
  description: string | null;
  category: string;
  quantity: number;
  uom: string;
  material?: string | null;
  unit_price?: number | null;
  currency?: string | null;
  supplier_name?: string | null;
  requisition_date?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  production_relevant?: boolean;
}

/**
 * Inserta varios items de BOM en lote (caso típico: subir Excel / CSV).
 */
export function useBulkInsertBom() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const insert = useCallback(async (items: BulkInsertBomItem[]): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const rows = items.map(it => ({
        ...it,
        material: it.material ?? null,
        unit_price: it.unit_price ?? null,
        currency: it.currency ?? 'MXN',
        supplier_name: it.supplier_name ?? null,
        requisition_date: it.requisition_date ?? null,
        delivery_date: it.delivery_date ?? null,
        notes: it.notes ?? null,
        production_relevant: it.production_relevant ?? true,
        bom_status: 'Pendiente' as BomStatus,
        manufacturing_status: 'PENDIENTE' as ManufacturingStatus,
      }));
      const { error } = await supabase.from('bom_items').insert(rows);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { insert, ...state };
}

export interface UpdateBomItemInput {
  part_number?: string;
  description?: string | null;
  category?: string;
  quantity?: number;
  uom?: string;
  bom_status?: BomStatus;
  unit_price?: number | null;
  currency?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  requisition_date?: string | null;
  delivery_date?: string | null;
  actual_delivery_date?: string | null;
  notes?: string | null;
  production_relevant?: boolean;
}

/**
 * Actualiza cualquier subset de campos de un BOM item.
 * Detecta RLS silencioso pidiendo el row de vuelta.
 */
export function useUpdateBomItem() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (itemId: string, input: UpdateBomItemInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { data, error } = await supabase
        .from('bom_items')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'No se actualizó el item. Verifica que tu profiles.role sea "Administrador" en Supabase.'
        );
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { update, ...state };
}

/**
 * Elimina un BOM item.
 */
export function useDeleteBomItem() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (itemId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { error, count } = await supabase
        .from('bom_items')
        .delete({ count: 'exact' })
        .eq('id', itemId);
      if (error) throw error;
      if (count === 0) {
        throw new Error('No se eliminó el item. Probablemente tu perfil no tiene permisos.');
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { remove, ...state };
}

/**
 * Elimina TODOS los BOM items de un proyecto (para recargar uno nuevo).
 * Devuelve cuántos se eliminaron.
 */
export function useDeleteProjectBom() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const removeAll = useCallback(async (projectId: string): Promise<number> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return 0;
      }
      const { error, count } = await supabase
        .from('bom_items')
        .delete({ count: 'exact' })
        .eq('project_id', projectId);
      if (error) throw error;
      setState({ loading: false, error: null });
      return count ?? 0;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { removeAll, ...state };
}

/**
 * Resumen de compras de un proyecto: % de items recibidos (o en stock) y
 * total gastado vs presupuesto declarado en los items con precio.
 *
 * `received` = items con bom_status en {Recibido, Stock}.
 * El % alimenta el avance del frente de Compras del proyecto.
 */
export interface PurchasingSummary {
  total_items: number;
  received_items: number;
  pending_items: number;
  in_transit_items: number;
  progress_pct: number;
  total_cost: number;
  currency: string;
  late_items: number;
}

export function summarizePurchasing(items: BomItem[]): PurchasingSummary {
  const total = items.length;
  const received = items.filter(i => i.bom_status === 'Recibido' || i.bom_status === 'Stock').length;
  const inTransit = items.filter(i => i.bom_status === 'Tránsito').length;
  const pending = items.filter(i => i.bom_status === 'Pendiente' || i.bom_status === 'Solicitado').length;
  const progress = total === 0 ? 0 : Math.round((received / total) * 100);
  const totalCost = items.reduce((acc, i) => acc + (Number(i.unit_price) || 0) * (Number(i.quantity) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const late = items.filter(
    i =>
      i.delivery_date != null &&
      i.delivery_date < today &&
      i.bom_status !== 'Recibido' &&
      i.bom_status !== 'Stock'
  ).length;
  const currency = items.find(i => i.currency)?.currency ?? 'MXN';
  return {
    total_items: total,
    received_items: received,
    pending_items: pending,
    in_transit_items: inTransit,
    progress_pct: progress,
    total_cost: totalCost,
    currency,
    late_items: late,
  };
}
