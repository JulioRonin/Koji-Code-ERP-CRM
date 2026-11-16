import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { useCompanySettings, DEFAULT_COMPANY } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { getIndustry } from '@/lib/saas';
import type { CompanySettings } from '@/types/database';
import { accentInk, accentOnWhite, accentSoft, resolveAccent } from '@/lib/brand';

interface CompanyContextType {
  company: CompanySettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

/**
 * Aplica la marca de la empresa. En el rediseño la tinta (#16181D) es el color
 * de acción (botones, texto) y el color de la empresa es el ACENTO: tarjetas
 * destacadas, punto activo del menú, barra resaltada en gráficas.
 */
function applyTheme(color: string | null | undefined) {
  const root = document.documentElement;
  const accent = resolveAccent(color);
  root.style.setProperty('--color-app-accent', accent);
  root.style.setProperty('--color-app-accent-ink', accentInk(accent));
  root.style.setProperty('--color-app-accent-soft', accentSoft(accent));
  root.style.setProperty('--color-app-accent-text', accentOnWhite(accent));
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { tenant, loading: tenantLoading } = useTenant();
  // Mientras la empresa no se resuelve pasamos `undefined` (no consulta). Una vez
  // resuelta, pasamos su id para traer SOLO la configuración de esa empresa.
  const activeTenantId = tenant.id && tenant.id !== 'tenant-default' ? tenant.id : null;
  const { data: company, loading, refetch } = useCompanySettings(tenantLoading ? undefined : activeTenantId);

  // Si la empresa aún no configuró su marca (company_settings = default), usamos
  // el nombre de su empresa (tenant) para no mostrar el del primer cliente.
  const effective: CompanySettings = useMemo(() => {
    const base = company ?? DEFAULT_COMPANY;
    if (base.id === 'default' && tenant?.name) {
      const industryLabel = tenant.industry ? getIndustry(tenant.industry)?.label : '';
      return { ...base, legal_name: tenant.name, commercial_name: tenant.name, tagline: industryLabel ?? '' };
    }
    return base;
  }, [company, tenant?.name]);

  // Aplica el tema cada vez que cambia el color primario.
  useEffect(() => {
    applyTheme(effective.primary_color);
  }, [effective.primary_color]);

  // Actualiza el <title> con el nombre de la empresa.
  useEffect(() => {
    const name = effective.commercial_name || effective.legal_name;
    if (name) document.title = `${name} · KANRI`;
  }, [effective.commercial_name, effective.legal_name]);

  return (
    <CompanyContext.Provider value={{ company: effective, loading, refresh: refetch }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    // Fallback seguro si se usa fuera del provider (no debería pasar)
    return { company: DEFAULT_COMPANY, loading: false, refresh: async () => {} };
  }
  return ctx;
}
