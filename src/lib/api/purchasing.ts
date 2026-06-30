import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { applyInventoryMovement } from './inventory';
import { MOCK_REQUISITIONS, MOCK_SUPPLIERS } from './mocks';
import type {
  Requisition, RequisitionStatus, Supplier, Priority,
  PurchaseOrder, PurchaseOrderItem, PoStatus,
} from '@/types/database';
import type { AsyncState, MutationState } from './types';

// ── Persistencia demo (localStorage) ──
const SUP_KEY = 'kanri_demo_suppliers';
const REQ_KEY = 'kanri_demo_requisitions';
const PO_KEY = 'kanri_demo_pos';
const POI_KEY = 'kanri_demo_po_items';

function read<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch { /* ignore */ }
  write(key, seed);
  return seed;
}
function write<T>(key: string, rows: T[]) {
  try { localStorage.setItem(key, JSON.stringify(rows)); } catch { /* ignore */ }
}
const year = () => new Date().getFullYear();
const rid = (p: string) => `${p}-${year()}-${Date.now().toString().slice(-5)}`;

// ════════════════════════════ PROVEEDORES ════════════════════════════
export function useSuppliers(): AsyncState<Supplier[]> {
  return useAsync<Supplier[]>(
    async () => {
      if (!supabase) return read(SUP_KEY, MOCK_SUPPLIERS);
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
    MOCK_SUPPLIERS,
    []
  );
}

export interface SupplierInput {
  id?: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  rating?: number | null;
  is_certified?: boolean;
  is_active?: boolean;
  notes?: string | null;
}

export function useUpsertSupplier() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const save = useCallback(async (input: SupplierInput): Promise<Supplier> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        const rows = read(SUP_KEY, MOCK_SUPPLIERS);
        if (input.id) {
          const idx = rows.findIndex(r => r.id === input.id);
          rows[idx] = { ...rows[idx], ...input, updated_at: now } as Supplier;
          write(SUP_KEY, rows);
          setState({ loading: false, error: null });
          return rows[idx];
        }
        const created = {
          id: `sup-${Date.now().toString(36)}`, is_certified: false, is_active: true,
          created_at: now, updated_at: now, ...input,
        } as Supplier;
        write(SUP_KEY, [created, ...rows]);
        setState({ loading: false, error: null });
        return created;
      }
      const payload = { ...input, updated_at: now };
      const { data, error } = input.id
        ? await supabase.from('suppliers').update(payload).eq('id', input.id).select('*').single()
        : await supabase.from('suppliers').insert(payload).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Supplier;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);
  return { save, ...state };
}

export function useDeleteSupplier() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) { write(SUP_KEY, read(SUP_KEY, MOCK_SUPPLIERS).filter(r => r.id !== id)); setState({ loading: false, error: null }); return; }
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { remove, ...state };
}

// ════════════════════════════ REQUISICIONES ════════════════════════════
export function useRequisitions(): AsyncState<Requisition[]> {
  return useAsync<Requisition[]>(
    async () => {
      if (!supabase) return read(REQ_KEY, MOCK_REQUISITIONS);
      const { data, error } = await supabase.from('requisitions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Requisition[];
    },
    MOCK_REQUISITIONS,
    []
  );
}

export interface RequisitionInput {
  description: string;
  quantity: number;
  uom?: string;
  priority?: Priority;
  project_id?: string | null;
  needed_by?: string | null;
  notes?: string | null;
}

export function useCreateRequisition() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const create = useCallback(async (input: RequisitionInput): Promise<Requisition> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const rec: Requisition = {
        id: rid('REQ'), project_id: input.project_id ?? null, bom_item_id: null,
        description: input.description, quantity: input.quantity, uom: input.uom ?? 'Pzas',
        requester_id: null, priority: input.priority ?? 'Media', status: 'Pendiente',
        notes: input.notes ?? null, needed_by: input.needed_by ?? null, created_at: now, updated_at: now,
      };
      if (!supabase) { write(REQ_KEY, [rec, ...read(REQ_KEY, MOCK_REQUISITIONS)]); setState({ loading: false, error: null }); return rec; }
      const { data, error } = await supabase.from('requisitions').insert(rec).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Requisition;
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { create, ...state };
}

export function useUpdateRequisitionStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const update = useCallback(async (id: string, status: RequisitionStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        write(REQ_KEY, read(REQ_KEY, MOCK_REQUISITIONS).map(r => r.id === id ? { ...r, status, updated_at: now } : r));
        setState({ loading: false, error: null }); return;
      }
      const { error } = await supabase.from('requisitions').update({ status, updated_at: now }).eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { update, ...state };
}

// ════════════════════════════ ÓRDENES DE COMPRA ════════════════════════════
export function usePurchaseOrders(): AsyncState<PurchaseOrder[]> {
  return useAsync<PurchaseOrder[]>(
    async () => {
      if (!supabase) return read<PurchaseOrder>(PO_KEY, []);
      const { data, error } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PurchaseOrder[];
    },
    [],
    []
  );
}

export function usePurchaseOrderItems(poId?: string): AsyncState<PurchaseOrderItem[]> {
  return useAsync<PurchaseOrderItem[]>(
    async () => {
      if (!poId) return [];
      if (!supabase) return read<PurchaseOrderItem>(POI_KEY, []).filter(i => i.purchase_order_id === poId);
      const { data, error } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', poId);
      if (error) throw error;
      return (data ?? []) as PurchaseOrderItem[];
    },
    [],
    [poId]
  );
}

export interface PoItemInput {
  description: string;
  quantity: number;
  uom?: string;
  unit_price: number;
  inventory_item_id?: string | null;
}
export interface PurchaseOrderInput {
  supplier_id: string;
  project_id?: string | null;
  currency?: string;
  expected_delivery?: string | null;
  notes?: string | null;
  items: PoItemInput[];
}

export function useCreatePurchaseOrder() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const create = useCallback(async (input: PurchaseOrderInput): Promise<PurchaseOrder> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const total = input.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const id = rid('PO');
      const po: PurchaseOrder = {
        id, supplier_id: input.supplier_id, project_id: input.project_id ?? null, status: 'Borrador',
        total_amount: total, currency: input.currency ?? 'MXN', issued_at: null,
        expected_delivery: input.expected_delivery ?? null, received_at: null, issued_by: null,
        notes: input.notes ?? null, created_at: now, updated_at: now,
      };
      const items: PurchaseOrderItem[] = input.items.map((it, i) => ({
        id: `poi-${Date.now().toString(36)}-${i}`, purchase_order_id: id, requisition_id: null, bom_item_id: null,
        inventory_item_id: it.inventory_item_id ?? null, description: it.description, quantity: it.quantity,
        uom: it.uom ?? 'Pzas', unit_price: it.unit_price, line_total: it.quantity * it.unit_price,
        received_qty: 0, created_at: now,
      }));
      if (!supabase) {
        write(PO_KEY, [po, ...read<PurchaseOrder>(PO_KEY, [])]);
        write(POI_KEY, [...items, ...read<PurchaseOrderItem>(POI_KEY, [])]);
        setState({ loading: false, error: null });
        return po;
      }
      const { error: e1 } = await supabase.from('purchase_orders').insert(po);
      if (e1) throw e1;
      // line_total es columna GENERATED en la BD: NO se inserta (la calcula sola).
      const { error: e2 } = await supabase.from('purchase_order_items').insert(
        items.map(({ id: _i, line_total: _lt, ...rest }) => rest)
      );
      if (e2) {
        // Evita dejar una OC huérfana (sin partidas) si fallan las partidas.
        await supabase.from('purchase_orders').delete().eq('id', id);
        throw e2;
      }
      setState({ loading: false, error: null });
      return po;
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { create, ...state };
}

export function useUpdatePoStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const update = useCallback(async (id: string, status: PoStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const patch: Partial<PurchaseOrder> = { status, updated_at: now };
      if (status === 'Emitida') patch.issued_at = now;
      if (!supabase) {
        write(PO_KEY, read<PurchaseOrder>(PO_KEY, []).map(p => p.id === id ? { ...p, ...patch } : p));
        setState({ loading: false, error: null }); return;
      }
      const { error } = await supabase.from('purchase_orders').update(patch).eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { update, ...state };
}

/** Elimina una OC y sus partidas. */
export function useDeletePurchaseOrder() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const remove = useCallback(async (poId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        write(POI_KEY, read<PurchaseOrderItem>(POI_KEY, []).filter(i => i.purchase_order_id !== poId));
        write(PO_KEY, read<PurchaseOrder>(PO_KEY, []).filter(p => p.id !== poId));
        setState({ loading: false, error: null });
        return;
      }
      // Borra partidas primero por si la FK no tiene ON DELETE CASCADE.
      await supabase.from('purchase_order_items').delete().eq('purchase_order_id', poId);
      const { error } = await supabase.from('purchase_orders').delete().eq('id', poId);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { remove, ...state };
}

/** Recibe una OC: marca recibida, fija received_qty y SUMA al inventario. */
export function useReceivePurchaseOrder() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const receive = useCallback(async (poId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      // 1. Lee las partidas de la OC.
      let items: PurchaseOrderItem[];
      if (!supabase) {
        items = read<PurchaseOrderItem>(POI_KEY, []).filter(i => i.purchase_order_id === poId);
      } else {
        const { data, error } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', poId);
        if (error) throw error;
        items = (data ?? []) as PurchaseOrderItem[];
      }
      // 2. Suma al inventario lo que esté ligado a un producto.
      for (const it of items) {
        const pending = it.quantity - (it.received_qty ?? 0);
        if (it.inventory_item_id && pending > 0) {
          await applyInventoryMovement(it.inventory_item_id, 'entrada', pending, 'Recepción OC', poId);
        }
      }
      // 3. Marca recibido (received_qty = quantity) + estatus.
      if (!supabase) {
        write(POI_KEY, read<PurchaseOrderItem>(POI_KEY, []).map(i => i.purchase_order_id === poId ? { ...i, received_qty: i.quantity } : i));
        write(PO_KEY, read<PurchaseOrder>(PO_KEY, []).map(p => p.id === poId ? { ...p, status: 'Recibida', received_at: now, updated_at: now } : p));
      } else {
        for (const it of items) {
          await supabase.from('purchase_order_items').update({ received_qty: it.quantity }).eq('id', it.id);
        }
        const { error } = await supabase.from('purchase_orders').update({ status: 'Recibida', received_at: now, updated_at: now }).eq('id', poId);
        if (error) throw error;
      }
      setState({ loading: false, error: null });
    } catch (err) { const e = err as Error; setState({ loading: false, error: e }); throw e; }
  }, []);
  return { receive, ...state };
}
