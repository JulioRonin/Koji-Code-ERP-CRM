import { useMemo, useState } from 'react';
import {
  FileText, Plug, CheckCircle2, Plus, ExternalLink, Trash2, ShieldCheck, DollarSign, Loader2, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import {
  useFacturapiStatus, useInvoices, useCreateInvoice, connectFacturapi,
  useCustomers, useQuotes, type Invoice, type InvoiceItemInput,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

const TAX_SYSTEMS = [
  ['601', '601 · General de Ley Personas Morales'], ['603', '603 · PM con Fines no Lucrativos'],
  ['605', '605 · Sueldos y Salarios'], ['606', '606 · Arrendamiento'],
  ['612', '612 · PF Actividad Empresarial y Profesional'], ['621', '621 · Incorporación Fiscal'],
  ['626', '626 · RESICO'], ['616', '616 · Sin obligaciones fiscales'],
];
const USES = [
  ['G01', 'G01 · Adquisición de mercancías'], ['G03', 'G03 · Gastos en general'],
  ['I01', 'I01 · Construcciones'], ['P01', 'P01 · Por definir'], ['S01', 'S01 · Sin efectos fiscales'],
];
const PAY_FORMS = [['01', '01 · Efectivo'], ['03', '03 · Transferencia'], ['04', '04 · Tarjeta de crédito'], ['28', '28 · Tarjeta de débito'], ['99', '99 · Por definir']];

const ADMIN_ROLES = ['Administrador', 'Administración / PM'];

export function Billing() {
  const { user } = useAuth();
  const isAdmin = !!user && (ADMIN_ROLES.includes(user.role) || /admin/i.test(user.role ?? ''));
  const { data: status, loading, refetch: refetchStatus } = useFacturapiStatus();
  const { data: invoices, refetch: refetchInvoices } = useInvoices();
  const [showNew, setShowNew] = useState(false);

  const totals = useMemo(() => ({
    count: invoices.length,
    total: invoices.reduce((s, i) => s + (i.total || 0), 0),
  }), [invoices]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-[var(--color-app-text-muted)]">Cargando…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-[var(--color-app-primary)]" /> Facturación (CFDI 4.0)</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">Emite facturas y complementos con Facturapi, con tus datos fiscales.</p>
        </div>
        {status.connected && (
          <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1.5" /> Nueva factura</Button>
        )}
      </div>

      {!status.connected ? (
        <ConnectWizard isAdmin={isAdmin} onConnected={async () => { await refetchStatus(); }} />
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm p-3 rounded-md border border-[var(--color-app-success)]/30 bg-[var(--color-app-success-soft)]/40">
            <ShieldCheck className="h-4 w-4 text-[var(--color-app-success)]" />
            Facturapi conectado {status.facturapi_test && <Badge variant="warning">modo pruebas</Badge>}
            <button className="ml-auto text-[var(--color-app-primary)] hover:underline text-xs" onClick={() => refetchStatus()}>Reconectar</button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi icon={FileText} label="Facturas emitidas" value={String(totals.count)} />
            <Kpi icon={DollarSign} label="Total facturado" value={money(totals.total)} />
          </div>

          <Card className="p-0">
            <CardHeader className="pb-3"><CardTitle className="text-base">Facturas emitidas</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {invoices.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">Sin facturas. Emite la primera con "Nueva factura".</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead><TableHead>Receptor</TableHead><TableHead>RFC</TableHead>
                      <TableHead className="text-right">Total</TableHead><TableHead className="text-center">Estatus</TableHead>
                      <TableHead>Fecha</TableHead><TableHead className="text-right">Descargar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv: Invoice) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.folio || inv.uuid?.slice(0, 8) || '—'}</TableCell>
                        <TableCell className="font-medium">{inv.receptor_name}</TableCell>
                        <TableCell className="font-mono text-xs text-[var(--color-app-text-muted)]">{inv.receptor_rfc}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{money(inv.total)}</TableCell>
                        <TableCell className="text-center"><Badge variant={inv.status === 'valid' ? 'success' : 'secondary'}>{inv.status}</Badge></TableCell>
                        <TableCell className="text-[var(--color-app-text-muted)] text-sm">{new Date(inv.created_at).toLocaleDateString('es-MX')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {inv.pdf_url && <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="text-[var(--color-app-primary)] hover:underline inline-flex items-center gap-1 text-xs"><Download className="h-3.5 w-3.5" /> PDF</a>}
                            {inv.xml_url && <a href={inv.xml_url} target="_blank" rel="noreferrer" className="text-[var(--color-app-primary)] hover:underline inline-flex items-center gap-1 text-xs"><ExternalLink className="h-3.5 w-3.5" /> XML</a>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showNew && <NewInvoiceModal onClose={() => setShowNew(false)} onDone={async () => { setShowNew(false); await refetchInvoices(); }} />}
    </div>
  );
}

function ConnectWizard({ isAdmin, onConnected }: { isAdmin: boolean; onConnected: () => void }) {
  const [key, setKey] = useState('');
  const [test, setTest] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setError(null); setBusy(true);
    try { await connectFacturapi(key.trim(), test); onConnected(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4 text-[var(--color-app-primary)]" /> Conectar Facturapi</CardTitle>
        <CardDescription>Conecta tu cuenta de Facturapi para timbrar CFDI 4.0 con tus sellos (CSD) y datos fiscales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <ol className="text-sm text-[var(--color-app-text-muted)] space-y-1.5 list-decimal ml-4">
          <li>Crea tu cuenta en <a href="https://facturapi.io" target="_blank" rel="noreferrer" className="text-[var(--color-app-primary)] hover:underline">facturapi.io</a> y sube tu Certificado de Sello Digital (CSD).</li>
          <li>En Facturapi → API Keys, copia tu <strong>Secret Key</strong> (usa la de <em>pruebas</em> para validar primero).</li>
          <li>Pégala aquí y conecta.</li>
        </ol>
        {!isAdmin && <div className="p-2.5 rounded-md bg-[var(--color-app-warning-soft)] text-sm text-[var(--color-app-warning)]">Solo un administrador puede conectar Facturapi.</div>}
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Facturapi Secret Key</label>
          <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk_test_… o sk_live_…" className="font-mono" disabled={!isAdmin} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={test} onChange={e => setTest(e.target.checked)} disabled={!isAdmin} /> Modo de pruebas (recomendado para validar)
        </label>
        <Button onClick={connect} disabled={!isAdmin || busy || key.trim().length < 10}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plug className="h-4 w-4 mr-1.5" />}
          {busy ? 'Validando…' : 'Conectar Facturapi'}
        </Button>
        <p className="text-[11px] text-[var(--color-app-text-subtle)]">Tu llave se guarda cifrada del lado del servidor y nunca se muestra en la app.</p>
      </CardContent>
    </Card>
  );
}

interface DraftItem { description: string; quantity: string; price: string; }

function NewInvoiceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { create, loading } = useCreateInvoice();
  const { data: customers } = useCustomers();
  const { data: quotes } = useQuotes();
  const [r, setR] = useState({ legal_name: '', tax_id: '', tax_system: '601', zip: '', email: '' });
  const [use, setUse] = useState('G03');
  const [payForm, setPayForm] = useState('03');
  const [payMethod, setPayMethod] = useState<'PUE' | 'PPD'>('PUE');
  const [items, setItems] = useState<DraftItem[]>([{ description: '', quantity: '1', price: '0' }]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ folio: number; pdf: string; xml: string } | null>(null);

  const pickCustomer = (id: string | null) => {
    const c = id ? customers.find(x => x.id === id) : null;
    if (c) setR(p => ({ ...p, legal_name: c.name, tax_id: c.tax_id ?? p.tax_id, email: c.contact_email ?? p.email }));
  };
  const pickQuote = (id: string | null) => {
    const q = id ? quotes.find(x => x.id === id) : null;
    if (q) {
      setR(p => ({ ...p, legal_name: q.client_name, email: q.client_email ?? p.email }));
      setItems([{ description: `Cotización ${q.id} · ${q.project_name}`, quantity: '1', price: String(q.subtotal || q.total || 0) }]);
    }
  };

  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  const submit = async () => {
    setError(null);
    if (!r.legal_name.trim() || !r.tax_id.trim() || !r.zip.trim()) return setError('Razón social, RFC y C.P. del receptor son obligatorios.');
    const validItems: InvoiceItemInput[] = items.filter(i => i.description.trim() && Number(i.price) > 0)
      .map(i => ({ description: i.description.trim(), quantity: Number(i.quantity) || 1, price: Number(i.price) }));
    if (validItems.length === 0) return setError('Agrega al menos una partida con precio.');
    try {
      const res = await create({
        receptor: { legal_name: r.legal_name.trim(), tax_id: r.tax_id.trim().toUpperCase(), tax_system: r.tax_system, zip: r.zip.trim(), email: r.email || undefined },
        items: validItems, use, payment_form: payForm, payment_method: payMethod,
      });
      setResult({ folio: res.folio, pdf: res.pdf, xml: res.xml });
    } catch (e) { setError((e as Error).message); }
  };

  if (result) {
    return (
      <Dialog open onOpenChange={o => !o && onDone()}>
        <DialogContent className="max-w-md">
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-[var(--color-app-success)] mx-auto" />
            <p className="font-semibold">Factura timbrada · Folio {result.folio}</p>
            <div className="flex justify-center gap-2">
              <a href={result.pdf} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" /> PDF</Button></a>
              <a href={result.xml} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1.5" /> XML</Button></a>
            </div>
            <Button onClick={onDone} className="mt-2">Listo</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva factura (CFDI 4.0)</DialogTitle>
          <DialogDescription>Datos del receptor y conceptos. Se timbra con Facturapi.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}

        <div className="grid sm:grid-cols-2 gap-3">
          {customers.length > 0 && (
            <div className="space-y-1.5"><label className="text-xs font-medium">Desde cliente (CRM)</label>
              <Combobox options={customers.map(c => ({ value: c.id, label: c.name, hint: c.tax_id ?? undefined }))} value={null} onChange={pickCustomer} placeholder="Prefijar receptor…" />
            </div>
          )}
          {quotes.length > 0 && (
            <div className="space-y-1.5"><label className="text-xs font-medium">Desde cotización</label>
              <Combobox options={quotes.map(q => ({ value: q.id, label: `${q.id} · ${q.project_name}`, hint: q.client_name }))} value={null} onChange={pickQuote} placeholder="Prefijar partidas…" />
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Razón social del receptor" full><Input value={r.legal_name} onChange={e => setR({ ...r, legal_name: e.target.value })} /></Field>
          <Field label="RFC"><Input value={r.tax_id} onChange={e => setR({ ...r, tax_id: e.target.value.toUpperCase() })} className="font-mono" /></Field>
          <Field label="C.P. (receptor)"><Input value={r.zip} onChange={e => setR({ ...r, zip: e.target.value })} className="font-mono" /></Field>
          <Field label="Régimen fiscal">
            <Sel value={r.tax_system} onChange={v => setR({ ...r, tax_system: v })} options={TAX_SYSTEMS} />
          </Field>
          <Field label="Correo (opcional)"><Input type="email" value={r.email} onChange={e => setR({ ...r, email: e.target.value })} /></Field>
          <Field label="Uso CFDI"><Sel value={use} onChange={setUse} options={USES} /></Field>
          <Field label="Forma de pago"><Sel value={payForm} onChange={setPayForm} options={PAY_FORMS} /></Field>
          <Field label="Método de pago">
            <Sel value={payMethod} onChange={v => setPayMethod(v as 'PUE' | 'PPD')} options={[['PUE', 'PUE · Una exhibición'], ['PPD', 'PPD · Parcialidades/diferido']]} />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Conceptos</label>
            <button onClick={() => setItems(p => [...p, { description: '', quantity: '1', price: '0' }])} className="text-xs text-[var(--color-app-primary)] inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Agregar</button>
          </div>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
              <Input className="col-span-7 h-9" placeholder="Descripción" value={it.description} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} />
              <Input className="col-span-2 h-9 text-center" type="number" title="Cantidad" value={it.quantity} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
              <Input className="col-span-2 h-9 text-right" type="number" title="Precio" value={it.price} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} />
              <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} className="col-span-1 flex justify-center text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>

        <div className="flex justify-end text-sm font-semibold">Subtotal: <span className="ml-2 tabular-nums">{money(total)}</span> <span className="text-[var(--color-app-text-muted)] font-normal ml-1">(+ IVA lo calcula Facturapi)</span></div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Timbrando…' : 'Emitir factura'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="p-0"><CardContent className="p-4 flex items-start justify-between">
      <div><p className="text-xs text-[var(--color-app-text-muted)]">{label}</p><p className="text-xl font-semibold mt-0.5">{value}</p></div>
      <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
    </CardContent></Card>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}><label className="text-xs font-medium">{label}</label>{children}</div>;
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
