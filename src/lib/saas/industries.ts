import type { IndustryDef, IndustryKey } from './types';
import { CORE_MODULES } from './modules';

/**
 * Catálogo de giros / sectores de la proveeduría. Al elegir uno en el
 * onboarding, la empresa arranca con un set de módulos por defecto y un
 * vocabulario adaptado. Después puede ajustar módulos desde Configuración o
 * el super-admin.
 */
export const INDUSTRIES: IndustryDef[] = [
  {
    key: 'cnc',
    label: 'Manufactura CNC',
    tagline: 'Maquinado de precisión, fresado y torneado CNC de alto volumen.',
    icon: 'Factory',
    defaultModules: [
      'quotes', 'projects', 'master_plan', 'design', 'purchasing',
      'production', 'quality', 'shipping', 'pmo', 'technicians',
      'meetings', 'chat', 'client_portal', 'billing',
    ],
    recommendedPlan: 'profesional',
    recommendationReason: 'Producción, calidad ISO 9001 y trazabilidad completa.',
    vocabulary: { project: 'Proyecto', part: 'Pieza', workOrder: 'Orden de trabajo', client: 'Cliente' },
  },
  {
    key: 'maquinados',
    label: 'Maquinados convencionales',
    tagline: 'Torno, fresa y rectificado convencional; lotes y refacciones.',
    icon: 'Cog',
    defaultModules: [
      'quotes', 'projects', 'design', 'purchasing', 'production',
      'quality', 'shipping', 'technicians', 'meetings', 'chat', 'billing',
    ],
    recommendedPlan: 'profesional',
    recommendationReason: 'Producción y calidad para lotes y refacciones.',
    vocabulary: { project: 'Trabajo', part: 'Pieza', workOrder: 'Orden de trabajo', client: 'Cliente' },
  },
  {
    key: 'mro',
    label: 'MRO · Mantenimiento y reparación',
    tagline: 'Mantenimiento, reparación y operación; servicios y refacciones.',
    icon: 'Wrench',
    defaultModules: [
      'quotes', 'projects', 'purchasing', 'production', 'quality',
      'technicians', 'meetings', 'chat', 'client_portal', 'billing',
    ],
    recommendedPlan: 'basico',
    recommendationReason: 'Inventario, refacciones y cotizaciones rápidas.',
    vocabulary: { project: 'Orden de servicio', part: 'Refacción', workOrder: 'Servicio', client: 'Cliente' },
  },
  {
    key: 'publicidad',
    label: 'Publicidad y marketing',
    tagline: 'Agencias y servicios creativos; campañas y entregables.',
    icon: 'Megaphone',
    defaultModules: [
      'quotes', 'projects', 'design', 'meetings', 'chat',
      'client_portal', 'billing',
    ],
    recommendedPlan: 'basico',
    recommendationReason: 'Proyectos, cotizaciones y entregables sin planta.',
    vocabulary: { project: 'Campaña', part: 'Entregable', workOrder: 'Tarea', client: 'Cliente' },
  },
  {
    key: 'diseno',
    label: 'Diseño y servicios de ingeniería',
    tagline: 'Despachos de diseño industrial, CAD/CAE e ingeniería.',
    icon: 'Ruler',
    defaultModules: [
      'quotes', 'projects', 'design', 'master_plan', 'meetings',
      'chat', 'client_portal', 'billing',
    ],
    recommendedPlan: 'profesional',
    recommendationReason: 'Master Plan, portal de cliente y entregables.',
    vocabulary: { project: 'Proyecto', part: 'Entregable', workOrder: 'Actividad', client: 'Cliente' },
  },
  {
    key: 'consultoria',
    label: 'Consultoría',
    tagline: 'Servicios profesionales por proyecto y por horas.',
    icon: 'Briefcase',
    defaultModules: [
      'quotes', 'projects', 'master_plan', 'pmo', 'meetings',
      'chat', 'client_portal', 'billing',
    ],
    recommendedPlan: 'profesional',
    recommendationReason: 'PMO, portal de cliente y seguimiento por proyecto.',
    vocabulary: { project: 'Engagement', part: 'Entregable', workOrder: 'Actividad', client: 'Cliente' },
  },
  {
    key: 'cursos',
    label: 'Capacitación y cursos',
    tagline: 'Centros de capacitación; cohortes, instructores y materiales.',
    icon: 'GraduationCap',
    defaultModules: [
      'quotes', 'projects', 'personnel', 'meetings', 'chat', 'billing',
    ],
    recommendedPlan: 'basico',
    recommendationReason: 'Cohortes, cotizaciones y gestión ligera.',
    vocabulary: { project: 'Curso', part: 'Material', workOrder: 'Sesión', client: 'Participante' },
  },
  {
    key: 'herramientas',
    label: 'Venta de herramientas e insumos',
    tagline: 'Distribución y venta de herramienta, consumibles e insumos.',
    icon: 'Hammer',
    defaultModules: [
      'quotes', 'purchasing', 'shipping', 'meetings', 'chat',
      'client_portal', 'billing',
    ],
    recommendedPlan: 'basico',
    recommendationReason: 'Inventario, surtido y facturación.',
    vocabulary: { project: 'Pedido', part: 'Producto', workOrder: 'Surtido', client: 'Cliente' },
  },
];

const INDUSTRY_MAP: Record<IndustryKey, IndustryDef> = INDUSTRIES.reduce(
  (acc, i) => ({ ...acc, [i.key]: i }),
  {} as Record<IndustryKey, IndustryDef>
);

export function getIndustry(key: IndustryKey): IndustryDef {
  return INDUSTRY_MAP[key];
}

/** Módulos efectivos por defecto al elegir un giro: sus módulos + los núcleo. */
export function defaultModulesForIndustry(key: IndustryKey): IndustryDef['defaultModules'] {
  const ind = INDUSTRY_MAP[key];
  const set = new Set([...CORE_MODULES, ...(ind?.defaultModules ?? [])]);
  return Array.from(set);
}
