import React, { useState } from 'react';
import { 
  Factory, 
  Settings, 
  PlayCircle, 
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  SearchCode
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

const mockMachines = [
  { id: 'CNC-001', type: 'Centro de Maquinado 3 Ejes', status: 'Operando', currentJob: 'Eje Principal (OP1)', operator: 'Juan P.', progress: 65, efficiency: 92 },
  { id: 'CNC-002', type: 'Torno CNC', status: 'Setup', currentJob: 'Bujes Bronce', operator: 'Raúl M.', progress: 0, efficiency: 78 },
  { id: 'CNC-003', type: 'Centro de Maquinado 5 Ejes', status: 'Mantenimiento', currentJob: '-', operator: '-', progress: 0, efficiency: 0 },
  { id: 'CNC-004', type: 'Torno Suizo', status: 'Operando', currentJob: 'Pernos Especiales', operator: 'Diego T.', progress: 88, efficiency: 95 },
];

const mockWorkOrders = [
  { id: 'WO-2026-089', project: 'IMC-2026-042', part: 'Eje Principal', qty: 500, completed: 325, machine: 'CNC-001', status: 'En Proceso' },
  { id: 'WO-2026-090', project: 'IMC-2026-045', part: 'Bujes Bronce', qty: 1200, completed: 0, machine: 'CNC-002', status: 'Setup' },
  { id: 'WO-2026-091', project: 'IMC-2026-039', part: 'Carcasa Alum', qty: 50, completed: 50, machine: 'CNC-003', status: 'Completado' },
  { id: 'WO-2026-092', project: 'IMC-2026-048', part: 'Pernos', qty: 5000, completed: 4400, machine: 'CNC-004', status: 'En Proceso' },
];

export function Production() {
  const [activeTab, setActiveTab] = useState<'floor' | 'planning' | 'status'>('floor');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-neon font-cyber">Control de Producción</h1>
          <p className="text-sm text-cyber-muted">Monitoreo de piso, estado de máquinas y órdenes de trabajo.</p>
        </div>
        <Button className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber shadow-[0_0_15px_var(--color-neon-cyan)]">
          Nueva Orden de Trabajo
        </Button>
      </div>

      <ProductionStatusHeader />

      {/* Production Tabs */}
      <div className="flex items-center gap-1 p-1 bg-black/40 border border-cyber-border rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('floor')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-md",
            activeTab === 'floor' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <LayoutDashboard className="h-4 w-4" /> Piso de Fábrica
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-md",
            activeTab === 'planning' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <ClipboardList className="h-4 w-4" /> Planificación
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-md",
            activeTab === 'status' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <BarChart3 className="h-4 w-4" /> Estatus de Proyectos
        </button>
      </div>

      {activeTab === 'floor' && (
        <>
          {/* Machine Status Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {mockMachines.map((machine) => (
              <Card key={machine.id} className={cn(
                "border-cyber-border bg-cyber-panel/50 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.3)]",
                machine.status === 'Operando' ? 'border-l-4 border-l-emerald-400' :
                machine.status === 'Setup' ? 'border-l-4 border-l-cyber-accent' :
                'border-l-4 border-l-cyber-red'
              )}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-bold text-cyber-neon font-cyber">{machine.id}</CardTitle>
                  {machine.status === 'Operando' ? <PlayCircle className="h-5 w-5 text-emerald-400" /> :
                   machine.status === 'Setup' ? <Settings className="h-5 w-5 text-cyber-accent" /> :
                   <AlertTriangle className="h-5 w-5 text-cyber-red" />}
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-cyber-muted mb-2 font-cyber uppercase tracking-tighter">{machine.type}</div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-cyber-muted">Estado:</span>
                      <span className="font-medium text-cyber-text">{machine.status}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cyber-muted font-mono text-[10px]">OEE:</span>
                      <span className="font-medium text-cyber-neon font-cyber">{machine.efficiency}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cyber-muted">Operador:</span>
                      <span className="font-medium text-cyber-text">{machine.operator}</span>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-cyber-border mt-2">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-cyber-muted truncate max-w-[120px] uppercase">{machine.currentJob}</span>
                        <span className="text-cyber-neon font-medium">{machine.progress}%</span>
                      </div>
                      <Progress value={machine.progress} className="h-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-cyber-border bg-cyber-panel/50 backdrop-blur-sm">
            <CardHeader className="pb-3 px-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-cyber-neon font-cyber flex items-center gap-2">
                    <SearchCode className="h-5 w-5" /> 
                    Órdenes de Trabajo Activas (WIP)
                  </CardTitle>
                  <CardDescription className="text-cyber-muted font-mono text-[10px] uppercase tracking-widest">Monitoreo de manufactura en tiempo real.</CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
                  <Input
                    placeholder="Buscar WO o ID de Proyecto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-black/40 border-cyber-border text-cyber-text font-mono text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="rounded-md border border-cyber-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-black/40">
                    <TableRow className="border-cyber-border hover:bg-transparent">
                      <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4">ID Orden</TableHead>
                      <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4">Proyecto</TableHead>
                      <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4">Pieza / Componente</TableHead>
                      <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4">Puesto Maquinaria</TableHead>
                      <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4">Estado</TableHead>
                      <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4">Progreso (Pzas)</TableHead>
                      <TableHead className="text-right text-cyber-muted font-cyber uppercase text-[10px] tracking-widest py-4 pr-6">Gestión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockWorkOrders.map((wo) => (
                      <TableRow key={wo.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors group">
                        <TableCell className="font-medium text-cyber-neon font-cyber text-xs py-4">{wo.id}</TableCell>
                        <TableCell className="text-cyber-text text-xs uppercase font-mono">{wo.project}</TableCell>
                        <TableCell className="text-cyber-text text-xs uppercase font-mono">{wo.part}</TableCell>
                        <TableCell className="text-cyber-muted text-xs uppercase font-mono">{wo.machine}</TableCell>
                        <TableCell>
                          <Badge variant={
                            wo.status === 'Completado' ? 'success' :
                            wo.status === 'En Proceso' ? 'default' : 'warning'
                          } className="text-[9px] px-2 py-0.5">
                            {wo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 w-32">
                            <Progress value={(wo.completed / wo.qty) * 100} className="h-1" />
                            <span className="text-[9px] text-cyber-muted font-mono flex justify-between">
                              <span>UNIDADES:</span>
                              <span className="text-cyber-neon font-bold">{wo.completed} / {wo.qty}</span>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4 pr-6">
                          <Button variant="ghost" size="sm" className="h-8 border border-cyber-border hover:bg-cyber-neon/10 hover:text-cyber-neon text-cyber-muted font-mono text-[9px] uppercase">
                            Reportar Avance
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'planning' && (
        <ProductionProjectView />
      )}

      {activeTab === 'status' && (
        <div className="grid gap-6">
          <Card className="border-cyber-border bg-cyber-panel/50">
            <CardHeader>
              <CardTitle className="text-cyber-neon font-cyber">Reporte de Estatus Avanzado</CardTitle>
              <CardDescription className="text-cyber-muted uppercase font-mono text-[10px]">Selecciona un proyecto arriba para filtrar el reporte.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-64 border-t border-cyber-border border-dashed m-6">
              <p className="text-cyber-muted italic font-mono text-xs">Selecciona un proyecto en el panel superior para desplegar estadísticas detalladas.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

