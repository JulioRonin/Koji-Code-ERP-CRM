import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Factory, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PLANS, formatMxn, type PlanDef } from '@/lib/saas';

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--color-app-border)] bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#0F0F10] flex items-center justify-center">
              <Factory className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[var(--color-app-text)]">KANRI</span>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="sm">Iniciar sesión</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-[var(--color-app-text)]">
            El ERP/CRM para tu taller, a tu medida
          </h1>
          <p className="mt-3 text-[var(--color-app-text-muted)]">
            Elige el plan según tu giro y crece cuando lo necesites. 14 días de prueba,
            sin tarjeta. Cancela cuando quieras.
          </p>

          {/* Toggle mensual / anual */}
          <div className="mt-6 inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)]">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                !annual ? 'bg-white shadow-sm text-[var(--color-app-text)]' : 'text-[var(--color-app-text-muted)]'
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                annual ? 'bg-white shadow-sm text-[var(--color-app-text)]' : 'text-[var(--color-app-text-muted)]'
              )}
            >
              Anual <span className="text-[var(--color-app-success)]">−2 meses</span>
            </button>
          </div>
        </div>

        {/* Planes */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map(plan => (
            <PlanCard key={plan.key} plan={plan} annual={annual} />
          ))}
        </div>

        <p className="text-center text-xs text-[var(--color-app-text-subtle)] mt-8">
          Precios en MXN + IVA. Enterprise se cotiza según número de usuarios, integraciones y
          requerimientos de aislamiento de datos.
        </p>
      </main>
    </div>
  );
}

function PlanCard({ plan, annual }: { plan: PlanDef; annual: boolean }) {
  const price = annual ? plan.priceMxnAnnual : plan.priceMxn;
  const isCustom = price == null;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-6 flex flex-col',
        plan.featured
          ? 'border-[var(--color-app-primary)] shadow-lg ring-1 ring-[var(--color-app-primary)]/20'
          : 'border-[var(--color-app-border)]'
      )}
    >
      {plan.featured && (
        <span className="self-start mb-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]">
          Más popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-[var(--color-app-text)]">{plan.label}</h3>
      <p className="text-sm text-[var(--color-app-text-muted)] mt-1 min-h-[40px]">{plan.tagline}</p>

      <div className="mt-4 mb-1">
        {isCustom ? (
          <span className="text-3xl font-bold text-[var(--color-app-text)]">A cotizar</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-[var(--color-app-text)]">{formatMxn(price!)}</span>
            <span className="text-sm text-[var(--color-app-text-muted)]"> /{annual ? 'año' : 'mes'}</span>
          </>
        )}
      </div>
      <p className="text-xs text-[var(--color-app-text-subtle)] mb-4">
        {plan.trialDays} días de prueba gratis
      </p>

      <Link to="/login" className="block">
        <Button className="w-full" variant={plan.featured ? 'default' : 'outline'}>
          {isCustom ? 'Contactar ventas' : 'Comenzar prueba'} <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </Link>

      <ul className="mt-5 space-y-2.5">
        {plan.highlights.map(h => (
          <li key={h} className="flex items-start gap-2 text-sm text-[var(--color-app-text)]">
            <Check className="h-4 w-4 text-[var(--color-app-success)] shrink-0 mt-0.5" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
