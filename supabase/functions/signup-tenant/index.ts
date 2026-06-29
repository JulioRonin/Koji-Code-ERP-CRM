// ============================================================================
// KANRI · Edge Function: signup-tenant
// ----------------------------------------------------------------------------
// Auto-registro de una empresa nueva. Crea, de forma atómica y con
// service_role (bypasea RLS de forma segura):
//   1) el tenant (empresa) en estado de prueba,
//   2) el usuario admin en auth,
//   3) su perfil con tenant_id + rol Administrador.
//
// Es pública (el usuario aún no tiene sesión). Despliega con:
//   supabase functions deploy signup-tenant --no-verify-jwt
// Requiere los secrets (ya presentes por defecto en Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Payload {
  name: string;
  slug: string;
  industry: string;
  plan: string;
  enabledModules: string[];
  trialDays: number;
  adminName?: string;
  adminEmail: string;
  adminPassword: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  // Validaciones mínimas.
  if (!p.name?.trim()) return json({ error: 'Falta el nombre de la empresa.' }, 400);
  if (!p.adminEmail?.trim() || !/^\S+@\S+\.\S+$/.test(p.adminEmail)) return json({ error: 'Correo inválido.' }, 400);
  if (!p.adminPassword || p.adminPassword.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const trialEnds = new Date(Date.now() + (p.trialDays ?? 14) * 86400_000).toISOString();

  // 1) Crear el tenant.
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .insert({
      name: p.name.trim(),
      slug: p.slug,
      industry: p.industry ?? 'cnc',
      plan: p.plan ?? 'profesional',
      status: 'trialing',
      enabled_modules: p.enabledModules ?? [],
      billing_cycle: 'monthly',
      trial_ends_at: trialEnds,
      current_period_end: trialEnds,
    })
    .select('id')
    .single();
  if (tErr) {
    const msg = tErr.message.includes('duplicate') ? 'Ya existe una empresa con ese identificador (slug).' : tErr.message;
    return json({ error: msg }, 400);
  }

  // 2) Crear el usuario admin (email ya confirmado).
  const { data: userRes, error: uErr } = await admin.auth.admin.createUser({
    email: p.adminEmail.trim(),
    password: p.adminPassword,
    email_confirm: true,
    user_metadata: { full_name: p.adminName?.trim() || p.adminEmail.split('@')[0] },
  });
  if (uErr || !userRes.user) {
    // Rollback del tenant para no dejar basura.
    await admin.from('tenants').delete().eq('id', tenant.id);
    const msg = (uErr?.message || '').toLowerCase().includes('already')
      ? 'Ese correo ya está registrado. Inicia sesión.'
      : uErr?.message || 'No se pudo crear el usuario.';
    return json({ error: msg }, 400);
  }

  // 3) Vincular el perfil (el trigger handle_new_user ya lo creó) al tenant y
  //    asignar rol Administrador.
  const { error: pErr } = await admin
    .from('profiles')
    .update({
      tenant_id: tenant.id,
      role: 'Administrador',
      department: 'Administrador',
      full_name: p.adminName?.trim() || p.adminEmail.split('@')[0],
    })
    .eq('id', userRes.user.id);
  if (pErr) {
    // Compensación: borra user + tenant.
    await admin.auth.admin.deleteUser(userRes.user.id);
    await admin.from('tenants').delete().eq('id', tenant.id);
    return json({ error: `No se pudo configurar el perfil: ${pErr.message}` }, 400);
  }

  return json({ ok: true, tenantId: tenant.id });
});
