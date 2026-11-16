import type { ComponentType } from 'react';
import {
  Home, Contact, Calculator, FolderKanban, Ruler, FileBarChart, ShoppingCart, Boxes,
  Factory, ShieldCheck, Wrench, Truck, HardHat, Users, FileText, HandCoins, PiggyBank,
  MessageSquare, Settings,
} from 'lucide-react';
import { canAccessPath, isTechnicianRole } from '@/lib/permissions';
import { moduleKeyForPath, type ModuleKey } from '@/lib/saas';

/**
 * Mapa de navegación del rediseño: los módulos se agrupan por ÁREA
 * (Comercial, Ingeniería, Operación, Administración). La barra superior
 * muestra las áreas como píldoras con menú; el riel lateral fija accesos
 * rápidos. Todo se filtra por rol y por los módulos del plan.
 */
export interface NavModule {
  name: string;
  path: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface NavArea {
  name: string;
  modules: NavModule[];
}

export const NAV_AREAS: NavArea[] = [
  { name: 'Comercial', modules: [
    { name: 'Clientes', path: '/customers', icon: Contact },
    { name: 'Cotizaciones', path: '/quotes', icon: Calculator },
  ] },
  { name: 'Ingeniería', modules: [
    { name: 'Proyectos', path: '/projects', icon: FolderKanban },
    { name: 'Diseño', path: '/design', icon: Ruler },
    { name: 'PMO', path: '/pmo', icon: FileBarChart },
  ] },
  { name: 'Operación', modules: [
    { name: 'Compras', path: '/purchasing', icon: ShoppingCart },
    { name: 'Inventario', path: '/inventory', icon: Boxes },
    { name: 'Producción', path: '/production', icon: Factory },
    { name: 'Calidad', path: '/quality', icon: ShieldCheck },
    { name: 'Mantenimiento', path: '/maintenance', icon: Wrench },
    { name: 'Embarques', path: '/shipping', icon: Truck },
    { name: 'Técnicos', path: '/technicians', icon: HardHat },
  ] },
  { name: 'Administración', modules: [
    { name: 'Personal', path: '/personnel', icon: Users },
    { name: 'Facturación', path: '/billing', icon: FileText },
    { name: 'Cobranza', path: '/cobranza', icon: HandCoins },
    { name: 'Finanzas', path: '/finance', icon: PiggyBank },
  ] },
];

export const HOME_MODULE: NavModule = { name: 'Inicio', path: '/', icon: Home };
export const CHAT_MODULE: NavModule = { name: 'Chat', path: '/chat', icon: MessageSquare };
export const SETTINGS_MODULE: NavModule = { name: 'Configuración', path: '/settings', icon: Settings };

/** Accesos fijos del riel lateral (en este orden, si el usuario tiene acceso). */
const RAIL_PATHS = ['/projects', '/production', '/quality', '/purchasing', '/quotes', '/finance'];

/** Rutas sueltas (fuera de las áreas) para el breadcrumb. */
const EXTRA_CRUMBS: Record<string, [string, string]> = {
  '/chat': ['Inicio', 'Chat'],
  '/settings': ['Cuenta', 'Configuración'],
  '/settings/integrations': ['Configuración', 'Integraciones'],
  '/subscription': ['Cuenta', 'Suscripción'],
  '/platform': ['Cuenta', 'Plataforma'],
};

interface NavUser {
  role?: string;
  permissions?: string[] | null;
}

function allowed(path: string, user: NavUser | null | undefined, isEnabled: (k: ModuleKey) => boolean): boolean {
  if (!canAccessPath(user?.role, path, user?.permissions)) return false;
  const mk = moduleKeyForPath(path);
  return mk ? isEnabled(mk) : true;
}

/** Áreas con solo los módulos que el usuario puede abrir (las vacías se omiten). */
export function visibleAreas(user: NavUser | null | undefined, isEnabled: (k: ModuleKey) => boolean): NavArea[] {
  const tech = isTechnicianRole(user?.role);
  return NAV_AREAS
    .map(a => ({
      ...a,
      modules: a.modules
        .filter(m => allowed(m.path, user, isEnabled))
        // El técnico usa su portal en lugar del tablero de coordinación.
        .map(m => (tech && m.path === '/technicians' ? { ...m, name: 'Mi portal', path: '/technician-portal' } : m)),
    }))
    .filter(a => a.modules.length > 0);
}

export function railModules(user: NavUser | null | undefined, isEnabled: (k: ModuleKey) => boolean): NavModule[] {
  const all = NAV_AREAS.flatMap(a => a.modules);
  const out: NavModule[] = [];
  if (allowed('/', user, isEnabled)) out.push(HOME_MODULE);
  for (const p of RAIL_PATHS) {
    const m = all.find(x => x.path === p);
    if (m && allowed(p, user, isEnabled)) out.push(m);
  }
  if (allowed('/chat', user, isEnabled)) out.push(CHAT_MODULE);
  return out;
}

/** Área a la que pertenece una ruta (para resaltar la píldora activa). */
export function areaForPath(pathname: string): string | null {
  if (pathname === '/') return 'Inicio';
  for (const a of NAV_AREAS) {
    if (a.modules.some(m => pathname === m.path || pathname.startsWith(m.path + '/'))) return a.name;
  }
  return null;
}

/** Breadcrumb "Área → Módulo" de la ruta actual (null en Inicio). */
export function crumbsForPath(pathname: string): { area: string; module: string; modulePath: string } | null {
  if (EXTRA_CRUMBS[pathname]) {
    const [area, module] = EXTRA_CRUMBS[pathname];
    return { area, module, modulePath: pathname };
  }
  for (const a of NAV_AREAS) {
    const m = a.modules.find(x => pathname === x.path || pathname.startsWith(x.path + '/'));
    if (m) return { area: a.name, module: m.name, modulePath: m.path };
  }
  return null;
}

export function isActivePath(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
}
