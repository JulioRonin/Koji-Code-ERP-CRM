import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_BOM_ITEMS } from './mocks';
import type { BomItem, BomStatus, ManufacturingStatus } from '@/types/database';
import type { AsyncState, MutationState } from './types';

/**
 * Trae TODAS las filas de bom_items que cumplan el filtro, paginando en
 * bloques de 1000. Supabase JS devuelve máximo 1000 filas por consulta;
 * sin paginar, los BOMs grandes (>1000 ítems) se truncaban silenciosamente
 * y los registros que ordenan al final (ej. part numbers que empiezan con
 * letras, después de los numéricos) simplemente desaparecían — aunque
 * estuvieran guardados en la base.
 */
async function fetchAllBomItems(projectId?: string): Promise<BomItem[]> {
  if (!supabase) {
    return projectId
      ? MOCK_BOM_ITEMS.filter(b => b.project_id === projectId)
      : MOCK_BOM_ITEMS;
  }
  const PAGE = 1000;
  const all: BomItem[] = [];
  let from = 0;
  // Bucle hasta que un bloque venga incompleto (= última página)
  // Tope de seguridad: 50 páginas (50k ítems) para no loopear infinito.
  // IMPORTANTE: filtros (.eq) van ANTES de modificadores (.order, .range).
  for (let guard = 0; guard < 50; guard++) {
    let q = supabase.from('bom_items').select('*');
    if (projectId) q = q.eq('project_id', projectId);
    const { data, error } = await q.order('part_number').range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as BomItem[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * Lista todos los BOM items, opcionalmente filtrados por proyecto.
 */
export function useBomItems(projectId?: string): AsyncState<BomItem[]> {
  return useAsync<BomItem[]>(
    () => fetchAllBomItems(projectId),
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
  production_quantity?: number | null;
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
        production_quantity: it.production_quantity ?? null,
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

/** Normaliza un part_number para comparar: minúsculas, sin separadores. */
function normalizePart(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface ProductionQtyRow {
  part_number: string;
  production_quantity: number;
}

export interface UpdateProductionQtyResult {
  matched: { part_number: string; production_quantity: number }[];
  unmatched: string[];
}

/**
 * Actualiza SÓLO la columna production_quantity de items existentes,
 * haciendo match por part_number dentro de un proyecto. No inserta filas
 * nuevas ni toca ningún otro campo: es la operación segura para "agregar
 * la cantidad de producción a un BOM ya cargado" sin duplicar ni romper
 * la data existente.
 *
 * El match ignora mayúsculas y separadores (-, _, espacios).
 */
export function useUpdateProductionQuantities() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(
    async (projectId: string, rows: ProductionQtyRow[]): Promise<UpdateProductionQtyResult> => {
      setState({ loading: true, error: null });
      const matched: UpdateProductionQtyResult['matched'] = [];
      const unmatched: string[] = [];
      try {
        if (!supabase) {
          setState({ loading: false, error: null });
          return { matched: rows.map(r => ({ ...r })), unmatched: [] };
        }

        // 1. Trae los items existentes del proyecto (id + part_number).
        const existing = await fetchAllBomItems(projectId);
        const byNorm = new Map<string, string>(); // normPart -> id
        existing.forEach(it => byNorm.set(normalizePart(it.part_number), it.id));

        const now = new Date().toISOString();
        // 2. Por cada fila del archivo, busca match y actualiza sólo la qty.
        for (const r of rows) {
          const id = byNorm.get(normalizePart(r.part_number));
          if (!id) {
            unmatched.push(r.part_number);
            continue;
          }
          const { data, error } = await supabase
            .from('bom_items')
            .update({ production_quantity: r.production_quantity, updated_at: now })
            .eq('id', id)
            .select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(
              `No se pudo actualizar ${r.part_number}. Verifica que tu profiles.role sea "Administrador".`
            );
          }
          matched.push({ part_number: r.part_number, production_quantity: r.production_quantity });
        }

        setState({ loading: false, error: null });
        return { matched, unmatched };
      } catch (err) {
        const error = err as Error;
        setState({ loading: false, error });
        throw error;
      }
    },
    []
  );

  return { update, ...state };
}

export interface UpdateBomItemInput {
  part_number?: string;
  description?: string | null;
  category?: string;
  quantity?: number;
  production_quantity?: number | null;
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
 * Asigna o desasigna un técnico a un BOM item.
 * Pasa null como techId para desasignar. Detecta RLS silenciosa.
 */
export function useAssignTechnician() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const assign = useCallback(async (itemId: string, techId: string | null): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { data, error } = await supabase
        .from('bom_items')
        .update({
          assigned_technician_id: techId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'No se pudo guardar la asignación. Verifica que tu profiles.role sea "Administrador" en Supabase.'
        );
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { assign, ...state };
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
  /** No solicitados aún */
  pending_items: number;
  /** Solicitados al proveedor pero todavía sin enviar */
  requested_items: number;
  /** En camino */
  in_transit_items: number;
  /** Recibidos o en stock */
  received_items: number;
  progress_pct: number;
  late_items: number;
  currency: string;
}

export function summarizePurchasing(items: BomItem[]): PurchasingSummary {
  const total = items.length;
  const pending = items.filter(i => i.bom_status === 'Pendiente').length;
  const requested = items.filter(i => i.bom_status === 'Solicitado').length;
  const inTransit = items.filter(i => i.bom_status === 'Tránsito').length;
  const received = items.filter(i => i.bom_status === 'Recibido' || i.bom_status === 'Stock').length;
  const progress = total === 0 ? 0 : Math.round((received / total) * 100);
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
    pending_items: pending,
    requested_items: requested,
    in_transit_items: inTransit,
    received_items: received,
    progress_pct: progress,
    late_items: late,
    currency,
  };
}
