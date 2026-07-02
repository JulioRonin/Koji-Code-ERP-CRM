import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  ShoppingCart,
  Ruler,
  Factory,
  ShieldCheck,
  MessageSquare,
  FileText,
  Settings,
  Users,
  HardHat,
  Truck,
  FileBarChart,
  Calculator,
  Boxes,
  Layers,
  Contact,
  PiggyBank,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { moduleKeyForPath } from '@/lib/saas';
import { canAccessPath } from '@/lib/permissions';

type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { name: 'Dashboard',    path: '/',            icon: LayoutDashboard },
  { name: 'Clientes',     path: '/customers',   icon: Contact },
  { name: 'Cotizaciones', path: '/quotes',      icon: Calculator },
  { name: 'Inventario',   path: '/inventory',   icon: Boxes },
  { name: 'Proyectos',    path: '/projects',    icon: FolderKanban },
  { name: 'Diseño',       path: '/design',      icon: Ruler },
  { name: 'Compras',      path: '/purchasing',  icon: ShoppingCart },
  { name: 'Producción',   path: '/production',  icon: Factory },
  { name: 'Calidad',      path: '/quality',     icon: ShieldCheck },
  { name: 'Embarques',    path: '/shipping',    icon: Truck },
  { name: 'PMO',          path: '/pmo',         icon: FileBarChart },
  { name: 'Técnicos',     path: '/technicians', icon: HardHat },
  { name: 'Personal',     path: '/personnel',   icon: Users },
  { name: 'Chat',         path: '/chat',        icon: MessageSquare },
  { name: 'Facturación',  path: '/billing',     icon: FileText },
  { name: 'Finanzas',     path: '/finance',     icon: PiggyBank },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { company } = useCompany();
  const { isEnabled } = useTenant();
  const brandName = company.commercial_name || company.legal_name || 'Empresa';
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'E';

  // Para técnicos, "Técnicos" apunta a su portal exclusivo en lugar del
  // dashboard administrativo de /technicians.
  const filteredNavItems = navItems
    .filter(item => canAccessPath(user?.role, item.path, user?.permissions))
    // Gating por módulos habilitados de la empresa (tenant). Si la ruta no
    // mapea a un módulo, se muestra.
    .filter(item => {
      const mk = moduleKeyForPath(item.path);
      return mk ? isEnabled(mk) : true;
    })
    .map(item =>
      user?.role === 'Técnico' && item.path === '/technicians'
        ? { ...item, name: 'Mi portal', path: '/technician-portal' }
        : item
    );
  const canSeeSettings = user?.role === 'Administrador' || user?.role === 'Administración / PM';

  return (
    <>
      {/* Overlay para mobile */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed lg:static top-0 bottom-0 left-0 z-50',
          'w-64 lg:w-60 bg-[var(--color-app-sidebar)] text-[var(--color-app-text-on-dark)]',
          'flex flex-col shrink-0 border-r border-[var(--color-app-sidebar-hover)]',
          'transform transition-transform duration-200 ease-out',
          'lg:transform-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand + close (mobile) */}
        <div className="h-16 flex items-center justify-between pl-5 pr-3 border-b border-[var(--color-app-sidebar-hover)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={brandName}
                className="h-8 w-8 rounded-md object-cover bg-white"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-[var(--color-app-primary)] flex items-center justify-center text-white font-bold text-sm shrink-0 font-display">
                {brandInitial}
              </div>
            )}
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold text-white truncate font-display">{brandName}</span>
              <span className="text-[10px] text-slate-400 truncate uppercase tracking-wider font-mono">
                {company.tagline || 'powered by KANRI'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-white/10"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overscroll-contain">
          {filteredNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isActive ? 'text-[var(--color-app-primary-soft)]' : 'text-slate-400'
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        {(canSeeSettings || user?.isPlatformOwner) && (
          <div className="px-2 py-3 border-t border-[var(--color-app-sidebar-hover)] shrink-0 space-y-1">
            {/* Panel de plataforma: SOLO para el dueño de la plataforma (KANRI),
                no para los admins de las empresas cliente. */}
            {user?.isPlatformOwner && (
              <NavLink
                to="/platform"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  )
                }
              >
                <Layers className="h-4 w-4 text-slate-400" />
                <span>Plataforma</span>
              </NavLink>
            )}
            {canSeeSettings && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                )
              }
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Configuración</span>
            </NavLink>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
