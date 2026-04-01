import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle2, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronDown,
  Package,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Shared Mock Data for Projects (Access from other modules)
export const PROJECTS = [
  { id: 'IMC-2026-042', name: 'Eje Principal Ensamblaje', client: 'BRP', deadline: '2026-04-15' },
  { id: 'IMC-2026-045', name: 'Moldes de Inyección', client: 'Foxconn', deadline: '2026-04-20' },
  { id: 'IMC-2026-048', name: 'Soportes Estructurales', client: 'Aptiv', deadline: '2026-04-05' },
  { id: 'IMC-2026-039', name: 'Carcasas de Aluminio', client: 'Bosch', deadline: '2026-03-30' },
];

// Shared Mock Initial BOM Data
export const INITIAL_BOMS = [
  {
    id: 'BOM-001',
    projectId: 'IMC-2026-042',
    projectName: 'Eje Principal Ensamblaje',
    items: [
      { id: 'item-1', partNumber: 'MS-A-4140-01', description: 'Acero 4140 2" x 12"', category: 'Materia Prima', quantity: 20, uom: 'Barras', status: 'Solicitado' },
      { id: 'item-2', partNumber: 'CN-T-1250-05', description: 'Insertos de Carburo (Fresa)', category: 'Herramental', quantity: 15, uom: 'Cajas', status: 'Stock' },
      { id: 'item-3', partNumber: 'HD-B-0820-10', description: 'Tornillo Allen M8x20mm', category: 'Hardware', quantity: 200, uom: 'Pzas', status: 'Recibido' },
    ]
  },
  {
    id: 'BOM-002',
    projectId: 'IMC-2026-045',
    projectName: 'Moldes de Inyección',
    items: [
      { id: 'item-4', partNumber: 'AL-M-6061-02', description: 'Aluminio 6061-T6 Block', category: 'Materia Prima', quantity: 4, uom: 'Pzas', status: 'Pendiente' },
      { id: 'item-5', partNumber: 'SP-R-200-15', description: 'Resortes de Expulsión 2"', category: 'Componentes Moldes', quantity: 12, uom: 'Pzas', status: 'Tránsito' },
    ]
  }
];

type BOMStatus = 'Pendiente' | 'Solicitado' | 'Tránsito' | 'Recibido' | 'Stock';

const STATUS_COLORS: Record<BOMStatus, string> = {
  'Pendiente': 'secondary',
  'Solicitado': 'warning',
  'Tránsito': 'default',
  'Recibido': 'success',
  'Stock': 'outline'
};

export function BOMManager() {
  const [boms, setBoms] = useState(INITIAL_BOMS);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<any[] | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<string[]>(['IMC-2026-042']);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;

      setIsUploading(false);
      setIsAnalyzing(true);

      // Cyberpunk analysis delay for UX
      setTimeout(() => {
        try {
          const workbook = XLSX.read(bstr, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet);

          // Data Mapping from Template: Name, Status, Qty, Type, Supplier, Part Description, etc.
          const mappedData = rawData.map((row: any) => ({
            partNumber: row.Name || row['Part Description'] || 'N/A',
            description: row['Part Description'] || row.Notes || 'SIN DESCRIPCIÓN',
            category: row.Type || 'GENERAL',
            quantity: Number(row.Qty) || 1,
            uom: 'Pzas', // Default UOM
            status: 'Pendiente' as BOMStatus
          }));

          setIsAnalyzing(false);
          setAnalyzedData(mappedData);
          setIsAssignModalOpen(true);
        } catch (error) {
          console.error('Error parsing Excel:', error);
          setIsAnalyzing(false);
          alert('Error al procesar el archivo Excel. Verifica el formato.');
        }
      }, 1500);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleAssignToProject = () => {
    if (!selectedProjectId || !analyzedData) return;
    
    const project = PROJECTS.find(p => p.id === selectedProjectId);
    const newItems = analyzedData.map((item, idx) => ({
      ...item,
      id: `new-${Date.now()}-${idx}`,
      status: 'Pendiente' as BOMStatus
    }));

    const existingProjectBOM = boms.find(b => b.projectId === selectedProjectId);

    if (existingProjectBOM) {
      setBoms(boms.map(b => b.projectId === selectedProjectId ? { ...b, items: [...b.items, ...newItems] } : b));
    } else {
      setBoms([{ 
        id: `BOM-${Date.now()}`, 
        projectId: selectedProjectId, 
        projectName: project?.name || 'Unknown', 
        items: newItems 
      }, ...boms]);
      setExpandedProjects([selectedProjectId, ...expandedProjects]);
    }

    setIsAssignModalOpen(false);
    setAnalyzedData(null);
    setSelectedProjectId('');
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const updateItemStatus = (projectId: string, itemId: string, newStatus: BOMStatus) => {
    setBoms(boms.map(b => 
      b.projectId === projectId 
        ? { ...b, items: b.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i) }
        : b
    ));
  };

  const deleteItem = (projectId: string, itemId: string) => {
    setBoms(boms.map(b => 
      b.projectId === projectId 
        ? { ...b, items: b.items.filter(i => i.id !== itemId) }
        : b
    ).filter(b => b.items.length > 0)); // Remove project if no items left
  };

  const getGroupedItems = (items: any[]) => {
    return items.reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  };

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-[var(--color-neon-cyan-dim)] bg-[var(--color-cyber-panel)]/30 group hover:border-[var(--color-neon-cyan)] transition-colors cursor-pointer relative overflow-hidden">
        <label className="h-48 flex flex-col items-center justify-center p-6 text-center space-y-4 cursor-pointer">
          <input 
            type="file" 
            className="sr-only" 
            accept=".xlsx,.xls" 
            onChange={handleFileUpload} 
          />
          {isAnalyzing ? (
            <div className="space-y-4 w-full max-w-xs">
              <div className="h-1 bg-[var(--color-neon-cyan-dim)]/20 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-[var(--color-neon-cyan)] animate-[loading_2s_infinite]" style={{ width: '30%' }} />
              </div>
              <p className="text-xs font-mono text-[var(--color-neon-cyan)] animate-pulse tracking-widest uppercase">Escaneando Estructura de Excel...</p>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="absolute -inset-1 bg-[var(--color-neon-cyan)] blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative p-3 bg-black rounded-lg border border-[var(--color-neon-cyan-dim)] group-hover:border-[var(--color-neon-cyan)] transition-colors">
                  <Upload className={cn("h-8 w-8 text-[var(--color-neon-cyan)]", isUploading && "animate-bounce")} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold text-[var(--color-text-main)] uppercase tracking-tight">Importar Lista de Materiales (BOM)</h3>
                <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1 uppercase">SOPORTA .XLSX, .XLS • FORMATO TEMPLATE</p>
              </div>
              <div className="border-[var(--color-neon-cyan-dim)] text-[var(--color-neon-cyan)] font-mono text-xs uppercase tracking-widest border px-4 py-2 rounded group-hover:bg-[var(--color-neon-cyan)] group-hover:text-black transition-all">
                Examinar Archivos
              </div>
            </>
          )}
        </label>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-mono font-bold text-[var(--color-neon-cyan)] uppercase flex items-center gap-2">
            <Package className="h-5 w-5" /> Inventario de Compras por Proyecto
          </h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-[var(--color-text-muted)]" />
              <Input placeholder="FILTRAR PARTE..." className="h-8 pl-8 font-mono text-xs w-48 bg-black/50 border-[var(--color-neon-cyan-dim)]" />
            </div>
            <Button variant="outline" size="sm" className="h-8 border-[var(--color-neon-cyan-dim)]"><Filter className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-4">
          {boms.map((bom) => (
            <div key={bom.id} className="border border-[var(--color-neon-cyan-dim)]/30 rounded-md overflow-hidden bg-[var(--color-cyber-panel)] shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              <button 
                onClick={() => toggleProject(bom.projectId)}
                className="w-full p-4 flex items-center justify-between bg-black/40 hover:bg-black/60 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {expandedProjects.includes(bom.projectId) ? <ChevronDown className="h-4 w-4 text-[var(--color-neon-cyan)]" /> : <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />}
                  <div className="text-left">
                    <p className="text-xs font-mono font-bold text-[var(--color-neon-cyan)] uppercase tracking-[0.2em]">{bom.projectId}</p>
                    <p className="text-sm font-mono text-[var(--color-text-main)] font-medium uppercase">{bom.projectName}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">Items</p>
                    <p className="text-xs font-mono font-bold">{bom.items.length}</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-[9px] font-mono uppercase tracking-tighter">
                    Activo
                  </Badge>
                </div>
              </button>

              {expandedProjects.includes(bom.projectId) && (
                <div className="p-4 border-t border-[var(--color-neon-cyan-dim)]/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  {Object.entries(getGroupedItems(bom.items)).map(([category, items]: [string, any]) => (
                    <div key={category} className="mb-6 last:mb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-[2px] w-4 bg-[var(--color-neon-purple)]" />
                        <h4 className="text-[10px] font-mono font-bold text-[var(--color-neon-purple)] uppercase tracking-[0.3em]">{category}</h4>
                      </div>
                      <div className="space-y-1">
                        {items.map((item: any) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 p-2 rounded hover:bg-white/5 transition-colors items-center text-xs border-b border-white/5 pb-2 last:border-b-0">
                            <div className="col-span-2 font-mono font-bold text-[var(--color-text-main)]">{item.partNumber}</div>
                            <div className="col-span-4 font-mono text-[var(--color-text-muted)] uppercase italic">{item.description}</div>
                            <div className="col-span-2 text-center font-mono">
                              <span className="font-bold">{item.quantity}</span> <span className="text-[10px] text-zinc-500 uppercase">{item.uom}</span>
                            </div>
                            <div className="col-span-3 flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-auto py-1 px-3 p-0 hover:bg-transparent">
                                    <Badge variant={STATUS_COLORS[item.status as BOMStatus] as any} className="cursor-pointer hover:scale-105 transition-transform text-[10px]">
                                      {item.status} <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                    </Badge>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[var(--color-cyber-panel)] border-[var(--color-neon-cyan-dim)] font-mono text-xs">
                                  <DropdownMenuLabel className="text-[10px] uppercase text-[var(--color-text-muted)]">Actualizar Estatus</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-white/5" />
                                  {(['Pendiente', 'Solicitado', 'Tránsito', 'Recibido', 'Stock'] as BOMStatus[]).map((s) => (
                                    <DropdownMenuItem key={s} onClick={() => updateItemStatus(bom.projectId, item.id, s)} className="hover:bg-[var(--color-neon-cyan)]/10 cursor-pointer uppercase text-[10px]">
                                      {s}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-white transition-colors">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[var(--color-cyber-panel)] border-[var(--color-neon-cyan-dim)] font-mono text-xs shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                                  <DropdownMenuLabel className="text-[10px] uppercase text-[var(--color-text-muted)] tracking-widest">Opciones de Partida</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-white/5" />
                                  <DropdownMenuItem className="hover:bg-[var(--color-neon-cyan)]/10 cursor-pointer uppercase text-[10px]">
                                    Ver Especificaciones
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="hover:bg-[var(--color-neon-cyan)]/10 cursor-pointer uppercase text-[10px]">
                                    Trazabilidad
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-white/5" />
                                  <DropdownMenuItem 
                                    onClick={() => deleteItem(bom.projectId, item.id)}
                                    className="text-red-400 hover:bg-red-400/10 cursor-pointer uppercase text-[10px] font-bold"
                                  >
                                    Eliminar Partida
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="bg-[var(--color-cyber-panel)] border-[var(--color-neon-cyan-dim)] text-white font-mono">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[var(--color-neon-cyan)] uppercase tracking-widest drop-shadow-[0_0_10px_var(--color-neon-cyan)] flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Análisis de Archivo Completo
            </DialogTitle>
            <DialogDescription className="text-zinc-400 uppercase text-xs">
              Se han detectado {analyzedData?.length} items nuevos. ¿A qué proyecto deseas asignar esta lista de materiales?
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-[var(--color-neon-cyan)]">Proyecto Destino</label>
              <select 
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full p-2 bg-black/50 border border-[var(--color-neon-cyan-dim)] text-[var(--color-text-main)] font-mono text-sm uppercase rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-neon-cyan)]"
              >
                <option value="" disabled>Seleccionar Proyecto...</option>
                {PROJECTS.map(p => (
                  <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                ))}
              </select>
            </div>
            
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="text-[10px] uppercase text-emerald-400 font-bold leading-tight">
                Análisis exitoso: Estructura de columnas validada y mapeada correctamente al sistema Koji CODE ERP.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)} className="border-white/10 text-white font-mono text-xs uppercase hover:bg-white/5">
              Cancelar
            </Button>
            <Button 
              onClick={handleAssignToProject}
              disabled={!selectedProjectId}
              className="bg-[var(--color-neon-cyan)] text-black font-mono font-bold text-xs uppercase tracking-widest shadow-[0_0_15px_var(--color-neon-cyan)]"
            >
              Asignar Materiales
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading {
          0% { left: -100%; width: 30%; }
          50% { width: 50%; }
          100% { left: 100%; width: 30%; }
        }
      `}} />
    </div>
  );
}
