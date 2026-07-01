import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Clock, AlertTriangle, CreditCard, ShieldCheck, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Receipt, ExternalLink, FileText as FileIcon } from 'lucide-react';
import { KanriLogo, KANRI } from '@/components/saas/KanriLogo';
import { PromoBanner } from '@/components/saas/PromoCountdown';
import { startCheckout, openBillingPortal, listInvoices, type StripeInvoice } from '@/lib/api/billing';
import { PLANS, formatMxn, effectivePrice, getPlan, daysLeft, subState, type PlanKey, type PlanDef } from '@/lib/saas';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-app-text-muted)]">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}

/** Página de suscripción. Con `blocked` se usa como pantalla bloqueante cuando
 *  la demo terminó (cubre toda la pantalla, fuera del AppShell). */
export function Subscription({ blocked = false }: { blocked?: boolean }) {
  const { tenant, refresh } = useTenant();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [annual, setAnnual] = useState(tenant.subscription.billingCycle === 'annual');
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);

  // Carga el historial de pagos del cliente (facturas de Stripe).
  useEffect(() => {
    let alive = true;
    listInvoices().then(inv => { if (alive) { setInvoices(inv); setLoadingInv(false); } });
    return () => { alive = false; };
  }, []);

  // Al volver de Stripe: refresca el estado del tenant (el webhook ya lo activó)
  // y muestra confirmación. Reintenta unas veces por si el webhook tarda.
  useEffect(() => {
    const checkout = params.get('checkout');
    if (!checkout) return;
    if (checkout === 'success') {
      setNotice('¡Pago recibido! Estamos activando tu suscripción…');
      let tries = 0;
      const poll = setInterval(async () => {
        tries += 1;
        await refresh();
        if (tries >= 5) clearInterval(poll);
      }, 2500);
    } else if (checkout === 'cancel') {
      setNotice('Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.');
    }
    params.delete('checkout');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = subState(tenant);
  const left = daysLeft(tenant);
  const plan = getPlan(tenant.plan);

  const subscribe = async (p: PlanDef) => {
    if (p.priceMxn == null) { window.location.href = 'mailto:ventas@kanri.app?subject=Plan Enterprise'; return; }
    setError(null);
    setBusyPlan(p.key);
    try {
      await startCheckout(p.key, annual ? 'annual' : 'monthly');
    } catch (err) {
      setError((err as Error).message);
      setBusyPlan(null);
    }
  };

  const StatusBanner = () => {
    if (state === 'active') {
      return (
        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-[var(--color-app-success)]/30 bg-[var(--color-app-success-soft)]/40 text-sm">
          <ShieldCheck className="h-4 w-4 text-[var(--color-app-success)]" />
          Suscripción <strong>activa</strong> · plan {plan.label}.
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => openBillingPortal().catch(e => setError((e as Error).message))}>
            <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Gestionar facturación
          </Button>
        </div>
      );
    }
    if (state === 'trial') {
      const total = plan.trialDays || 20;
      const pct = Math.max(4, Math.min(100, ((total - left) / total) * 100));
      return (
        <div className="p-4 rounded-lg border border-[var(--color-app-primary)]/30 bg-[var(--color-app-primary-soft)]/30">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-app-text)]">
            <Clock className="h-4 w-4 text-[var(--color-app-primary)]" />
            Estás en <strong>demo</strong> · te quedan <strong>{left} día{left === 1 ? '' : 's'}</strong>
          </div>
          <div className="h-2 rounded-full bg-white mt-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-app-primary)' }} />
          </div>
          <p className="text-xs text-[var(--color-app-text-muted)] mt-1.5">
            Suscríbete antes de que termine para no perder el acceso ni tus datos.
          </p>
        </div>
      );
    }
    // bloqueado / vencido
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-lg border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)]/40 text-sm">
        <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />
        {state === 'past_due' ? 'Tu pago está pendiente.' : 'Tu periodo de prueba terminó.'} Elige un plan para continuar.
      </div>
    );
  };

  const inner = (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Suscripción</h1>
        <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
          {blocked ? 'Activa tu plan para seguir usando KANRI.' : 'Tu plan, tu demo y la facturación de tu empresa.'}
        </p>
      </div>

      <StatusBanner />

      {notice && (
        <div className="p-3 rounded-md bg-[var(--color-app-success-soft)]/60 border border-[var(--color-app-success)]/30 text-sm text-[var(--color-app-text)]">
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-[var(--color-app-warning-soft)]/60 border border-[var(--color-app-warning)]/30 text-sm text-[var(--color-app-text)]">
          {error}
        </div>
      )}

      {/* Mi facturación: resumen + historial de pagos */}
      <Card className="p-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Mi facturación
            </h2>
            <Button variant="outline" size="sm" onClick={() => openBillingPortal().catch(e => setError((e as Error).message))}>
              <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Gestionar en Stripe
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Detail label="Plan" value={plan.label} />
            <Detail label="Ciclo" value={tenant.subscription.billingCycle === 'annual' ? 'Anual' : 'Mensual'} />
            <Detail label="Estatus" value={state === 'active' ? 'Activa' : state === 'trial' ? 'Demo' : state === 'past_due' ? 'Pago pendiente' : 'Vencida'} />
            <Detail
              label={state === 'trial' ? 'Fin de la demo' : 'Próxima renovación'}
              value={tenant.subscription.currentPeriodEnd ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString('es-MX') : '—'}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--color-app-text-muted)] mb-1.5">Historial de pagos</p>
            {loadingInv ? (
              <p className="text-sm text-[var(--color-app-text-muted)] py-3">Cargando…</p>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-[var(--color-app-text-muted)] py-3">
                Aún no hay pagos registrados. Aparecerán aquí automáticamente después de tu primer cobro.
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
                        <td className="p-2.5 text-right tabular-nums">
                          {(inv.amount_paid / 100).toLocaleString('es-MX', { style: 'currency', currency: (inv.currency || 'mxn').toUpperCase() })}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'warning' : 'secondary'}>
                            {inv.status === 'paid' ? 'Pagada' : inv.status === 'open' ? 'Pendiente' : inv.status ?? '—'}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right">
                          {inv.invoice_pdf ? (
                            <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-app-primary)] hover:underline">
                              <FileIcon className="h-3.5 w-3.5" /> PDF
                            </a>
                          ) : inv.hosted_invoice_url ? (
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--color-app-primary)] hover:underline">
                              <ExternalLink className="h-3.5 w-3.5" /> Ver
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Oferta de lanzamiento con contador */}
      <PromoBanner />

      {/* Toggle ciclo */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)]">
          <button onClick={() => setAnnual(false)} className={cn('px-4 py-1.5 text-sm font-medium rounded-md', !annual ? 'bg-white shadow-sm' : 'text-[var(--color-app-text-muted)]')}>Mensual</button>
          <button onClick={() => setAnnual(true)} className={cn('px-4 py-1.5 text-sm font-medium rounded-md', annual ? 'bg-white shadow-sm' : 'text-[var(--color-app-text-muted)]')}>
            Anual <span className="text-[var(--color-app-success)]">−2 meses</span>
          </button>
        </div>
      </div>

      {/* Planes */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map(p => {
          const ep = effectivePrice(p, annual);
          const current = tenant.plan === p.key && state === 'active';
          return (
            <Card key={p.key} className={cn('p-0 relative', p.featured && 'ring-1 ring-[var(--color-app-primary)]/30 border-[var(--color-app-primary)]')}>
              <CardContent className="p-5 flex flex-col h-full">
                {ep.promo && <span className="absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-app-primary)] text-white">−{ep.discountPct}%</span>}
                {p.featured && <span className="self-start mb-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]">Más popular</span>}
                <h3 className="text-base font-semibold">{p.label}</h3>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-1 min-h-[36px]">{p.tagline}</p>
                <div className="mt-3 mb-3">
                  {ep.price == null ? <span className="text-2xl font-bold">A cotizar</span> : (
                    <>
                      {ep.promo && <span className="text-sm text-[var(--color-app-text-subtle)] line-through mr-1.5">{formatMxn(ep.list!)}</span>}
                      <span className="text-2xl font-bold">{formatMxn(ep.price)}</span>
                      <span className="text-sm text-[var(--color-app-text-muted)]">/{annual ? 'año' : 'mes'}</span>
                      {ep.promo && <p className="text-[11px] text-[var(--color-app-primary)] font-medium mt-0.5">Oferta · regresa a {formatMxn(ep.list!)}</p>}
                    </>
                  )}
                </div>
                <Button
                  className="w-full"
                  variant={p.featured ? 'default' : 'outline'}
                  disabled={current || busyPlan === p.key}
                  onClick={() => subscribe(p)}
                >
                  {busyPlan === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? 'Tu plan actual' : p.priceMxn == null ? 'Contactar ventas' : 'Suscribirme'}
                </Button>
                <ul className="mt-4 space-y-2">
                  {p.highlights.map(h => (
                    <li key={h} className="flex items-start gap-2 text-xs text-[var(--color-app-text)]">
                      <Check className="h-3.5 w-3.5 text-[var(--color-app-success)] shrink-0 mt-0.5" /> {h}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-[var(--color-app-text-subtle)]">
        Precios en MXN + IVA. El cobro se procesa de forma segura con Stripe.
      </p>
    </div>
  );

  if (!blocked) return inner;

  // Modo bloqueante: pantalla completa fuera del AppShell.
  return (
    <div style={{ minHeight: '100vh', background: KANRI.paper }} className="overflow-y-auto">
      <header style={{ borderBottom: `1px solid ${KANRI.steel}33` }}>
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <KanriLogo size={30} />
          <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/welcome'); }}>
            <LogOut className="h-4 w-4 mr-1.5" /> Salir
          </Button>
        </div>
      </header>
      <main className="px-5 py-10">{inner}</main>
    </div>
  );
}
