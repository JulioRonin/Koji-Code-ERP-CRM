import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FolderKanban, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useProjects } from '@/lib/api';
import { CHAT_MODULE, HOME_MODULE, SETTINGS_MODULE, visibleAreas } from '@/lib/navigation';
import { canAccessPath } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface Result {
  key: string;
  label: string;
  hint: string;
  path: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda global (⌘K / Ctrl+K): módulos y proyectos. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden top-[18%] translate-y-0 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Buscar en KANRI</DialogTitle>
        {open && <PaletteBody onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnabled } = useTenant();
  const canProjects = canAccessPath(user?.role, '/projects', user?.permissions);
  const { data: projects } = useProjects();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const modules = useMemo<Result[]>(() => {
    const isAdmin = user?.role === 'Administrador' || user?.role === 'Administración / PM';
    const areas = visibleAreas(user, isEnabled);
    const base = [
      HOME_MODULE,
      ...(canAccessPath(user?.role, '/chat', user?.permissions) ? [CHAT_MODULE] : []),
      ...(isAdmin ? [SETTINGS_MODULE] : []),
    ].map(m => ({ key: m.path, label: m.name, hint: 'General', path: m.path, icon: m.icon }));
    return [
      ...base,
      ...areas.flatMap(a => a.modules.map(m => ({ key: m.path, label: m.name, hint: a.name, path: m.path, icon: m.icon }))),
    ];
  }, [user, isEnabled]);

  const results = useMemo<Result[]>(() => {
    const t = norm(q.trim());
    const mods = modules.filter(m => !t || norm(m.label + ' ' + m.hint).includes(t));
    const projs: Result[] = canProjects && t.length >= 2
      ? projects
          .filter(p => norm(`${p.id} ${p.name} ${p.client_name}`).includes(t))
          .slice(0, 8)
          .map(p => ({ key: 'p-' + p.id, label: p.name, hint: `${p.id} · ${p.client_name}`, path: `/projects/${p.id}`, icon: FolderKanban }))
      : [];
    return [...mods, ...projs];
  }, [q, modules, projects, canProjects]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    navigate(r.path);
  };

  return (
    <div>
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[var(--color-app-border)]">
        <Search className="h-5 w-5 text-[var(--color-app-text-muted)]" strokeWidth={1.8} />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); go(results[sel]); }
          }}
          placeholder={canProjects ? 'Busca un módulo o un proyecto (folio, nombre, cliente)…' : 'Busca un módulo…'}
          className="flex-1 bg-transparent outline-none text-[16px] placeholder:text-[var(--color-app-text-subtle)]"
        />
        <kbd className="font-mono text-[11px] text-[var(--color-app-text-muted)] bg-[var(--color-app-surface-alt)] rounded-lg px-2 py-1">Esc</kbd>
      </div>
      <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--color-app-text-muted)]">Sin resultados para “{q}”.</p>
        ) : (
          results.map((r, i) => (
            <button
              key={r.key}
              data-idx={i}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(r)}
              className={cn(
                'w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors',
                i === sel ? 'bg-[var(--color-app-surface-muted)]' : '',
              )}
            >
              <span className="h-9 w-9 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center shrink-0">
                <r.icon className="h-4 w-4" strokeWidth={1.7} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] truncate">{r.label}</span>
                <span className="block text-xs text-[var(--color-app-text-muted)] truncate font-mono">{r.hint}</span>
              </span>
              {i === sel && <ArrowRight className="h-4 w-4 text-[var(--color-app-text-muted)]" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
