import React from 'react';
import { LogOut, Settings, Shield, UserCircle, Search, Bell, Webhook } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--color-app-border)] bg-white shrink-0">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <input
            type="text"
            placeholder="Buscar proyectos, partes, órdenes..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] text-sm text-[var(--color-app-text)] placeholder:text-[var(--color-app-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {!isSupabaseConfigured && (
          <span
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-app-warning)] bg-[var(--color-app-warning-soft)] px-2.5 py-1 rounded-md"
            title="Conecta Supabase configurando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-warning)]" />
            Modo demo
          </span>
        )}
        <button
          type="button"
          className="relative h-9 w-9 inline-flex items-center justify-center rounded-md text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)] transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-app-danger)]" />
        </button>

        <div className="h-6 w-px bg-[var(--color-app-border)]" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-md hover:bg-[var(--color-app-surface-alt)] transition-colors">
              <div className="h-7 w-7 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-xs font-semibold">
                {user?.avatar || user?.name?.[0] || 'U'}
              </div>
              <div className="hidden md:flex flex-col text-left leading-tight">
                <span className="text-sm font-medium text-[var(--color-app-text)]">{user?.name}</span>
                <span className="text-[11px] text-[var(--color-app-text-muted)]">{user?.role}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white border border-[var(--color-app-border)] text-[var(--color-app-text)] shadow-md">
            <DropdownMenuLabel className="px-3 py-2">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-[var(--color-app-text-muted)]">{user?.department}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--color-app-border)]" />
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="gap-2 cursor-pointer"
            >
              <UserCircle className="h-4 w-4 text-[var(--color-app-text-muted)]" />
              <span>Mi perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="gap-2 cursor-pointer"
            >
              <Shield className="h-4 w-4 text-[var(--color-app-text-muted)]" />
              <span>Seguridad</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="gap-2 cursor-pointer"
            >
              <Settings className="h-4 w-4 text-[var(--color-app-text-muted)]" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/settings/integrations')}
              className="gap-2 cursor-pointer"
            >
              <Webhook className="h-4 w-4 text-[var(--color-app-text-muted)]" />
              <span>Integraciones (n8n)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--color-app-border)]" />
            <DropdownMenuItem
              onClick={logout}
              className="gap-2 cursor-pointer text-[var(--color-app-danger)] focus:text-[var(--color-app-danger)]"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
