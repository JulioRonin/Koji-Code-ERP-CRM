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
      const { error } = await supabase
        .from('bom_items')
        .update({ manufacturing_status: status, updated_at: new Date().toISOString() })
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

interface BulkInsertBomItem {
  project_id: string;
  part_number: string;
  description: string | null;
  category: string;
  quantity: number;
  uom: string;
  material?: string | null;
}

/**
 * Inserta varios items de BOM en lote (caso típico: subir Excel).
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
