import { Link, useNavigate } from 'react-router-dom';
import { Factory, LogIn, Building2, Rocket, ArrowRight, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

/** Marca esta sesión de navegador como "ya entré" para no volver a mostrar la
 *  pantalla de inicio al navegar dentro de la app. */
export function markEntered() {
  try {
    sessionStorage.setItem('kanri_entered', '1');
  } catch {
    /* ignore */
  }
}

export function LandingHome() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { company } = useCompany();
  const brand = company.commercial_name || company.legal_name || 'mi empresa';

  const enterApp = () => {
    markEntered();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] flex flex-col">
      {/* Topbar */}
      <header className="border-b border-[var(--color-app-border)] bg-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#0F0F10] flex items-center justify-center">
              <Factory className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[var(--color-app-text)]">KANRI</span>
          </div>
          <Link to="/pricing" className="text-sm text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)] inline-flex items-center gap-1.5">
            <Tags className="h-4 w-4" /> Ver planes
          </Link>
        </div>
      </header>

      {/* Hero + opciones */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-app-text)]">
              El ERP/CRM para tu taller
            </h1>
            <p className="mt-3 text-[var(--color-app-text-muted)] max-w-xl mx-auto">
              Manufactura CNC, maquinados, MRO, diseño, consultoría y más. Elige cómo
              quieres continuar.
            </p>
          </div>

          {/* Si ya hay sesión, atajo para entrar a su empresa */}
          {isAuthenticated && (
            <div className="mb-4 p-4 rounded-xl border border-[var(--color-app-primary)]/30 bg-[var(--color-app-primary-soft)]/20 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-app-text)]">Continuar en {brand}</p>
                <p className="text-xs text-[var(--color-app-text-muted)]">Ya tienes una sesión activa.</p>
              </div>
              <Button onClick={enterApp}>
                Entrar <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <OptionCard
              icon={LogIn}
              title="Iniciar sesión"
              desc="Entra a tu empresa con tu correo y contraseña."
              cta="Entrar"
              onClick={() => navigate('/login')}
            />
            <OptionCard
              icon={Building2}
              title="Registrar empresa"
              desc="Da de alta tu empresa y elige tu plan."
              cta="Registrarme"
              onClick={() => navigate('/onboarding')}
            />
            <OptionCard
              icon={Rocket}
              title="Probar demo"
              desc="20 días gratis, sin tarjeta de crédito."
              cta="Probar gratis"
              highlight
              onClick={() => navigate('/onboarding?demo=1')}
            />
          </div>

          <p className="text-center text-xs text-[var(--color-app-text-subtle)] mt-8">
            ¿Eres del equipo KANRI? Inicia sesión como administrador y entra al panel de Plataforma.
          </p>
        </div>
      </main>
    </div>
  );
}

function OptionCard({
  icon: Icon, title, desc, cta, onClick, highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; cta: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-2xl border bg-white transition-all hover:shadow-md flex flex-col ${
        highlight ? 'border-[var(--color-app-primary)] ring-1 ring-[var(--color-app-primary)]/20' : 'border-[var(--color-app-border)]'
      }`}
    >
      <div className="h-10 w-10 rounded-xl bg-[var(--color-app-primary-soft)] flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-[var(--color-app-primary)]" />
      </div>
      <p className="text-base font-semibold text-[var(--color-app-text)]">{title}</p>
      <p className="text-sm text-[var(--color-app-text-muted)] mt-1 flex-1">{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-app-primary)]">
        {cta} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}
