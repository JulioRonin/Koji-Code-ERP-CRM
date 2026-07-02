import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto secundario (ej. stock, SKU) mostrado a la derecha. */
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

/**
 * Selector buscable: muestra un campo tipo botón; al abrir, despliega un
 * buscador que filtra por texto + la lista de opciones. Útil para catálogos
 * grandes (inventario, clientes) donde un <select> nativo es incómodo.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecciona…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  className,
  allowClear = true,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find(o => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    // foco al buscador al abrir
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full h-9 px-2.5 rounded-md border border-[var(--color-app-border-strong)] bg-white',
          'text-xs flex items-center justify-between gap-2 text-left',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 disabled:opacity-60',
        )}
      >
        <span className={cn('truncate', !selected && 'text-[var(--color-app-text-subtle)]')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {allowClear && selected && (
            <X
              className="h-3.5 w-3.5 text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]"
              onClick={e => { e.stopPropagation(); onChange(null); }}
            />
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-app-text-subtle)]" />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-md border border-[var(--color-app-border)] bg-white shadow-lg">
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-[var(--color-app-border)]">
            <Search className="h-3.5 w-3.5 text-[var(--color-app-text-subtle)] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs bg-transparent focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--color-app-text-muted)]">{emptyText}</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={cn(
                    'w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-[var(--color-app-surface-alt)]',
                    o.value === value && 'bg-[var(--color-app-primary-soft)]/40',
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Check className={cn('h-3.5 w-3.5 shrink-0', o.value === value ? 'opacity-100 text-[var(--color-app-primary)]' : 'opacity-0')} />
                    <span className="truncate">{o.label}</span>
                  </span>
                  {o.hint && <span className="text-[10px] text-[var(--color-app-text-muted)] shrink-0 tabular-nums">{o.hint}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
