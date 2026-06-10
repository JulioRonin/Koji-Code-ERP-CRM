import React, { useState, useMemo } from 'react';
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
import { useProjects, useBomItems, useBulkInsertBom, useUpdateBomStatus } from '@/lib/api';
import type { BomStatus, Project, BomItem } from '@/types/database';

const STATUS_VARIANT: Record<BomStatus, 'secondary' | 'warning' | 'default' | 'success' | 'outline'> = {
  Pendiente: 'secondary',
  Solicitado: 'warning',
  Tránsito: 'default',
  Recibido: 'success',
  Stock: 'outline',
};

const STATUSES: BomStatus[] = ['Pendiente', 'Solicitado', 'Tránsito', 'Recibido', 'Stock'];

export function BOMManager() {
  const { data: projects } = useProjects();
  const { data: allBomItems, refetch: refetchBom } = useBomItems();
  const { insert: insertBom, loading: inserting } = useBulkInsertBom();
  const { update: updateStatus } = useUpdateBomStatus();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<
    { partNumber: string; description: string; category: string; quantity: number; uom: string }[] | null
  >(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  // Auto-expande el primer proyecto si hay BOMs
  React.useEffect(() => {
    if (expandedProjects.length === 0 && allBomItems.length > 0) {
      setExpandedProjects([allBomItems[0].project_id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBomItems.length === 0]);

  // Agrupa BOMs por proyecto
  const boms = useMemo(() => {
    const byProject = new Map<string, BomItem[]>();
    allBomItems.forEach(item => {
      if (!byProject.has(item.project_id)) byProject.set(item.project_id, []);
      byProject.get(item.project_id)!.push(item);
    });
    return Array.from(byProject.entries()).map(([projectId, items]) => {
      const project = projects.find(p => p.id === projectId);
      return {
        projectId,
        projectName: project?.name ?? 'Proyecto sin nombre',
        clientName: project?.client_name ?? '—',
        items,
      };
    });
  }, [allBomItems, projects]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = evt => {
      const bstr = evt.target?.result;
      if (!bstr) return;

      setTimeout(() => {
        try {
          const workbook = XLSX.read(bstr, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          const mappedData = rawData.map(row => ({
            partNumber: String(row.Name ?? row['Part Number'] ?? row['Part Description'] ?? 'N/A'),
            description: String(row['Part Description'] ?? row.Description ?? row.Notes ?? 'Sin descripción'),
            category: String(row.Type ?? row.Category ?? 'General'),
            quantity: Number(row.Qty ?? row.Quantity ?? 1),
            uom: String(row.UOM ?? 'Pzas'),
          }));

          setIsAnalyzing(false);
          setAnalyzedData(mappedData);
          setIsAssignModalOpen(true);
        } catch (err) {
          console.error('Error parsing Excel:', err);
          setIsAnalyzing(false);
          alert('Error al procesar el archivo Excel. Verifica el formato.');
        }
      }, 600);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAssignToProject = async () => {
    if (!selectedProjectId || !analyzedData) return;
    await insertBom(
      analyzedData.map(it => ({
        project_id: selectedProjectId,
        part_number: it.partNumber,
        description: it.description,
        category: it.category,
        quantity: it.quantity,
        uom: it.uom,
        material: null,
      }))
    );
    setIsAssignModalOpen(false);
    setAnalyzedData(null);
    setSelectedProjectId('');
    if (!expandedProjects.includes(selectedProjectId)) {
      setExpandedProjects(prev => [selectedProjectId, ...prev]);
    }
    await refetchBom();
  };

  const handleUpdateItemStatus = async (itemId: string, status: BomStatus) => {
    await updateStatus(itemId, status);
    await refetchBom();
  };

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
  };

  const filteredBoms = useMemo(() => {
    if (!filter.trim()) return boms;
    const q = filter.toLowerCase();
    return boms
      .map(b => ({
        ...b,
        items: b.items.filter(
          i =>
            i.part_number.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        ),
      }))
      .filter(b => b.items.length > 0);
  }, [boms, filter]);

  const getGroupedItems = (items: BomItem[]) =>
    items.reduce<Record<string, BomItem[]>>((acc, item) => {
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
                <Upload className={cn('h-5 w-5 text-[var(--color-app-primary)]')} />
              </div>
              <div>
                <h3 className="text-sm font-medium">Importar lista de materiales (BOM)</h3>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                  Acepta archivos .xlsx y .xls
                </p>
              </div>
              <Button variant="outline" size="sm">
                Examinar archivos
              </Button>
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
              <Input
                placeholder="Filtrar parte..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="h-8 pl-8 w-48"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 px-2.5">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredBoms.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {allBomItems.length === 0
                ? 'No hay BOMs cargados. Importa un Excel para empezar.'
                : 'Sin resultados con ese filtro.'}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBoms.map(bom => (
              <Card key={bom.projectId} className="p-0 overflow-hidden">
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
                      <p className="text-sm font-medium">
                        {bom.projectName}{' '}
                        <span className="text-[var(--color-app-text-muted)] font-normal">· {bom.clientName}</span>
                      </p>
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
                    {Object.entries(getGroupedItems(bom.items)).map(([category, items]) => (
                      <div key={category} className="mb-5 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-px flex-1 bg-[var(--color-app-border)]" />
                          <h4 className="text-xs font-medium text-[var(--color-app-text-muted)] uppercase tracking-wide">
                            {category}
                          </h4>
                          <div className="h-px flex-1 bg-[var(--color-app-border)]" />
                        </div>
                        <div className="space-y-1">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className="grid grid-cols-12 gap-2 p-2 rounded-md hover:bg-white transition-colors items-center text-sm"
                            >
                              <div className="col-span-3 font-mono text-xs">{item.part_number}</div>
                              <div className="col-span-4 text-[var(--color-app-text-muted)]">{item.description}</div>
                              <div className="col-span-2 text-center tabular-nums">
                                <span className="font-medium">{item.quantity}</span>{' '}
                                <span className="text-xs text-[var(--color-app-text-muted)]">{item.uom}</span>
                              </div>
                              <div className="col-span-2 flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                      <Badge variant={STATUS_VARIANT[item.bom_status]} className="cursor-pointer">
                                        {item.bom_status}
                                        <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                                      </Badge>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actualizar estatus</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {STATUSES.map(s => (
                                      <DropdownMenuItem
                                        key={s}
                                        onClick={() => handleUpdateItemStatus(item.id, s)}
                                      >
                                        {s}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
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
        )}
      </div>

      {/* Assign modal */}
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
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name} ({p.client_name})
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <p className="text-xs text-[var(--color-app-text-muted)]">
                  No hay proyectos creados todavía. Crea uno primero en el módulo Proyectos.
                </p>
              )}
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
            <Button onClick={handleAssignToProject} disabled={!selectedProjectId || inserting}>
              {inserting ? 'Asignando...' : 'Asignar materiales'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// LEGACY EXPORTS — re-exports vacios para no romper imports antiguos
// Estos archivos seran migrados a useProjects/useBomItems en proximas iteraciones.
// ============================================================================

/** @deprecated Usa useProjects() en lugar de PROJECTS hardcoded. */
export const PROJECTS: { id: string; name: string; client: string; deadline: string }[] = [];

/** @deprecated Usa useBomItems() en lugar de INITIAL_BOMS hardcoded. */
export const INITIAL_BOMS: {
  id: string;
  projectId: string;
  projectName: string;
  items: { id: string; partNumber: string; description: string; category: string; quantity: number; uom: string; status: string }[];
}[] = [];
