import { useMemo, useState } from 'react';
import {
  TrendingUp, Search, Pencil, Check, X, AlertTriangle, Users, FolderKanban, Percent, Download,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useProjects, useQuotes, usePurchaseOrders, useFinanceTransactions,
  useReceivables, useReceivablePayments, useSetProjectSaleAmount,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

/** Umbral de alerta: proyectos con margen por debajo de esto se marcan. */
const LOW_MARGIN_PCT = 20;

export interface ProjectProfit {
  id: string;
  name: string;
  client: string;
  status: string;
  venta: number;          // quote_amount o total de la cotización convertida
  ventaSource: 'manual' | 'cotizacion' | 'none';
  costoCompras: number;   // órdenes de compra ligadas al proyecto
  costoGastos: number;    // egresos manuales asignados al proyecto
  costoTotal: number;
  cobrado: number;        // pagos de cobranza ligados al proyecto
  margen: number;
  margenPct: number | null;
}

export function Profitability() {
  const { data: projects, refetch: refetchProjects } = useProjects();
  const { data: quotes } = useQuotes();
  const { data: pos } = usePurchaseOrders();
  const { data: txs } = useFinanceTransactions();
  const { data: receivables } = useReceivables();
  const { data: payments } = useReceivablePayments();
  const { setAmount, loading: savingSale } = useSetProjectSaleAmount();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows: ProjectProfit[] = useMemo(() => {
    // Mapa cobranza: receivable → project, pagos por receivable.
    const recProject = new Map(receivables.map(r => [r.id, r.project_id]));
    const cobradoByProject = new Map<string, number>();
    payments.forEach(p => {
      const pid = recProject.get(p.receivable_id);
      if (pid) cobradoByProject.set(pid, (cobradoByProject.get(pid) ?? 0) + p.amount);
    });

    return projects.map(p => {
      // Venta: monto fijado a mano, o el total de la cotización convertida.
      const convQuote = quotes.find(q => q.converted_project_id === p.id);
      const venta = p.quote_amount ?? convQuote?.total ?? 0;
      const ventaSource: ProjectProfit['ventaSource'] =
        p.quote_amount != null ? 'manual' : convQuote ? 'cotizacion' : 'none';

      const costoCompras = pos.filter(o => o.project_id === p.id && o.status !== 'Cancelada')
        .reduce((s, o) => s + (o.total_amount || 0), 0);
      const costoGastos = txs.filter(t => t.kind === 'expense' && t.project_id === p.id)
        .reduce((s, t) => s + t.amount, 0);
      const costoTotal = costoCompras + costoGastos;
      const margen = venta - costoTotal;
      return {
        id: p.id, name: p.name, client: p.client_name, status: p.status,
        venta, ventaSource, costoCompras, costoGastos, costoTotal,
        cobrado: cobradoByProject.get(p.id) ?? 0,
        margen, margenPct: venta > 0 ? Math.round((margen / venta) * 100) : null,
      };
    }).sort((a, b) => b.venta - a.venta);
  }, [projects, quotes, pos, txs, receivables, payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [rows, search]);

  const kpis = useMemo(() => {
    const withSale = rows.filter(r => r.venta > 0);
    const venta = withSale.reduce((s, r) => s + r.venta, 0);
    const costo = withSale.reduce((s, r) => s + r.costoTotal, 0);
    const margen = venta - costo;
    const margenPct = venta > 0 ? Math.round((margen / venta) * 100) : 0;
    const bajoMargen = withSale.filter(r => r.margenPct != null && r.margenPct < LOW_MARGIN_PCT).length;
    return { venta, costo, margen, margenPct, bajoMargen, sinVenta: rows.length - withSale.length };
  }, [rows]);

  // Ranking por cliente (agregado).
  const byClient = useMemo(() => {
    const m = new Map<string, { venta: number; costo: number; proyectos: number }>();
    rows.filter(r => r.venta > 0).forEach(r => {
      const c = m.get(r.client) ?? { venta: 0, costo: 0, proyectos: 0 };
      c.venta += r.venta; c.costo += r.costoTotal; c.proyectos += 1;
      m.set(r.client, c);
    });
    return Array.from(m.entries())
      .map(([client, v]) => ({ client, ...v, margen: v.venta - v.costo, margenPct: v.venta > 0 ? Math.round(((v.venta - v.costo) / v.venta) * 100) : 0 }))
      .sort((a, b) => b.venta - a.venta)
      .slice(0, 8);
  }, [rows]);

  const startEdit = (r: ProjectProfit) => setEditing({ id: r.id, value: r.venta ? String(r.venta) : '' });
  const saveEdit = async () => {
    if (!editing) return;
    setError(null);
    try {
      const v = editing.value.trim() === '' ? null : Number(editing.value);
      if (v != null && !(v >= 0)) throw new Error('Monto inválido.');
      await setAmount(editing.id, v);
      setEditing(null);
      await refetchProjects();
    } catch (e) { setError((e as Error).message); }
  };

  const exportCsv = () => {
    const lines = [
      ['Proyecto', 'Cliente', 'Estado', 'Venta', 'Costo compras', 'Gastos asignados', 'Costo total', 'Cobrado', 'Margen', 'Margen %'].join(','),
      ...rows.map(r => [
        csv(r.name), csv(r.client), r.status, r.venta.toFixed(2), r.costoCompras.toFixed(2),
        r.costoGastos.toFixed(2), r.costoTotal.toFixed(2), r.cobrado.toFixed(2), r.margen.toFixed(2),
        r.margenPct != null ? `${r.margenPct}%` : '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([`﻿${lines}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rentabilidad-proyectos.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const marginTone = (pct: number | null) =>
    pct == null ? 'text-[var(--color-app-text-subtle)]'
      : pct < 0 ? 'text-[var(--color-app-danger)] font-semibold'
      : pct < LOW_MARGIN_PCT ? 'text-[var(--color-app-warning)] font-semibold'
      : 'text-[var(--color-app-success)] font-semibold';

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={FolderKanban} label="Venta total (proyectos)" value={money(kpis.venta)} />
        <Kpi icon={TrendingUp} label="Costo total" value={money(kpis.costo)} />
        <Kpi icon={Percent} label="Margen global" value={`${money(kpis.margen)} · ${kpis.margenPct}%`} tone={kpis.margenPct < LOW_MARGIN_PCT ? 'warning' : 'success'} />
        <Kpi icon={AlertTriangle} label={`Bajo margen (<${LOW_MARGIN_PCT}%)`} value={String(kpis.bajoMargen)} tone={kpis.bajoMargen > 0 ? 'danger' : undefined} />
      </div>

      {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabla por proyecto */}
        <Card className="lg:col-span-2 p-0">
          <CardHeader className="pb-3 flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Rentabilidad por proyecto</CardTitle>
              <CardDescription>Venta, costos (compras + gastos asignados) y margen. Solo administradores.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" /> CSV</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">Sin proyectos.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead className="text-right">Costos</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.name}</div>
                        <div className="text-[11px] text-[var(--color-app-text-muted)]">{r.client} · <span className="font-mono">{r.id}</span></div>
                      </TableCell>
                      <TableCell className="text-right">
                        {editing?.id === r.id ? (
                          <span className="inline-flex items-center gap-1">
                            <Input
                              type="number" autoFocus value={editing.value}
                              onChange={e => setEditing({ id: r.id, value: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                              className="h-8 w-28 text-right text-xs"
                            />
                            <button onClick={saveEdit} disabled={savingSale} className="text-[var(--color-app-success)]"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditing(null)} className="text-[var(--color-app-text-subtle)]"><X className="h-4 w-4" /></button>
                          </span>
                        ) : (
                          <button onClick={() => startEdit(r)} className="group inline-flex items-center gap-1.5 tabular-nums hover:text-[var(--color-app-primary)]" title={r.ventaSource === 'cotizacion' ? 'Tomado de la cotización convertida — clic para fijar' : 'Clic para editar la venta'}>
                            {r.venta > 0 ? money(r.venta) : <span className="text-[var(--color-app-text-subtle)]">definir</span>}
                            {r.ventaSource === 'cotizacion' && <Badge variant="outline" className="text-[9px] px-1 py-0">cot.</Badge>}
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums" title={`Compras ${money(r.costoCompras)} · Gastos ${money(r.costoGastos)}`}>
                        {money(r.costoTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[var(--color-app-text-muted)]">{r.cobrado > 0 ? money(r.cobrado) : '—'}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', marginTone(r.margenPct))}>{r.venta > 0 ? money(r.margen) : '—'}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', marginTone(r.margenPct))}>{r.margenPct != null ? `${r.margenPct}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Ranking por cliente */}
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Margen por cliente</CardTitle>
            <CardDescription>Ranking por venta acumulada.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 space-y-4">
            {byClient.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-app-text-muted)]">Define la venta de tus proyectos para ver el ranking.</p>
            ) : (
              <>
                <div className="h-[180px] -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byClient.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                      <YAxis dataKey="client" type="category" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => money(v)} />
                      <Bar dataKey="venta" fill="var(--color-app-primary)" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {byClient.map(c => (
                    <div key={c.client} className="flex items-center justify-between text-xs">
                      <span className="truncate text-[var(--color-app-text-muted)]">{c.client} <span className="text-[var(--color-app-text-subtle)]">({c.proyectos})</span></span>
                      <span className={cn('tabular-nums shrink-0', marginTone(c.margenPct))}>{money(c.margen)} · {c.margenPct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        Información confidencial: solo los administradores acceden a Finanzas. La venta se toma de la cotización
        convertida o se fija aquí; los costos suman las órdenes de compra del proyecto y los gastos que asignes
        a un proyecto en "Movimientos".
      </p>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: 'success' | 'warning' | 'danger';
}) {
  const color = tone === 'success' ? 'text-[var(--color-app-success)]'
    : tone === 'warning' ? 'text-[var(--color-app-warning)]'
    : tone === 'danger' ? 'text-[var(--color-app-danger)]' : 'text-[var(--color-app-text)]';
  return (
    <Card className="p-0"><CardContent className="p-4 flex items-start justify-between">
      <div className="min-w-0"><p className="text-xs text-[var(--color-app-text-muted)] truncate">{label}</p><p className={cn('text-lg font-semibold mt-0.5 truncate', color)}>{value}</p></div>
      <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
    </CardContent></Card>
  );
}

function csv(s: string): string { return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
