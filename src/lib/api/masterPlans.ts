import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { MasterPlan, MasterPlanTask, Department, MasterPlanMethodology } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_PLANS_KEY = 'koji_demo_master_plans';
const DEMO_TASKS_KEY = 'koji_demo_master_plan_tasks';

function readDemo<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeDemo<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function newId(prefix: string): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================================
// PLANTILLAS — defaults editables por tipo de proyecto
// ============================================================================

export interface TemplateTask {
  wbs: string;
  name: string;
  department: Department;
  duration_days: number;
  is_milestone?: boolean;
  /** wbs codes que esta tarea depende */
  depends_on?: string[];
  /**
   * Si true, la duración escala con la cantidad de piezas a fabricar
   * (maquinado, tratamientos, inspección de lote, empaque...). Las tareas
   * fijas (kick-off, emisión de PO, diseño, hitos) NO se marcan.
   */
  scales_with_quantity?: boolean;
}

export interface MasterPlanTemplate {
  id: string;
  name: string;
  description: string;
  defaultRiskSummary: string;
  /**
   * Cantidad de piezas a la que corresponden las duraciones por defecto.
   * El scheduler escala las tareas marcadas usando quantity / base_quantity.
   */
  base_quantity: number;
  tasks: TemplateTask[];
}

/**
 * Plantilla estándar para piezas CNC.
 *
 * Duraciones calibradas con benchmarks de la industria (taller pequeño-medio,
 * lote 50-500 pzas, materiales comunes: aceros 4140/1018, Al 6061, Inox 304).
 * Para piezas exóticas, lotes >1000 pzas o aleaciones especiales, ajusta
 * manualmente en el wizard.
 *
 * Critical path típico: 1.1→1.2→2.1→2.2→2.3→4.1→4.2→4.3→5.2→5.3→6.1→6.2 ≈ 22 días
 */
export const TEMPLATE_CNC: MasterPlanTemplate = {
  id: 'CNC-Estándar',
  name: 'CNC estándar',
  description: 'Lotes de maquinado CNC. Las duraciones de fabricación escalan con la cantidad real.',
  base_quantity: 100,
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Retrasos en recepción de materia prima por escasez o cambios de proveedor (+3-5 días)\n' +
    '· Rechazo en inspección de primera pieza por tolerancias críticas (+1-2 días de re-setup)\n' +
    '· Variabilidad en tiempos de tratamiento térmico (±2 días)\n' +
    '· Cambios de ingeniería tardíos del cliente que invalidan programa CAM',
  tasks: [
    // Fase 1 — Iniciación
    { wbs: '1.1', name: 'Revisión de OC y arranque administrativo',  department: 'Compras',    duration_days: 1, is_milestone: true },
    { wbs: '1.2', name: 'Kick-off técnico interno',                  department: 'Producción', duration_days: 1, depends_on: ['1.1'] },

    // Fase 2 — Procura (lead time, fijo)
    { wbs: '2.1', name: 'Solicitud y emisión de PO',                 department: 'Compras',    duration_days: 1, depends_on: ['1.2'] },
    { wbs: '2.2', name: 'Recepción de materia prima en almacén',     department: 'Compras',    duration_days: 5, depends_on: ['2.1'] },
    { wbs: '2.3', name: 'Verificación dimensional y certificados',    department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['2.2'] },

    // Fase 3 — Ingeniería (en paralelo con procura — arranca en 1.2)
    { wbs: '3.1', name: 'Revisión técnica de planos 2D/3D',          department: 'Diseño',     duration_days: 2, depends_on: ['1.2'] },
    { wbs: '3.2', name: 'Programación CAM y simulación',             department: 'Diseño',     duration_days: 3, depends_on: ['3.1'], scales_with_quantity: true },
    { wbs: '3.3', name: 'Aprobación interna del programa',            department: 'Producción', duration_days: 1, is_milestone: true, depends_on: ['3.2'] },

    // Fase 4 — Manufactura (depende de 2.3 Y 3.3 — el más tardío). Escala con cantidad.
    { wbs: '4.1', name: 'Setup de máquina y herramental',            department: 'Producción', duration_days: 1, depends_on: ['2.3', '3.3'] },
    { wbs: '4.2', name: 'Maquinado del lote completo',               department: 'Producción', duration_days: 5, depends_on: ['4.1'], scales_with_quantity: true },
    { wbs: '4.3', name: 'Tratamientos térmicos / acabados',           department: 'Producción', duration_days: 3, depends_on: ['4.2'], scales_with_quantity: true },

    // Fase 5 — Calidad
    { wbs: '5.1', name: 'Inspección de primera pieza (PPAP)',        department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['4.1'] },
    { wbs: '5.2', name: 'Inspección dimensional final del lote',     department: 'Calidad',    duration_days: 2, depends_on: ['4.3'], scales_with_quantity: true },
    { wbs: '5.3', name: 'Liberación formal de calidad',               department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['5.2'] },

    // Fase 6 — Embarque
    { wbs: '6.1', name: 'Empaque, etiquetado y packing list',         department: 'Embarque',   duration_days: 1, depends_on: ['5.3'], scales_with_quantity: true },
    { wbs: '6.2', name: 'Embarque y entrega al cliente',             department: 'Embarque',   duration_days: 1, is_milestone: true, depends_on: ['6.1'] },
  ],
};

/**
 * Moldes de inyección. Critical path ~80 días.
 * Calibrado para moldes de complejidad media (cavidad simple-doble, sin
 * mecanismos complejos). Para moldes con corredera, levantadores o
 * multi-cavidad agregar 15-25% al ciclo de manufactura.
 */
export const TEMPLATE_MOLDES: MasterPlanTemplate = {
  id: 'Moldes',
  name: 'Moldes de inyección',
  description: 'Cavidad simple-doble, complejidad media. Ciclo ~80 días incluyendo T0 y ajustes.',
  base_quantity: 1,
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Cambios de geometría tardíos del cliente que invalidan trabajo en cavidad\n' +
    '· Retrasos en componentes especiales (resortes, guías, eyectores) +5-7 días\n' +
    '· T0 con defectos críticos que requieren maquinar nueva cavidad (+10-15 días)\n' +
    '· Tratamiento térmico con distorsión que requiere re-rectificado',
  tasks: [
    // Fase 1 — Iniciación (2 días)
    { wbs: '1.1', name: 'Revisión de OC y especificaciones',        department: 'Compras',    duration_days: 1, is_milestone: true },
    { wbs: '1.2', name: 'Kick-off técnico con cliente',              department: 'Producción', duration_days: 1, depends_on: ['1.1'] },

    // Fase 2 — Diseño (8 días)
    { wbs: '2.1', name: 'Diseño detallado del molde (CAD)',          department: 'Diseño',     duration_days: 6, depends_on: ['1.2'] },
    { wbs: '2.2', name: 'Aprobación de diseño con cliente',          department: 'Diseño',     duration_days: 2, is_milestone: true, depends_on: ['2.1'] },

    // Fase 3 — Procura (10 días) y CAM (3 días) en paralelo
    { wbs: '3.1', name: 'Compra de acero P20 / H13 y componentes',   department: 'Compras',    duration_days: 8, depends_on: ['2.2'] },
    { wbs: '3.2', name: 'Recepción y verificación de materiales',     department: 'Calidad',    duration_days: 2, depends_on: ['3.1'] },
    { wbs: '3.3', name: 'Programación CAM (placas + cavidad)',       department: 'Diseño',     duration_days: 3, depends_on: ['2.2'] },

    // Fase 4 — Manufactura (~30 días). Escala con el número de moldes/cavidades.
    { wbs: '4.1', name: 'Maquinado de placas (porta-molde)',         department: 'Producción', duration_days: 6, depends_on: ['3.2', '3.3'], scales_with_quantity: true },
    { wbs: '4.2', name: 'Maquinado de cavidad y núcleo',             department: 'Producción', duration_days: 10, depends_on: ['4.1'], scales_with_quantity: true },
    { wbs: '4.3', name: 'EDM (chispa / hilo)',                        department: 'Producción', duration_days: 5, depends_on: ['4.2'], scales_with_quantity: true },
    { wbs: '4.4', name: 'Tratamiento térmico (templado + revenido)',  department: 'Producción', duration_days: 4, depends_on: ['4.3'] },
    { wbs: '4.5', name: 'Rectificado y pulido espejo',                department: 'Producción', duration_days: 5, depends_on: ['4.4'], scales_with_quantity: true },

    // Fase 5 — Try-out y validación (10 días)
    { wbs: '5.1', name: 'Ensamble del molde',                        department: 'Producción', duration_days: 2, depends_on: ['4.5'] },
    { wbs: '5.2', name: 'Prueba T0 / Try-out en máquina',            department: 'Calidad',    duration_days: 2, is_milestone: true, depends_on: ['5.1'] },
    { wbs: '5.3', name: 'Ajustes finales y validación dimensional',  department: 'Producción', duration_days: 3, depends_on: ['5.2'] },
    { wbs: '5.4', name: 'Aprobación final del cliente',              department: 'Calidad',    duration_days: 2, is_milestone: true, depends_on: ['5.3'] },

    // Fase 6 — Embarque
    { wbs: '6.1', name: 'Empaque, manuales y embarque',              department: 'Embarque',   duration_days: 2, is_milestone: true, depends_on: ['5.4'] },
  ],
};

/**
 * Herramentales (fixtures, jigs, dispositivos). Ciclo rápido ~13 días.
 */
export const TEMPLATE_HERRAMENTALES: MasterPlanTemplate = {
  id: 'Herramentales',
  name: 'Herramentales',
  description: 'Fixtures, jigs y dispositivos de manufactura. Ciclo ~13 días.',
  base_quantity: 1,
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Cambios en geometría de la pieza objetivo durante manufactura\n' +
    '· Ajustes finales requeridos en sitio (validación con producción real)\n' +
    '· Disponibilidad de la pieza patrón para pruebas de fixture',
  tasks: [
    { wbs: '1.1', name: 'Revisión de OC y kickoff',           department: 'Compras',    duration_days: 1, is_milestone: true },
    { wbs: '2.1', name: 'Diseño y programación CAM',          department: 'Diseño',     duration_days: 2, depends_on: ['1.1'] },
    { wbs: '3.1', name: 'Compra y recepción de materiales',   department: 'Compras',    duration_days: 3, depends_on: ['1.1'] },
    { wbs: '4.1', name: 'Maquinado del herramental',          department: 'Producción', duration_days: 4, depends_on: ['2.1', '3.1'], scales_with_quantity: true },
    { wbs: '4.2', name: 'Ensamble y ajustes',                 department: 'Producción', duration_days: 1, depends_on: ['4.1'] },
    { wbs: '5.1', name: 'Inspección dimensional y validación', department: 'Calidad',   duration_days: 1, is_milestone: true, depends_on: ['4.2'] },
    { wbs: '6.1', name: 'Embarque o entrega',                 department: 'Embarque',   duration_days: 1, is_milestone: true, depends_on: ['5.1'] },
  ],
};

/**
 * Prototipo rápido. Ciclo corto ~7 días para validación de concepto.
 */
export const TEMPLATE_PROTOTIPO: MasterPlanTemplate = {
  id: 'Prototipo',
  name: 'Prototipo rápido',
  description: 'Pieza única o lote piloto (1-10 pzas) para validación. Ciclo ~7 días.',
  base_quantity: 5,
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Cambios iterativos del cliente durante el ciclo (típico en prototipos)\n' +
    '· Geometría no validada que requiere ajuste de programa CAM en máquina\n' +
    '· Materiales no estándar con tiempos de entrega impredecibles',
  tasks: [
    { wbs: '1.1', name: 'Kick-off técnico y revisión de plano',  department: 'Diseño',     duration_days: 1, is_milestone: true },
    { wbs: '2.1', name: 'Materia prima (stock o compra urgente)', department: 'Compras',    duration_days: 2, depends_on: ['1.1'] },
    { wbs: '2.2', name: 'Programación CAM y simulación',          department: 'Diseño',     duration_days: 1, depends_on: ['1.1'] },
    { wbs: '3.1', name: 'Setup y maquinado',                      department: 'Producción', duration_days: 2, depends_on: ['2.1', '2.2'], scales_with_quantity: true },
    { wbs: '4.1', name: 'Validación dimensional del prototipo',   department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['3.1'] },
    { wbs: '5.1', name: 'Entrega al cliente',                     department: 'Embarque',   duration_days: 1, is_milestone: true, depends_on: ['4.1'] },
  ],
};

export const MASTER_PLAN_TEMPLATES: MasterPlanTemplate[] = [
  TEMPLATE_CNC,
  TEMPLATE_MOLDES,
  TEMPLATE_HERRAMENTALES,
  TEMPLATE_PROTOTIPO,
];

// ============================================================================
// CÁLCULOS — schedule forward + critical path
// ============================================================================

interface ScheduledTaskDraft {
  wbs: string;
  name: string;
  department: Department;
  /** Duración EFECTIVA en días hábiles (ya escalada por cantidad). */
  duration_days: number;
  is_milestone: boolean;
  depends_on: string[];
  start_date: Date;
  end_date: Date;
  earliest_start: Date;
  earliest_finish: Date;
  latest_start?: Date;
  latest_finish?: Date;
  is_critical?: boolean;
}

/** Días de la semana laborables por defecto: Lun(1)…Vie(5). */
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

export interface ScheduleOptions {
  /** Días hábiles (0=Dom … 6=Sáb). Default Lun-Vie. */
  workingDays?: number[];
  /** Cantidad real de piezas a fabricar. Escala las tareas marcadas. */
  quantity?: number;
  /** Cantidad base de la plantilla (sobre la que se calibraron las
   *  duraciones). Default: template.base_quantity. */
  baseQuantity?: number;
  /** Exponente de escalado (0–1). 1 = lineal, <1 = sublineal (lotes grandes
   *  se procesan más eficientemente). Default 0.75. */
  scaleExponent?: number;
}

function isWorkingDay(d: Date, working: number[]): boolean {
  return working.includes(d.getDay());
}

/** Mueve la fecha al día hábil más cercano en la dirección indicada. */
function snapToWorkingDay(date: Date, working: number[], dir: 'forward' | 'backward'): Date {
  const result = new Date(date);
  const step = dir === 'forward' ? 1 : -1;
  let guard = 0;
  while (!isWorkingDay(result, working) && guard++ < 14) {
    result.setDate(result.getDate() + step);
  }
  return result;
}

/**
 * Suma (o resta, si n<0) n días HÁBILES a la fecha, saltando fines de semana.
 * Si la fecha de partida no es hábil, primero la deja en sí misma y cuenta
 * los saltos hábiles desde ahí.
 */
function addWorkingDays(start: Date, n: number, working: number[]): Date {
  const result = new Date(start);
  let remaining = Math.abs(Math.round(n));
  const step = n >= 0 ? 1 : -1;
  while (remaining > 0) {
    result.setDate(result.getDate() + step);
    if (isWorkingDay(result, working)) remaining--;
  }
  return result;
}

/** Cuenta cuántos días hábiles hay entre a (exclusivo) y b (inclusivo). */
function workingDaysBetween(a: Date, b: Date, working: number[]): number {
  if (b <= a) return 0;
  let count = 0;
  const cur = new Date(a);
  let guard = 0;
  while (cur < b && guard++ < 100000) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkingDay(cur, working)) count++;
  }
  return count;
}

/**
 * Escala una duración base según la cantidad real vs la cantidad base.
 * Sublineal por defecto: producir 4× piezas no toma 4× tiempo porque hay
 * eficiencias de setup, procesamiento por tandas y varias estaciones.
 * Tope de seguridad para que un solo paso no domine el plan (max 90 días).
 */
function scaleDuration(base: number, qty: number, baseQty: number, exp: number): number {
  const safeBase = Math.max(1, base);
  if (!qty || !baseQty || qty <= 0 || baseQty <= 0) return safeBase;
  const ratio = qty / baseQty;
  const scaled = safeBase * Math.pow(ratio, exp);
  return Math.min(90, Math.max(1, Math.round(scaled)));
}

/** Devuelve la duración efectiva (escalada) de una tarea de plantilla. */
function effectiveDuration(t: TemplateTask, opts: Required<Pick<ScheduleOptions, 'quantity' | 'baseQuantity' | 'scaleExponent'>>): number {
  const base = Math.max(1, t.duration_days);
  // Los hitos y las tareas no marcadas NO escalan.
  if (t.is_milestone || !t.scales_with_quantity) return base;
  return scaleDuration(base, opts.quantity, opts.baseQuantity, opts.scaleExponent);
}

/**
 * Programa un plan a partir de las tareas de plantilla y una fecha de inicio.
 *
 * Mejoras vs versión previa:
 *  · Días HÁBILES reales (Lun-Vie) — las tareas ya no caen en fines de semana.
 *  · Duraciones que ESCALAN con la cantidad de piezas (maquinado, inspección,
 *    empaque…), usando un modelo sublineal calibrado por plantilla.
 *  · CPM forward/backward para marcar la ruta crítica.
 */
export function scheduleTasks(
  template: MasterPlanTemplate,
  startDate: Date,
  options: ScheduleOptions = {}
): ScheduledTaskDraft[] {
  const working = options.workingDays ?? DEFAULT_WORKING_DAYS;
  const baseQuantity = options.baseQuantity ?? template.base_quantity ?? 1;
  const quantity = options.quantity ?? baseQuantity;
  const scaleExponent = options.scaleExponent ?? 0.75;
  const durOpts = { quantity, baseQuantity, scaleExponent };

  // El arranque siempre cae en día hábil.
  const anchor = snapToWorkingDay(new Date(startDate), working, 'forward');

  const taskMap = new Map<string, ScheduledTaskDraft>();
  template.tasks.forEach(t => {
    taskMap.set(t.wbs, {
      wbs: t.wbs,
      name: t.name,
      department: t.department,
      duration_days: effectiveDuration(t, durOpts),
      is_milestone: t.is_milestone ?? false,
      depends_on: t.depends_on ?? [],
      start_date: new Date(anchor),
      end_date: new Date(anchor),
      earliest_start: new Date(anchor),
      earliest_finish: new Date(anchor),
    });
  });

  // Forward pass — earliest start/finish en días hábiles
  const computeForward = (wbs: string, visiting: Set<string>): ScheduledTaskDraft => {
    const task = taskMap.get(wbs)!;
    if (visiting.has(wbs)) return task;
    visiting.add(wbs);

    if (task.depends_on.length === 0) {
      task.earliest_start = new Date(anchor);
    } else {
      let maxFinish = new Date(anchor);
      for (const dep of task.depends_on) {
        const depTask = taskMap.get(dep);
        if (!depTask) continue;
        const computed = computeForward(dep, new Set(visiting));
        if (computed.earliest_finish > maxFinish) maxFinish = computed.earliest_finish;
      }
      // El sucesor arranca en el siguiente día hábil disponible.
      task.earliest_start = snapToWorkingDay(maxFinish, working, 'forward');
    }

    task.earliest_finish = addWorkingDays(task.earliest_start, task.duration_days, working);
    task.start_date = new Date(task.earliest_start);
    task.end_date = new Date(task.earliest_finish);
    return task;
  };

  template.tasks.forEach(t => computeForward(t.wbs, new Set()));

  // Fin del proyecto = máximo earliest_finish
  const projectEnd = Array.from(taskMap.values()).reduce(
    (max, t) => (t.earliest_finish > max ? t.earliest_finish : max),
    new Date(anchor)
  );

  // Backward pass para ruta crítica
  const successors = new Map<string, string[]>();
  template.tasks.forEach(t => {
    (t.depends_on ?? []).forEach(dep => {
      if (!successors.has(dep)) successors.set(dep, []);
      successors.get(dep)!.push(t.wbs);
    });
  });

  const computeBackward = (wbs: string, visiting: Set<string>): ScheduledTaskDraft => {
    const task = taskMap.get(wbs)!;
    if (visiting.has(wbs)) return task;
    visiting.add(wbs);

    const succs = successors.get(wbs) ?? [];
    if (succs.length === 0) {
      task.latest_finish = new Date(projectEnd);
    } else {
      let minStart = new Date(projectEnd);
      for (const succ of succs) {
        const succTask = computeBackward(succ, new Set(visiting));
        if (succTask.latest_start && succTask.latest_start < minStart) minStart = succTask.latest_start;
      }
      task.latest_finish = minStart;
    }
    task.latest_start = addWorkingDays(task.latest_finish, -task.duration_days, working);
    return task;
  };

  template.tasks.forEach(t => computeBackward(t.wbs, new Set()));

  // Ruta crítica = slack ≈ 0
  taskMap.forEach(task => {
    const slack = task.latest_start
      ? (task.latest_start.getTime() - task.earliest_start.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    task.is_critical = Math.abs(slack) < 0.75;
  });

  return Array.from(taskMap.values()).sort((a, b) =>
    a.wbs.localeCompare(b.wbs, undefined, { numeric: true })
  );
}

export function projectEndDate(scheduled: ScheduledTaskDraft[]): Date {
  if (scheduled.length === 0) return new Date();
  return scheduled.reduce(
    (max, t) => (t.end_date > max ? t.end_date : max),
    scheduled[0].end_date
  );
}

/**
 * Calcula la fecha de INICIO necesaria para que el plan termine exactamente
 * en el deadline (planeación hacia atrás, días hábiles).
 *
 * Programa con un ancla cualquiera, mide el lapso total en días hábiles, y
 * resta ese lapso al deadline (ajustado al día hábil previo). El resultado,
 * usado como inicio en scheduleTasks, hace que el fin del proyecto aterrice
 * sobre el deadline.
 */
export function backwardStartForDeadline(
  template: MasterPlanTemplate,
  deadline: Date,
  options: ScheduleOptions = {}
): Date {
  const working = options.workingDays ?? DEFAULT_WORKING_DAYS;
  const placeholder = snapToWorkingDay(new Date(2035, 0, 1), working, 'forward');
  const sched = scheduleTasks(template, placeholder, options);
  if (sched.length === 0) return snapToWorkingDay(deadline, working, 'backward');
  const start = sched.reduce(
    (min, t) => (t.start_date < min ? t.start_date : min),
    sched[0].start_date
  );
  const end = projectEndDate(sched);
  const span = workingDaysBetween(start, end, working);
  const anchor = snapToWorkingDay(deadline, working, 'backward');
  return addWorkingDays(anchor, -span, working);
}

// ============================================================================
// HOOKS
// ============================================================================

export function useMasterPlan(projectId: string | undefined): AsyncState<MasterPlan | null> {
  return useAsync<MasterPlan | null>(
    async () => {
      if (!projectId) return null;
      if (!supabase) {
        return readDemo<MasterPlan>(DEMO_PLANS_KEY)
          .filter(p => p.project_id === projectId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
      }
      const { data, error } = await supabase
        .from('master_plans')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] as MasterPlan) ?? null;
    },
    null,
    [projectId]
  );
}

export function useMasterPlanTasks(masterPlanId: string | undefined): AsyncState<MasterPlanTask[]> {
  return useAsync<MasterPlanTask[]>(
    async () => {
      if (!masterPlanId) return [];
      if (!supabase) {
        return readDemo<MasterPlanTask>(DEMO_TASKS_KEY)
          .filter(t => t.master_plan_id === masterPlanId)
          .sort((a, b) => a.sort_order - b.sort_order);
      }
      const { data, error } = await supabase
        .from('master_plan_tasks')
        .select('*')
        .eq('master_plan_id', masterPlanId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as MasterPlanTask[];
    },
    [],
    [masterPlanId]
  );
}

interface CreateMasterPlanInput {
  project_id: string;
  template_used: string;
  methodology: MasterPlanMethodology;
  baseline_start: string;
  risk_summary?: string;
  notes?: string;
  tasks: Omit<MasterPlanTask, 'id' | 'master_plan_id' | 'created_at' | 'updated_at'>[];
}

export function useCreateMasterPlan() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (input: CreateMasterPlanInput): Promise<MasterPlan> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const baselineEnd =
        input.tasks.length > 0
          ? input.tasks.reduce((max, t) => (t.end_date > max ? t.end_date : max), input.tasks[0].end_date)
          : input.baseline_start;

      const plan: MasterPlan = {
        id: newId('mp'),
        project_id: input.project_id,
        name: 'Master Plan v1',
        version: 1,
        methodology: input.methodology,
        template_used: input.template_used,
        baseline_start: input.baseline_start,
        baseline_end: baselineEnd,
        actual_start: null,
        actual_end: null,
        status: 'Activo',
        risk_summary: input.risk_summary ?? null,
        notes: input.notes ?? null,
        created_by: null,
        created_at: now,
        updated_at: now,
      };

      const tasks: MasterPlanTask[] = input.tasks.map((t, i) => ({
        ...t,
        id: newId('mpt'),
        master_plan_id: plan.id,
        sort_order: i,
        created_at: now,
        updated_at: now,
      }));

      if (!supabase) {
        writeDemo(DEMO_PLANS_KEY, [plan, ...readDemo<MasterPlan>(DEMO_PLANS_KEY)]);
        writeDemo(DEMO_TASKS_KEY, [...readDemo<MasterPlanTask>(DEMO_TASKS_KEY), ...tasks]);
        setState({ loading: false, error: null });
        return plan;
      }

      const { data: planRow, error: planErr } = await supabase
        .from('master_plans')
        .insert(plan)
        .select('*')
        .single();
      if (planErr) throw planErr;
      if (tasks.length > 0) {
        const { error: tasksErr } = await supabase.from('master_plan_tasks').insert(tasks);
        if (tasksErr) throw tasksErr;
      }

      setState({ loading: false, error: null });
      return planRow as MasterPlan;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { create, ...state };
}

/**
 * Re-calcula fechas de tareas dependientes a partir de una tarea cambiada.
 *
 * Estrategia ASAP (PMI standard): cada tarea debe arrancar EXACTAMENTE cuando
 * sus dependencias terminan. Esto incluye los dos sentidos:
 *
 *   1. Si una predecesora se retrasa → empuja a la dependiente hacia adelante
 *   2. Si una predecesora se adelanta → jala a la dependiente hacia atrás
 *      (a menos que tenga otra dependencia que la sostenga)
 *
 * Las tareas sin dependencias mantienen sus fechas (son anclas).
 * La tarea cambiada manualmente queda fija.
 *
 * Devuelve la lista nueva (no muta la original).
 */
export function cascadeDates(
  tasks: MasterPlanTask[],
  changedTaskId: string,
  newStart: string,
  newEnd: string
): MasterPlanTask[] {
  const updated: MasterPlanTask[] = tasks.map(t => ({ ...t }));
  const byWbs = new Map<string, MasterPlanTask>();
  updated.forEach(t => byWbs.set(t.wbs_code, t));

  const changed = updated.find(t => t.id === changedTaskId);
  if (!changed) return updated;
  changed.start_date = newStart;
  changed.end_date = newEnd;
  const changedWbs = changed.wbs_code;

  const working = DEFAULT_WORKING_DAYS;

  // Forward pass ASAP en días HÁBILES — itera hasta estabilidad.
  // Cada dependiente arranca el siguiente día hábil tras su predecesora y
  // conserva su duración en días hábiles (no caen en fin de semana).
  let mutating = true;
  let safety = 100;
  while (mutating && safety-- > 0) {
    mutating = false;
    for (const task of updated) {
      if (task.wbs_code === changedWbs) continue;
      if (!task.dependencies || task.dependencies.length === 0) continue;

      let maxDepEnd: Date | null = null;
      for (const depWbs of task.dependencies) {
        const dep = byWbs.get(depWbs);
        if (!dep) continue;
        const depEnd = new Date(dep.end_date);
        if (!maxDepEnd || depEnd > maxDepEnd) maxDepEnd = depEnd;
      }
      if (!maxDepEnd) continue;

      const currentStart = new Date(task.start_date);
      const currentEnd = new Date(task.end_date);
      // Duración en días hábiles (preserva el "tamaño" de la tarea).
      const workDur = Math.max(1, workingDaysBetween(currentStart, currentEnd, working));

      // Inicio ideal = siguiente día hábil tras el fin de la última dependencia.
      const idealStart = snapToWorkingDay(maxDepEnd, working, 'forward');

      // Re-alinear si hay gap apreciable (≥ 1 día).
      const diffMs = idealStart.getTime() - currentStart.getTime();
      if (Math.abs(diffMs) > 12 * 60 * 60 * 1000) {
        const newEndDate = addWorkingDays(idealStart, workDur, working);
        task.start_date = idealStart.toISOString().slice(0, 10);
        task.end_date = newEndDate.toISOString().slice(0, 10);
        mutating = true;
      }
    }
  }

  return updated;
}

/**
 * Persiste cambios de fechas de un set de tareas (después de cascada).
 * Hace UN solo update batch para minimizar round-trips a Supabase.
 */
export function useUpdateMasterPlanTaskDates() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(
    async (
      tasks: MasterPlanTask[],
      changedTaskId: string,
      newStart: string,
      newEnd: string
    ): Promise<MasterPlanTask[]> => {
      setState({ loading: true, error: null });
      try {
        const recalculated = cascadeDates(tasks, changedTaskId, newStart, newEnd);

        // Detecta cambios reales para no actualizar lo que no cambió
        const dirty = recalculated.filter(t => {
          const orig = tasks.find(o => o.id === t.id);
          return orig && (orig.start_date !== t.start_date || orig.end_date !== t.end_date);
        });

        const now = new Date().toISOString();

        if (!supabase) {
          const all = readDemo<MasterPlanTask>(DEMO_TASKS_KEY);
          dirty.forEach(d => {
            const idx = all.findIndex(t => t.id === d.id);
            if (idx >= 0) all[idx] = { ...all[idx], start_date: d.start_date, end_date: d.end_date, updated_at: now };
          });
          writeDemo(DEMO_TASKS_KEY, all);
          setState({ loading: false, error: null });
          return recalculated;
        }

        // Persistencia uno por uno (Postgres no soporta UPDATE batch trivial sin UPSERT)
        // .select('id') es CRÍTICO para detectar RLS silenciosas (sin error pero 0 filas)
        for (const d of dirty) {
          const { data, error } = await supabase
            .from('master_plan_tasks')
            .update({ start_date: d.start_date, end_date: d.end_date, updated_at: now })
            .eq('id', d.id)
            .select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(
              `No se actualizó la actividad ${d.wbs_code}. Verifica que tu profiles.role sea ` +
                `"Administrador" o "Administración / PM" en Supabase.`
            );
          }
        }

        // Actualiza baseline_end si la última tarea se movió
        if (dirty.length > 0) {
          const maxEnd = recalculated.reduce(
            (max, t) => (t.end_date > max ? t.end_date : max),
            recalculated[0].end_date
          );
          const planId = recalculated[0].master_plan_id;
          const { error: planErr } = await supabase
            .from('master_plans')
            .update({ baseline_end: maxEnd, updated_at: now })
            .eq('id', planId);
          if (planErr) throw planErr;
        }

        setState({ loading: false, error: null });
        return recalculated;
      } catch (err) {
        const e = err as Error;
        setState({ loading: false, error: e });
        throw e;
      }
    },
    []
  );

  return { update, ...state };
}

export function useUpdateMasterPlanTaskProgress() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const update = useCallback(async (taskId: string, progress: number): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));

      if (!supabase) {
        // Actualiza la tarea
        const allTasks = readDemo<MasterPlanTask>(DEMO_TASKS_KEY);
        const idx = allTasks.findIndex(t => t.id === taskId);
        if (idx < 0) {
          setState({ loading: false, error: null });
          return;
        }
        const task = allTasks[idx];
        allTasks[idx] = { ...task, progress: clamped, updated_at: now };
        writeDemo(DEMO_TASKS_KEY, allTasks);

        // Recalcula avance del proyecto basado en el promedio del plan activo
        const planTasks = allTasks.filter(t => t.master_plan_id === task.master_plan_id);
        const avg = Math.round(planTasks.reduce((acc, t) => acc + t.progress, 0) / planTasks.length);

        const plans = readDemo<MasterPlan>(DEMO_PLANS_KEY);
        const plan = plans.find(p => p.id === task.master_plan_id);
        if (plan) {
          // Persiste el avance al project en localStorage de demo
          try {
            const projRaw = localStorage.getItem('koji_demo_projects_progress');
            const map: Record<string, number> = projRaw ? JSON.parse(projRaw) : {};
            map[plan.project_id] = avg;
            localStorage.setItem('koji_demo_projects_progress', JSON.stringify(map));
          } catch {
            /* ignore */
          }
        }
        setState({ loading: false, error: null });
        return;
      }

      // ── Supabase ─────────────────────────────────────────────
      // 1) Update task — detectamos RLS silenciosa pidiendo el row de vuelta
      const { data: updatedRows, error: updErr } = await supabase
        .from('master_plan_tasks')
        .update({ progress: clamped, updated_at: now })
        .eq('id', taskId)
        .select('master_plan_id');
      if (updErr) throw updErr;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          'No se pudo guardar el avance. Verifica que tu perfil tenga rol Administrador / PM en profiles.role.'
        );
      }
      const planId = (updatedRows[0] as { master_plan_id: string }).master_plan_id;

      // 2) Promedio del plan
      const { data: allTasks, error: listErr } = await supabase
        .from('master_plan_tasks')
        .select('progress')
        .eq('master_plan_id', planId);
      if (listErr) throw listErr;
      const rows = (allTasks ?? []) as { progress: number }[];
      const avg = rows.length > 0
        ? Math.round(rows.reduce((acc, t) => acc + (t.progress || 0), 0) / rows.length)
        : 0;

      // 3) Proyecto al que pertenece este plan
      const { data: planRow, error: planErr } = await supabase
        .from('master_plans')
        .select('project_id')
        .eq('id', planId)
        .single();
      if (planErr) throw planErr;

      // 4) Persiste avance al proyecto
      await supabase
        .from('projects')
        .update({ progress: avg, updated_at: now })
        .eq('id', (planRow as { project_id: string }).project_id);

      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { update, ...state };
}
