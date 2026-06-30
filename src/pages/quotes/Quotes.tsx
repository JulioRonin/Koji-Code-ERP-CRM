import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  useCustomers,
  useMaterialPrices,
  useUpsertMaterialPrice,
  useDeleteMaterialPrice,
  useBulkImportMaterialPrices,
} from '@/lib/api';
import { Combobox } from '@/components/ui/combobox';
import type { MaterialPrice, QuoteStatus } from '@/types/database';
import { cn } from '@/lib/utils';

const statusBadge: Record<QuoteStatus, 'secondary' | 'default' | 'success' | 'destructive' | 'outline' | 'warning'> = {
  Borrador:   'secondary',
  Enviada:    'default',
  Aprobada:   'success',
  Rechazada:  'destructive',
  Convertida: 'outline',
  Expirada:   'warning',
};

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
  const { data: quotes, refetch: refetchQuotes } = useQuotes();
  const { create: createQuote, loading: creating } = useCreateQuote();
  const { data: customers } = useCustomers();

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ client: '', project: '', email: '', customerId: '', delivery: '' });

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
    setDraft({ client: '', project: '', email: '', customerId: '', delivery: '' });
    await refetchQuotes();
    navigate(`/quotes/${quote.id}`);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Cotizaciones</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Estima costos de material y maquinado, genera la cotización y conviértela en proyecto.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva cotización
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={Calculator} label="Abiertas"          value={String(stats.open)} />
        <Kpi icon={CheckCircle2} label="Aprobadas"        value={String(stats.approved)} tone="success" />
        <Kpi icon={TrendingUp} label="Valor en pipeline" value={money(stats.pipelineValue)} />
        <Kpi icon={DollarSign} label="Valor ganado"      value={money(stats.wonValue)} tone="success" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
              activeTab === t.id
                ? 'bg-white text-[var(--color-app-text)] shadow-sm'
                : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'quotes' && (
        <Card className="p-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historial de cotizaciones</CardTitle>
            <CardDescription>Haz clic en una cotización para editarla o generar el documento.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {quotes.length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--color-app-text-muted)]">
                No hay cotizaciones. Crea la primera arriba.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Proyecto / cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden md:table-cell">Creada</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map(q => (
                    <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                      <TableCell className="font-mono text-xs">{q.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{q.project_name}</span>
                          <span className="text-xs text-[var(--color-app-text-muted)]">{q.client_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadge[q.status]}>{q.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {q.total > 0 ? money(q.total) : '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-[var(--color-app-text-muted)]">
                        {format(new Date(q.created_at), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-[var(--color-app-text-subtle)]" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
            {customers.length > 0 && (
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
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-app-text-muted)] truncate">{label}</p>
            <p className={cn('text-lg md:text-xl font-semibold mt-1 truncate', tone === 'success' && 'text-[var(--color-app-success)]')}>
              {value}
            </p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
