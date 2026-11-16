import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Calculator,
  Plus,
  Search,
  Upload,
  Trash2,
  Pencil,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  TrendingUp,
  Send,
  CheckCircle2,
  Layers,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useQuotes,
  useCreateQuote,
  useDeleteQuote,
  useCustomers,
  useInventoryItems,
  useMaterialPrices,
  useUpsertMaterialPrice,
  useDeleteMaterialPrice,
  useBulkImportMaterialPrices,
  useQuoteItems,
} from '@/lib/api';
import { Combobox } from '@/components/ui/combobox';
import type { MaterialPrice, Quote, QuoteStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { BigNumber, Chips, PageHeader, Panel, Pill, Segmented, StatTile, toneFor, useMediaQuery } from '@/components/kanri';


const QUOTE_STATUSES: QuoteStatus[] = ['Borrador', 'Enviada', 'Aprobada', 'Rechazada', 'Convertida', 'Expirada'];

const tabs = [
  { id: 'quotes', label: 'Cotizaciones',          icon: Calculator },
  { id: 'prices', label: 'Precios de materiales', icon: DollarSign },
] as const;
type Tab = (typeof tabs)[number]['id'];

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export function Quotes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('quotes');
  const { data: quotes, refetch: refetchQuotes, mutate: mutateQuotes } = useQuotes();
  const { create: createQuote, loading: creating } = useCreateQuote();
  const { remove: deleteQuote } = useDeleteQuote();
  const { data: customers } = useCustomers();

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ client: '', project: '', email: '', customerId: '', delivery: '', publicSale: false });

  // Filtros y agrupación del historial.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'TODOS'>('TODOS');
  const [groupByStatus, setGroupByStatus] = useState(false);

  const visibleQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter(row => {
      if (statusFilter !== 'TODOS' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.id.toLowerCase().includes(q) ||
        row.project_name.toLowerCase().includes(q) ||
        row.client_name.toLowerCase().includes(q)
      );
    });
  }, [quotes, search, statusFilter]);

  const groupedQuotes = useMemo(() => {
    if (!groupByStatus) return null;
    return QUOTE_STATUSES
      .map(s => ({ status: s, rows: visibleQuotes.filter(q => q.status === s) }))
      .filter(g => g.rows.length > 0);
  }, [visibleQuotes, groupByStatus]);

  const handleDeleteQuote = async (id: string) => {
    if (!window.confirm(`¿Eliminar la cotización ${id}? Se borran también sus partidas. Esta acción no se puede deshacer.`)) return;
    mutateQuotes(prev => prev.filter(q => q.id !== id)); // optimista
    try {
      await deleteQuote(id);
    } catch (err) {
      await refetchQuotes();
      window.alert((err as Error).message || 'No se pudo eliminar la cotización.');
    }
  };

  const stats = useMemo(() => {
    const open = quotes.filter(q => q.status === 'Borrador' || q.status === 'Enviada');
    const approved = quotes.filter(q => q.status === 'Aprobada' || q.status === 'Convertida');
    const pipelineValue = open.reduce((acc, q) => acc + (q.total || 0), 0);
    const wonValue = approved.reduce((acc, q) => acc + (q.total || 0), 0);
    return { open: open.length, approved: approved.length, pipelineValue, wonValue };
  }, [quotes]);

  const handleCreate = async () => {
    if (!draft.client || !draft.project) return;
    const quote = await createQuote({
      client_name: draft.client,
      client_email: draft.email || null,
      customer_id: draft.customerId || null,
      project_name: draft.project,
      delivery_time: draft.delivery || null,
    });
    setShowNew(false);
    setDraft({ client: '', project: '', email: '', customerId: '', delivery: '', publicSale: false });
    await refetchQuotes();
    navigate(`/quotes/${quote.id}`);
  };

  // "Nueva cotización para este cliente" (desde Clientes): ?cliente=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const cid = searchParams.get('cliente');
    if (!cid || customers.length === 0) return;
    setSearchParams({}, { replace: true });
    pickCustomer(cid);
    setShowNew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, customers.length]);

  const pickCustomer = (id: string | null) => {
    const c = id ? customers.find(x => x.id === id) : null;
    setDraft(d => ({
      ...d,
      customerId: id ?? '',
      client: c ? c.name : d.client,
      email: c?.contact_email ?? d.email,
    }));
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        title="Cotizaciones"
        subtitle={`${stats.open} abierta${stats.open === 1 ? '' : 's'} · ${money2(stats.pipelineValue)} en pipeline`}
        actions={
          <>
            <Segmented<Tab> value={activeTab} onChange={setActiveTab} items={tabs.map(t => ({ id: t.id, label: t.label }))} />
            <Button size="lg" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nueva cotización
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Calculator} label="Abiertas"          value={String(stats.open)} />
        <Kpi icon={CheckCircle2} label="Aprobadas"        value={String(stats.approved)} />
        <Kpi icon={TrendingUp} label="Valor en pipeline" value={money(stats.pipelineValue)} />
        <Kpi icon={DollarSign} label="Valor ganado"      value={money(stats.wonValue)} tone="success" />
      </div>

      {activeTab === 'quotes' && (
        <QuotesWorkspace
          quotes={quotes}
          visible={visibleQuotes}
          grouped={groupedQuotes}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          groupByStatus={groupByStatus}
          setGroupByStatus={setGroupByStatus}
          onDelete={handleDeleteQuote}
        />
      )}

      {activeTab === 'prices' && <PriceBook />}

      {/* New quote modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva cotización</DialogTitle>
            <DialogDescription>
              Después podrás agregar partidas, planos y ajustar márgenes en el constructor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.publicSale}
                onChange={e => setDraft(d => ({
                  ...d,
                  publicSale: e.target.checked,
                  client: e.target.checked ? 'Público en general' : '',
                  customerId: '', email: '',
                }))}
              />
              Venta a público en general
            </label>
            {!draft.publicSale && customers.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cliente registrado</label>
                <Combobox
                  options={customers.map(c => ({ value: c.id, label: c.name, hint: c.tax_id ?? undefined }))}
                  value={draft.customerId || null}
                  onChange={pickCustomer}
                  placeholder="Buscar cliente del CRM…"
                  searchPlaceholder="Escribe para buscar…"
                />
                <p className="text-[11px] text-[var(--color-app-text-muted)]">
                  ¿No está en la lista? Escríbelo abajo o regístralo en <span className="font-medium">Clientes</span>.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cliente</label>
                <Input
                  placeholder="Ej. BRP, Bosch..."
                  value={draft.client}
                  onChange={e => setDraft({ ...draft, client: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Correo del cliente</label>
                <Input
                  type="email"
                  placeholder="cliente@empresa.com"
                  value={draft.email}
                  onChange={e => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre del proyecto</label>
              <Input
                placeholder="Ej. Bujes para línea de ensamble"
                value={draft.project}
                onChange={e => setDraft({ ...draft, project: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tiempo de entrega</label>
              <Input
                placeholder="Ej. 15 días hábiles"
                value={draft.delivery}
                onChange={e => setDraft({ ...draft, delivery: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!draft.client || !draft.project || creating}>
              {creating ? 'Creando...' : 'Crear y abrir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// LISTA + PANEL DE DETALLE (rediseño)
// ============================================================================

const money2 = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quoteTone = (s: QuoteStatus) => toneFor(s === 'Convertida' ? 'Aprobada' : s === 'Borrador' ? 'gris' : s === 'Expirada' ? 'cotiz' : s);

function QuotesWorkspace({
  quotes, visible, grouped, search, setSearch, statusFilter, setStatusFilter, groupByStatus, setGroupByStatus, onDelete,
}: {
  quotes: Quote[];
  visible: Quote[];
  grouped: { status: QuoteStatus; rows: Quote[] }[] | null;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: QuoteStatus | 'TODOS';
  setStatusFilter: (v: QuoteStatus | 'TODOS') => void;
  groupByStatus: boolean;
  setGroupByStatus: (fn: (v: boolean) => boolean) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1180px)');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visible.find(q => q.id === selectedId) ?? visible[0] ?? null;

  const pick = (q: Quote) => (wide ? setSelectedId(q.id) : navigate(`/quotes/${q.id}`));

  const card = (q: Quote) => {
    const on = wide && selected?.id === q.id;
    return (
      <button
        key={q.id}
        onClick={() => pick(q)}
        onDoubleClick={() => navigate(`/quotes/${q.id}`)}
        className={cn(
          'k-rise w-full text-left rounded-[24px] p-5 transition-all duration-200',
          on ? 'bg-white shadow-[0_0_0_2px_var(--color-app-ink)]' : 'bg-[var(--color-app-surface-alt)] hover:bg-white',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-xs text-[var(--color-app-text-muted)]">{q.id}</span>
            <Pill tone={quoteTone(q.status)}>{q.status}</Pill>
          </div>
          <span className="font-mono text-[15px] whitespace-nowrap">{q.total > 0 ? money2(q.total) : '—'}</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[18px] leading-snug truncate">{q.project_name}</p>
            <p className="text-sm text-[var(--color-app-text-muted)] truncate">{q.client_name}</p>
          </div>
          <span className="text-[13px] text-[var(--color-app-text-muted)] whitespace-nowrap">
            {format(new Date(q.created_at), 'd MMM', { locale: es })}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra: buscar · estatus · agrupar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" />
          <input
            placeholder="Buscar folio, proyecto o cliente"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--color-app-surface-alt)] text-[15px] placeholder:text-[var(--color-app-text-muted)] outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-app-ink)] transition-colors"
          />
        </div>
        <Chips<QuoteStatus | 'TODOS'>
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: 'TODOS', label: 'Todas', count: quotes.length },
            ...QUOTE_STATUSES.map(st => ({ id: st, label: st, count: quotes.filter(q => q.status === st).length, tone: quoteTone(st) })),
          ]}
        />
        <Button variant={groupByStatus ? 'default' : 'outline'} className="ml-auto" onClick={() => setGroupByStatus(v => !v)}>
          <Layers className="h-4 w-4 mr-1.5" /> Agrupar por estatus
        </Button>
      </div>

      {quotes.length === 0 ? (
        <Panel><p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">No hay cotizaciones. Crea la primera arriba.</p></Panel>
      ) : visible.length === 0 ? (
        <Panel><p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">Sin resultados para el filtro actual.</p></Panel>
      ) : (
        <div className={cn('grid gap-3 items-start', wide && 'grid-cols-[minmax(0,1fr)_minmax(380px,460px)]')}>
          <div className="space-y-2.5 min-w-0">
            {grouped
              ? grouped.map(g => (
                  <div key={g.status} className="space-y-2.5">
                    <div className="flex items-center gap-2 px-1 pt-2">
                      <Pill tone={quoteTone(g.status)} dot>{g.status}</Pill>
                      <span className="text-xs text-[var(--color-app-text-muted)]">{g.rows.length} cotización{g.rows.length === 1 ? '' : 'es'}</span>
                    </div>
                    {g.rows.map(card)}
                  </div>
                ))
              : visible.map(card)}
          </div>
          {wide && selected && <QuoteDetailPanel key={selected.id} quote={selected} onDelete={onDelete} />}
        </div>
      )}
    </div>
  );
}

function QuoteDetailPanel({ quote, onDelete }: { quote: Quote; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const { data: items, loading } = useQuoteItems(quote.id);
  const subtotal = items.reduce((a, it) => a + (it.line_total || 0), 0) || quote.subtotal || 0;
  const iva = subtotal * ((quote.tax_pct ?? 16) / 100);
  const go = (accion?: string) => navigate(`/quotes/${quote.id}${accion ? `?accion=${accion}` : ''}`);
  const canApprove = quote.status !== 'Aprobada' && quote.status !== 'Convertida';

  return (
    <aside className="k-rise sticky top-2 rounded-[30px] bg-white p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-app-text-muted)]">
            {quote.id} · {format(new Date(quote.created_at), 'd MMM yyyy', { locale: es })}
          </p>
          <h2 className="mt-2 text-[26px] leading-tight font-normal tracking-[-0.01em]">{quote.project_name}</h2>
          <p className="text-[15px] text-[var(--color-app-text-muted)] mt-1">{quote.client_name}</p>
        </div>
        <Pill tone={quoteTone(quote.status)}>{quote.status}</Pill>
      </div>

      <div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-2 text-xs text-[var(--color-app-text-muted)] border-b border-[var(--color-app-border)]">
          <span>Concepto</span><span className="text-right">Cant.</span><span className="text-right w-28">Importe</span>
        </div>
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--color-app-text-muted)]">Cargando partidas…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-app-text-muted)]">Sin partidas todavía.</p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {items.map(it => (
              <div key={it.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-3 border-b border-[var(--color-app-border)] text-sm">
                <div className="min-w-0">
                  <p className="truncate">{it.description || it.part_number}</p>
                  <p className="font-mono text-xs text-[var(--color-app-text-muted)]">{money2(it.unit_price)} c/u</p>
                </div>
                <span className="text-right font-mono">{it.quantity}</span>
                <span className="text-right font-mono w-28">{money2(it.line_total)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-3 space-y-1 text-[15px]">
          <div className="flex justify-between text-[var(--color-app-text-muted)]"><span>Subtotal</span><span className="font-mono">{money2(subtotal)}</span></div>
          <div className="flex justify-between text-[var(--color-app-text-muted)]"><span>IVA {quote.tax_pct ?? 16} %</span><span className="font-mono">{money2(iva)}</span></div>
          <div className="flex items-baseline justify-between pt-3">
            <span>Total {quote.currency || 'MXN'}</span>
            <BigNumber value={money2(subtotal + iva)} size="md" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" size="lg" onClick={() => go('correo')}>
          <Send className="h-4 w-4 mr-1.5" /> Enviar por correo
        </Button>
        {canApprove ? (
          <Button variant="accent" size="lg" onClick={() => go('aprobar')}>Marcar aprobada</Button>
        ) : (
          <Button variant="accent" size="lg" onClick={() => (quote.converted_project_id ? navigate(`/projects/${quote.converted_project_id}`) : go())}>
            {quote.converted_project_id ? 'Ver proyecto' : 'Convertir a proyecto'}
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={() => go('pdf')}>
          <FileText className="h-4 w-4 mr-1.5" /> Documento PDF
        </Button>
        <Button size="lg" onClick={() => go()}>
          <Pencil className="h-4 w-4 mr-1.5" /> Editar
        </Button>
      </div>
      <button onClick={() => onDelete(quote.id)} className="self-start inline-flex items-center gap-1.5 text-sm text-[var(--color-app-danger)] hover:underline">
        <Trash2 className="h-3.5 w-3.5" /> Eliminar cotización
      </button>
    </aside>
  );
}

// ============================================================================
// PRICE BOOK
// ============================================================================

function PriceBook() {
  const { data: prices, refetch } = useMaterialPrices();
  const { upsert } = useUpsertMaterialPrice();
  const { remove } = useDeleteMaterialPrice();
  const { importRows, loading: importing } = useBulkImportMaterialPrices();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MaterialPrice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ material: '', description: '', uom: 'kg', price: '', supplier: '' });
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const filtered = prices.filter(
    p =>
      p.material.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (p: MaterialPrice) => {
    setEditing(p);
    setForm({
      material: p.material,
      description: p.description ?? '',
      uom: p.uom,
      price: String(p.unit_price),
      supplier: p.supplier_name ?? '',
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ material: '', description: '', uom: 'kg', price: '', supplier: '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    await upsert(
      {
        material: form.material,
        description: form.description || null,
        uom: form.uom,
        unit_price: Number(form.price) || 0,
        supplier_name: form.supplier || null,
      },
      editing?.id
    );
    setShowForm(false);
    await refetch();
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    await refetch();
  };

  const handleExcelImport = (file: File) => {
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        const count = await importRows(rows);
        setImportMsg(`${count} precios importados correctamente.`);
        await refetch();
      } catch (err) {
        setImportMsg(`Error: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder="Buscar material o proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={e => e.target.files?.[0] && handleExcelImport(e.target.files[0])}
            />
            <Button variant="outline" asChild>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-1.5" />
                {importing ? 'Importando...' : 'Importar Excel'}
              </span>
            </Button>
          </label>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" /> Agregar
          </Button>
        </div>
      </div>

      {importMsg && (
        <div
          className={cn(
            'p-3 rounded-md text-sm flex items-center gap-2',
            importMsg.startsWith('Error')
              ? 'bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]'
              : 'bg-[var(--color-app-success-soft)] text-[var(--color-app-success)]'
          )}
        >
          <FileSpreadsheet className="h-4 w-4 shrink-0" />
          {importMsg}
        </div>
      )}

      <Card className="p-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Catálogo de precios</CardTitle>
          <CardDescription>
            Columnas Excel soportadas: <code className="text-xs">Material, Descripcion, UOM, Precio, Proveedor</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="hidden md:table-cell">Descripción</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="hidden md:table-cell">Proveedor</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.material}</TableCell>
                  <TableCell className="hidden md:table-cell text-[var(--color-app-text-muted)]">
                    {p.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    ${p.unit_price.toLocaleString('es-MX')}
                  </TableCell>
                  <TableCell className="text-[var(--color-app-text-muted)]">{p.uom}</TableCell>
                  <TableCell className="hidden md:table-cell text-[var(--color-app-text-muted)]">
                    {p.supplier_name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--color-app-danger)]"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-[var(--color-app-text-muted)]">
                    Sin materiales. Importa un Excel o agrégalos manualmente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InventoryPriceList />

      {/* Form modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar precio' : 'Agregar material'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Material</label>
              <Input value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} placeholder="Acero 4140" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Descripción</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder='Barra redonda 2"' />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Precio unitario (MXN)</label>
              <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Unidad</label>
              <select
                value={form.uom}
                onChange={e => setForm({ ...form, uom: e.target.value })}
                className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              >
                <option value="kg">kg</option>
                <option value="barra">barra</option>
                <option value="placa">placa</option>
                <option value="pza">pza</option>
                <option value="m">m</option>
                <option value="lt">lt</option>
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium">Proveedor</label>
              <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Aceros del Norte" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.material || !form.price}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// CATÁLOGO DE INVENTARIO (precios de venta) — solo lectura, para cotizar
// ============================================================================



function InventoryPriceList() {
  const { data: inventory } = useInventoryItems();
  const [search, setSearch] = useState('');

  const filtered = inventory.filter(
    i =>
      !search.trim() ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="p-0">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="text-base">Inventario (precios de venta)</CardTitle>
          <CardDescription>Productos del inventario con su costo y precio de venta. Adminístralos en Inventario.</CardDescription>
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input placeholder="Buscar producto o SKU…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="hidden md:table-cell">SKU</TableHead>
              <TableHead className="hidden md:table-cell">Categoría</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Precio venta</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs text-[var(--color-app-text-muted)]">{i.sku ?? '—'}</TableCell>
                <TableCell className="hidden md:table-cell text-[var(--color-app-text-muted)]">{i.category}</TableCell>
                <TableCell className="text-right tabular-nums text-[var(--color-app-text-muted)]">{money2(i.unit_cost)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{money2(i.unit_price)}</TableCell>
                <TableCell className="text-right tabular-nums">{i.stock} {i.uom}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-[var(--color-app-text-muted)]">
                  {inventory.length === 0 ? 'Sin productos en inventario. Cárgalos en el módulo de Inventario.' : 'Sin resultados.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'success';
}) {
  return <StatTile icon={Icon} label={label} value={value} tone={tone === 'success' ? 'accent' : 'default'} />;
}
