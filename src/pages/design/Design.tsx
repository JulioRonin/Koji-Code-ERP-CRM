import React, { useState } from 'react';
import { 
  PenTool, 
  FileCheck, 
  MonitorPlay, 
  Clock,
  Search,
  Plus,
  MoreHorizontal,
  FileCode2,
  LayoutDashboard,
  Files
} from 'lucide-react';
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
import { DesignFileManager } from '@/components/design/DesignFileManager';
import { DesignChecklist } from '@/components/design/DesignChecklist';
import { cn } from '@/lib/utils';

const mockDesignTasks = [
  { id: 'DSG-001', project: 'IMC-2026-042', part: 'Eje Principal', designer: 'Miguel A.', status: 'Aprobado', camStatus: 'Completado', dueDate: '2026-03-30' },
  { id: 'DSG-002', project: 'IMC-2026-045', part: 'Molde Base', designer: 'Sofía L.', status: 'En Revisión', camStatus: 'Pendiente', dueDate: '2026-04-02' },
  { id: 'DSG-003', project: 'IMC-2026-048', part: 'Soporte A', designer: 'Miguel A.', status: 'Borrador', camStatus: 'Pendiente', dueDate: '2026-04-05' },
  { id: 'DSG-004', project: 'IMC-2026-050', part: 'Herramental 1', designer: 'Roberto C.', status: 'Aprobado', camStatus: 'En Proceso', dueDate: '2026-04-01' },
];

export function Design() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'files' | 'checklist'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-neon font-cyber">Diseño e Ingeniería</h1>
          <p className="text-sm text-cyber-muted">Gestión de modelos CAD, revisiones y programación CAM.</p>
        </div>
        {activeTab === 'dashboard' && (
          <Button className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber shadow-[0_0_15px_var(--color-neon-cyan)]">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Diseño
          </Button>
        )}
      </div>

      {/* Custom Tabs */}
      <div className="flex items-center gap-1 p-1 bg-black/40 border border-cyber-border rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-md",
            activeTab === 'dashboard' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard / Tareas
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-md",
            activeTab === 'files' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <Files className="h-4 w-4" /> Planos / Modelos 2D-3D
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-md",
            activeTab === 'checklist' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <FileCheck className="h-4 w-4" /> Checklist de Fabricación
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-cyber-border bg-cyber-panel/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-widest">Diseños Activos</CardTitle>
                <PenTool className="h-4 w-4 text-cyber-neon" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyber-neon font-cyber">14</div>
                <p className="text-[10px] text-cyber-muted uppercase font-mono">En fase de modelado</p>
              </CardContent>
            </Card>
            <Card className="border-cyber-border bg-cyber-panel/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-widest">En Revisión</CardTitle>
                <Clock className="h-4 w-4 text-cyber-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyber-neon font-cyber">5</div>
                <p className="text-[10px] text-cyber-muted uppercase font-mono">Esperando aprobación del cliente</p>
              </CardContent>
            </Card>
            <Card className="border-cyber-border bg-cyber-panel/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-widest">Aprobados (Mes)</CardTitle>
                <FileCheck className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyber-neon font-cyber">28</div>
                <p className="text-[10px] text-cyber-muted uppercase font-mono">Listos para manufactura</p>
              </CardContent>
            </Card>
            <Card className="border-cyber-border bg-cyber-panel/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-cyber-muted font-cyber uppercase tracking-widest">Programas CAM</CardTitle>
                <MonitorPlay className="h-4 w-4 text-cyber-purple" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyber-neon font-cyber">8</div>
                <p className="text-[10px] text-cyber-muted uppercase font-mono">En cola de programación</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center py-4">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
              <Input
                placeholder="Buscar diseños o proyectos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-cyber-dark/50 border-cyber-border text-cyber-text font-mono text-xs"
              />
            </div>
          </div>

          <div className="rounded-md border border-cyber-border bg-cyber-panel">
            <Table>
              <TableHeader>
                <TableRow className="border-cyber-border hover:bg-black/40">
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">ID Diseño</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Proyecto</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Pieza / Componente</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Diseñador</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Estado CAD</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Estado CAM</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Fecha Límite</TableHead>
                  <TableHead className="text-right text-cyber-muted font-cyber uppercase text-[10px] tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDesignTasks.map((task) => (
                  <TableRow key={task.id} className="border-cyber-border hover:bg-cyber-dark/50 transition-colors">
                    <TableCell className="font-medium text-cyber-neon font-cyber text-xs">{task.id}</TableCell>
                    <TableCell className="text-cyber-text text-xs uppercase font-mono">{task.project}</TableCell>
                    <TableCell className="text-cyber-text text-xs uppercase font-mono">{task.part}</TableCell>
                    <TableCell className="text-cyber-text text-xs uppercase font-mono">{task.designer}</TableCell>
                    <TableCell>
                      <Badge variant={
                        task.status === 'Aprobado' ? 'success' :
                        task.status === 'En Revisión' ? 'warning' : 'secondary'
                      } className="text-[10px]">
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        task.camStatus === 'Completado' ? 'success' :
                        task.camStatus === 'En Proceso' ? 'default' : 'outline'
                      } className="text-[10px]">
                        {task.camStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-cyber-muted font-cyber text-xs">{task.dueDate}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-cyber-dark/50 hover:text-cyber-neon text-cyber-muted">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-cyber-panel border-cyber-border text-cyber-text font-mono text-xs">
                          <DropdownMenuLabel className="text-cyber-muted font-cyber uppercase text-[10px]">Acciones</DropdownMenuLabel>
                          <DropdownMenuItem className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer">Ver Archivos CAD</DropdownMenuItem>
                          <DropdownMenuItem className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer">Aprobar Diseño</DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-cyber-border" />
                          <DropdownMenuItem className="hover:bg-cyber-dark/50 focus:bg-cyber-dark/50 focus:text-cyber-neon cursor-pointer text-cyber-accent">
                            <FileCode2 className="mr-2 h-4 w-4" />
                            Asignar a CAM
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : activeTab === 'files' ? (
        <DesignFileManager />
      ) : (
        <DesignChecklist />
      )}
    </div>
  );
}

