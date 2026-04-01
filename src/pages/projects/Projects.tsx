import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Clock
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { ProjectFormModal } from './ProjectFormModal';
import { useChat } from '@/contexts/ChatContext';

// Mock Data
type Project = {
  id: string;
  name: string;
  client: string;
  status: 'Cotización' | 'Diseño' | 'En Producción' | 'Calidad' | 'Entregado';
  progress: number;
  startDate: string;
  deadline: string;
  manager: string;
};

const mockProjects: Project[] = [
  { id: 'IMC-2026-042', name: 'Eje Principal Ensamblaje', client: 'BRP', status: 'En Producción', progress: 75, startDate: '2026-03-01', deadline: '2026-04-15', manager: 'Carlos M.' },
  { id: 'IMC-2026-045', name: 'Moldes de Inyección', client: 'Foxconn', status: 'Diseño', progress: 20, startDate: '2026-03-15', deadline: '2026-04-20', manager: 'Ana G.' },
  { id: 'IMC-2026-048', name: 'Soportes Estructurales', client: 'Aptiv', status: 'Cotización', progress: 10, startDate: '2026-03-25', deadline: '2026-04-05', manager: 'Luis R.' },
  { id: 'IMC-2026-039', name: 'Carcasas de Aluminio', client: 'Bosch', status: 'Calidad', progress: 95, startDate: '2026-02-10', deadline: '2026-03-30', manager: 'Carlos M.' },
  { id: 'IMC-2026-035', name: 'Prototipo Motor', client: 'BRP', status: 'Entregado', progress: 100, startDate: '2026-01-15', deadline: '2026-03-10', manager: 'Ana G.' },
  { id: 'IMC-2026-050', name: 'Herramentales Varios', client: 'Lear', status: 'Cotización', progress: 5, startDate: '2026-03-28', deadline: '2026-05-10', manager: 'Luis R.' },
];

const columnHelper = createColumnHelper<Project>();

export function Projects() {
  const { sendSystemMessage } = useChat();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [data, setData] = useState(() => [...mockProjects]);

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID Proyecto',
      cell: info => <span className="font-mono font-medium text-[var(--color-neon-cyan)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 h-8 data-[state=open]:bg-[var(--color-neon-cyan-dim)]/20 font-mono text-[var(--color-neon-cyan)] hover:text-[var(--color-neon-cyan)]"
          >
            Nombre
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: info => <span className="font-medium text-[var(--color-text-main)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor('client', {
      header: 'Cliente',
      cell: info => <span className="text-[var(--color-text-main)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: info => {
        const status = info.getValue();
        return (
          <Badge variant={
            status === 'En Producción' ? 'default' :
            status === 'Diseño' ? 'secondary' :
            status === 'Calidad' ? 'success' : 
            status === 'Entregado' ? 'outline' : 'warning'
          }>
            {status}
          </Badge>
        );
      },
    }),
    columnHelper.accessor('progress', {
      header: 'Progreso',
      cell: info => (
        <div className="flex items-center gap-2 w-full max-w-[120px]">
          <Progress value={info.getValue()} className="h-2" />
          <span className="text-xs font-mono text-[var(--color-text-muted)] w-8">{info.getValue()}%</span>
        </div>
      ),
    }),
    columnHelper.accessor('deadline', {
      header: 'Entrega',
      cell: info => {
        const date = new Date(info.getValue());
        return (
          <div className="flex items-center font-mono text-[var(--color-text-muted)]">
            <Calendar className="mr-2 h-4 w-4 text-[var(--color-neon-cyan)]" />
            {isValid(date) ? format(date, 'dd MMM yyyy', { locale: es }) : 'N/A'}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => {
        const project = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-[var(--color-neon-cyan)] hover:text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan-dim)]/20">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[var(--color-cyber-panel)] border-[var(--color-neon-cyan-dim)] text-[var(--color-text-main)]">
              <DropdownMenuLabel className="text-[var(--color-neon-cyan)] font-mono uppercase tracking-wider text-xs">Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(project.id)} className="hover:bg-[var(--color-neon-cyan-dim)]/20 focus:bg-[var(--color-neon-cyan-dim)]/20 cursor-pointer">
                Copiar ID
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--color-neon-cyan-dim)]" />
              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)} className="hover:bg-[var(--color-neon-cyan-dim)]/20 focus:bg-[var(--color-neon-cyan-dim)]/20 cursor-pointer">
                Ver Detalles
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-[var(--color-neon-cyan-dim)]/20 focus:bg-[var(--color-neon-cyan-dim)]/20 cursor-pointer">Editar Proyecto</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];

  const table = useReactTable({
    data,
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

  const handleCreateProject = (newProject: any) => {
    const nextId = `IMC-${new Date().getFullYear()}-${String(data.length + 1).padStart(3, '0')}`;
    const project: Project = {
      id: nextId,
      name: newProject.name,
      client: newProject.client,
      status: 'Cotización',
      progress: 0,
      startDate: isValid(newProject.startDate) ? format(newProject.startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      deadline: isValid(newProject.deadline) ? format(newProject.deadline, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      manager: newProject.manager,
    };
    setData([project, ...data]);
    setIsModalOpen(false);
    
    // Notification
    sendSystemMessage('2', `🚀 NUEVO PROYECTO REGISTRADO: [${project.id}] ${project.name} para el cliente ${project.client}. Responsable: ${project.manager}.`, 'PROJECT');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-widest text-[var(--color-neon-cyan)] uppercase drop-shadow-[0_0_8px_var(--color-neon-cyan)]">Gestión de Proyectos</h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] uppercase tracking-wider">Administra órdenes de trabajo, cotizaciones y seguimiento de producción.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Proyecto
        </Button>
      </div>

      <div className="flex items-center py-4">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-neon-cyan)]" />
          <Input
            placeholder="Buscar proyectos..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-9 bg-[var(--color-cyber-panel)] border-[var(--color-neon-cyan-dim)] text-[var(--color-text-main)] focus-visible:ring-[var(--color-neon-cyan)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      </div>

      <div className="rounded-md border border-[var(--color-neon-cyan-dim)] bg-[var(--color-cyber-panel)] shadow-[0_0_15px_var(--color-neon-cyan-dim)] overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center font-mono text-[var(--color-text-muted)]">
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
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
      </div>

      <ProjectFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateProject}
      />
    </div>
  );
}
