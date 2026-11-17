import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { ChatChannel, ChatMessage, MessageType } from '@/types/database';
import type { AsyncState, MutationState } from './types';

const DEMO_CHANNELS_KEY = 'koji_demo_chat_channels';
const DEMO_MESSAGES_KEY = 'koji_demo_chat_messages';

const DEFAULT_CHANNELS: ChatChannel[] = [
  { id: 'ch-general',    name: 'general',     description: 'Canal principal de comunicación', category: 'ADMIN',         project_id: null, is_archived: false, created_at: new Date().toISOString() },
  { id: 'ch-anuncios',   name: 'anuncios',    description: 'Notificaciones críticas del sistema', category: 'ADMIN',     project_id: null, is_archived: false, created_at: new Date().toISOString() },
  { id: 'ch-ingenieria', name: 'ingeniería',  description: 'Discusión de diseños CAD y CAM',  category: 'DEPARTAMENTOS', project_id: null, is_archived: false, created_at: new Date().toISOString() },
  { id: 'ch-produccion', name: 'producción',  description: 'Coordinación de piso y máquinas',  category: 'DEPARTAMENTOS', project_id: null, is_archived: false, created_at: new Date().toISOString() },
  { id: 'ch-calidad',    name: 'calidad',     description: 'Revisiones dimensionales',         category: 'DEPARTAMENTOS', project_id: null, is_archived: false, created_at: new Date().toISOString() },
];

function readDemoChannels(): ChatChannel[] {
  try {
    const raw = localStorage.getItem(DEMO_CHANNELS_KEY);
    if (raw) return JSON.parse(raw) as ChatChannel[];
  } catch {
    /* ignore */
  }
  localStorage.setItem(DEMO_CHANNELS_KEY, JSON.stringify(DEFAULT_CHANNELS));
  return DEFAULT_CHANNELS;
}

function readDemoMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(DEMO_MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function writeDemoMessages(items: ChatMessage[]): void {
  try {
    localStorage.setItem(DEMO_MESSAGES_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

/**
 * Lista canales de chat (con realtime opcional).
 */
export function useChannels(scopeKey?: string | null): AsyncState<ChatChannel[]> {
  return useAsync<ChatChannel[]>(
    async () => {
      if (!supabase) return readDemoChannels();
      const { data, error } = await scopeByTenant(supabase
        .from('chat_channels')
        .select('*')
        .eq('is_archived', false))
        .order('name');
      if (error) throw error;
      return (data ?? []) as ChatChannel[];
    },
    [],
    // scopeKey (usuario/empresa) fuerza recargar al iniciar sesión o cambiar de empresa.
    [scopeKey ?? null]
  );
}

/**
 * Lista mensajes de un canal + se suscribe en realtime a inserts.
 */
export function useMessages(channelId: string | undefined): AsyncState<ChatMessage[]> {
  const base = useAsync<ChatMessage[]>(
    async () => {
      if (!channelId) return [];
      if (!supabase) {
        return readDemoMessages()
          .filter(m => m.channel_id === channelId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
    [],
    [channelId]
  );

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !channelId) return;
    const sub = supabase
      .channel(`messages-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        () => {
          base.refetch();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return base;
}

interface SendMessageInput {
  channel_id: string;
  content: string;
  user_id?: string | null;
  message_type?: MessageType;
}

export function useSendMessage() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const send = useCallback(async (input: SendMessageInput): Promise<ChatMessage> => {
    setState({ loading: true, error: null });
    try {
      const id = (crypto?.randomUUID && crypto.randomUUID()) || `msg-${Date.now()}`;
      const now = new Date().toISOString();
      const draft: ChatMessage = {
        id,
        channel_id: input.channel_id,
        user_id: input.user_id ?? null,
        content: input.content,
        message_type: input.message_type ?? 'USER',
        created_at: now,
      };

      if (!supabase) {
        const all = readDemoMessages();
        writeDemoMessages([...all, draft]);
        // Demo: dispara evento sintético para que las suscripciones in-memory se actualicen
        window.dispatchEvent(new CustomEvent('koji-chat-update', { detail: { channel_id: input.channel_id } }));
        setState({ loading: false, error: null });
        return draft;
      }

      const { data, error } = await supabase.from('chat_messages').insert(draft).select('*').single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as ChatMessage;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { send, ...state };
}

// ── Mensajes directos ──────────────────────────────────────────────────────

export const DM_CATEGORY = 'DIRECTO';

/** Nombre estable del canal directo entre dos usuarios. */
export function directChannelName(a: string, b: string): string {
  return 'dm:' + [a, b].sort().join(':');
}

/** ¿Es un canal directo del usuario? */
export function isMyDirectChannel(c: ChatChannel, userId: string | undefined | null): boolean {
  if (c.category !== DM_CATEGORY || !userId) return false;
  return (c.member_ids?.includes(userId) ?? false) || c.name.split(':').includes(userId);
}

/** El otro participante de un canal directo. */
export function otherMember(c: ChatChannel, userId: string): string | null {
  const ids = c.member_ids?.length ? c.member_ids : c.name.replace(/^dm:/, '').split(':');
  return ids.find(id => id !== userId) ?? null;
}

/**
 * Abre (o crea) el canal directo entre el usuario y otra persona. Es privado:
 * con db/2026_chat_direct.sql solo sus dos miembros lo ven.
 */
export function useEnsureDirectChannel() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const ensure = useCallback(async (me: string, other: string, existing: ChatChannel[]): Promise<ChatChannel> => {
    const name = directChannelName(me, other);
    const found = existing.find(c => c.name === name);
    if (found) return found;
    setState({ loading: true, error: null });
    try {
      const draft = {
        name,
        description: null,
        category: DM_CATEGORY,
        project_id: null,
        is_archived: false,
        member_ids: [me, other].sort(),
      };
      if (!supabase) {
        const ch: ChatChannel = { id: `dm-${Date.now()}`, created_at: new Date().toISOString(), ...draft };
        localStorage.setItem(DEMO_CHANNELS_KEY, JSON.stringify([...readDemoChannels(), ch]));
        setState({ loading: false, error: null });
        return ch;
      }
      let { data, error } = await supabase.from('chat_channels').insert(draft).select('*').single();
      // Sin la migración (falta member_ids): crea el canal igual (no privado).
      if (error && /member_ids/i.test(error.message)) {
        const { member_ids: _m, ...base } = draft;
        ({ data, error } = await supabase.from('chat_channels').insert(base).select('*').single());
      }
      // Ya existía (creado por la otra persona): lo buscamos.
      if (error && /duplicate|unique/i.test(error.message)) {
        ({ data, error } = await supabase.from('chat_channels').select('*').eq('name', name).maybeSingle());
      }
      if (error) throw error;
      if (!data) throw new Error('No se pudo abrir la conversación.');
      setState({ loading: false, error: null });
      return data as ChatChannel;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { ensure, ...state };
}
