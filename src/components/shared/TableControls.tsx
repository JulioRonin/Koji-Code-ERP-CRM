import React from 'react';
import { Search, Layers, Filter, Plus, Trash2, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  type FieldDef,
  type TableState,
  type FilterCondition,
  OP_LABELS,
  opsForType,
  newConditionId,
} from '@/lib/tableControls';

interface Props<T> {
  fields: FieldDef<T>[];
  state: TableState;
  onChange: (next: TableState) => void;
  /** Placeholder del buscador. */
  searchPlaceholder?: string;
  /** Slot a la derecha para botones extra (Refrescar, etc.). */
  rightSlot?: React.ReactNode;
}

/**
 * Barra de controles tipo Airtable: búsqueda + "Agrupar por" + "Filtrar",
 * con chips que muestran el estado activo. Reutilizable en cualquier tabla
 * de los módulos pasándole sus FieldDef.
 */
export function TableControls<T>({
  fields,
  state,
  onChange,
  searchPlaceholder = 'Buscar…',
  rightSlot,
}: Props<T>) {
  const groupable = fields.filter(
    f => f.groupable ?? ['select', 'status', 'boolean'].includes(f.type)
  );
  const filterable = fields.filter(f => f.filterable ?? true);

  const groupField = fields.find(f => f.key === state.groupBy);

  const setGroupBy = (key: string | null) => onChange({ ...state, groupBy: key });

  const addFilter = () => {
    const f = filterable[0];
    if (!f) return;
    const cond: FilterCondition = {
      id: newConditionId(),
      fieldKey: f.key,
      op: opsForType(f.type)[0],
      value: '',
    };
    onChange({ ...state, filters: [...state.filters, cond] });
  };

  const updateFilter = (id: string, patch: Partial<FilterCondition>) =>
    onChange({
      ...state,
      filters: state.filters.map(c => (c.id === id ? { ...c, ...patch } : c)),
    });

  const removeFilter = (id: string) =>
    onChange({ ...state, filters: state.filters.filter(c => c.id !== id) });

  const activeFilters = state.filters.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder={searchPlaceholder}
            value={state.search}
            onChange={e => onChange({ ...state, search: e.target.value })}
            className="pl-9 h-9"
          />
        </div>

        {/* Agrupar por */}
        <Popover
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors',
                state.groupBy
                  ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
                  : 'border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-surface-alt)]'
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              {groupField ? `Agrupado: ${groupField.label}` : 'Agrupar'}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          )}
        >
          <p className="text-xs font-medium text-[var(--color-app-text-muted)] mb-2">
            Agrupar registros por
          </p>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            <button
              onClick={() => setGroupBy(null)}
              className={cn(
                'w-full text-left px-2.5 py-1.5 rounded-md text-sm hover:bg-[var(--color-app-surface-alt)]',
                !state.groupBy && 'bg-[var(--color-app-surface-alt)] font-medium'
              )}
            >
              Sin agrupar
            </button>
            {groupable.map(f => (
              <button
                key={f.key}
                onClick={() => setGroupBy(f.key)}
                className={cn(
                  'w-full text-left px-2.5 py-1.5 rounded-md text-sm hover:bg-[var(--color-app-surface-alt)]',
                  state.groupBy === f.key && 'bg-[var(--color-app-surface-alt)] font-medium'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Popover>

        {/* Filtrar */}
        <Popover
          align="end"
          className="min-w-[420px]"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors',
                activeFilters > 0
                  ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
                  : 'border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-surface-alt)]'
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFilters > 0 ? `Filtrado · ${activeFilters}` : 'Filtrar'}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          )}
        >
          <p className="text-xs font-medium text-[var(--color-app-text-muted)] mb-2">
            Mostrar registros donde
          </p>
          <div className="space-y-2">
            {state.filters.length === 0 && (
              <p className="text-xs text-[var(--color-app-text-subtle)] italic px-1">
                Sin condiciones. Agrega una abajo.
              </p>
            )}
            {state.filters.map((cond, idx) => {
              const field = fields.find(f => f.key === cond.fieldKey);
              const ops = field ? opsForType(field.type) : ['is' as const];
              const needsValue = !['is_empty', 'is_not_empty'].includes(cond.op);
              return (
                <div key={cond.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase text-[var(--color-app-text-muted)] w-8 shrink-0">
                    {idx === 0 ? 'Donde' : 'Y'}
                  </span>
                  {/* Campo */}
                  <select
                    value={cond.fieldKey}
                    onChange={e => {
                      const nf = fields.find(f => f.key === e.target.value);
                      updateFilter(cond.id, {
                        fieldKey: e.target.value,
                        op: nf ? opsForType(nf.type)[0] : 'is',
                        value: '',
                      });
                    }}
                    className="h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs flex-1 min-w-0"
                  >
                    {filterable.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {/* Operador */}
                  <select
                    value={cond.op}
                    onChange={e => updateFilter(cond.id, { op: e.target.value as FilterCondition['op'] })}
                    className="h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs shrink-0"
                  >
                    {ops.map(op => (
                      <option key={op} value={op}>
                        {OP_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  {/* Valor */}
                  {needsValue &&
                    (field?.options ? (
                      <select
                        value={cond.value}
                        onChange={e => updateFilter(cond.id, { value: e.target.value })}
                        className="h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs flex-1 min-w-0"
                      >
                        <option value="">Elige…</option>
                        {field.options.map(o => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : field?.type === 'boolean' ? (
                      <select
                        value={cond.value}
                        onChange={e => updateFilter(cond.id, { value: e.target.value })}
                        className="h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs flex-1 min-w-0"
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'}
                        value={cond.value}
                        onChange={e => updateFilter(cond.id, { value: e.target.value })}
                        placeholder="Valor"
                        className="h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs flex-1 min-w-0"
                      />
                    ))}
                  <button
                    onClick={() => removeFilter(cond.id)}
                    className="p-1.5 rounded hover:bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] shrink-0"
                    title="Quitar condición"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={addFilter}
            className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-app-primary)] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar condición
          </button>
        </Popover>

        {rightSlot}
      </div>

      {/* Chips de estado activo */}
      {(state.groupBy || activeFilters > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {groupField && (
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3 w-3" /> {groupField.label}
              <button onClick={() => setGroupBy(null)} className="ml-0.5 hover:opacity-70">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {state.filters.map(cond => {
            const field = fields.find(f => f.key === cond.fieldKey);
            if (!field) return null;
            const valLabel = ['is_empty', 'is_not_empty'].includes(cond.op)
              ? ''
              : ` ${cond.value}`;
            return (
              <Badge key={cond.id} variant="outline" className="gap-1">
                {field.label} {OP_LABELS[cond.op]}
                {valLabel}
                <button onClick={() => removeFilter(cond.id)} className="ml-0.5 hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
