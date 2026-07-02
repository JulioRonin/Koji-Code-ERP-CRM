import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useCompany } from '@/contexts/CompanyContext';
import type { Project, Shipment, ShippingLabel, ShippingLabelItem } from '@/types/database';

interface BoxLabelProps {
  project: Project;
  shipment: Shipment;
  label: ShippingLabel;
  items: ShippingLabelItem[];
  /** URL al portal cliente que se codifica en el QR. */
  trackingUrl: string;
}

/**
 * Etiqueta de caja imprimible (10x15 cm) estilo paquetería, con la marca de la
 * empresa emisora (remitente), destinatario, contenido y QR de seguimiento.
 */
export function BoxLabel({ project, shipment, label, items, trackingUrl }: BoxLabelProps) {
  const { company } = useCompany();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const brand = company.commercial_name || company.legal_name || 'KANRI';

  useEffect(() => {
    QRCode.toDataURL(trackingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 200 })
      .then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [trackingUrl]);

  const companyAddress = [
    [company.address_street, company.address_ext].filter(Boolean).join(' '),
    company.address_neighborhood,
    [company.address_city, company.address_state].filter(Boolean).join(', '),
    company.address_zip ? `C.P. ${company.address_zip}` : '',
  ].filter(Boolean).join(', ');

  return (
    <div className="box-label bg-white border-2 border-black text-black w-[400px] font-sans">
      <style>{`
        @media print {
          @page { size: 100mm 150mm; margin: 4mm; }
          body * { visibility: hidden; }
          .box-label, .box-label * { visibility: visible; }
          .box-label { position: absolute; left: 0; top: 0; }
          .no-print-in-label { display: none !important; }
        }
      `}</style>

      {/* Header: remitente (empresa) */}
      <div className="flex items-center gap-2 border-b-2 border-black p-2.5">
        {company.logo_url ? (
          <img src={company.logo_url} alt={brand} className="h-9 w-9 object-contain shrink-0" />
        ) : (
          <div className="h-9 w-9 bg-black text-white flex items-center justify-center font-bold text-sm shrink-0">
            {brand.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight truncate">{company.legal_name || brand}</p>
          {companyAddress && <p className="text-[9px] leading-tight text-gray-700 truncate">{companyAddress}</p>}
          {company.phone && <p className="text-[9px] leading-tight text-gray-700">{company.phone}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="border-2 border-black px-2 py-0.5">
            <p className="text-[8px] font-bold uppercase leading-none">Caja</p>
            <p className="text-sm font-bold font-mono leading-tight">{label.box_number}</p>
          </div>
        </div>
      </div>

      {/* Destinatario */}
      <div className="p-2.5 border-b-2 border-black">
        <p className="text-[9px] font-bold uppercase tracking-wide">Destinatario</p>
        <p className="text-base font-bold leading-tight">{project.client_name}</p>
        {shipment.ship_to_address && <p className="text-[11px] leading-snug mt-0.5">{shipment.ship_to_address}</p>}
      </div>

      {/* Proyecto / envío */}
      <div className="grid grid-cols-2 text-[10px] border-b-2 border-black">
        <div className="p-2 border-r-2 border-black">
          <p className="font-bold uppercase text-[8px]">Proyecto</p>
          <p className="font-mono">{project.id}</p>
          <p className="truncate">{project.name}</p>
        </div>
        <div className="p-2">
          <p className="font-bold uppercase text-[8px]">Envío</p>
          <p className="font-mono">{shipment.id}</p>
          <p>{[label.weight_kg ? `${label.weight_kg} kg` : '', label.dimensions_cm ? `${label.dimensions_cm} cm` : ''].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </div>

      {/* QR + contenido */}
      <div className="flex gap-2.5 p-2.5">
        <div className="shrink-0">
          {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="w-24 h-24" /> : <div className="w-24 h-24 bg-gray-200" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wide border-b border-black pb-0.5 mb-1">
            Contenido ({items.length} partida{items.length === 1 ? '' : 's'})
          </p>
          <div className="text-[11px] space-y-0.5 max-h-24 overflow-hidden">
            {items.slice(0, 6).map(it => (
              <div key={it.id} className="flex justify-between gap-2">
                <span className="truncate">{it.description}</span>
                <span className="font-mono shrink-0 font-bold">{it.quantity} {it.uom}</span>
              </div>
            ))}
            {items.length > 6 && <div className="text-[10px] italic">+ {items.length - 6} más…</div>}
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] px-2 pb-2 italic text-gray-600 border-t border-black pt-1.5">
        Escanea el QR para ver el estatus en vivo del proyecto · {brand}
      </p>
    </div>
  );
}
