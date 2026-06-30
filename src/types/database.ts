/**
 * Tipos TypeScript del schema de Supabase.
 * Espejean `database_schema.sql`. Cuando ejecutes `apply_migration` en
 * Supabase, puedes regenerar este archivo automáticamente con:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ============================================================================
// ENUMS / STATUS LITERALS
// ============================================================================

export type ProjectStatus =
  | 'Cotización'
  | 'Diseño'
  | 'Compras'
  | 'En Producción'
  | 'Calidad'
  | 'Embarque'
  | 'Entregado'
  | 'Cancelado';

export type BomStatus = 'Pendiente' | 'Solicitado' | 'Tránsito' | 'Recibido' | 'Stock';
export type ManufacturingStatus = 'PENDIENTE' | 'EN PROCESO' | 'CALIDAD' | 'TERMINADO' | 'RECHAZADO';
export type Priority = 'Alta' | 'Media' | 'Baja';
export type WorkOrderPriority = 'Normal' | 'Alta' | 'Urgente' | 'Crítica';
export type WorkOrderStatus =
  | 'Pendiente'
  | 'Setup'
  | 'En Proceso'
  | 'Pausado'
  | 'Calidad'
  | 'Completado'
  | 'Cancelado';
export type StageStatus = 'Pendiente' | 'En Proceso' | 'Pausado' | 'Completado' | 'Saltado';
export type RequisitionStatus =
  | 'Pendiente'
  | 'Cotizando'
  | 'Aprobada'
  | 'Rechazada'
  | 'Ordenada'
  | 'Cerrada';
export type PoStatus =
  | 'Borrador'
  | 'Emitida'
  | 'Confirmada'
  | 'Tránsito'
  | 'Recibida_Parcial'
  | 'Recibida'
  | 'Cerrada'
  | 'Cancelada';
export type MachineStatus =
  | 'Disponible'
  | 'Operando'
  | 'Setup'
  | 'Mantenimiento'
  | 'Fuera_Servicio';
export type InspectionType = 'Recibo Material' | 'Primera Pieza' | 'En Proceso' | 'Final';
export type InspectionResult = 'Aprobado' | 'Rechazado' | 'Con Observaciones';
export type NcrSeverity = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type NcrStatus = 'Abierta' | 'En Investigación' | 'Acción Correctiva' | 'Cerrada';
export type InstrumentStatus = 'Calibrado' | 'Por Calibrar' | 'Vencido' | 'Fuera de Servicio';
export type ShipmentStatus = 'Preparando' | 'Listo' | 'En Tránsito' | 'Entregado' | 'Cancelado';
export type ProjectFileCategory =
  | 'OC_Cliente'
  | 'BOM'
  | 'Plano_2D'
  | 'Modelo_3D'
  | 'Cotizacion'
  | 'Contrato'
  | 'Foto'
  | 'Reporte_QA'
  | 'Otro';
export type MessageType = 'USER' | 'SYSTEM' | 'PROJECT' | 'QUALITY' | 'PURCHASE' | 'PRODUCTION';
export type PmoReportType = 'Semanal' | 'Quincenal' | 'Mensual' | 'Cierre' | 'Ad-hoc';

// ============================================================================
// TABLA: company_settings
// ============================================================================

export interface CompanySettings {
  id: string;
  legal_name: string;
  commercial_name: string;
  tagline: string | null;
  rfc: string | null;
  tax_regime: string | null;
  address_street: string | null;
  address_ext: string | null;
  address_int: string | null;
  address_neighborhood: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  legal_rep: string | null;
  logo_url: string | null;
  primary_color: string | null;
  currency: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_clabe?: string | null;
  bank_beneficiary?: string | null;
  payment_notes?: string | null;
  dashboard_mode?: DashboardMode | null;
  created_at: string;
  updated_at: string;
}

/** Variante de tablero según el giro: operativo (manufactura/proyectos) o
 *  ventas (comercio/proveeduría que vende artículos). */
export type DashboardMode = 'operations' | 'sales';

// ============================================================================
// TABLA: profiles
// ============================================================================

export interface ProfileMetadata {
  bio?: string;
  skills?: { name: string; level: number }[];
  certifications?: string[];
  experience?: string;
  bonus?: number;
  efficiency?: number;
  shift?: string;
  /** Rutas de módulos permitidas para ESTE usuario (override del rol). Si está
   *  vacío o ausente, el acceso lo define el rol (permissions.ts). */
  permissions?: string[];
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  department: string;
  phone: string | null;
  status: string;
  join_date: string;
  bio: string | null;
  salary: number;
  pin_code: string | null;
  metadata: ProfileMetadata;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: customers
// ============================================================================

export interface Customer {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: suppliers
// ============================================================================

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  tax_id: string | null;
  address: string | null;
  payment_terms: string | null;
  rating: number | null;
  is_certified: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLAS: cotizaciones
// ============================================================================

export type QuoteStatus =
  | 'Borrador'
  | 'Enviada'
  | 'Aprobada'
  | 'Rechazada'
  | 'Convertida'
  | 'Expirada';

export interface MaterialPrice {
  id: string;
  material: string;
  description: string | null;
  uom: string;
  unit_price: number;
  currency: string;
  supplier_id: string | null;
  supplier_name: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  customer_id: string | null;
  client_name: string;
  client_email?: string | null;
  project_name: string;
  status: QuoteStatus;
  currency: string;
  margin_pct: number;
  tax_pct: number;
  machine_rate_per_hour: number;
  valid_until: string | null;
  delivery_time?: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  converted_project_id: string | null;
  inventory_deducted?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  part_number: string;
  description: string | null;
  quantity: number;
  material_price_id: string | null;
  material_name: string | null;
  inventory_item_id?: string | null;
  material_qty: number;
  material_unit_cost: number;
  machining_hours: number;
  machine_rate: number;
  extra_cost: number;
  margin_pct: number | null;
  drawing_file: string | null;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// TABLA: projects
// ============================================================================

export interface Project {
  id: string;
  name: string;
  customer_id: string | null;
  client_name: string;
  status: ProjectStatus;
  progress: number;
  purchase_order: string | null;
  quote_amount: number | null;
  currency: string;
  start_date: string;
  deadline: string;
  delivered_at: string | null;
  manager_id: string | null;
  description: string | null;
  client_portal_token: string | null;
  client_portal_expires: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLAS: project_tasks, project_notes, master_plan
// ============================================================================

export type ProjectTaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export interface ProjectTask {
  id: string;
  project_id: string;
  name: string;
  scheduled_date: string | null;
  start_date: string | null;
  end_date: string | null;
  department: Department | string | null;
  progress: number;
  status: ProjectTaskStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProjectNoteType = 'note' | 'system' | 'status_change' | 'milestone';

export interface ProjectNote {
  id: string;
  project_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  note_type: ProjectNoteType;
  created_at: string;
}

export type MasterPlanMethodology = 'PMI-Predictivo' | 'Ágil' | 'Híbrido';
export type MasterPlanStatus = 'Borrador' | 'Activo' | 'Archivado';
export type Department = 'Compras' | 'Diseño' | 'Producción' | 'Calidad' | 'Embarque';

export interface MasterPlan {
  id: string;
  project_id: string;
  name: string;
  version: number;
  methodology: MasterPlanMethodology;
  template_used: string | null;
  baseline_start: string;
  baseline_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: MasterPlanStatus;
  risk_summary: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MasterPlanTask {
  id: string;
  master_plan_id: string;
  wbs_code: string;
  name: string;
  department: Department | null;
  start_date: string;
  end_date: string;
  progress: number;
  is_milestone: boolean;
  is_critical_path: boolean;
  dependencies: string[]; // array of wbs_code
  assigned_to: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type MeetingType = 'Kick-off' | 'Semanal' | 'Quincenal' | 'Mensual' | 'Hito' | 'Cierre';
export type MeetingStatus = 'Programada' | 'Realizada' | 'Cancelada';

/** Un compromiso / acción acordada en la junta. */
export interface MinuteActionItem {
  task: string;
  owner?: string;
  due?: string;
}

/** Minuta de junta: datos de origen ("prompt") + documento editable generado. */
export interface MeetingMinute {
  // Datos capturados por el usuario
  purpose: string;
  discussion: string;
  attendees: string[];
  agreements: string[];
  actionItems: MinuteActionItem[];
  location?: string;
  // Documento profesional generado y editable
  title: string;
  intro: string;
  topics: string;
  closing: string;
  /** Cuerpo enriquecido (HTML) editable: negritas, listas, tablas, imágenes.
   *  Es la fuente de verdad del documento; intro/topics/closing quedan como
   *  semillas/legado para regenerar. */
  bodyHtml?: string;
  // Metadatos
  generatedAt: string;
  updatedAt: string;
}

export interface ProjectMeeting {
  id: string;
  project_id: string;
  master_plan_id: string | null;
  title: string;
  meeting_type: MeetingType;
  scheduled_at: string;
  duration_minutes: number;
  attendees: string[];
  status: MeetingStatus;
  notes: string | null;
  minutes: MeetingMinute | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: project_files
// ============================================================================

export interface ProjectFile {
  id: string;
  project_id: string;
  bom_item_id: string | null;
  category: ProjectFileCategory;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  is_client_visible: boolean;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// TABLA: bom_items
// ============================================================================

export interface BomItem {
  id: string;
  project_id: string;
  part_number: string;
  description: string | null;
  category: string;
  material: string | null;
  quantity: number;
  production_quantity: number | null;
  uom: string;
  bom_status: BomStatus;
  manufacturing_status: ManufacturingStatus;
  drawing_url: string | null;
  model_url: string | null;
  assigned_technician_id: string | null;
  unit_price: number | null;
  currency: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  requisition_date: string | null;
  delivery_date: string | null;
  actual_delivery_date: string | null;
  notes: string | null;
  production_relevant: boolean;
  /** Marca de "parte en riesgo" (entrega/criticidad) para seguimiento de compras. */
  at_risk?: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: requisitions
// ============================================================================

export interface Requisition {
  id: string;
  project_id: string | null;
  bom_item_id: string | null;
  description: string;
  quantity: number;
  uom: string;
  requester_id: string | null;
  priority: Priority;
  status: RequisitionStatus;
  notes: string | null;
  needed_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: purchase_orders
// ============================================================================

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  project_id: string | null;
  status: PoStatus;
  total_amount: number;
  currency: string;
  issued_at: string | null;
  expected_delivery: string | null;
  received_at: string | null;
  issued_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  requisition_id: string | null;
  bom_item_id: string | null;
  /** Producto de inventario que se sumará al stock al recibir (opcional). */
  inventory_item_id?: string | null;
  description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  line_total: number;
  received_qty: number;
  created_at: string;
}

// ============================================================================
// TABLA: machines
// ============================================================================

export interface Machine {
  id: string;
  type: string;
  status: MachineStatus;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: work_orders
// ============================================================================

export interface WorkOrder {
  id: string;
  project_id: string;
  bom_item_id: string;
  machine_id: string | null;
  assigned_technician_id: string | null;
  quantity: number;
  completed_qty: number;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderStage {
  id: string;
  work_order_id: string;
  sequence: number;
  name: string;
  status: StageStatus;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  started_at: string | null;
  completed_at: string | null;
  operator_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  work_order_id: string;
  stage_id: string | null;
  operator_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// TABLA: calidad
// ============================================================================

export interface QualityInspection {
  id: string;
  project_id: string;
  bom_item_id: string;
  work_order_id: string | null;
  inspection_type: InspectionType;
  inspector_id: string | null;
  inspection_date: string;
  result: InspectionResult;
  sample_size: number | null;
  notes: string | null;
  report_url: string | null;
  created_at: string;
}

export interface Ncr {
  id: string;
  project_id: string;
  bom_item_id: string;
  inspection_id: string | null;
  issue_description: string;
  severity: NcrSeverity;
  status: NcrStatus;
  root_cause: string | null;
  action_plan: string | null;
  notify_customer: boolean;
  created_by: string | null;
  closed_by: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface MeasurementInstrument {
  id: string;
  name: string;
  brand: string | null;
  serial_number: string | null;
  last_calibration: string | null;
  next_calibration: string | null;
  status: InstrumentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: dimensional_reports (FAIR / inspección dimensional ISO 9001)
// ============================================================================

export type DimensionalStatus = 'Borrador' | 'Aprobado' | 'Rechazado';

/** Una burbuja ("globo") colocada sobre el plano. x/y en % (0–100) relativo
 *  al tamaño renderizado de la imagen, para que escale con el zoom. */
export interface DimensionalBalloon {
  n: number;
  x: number;
  y: number;
}

/** Tipo de característica: cota dimensional (numérica) o calibre pasa/no pasa
 *  para rosca o dowel (atributo OK/NOK). */
export type DimensionalKind = 'dimensional' | 'rosca' | 'dowel';

/** Lectura de una pieza: número (dimensional) u OK/NOK (rosca/dowel). */
export type DimensionalReading = number | 'OK' | 'NOK' | null;

/** Una característica a inspeccionar (un renglón del reporte), ligada a la
 *  burbuja con el mismo número. `readings` tiene una lectura por pieza de la
 *  muestra (longitud = sample_size); null = sin capturar. */
export interface DimensionalCharacteristic {
  n: number;
  label: string;
  /** Tipo de verificación; por defecto 'dimensional'. */
  kind?: DimensionalKind;
  /** Cota nominal */
  nominal: number | null;
  /** Tolerancias como magnitudes positivas. USL = nominal + tolPlus,
   *  LSL = nominal - tolMinus. */
  tolPlus: number | null;
  tolMinus: number | null;
  unit: string;
  /** Instrumento de medición usado (opcional, trazabilidad ISO) */
  instrument?: string | null;
  readings: DimensionalReading[];
}

export interface DimensionalPayload {
  balloons: DimensionalBalloon[];
  characteristics: DimensionalCharacteristic[];
  /** Relación de aspecto de la imagen base (alto/ancho) para reconstruir el
   *  lienzo al reabrir el reporte. */
  imageAspect?: number;
}

export interface DimensionalReport {
  id: string;
  project_id: string;
  bom_item_id: string;
  part_number: string | null;
  title: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  sample_size: number;
  status: DimensionalStatus;
  drawing_image: string | null;
  report_url: string | null;
  payload: DimensionalPayload;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TABLA: embarques
// ============================================================================

export interface Shipment {
  id: string;
  project_id: string;
  status: ShipmentStatus;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  ship_to_address: string | null;
  packing_list_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingLabel {
  id: string;
  shipment_id: string;
  box_number: string;
  weight_kg: number | null;
  dimensions_cm: string | null;
  qr_token: string;
  label_pdf_url: string | null;
  printed_at: string | null;
  created_at: string;
}

export interface ShippingLabelItem {
  id: string;
  label_id: string;
  bom_item_id: string | null;
  description: string;
  quantity: number;
  uom: string;
  created_at: string;
}

// ============================================================================
// TABLA: PMO + chat + automatización
// ============================================================================

export interface PmoReport {
  id: string;
  project_id: string;
  report_type: PmoReportType;
  period_start: string | null;
  period_end: string | null;
  progress_snapshot: number | null;
  summary: string | null;
  pdf_url: string | null;
  sent_to_client: boolean;
  sent_at: string | null;
  generated_by: string | null;
  created_at: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  project_id: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string | null;
  content: string;
  message_type: MessageType;
  created_at: string;
}

export interface AutomationEvent {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Json | null;
  delivered: boolean;
  delivered_at: string | null;
  error: string | null;
  created_at: string;
}

// ============================================================================
// Database schema helper (formato compatible con supabase-js)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles:                { Row: Profile;                Insert: Partial<Profile>;                Update: Partial<Profile> };
      customers:               { Row: Customer;               Insert: Partial<Customer>;               Update: Partial<Customer> };
      suppliers:               { Row: Supplier;               Insert: Partial<Supplier>;               Update: Partial<Supplier> };
      material_prices:         { Row: MaterialPrice;          Insert: Partial<MaterialPrice>;          Update: Partial<MaterialPrice> };
      quotes:                  { Row: Quote;                  Insert: Partial<Quote>;                  Update: Partial<Quote> };
      quote_items:             { Row: QuoteItem;              Insert: Partial<QuoteItem>;              Update: Partial<QuoteItem> };
      projects:                { Row: Project;                Insert: Partial<Project>;                Update: Partial<Project> };
      project_files:           { Row: ProjectFile;            Insert: Partial<ProjectFile>;            Update: Partial<ProjectFile> };
      project_tasks:           { Row: ProjectTask;            Insert: Partial<ProjectTask>;            Update: Partial<ProjectTask> };
      project_notes:           { Row: ProjectNote;            Insert: Partial<ProjectNote>;            Update: Partial<ProjectNote> };
      master_plans:            { Row: MasterPlan;             Insert: Partial<MasterPlan>;             Update: Partial<MasterPlan> };
      master_plan_tasks:       { Row: MasterPlanTask;         Insert: Partial<MasterPlanTask>;         Update: Partial<MasterPlanTask> };
      project_meetings:        { Row: ProjectMeeting;         Insert: Partial<ProjectMeeting>;         Update: Partial<ProjectMeeting> };
      bom_items:               { Row: BomItem;                Insert: Partial<BomItem>;                Update: Partial<BomItem> };
      requisitions:            { Row: Requisition;            Insert: Partial<Requisition>;            Update: Partial<Requisition> };
      purchase_orders:         { Row: PurchaseOrder;          Insert: Partial<PurchaseOrder>;          Update: Partial<PurchaseOrder> };
      purchase_order_items:    { Row: PurchaseOrderItem;      Insert: Partial<PurchaseOrderItem>;      Update: Partial<PurchaseOrderItem> };
      machines:                { Row: Machine;                Insert: Partial<Machine>;                Update: Partial<Machine> };
      work_orders:             { Row: WorkOrder;              Insert: Partial<WorkOrder>;              Update: Partial<WorkOrder> };
      work_order_stages:       { Row: WorkOrderStage;         Insert: Partial<WorkOrderStage>;         Update: Partial<WorkOrderStage> };
      time_entries:            { Row: TimeEntry;              Insert: Partial<TimeEntry>;              Update: Partial<TimeEntry> };
      quality_inspections:     { Row: QualityInspection;      Insert: Partial<QualityInspection>;      Update: Partial<QualityInspection> };
      ncrs:                    { Row: Ncr;                    Insert: Partial<Ncr>;                    Update: Partial<Ncr> };
      measurement_instruments: { Row: MeasurementInstrument;  Insert: Partial<MeasurementInstrument>;  Update: Partial<MeasurementInstrument> };
      shipments:               { Row: Shipment;               Insert: Partial<Shipment>;               Update: Partial<Shipment> };
      shipping_labels:         { Row: ShippingLabel;          Insert: Partial<ShippingLabel>;          Update: Partial<ShippingLabel> };
      shipping_label_items:    { Row: ShippingLabelItem;      Insert: Partial<ShippingLabelItem>;      Update: Partial<ShippingLabelItem> };
      pmo_reports:             { Row: PmoReport;              Insert: Partial<PmoReport>;              Update: Partial<PmoReport> };
      chat_channels:           { Row: ChatChannel;            Insert: Partial<ChatChannel>;            Update: Partial<ChatChannel> };
      chat_messages:           { Row: ChatMessage;            Insert: Partial<ChatMessage>;            Update: Partial<ChatMessage> };
      automation_events:       { Row: AutomationEvent;        Insert: Partial<AutomationEvent>;        Update: Partial<AutomationEvent> };
    };
  };
}

// ============================================================================
// TABLAS: inventory_items / inventory_movements (módulo de Inventario)
// ============================================================================

export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste';

export interface InventoryItem {
  id: string;
  tenant_id?: string | null;
  sku: string | null;
  name: string;
  category: string;
  uom: string;
  stock: number;
  min_stock: number;
  max_stock: number | null;
  unit_cost: number;
  unit_price: number;
  location: string | null;
  supplier_name: string | null;
  barcode: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  tenant_id?: string | null;
  item_id: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string | null;
  reference: string | null;
  balance_after: number | null;
  created_by: string | null;
  created_at: string;
}

/** Estado de un item según su stock vs min/max. */
export type StockStatus = 'agotado' | 'bajo' | 'sobre' | 'ok';
