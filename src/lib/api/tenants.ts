import { supabase } from '@/lib/supabase';
import type { Tenant, IndustryKey, PlanKey, ModuleKey, SubscriptionStatus } from '@/lib/saas';
import {
  listTenants as demoList,
  getTenant as demoGet,
  upsertTenant as demoUpsert,
  deleteTenant as demoDelete,
} from '@/lib/saas/platformStore';

/**
 * Capa de acceso a la tabla `tenants` de Supabase, con fallback al almacén
 * demo (localStorage) cuando no hay backend. Mapea la fila de la BD al tipo
 * `Tenant` del catálogo SaaS. La RLS ya limita lo que cada quien puede ver:
 * un usuario normal solo ve SU empresa; el dueño de plataforma, todas.
 */

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  industry: string;
  plan: string;
  status: string;
  enabled_modules: ModuleKey[] | null;
  billing_cycle: 'monthly' | 'annual';
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTenant(r: TenantRow): Tenant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    industry: r.industry as IndustryKey,
    plan: r.plan as PlanKey,
    enabledModules: r.enabled_modules ?? [],
    subscription: {
      status: r.status as SubscriptionStatus,
      currentPeriodEnd: r.current_period_end ?? r.trial_ends_at ?? null,
      billingCycle: r.billing_cycle ?? 'monthly',
      stripeCustomerId: r.stripe_customer_id,
      stripeSubscriptionId: r.stripe_subscription_id,
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function tenantToRow(t: Tenant): Record<string, unknown> {
  return {
    name: t.name,
    slug: t.slug,
    industry: t.industry,
    plan: t.plan,
    status: t.subscription.status,
    enabled_modules: t.enabledModules,
    billing_cycle: t.subscription.billingCycle,
    current_period_end: t.subscription.currentPeriodEnd,
    trial_ends_at: t.subscription.status === 'trialing' ? t.subscription.currentPeriodEnd : null,
    stripe_customer_id: t.subscription.stripeCustomerId ?? null,
    stripe_subscription_id: t.subscription.stripeSubscriptionId ?? null,
  };
}

/** Lista de empresas (RLS aplica: owner = todas, usuario = la suya). */
export async function listTenants(): Promise<Tenant[]> {
  if (!supabase) return demoList();
  const { data, error } = await supabase.from('tenants').select('*').order('name');
  if (error) throw error;
  return (data as TenantRow[]).map(rowToTenant);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  if (!supabase) return demoGet(id);
  const { data, error } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToTenant(data as TenantRow);
}

/** La empresa del usuario autenticado (resuelta de profiles.tenant_id). */
export async function getMyTenant(): Promise<Tenant | null> {
  if (!supabase) return demoList()[0] ?? null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: prof } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!prof?.tenant_id) return null;
  return getTenantById(prof.tenant_id as string);
}

/** Inserta una empresa nueva (onboarding). En Supabase el id lo genera la BD. */
export async function createTenant(t: Tenant): Promise<Tenant> {
  if (!supabase) {
    demoUpsert(t);
    return t;
  }
  const { data, error } = await supabase.from('tenants').insert(tenantToRow(t)).select('*').single();
  if (error) throw error;
  return rowToTenant(data as TenantRow);
}

/** Actualiza una empresa existente (plan, estatus, módulos…). */
export async function saveTenant(t: Tenant): Promise<void> {
  if (!supabase) {
    demoUpsert(t);
    return;
  }
  const { error } = await supabase.from('tenants').update(tenantToRow(t)).eq('id', t.id);
  if (error) throw error;
}

export async function deleteTenant(id: string): Promise<void> {
  if (!supabase) {
    demoDelete(id);
    return;
  }
  const { error } = await supabase.from('tenants').delete().eq('id', id);
  if (error) throw error;
}
