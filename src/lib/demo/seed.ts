/**
 * Demo del usuario maestro: siembra en este navegador un set completo de
 * datos de ejemplo (con imágenes) para explorar KANRI de punta a punta sin
 * tocar la base real. Se activa/desactiva desde el menú de cuenta.
 *
 * Proyectos, BOM, máquinas, órdenes, inspecciones, NCR y equipo vienen de
 * `lib/api/mocks.ts` (fechas relativas a hoy). Aquí se escribe lo que cada
 * módulo guarda localmente en modo demo.
 */
import { DEMO_MODE_KEY } from '@/lib/supabase';
import { DEFAULT_TENANT } from '@/lib/saas';
import { DEFAULT_COMPANY } from '@/lib/api/companySettings';
import {
  DEMO_PROJECT_IMAGE, MOCK_BOM_ITEMS, MOCK_CUSTOMERS, MOCK_MACHINES, MOCK_PROFILES, MOCK_PROJECTS, MOCK_SUPPLIERS, demoDate, demoTs,
} from '@/lib/api/mocks';
import type {
  ChatChannel, ChatMessage, CompanySettings, CorrectiveAction, Customer, DimensionalCharacteristic, DimensionalReport,
  InventoryItem, InventoryMovement, MaintenanceChecklist, MaintenanceOrder, MaintenanceTask, ProjectFile, PurchaseOrder,
  PurchaseOrderItem, Quote, QuoteItem, Shipment,
} from '@/types/database';

export const DEMO_USER_ID = 'profile-001';
const img = (k: string) => `/demo/pieza-${k}.svg`;

/** Todas las llaves locales que usa la demo (para restablecer o salir). */
function demoKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('koji_demo_') || k.startsWith('kanri_demo_'))) keys.push(k);
  }
  return keys;
}

const put = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

// ── Cotizaciones con costeo real (material + maquinado + extras + margen) ──
type L = [string, string, number, string, number, number, number, number];
// [parte, descripción, cant, material, kg/pza, $/kg, horas/pza, extras]
function quote(id: string, cust: string, title: string, status: Quote['status'], daysAgo: number, lines: L[], photos: string[] = [], projectId: string | null = null) {
  const c = MOCK_CUSTOMERS.find(x => x.id === cust)!;
  const rate = 650;
  const margin = 30;
  const items: QuoteItem[] = lines.map(([part, desc, qty, mat, kg, perKg, hrs, extra], i) => {
    const cost = kg * perKg + hrs * rate + extra;
    const unit = Math.round(cost * (1 + margin / 100) * 100) / 100;
    return {
      id: `${id}-${i}`, quote_id: id, part_number: part, description: desc, quantity: qty, material_price_id: null, material_name: mat,
      inventory_item_id: null, material_qty: kg, material_unit_cost: perKg, machining_hours: hrs, machine_rate: rate, extra_cost: extra,
      margin_pct: null, drawing_file: null, unit_price: unit, line_total: Math.round(unit * qty * 100) / 100, sort_order: i, created_at: demoTs(-daysAgo),
    };
  });
  const subtotal = items.reduce((a, it) => a + it.line_total, 0);
  const q: Quote = {
    id, customer_id: cust, client_name: c.name, client_email: c.contact_email, project_name: title, status, currency: 'MXN',
    margin_pct: margin, tax_pct: 16, machine_rate_per_hour: rate, valid_until: demoDate(30 - daysAgo), delivery_time: '15 días hábiles',
    notes: status === 'Borrador' ? null : 'Incluye certificado de material y reporte dimensional de primera pieza.',
    subtotal, total: Math.round(subtotal * 1.16 * 100) / 100, converted_project_id: projectId, created_by: DEMO_USER_ID,
    created_at: demoTs(-daysAgo), updated_at: demoTs(-Math.max(0, daysAgo - 2)),
    approved_at: status === 'Aprobada' || status === 'Convertida' ? demoTs(-Math.max(0, daysAgo - 3)) : null,
    photos: photos.map((p, i) => ({ id: `${id}-ph${i}`, path: null, data_url: img(p), name: `${p}.svg`, caption: i === 0 ? 'Pieza de referencia del cliente' : null })),
  };
  return { q, items };
}

const QUOTES = [
  quote('COT-2026-1118', 'cust-003', 'Molde de soplado PET 1 L', 'Enviada', 4, [
    ['MP-1L-01', 'Bloque de cavidad (4 cav.)', 4, 'Acero H13', 38, 120, 26, 4500],
    ['MP-1L-02', 'Placa porta-molde', 2, 'Acero P20', 52, 85, 9, 1200],
    ['MP-1L-03', 'Pulido espejo y ajuste', 1, 'Servicio', 0, 0, 14, 6000],
  ], ['molde', 'placa']),
  quote('COT-2026-1117', 'cust-005', 'Lote de 200 engranes rectos M2', 'Enviada', 6, [
    ['ER-M2-Z40', 'Engrane recto M2 Z40', 200, 'Acero 4140', 0.6, 62, 0.45, 35],
    ['ER-TT', 'Tratamiento térmico (temple y revenido)', 1, 'Servicio', 0, 0, 0, 24000],
  ], ['engrane']),
  quote('COT-2026-1116', 'cust-004', 'Fixture de soldadura línea 3', 'Borrador', 7, [
    ['FX-01', 'Placa base A36 maquinada', 2, 'Acero A36', 45, 38, 7, 600],
    ['FX-02', 'Clamps y localizadores', 12, 'Acero D2', 0.8, 140, 1.2, 180],
  ], ['placa', 'soporte']),
  quote('COT-2026-1114', 'cust-001', 'Cuerpo de válvula 2"', 'Aprobada', 12, [
    ['CV-2-01', 'Cuerpo de válvula maquinado', 30, 'Latón C360', 3.2, 190, 2.4, 120],
    ['CV-2-02', 'Prueba hidrostática', 30, 'Servicio', 0, 0, 0.5, 200],
  ], ['valvula'], 'IMC-2026-048'),
  quote('COT-2026-1110', 'cust-001', 'Carcasa de bomba centrífuga', 'Convertida', 26, [
    ['CB-1001', 'Cuerpo de carcasa', 142, 'Fundición gris G25', 6.5, 48, 1.8, 90],
    ['CB-1010', 'Impulsor 6 álabes', 142, 'Inox 316', 2.1, 160, 1.1, 60],
  ], ['carcasa'], 'IMC-2026-042'),
  quote('COT-2026-1112', 'cust-007', 'Insertos intercambiables', 'Rechazada', 18, [
    ['IN-H13', 'Inserto H13 templado', 8, 'Acero H13', 2, 120, 3.5, 300],
  ]),
];

// ── Reportes dimensionales con plano globalizado ──
const CHARS: DimensionalCharacteristic[] = [
  { n: 1, label: 'Ø exterior', kind: 'dimensional', nominal: 42, tolPlus: 0.02, tolMinus: 0.02, unit: 'mm', instrument: 'Micrómetro 25–50', readings: [42.008, 42.04, 42.011] },
  { n: 2, label: 'Ø interior', kind: 'dimensional', nominal: 28, tolPlus: 0.015, tolMinus: 0.015, unit: 'mm', instrument: 'Calibrador de interiores', readings: [28.004, 27.996, 28.002] },
  { n: 3, label: 'Longitud total', kind: 'dimensional', nominal: 120, tolPlus: 0.05, tolMinus: 0.05, unit: 'mm', instrument: 'Altímetro', readings: [120.031, 120.012, 120.02] },
  { n: 4, label: 'Profundidad de caja', kind: 'dimensional', nominal: 8.5, tolPlus: 0.03, tolMinus: 0.03, unit: 'mm', instrument: 'Vernier', readings: [8.512, 8.505, 8.51] },
  { n: 5, label: 'Espesor de brida', kind: 'dimensional', nominal: 12, tolPlus: 0.025, tolMinus: 0.025, unit: 'mm', instrument: 'Micrómetro', readings: [11.99, 12.01, 12.004] },
  { n: 6, label: 'Rosca M8×1.25', kind: 'rosca', nominal: null, tolPlus: null, tolMinus: null, unit: '', instrument: 'Calibre pasa/no pasa', readings: ['OK', 'OK', 'OK'] },
];
const BALLOONS = [{ n: 1, x: 17, y: 8 }, { n: 2, x: 36, y: 56 }, { n: 3, x: 79, y: 10 }, { n: 4, x: 74, y: 40 }, { n: 5, x: 72, y: 78 }, { n: 6, x: 86, y: 30 }];
function dim(id: string, bom: string, project: string, part: string, title: string, status: DimensionalReport['status'], chars: DimensionalCharacteristic[], daysAgo: number): DimensionalReport {
  return {
    id, project_id: project, bom_item_id: bom, part_number: part, title, inspector_id: 'profile-003', inspector_name: 'Ana Gómez', sample_size: 3, status,
    drawing_image: '/demo/plano-brida.svg', report_url: null, payload: { balloons: BALLOONS, characteristics: chars, imageAspect: 0.56 },
    notes: status === 'Rechazado' ? 'Ø exterior fuera de tolerancia en pieza 2. Se levantó NCR.' : null,
    created_by: DEMO_USER_ID, created_at: demoTs(-daysAgo), updated_at: demoTs(-daysAgo + 1),
  };
}
const okChars = CHARS.map(c => (c.n === 1 ? { ...c, readings: [42.008, 42.012, 42.005] } : c));

// ── Mantenimiento ──
function mtoTasks(): MaintenanceTask[] {
  const rows: [string, string, MaintenanceTask['frequency'], number][] = [
    ['VMC-02', 'Limpieza de virutas y revisión de niveles (aceite de guías, refrigerante)', 'Semanal', 2],
    ['VMC-02', 'Engrase de husillos y revisión de holgura del ATC', 'Mensual', 9],
    ['TCNC-01', 'Revisión de presión hidráulica y del chuck', 'Mensual', 2],
    ['TCNC-02', 'Cambio de filtro de refrigerante', 'Trimestral', -3],
    ['VMC-01', 'Revisión de rodamientos de husillo (vibración)', 'Semestral', -6],
    ['RECT-01', 'Balanceo y rectificado de muela', 'Mensual', 0],
    ['SC-01', 'Tensión y cambio de segueta', 'Semanal', 4],
    ['COMP-01', 'Purga de condensados y revisión de filtro de aire', 'Semanal', 1],
    ['TC-01', 'Lubricación de bancada y carro', 'Mensual', 15],
    ['RCNC-01', 'Limpieza de cremalleras y revisión de banda', 'Mensual', 11],
  ];
  return rows.map(([machine_id, description, frequency, dueIn], i) => ({
    id: `mto-t${i}`, machine_id, description, level: 'Preventivo', frequency, performer: 'Técnico',
    last_done: demoDate(dueIn - 30), next_due: demoDate(dueIn), active: true, sort_order: i, created_at: demoTs(-120), updated_at: demoTs(-10),
  }));
}
function mtoOrders(): MaintenanceOrder[] {
  const base = {
    original_date: null, reprogram_reason: null, loto_applied: false, loto_removed: false, findings: null, parts_used: null,
    downtime_hours: null, test_ok: false, affects_quality: false, first_piece_released: false, ncr_id: null, checklist_id: null,
    started_at: null, completed_at: null, created_by: DEMO_USER_ID, updated_at: null,
  };
  return [
    { ...base, id: 'OM-2026-0412', machine_id: 'VMC-01', order_type: 'Correctivo', status: 'En proceso', scheduled_date: demoDate(0), problem: 'Paro por ruido en husillo y alarma de temperatura. Correctivo desde 07:40.', tasks: [], performed_by: 'Jorge Medina', loto_applied: true, started_at: demoTs(0, 8), created_at: demoTs(0, 7) },
    { ...base, id: 'OM-2026-0409', machine_id: 'RECT-01', order_type: 'Preventivo', status: 'Programada', scheduled_date: demoDate(1), problem: null, tasks: [{ task_id: 'mto-t5', description: 'Balanceo y rectificado de muela', done: false }], performed_by: null, created_at: demoTs(-3) },
    { ...base, id: 'OM-2026-0401', machine_id: 'TCNC-01', order_type: 'Preventivo', status: 'Completada', scheduled_date: demoDate(-12), problem: null, tasks: [{ task_id: 'mto-t2', description: 'Revisión de presión hidráulica y del chuck', done: true }], performed_by: 'Luis Pérez', loto_applied: true, loto_removed: true, test_ok: true, downtime_hours: 1.5, findings: 'Presión en rango. Se ajustó mordaza.', started_at: demoTs(-12, 8), completed_at: demoTs(-12, 10), created_at: demoTs(-15) },
  ];
}
function mtoChecklists(): MaintenanceChecklist[] {
  return ['VMC-02', 'TCNC-01', 'SC-01'].map((m, i) => ({
    id: `chk-${i}`, machine_id: m, check_date: demoDate(0), shift: 'Matutino', operator_name: ['Andrés Gil', 'Luis Pérez', 'Luis Pérez'][i],
    items: [{ key: 'g1', label: 'Limpieza general y área despejada', result: 'ok' }, { key: 'g2', label: 'Niveles de aceite y refrigerante', result: 'ok' }, { key: 'g3', label: 'Guardas y paros de emergencia', result: 'ok' }],
    anomalies: null, has_anomaly: false, order_id: null, created_at: demoTs(0, 7),
  }));
}

// ── Inventario ──
function inventory(): { items: InventoryItem[]; moves: InventoryMovement[] } {
  const rows: [string, string, string, string, number, number, number, number, number, string, string][] = [
    ['MP-4140-2', 'Barra acero 4140 Ø2"', 'Materia prima', 'm', 48, 20, 120, 380, 520, 'A-1', 'Aceros Monterrey'],
    ['MP-H13-BL', 'Bloque acero H13 200×200', 'Materia prima', 'Pza', 6, 4, 12, 4200, 5600, 'A-2', 'Aceros Monterrey'],
    ['MP-AL6061', 'Placa aluminio 6061-T6 1"', 'Materia prima', 'Pza', 3, 6, 20, 2100, 2900, 'A-3', 'Aceros Monterrey'],
    ['HE-CNMG432', 'Inserto CNMG 432 (caja 10)', 'Herramental', 'Caja', 14, 6, 30, 1680, 2200, 'H-1', 'Sandvik Coromant MX'],
    ['HE-FR-10', 'Fresa carburo Ø10 4 filos', 'Herramental', 'Pza', 2, 5, 15, 980, 1300, 'H-2', 'Sandvik Coromant MX'],
    ['TO-M10-40', 'Tornillo allen M10×40 12.9', 'Tornillería', 'Pza', 0, 50, 300, 9, 14, 'T-4', 'Tornillos y Tuercas León'],
    ['IN-ACEITE', 'Aceite soluble (20 L)', 'Insumos', 'Cubeta', 4, 3, 10, 1450, 1800, 'Almacén', 'Lubricantes del Bajío'],
    ['IN-SEGUETA', 'Segueta bimetálica 3/4"', 'Insumos', 'Pza', 5, 2, 8, 690, 900, 'Corte', 'Sandvik Coromant MX'],
  ];
  const items: InventoryItem[] = rows.map(([sku, name, category, uom, stock, min, max, cost, price, loc, sup], i) => ({
    id: `inv-${i}`, sku, name, category, uom, stock, min_stock: min, max_stock: max, unit_cost: cost, unit_price: price, location: loc,
    supplier_name: sup, barcode: null, active: true, notes: null, lead_time_days: 5 + i, restock_status: stock < min ? (i % 2 ? 'transito' : 'solicitado') : 'none',
    restock_eta: stock < min ? demoDate(3 + i) : null, created_at: demoTs(-90), updated_at: demoTs(-i),
  }));
  const moves: InventoryMovement[] = items.slice(0, 5).map((it, i) => ({
    id: `mov-${i}`, item_id: it.id, type: i % 2 ? 'salida' : 'entrada', quantity: 2 + i, reason: i % 2 ? 'Consumo OT' : 'Recepción OC',
    reference: i % 2 ? 'OT-1281' : 'OC-2026-118', balance_after: it.stock, created_by: DEMO_USER_ID, created_at: demoTs(-i - 1),
  }));
  return { items, moves };
}

// ── Compras ──
function purchases(): { pos: PurchaseOrder[]; items: PurchaseOrderItem[] } {
  const rows: [string, string, string | null, PurchaseOrder['status'], number, number, string][] = [
    ['OC-2026-118', 'sup-001', 'IMC-2026-042', 'Recibida', 48600, -6, 'Impulsor inox 316 y barra 4140'],
    ['OC-2026-121', 'sup-003', 'IMC-2026-042', 'Emitida', 1250, 2, 'Tornillería grado 12.9'],
    ['OC-2026-124', 'sup-005', 'IMC-2026-043', 'Confirmada', 24000, 6, 'Carburizado de engranes'],
    ['OC-2026-126', 'sup-001', 'IMC-2026-047', 'Tránsito', 12880, 3, 'Placa A36 y localizadores D2'],
    ['OC-2026-127', 'sup-004', null, 'Borrador', 9800, 8, 'Herramental de reposición'],
  ];
  const pos: PurchaseOrder[] = rows.map(([id, sup, proj, status, total, eta, note]) => ({
    id, supplier_id: sup, project_id: proj, status, total_amount: total, currency: 'MXN', issued_at: status === 'Borrador' ? null : demoTs(-10),
    expected_delivery: demoDate(eta), received_at: status === 'Recibida' ? demoTs(eta) : null, issued_by: 'profile-006', notes: note,
    created_at: demoTs(-12), updated_at: demoTs(-1),
  }));
  const items: PurchaseOrderItem[] = rows.map(([id, , , status, total, , note], i) => ({
    id: `poi-${i}`, purchase_order_id: id, requisition_id: null, bom_item_id: null, inventory_item_id: null, description: note,
    quantity: 1, uom: 'Lote', unit_price: total, line_total: total, received_qty: status === 'Recibida' ? 1 : 0, created_at: demoTs(-12),
  }));
  return { pos, items };
}

// ── Chat: canales, mensajes del equipo y directos ──
function chat(): { channels: ChatChannel[]; messages: ChatMessage[] } {
  const t = demoTs(-1);
  const channels: ChatChannel[] = [
    { id: 'ch-general', name: 'general', description: 'Canal principal de comunicación', category: 'ADMIN', project_id: null, is_archived: false, created_at: t },
    { id: 'ch-anuncios', name: 'anuncios', description: 'Notificaciones críticas del sistema', category: 'ADMIN', project_id: null, is_archived: false, created_at: t },
    { id: 'ch-ingenieria', name: 'ingeniería', description: 'Diseños CAD y CAM', category: 'DEPARTAMENTOS', project_id: null, is_archived: false, created_at: t },
    { id: 'ch-produccion', name: 'producción', description: 'Coordinación de piso y máquinas', category: 'DEPARTAMENTOS', project_id: null, is_archived: false, created_at: t },
    { id: 'ch-calidad', name: 'calidad', description: 'Inspecciones y NCR', category: 'DEPARTAMENTOS', project_id: null, is_archived: false, created_at: t },
    { id: 'dm-1', name: `dm:${DEMO_USER_ID}:profile-007`, description: null, category: 'DIRECTO', project_id: null, is_archived: false, member_ids: [DEMO_USER_ID, 'profile-007'], created_at: t },
    { id: 'dm-2', name: `dm:${DEMO_USER_ID}:profile-003`, description: null, category: 'DIRECTO', project_id: null, is_archived: false, member_ids: [DEMO_USER_ID, 'profile-003'], created_at: t },
  ];
  let n = 0;
  const m = (channel_id: string, user_id: string | null, content: string, minsAgo: number, type: ChatMessage['message_type'] = 'USER'): ChatMessage =>
    ({ id: `msg-${n++}`, channel_id, user_id, content, message_type: type, created_at: new Date(Date.now() - minsAgo * 60000).toISOString() });
  const messages: ChatMessage[] = [
    m('ch-general', 'profile-007', 'Buenos días equipo. Hoy prioridad: carcasa IMC-2026-042 y liberar bridas lote 2.', 300),
    m('ch-general', DEMO_USER_ID, 'Gracias Jorge. Cliente de Hidráulica del Bajío confirmó visita el jueves.', 290),
    m('ch-anuncios', null, '⚠️ Máquina VMC-01 (HAAS VF-2) fuera de servicio. Orden correctiva OM-2026-0412 en proceso.', 240, 'SYSTEM'),
    m('ch-produccion', 'profile-004', 'OT-1281 al 88 %. Termino cuerpo de carcasa mañana a medio día.', 120),
    m('ch-produccion', 'profile-005', 'Okuma en setup para engrane M3, primera pieza en 1 h.', 95),
    m('ch-produccion', null, '✅ OT-1279 (eje escalonado) completada y enviada a calidad.', 80, 'PRODUCTION'),
    m('ch-calidad', 'profile-003', 'Brida lote 2: Ø exterior 42.040 en pieza 2, fuera de tolerancia. Levanté NCR-2026-031.', 60),
    m('ch-calidad', null, '🛑 NCR-2026-031 (Alta) registrada en IMC-2026-038.', 59, 'QUALITY'),
    m('ch-ingenieria', 'profile-008', 'Subí el modelo 3D del molde PET 600 ml, revisión B.', 45),
    m('dm-1', 'profile-007', '¿Podemos mover el preventivo de la rectificadora para mañana? Hoy está ocupada.', 30),
    m('dm-1', DEMO_USER_ID, 'Sí, reprográmalo a mañana 7:00 y avísame cuando quede.', 25),
    m('dm-2', 'profile-003', 'Te dejo el reporte dimensional de la brida para que lo revises antes de mandarlo al cliente.', 15),
  ];
  return { channels, messages };
}

/** Siembra toda la demo y deja la sesión lista (usuario admin de la demo). */
export function seedDemoData(): void {
  for (const k of demoKeys()) localStorage.removeItem(k);

  // Empresa y marca de la demo
  const company: CompanySettings = {
    ...DEFAULT_COMPANY, id: 'demo', legal_name: 'Maquinados del Norte S.A. de C.V.', commercial_name: 'Maquinados del Norte',
    tagline: 'Maquinados CNC de precisión', rfc: 'MNO150612AB3', tax_regime: '601 - General de Ley Personas Morales',
    address_street: 'Blvd. Industrial', address_ext: '1450', address_neighborhood: 'Parque Industrial', address_zip: '37490',
    address_city: 'León', address_state: 'Guanajuato', phone: '+52 477 555 0100', email: 'contacto@maquinadosnorte.mx',
    legal_rep: 'Mariana Ruiz', logo_url: '/demo/logo-demo.svg', primary_color: '#E4F47C',
    bank_name: 'BBVA', bank_account: '0123456789', bank_clabe: '012180001234567891', bank_beneficiary: 'Maquinados del Norte S.A. de C.V.',
    quote_terms_enabled: true, terms_payment: 'Crédito 30 días contra entrega y factura. Pagos en MXN vía transferencia electrónica.',
    terms_special: 'Planos y modelos del cliente se tratan como confidenciales. Garantía de 30 días contra defectos de fabricación.',
  };
  put('koji_company_settings', company);
  put('kanri_tenant', { ...DEFAULT_TENANT, id: 'tenant-demo', name: 'Maquinados del Norte', slug: 'demo' });

  // Comercial
  const customers: Customer[] = MOCK_CUSTOMERS.map((c, i) => ({
    ...c, stage: (['activo', 'activo', 'activo', 'propuesta', 'activo', 'activo', 'prospecto'] as const)[i],
    tier: null, last_contact_at: demoTs(-i * 3),
  }));
  put('kanri_demo_customers', customers);
  put('koji_demo_quotes', QUOTES.map(x => x.q));
  put('koji_demo_quote_items', QUOTES.flatMap(x => x.items));

  // Cobranza y facturación
  put('kanri_demo_receivables', [
    { id: 'rc-1', project_id: 'IMC-2026-042', customer_name: 'Hidráulica del Bajío', concept: 'Anticipo 50 % · A-2291', total_amount: 186400, currency: 'MXN', due_date: demoDate(28), notes: null, created_at: demoTs(-2) },
    { id: 'rc-2', project_id: 'IMC-2026-041', customer_name: 'Envases Norteños', concept: 'Factura A-2279', total_amount: 98500, currency: 'MXN', due_date: demoDate(-2), notes: null, created_at: demoTs(-32) },
    { id: 'rc-3', project_id: 'IMC-2026-043', customer_name: 'Transmisiones Querétaro', concept: 'Factura A-2274', total_amount: 44200, currency: 'MXN', due_date: demoDate(-19), notes: null, created_at: demoTs(-49) },
    { id: 'rc-4', project_id: 'IMC-2026-035', customer_name: 'Agroindustrias Celaya', concept: 'Factura A-2268', total_amount: 95000, currency: 'MXN', due_date: demoDate(-30), notes: null, created_at: demoTs(-60) },
  ]);
  put('kanri_demo_receivable_payments', [
    { id: 'rp-1', receivable_id: 'rc-4', amount: 95000, paid_date: demoDate(-25), method: 'Transferencia', kind: 'liquidacion', notes: null, created_at: demoTs(-25) },
    { id: 'rp-2', receivable_id: 'rc-3', amount: 20000, paid_date: demoDate(-5), method: 'Transferencia', kind: 'abono', notes: null, created_at: demoTs(-5) },
    { id: 'rp-3', receivable_id: 'rc-1', amount: 93200, paid_date: demoDate(-1), method: 'Transferencia', kind: 'anticipo', notes: null, created_at: demoTs(-1) },
  ]);
  put('kanri_demo_invoices', [
    ['A-2291', 'Hidráulica del Bajío', 'HBA9803127K2', 186400, 'valid', -2],
    ['A-2290', 'Agroindustrias Celaya', 'ACE1103229H5', 74680.8, 'valid', -3],
    ['A-2289', 'Grupo Metalmecánico Saltillo', 'GMS120415AB7', 149350, 'valid', -5],
    ['A-2288', 'Envases Norteños', 'ENO0711023F9', 352640, 'valid', -9],
    ['A-2286', 'Autopartes Ramos', 'ARA1506309Q1', 98600, 'canceled', -12],
    ['A-2279', 'Envases Norteños', 'ENO0711023F9', 98500, 'valid', -32],
  ].map(([folio, name, rfc, total, status, d], i) => ({
    id: `inv-${i}`, facturapi_id: null, folio, uuid: `8F2C${i}A41E-DEMO`, receptor_name: name, receptor_rfc: rfc, total, currency: 'MXN',
    status, pdf_url: null, xml_url: null, project_id: null, quote_id: null, created_at: demoTs(d as number),
  })));

  // Finanzas: 6 meses de ingresos/egresos
  const tx: unknown[] = [];
  for (let mth = 0; mth < 6; mth++) {
    const d = -mth * 30 - 5;
    tx.push({ id: `tx-i${mth}`, kind: 'income', category: 'Ventas', description: 'Cobranza de facturas', amount: 920000 + mth * 45000, tx_date: demoDate(d), project_id: null, created_at: demoTs(d) });
    tx.push({ id: `tx-e${mth}`, kind: 'expense', category: 'Energía eléctrica', description: 'CFE', amount: 68000 + mth * 1500, tx_date: demoDate(d + 2), project_id: null, created_at: demoTs(d + 2) });
    tx.push({ id: `tx-h${mth}`, kind: 'expense', category: 'Herramental', description: 'Insertos y fresas', amount: 90000 + mth * 2000, tx_date: demoDate(d + 4), project_id: null, created_at: demoTs(d + 4) });
    tx.push({ id: `tx-m${mth}`, kind: 'expense', category: 'Mantenimiento', description: 'Refacciones y servicio', amount: 48000 + mth * 1200, tx_date: demoDate(d + 6), project_id: null, created_at: demoTs(d + 6) });
  }
  put('kanri_demo_finance_tx', tx);
  put('kanri_demo_payroll_runs', [0, 1].map(k => {
    const items = MOCK_PROFILES.map(p => ({ profile_id: p.id, name: p.full_name, monthly_salary: p.salary, absences: 0, bonus: 0, deductions: Math.round(p.salary * 0.12), perceptions: p.salary, net: Math.round(p.salary * 0.88) }));
    return { id: `pay-${k}`, period_label: k ? 'Mes anterior' : 'Mes actual', periodicity: 'mensual', status: 'dispersada', total_net: items.reduce((a, i) => a + i.net, 0), items, created_at: demoTs(-k * 30 - 2) };
  }));

  // Operación
  const inv = inventory();
  put('kanri_demo_inventory_items', inv.items);
  put('kanri_demo_inventory_movements', inv.moves);
  put('kanri_demo_suppliers', MOCK_SUPPLIERS);
  const po = purchases();
  put('kanri_demo_pos', po.pos);
  put('kanri_demo_po_items', po.items);
  put('kanri_demo_mto_tasks', mtoTasks());
  put('kanri_demo_mto_orders', mtoOrders());
  put('kanri_demo_mto_checklists', mtoChecklists());
  put('kanri_demo_mto_families', Object.fromEntries(MOCK_MACHINES.map(m => [m.id, m.equipment_family])));
  const ship: Shipment[] = [
    { id: 'SHIP-2026-0412', project_id: 'IMC-2026-040', status: 'Listo', carrier: 'Estafeta', tracking_number: null, shipped_at: null, delivered_at: null, ship_to_address: 'Celaya, Gto.', packing_list_url: null, notes: '12 ejes en 2 cajas', created_by: DEMO_USER_ID, created_at: demoTs(-1), updated_at: demoTs(-1) },
    { id: 'SHIP-2026-0398', project_id: 'IMC-2026-035', status: 'Entregado', carrier: 'DHL', tracking_number: '7781 2231 0098', shipped_at: demoTs(-12), delivered_at: demoTs(-10), ship_to_address: 'Celaya, Gto.', packing_list_url: null, notes: null, created_by: DEMO_USER_ID, created_at: demoTs(-13), updated_at: demoTs(-10) },
  ];
  put('koji_demo_shipments', ship);

  // Calidad
  put('koji_demo_dimensional', [
    dim('dim-0412', 'bom-006', 'IMC-2026-038', 'BR-2002', 'Brida DN150 · lote 2', 'Borrador', CHARS, 1),
    dim('dim-0411', 'bom-011', 'IMC-2026-041', 'RG-6001', 'Rodillo guía', 'Borrador', okChars, 1),
    dim('dim-0408', 'bom-007', 'IMC-2026-040', 'EJ-3001', 'Eje escalonado', 'Aprobado', okChars, 3),
    dim('dim-0401', 'bom-008', 'IMC-2026-043', 'EH-4001', 'Engrane M3 · primera pieza', 'Rechazado', CHARS, 4),
  ]);
  const ca = (id: string, area: CorrectiveAction['source_area'], title: string, status: CorrectiveAction['status'], due: number, ncr: string | null, project: string): CorrectiveAction => ({
    id, project_id: project, source_area: area, source_type: ncr ? 'NCR' : 'Mejora', source_ref: ncr, ncr_id: ncr, control_plan_item_id: null, title,
    problem: null, root_cause: null, action_type: 'Correctiva', action: null, responsible: area === 'Calidad' ? 'Ana Gómez' : 'Jorge Medina',
    due_date: demoDate(due), priority: due < 3 ? 'Alta' : 'Media', status, verification: null, effective: null, verified_by: null,
    verified_at: null, closed_at: null, created_by: DEMO_USER_ID, created_at: demoTs(-2), updated_at: null,
  });
  put('kanri_demo_corrective_actions', [
    ca('CA-2026-031', 'Calidad', 'Ajustar compensación de herramienta en Ø exterior', 'En proceso', 2, 'NCR-2026-031', 'IMC-2026-038'),
    ca('CA-2026-030', 'Producción', 'Revisar programa CAM del perfil de diente', 'Abierta', 5, 'NCR-2026-030', 'IMC-2026-043'),
    ca('CA-2026-029', 'Compras', 'Proveedor de tornillería: plan de entregas a tiempo', 'En verificación', 9, null, 'IMC-2026-042'),
  ]);

  // Fotos de cada proyecto (visibles al cliente en su portal)
  for (const p of MOCK_PROJECTS) {
    const k = DEMO_PROJECT_IMAGE[p.id];
    if (!k) continue;
    const f: ProjectFile = {
      id: `ph-${p.id}`, project_id: p.id, bom_item_id: null, category: 'Foto', file_name: `${k}.svg`, storage_path: img(k),
      mime_type: 'image/svg+xml', size_bytes: 12000, uploaded_by: DEMO_USER_ID, is_client_visible: true, notes: null, created_at: demoTs(-5),
    };
    put(`koji_demo_files_${p.id}`, [f]);
  }

  // Chat
  const c = chat();
  put('koji_demo_chat_channels', c.channels);
  put('koji_demo_chat_messages', c.messages);

  // Usuario de la demo (administrador; conserva el acceso de dueño de plataforma)
  const me = MOCK_PROFILES.find(p => p.id === DEMO_USER_ID)!;
  put('koji_user', {
    id: me.id, name: me.full_name, role: 'Administrador', department: 'Administración / PM', avatar: 'MR', email: me.email,
    tenantId: 'tenant-demo', isPlatformOwner: true, phone: me.phone ?? '', status: 'Activo', joinDate: me.join_date,
    portfolio: { bio: me.bio ?? '', skills: [], certifications: [], experience: '' }, salary: { base: me.salary, bonus: 0 },
  });
  try { sessionStorage.setItem('kanri_entered', '1'); } catch { /* ignore */ }
  // Los BOM, proyectos, máquinas, etc. vienen de mocks (no requieren escritura).
  void MOCK_BOM_ITEMS;
}

/** Activa la demo y recarga la app en el tablero. */
export function enterDemo(): void {
  seedDemoData();
  localStorage.setItem(DEMO_MODE_KEY, '1');
  window.location.assign('/');
}

/** Sale de la demo: borra sus datos locales y vuelve a la cuenta real. */
export function exitDemo(): void {
  for (const k of demoKeys()) localStorage.removeItem(k);
  ['koji_user', 'koji_company_settings', 'kanri_tenant', DEMO_MODE_KEY].forEach(k => localStorage.removeItem(k));
  window.location.assign('/');
}
