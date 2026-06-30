import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { CompanySettings } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_KEY = 'koji_company_settings';

/** Empresa por defecto (mientras no haya configuración guardada). */
export const DEFAULT_COMPANY: CompanySettings = {
  id: 'default',
  legal_name: 'KANRI',
  commercial_name: 'KANRI',
  tagline: 'powered by KANRI',
  rfc: null,
  tax_regime: null,
  address_street: null,
  address_ext: null,
  address_int: null,
  address_neighborhood: null,
  address_zip: null,
  address_city: null,
  address_state: null,
  address_country: 'México',
  phone: null,
  email: null,
  website: null,
  legal_rep: null,
  logo_url: null,
  primary_color: '#E2401F',
  currency: 'MXN',
  bank_name: null,
  bank_account: null,
  bank_clabe: null,
  bank_beneficiary: null,
  payment_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function readDemo(): CompanySettings | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as CompanySettings) : null;
  } catch {
    return null;
  }
}

function writeDemo(c: CompanySettings): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

/**
 * Carga la configuración de la empresa. Resiliente: si la tabla aún no existe
 * o la consulta falla, cae al valor de localStorage y, en última instancia,
 * al default — para que la marca de la app nunca quede vacía.
 */
export function useCompanySettings(): AsyncState<CompanySettings> {
  return useAsync<CompanySettings>(
    async () => {
      if (!supabase) {
        return readDemo() ?? DEFAULT_COMPANY;
      }
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1);
        if (error) throw error;
        const row = (data ?? [])[0] as CompanySettings | undefined;
        if (row) {
          writeDemo(row); // cache local para login/offline
          return row;
        }
        // Con backend real la RLS ya filtra por empresa: si esta empresa aún no
        // configuró su marca, usamos el DEFAULT (el branding cae al nombre del
        // tenant). NO usamos el cache local para no mostrar la marca de otra
        // empresa que se haya visto antes en este navegador.
        return DEFAULT_COMPANY;
      } catch {
        // Tabla inexistente o sin permisos → no rompemos la app
        return DEFAULT_COMPANY;
      }
    },
    DEFAULT_COMPANY,
    []
  );
}

export interface CompanySettingsInput {
  legal_name?: string;
  commercial_name?: string;
  tagline?: string | null;
  rfc?: string | null;
  tax_regime?: string | null;
  address_street?: string | null;
  address_ext?: string | null;
  address_int?: string | null;
  address_neighborhood?: string | null;
  address_zip?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  legal_rep?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  currency?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_clabe?: string | null;
  bank_beneficiary?: string | null;
  payment_notes?: string | null;
}

/**
 * Guarda la configuración. Upsert sobre el registro existente (o lo crea).
 * Siempre actualiza el cache local para que la UI reaccione al instante.
 */
export function useUpdateCompanySettings() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(
    async (current: CompanySettings, patch: CompanySettingsInput): Promise<CompanySettings> => {
      setState({ loading: true, error: null });
      try {
        const merged: CompanySettings = {
          ...current,
          ...patch,
          updated_at: new Date().toISOString(),
        };
        // Cache local siempre (la UI/branding reacciona al toque, incl. demo)
        writeDemo(merged);

        if (!supabase) {
          setState({ loading: false, error: null });
          return merged;
        }

        // Si el registro ya existe en la base (id real), update; si no, insert.
        if (current.id && current.id !== 'default') {
          let { data, error } = await supabase
            .from('company_settings')
            .update({ ...patch, updated_at: merged.updated_at })
            .eq('id', current.id)
            .select('*');
          // Resiliencia: si aún no se corrió la migración de datos bancarios,
          // reintenta sin esas columnas para no bloquear el guardado.
          if (error && /bank_|payment_notes/i.test(error.message)) {
            const { bank_name: _b, bank_account: _a, bank_clabe: _c2, bank_beneficiary: _be, payment_notes: _p, ...rest } = patch;
            ({ data, error } = await supabase
              .from('company_settings')
              .update({ ...rest, updated_at: merged.updated_at })
              .eq('id', current.id)
              .select('*'));
          }
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(
              'No se guardó la configuración. Verifica que tu profiles.role sea "Administrador".'
            );
          }
          const row = data[0] as CompanySettings;
          writeDemo(row);
          setState({ loading: false, error: null });
          return row;
        } else {
          const { id: _omit, created_at: _c, ...insertable } = merged;
          void _omit;
          void _c;
          const { data, error } = await supabase
            .from('company_settings')
            .insert(insertable)
            .select('*')
            .single();
          if (error) {
            const m = (error.message || '').toLowerCase();
            if (m.includes('does not exist') || m.includes('relation')) {
              throw new Error(
                'La tabla company_settings no existe en Supabase. Re-corre database_schema.sql ' +
                  '(se guardó localmente mientras tanto).'
              );
            }
            throw error;
          }
          const row = data as CompanySettings;
          writeDemo(row);
          setState({ loading: false, error: null });
          return row;
        }
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );

  return { update, ...state };
}
