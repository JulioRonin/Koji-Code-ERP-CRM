import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Credenciales de Supabase presentes en el entorno. */
const ENV_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'));

/** Llave del "modo demo" que activa el usuario maestro desde el menú de cuenta. */
export const DEMO_MODE_KEY = 'kanri_demo_mode';

/**
 * Sesión de demostración: el usuario maestro activó "Explorar demo". La app usa
 * datos de ejemplo locales (no toca la base real) hasta que sale de la demo.
 */
export const isDemoSession: boolean = (() => {
  if (!ENV_CONFIGURED) return false;
  try { return localStorage.getItem(DEMO_MODE_KEY) === '1'; } catch { return false; }
})();

/**
 * `true` cuando la app trabaja contra Supabase real. Toda la capa de datos
 * consulta este flag para decidir entre Supabase y los datos de demostración
 * (sin credenciales, o con la demo del usuario maestro activa).
 */
export const isSupabaseConfigured: boolean = ENV_CONFIGURED && !isDemoSession;

/**
 * Cliente Supabase. Si no hay credenciales, se exporta `null` y los hooks
 * de datos caen automáticamente a sus mocks de demo.
 *
 * Importante: nunca importes este cliente directamente desde un componente.
 * Pasa siempre por los hooks de `src/lib/api/*` que manejan el fallback
 * y devuelven tipos seguros.
 *
 * Nota: el cliente NO usa el genérico `<Database>` para evitar conflictos
 * de inferencia con `Insert`/`Update`. La capa de datos castea explícita
 * y devuelve los tipos correctos.
 */
export const supabase: SupabaseClient | null =
  isSupabaseConfigured
    ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/** URL pública del bucket de Storage para archivos del proyecto. */
export function getStorageUrl(bucket: string, path: string): string | null {
  if (!supabase) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
