import React from 'react';
import { motion } from 'motion/react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface GanttTask {
  id: string;
  name: string;
  department: 'Compras' | 'Diseño' | 'Producción' | 'Calidad';
  startDay: number;
  duration: number;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed';
}

interface GanttChartProps {
  startDate: string;
  tasks: GanttTask[];
}

const DEPARTMENT_COLORS: Record<GanttTask['department'], string> = {
  Compras: '#7c3aed',     // violet-600
  Diseño: '#0ea5e9',      // sky-500
  Producción: '#0369a1',  // sky-700 (primary)
  Calidad: '#16a34a',     // green-600
};

export function GanttChart({ startDate, tasks }: GanttChartProps) {
  const projectStart = new Date(startDate);
  const totalDays = Math.max(...tasks.map(t => t.startDay + t.duration)) + 5;
  const dateMarkers = Array.from({ length: Math.ceil(totalDays / 5) + 1 }, (_, i) => i * 5);

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[800px] relative">
        {/* Header */}
        <div className="flex border-b border-[var(--color-app-border)] mb-4 pb-2">
          <div className="w-48 shrink-0 text-xs font-medium text-[var(--color-app-text-muted)]">
            Departamento / Actividad
          </div>
          <div className="flex-1 relative h-6">
            {dateMarkers.map(day => (
              <div
                key={day}
                className="absolute text-xs text-[var(--color-app-text-muted)] border-l border-[var(--color-app-border)] h-full pl-1"
                style={{ left: `${(day / totalDays) * 100}%` }}
              >
                {format(addDays(projectStart, day), 'dd MMM', { locale: es })}
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-3 relative z-10">
          {tasks.map((task, index) => {
            const color = DEPARTMENT_COLORS[task.department];
            return (
              <div key={task.id} className="flex items-center group">
                <div className="w-48 shrink-0 pr-4">
                  <p className="text-sm font-medium text-[var(--color-app-text)] truncate">
                    {task.name}
                  </p>
                  <p className="text-xs text-[var(--color-app-text-muted)]">
                    {task.department}
                  </p>
                </div>

                <div className="flex-1 h-8 relative bg-[var(--color-app-surface-alt)] rounded-md overflow-hidden">
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{
                      width: `${(task.duration / totalDays) * 100}%`,
                      left: `${(task.startDay / totalDays) * 100}%`,
                      opacity: 1,
                    }}
                    transition={{ delay: index * 0.08, duration: 0.6, ease: 'easeOut' }}
                    className="absolute h-full flex items-center px-2 rounded-md"
                    style={{
                      backgroundColor: `${color}22`,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ delay: index * 0.08 + 0.4, duration: 0.8 }}
                      className="absolute top-0 left-0 bottom-0 rounded-md opacity-50"
                      style={{ backgroundColor: color }}
                    />
                    <div className="relative z-10 flex justify-between items-center w-full">
                      <span className="text-xs font-medium text-[var(--color-app-text)]">
                        {task.progress}%
                      </span>
                      {task.status === 'in-progress' && (
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-text)] animate-pulse" />
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-[var(--color-app-text-muted)] border-t border-[var(--color-app-border)] pt-3">
          {(Object.keys(DEPARTMENT_COLORS) as Array<keyof typeof DEPARTMENT_COLORS>).map(dept => (
            <div key={dept} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS[dept] }} />
              {dept}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
