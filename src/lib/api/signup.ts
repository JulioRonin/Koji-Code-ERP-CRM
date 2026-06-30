import { supabase } from '@/lib/supabase';
import { createTenant } from './tenants';
import type { Tenant } from '@/lib/saas';

export interface SignupInput {
  tenant: Tenant;
  adminName?: string;
  adminEmail: string;
  adminPassword: string;
  trialDays: number;
}

export interface SignupResult {
  /** Sólo en modo demo: el id local del tenant creado. */
  tenantId?: string;
  /** true si Supabase requiere confirmar el correo antes de entrar. */
  needsConfirmation: boolean;
}

function humanize(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already'))
    return 'Ese correo ya está registrado. Inicia sesión.';
  if (m.includes('password')) return 'La contraseña no cumple los requisitos (mínimo 8 caracteres).';
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  return msg || 'No se pudo crear la empresa.';
}

/**
 * Da de alta una empresa nueva y su primer administrador.
 * - Con Supabase: usa auth.signUp con metadata; un trigger en la BD crea el
 *   tenant + el perfil admin automáticamente (no requiere Edge Function).
 * - En modo demo: crea el tenant en localStorage.
 */
export async function signupTenant(input: SignupInput): Promise<SignupResult> {
  if (!supabase) {
    const created = await createTenant(input.tenant);
    return { tenantId: created.id, needsConfirmation: false };
  }

  const trialEnds = new Date(Date.now() + input.trialDays * 86400_000).toISOString();
  const { data, error } = await supabase.auth.signUp({
    email: input.adminEmail.trim(),
    password: input.adminPassword,
    options: {
      data: {
        kanri_signup: 'true',
        full_name: input.adminName ?? '',
        tenant_name: input.tenant.name,
        slug: input.tenant.slug,
        industry: input.tenant.industry,
        plan: input.tenant.plan,
        enabled_modules: input.tenant.enabledModules,
        trial_ends_at: trialEnds,
      },
    },
  });
  if (error) throw new Error(humanize(error.message));

  // Si hay sesión, el correo no requiere confirmación y ya quedó autenticado.
  return { needsConfirmation: !data.session };
}
