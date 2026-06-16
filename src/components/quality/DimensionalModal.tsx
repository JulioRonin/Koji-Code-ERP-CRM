import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Ruler,
  Upload,
  FileText,
  Trash2,
  Pencil,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  getFileDownloadUrl,
  newDimensionalId,
  useDimensionalReports,
  useSaveDimensionalReport,
  useDeleteDimensionalReport,
  uploadDimensionalFile,
} from '@/lib/api';
import { DimensionalEditor } from './DimensionalEditor';
import type { BomItem, DimensionalReport, DimensionalStatus } from '@/types/database';

interface Props {
  item: BomItem;
  projectName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const statusVariant: Record<DimensionalStatus, 'success' | 'destructive' | 'secondary'> = {
  Aprobado: 'success',
  Rechazado: 'destructive',
  Borrador: 'secondary',
};

export function DimensionalModal({ item, projectName, open, onOpenChange, onChanged }: Props) {
  const { data: reports, refetch } = useDimensionalReports(item.project_id, item.id);
  const { save } = useSaveDimensionalReport();
  const { remove } = useDeleteDimensionalReport();
  const [editing, setEditing] = useState<DimensionalReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const draft = (): DimensionalReport => ({
    id: newDimensionalId(),
    project_id: item.project_id,
    bom_item_id: item.id,
    part_number: item.part_number,
    title: null,
    inspector_id: null,
    inspector_name: null,
    sample_size: 1,
    status: 'Borrador',
    drawing_image: null,
    report_url: null,
    payload: { balloons: [], characteristics: [] },
    notes: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const handleUploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadDimensionalFile(file, item.project_id, item.part_number);
      await save({ ...draft(), report_url: path, title: `Dimensional adjunto · ${file.name}` });
      await refetch();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este reporte dimensional?')) return;
    try {
      await remove(id);
      await refetch();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openFile = async (path: string) => {
    const url = (await getFileDownloadUrl(path)) ?? path;
    window.open(url, '_blank');
  };

  const onEditorSaved = async () => {
    await refetch();
    onChanged?.();
  };

  // Mientras el editor está abierto, ocultamos el Dialog (evita que el focus
  // trap de Radix bloquee los inputs del editor).
  if (editing) {
    return (
      <DimensionalEditor
        report={editing}
        item={item}
        projectName={projectName}
        onClose={() => setEditing(null)}
        onSaved={async saved => {
          setEditing(saved); // conserva el id ya guardado para siguientes ediciones
          await onEditorSaved();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-[var(--color-app-primary)]" />
            Inspección dimensional
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{item.part_number}</span> — {item.description || 'pieza'}.
            Genera el plano globalizado con su reporte de medidas (ISO 9001) o adjunta uno existente.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-2.5 bg-[var(--color-app-danger-soft)] border border-[var(--color-app-danger)]/30 rounded-md text-sm text-[var(--color-app-danger)]">
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setEditing(draft())} className="h-auto py-3 flex-col gap-1">
            <Pencil className="h-4 w-4" />
            <span className="text-sm font-medium">Generar dimensional</span>
            <span className="text-[10px] opacity-80 font-normal">Globalizar plano + medidas</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="h-auto py-3 flex-col gap-1"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="text-sm font-medium">Subir archivo</span>
            <span className="text-[10px] opacity-80 font-normal">Foto o PDF ya hecho</span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleUploadFile(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Reportes existentes */}
        <div className="space-y-2 max-h-64 overflow-auto">
          <p className="text-xs font-medium text-[var(--color-app-text-muted)]">
            Reportes ({reports.length})
          </p>
          {reports.length === 0 ? (
            <p className="text-xs text-[var(--color-app-text-subtle)] py-2">
              Aún no hay reportes dimensionales para esta pieza.
            </p>
          ) : (
            reports.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-2 p-2 rounded-md border border-[var(--color-app-border)] hover:bg-[var(--color-app-surface-alt)]/40"
              >
                <FileText className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono truncate">{r.id}</span>
                    <Badge variant={statusVariant[r.status]} className="text-[9px]">{r.status}</Badge>
                  </div>
                  <p className="text-[10px] text-[var(--color-app-text-muted)]">
                    {r.payload.characteristics?.length ?? 0} medidas · {r.sample_size} pza ·{' '}
                    {new Date(r.updated_at || r.created_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                {r.report_url && (
                  <button
                    onClick={() => openFile(r.report_url!)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded text-[var(--color-app-text-muted)] hover:text-[var(--color-app-primary)]"
                    title="Ver archivo adjunto"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setEditing(r)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-[var(--color-app-text-muted)] hover:text-[var(--color-app-primary)]"
                  title="Abrir editor"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-[var(--color-app-text-muted)] hover:text-[var(--color-app-danger)]"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
