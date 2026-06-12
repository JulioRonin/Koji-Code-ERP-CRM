import React, { useEffect, useState } from 'react';
import {
  Search,
  Wrench,
  Play,
  Pause,
  CheckSquare,
  ChevronRight,
  Activity,
  Eye,
  FileText,
  X,
  Layers,
  FileCode2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useTechnicians, useWorkOrders, useMachines } from '@/lib/api';
import type { Profile, WorkOrder } from '@/types/database';
import { cn } from '@/lib/utils';

// Re-export para no romper imports en otros archivos
// (algunos módulos siguen referenciando mockTechnicians de aquí)
export const mockTechnicians: Profile[] = [];

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const statusBadge: Record<string, 'default' | 'secondary' | 'warning' | 'success'> = {
  'En Proceso': 'default',
  Pendiente: 'secondary',
  Pausado: 'warning',
  Completado: 'success',
  Setup: 'warning',
  Calidad: 'default',
  Cancelado: 'secondary',
};

export function Technicians() {
  const navigate = useNavigate();
  const { data: technicians } = useTechnicians();
  const { data: allWorkOrders } = useWorkOrders();
  const { data: machines } = useMachines();

  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<WorkOrder | null>(null);

  // Selecciona el primer técnico cuando cargan
  useEffect(() => {
    if (technicians.length > 0 && !selectedTechId) {
      setSelectedTechId(technicians[0].id);
    }
  }, [technicians, selectedTechId]);

  const selectedTech = technicians.find(t => t.id === selectedTechId);
  const techTasks = allWorkOrders.filter(t => t.assigned_technician_id === selectedTechId);

  const filteredTechnicians = technicians.filter(
    t =>
      t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const machineFor = (wo: WorkOrder) => machines.find(m => m.id === wo.machine_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center gap-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Técnicos</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Control de personal, maquinaria asignada y órdenes de trabajo.
          </p>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder="Buscar técnico..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Technicians list */}
        <Card className="lg:col-span-1 p-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Personal activo</CardTitle>
          </CardHeader>
          <CardContent className="p-2 max-h-[600px] overflow-y-auto">
            {filteredTechnicians.length === 0 && (
              <p className="text-sm text-[var(--color-app-text-muted)] p-3 text-center">
                No hay técnicos registrados.
              </p>
            )}
            <div className="space-y-1">
              {filteredTechnicians.map(tech => (
                <button
                  key={tech.id}
                  onClick={() => setSelectedTechId(tech.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-md border transition-colors flex items-center gap-3',
                    selectedTechId === tech.id
                      ? 'bg-[var(--color-app-primary-soft)] border-[var(--color-app-primary)]/30'
                      : 'border-transparent hover:bg-[var(--color-app-surface-alt)]'
                  )}
                >
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center font-medium text-sm shrink-0',
                      selectedTechId === tech.id
                        ? 'bg-[var(--color-app-primary)] text-white'
                        : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]'
                    )}
                  >
                    {initialsFor(tech.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{tech.full_name}</h3>
                    <p className="text-xs text-[var(--color-app-text-muted)] truncate flex items-center gap-1 mt-0.5">
                      <Wrench className="h-3 w-3" /> {tech.role}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--color-app-text-subtle)]" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Technician details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTech && (
            <Card>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-xl font-medium">
                      {initialsFor(selectedTech.full_name)}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">{selectedTech.full_name}</h2>
                      <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">{selectedTech.role}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-1 flex items-center gap-1">
                        <Wrench className="h-3 w-3" /> {selectedTech.metadata.shift ?? 'Sin turno asignado'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--color-app-text-muted)] mb-1">Eficiencia</div>
                    <div className="text-2xl font-semibold">{selectedTech.metadata.efficiency ?? 90}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                Órdenes asignadas
              </CardTitle>
              <Badge variant="outline">{techTasks.length} órdenes</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--color-app-border)]">
                {techTasks.length === 0 ? (
                  <p className="text-center text-[var(--color-app-text-muted)] py-8 text-sm">
                    No hay órdenes asignadas a este técnico.
                  </p>
                ) : (
                  techTasks.map(task => {
                    const progress = task.quantity > 0
                      ? Math.round((task.completed_qty / task.quantity) * 100)
                      : 0;
                    return (
                      <div key={task.id} className="p-4 hover:bg-[var(--color-app-surface-alt)]/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs text-[var(--color-app-text-muted)]">{task.id}</p>
                            <p className="font-medium mt-0.5">
                              {task.completed_qty}/{task.quantity} pzas
                            </p>
                            <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5 font-mono">
                              {task.project_id}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-2 min-w-[180px]">
                            <Badge variant={statusBadge[task.status] ?? 'secondary'}>{task.status}</Badge>
                            <div className="w-32 flex items-center gap-2">
                              <Progress value={progress} className="h-1.5" />
                              <span className="text-xs tabular-nums text-[var(--color-app-text-muted)] w-9 text-right">
                                {progress}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Detalles de la WO"
                                onClick={() => setSelectedTaskDetails(task)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/production/wo/${task.id}`)}
                              >
                                Etapas
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task details modal */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl p-0">
            <div className="p-5 border-b border-[var(--color-app-border)] flex justify-between items-center">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                Detalles de orden · {selectedTaskDetails.id}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedTaskDetails(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md bg-[var(--color-app-surface-alt)] p-4">
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-1.5">
                    <Layers className="h-3.5 w-3.5" /> Proyecto asociado
                  </p>
                  <p className="font-medium font-mono">{selectedTaskDetails.project_id}</p>
                </div>
                <div className="rounded-md bg-[var(--color-app-surface-alt)] p-4">
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-1.5">
                    <Activity className="h-3.5 w-3.5" /> Estado / progreso
                  </p>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusBadge[selectedTaskDetails.status] ?? 'secondary'}>
                      {selectedTaskDetails.status}
                    </Badge>
                    <span className="text-sm tabular-nums">
                      {selectedTaskDetails.completed_qty}/{selectedTaskDetails.quantity}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-[var(--color-app-surface-alt)] p-4">
                <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-3">
                  <Wrench className="h-3.5 w-3.5" /> Equipo asignado
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[var(--color-app-text-muted)]">Máquina</p>
                    <p className="font-medium mt-0.5">{machineFor(selectedTaskDetails)?.id ?? '—'}</p>
                    <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                      {machineFor(selectedTaskDetails)?.type ?? ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-app-text-muted)]">Prioridad</p>
                    <p className="font-medium mt-0.5">{selectedTaskDetails.priority}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedTaskDetails(null)}>
                  Cerrar
                </Button>
                <Button onClick={() => navigate(`/production/wo/${selectedTaskDetails.id}`)}>
                  Ver etapas y time tracking
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
