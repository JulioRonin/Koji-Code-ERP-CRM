import { DEFAULT_TENANT, type Tenant } from './index';

/**
 * Almacén de empresas (tenants) de la plataforma. En esta fase vive en
 * localStorage (modo demo). Cuando hagamos la migración multi-tenant real,
 * estas funciones se reemplazan por llamadas a una tabla `tenants` en Supabase
 * conservando la misma firma.
 */
const TENANTS_KEY = 'kanri_tenants';
const ACTIVE_KEY = 'kanri_tenant'; // el tenant activo (lo lee TenantContext)

function read(): Tenant[] {
  try {
    const raw = localStorage.getItem(TENANTS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as Tenant[];
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    /* ignore */
  }
  // Semilla: tenant placeholder genérico (sin datos de ningún cliente real).
  const seed = [DEFAULT_TENANT];
  write(seed);
  return seed;
}

function write(list: Tenant[]): void {
  try {
    localStorage.setItem(TENANTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function listTenants(): Tenant[] {
  return read().sort((a, b) => a.name.localeCompare(b.name));
}

export function getTenant(id: string): Tenant | null {
  return read().find(t => t.id === id) ?? null;
}

export function upsertTenant(tenant: Tenant): void {
  const list = read();
  const idx = list.findIndex(t => t.id === tenant.id);
  const next = { ...tenant, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  write(list);
}

export function deleteTenant(id: string): void {
  write(read().filter(t => t.id !== id));
}

/** Marca un tenant como activo (lo que verá la app al recargar). */
export function setActiveTenant(id: string): void {
  const t = getTenant(id);
  if (t) {
    try {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  }
}

/** Genera un slug a partir del nombre de la empresa. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Genera un id de tenant único y legible. */
export function newTenantId(): string {
  return `tenant-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}
