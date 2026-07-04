import { Printer, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useCompany } from '@/contexts/CompanyContext';
import type { Quote, QuoteItem } from '@/types/database';

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

interface QuoteDocumentProps {
  quote: Quote;
  items: QuoteItem[];
  onClose: () => void;
  onEmail?: () => void;
}

/**
 * Documento de cotización imprimible (carta). Usa los datos de la empresa
 * emisora (logo, razón social, RFC, domicilio) — KANRI es solo la plataforma.
 */
export function QuoteDocument({ quote, items, onClose, onEmail }: QuoteDocumentProps) {
  const { company } = useCompany();
  const tax = quote.subtotal * (quote.tax_pct / 100);
  const accent = company.primary_color && /^#[0-9a-fA-F]{6}$/.test(company.primary_color)
    ? company.primary_color
    : '#0369a1';

  const brand = company.commercial_name || company.legal_name || 'KANRI';
  const initial = brand.trim().charAt(0).toUpperCase() || 'K';

  // Domicilio fiscal compacto en una línea.
  const addressLine = [
    [company.address_street, company.address_ext].filter(Boolean).join(' '),
    company.address_int ? `Int. ${company.address_int}` : '',
    company.address_neighborhood,
    company.address_zip ? `C.P. ${company.address_zip}` : '',
    [company.address_city, company.address_state].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[92vh] p-0 overflow-hidden flex flex-col">
        <style>{`
          @media print {
            @page { size: letter; margin: 14mm; }
            body * { visibility: hidden; }
            #quote-doc, #quote-doc * { visibility: visible; }
            #quote-doc { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print-quote { display: none !important; }
          }
        `}</style>

        {/* Toolbar */}
        <div className="no-print-quote px-5 py-3 border-b border-[var(--color-app-border)] flex justify-between items-center bg-white shrink-0">
          <span className="text-sm font-medium">Vista previa · {quote.id}</span>
          <div className="flex gap-2">
            {onEmail && (
              <Button variant="outline" size="sm" onClick={onEmail}>
                <Mail className="h-3.5 w-3.5 mr-1.5" /> Enviar por correo
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir / PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </div>

        {/* Document */}
        <div id="quote-doc" className="flex-1 overflow-y-auto bg-white text-[#0f172a]">

          {/* ══════════ PÁGINA 1 · PORTADA ══════════ */}
          <section className="p-8 md:p-12 flex flex-col" style={{ minHeight: '92vh' }}>
            {/* Membrete superior */}
            <div className="flex items-center gap-3 border-b-2 pb-5" style={{ borderColor: accent }}>
              {company.logo_url ? (
                <img src={company.logo_url} alt={brand} className="h-14 w-14 rounded-md object-contain bg-white border border-[#e2e8f0]" />
              ) : (
                <div className="h-14 w-14 rounded-md flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: accent }}>
                  {initial}
                </div>
              )}
              <div>
                <p className="text-xl font-bold leading-tight">{company.legal_name || brand}</p>
                {company.tagline && <p className="text-sm text-[#475569]">{company.tagline}</p>}
              </div>
            </div>

            {/* Título grande centrado */}
            <div className="flex-1 flex flex-col justify-center items-center text-center py-10">
              <p className="text-sm font-semibold tracking-[0.35em] text-[#475569]">PROPUESTA COMERCIAL</p>
              <h1 className="text-5xl md:text-6xl font-bold mt-3 mb-6" style={{ color: accent }}>COTIZACIÓN</h1>
              <p className="text-lg font-mono">{quote.id}</p>
              <p className="text-sm text-[#475569] mt-1">
                {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </p>

              {/* Tarjeta de resumen */}
              <div className="mt-10 w-full max-w-md text-left rounded-lg border border-[#e2e8f0] overflow-hidden">
                <div className="px-5 py-3 text-white text-sm font-semibold" style={{ backgroundColor: accent }}>
                  Preparada para
                </div>
                <div className="px-5 py-4 space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-[#475569] uppercase tracking-wide">Cliente</p>
                    <p className="font-semibold text-base">{quote.client_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#475569] uppercase tracking-wide">Proyecto</p>
                    <p className="font-medium">{quote.project_name}</p>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#e2e8f0]">
                    <span className="text-[#475569]">
                      Vigencia:{' '}
                      <span className="font-medium text-[#0f172a]">
                        {quote.valid_until
                          ? format(new Date(quote.valid_until), 'dd MMM yyyy', { locale: es })
                          : '30 días naturales'}
                      </span>
                    </span>
                    <span className="text-right font-bold text-base" style={{ color: accent }}>
                      {money(quote.subtotal + tax)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Datos del emisor al pie de la portada */}
            <div className="border-t border-[#e2e8f0] pt-4 text-[11px] text-[#475569] leading-relaxed text-center">
              {company.rfc && <span>RFC: <span className="font-mono">{company.rfc}</span></span>}
              {addressLine && <p className="mt-0.5">{addressLine}</p>}
              {(company.phone || company.email) && (
                <p className="mt-0.5">{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </section>

          {/* ══════════ PÁGINA 2 · COTIZACIÓN ══════════ */}
          <section className="p-8 md:p-12" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
          {/* Membrete compacto */}
          <div className="flex justify-between items-center border-b-2 pb-3 mb-6" style={{ borderColor: accent }}>
            <div className="flex items-center gap-2">
              {company.logo_url ? (
                <img src={company.logo_url} alt={brand} className="h-9 w-9 rounded object-contain border border-[#e2e8f0]" />
              ) : (
                <div className="h-9 w-9 rounded flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accent }}>{initial}</div>
              )}
              <p className="font-bold text-sm">{company.legal_name || brand}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold" style={{ color: accent }}>COTIZACIÓN</p>
              <p className="text-[11px] font-mono text-[#475569]">{quote.id}</p>
            </div>
          </div>

          {/* Cliente / condiciones */}
          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-1">Cliente</p>
              <p className="font-semibold">{quote.client_name}</p>
              <p className="text-[#475569] mt-0.5">{quote.project_name}</p>
              {quote.client_email && <p className="text-[#475569] text-xs mt-0.5">{quote.client_email}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-1">Condiciones</p>
              <p className="text-[#475569]">
                Vigencia:{' '}
                <span className="font-medium text-[#0f172a]">
                  {quote.valid_until
                    ? format(new Date(quote.valid_until), 'dd MMM yyyy', { locale: es })
                    : '30 días naturales'}
                </span>
              </p>
              {quote.delivery_time && (
                <p className="text-[#475569]">
                  Entrega: <span className="font-medium text-[#0f172a]">{quote.delivery_time}</span>
                </p>
              )}
              <p className="text-[#475569]">Moneda: <span className="font-medium text-[#0f172a]">{quote.currency}</span></p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="bg-[#f1f5f9] text-left">
                <th className="py-2 px-3 font-semibold text-xs text-[#475569] uppercase w-8">#</th>
                <th className="py-2 px-3 font-semibold text-xs text-[#475569] uppercase">No. parte / descripción</th>
                <th className="py-2 px-3 font-semibold text-xs text-[#475569] uppercase">Material</th>
                <th className="py-2 px-3 font-semibold text-xs text-[#475569] uppercase text-right">Cant.</th>
                <th className="py-2 px-3 font-semibold text-xs text-[#475569] uppercase text-right">P. unitario</th>
                <th className="py-2 px-3 font-semibold text-xs text-[#475569] uppercase text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-[#e2e8f0]">
                  <td className="py-2.5 px-3 text-[#94a3b8]">{i + 1}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-mono text-xs font-semibold">{it.part_number}</p>
                    {it.description && <p className="text-xs text-[#475569] mt-0.5">{it.description}</p>}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-[#475569]">{it.material_name ?? '—'}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{money(it.unit_price)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium">{money(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totales */}
          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#475569]">Subtotal</span>
                <span className="tabular-nums">{money(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#475569]">IVA ({quote.tax_pct}%)</span>
                <span className="tabular-nums">{money(tax)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t-2 text-base font-bold" style={{ borderColor: accent }}>
                <span>Total</span>
                <span className="tabular-nums">{money(quote.subtotal + tax)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {quote.notes && (
            <div className="mb-8 text-sm">
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-1">Notas</p>
              <p className="text-[#475569] leading-relaxed whitespace-pre-line">{quote.notes}</p>
            </div>
          )}

          {/* Condiciones estándar */}
          <div className="text-xs text-[#94a3b8] space-y-1 border-t border-[#e2e8f0] pt-4 mb-10">
            <p>· Precios en {quote.currency}, sujetos a cambio sin previo aviso después de la vigencia.</p>
            <p>· Tiempo de entrega {quote.delivery_time ? `estimado: ${quote.delivery_time}` : 'a confirmar contra orden de compra'}.</p>
            <p>· No incluye fletes ni maniobras salvo indicación expresa.</p>
            <p>· Los términos de pago, anticipo, datos bancarios y condiciones especiales se detallan en la página siguiente.</p>
          </div>

          {/* Firma */}
          <div className="grid grid-cols-2 gap-16">
            <div className="border-t border-[#cbd5e1] pt-2 text-center">
              <p className="text-xs text-[#475569]">Elaboró</p>
              <p className="text-sm font-medium mt-1">{company.legal_rep || brand}</p>
            </div>
            <div className="border-t border-[#cbd5e1] pt-2 text-center">
              <p className="text-xs text-[#475569]">Aceptación del cliente</p>
              <p className="text-sm font-medium mt-1">Nombre y firma</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-[#94a3b8] mt-10">
            {company.legal_name || brand} · {new Date().getFullYear()}
          </p>
          </section>

          {/* ══════════ PÁGINA 3 · TÉRMINOS, BANCO E INFO FISCAL ══════════ */}
          <section className="p-8 md:p-12" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
            {/* Membrete compacto */}
            <div className="flex justify-between items-center border-b-2 pb-3 mb-6" style={{ borderColor: accent }}>
              <div className="flex items-center gap-2">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={brand} className="h-9 w-9 rounded object-contain border border-[#e2e8f0]" />
                ) : (
                  <div className="h-9 w-9 rounded flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: accent }}>{initial}</div>
                )}
                <p className="font-bold text-sm">{company.legal_name || brand}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: accent }}>TÉRMINOS Y CONDICIONES</p>
                <p className="text-[11px] font-mono text-[#475569]">Anexo de la cotización {quote.id}</p>
              </div>
            </div>

            <div className="space-y-5 text-sm">
              {(() => {
                // Numeración dinámica de las secciones presentes.
                let n = 0;
                const showTerms = company.quote_terms_enabled;
                const hasBank = !!(company.bank_name || company.bank_clabe || company.bank_account);
                return (
                  <>
                    {showTerms && company.terms_payment && (
                      <TermsSection n={++n} title="Términos de pago" body={company.terms_payment} accent={accent} />
                    )}
                    {showTerms && company.terms_advance && (
                      <TermsSection n={++n} title="Anticipo" body={company.terms_advance} accent={accent} />
                    )}

                    {hasBank && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: accent }}>
                          {++n}. Cuenta para transferencias y depósitos
                        </p>
                        <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                          {company.bank_beneficiary && <p><span className="text-[#475569]">Beneficiario:</span> <span className="font-medium">{company.bank_beneficiary}</span></p>}
                          {company.bank_name && <p><span className="text-[#475569]">Banco:</span> <span className="font-medium">{company.bank_name}</span></p>}
                          {company.bank_account && <p><span className="text-[#475569]">Cuenta:</span> <span className="font-mono font-medium">{company.bank_account}</span></p>}
                          {company.bank_clabe && <p><span className="text-[#475569]">CLABE:</span> <span className="font-mono font-medium">{company.bank_clabe}</span></p>}
                          {company.payment_notes && <p className="col-span-2 text-[#475569] text-xs">{company.payment_notes}</p>}
                        </div>
                      </div>
                    )}

                    {/* Información fiscal del emisor */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: accent }}>
                        {++n}. Información fiscal
                      </p>
                      <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                        <p><span className="text-[#475569]">Razón social:</span> <span className="font-medium">{company.legal_name || brand}</span></p>
                        {company.rfc && <p><span className="text-[#475569]">RFC:</span> <span className="font-mono font-medium">{company.rfc}</span></p>}
                        {company.tax_regime && <p className="col-span-2"><span className="text-[#475569]">Régimen fiscal:</span> <span className="font-medium">{company.tax_regime}</span></p>}
                        {addressLine && <p className="col-span-2"><span className="text-[#475569]">Domicilio fiscal:</span> <span className="font-medium">{addressLine}</span></p>}
                        {(company.phone || company.email) && (
                          <p className="col-span-2"><span className="text-[#475569]">Contacto:</span> <span className="font-medium">{[company.phone, company.email].filter(Boolean).join(' · ')}</span></p>
                        )}
                      </div>
                    </div>

                    {showTerms && company.terms_special && (
                      <TermsSection n={++n} title="Condiciones especiales y confidencialidad" body={company.terms_special} accent={accent} />
                    )}
                  </>
                );
              })()}
            </div>

            {/* Aceptación del anexo */}
            <div className="grid grid-cols-2 gap-16 mt-14">
              <div className="border-t border-[#cbd5e1] pt-2 text-center">
                <p className="text-xs text-[#475569]">Por {company.legal_name || brand}</p>
                <p className="text-sm font-medium mt-1">{company.legal_rep || 'Nombre y firma'}</p>
              </div>
              <div className="border-t border-[#cbd5e1] pt-2 text-center">
                <p className="text-xs text-[#475569]">Acepto los términos y condiciones · {quote.client_name}</p>
                <p className="text-sm font-medium mt-1">Nombre, firma y fecha</p>
              </div>
            </div>

            <p className="text-center text-[10px] text-[#94a3b8] mt-8">
              Este anexo forma parte integral de la cotización {quote.id} · {company.legal_name || brand} · {new Date().getFullYear()}
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TermsSection({ n, title, body, accent }: { n: number; title: string; body: string; accent: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: accent }}>{n}. {title}</p>
      <p className="text-[#334155] leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}
