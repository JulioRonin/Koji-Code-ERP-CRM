import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, AlertTriangle, CreditCard, ShieldCheck, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { KanriLogo, KANRI } from '@/components/saas/KanriLogo';
import { startCheckout, openBillingPortal } from '@/lib/api/billing';
import { PLANS, formatMxn, getPlan, daysLeft, subState, type PlanKey, type PlanDef } from '@/lib/saas';

/** Página de suscripción. Con `blocked` se usa como pantalla bloqueante cuando
 *  la demo terminó (cubre toda la pantalla, fuera del AppShell). */
export function Subscription({ blocked = false }: { blocked?: boolean }) {
  const { tenant } = useTenant();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(tenant.subscription.billingCycle === 'annual');
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      {error && (
        <div className="p-3 rounded-md bg-[var(--color-app-warning-soft)]/60 border border-[var(--color-app-warning)]/30 text-sm text-[var(--color-app-text)]">
          {error}
        </div>
      )}

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
          const price = annual ? p.priceMxnAnnual : p.priceMxn;
          const current = tenant.plan === p.key && state === 'active';
          return (
            <Card key={p.key} className={cn('p-0', p.featured && 'ring-1 ring-[var(--color-app-primary)]/30 border-[var(--color-app-primary)]')}>
              <CardContent className="p-5 flex flex-col h-full">
                {p.featured && <span className="self-start mb-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]">Más popular</span>}
                <h3 className="text-base font-semibold">{p.label}</h3>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-1 min-h-[36px]">{p.tagline}</p>
                <div className="mt-3 mb-3">
                  {price == null ? <span className="text-2xl font-bold">A cotizar</span> : (
                    <><span className="text-2xl font-bold">{formatMxn(price)}</span><span className="text-sm text-[var(--color-app-text-muted)]">/{annual ? 'año' : 'mes'}</span></>
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
