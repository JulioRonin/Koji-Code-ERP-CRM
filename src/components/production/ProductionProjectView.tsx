import React, { useState } from 'react';
import { 
  FolderSearch, 
  ChevronRight, 
  Users, 
  Settings, 
  Calendar, 
  Info, 
  CheckCircle2, 
  Clock, 
  Search, 
  PenTool, 
  FileOutput, 
  Maximize2,
  FileCode2,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';
import { mockTechnicians } from '@/pages/technicians/Technicians';
import { cn } from '@/lib/utils';

export function ProductionProjectView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<any>(null);

  const selectedProject = PROJECTS.find(p => p.id === selectedProjectId);
  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  const handleOpenPlanning = (part: any) => {
    setSelectedPart(part);
    setIsPlanningModalOpen(true);
  };

  if (!selectedProjectId) {
    return (
      <div className="grid gap-6">
        <h2 className="text-xl font-bold text-cyber-neon font-cyber flex items-center gap-2">
          <FolderSearch className="h-6 w-6" /> Selección de Proyecto para Producción
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTS.map((project) => (
            <Card 
              key={project.id} 
              className="border-cyber-border bg-cyber-panel/50 hover:border-cyber-neon/50 transition-all cursor-pointer group relative overflow-hidden"
              onClick={() => setSelectedProjectId(project.id)}
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileOutput className="h-16 w-16 text-cyber-neon" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="font-mono text-cyber-neon border-cyber-neon/30 text-[10px]">{project.id}</Badge>
                  <ChevronRight className="h-4 w-4 text-cyber-muted group-hover:text-cyber-neon transition-colors" />
                </div>
                <CardTitle className="text-base font-bold text-cyber-text font-cyber mt-2 uppercase">{project.name}</CardTitle>
                <CardDescription className="text-cyber-muted font-mono text-[10px] uppercase">Cliente: {project.client}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-xs font-mono text-cyber-muted">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {project.deadline}</span>
                  <span className="text-cyber-neon">Ver Lista de Producción</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedProjectId(null)}
            className="text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          >
            ← Volver
          </Button>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-cyber-neon font-cyber uppercase tracking-widest">{selectedProject?.name}</h2>
            <p className="text-[10px] text-cyber-muted font-mono uppercase tracking-widest">{selectedProject?.id} | BOM DE PRODUCCIÓN ENRIQUECIDA</p>
          </div>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
          <Input
            placeholder="Filtrar por Parte o Material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-black/40 border-cyber-border text-cyber-text text-xs"
          />
        </div>
      </div>

      <Card className="border-cyber-border bg-cyber-panel/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-cyber-border hover:bg-transparent">
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4">ID Parte</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4">Descripción / Material</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4">Cantidad</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4 text-center">Referencia CAD</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4">Estatus Compra</TableHead>
                  <TableHead className="text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4">Plan de Producción</TableHead>
                  <TableHead className="text-right text-cyber-muted font-cyber uppercase text-[9px] tracking-widest py-4 pr-6">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((item) => (
                  <TableRow key={item.id} className="border-cyber-border hover:bg-cyber-neon/5 group">
                    <TableCell className="font-medium text-cyber-neon font-cyber text-[11px] py-4">{item.partNumber}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-cyber-text uppercase">{item.description}</span>
                        <span className="text-[9px] font-mono text-cyber-muted uppercase italic bg-black/20 p-0.5 rounded w-fit">{item.category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-cyber-text text-xs font-mono">{item.quantity} {item.uom}</TableCell>
                    <TableCell className="text-center py-4">
                      <div className="flex justify-center gap-2">
                        <div className="p-1 bg-cyber-neon/10 rounded border border-cyber-neon/20 group-hover:border-cyber-neon transition-colors cursor-help" title="Ver Modelo 3D (STEP)">
                          <FileOutput className="h-4 w-4 text-cyber-neon" />
                        </div>
                        <div className="p-1 bg-cyber-accent/10 rounded border border-cyber-accent/20 group-hover:border-cyber-accent transition-colors cursor-help" title="Ver Plano 2D (PDF)">
                          <FileCode2 className="h-4 w-4 text-cyber-accent" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 text-[9px] uppercase font-mono">EN STOCK</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] uppercase font-mono">SIN ASIGNAR</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-4 pr-6">
                      <Button 
                        size="sm" 
                        onClick={() => handleOpenPlanning(item)}
                        className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber text-[10px] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                      >
                        ASIGNAR PLAN
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Modal Placeholder */}
      {isPlanningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md">
          <Card className="w-full max-w-lg border-cyber-neon shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-cyber-panel">
            <CardHeader className="border-b border-cyber-border">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-cyber text-cyber-neon uppercase tracking-widest flex items-center gap-2">
                  <PenTool className="h-5 w-5" /> Generar Plan de Producción
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsPlanningModalOpen(false)} className="text-cyber-muted hover:text-white">✕</Button>
              </div>
              <CardDescription className="text-xs font-mono uppercase text-cyber-muted">
                Pieza: <span className="text-cyber-neon">{selectedPart?.partNumber}</span> | {selectedPart?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-widest">Asignar Técnico</label>
                  <select className="w-full bg-black/60 border border-cyber-border text-white text-xs p-3 rounded-lg font-mono focus:border-cyber-neon outline-none appearance-none">
                    <option value="">SELECCIONE TÉCNICO DISPONIBLE...</option>
                    {mockTechnicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name} - {tech.role}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-widest">Maquinaria</label>
                    <select className="w-full bg-black/60 border border-cyber-border text-white text-xs p-3 rounded-lg font-mono focus:border-cyber-neon outline-none">
                      <option value="">SELECCIONE EQUIPO...</option>
                      <option>CNC-001 (FRESADORA 3 EJES)</option>
                      <option>CNC-002 (TORNO CNC)</option>
                      <option>CNC-004 (TORNO SUIZO)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-widest">Prioridad</label>
                    <select className="w-full bg-black/60 border border-cyber-border text-white text-xs p-3 rounded-lg font-mono focus:border-cyber-neon outline-none">
                      <option>NORMAL</option>
                      <option className="text-cyber-accent">ALTA</option>
                      <option className="text-cyber-red">URGENTE / CRÍTICA</option>
                    </select>
                  </div>
                </div>
                <div className="p-4 bg-black/40 border border-cyber-border rounded-lg space-y-3">
                  <h4 className="text-[10px] font-mono font-bold text-cyber-muted uppercase flex items-center gap-2">
                    <Info className="h-4 w-4" /> Referencias de Ingeniería Vinculadas
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-cyber-neon font-mono bg-cyber-neon/5 p-2 rounded border border-cyber-neon/20">
                      <FileOutput className="h-4 w-4" /> 3D_MODEL.STEP
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cyber-accent font-mono bg-cyber-accent/5 p-2 rounded border border-cyber-accent/20">
                      <FileCode2 className="h-4 w-4" /> 2D_DRAWING.PDF
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber uppercase text-xs" onClick={() => setIsPlanningModalOpen(false)}>
                  Confirmar Asignación
                </Button>
                <Button variant="ghost" className="flex-1 text-cyber-red hover:bg-cyber-red/10 font-cyber uppercase text-xs" onClick={() => setIsPlanningModalOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
