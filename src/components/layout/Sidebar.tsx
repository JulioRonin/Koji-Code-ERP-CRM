import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BarChart3, 
  FolderKanban, 
  ShoppingCart, 
  Ruler, 
  Factory, 
  Shield, 
  MessageSquare, 
  FileText, 
  Settings,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: BarChart3, departments: ['ALL'] },
  { name: 'Proyectos', path: '/projects', icon: FolderKanban, departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción', 'Diseño'] },
  { name: 'Compras', path: '/purchasing', icon: ShoppingCart, departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción'] },
  { name: 'Diseño', path: '/design', icon: Ruler, departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción', 'Diseño'] },
  { name: 'Producción', path: '/production', icon: Factory, departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción'] },
  { name: 'Técnicos', path: '/technicians', icon: Users, departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción'] },
  { name: 'Personal', path: '/personnel', icon: Users, departments: ['Administrador', 'Administración / PM', 'Compras'] },
  { name: 'Calidad', path: '/quality', icon: Shield, departments: ['Administrador', 'Administración / PM', 'Compras', 'Producción', 'Calidad'] },
  { name: 'Chat', path: '/chat', icon: MessageSquare, departments: ['ALL'] },
  { name: 'Facturación', path: '/billing', icon: FileText, departments: ['Administrador', 'Administración / PM', 'Compras'] },
];

export function Sidebar() {
  const { user } = useAuth();
  
  const filteredNavItems = navItems.filter(item => 
    item.departments.includes('ALL') || (user && item.departments.includes(user.department))
  );

  return (
    <aside className="w-64 bg-erp-sidebar border-r border-erp-purple/30 z-10 flex flex-col relative shrink-0 shadow-[2px_0_15px_rgba(176,38,255,0.1)]">
      {/* Logo */}
      <div className="h-24 flex items-center px-6 border-b border-erp-purple/20">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-erp-cyan text-glow tracking-wider leading-tight">KOJI CODE ERP</h1>
          <p className="text-[10px] font-mono text-erp-purple uppercase tracking-[0.2em] opacity-80 pl-0.5">by Ronin studio</p>
        </div>
      </div>

      <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center px-4 py-3 rounded-lg transition-colors group relative overflow-hidden",
                isActive 
                  ? "bg-gradient-to-r from-erp-cyan/20 to-transparent border-l-4 border-erp-cyan text-erp-text-bright rounded-r-lg shadow-[inset_10px_0_20px_rgba(0,240,255,0.1)]" 
                  : "text-erp-text hover:text-erp-text-bright hover:bg-erp-panel"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-erp-cyan shadow-[var(--shadow-glow-cyan)]"></div>
                )}
                <item.icon className={cn(
                  "w-6 h-6 mr-3 transition-colors",
                  isActive ? "text-erp-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]" : "text-erp-purple group-hover:text-erp-cyan"
                )} />
                <span className={cn(
                  "text-lg tracking-wide",
                  isActive ? "font-semibold text-glow" : "font-medium"
                )}>
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-erp-purple/20">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center px-4 py-3 rounded-lg transition-colors group relative overflow-hidden",
              isActive 
                ? "bg-gradient-to-r from-erp-cyan/20 to-transparent border-l-4 border-erp-cyan text-erp-text-bright rounded-r-lg shadow-[inset_10px_0_20px_rgba(0,240,255,0.1)]" 
                : "text-erp-text hover:text-erp-text-bright hover:bg-erp-panel"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-erp-cyan shadow-[var(--shadow-glow-cyan)]"></div>
              )}
              <Settings className={cn(
                "w-6 h-6 mr-3 transition-colors",
                isActive ? "text-erp-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]" : "text-erp-purple group-hover:text-erp-cyan"
              )} />
              <span className={cn(
                "text-lg tracking-wide",
                isActive ? "font-semibold text-glow" : "font-medium"
              )}>
                Configuración
              </span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
