import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * `true` cuando hay credenciales válidas de Supabase en el entorno.
 * Toda la capa de datos consulta este flag para decidir entre Supabase
 * real y los datos mock de demostración.
 */
export const isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http')
);

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
