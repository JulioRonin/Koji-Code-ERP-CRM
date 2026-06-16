/**
 * Definiciones de campo de BomItem para el motor de filtros/agrupación.
 * Compartido por los módulos que listan piezas (Compras, Producción,
 * Calidad, Diseño). Cada módulo escoge qué subconjunto usar.
 */
import type { BomItem } from '@/types/database';
import type { FieldDef } from './tableControls';

const BOM_STATUS_OPTIONS = ['Pendiente', 'Solicitado', 'Tránsito', 'Recibido', 'Stock'];
const MFG_STATUS_OPTIONS = ['PENDIENTE', 'EN PROCESO', 'CALIDAD', 'TERMINADO', 'RECHAZADO'];

export const BOM_FIELD_PART: FieldDef<BomItem> = {
  key: 'part_number',
  label: 'No. parte',
  type: 'text',
  get: r => r.part_number,
  groupable: false,
};

export const BOM_FIELD_DESCRIPTION: FieldDef<BomItem> = {
  key: 'description',
  label: 'Descripción',
  type: 'text',
  get: r => r.description ?? '',
  groupable: false,
};

export const BOM_FIELD_CATEGORY: FieldDef<BomItem> = {
  key: 'category',
  label: 'Categoría / Grupo',
  type: 'select',
  get: r => r.category || 'Sin categoría',
};

export const BOM_FIELD_BOM_STATUS: FieldDef<BomItem> = {
  key: 'bom_status',
  label: 'Estatus de compra',
  type: 'status',
  options: BOM_STATUS_OPTIONS,
  get: r => r.bom_status,
};

export const BOM_FIELD_MFG_STATUS: FieldDef<BomItem> = {
  key: 'manufacturing_status',
  label: 'Estatus de producción',
  type: 'status',
  options: MFG_STATUS_OPTIONS,
  get: r => r.manufacturing_status,
};

export const BOM_FIELD_SUPPLIER: FieldDef<BomItem> = {
  key: 'supplier_name',
  label: 'Proveedor',
  type: 'select',
  get: r => r.supplier_name ?? '',
};

export const BOM_FIELD_PRODUCTION: FieldDef<BomItem> = {
  key: 'production_relevant',
  label: 'Va a producción',
  type: 'boolean',
  get: r => r.production_relevant !== false,
};

export const BOM_FIELD_HAS_DRAWING: FieldDef<BomItem> = {
  key: 'has_drawing',
  label: 'Tiene plano 2D',
  type: 'boolean',
  get: r => !!r.drawing_url,
};

export const BOM_FIELD_HAS_IMAGE: FieldDef<BomItem> = {
  key: 'has_image',
  label: 'Tiene imagen',
  type: 'boolean',
  get: r => !!r.image_url,
};

export const BOM_FIELD_ASSIGNED: FieldDef<BomItem> = {
  key: 'assigned',
  label: 'Asignación',
  type: 'boolean',
  get: r => !!r.assigned_technician_id,
};

/** Compras: precio/proveedor/fechas/estatus de compra. */
export const PURCHASING_FIELDS: FieldDef<BomItem>[] = [
  BOM_FIELD_PART,
  BOM_FIELD_DESCRIPTION,
  BOM_FIELD_CATEGORY,
  BOM_FIELD_BOM_STATUS,
  BOM_FIELD_SUPPLIER,
  BOM_FIELD_PRODUCTION,
];

/** Producción: estatus de manufactura + asignación. */
export const PRODUCTION_FIELDS: FieldDef<BomItem>[] = [
  BOM_FIELD_PART,
  BOM_FIELD_DESCRIPTION,
  BOM_FIELD_CATEGORY,
  BOM_FIELD_MFG_STATUS,
  BOM_FIELD_BOM_STATUS,
  BOM_FIELD_ASSIGNED,
];

/** Calidad: estatus de manufactura. */
export const QUALITY_FIELDS: FieldDef<BomItem>[] = [
  BOM_FIELD_PART,
  BOM_FIELD_DESCRIPTION,
  BOM_FIELD_CATEGORY,
  BOM_FIELD_MFG_STATUS,
];

/** Diseño: categoría + cobertura de planos/imagen. */
export const DESIGN_FIELDS: FieldDef<BomItem>[] = [
  BOM_FIELD_PART,
  BOM_FIELD_DESCRIPTION,
  BOM_FIELD_CATEGORY,
  BOM_FIELD_HAS_DRAWING,
  BOM_FIELD_HAS_IMAGE,
  BOM_FIELD_MFG_STATUS,
];
