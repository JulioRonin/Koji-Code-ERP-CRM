import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, BadgeCheck, Star, Truck, DollarSign, Users, Timer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useSuppliers, useUpsertSupplier, useDeleteSupplier, usePurchaseOrders } from '@/lib/api';
import type { Supplier, PurchaseOrder } from '@/types/database';
import { cn } from '@/lib/utils';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const TIER_STYLE: Record<string, string> = {
  A: 'bg-amber-100 text-amber-700 border-amber-300',
  B: 'bg-sky-100 text-sky-700 border-sky-300',
  C: 'bg-slate-100 text-slate-600 border-slate-300',
};

interface SupplierMetrics {
  orders: number;
  spend: number;
  onTimeRate: number | null;
  lastOrder: string | null;
  tier: 'A' | 'B' | 'C';
  tierAuto: boolean;
  pos: PurchaseOrder[];
}

function computeMetrics(s: Supplier, pos: PurchaseOrder[]): SupplierMetrics {
  const mine = pos.filter(p => p.supplier_id === s.id);
  const spend = mine.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const received = mine.filter(p => p.received_at);
  const onTime = received.filter(p => p.expected_delivery && p.received_at && p.received_at <= p.expected_delivery).length;
  const onTimeRate = received.length ? Math.round((onTime / received.length) * 100) : null;
  const lastOrder = mine.length ? mine.map(p => p.created_at).sort().slice(-1)[0] : null;
  const tierAuto = spend >= 300_000 || mine.length >= 5 ? 'A' : spend >= 50_000 || mine.length >= 2 ? 'B' : 'C';
  const tier = (s.tier as 'A' | 'B' | 'C' | null) ?? tierAuto;
  return { orders: mine.length, spend, onTimeRate, lastOrder, tier, tierAuto: !s.tier, pos: mine };
}

type Enriched = Supplier & { m: SupplierMetrics };

export function SuppliersTab() {
  const { data: suppliers, refetch } = useSuppliers();
  const { data: pos } = usePurchaseOrders();
  const { remove } = useDeleteSupplier();
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Enriched | null>(null);

  const enriched: Enriched[] = useMemo(
    () => suppliers.map(s => ({ ...s, m: computeMetrics(s, pos) })).sort((a, b) => b.m.spend - a.m.spend),
    [suppliers, pos]
  );

  const filtered = enriched.filter(s =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const kpis = useMemo(() => {
    const spend = enriched.reduce((s, x) => s + x.m.spend, 0);
    const certificados = enriched.filter(s => s.is_certified).length;
    const rates = enriched.map(s => s.m.onTimeRate).filter((r): r is number => r != null);
    const avgOnTime = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
    return { total: enriched.length, spend, certificados, avgOnTime };
  }, [enriched]);

  const del = async (s: Supplier) => {
    if (!window.confirm(`¿Eliminar al proveedor "${s.name}"?`)) return;
    try { await remove(s.id); await refetch(); } catch (e) { window.alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Proveedores" value={String(kpis.total)} />
        <Kpi icon={DollarSign} label="Gasto total" value={money(kpis.spend)} sub="en órdenes de compra" />
        <Kpi icon={BadgeCheck} label="Certificados" value={String(kpis.certificados)} />
        <Kpi icon={Timer} label="Entregas a tiempo" value={kpis.avgOnTime != null ? `${kpis.avgOnTime}%` : '—'} sub="promedio" tone={kpis.avgOnTime != null && kpis.avgOnTime < 80 ? 'warning' : undefined} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input placeholder="Buscar proveedor o categoría…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo proveedor
        </Button>
      </div>

      <Card className="p-0">
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {suppliers.length === 0 ? 'Sin proveedores. Da de alta el primero.' : 'Sin resultados.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Rank</TableHead>
                  <TableHead className="text-center">Órdenes</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-center">A tiempo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setDetail(s)}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-1.5">
                        {s.name}
                        {s.is_certified && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-app-success)]" />}
                      </div>
                      {s.tax_id && <div className="text-[11px] text-[var(--color-app-text-subtle)] font-mono">{s.tax_id}</div>}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{s.category ?? '—'}</TableCell>
                    <TableCell className="text-center"><TierPill tier={s.m.tier} auto={s.m.tierAuto} /></TableCell>
                    <TableCell className="text-center tabular-nums">{s.m.orders}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(s.m.spend)}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {s.m.onTimeRate != null
                        ? <span className={cn(s.m.onTimeRate < 80 ? 'text-[var(--color-app-warning)]' : 'text-[var(--color-app-success)]')}>{s.m.onTimeRate}%</span>
                        : <span className="text-[var(--color-app-text-subtle)]">—</span>}
                    </TableCell>
                    <TableCell className="text-center"><Badge variant={s.is_active ? 'success' : 'secondary'}>{s.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEdit(s); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => del(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && <SupplierModal supplier={edit} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refetch(); }} />}
      {detail && <SupplierDetail s={detail} onClose={() => setDetail(null)} onEdit={() => { setEdit(detail); setDetail(null); setOpen(true); }} />}
    </div>
  );
}

function TierPill({ tier, auto }: { tier: string; auto: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[11px] font-bold', TIER_STYLE[tier] ?? TIER_STYLE.C)} title={auto ? 'Rango calculado' : 'Rango manual'}>
      <Star className="h-3 w-3" fill="currentColor" /> {tier}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone?: 'warning' }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-app-text-muted)] truncate">{label}</p>
            <p className={cn('text-xl font-semibold mt-0.5 truncate', tone === 'warning' && 'text-[var(--color-app-warning)]')}>{value}</p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        </div>
        {sub && <p className="text-[11px] text-[var(--color-app-text-muted)] mt-1 truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SupplierDetail({ s, onClose, onEdit }: { s: Enriched; onClose: () => void; onEdit: () => void }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {s.name} <TierPill tier={s.m.tier} auto={s.m.tierAuto} />
            {s.is_certified && <Badge variant="success">Certificado</Badge>}
          </DialogTitle>
          <DialogDescription>{s.category || 'Proveedor'}{s.tax_id ? ` · ${s.tax_id}` : ''}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Órdenes" value={String(s.m.orders)} />
          <Stat label="Gasto" value={money(s.m.spend)} />
          <Stat label="A tiempo" value={s.m.onTimeRate != null ? `${s.m.onTimeRate}%` : '—'} />
          <Stat label="Últ. orden" value={s.m.lastOrder ? formatDistanceToNow(new Date(s.m.lastOrder), { addSuffix: true, locale: es }) : '—'} />
        </div>

        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {s.contact_name && <p>👤 {s.contact_name}</p>}
          {s.contact_email && <p>✉️ {s.contact_email}</p>}
          {s.phone && <p>📞 {s.phone}</p>}
          {s.payment_terms && <p>💳 {s.payment_terms}</p>}
          {s.lead_time_days != null && <p className="flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Entrega ~{s.lead_time_days} días</p>}
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--color-app-text-muted)] mb-1.5">Órdenes de compra ({s.m.pos.length})</p>
          {s.m.pos.length === 0 ? (
            <p className="text-sm text-[var(--color-app-text-muted)] py-2">Sin órdenes registradas.</p>
          ) : (
            <div className="rounded-md border border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
              {s.m.pos.slice(0, 8).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{p.id}</span>
                  <span className="tabular-nums">{money(p.total_amount)}</span>
                  <Badge variant="secondary">{p.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="mr-auto" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1.5" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-app-border)] p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-app-text-muted)]">{label}</p>
      <p className="font-semibold mt-0.5 text-sm">{value}</p>
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { save, loading } = useUpsertSupplier();
  const [f, setF] = useState({
    name: supplier?.name ?? '', contact_name: supplier?.contact_name ?? '', contact_email: supplier?.contact_email ?? '',
    phone: supplier?.phone ?? '', tax_id: supplier?.tax_id ?? '', address: supplier?.address ?? '',
    payment_terms: supplier?.payment_terms ?? '', category: supplier?.category ?? '',
    tier: (supplier?.tier ?? '') as '' | 'A' | 'B' | 'C',
    lead_time_days: supplier?.lead_time_days != null ? String(supplier.lead_time_days) : '',
    is_certified: supplier?.is_certified ?? false, is_active: supplier?.is_active ?? true, notes: supplier?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) return setError('El nombre es obligatorio.');
    try {
      await save({
        id: supplier?.id, name: f.name.trim(), contact_name: f.contact_name, contact_email: f.contact_email,
        phone: f.phone, tax_id: f.tax_id, address: f.address, payment_terms: f.payment_terms,
        category: f.category || null, tier: f.tier || null,
        lead_time_days: f.lead_time_days.trim() === '' ? null : Number(f.lead_time_days),
        is_certified: f.is_certified, is_active: f.is_active, notes: f.notes,
      });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          <DialogDescription>Datos, categoría y clasificación.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <L label="Nombre / razón social" full><Input value={f.name} onChange={set('name')} autoFocus /></L>
          <L label="Categoría de suministro"><Input value={f.category} onChange={set('category')} placeholder="Aceros, herramienta, servicio…" /></L>
          <L label="Contacto"><Input value={f.contact_name} onChange={set('contact_name')} /></L>
          <L label="Correo"><Input value={f.contact_email} onChange={set('contact_email')} type="email" /></L>
          <L label="Teléfono"><Input value={f.phone} onChange={set('phone')} /></L>
          <L label="RFC"><Input value={f.tax_id} onChange={set('tax_id')} className="font-mono" /></L>
          <L label="Términos de pago"><Input value={f.payment_terms} onChange={set('payment_terms')} placeholder="30 días" /></L>
          <L label="Entrega típica (días)"><Input type="number" value={f.lead_time_days} onChange={set('lead_time_days')} /></L>
          <L label="Rango (opcional)">
            <select value={f.tier} onChange={e => setF(p => ({ ...p, tier: e.target.value as typeof f.tier }))} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40">
              <option value="">Automático</option>
              <option value="A">A — estratégico</option>
              <option value="B">B — recurrente</option>
              <option value="C">C — ocasional</option>
            </select>
          </L>
          <L label="Dirección"><Input value={f.address} onChange={set('address')} /></L>
          <div className="col-span-2 flex items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_certified} onChange={e => setF(p => ({ ...p, is_certified: e.target.checked }))} /> Certificado</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={e => setF(p => ({ ...p, is_active: e.target.checked }))} /> Activo</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
      <label className="text-xs font-medium text-[var(--color-app-text)]">{label}</label>
      {children}
    </div>
  );
}
