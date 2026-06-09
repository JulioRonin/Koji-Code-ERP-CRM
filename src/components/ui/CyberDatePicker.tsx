import React, { useState, useRef, useEffect } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function CyberDatePicker({ value, onChange, placeholder = 'Seleccionar fecha', className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value && isValid(value) ? value : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const onDateClick = (day: Date) => {
    onChange(day);
    setIsOpen(false);
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-app-border)]">
      <button
        type="button"
        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-medium capitalize">
        {format(currentMonth, 'MMMM yyyy', { locale: es })}
      </span>
      <button
        type="button"
        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  const renderDays = () => {
    const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
    return (
      <div className="grid grid-cols-7 mb-1">
        {days.map(d => (
          <div key={d} className="text-center text-xs font-medium text-[var(--color-app-text-muted)] py-1.5">
            {d}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-0.5 p-1">
        {allDays.map((date, i) => {
          const isSelected = value && isSameDay(date, value);
          const isCurrentMonth = isSameMonth(date, monthStart);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={i}
              type="button"
              onClick={() => onDateClick(date)}
              className={cn(
                'h-8 w-8 text-sm flex items-center justify-center rounded-md transition-colors',
                !isCurrentMonth && 'text-[var(--color-app-text-subtle)]',
                isCurrentMonth && !isSelected && 'text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-alt)]',
                isSelected && 'bg-[var(--color-app-primary)] text-white font-medium',
                isToday && !isSelected && 'ring-1 ring-[var(--color-app-primary)]/40 text-[var(--color-app-primary)] font-medium'
              )}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <div
        className={cn(
          'flex items-center justify-between w-full h-9 px-3 bg-white border border-[var(--color-app-border-strong)] rounded-md cursor-pointer transition-colors hover:border-[var(--color-app-primary)]/50 group',
          isOpen && 'border-[var(--color-app-primary)] ring-2 ring-[var(--color-app-primary)]/30'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
          <span className={cn('text-sm', value ? 'text-[var(--color-app-text)]' : 'text-[var(--color-app-text-subtle)]')}>
            {value && isValid(value) ? format(value, 'dd / MM / yyyy') : placeholder}
          </span>
        </div>
        {value && (
          <button
            type="button"
            className="p-1 text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)] opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 4 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 top-full w-72 bg-white border border-[var(--color-app-border)] shadow-lg rounded-md overflow-hidden"
          >
            {renderHeader()}
            <div className="p-1">
              {renderDays()}
              {renderCells()}
            </div>
            <div className="px-3 py-2 border-t border-[var(--color-app-border)] flex justify-between text-xs">
              <button
                type="button"
                onClick={() => onDateClick(new Date())}
                className="text-[var(--color-app-primary)] hover:underline font-medium"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className="text-[var(--color-app-text-muted)] hover:text-[var(--color-app-danger)] font-medium"
              >
                Borrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
