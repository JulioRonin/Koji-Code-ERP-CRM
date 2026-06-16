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
  /**
   * Si es true, el cronograma usa un ancho fijo por día y se desplaza
   * horizontalmente, de modo que se vea el plan COMPLETO con todas las fechas
   * legibles (ideal en pantalla). Si es false (default) escala al ancho del
   * contenedor para que quepa en una hoja (impresión / reporte).
   */
  scrollable?: boolean;
}

const DEPARTMENT_COLORS: Record<GanttTask['department'], string> = {
  Compras: '#7c3aed',     // violet-600
  Diseño: '#0ea5e9',      // sky-500
  Producción: '#0369a1',  // sky-700 (primary)
  Calidad: '#16a34a',     // green-600
};

const LABEL_COL = 192; // w-48
const DAY_PX = 18;      // ancho por día en modo scrollable

export function GanttChart({ startDate, tasks, scrollable = false }: GanttChartProps) {
  const projectStart = new Date(startDate);
  const totalDays = Math.max(...tasks.map(t => t.startDay + t.duration)) + 5;

  // Ancho real de la pista de tiempo (px) en modo scrollable.
  const timelineWidth = Math.max(560, totalDays * DAY_PX);
  const effDayPx = timelineWidth / totalDays;

  // Paso entre marcas de fecha: en scrollable elegimos un intervalo "bonito"
  // que deje al menos ~64px entre etiquetas para que no se encimen.
  const stepDays = scrollable
    ? [1, 2, 5, 7, 10, 14, 21, 30, 45, 60, 90].find(s => s * effDayPx >= 64) ?? 90
    : 5;
  const markerCount = Math.ceil(totalDays / stepDays);
  const dateMarkers = Array.from({ length: markerCount + 1 }, (_, i) => i * stepDays).filter(
    d => d <= totalDays
  );

  // Posición / tamaño: px en scrollable, % en modo ajustado.
  const posLeft = (day: number) => (scrollable ? `${day * effDayPx}px` : `${(day / totalDays) * 100}%`);
  const sizeW = (dur: number) => (scrollable ? `${dur * effDayPx}px` : `${(dur / totalDays) * 100}%`);

  // En scrollable fijamos el ancho total (col etiqueta + pista + holgura para
  // que la última fecha no se corte). En ajustado, ancho mínimo flexible.
  const innerStyle: React.CSSProperties = scrollable
    ? { width: LABEL_COL + timelineWidth + 72 }
    : { minWidth: 800 };
  const trackStyle: React.CSSProperties | undefined = scrollable
    ? { width: timelineWidth }
    : undefined;

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="relative" style={innerStyle}>
        {/* Header */}
        <div className="flex border-b border-[var(--color-app-border)] mb-4 pb-2">
          <div
            className="shrink-0 text-xs font-medium text-[var(--color-app-text-muted)] sticky left-0 bg-white z-20"
            style={{ width: LABEL_COL }}
          >
            Departamento / Actividad
          </div>
          <div className={scrollable ? 'relative h-6 shrink-0' : 'flex-1 relative h-6'} style={trackStyle}>
            {dateMarkers.map(day => (
              <div
                key={day}
                className="absolute text-xs text-[var(--color-app-text-muted)] border-l border-[var(--color-app-border)] h-full pl-1 whitespace-nowrap"
                style={{ left: posLeft(day) }}
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
            const taskEnd = addDays(projectStart, task.startDay + task.duration);
            const taskStartDate = addDays(projectStart, task.startDay);
            return (
              <div key={task.id} className="flex items-center group">
                <div
                  className="shrink-0 pr-4 sticky left-0 bg-white z-20"
                  style={{ width: LABEL_COL }}
                >
                  <p className="text-sm font-medium text-[var(--color-app-text)] truncate">
                    {task.name}
                  </p>
                  <p className="text-xs text-[var(--color-app-text-muted)]">
                    {task.department}
                  </p>
                </div>

                <div
                  className={
                    scrollable
                      ? 'h-8 relative bg-[var(--color-app-surface-alt)] rounded-md shrink-0'
                      : 'flex-1 h-8 relative bg-[var(--color-app-surface-alt)] rounded-md overflow-hidden'
                  }
                  style={trackStyle}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{
                      width: sizeW(task.duration),
                      left: posLeft(task.startDay),
                      opacity: 1,
                    }}
                    transition={{ delay: index * 0.05, duration: 0.5, ease: 'easeOut' }}
                    className="absolute h-full flex items-center px-2 rounded-md overflow-hidden"
                    style={{
                      backgroundColor: `${color}22`,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ delay: index * 0.05 + 0.3, duration: 0.6 }}
                      className="absolute top-0 left-0 bottom-0 rounded-md opacity-50"
                      style={{ backgroundColor: color }}
                    />
                    <div className="relative z-10 flex justify-between items-center w-full gap-2">
                      <span className="text-xs font-medium text-[var(--color-app-text)] whitespace-nowrap">
                        {task.progress}%
                      </span>
                      {task.status === 'in-progress' && (
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-text)] animate-pulse shrink-0" />
                      )}
                    </div>
                  </motion.div>

                  {/* Fechas inicio–fin junto a la barra (solo en pantalla) */}
                  {scrollable && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-app-text-muted)] whitespace-nowrap pl-1.5"
                      style={{ left: `calc(${posLeft(task.startDay)} + ${sizeW(task.duration)})` }}
                    >
                      {format(taskStartDate, 'dd MMM', { locale: es })} – {format(taskEnd, 'dd MMM', { locale: es })}
                    </div>
                  )}
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
