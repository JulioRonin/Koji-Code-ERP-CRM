import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { setActiveTenant } from '@/lib/api/tenantScope';

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
  // IMPORTANTE: no sembramos desde el cache (puede ser de OTRO usuario y filtrar
  // su marca/empresa por un instante). Arrancamos en el genérico KANRI y
  // resolvemos la empresa real del usuario autenticado.
  const [tenant, setTenant] = useState<Tenant>(DEFAULT_TENANT);
  const [loading, setLoading] = useState(true);
  // Id del usuario de auth ya resuelto. Evita que los eventos de refresco de
  // token (TOKEN_REFRESHED / SIGNED_IN re-emitido al recuperar el foco de la
  // pestaña) vuelvan a resolver la empresa y pongan loading=true — eso hacía
  // que el AppShell mostrara el spinner y REMONTARA el módulo, perdiendo
  // proyecto, tab, filtros y scroll.
  const authUserIdRef = useRef<string | null>(null);

  const apply = useCallback((t: Tenant) => {
    setTenant(t);
    setActiveTenant(t.id);
    writeCache(t);
  }, []);

  const loadActive = useCallback(async () => {
    setLoading(true);
    try {
      if (!supabase) {
        // Modo demo: usa el cache local (lo escribe onboarding/super-admin).
        const cached = readCache();
        setTenant(cached);
        setActiveTenant(cached.id);
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
      if (resolved) {
        apply(resolved);
      } else {
        // Sin empresa resuelta (p. ej. tras cerrar sesión): vuelve al genérico y
        // limpia el alcance para no arrastrar datos de la sesión anterior.
        setTenant(DEFAULT_TENANT);
        setActiveTenant(null);
      }
    } catch (err) {
      console.warn('No se pudo resolver la empresa activa', err);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  // Resuelve al montar y SOLO cuando cambia el usuario de la sesión
  // (login de otro usuario / logout). Los refrescos de token no re-resuelven.
  useEffect(() => {
    let unsub = () => {};
    const start = async () => {
      // Fijamos el id actual ANTES de suscribirnos, para que el evento
      // INITIAL_SESSION (mismo usuario) no dispare una recarga extra.
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          authUserIdRef.current = data.session?.user?.id ?? null;
        } catch {
          /* ignore */
        }
      }
      await loadActive();
      if (!supabase) return;
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id ?? null;
        // Cierre de sesión o sin usuario: re-resolvemos (vuelve al genérico).
        if (!uid) {
          authUserIdRef.current = null;
          loadActive();
          return;
        }
        // Mismo usuario (token refresh / SIGNED_IN re-emitido al enfocar la
        // pestaña): NO hacemos nada — así no se remonta el módulo.
        if (uid === authUserIdRef.current) return;
        // Usuario distinto (login real de otra cuenta): re-resolvemos su empresa.
        authUserIdRef.current = uid;
        loadActive();
      });
      unsub = () => sub.subscription.unsubscribe();
    };
    start();
    return () => unsub();
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
