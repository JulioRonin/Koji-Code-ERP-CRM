import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type {
  Shipment,
  ShippingLabel,
  ShippingLabelItem,
  ShipmentStatus,
} from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_SHIPMENTS_KEY = 'koji_demo_shipments';
const DEMO_LABELS_KEY = 'koji_demo_shipping_labels';
const DEMO_LABEL_ITEMS_KEY = 'koji_demo_shipping_label_items';

function readDemo<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeDemo<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/**
 * Lista embarques. Opcionalmente filtra por proyecto.
 */
export function useShipments(projectId?: string): AsyncState<Shipment[]> {
  return useAsync<Shipment[]>(
    async () => {
      if (!supabase) {
        const all = readDemo<Shipment>(DEMO_SHIPMENTS_KEY);
        return projectId ? all.filter(s => s.project_id === projectId) : all;
      }
      let query = supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Shipment[];
    },
    [],
    [projectId]
  );
}

interface CreateShipmentInput {
  project_id: string;
  carrier?: string;
  ship_to_address?: string;
  notes?: string;
}

export function useCreateShipment() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateShipmentInput): Promise<Shipment> => {
    setState({ loading: true, error: null });
    try {
      const year = new Date().getFullYear();
      const id = `SHIP-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
      const now = new Date().toISOString();

      const draft: Shipment = {
        id,
        project_id: input.project_id,
        status: 'Preparando',
        carrier: input.carrier ?? null,
        tracking_number: null,
        shipped_at: null,
        delivered_at: null,
        ship_to_address: input.ship_to_address ?? null,
        packing_list_url: null,
        notes: input.notes ?? null,
        created_by: null,
        created_at: now,
        updated_at: now,
      };

      if (!supabase) {
        const existing = readDemo<Shipment>(DEMO_SHIPMENTS_KEY);
        writeDemo(DEMO_SHIPMENTS_KEY, [draft, ...existing]);
        setState({ loading: false, error: null });
        return draft;
      }

      const { data, error } = await supabase.from('shipments').insert(draft).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Shipment;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { create, ...state };
}

/**
 * Actualiza el estatus de un embarque (con fecha automática al enviar).
 */
export function useUpdateShipmentStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (id: string, status: ShipmentStatus, tracking?: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const patch: Partial<Shipment> = {
        status,
        updated_at: now,
      };
      if (status === 'En Tránsito') patch.shipped_at = now;
      if (status === 'Entregado') patch.delivered_at = now;
      if (tracking) patch.tracking_number = tracking;

      if (!supabase) {
        const all = readDemo<Shipment>(DEMO_SHIPMENTS_KEY);
        const idx = all.findIndex(s => s.id === id);
        if (idx >= 0) {
          all[idx] = { ...all[idx], ...patch } as Shipment;
          writeDemo(DEMO_SHIPMENTS_KEY, all);
        }
        setState({ loading: false, error: null });
        return;
      }

      const { error } = await supabase.from('shipments').update(patch).eq('id', id);
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
 * Lista etiquetas (cajas) de un embarque.
 */
export function useShippingLabels(shipmentId: string | undefined): AsyncState<ShippingLabel[]> {
  return useAsync<ShippingLabel[]>(
    async () => {
      if (!shipmentId) return [];
      if (!supabase) {
        const all = readDemo<ShippingLabel>(DEMO_LABELS_KEY);
        return all.filter(l => l.shipment_id === shipmentId);
      }
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('box_number');
      if (error) throw error;
      return (data ?? []) as ShippingLabel[];
    },
    [],
    [shipmentId]
  );
}

interface CreateLabelInput {
  shipment_id: string;
  box_number: string;
  weight_kg?: number;
  dimensions_cm?: string;
  items: { description: string; quantity: number; uom?: string; bom_item_id?: string | null }[];
}

export function useCreateShippingLabel() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateLabelInput): Promise<ShippingLabel> => {
    setState({ loading: true, error: null });
    try {
      const id = (crypto?.randomUUID && crypto.randomUUID()) || `label-${Date.now()}`;
      const qr_token = (crypto?.randomUUID && crypto.randomUUID().replace(/-/g, '')) || String(Date.now());
      const now = new Date().toISOString();

      const label: ShippingLabel = {
        id,
        shipment_id: input.shipment_id,
        box_number: input.box_number,
        weight_kg: input.weight_kg ?? null,
        dimensions_cm: input.dimensions_cm ?? null,
        qr_token,
        label_pdf_url: null,
        printed_at: null,
        created_at: now,
      };

      const items: ShippingLabelItem[] = input.items.map((it, i) => ({
        id: (crypto?.randomUUID && crypto.randomUUID()) || `lbl-item-${Date.now()}-${i}`,
        label_id: id,
        bom_item_id: it.bom_item_id ?? null,
        description: it.description,
        quantity: it.quantity,
        uom: it.uom ?? 'Pzas',
        created_at: now,
      }));

      if (!supabase) {
        const labels = readDemo<ShippingLabel>(DEMO_LABELS_KEY);
        writeDemo(DEMO_LABELS_KEY, [...labels, label]);
        const allItems = readDemo<ShippingLabelItem>(DEMO_LABEL_ITEMS_KEY);
        writeDemo(DEMO_LABEL_ITEMS_KEY, [...allItems, ...items]);
        setState({ loading: false, error: null });
        return label;
      }

      const { data: row, error } = await supabase
        .from('shipping_labels')
        .insert(label)
        .select('*')
        .single();
      if (error) throw error;
      if (items.length > 0) {
        await supabase.from('shipping_label_items').insert(items);
      }
      setState({ loading: false, error: null });
      return row as ShippingLabel;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { create, ...state };
}

/**
 * Lista los items dentro de una etiqueta.
 */
export function useShippingLabelItems(labelId: string | undefined): AsyncState<ShippingLabelItem[]> {
  return useAsync<ShippingLabelItem[]>(
    async () => {
      if (!labelId) return [];
      if (!supabase) {
        const all = readDemo<ShippingLabelItem>(DEMO_LABEL_ITEMS_KEY);
        return all.filter(i => i.label_id === labelId);
      }
      const { data, error } = await supabase
        .from('shipping_label_items')
        .select('*')
        .eq('label_id', labelId);
      if (error) throw error;
      return (data ?? []) as ShippingLabelItem[];
    },
    [],
    [labelId]
  );
}
