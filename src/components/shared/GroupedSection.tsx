import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Group } from '@/lib/tableControls';

interface Props<T> {
  groups: Group<T>[];
  /** Si true, no dibuja cabeceras (cuando es el grupo único "Todos"). */
  hideHeaderWhenSingle?: boolean;
  /** Render de cada fila. */
  renderItem: (item: T) => React.ReactNode;
  /** Resumen opcional por grupo (ej. "5 recibidos"). */
  groupSummary?: (g: Group<T>) => React.ReactNode;
  /** Empieza colapsado (default: false). */
  defaultCollapsed?: boolean;
}

/**
 * Renderiza grupos colapsables con encabezado + contador. Cuando hay un
 * único grupo "__all__" y hideHeaderWhenSingle, dibuja las filas planas.
 */
export function GroupedSection<T>({
  groups,
  hideHeaderWhenSingle = true,
  renderItem,
  groupSummary,
  defaultCollapsed = false,
}: Props<T>) {
  const single = groups.length === 1 && groups[0].key === '__all__';
  if (single && hideHeaderWhenSingle) {
    return <>{groups[0].items.map((item, i) => <React.Fragment key={i}>{renderItem(item)}</React.Fragment>)}</>;
  }

  return (
    <div className="space-y-2">
      {groups.map(g => (
        <GroupBlock
          key={g.key}
          group={g}
          renderItem={renderItem}
          groupSummary={groupSummary}
          defaultCollapsed={defaultCollapsed}
        />
      ))}
    </div>
  );
}

function GroupBlock<T>({
  group,
  renderItem,
  groupSummary,
  defaultCollapsed,
}: {
  group: Group<T>;
  renderItem: (item: T) => React.ReactNode;
  groupSummary?: (g: Group<T>) => React.ReactNode;
  defaultCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="rounded-md border border-[var(--color-app-border)] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[var(--color-app-surface-alt)]/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
          )}
          <span className="text-sm font-semibold truncate">{group.label}</span>
          <Badge variant="outline">{group.items.length}</Badge>
        </div>
        {groupSummary && <div className="shrink-0">{groupSummary(group)}</div>}
      </button>
      {!collapsed && (
        <div className="border-t border-[var(--color-app-border)]">
          {group.items.map((item, i) => (
            <React.Fragment key={i}>{renderItem(item)}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
