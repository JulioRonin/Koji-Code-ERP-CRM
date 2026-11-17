import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Bot, Hash, Lock, Search, Send, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  DM_CATEGORY, isMyDirectChannel, otherMember, useChannels, useEnsureDirectChannel, useMessages, useProfiles, useSendMessage,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from '@/contexts/PresenceContext';
import { initialsOf } from '@/components/layout/UserMenu';
import { tintFor } from '@/components/layout/OnlineUsers';
import type { ChatChannel } from '@/types/database';

const CATEGORY_LABEL: Record<string, string> = { ADMIN: 'General', DEPARTAMENTOS: 'Departamentos', PROYECTOS: 'Proyectos', GENERAL: 'Canales' };

function dayLabel(d: Date) {
  if (isToday(d)) return 'Hoy';
  if (isYesterday(d)) return 'Ayer';
  return format(d, "d 'de' MMMM", { locale: es });
}

/**
 * Chat del equipo (rediseño): canales por área y mensajes directos privados
 * con quien esté conectado. En celular se ve la lista o la conversación.
 */
export function Chat() {
  const { user } = useAuth();
  const { online, isOnline } = usePresence();
  const { data: channels, refetch: refetchChannels } = useChannels(user?.id);
  const { data: profiles } = useProfiles();
  const { ensure } = useEnsureDirectChannel();
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const me = user?.id ?? '';
  const publicChannels = useMemo(() => channels.filter(c => c.category !== DM_CATEGORY), [channels]);
  const myDirects = useMemo(() => channels.filter(c => isMyDirectChannel(c, me)), [channels, me]);

  // Personas del equipo (para DM): perfiles + conectados que no estén en la lista.
  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    for (const p of profiles) if (p.id !== me) map.set(p.id, { id: p.id, name: p.full_name, role: p.role });
    for (const u of online) if (!map.has(u.id)) map.set(u.id, u);
    return [...map.values()].sort((a, b) => Number(isOnline(b.id)) - Number(isOnline(a.id)) || a.name.localeCompare(b.name));
  }, [profiles, online, me, isOnline]);

  const nameOf = (id: string | null) => people.find(p => p.id === id)?.name ?? (id === me ? user?.name ?? 'Tú' : 'Usuario');

  // Primer canal por defecto
  useEffect(() => {
    if (publicChannels.length > 0 && !activeChannelId) setActiveChannelId(publicChannels[0].id);
  }, [publicChannels, activeChannelId]);

  const openDirect = async (personId: string) => {
    if (!me) return;
    setDmError(null);
    try {
      const ch = await ensure(me, personId, channels);
      await refetchChannels();
      setActiveChannelId(ch.id);
      setMobileView('chat');
    } catch (e) {
      setDmError((e as Error).message || 'No se pudo abrir la conversación.');
    }
  };

  // Parámetros: ?channel= (canal), ?prefill= (texto), ?dm=<usuario> (mensaje directo)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (channels.length === 0 && !searchParams.get('dm')) return;
    const prefill = searchParams.get('prefill');
    const preferred = searchParams.get('channel');
    const dm = searchParams.get('dm');
    if (preferred) {
      const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^ch-/, '');
      const target = channels.find(c => c.id === preferred) ?? channels.find(c => norm(c.name) === norm(preferred));
      if (target) { setActiveChannelId(target.id); setMobileView('chat'); }
    }
    if (dm) void openDirect(dm);
    if (prefill) setNewMessage(prefill);
    if (prefill || preferred || dm) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.length, searchParams]);

  const { data: messages, refetch: refetchMessages } = useMessages(activeChannelId);
  const { send } = useSendMessage();
  const active = channels.find(c => c.id === activeChannelId) ?? null;
  const isDirect = active?.category === DM_CATEGORY;
  const partnerId = active && isDirect ? otherMember(active, me) : null;
  const title = active ? (isDirect ? nameOf(partnerId) : `#${active.name}`) : '';

  // Demo: refresca al recibir el evento local
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail?.channel_id === activeChannelId) refetchMessages(); };
    window.addEventListener('koji-chat-update', h);
    return () => window.removeEventListener('koji-chat-update', h);
  }, [activeChannelId, refetchMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeChannelId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannelId) return;
    await send({ channel_id: activeChannelId, content: newMessage.trim(), user_id: user?.id ?? null });
    setNewMessage('');
    await refetchMessages();
  };

  const q = filter.trim().toLowerCase();
  const byCategory = publicChannels
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .reduce<Record<string, ChatChannel[]>>((acc, ch) => {
      const cat = ch.category ?? 'GENERAL';
      (acc[cat] ??= []).push(ch);
      return acc;
    }, {});
  const filteredPeople = people.filter(p => !q || p.name.toLowerCase().includes(q));

  const pick = (id: string) => { setActiveChannelId(id); setMobileView('chat'); };

  // ── Lista lateral ────────────────────────────────────────────────────────
  const sidebar = (
    <aside className={cn('w-full md:w-72 shrink-0 rounded-[28px] bg-white flex flex-col min-h-0', mobileView === 'chat' && 'hidden md:flex')}>
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Buscar canal o persona"
            className="w-full h-11 pl-11 pr-4 rounded-full bg-[var(--color-app-surface-alt)] text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-app-ink)]"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {Object.entries(byCategory).map(([cat, list]) => (
          <div key={cat}>
            <p className="px-2 pb-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-app-text-subtle)]">{CATEGORY_LABEL[cat] ?? cat}</p>
            {list.map(ch => (
              <button
                key={ch.id}
                onClick={() => pick(ch.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left text-[15px] transition-colors',
                  ch.id === activeChannelId ? 'bg-[var(--color-app-ink)] text-white' : 'hover:bg-[var(--color-app-surface-muted)]',
                )}
              >
                <Hash className="h-4 w-4 opacity-60" /> <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        ))}

        <div>
          <p className="px-2 pb-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-app-text-subtle)]">
            Mensajes directos · {online.length} en línea
          </p>
          {dmError && <p className="px-2 pb-2 text-xs text-[var(--color-app-danger)]">{dmError}</p>}
          {filteredPeople.length === 0 && <p className="px-2 text-sm text-[var(--color-app-text-muted)]">Sin personas.</p>}
          {filteredPeople.map(p => {
            const dm = myDirects.find(c => otherMember(c, me) === p.id);
            const on = !!dm && dm.id === activeChannelId;
            return (
              <button
                key={p.id}
                onClick={() => (dm ? pick(dm.id) : openDirect(p.id))}
                className={cn(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-left transition-colors',
                  on ? 'bg-[var(--color-app-ink)] text-white' : 'hover:bg-[var(--color-app-surface-muted)]',
                )}
              >
                <span className="relative h-9 w-9 rounded-full flex items-center justify-center text-xs text-[var(--color-app-text)] shrink-0" style={{ background: tintFor(p.id) }}>
                  {initialsOf(p.name)}
                  {isOnline(p.id) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#15803D] border-2 border-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm truncate">{p.name}</span>
                  <span className={cn('block text-xs truncate', on ? 'text-white/70' : 'text-[var(--color-app-text-muted)]')}>
                    {isOnline(p.id) ? 'En línea' : p.role}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 border-t border-[var(--color-app-border)] flex items-center gap-3">
        <span className="relative h-9 w-9 rounded-full bg-[#D7DCE6] flex items-center justify-center text-xs">
          {initialsOf(user?.name)}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#15803D] border-2 border-white" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm truncate">{user?.name ?? 'Tú'}</span>
          <span className="block text-xs text-[#146C35]">En línea</span>
        </span>
      </div>
    </aside>
  );

  // ── Conversación ─────────────────────────────────────────────────────────
  let lastDay = '';
  const conversation = (
    <section className={cn('flex-1 min-w-0 rounded-[28px] bg-white flex flex-col min-h-0', mobileView === 'list' && 'hidden md:flex')}>
      <header className="h-16 px-4 md:px-6 flex items-center gap-3 border-b border-[var(--color-app-border)] shrink-0">
        <button onClick={() => setMobileView('list')} className="md:hidden h-9 w-9 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center" aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </button>
        {isDirect ? (
          <span className="relative h-9 w-9 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: tintFor(partnerId ?? 'x') }}>
            {initialsOf(title)}
            {partnerId && isOnline(partnerId) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#15803D] border-2 border-white" />}
          </span>
        ) : (
          <span className="h-9 w-9 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center shrink-0"><Hash className="h-4 w-4" /></span>
        )}
        <div className="min-w-0">
          <p className="text-[17px] leading-tight truncate">{title}</p>
          <p className="text-xs text-[var(--color-app-text-muted)] truncate flex items-center gap-1">
            {isDirect ? (<><Lock className="h-3 w-3" /> Conversación privada{partnerId && isOnline(partnerId) ? ' · en línea' : ''}</>) : active?.description}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-1">
        {!active ? (
          <p className="h-full flex items-center justify-center text-sm text-[var(--color-app-text-muted)]">Cargando canales…</p>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <span className="h-14 w-14 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center">
              {isDirect ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
            </span>
            <p className="text-[15px]">{isDirect ? `Inicio de tu conversación con ${title}` : `Inicio del canal ${title}`}</p>
            <p className="text-sm text-[var(--color-app-text-muted)]">Escribe abajo para comenzar.</p>
          </div>
        ) : (
          messages.map(msg => {
            const mine = !!msg.user_id && msg.user_id === me;
            const system = !msg.user_id || msg.message_type !== 'USER';
            const d = new Date(msg.created_at);
            const day = dayLabel(d);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <React.Fragment key={msg.id}>
                {showDay && <p className="text-center text-xs text-[var(--color-app-text-subtle)] py-3">{day}</p>}
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-2.5 py-1', mine && 'flex-row-reverse')}>
                  {system ? (
                    <span className="h-8 w-8 rounded-full bg-[var(--color-app-ink)] text-white flex items-center justify-center shrink-0"><Bot className="h-4 w-4" /></span>
                  ) : !mine ? (
                    <span className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] shrink-0" style={{ background: tintFor(msg.user_id ?? 'x') }}>
                      {initialsOf(nameOf(msg.user_id))}
                    </span>
                  ) : null}
                  <div className={cn('max-w-[78%] min-w-0', mine && 'items-end text-right')}>
                    <p className="text-xs text-[var(--color-app-text-muted)] mb-1 flex items-center gap-1.5" style={{ justifyContent: mine ? 'flex-end' : undefined }}>
                      {system ? <>Sistema <ShieldCheck className="h-3 w-3" /> · {msg.message_type}</> : mine ? 'Tú' : nameOf(msg.user_id)}
                      <span>· {format(d, 'HH:mm')}</span>
                    </p>
                    <div className={cn(
                      'inline-block text-left rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words',
                      mine ? 'bg-[var(--color-app-ink)] text-white rounded-tr-md' : system ? 'bg-[var(--color-app-accent-soft)] rounded-tl-md' : 'bg-[var(--color-app-surface-muted)] rounded-tl-md',
                    )}>
                      {msg.content}
                    </div>
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="p-3 md:p-4 border-t border-[var(--color-app-border)] flex items-center gap-2 shrink-0">
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          disabled={!active}
          placeholder={active ? `Escribe a ${title}` : 'Selecciona un canal'}
          className="flex-1 min-w-0 h-12 px-5 rounded-full bg-[var(--color-app-surface-alt)] text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-app-ink)]"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="h-12 w-12 rounded-full bg-[var(--color-app-ink)] text-white flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Chat</h1>
          <p className="mt-3 text-base text-[var(--color-app-text-muted)]">
            Canales del equipo y mensajes directos · {online.length} persona{online.length === 1 ? '' : 's'} en línea
          </p>
        </div>
      </div>
      <div className="mt-6 flex gap-3 h-[calc(100dvh-300px)] min-h-[460px]">
        {sidebar}
        {conversation}
      </div>
    </div>
  );
}
