import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Mail, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Paso 1 de la recuperación: el usuario captura su correo y Supabase
 * le envía un enlace que lo lleva a /reset-password para fijar la nueva
 * contraseña.
 */
export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await requestPasswordReset(email);
    setSending(false);
    if (res.ok) setSent(true);
    else setError(res.error || 'No se pudo enviar el correo.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-app-bg)]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--color-app-primary)] flex items-center justify-center mb-4 shadow-sm">
            <Factory className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-app-text)]">KANRI</h1>
        </div>

        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)] transition-colors w-fit"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
            </button>
            <CardTitle className="text-lg mt-2">Recuperar contraseña</CardTitle>
            <CardDescription>
              Te enviaremos un enlace a tu correo para crear una nueva contraseña.
            </CardDescription>
          </CardHeader>

          {sent ? (
            <CardContent className="space-y-4">
              <div className="p-4 rounded-md bg-[var(--color-app-success-soft)] text-sm text-[var(--color-app-success)] flex gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Correo enviado</p>
                  <p className="text-[var(--color-app-text)]">
                    Si <strong>{email}</strong> tiene una cuenta, recibirás un enlace para
                    restablecer tu contraseña. Revisa también la carpeta de spam.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                Volver a iniciar sesión
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 bg-[var(--color-app-danger-soft)] border border-[var(--color-app-danger)]/30 rounded-md text-sm text-[var(--color-app-danger)] flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--color-app-text)] flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    placeholder="usuario@empresa.com"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={sending} className="w-full">
                  {sending ? 'Enviando…' : 'Enviar enlace de recuperación'}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
