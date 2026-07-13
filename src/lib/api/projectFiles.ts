import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { ProjectFile, ProjectFileCategory } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const BUCKET = 'project-files';

/**
 * Lista los archivos asociados a un proyecto.
 */
export function useProjectFiles(projectId: string | undefined): AsyncState<ProjectFile[]> {
  return useAsync<ProjectFile[]>(
    async () => {
      if (!projectId) return [];
      if (!supabase) {
        // Demo: lectura desde localStorage para que persistan entre reloads
        const key = `koji_demo_files_${projectId}`;
        try {
          const raw = localStorage.getItem(key);
          return raw ? (JSON.parse(raw) as ProjectFile[]) : [];
        } catch {
          return [];
        }
      }
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectFile[];
    },
    [],
    [projectId]
  );
}

interface UploadInput {
  projectId: string;
  category: ProjectFileCategory;
  file: File;
  isClientVisible?: boolean;
  notes?: string | null;
}

/**
 * Sube un archivo a Supabase Storage y registra el row en `project_files`.
 * En modo demo solo persiste el metadata en localStorage (sin storage real).
 */
export function useUploadProjectFile() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const upload = useCallback(async (input: UploadInput): Promise<ProjectFile> => {
    setState({ loading: true, error: null });
    try {
      const id = (crypto?.randomUUID && crypto.randomUUID()) || `file-${Date.now()}`;
      const now = new Date().toISOString();
      const storagePath = `${input.projectId}/${input.category}/${id}-${input.file.name}`;

      const record: ProjectFile = {
        id,
        project_id: input.projectId,
        bom_item_id: null,
        category: input.category,
        file_name: input.file.name,
        storage_path: storagePath,
        mime_type: input.file.type || null,
        size_bytes: input.file.size,
        uploaded_by: null,
        is_client_visible: input.isClientVisible ?? false,
        notes: input.notes ?? null,
        created_at: now,
      };

      if (!supabase) {
        // Demo: guardamos solo metadata
        const key = `koji_demo_files_${input.projectId}`;
        try {
          const raw = localStorage.getItem(key);
          const existing: ProjectFile[] = raw ? JSON.parse(raw) : [];
          localStorage.setItem(key, JSON.stringify([record, ...existing]));
        } catch {
          /* ignore */
        }
        setState({ loading: false, error: null });
        return record;
      }

      // Producción: sube binario + crea row
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, input.file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase
        .from('project_files')
        .insert(record)
        .select('*')
        .single();
      if (insertError) throw insertError;

      setState({ loading: false, error: null });
      return row as ProjectFile;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { upload, ...state };
}

/**
 * Devuelve URL firmada (privada) o pública según configuración del bucket.
 */
export async function getFileDownloadUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export interface AttachDrawingsResult {
  matched: { partNumber: string; itemId: string; fileName: string }[];
  /** Archivos sin match exacto. Vienen con sugerencias por similitud para
   *  que la UI pueda ofrecer asignación manual. */
  unmatched: { file: File; suggestions: { itemId: string; partNumber: string; score: number }[] }[];
}

interface AttachDrawingsInput {
  projectId: string;
  files: File[];
  /** kind: 'drawing' guarda en drawing_url (PDF 2D), 'model' en model_url (3D). */
  kind: 'drawing' | 'model' | 'image';
  /** Items del BOM contra los que se intenta hacer match. */
  bomItems: { id: string; part_number: string }[];
}

/** Normaliza una cadena: minúsculas y sólo alfanuméricos. Así
 *  "IBA-02-04_001.PDF" y "iba0204001" se ven iguales. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Score 0–1 de similitud entre filename y part_number. 1 si el part es
 *  substring del filename, si no la longitud del prefijo común sobre la
 *  longitud del part_number. */
function similarity(fileBase: string, partNumber: string): number {
  const a = normalize(fileBase);
  const b = normalize(partNumber);
  if (b.length === 0) return 0;
  if (a.includes(b)) return 1;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return prefix / b.length;
}

/**
 * Sube un binario a Storage y persiste la referencia en bom_items.
 * Compartido entre el matcher automático y la asignación manual.
 */
async function uploadOne(
  file: File,
  itemId: string,
  partNumber: string,
  projectId: string,
  kind: 'drawing' | 'model' | 'image'
): Promise<void> {
  const folder = kind === 'drawing' ? 'drawings' : kind === 'model' ? 'models' : 'images';
  const storagePath = `${projectId}/${folder}/${partNumber}-${file.name}`;
  if (!supabase) return;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true });
  if (upErr) {
    // Mensajes más accionables para los errores comunes de Storage.
    const msg = (upErr.message || '').toLowerCase();
    if (msg.includes('bucket not found')) {
      throw new Error(
        `El bucket "${BUCKET}" no existe en Supabase Storage. Créalo desde ` +
          `Supabase → Storage → New bucket (nombre exacto: "${BUCKET}", privado).`
      );
    }
    if (msg.includes('not authorized') || msg.includes('row-level security') || msg.includes('permission')) {
      throw new Error(
        `Supabase rechazó la subida por permisos. Agrega las RLS policies de ` +
          `storage.objects para el bucket "${BUCKET}" (ver schema SQL).`
      );
    }
    throw new Error(`Supabase Storage: ${upErr.message}`);
  }

  const column = kind === 'drawing' ? 'drawing_url' : kind === 'model' ? 'model_url' : 'image_url';
  const { data, error } = await supabase
    .from('bom_items')
    .update({ [column]: storagePath, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select(`id, ${column}`);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'No se pudo guardar la referencia al archivo. Verifica que tu profiles.role sea ' +
        '"Administrador" en Supabase.'
    );
  }
  // Verificación final: lo que la base reporta DEBE coincidir con el path
  // que acabamos de escribir. Si no, hay un trigger / RLS que está silenciando.
  const saved = (data[0] as Record<string, unknown>)[column];
  if (saved !== storagePath) {
    throw new Error(
      `La base no aceptó la actualización del campo ${column}. ` +
        `Esperado: ${storagePath} · Recibido: ${saved ?? 'null'}. ` +
        'Reporta este error: posible trigger o policy bloqueando.'
    );
  }
}

/**
 * Sube archivos a Storage y hace match contra los part numbers del BOM.
 * El match ignora mayúsculas y separadores (-, _, espacios) — así
 * "IBA_02_04_001.pdf" empareja "IBA-02-04-001".
 *
 * Los archivos sin match perfecto se devuelven con un top-5 de candidatos
 * sugeridos por similitud para que la UI los muestre en un panel y el
 * usuario asigne manualmente.
 */
export function useAttachDrawings() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const attach = useCallback(async (input: AttachDrawingsInput): Promise<AttachDrawingsResult> => {
    setState({ loading: true, error: null });
    const matched: AttachDrawingsResult['matched'] = [];
    const unmatched: AttachDrawingsResult['unmatched'] = [];
    try {
      const normItems = input.bomItems.map(it => ({ ...it, _norm: normalize(it.part_number) }));
      // Match primero contra los part_numbers más largos / específicos
      normItems.sort((a, b) => b._norm.length - a._norm.length);

      for (const file of input.files) {
        const fileBase = file.name.replace(/\.[^.]+$/, '');
        const normFile = normalize(file.name);
        const hit = normItems.find(it => it._norm.length > 0 && normFile.includes(it._norm));

        if (!hit) {
          const ranked = input.bomItems
            .map(it => ({
              itemId: it.id,
              partNumber: it.part_number,
              score: similarity(fileBase, it.part_number),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          unmatched.push({ file, suggestions: ranked });
          continue;
        }

        await uploadOne(file, hit.id, hit.part_number, input.projectId, input.kind);
        matched.push({ partNumber: hit.part_number, itemId: hit.id, fileName: file.name });
      }
      setState({ loading: false, error: null });
      return { matched, unmatched };
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { attach, ...state };
}

/**
 * Sube un archivo individual y lo asocia con un BOM item específico
 * (usado por el panel de asignación manual).
 */
export function useAssignDrawingManually() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const assign = useCallback(
    async (
      file: File,
      itemId: string,
      partNumber: string,
      projectId: string,
      kind: 'drawing' | 'model' | 'image'
    ): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        await uploadOne(file, itemId, partNumber, projectId, kind);
        setState({ loading: false, error: null });
      } catch (err) {
        const error = err as Error;
        setState({ loading: false, error });
        throw error;
      }
    },
    []
  );

  return { assign, ...state };
}

/**
 * Quita la referencia al plano 2D (o modelo 3D) de un item, sin borrar el
 * archivo del Storage (para no romper auditoría). Si quisieras borrar el
 * binario también, agrega un `supabase.storage.remove([path])`.
 */
export function useDetachDrawing() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const detach = useCallback(
    async (itemId: string, kind: 'drawing' | 'model' | 'image'): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        if (!supabase) {
          setState({ loading: false, error: null });
          return;
        }
        const column = kind === 'drawing' ? 'drawing_url' : kind === 'model' ? 'model_url' : 'image_url';
        const { error } = await supabase
          .from('bom_items')
          .update({ [column]: null, updated_at: new Date().toISOString() })
          .eq('id', itemId);
        if (error) throw error;
        setState({ loading: false, error: null });
      } catch (err) {
        const error = err as Error;
        setState({ loading: false, error });
        throw error;
      }
    },
    []
  );

  return { detach, ...state };
}

/**
 * Elimina un archivo de proyecto (row de project_files + binario en Storage).
 * En modo demo solo borra el metadata en localStorage.
 */
export function useDeleteProjectFile() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (file: ProjectFile): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        const key = `koji_demo_files_${file.project_id}`;
        try {
          const raw = localStorage.getItem(key);
          const existing: ProjectFile[] = raw ? JSON.parse(raw) : [];
          localStorage.setItem(key, JSON.stringify(existing.filter(f => f.id !== file.id)));
        } catch {
          /* ignore */
        }
        setState({ loading: false, error: null });
        return;
      }
      // Borra el binario (si falla, seguimos con el row para no dejar huérfano el registro).
      if (file.storage_path) {
        await supabase.storage.from(BUCKET).remove([file.storage_path]).catch(() => {});
      }
      const { error } = await supabase.from('project_files').delete().eq('id', file.id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { remove, ...state };
}
