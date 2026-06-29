import { supabase } from '@/lib/supabase';
import { createTenant } from './tenants';
import type { Tenant } from '@/lib/saas';

export interface SignupInput {
  /** Borrador de la empresa (en Supabase el id real lo asigna la función). */
  tenant: Tenant;
  adminName?: string;
  adminEmail: string;
  adminPassword: string;
  trialDays: number;
}

/**
 * Da de alta una empresa nueva y su primer administrador.
 * - Con Supabase: invoca la Edge Function `signup-tenant` (service_role).
 * - En modo demo: crea el tenant en localStorage (sin usuario real).
 */
export async function signupTenant(input: SignupInput): Promise<{ tenantId: string }> {
  if (!supabase) {
    const created = await createTenant(input.tenant);
    return { tenantId: created.id };
  }

  const { data, error } = await supabase.functions.invoke('signup-tenant', {
    body: {
      name: input.tenant.name,
      slug: input.tenant.slug,
      industry: input.tenant.industry,
      plan: input.tenant.plan,
      enabledModules: input.tenant.enabledModules,
      trialDays: input.trialDays,
      adminName: input.adminName,
      adminEmail: input.adminEmail,
      adminPassword: input.adminPassword,
    },
  });

  if (error) {
    // Intenta leer el mensaje devuelto por la función (viene en el contexto).
    let msg = error.message;
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      const body = ctx?.json ? await ctx.json() : null;
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return { tenantId: data.tenantId as string };
}
