import { useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Trash2, Download, PiggyBank,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { startOfMonth, startOfYear, subMonths, isSameMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  useInvoices, usePurchaseOrders, usePayrollRuns, useQuotes, useReceivablePayments,
  useFinanceTransactions, useUpsertTransaction, useDeleteTransaction, type TxKind, type FinanceTransaction,
} from '@/lib/api';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const money2 = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

type Period = 'month' | '3m' | '6m' | 'year';
const PERIOD_LABEL: Record<Period, string> = { month: 'Este mes', '3m': 'Últimos 3 meses', '6m': 'Últimos 6 meses', year: 'Este año' };

function periodStart(p: Period): Date {
  const now = new Date();
  if (p === 'month') return startOfMonth(now);
  if (p === '3m') return startOfMonth(subMonths(now, 2));
  if (p === '6m') return startOfMonth(subMonths(now, 5));
  return startOfYear(now);
}

const EXP_COLORS = ['#E2401F', '#0369a1', '#7c3aed', '#15803d', '#b45309', '#0891b2'];

export function Finance() {
  const { data: invoices } = useInvoices();
  const { data: pos } = usePurchaseOrders();
  const { data: payroll } = usePayrollRuns();
  const { data: quotes } = useQuotes();
  const { data: cobranza } = useReceivablePayments();
  const { data: txs, refetch } = useFinanceTransactions();
  const { remove } = useDeleteTransaction();

  const [period, setPeriod] = useState<Period>('6m');
  const [showTx, setShowTx] = useState(false);

  const start = periodStart(period);
  const inPeriod = (d: string | null | undefined) => !!d && new Date(d) >= start;

  const agg = useMemo(() => {
    // Ingreso REAL = dinero cobrado (Cobranza) + ingresos manuales. La facturación
    // se muestra aparte como referencia (no siempre = dinero recibido).
    const cobrado = cobranza.filter(p => inPeriod(p.paid_date)).reduce((s, p) => s + (p.amount || 0), 0);
    const invIncome = invoices.filter(i => inPeriod(i.created_at)).reduce((s, i) => s + (i.total || 0), 0);
    const compras = pos.filter(p => inPeriod(p.created_at)).reduce((s, p) => s + (p.total_amount || 0), 0);
    const nomina = payroll.filter(p => inPeriod(p.created_at)).reduce((s, p) => s + (p.total_net || 0), 0);
    const manualIncome = txs.filter(t => t.kind === 'income' && inPeriod(t.tx_date)).reduce((s, t) => s + t.amount, 0);
    const manualExpense = txs.filter(t => t.kind === 'expense' && inPeriod(t.tx_date)).reduce((s, t) => s + t.amount, 0);
    const ventas = quotes.filter(q => (q.status === 'Aprobada' || q.status === 'Convertida') && inPeriod(q.updated_at)).reduce((s, q) => s + (q.total || 0), 0);

    const income = cobrado + manualIncome;
    const expenses = compras + nomina + manualExpense;
    const profit = income - expenses;
    const margin = income > 0 ? Math.round((profit / income) * 100) : 0;

    // Egresos por categoría manual
    const byCat = new Map<string, number>();
    byCat.set('Compras', compras);
    byCat.set('Nómina', nomina);
    txs.filter(t => t.kind === 'expense' && inPeriod(t.tx_date)).forEach(t => {
      const c = t.category || 'Otros';
      byCat.set(c, (byCat.get(c) || 0) + t.amount);
    });
    const expenseByCat = Array.from(byCat.entries()).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

    return { income, expenses, profit, margin, cobrado, invIncome, compras, nomina, manualIncome, manualExpense, ventas, expenseByCat };
  }, [invoices, pos, payroll, txs, quotes, cobranza, period]);

  // Serie mensual (últimos 6 meses): ingresos vs egresos
  const monthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, idx) => {
      const d = subMonths(now, 5 - idx);
      const inMonth = (s: string | null | undefined) => !!s && isSameMonth(new Date(s), d);
      const income = cobranza.filter(p => inMonth(p.paid_date)).reduce((s, p) => s + (p.amount || 0), 0)
        + txs.filter(t => t.kind === 'income' && inMonth(t.tx_date)).reduce((s, t) => s + t.amount, 0);
      const expense = pos.filter(p => inMonth(p.created_at)).reduce((s, p) => s + (p.total_amount || 0), 0)
        + payroll.filter(p => inMonth(p.created_at)).reduce((s, p) => s + (p.total_net || 0), 0)
        + txs.filter(t => t.kind === 'expense' && inMonth(t.tx_date)).reduce((s, t) => s + t.amount, 0);
      return { label: format(d, 'MMM yy', { locale: es }), Ingresos: Math.round(income), Egresos: Math.round(expense) };
    });
  }, [cobranza, pos, payroll, txs]);

  const exportCsv = () => {
    const lines = [
      ['Concepto', 'Monto'].join(','),
      ['Ingresos cobrados (cobranza)', agg.cobrado.toFixed(2)].join(','),
      ['Ingresos (otros)', agg.manualIncome.toFixed(2)].join(','),
      ['Facturado (referencia)', agg.invIncome.toFixed(2)].join(','),
      ['Egresos (compras)', agg.compras.toFixed(2)].join(','),
      ['Egresos (nómina)', agg.nomina.toFixed(2)].join(','),
      ['Egresos (otros)', agg.manualExpense.toFixed(2)].join(','),
      ['UTILIDAD', agg.profit.toFixed(2)].join(','),
      '',
      ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'].join(','),
      ...txs.filter(t => new Date(t.tx_date) >= start).map(t =>
        [t.tx_date, t.kind === 'income' ? 'Ingreso' : 'Egreso', csv(t.category ?? ''), csv(t.description ?? ''), t.amount.toFixed(2)].join(',')),
    ].join('\n');
    const blob = new Blob([`﻿${lines}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finanzas-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const delTx = async (t: FinanceTransaction) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    try { await remove(t.id); await refetch(); } catch (e) { window.alert((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><PiggyBank className="h-5 w-5 text-[var(--color-app-primary)]" /> Finanzas</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">P&L, ingresos, egresos y utilidad — combina facturas, compras, nómina y movimientos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={period} onChange={e => setPeriod(e.target.value as Period)} className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40">
            {(Object.keys(PERIOD_LABEL) as Period[]).map(p => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
          </select>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> Exportar</Button>
          <Button onClick={() => setShowTx(true)}><Plus className="h-4 w-4 mr-1.5" /> Movimiento</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Ingresos" value={money(agg.income)} tone="success" />
        <Kpi icon={TrendingDown} label="Egresos" value={money(agg.expenses)} tone="danger" />
        <Kpi icon={DollarSign} label="Utilidad" value={money(agg.profit)} tone={agg.profit >= 0 ? 'success' : 'danger'} />
        <Kpi icon={Wallet} label="Margen" value={`${agg.margin}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ingresos vs Egresos */}
        <Card className="lg:col-span-2 p-0">
          <CardHeader className="pb-2"><CardTitle className="text-base">Ingresos vs Egresos</CardTitle><CardDescription>Últimos 6 meses</CardDescription></CardHeader>
          <CardContent className="pb-4">
            <div className="h-[260px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} formatter={(v: number) => money2(v)} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#15803d" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="Egresos" fill="#E2401F" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Egresos por categoría */}
        <Card className="p-0">
          <CardHeader className="pb-2"><CardTitle className="text-base">Egresos por categoría</CardTitle><CardDescription>{PERIOD_LABEL[period]}</CardDescription></CardHeader>
          <CardContent className="pb-4">
            {agg.expenseByCat.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Sin egresos en el periodo.</p>
            ) : (
              <>
                <div className="h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agg.expenseByCat} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3} strokeWidth={0}>
                        {agg.expenseByCat.map((_, i) => <Cell key={i} fill={EXP_COLORS[i % EXP_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} formatter={(v: number) => money2(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-2">
                  {agg.expenseByCat.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-[var(--color-app-text-muted)]"><span className="h-2 w-2 rounded-full" style={{ background: EXP_COLORS[i % EXP_COLORS.length] }} />{c.name}</span>
                      <span className="font-medium tabular-nums">{money(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Desglose P&L */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Estado de resultados (resumen)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm max-w-2xl">
            <PL label="Ingresos cobrados (cobranza)" value={agg.cobrado} />
            <PL label="Otros ingresos" value={agg.manualIncome} />
            <PL label="Facturado (referencia)" value={agg.invIncome} muted />
            <PL label="Ventas ganadas (cotizaciones)" value={agg.ventas} muted />
            <div className="hidden sm:block" />
            <PL label="Egresos — Compras" value={-agg.compras} />
            <PL label="Egresos — Nómina" value={-agg.nomina} />
            <PL label="Egresos — Otros" value={-agg.manualExpense} />
            <div className="hidden sm:block" />
            <div className="sm:col-span-2 border-t border-[var(--color-app-border)] pt-2 flex justify-between font-semibold">
              <span>Utilidad {PERIOD_LABEL[period].toLowerCase()}</span>
              <span className={agg.profit >= 0 ? 'text-[var(--color-app-success)]' : 'text-[var(--color-app-danger)]'}>{money2(agg.profit)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movimientos manuales */}
      <Card className="p-0">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div><CardTitle className="text-base">Movimientos manuales</CardTitle><CardDescription>Ingresos/egresos que no vienen de facturas, compras o nómina.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={() => setShowTx(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar</Button>
        </CardHeader>
        <CardContent className="p-0">
          {txs.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Sin movimientos manuales.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
              <TableBody>
                {txs.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.tx_date}</TableCell>
                    <TableCell><Badge variant={t.kind === 'income' ? 'success' : 'destructive'}>{t.kind === 'income' ? 'Ingreso' : 'Egreso'}</Badge></TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{t.category ?? '—'}</TableCell>
                    <TableCell>{t.description ?? '—'}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${t.kind === 'income' ? 'text-[var(--color-app-success)]' : ''}`}>{t.kind === 'income' ? '+' : '−'}{money2(t.amount)}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => delTx(t)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showTx && <TxModal onClose={() => setShowTx(false)} onSaved={async () => { setShowTx(false); await refetch(); }} />}
    </div>
  );
}

function TxModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { save, loading } = useUpsertTransaction();
  const [kind, setKind] = useState<TxKind>('expense');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!(Number(amount) > 0)) return setError('El monto debe ser mayor a 0.');
    try {
      await save({ kind, category: category || null, description: description || null, amount: Number(amount), tx_date: date });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle><DialogDescription>Registra un ingreso o egreso manual.</DialogDescription></DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-medium">Tipo</label>
            <select value={kind} onChange={e => setKind(e.target.value as TxKind)} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm">
              <option value="expense">Egreso</option><option value="income">Ingreso</option>
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Fecha</label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Categoría</label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Renta, servicios…" /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Monto (MXN)</label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><label className="text-xs font-medium">Descripción</label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: 'success' | 'danger' }) {
  const color = tone === 'success' ? 'text-[var(--color-app-success)]' : tone === 'danger' ? 'text-[var(--color-app-danger)]' : 'text-[var(--color-app-text)]';
  return (
    <Card className="p-0"><CardContent className="p-4 flex items-start justify-between">
      <div><p className="text-xs text-[var(--color-app-text-muted)]">{label}</p><p className={`text-xl font-semibold mt-0.5 ${color}`}>{value}</p></div>
      <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
    </CardContent></Card>
  );
}

function PL({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-[var(--color-app-text-muted)]' : ''}`}>
      <span className="text-[var(--color-app-text-muted)]">{label}</span>
      <span className="tabular-nums">{money2(value)}</span>
    </div>
  );
}

function csv(s: string): string { return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
