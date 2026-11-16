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
import { toLocalDate } from '@/lib/dates';
import { Chips, ProgressLine, Segmented, TONE, toneFor } from '@/components/kanri';
import { useAuth } from '@/contexts/AuthContext';
import { canSeeAmounts } from '@/lib/permissions';
import { cn } from '@/lib/utils';

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
  const date = toLocalDate(project.deadline);
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
  const { user } = useAuth();
  const showMoney = canSeeAmounts(user?.role, user?.isPlatformOwner);
  // Vista Tablero (por etapa) o Lista (tabla); se recuerda por navegador.
  const [view, setViewState] = useState<'board' | 'list'>(() => {
    try { return localStorage.getItem('kanri_projects_view') === 'list' ? 'list' : 'board'; } catch { return 'board'; }
  });
  const setView = (v: 'board' | 'list') => {
    setViewState(v);
    try { localStorage.setItem('kanri_projects_view', v); } catch { /* ignore */ }
  };

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

  // Búsqueda de texto aplicada también al tablero.
  const searched = React.useMemo(() => {
    const q = (globalFilter ?? '').trim().toLowerCase();
    return q ? projects.filter(p => `${p.id} ${p.name} ${p.client_name}`.toLowerCase().includes(q)) : projects;
  }, [projects, globalFilter]);
  const activeProjects = projects.filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado');
  const portfolio = activeProjects.reduce((s, p) => s + (p.quote_amount ?? 0), 0);

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
        const date = toLocalDate(info.getValue());
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
          <h1 className="page-title">Proyectos</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            {activeProjects.length} en curso
            {showMoney && portfolio > 0 && <> · {portfolio.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} en cartera</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-app-text)]" />
            <input
              placeholder="Buscar folio, pieza o cliente"
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="w-full h-[52px] pl-11 pr-4 rounded-full bg-[var(--color-app-surface-alt)] text-[15px] placeholder:text-[var(--color-app-text-muted)] outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-app-ink)] transition-colors"
            />
          </div>
          <Segmented<'board' | 'list'> value={view} onChange={setView} items={[{ id: 'board', label: 'Tablero' }, { id: 'list', label: 'Lista' }]} />
          <Button variant="outline" size="lg" onClick={() => setIsModalOpen(true)}>
            Crear rápido
          </Button>
          <Button size="lg" onClick={() => navigate('/projects/new')}>
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo proyecto
          </Button>
        </div>
      </div>

      {/* Chips por etapa (filtran tablero y lista) */}
      <Chips
        value={statusFilter || 'all'}
        onChange={v => setStatusFilter(v === 'all' ? '' : v)}
        items={[
          { id: 'all', label: 'Todos', count: searched.length },
          ...BOARD_STAGES.map(st => ({ id: st, label: stageLabel(st), count: searched.filter(p => p.status === st).length })),
          { id: 'Entregado', label: 'Entregados', count: searched.filter(p => p.status === 'Entregado').length },
        ]}
      />

      {view === 'board' && (
        <ProjectBoard
          projects={searched.filter(p => !clientFilter || p.client_name === clientFilter)}
          stages={statusFilter ? [statusFilter as ProjectStatus] : BOARD_STAGES}
          onOpen={id => navigate(`/projects/${id}`)}
        />
      )}

      {view === 'list' && <>
      <div className="flex flex-wrap items-center gap-3">

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
      </>}

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

const BOARD_STAGES: ProjectStatus[] = ['Cotización', 'Diseño', 'Compras', 'En Producción', 'Calidad', 'Embarque'];
const stageLabel = (s: string) => (s === 'En Producción' ? 'Producción' : s);

/** Tablero por etapa (rediseño): columnas con tarjetas de proyecto. */
function ProjectBoard({ projects, stages, onOpen }: { projects: Project[]; stages: ProjectStatus[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(196px, 1fr))` }}>
        {stages.map((st, ci) => {
          const cards = projects
            .filter(p => p.status === st)
            .sort((a, b) => toLocalDate(a.deadline).getTime() - toLocalDate(b.deadline).getTime());
          return (
            <section key={st} className="k-rise rounded-[26px] bg-[var(--color-app-surface-alt)] p-3 min-h-[420px] flex flex-col" style={{ ['--i' as string]: ci }}>
              <div className="flex items-center justify-between px-2 pt-2 pb-3">
                <span className="flex items-center gap-2 text-[16px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: TONE[toneFor(st)].fg }} />
                  {stageLabel(st)}
                </span>
                <span className="font-mono text-xs text-[var(--color-app-text-muted)]">{cards.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-[var(--color-app-text-subtle)]">Sin proyectos</p>}
                {cards.map(p => {
                  const days = Math.ceil((toLocalDate(p.deadline).getTime() - Date.now()) / 86_400_000);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onOpen(p.id)}
                      className="k-rise text-left rounded-[20px] bg-white p-4 flex flex-col gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(22,24,29,.08)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-[var(--color-app-text-muted)]">{p.id}</span>
                        <span className={cn('text-[11px] whitespace-nowrap', days < 0 || days <= 3 ? 'text-[#B91C1C]' : days <= 7 ? 'text-[#B45309]' : 'text-[var(--color-app-text-muted)]')}>
                          {days < 0 ? `vencido ${-days} d` : days === 0 ? 'hoy' : `en ${days} días`}
                        </span>
                      </div>
                      <div>
                        <p className="text-[16px] leading-snug">{p.name}</p>
                        <p className="text-[13px] text-[var(--color-app-text-muted)] mt-0.5 truncate">{p.client_name}</p>
                      </div>
                      <div className="flex items-center gap-2.5 mt-1">
                        <ProgressLine pct={p.progress} />
                        <span className="font-mono text-[11px] w-8 text-right">{p.progress}%</span>
                      </div>
                      <span className="text-[12px] text-[var(--color-app-text-muted)]">
                        Entrega {format(toLocalDate(p.deadline), 'd MMM', { locale: es })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
