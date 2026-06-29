import React, { useMemo, useState } from 'react';
import {
  Boxes, Plus, ArrowDownUp, Search, AlertTriangle, PackageX, DollarSign,
  Bell, Pencil, Trash2, TrendingDown, TrendingUp, Upload, FileDown, Loader2, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import {
  useInventoryItems, useUpsertInventoryItem, useDeleteInventoryItem, useRegisterMovement,
  useBulkInsertInventory, stockStatus,
} from '@/lib/api';
import { parseInventoryFile, downloadInventoryTemplate } from '@/lib/inventoryImport';
import type { InventoryItem, InventoryMovementType, StockStatus } from '@/types/database';

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const STATUS_META: Record<StockStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  ok: { label: 'OK', variant: 'success' },
  bajo: { label: 'Bajo mínimo', variant: 'warning' },
  sobre: { label: 'Sobre máximo', variant: 'secondary' },
  agotado: { label: 'Agotado', variant: 'destructive' },
};

export function Inventory() {
  const { tenant } = useTenant();
  const { data: items, refetch } = useInventoryItems();
  const { remove } = useDeleteInventoryItem();

  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [movItem, setMovItem] = useState<InventoryItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Notificaciones automáticas: disponibles en planes superiores (no básico).
  const notificationsAvailable = tenant.plan !== 'basico';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku ?? '').toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const value = items.reduce((s, i) => s + i.stock * i.unit_cost, 0);
    const low = items.filter(i => stockStatus(i) === 'bajo').length;
    const out = items.filter(i => stockStatus(i) === 'agotado').length;
    return { skus: items.length, value, low, out };
  }, [items]);

  const alerts = useMemo(
    () => items.filter(i => i.active && (stockStatus(i) === 'bajo' || stockStatus(i) === 'agotado')),
    [items]
  );

  const handleDelete = async (i: InventoryItem) => {
    if (!window.confirm(`¿Eliminar "${i.name}" del inventario? Se borra también su historial.`)) return;
    try {
      await remove(i.id);
      await refetch();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Inventario</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Control de stock en tiempo real, entradas/salidas y mínimos/máximos.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Importar
          </Button>
          <Button variant="outline" onClick={() => setMovItem(items[0] ?? null)} disabled={items.length === 0}>
            <ArrowDownUp className="h-4 w-4 mr-1.5" /> Movimiento
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo producto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Boxes} label="Productos (SKU)" value={String(stats.skus)} />
        <Kpi icon={DollarSign} label="Valor del inventario" value={MXN.format(stats.value)} tone="primary" />
        <Kpi icon={AlertTriangle} label="Bajo mínimo" value={String(stats.low)} tone={stats.low ? 'warning' : 'muted'} />
        <Kpi icon={PackageX} label="Agotados" value={String(stats.out)} tone={stats.out ? 'danger' : 'muted'} />
      </div>

      {/* Aviso de notificaciones según plan */}
      <div
        className={cn(
          'rounded-lg border px-4 py-3 flex items-center gap-3 text-sm',
          notificationsAvailable
            ? 'border-[var(--color-app-success)]/30 bg-[var(--color-app-success-soft)]/40'
            : 'border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)]/50'
        )}
      >
        <Bell className={cn('h-4 w-4 shrink-0', notificationsAvailable ? 'text-[var(--color-app-success)]' : 'text-[var(--color-app-text-subtle)]')} />
        {notificationsAvailable ? (
          <span>
            <strong>Notificaciones automáticas activas:</strong> recibirás alerta por correo (y push en la app móvil)
            cuando un producto baje de su mínimo.
          </span>
        ) : (
          <span className="text-[var(--color-app-text-muted)]">
            Las alertas de reorden por <strong>correo y push automáticas</strong> están disponibles en los planes
            Profesional y Enterprise. En tu plan actual ves las alertas dentro de la app.
          </span>
        )}
      </div>

      {/* Alertas de reorden */}
      {alerts.length > 0 && (
        <Card className="border-[var(--color-app-warning)]/40 bg-[var(--color-app-warning-soft)]/20">
          <CardContent className="p-4">
            <p className="text-sm font-semibold flex items-center gap-2 mb-2 text-[var(--color-app-text)]">
              <AlertTriangle className="h-4 w-4 text-[var(--color-app-warning)]" />
              {alerts.length} producto{alerts.length === 1 ? '' : 's'} requiere{alerts.length === 1 ? '' : 'n'} reorden
            </p>
            <div className="flex flex-wrap gap-2">
              {alerts.map(i => (
                <button
                  key={i.id}
                  onClick={() => setMovItem(i)}
                  className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-app-border)] bg-white hover:border-[var(--color-app-primary)]"
                >
                  <span className="font-medium">{i.name}</span>{' '}
                  <span className="text-[var(--color-app-text-muted)]">· {i.stock}/{i.min_stock} {i.uom}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card className="p-0">
        <div className="p-3 border-b border-[var(--color-app-border)]">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
            <Input placeholder="Buscar SKU, nombre o categoría…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {items.length === 0 ? 'Sin productos. Crea el primero con “Nuevo producto”.' : 'Sin resultados.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-center">Mín / Máx</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(i => {
                  const st = stockStatus(i);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.sku ?? '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium text-[var(--color-app-text)]">{i.name}</div>
                        {i.location && <div className="text-[11px] text-[var(--color-app-text-subtle)]">📍 {i.location}</div>}
                      </TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)]">{i.category}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {i.stock} <span className="text-xs font-normal text-[var(--color-app-text-muted)]">{i.uom}</span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-xs text-[var(--color-app-text-muted)]">
                        {i.min_stock} / {i.max_stock ?? '—'}
                      </TableCell>
                      <TableCell><Badge variant={STATUS_META[st].variant}>{STATUS_META[st].label}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{MXN.format(i.stock * i.unit_cost)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setMovItem(i)} title="Entrada / salida / ajuste">
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditItem(i)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => handleDelete(i)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(newOpen || editItem) && (
        <ItemFormModal
          item={editItem}
          onClose={() => { setNewOpen(false); setEditItem(null); }}
          onSaved={async () => { setNewOpen(false); setEditItem(null); await refetch(); }}
        />
      )}
      {movItem && (
        <MovementModal
          items={items}
          initial={movItem}
          onClose={() => setMovItem(null)}
          onSaved={async () => { setMovItem(null); await refetch(); }}
        />
      )}
      {importOpen && (
        <ImportModal onClose={() => setImportOpen(false)} onDone={async () => { setImportOpen(false); await refetch(); }} />
      )}
    </div>
  );
}

// ── Modal: importación masiva (Excel/CSV) ──
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { insert, loading } = useBulkInsertInventory();
  const [rows, setRows] = useState<import('@/lib/api').BulkInventoryRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    try {
      const res = await parseInventoryFile(file);
      setRows(res.rows);
      setSkipped(res.skipped);
      setFileName(file.name);
    } catch {
      setError('No se pudo leer el archivo. Asegúrate de usar la plantilla (.xlsx o .csv).');
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    setError(null);
    try {
      const n = await insert(rows);
      setDone(n);
      setTimeout(onDone, 900);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar inventario</DialogTitle>
          <DialogDescription>Sube tu BOM de inventario en Excel o CSV. Usa la plantilla para que siempre cargue igual.</DialogDescription>
        </DialogHeader>

        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}

        {done != null ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-[var(--color-app-success)] mx-auto" />
            <p className="text-sm font-medium">Se importaron {done} productos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={downloadInventoryTemplate}>
              <FileDown className="h-4 w-4 mr-1.5" /> Descargar plantilla (.xlsx)
            </Button>

            <label className="block">
              <div className="border-2 border-dashed border-[var(--color-app-border-strong)] rounded-lg p-6 text-center cursor-pointer hover:bg-[var(--color-app-surface-alt)]/40">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
                {parsing ? (
                  <span className="inline-flex items-center gap-2 text-sm text-[var(--color-app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Leyendo…</span>
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto text-[var(--color-app-primary)] mb-1.5" />
                    <p className="text-sm font-medium">{fileName || 'Selecciona o arrastra tu archivo'}</p>
                    <p className="text-xs text-[var(--color-app-text-muted)]">.xlsx, .xls o .csv</p>
                  </>
                )}
              </div>
            </label>

            {rows.length > 0 && (
              <div className="text-sm rounded-md bg-[var(--color-app-success-soft)]/40 p-3 border border-[var(--color-app-success)]/30">
                <strong>{rows.length}</strong> productos detectados
                {skipped > 0 && <span className="text-[var(--color-app-text-muted)]"> · {skipped} filas ignoradas (sin nombre)</span>}.
              </div>
            )}
          </div>
        )}

        {done == null && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={doImport} disabled={loading || rows.length === 0}>
              {loading ? 'Importando…' : `Importar ${rows.length || ''} productos`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; tone?: 'primary' | 'warning' | 'danger' | 'muted';
}) {
  const color = tone === 'primary' ? 'text-[var(--color-app-primary)]'
    : tone === 'warning' ? 'text-[var(--color-app-warning)]'
    : tone === 'danger' ? 'text-[var(--color-app-danger)]'
    : tone === 'muted' ? 'text-[var(--color-app-text-subtle)]'
    : 'text-[var(--color-app-text)]';
  return (
    <Card className="p-0">
      <CardContent className="p-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
          <p className={cn('text-2xl font-semibold mt-1', color)}>{value}</p>
        </div>
        <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
      </CardContent>
    </Card>
  );
}

// ── Modal: alta / edición de producto ──
function ItemFormModal({ item, onClose, onSaved }: {
  item: InventoryItem | null; onClose: () => void; onSaved: () => void;
}) {
  const { save, loading } = useUpsertInventoryItem();
  const [f, setF] = useState({
    sku: item?.sku ?? '', name: item?.name ?? '', category: item?.category ?? 'General', uom: item?.uom ?? 'Pza',
    stock: String(item?.stock ?? 0), min_stock: String(item?.min_stock ?? 0), max_stock: item?.max_stock != null ? String(item.max_stock) : '',
    unit_cost: String(item?.unit_cost ?? 0), unit_price: String(item?.unit_price ?? 0),
    location: item?.location ?? '', supplier_name: item?.supplier_name ?? '', notes: item?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const num = (s: string) => (s.trim() === '' ? 0 : Number(s));

  const submit = async () => {
    setError(null);
    if (!f.name.trim()) return setError('El nombre es obligatorio.');
    try {
      await save({
        id: item?.id,
        sku: f.sku.trim() || null,
        name: f.name.trim(),
        category: f.category.trim() || 'General',
        uom: f.uom.trim() || 'Pza',
        stock: item ? undefined : num(f.stock), // stock inicial solo al crear
        min_stock: num(f.min_stock),
        max_stock: f.max_stock.trim() === '' ? null : num(f.max_stock),
        unit_cost: num(f.unit_cost),
        unit_price: num(f.unit_price),
        location: f.location.trim() || null,
        supplier_name: f.supplier_name.trim() || null,
        barcode: null,
        active: true,
        notes: f.notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            {item ? 'Actualiza los datos del producto. El stock se cambia con movimientos.' : 'Registra un producto en tu inventario.'}
          </DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <L label="SKU / código"><Input value={f.sku} onChange={set('sku')} className="font-mono" placeholder="HER-001" /></L>
          <L label="Categoría"><Input value={f.category} onChange={set('category')} /></L>
          <L label="Nombre" full><Input value={f.name} onChange={set('name')} autoFocus /></L>
          <L label="Unidad"><Input value={f.uom} onChange={set('uom')} placeholder="Pza, m, kg…" /></L>
          {!item && <L label="Stock inicial"><Input type="number" value={f.stock} onChange={set('stock')} /></L>}
          <L label="Mínimo (reorden)"><Input type="number" value={f.min_stock} onChange={set('min_stock')} /></L>
          <L label="Máximo"><Input type="number" value={f.max_stock} onChange={set('max_stock')} placeholder="Opcional" /></L>
          <L label="Costo unitario"><Input type="number" value={f.unit_cost} onChange={set('unit_cost')} /></L>
          <L label="Precio venta"><Input type="number" value={f.unit_price} onChange={set('unit_price')} /></L>
          <L label="Ubicación"><Input value={f.location} onChange={set('location')} placeholder="A-1, Almacén…" /></L>
          <L label="Proveedor"><Input value={f.supplier_name} onChange={set('supplier_name')} /></L>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Guardando…' : item ? 'Guardar' : 'Crear producto'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: registrar movimiento (entrada / salida / ajuste) ──
function MovementModal({ items, initial, onClose, onSaved }: {
  items: InventoryItem[]; initial: InventoryItem; onClose: () => void; onSaved: () => void;
}) {
  const { register, loading } = useRegisterMovement();
  const [itemId, setItemId] = useState(initial.id);
  const [type, setType] = useState<InventoryMovementType>('salida');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const item = items.find(i => i.id === itemId) ?? initial;
  const q = Number(quantity) || 0;
  const projected = type === 'entrada' ? item.stock + q : type === 'salida' ? item.stock - q : q;

  const submit = async () => {
    setError(null);
    if (q <= 0 && type !== 'ajuste') return setError('La cantidad debe ser mayor a 0.');
    if (type === 'salida' && q > item.stock) return setError(`No hay stock suficiente. Disponible: ${item.stock} ${item.uom}.`);
    try {
      await register({ item_id: itemId, type, quantity: type === 'ajuste' ? q : Math.abs(q), reason: reason || null, reference: reference || null });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const TYPE_LABEL: Record<InventoryMovementType, string> = { entrada: 'Entrada (compra/recepción)', salida: 'Salida (venta/consumo)', ajuste: 'Ajuste (conteo físico)' };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>El stock se actualiza al instante.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="space-y-3">
          <L label="Producto" full>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} · {i.stock} {i.uom}</SelectItem>)}
              </SelectContent>
            </Select>
          </L>
          <L label="Tipo de movimiento" full>
            <Select value={type} onValueChange={v => setType(v as InventoryMovementType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['entrada', 'salida', 'ajuste'] as InventoryMovementType[]).map(t => (
                  <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label={type === 'ajuste' ? 'Stock contado' : 'Cantidad'}>
              <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} autoFocus />
            </L>
            <L label="Referencia"><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Folio / doc" /></L>
          </div>
          <L label="Motivo" full><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Venta, compra, merma…" /></L>

          <div className="flex items-center justify-between p-3 rounded-md bg-[var(--color-app-surface-alt)]/60 text-sm">
            <span className="text-[var(--color-app-text-muted)]">Stock {item.stock} → resultante</span>
            <span className={cn('font-semibold tabular-nums flex items-center gap-1', projected < item.stock ? 'text-[var(--color-app-danger)]' : 'text-[var(--color-app-success)]')}>
              {projected < item.stock ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {projected} {item.uom}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Registrando…' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('space-y-1.5', full && 'col-span-2')}>
      <label className="text-xs font-medium text-[var(--color-app-text)]">{label}</label>
      {children}
    </div>
  );
}
