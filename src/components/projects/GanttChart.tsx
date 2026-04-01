import React from 'react';
import { motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface GanttTask {
  id: string;
  name: string;
  department: 'Compras' | 'Diseño' | 'Producción' | 'Calidad';
  startDay: number; // Days from project start
  duration: number; // Duration in days
  progress: number; // 0 to 100
  status: 'pending' | 'in-progress' | 'completed';
}

interface GanttChartProps {
  startDate: string;
  tasks: GanttTask[];
}

const DEPARTMENT_COLORS = {
  Compras: 'var(--color-neon-purple)',
  Diseño: 'var(--color-neon-blue)',
  Producción: 'var(--color-neon-cyan)',
  Calidad: 'var(--color-neon-green, #10b981)',
};

export function GanttChart({ startDate, tasks }: GanttChartProps) {
  const projectStart = new Date(startDate);
  const totalDays = Math.max(...tasks.map(t => t.startDay + t.duration)) + 5;
  
  // Generate date markers for the header
  const dateMarkers = Array.from({ length: Math.ceil(totalDays / 5) + 1 }, (_, i) => i * 5);

  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-[var(--color-neon-cyan-dim)] scrollbar-track-transparent">
      <div className="min-w-[800px] relative font-mono">
        {/* Header: Dates */}
        <div className="flex border-b border-[var(--color-neon-cyan-dim)]/30 mb-8 pb-2">
          <div className="w-48 flex-shrink-0 font-bold uppercase tracking-widest text-[var(--color-text-muted)] text-xs">
            Departamento / Actividad
          </div>
          <div className="flex-1 relative h-6">
            {dateMarkers.map((day) => (
              <div 
                key={day} 
                className="absolute text-[10px] text-[var(--color-text-muted)] border-l border-[var(--color-neon-cyan-dim)]/20 h-full pl-1"
                style={{ left: `${(day / totalDays) * 100}%` }}
              >
                {format(addDays(projectStart, day), 'dd MMM', { locale: es })}
              </div>
            ))}
          </div>
        </div>

        {/* Grid Background */}
        <div className="absolute top-8 left-48 right-0 bottom-0 pointer-events-none">
          {dateMarkers.map((day) => (
            <div 
              key={`grid-${day}`} 
              className="absolute top-0 bottom-0 border-l border-[var(--color-neon-cyan-dim)]/5"
              style={{ left: `${(day / totalDays) * 100}%` }}
            />
          ))}
        </div>

        {/* Tasks */}
        <div className="space-y-6 relative z-10">
          {tasks.map((task, index) => (
            <div key={task.id} className="flex items-center group">
              {/* Task Label */}
              <div className="w-48 flex-shrink-0 pr-4">
                <p className="text-xs font-bold text-[var(--color-text-main)] uppercase truncate group-hover:text-[var(--color-neon-cyan)] transition-colors">
                  {task.name}
                </p>
                <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-tighter">
                  {task.department}
                </p>
              </div>

              {/* Timeline Bar Container */}
              <div className="flex-1 h-8 relative bg-[var(--color-neon-cyan-dim)]/5 rounded-sm overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ 
                    width: `${(task.duration / totalDays) * 100}%`,
                    left: `${(task.startDay / totalDays) * 100}%`,
                    opacity: 1
                  }}
                  transition={{ delay: index * 0.1, duration: 0.8, ease: "easeOut" }}
                  className="absolute h-full flex flex-col justify-center px-2 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                  style={{ 
                    backgroundColor: `${DEPARTMENT_COLORS[task.department]}20`,
                    borderLeft: `2px solid ${DEPARTMENT_COLORS[task.department]}`,
                    boxShadow: `inset 4px 0 10px -4px ${DEPARTMENT_COLORS[task.department]}`
                  }}
                >
                  {/* Progress Fill */}
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ delay: (index * 0.1) + 0.5, duration: 1 }}
                    className="absolute top-0 left-0 bottom-0 opacity-30"
                    style={{ backgroundColor: DEPARTMENT_COLORS[task.department] }}
                  />
                  
                  {/* Progress Label */}
                  <div className="relative z-10 flex justify-between items-center w-full">
                    <span className="text-[9px] font-bold text-white drop-shadow-md">
                      {task.progress}%
                    </span>
                    {task.status === 'in-progress' && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-10 flex gap-6 text-[10px] uppercase font-bold text-[var(--color-text-muted)] border-t border-[var(--color-neon-cyan-dim)]/20 pt-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS.Compras }} /> Compras
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS.Diseño }} /> Diseño
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS.Producción }} /> Producción
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS.Calidad }} /> Calidad
          </div>
        </div>
      </div>
    </div>
  );
}
