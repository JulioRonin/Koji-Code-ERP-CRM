import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { KanriLogo, KANRI } from '@/components/saas/KanriLogo';

const FONT_DISPLAY = "'Poppins', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

/**
 * Login por correo (identifier-first). El usuario escribe su correo y
 * contraseña; el sistema resuelve su empresa (tenant) y su rol a partir del
 * perfil. NO se muestra ninguna empresa ni se elige departamento — así un
 * cliente nunca sabe de los demás clientes de la plataforma.
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // El primer argumento (departamento) se ignora: lo que vale es el correo +
    // contraseña; el rol/empresa salen del perfil.
    const result = await login('', email, password);

    if (result.ok) {
      try {
        sessionStorage.setItem('kanri_entered', '1');
      } catch {
        /* ignore */
      }
      // El destino se resuelve por rol en el ProtectedRoute (técnico → su
      // portal; resto → su dashboard). Con multi-tenant, el perfil ya fijó la
      // empresa activa.
      navigate('/');
    } else {
      setError(result.error || 'No se pudo iniciar sesión.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: KANRI.paper, color: KANRI.ink }} className="flex flex-col">
      {/* Topbar mínima de plataforma */}
      <header style={{ borderBottom: `1px solid ${KANRI.steel}33` }}>
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/welcome"><KanriLogo size={32} /></Link>
          <Link
            to="/onboarding"
            style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '0.08em', color: KANRI.steel }}
            className="uppercase hover:opacity-80"
          >
            Crear empresa
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.02em' }} className="text-2xl">
              Inicia sesión
            </h1>
            <p style={{ color: '#5a5e66', fontFamily: FONT_DISPLAY }} className="text-sm mt-1.5">
              Entra con tu correo. Te llevamos a tu empresa automáticamente.
            </p>
          </div>

          <div
            className="rounded-2xl p-6"
            style={{ background: '#FFFFFF', border: `1px solid ${KANRI.steel}33`, boxShadow: '0 1px 2px rgba(22,24,29,0.05)' }}
          >
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{ background: `${KANRI.accent}14`, color: KANRI.accent, border: `1px solid ${KANRI.accent}33` }}
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }} className="text-sm flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" style={{ color: KANRI.steel }} /> Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  style={{ fontFamily: FONT_DISPLAY, borderColor: `${KANRI.steel}66` }}
                  className="w-full h-11 px-3 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E2401F]/30 focus:border-[#E2401F]"
                />
              </div>

              <div className="space-y-1.5">
                <label style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }} className="text-sm flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" style={{ color: KANRI.steel }} /> Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ fontFamily: FONT_DISPLAY, borderColor: `${KANRI.steel}66` }}
                  className="w-full h-11 px-3 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E2401F]/30 focus:border-[#E2401F]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, background: KANRI.ink, color: KANRI.paper }}
                className="w-full h-11 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {isLoading ? 'Verificando…' : <>Entrar <ArrowRight className="h-4 w-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                style={{ color: KANRI.accent, fontFamily: FONT_DISPLAY }}
                className="w-full text-xs text-center hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          </div>

          <p
            style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', color: KANRI.steel }}
            className="text-center mt-6 uppercase"
          >
            Powered by KANRI · 管理
          </p>
        </div>
      </main>
    </div>
  );
}
