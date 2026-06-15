import { useEffect, useState } from 'react';
import { getFileDownloadUrl, renderPdfPageHiRes } from '@/lib/api';
import type { BomItem, DimensionalReport } from '@/types/database';

/**
 * Resuelve la imagen base sobre la que se globaliza el plano. Orden de
 * preferencia:
 *   1. La imagen ya guardada en el reporte (`drawing_image`).
 *   2. Una foto/render de la pieza (`bom_items.image_url`).
 *   3. El plano 2D en PDF (`bom_items.drawing_url`) → se renderiza la 1ª página.
 * Devuelve un data URL o signed URL listo para <img>. `setImage` permite
 * inyectar una imagen subida manualmente (foto del inspector).
 */
export function useDimensionalBaseImage(
  report: Pick<DimensionalReport, 'drawing_image'>,
  item: Pick<BomItem, 'image_url' | 'drawing_url'>
) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (report.drawing_image) {
          const signed = await getFileDownloadUrl(report.drawing_image);
          if (!cancelled && signed) {
            setImage(signed);
            return;
          }
        }
        if (item.image_url) {
          const signed = await getFileDownloadUrl(item.image_url);
          if (!cancelled && signed) {
            setImage(signed);
            return;
          }
        }
        if (item.drawing_url) {
          const rendered = await renderPdfPageHiRes(item.drawing_url);
          if (!cancelled && rendered) {
            setImage(rendered.dataUrl);
            return;
          }
        }
        if (!cancelled) setImage(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [report.drawing_image, item.image_url, item.drawing_url]);

  return { image, setImage, loading };
}
