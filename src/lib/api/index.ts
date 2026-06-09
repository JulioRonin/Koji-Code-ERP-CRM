/**
 * Punto único de entrada para la capa de datos.
 * Cada hook decide automáticamente entre Supabase (si está configurado)
 * y datos mock de demo (si no).
 *
 * Uso típico:
 *
 *   const { data: projects, loading, error, refetch } = useProjects();
 */

export * from './types';
export * from './projects';
export * from './bom';
export * from './purchasing';
export * from './production';
export * from './quality';
export * from './profiles';
