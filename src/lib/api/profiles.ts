import { useCallback, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_PROFILES } from './mocks';
import type { Profile, ProfileMetadata } from '@/types/database';
import type { AsyncState, MutationState } from './types';

/** Genera una contraseña temporal legible-pero-segura para nuevos usuarios.
 *  Combina dos palabras + 4 dígitos + un símbolo. Cumple los mínimos típicos
 *  (≥10 caracteres, mayúscula, minúscula, número, símbolo). */
export function generateTempPassword(): string {
  const words = [
    'koji', 'metal', 'acero', 'taller', 'cnc', 'piezas', 'planta', 'forja',
    'laser', 'molde', 'fixture', 'control', 'turno', 'gauge', 'soldar',
  ];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = String(Math.floor(1000 + Math.random() * 9000));
  const sym = '!@#$%&*'[Math.floor(Math.random() * 7)];
  return `${w1.charAt(0).toUpperCase() + w1.slice(1)}-${w2}${num}${sym}`;
}

/**
 * Lista perfiles. Acepta un filtro por role o department.
 * Por compatibilidad histórica, pasar un string se interpreta como rol
 * (caso de uso típico: useProfiles('Técnico')).
 */
export function useProfiles(
  filter?: string | { role?: string; department?: string }
): AsyncState<Profile[]> {
  const role = typeof filter === 'string' ? filter : filter?.role;
  const department = typeof filter === 'string' ? undefined : filter?.department;
  return useAsync<Profile[]>(
    async () => {
      const matchMock = (p: Profile) =>
        (!role || p.role === role) && (!department || p.department === department);
      if (!supabase) return MOCK_PROFILES.filter(matchMock);
      let query = supabase.from('profiles').select('*').order('full_name');
      if (role) query = query.eq('role', role);
      if (department) query = query.eq('department', department);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    MOCK_PROFILES.filter(p => (!role || p.role === role) && (!department || p.department === department)),
    [role, department]
  );
}

/**
 * Lista cualquier perfil con rol que sea "Técnico" o derivados ("Técnico
 * Senior", "Técnico de Calidad", "Técnico Especialista"). Se usa en los
 * dropdowns de asignación de plan de producción y work orders.
 */
export function useTechnicians(): AsyncState<Profile[]> {
  return useAsync<Profile[]>(
    async () => {
      const matchesTech = (p: Profile) =>
        (p.role ?? '').toLowerCase().startsWith('técnico') ||
        (p.role ?? '').toLowerCase().startsWith('tecnico');
      if (!supabase) return MOCK_PROFILES.filter(matchesTech);
      // En Supabase usamos ILIKE para captar las variantes en una sola
      // query, sin asumir mayúsculas o acentos exactos.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('role.ilike.Técnico%,role.ilike.Tecnico%')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    MOCK_PROFILES.filter(
      p =>
        (p.role ?? '').toLowerCase().startsWith('técnico') ||
        (p.role ?? '').toLowerCase().startsWith('tecnico')
    ),
    []
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

export interface CreateStaffInput {
  full_name: string;
  email: string;
  password: string;
  role: string;
  department: string;
  phone?: string | null;
  salary?: number;
}

/**
 * Crea un colaborador con cuenta de Supabase Auth + fila en profiles.
 *
 * Usa un cliente Supabase EFÍMERO para que la llamada a signUp no toque
 * la sesión del admin que está dando de alta. El trigger handle_new_user
 * crea automáticamente la fila en profiles con los datos básicos, así
 * que después hacemos un UPDATE para completar role/department/salary.
 *
 * Nota: si en Supabase tienes "Confirm email" activado en Auth Settings,
 * el usuario nuevo no podrá hacer login hasta confirmar su correo. Para
 * un onboarding interno típicamente se desactiva esa opción.
 */
export function useCreateStaffWithAuth() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(
    async (input: CreateStaffInput): Promise<{ userId: string }> => {
      setState({ loading: true, error: null });
      try {
        if (!supabase) {
          // Demo: simulamos éxito
          setState({ loading: false, error: null });
          return { userId: `demo-${Date.now()}` };
        }

        // Cliente temporal — sesión separada para no kickear al admin.
        const url = import.meta.env.VITE_SUPABASE_URL as string;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const tmp = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: signUpData, error: signUpErr } = await tmp.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: { full_name: input.full_name },
          },
        });
        if (signUpErr) {
          if ((signUpErr.message || '').toLowerCase().includes('already registered')) {
            throw new Error('Ese correo ya tiene cuenta en Supabase Auth.');
          }
          throw new Error(`Supabase Auth: ${signUpErr.message}`);
        }
        const userId = signUpData.user?.id;
        if (!userId) {
          throw new Error('Supabase Auth no devolvió un user id. Revisa la configuración.');
        }

        // El trigger handle_new_user creó la fila base; completamos los
        // campos administrativos. Usa el cliente principal (sesión del admin)
        // para que RLS valide is_admin().
        const { data, error } = await supabase
          .from('profiles')
          .update({
            full_name: input.full_name,
            role: input.role,
            department: input.department,
            phone: input.phone ?? null,
            salary: input.salary ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) {
          // El trigger pudo no haber corrido todavía (race), o RLS bloqueó.
          // Intentamos un INSERT como fallback.
          const { error: insErr } = await supabase.from('profiles').insert({
            id: userId,
            full_name: input.full_name,
            email: input.email,
            role: input.role,
            department: input.department,
            phone: input.phone ?? null,
            salary: input.salary ?? 0,
            status: 'Activo',
            join_date: new Date().toISOString().slice(0, 10),
            metadata: {},
          });
          if (insErr) {
            throw new Error(
              'El usuario de Auth se creó pero no se pudo guardar el perfil. ' +
                'Verifica que tu profiles.role sea "Administrador" en Supabase. ' +
                'Detalle: ' + insErr.message
            );
          }
        }

        // Cierra la sesión del cliente temporal para no dejar tokens colgando.
        await tmp.auth.signOut();

        setState({ loading: false, error: null });
        return { userId };
      } catch (err) {
        const error = err as Error;
        setState({ loading: false, error });
        throw error;
      }
    },
    []
  );

  return { create, ...state };
}
