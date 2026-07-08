/**
 * Tipos compartidos para la capa de datos.
 */

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  /** Re-ejecuta la query. */
  refetch: () => Promise<void>;
  /**
   * Actualiza los datos localmente (optimista), sin ir a la red. Útil para
   * reflejar de inmediato una edición mientras la mutación viaja al servidor.
   */
  mutate: (updater: (prev: T) => T) => void;
}

export interface MutationState {
  loading: boolean;
  error: Error | null;
}
