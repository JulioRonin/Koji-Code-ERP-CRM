import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuotePhotoUrls } from '@/lib/api';
import { ADVANCE_TERMS_TEXT } from '@/lib/quoteTerms';
import { accentInk, resolveAccent } from '@/lib/brand';
import type { Quote, QuoteItem } from '@/types/database';
import { toLocalDate } from '@/lib/dates';

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
 *
 * Impresión: el documento se renderiza DOS veces — una en el diálogo (vista en
 * pantalla) y otra en un portal directo a <body> (`.quote-print-portal`). Al
 * imprimir se oculta todo `body > *` excepto ese portal, evitando que el
 * contenedor del diálogo (fixed, centrado con transform y con overflow-hidden)
 * interfiera con la paginación. Así salen las 3 hojas completas y alineadas.
 */
export function QuoteDocument({ quote, items, onClose, onEmail }: QuoteDocumentProps) {
  const { company } = useCompany();
  const tax = quote.subtotal * (quote.tax_pct / 100);

  const brand = company.commercial_name || company.legal_name || 'KANRI';
  const initial = brand.trim().charAt(0).toUpperCase() || 'K';
  // Si el logo no carga (link roto), usamos la inicial en vez del ícono roto.
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = company.logo_url && !logoFailed ? company.logo_url : null;
  const photos = quote.photos ?? [];
  const photoUrls = useQuotePhotoUrls(photos);

  // Domicilio fiscal compacto en una línea.
  const addressLine = [
    [company.address_street, company.address_ext].filter(Boolean).join(' '),
    company.address_int ? `Int. ${company.address_int}` : '',
    company.address_neighborhood,
    company.address_zip ? `C.P. ${company.address_zip}` : '',
    [company.address_city, company.address_state].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');

  const accentBg = resolveAccent(company.primary_color);
  const accentFg = accentInk(accentBg);
  const ink = '#16181D';
  const muted = '#6B7079';
  const total = quote.subtotal + tax;
  const validity = quote.valid_until
    ? format(toLocalDate(quote.valid_until), 'dd MMM yyyy', { locale: es })
    : '30 días naturales';

  const tile = (size: number) =>
    logo ? (
      <img src={logo} alt={brand} onError={() => setLogoFailed(true)} className="object-contain bg-white" style={{ width: size, height: size, borderRadius: size * 0.3 }} />
    ) : (
      <div className="flex items-center justify-center text-white font-semibold" style={{ width: size, height: size, borderRadius: size * 0.3, background: ink, fontSize: size * 0.32, letterSpacing: '.06em' }}>
        {initial}
      </div>
    );

  /** Encabezado compacto de las páginas interiores. */
  const pageHead = (title: string, sub: string) => (
    <div className="flex justify-between items-end pb-4 mb-7" style={{ borderBottom: `2px solid ${ink}` }}>
      <div className="flex items-center gap-3">
        {tile(40)}
        <div>
          <p className="text-[15px] leading-tight">{company.legal_name || brand}</p>
          {company.tagline && <p className="text-[11px]" style={{ color: muted }}>{company.tagline}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-[20px] font-light leading-none tracking-[-0.01em]">{title}</p>
        <p className="text-[11px] font-mono mt-1" style={{ color: muted }}>{sub}</p>
      </div>
    </div>
  );

  const label = (t: string) => <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: muted }}>{t}</p>;
  const box = 'rounded-[18px] bg-[#F5F6F8] p-4';

  // Contenido del documento (se reutiliza en pantalla y en el portal de impresión).
  const doc = (
    <div className="quote-doc" style={{ fontFamily: "'Outfit', system-ui, sans-serif", color: ink }}>
      {/* ══════════ PÁGINA 1 · PORTADA (sin montos) ══════════ */}
      <section className="quote-cover p-8 md:p-12 flex flex-col" style={{ minHeight: '92vh' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {tile(52)}
            <div>
              <p className="text-[18px] leading-tight">{company.legal_name || brand}</p>
              {company.tagline && <p className="text-[12px]" style={{ color: muted }}>{company.tagline}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: muted }}>Propuesta comercial</p>
            <p className="font-mono text-[13px] mt-0.5">{quote.id}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center py-10">
          <div className="rounded-[30px] bg-[#F5F6F8] p-9">
            <p className="text-[12px] uppercase tracking-[0.14em]" style={{ color: muted }}>Cotización</p>
            <h1 className="mt-3 text-[46px] md:text-[54px] font-light leading-[1.02] tracking-[-0.03em]">{quote.project_name}</h1>
            <p className="mt-3 text-[18px]" style={{ color: muted }}>Preparada para <span style={{ color: ink }}>{quote.client_name}</span></p>

            <div className="mt-9 grid grid-cols-3 gap-3">
              <div className="rounded-[20px] bg-white p-4">
                {label('Folio')}
                <p className="font-mono text-[14px]">{quote.id}</p>
              </div>
              <div className="rounded-[20px] bg-white p-4">
                {label('Fecha')}
                <p className="text-[15px]">{format(new Date(), "d 'de' MMMM yyyy", { locale: es })}</p>
              </div>
              <div className="rounded-[20px] bg-white p-4">
                {label('Vigencia')}
                <p className="text-[15px]">{validity}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-[20px] p-4" style={{ background: accentBg, color: accentFg }}>
                <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ opacity: 0.75 }}>Tiempo de entrega</p>
                <p className="text-[18px]">{quote.delivery_time || 'A confirmar contra orden de compra'}</p>
              </div>
              <div className="rounded-[20px] bg-white p-4">
                {label('Contacto del cliente')}
                <p className="text-[15px] truncate">{quote.client_email || quote.client_name}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 text-[11px] leading-relaxed text-center" style={{ color: muted, borderTop: '1px solid #E6E8EC' }}>
          {company.rfc && <span>RFC <span className="font-mono">{company.rfc}</span></span>}
          {addressLine && <p className="mt-0.5">{addressLine}</p>}
          {(company.phone || company.email) && <p className="mt-0.5">{[company.phone, company.email].filter(Boolean).join(' · ')}</p>}
        </div>
      </section>

      {/* ══════════ PÁGINA 2 · COTIZACIÓN ══════════ */}
      <section className="p-8 md:p-12" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
        {pageHead('Cotización', quote.id)}

        <div className="grid grid-cols-2 gap-3 mb-6 text-[13px]">
          <div className={box}>
            {label('Cliente')}
            <p className="text-[16px]">{quote.client_name}</p>
            <p className="mt-0.5" style={{ color: muted }}>{quote.project_name}</p>
            {quote.client_email && <p className="mt-0.5 text-[12px]" style={{ color: muted }}>{quote.client_email}</p>}
          </div>
          <div className={box}>
            {label('Condiciones')}
            <p><span style={{ color: muted }}>Vigencia:</span> {validity}</p>
            {quote.delivery_time && <p><span style={{ color: muted }}>Entrega:</span> {quote.delivery_time}</p>}
            <p><span style={{ color: muted }}>Moneda:</span> {quote.currency}</p>
          </div>
        </div>

        <table className="w-full text-[13px] mb-6" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr className="text-left text-[11px]" style={{ color: muted }}>
              <th className="py-2.5 px-3 font-normal bg-[#F5F6F8] rounded-l-xl w-8">#</th>
              <th className="py-2.5 px-3 font-normal bg-[#F5F6F8]">No. parte / descripción</th>
              <th className="py-2.5 px-3 font-normal bg-[#F5F6F8]">Material</th>
              <th className="py-2.5 px-3 font-normal bg-[#F5F6F8] text-right">Cant.</th>
              <th className="py-2.5 px-3 font-normal bg-[#F5F6F8] text-right">P. unitario</th>
              <th className="py-2.5 px-3 font-normal bg-[#F5F6F8] text-right rounded-r-xl">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ breakInside: 'avoid' }}>
                <td className="py-3 px-3 border-b border-[#EEF0F3]" style={{ color: '#A3A8B1' }}>{i + 1}</td>
                <td className="py-3 px-3 border-b border-[#EEF0F3]">
                  <p className="font-mono text-[12px]">{it.part_number}</p>
                  {it.description && <p className="text-[12px] mt-0.5" style={{ color: muted }}>{it.description}</p>}
                </td>
                <td className="py-3 px-3 border-b border-[#EEF0F3] text-[12px]" style={{ color: muted }}>{it.material_name ?? '—'}</td>
                <td className="py-3 px-3 border-b border-[#EEF0F3] text-right font-mono">{it.quantity}</td>
                <td className="py-3 px-3 border-b border-[#EEF0F3] text-right font-mono">{money(it.unit_price)}</td>
                <td className="py-3 px-3 border-b border-[#EEF0F3] text-right font-mono">{money(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6" style={{ breakInside: 'avoid' }}>
          <div className="w-80 rounded-[22px] bg-[#F5F6F8] p-5 text-[13px]">
            <div className="flex justify-between"><span style={{ color: muted }}>Subtotal</span><span className="font-mono">{money(quote.subtotal)}</span></div>
            <div className="flex justify-between mt-1"><span style={{ color: muted }}>IVA {quote.tax_pct} %</span><span className="font-mono">{money(tax)}</span></div>
            <div className="mt-4 rounded-[16px] px-4 py-3 flex items-baseline justify-between" style={{ background: accentBg, color: accentFg }}>
              <span className="text-[13px]">Total {quote.currency}</span>
              <span className="text-[24px] font-light tracking-[-0.01em]">{money(total)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className={`${box} mb-6 text-[13px]`}>
            {label('Notas')}
            <p className="leading-relaxed whitespace-pre-line" style={{ color: '#474C55' }}>{quote.notes}</p>
          </div>
        )}

        <div className="text-[11px] space-y-0.5 mb-9" style={{ color: muted }}>
          <p>· Precios en {quote.currency}, sujetos a cambio sin previo aviso después de la vigencia.</p>
          <p>· Tiempo de entrega {quote.delivery_time ? `estimado: ${quote.delivery_time}` : 'a confirmar contra orden de compra'}.</p>
          <p>· No incluye fletes ni maniobras salvo indicación expresa.</p>
          <p>· Los términos de pago, anticipo, datos bancarios y condiciones especiales se detallan en la página siguiente.</p>
          {photos.length > 0 && <p>· Se anexa{photos.length > 1 ? 'n' : ''} {photos.length} foto{photos.length > 1 ? 's' : ''} de referencia al final del documento.</p>}
        </div>

        <div className="grid grid-cols-2 gap-16" style={{ breakInside: 'avoid' }}>
          <div className="pt-2 text-center" style={{ borderTop: `1px solid ${ink}` }}>
            <p className="text-[11px]" style={{ color: muted }}>Elaboró</p>
            <p className="text-[14px] mt-1">{company.legal_rep || brand}</p>
          </div>
          <div className="pt-2 text-center" style={{ borderTop: `1px solid ${ink}` }}>
            <p className="text-[11px]" style={{ color: muted }}>Aceptación del cliente</p>
            <p className="text-[14px] mt-1">Nombre y firma</p>
          </div>
        </div>

        <p className="text-right text-[10px] mt-6" style={{ color: '#A3A8B1' }}>
          {company.legal_name || brand} · powered by KANRI
        </p>
      </section>

      {/* ══════════ PÁGINA 3 · TÉRMINOS, BANCO E INFO FISCAL ══════════ */}
      <section className="p-8 md:p-12" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
        {pageHead('Términos y condiciones', `Anexo de la cotización ${quote.id}`)}

        <div className="space-y-3 text-[13px]">
          {(() => {
            // Numeración dinámica de las secciones presentes.
            let n = 0;
            const showTerms = company.quote_terms_enabled;
            const hasBank = !!(company.bank_name || company.bank_clabe || company.bank_account);
            return (
              <>
                {showTerms && company.terms_payment && (
                  <TermsSection n={++n} title="Términos de pago" body={company.terms_payment} />
                )}
                {showTerms && (
                  <TermsSection n={++n} title="Anticipo" body={ADVANCE_TERMS_TEXT} />
                )}

                {hasBank && (
                  <div className={box} style={{ breakInside: 'avoid' }}>
                    {label(`${++n}. Cuenta para transferencias y depósitos`)}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1">
                      {company.bank_beneficiary && <p><span style={{ color: muted }}>Beneficiario:</span> {company.bank_beneficiary}</p>}
                      {company.bank_name && <p><span style={{ color: muted }}>Banco:</span> {company.bank_name}</p>}
                      {company.bank_account && <p><span style={{ color: muted }}>Cuenta:</span> <span className="font-mono">{company.bank_account}</span></p>}
                      {company.bank_clabe && <p><span style={{ color: muted }}>CLABE:</span> <span className="font-mono">{company.bank_clabe}</span></p>}
                      {company.payment_notes && <p className="col-span-2 text-[12px]" style={{ color: muted }}>{company.payment_notes}</p>}
                    </div>
                  </div>
                )}

                {/* Información fiscal del emisor */}
                <div className={box} style={{ breakInside: 'avoid' }}>
                  {label(`${++n}. Información fiscal`)}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-1">
                    <p><span style={{ color: muted }}>Razón social:</span> {company.legal_name || brand}</p>
                    {company.rfc && <p><span style={{ color: muted }}>RFC:</span> <span className="font-mono">{company.rfc}</span></p>}
                    {company.tax_regime && <p className="col-span-2"><span style={{ color: muted }}>Régimen fiscal:</span> {company.tax_regime}</p>}
                    {addressLine && <p className="col-span-2"><span style={{ color: muted }}>Domicilio fiscal:</span> {addressLine}</p>}
                    {(company.phone || company.email) && (
                      <p className="col-span-2"><span style={{ color: muted }}>Contacto:</span> {[company.phone, company.email].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>

                {showTerms && company.terms_special && (
                  <TermsSection n={++n} title="Condiciones especiales y confidencialidad" body={company.terms_special} />
                )}
              </>
            );
          })()}
        </div>

        <div className="grid grid-cols-2 gap-16 mt-14" style={{ breakInside: 'avoid' }}>
          <div className="pt-2 text-center" style={{ borderTop: `1px solid ${ink}` }}>
            <p className="text-[11px]" style={{ color: muted }}>Por {company.legal_name || brand}</p>
            <p className="text-[14px] mt-1">{company.legal_rep || 'Nombre y firma'}</p>
          </div>
          <div className="pt-2 text-center" style={{ borderTop: `1px solid ${ink}` }}>
            <p className="text-[11px]" style={{ color: muted }}>Acepto los términos y condiciones · {quote.client_name}</p>
            <p className="text-[14px] mt-1">Nombre, firma y fecha</p>
          </div>
        </div>

        <p className="text-right text-[10px] mt-8" style={{ color: '#A3A8B1' }}>
          Este anexo forma parte integral de la cotización {quote.id} · {company.legal_name || brand}
        </p>
      </section>

      {/* ══════════ PÁGINA 4 · ANEXO FOTOGRÁFICO (opcional) ══════════ */}
      {photos.length > 0 && (
        <section className="p-8 md:p-12" style={{ breakBefore: 'page', pageBreakBefore: 'always' }}>
          {pageHead('Anexo fotográfico', `Cotización ${quote.id}`)}
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <figure
                key={p.id}
                className={`quote-photo rounded-[20px] bg-[#F5F6F8] p-2 ${photos.length % 2 === 1 && i === photos.length - 1 ? 'col-span-2 mx-auto w-1/2' : ''}`}
                style={{ breakInside: 'avoid' }}
              >
                <div className="h-[185px] rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
                  {photoUrls[p.id] && <img src={photoUrls[p.id]} alt={p.caption || p.name} className="max-h-full max-w-full object-contain" />}
                </div>
                <figcaption className="px-2 pt-2 pb-1 text-[11px]" style={{ color: muted }}>
                  <span style={{ color: ink }}>Foto {i + 1}</span>{p.caption ? ` · ${p.caption}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-right text-[10px] mt-5" style={{ color: '#A3A8B1' }}>
            Imágenes de referencia · forman parte de la cotización {quote.id} · {company.legal_name || brand}
          </p>
        </section>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[92vh] p-0 overflow-hidden flex flex-col">
        <style>{`
          /* El documento imprimible vive en un portal aparte (.quote-print-portal),
             oculto en pantalla y visible SOLO al imprimir. */
          .quote-print-portal { display: none; }
          @media print {
            @page { size: letter; margin: 14mm; }
            /* Oculta TODO el árbol de la app y el diálogo; deja solo el portal del
               documento, que al estar suelto en <body> pagina de forma natural
               (sin transform ni overflow que corten o desplacen el contenido). */
            body > *:not(.quote-print-portal) { display: none !important; }
            .quote-print-portal { display: block !important; }
            /* La portada se centra con min-height en pantalla; en impresión la
               dejamos de alto automático para no desbordar a una hoja extra. */
            .quote-cover { min-height: 0 !important; height: 244mm; }
            /* La hoja ya trae márgenes de 14 mm: sin relleno extra en las secciones. */
            .quote-print-portal section { padding: 0 !important; }
            /* Conserva fondos grises y el acento al imprimir. */
            .quote-print-portal, .quote-print-portal * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-[var(--color-app-border)] flex justify-between items-center bg-white shrink-0">
          <DialogTitle className="text-sm font-medium">Vista previa · {quote.id}</DialogTitle>
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

        {/* Vista en pantalla (dentro del diálogo) */}
        <div className="flex-1 overflow-y-auto bg-white text-[#16181D]">
          {doc}
        </div>
      </DialogContent>

      {/* Copia imprimible: portal directo a <body>, oculta en pantalla. */}
      {createPortal(
        <div className="quote-print-portal bg-white text-[#16181D]">{doc}</div>,
        document.body,
      )}
    </Dialog>
  );
}

function TermsSection({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-[18px] bg-[#F5F6F8] p-4" style={{ breakInside: 'avoid' }}>
      <p className="text-[10px] uppercase tracking-[0.08em] mb-1 text-[#6B7079]">{n}. {title}</p>
      <p className="text-[#474C55] leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}
