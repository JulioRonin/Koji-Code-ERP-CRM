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

/** Renderiza un PDF (si no está en cache) y devuelve el data URL. */
async function ensureThumb(storagePath: string): Promise<string | null> {
  const cached = cache.get(storagePath);
  if (cached) return cached;
  try {
    const signed = await getFileDownloadUrl(storagePath);
    if (!signed) return null;
    const png = await renderFirstPage(signed);
    cache.set(storagePath, png);
    return png;
  } catch (err) {
    console.warn('Falló render de PDF thumbnail', storagePath, err);
    return null;
  }
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
    ensureThumb(storagePath).then(png => {
      if (!cancelled && png) setDataUrl(png);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return dataUrl;
}

/**
 * Pre-renderiza un batch de PDFs (uno por uno para no saturar la red /
 * cpu) y devuelve un mapa storagePath → dataUrl. `prime` es la función
 * que el caller invoca cuando quiera disparar el proceso (ej. justo
 * antes de imprimir). Devuelve también `progress` (0–1) y `done`.
 */
export function useBatchPdfThumbnails(paths: (string | null | undefined)[]) {
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    paths.forEach(p => {
      if (p && cache.has(p)) seed[p] = cache.get(p)!;
    });
    return seed;
  });
  const [progress, setProgress] = useState<{ done: number; total: number; running: boolean }>(
    { done: 0, total: 0, running: false }
  );

  const prime = async (): Promise<void> => {
    const uniq = Array.from(new Set(paths.filter(Boolean) as string[]));
    const pending = uniq.filter(p => !cache.has(p));
    setProgress({ done: uniq.length - pending.length, total: uniq.length, running: true });
    // Secuencial: para 100+ PDFs, hacerlo en paralelo congela el navegador.
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const png = await ensureThumb(p);
      if (png) {
        setUrls(prev => ({ ...prev, [p]: png }));
      }
      setProgress(prev => ({ ...prev, done: uniq.length - pending.length + i + 1 }));
    }
    // Asegúrate de que el state final incluya todos (en caso de paths ya en cache)
    setUrls(prev => {
      const next = { ...prev };
      uniq.forEach(p => {
        const c = cache.get(p);
        if (c) next[p] = c;
      });
      return next;
    });
    setProgress(prev => ({ ...prev, running: false, done: uniq.length }));
  };

  return { urls, progress, prime };
}
