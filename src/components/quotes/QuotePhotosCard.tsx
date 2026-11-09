import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ACCEPTED_IMAGE_TYPES } from '@/lib/imageUpload';
import {
  MAX_QUOTE_PHOTOS,
  deleteQuotePhotoFile,
  uploadQuotePhoto,
  useQuotePhotoUrls,
} from '@/lib/api';
import type { QuotePhoto } from '@/types/database';

interface Props {
  quoteId: string;
  photos: QuotePhoto[];
  /** Persiste la lista completa en quotes.photos. */
  onChange: (photos: QuotePhoto[]) => Promise<void>;
}

/**
 * Fotos anexas a la cotización (máx. 5). Se guardan al momento (no dependen
 * del botón Guardar) y salen en la hoja "Anexo fotográfico" del PDF.
 */
export function QuotePhotosCard({ quoteId, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useQuotePhotoUrls(photos);
  const remaining = MAX_QUOTE_PHOTOS - photos.length;

  const persist = async (next: QuotePhoto[]) => {
    setError(null);
    try {
      await onChange(next);
    } catch (e) {
      setError((e as Error).message || 'No se pudieron guardar las fotos.');
      throw e;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return;
    setError(null);
    const list = Array.from(files).slice(0, remaining);
    const skipped = files.length - list.length;
    setBusy(true);
    const uploaded: QuotePhoto[] = [];
    try {
      for (const f of list) uploaded.push(await uploadQuotePhoto(quoteId, f));
      await persist([...photos, ...uploaded]);
      if (skipped > 0) setError(`Solo se permiten ${MAX_QUOTE_PHOTOS} fotos por cotización; se omitieron ${skipped}.`);
    } catch (e) {
      // Si falló el guardado de la referencia, no dejamos binarios huérfanos.
      await Promise.all(uploaded.map(deleteQuotePhotoFile));
      setError((e as Error).message || 'No se pudo subir la foto.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (photo: QuotePhoto) => {
    if (!confirm(`¿Quitar la foto "${photo.name}" de la cotización?`)) return;
    setBusy(true);
    try {
      await persist(photos.filter(p => p.id !== photo.id));
      await deleteQuotePhotoFile(photo);
    } catch { /* error ya mostrado */ } finally {
      setBusy(false);
    }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...photos];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    void persist(next).catch(() => {});
  };

  const setCaption = (photo: QuotePhoto, caption: string) => {
    const value = caption.trim() || null;
    if ((photo.caption ?? null) === value) return;
    void persist(photos.map(p => (p.id === photo.id ? { ...p, caption: value } : p))).catch(() => {});
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="text-base">Fotos anexas ({photos.length}/{MAX_QUOTE_PHOTOS})</CardTitle>
          <CardDescription>Se agregan al PDF en una hoja de "Anexo fotográfico". Se guardan al subirlas.</CardDescription>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy || remaining <= 0}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1.5" />}
          {busy ? 'Procesando…' : 'Agregar fotos'}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 p-2.5 rounded-md bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full rounded-lg border-2 border-dashed border-[var(--color-app-border-strong)] py-8 text-sm text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)] transition-colors"
          >
            Sin fotos. Haz clic para agregar hasta {MAX_QUOTE_PHOTOS} (PNG, JPG o WEBP).
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {photos.map((p, idx) => (
              <div key={p.id} className="rounded-lg border border-[var(--color-app-border)] overflow-hidden bg-white">
                <div className="relative aspect-[4/3] bg-[var(--color-app-surface-alt)]">
                  {urls[p.id] ? (
                    <img src={urls[p.id]} alt={p.caption || p.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--color-app-text-subtle)]" />
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 text-[10px] font-medium text-white">Foto {idx + 1}</span>
                </div>
                <div className="p-2 space-y-1.5">
                  <Input
                    key={`${p.id}-${p.caption ?? ''}`}
                    defaultValue={p.caption ?? ''}
                    placeholder="Descripción (opcional)"
                    className="h-8 text-xs"
                    onBlur={e => setCaption(p, e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={busy || idx === 0} onClick={() => move(idx, -1)} title="Mover antes">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={busy || idx === photos.length - 1} onClick={() => move(idx, 1)} title="Mover después">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[var(--color-app-danger)]" disabled={busy} onClick={() => remove(p)} title="Quitar foto">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
