import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { IndustryIcon } from '@/components/saas/IndustryIcon';
import { KanriLogo, KANRI } from '@/components/saas/KanriLogo';
import { markEntered } from './LandingHome';
import { signupTenant } from '@/lib/api/signup';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  INDUSTRIES, PLANS, MODULES, getModule, getPlan, getIndustry,
  initialModules, availableModulesForTenant, formatMxn,
  type IndustryKey, type PlanKey, type ModuleKey, type Tenant,
} from '@/lib/saas';
import { slugify, newTenantId } from '@/lib/saas/platformStore';

const FONT_DISPLAY = "'Poppins', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
const DEMO_TRIAL_DAYS = 20;
const STEPS = ['Giro', 'Empresa', 'Plan', 'Módulos'];

type Step = 1 | 2 | 3 | 4;

/** Motivo de marca: línea líder + punto bermellón (en vez de flecha genérica). */
function Lead({ light }: { light?: boolean }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" className="shrink-0">
      <line x1="2" y1="7" x2="14" y2="7" stroke={light ? KANRI.paper : KANRI.accent} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="7" r="3.5" fill={light ? KANRI.paper : KANRI.accent} />
    </svg>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const { setActiveTenantId } = useTenant();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const needsAccount = !!supabase;

  const [step, setStep] = useState<Step>(1);
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState<PlanKey>('profesional');
  const [demoSelected, setDemoSelected] = useState(true);              // demo por default
  const [showPlans, setShowPlans] = useState(searchParams.get('plan') === '1');
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const ceiling = useMemo(() => new Set(availableModulesForTenant({ plan })), [plan]);
  const recommended = industry ? getIndustry(industry).recommendedPlan : 'profesional';
  const trialDays = demoSelected ? DEMO_TRIAL_DAYS : getPlan(plan).trialDays;

  const pickIndustry = (key: IndustryKey) => {
    setIndustry(key);
    setPlan(getIndustry(key).recommendedPlan); // pre-sugiere el plan del giro
  };

  const goModulesStep = () => {
    if (industry) setModules(initialModules(industry, plan));
    setStep(4);
  };

  const toggleModule = (key: ModuleKey, on: boolean) =>
    setModules(prev => (on ? Array.from(new Set([...prev, key])) : prev.filter(m => m !== key)));

  const handleCreate = async () => {
    if (!industry || !name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const now = new Date().toISOString();
    const draft: Tenant = {
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
    try {
      const { tenantId } = await signupTenant({ tenant: draft, adminName, adminEmail: adminEmail.trim(), adminPassword, trialDays });
      if (needsAccount) {
        const res = await login('', adminEmail.trim(), adminPassword);
        if (!res.ok) {
          setCreating(false);
          setCreateError(`Empresa creada, pero no se pudo iniciar sesión: ${res.error}. Intenta entrar manualmente.`);
          return;
        }
      }
      await setActiveTenantId(tenantId);
      markEntered();
      window.location.href = '/';
    } catch (err) {
      setCreating(false);
      setCreateError((err as Error).message || 'No se pudo crear la empresa.');
    }
  };

  const accountValid = !needsAccount || (/^\S+@\S+\.\S+$/.test(adminEmail) && adminPassword.length >= 8);

  return (
    <div style={{ minHeight: '100vh', background: KANRI.paper, color: KANRI.ink }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${KANRI.steel}33`, background: KANRI.paper }}>
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center gap-3">
          <KanriLogo size={30} />
          <span style={{ color: KANRI.steel, fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.08em' }} className="uppercase hidden sm:inline">
            / configura tu empresa
          </span>
          {demoSelected && (
            <span
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: `${KANRI.accent}14`, color: KANRI.accent, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.06em' }}
            >
              DEMO · {DEMO_TRIAL_DAYS} DÍAS · SIN TARJETA
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-9">
        {/* Stepper — estaciones numeradas (balón datum) */}
        <div className="flex items-center mb-9">
          {STEPS.map((label, i) => {
            const n = (i + 1) as Step;
            const done = n < step;
            const active = n === step;
            return (
              <div key={label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 'unset' }}>
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className="flex items-center justify-center rounded-full transition-all"
                    style={{
                      width: 34, height: 34,
                      background: done ? KANRI.ink : active ? KANRI.accent : 'transparent',
                      border: `2px solid ${done ? KANRI.ink : active ? KANRI.accent : KANRI.steel + '66'}`,
                      color: done || active ? KANRI.paper : KANRI.steel,
                      fontFamily: FONT_MONO, fontWeight: 600, fontSize: 13,
                    }}
                  >
                    {done ? <Check className="h-4 w-4" /> : `0${n}`}
                  </span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: active ? KANRI.ink : KANRI.steel }} className="uppercase hidden sm:block">
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2" style={{ background: n < step ? KANRI.accent : `${KANRI.steel}44` }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── PASO 1: giro ── */}
        {step === 1 && (
          <Section title="¿A qué se dedica tu empresa?" subtitle="Activamos los módulos y el plan ideal para tu giro.">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {INDUSTRIES.map((ind, idx) => {
                const sel = industry === ind.key;
                return (
                  <button
                    key={ind.key}
                    onClick={() => pickIndustry(ind.key)}
                    className="group text-left p-4 rounded-2xl transition-all hover:-translate-y-0.5"
                    style={{
                      background: sel ? KANRI.ink : '#FFFFFF',
                      border: `1.5px solid ${sel ? KANRI.ink : KANRI.steel + '33'}`,
                      boxShadow: sel ? '0 14px 30px -14px rgba(22,24,29,0.5)' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="flex items-center justify-center rounded-lg"
                        style={{ width: 36, height: 36, background: sel ? `${KANRI.paper}1A` : KANRI.paper, border: `1px solid ${sel ? KANRI.paper + '33' : KANRI.steel + '33'}` }}
                      >
                        <IndustryIcon name={ind.icon} className="h-4 w-4" />
                      </span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: sel ? KANRI.steel : KANRI.steel }}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: sel ? KANRI.paper : KANRI.ink }}>
                      {ind.label}
                    </p>
                    <p style={{ fontSize: 11.5, color: sel ? '#C9CCD2' : '#6b6f77', lineHeight: 1.45 }} className="mt-1">
                      {ind.tagline}
                    </p>
                    <span
                      className="inline-block mt-2.5 px-2 py-0.5 rounded-full"
                      style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: '0.05em', background: sel ? `${KANRI.accent}` : `${KANRI.accent}14`, color: sel ? KANRI.paper : KANRI.accent }}
                    >
                      {getPlan(ind.recommendedPlan).label.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
            <Nav onNext={() => setStep(2)} nextDisabled={!industry} />
          </Section>
        )}

        {/* ── PASO 2: empresa + cuenta admin ── */}
        {step === 2 && (
          <Section title="Datos de tu empresa" subtitle="Tu marca y tu acceso de administrador.">
            <div className="max-w-md space-y-4">
              <Field label="Nombre de la empresa">
                <Input value={name} onChange={setName} autoFocus placeholder="Mi Taller S.A. de C.V." />
                {name.trim() && (
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: KANRI.steel }} className="mt-1">
                    kanri.app/{slugify(name) || 'empresa'}
                  </p>
                )}
              </Field>
              {industry && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg" style={{ background: '#FFFFFF', border: `1px solid ${KANRI.steel}22` }}>
                  <IndustryIcon name={getIndustry(industry).icon} className="h-4 w-4" />
                  <span className="text-sm">Giro: <strong>{getIndustry(industry).label}</strong></span>
                </div>
              )}
              {needsAccount && (
                <div className="pt-2 space-y-4" style={{ borderTop: `1px solid ${KANRI.steel}22` }}>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '0.12em', color: KANRI.steel }} className="uppercase pt-2">
                    Tu cuenta de administrador
                  </p>
                  <Field label="Tu nombre"><Input value={adminName} onChange={setAdminName} placeholder="Nombre y apellido" /></Field>
                  <Field label="Correo (será tu acceso)"><Input value={adminEmail} onChange={setAdminEmail} type="email" placeholder="tu@empresa.com" /></Field>
                  <Field label="Contraseña"><Input value={adminPassword} onChange={setAdminPassword} type="password" placeholder="Mínimo 8 caracteres" /></Field>
                </div>
              )}
            </div>
            <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!name.trim() || !accountValid} />
          </Section>
        )}

        {/* ── PASO 3: plan (demo por default + ver planes) ── */}
        {step === 3 && (
          <Section title="¿Cómo quieres empezar?" subtitle="Arranca gratis con la demo o elige un plan desde el inicio.">
            {/* Tarjeta DEMO destacada */}
            <button
              onClick={() => setDemoSelected(true)}
              className="w-full text-left p-5 rounded-2xl transition-all"
              style={{
                background: demoSelected ? KANRI.ink : '#FFFFFF',
                border: `1.5px solid ${demoSelected ? KANRI.ink : KANRI.steel + '33'}`,
                boxShadow: demoSelected ? '0 16px 36px -16px rgba(226,64,31,0.4)' : 'none',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.12em', color: KANRI.accent }} className="uppercase">
                    Recomendado para empezar
                  </span>
                  <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: demoSelected ? KANRI.paper : KANRI.ink }} className="mt-1">
                    Demo gratis · {DEMO_TRIAL_DAYS} días
                  </p>
                  <p style={{ fontSize: 13, color: demoSelected ? '#C9CCD2' : '#6b6f77' }} className="mt-1">
                    Sin tarjeta. Prueba KANRI con tu giro <strong>{industry ? getIndustry(industry).label : ''}</strong> y sus módulos sugeridos.
                  </p>
                </div>
                <span
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 26, height: 26, border: `2px solid ${demoSelected ? KANRI.accent : KANRI.steel + '66'}`, background: demoSelected ? KANRI.accent : 'transparent' }}
                >
                  {demoSelected && <Check className="h-3.5 w-3.5" style={{ color: KANRI.paper }} />}
                </span>
              </div>
            </button>

            {/* Recomendación de plan por giro + toggle */}
            <div className="flex items-center justify-between mt-4 mb-2 flex-wrap gap-2">
              <p style={{ fontSize: 13, color: '#5a5e66' }}>
                ¿Buscas un plan desde ahora? Para <strong>{industry ? getIndustry(industry).label : 'tu giro'}</strong> sugerimos el plan{' '}
                <strong style={{ color: KANRI.accent }}>{getPlan(recommended).label}</strong>.
              </p>
              <button
                onClick={() => setShowPlans(v => !v)}
                style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, color: KANRI.ink, border: `1px solid ${KANRI.ink}`, borderRadius: 10 }}
                className="px-3.5 py-1.5 hover:bg-[#16181D] hover:text-[#F7F5F0] transition-colors"
              >
                {showPlans ? 'Ocultar planes' : 'Ver planes'}
              </button>
            </div>

            {showPlans && (
              <div className="grid sm:grid-cols-3 gap-3 mt-2">
                {PLANS.map(p => {
                  const isRec = p.key === recommended;
                  const sel = !demoSelected && plan === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => { setPlan(p.key); setDemoSelected(false); }}
                      className="text-left p-4 rounded-2xl transition-all relative"
                      style={{
                        background: sel ? KANRI.ink : '#FFFFFF',
                        border: `1.5px solid ${sel ? KANRI.ink : isRec ? KANRI.accent : KANRI.steel + '33'}`,
                      }}
                    >
                      {isRec && (
                        <span
                          className="absolute -top-2 left-3 px-2 py-0.5 rounded-full"
                          style={{ background: KANRI.accent, color: KANRI.paper, fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.05em' }}
                        >
                          SUGERIDO
                        </span>
                      )}
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: sel ? KANRI.paper : KANRI.ink }}>{p.label}</p>
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: sel ? KANRI.paper : KANRI.ink }} className="mt-1">
                        {p.priceMxn == null ? 'A cotizar' : formatMxn(p.priceMxn)}
                        {p.priceMxn != null && <span style={{ fontSize: 11, fontWeight: 400, color: KANRI.steel }}>/mes</span>}
                      </p>
                      <p style={{ fontSize: 11.5, color: sel ? '#C9CCD2' : '#6b6f77', lineHeight: 1.4 }} className="mt-1">{p.tagline}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <Nav onBack={() => setStep(2)} onNext={goModulesStep} />
          </Section>
        )}

        {/* ── PASO 4: módulos ── */}
        {step === 4 && (
          <Section title="Módulos de tu plataforma" subtitle="Pre-seleccionados para tu giro. Ajusta lo que quieras.">
            <div className="grid sm:grid-cols-2 gap-2">
              {MODULES.map(m => {
                const allowed = ceiling.has(m.key);
                const on = modules.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{
                      background: on && allowed ? '#FFFFFF' : '#FFFFFF',
                      border: `1px solid ${on && allowed ? KANRI.accent + '66' : KANRI.steel + '22'}`,
                      opacity: allowed ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!allowed || m.core}
                      checked={on}
                      onChange={e => toggleModule(m.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                      style={{ accentColor: KANRI.accent }}
                    />
                    <div className="min-w-0">
                      <p style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 13.5 }} className="flex items-center gap-1.5">
                        {getModule(m.key).label}
                        {m.core && <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, background: '#efece5', color: KANRI.steel }} className="px-1 rounded uppercase">núcleo</span>}
                        {!allowed && <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: KANRI.accent }} className="uppercase">plan superior</span>}
                      </p>
                      <p style={{ fontSize: 11.5, color: '#6b6f77', lineHeight: 1.4 }}>{m.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#FFFFFF', border: `1px solid ${KANRI.steel}22`, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: KANRI.accent }} />
              {modules.length} módulos · plan {getPlan(plan).label} · {trialDays} días de prueba
            </div>
            {createError && (
              <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: `${KANRI.accent}14`, color: KANRI.accent, border: `1px solid ${KANRI.accent}33` }}>
                {createError}
              </div>
            )}
            <Nav onBack={() => setStep(3)} onNext={handleCreate} nextLabel={creating ? 'Creando…' : 'Crear empresa y entrar'} nextDisabled={creating} />
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Subcomponentes de marca ──
function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.02em' }} className="text-xl sm:text-2xl">{title}</h1>
      <p style={{ color: '#5a5e66' }} className="text-sm mt-1 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }} className="text-sm">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = 'text', autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      autoFocus={autoFocus}
      style={{ fontFamily: FONT_DISPLAY, borderColor: `${KANRI.steel}66` }}
      className="w-full h-11 px-3 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E2401F]/25 focus:border-[#E2401F]"
    />
  );
}

function Nav({
  onBack, onNext, nextDisabled, nextLabel = 'Continuar',
}: {
  onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-8">
      {onBack ? (
        <button
          onClick={onBack}
          style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, color: KANRI.ink, border: `1px solid ${KANRI.steel}66`, borderRadius: 12 }}
          className="px-4 py-2.5 text-sm hover:bg-white"
        >
          ← Atrás
        </button>
      ) : <span />}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, background: KANRI.ink, color: KANRI.paper, borderRadius: 12, opacity: nextDisabled ? 0.45 : 1 }}
        className="px-5 py-2.5 text-sm inline-flex items-center gap-2.5 hover:opacity-90 transition-opacity"
      >
        {nextLabel} <Lead light />
      </button>
    </div>
  );
}
