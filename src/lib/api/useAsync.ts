import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncState } from './types';

/**
 * Hook genérico para queries asíncronas. Maneja loading/error y permite
 * re-fetch manual. La capa de datos lo usa internamente.
 */
export function useAsync<T>(fn: () => Promise<T>, initialData: T, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

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
      if (mountedRef.current) setData(result);
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
