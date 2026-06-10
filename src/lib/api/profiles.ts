import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_PROFILES } from './mocks';
import type { Profile, ProfileMetadata } from '@/types/database';
import type { AsyncState, MutationState } from './types';

export function useProfiles(department?: string): AsyncState<Profile[]> {
  return useAsync<Profile[]>(
    async () => {
      if (!supabase) {
        return department ? MOCK_PROFILES.filter(p => p.department === department) : MOCK_PROFILES;
      }
      let query = supabase.from('profiles').select('*').order('full_name');
      if (department) query = query.eq('department', department);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    department ? MOCK_PROFILES.filter(p => p.department === department) : MOCK_PROFILES,
    [department]
  );
}

export function useProfile(id: string | undefined): AsyncState<Profile | null> {
  return useAsync<Profile | null>(
    async () => {
      if (!id) return null;
      if (!supabase) return MOCK_PROFILES.find(p => p.id === id) ?? null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
    null,
    [id]
  );
}

export interface UpdateProfileInput {
  full_name?: string;
  email?: string;
  role?: string;
  department?: string;
  phone?: string | null;
  status?: string;
  bio?: string | null;
  salary?: number;
  metadata?: ProfileMetadata;
}

/**
 * Actualiza un perfil. Sólo los administradores pueden hacerlo (gated por
 * RLS en Supabase via is_admin()). Detecta bloqueos silenciosos con
 * .select('id') para lanzar un error visible en lugar de fingir éxito.
 */
export function useUpdateProfile() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (id: string, input: UpdateProfileInput): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          'No se actualizó el perfil. Sólo los administradores pueden editar la información ' +
            'del personal. Verifica que tu profiles.role sea "Administrador" en Supabase.'
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
