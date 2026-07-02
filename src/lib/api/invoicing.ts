import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';

export interface Invoice {
  id: string;
  tenant_id?: string | null;
  facturapi_id: string | null;
  folio: string | null;
  uuid: string | null;
  receptor_name: string | null;
  receptor_rfc: string | null;
  total: number;
  currency: string;
  status: string;
  pdf_url: string | null;
  xml_url: string | null;
  project_id: string | null;
  quote_id: string | null;
  created_at: string;
}

export interface FacturapiStatus {
  connected: boolean;
  facturapi_test: boolean;
}

/** Estatus de conexión con Facturapi de la empresa (sin exponer la llave). */
export function useFacturapiStatus(): AsyncState<FacturapiStatus> {
  return useAsync<FacturapiStatus>(
    async () => {
      if (!supabase) return { connected: false, facturapi_test: true };
      const { data } = await scopeByTenant(supabase.from('tenant_integrations').select('connected, facturapi_test'))
        .limit(1).maybeSingle();
      return { connected: !!data?.connected, facturapi_test: data?.facturapi_test ?? true };
    },
    { connected: false, facturapi_test: true },
    []
  );
}

export function useInvoices(): AsyncState<Invoice[]> {
  return useAsync<Invoice[]>(
    async () => {
      if (!supabase) return [];
      const { data, error } = await scopeByTenant(supabase.from('invoices').select('*'))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    [],
    []
  );
}

/** Conecta/valida la llave de Facturapi. */
export async function connectFacturapi(key: string, test: boolean): Promise<void> {
  if (!supabase) throw new Error('Requiere backend configurado.');
  const { data, error } = await supabase.functions.invoke('facturapi-connect', { body: { key, test } });
  if (error) throw new Error('No se pudo conectar (¿ya desplegaste la función facturapi-connect?).');
  if (data?.error) throw new Error(data.error as string);
}

export interface InvoiceItemInput { description: string; quantity: number; price: number; product_key?: string; unit_key?: string; }
export interface CreateInvoiceInput {
  receptor: { legal_name: string; tax_id: string; tax_system: string; zip: string; email?: string };
  items: InvoiceItemInput[];
  use?: string;
  payment_form?: string;
  payment_method?: string;
  project_id?: string | null;
  quote_id?: string | null;
}

export interface CreateInvoiceResult { id: string; uuid: string; folio: number; total: number; pdf: string; xml: string; }

export function useCreateInvoice() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const create = useCallback(async (input: CreateInvoiceInput): Promise<CreateInvoiceResult> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) throw new Error('Requiere backend configurado.');
      const { data, error } = await supabase.functions.invoke('facturapi-invoice', { body: input });
      if (error) throw new Error('No se pudo emitir la factura (¿desplegaste facturapi-invoice?).');
      if (data?.error) throw new Error(data.error as string);
      setState({ loading: false, error: null });
      return data as CreateInvoiceResult;
    } catch (e) {
      const err = e as Error; setState({ loading: false, error: err }); throw err;
    }
  }, []);
  return { create, ...state };
}
