import type { ModuleKey, PlanKey, Tenant } from './types';
import { MODULES, CORE_MODULES } from './modules';
import { defaultModulesForIndustry } from './industries';
import { modulesForPlan } from './plans';

export * from './types';
export * from './modules';
export * from './industries';
export * from './plans';
export * from './subscription';

const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map(m => m.key);

/** Módulos que el PLAN de la empresa permite activar (techo del plan). */
export function availableModulesForTenant(tenant: Pick<Tenant, 'plan'>): ModuleKey[] {
  const planMods = modulesForPlan(tenant.plan, ALL_MODULE_KEYS);
  return Array.from(new Set([...CORE_MODULES, ...planMods]));
}

/**
 * Módulos efectivamente habilitados para la empresa:
 *  - Siempre incluye los núcleo.
 *  - Respeta `enabledModules` (override del admin) acotado al techo del plan.
 *  - Si no hay override, usa el default del giro acotado al plan.
 */
export function effectiveModules(tenant: Tenant): ModuleKey[] {
  const ceiling = new Set(availableModulesForTenant(tenant));
  const base =
    tenant.enabledModules && tenant.enabledModules.length > 0
      ? tenant.enabledModules
      : defaultModulesForIndustry(tenant.industry);
  const set = new Set<ModuleKey>(CORE_MODULES);
  base.forEach(m => {
    if (ceiling.has(m)) set.add(m);
  });
  return Array.from(set);
}

export function isModuleEnabled(tenant: Tenant, key: ModuleKey): boolean {
  return effectiveModules(tenant).includes(key);
}

/** Construye el conjunto inicial de módulos al crear una empresa (onboarding). */
export function initialModules(industry: Tenant['industry'], plan: PlanKey): ModuleKey[] {
  const ceiling = new Set([...CORE_MODULES, ...modulesForPlan(plan, ALL_MODULE_KEYS)]);
  const set = new Set<ModuleKey>(CORE_MODULES);
  defaultModulesForIndustry(industry).forEach(m => {
    if (ceiling.has(m)) set.add(m);
  });
  return Array.from(set);
}

/** Tenant placeholder (genérico de marca) usado mientras se resuelve la empresa
 *  real del usuario. No debe contener datos de ningún cliente específico. */
export const DEFAULT_TENANT: Tenant = {
  id: 'tenant-default',
  name: 'KANRI',
  slug: 'kanri',
  industry: 'cnc',
  plan: 'enterprise',
  enabledModules: initialModules('cnc', 'enterprise'),
  subscription: {
    status: 'active',
    currentPeriodEnd: null,
    billingCycle: 'monthly',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
