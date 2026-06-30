import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useSuppliers, useUpsertSupplier, useDeleteSupplier } from '@/lib/api';
import type { Supplier } from '@/types/database';

export function SuppliersTab() {
  const { data: suppliers, refetch } = useSuppliers();
  const { remove } = useDeleteSupplier();
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = suppliers.filter(s =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const del = async (s: Supplier) => {
    if (!window.confirm(`¿Eliminar al proveedor "${s.name}"?`)) return;
    try { await remove(s.id); await refetch(); } catch (e) { window.alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input placeholder="Buscar proveedor…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo proveedor
        </Button>
      </div>

      <Card className="p-0">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {suppliers.length === 0 ? 'Sin proveedores. Da de alta el primero.' : 'Sin resultados.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Términos</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-1.5">
                        {s.name}
                        {s.is_certified && <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-app-success)]" />}
                      </div>
                      {s.tax_id && <div className="text-[11px] text-[var(--color-app-text-subtle)] font-mono">{s.tax_id}</div>}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {s.contact_name ?? '—'}
                      {s.contact_email && <div className="text-[11px]">{s.contact_email}</div>}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{s.phone ?? '—'}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{s.payment_terms ?? '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={s.is_active ? 'success' : 'secondary'}>{s.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { save, loading } = useUpsertSupplier();
  const [f, setF] = useState({
    name: supplier?.name ?? '', contact_name: supplier?.contact_name ?? '', contact_email: supplier?.contact_email ?? '',
    phone: supplier?.phone ?? '', tax_id: supplier?.tax_id ?? '', address: supplier?.address ?? '',
    payment_terms: supplier?.payment_terms ?? '', is_certified: supplier?.is_certified ?? false, is_active: supplier?.is_active ?? true,
    notes: supplier?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) return setError('El nombre es obligatorio.');
    try {
      await save({ id: supplier?.id, ...f, name: f.name.trim() });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          <DialogDescription>Datos de contacto y términos comerciales.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <L label="Nombre / razón social" full><Input value={f.name} onChange={set('name')} autoFocus /></L>
          <L label="Contacto"><Input value={f.contact_name} onChange={set('contact_name')} /></L>
          <L label="Correo"><Input value={f.contact_email} onChange={set('contact_email')} type="email" /></L>
          <L label="Teléfono"><Input value={f.phone} onChange={set('phone')} /></L>
          <L label="RFC"><Input value={f.tax_id} onChange={set('tax_id')} className="font-mono" /></L>
          <L label="Términos de pago"><Input value={f.payment_terms} onChange={set('payment_terms')} placeholder="30 días" /></L>
          <L label="Dirección" full><Input value={f.address} onChange={set('address')} /></L>
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
