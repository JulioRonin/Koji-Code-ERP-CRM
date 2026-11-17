import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Shield, UserCircle, Webhook, Home, CreditCard, Layers, Sparkles, RotateCcw, DoorOpen } from 'lucide-react';
import { isDemoSession, isSupabaseConfigured } from '@/lib/supabase';
import { enterDemo, exitDemo, seedDemoData } from '@/lib/demo/seed';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function initialsOf(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Píldora de usuario (avatar + nombre + rol) con el menú de cuenta. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Administrador' || user?.role === 'Administración / PM';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-3 rounded-full transition-colors hover:bg-[var(--color-app-surface-alt)] shrink-0',
            compact ? 'p-0.5' : 'pl-1 pr-4 py-1',
          )}
          aria-label="Menú de cuenta"
        >
          <span className="h-11 w-11 rounded-full bg-[#D7DCE6] text-[var(--color-app-text)] flex items-center justify-center text-[15px] font-medium">
            {initialsOf(user?.name)}
          </span>
          {!compact && (
            <span className="hidden xl:flex flex-col text-left leading-tight min-w-0">
              <span className="text-[15px] truncate max-w-[160px]">{user?.name}</span>
              <span className="text-xs text-[var(--color-app-text-muted)] truncate max-w-[160px]">{user?.role}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="px-3 py-2">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs font-normal text-[var(--color-app-text-muted)] truncate">{user?.role}{user?.department ? ` · ${user.department}` : ''}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--color-app-border)]" />
        <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2.5">
          <UserCircle className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2.5">
          <Shield className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Seguridad
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2.5">
            <Settings className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Configuración
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/settings/integrations')} className="gap-2.5">
          <Webhook className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Integraciones (n8n)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/subscription')} className="gap-2.5">
          <CreditCard className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Suscripción
        </DropdownMenuItem>
        {user?.isPlatformOwner && (
          <DropdownMenuItem onClick={() => navigate('/platform')} className="gap-2.5">
            <Layers className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Plataforma
          </DropdownMenuItem>
        )}
        {/* Demo con datos e imágenes para explorar toda la plataforma (usuario maestro) */}
        {user?.isPlatformOwner && (
          <>
            <DropdownMenuSeparator className="bg-[var(--color-app-border)]" />
            {isDemoSession || !isSupabaseConfigured ? (
              <DropdownMenuItem
                onClick={() => {
                  if (!window.confirm('¿Restablecer la demo? Se recargan los datos de ejemplo y se pierden los cambios hechos en ella.')) return;
                  seedDemoData();
                  window.location.assign('/');
                }}
                className="gap-2.5"
              >
                <RotateCcw className="h-4 w-4 text-[var(--color-app-text-muted)]" /> {isDemoSession ? 'Restablecer datos de la demo' : 'Cargar datos de demostración'}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  if (window.confirm('Entrarás a una demo con datos e imágenes de ejemplo. Tu cuenta y la base real no se modifican. ¿Continuar?')) enterDemo();
                }}
                className="gap-2.5"
              >
                <Sparkles className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Explorar demo
              </DropdownMenuItem>
            )}
            {isDemoSession && (
              <DropdownMenuItem onClick={exitDemo} className="gap-2.5">
                <DoorOpen className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Salir de la demo
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuItem
          onClick={() => {
            try { sessionStorage.removeItem('kanri_entered'); } catch { /* ignore */ }
            navigate('/welcome');
          }}
          className="gap-2.5"
        >
          <Home className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Pantalla de inicio
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--color-app-border)]" />
        <DropdownMenuItem onClick={logout} className="gap-2.5 text-[var(--color-app-danger)] focus:text-[var(--color-app-danger)]">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
