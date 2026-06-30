import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Users, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useCustomers, useUpsertCustomer, useDeleteCustomer } from '@/lib/api';
import type { Customer } from '@/types/database';

export function Customers() {
  const { data: customers, refetch } = useCustomers();
  const { remove } = useDeleteCustomer();
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = customers.filter(c =>
    !search.trim() ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.tax_id ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const del = async (c: Customer) => {
    if (!window.confirm(`¿Eliminar al cliente "${c.name}"?`)) return;
    try { await remove(c.id); await refetch(); } catch (e) { window.alert((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--color-app-primary)]" /> Clientes
          </h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Da de alta tus clientes para usarlos en cotizaciones y notas de venta.
          </p>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo cliente
        </Button>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
        <Input placeholder="Buscar por nombre, contacto o RFC…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="p-0">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {customers.length === 0 ? 'Sin clientes. Da de alta el primero.' : 'Sin resultados.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.tax_id && <div className="text-[11px] text-[var(--color-app-text-subtle)] font-mono">{c.tax_id}</div>}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {c.contact_name ?? '—'}
                      {c.contact_email && (
                        <div className="text-[11px] inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.contact_email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {c.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span> : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.is_active ? 'success' : 'secondary'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => del(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && <CustomerModal customer={edit} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refetch(); }} />}
    </div>
  );
}

function CustomerModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const { save, loading } = useUpsertCustomer();
  const [f, setF] = useState({
    name: customer?.name ?? '', contact_name: customer?.contact_name ?? '', contact_email: customer?.contact_email ?? '',
    phone: customer?.phone ?? '', tax_id: customer?.tax_id ?? '', address: customer?.address ?? '',
    is_active: customer?.is_active ?? true, notes: customer?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) return setError('El nombre es obligatorio.');
    try {
      await save({ id: customer?.id, ...f, name: f.name.trim() });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>Datos de contacto y fiscales para cotizaciones.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <L label="Nombre / razón social" full><Input value={f.name} onChange={set('name')} autoFocus /></L>
          <L label="Contacto"><Input value={f.contact_name} onChange={set('contact_name')} /></L>
          <L label="Correo"><Input value={f.contact_email} onChange={set('contact_email')} type="email" placeholder="cliente@empresa.com" /></L>
          <L label="Teléfono"><Input value={f.phone} onChange={set('phone')} /></L>
          <L label="RFC"><Input value={f.tax_id} onChange={set('tax_id')} className="font-mono" /></L>
          <L label="Dirección" full><Input value={f.address} onChange={set('address')} /></L>
          <div className="col-span-2 flex items-center gap-5 pt-1">
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
