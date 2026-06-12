import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncState } from './types';

/**
 * Hook genérico para queries asíncronas. Maneja loading/error y permite
 * re-fetch manual.
 *
 * Defensiva contra "datos que desaparecen": si en una sesión ya tuvimos
 * un fetch exitoso con datos reales y luego una respuesta posterior
 * devuelve vacío para el MISMO contexto (mismas deps), preservamos los
 * datos anteriores en lugar de clobberlos. Esto evita que cambios
 * transitorios de Supabase (timeout, reconexión, RLS desincronizado)
 * borren la UI.
 *
 * IMPORTANTE: el "anchor" sólo cuenta datos venidos de una llamada a
 * fetch REAL, NUNCA los initialData (que típicamente son mocks de seed).
 * Si la tabla en Supabase está legítimamente vacía, ese array vacío
 * sí se respeta porque no había un fetch previo con datos.
 *
 * Cuando las deps cambian (ej. el usuario eligió otro proyecto), se
 * resetea el anchor para no mezclar contextos.
 */
export function useAsync<T>(fn: () => Promise<T>, initialData: T, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  // null = todavía no hay un fetch previo con datos reales para este contexto
  const lastRealNonEmptyRef = useRef<T | null>(null);
  const prevDepsRef = useRef<unknown[]>(deps);

  // Si las deps cambiaron desde el render anterior, perdemos el "anchor"
  // de datos previos (es otro contexto).
  if (!shallowEqualArrays(prevDepsRef.current, deps)) {
    prevDepsRef.current = deps;
    lastRealNonEmptyRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (mountedRef.current) {
        const resultIsEmptyArray = Array.isArray(result) && result.length === 0;
        const anchorHadRealData =
          lastRealNonEmptyRef.current != null &&
          Array.isArray(lastRealNonEmptyRef.current) &&
          (lastRealNonEmptyRef.current as unknown[]).length > 0;

        if (resultIsEmptyArray && anchorHadRealData) {
          // Resultado vacío inesperado tras haber tenido datos reales:
          // conservamos los datos previos y dejamos un error suave para
          // que el UI muestre un aviso.
          setError(
            new Error(
              'La consulta regresó vacía pero ya teníamos datos. Conservando lo anterior — usa Refrescar.'
            )
          );
        } else {
          if (Array.isArray(result) && result.length > 0) {
            lastRealNonEmptyRef.current = result as T;
          }
          setData(result);
        }
      }
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

function shallowEqualArrays(a: unknown[], b: unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}
