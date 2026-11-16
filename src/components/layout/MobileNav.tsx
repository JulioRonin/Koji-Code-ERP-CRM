import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { CHAT_MODULE, HOME_MODULE, SETTINGS_MODULE, isActivePath, visibleAreas, type NavModule } from '@/lib/navigation';
import { canAccessPath } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { BrandTile } from './TopBar';

/** Menú en pantallas chicas: panel lateral con las áreas y sus módulos. */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { company } = useCompany();
  const { isEnabled } = useTenant();
  const { pathname } = useLocation();
  const areas = visibleAreas(user, isEnabled);
  const isAdmin = user?.role === 'Administrador' || user?.role === 'Administración / PM';
  const general: NavModule[] = [
    ...(canAccessPath(user?.role, '/', user?.permissions) ? [HOME_MODULE] : []),
    ...(canAccessPath(user?.role, '/chat', user?.permissions) ? [CHAT_MODULE] : []),
    ...(isAdmin ? [SETTINGS_MODULE] : []),
  ];

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const item = (m: NavModule) => {
    const active = isActivePath(pathname, m.path);
    return (
      <NavLink
        key={m.path}
        to={m.path}
        end={m.path === '/'}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] transition-colors',
          active ? 'bg-[var(--color-app-ink)] text-white' : 'hover:bg-white',
        )}
      >
        <m.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
        {m.name}
      </NavLink>
    );
  };

  return (
    <div className={cn('xl:hidden fixed inset-0 z-50', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
      <div
        className={cn('absolute inset-0 bg-[#16181D]/35 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[86%] max-w-[340px] bg-[var(--color-app-bg)] rounded-r-[32px] flex flex-col',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <BrandTile size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] truncate">{company.commercial_name || company.legal_name}</p>
            <p className="text-xs text-[var(--color-app-text-muted)] truncate">powered by KANRI</p>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center" aria-label="Cerrar menú">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 pb-6 space-y-5">
          {general.length > 0 && <div className="space-y-0.5">{general.map(item)}</div>}
          {areas.map(a => (
            <div key={a.name}>
              <p className="px-3.5 pb-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-app-text-subtle)]">{a.name}</p>
              <div className="space-y-0.5">{a.modules.map(item)}</div>
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
