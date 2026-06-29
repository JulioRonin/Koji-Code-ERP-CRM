import * as XLSX from 'xlsx';
import type { BulkInventoryRow } from '@/lib/api/inventory';

/** Encabezados oficiales de la plantilla (orden y nombres recomendados). */
export const INVENTORY_HEADERS = [
  'SKU', 'Nombre', 'Categoria', 'Unidad', 'Stock', 'Minimo', 'Maximo', 'Costo', 'Precio', 'Ubicacion', 'Proveedor',
] as const;

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Acepta varios nombres de columna por campo (tolerante). */
const ALIASES: Record<string, string[]> = {
  sku: ['sku', 'codigo', 'code', 'clave'],
  name: ['nombre', 'name', 'producto', 'descripcion', 'description', 'articulo'],
  category: ['categoria', 'category', 'grupo', 'familia'],
  uom: ['unidad', 'uom', 'unit', 'um'],
  stock: ['stock', 'existencia', 'cantidad', 'qty', 'inventario'],
  min: ['minimo', 'min', 'min stock', 'punto de reorden', 'reorden'],
  max: ['maximo', 'max', 'max stock'],
  cost: ['costo', 'cost', 'costo unitario', 'unit cost'],
  price: ['precio', 'price', 'precio venta', 'venta', 'pvp'],
  location: ['ubicacion', 'location', 'ubic', 'almacen', 'rack'],
  supplier: ['proveedor', 'supplier', 'vendor'],
};

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const map: Record<string, unknown> = {};
  Object.keys(row).forEach(k => { map[norm(k)] = row[k]; });
  for (const k of keys) {
    if (map[k] != null && String(map[k]).trim() !== '') return map[k];
  }
  return undefined;
}

const toNum = (v: unknown): number => {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const toStr = (v: unknown): string => (v == null ? '' : String(v).trim());

export interface ParseResult {
  rows: BulkInventoryRow[];
  skipped: number;
}

/** Lee un .xlsx/.xls/.csv y devuelve filas listas para insertar. */
export async function parseInventoryFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows: BulkInventoryRow[] = [];
  let skipped = 0;
  for (const r of raw) {
    const name = toStr(pick(r, ALIASES.name));
    if (!name) { skipped++; continue; } // sin nombre no es válido
    rows.push({
      sku: toStr(pick(r, ALIASES.sku)) || null,
      name,
      category: toStr(pick(r, ALIASES.category)) || 'General',
      uom: toStr(pick(r, ALIASES.uom)) || 'Pza',
      stock: toNum(pick(r, ALIASES.stock)),
      min_stock: toNum(pick(r, ALIASES.min)),
      max_stock: pick(r, ALIASES.max) === undefined ? null : toNum(pick(r, ALIASES.max)),
      unit_cost: toNum(pick(r, ALIASES.cost)),
      unit_price: toNum(pick(r, ALIASES.price)),
      location: toStr(pick(r, ALIASES.location)) || null,
      supplier_name: toStr(pick(r, ALIASES.supplier)) || null,
    });
  }
  return { rows, skipped };
}

/** Descarga una plantilla .xlsx con los encabezados y una fila de ejemplo. */
export function downloadInventoryTemplate(): void {
  const example = {
    SKU: 'HER-001', Nombre: 'Broca HSS 6mm', Categoria: 'Herramienta de corte', Unidad: 'Pza',
    Stock: 48, Minimo: 20, Maximo: 120, Costo: 35, Precio: 89, Ubicacion: 'A-1', Proveedor: 'Truper',
  };
  const ws = XLSX.utils.json_to_sheet([example], { header: [...INVENTORY_HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, 'plantilla_inventario_kanri.xlsx');
}
