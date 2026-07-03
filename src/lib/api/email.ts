import { supabase } from '@/lib/supabase';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
}

/**
 * Envía un correo transaccional vía la Edge Function `send-email` (Resend).
 * Lanza un error legible si Resend aún no está configurado/desplegado.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!supabase) throw new Error('El envío de correo requiere el backend configurado.');
  const { data, error } = await supabase.functions.invoke('send-email', { body: input });
  if (error) {
    throw new Error('El envío automático de correo aún no está disponible (falta configurar Resend).');
  }
  if (data?.error) throw new Error(data.error as string);
}

/** Envoltura simple para un correo con estilo de marca (HTML). */
export function brandedEmailHtml(opts: {
  brand: string;
  accent?: string | null;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const accent = opts.accent && /^#[0-9a-fA-F]{6}$/.test(opts.accent) ? opts.accent : '#E2401F';
  const cta = opts.ctaUrl && opts.ctaLabel
    ? `<a href="${opts.ctaUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;margin-top:8px">${opts.ctaLabel}</a>`
    : '';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F7F5F0;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:#16181D;color:#fff;padding:16px 20px;font-weight:700">${opts.brand}</div>
      <div style="padding:20px;color:#16181D">
        <h1 style="font-size:18px;margin:0 0 10px">${opts.title}</h1>
        <div style="font-size:14px;line-height:1.6;color:#333">${opts.bodyHtml}</div>
        ${cta}
      </div>
      <div style="padding:12px 20px;color:#8A9099;font-size:11px;border-top:1px solid #eee">Enviado por ${opts.brand} · powered by KANRI</div>
    </div>
  </div>`;
}
