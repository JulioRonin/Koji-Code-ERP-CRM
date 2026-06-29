import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Sparkles, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IndustryIcon } from '@/components/saas/IndustryIcon';
import { KanriLogo } from '@/components/saas/KanriLogo';
import { markEntered } from './LandingHome';
import {
  INDUSTRIES, PLANS, MODULES, getModule, getPlan, getIndustry,
  initialModules, availableModulesForTenant, formatMxn,
  type IndustryKey, type PlanKey, type ModuleKey, type Tenant,
} from '@/lib/saas';
import { upsertTenant, setActiveTenant, slugify, newTenantId } from '@/lib/saas/platformStore';

type Step = 1 | 2 | 3 | 4;

const DEMO_TRIAL_DAYS = 20;

export function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('demo') === '1';
  const [step, setStep] = useState<Step>(1);
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<PlanKey>('profesional');
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [creating, setCreating] = useState(false);

  const ceiling = useMemo(() => new Set(availableModulesForTenant({ plan })), [plan]);

  const goModulesStep = () => {
    if (industry) setModules(initialModules(industry, plan));
    setStep(4);
  };

  const toggleModule = (key: ModuleKey, on: boolean) => {
    setModules(prev => (on ? Array.from(new Set([...prev, key])) : prev.filter(m => m !== key)));
  };

  const handleCreate = () => {
    if (!industry || !name.trim()) return;
    setCreating(true);
    const now = new Date().toISOString();
    const planDef = getPlan(plan);
    const trialDays = isDemo ? DEMO_TRIAL_DAYS : planDef.trialDays;
    const tenant: Tenant = {
      id: newTenantId(),
      name: name.trim(),
      slug: slugify(name),
      industry,
      plan,
      enabledModules: modules,
      subscription: {
        status: 'trialing',
        currentPeriodEnd: new Date(Date.now() + trialDays * 86400_000).toISOString(),
        billingCycle: 'monthly',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
      createdAt: now,
      updatedAt: now,
    };
    upsertTenant(tenant);
    setActiveTenant(tenant.id);
    markEntered(); // entró a propósito: no volver a la pantalla de inicio
    // Recarga para que el TenantContext tome el nuevo activo.
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)]">
      <header className="border-b border-[var(--color-app-border)] bg-white">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-2">
          <KanriLogo size={28} />
          <span className="text-sm text-[var(--color-app-text-muted)] ml-2">· Configura tu empresa</span>
          {isDemo && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]">
              <Rocket className="h-3.5 w-3.5" /> Demo · {DEMO_TRIAL_DAYS} días gratis · sin tarjeta
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  s <= step ? 'bg-[var(--color-app-primary)] text-white' : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]'
                )}
              >
                {s < step ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              {s < 4 && <div className={cn('h-0.5 flex-1', s < step ? 'bg-[var(--color-app-primary)]' : 'bg-[var(--color-app-border)]')} />}
            </div>
          ))}
        </div>

        {/* Paso 1: giro */}
        {step === 1 && (
          <Section title="¿A qué se dedica tu empresa?" subtitle="Elige tu giro para activar los módulos adecuados.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind.key}
                  onClick={() => setIndustry(ind.key)}
                  className={cn(
                    'text-left p-4 rounded-xl border bg-white transition-all hover:shadow-sm',
                    industry === ind.key
                      ? 'border-[var(--color-app-primary)] ring-1 ring-[var(--color-app-primary)]/20'
                      : 'border-[var(--color-app-border)]'
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-[var(--color-app-primary-soft)] flex items-center justify-center mb-2.5">
                    <IndustryIcon name={ind.icon} className="h-4.5 w-4.5 text-[var(--color-app-primary)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-app-text)]">{ind.label}</p>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-1 leading-snug">{ind.tagline}</p>
                </button>
              ))}
            </div>
            <Nav onNext={() => setStep(2)} nextDisabled={!industry} />
          </Section>
        )}

        {/* Paso 2: datos empresa */}
        {step === 2 && (
          <Section title="Datos de tu empresa" subtitle="Así se mostrará tu marca dentro de la plataforma.">
            <div className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-app-text)]">Nombre de la empresa</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                  placeholder="Mi Taller S.A. de C.V."
                  className="w-full h-10 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
                />
                {name.trim() && (
                  <p className="text-xs text-[var(--color-app-text-subtle)]">
                    URL: kanri.app/<span className="font-mono">{slugify(name) || 'empresa'}</span>
                  </p>
                )}
              </div>
              {industry && (
                <div className="p-3 rounded-md bg-[var(--color-app-surface-alt)]/60 flex items-center gap-2.5 text-sm">
                  <IndustryIcon name={getIndustry(industry).icon} className="h-4 w-4 text-[var(--color-app-primary)]" />
                  Giro: <strong>{getIndustry(industry).label}</strong>
                </div>
              )}
            </div>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!name.trim()} />
          </Section>
        )}

        {/* Paso 3: plan */}
        {step === 3 && (
          <Section title="Elige tu plan" subtitle="Puedes cambiarlo cuando quieras. Todos incluyen prueba gratis.">
            <div className="grid sm:grid-cols-3 gap-3">
              {PLANS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPlan(p.key)}
                  className={cn(
                    'text-left p-4 rounded-xl border bg-white transition-all',
                    plan === p.key
                      ? 'border-[var(--color-app-primary)] ring-1 ring-[var(--color-app-primary)]/20'
                      : 'border-[var(--color-app-border)]'
                  )}
                >
                  <p className="text-sm font-semibold text-[var(--color-app-text)]">{p.label}</p>
                  <p className="text-lg font-bold mt-1">
                    {p.priceMxn == null ? 'A cotizar' : `${formatMxn(p.priceMxn)}`}
                    {p.priceMxn != null && <span className="text-xs font-normal text-[var(--color-app-text-muted)]">/mes</span>}
                  </p>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-1 leading-snug">{p.tagline}</p>
                </button>
              ))}
            </div>
            <Nav onBack={() => setStep(2)} onNext={goModulesStep} />
          </Section>
        )}

        {/* Paso 4: módulos */}
        {step === 4 && (
          <Section
            title="Módulos de tu plataforma"
            subtitle="Pre-seleccionamos los típicos de tu giro. Activa o desactiva los que quieras."
          >
            <div className="grid sm:grid-cols-2 gap-2">
              {MODULES.map(m => {
                const allowed = ceiling.has(m.key);
                const on = modules.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border bg-white cursor-pointer',
                      !allowed && 'opacity-50 cursor-not-allowed',
                      on && allowed && 'border-[var(--color-app-primary)]/40 bg-[var(--color-app-primary-soft)]/20'
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={!allowed || m.core}
                      checked={on}
                      onChange={e => toggleModule(m.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[var(--color-app-primary)]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-app-text)] flex items-center gap-1.5">
                        {getModule(m.key).label}
                        {m.core && <span className="text-[9px] uppercase bg-[var(--color-app-surface-alt)] px-1 rounded text-[var(--color-app-text-muted)]">núcleo</span>}
                        {!allowed && <span className="text-[9px] uppercase text-[var(--color-app-warning)]">plan superior</span>}
                      </p>
                      <p className="text-xs text-[var(--color-app-text-muted)] leading-snug">{m.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 p-3 rounded-md bg-[var(--color-app-success-soft)]/40 flex items-center gap-2 text-sm text-[var(--color-app-text)]">
              <Sparkles className="h-4 w-4 text-[var(--color-app-success)]" />
              {modules.length} módulos activos · plan {getPlan(plan).label} ·{' '}
              {isDemo ? `${DEMO_TRIAL_DAYS} días de demo (sin tarjeta)` : `${getPlan(plan).trialDays} días de prueba`}
            </div>
            <Nav
              onBack={() => setStep(3)}
              onNext={handleCreate}
              nextLabel={creating ? 'Creando…' : 'Crear empresa y entrar'}
              nextDisabled={creating}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-[var(--color-app-text)]">{title}</h1>
      <p className="text-sm text-[var(--color-app-text-muted)] mt-1 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function Nav({
  onBack, onNext, nextDisabled, nextLabel = 'Continuar',
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-8">
      {onBack ? (
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Atrás
        </Button>
      ) : <span />}
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
}
