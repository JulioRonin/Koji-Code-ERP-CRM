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
  addDays, 
  eachDayOfInterval,
  isValid
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface CyberDatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function CyberDatePicker({ value, onChange, placeholder = "Seleccionar fecha", className }: CyberDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value && isValid(value) ? value : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const onDateClick = (day: Date) => {
    onChange(day);
    setIsOpen(false);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyber-border bg-black/40">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 hover:text-cyber-neon transition-colors text-cyber-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyber-neon">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 hover:text-cyber-neon transition-colors text-cyber-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];
    return (
      <div className="grid grid-cols-7 mb-2 border-b border-white/5">
        {days.map((day, idx) => (
          <div key={idx} className="text-center text-[8px] font-mono font-bold uppercase py-2 text-cyber-muted">
            {day}
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

    const rows = [];
    let days = [];
    let day = startDate;

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-1 p-2">
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
                "h-8 w-8 text-[10px] font-mono flex items-center justify-center rounded-sm transition-all relative overflow-hidden group",
                !isCurrentMonth ? "text-white/10" : "text-white/70 hover:text-cyber-neon",
                isSelected && "bg-cyber-neon text-cyber-dark font-bold shadow-[0_0_10px_var(--color-neon-cyan)]",
                isToday && !isSelected && "border border-cyber-neon/30 text-cyber-neon"
              )}
            >
              {format(date, 'd')}
              {isSelected && (
                <motion.div 
                  layoutId="active-bg"
                  className="absolute inset-0 bg-cyber-neon -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div 
        className={cn(
          "flex items-center justify-between w-full h-10 px-3 bg-cyber-panel border border-cyber-border rounded-sm cursor-pointer transition-all hover:border-cyber-neon font-mono text-[10px] group",
          isOpen && "border-cyber-neon shadow-[0_0_10px_rgba(0,240,255,0.2)]"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className={cn("h-3 w-3 text-cyber-muted transition-colors", isOpen || value ? "text-cyber-neon" : "")} />
          <span className={cn(value ? "text-white font-bold" : "text-cyber-muted uppercase tracking-widest")}>
            {value && isValid(value) ? format(value, 'dd / MM / yyyy') : placeholder}
          </span>
        </div>
        {value && (
          <div 
            className="p-1 hover:text-cyber-red transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
          >
            <X className="h-3 w-3" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-50 left-0 top-full w-64 bg-cyber-panel border border-cyber-neon shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(0,240,255,0.1)] backdrop-blur-xl rounded-sm overflow-hidden"
          >
            {renderHeader()}
            <div className="p-2">
              {renderDays()}
              {renderCells()}
            </div>
            <div className="p-3 border-t border-white/5 bg-black/20 flex justify-between">
              <button
                type="button"
                onClick={() => onDateClick(new Date())}
                className="text-[8px] font-mono text-cyber-neon hover:underline uppercase tracking-widest font-bold"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                }}
                className="text-[8px] font-mono text-cyber-red hover:underline uppercase tracking-widest font-bold"
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
