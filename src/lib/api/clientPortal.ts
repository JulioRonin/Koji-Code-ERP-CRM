import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { MOCK_PROJECTS, MOCK_BOM_ITEMS, MOCK_INSPECTIONS } from './mocks';
import type {
  Project,
  BomItem,
  QualityInspection,
  ProjectFile,
} from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_TOKEN_KEY = 'koji_demo_client_tokens'; // map projectId -> token

interface DemoTokenMap {
  [projectId: string]: string;
}

function readDemoTokens(): DemoTokenMap {
  try {
    const raw = localStorage.getItem(DEMO_TOKEN_KEY);
    return raw ? (JSON.parse(raw) as DemoTokenMap) : {};
  } catch {
    return {};
  }
}

function writeDemoTokens(map: DemoTokenMap): void {
  try {
    localStorage.setItem(DEMO_TOKEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Genera (o reusa) un token único para el portal cliente de un proyecto.
 * El token caduca a los 90 días.
 */
export function useGenerateClientPortalToken() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const generate = useCallback(async (projectId: string): Promise<string> => {
    setState({ loading: true, error: null });
    try {
      const token =
        (crypto?.randomUUID && crypto.randomUUID().replace(/-/g, '')) ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      if (!supabase) {
        const tokens = readDemoTokens();
        tokens[projectId] = token;
        writeDemoTokens(tokens);
        setState({ loading: false, error: null });
        return token;
      }

      const { error } = await supabase
        .from('projects')
        .update({
          client_portal_token: token,
          client_portal_expires: expires,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      if (error) throw error;
      setState({ loading: false, error: null });
      return token;
    } catch (err) {
      const error = err as Error;
      setState({ loading: false, error });
      throw error;
    }
  }, []);

  return { generate, ...state };
}

/**
 * Obtiene el token existente del portal cliente para un proyecto (si hay).
 */
export function useClientPortalToken(projectId: string | undefined): AsyncState<string | null> {
  return useAsync<string | null>(
    async () => {
      if (!projectId) return null;
      if (!supabase) {
        const tokens = readDemoTokens();
        return tokens[projectId] ?? null;
      }
      const { data, error } = await supabase
        .from('projects')
        .select('client_portal_token')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;
      return ((data as { client_portal_token: string | null })?.client_portal_token) ?? null;
    },
    null,
    [projectId]
  );
}

export interface PortalBrand {
  name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  tagline: string | null;
}

export interface ClientPortalData {
  project: Project | null;
  parts: BomItem[];
  inspections: QualityInspection[];
  visibleFiles: ProjectFile[];
  brand?: PortalBrand | null;
}

/**
 * Carga el bundle de datos visibles para el cliente, dado un token.
 * En modo demo el token se mapea contra `koji_demo_client_tokens`.
 */
export function useClientPortalData(token: string | undefined): AsyncState<ClientPortalData> {
  const empty: ClientPortalData = { project: null, parts: [], inspections: [], visibleFiles: [] };
  return useAsync<ClientPortalData>(
    async () => {
      if (!token) return empty;

      // --- Modo demo ---
      if (!supabase) {
        const tokens = readDemoTokens();
        const projectId = Object.keys(tokens).find(k => tokens[k] === token);
        if (!projectId) return empty;
        const project = MOCK_PROJECTS.find(p => p.id === projectId) ?? null;
        return {
          project,
          parts: MOCK_BOM_ITEMS.filter(b => b.project_id === projectId),
          inspections: MOCK_INSPECTIONS.filter(i => i.project_id === projectId),
          visibleFiles: [],
        };
      }

      // --- Modo Supabase ---
      const { data: projectRow, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('client_portal_token', token)
        .maybeSingle();
      if (projErr || !projectRow) return empty;
      const project = projectRow as Project;

      // Verifica vigencia
      if (project.client_portal_expires && new Date(project.client_portal_expires) < new Date()) {
        return empty;
      }

      const projectTenant = (project as Project & { tenant_id?: string | null }).tenant_id ?? null;
      const [{ data: parts }, { data: inspections }, { data: files }, brandRes] = await Promise.all([
        supabase.from('bom_items').select('*').eq('project_id', project.id),
        supabase
          .from('quality_inspections')
          .select('*')
          .eq('project_id', project.id)
          .order('inspection_date', { ascending: false }),
        supabase
          .from('project_files')
          .select('*')
          .eq('project_id', project.id)
          .eq('is_client_visible', true),
        // Marca de la empresa emisora (lectura anónima permitida por "company read").
        projectTenant
          ? supabase.from('company_settings').select('commercial_name, legal_name, logo_url, primary_color, tagline').eq('tenant_id', projectTenant).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const b = (brandRes as { data: Record<string, string | null> | null }).data;
      const brand: PortalBrand | null = b
        ? { name: b.commercial_name || b.legal_name || null, logo_url: b.logo_url ?? null, primary_color: b.primary_color ?? null, tagline: b.tagline ?? null }
        : null;

      return {
        project,
        parts: (parts ?? []) as BomItem[],
        inspections: (inspections ?? []) as QualityInspection[],
        visibleFiles: (files ?? []) as ProjectFile[],
        brand,
      };
    },
    empty,
    [token]
  );
}
