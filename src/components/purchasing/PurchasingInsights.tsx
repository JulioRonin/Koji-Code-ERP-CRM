import { useMemo, useState } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { BomItem } from '@/types/database';

type GroupKey = 'bom_status' | 'category' | 'supplier_name';
type Metric = 'count' | 'amount';

const GROUP_LABEL: Record<GroupKey, string> = {
  bom_status: 'Estatus de compra',
  category: 'Categoría',
  supplier_name: 'Proveedor',
};

const STATUS_COLORS: Record<string, string> = {
  Pendiente: '#94a3b8',
  Solicitado: '#f59e0b',
  Tránsito: '#0ea5e9',
  Recibido: '#16a34a',
  Stock: '#7c3aed',
};
const STATUS_OPTIONS = ['Pendiente', 'Solicitado', 'Tránsito', 'Recibido', 'Stock'];
const PALETTE = [
  '#0369a1', '#0ea5e9', '#7c3aed', '#16a34a', '#f59e0b', '#dc2626',
  '#0d9488', '#db2777', '#65a30d', '#9333ea', '#2563eb', '#ca8a04',
];

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

interface Props {
  items: BomItem[];
}

export function PurchasingInsights({ items }: Props) {
  const [groupBy, setGroupBy] = useState<GroupKey>('category');
  const [metric, setMetric] = useState<Metric>('count');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');

  const data = useMemo(() => {
    const filtered = statusFilter === 'Todos' ? items : items.filter(i => i.bom_status === statusFilter);

    const labelFor = (i: BomItem): string => {
      const raw = i[groupBy] as string | null | undefined;
      if (raw && String(raw).trim()) return String(raw);
      return groupBy === 'supplier_name' ? 'Sin proveedor' : groupBy === 'category' ? 'Sin categoría' : '—';
    };

    const map = new Map<string, { count: number; amount: number }>();
    filtered.forEach(i => {
      const key = labelFor(i);
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += (i.unit_price ?? 0) * (i.quantity ?? 0);
      map.set(key, cur);
    });

    let arr = Array.from(map.entries()).map(([name, v]) => ({ name, value: metric === 'count' ? v.count : v.amount }));
    arr.sort((a, b) => b.value - a.value);

    // Para proveedor/categoría con muchas entradas, agrupa la cola en "Otros".
    if (arr.length > 12) {
      const top = arr.slice(0, 11);
      const rest = arr.slice(11).reduce((s, x) => s + x.value, 0);
      arr = [...top, { name: `Otros (${arr.length - 11})`, value: rest }];
    }
    return arr;
  }, [items, groupBy, metric, statusFilter]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const colorFor = (name: string, idx: number) =>
    groupBy === 'bom_status' ? STATUS_COLORS[name] ?? '#94a3b8' : PALETTE[idx % PALETTE.length];

  const atRisk = useMemo(() => items.filter(i => i.at_risk), [items]);

  const fmt = (v: number) => (metric === 'amount' ? MXN.format(v) : String(v));
  const chartHeight = Math.max(180, data.length * 34 + 20);

  const selectCls =
    'h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs text-[var(--color-app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40';

  return (
    <Card className="p-0">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-[var(--color-app-primary)]" />
              Análisis de compras
            </CardTitle>
            <CardDescription>
              {metric === 'count' ? `${total} piezas` : MXN.format(total)} ·{' '}
              {GROUP_LABEL[groupBy]}
              {statusFilter !== 'Todos' ? ` · ${statusFilter}` : ''}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-app-text-muted)]">
              Ver por
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupKey)} className={selectCls}>
                <option value="bom_status">Estatus</option>
                <option value="category">Categoría</option>
                <option value="supplier_name">Proveedor</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-app-text-muted)]">
              Estatus
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                <option value="Todos">Todos</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-app-text-muted)]">
              Medir
              <select value={metric} onChange={e => setMetric(e.target.value as Metric)} className={selectCls}>
                <option value="count">Piezas</option>
                <option value="amount">Monto</option>
              </select>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        {data.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-[var(--color-app-text-muted)]">
            Sin datos para los filtros seleccionados.
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmt} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  formatter={(v: number) => [fmt(v), metric === 'count' ? 'Piezas' : 'Monto']}
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                  {data.map((entry, idx) => (
                    <Cell key={entry.name} fill={colorFor(entry.name, idx)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Partes marcadas en riesgo */}
        <div className="mt-4 pt-4 border-t border-[var(--color-app-border)]">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />
            <span className="text-sm font-semibold text-[var(--color-app-text)]">Partes en riesgo</span>
            <span className="text-xs text-[var(--color-app-text-muted)]">({atRisk.length})</span>
          </div>
          {atRisk.length === 0 ? (
            <p className="text-xs text-[var(--color-app-text-muted)]">
              Marca la casilla de riesgo (⚠) en la tabla para listar aquí las partes críticas.
            </p>
          ) : (
            <div className="space-y-1.5">
              {atRisk.map(i => (
                <div
                  key={i.id}
                  className="flex items-center gap-3 p-2 rounded-md border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)]/40 text-xs"
                >
                  <span className="font-mono font-semibold shrink-0">{i.part_number}</span>
                  <span className="flex-1 min-w-0 truncate text-[var(--color-app-text-muted)]">
                    {i.description ?? '—'}
                  </span>
                  <span className="shrink-0 text-[var(--color-app-text-muted)] hidden sm:inline">
                    {i.supplier_name ?? 'Sin proveedor'}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--color-app-text-muted)]">
                    {i.quantity} {i.uom}
                  </span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-white border border-[var(--color-app-border)] text-[var(--color-app-text-muted)]">
                    {i.bom_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
