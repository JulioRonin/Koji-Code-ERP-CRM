/**
 * Datos mock que sirven de fallback cuando Supabase no está configurado.
 * Son la fuente de la verdad para la experiencia demo. Mantén los IDs
 * consistentes entre tablas (por ejemplo proyectos referenciados en BOMs).
 */

import type {
  Project,
  BomItem,
  Requisition,
  Machine,
  WorkOrder,
  QualityInspection,
  Ncr,
  MeasurementInstrument,
  Profile,
  Customer,
  Supplier,
} from '@/types/database';

const now = new Date().toISOString();

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'cust-001', name: 'BRP',     contact_name: null, contact_email: null, phone: null, tax_id: null, address: null, notes: null, is_active: true, created_at: now, updated_at: now },
  { id: 'cust-002', name: 'Foxconn', contact_name: null, contact_email: null, phone: null, tax_id: null, address: null, notes: null, is_active: true, created_at: now, updated_at: now },
  { id: 'cust-003', name: 'Aptiv',   contact_name: null, contact_email: null, phone: null, tax_id: null, address: null, notes: null, is_active: true, created_at: now, updated_at: now },
  { id: 'cust-004', name: 'Bosch',   contact_name: null, contact_email: null, phone: null, tax_id: null, address: null, notes: null, is_active: true, created_at: now, updated_at: now },
  { id: 'cust-005', name: 'Lear',    contact_name: null, contact_email: null, phone: null, tax_id: null, address: null, notes: null, is_active: true, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 'sup-001', name: 'Aceros del Norte',      contact_name: 'Juan Pérez',   contact_email: 'ventas@acerosnorte.mx',   phone: '+52 81 1234 5678', tax_id: null, address: 'Monterrey, NL', payment_terms: 'Net 30', rating: 4, is_certified: true,  is_active: true, notes: null, created_at: now, updated_at: now },
  { id: 'sup-002', name: 'Carburos Industriales', contact_name: 'María López',  contact_email: 'ventas@carburos.mx',       phone: '+52 33 9876 5432', tax_id: null, address: 'Guadalajara, JAL', payment_terms: 'Net 60', rating: 5, is_certified: true, is_active: true, notes: null, created_at: now, updated_at: now },
  { id: 'sup-003', name: 'Tornillería Express',   contact_name: 'Carlos Ruiz',  contact_email: 'contacto@torniexpress.mx', phone: '+52 55 5544 3322', tax_id: null, address: 'CDMX',           payment_terms: 'Contado', rating: 3, is_certified: false, is_active: true, notes: null, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export const MOCK_PROFILES: Profile[] = [
  { id: 'profile-001', full_name: 'Roberto Gómez',  email: 'roberto.g@roninstudio.com', avatar_url: null, role: 'Ingeniero de Diseño',    department: 'Diseño',                phone: '+52 555 123 4567', status: 'Activo', join_date: '2022-03-15', bio: 'Especialista en CAD/CAM.', salary: 45000, pin_code: null, created_at: now, updated_at: now },
  { id: 'profile-002', full_name: 'Ana Martínez',   email: 'ana.m@roninstudio.com',     avatar_url: null, role: 'Operador CNC Master',    department: 'Producción',            phone: '+52 555 987 6543', status: 'Activo', join_date: '2023-01-10', bio: 'Centros de maquinado 5 ejes.', salary: 32000, pin_code: null, created_at: now, updated_at: now },
  { id: 'profile-003', full_name: 'Julian Herrera', email: 'julian.h@roninstudio.com',  avatar_url: null, role: 'Técnico de Calidad',     department: 'Calidad',               phone: '+52 555 456 7890', status: 'Activo', join_date: '2023-06-20', bio: 'Control dimensional / ISO.', salary: 28000, pin_code: null, created_at: now, updated_at: now },
  { id: 'profile-004', full_name: 'Admin User',     email: 'admin@imcdesign.com',        avatar_url: null, role: 'Administrador',          department: 'Administrador',         phone: '+52 555 000 1111', status: 'Activo', join_date: '2020-01-01', bio: 'Root.',                    salary: 80000, pin_code: null, created_at: now, updated_at: now },
  { id: 'profile-005', full_name: 'Técnico Senior', email: 'tecnico@imcdesign.com',      avatar_url: null, role: 'Técnico Especialista',   department: 'Técnico',               phone: '+52 555 222 3333', status: 'Activo', join_date: '2024-01-01', bio: null,                       salary: 20000, pin_code: '1234', created_at: now, updated_at: now },
  { id: 'profile-006', full_name: 'Gerente Compras', email: 'compras@imcdesign.com',     avatar_url: null, role: 'Purchasing Manager',     department: 'Compras',               phone: '+52 555 444 5555', status: 'Activo', join_date: '2021-05-01', bio: null,                       salary: 35000, pin_code: null, created_at: now, updated_at: now },
  { id: 'profile-007', full_name: 'Gerente Admin',   email: 'pm@imcdesign.com',          avatar_url: null, role: 'Project Manager',        department: 'Administración / PM',   phone: '+52 555 777 8888', status: 'Activo', join_date: '2022-01-01', bio: null,                       salary: 50000, pin_code: null, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const MOCK_PROJECTS: Project[] = [
  { id: 'IMC-2026-042', name: 'Eje Principal Ensamblaje', customer_id: 'cust-001', client_name: 'BRP',     status: 'En Producción', progress: 75,  purchase_order: 'PO-CLIENT-981', quote_amount: 125000, currency: 'MXN', start_date: '2026-03-01', deadline: '2026-04-15', delivered_at: null, manager_id: 'profile-007', description: 'Fabricación de 500 ejes principales para nuevo modelo de motor.', client_portal_token: null, client_portal_expires: null, created_at: now, updated_at: now },
  { id: 'IMC-2026-045', name: 'Moldes de Inyección',      customer_id: 'cust-002', client_name: 'Foxconn', status: 'Diseño',         progress: 20,  purchase_order: 'PO-CLIENT-982', quote_amount: 380000, currency: 'MXN', start_date: '2026-03-15', deadline: '2026-04-20', delivered_at: null, manager_id: 'profile-007', description: null, client_portal_token: null, client_portal_expires: null, created_at: now, updated_at: now },
  { id: 'IMC-2026-048', name: 'Soportes Estructurales',   customer_id: 'cust-003', client_name: 'Aptiv',   status: 'Cotización',     progress: 10,  purchase_order: null,            quote_amount: 55000,  currency: 'MXN', start_date: '2026-03-25', deadline: '2026-04-05', delivered_at: null, manager_id: 'profile-007', description: null, client_portal_token: null, client_portal_expires: null, created_at: now, updated_at: now },
  { id: 'IMC-2026-039', name: 'Carcasas de Aluminio',     customer_id: 'cust-004', client_name: 'Bosch',   status: 'Calidad',         progress: 95,  purchase_order: 'PO-CLIENT-940', quote_amount: 210000, currency: 'MXN', start_date: '2026-02-10', deadline: '2026-03-30', delivered_at: null, manager_id: 'profile-007', description: null, client_portal_token: null, client_portal_expires: null, created_at: now, updated_at: now },
  { id: 'IMC-2026-035', name: 'Prototipo Motor',          customer_id: 'cust-001', client_name: 'BRP',     status: 'Entregado',       progress: 100, purchase_order: 'PO-CLIENT-900', quote_amount: 95000,  currency: 'MXN', start_date: '2026-01-15', deadline: '2026-03-10', delivered_at: '2026-03-08T00:00:00Z', manager_id: 'profile-007', description: null, client_portal_token: null, client_portal_expires: null, created_at: now, updated_at: now },
  { id: 'IMC-2026-050', name: 'Herramentales Varios',     customer_id: 'cust-005', client_name: 'Lear',    status: 'Cotización',     progress: 5,   purchase_order: null,            quote_amount: 42000,  currency: 'MXN', start_date: '2026-03-28', deadline: '2026-05-10', delivered_at: null, manager_id: 'profile-007', description: null, client_portal_token: null, client_portal_expires: null, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// BOM items
// ---------------------------------------------------------------------------
export const MOCK_BOM_ITEMS: BomItem[] = [
  { id: 'bom-item-1', project_id: 'IMC-2026-042', part_number: 'MS-A-4140-01', description: 'Acero 4140 2" x 12"',           category: 'Materia Prima',     material: 'Acero 4140',    quantity: 20,  uom: 'Barras', bom_status: 'Solicitado', manufacturing_status: 'PENDIENTE', drawing_url: null, model_url: null, assigned_technician_id: null, created_at: now, updated_at: now },
  { id: 'bom-item-2', project_id: 'IMC-2026-042', part_number: 'CN-T-1250-05', description: 'Insertos de carburo (fresa)',    category: 'Herramental',       material: 'Carburo',        quantity: 15,  uom: 'Cajas',  bom_status: 'Stock',      manufacturing_status: 'PENDIENTE', drawing_url: null, model_url: null, assigned_technician_id: null, created_at: now, updated_at: now },
  { id: 'bom-item-3', project_id: 'IMC-2026-042', part_number: 'HD-B-0820-10', description: 'Tornillo Allen M8x20mm',         category: 'Hardware',          material: 'Acero negro',    quantity: 200, uom: 'Pzas',   bom_status: 'Recibido',   manufacturing_status: 'PENDIENTE', drawing_url: null, model_url: null, assigned_technician_id: null, created_at: now, updated_at: now },
  { id: 'bom-item-4', project_id: 'IMC-2026-045', part_number: 'AL-M-6061-02', description: 'Aluminio 6061-T6 block',         category: 'Materia Prima',     material: 'Aluminio 6061', quantity: 4,   uom: 'Pzas',   bom_status: 'Pendiente',  manufacturing_status: 'PENDIENTE', drawing_url: null, model_url: null, assigned_technician_id: null, created_at: now, updated_at: now },
  { id: 'bom-item-5', project_id: 'IMC-2026-045', part_number: 'SP-R-200-15',  description: 'Resortes de expulsión 2"',       category: 'Componentes Moldes', material: 'Acero',          quantity: 12,  uom: 'Pzas',   bom_status: 'Tránsito',   manufacturing_status: 'PENDIENTE', drawing_url: null, model_url: null, assigned_technician_id: null, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Requisitions
// ---------------------------------------------------------------------------
export const MOCK_REQUISITIONS: Requisition[] = [
  { id: 'REQ-2026-101', project_id: 'IMC-2026-042', bom_item_id: 'bom-item-1', description: 'Acero 4140 (20 barras)',  quantity: 20, uom: 'Barras', requester_id: 'profile-001', priority: 'Alta',  status: 'Pendiente', notes: null, needed_by: '2026-04-01', created_at: now, updated_at: now },
  { id: 'REQ-2026-102', project_id: 'IMC-2026-045', bom_item_id: 'bom-item-5', description: 'Insertos de carburo',     quantity: 8,  uom: 'Cajas',  requester_id: 'profile-002', priority: 'Media', status: 'Cotizando', notes: null, needed_by: '2026-04-05', created_at: now, updated_at: now },
  { id: 'REQ-2026-103', project_id: 'IMC-2026-039', bom_item_id: null,         description: 'Aluminio 6061 T6',         quantity: 6,  uom: 'Pzas',   requester_id: 'profile-001', priority: 'Alta',  status: 'Aprobada', notes: null, needed_by: '2026-04-02', created_at: now, updated_at: now },
  { id: 'REQ-2026-104', project_id: null,           bom_item_id: null,         description: 'Aceite soluble (2 tambos)', quantity: 2, uom: 'Tambos', requester_id: 'profile-002', priority: 'Media', status: 'Ordenada', notes: 'Mantenimiento', needed_by: null,        created_at: now, updated_at: now },
  { id: 'REQ-2026-105', project_id: 'IMC-2026-048', bom_item_id: null,         description: 'Tornillería especial',    quantity: 50, uom: 'Pzas',   requester_id: 'profile-001', priority: 'Baja',  status: 'Rechazada', notes: null, needed_by: null,        created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------
export const MOCK_MACHINES: Machine[] = [
  { id: 'CNC-001', type: 'Centro de Maquinado 3 ejes', status: 'Operando',      location: 'Nave 1', notes: null, created_at: now, updated_at: now },
  { id: 'CNC-002', type: 'Torno CNC',                  status: 'Setup',         location: 'Nave 1', notes: null, created_at: now, updated_at: now },
  { id: 'CNC-003', type: 'Centro de Maquinado 5 ejes', status: 'Mantenimiento', location: 'Nave 2', notes: null, created_at: now, updated_at: now },
  { id: 'CNC-004', type: 'Torno Suizo',                status: 'Operando',      location: 'Nave 2', notes: null, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Work orders
// ---------------------------------------------------------------------------
export const MOCK_WORK_ORDERS: WorkOrder[] = [
  { id: 'WO-2026-089', project_id: 'IMC-2026-042', bom_item_id: 'bom-item-1', machine_id: 'CNC-001', assigned_technician_id: 'profile-002', quantity: 500,  completed_qty: 325,  priority: 'Alta',     status: 'En Proceso', planned_start: '2026-03-15T00:00:00Z', planned_end: '2026-04-05T00:00:00Z', actual_start: '2026-03-15T08:00:00Z', actual_end: null, notes: null, created_at: now, updated_at: now },
  { id: 'WO-2026-090', project_id: 'IMC-2026-045', bom_item_id: 'bom-item-4', machine_id: 'CNC-002', assigned_technician_id: 'profile-002', quantity: 1200, completed_qty: 0,    priority: 'Normal',   status: 'Setup',      planned_start: '2026-03-28T00:00:00Z', planned_end: '2026-04-12T00:00:00Z', actual_start: null, actual_end: null, notes: null, created_at: now, updated_at: now },
  { id: 'WO-2026-091', project_id: 'IMC-2026-039', bom_item_id: 'bom-item-2', machine_id: 'CNC-003', assigned_technician_id: 'profile-002', quantity: 50,   completed_qty: 50,   priority: 'Normal',   status: 'Completado', planned_start: '2026-03-10T00:00:00Z', planned_end: '2026-03-25T00:00:00Z', actual_start: '2026-03-10T08:00:00Z', actual_end: '2026-03-24T17:00:00Z', notes: null, created_at: now, updated_at: now },
  { id: 'WO-2026-092', project_id: 'IMC-2026-048', bom_item_id: 'bom-item-3', machine_id: 'CNC-004', assigned_technician_id: 'profile-002', quantity: 5000, completed_qty: 4400, priority: 'Crítica', status: 'En Proceso', planned_start: '2026-03-20T00:00:00Z', planned_end: '2026-04-08T00:00:00Z', actual_start: '2026-03-20T08:00:00Z', actual_end: null, notes: null, created_at: now, updated_at: now },
];

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------
export const MOCK_INSPECTIONS: QualityInspection[] = [
  { id: 'QA-2026-055', project_id: 'IMC-2026-042', bom_item_id: 'bom-item-1', work_order_id: 'WO-2026-089', inspection_type: 'Primera Pieza',   inspector_id: 'profile-003', inspection_date: '2026-03-29T10:00:00Z', result: 'Aprobado',   sample_size: 5, notes: null, report_url: null, created_at: now },
  { id: 'QA-2026-056', project_id: 'IMC-2026-048', bom_item_id: 'bom-item-3', work_order_id: 'WO-2026-092', inspection_type: 'En Proceso',     inspector_id: 'profile-003', inspection_date: '2026-03-29T14:00:00Z', result: 'Rechazado',  sample_size: 5, notes: null, report_url: null, created_at: now },
  { id: 'QA-2026-057', project_id: 'IMC-2026-039', bom_item_id: 'bom-item-2', work_order_id: 'WO-2026-091', inspection_type: 'Final',           inspector_id: 'profile-003', inspection_date: '2026-03-28T11:00:00Z', result: 'Aprobado',   sample_size: 5, notes: null, report_url: null, created_at: now },
  { id: 'QA-2026-058', project_id: 'IMC-2026-045', bom_item_id: 'bom-item-4', work_order_id: null,           inspection_type: 'Recibo Material', inspector_id: 'profile-003', inspection_date: '2026-03-28T09:00:00Z', result: 'Aprobado',   sample_size: 5, notes: null, report_url: null, created_at: now },
];

export const MOCK_NCRS: Ncr[] = [
  { id: 'NCR-2026-012', project_id: 'IMC-2026-048', bom_item_id: 'bom-item-3', inspection_id: 'QA-2026-056', issue_description: 'Tolerancia de diámetro exterior fuera de rango (+0.05mm)', severity: 'Alta',  status: 'Abierta',          root_cause: null, action_plan: null, notify_customer: true,  created_by: 'profile-003', closed_by: null, created_at: '2026-03-29T14:30:00Z', closed_at: null },
  { id: 'NCR-2026-011', project_id: 'IMC-2026-035', bom_item_id: 'bom-item-2', inspection_id: null,           issue_description: 'Acabado superficial rugoso en cara frontal',              severity: 'Media', status: 'En Investigación', root_cause: null, action_plan: null, notify_customer: false, created_by: 'profile-003', closed_by: null, created_at: '2026-03-25T10:00:00Z', closed_at: null },
  { id: 'NCR-2026-010', project_id: 'IMC-2026-042', bom_item_id: 'bom-item-1', inspection_id: null,           issue_description: 'Material recibido sin certificado de calidad',           severity: 'Baja',  status: 'Cerrada',          root_cause: 'Proveedor olvidó enviar', action_plan: 'Solicitar a proveedor', notify_customer: false, created_by: 'profile-003', closed_by: 'profile-003', created_at: '2026-03-18T10:00:00Z', closed_at: '2026-03-20T16:00:00Z' },
];

export const MOCK_INSTRUMENTS: MeasurementInstrument[] = [
  { id: 'INS-001', name: 'Vernier digital 6"',  brand: 'Mitutoyo', serial_number: 'MIT-001234',  last_calibration: '2026-01-15', next_calibration: '2027-01-15', status: 'Calibrado', notes: null, created_at: now, updated_at: now },
  { id: 'INS-002', name: 'Micrómetro 0-25mm',    brand: 'Starrett', serial_number: 'STR-009876',  last_calibration: '2025-06-12', next_calibration: '2026-06-12', status: 'Calibrado', notes: null, created_at: now, updated_at: now },
  { id: 'INS-003', name: 'CMM Bridge Type',       brand: 'Zeiss',    serial_number: 'ZEI-Bridge-1', last_calibration: '2025-04-01', next_calibration: '2026-04-01', status: 'Vencido',   notes: null, created_at: now, updated_at: now },
];
