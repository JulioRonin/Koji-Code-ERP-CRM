import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, LogIn, Trash2, Pencil, ShieldAlert, ArrowLeft, Users, DollarSign, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { IndustryIcon } from '@/components/saas/IndustryIcon';
import { KanriLogo } from '@/components/saas/KanriLogo';
import {
  PLANS, MODULES, getPlan, getIndustry, getModule, availableModulesForTenant,
  type Tenant, type PlanKey, type SubscriptionStatus, type ModuleKey,
} from '@/lib/saas';
import { useTenant } from '@/contexts/TenantContext';
import { listTenants, saveTenant, deleteTenant } from '@/lib/api/tenants';
import { listInvoices, type StripeInvoice } from '@/lib/api/billing';
import { Receipt } from 'lucide-react';

const STATUS_VARIANT: Record<SubscriptionStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  active: 'success',
  trialing: 'warning',
  past_due: 'destructive',
  canceled: 'destructive',
  paused: 'secondary',
};
const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'Activa', trialing: 'Prueba', past_due: 'Vencida', canceled: 'Cancelada', paused: 'Pausada',
};

export function PlatformAdmin() {
  const { user } = useAuth();
  const { setActiveTenantId } = useTenant();
  const navigate = useNavigate();
  const isAllowed = !!user && user.isPlatformOwner === true;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [billing, setBilling] = useState<Tenant | null>(null);

  const refresh = async () => {
    try {
      setTenants(await listTenants());
    } catch (err) {
      console.warn('No se pudieron cargar las empresas', err);
    }
  };

  useEffect(() => {
    if (isAllowed) refresh();
  }, [isAllowed]);

  const stats = useMemo(() => {
    const billable = tenants.filter(t => t.subscription.status === 'active');
    const mrr = billable.reduce((s, t) => s + (getPlan(t.plan).priceMxn ?? 0), 0);
    return {
      total: tenants.length,
      active: tenants.filter(t => t.subscription.status === 'active').length,
      trialing: tenants.filter(t => t.subscription.status === 'trialing').length,
      mrr,
    };
  }, [tenants]);

  const handleEnter = async (t: Tenant) => {
    await setActiveTenantId(t.id);
    window.location.href = '/';
  };

  const handleDelete = async (t: Tenant) => {
    if (!window.confirm(`¿Eliminar la empresa "${t.name}"? (no borra sus datos de operación, solo el registro de plataforma)`)) return;
    try {
      await deleteTenant(t.id);
      await refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const handleSaveEdit = async (next: Tenant) => {
    try {
      await saveTenant(next);
      await refresh();
      setEditing(null);
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-app-bg)] p-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="h-10 w-10 text-[var(--color-app-danger)] mx-auto mb-3" />
          <h1 className="text-lg font-semibold">Acceso restringido</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-1">
            El panel de plataforma es exclusivo del equipo KANRI (administradores).
          </p>
          <Link to="/"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-1.5" /> Volver</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)]">
      <header className="border-b border-[var(--color-app-border)] bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KanriLogo size={28} />
            <span className="text-sm text-[var(--color-app-text-muted)]">· Plataforma</span>
          </div>
          <div className="flex gap-2">
            <Link to="/"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" /> A la app</Button></Link>
            <Button size="sm" onClick={() => navigate('/onboarding')}><Plus className="h-4 w-4 mr-1.5" /> Nueva empresa</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Building2} label="Empresas" value={String(stats.total)} />
          <Kpi icon={Users} label="Activas" value={String(stats.active)} tone="success" />
          <Kpi icon={Layers} label="En prueba" value={String(stats.trialing)} tone="warning" />
          <Kpi icon={DollarSign} label="MRR estimado" value={`$${stats.mrr.toLocaleString('es-MX')}`} tone="primary" />
        </div>

        {/* Tabla de empresas */}
        <div className="rounded-xl border border-[var(--color-app-border)] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-app-border)]">
            <h2 className="text-sm font-semibold">Empresas ({tenants.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-app-surface-alt)]/60 text-xs text-[var(--color-app-text-muted)] uppercase">
                <tr>
                  <th className="text-left p-3 font-medium">Empresa</th>
                  <th className="text-left p-3 font-medium">Giro</th>
                  <th className="text-left p-3 font-medium">Plan</th>
                  <th className="text-left p-3 font-medium">Ciclo</th>
                  <th className="text-left p-3 font-medium">Estatus</th>
                  <th className="text-left p-3 font-medium">Vence / renueva</th>
                  <th className="text-center p-3 font-medium">Módulos</th>
                  <th className="text-right p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} className="border-t border-[var(--color-app-border)] hover:bg-[var(--color-app-surface-alt)]/40">
                    <td className="p-3">
                      <div className="font-medium text-[var(--color-app-text)]">{t.name}</div>
                      <div className="text-xs text-[var(--color-app-text-subtle)] font-mono">{t.slug}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 text-[var(--color-app-text-muted)]">
                        <IndustryIcon name={getIndustry(t.industry).icon} className="h-3.5 w-3.5" />
                        {getIndustry(t.industry).label}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={t.plan === 'enterprise' ? 'default' : 'secondary'}>{getPlan(t.plan).label}</Badge>
                        {getPlan(t.plan).priceMxn != null && (
                          <span className="text-xs text-[var(--color-app-text-subtle)]">${getPlan(t.plan).priceMxn!.toLocaleString('es-MX')}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[var(--color-app-text-muted)]">
                      {t.subscription.billingCycle === 'annual' ? 'Anual' : 'Mensual'}
                    </td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANT[t.subscription.status]}>{STATUS_LABEL[t.subscription.status]}</Badge>
                    </td>
                    <td className="p-3 text-[var(--color-app-text-muted)] text-xs">
                      {t.subscription.currentPeriodEnd ? new Date(t.subscription.currentPeriodEnd).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="p-3 text-center tabular-nums text-[var(--color-app-text-muted)]">
                      {t.enabledModules.length}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => setBilling(t)} title="Suscripción y pagos">
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => handleEnter(t)} title="Entrar como esta empresa">
                          <LogIn className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(t)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-[var(--color-app-danger)]" onClick={() => handleDelete(t)} title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editing && (
        <EditTenantModal tenant={editing} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
      )}
      {billing && (
        <TenantBillingModal tenant={billing} onClose={() => setBilling(null)} />
      )}
    </div>
  );
}

function TenantBillingModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const sub = tenant.subscription;

  useEffect(() => {
    let alive = true;
    listInvoices(tenant.id).then(inv => { if (alive) { setInvoices(inv); setLoading(false); } });
    return () => { alive = false; };
  }, [tenant.id]);

  const money = (cents: number, currency: string) =>
    (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: (currency || 'mxn').toUpperCase() });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> {tenant.name}</DialogTitle>
          <DialogDescription>Suscripción e historial de pagos.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Field2 label="Plan" value={getPlan(tenant.plan).label} />
          <Field2 label="Estatus" value={STATUS_LABEL[sub.status]} />
          <Field2 label="Ciclo" value={sub.billingCycle === 'annual' ? 'Anual' : 'Mensual'} />
          <Field2 label="Precio" value={getPlan(tenant.plan).priceMxn != null ? `$${getPlan(tenant.plan).priceMxn!.toLocaleString('es-MX')}` : 'A cotizar'} />
          <Field2 label="Vence / renueva" value={sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-MX') : '—'} />
          <Field2 label="Cliente Stripe" value={sub.stripeCustomerId ?? 'Sin conectar'} mono />
        </div>

        <div className="mt-2">
          <p className="text-xs font-medium mb-2">Historial de pagos</p>
          {loading ? (
            <p className="text-sm text-[var(--color-app-text-muted)] py-3">Cargando…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-[var(--color-app-text-muted)] py-3">
              Sin pagos registrados. Aparecen aquí cuando Stripe está configurado y la empresa realiza cobros.
            </p>
          ) : (
            <div className="rounded-md border border-[var(--color-app-border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-app-surface-alt)]/60 text-xs text-[var(--color-app-text-muted)]">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Fecha</th>
                    <th className="text-left p-2.5 font-medium">Factura</th>
                    <th className="text-right p-2.5 font-medium">Monto</th>
                    <th className="text-center p-2.5 font-medium">Estado</th>
                    <th className="text-right p-2.5 font-medium">Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-t border-[var(--color-app-border)]">
                      <td className="p-2.5">{new Date(inv.created * 1000).toLocaleDateString('es-MX')}</td>
                      <td className="p-2.5 font-mono text-xs text-[var(--color-app-text-muted)]">{inv.number ?? inv.id.slice(-8)}</td>
                      <td className="p-2.5 text-right tabular-nums">{money(inv.amount_paid, inv.currency)}</td>
                      <td className="p-2.5 text-center">
                        <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'warning' : 'secondary'}>
                          {inv.status === 'paid' ? 'Pagada' : inv.status === 'open' ? 'Pendiente' : inv.status ?? '—'}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-right">
                        {(inv.invoice_pdf || inv.hosted_invoice_url) ? (
                          <a href={(inv.invoice_pdf || inv.hosted_invoice_url)!} target="_blank" rel="noreferrer" className="text-[var(--color-app-primary)] hover:underline">Ver</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field2({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-app-text-muted)]">{label}</p>
      <p className={cn('font-medium mt-0.5 truncate', mono && 'font-mono text-xs')} title={value}>{value}</p>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string;
  tone?: 'success' | 'warning' | 'primary';
}) {
  const color = tone === 'success' ? 'text-[var(--color-app-success)]'
    : tone === 'warning' ? 'text-[var(--color-app-warning)]'
    : tone === 'primary' ? 'text-[var(--color-app-primary)]' : 'text-[var(--color-app-text)]';
  return (
    <div className="rounded-xl border border-[var(--color-app-border)] bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
          <p className={cn('text-2xl font-semibold mt-1', color)}>{value}</p>
        </div>
        <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
      </div>
    </div>
  );
}

function EditTenantModal({ tenant, onClose, onSave }: {
  tenant: Tenant; onClose: () => void; onSave: (t: Tenant) => void;
}) {
  const [plan, setPlan] = useState<PlanKey>(tenant.plan);
  const [status, setStatus] = useState<SubscriptionStatus>(tenant.subscription.status);
  const [modules, setModules] = useState<ModuleKey[]>(tenant.enabledModules);

  const ceiling = useMemo(() => new Set(availableModulesForTenant({ plan })), [plan]);

  const toggle = (k: ModuleKey, on: boolean) =>
    setModules(prev => (on ? Array.from(new Set([...prev, k])) : prev.filter(m => m !== k)));

  const save = () => {
    onSave({
      ...tenant,
      plan,
      enabledModules: modules.filter(m => ceiling.has(m)),
      subscription: { ...tenant.subscription, status },
    });
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tenant.name}</DialogTitle>
          <DialogDescription>Plan, estatus de suscripción y módulos habilitados.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value as PlanKey)} className={selectCls}>
              {PLANS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Estatus</label>
            <select value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)} className={selectCls}>
              <option value="trialing">Prueba</option>
              <option value="active">Activa</option>
              <option value="past_due">Vencida</option>
              <option value="paused">Pausada</option>
              <option value="canceled">Cancelada</option>
            </select>
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs font-medium mb-2">Módulos habilitados</p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {MODULES.map(m => {
              const allowed = ceiling.has(m.key);
              return (
                <label key={m.key} className={cn('flex items-center gap-2 p-2 rounded border text-sm', !allowed && 'opacity-40')}>
                  <input
                    type="checkbox"
                    disabled={!allowed || m.core}
                    checked={modules.includes(m.key)}
                    onChange={e => toggle(m.key, e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-app-primary)]"
                  />
                  <span>{getModule(m.key).label}</span>
                  {m.core && <span className="text-[9px] uppercase text-[var(--color-app-text-subtle)] ml-auto">núcleo</span>}
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const selectCls =
  'w-full h-9 px-2.5 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40';
