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
import { ProductionStatusHeader } from '@/components/production/ProductionStatusHeader';
import { ProductionProjectView } from '@/components/production/ProductionProjectView';
import { cn } from '@/lib/utils';
import { useMachines, useWorkOrders, useBomItems, useProjects } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

const machineLeftColor: Record<string, string> = {
  Operando: 'border-l-[var(--color-app-success)]',
  Setup: 'border-l-[var(--color-app-warning)]',
  Mantenimiento: 'border-l-[var(--color-app-danger)]',
  Disponible: 'border-l-[var(--color-app-border-strong)]',
  Fuera_Servicio: 'border-l-[var(--color-app-danger)]',
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
  const { data: machines } = useMachines();
  const { data: workOrders } = useWorkOrders();
  const navigate = useNavigate();

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
          {/* Machine cards */}
          {machines.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-2">
                <Settings className="h-8 w-8 mx-auto text-[var(--color-app-text-subtle)]" />
                <p className="text-sm font-medium">Sin máquinas registradas</p>
                <p className="text-xs text-[var(--color-app-text-muted)] max-w-md mx-auto">
                  Aún no hay máquinas dadas de alta en el catálogo. Cuando registres tu
                  parque de equipo aparecerán aquí con su estado en tiempo real (Operando,
                  Setup, Mantenimiento, etc.).
                </p>
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
                    {m.status === 'Operando' && <PlayCircle className="h-4 w-4 text-[var(--color-app-success)]" />}
                    {m.status === 'Setup' && <Settings className="h-4 w-4 text-[var(--color-app-warning)]" />}
                    {m.status === 'Mantenimiento' && <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />}
                    {m.status === 'Fuera_Servicio' && <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />}
                  </CardHeader>
                  <CardContent className="space-y-3 pb-5">
                    <p className="text-xs text-[var(--color-app-text-muted)]">{m.type}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-app-text-muted)]">Estado</span>
                        <span className="font-medium">{m.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-app-text-muted)]">Ubicación</span>
                        <span className="font-medium">{m.location ?? '—'}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-3 border-t border-[var(--color-app-border)]">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--color-app-text-muted)] truncate max-w-[140px]">
                          {activeWO ? activeWO.id : 'Sin orden activa'}
                        </span>
                        <span className="font-medium tabular-nums">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1" />
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
          onChanged={refetchBom}
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
    </div>
  );
}
