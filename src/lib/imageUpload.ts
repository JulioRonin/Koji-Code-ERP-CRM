/**
 * Utilidades para subir imágenes desde el navegador: redimensiona y comprime
 * con <canvas> antes de subir, para que el logo y las fotos de cotización
 * pesen poco y siempre se rendericen (pantalla, impresión y PDF).
 */

export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/webp';

interface CompressOptions {
  /** Lado mayor máximo en px. */
  maxSize: number;
  /** 'image/png' conserva transparencia (logos); 'image/jpeg' para fotos. */
  type: 'image/png' | 'image/jpeg';
  quality?: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('El archivo no es una imagen válida (usa PNG, JPG o WEBP).')); };
    img.src = url;
  });
}

/** Redimensiona y re-codifica la imagen. Devuelve un Blob listo para subir. */
export async function compressImage(file: File, { maxSize, type, quality = 0.85 }: CompressOptions): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen (PNG, JPG o WEBP).');
  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  if (type === 'image/jpeg') {
    // JPEG no tiene transparencia: fondo blanco en lugar de negro.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), type, quality)
  );
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    r.readAsDataURL(blob);
  });
}

export function newUuid(): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
