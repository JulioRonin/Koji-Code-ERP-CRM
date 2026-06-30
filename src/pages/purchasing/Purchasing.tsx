import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  MoreHorizontal,
  ArrowUpDown,
  Calendar,
  ShoppingCart,
  FileText,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BOMManager } from '@/components/purchasing/BOMManager';
import { ProjectPurchaseTracker } from '@/components/purchasing/ProjectPurchaseTracker';
import { SuppliersTab } from '@/components/purchasing/SuppliersTab';
import { PurchaseOrdersTab } from '@/components/purchasing/PurchaseOrdersTab';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useRequisitions, useBomItems, summarizePurchasing, useCreateRequisition,
} from '@/lib/api';
import type { Requisition, Priority, RequisitionStatus } from '@/types/database';

const priorityVariant: Record<Priority, 'destructive' | 'warning' | 'secondary'> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

const statusVariant: Record<RequisitionStatus, 'secondary' | 'warning' | 'success' | 'default' | 'destructive' | 'outline'> = {
  Pendiente: 'secondary',
  Cotizando: 'warning',
  Aprobada: 'success',
  Ordenada: 'default',
  Rechazada: 'destructive',
  Cerrada: 'outline',
};

const columnHelper = createColumnHelper<Requisition>();

const tabs = [
  { id: 'by-project',   label: 'Por proyecto' },
  { id: 'requisitions', label: 'Requisiciones' },
  { id: 'bom',          label: 'BOM / Listas' },
  { id: 'pos',          label: 'Órdenes de compra' },
  { id: 'suppliers',    label: 'Proveedores' },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Purchasing() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('by-project');
  const { data: requisitions, refetch: refetchReqs } = useRequisitions();
  const { data: bomItems } = useBomItems();
  const [newReqOpen, setNewReqOpen] = useState(false);

  // KPIs reales derivados de bom_items — desglose por estatus de compra
  const kpis = React.useMemo(() => {
    const summary = summarizePurchasing(bomItems);
    const pendingReqs = requisitions.filter(r => r.status === 'Pendiente' || r.status === 'Cotizando').length;
    const activeOrders = requisitions.filter(r => r.status === 'Aprobada' || r.status === 'Ordenada').length;
    const suppliers = new Set(bomItems.map(b => b.supplier_name).filter(Boolean)).size;
    return {
      pendingReqs,
      activeOrders,
      pending: summary.pending_items,
      requested: summary.requested_items,
      inTransit: summary.in_transit_items,
      received: summary.received_items,
      progress: summary.progress_pct,
      late: summary.late_items,
      suppliers,
    };
  }, [bomItems, requisitions]);

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID req.',
      cell: info => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('project_id', {
      header: 'Proyecto',
      cell: info => <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('description', {
      header: 'Descripción',
      cell: info => <span>{info.getValue()}</span>,
    }),
    columnHelper.accessor('requester_id', {
      header: 'Solicitante',
      cell: info => <span className="text-[var(--color-app-text-muted)]">{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('created_at', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-3 h-8"
        >
          Fecha <ArrowUpDown className="ml-1.5 h-3 w-3" />
        </Button>
      ),
      cell: info => {
        const date = new Date(info.getValue());
        return (
          <div className="flex items-center gap-2 text-sm text-[var(--color-app-text-muted)]">
            <Calendar className="h-3.5 w-3.5" />
            {format(date, 'dd MMM yyyy', { locale: es })}
          </div>
        );
      },
    }),
    columnHelper.accessor('priority', {
      header: 'Prioridad',
      cell: info => <Badge variant={priorityVariant[info.getValue()]}>{info.getValue()}</Badge>,
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: info => <Badge variant={statusVariant[info.getValue()]}>{info.getValue()}</Badge>,
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => {
        const req = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(req.id)}>
                Copiar ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Ver detalles</DropdownMenuItem>
              <DropdownMenuItem>Generar PO</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: requisitions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Compras</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Requisiciones, órdenes de compra y proveedores.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva requisición
        </Button>
      </div>

      {/* KPI cards — desglose por estatus de compra del BOM activo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'Avance global',
            value: `${kpis.progress}%`,
            sub: `${kpis.received} recibidos`,
            icon: ShoppingCart,
          },
          { label: 'Pendientes',  value: String(kpis.pending),   sub: 'Sin solicitar',     icon: AlertCircle },
          { label: 'Solicitados', value: String(kpis.requested), sub: 'Cotización / PO',   icon: FileText },
          { label: 'En tránsito', value: String(kpis.inTransit), sub: 'Camino al taller',  icon: ShoppingCart },
          {
            label: 'Atrasadas',
            value: String(kpis.late),
            sub: kpis.late > 0 ? 'Requieren seguimiento' : 'Todo al día',
            icon: AlertCircle,
          },
        ].map(k => (
          <Card key={k.label} className="p-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[var(--color-app-text-muted)]">{k.label}</p>
                  <p className="text-2xl font-semibold mt-1">{k.value}</p>
                </div>
                <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
                  <k.icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                </div>
              </div>
              <p className="text-xs text-[var(--color-app-text-muted)] mt-2">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-app-border)] flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === t.id
                ? 'border-[var(--color-app-primary)] text-[var(--color-app-primary)]'
                : 'border-transparent text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'by-project' && <ProjectPurchaseTracker />}

      {activeTab === 'requisitions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
              <Input
                placeholder="Buscar requisiciones..."
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setNewReqOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nueva requisición
            </Button>
          </div>

          <Card className="p-0">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map(row => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-[var(--color-app-text-muted)]">
                      No se encontraron resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'bom' && <BOMManager />}

      {activeTab === 'pos' && <PurchaseOrdersTab />}

      {activeTab === 'suppliers' && <SuppliersTab />}

      {newReqOpen && (
        <NewRequisitionModal onClose={() => setNewReqOpen(false)} onCreated={async () => { setNewReqOpen(false); await refetchReqs(); }} />
      )}
    </div>
  );
}

function NewRequisitionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { create, loading } = useCreateRequisition();
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [uom, setUom] = useState('Pzas');
  const [priority, setPriority] = useState<Priority>('Media');
  const [neededBy, setNeededBy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!description.trim()) return setError('Describe lo que necesitas.');
    try {
      await create({ description: description.trim(), quantity: Number(quantity) || 1, uom, priority, needed_by: neededBy || null });
      onCreated();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva requisición</DialogTitle>
          <DialogDescription>Solicita una compra de material o servicio.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">¿Qué necesitas?</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} autoFocus placeholder="Ej. Brocas HSS 6mm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><label className="text-xs font-medium">Cantidad</label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium">Unidad</label><Input value={uom} onChange={e => setUom(e.target.value)} /></div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Prioridad</label>
              <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(['Alta', 'Media', 'Baja'] as Priority[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-medium">Necesaria para</label><Input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Creando…' : 'Crear requisición'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
