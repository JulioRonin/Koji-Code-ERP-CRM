/**
 * Tipos compartidos para la capa de datos.
 */

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  /** Re-ejecuta la query. */
  refetch: () => Promise<void>;
}

export interface MutationState {
  loading: boolean;
  error: Error | null;
}
