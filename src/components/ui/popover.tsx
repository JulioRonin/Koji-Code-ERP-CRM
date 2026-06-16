import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PopoverProps {
  /** Elemento que dispara la apertura (el trigger). */
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  /** Contenido del panel. */
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Popover ligero con cierre al hacer click afuera o Escape. No depende de
 * Radix; suficiente para los paneles de filtro / agrupación de las tablas.
 */
export function Popover({ trigger, children, align = 'start', className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      {trigger({ open, toggle: () => setOpen(v => !v) })}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 min-w-[280px] rounded-lg border border-[var(--color-app-border)] bg-white shadow-lg p-3',
            align === 'end' ? 'right-0' : 'left-0',
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
