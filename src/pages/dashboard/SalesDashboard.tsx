import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays, subMonths, isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  DollarSign, ShoppingBag, Receipt, AlertTriangle, TrendingUp, ArrowRight, Boxes, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuotes, useInventoryItems } from '@/lib/api';
import type { Quote } from '@/types/database';

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const money2 = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

/** Fecha de la venta: cuándo se aprobó (updated_at) o, si no, cuándo se creó. */
const saleDate = (q: Quote) => new Date(q.updated_at || q.created_at);
const isSale = (q: Quote) => q.status === 'Aprobada' || q.status === 'Convertida';

/**
 * Tablero para giros que venden artículos (comercio / proveeduría): ventas por
 * día y mes, ventas por cliente, stock con mín/máx y el detalle de ventas.
 */
export function SalesDashboard() {
  const navigate = useNavigate();
  const { data: quotes } = useQuotes();
  const { data: inventory } = useInventoryItems();

  const sales = useMemo(() => quotes.filter(isSale), [quotes]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthSales = sales.filter(q => isSameMonth(saleDate(q), now));
    const todaySales = sales.filter(q => isSameDay(saleDate(q), now));
    const ventasMes = monthSales.reduce((s, q) => s + (q.total || 0), 0);
    const ventasHoy = todaySales.reduce((s, q) => s + (q.total || 0), 0);
    const ticket = monthSales.length ? ventasMes / monthSales.length : 0;
    const bajoMin = inventory.filter(i => i.active !== false && i.stock <= i.min_stock).length;
    return { ventasMes, ventasHoy, countMes: monthSales.length, ticket, bajoMin };
  }, [sales, inventory]);

  // Ventas por día (últimos 14 días)
  const porDia = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, idx) => {
      const d = subDays(today, 13 - idx);
      const total = sales
        .filter(q => isSameDay(saleDate(q), d))
        .reduce((s, q) => s + (q.total || 0), 0);
      return { label: format(d, 'dd MMM', { locale: es }), total };
    });
  }, [sales]);

  // Ventas por mes (últimos 6 meses)
  const porMes = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, idx) => {
      const d = startOfMonth(subMonths(today, 5 - idx));
      const total = sales
        .filter(q => isSameMonth(saleDate(q), d))
        .reduce((s, q) => s + (q.total || 0), 0);
      return { label: format(d, 'MMM yy', { locale: es }), total };
    });
  }, [sales]);

  // Ventas por cliente (top 8)
  const porCliente = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(q => map.set(q.client_name, (map.get(q.client_name) || 0) + (q.total || 0)));
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [sales]);

  // Detalle de ventas recientes
  const recientes = useMemo(
    () => [...sales].sort((a, b) => saleDate(b).getTime() - saleDate(a).getTime()).slice(0, 8),
    [sales]
  );

  // Stock con alertas mín/máx (prioriza agotado/bajo)
  const stockRows = useMemo(() => {
    const rank = (i: typeof inventory[number]) =>
      i.stock <= 0 ? 0 : i.stock <= i.min_stock ? 1 : (i.max_stock != null && i.stock > i.max_stock ? 2 : 3);
    return [...inventory]
      .filter(i => i.active !== false)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  }, [inventory]);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-[var(--color-app-text)]">Tablero de ventas</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })} · ventas, clientes e inventario
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="md:h-9" onClick={() => navigate('/inventory')}>Inventario</Button>
          <Button size="sm" className="md:h-9" onClick={() => navigate('/quotes')}>Nueva venta</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={DollarSign} label="Ventas del mes" value={money(kpis.ventasMes)} sub={`${kpis.countMes} ventas`} />
        <Kpi icon={ShoppingBag} label="Ventas de hoy" value={money(kpis.ventasHoy)} sub="cerradas hoy" />
        <Kpi icon={Receipt} label="Ticket promedio" value={money(kpis.ticket)} sub="del mes" />
        <Kpi
          icon={AlertTriangle}
          label="Bajo mínimo"
          value={String(kpis.bajoMin)}
          sub="productos a resurtir"
          tone={kpis.bajoMin > 0 ? 'danger' : undefined}
        />
      </div>

      {/* Ventas por día + por mes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por día</CardTitle>
            <CardDescription>Últimos 14 días</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[230px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={porDia}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-app-primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-app-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} interval={1} />
                  <YAxis stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v)} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                    formatter={(v: number) => [money2(v), 'Ventas']}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--color-app-primary)" strokeWidth={2.5} fill="url(#salesGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas por mes</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[230px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                    formatter={(v: number) => [money2(v), 'Ventas']}
                  />
                  <Bar dataKey="total" fill="var(--color-app-primary)" radius={[4, 4, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ventas por cliente + Detalle de ventas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Ventas por cliente
            </CardTitle>
            <CardDescription>Top clientes por monto</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {porCliente.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Aún no hay ventas registradas.</p>
            ) : (
              <div className="h-[260px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porCliente} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                    <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                      formatter={(v: number) => [money2(v), 'Ventas']}
                    />
                    <Bar dataKey="total" fill="var(--color-app-primary)" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Detalle de ventas
              </CardTitle>
              <CardDescription>Ventas más recientes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')} className="gap-1 hidden sm:flex">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--color-app-border)]">
              {recientes.map(q => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-[var(--color-app-surface-alt)]/50 cursor-pointer"
                  onClick={() => navigate(`/quotes/${q.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{q.client_name}</span>
                      <Badge variant={q.status === 'Convertida' ? 'outline' : 'success'}>{q.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--color-app-text-muted)] font-mono">{q.id}</span>
                      <span className="text-xs text-[var(--color-app-text-muted)]">· {format(saleDate(q), 'dd MMM yyyy', { locale: es })}</span>
                    </div>
                  </div>
                  <span className="font-semibold tabular-nums text-sm shrink-0">{money2(q.total || 0)}</span>
                </div>
              ))}
              {recientes.length === 0 && (
                <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">
                  Aprueba una cotización para registrar tu primera venta.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock con mín/máx */}
      <Card className="p-0">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Inventario · stock y mín/máx
            </CardTitle>
            <CardDescription>Productos que requieren atención primero</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="gap-1 hidden sm:flex">
            Ir a inventario <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {stockRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Sin productos en inventario.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-app-text-muted)] border-b border-[var(--color-app-border)]">
                  <th className="px-4 md:px-5 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium text-right">Stock</th>
                  <th className="px-3 py-2 font-medium text-right">Mín</th>
                  <th className="px-3 py-2 font-medium text-right">Máx</th>
                  <th className="px-3 py-2 font-medium text-right">Precio venta</th>
                  <th className="px-4 md:px-5 py-2 font-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map(i => {
                  const status =
                    i.stock <= 0 ? { label: 'Agotado', variant: 'destructive' as const }
                    : i.stock <= i.min_stock ? { label: 'Bajo', variant: 'warning' as const }
                    : (i.max_stock != null && i.stock > i.max_stock) ? { label: 'Sobre máx', variant: 'secondary' as const }
                    : { label: 'OK', variant: 'success' as const };
                  return (
                    <tr key={i.id} className="border-b border-[var(--color-app-border)] last:border-0">
                      <td className="px-4 md:px-5 py-2.5">
                        <div className="font-medium">{i.name}</div>
                        {i.sku && <div className="text-[11px] text-[var(--color-app-text-subtle)] font-mono">{i.sku}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{i.stock} {i.uom}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-app-text-muted)]">{i.min_stock}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[var(--color-app-text-muted)]">{i.max_stock ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money2(i.unit_price)}</td>
                      <td className="px-4 md:px-5 py-2.5 text-center"><Badge variant={status.variant}>{status.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone?: 'danger';
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <span className="text-xs text-[var(--color-app-text-muted)] block truncate">{label}</span>
            <span className={cn('text-xl md:text-2xl font-semibold mt-0.5 block', tone === 'danger' && 'text-[var(--color-app-danger)]')}>
              {value}
            </span>
          </div>
          <div className="h-8 w-8 md:h-9 md:w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
          </div>
        </div>
        <p className="text-xs text-[var(--color-app-text-muted)] mt-2 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}
