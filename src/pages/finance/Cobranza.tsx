import { useMemo, useState } from 'react';
import {
  HandCoins, Plus, Trash2, DollarSign, AlertTriangle, Clock, Wallet, Receipt, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import {
  useReceivables, useReceivablePayments, useUpsertReceivable, useDeleteReceivable,
  useAddPayment, useDeletePayment, receivableStatus,
  useProjects, useCustomers,
  type Receivable, type ReceivablePayment, type PaymentKind, type ReceivableStatus,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
const money0 = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const STATUS_META: Record<ReceivableStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' }> = {
  pendiente: { label: 'Pendiente', variant: 'secondary' },
  parcial: { label: 'Parcial', variant: 'warning' },
  liquidado: { label: 'Liquidado', variant: 'success' },
  vencido: { label: 'Vencido', variant: 'destructive' },
};

interface Enriched extends Receivable { paid: number; balance: number; status: ReceivableStatus; payments: ReceivablePayment[]; }

export function Cobranza() {
  const { data: receivables, refetch } = useReceivables();
  const { data: payments, refetch: refetchPay } = useReceivablePayments();
  const { remove } = useDeleteReceivable();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Receivable | null>(null);
  const [payFor, setPayFor] = useState<Enriched | null>(null);
  const [detail, setDetail] = useState<Enriched | null>(null);

  const enriched: Enriched[] = useMemo(() => receivables.map(r => {
    const ps = payments.filter(p => p.receivable_id === r.id);
    const paid = ps.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, r.total_amount - paid);
    return { ...r, paid, balance, status: receivableStatus(r.total_amount, paid, r.due_date), payments: ps };
  }), [receivables, payments]);

  const kpis = useMemo(() => {
    const porCobrar = enriched.reduce((s, r) => s + r.balance, 0);
    const vencido = enriched.filter(r => r.status === 'vencido').reduce((s, r) => s + r.balance, 0);
    const now = new Date();
    const cobradoMes = payments.filter(p => { const d = new Date(p.paid_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, p) => s + p.amount, 0);
    const activas = enriched.filter(r => r.status !== 'liquidado').length;
    return { porCobrar, vencido, cobradoMes, activas };
  }, [enriched, payments]);

  const reload = async () => { await refetch(); await refetchPay(); };

  const del = async (r: Receivable) => {
    if (!window.confirm(`¿Eliminar la cuenta por cobrar de "${r.customer_name}"? Se borran también sus pagos.`)) return;
    try { await remove(r.id); await reload(); } catch (e) { window.alert((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><HandCoins className="h-5 w-5 text-[var(--color-app-primary)]" /> Crédito y Cobranza</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">Control de anticipos, saldos y liquidaciones por proyecto. Los pagos se reflejan en Finanzas.</p>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Nueva cuenta por cobrar</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Wallet} label="Por cobrar" value={money0(kpis.porCobrar)} />
        <Kpi icon={DollarSign} label="Cobrado (mes)" value={money0(kpis.cobradoMes)} tone="success" />
        <Kpi icon={AlertTriangle} label="Vencido" value={money0(kpis.vencido)} tone={kpis.vencido > 0 ? 'danger' : undefined} />
        <Kpi icon={Clock} label="Cuentas activas" value={String(kpis.activas)} />
      </div>

      <Card className="p-0">
        <CardHeader className="pb-3"><CardTitle className="text-base">Cuentas por cobrar</CardTitle><CardDescription>Haz clic para ver el detalle de pagos.</CardDescription></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {enriched.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">Sin cuentas por cobrar. Crea la primera.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / concepto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-center">Estatus</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                    <TableCell>
                      <div className="font-medium">{r.customer_name}</div>
                      <div className="text-[11px] text-[var(--color-app-text-muted)]">{r.concept || (r.project_id ? `Proyecto ${r.project_id}` : '—')}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money0(r.total_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-[var(--color-app-success)]">{money0(r.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{money0(r.balance)}</TableCell>
                    <TableCell className={cn('text-sm', r.status === 'vencido' ? 'text-[var(--color-app-danger)] font-medium' : 'text-[var(--color-app-text-muted)]')}>{r.due_date ?? '—'}</TableCell>
                    <TableCell className="text-center"><Badge variant={STATUS_META[r.status].variant}>{STATUS_META[r.status].label}</Badge></TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {r.status !== 'liquidado' && (
                          <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-success)]" onClick={() => setPayFor(r)} title="Registrar pago"><Receipt className="h-3.5 w-3.5 mr-1" /> Pago</Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEdit(r); setOpen(true); }} title="Editar"><Plus className="h-3.5 w-3.5 rotate-45" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => del(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && <ReceivableModal receivable={edit} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await reload(); }} />}
      {payFor && <PaymentModal r={payFor} onClose={() => setPayFor(null)} onSaved={async () => { setPayFor(null); await reload(); }} />}
      {detail && <ReceivableDetail r={enriched.find(x => x.id === detail.id) ?? detail} onClose={() => setDetail(null)} onPay={() => { setPayFor(detail); setDetail(null); }} onReload={reload} />}
    </div>
  );
}

function ReceivableModal({ receivable, onClose, onSaved }: { receivable: Receivable | null; onClose: () => void; onSaved: () => void }) {
  const { save, loading } = useUpsertReceivable();
  const { data: projects } = useProjects();
  const { data: customers } = useCustomers();
  const [f, setF] = useState({
    customer_name: receivable?.customer_name ?? '', concept: receivable?.concept ?? '',
    total_amount: receivable ? String(receivable.total_amount) : '', due_date: receivable?.due_date ?? '',
    project_id: receivable?.project_id ?? '', notes: receivable?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const pickProject = (id: string | null) => {
    const p = id ? projects.find(x => x.id === id) : null;
    setF(prev => ({ ...prev, project_id: id ?? '', customer_name: p?.client_name || prev.customer_name, total_amount: p?.quote_amount ? String(p.quote_amount) : prev.total_amount, concept: prev.concept || (p ? p.name : '') }));
  };

  const submit = async () => {
    if (!f.customer_name.trim()) return setError('El cliente es obligatorio.');
    if (!(Number(f.total_amount) > 0)) return setError('El total debe ser mayor a 0.');
    try {
      await save({ id: receivable?.id, customer_name: f.customer_name.trim(), concept: f.concept || null, total_amount: Number(f.total_amount), due_date: f.due_date || null, project_id: f.project_id || null, notes: f.notes || null });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{receivable ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'}</DialogTitle><DialogDescription>Monto a cobrar y su vencimiento. Puedes ligarla a un proyecto.</DialogDescription></DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          {projects.length > 0 && (
            <div className="col-span-2 space-y-1.5"><label className="text-xs font-medium">Proyecto (opcional)</label>
              <Combobox options={projects.map(p => ({ value: p.id, label: p.name, hint: p.client_name }))} value={f.project_id || null} onChange={pickProject} placeholder="Ligar a un proyecto…" />
            </div>
          )}
          <div className="space-y-1.5"><label className="text-xs font-medium">Cliente</label>
            {customers.length > 0
              ? <Combobox options={customers.map(c => ({ value: c.name, label: c.name }))} value={f.customer_name || null} onChange={v => setF(p => ({ ...p, customer_name: v ?? '' }))} placeholder="Cliente…" allowClear={false} />
              : <Input value={f.customer_name} onChange={e => setF(p => ({ ...p, customer_name: e.target.value }))} />}
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Concepto</label><Input value={f.concept} onChange={e => setF(p => ({ ...p, concept: e.target.value }))} placeholder="Anticipo, saldo, etc." /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Total (MXN)</label><Input type="number" value={f.total_amount} onChange={e => setF(p => ({ ...p, total_amount: e.target.value }))} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Vencimiento</label><Input type="date" value={f.due_date} onChange={e => setF(p => ({ ...p, due_date: e.target.value }))} /></div>
          <div className="col-span-2 space-y-1.5"><label className="text-xs font-medium">Notas</label><Input value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button><Button onClick={submit} disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentModal({ r, onClose, onSaved }: { r: Enriched; onClose: () => void; onSaved: () => void }) {
  const { add, loading } = useAddPayment();
  const [amount, setAmount] = useState(String(r.balance || ''));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('transferencia');
  const [kind, setKind] = useState<PaymentKind>(r.paid === 0 ? 'anticipo' : 'abono');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) return setError('El monto debe ser mayor a 0.');
    try {
      await add({ receivable_id: r.id, amount: amt, paid_date: date, method, kind, notes: notes || null });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle><DialogDescription>{r.customer_name} · saldo {money(r.balance)}</DialogDescription></DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-medium">Monto</label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Fecha</label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Tipo</label>
            <select value={kind} onChange={e => setKind(e.target.value as PaymentKind)} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm">
              <option value="anticipo">Anticipo</option><option value="abono">Abono</option><option value="liquidacion">Liquidación</option>
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Método</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm">
              <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div className="col-span-2 space-y-1.5"><label className="text-xs font-medium">Notas</label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Referencia, folio…" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button><Button onClick={submit} disabled={loading}>{loading ? 'Registrando…' : 'Registrar pago'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceivableDetail({ r, onClose, onPay, onReload }: { r: Enriched; onClose: () => void; onPay: () => void; onReload: () => void }) {
  const { remove } = useDeletePayment();
  const delPay = async (p: ReceivablePayment) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    try { await remove(p.id); await onReload(); } catch (e) { window.alert((e as Error).message); }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{r.customer_name} <Badge variant={STATUS_META[r.status].variant}>{STATUS_META[r.status].label}</Badge></DialogTitle>
          <DialogDescription>{r.concept || (r.project_id ? `Proyecto ${r.project_id}` : 'Cuenta por cobrar')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Total" value={money0(r.total_amount)} />
          <Stat label="Cobrado" value={money0(r.paid)} />
          <Stat label="Saldo" value={money0(r.balance)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-[var(--color-app-text-muted)]">Pagos ({r.payments.length})</p>
            {r.status !== 'liquidado' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onPay}><Receipt className="h-3.5 w-3.5 mr-1" /> Registrar pago</Button>}
          </div>
          {r.payments.length === 0 ? (
            <p className="text-sm text-[var(--color-app-text-muted)] py-2">Aún no hay pagos.</p>
          ) : (
            <div className="rounded-md border border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
              {[...r.payments].sort((a, b) => b.paid_date.localeCompare(a.paid_date)).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-app-success)]" /> {p.paid_date} · <span className="capitalize text-[var(--color-app-text-muted)]">{p.kind} / {p.method}</span></span>
                  <span className="flex items-center gap-2"><span className="tabular-nums font-medium">{money(p.amount)}</span>
                    <button onClick={() => delPay(p)} className="text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
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

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-[var(--color-app-border)] p-2.5"><p className="text-[10px] uppercase tracking-wide text-[var(--color-app-text-muted)]">{label}</p><p className="font-semibold mt-0.5 text-sm">{value}</p></div>;
}
