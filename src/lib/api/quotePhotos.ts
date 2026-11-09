import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { blobToDataUrl, compressImage, newUuid } from '@/lib/imageUpload';
import { activeTenantId } from './tenantScope';
import type { QuotePhoto } from '@/types/database';

/** Bucket público para la marca de la empresa (logo). */
const LOGO_BUCKET = 'company-assets';
/** Bucket privado para las fotos anexas a cotizaciones (URLs firmadas). */
const PHOTO_BUCKET = 'quote-photos';

export const MAX_QUOTE_PHOTOS = 5;

/** Carpeta raíz por empresa: las políticas de Storage la comparan con current_tenant(). */
async function tenantFolder(): Promise<string> {
  const active = activeTenantId();
  if (active) return active;
  if (!supabase) return 'demo';
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data } = await supabase.from('profiles').select('tenant_id').eq('id', auth.user.id).maybeSingle();
    const t = (data as { tenant_id?: string | null } | null)?.tenant_id;
    if (t) return t;
  }
  throw new Error('No se pudo identificar la empresa activa para subir el archivo.');
}

function storageError(bucket: string, message: string): Error {
  const m = message.toLowerCase();
  if (m.includes('bucket not found')) {
    return new Error(`Falta el bucket "${bucket}" en Supabase Storage. Ejecuta db/2026_quote_photos.sql.`);
  }
  if (m.includes('row-level security') || m.includes('not authorized') || m.includes('permission')) {
    return new Error(`Supabase rechazó la subida por permisos. Ejecuta db/2026_quote_photos.sql (políticas de "${bucket}").`);
  }
  return new Error(`Supabase Storage: ${message}`);
}

/**
 * Sube el logo de la empresa (archivo, no link) y devuelve la URL a guardar en
 * company_settings.logo_url. Se normaliza a PNG ≤ 512 px.
 *
 * Con Supabase: bucket público `company-assets` (URL directa, sirve también en
 * correos). Sin Supabase (demo) se guarda como data URL.
 */
export async function uploadCompanyLogo(file: File): Promise<string> {
  const blob = await compressImage(file, { maxSize: 512, type: 'image/png' });
  if (!supabase) return blobToDataUrl(blob);
  const path = `${await tenantFolder()}/logo-${Date.now()}.png`;
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true, cacheControl: '31536000' });
  if (error) throw storageError(LOGO_BUCKET, error.message);
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Sube una foto para anexar a la cotización (JPEG ≤ 1600 px). Devuelve la
 * referencia que se guarda en quotes.photos.
 */
export async function uploadQuotePhoto(quoteId: string, file: File): Promise<QuotePhoto> {
  const id = newUuid();
  const name = file.name;
  if (!supabase) {
    // Demo: localStorage tiene poco espacio, comprimimos más.
    const blob = await compressImage(file, { maxSize: 1000, type: 'image/jpeg', quality: 0.7 });
    return { id, path: null, data_url: await blobToDataUrl(blob), name, caption: null };
  }
  const blob = await compressImage(file, { maxSize: 1600, type: 'image/jpeg', quality: 0.82 });
  const path = `${await tenantFolder()}/${quoteId}/${id}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw storageError(PHOTO_BUCKET, error.message);
  return { id, path, data_url: null, name, caption: null };
}

/** Borra el binario de una foto (best-effort: la referencia se quita aparte). */
export async function deleteQuotePhotoFile(photo: QuotePhoto): Promise<void> {
  if (!supabase || !photo.path) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.path]).catch(() => {});
}

/**
 * Resuelve las URLs visibles de las fotos (firmadas por 1 h en Supabase,
 * data URL en demo). Devuelve un mapa id → url.
 */
export function useQuotePhotoUrls(photos: QuotePhoto[] | null | undefined): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = (photos ?? []).map(p => p.id).join('|');

  useEffect(() => {
    let cancelled = false;
    const list = photos ?? [];
    (async () => {
      const out: Record<string, string> = {};
      const paths = list.filter(p => p.path).map(p => p.path as string);
      let signed: { path: string | null; signedUrl: string }[] = [];
      if (supabase && paths.length > 0) {
        const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
        signed = (data ?? []) as { path: string | null; signedUrl: string }[];
      }
      for (const p of list) {
        if (p.data_url) out[p.id] = p.data_url;
        else if (p.path) {
          const s = signed.find(x => x.path === p.path);
          if (s?.signedUrl) out[p.id] = s.signedUrl;
        }
      }
      if (!cancelled) setUrls(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
