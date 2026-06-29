import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
import { getMyTenant, getTenantById, saveTenant as persistTenant } from '@/lib/api/tenants';

const CACHE_KEY = 'kanri_tenant';                 // última empresa resuelta (cache/branding)
const OVERRIDE_KEY = 'kanri_active_tenant_id';     // "entrar como" (solo dueño de plataforma)

interface TenantContextValue {
  tenant: Tenant;
  loading: boolean;
  modules: ModuleKey[];
  available: ModuleKey[];
  isEnabled: (key: ModuleKey) => boolean;
  /** Recarga la empresa activa (tras login, o cambio de override). */
  refresh: () => Promise<void>;
  /** Dueño de plataforma: ver/operar como otra empresa (branding/módulos). */
  setActiveTenantId: (id: string | null) => Promise<void>;
  setIndustry: (industry: IndustryKey) => void;
  setPlan: (plan: PlanKey) => void;
  toggleModule: (key: ModuleKey, on: boolean) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readCache(): Tenant {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...DEFAULT_TENANT, ...(JSON.parse(raw) as Tenant) };
  } catch {
    /* ignore */
  }
  return DEFAULT_TENANT;
}

function writeCache(t: Tenant) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant>(() => readCache());
  const [loading, setLoading] = useState(true);

  const apply = useCallback((t: Tenant) => {
    setTenant(t);
    writeCache(t);
  }, []);

  const loadActive = useCallback(async () => {
    setLoading(true);
    try {
      if (!supabase) {
        // Modo demo: usa el cache local (lo escribe onboarding/super-admin).
        setTenant(readCache());
        return;
      }
      const override = (() => {
        try {
          return localStorage.getItem(OVERRIDE_KEY);
        } catch {
          return null;
        }
      })();
      // El override solo carga si la RLS lo permite (dueño de plataforma);
      // si no, cae a la empresa propia.
      let resolved: Tenant | null = override ? await getTenantById(override) : null;
      if (!resolved) resolved = await getMyTenant();
      if (resolved) apply(resolved);
    } catch (err) {
      console.warn('No se pudo resolver la empresa activa', err);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  // Resuelve al montar y cuando cambia la sesión (login/logout).
  useEffect(() => {
    loadActive();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadActive();
    });
    return () => sub.subscription.unsubscribe();
  }, [loadActive]);

  const refresh = useCallback(() => loadActive(), [loadActive]);

  const setActiveTenantId = useCallback(
    async (id: string | null) => {
      try {
        if (id) localStorage.setItem(OVERRIDE_KEY, id);
        else localStorage.removeItem(OVERRIDE_KEY);
      } catch {
        /* ignore */
      }
      await loadActive();
    },
    [loadActive]
  );

  // Mutaciones (panel/demo). Persisten vía API (saveTenant: Supabase o demo).
  const mutate = useCallback(
    (next: Tenant) => {
      apply(next);
      persistTenant(next).catch(() => {/* RLS / demo */});
    },
    [apply]
  );

  const setIndustry = useCallback(
    (industry: IndustryKey) => mutate({ ...tenant, industry, enabledModules: initialModules(industry, tenant.plan) }),
    [tenant, mutate]
  );

  const setPlan = useCallback(
    (plan: PlanKey) => {
      const ceiling = new Set(availableModulesForTenant({ plan }));
      const kept = (tenant.enabledModules ?? []).filter(m => ceiling.has(m));
      mutate({ ...tenant, plan, enabledModules: kept.length ? kept : initialModules(tenant.industry, plan) });
    },
    [tenant, mutate]
  );

  const toggleModule = useCallback(
    (key: ModuleKey, on: boolean) => {
      const cur = new Set(tenant.enabledModules ?? []);
      if (on) cur.add(key);
      else cur.delete(key);
      mutate({ ...tenant, enabledModules: Array.from(cur) });
    },
    [tenant, mutate]
  );

  const modules = useMemo(() => effectiveModules(tenant), [tenant]);
  const available = useMemo(() => availableModulesForTenant(tenant), [tenant]);
  const isEnabled = useCallback((key: ModuleKey) => modules.includes(key), [modules]);

  const value: TenantContextValue = {
    tenant,
    loading,
    modules,
    available,
    isEnabled,
    refresh,
    setActiveTenantId,
    setIndustry,
    setPlan,
    toggleModule,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant debe usarse dentro de <TenantProvider>');
  return ctx;
}
