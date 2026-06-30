import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Printer,
  Upload,
  FileCode2,
  CheckCircle2,
  Send,
  Mail,
  FolderKanban,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useQuote,
  useQuoteItems,
  useUpdateQuote,
  useSaveQuoteItems,
  useMaterialPrices,
  useCreateProject,
  useBulkInsertBom,
  useInventoryItems,
  applyInventoryMovement,
  computeQuoteItem,
  computeQuoteTotals,
} from '@/lib/api';
import type { Quote, QuoteItem, QuoteStatus } from '@/types/database';
import { QuoteDocument } from '@/components/quotes/QuoteDocument';
import { useCompany } from '@/contexts/CompanyContext';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

const statusBadge: Record<QuoteStatus, 'secondary' | 'default' | 'success' | 'destructive' | 'outline' | 'warning'> = {
  Borrador:   'secondary',
  Enviada:    'default',
  Aprobada:   'success',
  Rechazada:  'destructive',
  Convertida: 'outline',
  Expirada:   'warning',
};

/** Row editable en memoria; espejo de QuoteItem sin quote_id/created_at. */
type DraftItem = Omit<QuoteItem, 'quote_id' | 'created_at'>;

function emptyItem(machineRate: number): DraftItem {
  return {
    id: '',
    part_number: '',
    description: '',
    quantity: 1,
    material_price_id: null,
    material_name: null,
    inventory_item_id: null,
    material_qty: 0,
    material_unit_cost: 0,
    machining_hours: 0,
    machine_rate: machineRate,
    extra_cost: 0,
    margin_pct: null,
    drawing_file: null,
    unit_price: 0,
    line_total: 0,
    sort_order: 0,
  };
}

export function QuoteBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, refetch: refetchQuote } = useQuote(id);
  const { data: savedItems, loading: loadingItems } = useQuoteItems(id);
  const { data: materialPrices } = useMaterialPrices();
  const { data: inventory } = useInventoryItems();
  const { company } = useCompany();
  const { update: updateQuote } = useUpdateQuote();
  const { save: saveItems, loading: saving } = useSaveQuoteItems();
  const { create: createProject } = useCreateProject();
  const { insert: insertBom } = useBulkInsertBom();

  const [items, setItems] = useState<DraftItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Hidrata items guardados una sola vez
  useEffect(() => {
    if (loadingItems || hydrated) return;
    setItems(savedItems.map(({ quote_id: _q, created_at: _c, ...rest }) => rest));
    setHydrated(true);
  }, [loadingItems, savedItems, hydrated]);

  // Cotización simple (venta de insumos): sin margen/costeo; precio directo.
  const simple = company.quote_simple === true;
  const marginDefault = simple ? 0 : (quote?.margin_pct ?? 30);
  const machineRate = quote?.machine_rate_per_hour ?? 650;
  const taxPct = quote?.tax_pct ?? 16;

  // Recalcula precios derivados de cada draft (en render, no en estado).
  // En modo simple el precio unitario es el capturado (extra_cost) sin margen.
  const computedItems: DraftItem[] = useMemo(
    () =>
      items.map(it => {
        const { unitPrice, lineTotal } = computeQuoteItem({
          material_qty: simple ? 0 : it.material_qty,
          material_unit_cost: simple ? 0 : it.material_unit_cost,
          machining_hours: simple ? 0 : it.machining_hours,
          machine_rate: simple ? 0 : it.machine_rate,
          extra_cost: it.extra_cost,
          margin_pct: simple ? 0 : (it.margin_pct ?? marginDefault),
          quantity: it.quantity,
        });
        return { ...it, unit_price: unitPrice, line_total: lineTotal };
      }),
    [items, marginDefault, simple]
  );

  const totals = useMemo(
    () => computeQuoteTotals(computedItems as QuoteItem[], taxPct),
    [computedItems, taxPct]
  );

  const patchItem = (index: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setDirty(true);
  };

  const addItem = () => {
    setItems(prev => [...prev, emptyItem(machineRate)]);
    setDirty(true);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const selectMaterial = (index: number, priceId: string) => {
    const price = materialPrices.find(p => p.id === priceId);
    patchItem(index, {
      material_price_id: priceId || null,
      material_name: price?.material ?? null,
      material_unit_cost: price?.unit_price ?? 0,
    });
  };

  // Liga la partida a un producto del inventario: autorrellena descripción, no.
  // de parte y costo (como "extra" por pieza). El stock se descuenta al aprobar.
  const selectInventory = (index: number, invId: string) => {
    if (!invId) {
      patchItem(index, { inventory_item_id: null });
      return;
    }
    const it = inventory.find(x => x.id === invId);
    if (!it) return;
    const cur = items[index];
    patchItem(index, {
      inventory_item_id: invId,
      part_number: cur.part_number || it.sku || it.name,
      description: cur.description || it.name,
      // En modo simple el precio = precio de venta; en costeo = costo del producto.
      extra_cost: simple ? it.unit_price : it.unit_cost,
    });
  };

  const handleSave = async () => {
    if (!quote) return;
    setSaveError(null);
    try {
      await saveItems(quote.id, computedItems, taxPct);
      await refetchQuote();
      setDirty(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (e) {
      setSaveError((e as Error).message || 'No se pudo guardar la cotización.');
    }
  };

  const handleEmail = () => {
    if (!quote) return;
    const brand = company.commercial_name || company.legal_name || 'KANRI';
    const subject = `Cotización ${quote.id} — ${brand}`;
    const body = [
      `Estimado(a) ${quote.client_name},`,
      '',
      `Le compartimos la cotización ${quote.id} correspondiente a "${quote.project_name}".`,
      `Total: ${money(totals.total)} ${quote.currency} (IVA incluido).`,
      quote.delivery_time ? `Tiempo de entrega: ${quote.delivery_time}.` : '',
      `Vigencia: ${quote.valid_until ?? '30 días naturales'}.`,
      '',
      'Adjunte el PDF generado con el botón "Documento" antes de enviar.',
      '',
      'Saludos cordiales,',
      brand,
      company.phone ?? '',
      company.email ?? '',
    ].filter(Boolean).join('\n');
    const to = quote.client_email ?? '';
    window.location.href =
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleStatusChange = async (status: QuoteStatus) => {
    if (!quote) return;

    // Al aprobar por primera vez, descuenta del inventario las partidas ligadas.
    if (status === 'Aprobada' && !quote.inventory_deducted) {
      const linked = computedItems.filter(it => it.inventory_item_id && it.quantity > 0);
      if (linked.length > 0) {
        const ok = window.confirm(
          `Esta cotización tiene ${linked.length} partida(s) ligada(s) al inventario.\n` +
          `Al aprobarla se descontará el stock correspondiente. ¿Continuar?`
        );
        if (!ok) return;
        try {
          for (const it of linked) {
            await applyInventoryMovement(
              it.inventory_item_id as string,
              'salida',
              it.quantity,
              `Cotización ${quote.id}`,
              quote.id
            );
          }
        } catch (e) {
          window.alert(`No se pudo descontar el inventario: ${(e as Error).message}`);
          return;
        }
        await updateQuote(quote.id, { status, inventory_deducted: true });
        await refetchQuote();
        return;
      }
    }

    await updateQuote(quote.id, { status });
    await refetchQuote();
  };

  const handleHeaderChange = async (patch: Partial<Quote>) => {
    if (!quote) return;
    await updateQuote(quote.id, patch);
    await refetchQuote();
    setDirty(true);
  };

  /** Importa listado de componentes desde Excel (Name/Part Number, Description, Qty, Material). */
  const handleComponentsImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        const imported: DraftItem[] = rows.map(row => {
          const materialName = String(row.Material ?? row.material ?? '').trim();
          const price = materialPrices.find(
            p => materialName && p.material.toLowerCase().includes(materialName.toLowerCase())
          );
          return {
            ...emptyItem(machineRate),
            part_number: String(row.Name ?? row['Part Number'] ?? row['No. Parte'] ?? 'N/A'),
            description: String(row['Part Description'] ?? row.Description ?? row['Descripción'] ?? '') || null,
            quantity: Number(row.Qty ?? row.Quantity ?? row.Cantidad ?? 1),
            material_price_id: price?.id ?? null,
            material_name: price?.material ?? (materialName || null),
            material_unit_cost: price?.unit_price ?? 0,
          };
        });
        setItems(prev => [...prev, ...imported]);
        setDirty(true);
      } catch (err) {
        alert(`Error al leer el Excel: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /** Asocia planos 2D a partidas por coincidencia de nombre de archivo. */
  const handleDrawingsUpload = (files: FileList) => {
    const names = Array.from(files).map(f => f.name);
    setItems(prev =>
      prev.map(it => {
        const match = names.find(
          n => it.part_number && n.toLowerCase().includes(it.part_number.toLowerCase())
        );
        return match ? { ...it, drawing_file: match } : it;
      })
    );
    // Los que no coincidieron, se asignan al primer item sin plano
    const unmatched = names.filter(
      n => !items.some(it => it.part_number && n.toLowerCase().includes(it.part_number.toLowerCase()))
    );
    if (unmatched.length > 0) {
      setItems(prev => {
        const next = [...prev];
        let u = 0;
        for (let i = 0; i < next.length && u < unmatched.length; i++) {
          if (!next[i].drawing_file) {
            next[i] = { ...next[i], drawing_file: unmatched[u++] };
          }
        }
        return next;
      });
    }
    setDirty(true);
  };

  const handleConvertToProject = async () => {
    if (!quote) return;
    const project = await createProject({
      name: quote.project_name,
      client_name: quote.client_name,
      description: `Generado desde cotización ${quote.id}. ${quote.notes ?? ''}`.trim(),
      start_date: format(new Date(), 'yyyy-MM-dd'),
      deadline: format(addDays(new Date(), 45), 'yyyy-MM-dd'),
    });
    if (computedItems.length > 0) {
      await insertBom(
        computedItems.map(it => ({
          project_id: project.id,
          part_number: it.part_number,
          description: it.description,
          category: 'General',
          quantity: it.quantity,
          uom: 'Pzas',
          material: it.material_name,
        }))
      );
    }
    await updateQuote(quote.id, { status: 'Convertida', converted_project_id: project.id });
    navigate(`/projects/${project.id}`);
  };

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-app-text-muted)]">Cotización no encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/quotes')}>
          ← Volver a cotizaciones
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" onClick={() => navigate('/quotes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-semibold truncate">{quote.project_name}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                    <Badge variant={statusBadge[quote.status]} className="cursor-pointer">
                      {quote.status}
                      <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(['Borrador', 'Enviada', 'Aprobada', 'Rechazada', 'Expirada'] as QuoteStatus[]).map(s => (
                    <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
              <span className="font-mono">{quote.id}</span> · {quote.client_name}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowDocument(true)} disabled={computedItems.length === 0}>
            <Printer className="h-4 w-4 mr-1.5" /> Documento
          </Button>
          <Button variant="outline" onClick={handleEmail} disabled={computedItems.length === 0} title={quote.client_email ? `Enviar a ${quote.client_email}` : 'Agrega el correo del cliente'}>
            <Mail className="h-4 w-4 mr-1.5" /> Enviar por correo
          </Button>
          {quote.status === 'Aprobada' && (
            <Button variant="outline" onClick={handleConvertToProject}>
              <FolderKanban className="h-4 w-4 mr-1.5" /> Convertir a proyecto
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {savedMsg ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            {saving ? 'Guardando...' : savedMsg ? 'Guardado' : 'Guardar'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="p-3 rounded-md bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Cliente y entrega */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cliente y condiciones</CardTitle>
          <CardDescription>Aparecen en el documento PDF y el correo al cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">Cliente</label>
              <Input
                defaultValue={quote.client_name}
                onBlur={e => handleHeaderChange({ client_name: e.target.value || quote.client_name })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">Correo del cliente</label>
              <Input
                type="email"
                placeholder="cliente@empresa.com"
                defaultValue={quote.client_email ?? ''}
                onBlur={e => handleHeaderChange({ client_email: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">Tiempo de entrega</label>
              <Input
                placeholder="Ej. 15 días hábiles"
                defaultValue={quote.delivery_time ?? ''}
                onBlur={e => handleHeaderChange({ delivery_time: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5 md:row-span-2">
              <label className="text-xs text-[var(--color-app-text-muted)]">Notas de la cotización</label>
              <Textarea
                rows={4}
                placeholder="Condiciones especiales, alcance, exclusiones…"
                defaultValue={quote.notes ?? ''}
                onBlur={e => handleHeaderChange({ notes: e.target.value || null })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parámetros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Parámetros de cotización</CardTitle>
          <CardDescription>Aplican a todas las partidas salvo override individual.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {!simple && (
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--color-app-text-muted)]">Margen (%)</label>
                <Input
                  type="number"
                  defaultValue={quote.margin_pct}
                  onBlur={e => handleHeaderChange({ margin_pct: Number(e.target.value) || 30 })}
                />
              </div>
            )}
            {!simple && (
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--color-app-text-muted)]">Tarifa máquina ($/hr)</label>
                <Input
                  type="number"
                  defaultValue={quote.machine_rate_per_hour}
                  onBlur={e => handleHeaderChange({ machine_rate_per_hour: Number(e.target.value) || 650 })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">Vigencia hasta</label>
              <Input
                type="date"
                defaultValue={quote.valid_until ?? ''}
                onBlur={e => handleHeaderChange({ valid_until: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">IVA</label>
              <select
                value={taxPct}
                onChange={e => handleHeaderChange({ tax_pct: Number(e.target.value) })}
                className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              >
                <option value={16}>16% (general)</option>
                <option value={8}>8% (región fronteriza)</option>
                <option value={0}>0% (exento / exportación)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carga de datos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="border-2 border-dashed border-[var(--color-app-border)] rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-[var(--color-app-primary)] transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={e => e.target.files?.[0] && handleComponentsImport(e.target.files[0])}
          />
          <div className="h-10 w-10 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center shrink-0">
            <Upload className="h-4 w-4 text-[var(--color-app-primary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Importar listado de componentes</p>
            <p className="text-xs text-[var(--color-app-text-muted)]">Excel: Name, Description, Qty, Material</p>
          </div>
        </label>

        <label className="border-2 border-dashed border-[var(--color-app-border)] rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-[var(--color-app-primary)] transition-colors">
          <input
            type="file"
            multiple
            accept=".pdf,.dwg,.dxf,.png,.jpg"
            className="sr-only"
            onChange={e => e.target.files && handleDrawingsUpload(e.target.files)}
          />
          <div className="h-10 w-10 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center shrink-0">
            <FileCode2 className="h-4 w-4 text-[var(--color-app-primary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Subir planos 2D</p>
            <p className="text-xs text-[var(--color-app-text-muted)]">Se asocian a partidas por nombre de archivo</p>
          </div>
        </label>
      </div>

      {/* Partidas */}
      <Card className="p-0">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Partidas ({computedItems.length})</CardTitle>
            <CardDescription>Material + maquinado + extras, con margen aplicado.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Partida
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {computedItems.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-app-text-muted)]">
              Agrega partidas manualmente o importa un listado de componentes.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-app-border)]">
              {computedItems.map((it, i) => (
                <div key={i} className="p-4 space-y-3">
                  {/* Fila 1: identificación */}
                  <div className="flex items-start gap-2">
                    <span className="h-6 w-6 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center text-xs font-medium text-[var(--color-app-text-muted)] shrink-0 mt-1.5">
                      {i + 1}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_90px] gap-2 flex-1 min-w-0">
                      <Input
                        placeholder="No. de parte"
                        value={it.part_number}
                        onChange={e => patchItem(i, { part_number: e.target.value })}
                        className="font-mono text-xs"
                      />
                      <Input
                        placeholder="Descripción"
                        value={it.description ?? ''}
                        onChange={e => patchItem(i, { description: e.target.value })}
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={it.quantity || ''}
                        onChange={e => patchItem(i, { quantity: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-[var(--color-app-danger)] shrink-0"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Componente de inventario (opcional, descuenta stock al aprobar) */}
                  {inventory.length > 0 && (
                    <div className="flex items-center gap-2 pl-8 flex-wrap">
                      <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase shrink-0">
                        Inventario
                      </label>
                      <Combobox
                        className="min-w-[240px]"
                        options={inventory.map(inv => ({
                          value: inv.id,
                          label: inv.sku ? `${inv.name} · ${inv.sku}` : inv.name,
                          hint: `stock ${inv.stock} ${inv.uom}`,
                        }))}
                        value={it.inventory_item_id ?? null}
                        onChange={v => selectInventory(i, v ?? '')}
                        placeholder="Sin componente de inventario"
                        searchPlaceholder="Buscar producto o SKU…"
                      />
                      {it.inventory_item_id && (() => {
                        const inv = inventory.find(x => x.id === it.inventory_item_id);
                        if (!inv) return null;
                        const insufficient = inv.stock < it.quantity;
                        return (
                          <span
                            className={cn(
                              'text-xs inline-flex items-center gap-1',
                              insufficient ? 'text-[var(--color-app-danger)]' : 'text-[var(--color-app-text-muted)]'
                            )}
                          >
                            {insufficient
                              ? `Stock insuficiente (${inv.stock} disp. / ${it.quantity} req.)`
                              : `Se descontarán ${it.quantity} ${inv.uom} al aprobar`}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Fila 2: precio directo (modo simple) */}
                  {simple && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pl-8">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase">Precio unitario</label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 text-xs"
                          value={it.extra_cost || ''}
                          onChange={e => patchItem(i, { extra_cost: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Fila 2: costos (modo costeo / manufactura) */}
                  {!simple && (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pl-8">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase">Material</label>
                      <select
                        value={it.material_price_id ?? ''}
                        onChange={e => selectMaterial(i, e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                      >
                        <option value="">Sin material</option>
                        {materialPrices.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.material} (${p.unit_price}/{p.uom})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase">Consumo/pza</label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={it.material_qty || ''}
                        onChange={e => patchItem(i, { material_qty: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase">Hrs máquina</label>
                      <Input
                        type="number"
                        step="0.1"
                        className="h-8 text-xs"
                        value={it.machining_hours || ''}
                        onChange={e => patchItem(i, { machining_hours: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase">Extras/pza</label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={it.extra_cost || ''}
                        onChange={e => patchItem(i, { extra_cost: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-[var(--color-app-text-muted)] uppercase">Margen %</label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder={String(marginDefault)}
                        value={it.margin_pct ?? ''}
                        onChange={e =>
                          patchItem(i, { margin_pct: e.target.value === '' ? null : Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                  )}

                  {/* Fila 3: plano + resultados */}
                  <div className="flex items-center justify-between gap-3 pl-8 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-app-text-muted)] min-w-0">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                      {it.drawing_file ? (
                        <span className="truncate font-mono">{it.drawing_file}</span>
                      ) : (
                        <span className="italic">Sin plano 2D</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <span className="text-xs text-[var(--color-app-text-muted)]">
                        Unitario: <span className="font-semibold text-[var(--color-app-text)]">{money(it.unit_price)}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{money(it.line_total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totales */}
      {computedItems.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col items-end gap-1.5 text-sm">
              <div className="flex justify-between w-full sm:w-72">
                <span className="text-[var(--color-app-text-muted)]">Subtotal</span>
                <span className="tabular-nums">{money(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between w-full sm:w-72">
                <span className="text-[var(--color-app-text-muted)]">IVA ({taxPct}%)</span>
                <span className="tabular-nums">{money(totals.tax)}</span>
              </div>
              <div className="flex justify-between w-full sm:w-72 pt-2 border-t border-[var(--color-app-border)] text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(totals.total)}</span>
              </div>
              {dirty && (
                <p className="text-xs text-[var(--color-app-warning)] mt-1">
                  Cambios sin guardar — presiona Guardar para persistir los totales.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documento imprimible */}
      {showDocument && (
        <QuoteDocument
          quote={{ ...quote, subtotal: totals.subtotal, total: totals.total }}
          items={computedItems as QuoteItem[]}
          onClose={() => setShowDocument(false)}
          onEmail={handleEmail}
        />
      )}
    </div>
  );
}
