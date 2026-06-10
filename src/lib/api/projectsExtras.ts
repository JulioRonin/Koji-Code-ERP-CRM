import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { AsyncState } from './types';

/**
 * Devuelve el set de project_ids que tienen al menos un master plan activo.
 * Útil para que PMO marque proyectos sin plan formal.
 */
export function useProjectsMasterPlanStatus(): AsyncState<Set<string>> {
  return useAsync<Set<string>>(
    async () => {
      if (!supabase) {
        try {
          const raw = localStorage.getItem('koji_demo_master_plans');
          const plans: { project_id: string; status: string }[] = raw ? JSON.parse(raw) : [];
          return new Set(plans.filter(p => p.status === 'Activo').map(p => p.project_id));
        } catch {
          return new Set();
        }
      }
      const { data, error } = await supabase
        .from('master_plans')
        .select('project_id')
        .eq('status', 'Activo');
      if (error) throw error;
      return new Set(((data ?? []) as { project_id: string }[]).map(r => r.project_id));
    },
    new Set(),
    []
  );
}
