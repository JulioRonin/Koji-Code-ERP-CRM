import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { MaterialPrice, Quote, QuoteItem, QuoteStatus } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_PRICES_KEY = 'koji_demo_material_prices';
const DEMO_QUOTES_KEY = 'koji_demo_quotes';
const DEMO_QUOTE_ITEMS_KEY = 'koji_demo_quote_items';

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

function newId(prefix: string): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Precios demo iniciales para que el módulo no arranque vacío
const SEED_PRICES: MaterialPrice[] = [
  { id: 'mp-seed-1', material: 'Acero 4140',     description: 'Barra redonda 2"',   uom: 'kg',  unit_price: 48,   currency: 'MXN', supplier_id: null, supplier_name: 'Aceros del Norte',      valid_until: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mp-seed-2', material: 'Aluminio 6061-T6', description: 'Placa 1"',          uom: 'kg',  unit_price: 95,   currency: 'MXN', supplier_id: null, supplier_name: 'Aceros del Norte',      valid_until: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mp-seed-3', material: 'Acero inoxidable 304', description: 'Barra redonda', uom: 'kg', unit_price: 120,  currency: 'MXN', supplier_id: null, supplier_name: 'Carburos Industriales', valid_until: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mp-seed-4', material: 'Bronce SAE 660',  description: 'Barra hueca',        uom: 'kg',  unit_price: 210,  currency: 'MXN', supplier_id: null, supplier_name: 'Carburos Industriales', valid_until: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'mp-seed-5', material: 'Nylamid',          description: 'Barra 3"',           uom: 'kg',  unit_price: 160,  currency: 'MXN', supplier_id: null, supplier_name: 'Tornillería Express',   valid_until: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

function readDemoPrices(): MaterialPrice[] {
  const existing = readDemo<MaterialPrice>(DEMO_PRICES_KEY);
  if (existing.length === 0) {
    writeDemo(DEMO_PRICES_KEY, SEED_PRICES);
    return SEED_PRICES;
  }
  return existing;
}

// ============================================================================
// CÁLCULO — única fuente de la verdad para la fórmula de cotización
// ============================================================================

export interface QuoteItemCostInput {
  material_qty: number;
  material_unit_cost: number;
  machining_hours: number;
  machine_rate: number;
  extra_cost: number;
  margin_pct: number;
  quantity: number;
}

export function computeQuoteItem(input: QuoteItemCostInput): {
  materialCost: number;
  machiningCost: number;
  baseCost: number;
  unitPrice: number;
  lineTotal: number;
} {
  const materialCost = input.material_qty * input.material_unit_cost;
  const machiningCost = input.machining_hours * input.machine_rate;
  const baseCost = materialCost + machiningCost + input.extra_cost;
  const unitPrice = baseCost * (1 + input.margin_pct / 100);
  const lineTotal = unitPrice * input.quantity;
  return { materialCost, machiningCost, baseCost, unitPrice, lineTotal };
}

export function computeQuoteTotals(items: QuoteItem[], taxPct: number): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = items.reduce((acc, it) => acc + (it.line_total || 0), 0);
  const tax = subtotal * (taxPct / 100);
  return { subtotal, tax, total: subtotal + tax };
}

// ============================================================================
// CATÁLOGO DE PRECIOS DE MATERIALES
// ============================================================================

export function useMaterialPrices(): AsyncState<MaterialPrice[]> {
  return useAsync<MaterialPrice[]>(
    async () => {
      if (!supabase) return readDemoPrices();
      const { data, error } = await supabase
        .from('material_prices')
        .select('*')
        .order('material');
      if (error) throw error;
      return (data ?? []) as MaterialPrice[];
    },
    [],
    []
  );
}

export interface MaterialPriceInput {
  material: string;
  description?: string | null;
  uom: string;
  unit_price: number;
  supplier_name?: string | null;
  valid_until?: string | null;
}

export function useUpsertMaterialPrice() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const upsert = useCallback(async (input: MaterialPriceInput, id?: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        const all = readDemoPrices();
        if (id) {
          const idx = all.findIndex(p => p.id === id);
          if (idx >= 0) all[idx] = { ...all[idx], ...input, updated_at: now } as MaterialPrice;
        } else {
          all.unshift({
            id: newId('mp'),
            material: input.material,
            description: input.description ?? null,
            uom: input.uom,
            unit_price: input.unit_price,
            currency: 'MXN',
            supplier_id: null,
            supplier_name: input.supplier_name ?? null,
            valid_until: input.valid_until ?? null,
            notes: null,
            created_at: now,
            updated_at: now,
          });
        }
        writeDemo(DEMO_PRICES_KEY, all);
        setState({ loading: false, error: null });
        return;
      }

      if (id) {
        const { error } = await supabase
          .from('material_prices')
          .update({ ...input, updated_at: now })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('material_prices').insert(input);
        if (error) throw error;
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { upsert, ...state };
}

export function useDeleteMaterialPrice() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        writeDemo(DEMO_PRICES_KEY, readDemoPrices().filter(p => p.id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('material_prices').delete().eq('id', id);
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

/**
 * Importa precios desde filas de Excel ya parseadas.
 * Columnas esperadas (flexibles): Material, Descripcion/Description,
 * UOM/Unidad, Precio/Price/Unit Price, Proveedor/Supplier.
 */
export function useBulkImportMaterialPrices() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const importRows = useCallback(async (rows: Record<string, unknown>[]): Promise<number> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const parsed: MaterialPriceInput[] = rows
        .map(row => ({
          material: String(row.Material ?? row.material ?? '').trim(),
          description: String(row.Descripcion ?? row['Descripción'] ?? row.Description ?? '') || null,
          uom: String(row.UOM ?? row.Unidad ?? row.uom ?? 'kg'),
          unit_price: Number(row.Precio ?? row.Price ?? row['Unit Price'] ?? row.precio ?? 0),
          supplier_name: String(row.Proveedor ?? row.Supplier ?? '') || null,
        }))
        .filter(p => p.material && p.unit_price > 0);

      if (parsed.length === 0) {
        throw new Error('No se encontraron filas válidas. Verifica las columnas: Material, Precio, UOM, Proveedor.');
      }

      if (!supabase) {
        const all = readDemoPrices();
        const added: MaterialPrice[] = parsed.map(p => ({
          id: newId('mp'),
          material: p.material,
          description: p.description ?? null,
          uom: p.uom,
          unit_price: p.unit_price,
          currency: 'MXN',
          supplier_id: null,
          supplier_name: p.supplier_name ?? null,
          valid_until: null,
          notes: null,
          created_at: now,
          updated_at: now,
        }));
        writeDemo(DEMO_PRICES_KEY, [...added, ...all]);
        setState({ loading: false, error: null });
        return added.length;
      }

      const { error } = await supabase.from('material_prices').insert(parsed);
      if (error) throw error;
      setState({ loading: false, error: null });
      return parsed.length;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { importRows, ...state };
}

// ============================================================================
// QUOTES
// ============================================================================

export function useQuotes(): AsyncState<Quote[]> {
  return useAsync<Quote[]>(
    async () => {
      if (!supabase) {
        return readDemo<Quote>(DEMO_QUOTES_KEY).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Quote[];
    },
    [],
    []
  );
}

export function useQuote(id: string | undefined): AsyncState<Quote | null> {
  return useAsync<Quote | null>(
    async () => {
      if (!id) return null;
      if (!supabase) return readDemo<Quote>(DEMO_QUOTES_KEY).find(q => q.id === id) ?? null;
      const { data, error } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as Quote) ?? null;
    },
    null,
    [id]
  );
}

export function useQuoteItems(quoteId: string | undefined): AsyncState<QuoteItem[]> {
  return useAsync<QuoteItem[]>(
    async () => {
      if (!quoteId) return [];
      if (!supabase) {
        return readDemo<QuoteItem>(DEMO_QUOTE_ITEMS_KEY)
          .filter(i => i.quote_id === quoteId)
          .sort((a, b) => a.sort_order - b.sort_order);
      }
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as QuoteItem[];
    },
    [],
    [quoteId]
  );
}

interface CreateQuoteInput {
  client_name: string;
  project_name: string;
  margin_pct?: number;
  machine_rate_per_hour?: number;
  valid_until?: string | null;
  notes?: string | null;
}

export function useCreateQuote() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateQuoteInput): Promise<Quote> => {
    setState({ loading: true, error: null });
    try {
      const year = new Date().getFullYear();
      const id = `COT-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
      const now = new Date().toISOString();

      const draft: Quote = {
        id,
        customer_id: null,
        client_name: input.client_name,
        project_name: input.project_name,
        status: 'Borrador',
        currency: 'MXN',
        margin_pct: input.margin_pct ?? 30,
        tax_pct: 16,
        machine_rate_per_hour: input.machine_rate_per_hour ?? 650,
        valid_until: input.valid_until ?? null,
        notes: input.notes ?? null,
        subtotal: 0,
        total: 0,
        converted_project_id: null,
        created_by: null,
        created_at: now,
        updated_at: now,
      };

      if (!supabase) {
        writeDemo(DEMO_QUOTES_KEY, [draft, ...readDemo<Quote>(DEMO_QUOTES_KEY)]);
        setState({ loading: false, error: null });
        return draft;
      }

      const { data, error } = await supabase.from('quotes').insert(draft).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Quote;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { create, ...state };
}

export function useUpdateQuote() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (id: string, patch: Partial<Quote>): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        const all = readDemo<Quote>(DEMO_QUOTES_KEY);
        const idx = all.findIndex(q => q.id === id);
        if (idx >= 0) {
          all[idx] = { ...all[idx], ...patch, updated_at: now };
          writeDemo(DEMO_QUOTES_KEY, all);
        }
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase
        .from('quotes')
        .update({ ...patch, updated_at: now })
        .eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { update, ...state };
}

/**
 * Reemplaza el set completo de items de una quote (patrón save-all del builder)
 * y actualiza subtotal/total en la quote.
 */
export function useSaveQuoteItems() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const save = useCallback(
    async (quoteId: string, items: Omit<QuoteItem, 'quote_id' | 'created_at'>[], taxPct: number): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        const now = new Date().toISOString();
        const rows: QuoteItem[] = items.map((it, i) => ({
          ...it,
          id: it.id || newId('qi'),
          quote_id: quoteId,
          sort_order: i,
          created_at: now,
        }));
        const { subtotal, total } = computeQuoteTotals(rows, taxPct);

        if (!supabase) {
          const others = readDemo<QuoteItem>(DEMO_QUOTE_ITEMS_KEY).filter(i => i.quote_id !== quoteId);
          writeDemo(DEMO_QUOTE_ITEMS_KEY, [...others, ...rows]);
          const quotes = readDemo<Quote>(DEMO_QUOTES_KEY);
          const idx = quotes.findIndex(q => q.id === quoteId);
          if (idx >= 0) {
            quotes[idx] = { ...quotes[idx], subtotal, total, updated_at: now };
            writeDemo(DEMO_QUOTES_KEY, quotes);
          }
          setState({ loading: false, error: null });
          return;
        }

        // Reemplazo completo: delete + insert (volumen pequeño por quote)
        const { error: delErr } = await supabase.from('quote_items').delete().eq('quote_id', quoteId);
        if (delErr) throw delErr;
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from('quote_items').insert(rows);
          if (insErr) throw insErr;
        }
        const { error: updErr } = await supabase
          .from('quotes')
          .update({ subtotal, total, updated_at: now })
          .eq('id', quoteId);
        if (updErr) throw updErr;

        setState({ loading: false, error: null });
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );

  return { save, ...state };
}

export function useUpdateQuoteStatus() {
  const { update, ...state } = useUpdateQuote();
  const updateStatus = useCallback(
    (id: string, status: QuoteStatus) => update(id, { status }),
    [update]
  );
  return { updateStatus, ...state };
}
