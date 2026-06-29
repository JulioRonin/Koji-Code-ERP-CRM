import type { ModuleDef, ModuleKey } from './types';

/**
 * Catálogo de módulos del sistema. Cada uno es una pieza funcional que se
 * puede habilitar/deshabilitar por empresa (tenant). El sidebar, el router y
 * el panel super-admin leen de aquí.
 */
export const MODULES: ModuleDef[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/',
    description: 'Resumen ejecutivo: KPIs y actividad reciente.',
    core: true,
  },
  {
    key: 'quotes',
    label: 'Cotizaciones',
    path: '/quotes',
    description: 'Cotizador con catálogo de precios y documento PDF.',
    minPlan: 'basico',
  },
  {
    key: 'inventory',
    label: 'Inventario',
    path: '/inventory',
    description: 'Control de stock en tiempo real, entradas/salidas y mín/máx con alertas.',
    minPlan: 'basico',
  },
  {
    key: 'projects',
    label: 'Proyectos',
    path: '/projects',
    description: 'Gestión de proyectos, archivos, notas y reporte ejecutivo.',
    core: true,
  },
  {
    key: 'master_plan',
    label: 'Master Plan / Gantt',
    description: 'Planeación PMI con cronograma Gantt descargable.',
    minPlan: 'profesional',
  },
  {
    key: 'design',
    label: 'Diseño',
    path: '/design',
    description: 'Planos 2D, modelos 3D y checklist de ingeniería.',
    minPlan: 'basico',
  },
  {
    key: 'purchasing',
    label: 'Compras',
    path: '/purchasing',
    description: 'BOM, requisiciones, órdenes de compra y proveedores.',
    minPlan: 'basico',
  },
  {
    key: 'production',
    label: 'Producción',
    path: '/production',
    description: 'Piso de fábrica, máquinas y órdenes de trabajo.',
    minPlan: 'profesional',
  },
  {
    key: 'quality',
    label: 'Calidad',
    path: '/quality',
    description: 'Inspección, NCRs y reportes dimensionales (ISO 9001).',
    minPlan: 'profesional',
  },
  {
    key: 'shipping',
    label: 'Embarques',
    path: '/shipping',
    description: 'Packing lists, etiquetas y seguimiento de envíos.',
    minPlan: 'profesional',
  },
  {
    key: 'pmo',
    label: 'PMO',
    path: '/pmo',
    description: 'Reportes ejecutivos y salud de portafolio.',
    minPlan: 'profesional',
  },
  {
    key: 'technicians',
    label: 'Técnicos',
    path: '/technicians',
    description: 'Portal del técnico y registro de tiempos.',
    minPlan: 'profesional',
  },
  {
    key: 'personnel',
    label: 'Personal',
    path: '/personnel',
    description: 'Gestión de colaboradores, roles y accesos.',
    core: true,
  },
  {
    key: 'meetings',
    label: 'Juntas y minutas',
    description: 'Calendario de juntas y minutas con export PDF.',
    minPlan: 'basico',
  },
  {
    key: 'chat',
    label: 'Chat',
    path: '/chat',
    description: 'Mensajería por proyecto y por departamento.',
    minPlan: 'basico',
  },
  {
    key: 'client_portal',
    label: 'Portal del cliente',
    description: 'Acceso por enlace mágico para que el cliente dé seguimiento.',
    minPlan: 'profesional',
  },
  {
    key: 'billing',
    label: 'Facturación',
    path: '/billing',
    description: 'Facturación y cobranza a clientes.',
    minPlan: 'profesional',
  },
];

const MODULE_MAP: Record<ModuleKey, ModuleDef> = MODULES.reduce(
  (acc, m) => ({ ...acc, [m.key]: m }),
  {} as Record<ModuleKey, ModuleDef>
);

export function getModule(key: ModuleKey): ModuleDef {
  return MODULE_MAP[key];
}

/** Módulos núcleo: siempre activos para cualquier empresa/plan. */
export const CORE_MODULES: ModuleKey[] = MODULES.filter(m => m.core).map(m => m.key);

/** Mapea una ruta (path) a su ModuleKey, si existe. */
export function moduleKeyForPath(path: string): ModuleKey | null {
  const found = MODULES.find(m => m.path && (path === m.path || path.startsWith(m.path + '/')));
  return found?.key ?? null;
}
