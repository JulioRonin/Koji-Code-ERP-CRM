import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { usePresence } from '@/contexts/PresenceContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initialsOf } from './UserMenu';

export const AVATAR_TINTS = ['#D7DCE6', '#E6DCCF', '#D5E4DB', '#E8DDE9', '#DCE6EE', '#EEE6D2'];
export const tintFor = (id: string) => AVATAR_TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];

/** Avatares del equipo conectado (como en el prototipo) con mensaje directo. */
export function OnlineUsers() {
  const { online } = usePresence();
  const navigate = useNavigate();
  if (online.length === 0) return null;
  const shown = online.slice(0, 3);
  const extra = online.length - shown.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hidden lg:flex items-center gap-2.5 rounded-full pr-2 hover:bg-[var(--color-app-surface-alt)] transition-colors" aria-label="Equipo conectado">
        <span className="flex">
          {shown.map((u, i) => (
            <span
              key={u.id}
              className="relative h-11 w-11 rounded-full border-[3px] border-[var(--color-app-bg)] flex items-center justify-center text-[13px]"
              style={{ background: tintFor(u.id), marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }}
              title={u.name}
            >
              {initialsOf(u.name)}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#15803D] border-2 border-[var(--color-app-bg)]" />
            </span>
          ))}
          {extra > 0 && (
            <span className="h-11 w-11 rounded-full border-[3px] border-[var(--color-app-bg)] bg-[var(--color-app-ink)] text-white flex items-center justify-center text-[13px]" style={{ marginLeft: -12 }}>
              +{extra}
            </span>
          )}
        </span>
        <span className="hidden 2xl:inline text-sm text-[var(--color-app-text-muted)] whitespace-nowrap">en planta</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-[22px]">
        <DropdownMenuLabel className="px-3.5 pt-2 pb-1 text-[11px] font-normal uppercase tracking-[0.08em] text-[var(--color-app-text-subtle)]">
          En línea · {online.length}
        </DropdownMenuLabel>
        <div className="max-h-80 overflow-y-auto">
          {online.map(u => (
            <DropdownMenuItem key={u.id} onClick={() => navigate(`/chat?dm=${encodeURIComponent(u.id)}`)} className="gap-3 py-2.5">
              <span className="relative h-9 w-9 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: tintFor(u.id) }}>
                {initialsOf(u.name)}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#15803D] border-2 border-white" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{u.name}</span>
                <span className="block text-xs text-[var(--color-app-text-muted)] truncate">{u.role}</span>
              </span>
              <MessageSquare className="h-4 w-4 text-[var(--color-app-text-muted)]" />
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="bg-[var(--color-app-border)]" />
        <DropdownMenuItem onClick={() => navigate('/chat')} className="justify-center text-sm">Abrir chat del equipo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
