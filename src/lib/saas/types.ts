/**
 * Tipos núcleo de la capa SaaS / multi-tenant de KANRI.
 *
 * Esta capa es la "fuente de verdad" del producto comercial:
 *  - Giros (industries): a qué sector pertenece la empresa.
 *  - Módulos (modules): piezas funcionales habilitables por empresa.
 *  - Planes (plans): paquetes comerciales con precio y límites.
 *  - Tenant: la empresa cliente que renta KANRI.
 *
 * En esta primera fase los catálogos viven en código (config). La migración
 * a tablas con tenant_id + RLS llega en la fase siguiente.
 */

/** Identificador estable de cada módulo del sistema. */
export type ModuleKey =
  | 'dashboard'
  | 'quotes'
  | 'projects'
  | 'design'
  | 'purchasing'
  | 'production'
  | 'quality'
  | 'shipping'
  | 'pmo'
  | 'technicians'
  | 'personnel'
  | 'chat'
  | 'billing'
  | 'client_portal'
  | 'meetings'
  | 'master_plan';

/** Definición de un módulo habilitable. */
export interface ModuleDef {
  key: ModuleKey;
  /** Nombre visible. */
  label: string;
  /** Ruta principal en la app (si aplica). */
  path?: string;
  /** Descripción corta para onboarding / panel admin. */
  description: string;
  /** Núcleo = siempre activo, no se puede desactivar. */
  core?: boolean;
  /** Plan mínimo que incluye el módulo de forma estándar. */
  minPlan?: PlanKey;
}

/** Identificador de cada giro / sector de proveeduría. */
export type IndustryKey =
  | 'cnc'
  | 'maquinados'
  | 'mro'
  | 'publicidad'
  | 'diseno'
  | 'consultoria'
  | 'cursos'
  | 'herramientas';

/** Definición de un giro: qué módulos trae por defecto y su vocabulario. */
export interface IndustryDef {
  key: IndustryKey;
  label: string;
  /** Pitch corto del giro para el onboarding. */
  tagline: string;
  /** Emoji/ícono representativo (lucide name se resuelve en UI). */
  icon: string;
  /** Módulos que se activan por defecto al elegir este giro. */
  defaultModules: ModuleKey[];
  /** Plan sugerido para este giro (se destaca en el onboarding). */
  recommendedPlan: PlanKey;
  /** Por qué se recomienda ese plan (texto corto para el onboarding). */
  recommendationReason: string;
  /** Renombrado de conceptos según el sector (ej. "Orden de trabajo" vs
   *  "Servicio"). El frontend puede leer estos labels para adaptarse. */
  vocabulary?: Partial<Record<'project' | 'part' | 'workOrder' | 'client', string>>;
}

/** Identificador de cada plan comercial. */
export type PlanKey = 'basico' | 'profesional' | 'enterprise';

/** Definición de un plan: precio, límites y módulos incluidos. */
export interface PlanDef {
  key: PlanKey;
  label: string;
  /** Precio mensual en MXN. null = cotización (Enterprise custom). */
  priceMxn: number | null;
  /** Precio anual en MXN (con descuento). null = cotización. */
  priceMxnAnnual: number | null;
  /** Texto comercial corto. */
  tagline: string;
  /** Días de prueba gratis. */
  trialDays: number;
  /** Límites del plan. -1 = ilimitado. */
  limits: {
    users: number;
    activeProjects: number;
    storageGb: number;
  };
  /** Módulos incluidos en el plan ('ALL' = todos). */
  modules: ModuleKey[] | 'ALL';
  /** Bullets destacados para la página de precios. */
  highlights: string[];
  /** Marca visual: el plan "destacado". */
  featured?: boolean;
}

/** Estado de la suscripción de una empresa. */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';

/** Una empresa cliente (tenant) que renta KANRI. */
export interface Tenant {
  id: string;
  /** Nombre comercial / razón social. */
  name: string;
  /** Subdominio o slug (futuro: kanri.app/<slug>). */
  slug: string;
  industry: IndustryKey;
  plan: PlanKey;
  /** Módulos efectivamente habilitados (override del default del giro/plan). */
  enabledModules: ModuleKey[];
  subscription: {
    status: SubscriptionStatus;
    /** ISO date en que termina el periodo actual / el trial. */
    currentPeriodEnd: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    billingCycle: 'monthly' | 'annual';
  };
  createdAt: string;
  updatedAt: string;
}
