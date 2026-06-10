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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  departments: string[];
};

const navItems: NavItem[] = [
  { name: 'Dashboard',  path: '/',            icon: LayoutDashboard,  departments: ['ALL'] },
  { name: 'Cotizaciones', path: '/quotes',    icon: Calculator,       departments: ['Administrador', 'Administración / PM', 'Compras'] },
  { name: 'Proyectos',  path: '/projects',    icon: FolderKanban,     departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción', 'Diseño'] },
  { name: 'Diseño',     path: '/design',      icon: Ruler,            departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción', 'Diseño'] },
  { name: 'Compras',    path: '/purchasing',  icon: ShoppingCart,     departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción'] },
  { name: 'Producción', path: '/production',  icon: Factory,          departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción'] },
  { name: 'Calidad',    path: '/quality',     icon: ShieldCheck,      departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción', 'Calidad'] },
  { name: 'Embarques',  path: '/shipping',    icon: Truck,            departments: ['Administrador', 'Administración / PM', 'Producción'] },
  { name: 'PMO',        path: '/pmo',         icon: FileBarChart,     departments: ['Administrador', 'Administración / PM', 'Producción'] },
  { name: 'Técnicos',   path: '/technicians', icon: HardHat,          departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción'] },
  { name: 'Personal',   path: '/personnel',   icon: Users,            departments: ['Administrador', 'Administración / PM', 'Compras'] },
  { name: 'Chat',       path: '/chat',        icon: MessageSquare,    departments: ['ALL'] },
  { name: 'Facturación', path: '/billing',    icon: FileText,         departments: ['Administrador', 'Administración / PM', 'Compras'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item =>
    item.departments.includes('ALL') || (user && item.departments.includes(user.department))
  );

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
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-[var(--color-app-primary)] flex items-center justify-center text-white font-bold text-sm">
              K
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white">Koji Code</span>
              <span className="text-[10px] text-slate-400">ERP · Manufactura</span>
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
        <div className="px-2 py-3 border-t border-[var(--color-app-sidebar-hover)] shrink-0">
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
        </div>
      </aside>
    </>
  );
}
