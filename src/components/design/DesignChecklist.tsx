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
import {
  useProjects,
  useBomItems,
  getFileDownloadUrl,
  usePdfFirstPageThumbnail,
  useBatchPdfThumbnails,
} from '@/lib/api';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { BomItem } from '@/types/database';

const ITEMS_PER_PAGE = 8;

/** Resuelve signed URLs para imágenes (válidas 1 h). Bulk-load. */
function useSignedUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
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

  // Items que dependen del PDF para tener thumbnail (no tienen image_url).
  const pdfPaths = useMemo(
    () => filteredParts.filter(p => !p.image_url && p.drawing_url).map(p => p.drawing_url!),
    [filteredParts]
  );
  const { urls: pdfThumbUrls, progress: pdfBatchProgress, prime: primePdfThumbs } =
    useBatchPdfThumbnails(pdfPaths);

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Renderiza TODOS los PDFs como thumbnails antes de disparar print.
      // Sin esto, los cards salen con "Sin imagen" porque pdfjs aún no
      // termina (procesa cientos de PDFs no es instantáneo).
      await primePdfThumbs();
      // Da un tick más para que React aplique los src de las imágenes.
      await new Promise(r => setTimeout(r, 200));
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const withImageCount = filteredParts.filter(p => p.image_url || p.drawing_url).length;

  return (
    <div className="space-y-5 relative">
      {/* Estilos de impresión: cabecera compacta + páginas A4 de 2×4 = 8 piezas */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white;
            /* Vital: deja al print engine ver TODA la altura del contenido */
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          /* AppShell: el wrapper raíz tiene h-[100dvh] overflow-hidden,
             eso normalmente colapsa el print a una sola "viewport". Lo
             liberamos sólo durante impresión. */
          body #root,
          body > div,
          body main,
          body main > div,
          body main > div > div {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: auto !important;
          }
          /* Sidebar / header / drawer no deben aparecer en el PDF */
          body aside,
          body header,
          body nav {
            display: none !important;
          }
          .no-print, .screen-only { display: none !important; }
          .print-only { display: block !important; }

          /* Reset: oculta TODO menos nuestro contenedor de impresión */
          .print-root { display: block; }

          /* Header impreso: una sola tira, ~12mm */
          .print-banner {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 1.5px solid #0f172a;
            padding-bottom: 2mm;
            margin-bottom: 4mm;
          }
          .print-banner h1 {
            font-size: 11pt;
            font-weight: 700;
            margin: 0;
          }
          .print-banner .meta {
            font-size: 8pt;
            color: #475569;
            text-align: right;
          }

          /* Cada página es un grid 2×4. break-after fuerza salto. */
          .print-page {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(4, 1fr);
            gap: 4mm;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          /* Primera página: deja espacio para el banner restando ~16mm */
          .print-page.first {
            height: calc(297mm - 16mm - 8mm * 2);
          }
          .print-page:not(.first) {
            height: calc(297mm - 8mm * 2);
          }

          .print-card {
            border: 1px solid #94a3b8;
            border-radius: 2mm;
            padding: 2mm 3mm;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: white;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-card-image {
            flex: 1 1 auto;
            min-height: 0;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 1.5mm;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5mm;
          }
          .print-card-image img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .print-card-image .placeholder {
            font-size: 7pt;
            color: #94a3b8;
          }
          .print-card-part {
            font-family: ui-monospace, SFMono-Regular, monospace;
            font-weight: 700;
            font-size: 9pt;
            color: #0f172a;
          }
          .print-card-desc {
            font-size: 7.5pt;
            color: #334155;
            line-height: 1.2;
            margin-top: 0.5mm;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .print-card-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7.5pt;
            color: #475569;
            border-top: 1px solid #e2e8f0;
            padding-top: 1mm;
            margin-top: 1mm;
          }
          .print-checkbox {
            width: 3.5mm;
            height: 3.5mm;
            border: 1.2px solid #0f172a;
            border-radius: 0.8mm;
            display: inline-block;
            flex-shrink: 0;
          }
        }
      `}</style>

      {/* ── HEADER (pantalla) ────────────────────────────────────── */}
      <Card className="screen-only">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-3 w-full md:w-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Proyecto activo</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="block w-full md:w-72 h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                >
                  {projects.length === 0 && <option value="">No hay proyectos</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-5">
                <Meta icon={User} label="Cliente" value={selectedProject?.client_name || 'N/A'} />
                <Meta icon={Calendar} label="Fecha de entrega" value={deadlineStr} />
                <Meta
                  icon={ImageIcon}
                  label="Cobertura visual"
                  value={`${withImageCount} / ${filteredParts.length}`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button onClick={handleExport} disabled={isExporting}>
                <Printer className={cn('h-4 w-4 mr-1.5', isExporting && 'animate-pulse')} />
                {isExporting
                  ? pdfBatchProgress.total > 0
                    ? `Renderizando PDFs ${pdfBatchProgress.done}/${pdfBatchProgress.total}…`
                    : 'Procesando…'
                  : `Generar PDF · ${pages.length} hoja(s)`}
              </Button>
              {pdfPaths.length > 0 && (
                <p className="text-[10px] text-[var(--color-app-text-muted)] leading-tight">
                  Se renderizarán {pdfPaths.length} planos como vista previa al imprimir.
                </p>
              )}
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

      {/* ── GRID (pantalla) ──────────────────────────────────────── */}
      {filteredParts.length === 0 ? (
        <Card className="screen-only">
          <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
            {parts.length === 0
              ? 'Sin BOM cargado para este proyecto.'
              : 'No hay items que cumplan el filtro actual.'}
          </div>
        </Card>
      ) : (
        <div className="screen-only grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredParts.map(item => (
            <ChecklistCardScreen
              key={item.id}
              item={item}
              imageUrl={item.image_url ? imageUrls[item.image_url] : undefined}
              pdfThumbUrl={item.drawing_url ? pdfThumbUrls[item.drawing_url] : undefined}
              checked={!!checkedItems[item.id]}
              onToggle={() => toggleItem(item.id)}
              onZoom={url => setZoomImage(url)}
            />
          ))}
        </div>
      )}

      {/* ── VISTA DE IMPRESIÓN ───────────────────────────────────── */}
      <div className="print-only print-root">
        {/* Banner sólo en la primera página */}
        <div className="print-banner">
          <div>
            <h1>
              {selectedProject?.name ?? '—'} · {selectedProject?.id ?? ''}
            </h1>
            <div style={{ fontSize: '8pt', color: '#475569' }}>
              Checklist de producción · {filteredParts.length} piezas · Cliente:{' '}
              {selectedProject?.client_name ?? 'N/A'}
            </div>
          </div>
          <div className="meta">
            <div>Entrega: {deadlineStr}</div>
            <div>Impreso: {format(new Date(), "dd MMM yyyy HH:mm", { locale: es })}</div>
          </div>
        </div>

        {pages.map((pageItems, idx) => (
          <div key={idx} className={cn('print-page', idx === 0 && 'first')}>
            {pageItems.map(item => (
              <ChecklistCardPrint
                key={item.id}
                item={item}
                imageUrl={item.image_url ? imageUrls[item.image_url] : undefined}
                pdfThumbUrl={item.drawing_url ? pdfThumbUrls[item.drawing_url] : undefined}
              />
            ))}
          </div>
        ))}
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

function Meta({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
      <div>
        <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

interface ScreenCardProps {
  item: BomItem;
  imageUrl?: string;
  pdfThumbUrl?: string;
  checked: boolean;
  onToggle: () => void;
  onZoom: (url: string) => void;
}

function ChecklistCardScreen({ item, imageUrl, pdfThumbUrl, checked, onToggle, onZoom }: ScreenCardProps) {
  // Si no hay imagen ni thumb del padre, renderiza la primera página del PDF
  // bajo demanda (cae de useBatchPdfThumbnails al cache compartido).
  const fallback = usePdfFirstPageThumbnail(
    !imageUrl && !pdfThumbUrl ? item.drawing_url : null
  );
  const effectiveUrl = imageUrl ?? pdfThumbUrl ?? fallback ?? undefined;

  return (
    <Card className={cn('p-0 overflow-hidden transition-all', checked && 'opacity-70')}>
      <CardContent className="p-0 flex flex-col">
        <div className="relative h-40 bg-[var(--color-app-surface-alt)] overflow-hidden group">
          {effectiveUrl ? (
            <>
              <img
                src={effectiveUrl}
                alt={item.part_number}
                className="w-full h-full object-contain bg-white"
              />
              <button
                onClick={() => onZoom(effectiveUrl)}
                className="absolute bottom-2 right-2 h-7 w-7 bg-white/90 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              {!imageUrl && (pdfThumbUrl || fallback) && (
                <Badge variant="outline" className="absolute top-2 left-2 text-[10px] bg-white/90">
                  Desde PDF
                </Badge>
              )}
            </>
          ) : item.drawing_url ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-app-text-subtle)] gap-2">
              <div className="h-4 w-4 border-2 border-[var(--color-app-primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Renderizando PDF…</span>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[var(--color-app-text-subtle)] gap-2">
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Sin imagen ni plano 2D</span>
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
  pdfThumbUrl?: string;
}

function ChecklistCardPrint({ item, imageUrl, pdfThumbUrl }: PrintCardProps) {
  // El padre ya precargó todos los PDFs vía useBatchPdfThumbnails antes
  // de llamar a window.print(); aquí sólo consumimos el resultado.
  const effective = imageUrl ?? pdfThumbUrl;
  return (
    <div className="print-card">
      <div className="print-card-image">
        {effective ? (
          <img src={effective} alt={item.part_number} />
        ) : (
          <span className="placeholder">Sin imagen</span>
        )}
      </div>
      <div className="print-card-part">{item.part_number}</div>
      <div className="print-card-desc">{item.description}</div>
      <div className="print-card-bottom">
        <span>
          {item.category} · {item.quantity} {item.uom}
        </span>
        <span className="print-checkbox" />
      </div>
    </div>
  );
}
