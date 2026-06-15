import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { AsyncState, MutationState } from './types';
import type { DimensionalReport } from '@/types/database';

const DEMO_KEY = 'koji_demo_dimensional';
const BUCKET = 'project-files';

function readDemo(): DimensionalReport[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as DimensionalReport[]) : [];
  } catch {
    return [];
  }
}

function writeDemo(rows: DimensionalReport[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

/** Genera un folio legible: DIM-2026-482913 */
export function newDimensionalId(): string {
  const year = new Date().getFullYear();
  return `DIM-${year}-${Date.now().toString().slice(-6)}`;
}

/**
 * Lista reportes dimensionales. Filtra por proyecto y/o pieza. Útil tanto para
 * la bandeja de calidad (badge "tiene reporte") como para el editor.
 */
export function useDimensionalReports(
  projectId?: string,
  bomItemId?: string
): AsyncState<DimensionalReport[]> {
  return useAsync<DimensionalReport[]>(
    async () => {
      if (!supabase) {
        return readDemo().filter(
          r =>
            (!projectId || r.project_id === projectId) &&
            (!bomItemId || r.bom_item_id === bomItemId)
        );
      }
      let query = supabase
        .from('dimensional_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      if (bomItemId) query = query.eq('bom_item_id', bomItemId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DimensionalReport[];
    },
    [],
    [projectId, bomItemId]
  );
}

/** Inserta o actualiza un reporte dimensional (upsert por PK). */
export function useSaveDimensionalReport() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const save = useCallback(async (report: DimensionalReport): Promise<DimensionalReport> => {
    setState({ loading: true, error: null });
    try {
      const record: DimensionalReport = { ...report, updated_at: new Date().toISOString() };

      if (!supabase) {
        const rows = readDemo();
        const idx = rows.findIndex(r => r.id === record.id);
        if (idx >= 0) rows[idx] = record;
        else rows.unshift(record);
        writeDemo(rows);
        setState({ loading: false, error: null });
        return record;
      }

      const { data, error } = await supabase
        .from('dimensional_reports')
        .upsert(record)
        .select('*')
        .single();
      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('row-level security') || m.includes('policy')) {
          throw new Error(
            'No tienes permisos para guardar reportes dimensionales. Tu perfil debe ser del ' +
              'departamento Calidad o Administración.'
          );
        }
        throw error;
      }
      setState({ loading: false, error: null });
      return data as DimensionalReport;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { save, ...state };
}

/** Elimina un reporte dimensional. */
export function useDeleteDimensionalReport() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const remove = useCallback(async (id: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      if (!supabase) {
        writeDemo(readDemo().filter(r => r.id !== id));
        setState({ loading: false, error: null });
        return;
      }
      const { error } = await supabase.from('dimensional_reports').delete().eq('id', id);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { remove, ...state };
}

/**
 * Sube una imagen/PDF/foto al bucket y devuelve el storage path. Se usa tanto
 * para adjuntar un dimensional ya hecho ("Subir archivo") como para guardar la
 * foto base cuando la pieza no tiene plano PDF.
 */
export async function uploadDimensionalFile(
  file: File,
  projectId: string,
  partNumber: string
): Promise<string> {
  const safePart = partNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `${projectId}/dimensional/${safePart}-${Date.now()}-${file.name}`;
  if (!supabase) return storagePath; // demo: solo metadata
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, { upsert: true });
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('bucket not found')) {
      throw new Error(`El bucket "${BUCKET}" no existe en Supabase Storage.`);
    }
    if (msg.includes('not authorized') || msg.includes('row-level security') || msg.includes('permission')) {
      throw new Error(
        'Supabase rechazó la subida por permisos. Verifica que tu perfil sea de Calidad o ' +
          'Administración y que existan las RLS policies del bucket "project-files".'
      );
    }
    throw new Error(`Supabase Storage: ${error.message}`);
  }
  return storagePath;
}

/**
 * Sube un dataURL (PNG del lienzo globalizado generado en el editor) y devuelve
 * el storage path. Permite conservar la imagen base + burbujas "horneadas".
 */
export async function uploadDimensionalDataUrl(
  dataUrl: string,
  projectId: string,
  partNumber: string
): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], 'dimensional.png', { type: 'image/png' });
  return uploadDimensionalFile(file, projectId, partNumber);
}
