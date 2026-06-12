import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncState } from './types';

/**
 * Hook genérico para queries asíncronas. Maneja loading/error y permite
 * re-fetch manual.
 *
 * Defensiva contra "datos que desaparecen": si la query devuelve un array
 * vacío pero en la sesión actual ya habíamos visto datos no vacíos
 * (mismas deps), preservamos los datos anteriores y emitimos un error
 * en lugar de clobberlos. Esto evita que cambios transitorios de Supabase
 * (timeout, reconexión, RLS desincronizado) borren la UI. Cuando las
 * deps cambian (ej. el usuario eligió otro proyecto), reseteamos el
 * "último visto" para no mezclar contextos.
 */
export function useAsync<T>(fn: () => Promise<T>, initialData: T, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const lastNonEmptyRef = useRef<T>(initialData);
  const prevDepsRef = useRef<unknown[]>(deps);

  // Si las deps cambiaron desde el render anterior, perdemos el "anchor"
  // de datos previos (es otro contexto).
  if (!shallowEqualArrays(prevDepsRef.current, deps)) {
    prevDepsRef.current = deps;
    lastNonEmptyRef.current = initialData;
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
        const anchorHadItems =
          Array.isArray(lastNonEmptyRef.current) && lastNonEmptyRef.current.length > 0;

        if (resultIsEmptyArray && anchorHadItems) {
          // Resultado vacío inesperado: conservamos los datos previos y
          // dejamos un error suave para que el UI muestre un aviso.
          setError(
            new Error(
              'La consulta regresó vacía pero ya teníamos datos. Conservando lo anterior — usa Refrescar.'
            )
          );
        } else {
          if (Array.isArray(result) && result.length > 0) {
            lastNonEmptyRef.current = result as T;
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
