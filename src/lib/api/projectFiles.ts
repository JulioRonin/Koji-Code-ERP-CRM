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
