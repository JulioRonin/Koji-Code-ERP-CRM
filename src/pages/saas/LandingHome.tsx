import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { KanriLogo, KanriMark, KANRI } from '@/components/saas/KanriLogo';

/** Marca esta sesión de navegador como "ya entré" para no volver a mostrar la
 *  pantalla de inicio al navegar dentro de la app. */
export function markEntered() {
  try {
    sessionStorage.setItem('kanri_entered', '1');
  } catch {
    /* ignore */
  }
}

const FONT_DISPLAY = "'Poppins', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

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
    <div style={{ minHeight: '100vh', background: KANRI.paper, color: KANRI.ink }}>
      {/* Topbar */}
      <header style={{ borderBottom: `1px solid ${KANRI.steel}33`, background: KANRI.paper }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <KanriLogo size={34} showKanji />
          <div className="flex items-center gap-4">
            <Link
              to="/pricing"
              style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.08em', color: KANRI.steel }}
              className="hover:opacity-80 uppercase hidden sm:inline"
            >
              Planes
            </Link>
            <button
              onClick={() => navigate('/login')}
              style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 14, color: KANRI.ink, border: `1px solid ${KANRI.ink}`, borderRadius: 10 }}
              className="px-4 py-2 hover:bg-[#16181D] hover:text-[#F7F5F0] transition-colors"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-5">
        <section className="grid lg:grid-cols-2 gap-10 items-center pt-14 pb-10">
          {/* Izquierda: mensaje */}
          <div>
            <span
              style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.22em', color: KANRI.accent }}
              className="uppercase"
            >
              ERP · MES · QC
            </span>
            <h1
              style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}
              className="text-4xl sm:text-5xl mt-4"
            >
              La manufactura de tu taller,
              <br />
              <span style={{ color: KANRI.accent }}>bajo un solo techo.</span>
            </h1>
            <p style={{ color: '#3a3d44', fontFamily: FONT_DISPLAY }} className="mt-5 text-base max-w-md leading-relaxed">
              Cotización, producción, calidad ISO 9001 y embarque — conectados de punta a punta.
              Elige cómo quieres continuar.
            </p>

            {isAuthenticated && (
              <button
                onClick={enterApp}
                style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, background: KANRI.ink, color: KANRI.paper, borderRadius: 12 }}
                className="mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm hover:opacity-90"
              >
                Entrar a {brand}
                <Lead />
              </button>
            )}
          </div>

          {/* Derecha: panel "plano globalizado" con el símbolo */}
          <BlueprintPanel />
        </section>

        {/* Opciones — "estaciones" numeradas estilo balón de inspección */}
        <section className="pb-16">
          <div className="grid sm:grid-cols-3 gap-4">
            <Station
              n="01"
              title="Iniciar sesión"
              desc="Entra a tu empresa con tu correo y contraseña."
              onClick={() => navigate('/login')}
            />
            <Station
              n="02"
              title="Registrar empresa"
              desc="Da de alta tu taller y elige tu plan en minutos."
              onClick={() => navigate('/onboarding')}
            />
            <Station
              n="03"
              title="Probar demo"
              desc="20 días gratis. Sin tarjeta de crédito."
              highlight
              onClick={() => navigate('/onboarding?demo=1')}
            />
          </div>

          <p
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.1em', color: KANRI.steel }}
            className="text-center mt-10 uppercase"
          >
            ¿Equipo KANRI? Inicia sesión como administrador → panel de Plataforma
          </p>
        </section>
      </main>
    </div>
  );
}

/** Línea líder + punto, motivo de marca, como "flecha". */
function Lead() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
      <line x1="2" y1="7" x2="14" y2="7" stroke={KANRI.accent} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="7" r="3.5" fill={KANRI.accent} />
    </svg>
  );
}

/** Panel oscuro tipo plano técnico con el símbolo y balones de inspección. */
function BlueprintPanel() {
  const balloons = [
    { n: 1, x: 18, y: 24 },
    { n: 2, x: 80, y: 30 },
    { n: 3, x: 26, y: 78 },
    { n: 4, x: 84, y: 74 },
  ];
  return (
    <div
      className="relative rounded-2xl overflow-hidden aspect-[4/3] w-full"
      style={{
        background: KANRI.ink,
        backgroundImage:
          `linear-gradient(${KANRI.steel}22 1px, transparent 1px), linear-gradient(90deg, ${KANRI.steel}22 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
      }}
    >
      {/* Símbolo central grande */}
      <div className="absolute inset-0 flex items-center justify-center">
        <KanriMark tone="paper" size={180} />
      </div>
      {/* Balones de inspección decorativos */}
      {balloons.map(b => (
        <div
          key={b.n}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${b.x}%`, top: `${b.y}%` }}
        >
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: 26,
              height: 26,
              border: `2px solid ${KANRI.paper}`,
              color: KANRI.paper,
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {b.n}
          </span>
        </div>
      ))}
      {/* Tag inferior */}
      <span
        className="absolute bottom-4 left-4 uppercase"
        style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.2em', color: KANRI.steel }}
      >
        Balón datum · punto medido y aprobado
      </span>
    </div>
  );
}

/** Tarjeta de opción con balón numerado (motivo de marca) en lugar de ícono genérico. */
function Station({
  n, title, desc, onClick, highlight,
}: {
  n: string; title: string; desc: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left p-5 rounded-2xl transition-all hover:-translate-y-0.5"
      style={{
        background: highlight ? KANRI.ink : '#FFFFFF',
        border: `1px solid ${highlight ? KANRI.ink : KANRI.steel + '44'}`,
        boxShadow: highlight ? '0 12px 30px -12px rgba(226,64,31,0.45)' : '0 1px 2px rgba(22,24,29,0.04)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Balón numerado */}
        <span
          className="flex items-center justify-center rounded-full"
          style={{
            width: 40,
            height: 40,
            border: `2.5px solid ${highlight ? KANRI.accent : KANRI.ink}`,
            color: highlight ? KANRI.paper : KANRI.ink,
            fontFamily: FONT_MONO,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {n}
        </span>
        <Lead />
      </div>
      <p
        style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 17, color: highlight ? KANRI.paper : KANRI.ink }}
        className="mt-4"
      >
        {title}
      </p>
      <p
        style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: highlight ? '#C9CCD2' : '#5a5e66' }}
        className="mt-1 leading-snug"
      >
        {desc}
      </p>
    </button>
  );
}
