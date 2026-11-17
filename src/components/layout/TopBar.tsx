import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Menu, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { areaForPath, isActivePath, visibleAreas } from '@/lib/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';
import { OnlineUsers } from './OnlineUsers';

/** Tile de marca: logo de la empresa o sus iniciales sobre tinta. */
export function BrandTile({ size = 44 }: { size?: number }) {
  const { company } = useCompany();
  const name = company.commercial_name || company.legal_name || 'Empresa';
  const initials = name.replace(/\b(S\.?\s?A\.?|DE|RL|CV|S\.?C\.?)\b/gi, '').trim().split(/\s+/)[0]?.slice(0, 3).toUpperCase() || 'K';
  return company.logo_url ? (
    <img
      src={company.logo_url}
      alt={name}
      className="rounded-[14px] object-contain bg-white shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="rounded-[14px] bg-[var(--color-app-ink)] text-white flex items-center justify-center font-semibold tracking-[0.06em] shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </span>
  );
}

const pill = (active: boolean) =>
  cn(
    'h-[52px] px-5 rounded-full inline-flex items-center gap-2 text-[15px] transition-colors whitespace-nowrap',
    active
      ? 'bg-[var(--color-app-ink)] text-white'
      : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text)] hover:bg-white data-[state=open]:bg-white',
  );

const dot = (active: boolean) => (
  <span
    className="h-[7px] w-[7px] rounded-full"
    style={{ background: active ? 'var(--color-app-accent)' : '#A3A8B1' }}
  />
);

interface TopBarProps {
  onOpenNav: () => void;
  onOpenSearch: () => void;
}

export function TopBar({ onOpenNav, onOpenSearch }: TopBarProps) {
  const { user } = useAuth();
  const { isEnabled } = useTenant();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const areas = visibleAreas(user, isEnabled);
  const current = areaForPath(pathname);

  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-3 md:px-6 md:pt-5 shrink-0">
      <Link to="/" className="mr-1 xl:mr-3" aria-label="Inicio">
        <BrandTile />
      </Link>

      {/* Áreas (escritorio) */}
      <nav className="hidden xl:flex items-center gap-2 shrink-0" aria-label="Áreas">
        <Link to="/" className={pill(current === 'Inicio')} aria-current={current === 'Inicio' ? 'page' : undefined}>
          {dot(current === 'Inicio')} Inicio
        </Link>
        {areas.map(a => {
          const active = current === a.name;
          return (
            <DropdownMenu key={a.name}>
              <DropdownMenuTrigger className={pill(active)}>
                {dot(active)} {a.name}
                <ChevronDown className="h-3.5 w-3.5 opacity-80" strokeWidth={1.8} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="min-w-[250px] rounded-[22px]">
                <DropdownMenuLabel className="px-3.5 pt-2 pb-1 text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--color-app-text-subtle)]">
                  {a.name}
                </DropdownMenuLabel>
                {a.modules.map(m => (
                  <DropdownMenuItem
                    key={m.path}
                    onClick={() => navigate(m.path)}
                    className={cn(
                      'justify-between gap-6 px-3.5 py-3 text-[15px] rounded-[14px]',
                      isActivePath(pathname, m.path) && 'bg-[var(--color-app-surface-muted)]',
                    )}
                  >
                    <span>{m.name}</span>
                    <span className="font-mono text-[11px] text-[var(--color-app-text-subtle)]">{m.path}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Equipo conectado (clic → mensaje directo) */}
      <OnlineUsers />

      {/* Búsqueda / paleta de comandos */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden md:flex h-[52px] w-[52px] 2xl:w-[280px] shrink-0 items-center justify-center 2xl:justify-start gap-3 rounded-full bg-[var(--color-app-surface-alt)] hover:bg-white transition-colors 2xl:pl-5 2xl:pr-2 text-[15px] text-[var(--color-app-text-muted)]"
        aria-label="Buscar (Ctrl+K)"
      >
        <Search className="h-4 w-4 text-[var(--color-app-text)]" strokeWidth={1.8} />
        <span className="hidden 2xl:inline flex-1 text-left truncate">Proyecto, pieza, OC, cliente…</span>
        <kbd className="hidden 2xl:inline font-mono text-[11px] text-[var(--color-app-text-muted)] bg-white rounded-lg px-2 py-1">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={onOpenSearch}
        className="md:hidden h-11 w-11 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center"
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" strokeWidth={1.8} />
      </button>

      {!isSupabaseConfigured && (
        <span
          className="hidden 2xl:inline-flex items-center h-9 px-3 rounded-full border border-dashed whitespace-nowrap border-[var(--color-app-border-strong)] text-xs text-[var(--color-app-text-muted)]"
          title="Conecta Supabase configurando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY"
        >
          Modo demo
        </span>
      )}

      <button
        type="button"
        className="relative h-11 w-11 md:h-[52px] md:w-[52px] rounded-full bg-[var(--color-app-surface-alt)] hover:bg-white transition-colors flex items-center justify-center shrink-0"
        aria-label="Notificaciones"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        <span className="absolute top-3 right-3.5 h-2 w-2 rounded-full bg-[#E2401F]" />
      </button>

      <UserMenu />

      <button
        type="button"
        onClick={onOpenNav}
        className="xl:hidden h-11 w-11 rounded-full bg-[var(--color-app-ink)] text-white flex items-center justify-center shrink-0"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} />
      </button>
    </header>
  );
}
