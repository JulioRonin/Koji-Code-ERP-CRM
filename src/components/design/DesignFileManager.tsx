import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  FileBox, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  FileText, 
  Settings2,
  Trash2,
  Eye,
  Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

interface MappedFile {
  name: string;
  type: '2D' | '3D';
  partNumber: string;
  size: string;
}

export function DesignFileManager() {
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECTS[0].id);
  const [isUploading, setIsUploading] = useState(false);
  const [mappedFiles, setMappedFiles] = useState<Record<string, { drawing?: string, model?: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Get items for the selected project
  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    // Simulate analysis delay
    setTimeout(() => {
      const newMappings = { ...mappedFiles };
      
      Array.from(files).forEach(file => {
        const fileName = file.name;
        // Simple matching logic: find a part number that is contained in the filename
        const matchedPart = parts.find(p => fileName.toLowerCase().includes(p.partNumber.toLowerCase()));
        
        if (matchedPart) {
          const is3D = fileName.toLowerCase().endsWith('.step') || 
                       fileName.toLowerCase().endsWith('.stp') || 
                       fileName.toLowerCase().endsWith('.igs');
          const is2D = fileName.toLowerCase().endsWith('.pdf') || 
                       fileName.toLowerCase().endsWith('.dwg') || 
                       fileName.toLowerCase().endsWith('.dxf');

          if (!newMappings[matchedPart.id]) {
            newMappings[matchedPart.id] = {};
          }

          if (is3D) newMappings[matchedPart.id].model = fileName;
          if (is2D) newMappings[matchedPart.id].drawing = fileName;
        }
      });

      setMappedFiles(newMappings);
      setIsUploading(false);
    }, 1500);
  };

  const removeFile = (partId: string, type: 'drawing' | 'model') => {
    const newMappings = { ...mappedFiles };
    if (newMappings[partId]) {
      delete newMappings[partId][type];
      setMappedFiles(newMappings);
    }
  };

  const filteredParts = parts.filter(p => 
    p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="space-y-2 w-full md:w-64">
          <label className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-widest">Proyecto Seleccionado</label>
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full h-10 p-2 bg-cyber-dark/50 border border-cyber-border text-cyber-text font-mono text-xs uppercase rounded focus:outline-none focus:ring-1 focus:ring-cyber-neon"
          >
            {PROJECTS.map(p => (
              <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
            <Input
              placeholder="BUSCAR PARTE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-cyber-dark/50 border-cyber-border text-cyber-text font-mono text-xs"
            />
          </div>
          <Button variant="outline" className="border-cyber-border"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Bulk Upload Zone */}
      <Card className="border-dashed border-cyber-neon/30 bg-cyber-panel/20 group hover:border-cyber-neon transition-all cursor-pointer relative overflow-hidden">
        <label className="h-40 flex flex-col items-center justify-center p-6 text-center space-y-4 cursor-pointer">
          <input 
            type="file" 
            multiple 
            className="sr-only" 
            onChange={handleBulkUpload}
          />
          {isUploading ? (
            <div className="space-y-4 w-full max-w-xs">
              <div className="h-1 bg-cyber-neon/20 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-cyber-neon animate-[progress_2s_infinite]" style={{ width: '40%' }} />
              </div>
              <p className="text-[10px] font-mono text-cyber-neon animate-pulse tracking-[0.3em] uppercase">Analizando Geometrías y Nombres...</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="absolute -inset-1 bg-cyber-neon blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
                <div className="relative p-3 bg-black rounded-lg border border-cyber-border group-hover:border-cyber-neon transition-colors">
                  <Upload className="h-6 w-6 text-cyber-neon" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold text-cyber-text uppercase tracking-tight">Carga Masiva de Archivos Ingeniería</h3>
                <p className="text-[9px] font-mono text-cyber-muted mt-1 uppercase tracking-tighter">SUELTA CARPETAS O ARCHIVOS 2D/3D (PDF, STEP, DWG, DXF)</p>
              </div>
            </>
          )}
        </label>
      </Card>

      {/* Parts Table */}
      <div className="rounded-md border border-cyber-border bg-cyber-panel overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <Table>
          <TableHeader>
            <TableRow className="border-cyber-border hover:bg-transparent bg-black/40">
              <TableHead className="text-cyber-neon font-cyber text-[10px] uppercase tracking-widest">Part Number</TableHead>
              <TableHead className="text-cyber-neon font-cyber text-[10px] uppercase tracking-widest">Descripción</TableHead>
              <TableHead className="text-cyber-neon font-cyber text-[10px] uppercase tracking-widest text-center">Estado 2D (Drawing)</TableHead>
              <TableHead className="text-cyber-neon font-cyber text-[10px] uppercase tracking-widest text-center">Estado 3D (Model)</TableHead>
              <TableHead className="text-right text-cyber-neon font-cyber text-[10px] uppercase tracking-widest">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParts.length > 0 ? (
              filteredParts.map((part) => (
                <TableRow key={part.id} className="border-cyber-border hover:bg-cyber-dark/30 transition-colors">
                  <TableCell className="font-bold text-cyber-text font-mono text-xs">{part.partNumber}</TableCell>
                  <TableCell className="text-cyber-muted font-mono text-[10px] uppercase">{part.description}</TableCell>
                  <TableCell className="text-center">
                    {mappedFiles[part.id]?.drawing ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="success" className="h-5 text-[9px] gap-1 px-2 border-emerald-500/50">
                          <CheckCircle2 className="h-3 w-3" /> LISTO
                        </Badge>
                        <span className="text-[8px] font-mono text-emerald-400/70 truncate max-w-[100px]">{mappedFiles[part.id].drawing}</span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[9px] px-2 opacity-40">PENDIENTE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {mappedFiles[part.id]?.model ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="default" className="h-5 text-[9px] gap-1 px-2 border-cyber-neon/50 bg-cyber-neon/10 text-cyber-neon">
                          <Box className="h-3 w-3" /> STEP OK
                        </Badge>
                        <span className="text-[8px] font-mono text-cyber-neon/70 truncate max-w-[100px]">{mappedFiles[part.id].model}</span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="h-5 text-[9px] px-2 opacity-40">PENDIENTE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-cyber-muted hover:text-cyber-neon"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-cyber-muted hover:text-cyber-neon"><Settings2 className="h-3.5 w-3.5" /></Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          const newMappings = { ...mappedFiles };
                          delete newMappings[part.id];
                          setMappedFiles(newMappings);
                        }}
                        className="h-7 w-7 text-cyber-muted hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-cyber-muted font-mono text-xs border-cyber-border">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-5 w-5 opacity-20" />
                    NO SE ENCONTRARON PARTIDAS EN ESTE PROYECTO
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { left: -100%; width: 30%; }
          50% { width: 50%; }
          100% { left: 100%; width: 30%; }
        }
      `}} />
    </div>
  );
}
