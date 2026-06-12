import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  Eye,
  Box,
  Image as ImageIcon,
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
  useAssignDrawingManually,
  getFileDownloadUrl,
} from '@/lib/api';
import type { AttachDrawingsResult } from '@/lib/api/projectFiles';
import type { BomItem } from '@/types/database';

interface PendingFile {
  /** Identificador estable para React keys (filename + size + lastMod). */
  key: string;
  file: File;
  suggestions: { itemId: string; partNumber: string; score: number }[];
  /** Item destino elegido por el usuario (id), inicialmente la mejor sugerencia. */
  assignedItemId: string;
  /** 'drawing' / 'model' / 'image' — para subirlo al campo correcto. */
  kind: 'drawing' | 'model' | 'image';
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
  const { assign: assignOne, loading: assigning } = useAssignDrawingManually();

  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<AttachDrawingsResult | null>(null);
  /** Cola de archivos sin match — el usuario los asigna a mano desde el panel. */
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingFilter, setPendingFilter] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const filteredParts = useMemo(() => {
    let items = parts;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        p =>
          p.part_number.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [parts, searchTerm]);

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
    kind: 'drawing' | 'model' | 'image'
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

      // Mete los archivos sin match al panel de asignación manual.
      // Conservamos los File objects en memoria (no se subieron todavía).
      if (fail > 0) {
        setPendingFiles(prev => [
          ...prev,
          ...result.unmatched.map(u => ({
            key: `${u.file.name}-${u.file.size}-${u.file.lastModified}`,
            file: u.file,
            suggestions: u.suggestions,
            assignedItemId: u.suggestions[0]?.itemId ?? '',
            kind,
          })),
        ]);
      }

      if (ok > 0 && fail === 0) flash(`${ok} archivo(s) asociado(s) correctamente.`);
      else if (ok > 0 && fail > 0) flash(`${ok} asociado(s) · ${fail} sin match — asígnalos abajo.`, 'error');
      else flash(`${fail} archivo(s) sin match — asígnalos manualmente abajo.`, 'error');
    } catch (err) {
      flash((err as Error).message || 'No se pudo procesar la carga.', 'error');
    } finally {
      if (drawingInputRef.current) drawingInputRef.current.value = '';
      if (modelInputRef.current) modelInputRef.current.value = '';
    }
  };

  const handleAssignManual = async (pending: PendingFile) => {
    if (!pending.assignedItemId || !selectedProjectId) return;
    const partNumber = parts.find(p => p.id === pending.assignedItemId)?.part_number;
    if (!partNumber) {
      flash('No se encontró el part number destino.', 'error');
      return;
    }
    try {
      await assignOne(pending.file, pending.assignedItemId, partNumber, selectedProjectId, pending.kind);
      await refetchParts();
      setPendingFiles(prev => prev.filter(p => p.key !== pending.key));
      flash(`${pending.file.name} → ${partNumber}`);
    } catch (err) {
      flash((err as Error).message || 'No se pudo asignar.', 'error');
    }
  };

  const removePending = (key: string) => {
    setPendingFiles(prev => prev.filter(p => p.key !== key));
  };

  const filteredPending = useMemo(() => {
    if (!pendingFilter.trim()) return pendingFiles;
    const q = pendingFilter.toLowerCase();
    return pendingFiles.filter(p => p.file.name.toLowerCase().includes(q));
  }, [pendingFiles, pendingFilter]);

  const openFile = async (storagePath: string) => {
    const url = await getFileDownloadUrl(storagePath);
    if (url) window.open(url, '_blank', 'noopener');
    else flash('No se pudo abrir el archivo (¿Supabase Storage configurado?).', 'error');
  };

  const handleDetach = async (item: BomItem, kind: 'drawing' | 'model' | 'image') => {
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
          subtitle="Filename con el número de parte (ej. MS-A-4140-01.pdf)."
          icon={FileText}
          onFiles={e => handleBulkUpload(e, 'drawing')}
          busy={attaching}
        />
        <DropZone
          accept=".step,.stp,.igs,.iges,.x_t,.x_b,.sldprt,.f3d,.stl"
          inputRef={modelInputRef}
          title="Modelos 3D"
          subtitle="STEP, IGS, SLDPRT — match por nombre."
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

      {/* Auto-matched (último batch) */}
      {lastResult && lastResult.matched.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--color-app-success)]">
              ✓ Asociados automáticamente ({lastResult.matched.length})
            </p>
            <button
              onClick={() => setLastResult(null)}
              className="text-xs text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
            {lastResult.matched.map(m => (
              <div
                key={m.fileName}
                className="p-2 rounded bg-[var(--color-app-success-soft)] flex items-center gap-2"
              >
                <Badge variant="success" className="font-mono">
                  {m.partNumber}
                </Badge>
                <span className="truncate text-[var(--color-app-text-muted)]">{m.fileName}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Panel de asignación manual — archivos sin match */}
      {pendingFiles.length > 0 && (
        <Card className="p-0 border-[var(--color-app-warning)]/40">
          <div className="p-4 border-b border-[var(--color-app-border)] bg-[var(--color-app-warning-soft)]/40 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--color-app-warning)]" />
                Asignar manualmente · {pendingFiles.length} archivos sin match
              </p>
              <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                Cada PDF se quedó sin part_number similar. Elige el item del BOM al que corresponde
                (te sugerimos los 5 más parecidos) y dale <strong>Asignar</strong>. Los archivos
                viven en tu navegador hasta que los asignes o quites.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                <Input
                  placeholder="Filtrar archivos…"
                  value={pendingFilter}
                  onChange={e => setPendingFilter(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingFiles([])}
                className="text-[var(--color-app-danger)]"
              >
                Limpiar lista
              </Button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto divide-y divide-[var(--color-app-border)]">
            {filteredPending.map(pending => (
              <PendingFileRow
                key={pending.key}
                pending={pending}
                allParts={parts}
                busy={assigning}
                onChangeAssignment={itemId =>
                  setPendingFiles(prev =>
                    prev.map(p => (p.key === pending.key ? { ...p, assignedItemId: itemId } : p))
                  )
                }
                onAssign={() => handleAssignManual(pending)}
                onRemove={() => removePending(pending.key)}
              />
            ))}
            {filteredPending.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--color-app-text-muted)]">
                No hay archivos pendientes que coincidan con ese filtro.
              </div>
            )}
          </div>
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
                              {item.production_quantity ?? item.quantity} {item.uom}
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
                                <SingleDrawingUpload
                                  item={item}
                                  projectId={selectedProjectId}
                                  onUploaded={refetchParts}
                                />
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

/**
 * Botón compacto para subir UN plano 2D directamente al item de esa fila,
 * sin pasar por el match por nombre. Útil cuando el archivo no tiene el
 * número de parte en el filename o cuando hay que rectificar una falta
 * puntual.
 */
function SingleDrawingUpload({
  item,
  projectId,
  onUploaded,
}: {
  item: BomItem;
  projectId: string;
  onUploaded: () => void | Promise<void>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { assign, loading } = useAssignDrawingManually();
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await assign(file, item.id, item.part_number, projectId, 'drawing');
      await onUploaded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        title={`Subir el plano 2D de ${item.part_number}`}
      >
        <Upload className="h-3.5 w-3.5" />
        {loading ? 'Subiendo…' : 'Subir 2D'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleChange}
      />
      {error && (
        <span
          className="text-[10px] text-[var(--color-app-danger)] max-w-[140px] truncate"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Thumbnail de 48x48 de la imagen del checklist. Resuelve el signed URL
 * de manera diferida (sólo al montar) para no bloquear la tabla.
 */
function ImageThumb({ path, alt, onRemove }: { path: string; alt: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    getFileDownloadUrl(path).then(u => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return (
    <div className="inline-flex items-center justify-center gap-1.5">
      {url ? (
        <img
          src={url}
          alt={alt}
          className="h-10 w-10 rounded object-cover border border-[var(--color-app-border)]"
        />
      ) : (
        <div className="h-10 w-10 rounded bg-[var(--color-app-surface-alt)] animate-pulse" />
      )}
      <button
        onClick={onRemove}
        title="Quitar imagen"
        className="p-1 rounded hover:bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

interface PendingRowProps {
  pending: PendingFile;
  allParts: BomItem[];
  busy: boolean;
  onChangeAssignment: (itemId: string) => void;
  onAssign: () => void;
  onRemove: () => void;
}

/**
 * Fila de asignación manual para un archivo sin match. Muestra el filename,
 * un dropdown con las 5 mejores sugerencias por similitud, fallback a "buscar
 * en todo el BOM" con un datalist + input, y botón Asignar.
 */
function PendingFileRow({ pending, allParts, busy, onChangeAssignment, onAssign, onRemove }: PendingRowProps) {
  const [showAll, setShowAll] = useState(false);
  const [customSearch, setCustomSearch] = useState('');

  // Texto a mostrar para la asignación actual
  const currentPart = allParts.find(p => p.id === pending.assignedItemId);

  // Cuando el usuario tipea en el modo "buscar en todo el BOM", filtramos
  // dinámicamente. Tope a 30 para no congelar el render con BOMs gigantes.
  const customMatches = useMemo(() => {
    if (!showAll || !customSearch.trim()) return [];
    const q = customSearch.toLowerCase();
    return allParts
      .filter(
        p =>
          p.part_number.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [showAll, customSearch, allParts]);

  return (
    <div className="p-3 grid grid-cols-12 gap-3 items-center hover:bg-[var(--color-app-surface-alt)]/30">
      <div className="col-span-12 md:col-span-4 flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        <span className="text-xs font-mono truncate" title={pending.file.name}>
          {pending.file.name}
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {pending.kind === 'drawing' ? '2D' : '3D'}
        </Badge>
      </div>

      <div className="col-span-12 md:col-span-6 space-y-1.5">
        {!showAll ? (
          <select
            value={pending.assignedItemId}
            onChange={e => onChangeAssignment(e.target.value)}
            className="w-full h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-xs"
          >
            {pending.suggestions.length === 0 && (
              <option value="">Sin sugerencias — busca en todo el BOM</option>
            )}
            {pending.suggestions.map(s => {
              const part = allParts.find(p => p.id === s.itemId);
              const pct = Math.round(s.score * 100);
              return (
                <option key={s.itemId} value={s.itemId}>
                  {s.partNumber} {part?.description ? `· ${part.description}` : ''} {pct > 0 ? `(${pct}%)` : ''}
                </option>
              );
            })}
          </select>
        ) : (
          <div className="space-y-1.5">
            <Input
              placeholder="Buscar número de parte o descripción…"
              value={customSearch}
              onChange={e => setCustomSearch(e.target.value)}
              className="h-8 text-xs"
            />
            {customMatches.length > 0 && (
              <select
                value={pending.assignedItemId}
                onChange={e => onChangeAssignment(e.target.value)}
                className="w-full h-8 px-2 rounded border border-[var(--color-app-border-strong)] bg-white text-xs"
              >
                <option value="">Elige…</option>
                {customMatches.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.part_number} · {p.description ?? ''}
                  </option>
                ))}
              </select>
            )}
            {currentPart && (
              <p className="text-[10px] text-[var(--color-app-text-muted)]">
                Seleccionado: <strong className="font-mono">{currentPart.part_number}</strong>
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-[10px] text-[var(--color-app-primary)] hover:underline"
        >
          {showAll ? 'Volver a sugerencias' : 'Buscar en todo el BOM…'}
        </button>
      </div>

      <div className="col-span-12 md:col-span-2 flex justify-end gap-1.5">
        <Button
          size="sm"
          onClick={onAssign}
          disabled={!pending.assignedItemId || busy}
          className="h-8"
        >
          Asignar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-[var(--color-app-danger)]"
          title="Descartar archivo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
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
