import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Trash2, Loader2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useProjectFiles,
  useUploadProjectFile,
  useDeleteProjectFile,
  getFileDownloadUrl,
} from '@/lib/api';
import type { ProjectFile } from '@/types/database';

const IMG_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const isImage = (f: ProjectFile) =>
  f.category === 'Foto' || (f.mime_type?.startsWith('image/') ?? false) || IMG_RE.test(f.file_name);

const MAX_MB = 8;

/**
 * Tarjeta para subir y administrar imágenes del proyecto. Se guardan como
 * project_files (categoría "Foto") visibles al cliente, por lo que aparecen en
 * el portal del cliente.
 */
export function ProjectImagesCard({ projectId }: { projectId: string }) {
  const { data: files, refetch } = useProjectFiles(projectId);
  const { upload, loading: uploading } = useUploadProjectFile();
  const { remove } = useDeleteProjectFile();

  const images = useMemo(() => files.filter(isImage), [files]);

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        images.map(async f => [f.id, (await getFileDownloadUrl(f.storage_path)) ?? ''] as const)
      );
      if (!cancelled) setUrls(Object.fromEntries(entries.filter(([, u]) => u)));
    })();
    return () => { cancelled = true; };
  }, [images]);

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        if (!file.type.startsWith('image/') && !IMG_RE.test(file.name)) {
          setError(`"${file.name}" no es una imagen.`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          setError(`"${file.name}" supera ${MAX_MB} MB.`);
          continue;
        }
        await upload({ projectId, category: 'Foto', file, isClientVisible: true });
      }
      await refetch();
    } catch (e) {
      setError((e as Error).message || 'No se pudo subir la imagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (f: ProjectFile) => {
    if (!window.confirm(`¿Eliminar la imagen "${f.file_name}"?`)) return;
    try {
      await remove(f);
      await refetch();
    } catch (e) {
      setError((e as Error).message || 'No se pudo eliminar.');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Imágenes del proyecto
        </CardTitle>
        <CardDescription>Fotos visibles para el cliente en su portal de seguimiento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
          />
          <span className="flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-[var(--color-app-border-strong)] text-sm text-[var(--color-app-text-muted)] cursor-pointer hover:border-[var(--color-app-primary)] hover:text-[var(--color-app-primary)] transition-colors">
            {busy || uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
            ) : (
              <><ImagePlus className="h-4 w-4" /> Subir imágenes (máx. {MAX_MB} MB)</>
            )}
          </span>
        </label>

        {error && <p className="text-xs text-[var(--color-app-danger)]">{error}</p>}

        {images.length === 0 ? (
          <p className="text-sm text-[var(--color-app-text-muted)] text-center py-2">
            Aún no hay imágenes. Súbelas para que tu cliente las vea en el portal.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map(f => {
              const url = urls[f.id];
              return (
                <div key={f.id} className="group relative rounded-md overflow-hidden border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] aspect-square">
                  {url ? (
                    <img src={url} alt={f.file_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--color-app-text-subtle)]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="h-7 w-7 rounded-md bg-white/90 flex items-center justify-center" title="Ver">
                        <Eye className="h-3.5 w-3.5 text-[var(--color-app-text)]" />
                      </a>
                    )}
                    <button onClick={() => handleDelete(f)} className="h-7 w-7 rounded-md bg-white/90 flex items-center justify-center" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5 text-[var(--color-app-danger)]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
