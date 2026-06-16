import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Lock, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Paso 2 de la recuperación: el usuario llega aquí desde el enlace del
 * correo. Supabase (detectSessionInUrl) ya estableció una sesión de
 * recuperación; aquí captura su nueva contraseña.
 */
export function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Verifica que haya una sesión de recuperación válida al cargar.
  // Damos un margen porque detectSessionInUrl procesa el hash de forma async.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!supabase) {
        if (!cancelled) setHasSession(false);
        return;
      }
      // Pequeña espera para que el SDK procese el token del hash de la URL.
      await new Promise(r => setTimeout(r, 400));
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setHasSession(!!data.session);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    const res = await updatePassword(password);
    setSaving(false);
    if (res.ok) {
      setDone(true);
      // Cierra la sesión de recuperación y manda al login tras 2.5s
      setTimeout(async () => {
        if (supabase) await supabase.auth.signOut();
        navigate('/login');
      }, 2500);
    } else {
      setError(res.error || 'No se pudo actualizar la contraseña.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-app-bg)]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[var(--color-app-primary)] flex items-center justify-center mb-4 shadow-sm">
            <Factory className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-app-text)]">Koji Code ERP</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nueva contraseña</CardTitle>
            <CardDescription>Define la contraseña con la que vas a ingresar.</CardDescription>
          </CardHeader>

          {hasSession === false ? (
            <CardContent className="space-y-4">
              <div className="p-4 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Enlace inválido o expirado</p>
                  <p className="text-[var(--color-app-text)]">
                    El enlace de recuperación no es válido, ya se usó o caducó. Solicita uno nuevo.
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate('/forgot-password')}>
                Solicitar nuevo enlace
              </Button>
            </CardContent>
          ) : done ? (
            <CardContent>
              <div className="p-4 rounded-md bg-[var(--color-app-success-soft)] text-sm text-[var(--color-app-success)] flex gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">¡Contraseña actualizada!</p>
                  <p className="text-[var(--color-app-text)]">
                    Te llevamos al inicio de sesión para que entres con tu nueva contraseña…
                  </p>
                </div>
              </div>
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
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full h-9 px-3 pr-9 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShow(v => !v)}
                      className="absolute right-2.5 top-2 text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Confirmar contraseña
                  </label>
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    placeholder="Repite la contraseña"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={saving || hasSession === null} className="w-full">
                  {hasSession === null ? 'Validando enlace…' : saving ? 'Guardando…' : 'Guardar nueva contraseña'}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
