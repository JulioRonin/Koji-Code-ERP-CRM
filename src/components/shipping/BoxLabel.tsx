import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
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
 * Etiqueta de caja imprimible (10x15 cm aprox.) con QR.
 * Incluye estilos `@media print` para imprimir directo desde el navegador.
 */
export function BoxLabel({ project, shipment, label, items, trackingUrl }: BoxLabelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(trackingUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [trackingUrl]);

  return (
    <div className="box-label bg-white border-2 border-black text-black p-4 w-[400px] font-sans">
      <style>{`
        @media print {
          @page { size: 100mm 150mm; margin: 5mm; }
          body * { visibility: hidden; }
          .box-label, .box-label * { visibility: visible; }
          .box-label { position: absolute; left: 0; top: 0; }
          .no-print-in-label { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3">
        <div>
          <p className="text-[10px] tracking-widest font-bold">KOJI CODE ERP</p>
          <p className="text-xs font-bold mt-0.5">{project.client_name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono">{shipment.id}</p>
          <p className="text-[10px] font-mono">{label.box_number}</p>
        </div>
      </div>

      {/* Project info */}
      <div className="space-y-1 text-xs mb-3">
        <div className="flex justify-between">
          <span className="font-semibold">Proyecto:</span>
          <span className="font-mono">{project.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold truncate max-w-[60%]">{project.name}</span>
          {label.weight_kg && <span>{label.weight_kg} kg</span>}
        </div>
        {label.dimensions_cm && (
          <div className="flex justify-between">
            <span className="font-semibold">Dimensiones:</span>
            <span>{label.dimensions_cm} cm</span>
          </div>
        )}
      </div>

      {/* QR + items */}
      <div className="flex gap-3 mb-3">
        <div className="shrink-0 border border-black p-1">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" className="w-24 h-24" />
          ) : (
            <div className="w-24 h-24 bg-gray-200" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1">Contenido</p>
          <div className="text-xs space-y-0.5 max-h-24 overflow-hidden">
            {items.slice(0, 6).map(it => (
              <div key={it.id} className="flex justify-between gap-2">
                <span className="truncate">{it.description}</span>
                <span className="font-mono shrink-0">
                  {it.quantity} {it.uom}
                </span>
              </div>
            ))}
            {items.length > 6 && (
              <div className="text-[10px] italic mt-1">+ {items.length - 6} más...</div>
            )}
          </div>
        </div>
      </div>

      {/* Ship to */}
      {shipment.ship_to_address && (
        <div className="border-t border-black pt-2 text-xs">
          <p className="font-bold uppercase text-[10px] mb-0.5">Enviar a:</p>
          <p className="leading-snug">{shipment.ship_to_address}</p>
        </div>
      )}

      <p className="text-center text-[9px] mt-3 italic text-gray-600">
        Escanea el QR para ver el estatus en vivo del proyecto.
      </p>
    </div>
  );
}
