import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Search,
  Package,
  Save,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Truck,
  Clock,
  TrendingUp,
  Factory,
  ChevronRight,
  ChevronDown,
  Eraser,
  Inbox,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useProjects,
  useBomItems,
  useBulkInsertBom,
  useUpdateBomItem,
  useDeleteBomItem,
  useDeleteProjectBom,
  summarizePurchasing,
} from '@/lib/api';
import { TableControls } from '@/components/shared/TableControls';
import { applyTableState, type TableState } from '@/lib/tableControls';
import { PURCHASING_FIELDS } from '@/lib/bomFields';
import type { BomItem, BomStatus } from '@/types/database';

const STATUS_VARIANT: Record<BomStatus, 'secondary' | 'warning' | 'default' | 'success' | 'outline'> = {
  Pendiente: 'secondary',
  Solicitado: 'warning',
  Tránsito: 'default',
  Recibido: 'success',
  Stock: 'outline',
};
const STATUSES: BomStatus[] = ['Pendiente', 'Solicitado', 'Tránsito', 'Recibido', 'Stock'];

interface ParsedRow {
  part_number: string;
  description: string;
  category: string;
  quantity: number;
  uom: string;
  unit_price: number | null;
  supplier_name: string | null;
  requisition_date: string | null;
  delivery_date: string | null;
  notes: string | null;
  production_relevant: boolean;
}

/** Categorías que NO van a producción por defecto al importar. */
const NON_PROD_CATEGORIES = ['Hardware', 'Consumible', 'Consumibles', 'Insumo', 'Insumos'];

/**
 * Convierte fechas de Excel (serial number o string) a YYYY-MM-DD. Devuelve
 * null si no se pudo parsear — evita guardar basura en la base.
 */
function toIsoDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    // Excel serial date (días desde 1899-12-30)
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isValid(d) ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // dd/mm/yyyy ó dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isValid(d) ? d.toISOString().slice(0, 10) : null;
}

function toNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[,$\s]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Mapea un row arbitrario de la hoja a la estructura interna. Reconoce
 * varios encabezados típicos en español/inglés.
 */
function mapRow(row: Record<string, unknown>): ParsedRow {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
      if (found && row[found] != null && row[found] !== '') return row[found];
    }
    return null;
  };
  const category = String(get('category', 'categoria', 'categoría', 'tipo', 'type') ?? 'General');
  const prodRaw = get('production_relevant', 'produccion', 'producción', 'a fabricar', 'fabricar');
  const productionRelevant: boolean =
    prodRaw != null
      ? ['true', '1', 'sí', 'si', 'yes', 'x'].includes(String(prodRaw).toLowerCase())
      : !NON_PROD_CATEGORIES.some(c => category.toLowerCase().includes(c.toLowerCase()));
  return {
    part_number: String(get('part_number', 'part number', 'no parte', 'no. parte', 'numero de parte', 'parte', 'sku', 'name') ?? 'N/A'),
    description: String(get('description', 'descripcion', 'descripción', 'part description', 'detalle') ?? 'Sin descripción'),
    category,
    quantity: Number(get('quantity', 'cantidad', 'qty', 'cant') ?? 1) || 1,
    uom: String(get('uom', 'unidad', 'um') ?? 'Pzas'),
    unit_price: toNumber(get('unit_price', 'precio', 'precio unitario', 'price', 'costo')),
    supplier_name: ((): string | null => {
      const v = get('supplier', 'proveedor', 'vendor');
      return v != null ? String(v) : null;
    })(),
    requisition_date: toIsoDate(get('requisition_date', 'fecha requisicion', 'fecha requisición', 'fecha req', 'req date')),
    delivery_date: toIsoDate(get('delivery_date', 'fecha entrega', 'eta', 'delivery', 'fecha promesa')),
    notes: ((): string | null => {
      const v = get('notes', 'notas', 'observaciones', 'nota');
      return v != null ? String(v) : null;
    })(),
    production_relevant: productionRelevant,
  };
}

interface Props {
  /** Si se pasa, el selector se oculta y el tracker se ata a este proyecto. */
  projectId?: string;
}

/**
 * Módulo de seguimiento de compras por proyecto.
 *
 * Flujo: 1) elige proyecto, 2) sube Excel/CSV con la BOM (o agrega manual),
 * 3) gestiona inline cada compra (precio, fechas, proveedor, estado).
 * El % de items recibidos alimenta el progreso del frente de Compras
 * que se muestra en el dashboard del proyecto y en el master plan.
 */
export function ProjectPurchaseTracker({ projectId: lockedProjectId }: Props) {
  const { data: projects } = useProjects();
  const { data: allItems, refetch: refetchBom } = useBomItems();
  const { insert: bulkInsert, loading: inserting } = useBulkInsertBom();
  const { update: updateItem } = useUpdateBomItem();
  const { remove: deleteItem } = useDeleteBomItem();
  const { removeAll: deleteAllBom, loading: deletingAll } = useDeleteProjectBom();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId ?? '');
  // Estado de filtros/agrupación configurable (tipo Airtable). Por defecto
  // agrupa por categoría para conservar el comportamiento previo.
  const [tableState, setTableState] = useState<TableState>({
    search: '',
    groupBy: 'category',
    filters: [],
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BomItem | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [productionOnly, setProductionOnly] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const projectItems = useMemo(
    () => (selectedProjectId ? allItems.filter(i => i.project_id === selectedProjectId) : []),
    [allItems, selectedProjectId]
  );

  // El toggle "Sólo producción" se aplica antes del motor genérico.
  const baseItems = useMemo(
    () => (productionOnly ? projectItems.filter(i => i.production_relevant) : projectItems),
    [projectItems, productionOnly]
  );

  const { filtered: filteredItems, groups } = useMemo(
    () => applyTableState(baseItems, PURCHASING_FIELDS, tableState),
    [baseItems, tableState]
  );

  /** Categorías disponibles (para el datalist de cada fila). */
  const categoryNames = useMemo(
    () => Array.from(new Set(projectItems.map(i => i.category || 'Sin categoría'))).sort(),
    [projectItems]
  );

  const summary = useMemo(() => summarizePurchasing(projectItems), [projectItems]);
  const productionCount = useMemo(
    () => projectItems.filter(i => i.production_relevant).length,
    [projectItems]
  );

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const flash = (text: string, tone: 'success' | 'error' = 'success') => {
    setFeedback({ tone, text });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ─── Upload Excel / CSV ───────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);

    try {
      const buf = await file.arrayBuffer();
      // xlsx detecta CSV automáticamente cuando hay extensión .csv
      const workbook = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      if (raw.length === 0) {
        setParseError('El archivo está vacío o no se pudo leer.');
        return;
      }
      const parsed = raw.map(mapRow);
      setParsedRows(parsed);
    } catch (err) {
      console.error(err);
      setParseError(`No se pudo procesar el archivo: ${(err as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!parsedRows || !selectedProjectId) return;
    try {
      await bulkInsert(
        parsedRows.map(r => ({
          project_id: selectedProjectId,
          part_number: r.part_number,
          description: r.description,
          category: r.category,
          quantity: r.quantity,
          uom: r.uom,
          unit_price: r.unit_price,
          supplier_name: r.supplier_name,
          requisition_date: r.requisition_date,
          delivery_date: r.delivery_date,
          notes: r.notes,
          production_relevant: r.production_relevant,
        }))
      );
      await refetchBom();
      flash(`Se importaron ${parsedRows.length} materiales al proyecto.`);
      setParsedRows(null);
    } catch (err) {
      flash((err as Error).message || 'No se pudo importar.', 'error');
    }
  };

  // ─── Edición inline de cada campo ─────────────────────────────────────
  const handlePatch = async (item: BomItem, patch: Partial<BomItem>) => {
    try {
      await updateItem(item.id, patch);
      await refetchBom();
    } catch (err) {
      flash((err as Error).message || 'No se pudo guardar.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteItem(confirmDelete.id);
      await refetchBom();
      setConfirmDelete(null);
      flash('Item eliminado.');
    } catch (err) {
      flash((err as Error).message || 'No se pudo eliminar.', 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedProjectId) return;
    try {
      const n = await deleteAllBom(selectedProjectId);
      await refetchBom();
      setConfirmDeleteAll(false);
      flash(`Se eliminaron ${n} materiales del proyecto.`);
    } catch (err) {
      flash((err as Error).message || 'No se pudo eliminar la lista.', 'error');
    }
  };

  // ─── Plantilla descargable ────────────────────────────────────────────
  const downloadTemplate = () => {
    const sample = [
      {
        part_number: 'MS-A-4140-01',
        description: 'Acero 4140 redondo 2"x12"',
        category: 'Materia Prima',
        quantity: 10,
        uom: 'Barras',
        unit_price: 4200,
        supplier: 'Aceros del Bajío',
        requisition_date: '2026-06-12',
        delivery_date: '2026-06-22',
        production_relevant: 'sí',
        notes: 'Va a producción',
      },
      {
        part_number: 'HD-B-0820-10',
        description: 'Tornillo Allen M8x20mm',
        category: 'Hardware',
        quantity: 200,
        uom: 'Pzas',
        unit_price: 4.5,
        supplier: 'Tornillos Mexicanos',
        requisition_date: '2026-06-12',
        delivery_date: '2026-06-22',
        production_relevant: 'no',
        notes: 'Sólo compra, no entra al plan',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOM');
    XLSX.writeFile(wb, 'plantilla_bom_compras.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Selector de proyecto + upload */}
      <Card>
        <CardContent className="p-5 space-y-4">
          {!lockedProjectId && (
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-[var(--color-app-text-muted)]">
                Proyecto
              </label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
              >
                <option value="">Seleccionar proyecto…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name} ({p.client_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedProjectId && (
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <label className="flex-1 flex items-center gap-3 p-4 rounded-md border-2 border-dashed border-[var(--color-app-border)] hover:border-[var(--color-app-primary)]/40 hover:bg-[var(--color-app-surface-alt)]/40 cursor-pointer transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={handleFile}
                />
                <div className="h-9 w-9 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center shrink-0">
                  <Upload className="h-4 w-4 text-[var(--color-app-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Importar BOM (Excel o CSV)</p>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                    Columnas reconocidas: part_number, description, category, quantity, uom, unit_price,
                    supplier, requisition_date, delivery_date, notes.
                  </p>
                </div>
              </label>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1.5" /> Plantilla
              </Button>
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* KPIs por proyecto — desglose por estatus de compra */}
      {activeProject && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
          <KpiCard
            icon={TrendingUp}
            label="Avance de compras"
            value={`${summary.progress_pct}%`}
            sub={`${summary.received_items} de ${summary.total_items}`}
            progress={summary.progress_pct}
          />
          <KpiCard
            icon={Inbox}
            label="Pendientes"
            value={String(summary.pending_items)}
            sub="Sin solicitar"
          />
          <KpiCard
            icon={FileSpreadsheet}
            label="Solicitados"
            value={String(summary.requested_items)}
            sub="En cotización / PO"
          />
          <KpiCard
            icon={Truck}
            label="En tránsito"
            value={String(summary.in_transit_items)}
            sub="Camino al taller"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Recibidos"
            value={String(summary.received_items)}
            sub="En almacén / stock"
            tone="success"
          />
          <KpiCard
            icon={Clock}
            label="Atrasadas"
            value={String(summary.late_items)}
            sub={summary.late_items > 0 ? 'Requieren seguimiento' : 'Todo al día'}
            tone={summary.late_items > 0 ? 'warning' : 'success'}
          />
        </div>
      )}

      {/* Tabla de items agrupada por categoría */}
      {activeProject && (
        <Card className="p-0">
          <div className="p-4 border-b border-[var(--color-app-border)] flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                {activeProject.name}{' '}
                <span className="text-[var(--color-app-text-muted)] font-normal">
                  · {activeProject.client_name}
                </span>
              </h3>
              <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                {projectItems.length} materiales en seguimiento · {productionCount} marcados para producción
              </p>
            </div>
          </div>

          {/* Controles configurables tipo Airtable */}
          <div className="px-4 pb-3">
            <TableControls
              fields={PURCHASING_FIELDS}
              state={tableState}
              onChange={setTableState}
              searchPlaceholder="Buscar parte, proveedor o categoría…"
              rightSlot={
                <>
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
                    Sólo producción
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteAll(true)}
                    disabled={projectItems.length === 0 || deletingAll}
                    className="text-[var(--color-app-danger)] hover:text-[var(--color-app-danger)]"
                  >
                    <Eraser className="h-4 w-4 mr-1.5" /> Eliminar BOM
                  </Button>
                </>
              }
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {projectItems.length === 0
                ? 'Aún no hay materiales registrados para este proyecto. Importa una BOM con el cargador de arriba.'
                : productionOnly
                ? 'No hay items marcados como "producción" con ese filtro. Activa el toggle en cada fila para mandarlos a fabricación.'
                : 'Sin resultados con ese filtro.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-app-surface-alt)]/60 text-xs text-[var(--color-app-text-muted)] uppercase">
                  <tr>
                    <th className="text-left p-2 font-medium">No. parte</th>
                    <th className="text-left p-2 font-medium">Descripción</th>
                    <th className="text-left p-2 font-medium">Grupo</th>
                    <th className="text-center p-2 font-medium" title="Va a producción">
                      <Factory className="h-3.5 w-3.5 inline" />
                    </th>
                    <th className="text-right p-2 font-medium">Cantidad</th>
                    <th className="text-right p-2 font-medium">Precio unit.</th>
                    <th className="text-left p-2 font-medium">Proveedor</th>
                    <th className="text-left p-2 font-medium">Fecha req.</th>
                    <th className="text-left p-2 font-medium">Fecha entrega</th>
                    <th className="text-left p-2 font-medium">Estado</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => {
                    // Grupo único "Todos" (sin agrupar) → filas planas, sin cabecera.
                    const isAll = group.key === '__all__';
                    const collapsed = collapsedGroups.has(group.key);
                    const items = group.items;
                    const groupProd = items.filter(i => i.production_relevant).length;
                    const groupReceived = items.filter(
                      i => i.bom_status === 'Recibido' || i.bom_status === 'Stock'
                    ).length;
                    return (
                      <React.Fragment key={group.key}>
                        {!isAll && (
                          <tr
                            className="bg-[var(--color-app-surface-alt)]/80 cursor-pointer hover:bg-[var(--color-app-surface-alt)]"
                            onClick={() => toggleGroup(group.key)}
                          >
                            <td colSpan={11} className="p-2">
                              <div className="flex items-center gap-2 text-xs">
                                {collapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                <span className="font-semibold uppercase tracking-wide text-[var(--color-app-text)]">
                                  {group.label}
                                </span>
                                <Badge variant="outline" className="ml-1">
                                  {items.length} items
                                </Badge>
                                <Badge variant="success">{groupReceived} recibidos</Badge>
                                {groupProd > 0 && (
                                  <Badge variant="default" className="gap-1">
                                    <Factory className="h-2.5 w-2.5" /> {groupProd} a fabricar
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        {(isAll || !collapsed) &&
                          items.map(item => (
                            <BomRow
                              key={item.id}
                              item={item}
                              categories={categoryNames}
                              onPatch={patch => handlePatch(item, patch)}
                              onDelete={() => setConfirmDelete(item)}
                            />
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal preview de import */}
      <Dialog open={!!parsedRows} onOpenChange={open => !open && setParsedRows(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[var(--color-app-primary)]" />
              Vista previa de importación
            </DialogTitle>
            <DialogDescription>
              {parsedRows?.length ?? 0} filas detectadas. Se asignarán a{' '}
              <strong>{activeProject?.name ?? '—'}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto border border-[var(--color-app-border)] rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-[var(--color-app-surface-alt)] sticky top-0">
                <tr>
                  <th className="text-left p-2">Parte</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Precio</th>
                  <th className="text-left p-2">Proveedor</th>
                  <th className="text-left p-2">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows?.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-app-border)]">
                    <td className="p-2 font-mono">{r.part_number}</td>
                    <td className="p-2">{r.description}</td>
                    <td className="p-2 text-right tabular-nums">
                      {r.quantity} {r.uom}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.unit_price != null ? `$${r.unit_price.toLocaleString('es-MX')}` : '—'}
                    </td>
                    <td className="p-2">{r.supplier_name ?? '—'}</td>
                    <td className="p-2">{r.delivery_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParsedRows(null)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={inserting}>
              <Save className="h-4 w-4 mr-1.5" />
              {inserting ? 'Importando…' : 'Confirmar e importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado masivo */}
      <Dialog open={confirmDeleteAll} onOpenChange={open => !open && setConfirmDeleteAll(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--color-app-danger)]" />
              Eliminar BOM completo del proyecto
            </DialogTitle>
            <DialogDescription>
              Se eliminarán <strong>{projectItems.length} materiales</strong> de{' '}
              <strong>{activeProject?.name}</strong>, incluyendo precios, proveedores y fechas de
              entrega. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAll(false)} disabled={deletingAll}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deletingAll}>
              <Eraser className="h-4 w-4 mr-1.5" />
              {deletingAll ? 'Eliminando…' : 'Eliminar todo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado individual */}
      <Dialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--color-app-danger)]" />
              Eliminar material
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{confirmDelete?.part_number}</strong> del proyecto? Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componentes auxiliares ─────────────────────────────────────────────

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  progress?: number;
  tone?: 'warning' | 'success';
}

function KpiCard({ icon: Icon, label, value, sub, progress, tone }: KpiProps) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
            <p
              className={
                tone === 'warning'
                  ? 'text-xl font-semibold mt-1 text-[var(--color-app-warning)]'
                  : tone === 'success'
                  ? 'text-xl font-semibold mt-1 text-[var(--color-app-success)]'
                  : 'text-xl font-semibold mt-1'
              }
            >
              {value}
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
            <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
          </div>
        </div>
        <p className="text-xs text-[var(--color-app-text-muted)] mt-2">{sub}</p>
        {progress != null && <Progress value={progress} className="h-1 mt-2" />}
      </CardContent>
    </Card>
  );
}

interface RowProps {
  item: BomItem;
  categories: string[];
  onPatch: (patch: Partial<BomItem>) => void;
  onDelete: () => void;
}

/**
 * Fila con edición inline. Guarda en onBlur para no spamear updates a la
 * base con cada keystroke. El estado del item se cambia via select.
 */
function BomRow({ item, categories, onPatch, onDelete }: RowProps) {
  const datalistId = `bom-categories-${item.project_id}`;
  const [draft, setDraft] = useState({
    part_number: item.part_number,
    description: item.description ?? '',
    category: item.category,
    quantity: item.quantity,
    unit_price: item.unit_price ?? 0,
    supplier_name: item.supplier_name ?? '',
    requisition_date: item.requisition_date ?? '',
    delivery_date: item.delivery_date ?? '',
  });

  React.useEffect(() => {
    setDraft({
      part_number: item.part_number,
      description: item.description ?? '',
      category: item.category,
      quantity: item.quantity,
      unit_price: item.unit_price ?? 0,
      supplier_name: item.supplier_name ?? '',
      requisition_date: item.requisition_date ?? '',
      delivery_date: item.delivery_date ?? '',
    });
  }, [item.id, item.updated_at]);

  const commit = (patch: Partial<BomItem>) => {
    // Sólo guarda si realmente cambió respecto al item original
    const patchObj = patch as unknown as Record<string, unknown>;
    const itemObj = item as unknown as Record<string, unknown>;
    const dirty: Record<string, unknown> = {};
    Object.keys(patchObj).forEach(k => {
      if (patchObj[k] !== itemObj[k]) dirty[k] = patchObj[k];
    });
    if (Object.keys(dirty).length === 0) return;
    onPatch(dirty as Partial<BomItem>);
  };

  const isLate =
    item.delivery_date != null &&
    item.delivery_date < new Date().toISOString().slice(0, 10) &&
    item.bom_status !== 'Recibido' &&
    item.bom_status !== 'Stock';

  return (
    <tr className="border-t border-[var(--color-app-border)] hover:bg-[var(--color-app-surface-alt)]/40">
      <td className="p-2">
        <input
          value={draft.part_number}
          onChange={e => setDraft(d => ({ ...d, part_number: e.target.value }))}
          onBlur={() => commit({ part_number: draft.part_number })}
          className="w-32 px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none font-mono text-xs"
        />
      </td>
      <td className="p-2">
        <input
          value={draft.description}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          onBlur={() => commit({ description: draft.description || null })}
          className="w-56 px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none"
        />
      </td>
      <td className="p-2">
        <input
          list={datalistId}
          value={draft.category}
          onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
          onBlur={() => commit({ category: draft.category || 'General' })}
          placeholder="Categoría / grupo"
          className="w-32 px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none text-xs"
        />
        <datalist id={datalistId}>
          {categories.map(c => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </td>
      <td className="p-2 text-center">
        <label className="inline-flex items-center justify-center cursor-pointer" title="Va a producción">
          <input
            type="checkbox"
            checked={item.production_relevant}
            onChange={e => onPatch({ production_relevant: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-app-primary)] cursor-pointer"
          />
        </label>
      </td>
      <td className="p-2 text-right">
        <input
          type="number"
          value={draft.quantity}
          onChange={e => setDraft(d => ({ ...d, quantity: Number(e.target.value) || 0 }))}
          onBlur={() => commit({ quantity: draft.quantity })}
          className="w-20 px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none text-right tabular-nums"
        />
        <span className="text-xs text-[var(--color-app-text-muted)] ml-1">{item.uom}</span>
      </td>
      <td className="p-2 text-right">
        <input
          type="number"
          value={draft.unit_price}
          onChange={e => setDraft(d => ({ ...d, unit_price: Number(e.target.value) || 0 }))}
          onBlur={() => commit({ unit_price: draft.unit_price || null })}
          step="0.01"
          className="w-24 px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none text-right tabular-nums"
        />
      </td>
      <td className="p-2">
        <input
          value={draft.supplier_name}
          onChange={e => setDraft(d => ({ ...d, supplier_name: e.target.value }))}
          onBlur={() => commit({ supplier_name: draft.supplier_name || null })}
          className="w-36 px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none"
        />
      </td>
      <td className="p-2">
        <input
          type="date"
          value={draft.requisition_date}
          onChange={e => setDraft(d => ({ ...d, requisition_date: e.target.value }))}
          onBlur={() => commit({ requisition_date: draft.requisition_date || null })}
          className="px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none text-xs"
        />
      </td>
      <td className="p-2">
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={draft.delivery_date}
            onChange={e => setDraft(d => ({ ...d, delivery_date: e.target.value }))}
            onBlur={() => commit({ delivery_date: draft.delivery_date || null })}
            className="px-2 py-1 rounded border border-transparent hover:border-[var(--color-app-border)] focus:border-[var(--color-app-primary)] focus:bg-white focus:outline-none text-xs"
          />
          {isLate && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-[var(--color-app-warning)] shrink-0"
              aria-label="Entrega atrasada"
            />
          )}
        </div>
      </td>
      <td className="p-2">
        <select
          value={item.bom_status}
          onChange={e => onPatch({ bom_status: e.target.value as BomStatus })}
          className="px-2 py-1 rounded border border-[var(--color-app-border-strong)] bg-white text-xs"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Badge variant={STATUS_VARIANT[item.bom_status]} className="ml-1 hidden md:inline-flex">
          {item.bom_status}
        </Badge>
      </td>
      <td className="p-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-[var(--color-app-danger)]" />
          <span className="sr-only">Eliminar</span>
        </Button>
      </td>
    </tr>
  );
}

// Helper exportado para formato de fecha si hace falta en otros lados
export function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return format(parseISO(s), 'dd MMM yyyy', { locale: es });
  } catch {
    return s;
  }
}
