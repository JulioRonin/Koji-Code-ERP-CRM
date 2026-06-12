/**
 * Motor reutilizable de filtros y agrupación tipo Airtable para las tablas
 * de los módulos. Es genérico sobre cualquier tipo de fila T; cada tabla
 * declara sus FieldDef y este motor se encarga de filtrar, agrupar y contar.
 */

export type FieldType = 'text' | 'select' | 'status' | 'boolean' | 'number' | 'date';

export interface FieldDef<T> {
  /** Identificador estable del campo. */
  key: string;
  /** Etiqueta visible en los menús. */
  label: string;
  type: FieldType;
  /** Extrae el valor crudo de la fila. */
  get: (row: T) => string | number | boolean | null | undefined;
  /** Para select/status: opciones disponibles (orden de agrupación). */
  options?: string[];
  /** ¿Se puede agrupar por este campo? (default: true para select/status/boolean) */
  groupable?: boolean;
  /** ¿Se puede filtrar por este campo? (default: true) */
  filterable?: boolean;
}

export type FilterOp =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'lt';

export interface FilterCondition {
  id: string;
  fieldKey: string;
  op: FilterOp;
  value: string;
}

export interface TableState {
  search: string;
  groupBy: string | null;
  filters: FilterCondition[];
}

export const EMPTY_TABLE_STATE: TableState = {
  search: '',
  groupBy: null,
  filters: [],
};

export interface Group<T> {
  key: string;
  label: string;
  items: T[];
}

const OPS_BY_TYPE: Record<FieldType, FilterOp[]> = {
  text: ['contains', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  select: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  status: ['is', 'is_not'],
  boolean: ['is'],
  number: ['is', 'is_not', 'gt', 'lt', 'is_empty', 'is_not_empty'],
  date: ['is', 'is_not', 'gt', 'lt', 'is_empty', 'is_not_empty'],
};

export const OP_LABELS: Record<FilterOp, string> = {
  is: 'es',
  is_not: 'no es',
  contains: 'contiene',
  is_empty: 'está vacío',
  is_not_empty: 'no está vacío',
  gt: 'mayor que',
  lt: 'menor que',
};

export function opsForType(type: FieldType): FilterOp[] {
  return OPS_BY_TYPE[type] ?? ['is'];
}

function normalize(v: unknown): string {
  if (v == null) return '';
  return String(v).toLowerCase().trim();
}

function matchesCondition<T>(row: T, field: FieldDef<T>, cond: FilterCondition): boolean {
  const raw = field.get(row);
  const s = normalize(raw);
  const v = normalize(cond.value);
  switch (cond.op) {
    case 'is':
      if (field.type === 'boolean') return Boolean(raw) === (v === 'true' || v === 'sí' || v === 'si');
      return s === v;
    case 'is_not':
      return s !== v;
    case 'contains':
      return s.includes(v);
    case 'is_empty':
      return s === '';
    case 'is_not_empty':
      return s !== '';
    case 'gt':
      return Number(raw) > Number(cond.value);
    case 'lt':
      return Number(raw) < Number(cond.value);
    default:
      return true;
  }
}

/**
 * Aplica búsqueda global + condiciones de filtro a las filas.
 * La búsqueda global busca en TODOS los campos de tipo text/select/status.
 */
export function applyFilters<T>(
  rows: T[],
  fields: FieldDef<T>[],
  state: TableState
): T[] {
  const byKey = new Map(fields.map(f => [f.key, f]));
  let result = rows;

  // Búsqueda global
  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    const searchable = fields.filter(f =>
      ['text', 'select', 'status'].includes(f.type)
    );
    result = result.filter(row =>
      searchable.some(f => normalize(f.get(row)).includes(q))
    );
  }

  // Condiciones explícitas (AND)
  for (const cond of state.filters) {
    const field = byKey.get(cond.fieldKey);
    if (!field) continue;
    // Las condiciones sin valor (salvo is_empty/is_not_empty) se ignoran
    if (!['is_empty', 'is_not_empty'].includes(cond.op) && cond.value === '') continue;
    result = result.filter(row => matchesCondition(row, field, cond));
  }

  return result;
}

/**
 * Agrupa filas por el campo activo. Si no hay groupBy, devuelve un único
 * grupo "Todos". Respeta el orden de `options` cuando existe.
 */
export function groupRows<T>(
  rows: T[],
  fields: FieldDef<T>[],
  groupByKey: string | null
): Group<T>[] {
  if (!groupByKey) {
    return [{ key: '__all__', label: 'Todos', items: rows }];
  }
  const field = fields.find(f => f.key === groupByKey);
  if (!field) return [{ key: '__all__', label: 'Todos', items: rows }];

  const map = new Map<string, T[]>();
  rows.forEach(row => {
    const raw = field.get(row);
    const label =
      field.type === 'boolean'
        ? raw
          ? 'Sí'
          : 'No'
        : raw == null || raw === ''
        ? '(Sin valor)'
        : String(raw);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(row);
  });

  // Orden: por options si existe, luego alfabético, (Sin valor) al final
  const ordered: Group<T>[] = [];
  const seen = new Set<string>();
  if (field.options) {
    field.options.forEach(opt => {
      if (map.has(opt)) {
        ordered.push({ key: opt, label: opt, items: map.get(opt)! });
        seen.add(opt);
      }
    });
  }
  Array.from(map.keys())
    .filter(k => !seen.has(k))
    .sort((a, b) => {
      if (a === '(Sin valor)') return 1;
      if (b === '(Sin valor)') return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    })
    .forEach(k => ordered.push({ key: k, label: k, items: map.get(k)! }));

  return ordered;
}

/** Conveniencia: filtra y agrupa en un paso. */
export function applyTableState<T>(
  rows: T[],
  fields: FieldDef<T>[],
  state: TableState
): { filtered: T[]; groups: Group<T>[] } {
  const filtered = applyFilters(rows, fields, state);
  const groups = groupRows(filtered, fields, state.groupBy);
  return { filtered, groups };
}

let _id = 0;
export function newConditionId(): string {
  _id += 1;
  return `cond-${Date.now()}-${_id}`;
}
