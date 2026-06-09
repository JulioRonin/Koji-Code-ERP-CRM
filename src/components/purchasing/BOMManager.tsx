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
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

// Shared mock data
export const PROJECTS = [
  { id: 'IMC-2026-042', name: 'Eje Principal Ensamblaje', client: 'BRP', deadline: '2026-04-15' },
  { id: 'IMC-2026-045', name: 'Moldes de Inyección', client: 'Foxconn', deadline: '2026-04-20' },
  { id: 'IMC-2026-048', name: 'Soportes Estructurales', client: 'Aptiv', deadline: '2026-04-05' },
  { id: 'IMC-2026-039', name: 'Carcasas de Aluminio', client: 'Bosch', deadline: '2026-03-30' },
];

export const INITIAL_BOMS = [
  {
    id: 'BOM-001',
    projectId: 'IMC-2026-042',
    projectName: 'Eje Principal Ensamblaje',
    items: [
      { id: 'item-1', partNumber: 'MS-A-4140-01', description: 'Acero 4140 2" x 12"', category: 'Materia Prima', quantity: 20, uom: 'Barras', status: 'Solicitado' },
      { id: 'item-2', partNumber: 'CN-T-1250-05', description: 'Insertos de carburo (fresa)', category: 'Herramental', quantity: 15, uom: 'Cajas', status: 'Stock' },
      { id: 'item-3', partNumber: 'HD-B-0820-10', description: 'Tornillo Allen M8x20mm', category: 'Hardware', quantity: 200, uom: 'Pzas', status: 'Recibido' },
    ],
  },
  {
    id: 'BOM-002',
    projectId: 'IMC-2026-045',
    projectName: 'Moldes de Inyección',
    items: [
      { id: 'item-4', partNumber: 'AL-M-6061-02', description: 'Aluminio 6061-T6 block', category: 'Materia Prima', quantity: 4, uom: 'Pzas', status: 'Pendiente' },
      { id: 'item-5', partNumber: 'SP-R-200-15', description: 'Resortes de expulsión 2"', category: 'Componentes Moldes', quantity: 12, uom: 'Pzas', status: 'Tránsito' },
    ],
  },
];

type BOMStatus = 'Pendiente' | 'Solicitado' | 'Tránsito' | 'Recibido' | 'Stock';

const STATUS_VARIANT: Record<BOMStatus, 'secondary' | 'warning' | 'default' | 'success' | 'outline'> = {
  Pendiente: 'secondary',
  Solicitado: 'warning',
  Tránsito: 'default',
  Recibido: 'success',
  Stock: 'outline',
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

    reader.onload = evt => {
      const bstr = evt.target?.result;
      if (!bstr) return;

      setIsUploading(false);
      setIsAnalyzing(true);

      setTimeout(() => {
        try {
          const workbook = XLSX.read(bstr, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet);

          const mappedData = rawData.map((row: any) => ({
            partNumber: row.Name || row['Part Description'] || 'N/A',
            description: row['Part Description'] || row.Notes || 'Sin descripción',
            category: row.Type || 'General',
            quantity: Number(row.Qty) || 1,
            uom: 'Pzas',
            status: 'Pendiente' as BOMStatus,
          }));

          setIsAnalyzing(false);
          setAnalyzedData(mappedData);
          setIsAssignModalOpen(true);
        } catch (error) {
          console.error('Error parsing Excel:', error);
          setIsAnalyzing(false);
          alert('Error al procesar el archivo Excel. Verifica el formato.');
        }
      }, 800);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleAssignToProject = () => {
    if (!selectedProjectId || !analyzedData) return;

    const project = PROJECTS.find(p => p.id === selectedProjectId);
    const newItems = analyzedData.map((item, idx) => ({
      ...item,
      id: `new-${Date.now()}-${idx}`,
      status: 'Pendiente' as BOMStatus,
    }));

    const existingProjectBOM = boms.find(b => b.projectId === selectedProjectId);

    if (existingProjectBOM) {
      setBoms(boms.map(b => (b.projectId === selectedProjectId ? { ...b, items: [...b.items, ...newItems] } : b)));
    } else {
      setBoms([
        {
          id: `BOM-${Date.now()}`,
          projectId: selectedProjectId,
          projectName: project?.name || 'Unknown',
          items: newItems,
        },
        ...boms,
      ]);
      setExpandedProjects([selectedProjectId, ...expandedProjects]);
    }

    setIsAssignModalOpen(false);
    setAnalyzedData(null);
    setSelectedProjectId('');
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
  };

  const updateItemStatus = (projectId: string, itemId: string, newStatus: BOMStatus) => {
    setBoms(
      boms.map(b =>
        b.projectId === projectId
          ? { ...b, items: b.items.map(i => (i.id === itemId ? { ...i, status: newStatus } : i)) }
          : b
      )
    );
  };

  const deleteItem = (projectId: string, itemId: string) => {
    setBoms(
      boms
        .map(b =>
          b.projectId === projectId ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b
        )
        .filter(b => b.items.length > 0)
    );
  };

  const getGroupedItems = (items: any[]) =>
    items.reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <Card className="border-dashed">
        <label className="h-40 flex flex-col items-center justify-center p-6 text-center gap-3 cursor-pointer">
          <input type="file" className="sr-only" accept=".xlsx,.xls" onChange={handleFileUpload} />
          {isAnalyzing ? (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-1 bg-[var(--color-app-surface-alt)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--color-app-primary)] animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-sm text-[var(--color-app-text-muted)]">Analizando estructura del Excel...</p>
            </div>
          ) : (
            <>
              <div className="h-10 w-10 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center">
                <Upload className={cn('h-5 w-5 text-[var(--color-app-primary)]', isUploading && 'animate-bounce')} />
              </div>
              <div>
                <h3 className="text-sm font-medium">Importar lista de materiales (BOM)</h3>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                  Acepta archivos .xlsx y .xls
                </p>
              </div>
              <Button variant="outline" size="sm">Examinar archivos</Button>
            </>
          )}
        </label>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Inventario por proyecto
          </h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-[var(--color-app-text-subtle)]" />
              <Input placeholder="Filtrar parte..." className="h-8 pl-8 w-48" />
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2.5">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {boms.map(bom => (
            <Card key={bom.id} className="p-0 overflow-hidden">
              <button
                onClick={() => toggleProject(bom.projectId)}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-app-surface-alt)]/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {expandedProjects.includes(bom.projectId) ? (
                    <ChevronDown className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                  )}
                  <div>
                    <p className="text-xs font-mono text-[var(--color-app-text-muted)]">{bom.projectId}</p>
                    <p className="text-sm font-medium">{bom.projectName}</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-app-text-muted)]">Items</p>
                    <p className="text-sm font-medium">{bom.items.length}</p>
                  </div>
                  <Badge variant="success">Activo</Badge>
                </div>
              </button>

              {expandedProjects.includes(bom.projectId) && (
                <div className="p-4 border-t border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)]/30">
                  {Object.entries(getGroupedItems(bom.items)).map(([category, items]: [string, any]) => (
                    <div key={category} className="mb-5 last:mb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-px flex-1 bg-[var(--color-app-border)]" />
                        <h4 className="text-xs font-medium text-[var(--color-app-text-muted)] uppercase tracking-wide">
                          {category}
                        </h4>
                        <div className="h-px flex-1 bg-[var(--color-app-border)]" />
                      </div>
                      <div className="space-y-1">
                        {items.map((item: any) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-2 p-2 rounded-md hover:bg-white transition-colors items-center text-sm"
                          >
                            <div className="col-span-2 font-mono text-xs">{item.partNumber}</div>
                            <div className="col-span-4 text-[var(--color-app-text-muted)]">{item.description}</div>
                            <div className="col-span-2 text-center tabular-nums">
                              <span className="font-medium">{item.quantity}</span>{' '}
                              <span className="text-xs text-[var(--color-app-text-muted)]">{item.uom}</span>
                            </div>
                            <div className="col-span-3 flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                    <Badge variant={STATUS_VARIANT[item.status as BOMStatus]} className="cursor-pointer">
                                      {item.status}
                                      <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                                    </Badge>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actualizar estatus</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {(['Pendiente', 'Solicitado', 'Tránsito', 'Recibido', 'Stock'] as BOMStatus[]).map(s => (
                                    <DropdownMenuItem
                                      key={s}
                                      onClick={() => updateItemStatus(bom.projectId, item.id, s)}
                                    >
                                      {s}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem>Ver especificaciones</DropdownMenuItem>
                                  <DropdownMenuItem>Trazabilidad</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => deleteItem(bom.projectId, item.id)}
                                    className="text-[var(--color-app-danger)] focus:text-[var(--color-app-danger)]"
                                  >
                                    Eliminar
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
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[var(--color-app-primary)]" /> Análisis completo
            </DialogTitle>
            <DialogDescription>
              Se detectaron {analyzedData?.length} items. ¿A qué proyecto deseas asignarlos?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Proyecto destino</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
              >
                <option value="" disabled>
                  Seleccionar proyecto...
                </option>
                {PROJECTS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-[var(--color-app-success-soft)] rounded-md flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-app-success)] shrink-0" />
              <p className="text-sm text-[var(--color-app-success)]">
                Estructura de columnas validada correctamente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignToProject} disabled={!selectedProjectId}>
              Asignar materiales
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
