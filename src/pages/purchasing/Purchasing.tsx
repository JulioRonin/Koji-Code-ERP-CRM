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
import { cn } from '@/lib/utils';

type Requisition = {
  id: string;
  project: string;
  description: string;
  requester: string;
  date: string;
  status: 'Pendiente' | 'Cotizando' | 'Aprobada' | 'Rechazada' | 'Ordenada';
  priority: 'Alta' | 'Media' | 'Baja';
};

const mockRequisitions: Requisition[] = [
  { id: 'REQ-2026-101', project: 'IMC-2026-042', description: 'Acero 4140 (20 barras)', requester: 'Carlos M.', date: '2026-03-28', status: 'Pendiente', priority: 'Alta' },
  { id: 'REQ-2026-102', project: 'IMC-2026-045', description: 'Insertos de carburo', requester: 'Ana G.', date: '2026-03-27', status: 'Cotizando', priority: 'Media' },
  { id: 'REQ-2026-103', project: 'IMC-2026-039', description: 'Aluminio 6061 T6', requester: 'Luis R.', date: '2026-03-25', status: 'Aprobada', priority: 'Alta' },
  { id: 'REQ-2026-104', project: 'Mantenimiento', description: 'Aceite soluble (2 tambos)', requester: 'Pedro S.', date: '2026-03-24', status: 'Ordenada', priority: 'Media' },
  { id: 'REQ-2026-105', project: 'IMC-2026-048', description: 'Tornillería especial', requester: 'Carlos M.', date: '2026-03-22', status: 'Rechazada', priority: 'Baja' },
];

const priorityVariant: Record<Requisition['priority'], 'destructive' | 'warning' | 'secondary'> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

const statusVariant: Record<Requisition['status'], 'secondary' | 'warning' | 'success' | 'default' | 'destructive'> = {
  Pendiente: 'secondary',
  Cotizando: 'warning',
  Aprobada: 'success',
  Ordenada: 'default',
  Rechazada: 'destructive',
};

const columnHelper = createColumnHelper<Requisition>();

const tabs = [
  { id: 'requisitions', label: 'Requisiciones' },
  { id: 'bom',          label: 'BOM / Listas' },
  { id: 'pos',          label: 'Órdenes de compra' },
  { id: 'suppliers',    label: 'Proveedores' },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Purchasing() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('requisitions');

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID req.',
      cell: info => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('project', {
      header: 'Proyecto',
      cell: info => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('description', {
      header: 'Descripción',
      cell: info => <span>{info.getValue()}</span>,
    }),
    columnHelper.accessor('requester', {
      header: 'Solicitante',
      cell: info => <span className="text-[var(--color-app-text-muted)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor('date', {
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
    data: mockRequisitions,
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

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Req. pendientes', value: '12', sub: 'Requieren cotización', icon: AlertCircle },
          { label: 'Órdenes activas',  value: '8',  sub: 'En tránsito o espera', icon: ShoppingCart },
          { label: 'Gasto mensual',    value: '$45,230', sub: '+12% vs mes anterior', icon: DollarSign },
          { label: 'Proveedores',      value: '34', sub: 'Evaluados este año', icon: FileText },
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
      {activeTab === 'requisitions' && (
        <div className="space-y-4">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
            <Input
              placeholder="Buscar requisiciones..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
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

      {activeTab === 'pos' && (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-[var(--color-app-text-muted)]" />
            </div>
            <h3 className="text-base font-medium">Órdenes de compra</h3>
            <p className="text-sm text-[var(--color-app-text-muted)] max-w-sm">
              Las órdenes de compra se generan automáticamente tras aprobar requisiciones o requerimientos de BOM.
            </p>
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear PO manual
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'suppliers' && (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center">
              <FileText className="h-5 w-5 text-[var(--color-app-text-muted)]" />
            </div>
            <h3 className="text-base font-medium">Directorio de proveedores</h3>
            <p className="text-sm text-[var(--color-app-text-muted)] max-w-sm">
              Gestiona tu red de proveedores certificados y monitorea el cumplimiento de entregas.
            </p>
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Añadir proveedor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
