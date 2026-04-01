import React, { useState } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState
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
  Package
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

// Mock Data
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

const columnHelper = createColumnHelper<Requisition>();

export function Purchasing() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'requisitions' | 'pos' | 'suppliers' | 'bom'>('requisitions');

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID Req.',
      cell: info => <span className="font-medium text-cyber-neon font-cyber">{info.getValue()}</span>,
    }),
    columnHelper.accessor('project', {
      header: 'Proyecto',
      cell: info => <span className="font-medium text-cyber-text">{info.getValue()}</span>,
    }),
    columnHelper.accessor('description', {
      header: 'Descripción',
      cell: info => <span className="text-cyber-muted">{info.getValue()}</span>,
    }),
    columnHelper.accessor('requester', {
      header: 'Solicitante',
      cell: info => <span className="text-cyber-text">{info.getValue()}</span>,
    }),
    columnHelper.accessor('date', {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 data-[state=open]:bg-cyber-dark/50 hover:bg-cyber-dark/50 hover:text-cyber-neon text-cyber-muted font-cyber"
          >
            Fecha
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: info => {
        const date = new Date(info.getValue());
        return (
          <div className="flex items-center text-cyber-muted font-cyber text-sm">
            <Calendar className="mr-2 h-4 w-4 text-cyber-accent" />
            {format(date, 'dd MMM yyyy', { locale: es })}
          </div>
        );
      },
    }),
    columnHelper.accessor('priority', {
      header: 'Prioridad',
      cell: info => {
        const priority = info.getValue();
        return (
          <Badge variant={
            priority === 'Alta' ? 'destructive' :
            priority === 'Media' ? 'warning' : 'secondary'
          }>
            {priority}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: info => {
        const status = info.getValue();
        return (
          <Badge variant={
            status === 'Pendiente' ? 'secondary' :
            status === 'Cotizando' ? 'warning' :
            status === 'Aprobada' ? 'success' : 
            status === 'Ordenada' ? 'default' : 'destructive'
          }>
            {status}
          </Badge>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => {
        const req = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-cyber-dark/50 hover:text-cyber-neon text-cyber-muted">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-cyber-panel border-cyber-border text-cyber-text">
              <DropdownMenuLabel className="text-cyber-muted font-cyber">Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(req.id)} className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer">
                Copiar ID
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-cyber-border" />
              <DropdownMenuItem className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer">Ver Detalles</DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer text-cyber-accent">Cotizar con IA</DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer">Generar PO</DropdownMenuItem>
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
    state: {
      sorting,
      globalFilter,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-neon font-cyber uppercase tracking-widest drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">Gestión de Compras</h1>
          <p className="text-sm text-cyber-muted font-cyber tracking-wider">Administra requisiciones, órdenes de compra y proveedores.</p>
        </div>
        <Button className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber font-bold tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.3)]">
          <Plus className="mr-2 h-4 w-4" /> Nueva Requisición
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-cyber-dark/10 backdrop-blur-sm border-cyber-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-wider">Req. Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-cyber-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-neon font-cyber">12</div>
            <p className="text-xs text-cyber-muted uppercase font-cyber tracking-tight">Requieren cotización</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-dark/10 backdrop-blur-sm border-cyber-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-wider">Órdenes Activas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-cyber-neon" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-neon font-cyber">8</div>
            <p className="text-xs text-cyber-muted uppercase font-cyber tracking-tight">En tránsito o espera</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-dark/10 backdrop-blur-sm border-cyber-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-wider">Gasto Mensual</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-neon font-cyber">$45,230</div>
            <p className="text-xs text-cyber-muted uppercase font-cyber tracking-tight">+12% vs mes anterior</p>
          </CardContent>
        </Card>
        <Card className="bg-cyber-dark/10 backdrop-blur-sm border-cyber-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-wider">Proveedores Activos</CardTitle>
            <FileText className="h-4 w-4 text-cyber-purple" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-neon font-cyber">34</div>
            <p className="text-xs text-cyber-muted uppercase font-cyber tracking-tight">Evaluados este año</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs (Simple State) */}
      <div className="flex space-x-1 border-b border-cyber-border">
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 font-cyber uppercase tracking-widest ${
            activeTab === 'requisitions' 
              ? 'border-cyber-neon text-cyber-neon shadow-[0_4px_10px_-5px_rgba(6,182,212,0.5)]' 
              : 'border-transparent text-cyber-muted hover:text-cyber-neon hover:border-cyber-border/50'
          }`}
        >
          Requisiciones
        </button>
        <button
          onClick={() => setActiveTab('bom')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 font-cyber uppercase tracking-widest ${
            activeTab === 'bom' 
              ? 'border-cyber-neon text-cyber-neon shadow-[0_4px_10px_-5px_rgba(6,182,212,0.5)]' 
              : 'border-transparent text-cyber-muted hover:text-cyber-neon hover:border-cyber-border/50'
          }`}
        >
          BOM / Listas
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 font-cyber uppercase tracking-widest ${
            activeTab === 'pos' 
              ? 'border-cyber-neon text-cyber-neon shadow-[0_4px_10px_-5px_rgba(6,182,212,0.5)]' 
              : 'border-transparent text-cyber-muted hover:text-cyber-neon hover:border-cyber-border/50'
          }`}
        >
          Órdenes de Compra (PO)
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 font-cyber uppercase tracking-widest ${
            activeTab === 'suppliers' 
              ? 'border-cyber-neon text-cyber-neon shadow-[0_4px_10px_-5px_rgba(6,182,212,0.5)]' 
              : 'border-transparent text-cyber-muted hover:text-cyber-neon hover:border-cyber-border/50'
          }`}
        >
          Proveedores
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'requisitions' && (
        <div className="space-y-4">
          <div className="flex items-center py-2">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
              <Input
                placeholder="Buscar requisiciones..."
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-9 bg-cyber-dark/50 border-cyber-border text-cyber-text font-cyber"
              />
            </div>
          </div>

          <div className="rounded-md border border-cyber-border bg-cyber-panel shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-cyber-border hover:bg-white/5">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} className="text-cyber-muted font-cyber uppercase text-[10px] tracking-thinner">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="border-cyber-border hover:bg-white/5"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="text-cyber-text py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-cyber-muted uppercase font-cyber italic">
                      No se encontraron resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="border-cyber-border text-cyber-neon hover:bg-cyber-neon/10 uppercase font-cyber text-xs p-2.5"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="border-cyber-border text-cyber-neon hover:bg-cyber-neon/10 uppercase font-cyber text-xs p-2.5"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'bom' && (
        <BOMManager />
      )}

      {activeTab === 'pos' && (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-cyber-border/30 rounded-lg bg-cyber-panel/50">
          <ShoppingCart className="h-12 w-12 text-cyber-muted mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-cyber-neon font-cyber uppercase tracking-widest">Órdenes de Compra</h3>
          <p className="text-sm text-cyber-muted max-w-sm mt-3 font-cyber">
            Las órdenes de compra se generan automáticamente tras la aprobación de requisiciones o requerimientos de BOM.
          </p>
          <Button className="mt-6 border-cyber-neon text-cyber-neon hover:bg-cyber-neon/10 font-cyber uppercase tracking-widest" variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Crear PO Manual
          </Button>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-cyber-border/30 rounded-lg bg-cyber-panel/50">
          <FileText className="h-12 w-12 text-cyber-muted mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-cyber-neon font-cyber uppercase tracking-widest">Directorio de Proveedores</h3>
          <p className="text-sm text-cyber-muted max-w-sm mt-3 font-cyber">
            Gestiona tu red de proveedores certificados y monitorea el cumplimiento de entregas.
          </p>
          <Button className="mt-6 border-cyber-neon text-cyber-neon hover:bg-cyber-neon/10 font-cyber uppercase tracking-widest" variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Añadir Proveedor
          </Button>
        </div>
      )}
    </div>
  );
}
