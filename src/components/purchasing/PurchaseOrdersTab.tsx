import { useMemo, useState } from 'react';
import { Plus, Trash2, PackageCheck, Send, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  usePurchaseOrders, useSuppliers, useInventoryItems,
  useCreatePurchaseOrder, useUpdatePoStatus, useReceivePurchaseOrder,
} from '@/lib/api';
import type { PoStatus, PurchaseOrder } from '@/types/database';

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  Borrador: 'secondary', Emitida: 'warning', Confirmada: 'default', Tránsito: 'default',
  Recibida_Parcial: 'warning', Recibida: 'success', Cerrada: 'success', Cancelada: 'destructive',
};

export function PurchaseOrdersTab() {
  const { data: pos, refetch } = usePurchaseOrders();
  const { data: suppliers } = useSuppliers();
  const { update: setStatus } = useUpdatePoStatus();
  const { receive } = useReceivePurchaseOrder();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? id;

  const emit = async (po: PurchaseOrder) => {
    setBusy(po.id);
    try { await setStatus(po.id, 'Emitida'); await refetch(); } catch (e) { window.alert((e as Error).message); } finally { setBusy(null); }
  };
  const doReceive = async (po: PurchaseOrder) => {
    if (!window.confirm(`¿Marcar la orden ${po.id} como recibida? Se sumarán las cantidades al inventario.`)) return;
    setBusy(po.id);
    try { await receive(po.id); await refetch(); } catch (e) { window.alert((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-app-text-muted)]">Órdenes a proveedores. Al recibir, las partidas ligadas a inventario suman stock.</p>
        <Button onClick={() => setOpen(true)} disabled={suppliers.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva orden
        </Button>
      </div>
      {suppliers.length === 0 && (
        <p className="text-xs text-[var(--color-app-warning)]">Primero da de alta un proveedor en la pestaña Proveedores.</p>
      )}

      <Card className="p-0">
        <CardContent className="p-0">
          {pos.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">Sin órdenes de compra.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map(po => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs">{po.id}</TableCell>
                    <TableCell>{supplierName(po.supplier_id)}</TableCell>
                    <TableCell className="text-right tabular-nums">{MXN.format(po.total_amount)}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{po.expected_delivery ?? '—'}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[po.status] ?? 'secondary'}>{po.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {po.status === 'Borrador' && (
                          <Button variant="ghost" size="sm" className="h-8" disabled={busy === po.id} onClick={() => emit(po)} title="Emitir">
                            <Send className="h-3.5 w-3.5 mr-1" /> Emitir
                          </Button>
                        )}
                        {po.status !== 'Recibida' && po.status !== 'Cancelada' && po.status !== 'Borrador' && (
                          <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-success)]" disabled={busy === po.id} onClick={() => doReceive(po)} title="Recibir">
                            <PackageCheck className="h-3.5 w-3.5 mr-1" /> Recibir
                          </Button>
                        )}
                        {po.status === 'Recibida' && <span className="text-xs text-[var(--color-app-success)] inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Recibida</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && <PoModal onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refetch(); }} />}
    </div>
  );
}

interface DraftLine { description: string; inventory_item_id: string | null; quantity: string; unit_price: string; uom: string }

function PoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: suppliers } = useSuppliers();
  const { data: inventory } = useInventoryItems();
  const { create, loading } = useCreatePurchaseOrder();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [expected, setExpected] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ description: '', inventory_item_id: null, quantity: '1', unit_price: '0', uom: 'Pza' }]);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0), [lines]);

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const pickInventory = (i: number, invId: string) => {
    if (invId === '__free__') { setLine(i, { inventory_item_id: null }); return; }
    const it = inventory.find(x => x.id === invId);
    if (it) setLine(i, { inventory_item_id: invId, description: it.name, unit_price: String(it.unit_cost), uom: it.uom });
  };

  const submit = async () => {
    setError(null);
    if (!supplierId) return setError('Selecciona un proveedor.');
    const items = lines
      .filter(l => l.description.trim() && Number(l.quantity) > 0)
      .map(l => ({ description: l.description.trim(), quantity: Number(l.quantity), uom: l.uom, unit_price: Number(l.unit_price) || 0, inventory_item_id: l.inventory_item_id }));
    if (items.length === 0) return setError('Agrega al menos una partida.');
    try {
      await create({ supplier_id: supplierId, expected_delivery: expected || null, items });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>Las partidas ligadas a un producto de inventario sumarán stock al recibir.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Proveedor</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Fecha de entrega</label>
            <Input type="date" value={expected} onChange={e => setExpected(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Partidas</label>
            <button onClick={() => setLines(p => [...p, { description: '', inventory_item_id: null, quantity: '1', unit_price: '0', uom: 'Pza' }])} className="text-xs text-[var(--color-app-primary)] inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar</button>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
              <div className="col-span-4">
                <Select value={l.inventory_item_id ?? '__free__'} onValueChange={v => pickInventory(i, v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__free__">— Libre —</SelectItem>
                    {inventory.map(it => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input className="col-span-4 h-9" placeholder="Descripción" value={l.description} onChange={e => setLine(i, { description: e.target.value })} />
              <Input className="col-span-1 h-9 text-center" type="number" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} title="Cantidad" />
              <Input className="col-span-2 h-9 text-right" type="number" value={l.unit_price} onChange={e => setLine(i, { unit_price: e.target.value })} title="Precio unit." />
              <button onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        <div className="flex justify-end text-sm font-semibold">Total: <span className="ml-2 tabular-nums">{MXN.format(total)}</span></div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creando…' : 'Crear orden'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { PoStatus };
