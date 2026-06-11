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

interface AttachDrawingsResult {
  matched: { partNumber: string; itemId: string; fileName: string }[];
  unmatched: string[];
}

interface AttachDrawingsInput {
  projectId: string;
  files: File[];
  /** kind: 'drawing' guarda en drawing_url (PDF 2D), 'model' en model_url (3D). */
  kind: 'drawing' | 'model';
  /** Items del BOM contra los que se intenta hacer match. */
  bomItems: { id: string; part_number: string }[];
}

/**
 * Sube archivos a Storage y hace match por nombre contra los part numbers
 * del BOM del proyecto. Si el filename contiene el part_number (case-insensitive)
 * guarda el storage_path en bom_items.drawing_url (o model_url).
 *
 * Devuelve dos listas: los items emparejados y los archivos que no pudieron
 * asociarse a ningún número de parte.
 */
export function useAttachDrawings() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const attach = useCallback(async (input: AttachDrawingsInput): Promise<AttachDrawingsResult> => {
    setState({ loading: true, error: null });
    const matched: AttachDrawingsResult['matched'] = [];
    const unmatched: string[] = [];
    try {
      // Orden: matchea primero los part_number más largos para evitar que
      // "MS-A-4140-01" matchee también "MS-A-4140" si existieran ambos.
      const sortedItems = [...input.bomItems].sort(
        (a, b) => b.part_number.length - a.part_number.length
      );

      for (const file of input.files) {
        const fname = file.name.toLowerCase();
        const hit = sortedItems.find(it => fname.includes(it.part_number.toLowerCase()));
        if (!hit) {
          unmatched.push(file.name);
          continue;
        }
        const folder = input.kind === 'drawing' ? 'drawings' : 'models';
        const storagePath = `${input.projectId}/${folder}/${hit.part_number}-${file.name}`;

        if (supabase) {
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, { upsert: true });
          if (upErr) throw upErr;

          const column = input.kind === 'drawing' ? 'drawing_url' : 'model_url';
          const { data, error } = await supabase
            .from('bom_items')
            .update({ [column]: storagePath, updated_at: new Date().toISOString() })
            .eq('id', hit.id)
            .select('id');
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(
              'No se pudo guardar la referencia al plano. Verifica que tu profiles.role sea ' +
                '"Administrador" en Supabase.'
            );
          }
        }
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
 * Quita la referencia al plano 2D (o modelo 3D) de un item, sin borrar el
 * archivo del Storage (para no romper auditoría). Si quisieras borrar el
 * binario también, agrega un `supabase.storage.remove([path])`.
 */
export function useDetachDrawing() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const detach = useCallback(
    async (itemId: string, kind: 'drawing' | 'model'): Promise<void> => {
      setState({ loading: true, error: null });
      try {
        if (!supabase) {
          setState({ loading: false, error: null });
          return;
        }
        const column = kind === 'drawing' ? 'drawing_url' : 'model_url';
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
