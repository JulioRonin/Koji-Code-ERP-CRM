import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { STAFF_MEMBERS, StaffMember } from '@/data/crmData';

export interface LoginResult {
  ok: boolean;
  /** Mensaje accionable cuando ok === false. */
  error?: string;
}

interface AuthContextType {
  user: StaffMember | null;
  isAuthenticated: boolean;
  login: (department: string, email: string, passcode: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
  /** Indica si la app está usando Supabase Auth o el fallback demo. */
  authMode: 'supabase' | 'demo';
  /** true cuando el usuario llegó por un link de recuperación de contraseña. */
  isRecovery: boolean;
  /** Envía el correo de recuperación de contraseña. */
  requestPasswordReset: (email: string) => Promise<LoginResult>;
  /** Fija la nueva contraseña (requiere sesión de recuperación activa). */
  updatePassword: (newPassword: string) => Promise<LoginResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'koji_user';

/** Traduce los errores crudos de Supabase Auth a mensajes accionables. */
function humanizeAuthError(raw: string | undefined): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido confirmado. Revisa tu bandeja (y spam) y abre el enlace de confirmación, o pide a tu administrador que desactive la confirmación de correo.';
  }
  if (m.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos. Si es tu primer ingreso, usa exactamente la contraseña que te compartió el administrador, o recupérala con "¿Olvidaste tu contraseña?".';
  }
  if (m.includes('user not found')) {
    return 'No existe una cuenta con ese correo. Verifica que esté bien escrito o que ya hayas sido registrado.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Espera un minuto antes de volver a intentar.';
  }
  return raw || 'No se pudo iniciar sesión. Intenta de nuevo.';
}

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const authMode: 'supabase' | 'demo' = isSupabaseConfigured ? 'supabase' : 'demo';

  // Restaura sesión al cargar
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Modo demo: leemos del localStorage
      if (!supabase) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && !cancelled) {
          try {
            setUser(JSON.parse(saved));
          } catch {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Modo Supabase: hidratamos sesión + perfil
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user && !cancelled) {
        const profile = await fetchProfileAsStaffMember(sessionData.session.user.id);
        if (profile && !cancelled) setUser(profile);
      }
      if (!cancelled) setIsLoading(false);

      // Escuchamos cambios de auth
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;
        // El link del correo de recuperación dispara PASSWORD_RECOVERY:
        // marcamos modo recuperación para que la app mande al usuario a
        // fijar su nueva contraseña en lugar de dejarlo entrar al ERP.
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true);
        }
        if (event === 'SIGNED_OUT') {
          setIsRecovery(false);
        }
        if (session?.user) {
          const profile = await fetchProfileAsStaffMember(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      });

      return () => listener.subscription.unsubscribe();
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // `department` se conserva por compatibilidad con la pantalla de login,
  // pero YA NO bloquea el acceso: lo que importa es que el correo+contraseña
  // sean válidos. El acceso a módulos lo controla el rol (permissions.ts).
  // Esto elimina el caso típico donde un usuario nuevo elegía el departamento
  // equivocado y no podía entrar aunque su contraseña fuera correcta.
  const login = async (
    _department: string,
    email: string,
    passcode: string
  ): Promise<LoginResult> => {
    setIsLoading(true);

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: passcode,
        });
        if (error || !data.user) {
          setIsLoading(false);
          return { ok: false, error: humanizeAuthError(error?.message) };
        }
        const profile = await fetchProfileAsStaffMember(data.user.id);
        if (!profile) {
          await supabase.auth.signOut();
          setIsLoading(false);
          return {
            ok: false,
            error:
              'Tu cuenta existe pero no tiene un perfil asociado. Pide a tu administrador que te registre en el módulo Personal.',
          };
        }
        setUser(profile);
        setIsLoading(false);
        return { ok: true };
      }

      // --- Fallback demo ---
      await new Promise(resolve => setTimeout(resolve, 400));
      const found = STAFF_MEMBERS.find(
        u =>
          u.email.toLowerCase() === email.trim().toLowerCase() &&
          u.password === passcode
      );
      if (found) {
        setUser(found);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
        setIsLoading(false);
        return { ok: true };
      }
      setIsLoading(false);
      return { ok: false, error: 'Correo o contraseña incorrectos.' };
    } catch (err) {
      console.error('Auth login failed', err);
      setIsLoading(false);
      return { ok: false, error: 'Error de conexión. Revisa tu internet e intenta de nuevo.' };
    }
  };

  /** Envía el correo de recuperación. El link redirige a /reset-password. */
  const requestPasswordReset = async (email: string): Promise<LoginResult> => {
    if (!supabase) {
      return {
        ok: false,
        error: 'La recuperación de contraseña requiere Supabase configurado (modo demo no la soporta).',
      };
    }
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) return { ok: false, error: humanizeAuthError(error.message) };
      return { ok: true };
    } catch {
      return { ok: false, error: 'No se pudo enviar el correo. Intenta de nuevo.' };
    }
  };

  /** Fija la nueva contraseña usando la sesión de recuperación activa. */
  const updatePassword = async (newPassword: string): Promise<LoginResult> => {
    if (!supabase) {
      return { ok: false, error: 'Función no disponible en modo demo.' };
    }
    if (newPassword.length < 8) {
      return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes('session') || m.includes('jwt') || m.includes('token')) {
          return {
            ok: false,
            error:
              'El enlace de recuperación expiró o ya se usó. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".',
          };
        }
        return { ok: false, error: error.message };
      }
      setIsRecovery(false);
      return { ok: true };
    } catch {
      return { ok: false, error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' };
    }
  };

  const logout = () => {
    if (supabase) {
      supabase.auth.signOut();
    }
    setUser(null);
    setIsRecovery(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        isLoading,
        authMode,
        isRecovery,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Adapter: convierte un row de `profiles` (Supabase) al shape StaffMember
 * que los componentes ya conocen. Evita romper la UI existente.
 */
async function fetchProfileAsStaffMember(userId: string): Promise<StaffMember | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    name: data.full_name,
    role: data.role,
    department: data.department,
    avatar: initialsFor(data.full_name),
    email: data.email,
    phone: data.phone ?? '',
    status: 'Activo',
    joinDate: data.join_date,
    portfolio: {
      bio: data.bio ?? '',
      skills: [],
      certifications: [],
      experience: '',
    },
    salary: {
      base: data.salary ?? 0,
      bonus: 0,
      currency: 'MXN',
      lastPaymentDate: '',
    },
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
