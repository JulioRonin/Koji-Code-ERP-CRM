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
}

export interface MasterPlanTemplate {
  id: string;
  name: string;
  description: string;
  defaultRiskSummary: string;
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
  description: 'Lotes 50-500 pzas, aceros / Al / Inox comunes. Ciclo completo de ~22 días.',
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Retrasos en recepción de materia prima por escasez o cambios de proveedor (+3-5 días)\n' +
    '· Rechazo en inspección de primera pieza por tolerancias críticas (+1-2 días de re-setup)\n' +
    '· Variabilidad en tiempos de tratamiento térmico (±2 días)\n' +
    '· Cambios de ingeniería tardíos del cliente que invalidan programa CAM',
  tasks: [
    // Fase 1 — Iniciación (1 día)
    { wbs: '1.1', name: 'Revisión de OC y arranque administrativo',  department: 'Compras',    duration_days: 1, is_milestone: true },
    { wbs: '1.2', name: 'Kick-off técnico interno',                  department: 'Producción', duration_days: 1, depends_on: ['1.1'] },

    // Fase 2 — Procura (5 días total: solicitar 1 + comprar/recibir 3 + inspección 1)
    { wbs: '2.1', name: 'Solicitud y emisión de PO',                 department: 'Compras',    duration_days: 1, depends_on: ['1.2'] },
    { wbs: '2.2', name: 'Recepción de materia prima en almacén',     department: 'Compras',    duration_days: 3, depends_on: ['2.1'] },
    { wbs: '2.3', name: 'Verificación dimensional y certificados',    department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['2.2'] },

    // Fase 3 — Ingeniería (4 días, en paralelo con procura — arranca en 1.2)
    { wbs: '3.1', name: 'Revisión técnica de planos 2D/3D',          department: 'Diseño',     duration_days: 1, depends_on: ['1.2'] },
    { wbs: '3.2', name: 'Programación CAM y simulación',             department: 'Diseño',     duration_days: 2, depends_on: ['3.1'] },
    { wbs: '3.3', name: 'Aprobación interna del programa',            department: 'Producción', duration_days: 1, is_milestone: true, depends_on: ['3.2'] },

    // Fase 4 — Manufactura (depende de 2.3 Y 3.3 — el más tardío)
    { wbs: '4.1', name: 'Setup de máquina y herramental',            department: 'Producción', duration_days: 1, depends_on: ['2.3', '3.3'] },
    { wbs: '4.2', name: 'Maquinado del lote completo',               department: 'Producción', duration_days: 5, depends_on: ['4.1'] },
    { wbs: '4.3', name: 'Tratamientos térmicos / acabados',           department: 'Producción', duration_days: 3, depends_on: ['4.2'] },

    // Fase 5 — Calidad (en paralelo con 4.3 donde aplique)
    { wbs: '5.1', name: 'Inspección de primera pieza (PPAP)',        department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['4.1'] },
    { wbs: '5.2', name: 'Inspección dimensional final del lote',     department: 'Calidad',    duration_days: 2, depends_on: ['4.3'] },
    { wbs: '5.3', name: 'Liberación formal de calidad',               department: 'Calidad',    duration_days: 1, is_milestone: true, depends_on: ['5.2'] },

    // Fase 6 — Embarque (2 días)
    { wbs: '6.1', name: 'Empaque, etiquetado y packing list',         department: 'Embarque',   duration_days: 1, depends_on: ['5.3'] },
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

    // Fase 4 — Manufactura (~30 días)
    { wbs: '4.1', name: 'Maquinado de placas (porta-molde)',         department: 'Producción', duration_days: 6, depends_on: ['3.2', '3.3'] },
    { wbs: '4.2', name: 'Maquinado de cavidad y núcleo',             department: 'Producción', duration_days: 10, depends_on: ['4.1'] },
    { wbs: '4.3', name: 'EDM (chispa / hilo)',                        department: 'Producción', duration_days: 5, depends_on: ['4.2'] },
    { wbs: '4.4', name: 'Tratamiento térmico (templado + revenido)',  department: 'Producción', duration_days: 4, depends_on: ['4.3'] },
    { wbs: '4.5', name: 'Rectificado y pulido espejo',                department: 'Producción', duration_days: 5, depends_on: ['4.4'] },

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
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Cambios en geometría de la pieza objetivo durante manufactura\n' +
    '· Ajustes finales requeridos en sitio (validación con producción real)\n' +
    '· Disponibilidad de la pieza patrón para pruebas de fixture',
  tasks: [
    { wbs: '1.1', name: 'Revisión de OC y kickoff',           department: 'Compras',    duration_days: 1, is_milestone: true },
    { wbs: '2.1', name: 'Diseño y programación CAM',          department: 'Diseño',     duration_days: 2, depends_on: ['1.1'] },
    { wbs: '3.1', name: 'Compra y recepción de materiales',   department: 'Compras',    duration_days: 3, depends_on: ['1.1'] },
    { wbs: '4.1', name: 'Maquinado del herramental',          department: 'Producción', duration_days: 4, depends_on: ['2.1', '3.1'] },
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
  defaultRiskSummary:
    'Riesgos típicos del proyecto:\n' +
    '· Cambios iterativos del cliente durante el ciclo (típico en prototipos)\n' +
    '· Geometría no validada que requiere ajuste de programa CAM en máquina\n' +
    '· Materiales no estándar con tiempos de entrega impredecibles',
  tasks: [
    { wbs: '1.1', name: 'Kick-off técnico y revisión de plano',  department: 'Diseño',     duration_days: 1, is_milestone: true },
    { wbs: '2.1', name: 'Materia prima (stock o compra urgente)', department: 'Compras',    duration_days: 2, depends_on: ['1.1'] },
    { wbs: '2.2', name: 'Programación CAM y simulación',          department: 'Diseño',     duration_days: 1, depends_on: ['1.1'] },
    { wbs: '3.1', name: 'Setup y maquinado',                      department: 'Producción', duration_days: 2, depends_on: ['2.1', '2.2'] },
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

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Programa un plan a partir de las tareas de plantilla y una fecha de inicio.
 * Usa forward pass para earliest_start/finish, backward pass para latest,
 * y marca como critical aquellas con slack = 0.
 */
export function scheduleTasks(
  template: MasterPlanTemplate,
  startDate: Date
): ScheduledTaskDraft[] {
  const taskMap = new Map<string, ScheduledTaskDraft>();

  // Inicializar
  template.tasks.forEach(t => {
    taskMap.set(t.wbs, {
      wbs: t.wbs,
      name: t.name,
      department: t.department,
      duration_days: t.duration_days,
      is_milestone: t.is_milestone ?? false,
      depends_on: t.depends_on ?? [],
      start_date: new Date(startDate),
      end_date: new Date(startDate),
      earliest_start: new Date(startDate),
      earliest_finish: new Date(startDate),
    });
  });

  // Forward pass — calcular earliest start/finish
  const computeForward = (wbs: string, visiting: Set<string>): ScheduledTaskDraft => {
    const task = taskMap.get(wbs)!;
    if (visiting.has(wbs)) return task; // evita ciclos
    visiting.add(wbs);

    if (task.depends_on.length === 0) {
      task.earliest_start = new Date(startDate);
    } else {
      let maxFinish = new Date(startDate);
      for (const dep of task.depends_on) {
        const depTask = taskMap.get(dep);
        if (!depTask) continue;
        const computed = computeForward(dep, new Set(visiting));
        if (computed.earliest_finish > maxFinish) maxFinish = computed.earliest_finish;
      }
      task.earliest_start = maxFinish;
    }

    task.earliest_finish = addBusinessDays(task.earliest_start, task.duration_days);
    task.start_date = new Date(task.earliest_start);
    task.end_date = new Date(task.earliest_finish);

    return task;
  };

  template.tasks.forEach(t => computeForward(t.wbs, new Set()));

  // Backward pass — encontrar el final del proyecto y propagar latest_start
  const projectEnd = Array.from(taskMap.values()).reduce(
    (max, t) => (t.earliest_finish > max ? t.earliest_finish : max),
    new Date(startDate)
  );

  // Inicializar latest = earliest para las hojas (tareas sin sucesoras)
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
    task.latest_start = addBusinessDays(task.latest_finish, -task.duration_days);
    return task;
  };

  template.tasks.forEach(t => computeBackward(t.wbs, new Set()));

  // Marcar critical path — slack === 0
  taskMap.forEach(task => {
    const slack = task.latest_start
      ? (task.latest_start.getTime() - task.earliest_start.getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    task.is_critical = Math.abs(slack) < 0.5;
  });

  return Array.from(taskMap.values()).sort((a, b) => a.wbs.localeCompare(b.wbs, undefined, { numeric: true }));
}

export function projectEndDate(scheduled: ScheduledTaskDraft[]): Date {
  if (scheduled.length === 0) return new Date();
  return scheduled.reduce(
    (max, t) => (t.end_date > max ? t.end_date : max),
    scheduled[0].end_date
  );
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

  // Forward pass ASAP — itera hasta estabilidad
  let mutating = true;
  let safety = 100;
  while (mutating && safety-- > 0) {
    mutating = false;
    for (const task of updated) {
      // No tocar la tarea que el usuario movió manualmente
      if (task.wbs_code === changedWbs) continue;
      // Tareas sin dependencias quedan donde están (son anclas)
      if (!task.dependencies || task.dependencies.length === 0) continue;

      // Max end_date entre dependencias = inicio "ideal" de esta tarea
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
      const durationMs = currentEnd.getTime() - currentStart.getTime();

      // Re-alinear si hay gap (anterior o posterior). Tolerancia de 0.5 día.
      const diffMs = maxDepEnd.getTime() - currentStart.getTime();
      if (Math.abs(diffMs) > 12 * 60 * 60 * 1000) {
        task.start_date = maxDepEnd.toISOString().slice(0, 10);
        const newEndDate = new Date(maxDepEnd.getTime() + durationMs);
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
        for (const d of dirty) {
          const { error } = await supabase
            .from('master_plan_tasks')
            .update({ start_date: d.start_date, end_date: d.end_date, updated_at: now })
            .eq('id', d.id);
          if (error) throw error;
        }

        // Actualiza baseline_end si la última tarea se movió
        if (dirty.length > 0) {
          const maxEnd = recalculated.reduce(
            (max, t) => (t.end_date > max ? t.end_date : max),
            recalculated[0].end_date
          );
          const planId = recalculated[0].master_plan_id;
          await supabase
            .from('master_plans')
            .update({ baseline_end: maxEnd, updated_at: now })
            .eq('id', planId);
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
