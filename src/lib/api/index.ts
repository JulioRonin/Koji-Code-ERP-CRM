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
export * from './projectFiles';
export * from './workOrderStages';
export * from './shipments';
export * from './clientPortal';
export * from './pmo';
export * from './quotes';
export * from './projectTasks';
export * from './masterPlans';
export * from './projectsExtras';
export * from './projectMeetings';
export * from './automations';
export * from './chat';
export * from './pdfThumbnail';
export * from './companySettings';
export * from './dimensionalReports';
export * from './inventory';
export * from './customers';
export * from './payroll';
export * from './attendance';
export * from './email';
export * from './tenantScope';
