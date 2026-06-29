import type { PlanDef, PlanKey, ModuleKey } from './types';

/**
 * Planes comerciales de KANRI. Precios en MXN (ajustables). El plan define
 * límites (usuarios, proyectos, storage) y el conjunto de módulos incluidos.
 *
 * NOTA: estos precios son un punto de partida del business case; se editan
 * aquí y se reflejan en la página de precios y el panel super-admin.
 */
export const PLANS: PlanDef[] = [
  {
    key: 'basico',
    label: 'Básico',
    priceMxn: 1499,
    priceMxnAnnual: 14990, // ~2 meses gratis
    tagline: 'Para talleres y despachos pequeños que arrancan a digitalizarse.',
    trialDays: 14,
    limits: { users: 5, activeProjects: 5, storageGb: 5 },
    modules: ['dashboard', 'projects', 'personnel', 'quotes', 'design', 'purchasing', 'meetings', 'chat'],
    highlights: [
      'Hasta 5 usuarios',
      'Proyectos, cotizaciones y compras',
      'Diseño (planos 2D/3D)',
      'Juntas y minutas',
      'Soporte por correo',
    ],
  },
  {
    key: 'profesional',
    label: 'Profesional',
    priceMxn: 3999,
    priceMxnAnnual: 39990,
    tagline: 'Operación completa: producción, calidad y portal de clientes.',
    trialDays: 14,
    featured: true,
    limits: { users: 25, activeProjects: -1, storageGb: 50 },
    modules: [
      'dashboard', 'projects', 'personnel', 'quotes', 'design', 'purchasing',
      'master_plan', 'production', 'quality', 'shipping', 'pmo', 'technicians',
      'meetings', 'chat', 'client_portal', 'billing',
    ],
    highlights: [
      'Hasta 25 usuarios',
      'Proyectos ilimitados',
      'Producción, Calidad (ISO 9001) y Embarques',
      'Master Plan / Gantt y PMO',
      'Portal del cliente y facturación',
      'Soporte prioritario',
    ],
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    priceMxn: null, // cotización
    priceMxnAnnual: null,
    tagline: 'A la medida: límites altos, integraciones y datos aislados.',
    trialDays: 30,
    limits: { users: -1, activeProjects: -1, storageGb: -1 },
    modules: 'ALL',
    highlights: [
      'Usuarios y almacenamiento ilimitados',
      'Todos los módulos + personalización por giro',
      'Opción de base de datos dedicada (silo)',
      'Integraciones a la medida (ERP/contabilidad)',
      'SSO, SLA y gerente de cuenta',
    ],
  },
];

const PLAN_MAP: Record<PlanKey, PlanDef> = PLANS.reduce(
  (acc, p) => ({ ...acc, [p.key]: p }),
  {} as Record<PlanKey, PlanDef>
);

export function getPlan(key: PlanKey): PlanDef {
  return PLAN_MAP[key];
}

/** Módulos que incluye un plan (resolviendo 'ALL'). */
export function modulesForPlan(key: PlanKey, allModules: ModuleKey[]): ModuleKey[] {
  const plan = PLAN_MAP[key];
  if (!plan) return [];
  return plan.modules === 'ALL' ? [...allModules] : [...plan.modules];
}

/** Formatea un precio MXN para la UI. */
export function formatMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}
