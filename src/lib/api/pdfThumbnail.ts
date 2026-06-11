/**
 * Renderiza la primera página de un PDF a un data URL (PNG). Cache en
 * memoria por storagePath para no re-renderizar mientras dura la sesión.
 *
 * Uso típico: en el checklist visual o en el PDF de impresión, cuando el
 * item NO tiene image_url pero SÍ tiene drawing_url, mostrar el PDF como
 * thumbnail.
 */
import { useEffect, useState } from 'react';
import { getFileDownloadUrl } from './projectFiles';

// Cache global a lo largo de la sesión
const cache = new Map<string, string>();

// Cargamos pdfjs-dist y su worker de manera diferida sólo cuando se necesita,
// para no pegarle al bundle inicial.
let pdfjsModulePromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfJs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      const mod = await import('pdfjs-dist');
      // Worker como URL (Vite resuelve ?url)
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      return mod;
    })();
  }
  return pdfjsModulePromise;
}

async function renderFirstPage(url: string, maxWidth = 480): Promise<string> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument(url);
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxWidth / viewport.width);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d not available');
  await page.render({ canvasContext: ctx, viewport: scaled, canvas } as never).promise;
  return canvas.toDataURL('image/png');
}

/**
 * Devuelve el data URL de la primera página del PDF. null mientras carga.
 * `storagePath` es la ruta dentro del bucket project-files (no la signed URL).
 */
export function usePdfFirstPageThumbnail(storagePath: string | null | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(
    storagePath ? cache.get(storagePath) ?? null : null
  );

  useEffect(() => {
    if (!storagePath) {
      setDataUrl(null);
      return;
    }
    const cached = cache.get(storagePath);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const signed = await getFileDownloadUrl(storagePath);
        if (!signed || cancelled) return;
        const png = await renderFirstPage(signed);
        if (cancelled) return;
        cache.set(storagePath, png);
        setDataUrl(png);
      } catch (err) {
        console.warn('Falló render de PDF thumbnail', storagePath, err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return dataUrl;
}
