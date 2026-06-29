import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_TENANT,
  effectiveModules,
  availableModulesForTenant,
  initialModules,
  type ModuleKey,
  type IndustryKey,
  type PlanKey,
  type Tenant,
} from '@/lib/saas';

const STORAGE_KEY = 'kanri_tenant';

interface TenantContextValue {
  tenant: Tenant;
  /** Módulos efectivamente habilitados (núcleo + giro/override acotado al plan). */
  modules: ModuleKey[];
  /** Módulos que el plan permite activar (techo). */
  available: ModuleKey[];
  isEnabled: (key: ModuleKey) => boolean;
  setIndustry: (industry: IndustryKey) => void;
  setPlan: (plan: PlanKey) => void;
  toggleModule: (key: ModuleKey, on: boolean) => void;
  updateTenant: (patch: Partial<Tenant>) => void;
  /** Reaplica el set de módulos por defecto del giro + plan actuales. */
  resetModulesToDefault: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readStored(): Tenant {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_TENANT, ...(JSON.parse(raw) as Tenant) };
  } catch {
    /* ignore */
  }
  return DEFAULT_TENANT;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant>(() => readStored());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
    } catch {
      /* ignore */
    }
  }, [tenant]);

  const persist = useCallback((next: Tenant) => {
    setTenant({ ...next, updatedAt: new Date().toISOString() });
  }, []);

  const updateTenant = useCallback(
    (patch: Partial<Tenant>) => setTenant(t => ({ ...t, ...patch, updatedAt: new Date().toISOString() })),
    []
  );

  const setIndustry = useCallback(
    (industry: IndustryKey) =>
      persist({ ...tenant, industry, enabledModules: initialModules(industry, tenant.plan) }),
    [tenant, persist]
  );

  const setPlan = useCallback(
    (plan: PlanKey) => {
      // Al cambiar de plan, acotamos los módulos al nuevo techo.
      const ceiling = new Set(availableModulesForTenant({ plan }));
      const kept = (tenant.enabledModules ?? []).filter(m => ceiling.has(m));
      persist({ ...tenant, plan, enabledModules: kept.length ? kept : initialModules(tenant.industry, plan) });
    },
    [tenant, persist]
  );

  const toggleModule = useCallback(
    (key: ModuleKey, on: boolean) => {
      const cur = new Set(tenant.enabledModules ?? []);
      if (on) cur.add(key);
      else cur.delete(key);
      persist({ ...tenant, enabledModules: Array.from(cur) });
    },
    [tenant, persist]
  );

  const resetModulesToDefault = useCallback(
    () => persist({ ...tenant, enabledModules: initialModules(tenant.industry, tenant.plan) }),
    [tenant, persist]
  );

  const modules = useMemo(() => effectiveModules(tenant), [tenant]);
  const available = useMemo(() => availableModulesForTenant(tenant), [tenant]);
  const isEnabled = useCallback((key: ModuleKey) => modules.includes(key), [modules]);

  const value: TenantContextValue = {
    tenant,
    modules,
    available,
    isEnabled,
    setIndustry,
    setPlan,
    toggleModule,
    updateTenant,
    resetModulesToDefault,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant debe usarse dentro de <TenantProvider>');
  return ctx;
}
