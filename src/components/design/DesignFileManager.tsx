import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Settings2,
  Trash2,
  Eye,
  Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';

export function DesignFileManager() {
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECTS[0].id);
  const [isUploading, setIsUploading] = useState(false);
  const [mappedFiles, setMappedFiles] = useState<Record<string, { drawing?: string; model?: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);

    setTimeout(() => {
      const newMappings = { ...mappedFiles };
      Array.from(files).forEach(file => {
        const fileName = file.name;
        const matchedPart = parts.find(p => fileName.toLowerCase().includes(p.partNumber.toLowerCase()));
        if (matchedPart) {
          const lower = fileName.toLowerCase();
          const is3D = lower.endsWith('.step') || lower.endsWith('.stp') || lower.endsWith('.igs');
          const is2D = lower.endsWith('.pdf') || lower.endsWith('.dwg') || lower.endsWith('.dxf');

          if (!newMappings[matchedPart.id]) newMappings[matchedPart.id] = {};
          if (is3D) newMappings[matchedPart.id].model = fileName;
          if (is2D) newMappings[matchedPart.id].drawing = fileName;
        }
      });
      setMappedFiles(newMappings);
      setIsUploading(false);
    }, 800);
  };

  const filteredParts = parts.filter(
    p =>
      p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-end justify-between">
        <div className="space-y-1.5 w-full md:w-64">
          <label className="text-sm font-medium">Proyecto</label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
          >
            {PROJECTS.map(p => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
            <Input
              placeholder="Buscar parte..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Upload */}
      <Card className="border-dashed">
        <label className="h-36 flex flex-col items-center justify-center p-5 text-center gap-3 cursor-pointer">
          <input type="file" multiple className="sr-only" onChange={handleBulkUpload} />
          {isUploading ? (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-1 bg-[var(--color-app-surface-alt)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--color-app-primary)] animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-sm text-[var(--color-app-text-muted)]">Analizando archivos...</p>
            </div>
          ) : (
            <>
              <div className="h-10 w-10 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center">
                <Upload className="h-5 w-5 text-[var(--color-app-primary)]" />
              </div>
              <div>
                <h3 className="text-sm font-medium">Carga masiva de archivos de ingeniería</h3>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                  Soporta PDF, STEP, DWG, DXF, IGS
                </p>
              </div>
            </>
          )}
        </label>
      </Card>

      {/* Table */}
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part number</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-center">Estado 2D</TableHead>
              <TableHead className="text-center">Estado 3D</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParts.length > 0 ? (
              filteredParts.map(part => (
                <TableRow key={part.id}>
                  <TableCell className="font-mono text-xs">{part.partNumber}</TableCell>
                  <TableCell className="text-[var(--color-app-text-muted)]">{part.description}</TableCell>
                  <TableCell className="text-center">
                    {mappedFiles[part.id]?.drawing ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Listo
                        </Badge>
                        <span className="text-xs text-[var(--color-app-text-muted)] truncate max-w-[120px]">
                          {mappedFiles[part.id].drawing}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {mappedFiles[part.id]?.model ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="default" className="gap-1">
                          <Box className="h-3 w-3" /> Listo
                        </Badge>
                        <span className="text-xs text-[var(--color-app-text-muted)] truncate max-w-[120px]">
                          {mappedFiles[part.id].model}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[var(--color-app-danger)]"
                        onClick={() => {
                          const newMappings = { ...mappedFiles };
                          delete newMappings[part.id];
                          setMappedFiles(newMappings);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-[var(--color-app-text-muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-[var(--color-app-text-subtle)]" />
                    No se encontraron partidas en este proyecto.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
