/**
 * Control de acceso por rol.
 *
 * El rol es lo que se asigna al colaborador en su perfil
 * (profiles.role). La matriz de abajo define exactamente qué rutas
 * puede ver y abrir cada rol. Si un rol no está mapeado o se omite
 * "ALL", la sidebar lo filtra y el ProtectedRoute lo redirige.
 *
 * Mantén esto como single source of truth: tanto la navegación
 * (Sidebar) como las rutas (App) leen de aquí.
 */

export type Role =
  | 'Administrador'
  | 'Administración / PM'
  | 'Diseñador'
  | 'Compras'
  | 'Producción'
  | 'Calidad'
  | 'Técnico'
  | (string & {}); // permite roles libres sin romper TS

/** Rutas (paths) que cada rol puede ver. "ALL" = todo. */
export const ROLE_ACCESS: Record<string, string[]> = {
  Administrador: ['ALL'],
  'Administración / PM': ['ALL'],
  Diseñador: ['/', '/projects', '/design', '/chat'],
  Compras: ['/', '/projects', '/quotes', '/chat', '/purchasing', '/billing'],
  Producción: ['/', '/chat', '/quality', '/technicians', '/production'],
  Calidad: ['/', '/chat', '/quality', '/technicians', '/production'],
  // Los técnicos viven en /technician-portal (su dashboard exclusivo) y
  // pueden saltar a /chat para discutir piezas. /technicians lo dejamos
  // permitido sólo para que el redirect del sidebar no rompa: el
  // ProtectedRoute los redirige a /technician-portal al detectar el rol.
  Técnico: ['/technician-portal', '/chat', '/technicians'],
};

/** Devuelve true si el rol puede entrar a la ruta. */
export function canAccessPath(role: string | undefined, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ACCESS[role];
  if (!allowed) return false;
  if (allowed.includes('ALL')) return true;
  // Match exacto o prefijo (ej. /projects/123 cae bajo /projects)
  return allowed.some(a => path === a || (a !== '/' && path.startsWith(a + '/')));
}

/** Ruta home / fallback adecuado para cada rol — la primera ruta accesible. */
export function defaultRouteForRole(role: string | undefined): string {
  if (!role) return '/login';
  // Caso especial: los técnicos siempre van a su portal exclusivo, sin
  // pasar por el dashboard administrativo.
  if (role === 'Técnico') return '/technician-portal';
  const allowed = ROLE_ACCESS[role];
  if (!allowed || allowed.length === 0) return '/chat';
  if (allowed.includes('ALL')) return '/';
  // Evita "/" si no puede llegar al dashboard
  const first = allowed.find(a => a !== '/') ?? '/chat';
  return first;
}
