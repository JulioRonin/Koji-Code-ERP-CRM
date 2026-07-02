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

/** Acceso mínimo para usuarios autenticados con un rol "desconocido" — al
 *  menos el dashboard y el chat, para que NUNCA queden atrapados en una
 *  redirección infinita. */
const FALLBACK_ACCESS = ['/', '/chat'];

/** Rutas (paths) que cada rol puede ver. "ALL" = todo. */
export const ROLE_ACCESS: Record<string, string[]> = {
  Administrador: ['ALL'],
  'Administración / PM': ['ALL'],
  Diseñador: ['/', '/projects', '/design', '/chat'],
  Compras: ['/', '/projects', '/quotes', '/customers', '/inventory', '/chat', '/purchasing', '/billing'],
  Producción: ['/', '/chat', '/inventory', '/quality', '/technicians', '/production'],
  Calidad: ['/', '/chat', '/quality', '/technicians', '/production'],
  // Rol por defecto del schema (DEFAULT 'Operador'). Le damos el mismo
  // acceso de Producción para que pueda ver el piso, su KPI y el chat.
  Operador: ['/', '/chat', '/inventory', '/quality', '/technicians', '/production'],
  // Los técnicos viven en /technician-portal (su dashboard exclusivo) y
  // pueden saltar a /chat para discutir piezas. /technicians lo dejamos
  // permitido sólo para que el redirect del sidebar no rompa: el
  // ProtectedRoute los redirige a /technician-portal al detectar el rol.
  Técnico: ['/technician-portal', '/chat', '/technicians'],
};

/** Normaliza un rol guardado en BD para tolerar variaciones simples (acentos,
 *  espacios extra, mayúsculas). Si después de normalizar coincide con una
 *  clave conocida, la devuelve; si no, devuelve el original. */
function resolveRole(role: string): string {
  if (ROLE_ACCESS[role]) return role;
  const norm = role
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .trim();
  // Coincidencia tolerante por nombre canónico.
  if (norm === 'administracion' || norm.includes('admin') && norm.includes('pm'))
    return 'Administración / PM';
  if (norm === 'administrador') return 'Administrador';
  if (norm === 'disenador' || norm === 'diseno' || norm === 'diseño') return 'Diseñador';
  if (norm === 'compras') return 'Compras';
  if (norm === 'produccion') return 'Producción';
  if (norm === 'calidad') return 'Calidad';
  if (norm === 'operador') return 'Operador';
  if (norm === 'tecnico' || norm.startsWith('tecnico')) return 'Técnico';
  return role;
}

/** Rutas siempre permitidas a cualquier usuario autenticado (no se restringen
 *  ni con permisos por usuario). */
const ALWAYS_ALLOWED = ['/', '/chat', '/subscription'];

/**
 * Devuelve true si el usuario puede entrar a la ruta.
 *
 * @param role          rol del usuario (matriz por rol, fallback).
 * @param path          ruta a evaluar.
 * @param overrides     permisos por usuario (rutas permitidas). Si se pasa una
 *                      lista NO vacía, define el acceso en lugar del rol (más
 *                      las rutas siempre permitidas). Vacío/undefined = usa rol.
 */
export function canAccessPath(role: string | undefined, path: string, overrides?: string[] | null): boolean {
  if (!role) return false;
  // La suscripción es accesible para cualquier usuario autenticado.
  if (path.startsWith('/subscription')) return true;

  // Permisos por usuario: si existen, mandan sobre el rol.
  if (overrides && overrides.length > 0) {
    const list = [...ALWAYS_ALLOWED, ...overrides];
    return list.some(a => path === a || (a !== '/' && path.startsWith(a + '/')));
  }

  const resolved = resolveRole(role);
  const allowed = ROLE_ACCESS[resolved] ?? FALLBACK_ACCESS;
  if (allowed.includes('ALL')) return true;
  // Match exacto o prefijo (ej. /projects/123 cae bajo /projects)
  return allowed.some(a => path === a || (a !== '/' && path.startsWith(a + '/')));
}

/** Módulos asignables a un usuario (permisos por usuario). El Dashboard y el
 *  Chat están siempre disponibles, por eso no se listan aquí. */
export const ASSIGNABLE_MODULES: { path: string; label: string }[] = [
  { path: '/customers',   label: 'Clientes' },
  { path: '/quotes',      label: 'Cotizaciones' },
  { path: '/inventory',   label: 'Inventario' },
  { path: '/projects',    label: 'Proyectos' },
  { path: '/design',      label: 'Diseño' },
  { path: '/purchasing',  label: 'Compras' },
  { path: '/production',  label: 'Producción' },
  { path: '/quality',     label: 'Calidad' },
  { path: '/shipping',    label: 'Embarques' },
  { path: '/pmo',         label: 'PMO' },
  { path: '/technicians', label: 'Técnicos' },
  { path: '/personnel',   label: 'Personal' },
  { path: '/billing',     label: 'Facturación' },
];

/** Ruta home / fallback adecuado para cada rol — la primera ruta accesible. */
export function defaultRouteForRole(role: string | undefined): string {
  if (!role) return '/login';
  const resolved = resolveRole(role);
  // Caso especial: los técnicos siempre van a su portal exclusivo, sin
  // pasar por el dashboard administrativo.
  if (resolved === 'Técnico') return '/technician-portal';
  const allowed = ROLE_ACCESS[resolved] ?? FALLBACK_ACCESS;
  if (allowed.includes('ALL')) return '/';
  // Preferimos siempre el dashboard como home cuando esté permitido (en vez
  // del antiguo /chat, que dejaba al usuario "atrapado" si no podía ver nada).
  if (allowed.includes('/')) return '/';
  return allowed[0] ?? '/';
}
