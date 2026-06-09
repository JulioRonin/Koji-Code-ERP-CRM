import React, { useState } from 'react';
import {
  FolderSearch,
  ChevronRight,
  Calendar,
  Info,
  Search,
  PenTool,
  FileOutput,
  FileCode2,
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

export function ProductionProjectView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<any>(null);

  const selectedProject = PROJECTS.find(p => p.id === selectedProjectId);
  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  if (!selectedProjectId) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-medium flex items-center gap-2 text-[var(--color-app-text)]">
          <FolderSearch className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Selección de proyecto
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROJECTS.map(project => (
            <Card
              key={project.id}
              className="p-0 hover:border-[var(--color-app-primary)]/40 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedProjectId(project.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="font-mono text-xs">{project.id}</Badge>
                  <ChevronRight className="h-4 w-4 text-[var(--color-app-text-subtle)]" />
                </div>
                <CardTitle className="text-base mt-2">{project.name}</CardTitle>
                <CardDescription>Cliente: {project.client}</CardDescription>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="flex justify-between items-center text-xs text-[var(--color-app-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {project.deadline}
                  </span>
                  <span className="text-[var(--color-app-primary)]">Ver lista →</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelectedProjectId(null)}>
            ← Volver
          </Button>
          <div>
            <h2 className="text-base font-semibold">{selectedProject?.name}</h2>
            <p className="text-xs text-[var(--color-app-text-muted)] font-mono">
              {selectedProject?.id} · BOM de producción
            </p>
          </div>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder="Filtrar por parte o material..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID parte</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead className="text-center">Referencias</TableHead>
                <TableHead>Estatus compra</TableHead>
                <TableHead>Plan producción</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.partNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.description}</span>
                      <span className="text-xs text-[var(--color-app-text-muted)]">{item.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[var(--color-app-text-muted)] tabular-nums">
                    {item.quantity} {item.uom}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <span title="Modelo 3D (STEP)" className="p-1.5 rounded-md bg-[var(--color-app-surface-alt)] hover:bg-[var(--color-app-primary-soft)] transition-colors cursor-pointer">
                        <FileOutput className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" />
                      </span>
                      <span title="Plano 2D (PDF)" className="p-1.5 rounded-md bg-[var(--color-app-surface-alt)] hover:bg-[var(--color-app-primary-soft)] transition-colors cursor-pointer">
                        <FileCode2 className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" />
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">En stock</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Sin asignar</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedPart(item);
                        setIsPlanningModalOpen(true);
                      }}
                    >
                      Asignar plan
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Planning Modal */}
      {isPlanningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-0">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" /> Generar plan de producción
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {selectedPart?.partNumber} · {selectedPart?.description}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsPlanningModalOpen(false)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Asignar técnico</label>
                <select className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]">
                  <option value="">Selecciona técnico...</option>
                  {mockTechnicians.map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.name} — {tech.role}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Máquina</label>
                  <select className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]">
                    <option value="">Selecciona equipo...</option>
                    <option>CNC-001 (Fresadora 3 ejes)</option>
                    <option>CNC-002 (Torno CNC)</option>
                    <option>CNC-004 (Torno Suizo)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Prioridad</label>
                  <select className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]">
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-[var(--color-app-surface-alt)] rounded-md border border-[var(--color-app-border)] space-y-2">
                <h4 className="text-xs font-medium text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Referencias de ingeniería vinculadas
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FileOutput className="h-3 w-3" /> 3D_MODEL.STEP
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <FileCode2 className="h-3 w-3" /> 2D_DRAWING.PDF
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsPlanningModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={() => setIsPlanningModalOpen(false)}>
                  Confirmar asignación
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
