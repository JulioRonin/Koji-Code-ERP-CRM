import React, { useState } from 'react';
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
import { cn } from '@/lib/utils';

export const mockTechnicians = [
  { id: 'T-001', name: 'Alex Vance',      role: 'Operador CNC Senior',     machine: 'CNC-001 (Fresadora 5 ejes)', status: 'Activo',  avatar: 'AV', efficiency: 94 },
  { id: 'T-002', name: 'Sarah Connor',    role: 'Especialista Impresión 3D', machine: '3D-PRT-04',                  status: 'Activo',  avatar: 'SC', efficiency: 88 },
  { id: 'T-003', name: 'David Martinez',  role: 'Técnico de Ensamblaje',   machine: 'Estación ENS-02',            status: 'Pausado', avatar: 'DM', efficiency: 76 },
  { id: 'T-004', name: 'Elena Rosas',     role: 'Operador Torno CNC',       machine: 'CNC-003 (Torno)',            status: 'Activo',  avatar: 'ER', efficiency: 91 },
];

const initialTasks = [
  { id: 'ORD-992', techId: 'T-001', project: 'IMC-2026-042', part: 'Soporte de Titanio A4', status: 'En Proceso',  progress: 68,  priority: 'Alta',  specs: 'Aleación Ti-6Al-4V, Tolerancia ±0.005mm', projectStatus: 'Producción Activa', blueprint: 'BP-737-A4-v2' },
  { id: 'ORD-993', techId: 'T-001', project: 'IMC-2026-042', part: 'Eje de Transmisión',   status: 'Pendiente',   progress: 0,   priority: 'Media', specs: 'Acero Inoxidable 316L, Longitud 120cm',  projectStatus: 'Producción Activa', blueprint: 'BP-737-TR-v1' },
  { id: 'ORD-842', techId: 'T-002', project: 'IMC-2026-045', part: 'Carcasa de Polímero',   status: 'En Proceso',  progress: 45,  priority: 'Alta',  specs: 'Polímero PEEK, Resistente a 500atm',      projectStatus: 'Fase de Pruebas',    blueprint: 'BP-SSH-C1' },
  { id: 'ORD-843', techId: 'T-002', project: 'IMC-2026-045', part: 'Soporte Interno',       status: 'Completado',  progress: 100, priority: 'Baja',  specs: 'Aluminio 7075-T6, Anodizado',              projectStatus: 'Fase de Pruebas',    blueprint: 'BP-SSH-S2' },
  { id: 'ORD-710', techId: 'T-003', project: 'IMC-2026-048', part: 'Anillo de Sellado',     status: 'Pausado',     progress: 30,  priority: 'Media', specs: 'Caucho de Fluorocarbono (FKM)',           projectStatus: 'Retrasado',          blueprint: 'BP-TSC-R1' },
  { id: 'ORD-605', techId: 'T-004', project: 'IMC-2026-039', part: 'Rotor Principal',       status: 'En Proceso',  progress: 82,  priority: 'Crítica', specs: 'Fibra de Carbono Compuesta',            projectStatus: 'Ensamblaje Final',   blueprint: 'BP-HLD-R0' },
];

const statusBadge: Record<string, 'default' | 'secondary' | 'warning' | 'success'> = {
  'En Proceso': 'default',
  Pendiente: 'secondary',
  Pausado: 'warning',
  Completado: 'success',
};

export function Technicians() {
  const [technicians] = useState(mockTechnicians);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTechId, setSelectedTechId] = useState(mockTechnicians[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<typeof initialTasks[0] | null>(null);

  const selectedTech = technicians.find(t => t.id === selectedTechId);
  const techTasks = tasks.filter(t => t.techId === selectedTechId);

  const handleStatusChange = (taskId: string, newStatus: string) => {
    setTasks(
      tasks.map(t => {
        if (t.id === taskId) {
          let newProgress = t.progress;
          if (newStatus === 'Completado') newProgress = 100;
          if (newStatus === 'En Proceso' && t.progress === 0) newProgress = 5;
          return { ...t, status: newStatus, progress: newProgress };
        }
        return t;
      })
    );
  };

  const filteredTechnicians = technicians.filter(
    t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.machine.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            placeholder="Buscar técnico o máquina..."
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
                    {tech.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{tech.name}</h3>
                    <p className="text-xs text-[var(--color-app-text-muted)] truncate flex items-center gap-1 mt-0.5">
                      <Wrench className="h-3 w-3" /> {tech.machine}
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
                      {selectedTech.avatar}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">{selectedTech.name}</h2>
                      <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">{selectedTech.role}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-1 flex items-center gap-1">
                        <Wrench className="h-3 w-3" /> {selectedTech.machine}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--color-app-text-muted)] mb-1">Eficiencia</div>
                    <div className="text-2xl font-semibold">{selectedTech.efficiency}%</div>
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
                  techTasks.map(task => (
                    <div key={task.id} className="p-4 hover:bg-[var(--color-app-surface-alt)]/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-[var(--color-app-text-muted)]">{task.id}</p>
                          <p className="font-medium mt-0.5">{task.part}</p>
                          <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">{task.project}</p>
                        </div>

                        <div className="flex flex-col items-end gap-2 min-w-[180px]">
                          <Badge variant={statusBadge[task.status]}>{task.status}</Badge>
                          <div className="w-32 flex items-center gap-2">
                            <Progress value={task.progress} className="h-1.5" />
                            <span className="text-xs tabular-nums text-[var(--color-app-text-muted)] w-9 text-right">
                              {task.progress}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {task.status === 'Pendiente' && (
                              <Button size="icon" variant="outline" className="h-7 w-7" title="Iniciar" onClick={() => handleStatusChange(task.id, 'En Proceso')}>
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {task.status === 'En Proceso' && (
                              <>
                                <Button size="icon" variant="outline" className="h-7 w-7" title="Pausar" onClick={() => handleStatusChange(task.id, 'Pausado')}>
                                  <Pause className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-7 w-7" title="Completar" onClick={() => handleStatusChange(task.id, 'Completado')}>
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {task.status === 'Pausado' && (
                              <Button size="icon" variant="outline" className="h-7 w-7" title="Reanudar" onClick={() => handleStatusChange(task.id, 'En Proceso')}>
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Detalles" onClick={() => setSelectedTaskDetails(task)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
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
                  <p className="font-medium">{selectedTaskDetails.project}</p>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-1">
                    Estado general: <span className="text-[var(--color-app-text)]">{selectedTaskDetails.projectStatus}</span>
                  </p>
                </div>
                <div className="rounded-md bg-[var(--color-app-surface-alt)] p-4">
                  <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-1.5">
                    <Activity className="h-3.5 w-3.5" /> Estado / progreso
                  </p>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusBadge[selectedTaskDetails.status]}>{selectedTaskDetails.status}</Badge>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--color-app-text-muted)]">Progreso</span>
                        <span className="font-medium">{selectedTaskDetails.progress}%</span>
                      </div>
                      <Progress value={selectedTaskDetails.progress} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-[var(--color-app-surface-alt)] p-4">
                <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-3">
                  <Wrench className="h-3.5 w-3.5" /> Especificaciones de la pieza
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-[var(--color-app-text-muted)]">Nombre</p>
                    <p className="font-medium mt-0.5">{selectedTaskDetails.part}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-app-text-muted)]">Material y tolerancias</p>
                    <p className="text-sm mt-0.5">{selectedTaskDetails.specs}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-[var(--color-app-surface-alt)] p-4">
                <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5 mb-3">
                  <FileCode2 className="h-3.5 w-3.5" /> Planos y referencias
                </p>
                <div className="border border-dashed border-[var(--color-app-border-strong)] rounded-md min-h-[180px] flex flex-col items-center justify-center gap-2 bg-white">
                  <FileCode2 className="h-10 w-10 text-[var(--color-app-text-subtle)]" />
                  <p className="text-sm font-medium">{selectedTaskDetails.blueprint}.pdf</p>
                  <p className="text-xs text-[var(--color-app-text-muted)]">Haz clic para abrir el visor CAD</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Ver plano completo
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
