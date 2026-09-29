/**
 * Mantenimiento preventivo — reglas del PR-MTO-001 y formato FR-MTO-001.
 * Lógica pura (sin React): familias de equipo, plantillas de tareas,
 * puntos del checklist diario, frecuencias y semáforo de vencimientos.
 */
import type {
  EquipmentFamily,
  MaintenanceFrequency,
  MaintenanceLevel,
  MaintenanceChecklistItem,
} from '@/types/database';

export const MTO_DOC = { code: 'PR-MTO-001', form: 'FR-MTO-001', title: 'Mantenimiento Preventivo de Equipos' } as const;

export const FAMILIES: { key: EquipmentFamily; label: string; area: string }[] = [
  { key: 'convencional', label: 'Torno y fresadora convencionales', area: 'Convencional' },
  { key: 'rectificadora', label: 'Rectificadora', area: 'Convencional' },
  { key: 'sierra', label: 'Sierra cinta', area: 'Corte' },
  { key: 'cnc', label: 'Centros de maquinado y torno CNC', area: 'CNC' },
  { key: 'router', label: 'Router CNC', area: 'CNC' },
  { key: 'compresor', label: 'Compresores de aire', area: 'Servicios' },
];

export const familyLabel = (f: EquipmentFamily | null | undefined) =>
  FAMILIES.find(x => x.key === f)?.label ?? 'Sin familia';

/** Sugiere la familia a partir del tipo de máquina capturado en Producción. */
export function inferFamily(type: string): EquipmentFamily | null {
  const t = type.toLowerCase();
  if (t.includes('router')) return 'router';
  if (t.includes('rectific')) return 'rectificadora';
  if (t.includes('sierra') || t.includes('cinta')) return 'sierra';
  if (t.includes('compres')) return 'compresor';
  if (t.includes('cnc') || t.includes('centro de maquinado') || t.includes('suizo')) return 'cnc';
  if (t.includes('torno') || t.includes('fresa')) return 'convencional';
  return null;
}

export const FREQUENCIES: MaintenanceFrequency[] = ['Semanal', 'Quincenal', 'Mensual', 'Trimestral', 'Semestral', 'Anual'];

export const FREQ_DAYS: Record<MaintenanceFrequency, number> = {
  Semanal: 7,
  Quincenal: 15,
  Mensual: 30,
  Trimestral: 90,
  Semestral: 182,
  Anual: 365,
};

export interface TaskTemplate {
  description: string;
  frequency: MaintenanceFrequency;
  level: MaintenanceLevel;
  performer: 'Técnico' | 'Proveedor';
}

const T = (description: string, frequency: MaintenanceFrequency, level: MaintenanceLevel = 'Preventivo', performer: 'Técnico' | 'Proveedor' = 'Técnico'): TaskTemplate =>
  ({ description, frequency, level, performer });

/** Plantillas por familia (PR-MTO-001, sección 8). Lo diario va en el checklist. */
export const TEMPLATES: Record<EquipmentFamily, TaskTemplate[]> = {
  convencional: [
    T('Revisar tensión y estado de bandas', 'Semanal'),
    T('Revisar y ajustar juego de carros y mesa', 'Mensual'),
    T('Limpieza del depósito de refrigerante', 'Mensual'),
    T('Cambio de aceite de caja / cabezal', 'Semestral', 'Mayor'),
    T('Ajuste de cuñas (gibs) y nivelación', 'Anual', 'Mayor'),
  ],
  rectificadora: [
    T('Diamantado y balanceo de la muela', 'Semanal'),
    T('Limpiar separador magnético y filtro de refrigerante', 'Semanal'),
    T('Verificar paralelismo de la mesa', 'Anual', 'Mayor'),
    T('Cambio de aceite hidráulico (si aplica)', 'Anual', 'Mayor'),
  ],
  sierra: [
    T('Tensión de la cinta; guías y rodamientos de guía', 'Semanal'),
    T('Limpieza general de la sierra', 'Mensual'),
    T('Revisar rodamientos de volantes', 'Semestral', 'Mayor'),
    T('Cambio de aceite de la caja reductora', 'Anual', 'Mayor'),
  ],
  cnc: [
    T('Concentración de refrigerante (refractómetro)', 'Semanal'),
    T('Limpiar cono del husillo y cambiador de herramientas', 'Semanal'),
    T('Limpiar filtros del gabinete eléctrico', 'Mensual'),
    T('Respaldo de parámetros y programas', 'Semestral'),
    T('Verificar geometría y juego de ejes (backlash)', 'Anual', 'Mayor', 'Proveedor'),
    T('Cambio de aceite hidráulico', 'Anual', 'Mayor'),
  ],
  router: [
    T('Lubricar rieles y husillos de bolas', 'Semanal'),
    T('Revisar pinzas y fresas', 'Semanal'),
    T('Limpiar filtros del colector de polvo', 'Mensual'),
    T('Revisar rodamientos del husillo (spindle)', 'Anual', 'Mayor', 'Proveedor'),
    T('Escuadra y nivelación del pórtico', 'Anual', 'Mayor'),
  ],
  compresor: [
    T('Cambiar / limpiar filtro de aire', 'Mensual'),
    T('Nivel de aceite; drenes y secador', 'Mensual'),
    T('Cambio de aceite y separador (según horas)', 'Semestral', 'Mayor', 'Proveedor'),
    T('Prueba de la válvula de seguridad', 'Anual', 'Mayor'),
  ],
};

/** FR-MTO-001 sección A — puntos generales (todas las máquinas). */
export const GENERAL_CHECK_ITEMS: { key: string; label: string }[] = [
  { key: 'g1', label: 'Limpieza de viruta y área de trabajo' },
  { key: 'g2', label: 'Nivel de aceite de guías / lubricación' },
  { key: 'g3', label: 'Nivel y estado del refrigerante' },
  { key: 'g4', label: 'Presión de aire correcta' },
  { key: 'g5', label: 'Sin fugas (aceite, refrigerante, aire)' },
  { key: 'g6', label: 'Guardas y paro de emergencia funcionando' },
  { key: 'g7', label: 'Sin ruidos, vibraciones ni alarmas anormales' },
  { key: 'g8', label: 'Sujeción (chuck, prensa, mordazas) en buen estado' },
];

/** FR-MTO-001 sección B — puntos específicos por familia. */
export const FAMILY_CHECK_ITEMS: Record<EquipmentFamily, string[]> = {
  convencional: ['Lubricar bancada, guías y carros (aceitera)', 'Nivel de aceite de la caja', 'Bandas sin desgaste ni holgura'],
  rectificadora: ['Protección de la muela colocada', 'Muela sin grietas; diamantado al día', 'Separador magnético / filtro limpio'],
  sierra: ['Cinta sin dientes rotos', 'Tensión y guías de la cinta', 'Cepillo limpia-viruta funcionando'],
  cnc: ['Tanque de lubricación automática con nivel', 'Cono del husillo y cambiador limpios', 'Calentamiento del husillo al arranque'],
  router: ['Colector de polvo funcionando', 'Vacío de la mesa correcto', 'Pinzas y fresas en buen estado'],
  compresor: ['Purga de condensados del tanque', 'Nivel de aceite', 'Presión de corte y arranque normal'],
};

/** Puntos del checklist para una máquina (generales + específicos de su familia). */
export function checklistItemsFor(family: EquipmentFamily | null | undefined): MaintenanceChecklistItem[] {
  const general = family === 'compresor'
    ? GENERAL_CHECK_ITEMS.filter(i => ['g5', 'g6', 'g7'].includes(i.key)) // compresor: sin viruta, refrigerante ni sujeción
    : GENERAL_CHECK_ITEMS;
  const specific = family ? FAMILY_CHECK_ITEMS[family].map((label, i) => ({ key: `s${i + 1}`, label })) : [];
  return [...general, ...specific].map(i => ({ ...i, result: null }));
}

export const SHIFTS = ['Matutino', 'Vespertino', 'Nocturno'];

// ── Fechas ────────────────────────────────────────────────────────────────
export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const a = new Date(`${todayStr()}T12:00:00`).getTime();
  const b = new Date(`${date}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export type DueState = 'overdue' | 'due_soon' | 'ok' | 'unknown';

/** Semáforo: vencido (<0 días), por vencer (≤7 días), al día. */
export function dueState(nextDue: string | null | undefined, warnDays = 7): DueState {
  const d = daysUntil(nextDue);
  if (d == null) return 'unknown';
  if (d < 0) return 'overdue';
  if (d <= warnDays) return 'due_soon';
  return 'ok';
}

export function dueLabel(nextDue: string | null | undefined): string {
  const d = daysUntil(nextDue);
  if (d == null) return 'Sin fecha';
  if (d < 0) return `vencido hace ${Math.abs(d)} d`;
  if (d === 0) return 'vence hoy';
  return `en ${d} d`;
}

/** Folio legible de orden de mantenimiento: OM-2026-123456. */
export function newOrderId(): string {
  return `OM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

/** Reprogramación permitida: una sola vez y máximo 7 días (PR-MTO-001, criterios). */
export const MAX_REPROGRAM_DAYS = 7;
