import React from 'react';
import { motion } from 'motion/react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
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
  /**
   * Fecha de entrega / deadline del proyecto. Extiende la línea de tiempo
   * hasta esa fecha y dibuja un marcador "Entrega".
   */
  endDate?: string | null;
  /** Desactiva las animaciones (necesario para imprimir/exportar). */
  noAnimation?: boolean;
}

const DEPARTMENT_COLORS: Record<GanttTask['department'], string> = {
  Compras: '#7c3aed',     // violet-600
  Diseño: '#0ea5e9',      // sky-500
  Producción: '#0369a1',  // sky-700 (primary)
  Calidad: '#16a34a',     // green-600
};

const LABEL_COL = 192; // w-48
const DAY_PX = 18;      // ancho por día en modo scrollable
const NICE_STEPS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120];
const DEADLINE_COLOR = '#dc2626';

export function GanttChart({
  startDate,
  tasks,
  scrollable = false,
  endDate,
  noAnimation = false,
}: GanttChartProps) {
  const projectStart = new Date(startDate);
  const lastTaskEnd = Math.max(...tasks.map(t => t.startDay + t.duration));

  // Día del deadline relativo al inicio (si se proporciona y es válido).
  const deadlineDay = (() => {
    if (!endDate) return null;
    const d = parseISO(endDate);
    if (isNaN(d.getTime())) return null;
    return Math.max(0, differenceInDays(d, projectStart));
  })();

  // La línea de tiempo llega hasta la última actividad O el deadline, lo que
  // ocurra después, con un pequeño margen para que no se corte la etiqueta.
  const contentEnd = Math.max(lastTaskEnd, deadlineDay ?? 0);
  const totalDays = contentEnd + (scrollable ? 3 : 2);

  const timelineWidth = Math.max(560, totalDays * DAY_PX);
  const effDayPx = timelineWidth / totalDays;

  // Paso entre marcas de fecha: en scrollable por px disponible; en modo
  // ajustado limitamos el número total de etiquetas para que no se encimen.
  const stepDays = scrollable
    ? NICE_STEPS.find(s => s * effDayPx >= 64) ?? 120
    : NICE_STEPS.find(s => totalDays / s <= 14) ?? 120;
  const markerCount = Math.ceil(totalDays / stepDays);
  const dateMarkers = Array.from({ length: markerCount + 1 }, (_, i) => i * stepDays).filter(
    d => d <= totalDays
  );

  const posLeft = (day: number) => (scrollable ? `${day * effDayPx}px` : `${(day / totalDays) * 100}%`);
  const sizeW = (dur: number) => (scrollable ? `${dur * effDayPx}px` : `${(dur / totalDays) * 100}%`);

  // Posición horizontal de la línea del deadline, relativa al contenedor
  // completo (col etiqueta + pista).
  const deadlineLeft =
    deadlineDay == null
      ? null
      : scrollable
      ? `${LABEL_COL + deadlineDay * effDayPx}px`
      : `calc(${LABEL_COL}px + (100% - ${LABEL_COL}px) * ${deadlineDay / totalDays})`;

  const innerStyle: React.CSSProperties = scrollable
    ? { width: LABEL_COL + timelineWidth + 72 }
    : { minWidth: 760 };
  const trackStyle: React.CSSProperties | undefined = scrollable
    ? { width: timelineWidth }
    : undefined;

  const Bar = noAnimation ? ('div' as const) : motion.div;

  return (
    <div className={scrollable ? 'w-full overflow-x-auto pb-4' : 'w-full pb-4'}>
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
            {deadlineDay != null && (
              <div
                className="absolute text-[10px] font-semibold whitespace-nowrap -translate-x-1/2"
                style={{ left: posLeft(deadlineDay), top: -2, color: DEADLINE_COLOR }}
              >
                ▾ Entrega {format(addDays(projectStart, deadlineDay), 'dd MMM', { locale: es })}
              </div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-3 relative z-10">
          {tasks.map((task, index) => {
            const color = DEPARTMENT_COLORS[task.department];
            const taskStartDate = addDays(projectStart, task.startDay);
            const taskEnd = addDays(projectStart, task.startDay + task.duration);
            const barAnim = noAnimation
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { width: sizeW(task.duration), left: posLeft(task.startDay), opacity: 1 },
                  transition: { delay: index * 0.04, duration: 0.5, ease: 'easeOut' as const },
                };
            const barStaticStyle: React.CSSProperties = noAnimation
              ? { width: sizeW(task.duration), left: posLeft(task.startDay) }
              : {};
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
                  <Bar
                    {...barAnim}
                    className="absolute h-full flex items-center px-2 rounded-md overflow-hidden"
                    style={{
                      backgroundColor: `${color}22`,
                      borderLeft: `3px solid ${color}`,
                      ...barStaticStyle,
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 bottom-0 rounded-md opacity-50"
                      style={{ backgroundColor: color, width: `${task.progress}%` }}
                    />
                    <div className="relative z-10 flex justify-between items-center w-full gap-2">
                      <span className="text-xs font-medium text-[var(--color-app-text)] whitespace-nowrap">
                        {task.progress}%
                      </span>
                      {task.status === 'in-progress' && (
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-text)] animate-pulse shrink-0" />
                      )}
                    </div>
                  </Bar>

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

          {/* Línea vertical del deadline a lo largo de todas las actividades */}
          {deadlineLeft && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: deadlineLeft, borderLeft: `2px dashed ${DEADLINE_COLOR}` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-[var(--color-app-text-muted)] border-t border-[var(--color-app-border)] pt-3">
          {(Object.keys(DEPARTMENT_COLORS) as Array<keyof typeof DEPARTMENT_COLORS>).map(dept => (
            <div key={dept} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: DEPARTMENT_COLORS[dept] }} />
              {dept}
            </div>
          ))}
          {deadlineDay != null && (
            <div className="flex items-center gap-2">
              <div className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: DEADLINE_COLOR }} />
              Fecha de entrega
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
