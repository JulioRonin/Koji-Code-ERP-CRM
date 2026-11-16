import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { SETTINGS_MODULE, isActivePath, railModules } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const circle = (active: boolean) =>
  cn(
    'group relative h-14 w-14 rounded-full flex items-center justify-center transition-colors',
    active ? 'bg-[var(--color-app-ink)] text-white' : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text)] hover:bg-white',
  );

/** Etiqueta flotante al pasar el cursor (el riel solo muestra íconos). */
function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--color-app-ink)] px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 z-30">
      {label}
    </span>
  );
}

/** Riel de accesos rápidos (escritorio/tablet). */
export function NavRail() {
  const { user } = useAuth();
  const { isEnabled } = useTenant();
  const { pathname } = useLocation();
  const items = railModules(user, isEnabled);
  const isAdmin = user?.role === 'Administrador' || user?.role === 'Administración / PM';

  return (
    <aside className="hidden md:flex sticky top-0 self-start flex-col items-center gap-3 pt-1 pb-6 min-h-[calc(100dvh-140px)]" aria-label="Accesos rápidos">
      {items.map(m => {
        const active = isActivePath(pathname, m.path);
        return (
          <NavLink key={m.path} to={m.path} end={m.path === '/'} className={circle(active)} aria-label={m.name} aria-current={active ? 'page' : undefined}>
            <m.icon className="h-5 w-5" strokeWidth={1.7} />
            <Tip label={m.name} />
          </NavLink>
        );
      })}
      {isAdmin && (
        <NavLink to={SETTINGS_MODULE.path} className={cn(circle(isActivePath(pathname, '/settings')), 'mt-auto')} aria-label="Configuración">
          <SETTINGS_MODULE.icon className="h-5 w-5" strokeWidth={1.7} />
          <Tip label="Configuración" />
        </NavLink>
      )}
    </aside>
  );
}
