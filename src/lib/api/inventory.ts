import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { AsyncState, MutationState } from './types';
import type { InventoryItem, InventoryMovement, InventoryMovementType, StockStatus } from '@/types/database';

const ITEMS_KEY = 'kanri_demo_inventory_items';
const MOV_KEY = 'kanri_demo_inventory_movements';

// ── Demo seed ──
const SEED_ITEMS: InventoryItem[] = [
  mkItem('HER-001', 'Broca HSS 6mm', 'Herramienta de corte', 'Pza', 48, 20, 120, 35, 89, 'A-1'),
  mkItem('INS-014', 'Aceite soluble (20 L)', 'Insumos', 'Cubeta', 6, 8, 24, 540, 980, 'Almacén'),
  mkItem('REF-220', 'Filtro neumático 1/2"', 'Refacción', 'Pza', 0, 5, 30, 120, 260, 'B-3'),
  mkItem('HER-220', 'Inserto CNMG 432', 'Herramienta de corte', 'Caja', 14, 6, 20, 410, 760, 'A-2'),
];

function mkItem(
  sku: string, name: string, category: string, uom: string,
  stock: number, min: number, max: number, cost: number, price: number, loc: string
): InventoryItem {
  const now = new Date().toISOString();
  return {
    id: `inv-${sku}`, tenant_id: null, sku, name, category, uom,
    stock, min_stock: min, max_stock: max, unit_cost: cost, unit_price: price,
    location: loc, supplier_name: null, barcode: null, active: true, notes: null,
    created_at: now, updated_at: now,
  };
}

function readItems(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (raw) return JSON.parse(raw) as InventoryItem[];
  } catch {
    /* ignore */
  }
  writeItems(SEED_ITEMS);
  return SEED_ITEMS;
}
function writeItems(rows: InventoryItem[]) {
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}
function readMovs(): InventoryMovement[] {
  try { return JSON.parse(localStorage.getItem(MOV_KEY) || '[]'); } catch { return []; }
}
function writeMovs(rows: InventoryMovement[]) {
  try { localStorage.setItem(MOV_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}

/** Estado de stock vs mínimo/máximo. */
export function stockStatus(item: Pick<InventoryItem, 'stock' | 'min_stock' | 'max_stock'>): StockStatus {
  if (item.stock <= 0) return 'agotado';
  if (item.stock <= item.min_stock) return 'bajo';
  if (item.max_stock != null && item.stock > item.max_stock) return 'sobre';
  return 'ok';
}

export function useInventoryItems(): AsyncState<InventoryItem[]> {
  return useAsync<InventoryItem[]>(
    async () => {
      if (!supabase) return readItems();
      const { data, error } = await supabase.from('inventory_items').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
    [],
    []
  );
}

export function useInventoryMovements(itemId?: string): AsyncState<InventoryMovement[]> {
  return useAsync<InventoryMovement[]>(
    async () => {
      if (!supabase) {
        const all = readMovs().sort((a, b) => b.created_at.localeCompare(a.created_at));
        return itemId ? all.filter(m => m.item_id === itemId) : all;
      }
      let q = supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(200);
      if (itemId) q = q.eq('item_id', itemId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InventoryMovement[];
    },
    [],
    [itemId]
  );
}

type ItemInput = Omit<InventoryItem, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'stock'> & {
  id?: string;
  stock?: number;
};

export function useUpsertInventoryItem() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (input: ItemInput): Promise<InventoryItem> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        const rows = readItems();
        if (input.id) {
          const idx = rows.findIndex(r => r.id === input.id);
          const updated = { ...rows[idx], ...input, updated_at: now } as InventoryItem;
          rows[idx] = updated;
          writeItems(rows);
          setState({ loading: false, error: null });
          return updated;
        }
        const created: InventoryItem = {
          ...(input as Omit<ItemInput, 'id'>),
          id: `inv-${Date.now().toString(36)}`,
          tenant_id: null,
          stock: input.stock ?? 0,
          created_at: now,
          updated_at: now,
        } as InventoryItem;
        writeItems([created, ...rows]);
        setState({ loading: false, error: null });
        return created;
      }
      const payload = { ...input, updated_at: now };
      const { data, error } = input.id
        ? await supabase.from('inventory_items').update(payload).eq('id', input.id).select('*').single()
        : await supabase.from('inventory_items').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as InventoryItem;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);
  return { save, ...state };
}

export function useDeleteInventoryItem() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        writeItems(readItems().filter(r => r.id !== id));
        writeMovs(readMovs().filter(m => m.item_id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
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

interface MovementInput {
  item_id: string;
  type: InventoryMovementType;
  quantity: number;
  reason?: string | null;
  reference?: string | null;
}

export interface BulkInventoryRow {
  sku: string | null;
  name: string;
  category: string;
  uom: string;
  stock: number;
  min_stock: number;
  max_stock: number | null;
  unit_cost: number;
  unit_price: number;
  location: string | null;
  supplier_name: string | null;
}

/** Inserta varios productos de inventario en lote (importación Excel/CSV). */
export function useBulkInsertInventory() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const insert = useCallback(async (rows: BulkInventoryRow[]): Promise<number> => {
    if (rows.length === 0) return 0;
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        const now = new Date().toISOString();
        const existing = readItems();
        const created: InventoryItem[] = rows.map((r, i) => ({
          ...r, id: `inv-${Date.now().toString(36)}-${i}`, tenant_id: null,
          barcode: null, active: true, notes: null, created_at: now, updated_at: now,
        }));
        writeItems([...created, ...existing]);
        setState({ loading: false, error: null });
        return created.length;
      }
      const { error } = await supabase.from('inventory_items').insert(rows);
      if (error) throw error;
      setState({ loading: false, error: null });
      return rows.length;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);
  return { insert, ...state };
}

export function useRegisterMovement() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const register = useCallback(async (input: MovementInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        // Demo: replica el trigger (actualiza stock + balance_after).
        const items = readItems();
        const idx = items.findIndex(i => i.id === input.item_id);
        if (idx < 0) throw new Error('Item no encontrado.');
        const cur = items[idx].stock;
        const q = Math.abs(input.quantity);
        const nw = input.type === 'entrada' ? cur + q : input.type === 'salida' ? cur - q : input.quantity;
        items[idx] = { ...items[idx], stock: nw, updated_at: new Date().toISOString() };
        writeItems(items);
        const mov: InventoryMovement = {
          id: `mov-${Date.now().toString(36)}`,
          tenant_id: null,
          item_id: input.item_id,
          type: input.type,
          quantity: input.type === 'ajuste' ? input.quantity : q,
          reason: input.reason ?? null,
          reference: input.reference ?? null,
          balance_after: nw,
          created_by: null,
          created_at: new Date().toISOString(),
        };
        writeMovs([mov, ...readMovs()]);
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('inventory_movements').insert({
        item_id: input.item_id,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason ?? null,
        reference: input.reference ?? null,
      });
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);
  return { register, ...state };
}
