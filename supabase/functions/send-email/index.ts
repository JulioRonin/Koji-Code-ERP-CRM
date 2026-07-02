// ============================================================================
// KANRI · Edge Function: send-email (Resend)
// ----------------------------------------------------------------------------
// Envía un correo transaccional con Resend. Lo llama un usuario autenticado
// (avisos de avance a clientes, envío de cotizaciones/facturas, etc.).
//
// Despliega con:  supabase functions deploy send-email
// Secrets:
//   RESEND_API_KEY   (re_...)
//   RESEND_FROM      remitente verificado, p. ej. "KANRI <avisos@tudominio.com>"
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (presentes por defecto)
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
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  if (!apiKey || !from) return json({ error: 'Resend no está configurado (RESEND_API_KEY / RESEND_FROM).' }, 500);

  // Solo usuarios autenticados pueden enviar.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const authHeader = req.headers.get('Authorization') ?? '';
  const { data: userData } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!userData.user) return json({ error: 'Sesión no válida.' }, 401);

  let p: Payload;
  try { p = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!p.to || !p.subject || (!p.html && !p.text)) {
    return json({ error: 'Faltan campos: to, subject y html/text.' }, 400);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: Array.isArray(p.to) ? p.to : [p.to],
      subject: p.subject,
      html: p.html,
      text: p.text,
      cc: p.cc,
      reply_to: p.replyTo,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: data?.message || 'No se pudo enviar el correo.' }, 502);
  return json({ ok: true, id: data?.id });
});
