import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, Users, Mail, Phone, LayoutList, Kanban,
  TrendingUp, Star, CalendarClock, Building2, ClipboardList, X, FolderKanban,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useCustomers, useUpsertCustomer, useDeleteCustomer, useProjects, useQuotes } from '@/lib/api';
import type { Customer, CustomerStage, Project, Quote } from '@/types/database';
import { cn } from '@/lib/utils';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const STAGES: { key: CustomerStage; label: string; variant: 'secondary' | 'warning' | 'default' | 'success' | 'outline' }[] = [
  { key: 'prospecto', label: 'Prospecto', variant: 'secondary' },
  { key: 'contacto',  label: 'En contacto', variant: 'warning' },
  { key: 'propuesta', label: 'Propuesta', variant: 'default' },
  { key: 'activo',    label: 'Activo', variant: 'success' },
  { key: 'inactivo',  label: 'Inactivo', variant: 'outline' },
];
const stageMeta = (s?: CustomerStage | null) => STAGES.find(x => x.key === s) ?? STAGES[0];

const TIER_STYLE: Record<string, string> = {
  A: 'bg-amber-100 text-amber-700 border-amber-300',
  B: 'bg-sky-100 text-sky-700 border-sky-300',
  C: 'bg-slate-100 text-slate-600 border-slate-300',
};

export interface CustomerMetrics {
  projectsTotal: number;
  activeProjects: number;
  ventas: number;
  lastActivity: string | null;
  tier: 'A' | 'B' | 'C';
  tierAuto: boolean;
  score: number;
  projects: Project[];
  quotes: Quote[];
}

/** Calcula métricas del cliente a partir de sus proyectos y cotizaciones. */
function computeMetrics(c: Customer, projects: Project[], quotes: Quote[]): CustomerMetrics {
  const nameMatch = (n?: string | null) => (n ?? '').trim().toLowerCase() === c.name.trim().toLowerCase();
  const projs = projects.filter(p => p.customer_id === c.id || (!p.customer_id && nameMatch(p.client_name)));
  const qs = quotes.filter(q => q.customer_id === c.id || nameMatch(q.client_name));
  const won = qs.filter(q => q.status === 'Aprobada' || q.status === 'Convertida');
  const ventas = won.reduce((s, q) => s + (q.total || 0), 0);
  const activeProjects = projs.filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado').length;
  const dates = [
    ...projs.map(p => p.updated_at),
    ...qs.map(q => q.updated_at),
    c.last_contact_at ?? undefined,
  ].filter(Boolean) as string[];
  const lastActivity = dates.length ? dates.sort().slice(-1)[0] : null;
  const tierAuto = ventas >= 500_000 || projs.length >= 5 ? 'A' : ventas >= 100_000 || projs.length >= 2 ? 'B' : 'C';
  const tier = (c.tier as 'A' | 'B' | 'C' | null) ?? tierAuto;
  const score = Math.min(100, Math.round((ventas / 10_000) + projs.length * 8 + activeProjects * 4));
  return { projectsTotal: projs.length, activeProjects, ventas, lastActivity, tier, tierAuto: !c.tier, score, projects: projs, quotes: qs };
}

type Enriched = Customer & { m: CustomerMetrics };

export function Customers() {
  const navigate = useNavigate();
  const { data: customers, refetch } = useCustomers();
  const { data: projects } = useProjects();
  const { data: quotes } = useQuotes();
  const { remove } = useDeleteCustomer();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [view, setView] = useState<'directory' | 'pipeline'>('directory');
  const [edit, setEdit] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Enriched | null>(null);

  const enriched: Enriched[] = useMemo(
    () => customers.map(c => ({ ...c, m: computeMetrics(c, projects, quotes) })),
    [customers, projects, quotes]
  );

  const filtered = useMemo(() => enriched.filter(c => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.contact_name ?? '').toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q);
    const matchesStage = !stageFilter || (c.stage ?? 'activo') === stageFilter;
    return matchesSearch && matchesStage;
  }), [enriched, search, stageFilter]);

  const kpis = useMemo(() => {
    const activos = enriched.filter(c => (c.stage ?? 'activo') === 'activo').length;
    const prospectos = enriched.filter(c => ['prospecto', 'contacto', 'propuesta'].includes(c.stage ?? '')).length;
    const inactivos = enriched.filter(c => (c.stage ?? '') === 'inactivo').length;
    const cartera = enriched.reduce((s, c) => s + c.m.ventas, 0);
    return { total: enriched.length, activos, prospectos, inactivos, cartera };
  }, [enriched]);

  const del = async (c: Customer) => {
    if (!window.confirm(`¿Eliminar al cliente "${c.name}"?`)) return;
    try { await remove(c.id); await refetch(); } catch (e) { window.alert((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--color-app-primary)]" /> Clientes
          </h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Seguimiento comercial: ranking, cartera y roadmap de tus clientes y prospectos.
          </p>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo cliente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Clientes" value={String(kpis.total)} sub={`${kpis.activos} activos`} />
        <Kpi icon={TrendingUp} label="Cartera (ventas)" value={money(kpis.cartera)} sub="cotizaciones ganadas" />
        <Kpi icon={ClipboardList} label="En pipeline" value={String(kpis.prospectos)} sub="prospectos y propuestas" />
        <Kpi icon={Building2} label="Inactivos" value={String(kpis.inactivos)} sub="oportunidad de mercado" tone={kpis.inactivos > 0 ? 'warning' : undefined} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input placeholder="Buscar cliente, contacto o giro…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40">
          <option value="">Todas las etapas</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="ml-auto inline-flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg">
          <button onClick={() => setView('directory')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md', view === 'directory' ? 'bg-white shadow-sm' : 'text-[var(--color-app-text-muted)]')}>
            <LayoutList className="h-4 w-4" /> Directorio
          </button>
          <button onClick={() => setView('pipeline')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md', view === 'pipeline' ? 'bg-white shadow-sm' : 'text-[var(--color-app-text-muted)]')}>
            <Kanban className="h-4 w-4" /> Roadmap
          </button>
        </div>
      </div>

      {view === 'directory' ? (
        <Card className="p-0">
          <CardContent className="p-0 overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
                {customers.length === 0 ? 'Sin clientes. Da de alta el primero.' : 'Sin resultados.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-center">Rank</TableHead>
                    <TableHead className="text-center">Proyectos</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-[var(--color-app-text-subtle)]">
                          {c.industry || c.contact_name || (c.tax_id ? c.tax_id : '—')}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={stageMeta(c.stage).variant}>{stageMeta(c.stage).label}</Badge></TableCell>
                      <TableCell className="text-center"><TierPill tier={c.m.tier} auto={c.m.tierAuto} /></TableCell>
                      <TableCell className="text-center tabular-nums">
                        {c.m.projectsTotal}
                        {c.m.activeProjects > 0 && <span className="text-[10px] text-[var(--color-app-primary)] ml-1">({c.m.activeProjects} act.)</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{money(c.m.ventas)}</TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)] text-xs">
                        {c.m.lastActivity ? formatDistanceToNow(new Date(c.m.lastActivity), { addSuffix: true, locale: es }) : '—'}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => del(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {STAGES.map(stage => {
            const items = filtered.filter(c => (c.stage ?? 'activo') === stage.key);
            return (
              <div key={stage.key} className="bg-[var(--color-app-surface-alt)]/50 rounded-lg p-2">
                <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: `var(--color-app-${stage.variant === 'success' ? 'success' : stage.variant === 'warning' ? 'warning' : 'primary'})` }}
                    />
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-[var(--color-app-text-muted)]">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(c => (
                    <button key={c.id} onClick={() => setDetail(c)} className="w-full text-left rounded-md border border-[var(--color-app-border)] bg-white p-2.5 hover:border-[var(--color-app-primary)]/40 transition-colors">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <TierPill tier={c.m.tier} auto={c.m.tierAuto} />
                      </div>
                      <div className="text-[11px] text-[var(--color-app-text-muted)] mt-1 flex items-center justify-between">
                        <span>{c.m.projectsTotal} proyecto{c.m.projectsTotal === 1 ? '' : 's'}</span>
                        <span className="tabular-nums font-medium">{money(c.m.ventas)}</span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && <p className="text-[11px] text-[var(--color-app-text-subtle)] text-center py-3">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && <CustomerModal customer={edit} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refetch(); }} />}
      {detail && (
        <CustomerDetail
          c={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEdit(detail); setDetail(null); setOpen(true); }}
          onOpenProject={id => navigate(`/projects/${id}`)}
          onNewProject={() => navigate('/projects/new')}
        />
      )}
    </div>
  );
}

function TierPill({ tier, auto }: { tier: string; auto: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[11px] font-bold', TIER_STYLE[tier] ?? TIER_STYLE.C)} title={auto ? 'Rango calculado' : 'Rango manual'}>
      <Star className="h-3 w-3" fill="currentColor" /> {tier}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; tone?: 'warning' }) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-app-text-muted)] truncate">{label}</p>
            <p className={cn('text-xl font-semibold mt-0.5 truncate', tone === 'warning' && 'text-[var(--color-app-warning)]')}>{value}</p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        </div>
        <p className="text-[11px] text-[var(--color-app-text-muted)] mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CustomerDetail({ c, onClose, onEdit, onOpenProject, onNewProject }: {
  c: Enriched; onClose: () => void; onEdit: () => void; onOpenProject: (id: string) => void; onNewProject: () => void;
}) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {c.name} <TierPill tier={c.m.tier} auto={c.m.tierAuto} />
            <Badge variant={stageMeta(c.stage).variant}>{stageMeta(c.stage).label}</Badge>
          </DialogTitle>
          <DialogDescription>{c.industry || 'Cliente'}{c.tax_id ? ` · ${c.tax_id}` : ''}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Proyectos" value={String(c.m.projectsTotal)} />
          <Stat label="Activos" value={String(c.m.activeProjects)} />
          <Stat label="Ventas" value={money(c.m.ventas)} />
          <Stat label="Score" value={`${c.m.score}/100`} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {c.contact_name && <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> {c.contact_name}</p>}
          {c.contact_email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> {c.contact_email}</p>}
          {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> {c.phone}</p>}
          {c.last_contact_at && <p className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Últ. contacto: {format(new Date(c.last_contact_at), 'dd MMM yyyy', { locale: es })}</p>}
        </div>

        {c.notes && <div className="text-sm bg-[var(--color-app-surface-alt)]/60 rounded-md p-3"><span className="text-[var(--color-app-text-muted)]">Notas: </span>{c.notes}</div>}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-[var(--color-app-text-muted)]">Proyectos ({c.m.projects.length})</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onNewProject}><FolderKanban className="h-3.5 w-3.5 mr-1" /> Nuevo proyecto</Button>
          </div>
          {c.m.projects.length === 0 ? (
            <p className="text-sm text-[var(--color-app-text-muted)] py-2">Sin proyectos registrados con este cliente.</p>
          ) : (
            <div className="rounded-md border border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
              {c.m.projects.slice(0, 8).map(p => (
                <button key={p.id} onClick={() => onOpenProject(p.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-[var(--color-app-surface-alt)]/50 text-left">
                  <span className="min-w-0"><span className="font-medium truncate">{p.name}</span> <span className="text-[11px] text-[var(--color-app-text-muted)] font-mono">{p.id}</span></span>
                  <Badge variant="secondary">{p.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="mr-auto" onClick={onClose}><X className="h-4 w-4 mr-1.5" /> Cerrar</Button>
          <Button variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1.5" /> Editar cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-app-border)] p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-app-text-muted)]">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function CustomerModal({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const { save, loading } = useUpsertCustomer();
  const [f, setF] = useState({
    name: customer?.name ?? '', contact_name: customer?.contact_name ?? '', contact_email: customer?.contact_email ?? '',
    phone: customer?.phone ?? '', tax_id: customer?.tax_id ?? '', address: customer?.address ?? '',
    industry: customer?.industry ?? '', stage: (customer?.stage ?? 'activo') as CustomerStage,
    tier: (customer?.tier ?? '') as '' | 'A' | 'B' | 'C',
    last_contact_at: customer?.last_contact_at ? customer.last_contact_at.slice(0, 10) : '',
    notes: customer?.notes ?? '', is_active: customer?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim()) return setError('El nombre es obligatorio.');
    try {
      await save({
        id: customer?.id, name: f.name.trim(), contact_name: f.contact_name, contact_email: f.contact_email,
        phone: f.phone, tax_id: f.tax_id, address: f.address, industry: f.industry || null,
        stage: f.stage, tier: f.tier || null, last_contact_at: f.last_contact_at || null,
        notes: f.notes, is_active: f.stage !== 'inactivo',
      });
      onSaved();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>Datos, seguimiento comercial y clasificación.</DialogDescription>
        </DialogHeader>
        {error && <div className="p-2.5 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] rounded-md text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <L label="Nombre / razón social" full><Input value={f.name} onChange={set('name')} autoFocus /></L>
          <L label="Giro / industria"><Input value={f.industry} onChange={set('industry')} placeholder="Automotriz, aeroespacial…" /></L>
          <L label="Contacto"><Input value={f.contact_name} onChange={set('contact_name')} /></L>
          <L label="Correo"><Input value={f.contact_email} onChange={set('contact_email')} type="email" /></L>
          <L label="Teléfono"><Input value={f.phone} onChange={set('phone')} /></L>
          <L label="RFC"><Input value={f.tax_id} onChange={set('tax_id')} className="font-mono" /></L>
          <L label="Etapa (roadmap)">
            <select value={f.stage} onChange={e => setF(p => ({ ...p, stage: e.target.value as CustomerStage }))} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40">
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </L>
          <L label="Rango (opcional)">
            <select value={f.tier} onChange={e => setF(p => ({ ...p, tier: e.target.value as typeof f.tier }))} className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40">
              <option value="">Automático</option>
              <option value="A">A — clave</option>
              <option value="B">B — recurrente</option>
              <option value="C">C — ocasional</option>
            </select>
          </L>
          <L label="Último contacto"><Input type="date" value={f.last_contact_at} onChange={set('last_contact_at')} /></L>
          <L label="Dirección"><Input value={f.address} onChange={set('address')} /></L>
          <L label="Notas / seguimiento" full>
            <textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40" />
          </L>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
      <label className="text-xs font-medium text-[var(--color-app-text)]">{label}</label>
      {children}
    </div>
  );
}
