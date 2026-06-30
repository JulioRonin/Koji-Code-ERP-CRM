/**
 * Logo de KANRI — concepto "Balón Datum".
 * Un balón de inspección (el círculo numerado de los planos globalizados
 * ISO 9001) con una K geométrica y una línea líder que apunta a un punto
 * bermellón: el punto medido y aprobado.
 *
 * Paleta de marca: Ink #16181D · Acento #E2401F · Paper #F7F5F0
 * Reglas: nunca deformar, recolorear el balón ni rotar el símbolo.
 */

export const KANRI = {
  ink: '#16181D',
  accent: '#E2401F',
  steel: '#8A9099',
  paper: '#F7F5F0',
};

interface SymbolProps {
  /** 'ink' = balón oscuro (sobre fondo claro); 'paper' = balón claro (sobre fondo oscuro). */
  tone?: 'ink' | 'paper';
  className?: string;
  /** Tamaño en px (cuadrado). */
  size?: number;
  title?: string;
}

/** Solo el símbolo (balón datum), sin recuadro. */
export function KanriMark({ tone = 'ink', className, size = 40, title = 'KANRI' }: SymbolProps) {
  const ring = tone === 'paper' ? KANRI.paper : KANRI.ink;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      {/* Balón de inspección (anillo) */}
      <circle cx="46" cy="46" r="33" stroke={ring} strokeWidth="9" />
      {/* K geométrica */}
      <g fill={ring}>
        <rect x="33" y="26" width="8.5" height="40" rx="1.5" />
        <path d="M41.5 46 L62 26 h-11.5 L41.5 38 z" />
        <path d="M41.5 46 L62 66 h-11.5 L41.5 54 z" />
      </g>
      {/* Línea líder + punto medido (acento bermellón) */}
      <line x1="69.5" y1="69.5" x2="88" y2="88" stroke={KANRI.accent} strokeWidth="8" strokeLinecap="round" />
      <circle cx="90" cy="90" r="8" fill={KANRI.accent} />
    </svg>
  );
}

interface LogoProps {
  variant?: 'default' | 'reversed';
  /** Mostrar wordmark "kanri" al lado. */
  wordmark?: boolean;
  /** Mostrar el tag japonés 管理 bajo el wordmark. */
  showKanji?: boolean;
  size?: number;
  className?: string;
}

/** App icon: símbolo dentro del recuadro Ink redondeado (uso en headers). */
export function KanriIcon({ size = 36, className }: { size?: number; className?: string }) {
  const r = size;
  return (
    <span
      className={className}
      style={{
        width: r,
        height: r,
        borderRadius: r * 0.28,
        background: KANRI.ink,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <KanriMark tone="paper" size={Math.round(r * 0.74)} />
    </span>
  );
}

/** Logo completo: icono + wordmark (Poppins). */
export function KanriLogo({ variant = 'default', wordmark = true, showKanji = false, size = 36, className }: LogoProps) {
  const reversed = variant === 'reversed';
  const textColor = reversed ? KANRI.paper : KANRI.ink;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <KanriIcon size={size} />
      {wordmark && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: 'Poppins, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: size * 0.62,
              letterSpacing: '-0.01em',
              color: textColor,
            }}
          >
            kanri
          </span>
          {showKanji && (
            <span
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: size * 0.26,
                letterSpacing: '0.35em',
                color: KANRI.steel,
                marginTop: size * 0.08,
              }}
            >
              管理
            </span>
          )}
        </span>
      )}
    </span>
  );
}
