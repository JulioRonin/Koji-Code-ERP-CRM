import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import type { AutomationEvent } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_KEY = 'koji_demo_automation_events';

function readDemo(): AutomationEvent[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as AutomationEvent[]) : [];
  } catch {
    return [];
  }
}

function writeDemo(items: AutomationEvent[]): void {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/** URL del webhook n8n desde env vars. */
export const N8N_WEBHOOK_URL: string | undefined = import.meta.env.VITE_N8N_WEBHOOK_URL;

interface AutomationEventsFilter {
  delivered?: boolean;
  eventType?: string;
  entityType?: string;
}

/**
 * Lista los eventos de la cola de automatizaciones.
 */
export function useAutomationEvents(filter: AutomationEventsFilter = {}): AsyncState<AutomationEvent[]> {
  return useAsync<AutomationEvent[]>(
    async () => {
      if (!supabase) {
        let all = readDemo();
        if (filter.delivered != null) all = all.filter(e => e.delivered === filter.delivered);
        if (filter.eventType) all = all.filter(e => e.event_type === filter.eventType);
        if (filter.entityType) all = all.filter(e => e.entity_type === filter.entityType);
        return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      let query = supabase
        .from('automation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (filter.delivered != null) query = query.eq('delivered', filter.delivered);
      if (filter.eventType) query = query.eq('event_type', filter.eventType);
      if (filter.entityType) query = query.eq('entity_type', filter.entityType);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AutomationEvent[];
    },
    [],
    [filter.delivered, filter.eventType, filter.entityType]
  );
}

/**
 * Marca un evento como entregado manualmente (o con error).
 */
export function useMarkEventDelivered() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const mark = useCallback(async (eventId: string, error?: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      if (!supabase) {
        const all = readDemo();
        const idx = all.findIndex(e => e.id === eventId);
        if (idx >= 0) {
          all[idx] = {
            ...all[idx],
            delivered: !error,
            delivered_at: error ? all[idx].delivered_at : now,
            error: error ?? null,
          };
          writeDemo(all);
        }
        setState({ loading: false, error: null });
        return;
      }
      const { error: rpcErr } = await supabase.rpc('mark_event_delivered', {
        p_event_id: eventId,
        p_error: error ?? null,
      });
      if (rpcErr) throw rpcErr;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { mark, ...state };
}

/**
 * Envía manualmente un evento al webhook configurado.
 * Útil para reintentar o testear la integración.
 */
export function useReplayEvent() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const replay = useCallback(async (event: AutomationEvent): Promise<boolean> => {
    setState({ loading: true, error: null });
    try {
      if (!N8N_WEBHOOK_URL) {
        throw new Error('VITE_N8N_WEBHOOK_URL no está configurado.');
      }

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          event_type: event.event_type,
          entity_type: event.entity_type,
          entity_id: event.entity_id,
          payload: event.payload,
          created_at: event.created_at,
        }),
      });

      const ok = response.ok;
      // Marca en BD
      if (supabase) {
        await supabase.rpc('mark_event_delivered', {
          p_event_id: event.id,
          p_error: ok ? null : `HTTP ${response.status}`,
        });
      } else {
        const all = readDemo();
        const idx = all.findIndex(e => e.id === event.id);
        if (idx >= 0) {
          all[idx] = {
            ...all[idx],
            delivered: ok,
            delivered_at: ok ? new Date().toISOString() : all[idx].delivered_at,
            error: ok ? null : `HTTP ${response.status}`,
          };
          writeDemo(all);
        }
      }

      setState({ loading: false, error: null });
      return ok;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { replay, ...state };
}

/**
 * Crea manualmente un evento de prueba (solo demo / dev).
 */
export function useCreateTestEvent() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (eventType: string): Promise<void> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const event: AutomationEvent = {
        id: (crypto?.randomUUID && crypto.randomUUID()) || `evt-${Date.now()}`,
        event_type: eventType,
        entity_type: 'test',
        entity_id: 'manual-test',
        payload: { source: 'manual_test', timestamp: now },
        delivered: false,
        delivered_at: null,
        error: null,
        created_at: now,
      };

      if (!supabase) {
        const all = readDemo();
        writeDemo([event, ...all]);
        setState({ loading: false, error: null });
        return;
      }

      const { error } = await supabase.from('automation_events').insert(event);
      if (error) throw error;
      setState({ loading: false, error: null });
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { create, ...state };
}
