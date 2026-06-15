import React, { useState } from 'react';
import {
  Settings,
  PlayCircle,
  AlertTriangle,
  Search,
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProductionStatusHeader } from '@/components/production/ProductionStatusHeader';
import { ProductionProjectView } from '@/components/production/ProductionProjectView';
import { MachineFormModal } from '@/components/production/MachineFormModal';
import { cn } from '@/lib/utils';
import { useMachines, useWorkOrders, useBomItems, useProjects } from '@/lib/api';
import { useDeleteMachine, useUpdateMachine, useUpdateWorkOrder } from '@/lib/api/production';
import type { Machine } from '@/types/database';
import { useNavigate } from 'react-router-dom';

const machineLeftColor: Record<string, string> = {
  Operando: 'border-l-[var(--color-app-success)]',
  Setup: 'border-l-[var(--color-app-warning)]',
  Mantenimiento: 'border-l-[var(--color-app-danger)]',
  Disponible: 'border-l-[var(--color-app-border-strong)]',
  Fuera_Servicio: 'border-l-[var(--color-app-danger)]',
};

const machineStatusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  Operando: 'success',
  Disponible: 'secondary',
  Setup: 'warning',
  Mantenimiento: 'destructive',
  Fuera_Servicio: 'destructive',
};

const statusBadgeVariant: Record<string, 'success' | 'default' | 'warning'> = {
  Completado: 'success',
  'En Proceso': 'default',
  Setup: 'warning',
};

const tabs = [
  { id: 'floor',    label: 'Piso de fábrica',     icon: LayoutDashboard },
  { id: 'planning', label: 'Planificación',        icon: ClipboardList },
  { id: 'status',   label: 'Estatus de proyectos', icon: BarChart3 },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Production() {
  const [activeTab, setActiveTab] = useState<Tab>('floor');
  const [searchTerm, setSearchTerm] = useState('');
  // Estado de proyecto y BOM compartido entre header y vista de planificación,
  // para que el scoreboard se actualice cuando se marca una pieza como terminada.
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { data: projects } = useProjects();
  const { data: bomItems, refetch: refetchBom } = useBomItems(selectedProjectId || undefined);

  React.useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      const inProd = projects.find(p => p.status === 'En Producción') ?? projects[0];
      setSelectedProjectId(inProd.id);
    }
  }, [projects, selectedProjectId]);
  const { data: machines, refetch: refetchMachines } = useMachines();
  const { data: workOrders, refetch: refetchWorkOrders } = useWorkOrders();
  const { remove: removeMachine } = useDeleteMachine();
  const { update: updateMachineStatus } = useUpdateMachine();
  const { update: updateWorkOrder } = useUpdateWorkOrder();
  const navigate = useNavigate();

  // Tras asignar un plan, refresca piezas + máquinas + órdenes para que el
  // piso muestre el estatus actualizado de cada equipo.
  const refetchFloor = async () => {
    await Promise.all([refetchBom(), refetchMachines(), refetchWorkOrders()]);
  };

  // Liberar una máquina: cierra su orden activa y la regresa a Disponible.
  const releaseMachine = async (machineId: string) => {
    const activeWO = workOrders.find(w => w.machine_id === machineId && w.status === 'En Proceso');
    try {
      if (activeWO) {
        await updateWorkOrder(activeWO.id, { status: 'Completado', actual_end: new Date().toISOString() });
      }
      await updateMachineStatus(machineId, { status: 'Disponible' });
      await Promise.all([refetchMachines(), refetchWorkOrders()]);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  // Alta / edición de máquinas
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  const openNewMachine = () => {
    setEditingMachine(null);
    setMachineModalOpen(true);
  };
  const openEditMachine = (m: Machine) => {
    setEditingMachine(m);
    setMachineModalOpen(true);
  };
  const handleDeleteMachine = async (m: Machine) => {
    if (!window.confirm(`¿Eliminar la máquina "${m.id}" del catálogo? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await removeMachine(m.id);
      refetchMachines();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Producción</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Monitoreo de piso, máquinas y órdenes de trabajo.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva orden de trabajo
        </Button>
      </div>

      <ProductionStatusHeader
        projects={projects}
        bomItems={bomItems}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
              activeTab === t.id
                ? 'bg-white text-[var(--color-app-text)] shadow-sm'
                : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'floor' && (
        <>
          {/* Catálogo de máquinas */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-app-text)]">
                Parque de máquinas
              </h2>
              <p className="text-xs text-[var(--color-app-text-muted)]">
                {machines.length} {machines.length === 1 ? 'equipo registrado' : 'equipos registrados'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openNewMachine}>
              <Plus className="h-4 w-4 mr-1.5" /> Nueva máquina
            </Button>
          </div>

          {/* Machine cards */}
          {machines.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <Settings className="h-8 w-8 mx-auto text-[var(--color-app-text-subtle)]" />
                <p className="text-sm font-medium">Sin máquinas registradas</p>
                <p className="text-xs text-[var(--color-app-text-muted)] max-w-md mx-auto">
                  Aún no hay máquinas dadas de alta en el catálogo. Cuando registres tu
                  parque de equipo aparecerán aquí con su estado en tiempo real (Operando,
                  Setup, Mantenimiento, etc.).
                </p>
                <Button size="sm" onClick={openNewMachine} className="mt-1">
                  <Plus className="h-4 w-4 mr-1.5" /> Dar de alta la primera máquina
                </Button>
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {machines.map(m => {
              const activeWO = workOrders.find(w => w.machine_id === m.id && w.status === 'En Proceso');
              const progress = activeWO ? Math.round((activeWO.completed_qty / activeWO.quantity) * 100) : 0;
              return (
                <Card
                  key={m.id}
                  className={cn('border-l-4 p-0', machineLeftColor[m.status])}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">{m.id}</CardTitle>
                    <div className="flex items-center gap-1">
                      {m.status === 'Operando' && <PlayCircle className="h-4 w-4 text-[var(--color-app-success)]" />}
                      {m.status === 'Setup' && <Settings className="h-4 w-4 text-[var(--color-app-warning)]" />}
                      {m.status === 'Mantenimiento' && <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />}
                      {m.status === 'Fuera_Servicio' && <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--color-app-text-subtle)] hover:bg-[var(--color-app-surface-alt)] hover:text-[var(--color-app-text)] transition-colors"
                            aria-label="Acciones de máquina"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditMachine(m)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteMachine(m)}
                            className="text-[var(--color-app-danger)] focus:text-[var(--color-app-danger)]"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-5">
                    <p className="text-xs text-[var(--color-app-text-muted)]">{m.type}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-app-text-muted)]">Estado</span>
                        <Badge variant={machineStatusVariant[m.status] ?? 'secondary'}>
                          {m.status === 'Fuera_Servicio' ? 'Fuera de servicio' : m.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-app-text-muted)]">Ubicación</span>
                        <span className="font-medium">{m.location ?? '—'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-[var(--color-app-border)]">
                      {activeWO ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-[var(--color-app-text)] font-medium truncate max-w-[150px]">
                              {bomItems.find(b => b.id === activeWO.bom_item_id)?.part_number ?? activeWO.id}
                            </span>
                            <span className="font-medium tabular-nums">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1" />
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-[10px] text-[var(--color-app-text-muted)] font-mono truncate max-w-[130px]">
                              {activeWO.project_id}
                            </span>
                            <button
                              onClick={() => releaseMachine(m.id)}
                              className="text-[10px] font-medium text-[var(--color-app-danger)] hover:underline"
                            >
                              Liberar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--color-app-text-muted)]">Sin orden activa</span>
                          {m.status === 'Operando' && (
                            <button
                              onClick={() => releaseMachine(m.id)}
                              className="text-[10px] font-medium text-[var(--color-app-danger)] hover:underline"
                            >
                              Liberar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}

          {/* Active work orders */}
          <Card className="p-0">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <CardTitle>Órdenes de trabajo activas</CardTitle>
                  <CardDescription>Monitoreo en tiempo real</CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                  <Input
                    placeholder="Buscar WO o ID de proyecto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {workOrders.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)] space-y-1">
                  <p className="font-medium text-[var(--color-app-text)]">
                    Sin órdenes de trabajo activas
                  </p>
                  <p className="text-xs">
                    Las órdenes se generan al confirmar el plan de producción en la pestaña{' '}
                    <strong>Planificación</strong> o desde el botón “Nueva orden de trabajo”.
                  </p>
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID orden</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Pieza</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders
                    .filter(wo =>
                      searchTerm
                        ? wo.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          wo.project_id.toLowerCase().includes(searchTerm.toLowerCase())
                        : true
                    )
                    .map(wo => (
                      <TableRow key={wo.id}>
                        <TableCell className="font-mono text-xs">{wo.id}</TableCell>
                        <TableCell className="font-mono text-xs">{wo.project_id}</TableCell>
                        <TableCell className="font-mono text-xs">{wo.bom_item_id}</TableCell>
                        <TableCell className="text-[var(--color-app-text-muted)]">{wo.machine_id ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant[wo.status] ?? 'secondary'}>{wo.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 w-36">
                            <Progress value={(wo.completed_qty / wo.quantity) * 100} className="h-1.5" />
                            <span className="text-xs text-[var(--color-app-text-muted)] tabular-nums">
                              {wo.completed_qty} / {wo.quantity}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/production/wo/${wo.id}`)}>
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'planning' && (
        <ProductionProjectView
          projects={projects}
          bomItems={bomItems}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onChanged={refetchFloor}
        />
      )}

      {activeTab === 'status' && (
        <Card>
          <CardHeader>
            <CardTitle>Reporte de estatus</CardTitle>
            <CardDescription>Selecciona un proyecto para ver el desglose detallado.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center border-t border-dashed border-[var(--color-app-border)]">
            <p className="text-sm text-[var(--color-app-text-muted)]">
              Selecciona un proyecto en el panel superior para desplegar el reporte.
            </p>
          </CardContent>
        </Card>
      )}

      <MachineFormModal
        open={machineModalOpen}
        onOpenChange={setMachineModalOpen}
        machine={editingMachine}
        onSaved={refetchMachines}
      />
    </div>
  );
}
