import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  Calendar,
  User,
  Search,
  Printer,
  Maximize2,
  Image as ImageIcon,
  FileText,
  Factory,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useProjects, useBomItems, getFileDownloadUrl } from '@/lib/api';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { BomItem } from '@/types/database';

const ITEMS_PER_PAGE = 8;

/** Resuelve signed URLs (válidas 1 h) para una lista de storage paths. */
function useSignedUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // Stringify para que el array no dispare un re-fetch en cada render
  const key = paths.filter(Boolean).sort().join('|');
  useEffect(() => {
    let cancelled = false;
    const uniq = Array.from(new Set(paths.filter(Boolean) as string[]));
    if (uniq.length === 0) {
      setUrls({});
      return;
    }
    Promise.all(uniq.map(p => getFileDownloadUrl(p).then(u => [p, u] as const))).then(pairs => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      pairs.forEach(([p, u]) => {
        if (u) next[p] = u;
      });
      setUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/** Reparte items en páginas de N. */
function chunkPages<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

export function DesignChecklist() {
  const { data: projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [productionOnly, setProductionOnly] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const { data: parts } = useBomItems(selectedProjectId || undefined);

  const deadlineStr = selectedProject?.deadline
    ? (() => {
        try {
          const d = parseISO(selectedProject.deadline);
          return isValid(d) ? format(d, 'dd MMM yyyy', { locale: es }) : 'N/A';
        } catch {
          return 'N/A';
        }
      })()
    : 'N/A';

  const filteredParts = useMemo(() => {
    let list = parts;
    if (productionOnly) list = list.filter(p => p.production_relevant !== false);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        p =>
          p.part_number.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [parts, productionOnly, searchTerm]);

  const pages = useMemo(() => chunkPages(filteredParts, ITEMS_PER_PAGE), [filteredParts]);
  const imageUrls = useSignedUrls(filteredParts.map(p => p.image_url));

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 300);
  };

  const withImageCount = filteredParts.filter(p => p.image_url).length;

  return (
    <div className="space-y-5 relative">
      {/* Print styles: 8 piezas (2 col × 4 filas) por página A4 */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page {
            page-break-after: always;
            break-after: page;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(4, 1fr);
            gap: 6mm;
            height: 277mm; /* A4 - margins */
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .print-header {
            page-break-before: avoid;
            break-before: avoid;
          }
          .print-card {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 4mm;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: white;
          }
          .print-card-image {
            height: 38mm;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .print-card-image img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .print-card-image .placeholder {
            font-size: 8pt;
            color: #94a3b8;
          }
          .print-card-meta {
            margin-top: 2mm;
          }
          .print-card-part {
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-weight: 600;
            font-size: 9pt;
          }
          .print-card-desc {
            font-size: 8pt;
            color: #475569;
            line-height: 1.25;
            margin-top: 1mm;
          }
          .print-card-bottom {
            margin-top: auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8pt;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 2mm;
          }
          .print-checkbox {
            width: 4mm;
            height: 4mm;
            border: 1.2px solid #475569;
            border-radius: 1mm;
            display: inline-block;
          }
          /* Oculta el grid en pantalla para no duplicar contenido */
          .screen-only { display: block; }
          .screen-grid { display: none !important; }
        }
        @media screen {
          .print-page { display: contents; }
          .screen-grid { display: grid; }
        }
      `}</style>

      <div id="print-area" className="space-y-5">
        {/* Header (visible en pantalla y como cabecera de la primera página) */}
        <Card className="print-header">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-3 w-full md:w-auto">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium no-print">Proyecto activo</label>
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="block w-full md:w-72 h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] no-print"
                  >
                    {projects.length === 0 && <option value="">No hay proyectos</option>}
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="hidden print:block">
                    <p className="text-xs text-[var(--color-app-text-muted)] uppercase tracking-wide">
                      Checklist de producción
                    </p>
                    <p className="text-base font-semibold">
                      {selectedProject?.id} — {selectedProject?.name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-5">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    <div>
                      <p className="text-xs text-[var(--color-app-text-muted)]">Cliente</p>
                      <p className="text-sm font-medium">{selectedProject?.client_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    <div>
                      <p className="text-xs text-[var(--color-app-text-muted)]">Fecha de entrega</p>
                      <p className="text-sm font-medium">{deadlineStr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    <div>
                      <p className="text-xs text-[var(--color-app-text-muted)]">Cobertura imágenes</p>
                      <p className="text-sm font-medium">
                        {withImageCount} / {filteredParts.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full md:w-auto no-print">
                <Button onClick={handleExport} disabled={isExporting}>
                  <Printer className={cn('h-4 w-4 mr-1.5', isExporting && 'animate-pulse')} />
                  {isExporting ? 'Procesando…' : `Generar PDF (8/pág)`}
                </Button>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                  <Input
                    placeholder="Buscar parte…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <label
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs px-2.5 h-9 rounded-md border cursor-pointer transition-colors',
                    productionOnly
                      ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
                      : 'border-[var(--color-app-border-strong)] hover:bg-[var(--color-app-surface-alt)]'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={productionOnly}
                    onChange={e => setProductionOnly(e.target.checked)}
                    className="sr-only"
                  />
                  <Factory className="h-3.5 w-3.5" />
                  Sólo producción
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredParts.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {parts.length === 0
                ? 'Sin BOM cargado para este proyecto.'
                : 'No hay items que cumplan el filtro actual.'}
            </div>
          </Card>
        ) : (
          <>
            {/* Vista en pantalla: grid flexible */}
            <div className="screen-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredParts.map(item => (
                <ChecklistCardScreen
                  key={item.id}
                  item={item}
                  imageUrl={item.image_url ? imageUrls[item.image_url] : undefined}
                  checked={!!checkedItems[item.id]}
                  onToggle={() => toggleItem(item.id)}
                  onZoom={url => setZoomImage(url)}
                />
              ))}
            </div>

            {/* Vista para imprimir: páginas A4 de 2×4 (8 piezas) */}
            <div className="hidden print:block">
              {pages.map((pageItems, idx) => (
                <div key={idx} className="print-page">
                  {pageItems.map(item => (
                    <ChecklistCardPrint
                      key={item.id}
                      item={item}
                      imageUrl={item.image_url ? imageUrls[item.image_url] : undefined}
                    />
                  ))}
                </div>
              ))}
              <div className="print-footer text-[8pt] text-[var(--color-app-text-muted)] text-center mt-2">
                {selectedProject?.id} · {filteredParts.length} piezas · página {pages.length} de {pages.length}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-10 cursor-zoom-out no-print"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl max-h-full rounded-lg overflow-hidden">
            <img
              src={zoomImage}
              alt="Zoom"
              className="max-w-full max-h-full object-contain bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────

interface ScreenCardProps {
  item: BomItem;
  imageUrl?: string;
  checked: boolean;
  onToggle: () => void;
  onZoom: (url: string) => void;
}

function ChecklistCardScreen({ item, imageUrl, checked, onToggle, onZoom }: ScreenCardProps) {
  return (
    <Card className={cn('p-0 overflow-hidden transition-all', checked && 'opacity-70')}>
      <CardContent className="p-0 flex flex-col">
        <div className="relative h-40 bg-[var(--color-app-surface-alt)] overflow-hidden group">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt={item.part_number} className="w-full h-full object-contain" />
              <button
                onClick={() => onZoom(imageUrl)}
                className="absolute bottom-2 right-2 h-7 w-7 bg-white/90 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-app-text-subtle)] gap-2">
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Sin imagen</span>
              <span className="text-[10px] text-[var(--color-app-text-muted)]">
                Súbela en Planos 2D / 3D
              </span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-sm font-mono font-medium truncate">{item.part_number}</p>
              <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5 leading-snug">
                {item.description}
              </p>
            </div>
            <button
              onClick={onToggle}
              className={cn(
                'p-1 rounded-md transition-colors no-print',
                checked
                  ? 'text-[var(--color-app-success)]'
                  : 'text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-text)]'
              )}
            >
              {checked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--color-app-border)]">
            <Badge variant="secondary">{item.category}</Badge>
            <Badge variant="outline">
              {item.quantity} {item.uom}
            </Badge>
            {item.drawing_url && (
              <Badge variant="default" className="gap-1">
                <FileText className="h-2.5 w-2.5" /> 2D
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PrintCardProps {
  item: BomItem;
  imageUrl?: string;
}

function ChecklistCardPrint({ item, imageUrl }: PrintCardProps) {
  return (
    <div className="print-card">
      <div className="print-card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={item.part_number} />
        ) : (
          <span className="placeholder">Sin imagen</span>
        )}
      </div>
      <div className="print-card-meta">
        <div className="print-card-part">{item.part_number}</div>
        <div className="print-card-desc">{item.description}</div>
      </div>
      <div className="print-card-bottom">
        <span>
          {item.category} · {item.quantity} {item.uom}
        </span>
        <span className="print-checkbox" />
      </div>
    </div>
  );
}
