import type {
  CaActionType,
  CaArea,
  CaPriority,
  CaSourceType,
  CaStatus,
  ManufacturingStatus,
  NcrDisposition,
  NcrStatus,
} from '@/types/database';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

/** Áreas que alimentan el action list de acciones correctivas. */
export const CA_AREAS: CaArea[] = ['Calidad', 'Producción', 'Diseño', 'Compras', 'Ventas', 'Cliente', 'Auditoría', 'Otra'];

/** Color por área (punto/etiqueta), para distinguir el origen de un vistazo. */
export const AREA_COLOR: Record<CaArea, string> = {
  Calidad: '#15803d',
  Producción: '#0369a1',
  Diseño: '#0ea5e9',
  Compras: '#7c3aed',
  Ventas: '#b45309',
  Cliente: '#dc2626',
  Auditoría: '#475569',
  Otra: '#94a3b8',
};

export const CA_SOURCE_TYPES: CaSourceType[] = ['NCR', 'Plan de control', 'Queja de cliente', 'Auditoría', 'Proveedor', 'Mejora', 'Otro'];
export const CA_ACTION_TYPES: CaActionType[] = ['Contención', 'Correctiva', 'Preventiva', 'Mejora'];
export const CA_PRIORITIES: CaPriority[] = ['Alta', 'Media', 'Baja'];
export const CA_STATUSES: CaStatus[] = ['Abierta', 'En proceso', 'En verificación', 'Cerrada', 'Cancelada'];

export const CA_STATUS_VARIANT: Record<CaStatus, BadgeVariant> = {
  Abierta: 'destructive',
  'En proceso': 'warning',
  'En verificación': 'default',
  Cerrada: 'success',
  Cancelada: 'outline',
};

export const PRIORITY_VARIANT: Record<CaPriority, BadgeVariant> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

// ── Producto no conforme ─────────────────────────────────────────────────
export const NCR_STATUS_VARIANT: Record<NcrStatus, BadgeVariant> = {
  Abierta: 'destructive',
  'En Investigación': 'warning',
  'Acción Correctiva': 'default',
  Cerrada: 'success',
};

export const SEVERITY_VARIANT: Record<string, BadgeVariant> = {
  Crítica: 'destructive',
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

export const DETECTED_AREAS = ['Calidad', 'Producción', 'Recibo (material)', 'Cliente', 'Proveedor'];
export const DEFECT_TYPES = ['Dimensional', 'Acabado superficial', 'Material / certificado', 'Tratamiento', 'Daño / golpe', 'Documentación', 'Otro'];

export const DISPOSITIONS: NcrDisposition[] = [
  'Retrabajo',
  'Reparación',
  'Reinspección 100%',
  'Usar como está',
  'Devolver a proveedor',
  'Desecho',
];

/**
 * Efecto de cada disposición sobre la pieza (estatus de fabricación) y guía
 * para quien decide (comité MRB).
 */
export const DISPOSITION_META: Record<NcrDisposition, { next: ManufacturingStatus; hint: string }> = {
  Retrabajo: { next: 'EN PROCESO', hint: 'La pieza regresa a Producción para corregirse y vuelve a inspección.' },
  Reparación: { next: 'EN PROCESO', hint: 'Se repara con un método aprobado; puede requerir autorización del cliente.' },
  'Reinspección 100%': { next: 'CALIDAD', hint: 'Se reinspecciona todo el lote antes de liberar.' },
  'Usar como está': { next: 'TERMINADO', hint: 'Concesión: se libera con la desviación. Requiere autorización del cliente.' },
  'Devolver a proveedor': { next: 'RECHAZADO', hint: 'Material/servicio externo no conforme: se reclama al proveedor.' },
  Desecho: { next: 'RECHAZADO', hint: 'Scrap: la pieza se identifica y segrega para su destrucción.' },
};

/** Plan de control. */
export const CONTROL_METHODS = ['Hoja de inspección', 'Inspección de 1a pieza', 'SPC (carta de control)', 'Poka-yoke', 'Inspección visual', 'Gauge pasa / no pasa', 'Reporte dimensional (CMM)'];
export const FREQUENCIES = ['1a pieza', 'Última pieza', 'Cada hora', 'Cada 5 piezas', 'Por lote', 'Por turno', '100%'];

/** Estilo común para <select> nativos en formularios de calidad. */
export const SELECT_CLS =
  'w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm text-[var(--color-app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 disabled:opacity-60';
