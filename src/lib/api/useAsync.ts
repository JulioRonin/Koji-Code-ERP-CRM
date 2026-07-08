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
  // Ya se completó al menos una carga para este contexto. Sirve para NO volver
  // a poner loading=true en los refetch (que provocaba parpadeos y que la UI
  // dependiente del loading se reseteara). El spinner solo aparece en la carga
  // inicial o al cambiar de contexto (deps).
  const hasLoadedRef = useRef(false);

  // Si las deps cambiaron desde el render anterior, perdemos el "anchor"
  // de datos previos (es otro contexto) y volvemos a permitir el spinner.
  if (!shallowEqualArrays(prevDepsRef.current, deps)) {
    prevDepsRef.current = deps;
    lastRealNonEmptyRef.current = null;
    hasLoadedRef.current = false;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    // Solo mostramos loading en la carga inicial (o al cambiar de contexto).
    // Los refetch posteriores son silenciosos: conservan los datos en pantalla.
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (mountedRef.current) {
        hasLoadedRef.current = true;
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

  // Actualización optimista local (sin red). Mantiene el "anchor" en sync para
  // que un refetch posterior vacío no borre el cambio.
  const mutate = useCallback((updater: (prev: T) => T) => {
    setData(prev => {
      const next = updater(prev);
      if (Array.isArray(next) && next.length > 0) {
        lastRealNonEmptyRef.current = next as T;
      }
      return next;
    });
  }, []);

  return { data, loading, error, refetch: execute, mutate };
}

function shallowEqualArrays(a: unknown[], b: unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}
