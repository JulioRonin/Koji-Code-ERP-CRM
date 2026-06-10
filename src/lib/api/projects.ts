import { useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_PROJECTS } from './mocks';
import type { Project, ProjectStatus } from '@/types/database';
import type { AsyncState, MutationState } from './types';

/**
 * Lista todos los proyectos ordenados por fecha de actualización desc.
 */
export function useProjects(): AsyncState<Project[]> {
  return useAsync<Project[]>(
    async () => {
      if (!supabase) return MOCK_PROJECTS;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
    MOCK_PROJECTS,
    [isSupabaseConfigured]
  );
}

/**
 * Obtiene un proyecto puntual por su ID.
 */
export function useProject(id: string | undefined): AsyncState<Project | null> {
  return useAsync<Project | null>(
    async () => {
      if (!id) return null;
      if (!supabase) return MOCK_PROJECTS.find(p => p.id === id) ?? null;
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as Project) ?? null;
    },
    null,
    [id]
  );
}

interface CreateProjectInput {
  name: string;
  client_name: string;
  customer_id?: string | null;
  manager_id?: string | null;
  description?: string | null;
  start_date: string;
  deadline: string;
}

/**
 * Crea un nuevo proyecto. Genera el ID con prefijo IMC-AAAA-NNN.
 * En modo demo solo simula y devuelve el objeto.
 */
export function useCreateProject() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateProjectInput): Promise<Project> => {
    setState({ loading: true, error: null });
    try {
      const year = new Date().getFullYear();
      const id = `IMC-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
      const now = new Date().toISOString();

      const draft: Project = {
        id,
        name: input.name,
        customer_id: input.customer_id ?? null,
        client_name: input.client_name,
        status: 'Cotización',
        progress: 0,
        purchase_order: null,
        quote_amount: null,
        currency: 'MXN',
        start_date: input.start_date,
        deadline: input.deadline,
        delivered_at: null,
        manager_id: input.manager_id ?? null,
        description: input.description ?? null,
        client_portal_token: null,
        client_portal_expires: null,
        created_at: now,
        updated_at: now,
      };

      if (!supabase) {
        setState({ loading: false, error: null });
        return draft;
      }

      const { data, error } = await supabase.from('projects').insert(draft).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as Project;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { create, ...state };
}

/**
 * Cambia el estado de un proyecto.
 */
export function useUpdateProjectStatus() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (projectId: string, status: ProjectStatus): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { data, error } = await supabase
        .from('projects')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select('id');
      if (error) throw error;
      // RLS-silent: si la política bloquea, no hay error pero data es []
      if (!data || data.length === 0) {
        throw new Error(
          'No se actualizó ningún registro. Probablemente tu perfil no tiene permisos. ' +
            'Verifica que profiles.role sea "Administrador" o "Administración / PM" en Supabase.'
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

/**
 * Elimina un proyecto. Por las FK con ON DELETE CASCADE, se borran también
 * sus BOMs, work orders, inspecciones, NCRs, archivos, master plan, etc.
 */
export function useDeleteProject() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (projectId: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        setState({ loading: false, error: null });
        return;
      }
      const { error, count } = await supabase
        .from('projects')
        .delete({ count: 'exact' })
        .eq('id', projectId);
      if (error) throw error;
      if (count === 0) {
        throw new Error(
          'No se eliminó el proyecto. Probablemente tu perfil no tiene permisos. ' +
            'Verifica que profiles.role sea "Administrador" en Supabase.'
        );
      }
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { remove, ...state };
}
