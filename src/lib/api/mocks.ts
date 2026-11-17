/**
 * Datos de demostración (solo se usan sin Supabase o en la demo del usuario
 * maestro). Las fechas son RELATIVAS A HOY para que tableros, entregas,
 * producción semanal y calidad siempre se vean vivos. Los IDs son consistentes
 * entre tablas (proyectos ↔ BOM ↔ órdenes ↔ inspecciones ↔ NCR).
 */

import type {
  Project,
  ProjectStatus,
  BomItem,
  BomStatus,
  ManufacturingStatus,
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

const DAY = 86_400_000;
const now = new Date().toISOString();
/** Timestamp a `d` días de hoy (negativo = pasado), a la hora `h`. */
export const demoTs = (d: number, h = 10): string => {
  const t = new Date(Date.now() + d * DAY);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};
/** Fecha (YYYY-MM-DD local) a `d` días de hoy. */
export const demoDate = (d: number): string => {
  const t = new Date(Date.now() + d * DAY);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
/** Días desde el lunes de esta semana hasta hoy (0 = lunes). */
const weekdayIdx = (new Date().getDay() + 6) % 7;
/** Día `i` (0 = lunes) de esta semana, sin pasar de hoy; `w` = semanas atrás. */
const weekDay = (i: number, w = 0, h = 12) => demoTs(Math.min(i, weekdayIdx) - weekdayIdx - w * 7, h);

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
export const MOCK_CUSTOMERS: Customer[] = [
  ['cust-001', 'Hidráulica del Bajío', 'Ing. Fernando Lara', 'flara@hidrabajio.mx', 'HBA9803127K2', 'Hidráulica'],
  ['cust-002', 'Grupo Metalmecánico Saltillo', 'Lic. Patricia Garza', 'compras@gmsaltillo.com', 'GMS120415AB7', 'Metalmecánica'],
  ['cust-003', 'Envases Norteños', 'Ing. Raúl Treviño', 'rtrevino@envasesn.mx', 'ENO0711023F9', 'Empaque'],
  ['cust-004', 'Autopartes Ramos', 'Ing. Sofía Ramos', 'sramos@autopartesramos.mx', 'ARA1506309Q1', 'Automotriz'],
  ['cust-005', 'Transmisiones Querétaro', 'Ing. Diego Montes', 'dmontes@tq.com.mx', 'TQU0902184M3', 'Automotriz'],
  ['cust-006', 'Agroindustrias Celaya', 'C.P. Laura Méndez', 'lmendez@agrocelaya.mx', 'ACE1103229H5', 'Agroindustria'],
  ['cust-007', 'Plásticos del Norte', 'Ing. Mario Salas', 'msalas@plasticosnorte.mx', 'PNO0405126T8', 'Plásticos'],
].map(([id, name, contact_name, contact_email, tax_id, industry]) => ({
  id, name, contact_name, contact_email, phone: '+52 477 555 0100', tax_id, address: null, notes: null, is_active: true,
  industry, created_at: demoTs(-200), updated_at: demoTs(-5),
}));

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------
export const MOCK_SUPPLIERS: Supplier[] = [
  ['sup-001', 'Aceros Monterrey', 'Juan Pérez', 'ventas@acerosmty.mx', 'Monterrey, NL', 'Net 30', 5, true, 'Materia prima', 7],
  ['sup-002', 'Fundiciones Irapuato', 'Rosa Ávila', 'rosa@fundirapuato.mx', 'Irapuato, GTO', 'Net 30', 4, true, 'Materia prima', 15],
  ['sup-003', 'Tornillos y Tuercas León', 'Carlos Ruiz', 'ventas@tytleon.mx', 'León, GTO', 'Contado', 3, false, 'Tornillería', 3],
  ['sup-004', 'Sandvik Coromant MX', 'María López', 'mx.ventas@sandvik.com', 'Querétaro, QRO', 'Net 60', 5, true, 'Herramental', 5],
  ['sup-005', 'Tratamientos Térmicos Bajío', 'Ing. Pedro Lugo', 'pedro@ttbajio.mx', 'Celaya, GTO', 'Net 30', 4, true, 'Servicios', 10],
  ['sup-006', 'Bronces del Centro', 'Ana Ibarra', 'ventas@broncescentro.mx', 'CDMX', 'Net 15', 4, false, 'Materia prima', 8],
].map(([id, name, contact_name, contact_email, address, payment_terms, rating, is_certified, category, lead]) => ({
  id: id as string, name: name as string, contact_name: contact_name as string, contact_email: contact_email as string,
  phone: '+52 442 555 0200', tax_id: null, address: address as string, payment_terms: payment_terms as string,
  rating: rating as number, is_certified: is_certified as boolean, is_active: true, notes: null,
  category: category as string, lead_time_days: lead as number, created_at: demoTs(-300), updated_at: demoTs(-20),
}));

// ---------------------------------------------------------------------------
// Equipo (el usuario de la demo es profile-001)
// ---------------------------------------------------------------------------
const P = (id: string, full_name: string, role: string, department: string, title: string, salary: number, status = 'Activo', extra: Partial<Profile> = {}): Profile => ({
  id, full_name, email: `${full_name.split(' ')[0].toLowerCase()}@maquinadosnorte.mx`, avatar_url: null,
  role, department, phone: '+52 477 555 01' + id.slice(-2), status, join_date: demoDate(-400 - Number(id.slice(-2)) * 30),
  bio: title, salary, pin_code: role === 'Técnico' ? '1234' : null,
  metadata: { efficiency: 82 + (Number(id.slice(-2)) * 3) % 16, bonus: Math.round(salary * 0.08), skills: [], certifications: [] },
  created_at: now, updated_at: now, ...extra,
});
export const MOCK_PROFILES: Profile[] = [
  P('profile-001', 'Mariana Ruiz', 'Administrador', 'Administración / PM', 'Project manager', 52000),
  P('profile-002', 'Luis Pérez', 'Técnico', 'Producción', 'Técnico CNC · tornos', 24000, 'Activo', { metadata: { efficiency: 86, shift: 'Matutino · 07:00 – 16:00' } }),
  P('profile-003', 'Ana Gómez', 'Calidad', 'Calidad', 'Inspectora de calidad', 26000),
  P('profile-004', 'Andrés Gil', 'Técnico', 'Producción', 'Técnico CNC · centros', 25000, 'Activo', { metadata: { efficiency: 92, shift: 'Matutino · 07:00 – 16:00' } }),
  P('profile-005', 'Raúl Torres', 'Técnico', 'Producción', 'Técnico CNC · tornos', 23000, 'Activo', { metadata: { efficiency: 78, shift: 'Vespertino · 15:00 – 23:00' } }),
  P('profile-006', 'Valeria Soto', 'Compras', 'Compras', 'Compradora', 28000),
  P('profile-007', 'Jorge Medina', 'Producción', 'Producción', 'Supervisor de turno', 34000),
  P('profile-008', 'Daniel Ortiz', 'Diseñador', 'Diseño', 'Diseñador CAD/CAM', 32000),
  P('profile-009', 'Karla Ibarra', 'Técnico', 'Producción', 'Técnica de router y fresado', 23000, 'Vacaciones'),
  P('profile-010', 'Héctor Cruz', 'Calidad', 'Calidad', 'Metrólogo', 27000, 'Incapacidad'),
];

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------
const PR = (id: string, name: string, cust: string, status: ProjectStatus, progress: number, dueIn: number, amount: number, startAgo: number, desc: string | null = null): Project => {
  const c = MOCK_CUSTOMERS.find(x => x.id === cust)!;
  return {
    id, name, customer_id: cust, client_name: c.name, status, progress,
    purchase_order: status === 'Cotización' ? null : `OC-${id.slice(-3)}-${c.name.slice(0, 3).toUpperCase()}`,
    quote_amount: amount, currency: 'MXN', start_date: demoDate(-startAgo), deadline: demoDate(dueIn),
    delivered_at: status === 'Entregado' ? demoTs(dueIn - 1) : null, manager_id: 'profile-001', description: desc,
    client_portal_token: null, client_portal_expires: null, created_at: demoTs(-startAgo), updated_at: demoTs(-1),
  };
};
export const MOCK_PROJECTS: Project[] = [
  PR('IMC-2026-042', 'Carcasa de bomba centrífuga', 'cust-001', 'En Producción', 68, 12, 486200, 24, 'Carcasa en fundición gris con impulsor de 6 álabes en inoxidable 316. Prueba hidrostática al 150 %.'),
  PR('IMC-2026-038', 'Brida de acoplamiento DN150', 'cust-002', 'Calidad', 91, 3, 128750, 30, 'Lote de 38 bridas en acero 4140 con reporte dimensional por lote.'),
  PR('IMC-2026-040', 'Eje escalonado 4140', 'cust-006', 'Embarque', 98, 1, 64380, 28),
  PR('IMC-2026-045', 'Molde de soplado PET 600 ml', 'cust-003', 'Diseño', 22, 18, 912000, 9, 'Molde de 4 cavidades en H13 con pulido espejo.'),
  PR('IMC-2026-047', 'Placa base para fixture', 'cust-004', 'Compras', 35, 24, 203900, 12),
  PR('IMC-2026-043', 'Engrane helicoidal M3', 'cust-005', 'En Producción', 54, 16, 341500, 20),
  PR('IMC-2026-046', 'Soporte de motor aluminio 6061', 'cust-004', 'Compras', 12, 29, 158300, 6),
  PR('IMC-2026-044', 'Boquilla de inyección H13', 'cust-007', 'En Producción', 77, 8, 97800, 22),
  PR('IMC-2026-048', 'Cuerpo de válvula 2"', 'cust-001', 'Diseño', 8, 32, 265000, 4),
  PR('IMC-2026-041', 'Rodillo guía acero inoxidable', 'cust-003', 'Calidad', 95, 4, 73400, 26),
  PR('IMC-2026-050', 'Herramentales para troquel', 'cust-007', 'Cotización', 5, 40, 148000, 2),
  PR('IMC-2026-035', 'Flecha de transmisión', 'cust-006', 'Entregado', 100, -10, 95000, 60),
];

/** Imagen de demo por proyecto (fotos de la pieza en /public/demo). */
export const DEMO_PROJECT_IMAGE: Record<string, string> = {
  'IMC-2026-042': 'carcasa', 'IMC-2026-038': 'brida', 'IMC-2026-040': 'eje', 'IMC-2026-045': 'molde',
  'IMC-2026-047': 'placa', 'IMC-2026-043': 'engrane', 'IMC-2026-046': 'soporte', 'IMC-2026-044': 'boquilla',
  'IMC-2026-048': 'valvula', 'IMC-2026-041': 'rodillo', 'IMC-2026-050': 'placa', 'IMC-2026-035': 'eje',
};

// ---------------------------------------------------------------------------
// BOM (piezas): estatus de compra + fabricación, con avance de ESTA semana
// ---------------------------------------------------------------------------
const baseBom = {
  currency: 'MXN', supplier_id: null, requisition_date: null, actual_delivery_date: null, notes: null,
  production_relevant: true, model_url: null, drawing_url: null,
};
type B = [string, string, string, string, string, number, number | null, BomStatus, ManufacturingStatus, string | null, number, string | null, string];
// [id, proyecto, parte, descripción, material, cant, pzas a fabricar, compra, fabricación, técnico, precio, proveedor, actualizado]
const BOM_ROWS: B[] = [
  ['bom-001', 'IMC-2026-042', 'CB-1001', 'Cuerpo de carcasa', 'Fundición gris G25', 1, 142, 'Recibido', 'EN PROCESO', 'profile-004', 18500, 'Fundiciones Irapuato', weekDay(0)],
  ['bom-002', 'IMC-2026-042', 'CB-1010', 'Impulsor 6 álabes', 'Inox 316', 1, 142, 'Tránsito', 'EN PROCESO', 'profile-002', 9600, 'Aceros Monterrey', weekDay(1)],
  ['bom-003', 'IMC-2026-042', 'CB-1021', 'Buje de bronce', 'Bronce SAE 660', 4, 118, 'Recibido', 'TERMINADO', 'profile-005', 780, 'Bronces del Centro', weekDay(1, 0, 15)],
  ['bom-004', 'IMC-2026-042', 'CB-1044', 'Tornillo allen M10×40', 'Grado 12.9', 24, null, 'Solicitado', 'PENDIENTE', null, 18, 'Tornillos y Tuercas León', demoTs(-6)],
  ['bom-005', 'IMC-2026-038', 'BR-2001', 'Brida DN150 · lote 1', 'Acero 4140', 20, 20, 'Recibido', 'TERMINADO', 'profile-004', 2400, 'Aceros Monterrey', weekDay(2, 1)],
  ['bom-006', 'IMC-2026-038', 'BR-2002', 'Brida DN150 · lote 2', 'Acero 4140', 18, 18, 'Recibido', 'CALIDAD', 'profile-004', 2400, 'Aceros Monterrey', weekDay(2)],
  ['bom-007', 'IMC-2026-040', 'EJ-3001', 'Eje escalonado', 'Acero 4140', 12, 12, 'Recibido', 'TERMINADO', 'profile-002', 3100, 'Aceros Monterrey', weekDay(3)],
  ['bom-008', 'IMC-2026-043', 'EH-4001', 'Engrane helicoidal M3 Z38', 'Acero 8620', 88, 88, 'Recibido', 'EN PROCESO', 'profile-005', 1450, 'Aceros Monterrey', weekDay(2)],
  ['bom-009', 'IMC-2026-043', 'EH-4002', 'Tratamiento térmico (carburizado)', 'Servicio', 1, null, 'Solicitado', 'PENDIENTE', null, 24000, 'Tratamientos Térmicos Bajío', demoTs(-3)],
  ['bom-010', 'IMC-2026-044', 'BQ-5001', 'Boquilla H13', 'Acero H13', 12, 12, 'Recibido', 'CALIDAD', 'profile-009', 6200, 'Aceros Monterrey', weekDay(4)],
  ['bom-011', 'IMC-2026-041', 'RG-6001', 'Rodillo guía', 'Inox 304', 16, 16, 'Recibido', 'CALIDAD', 'profile-002', 2800, 'Aceros Monterrey', weekDay(4, 0, 11)],
  ['bom-012', 'IMC-2026-047', 'PB-7001', 'Placa base A36', 'Acero A36', 2, 2, 'Pendiente', 'PENDIENTE', null, 6300, null, demoTs(-2)],
  ['bom-013', 'IMC-2026-047', 'PB-7002', 'Localizadores templados', 'Acero D2', 12, 12, 'Tránsito', 'PENDIENTE', null, 640, 'Aceros Monterrey', demoTs(-2)],
  ['bom-014', 'IMC-2026-046', 'SM-8001', 'Soporte de motor', 'Aluminio 6061-T6', 24, 24, 'Solicitado', 'PENDIENTE', null, 1850, 'Aceros Monterrey', demoTs(-1)],
  ['bom-015', 'IMC-2026-045', 'MP-9001', 'Bloque de cavidad', 'Acero H13', 4, 4, 'Pendiente', 'PENDIENTE', null, 21000, null, demoTs(-1)],
  ['bom-016', 'IMC-2026-042', 'CB-1030', 'Sello mecánico 1.5"', 'Comercial', 2, null, 'Solicitado', 'PENDIENTE', null, 3400, 'John Crane MX', demoTs(-4)],
  ['bom-017', 'IMC-2026-040', 'EJ-3002', 'Eje escalonado · lote anterior', 'Acero 4140', 60, 60, 'Recibido', 'TERMINADO', 'profile-002', 3100, 'Aceros Monterrey', weekDay(4, 1)],
  ['bom-018', 'IMC-2026-044', 'BQ-5002', 'Inserto de boquilla', 'Acero H13', 70, 70, 'Recibido', 'TERMINADO', 'profile-009', 1900, 'Aceros Monterrey', weekDay(0, 1)],
];
export const MOCK_BOM_ITEMS: BomItem[] = BOM_ROWS.map(([id, project_id, part_number, description, material, quantity, prod, bom_status, manufacturing_status, tech, unit_price, supplier, updated]) => ({
  id, project_id, part_number, description, category: material === 'Servicio' ? 'Servicios' : material === 'Comercial' || material.startsWith('Grado') ? 'Comerciales' : 'Materia Prima',
  material, quantity, uom: 'Pzas', production_quantity: prod, bom_status, manufacturing_status, assigned_technician_id: tech,
  unit_price, supplier_name: supplier, delivery_date: bom_status === 'Recibido' ? demoDate(-8) : bom_status === 'Solicitado' && id === 'bom-004' ? demoDate(-3) : demoDate(5),
  at_risk: id === 'bom-004' || id === 'bom-009', image_url: null, ...baseBom,
  production_relevant: prod != null, created_at: demoTs(-20), updated_at: updated,
}));

// ---------------------------------------------------------------------------
// Requisiciones
// ---------------------------------------------------------------------------
export const MOCK_REQUISITIONS: Requisition[] = [
  { id: 'REQ-2026-201', project_id: 'IMC-2026-042', bom_item_id: 'bom-004', description: 'Tornillo allen M10×40 12.9 (24 pzs)', quantity: 24, uom: 'Pzas', requester_id: 'profile-004', priority: 'Alta', status: 'Pendiente', notes: 'Urgente: detiene ensamble', needed_by: demoDate(2), created_at: demoTs(-6), updated_at: demoTs(-6) },
  { id: 'REQ-2026-202', project_id: 'IMC-2026-043', bom_item_id: 'bom-009', description: 'Carburizado de engranes', quantity: 1, uom: 'Servicio', requester_id: 'profile-007', priority: 'Media', status: 'Cotizando', notes: null, needed_by: demoDate(6), created_at: demoTs(-3), updated_at: demoTs(-2) },
  { id: 'REQ-2026-203', project_id: 'IMC-2026-047', bom_item_id: 'bom-012', description: 'Placa A36 1" (2 pzas)', quantity: 2, uom: 'Pzas', requester_id: 'profile-008', priority: 'Media', status: 'Aprobada', notes: null, needed_by: demoDate(8), created_at: demoTs(-2), updated_at: demoTs(-1) },
  { id: 'REQ-2026-204', project_id: null, bom_item_id: null, description: 'Aceite soluble para refrigerante (2 tambos)', quantity: 2, uom: 'Tambos', requester_id: 'profile-007', priority: 'Baja', status: 'Ordenada', notes: 'Mantenimiento', needed_by: null, created_at: demoTs(-9), updated_at: demoTs(-7) },
];

// ---------------------------------------------------------------------------
// Máquinas (parque real de un taller como IMC)
// ---------------------------------------------------------------------------
const M = (id: string, type: string, status: Machine['status'], location: string, family: Machine['equipment_family']): Machine =>
  ({ id, type, status, location, notes: null, equipment_family: family, created_at: demoTs(-500), updated_at: demoTs(-1) });
export const MOCK_MACHINES: Machine[] = [
  M('VMC-01', 'Centro de maquinado · HAAS VF-2', 'Fuera_Servicio', 'Nave CNC', 'cnc'),
  M('VMC-02', 'Centro de maquinado · DMG Mori CMX 1100', 'Operando', 'Nave CNC', 'cnc'),
  M('TCNC-01', 'Torno CNC · Mazak QTN-200', 'Operando', 'Nave CNC', 'cnc'),
  M('TCNC-02', 'Torno CNC · Okuma LB3000', 'Setup', 'Nave CNC', 'cnc'),
  M('RCNC-01', 'Router CNC · ShopSabre 4896', 'Operando', 'Nave CNC', 'router'),
  M('TC-01', 'Torno convencional · Romi', 'Operando', 'Área convencional', 'convencional'),
  M('FC-01', 'Fresadora convencional · Bridgeport', 'Disponible', 'Área convencional', 'convencional'),
  M('RECT-01', 'Rectificadora plana · Okamoto ACC-63', 'Mantenimiento', 'Área convencional', 'rectificadora'),
  M('SC-01', 'Sierra cinta · Kalamazoo', 'Operando', 'Corte', 'sierra'),
  M('COMP-01', 'Compresor de tornillo · Atlas Copco', 'Operando', 'Cuarto de máquinas', 'compresor'),
];

// ---------------------------------------------------------------------------
// Órdenes de trabajo
// ---------------------------------------------------------------------------
const WO = (id: string, project_id: string, bom: string, machine: string, tech: string, quantity: number, done: number, priority: WorkOrder['priority'], status: WorkOrder['status'], startAgo: number, endIn: number): WorkOrder => ({
  id, project_id, bom_item_id: bom, machine_id: machine, assigned_technician_id: tech, quantity, completed_qty: done, priority, status,
  planned_start: demoTs(-startAgo, 7), planned_end: demoTs(endIn, 16), actual_start: status === 'Pendiente' ? null : demoTs(-startAgo, 8),
  actual_end: status === 'Completado' ? demoTs(-1, 15) : null, notes: null, created_at: demoTs(-startAgo - 1), updated_at: demoTs(0, 9),
});
export const MOCK_WORK_ORDERS: WorkOrder[] = [
  WO('OT-1281', 'IMC-2026-042', 'bom-001', 'VMC-02', 'profile-004', 142, 125, 'Alta', 'En Proceso', 9, 4),
  WO('OT-1284', 'IMC-2026-042', 'bom-002', 'TCNC-01', 'profile-002', 142, 102, 'Alta', 'En Proceso', 7, 5),
  WO('OT-1279', 'IMC-2026-040', 'bom-007', 'TC-01', 'profile-002', 12, 12, 'Normal', 'Completado', 10, -1),
  WO('OT-1283', 'IMC-2026-044', 'bom-010', 'RCNC-01', 'profile-009', 12, 6, 'Normal', 'En Proceso', 6, 3),
  WO('OT-1287', 'IMC-2026-043', 'bom-008', 'TCNC-02', 'profile-005', 88, 4, 'Normal', 'Setup', 2, 9),
  WO('OT-1288', 'IMC-2026-041', 'bom-011', 'SC-01', 'profile-002', 16, 16, 'Normal', 'Completado', 8, -2),
  WO('OT-1290', 'IMC-2026-042', 'bom-003', 'TC-01', 'profile-005', 118, 118, 'Normal', 'Completado', 12, -3),
];

// ---------------------------------------------------------------------------
// Calidad: inspecciones de esta semana y la anterior
// ---------------------------------------------------------------------------
let qa = 300;
const I = (project_id: string, bom: string, wo: string | null, type: QualityInspection['inspection_type'], dayIdx: number, w: number, result: QualityInspection['result']): QualityInspection => ({
  id: `INS-0${qa++}`, project_id, bom_item_id: bom, work_order_id: wo, inspection_type: type, inspector_id: 'profile-003',
  inspection_date: weekDay(dayIdx, w, 11), result, sample_size: 5, notes: null, report_url: null, created_at: weekDay(dayIdx, w, 11),
});
export const MOCK_INSPECTIONS: QualityInspection[] = [
  // semana anterior
  I('IMC-2026-038', 'bom-005', null, 'Final', 0, 1, 'Aprobado'), I('IMC-2026-038', 'bom-005', null, 'En Proceso', 1, 1, 'Aprobado'),
  I('IMC-2026-040', 'bom-017', null, 'Final', 2, 1, 'Aprobado'), I('IMC-2026-044', 'bom-018', null, 'Primera Pieza', 3, 1, 'Rechazado'),
  I('IMC-2026-044', 'bom-018', null, 'Primera Pieza', 4, 1, 'Aprobado'), I('IMC-2026-042', 'bom-003', 'OT-1290', 'En Proceso', 4, 1, 'Aprobado'),
  // esta semana
  I('IMC-2026-042', 'bom-001', 'OT-1281', 'Primera Pieza', 0, 0, 'Aprobado'), I('IMC-2026-042', 'bom-002', 'OT-1284', 'En Proceso', 0, 0, 'Aprobado'),
  I('IMC-2026-043', 'bom-008', 'OT-1287', 'Primera Pieza', 1, 0, 'Rechazado'), I('IMC-2026-042', 'bom-003', 'OT-1290', 'Final', 1, 0, 'Aprobado'),
  I('IMC-2026-038', 'bom-006', null, 'En Proceso', 2, 0, 'Aprobado'), I('IMC-2026-040', 'bom-007', 'OT-1279', 'Final', 3, 0, 'Aprobado'),
  I('IMC-2026-041', 'bom-011', 'OT-1288', 'Final', 4, 0, 'Aprobado'), I('IMC-2026-044', 'bom-010', 'OT-1283', 'En Proceso', 4, 0, 'Con Observaciones'),
];

export const MOCK_NCRS: Ncr[] = [
  { id: 'NCR-2026-031', project_id: 'IMC-2026-038', bom_item_id: 'bom-006', inspection_id: null, issue_description: 'Ø exterior 42.040 fuera de tolerancia (+0.02) en brida lote 2', severity: 'Alta', status: 'Abierta', root_cause: null, action_plan: null, notify_customer: true, created_by: 'profile-003', closed_by: null, created_at: demoTs(-1, 12), closed_at: null, part_number: 'BR-2002', quantity_affected: 3, detected_area: 'Calidad', defect_type: 'Dimensional', containment: 'Lote segregado en cuarentena', updated_at: demoTs(-1, 12) },
  { id: 'NCR-2026-030', project_id: 'IMC-2026-043', bom_item_id: 'bom-008', inspection_id: null, issue_description: 'Perfil de diente fuera de especificación en primera pieza', severity: 'Media', status: 'En Investigación', root_cause: null, action_plan: null, notify_customer: false, created_by: 'profile-003', closed_by: null, created_at: demoTs(-3, 11), closed_at: null, part_number: 'EH-4001', quantity_affected: 1, detected_area: 'Producción', defect_type: 'Dimensional', containment: 'Ajuste de programa CAM', updated_at: demoTs(-2) },
  { id: 'NCR-2026-028', project_id: 'IMC-2026-044', bom_item_id: 'bom-018', inspection_id: null, issue_description: 'Rugosidad superficial Ra 1.6 (requerido Ra 0.8)', severity: 'Baja', status: 'Cerrada', root_cause: 'Inserto desgastado', action_plan: 'Cambio de inserto y control de vida útil', notify_customer: false, created_by: 'profile-003', closed_by: 'profile-003', created_at: demoTs(-9), closed_at: demoTs(-6), part_number: 'BQ-5002', quantity_affected: 2, effective: true, updated_at: demoTs(-6) },
];

export const MOCK_INSTRUMENTS: MeasurementInstrument[] = [
  { id: 'INS-001', name: 'Vernier digital 6"', brand: 'Mitutoyo', serial_number: 'MIT-001234', last_calibration: demoDate(-120), next_calibration: demoDate(245), status: 'Calibrado', notes: null, created_at: now, updated_at: now },
  { id: 'INS-002', name: 'Micrómetro exteriores 0–25 mm', brand: 'Starrett', serial_number: 'STR-009876', last_calibration: demoDate(-340), next_calibration: demoDate(25), status: 'Por Calibrar', notes: null, created_at: now, updated_at: now },
  { id: 'INS-003', name: 'Calibre de rosca M8×1.25', brand: 'Mitutoyo', serial_number: 'MIT-GO-M8', last_calibration: demoDate(-200), next_calibration: demoDate(165), status: 'Calibrado', notes: null, created_at: now, updated_at: now },
  { id: 'INS-004', name: 'Altímetro digital 300 mm', brand: 'Mitutoyo', serial_number: 'MIT-HG-300', last_calibration: demoDate(-380), next_calibration: demoDate(-15), status: 'Vencido', notes: null, created_at: now, updated_at: now },
];
