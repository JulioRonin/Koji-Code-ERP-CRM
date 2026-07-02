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
  SortingState,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  MoreHorizontal,
  ArrowUpDown,
  Calendar,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
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
import { useProjects, useCreateProject, useDeleteProject } from '@/lib/api';
import type { Project, ProjectStatus } from '@/types/database';

const statusVariant: Record<ProjectStatus, 'default' | 'secondary' | 'success' | 'outline' | 'warning'> = {
  'En Producción': 'default',
  'Diseño':         'secondary',
  'Compras':        'secondary',
  'Calidad':        'success',
  'Embarque':       'success',
  'Entregado':      'outline',
  'Cotización':     'warning',
  'Cancelado':      'outline',
};

const columnHelper = createColumnHelper<Project>();

/** Fila de proyecto reutilizable (usada en la vista agrupada). */
function ProjectRow({ project, onOpen, onDelete }: { project: Project; onOpen: () => void; onDelete: () => void }) {
  const date = new Date(project.deadline);
  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="font-mono text-xs text-[var(--color-app-text-muted)]">{project.id}</TableCell>
      <TableCell className="font-medium">{project.name}</TableCell>
      <TableCell className="text-[var(--color-app-text-muted)]">{project.client_name}</TableCell>
      <TableCell><Badge variant={statusVariant[project.status]}>{project.status}</Badge></TableCell>
      <TableCell>
        <div className="flex items-center gap-2 w-32">
          <Progress value={project.progress} className="h-1.5" />
          <span className="text-xs text-[var(--color-app-text-muted)] tabular-nums w-9 text-right">{project.progress}%</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm text-[var(--color-app-text-muted)]">
          <Calendar className="h-3.5 w-3.5" />
          {isValid(date) ? format(date, 'dd MMM yyyy', { locale: es }) : 'N/A'}
        </div>
      </TableCell>
      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Ver detalles</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(project.id)}>Copiar ID</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-[var(--color-app-danger)] focus:text-[var(--color-app-danger)] gap-2">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar proyecto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function Projects() {
  const { sendSystemMessage } = useChat();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: projects, loading, refetch } = useProjects();
  const { create: createProject } = useCreateProject();
  const { remove: deleteProject, loading: deleting } = useDeleteProject();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'' | 'status' | 'client_name'>('');

  // Clientes únicos presentes en los proyectos (para el filtro).
  const clientOptions = React.useMemo(
    () => Array.from(new Set(projects.map(p => p.client_name).filter(Boolean))).sort(),
    [projects]
  );

  // Aplica los filtros de estatus y cliente antes de la tabla (la búsqueda por
  // texto la maneja el globalFilter de la tabla).
  const data = React.useMemo(
    () => projects.filter(p =>
      (!statusFilter || p.status === statusFilter) &&
      (!clientFilter || p.client_name === clientFilter)
    ),
    [projects, statusFilter, clientFilter]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteProject(deleteTarget.id);
      await refetch();
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  };

  const columns = [
    columnHelper.accessor('id', {
      header: 'ID',
      cell: info => <span className="font-mono text-xs text-[var(--color-app-text-muted)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor('name', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-3 h-8"
        >
          Nombre <ArrowUpDown className="ml-1.5 h-3 w-3" />
        </Button>
      ),
      cell: info => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('client_name', {
      header: 'Cliente',
      cell: info => <span className="text-[var(--color-app-text-muted)]">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Estado',
      cell: info => <Badge variant={statusVariant[info.getValue()]}>{info.getValue()}</Badge>,
    }),
    columnHelper.accessor('progress', {
      header: 'Progreso',
      cell: info => (
        <div className="flex items-center gap-2 w-32">
          <Progress value={info.getValue()} className="h-1.5" />
          <span className="text-xs text-[var(--color-app-text-muted)] tabular-nums w-9 text-right">{info.getValue()}%</span>
        </div>
      ),
    }),
    columnHelper.accessor('deadline', {
      header: 'Entrega',
      cell: info => {
        const date = new Date(info.getValue());
        return (
          <div className="flex items-center gap-2 text-sm text-[var(--color-app-text-muted)]">
            <Calendar className="h-3.5 w-3.5" />
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
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(project.id)}>
                Copiar ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                Ver detalles
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/projects/${project.id}?wizard=1`)}
              >
                Generar master plan
              </DropdownMenuItem>
              <DropdownMenuItem>Editar proyecto</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(project)}
                className="text-[var(--color-app-danger)] focus:text-[var(--color-app-danger)] gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar proyecto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];

  // Grupos para la vista agrupada (respeta la búsqueda por texto + filtros).
  const groups = React.useMemo(() => {
    if (!groupBy) return [];
    const q = (globalFilter ?? '').trim().toLowerCase();
    const filtered = q
      ? data.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.client_name ?? '').toLowerCase().includes(q))
      : data;
    const map = new Map<string, Project[]>();
    filtered.forEach(p => {
      const key = (groupBy === 'status' ? p.status : p.client_name) || '—';
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    });
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [groupBy, data, globalFilter]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
  });

  const handleCreateProject = async (newProject: any) => {
    const startDate = isValid(newProject.startDate)
      ? format(newProject.startDate, 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');
    const deadline = isValid(newProject.deadline)
      ? format(newProject.deadline, 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd');

    const project = await createProject({
      name: newProject.name,
      client_name: newProject.client,
      customer_id: newProject.customerId || null,
      manager_id: null,
      description: newProject.description ?? null,
      start_date: startDate,
      deadline,
    });
    await refetch();
    setIsModalOpen(false);

    sendSystemMessage(
      '2',
      `🚀 Nuevo proyecto registrado: [${project.id}] ${project.name} para ${project.client_name}. Responsable: ${newProject.manager}.`,
      'PROJECT'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Proyectos</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Administra órdenes de trabajo, cotizaciones y seguimiento de producción.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            Crear rápido
          </Button>
          <Button onClick={() => navigate('/projects/new')}>
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo proyecto
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder="Buscar proyectos..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(statusVariant) as ProjectStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 max-w-[220px]"
        >
          <option value="">Todos los clientes</option>
          {clientOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value as typeof groupBy)}
          className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
          title="Agrupar proyectos"
        >
          <option value="">Sin agrupar</option>
          <option value="status">Agrupar por estado</option>
          <option value="client_name">Agrupar por cliente</option>
        </select>

        {(statusFilter || clientFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => { setStatusFilter(''); setClientFilter(''); }}
          >
            Limpiar filtros
          </Button>
        )}

        <span className="text-xs text-[var(--color-app-text-muted)] ml-auto">
          {data.length} de {projects.length} proyecto{projects.length === 1 ? '' : 's'}
        </span>
      </div>

      {groupBy ? (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2">
                {groupBy === 'status'
                  ? <Badge variant={statusVariant[group.key as ProjectStatus] ?? 'secondary'}>{group.key}</Badge>
                  : <span className="text-sm font-semibold">{group.key}</span>}
                <span className="text-xs text-[var(--color-app-text-muted)]">({group.items.length})</span>
              </div>
              <Card className="p-0">
                <Table>
                  <TableBody>
                    {group.items.map(p => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        onOpen={() => navigate(`/projects/${p.id}`)}
                        onDelete={() => setDeleteTarget(p)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ))}
          {groups.length === 0 && (
            <Card className="p-0">
              <div className="h-24 flex items-center justify-center text-sm text-[var(--color-app-text-muted)]">
                No se encontraron resultados.
              </div>
            </Card>
          )}
        </div>
      ) : (
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/projects/${row.original.id}`)}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} onClick={cell.column.id === 'actions' ? e => e.stopPropagation() : undefined}>
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
      )}

      {!groupBy && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Siguiente
          </Button>
        </div>
      )}

      <ProjectFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      {/* Dialog de confirmación de borrado */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--color-app-danger)]" />
              Eliminar proyecto
            </DialogTitle>
            <DialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminará todo el contenido del
              proyecto: BOM, work orders, inspecciones, NCRs, embarques, master plan, juntas y
              reportes PMO asociados.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="p-3 rounded-md bg-[var(--color-app-surface-alt)] text-sm">
              <p className="font-medium">{deleteTarget.name}</p>
              <p className="text-xs text-[var(--color-app-text-muted)] font-mono mt-0.5">
                {deleteTarget.id} · {deleteTarget.client_name}
              </p>
            </div>
          )}

          {deleteError && (
            <div className="p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
