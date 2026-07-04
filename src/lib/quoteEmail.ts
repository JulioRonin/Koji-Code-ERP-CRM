import type { CompanySettings, Quote, QuoteItem } from '@/types/database';

const mx = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

/**
 * Construye el HTML del correo de una cotización, con las MISMAS secciones del
 * documento imprimible: membrete, partidas, totales, datos de pago y los
 * términos y condiciones configurados por la empresa.
 */
export function quoteEmailHtml(
  quote: Quote,
  items: QuoteItem[],
  company: CompanySettings,
  opts: { subtotal: number; tax: number; total: number },
): string {
  const accent = company.primary_color && /^#[0-9a-fA-F]{6}$/.test(company.primary_color) ? company.primary_color : '#E2401F';
  const brand = company.commercial_name || company.legal_name || 'KANRI';

  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;color:#94a3b8">${i + 1}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee">
        <div style="font-family:monospace;font-size:12px;font-weight:600">${esc(it.part_number)}</div>
        ${it.description ? `<div style="font-size:12px;color:#475569">${esc(it.description)}</div>` : ''}
      </td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${it.quantity}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${mx(it.unit_price)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${mx(it.line_total)}</td>
    </tr>`).join('');

  const bank = (company.bank_name || company.bank_clabe || company.bank_account) ? `
    <div style="margin-top:18px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:12px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;color:${accent}">Datos para pago (transferencia)</p>
      <table style="width:100%;font-size:13px;color:#334155">
        ${company.bank_beneficiary ? `<tr><td style="padding:2px 0"><span style="color:#475569">Beneficiario:</span> <b>${esc(company.bank_beneficiary)}</b></td>${company.bank_name ? `<td style="padding:2px 0"><span style="color:#475569">Banco:</span> <b>${esc(company.bank_name)}</b></td>` : '<td></td>'}</tr>` : ''}
        <tr>${company.bank_account ? `<td style="padding:2px 0"><span style="color:#475569">Cuenta:</span> <b style="font-family:monospace">${esc(company.bank_account)}</b></td>` : '<td></td>'}${company.bank_clabe ? `<td style="padding:2px 0"><span style="color:#475569">CLABE:</span> <b style="font-family:monospace">${esc(company.bank_clabe)}</b></td>` : '<td></td>'}</tr>
      </table>
      ${company.payment_notes ? `<p style="margin:6px 0 0;font-size:12px;color:#475569">${esc(company.payment_notes)}</p>` : ''}
    </div>` : '';

  const termsBlocks: string[] = [];
  if (company.quote_terms_enabled) {
    let n = 0;
    const sect = (title: string, body: string) => `<div style="margin-top:12px"><p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:${accent}">${++n}. ${title}</p><p style="margin:0;font-size:13px;line-height:1.6;color:#334155;white-space:pre-line">${esc(body)}</p></div>`;
    if (company.terms_payment) termsBlocks.push(sect('Términos de pago', company.terms_payment));
    if (company.terms_advance) termsBlocks.push(sect('Anticipo', company.terms_advance));
    if (company.terms_special) termsBlocks.push(sect('Condiciones especiales y confidencialidad', company.terms_special));
  }
  const terms = termsBlocks.length ? `
    <div style="margin-top:22px;border-top:2px solid ${accent};padding-top:14px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700">Términos y condiciones</p>
      ${termsBlocks.join('')}
    </div>` : '';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#F7F5F0;padding:24px">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="padding:18px 22px;border-bottom:2px solid ${accent};display:flex;justify-content:space-between;align-items:center">
        <div>
          ${company.logo_url ? `<img src="${esc(company.logo_url)}" alt="${esc(brand)}" style="height:40px;max-width:160px;object-fit:contain" />` : `<div style="font-size:18px;font-weight:700">${esc(company.legal_name || brand)}</div>`}
          ${company.rfc ? `<div style="font-size:11px;color:#475569;margin-top:4px">RFC: ${esc(company.rfc)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:700;color:${accent}">COTIZACIÓN</div>
          <div style="font-family:monospace;font-size:13px">${esc(quote.id)}</div>
        </div>
      </div>

      <div style="padding:20px 22px;color:#16181D">
        <p style="margin:0 0 12px;font-size:14px">Estimado(a) <b>${esc(quote.client_name)}</b>, le compartimos la cotización para <b>${esc(quote.project_name)}</b>.</p>
        <table style="width:100%;font-size:12px;color:#475569;margin-bottom:14px">
          <tr>
            <td>Vigencia: <b style="color:#16181D">${quote.valid_until || '30 días naturales'}</b></td>
            <td style="text-align:right">${quote.delivery_time ? `Entrega: <b style="color:#16181D">${esc(quote.delivery_time)}</b>` : ''}</td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f1f5f9;text-align:left">
              <th style="padding:6px;font-size:11px;color:#475569;text-transform:uppercase">#</th>
              <th style="padding:6px;font-size:11px;color:#475569;text-transform:uppercase">No. parte / descripción</th>
              <th style="padding:6px;font-size:11px;color:#475569;text-transform:uppercase;text-align:right">Cant.</th>
              <th style="padding:6px;font-size:11px;color:#475569;text-transform:uppercase;text-align:right">P. unitario</th>
              <th style="padding:6px;font-size:11px;color:#475569;text-transform:uppercase;text-align:right">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <table style="width:100%;font-size:13px;margin-top:12px">
          <tr><td style="text-align:right;color:#475569;padding:2px 6px">Subtotal</td><td style="text-align:right;width:120px;padding:2px 6px">${mx(opts.subtotal)}</td></tr>
          <tr><td style="text-align:right;color:#475569;padding:2px 6px">IVA (${quote.tax_pct}%)</td><td style="text-align:right;padding:2px 6px">${mx(opts.tax)}</td></tr>
          <tr><td style="text-align:right;font-weight:700;border-top:2px solid ${accent};padding:6px">Total</td><td style="text-align:right;font-weight:700;border-top:2px solid ${accent};padding:6px">${mx(opts.total)}</td></tr>
        </table>

        ${quote.notes ? `<div style="margin-top:16px;font-size:13px"><b>Notas:</b> <span style="color:#475569;white-space:pre-line">${esc(quote.notes)}</span></div>` : ''}
        ${bank}
        ${terms}
      </div>

      <div style="padding:12px 22px;color:#8A9099;font-size:11px;border-top:1px solid #eee">
        ${esc(company.legal_name || brand)}${company.phone ? ` · ${esc(company.phone)}` : ''}${company.email ? ` · ${esc(company.email)}` : ''} · powered by KANRI
      </div>
    </div>
  </div>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
