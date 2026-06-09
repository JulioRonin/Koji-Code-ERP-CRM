import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_PROFILES } from './mocks';
import type { Profile } from '@/types/database';
import type { AsyncState } from './types';

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
