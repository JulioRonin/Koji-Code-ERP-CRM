import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  Eye,
  Box,
  FileText,
  Factory,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useProjects,
  useBomItems,
  useAttachDrawings,
  useDetachDrawing,
  getFileDownloadUrl,
} from '@/lib/api';
import type { BomItem } from '@/types/database';

interface MatchResult {
  matched: { partNumber: string; itemId: string; fileName: string }[];
  unmatched: string[];
}

/**
 * Gestor de planos 2D y modelos 3D por proyecto.
 *
 * Flujo:
 *   1. Elige proyecto. El módulo carga la BOM (sólo items marcados para producción).
 *   2. Arrastra los PDFs / STEP. El nombre del archivo se intenta matchear
 *      contra el part_number de cada item (case-insensitive, substring).
 *   3. Lo que matchea se sube a Storage y la URL queda guardada en
 *      bom_items.drawing_url (o model_url). Lo que no matchea se reporta.
 *   4. Producción ve los iconos de plano 2D/3D enlazados al PDF.
 */
export function DesignFileManager() {
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const { data: parts, refetch: refetchParts } = useBomItems(selectedProjectId || undefined);
  const { attach, loading: attaching } = useAttachDrawings();
  const { detach } = useDetachDrawing();

  const [searchTerm, setSearchTerm] = useState('');
  const [productionOnly, setProductionOnly] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<MatchResult | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const filteredParts = useMemo(() => {
    let items = parts;
    if (productionOnly) items = items.filter(p => p.production_relevant !== false);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        p =>
          p.part_number.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [parts, productionOnly, searchTerm]);

  const groupedParts = useMemo(() => {
    const groups = new Map<string, BomItem[]>();
    filteredParts.forEach(p => {
      const c = p.category || 'Sin categoría';
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(p);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredParts]);

  const flash = (text: string, tone: 'success' | 'error' = 'success') => {
    setFeedback({ tone, text });
    setTimeout(() => setFeedback(null), 3000);
  };

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleBulkUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'drawing' | 'model'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedProjectId) return;
    try {
      const result = await attach({
        projectId: selectedProjectId,
        files: Array.from(files),
        kind,
        bomItems: parts.map(p => ({ id: p.id, part_number: p.part_number })),
      });
      setLastResult(result);
      await refetchParts();
      const ok = result.matched.length;
      const fail = result.unmatched.length;
      if (ok > 0 && fail === 0) flash(`${ok} archivo(s) asociado(s) correctamente.`);
      else if (ok > 0 && fail > 0) flash(`${ok} asociado(s) · ${fail} sin match.`, 'error');
      else flash('Ningún archivo coincidió con un número de parte.', 'error');
    } catch (err) {
      flash((err as Error).message || 'No se pudo procesar la carga.', 'error');
    } finally {
      if (drawingInputRef.current) drawingInputRef.current.value = '';
      if (modelInputRef.current) modelInputRef.current.value = '';
    }
  };

  const openFile = async (storagePath: string) => {
    const url = await getFileDownloadUrl(storagePath);
    if (url) window.open(url, '_blank', 'noopener');
    else flash('No se pudo abrir el archivo (¿Supabase Storage configurado?).', 'error');
  };

  const handleDetach = async (item: BomItem, kind: 'drawing' | 'model') => {
    try {
      await detach(item.id, kind);
      await refetchParts();
      flash('Referencia eliminada.');
    } catch (err) {
      flash((err as Error).message || 'No se pudo quitar la referencia.', 'error');
    }
  };

  // ─── Pantalla inicial: selector de proyecto ───────────────────────────
  if (!selectedProjectId) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-[var(--color-app-text-muted)]" />
          Selección de proyecto
        </h2>
        {projects.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              No hay proyectos creados. Crea uno en el módulo Proyectos para empezar.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <Card
                key={p.id}
                className="p-0 hover:border-[var(--color-app-primary)]/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedProjectId(p.id)}
              >
                <div className="p-5 space-y-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {p.id}
                  </Badge>
                  <h3 className="text-base font-medium">{p.name}</h3>
                  <p className="text-xs text-[var(--color-app-text-muted)]">{p.client_name}</p>
                  <p className="text-[10px] text-[var(--color-app-primary)] flex items-center gap-1 pt-2">
                    Gestionar planos <ChevronRight className="h-3 w-3" />
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const totalProd = parts.filter(p => p.production_relevant !== false);
  const withDrawing = totalProd.filter(p => p.drawing_url).length;
  const withModel = totalProd.filter(p => p.model_url).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelectedProjectId('')}>
            ← Volver
          </Button>
          <div>
            <h2 className="text-base font-semibold">{selectedProject?.name}</h2>
            <p className="text-xs text-[var(--color-app-text-muted)] font-mono">
              {selectedProject?.id} · {totalProd.length} piezas en producción · {withDrawing}{' '}
              con plano 2D · {withModel} con modelo 3D
            </p>
          </div>
        </div>
      </div>

      {/* Drop zones */}
      <div className="grid gap-3 md:grid-cols-2">
        <DropZone
          accept=".pdf"
          inputRef={drawingInputRef}
          title="Planos 2D (PDF)"
          subtitle="El nombre del PDF debe contener el número de parte (ej. MS-A-4140-01.pdf)."
          icon={FileText}
          onFiles={e => handleBulkUpload(e, 'drawing')}
          busy={attaching}
        />
        <DropZone
          accept=".step,.stp,.igs,.iges,.x_t,.x_b,.sldprt,.f3d,.stl"
          inputRef={modelInputRef}
          title="Modelos 3D (STEP, IGS, etc.)"
          subtitle="Mismo criterio de match: filename contiene el part_number."
          icon={Box}
          onFiles={e => handleBulkUpload(e, 'model')}
          busy={attaching}
        />
      </div>

      {feedback && (
        <div
          className={
            feedback.tone === 'success'
              ? 'flex items-center gap-2 p-3 rounded-md bg-[var(--color-app-success-soft)] text-sm text-[var(--color-app-success)]'
              : 'flex items-center gap-2 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)]'
          }
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Resultado de la última carga */}
      {lastResult && (lastResult.matched.length > 0 || lastResult.unmatched.length > 0) && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Resultado del match</p>
            <button
              onClick={() => setLastResult(null)}
              className="text-xs text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]"
            >
              Cerrar
            </button>
          </div>
          {lastResult.matched.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-app-success)] mb-1.5">
                ✓ Asociados ({lastResult.matched.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                {lastResult.matched.map(m => (
                  <div
                    key={m.fileName}
                    className="p-2 rounded bg-[var(--color-app-success-soft)] flex items-center gap-2"
                  >
                    <Badge variant="success" className="font-mono">
                      {m.partNumber}
                    </Badge>
                    <span className="truncate text-[var(--color-app-text-muted)]">
                      {m.fileName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lastResult.unmatched.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-app-warning)] mb-1.5">
                ⚠ Sin match ({lastResult.unmatched.length}) — renómbralos para que contengan el
                número de parte.
              </p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {lastResult.unmatched.map(f => (
                  <Badge key={f} variant="warning" className="font-mono">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder="Buscar parte o descripción…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <label
          className={
            'inline-flex items-center gap-1.5 text-xs px-2.5 h-9 rounded-md border cursor-pointer transition-colors ' +
            (productionOnly
              ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
              : 'border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-surface-alt)]')
          }
        >
          <input
            type="checkbox"
            checked={productionOnly}
            onChange={e => setProductionOnly(e.target.checked)}
            className="sr-only"
          />
          <Factory className="h-3.5 w-3.5" />
          Sólo piezas de producción
        </label>
      </div>

      {/* Tabla agrupada por categoría */}
      <Card className="p-0">
        {filteredParts.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)] flex flex-col items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[var(--color-app-text-subtle)]" />
            {parts.length === 0
              ? 'Sin BOM en este proyecto. Súbela desde Compras → Por proyecto.'
              : 'Sin resultados con ese filtro.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-app-surface-alt)]/60 text-xs text-[var(--color-app-text-muted)] uppercase">
                <tr>
                  <th className="text-left p-2 font-medium">No. parte</th>
                  <th className="text-left p-2 font-medium">Descripción</th>
                  <th className="text-center p-2 font-medium">Cant.</th>
                  <th className="text-center p-2 font-medium">Plano 2D</th>
                  <th className="text-center p-2 font-medium">Modelo 3D</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {groupedParts.map(([category, items]) => {
                  const collapsed = collapsedGroups.has(category);
                  const cat2D = items.filter(i => i.drawing_url).length;
                  const cat3D = items.filter(i => i.model_url).length;
                  return (
                    <React.Fragment key={category}>
                      <tr
                        className="bg-[var(--color-app-surface-alt)]/80 cursor-pointer hover:bg-[var(--color-app-surface-alt)]"
                        onClick={() => toggleGroup(category)}
                      >
                        <td colSpan={6} className="p-2">
                          <div className="flex items-center gap-2 text-xs">
                            {collapsed ? (
                              <ChevronRight className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                            <span className="font-semibold uppercase tracking-wide">
                              {category}
                            </span>
                            <Badge variant="outline">{items.length} items</Badge>
                            <Badge variant="default">{cat2D} con 2D</Badge>
                            {cat3D > 0 && <Badge variant="secondary">{cat3D} con 3D</Badge>}
                          </div>
                        </td>
                      </tr>
                      {!collapsed &&
                        items.map(item => (
                          <tr
                            key={item.id}
                            className="border-t border-[var(--color-app-border)] hover:bg-[var(--color-app-surface-alt)]/40"
                          >
                            <td className="p-2 font-mono text-xs">{item.part_number}</td>
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-center tabular-nums text-[var(--color-app-text-muted)]">
                              {item.quantity} {item.uom}
                            </td>
                            <td className="p-2 text-center">
                              {item.drawing_url ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1"
                                    onClick={() => openFile(item.drawing_url!)}
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Ver
                                  </Button>
                                  <button
                                    onClick={() => handleDetach(item, 'drawing')}
                                    title="Quitar plano"
                                    className="p-1 rounded hover:bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <Badge variant="secondary">Pendiente</Badge>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {item.model_url ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1"
                                    onClick={() => openFile(item.model_url!)}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <button
                                    onClick={() => handleDetach(item, 'model')}
                                    title="Quitar modelo"
                                    className="p-1 rounded hover:bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <Badge variant="secondary">Pendiente</Badge>
                              )}
                            </td>
                            <td className="p-2" />
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

interface DropZoneProps {
  accept: string;
  inputRef: React.RefObject<HTMLInputElement>;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  busy: boolean;
  onFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function DropZone({ accept, inputRef, title, subtitle, icon: Icon, busy, onFiles }: DropZoneProps) {
  return (
    <Card className="border-dashed">
      <label className="p-5 flex items-center gap-3 cursor-pointer">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={onFiles}
          disabled={busy}
        />
        <div className="h-10 w-10 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center shrink-0">
          {busy ? (
            <div className="h-4 w-4 border-2 border-[var(--color-app-primary)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="h-5 w-5 text-[var(--color-app-primary)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> {title}
          </p>
          <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">{subtitle}</p>
        </div>
      </label>
    </Card>
  );
}
