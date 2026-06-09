import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { STAFF_MEMBERS, StaffMember } from '@/data/crmData';

interface AuthContextType {
  user: StaffMember | null;
  isAuthenticated: boolean;
  login: (department: string, email: string, passcode: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  /** Indica si la app está usando Supabase Auth o el fallback demo. */
  authMode: 'supabase' | 'demo';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'koji_user';

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
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (cancelled) return;
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

  const login = async (department: string, email: string, passcode: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: passcode });
        if (error || !data.user) {
          setIsLoading(false);
          return false;
        }
        const profile = await fetchProfileAsStaffMember(data.user.id);
        if (!profile) {
          setIsLoading(false);
          return false;
        }
        // Validación opcional: forzar que el departamento coincida
        if (profile.department !== department && department !== 'Administrador') {
          await supabase.auth.signOut();
          setIsLoading(false);
          return false;
        }
        setUser(profile);
        setIsLoading(false);
        return true;
      }

      // --- Fallback demo ---
      await new Promise(resolve => setTimeout(resolve, 500));
      const found = STAFF_MEMBERS.find(
        u =>
          u.email.toLowerCase() === email.toLowerCase() &&
          u.password === passcode &&
          u.department === department
      );
      if (found) {
        setUser(found);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('Auth login failed', err);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    if (supabase) {
      supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout, isLoading, authMode }}
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
