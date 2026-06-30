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
        <div id="quote-doc" className="flex-1 overflow-y-auto bg-white p-8 md:p-10 text-[#0f172a]">
          {/* Letterhead */}
          <div className="flex justify-between items-start border-b-2 pb-5 mb-6" style={{ borderColor: accent }}>
            <div className="max-w-[60%]">
              <div className="flex items-center gap-2.5">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={brand} className="h-12 w-12 rounded-md object-contain bg-white border border-[#e2e8f0]" />
                ) : (
                  <div className="h-12 w-12 rounded-md flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: accent }}>
                    {initial}
                  </div>
                )}
                <div>
                  <p className="text-lg font-bold leading-tight">{company.legal_name || brand}</p>
                  {company.tagline && <p className="text-xs text-[#475569]">{company.tagline}</p>}
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#475569] leading-relaxed">
                {company.rfc && <p>RFC: <span className="font-mono">{company.rfc}</span></p>}
                {addressLine && <p>{addressLine}</p>}
                {(company.phone || company.email) && (
                  <p>{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold" style={{ color: accent }}>COTIZACIÓN</p>
              <p className="text-sm font-mono mt-0.5">{quote.id}</p>
              <p className="text-xs text-[#475569] mt-1">
                {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
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
            <p>· Condiciones de pago a convenir.</p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
