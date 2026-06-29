import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { useCompanySettings, DEFAULT_COMPANY } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { getIndustry } from '@/lib/saas';
import type { CompanySettings } from '@/types/database';

interface CompanyContextType {
  company: CompanySettings;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

/** Aclara/oscurece un hex por un factor (-1..1). */
function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c : 255 - c) * amount)));
  r = adj(r);
  g = adj(g);
  b = adj(b);
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Aplica el color primario de la empresa a las variables CSS de la app. */
function applyTheme(primary: string | null | undefined) {
  const root = document.documentElement;
  // Default de marca KANRI: bermellón. Cada empresa puede personalizar su color.
  const color = primary && /^#[0-9a-fA-F]{6}$/.test(primary) ? primary : '#E2401F';
  root.style.setProperty('--color-app-primary', color);
  root.style.setProperty('--color-app-primary-hover', shade(color, -0.18));
  root.style.setProperty('--color-app-primary-soft', shade(color, 0.85));
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { data: company, loading, refetch } = useCompanySettings();
  const { tenant } = useTenant();

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
