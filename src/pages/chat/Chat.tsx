import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Send,
  Paperclip,
  Smile,
  Users,
  Search,
  Plus,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useChannels, useMessages, useSendMessage, useProfiles } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';

export function Chat() {
  const { user } = useAuth();
  const { data: channels } = useChannels();
  const { data: profiles } = useProfiles();
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [showUserList, setShowUserList] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Selecciona el primer canal cuando llegan
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // Pre-llenado desde URL (ej. el botón "Chat de la pieza" del portal
  // de técnicos manda ?prefill=...&channel=ch-produccion). Se consume
  // una sola vez y luego limpia el query string.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const preferredChannel = searchParams.get('channel');
    if (preferredChannel && channels.some(c => c.id === preferredChannel)) {
      setActiveChannelId(preferredChannel);
    }
    if (prefill) {
      setNewMessage(decodeURIComponent(prefill));
    }
    if (prefill || preferredChannel) {
      const next = new URLSearchParams(searchParams);
      next.delete('prefill');
      next.delete('channel');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.length]);

  const { data: currentMessages, refetch: refetchMessages } = useMessages(activeChannelId);
  const { send: sendMessage } = useSendMessage();

  const activeChannel = channels.find(c => c.id === activeChannelId);

  // Re-fetch en modo demo cuando otro tab/handler emite el evento
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.channel_id === activeChannelId) refetchMessages();
    };
    window.addEventListener('koji-chat-update', handler);
    return () => window.removeEventListener('koji-chat-update', handler);
  }, [activeChannelId, refetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, activeChannelId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannelId) return;
    await sendMessage({
      channel_id: activeChannelId,
      content: newMessage,
      user_id: user?.id ?? null,
    });
    setNewMessage('');
    await refetchMessages();
  };

  // Helpers para resolver nombre/avatar del mensaje
  const getSender = (userId: string | null) => {
    if (!userId) return { name: 'Sistema', avatar: 'KB', isSystem: true };
    const profile = profiles.find(p => p.id === userId);
    if (!profile) return { name: 'Usuario', avatar: 'UA', isSystem: false };
    return {
      name: profile.full_name,
      avatar: profile.full_name
        .split(' ')
        .map(p => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      isSystem: false,
    };
  };

  if (!activeChannel) {
    return (
      <div className="flex h-[calc(100vh-160px)] items-center justify-center text-sm text-[var(--color-app-text-muted)]">
        Cargando canales...
      </div>
    );
  }

  // Agrupa por categoría
  const channelsByCategory = channels.reduce<Record<string, typeof channels>>((acc, ch) => {
    const cat = ch.category ?? 'GENERAL';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ch);
    return acc;
  }, {});

  return (
    <div className="flex h-[calc(100vh-160px)] border border-[var(--color-app-border)] rounded-xl overflow-hidden bg-white">
      {/* Channel sidebar */}
      <div className="w-60 bg-[var(--color-app-surface-alt)] border-r border-[var(--color-app-border)] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--color-app-border)] bg-white">
          <h2 className="text-sm font-semibold text-[var(--color-app-text)]">Canales</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {Object.entries(channelsByCategory).map(([cat, list]) => (
            <div key={cat} className="space-y-1">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-medium text-[var(--color-app-text-muted)] uppercase tracking-wide">
                  {cat}
                </span>
                <button className="text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-text)] transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {list.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left',
                    activeChannelId === channel.id
                      ? 'bg-white text-[var(--color-app-text)] shadow-sm'
                      : 'text-[var(--color-app-text-muted)] hover:bg-white hover:text-[var(--color-app-text)]'
                  )}
                >
                  <Hash className="h-3.5 w-3.5" />
                  <span className="text-sm truncate">{channel.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[var(--color-app-border)] flex items-center gap-2 bg-white">
          <div className="h-8 w-8 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-xs font-medium">
            UA
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Usuario</p>
            <p className="text-xs text-[var(--color-app-success)]">En línea</p>
          </div>
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="h-12 border-b border-[var(--color-app-border)] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-[var(--color-app-text-muted)]" />
            <h3 className="text-sm font-semibold">{activeChannel.name}</h3>
            <span className="text-xs text-[var(--color-app-text-muted)] hidden md:block border-l border-[var(--color-app-border)] pl-2 ml-1">
              {activeChannel.description}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={cn(
                'h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors',
                showUserList
                  ? 'bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
                  : 'text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]'
              )}
              onClick={() => setShowUserList(!showUserList)}
            >
              <Users className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 bg-[var(--color-app-surface-alt)] px-2 py-1 rounded-md">
              <Search className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" />
              <input
                className="bg-transparent border-none outline-none text-xs w-28 placeholder:text-[var(--color-app-text-subtle)]"
                placeholder="Buscar..."
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <Hash className="h-10 w-10 text-[var(--color-app-text-subtle)]" />
              <p className="text-sm font-medium">Inicio del canal #{activeChannel.name}</p>
              <p className="text-xs text-[var(--color-app-text-muted)]">
                Comienza a escribir para comunicarte con tu equipo.
              </p>
            </div>
          ) : (
            currentMessages.map(msg => {
              const sender = getSender(msg.user_id);
              const isSystem = sender.isSystem || msg.message_type !== 'USER';
              return (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={cn(
                    'group flex gap-3 -mx-6 px-6 py-2 hover:bg-[var(--color-app-surface-alt)]/50 transition-colors',
                    isSystem && 'bg-[var(--color-app-info-soft)]/40'
                  )}
                >
                  <div
                    className={cn(
                      'h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-medium',
                      isSystem
                        ? 'bg-[var(--color-app-info)] text-white'
                        : 'bg-[var(--color-app-primary)] text-white'
                    )}
                  >
                    {isSystem ? <Bot className="h-4 w-4" /> : sender.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium flex items-center gap-1">
                        {sender.name}
                        {isSystem && <ShieldCheck className="h-3 w-3 text-[var(--color-app-info)]" />}
                      </span>
                      <span className="text-xs text-[var(--color-app-text-muted)]">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                      {msg.message_type !== 'USER' && <Badge variant="default">{msg.message_type}</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed mt-0.5 text-[var(--color-app-text)]">
                      {msg.content}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[var(--color-app-border)]">
          <form
            onSubmit={handleSendMessage}
            className="flex items-center bg-[var(--color-app-surface-alt)] rounded-md border border-[var(--color-app-border)] focus-within:border-[var(--color-app-primary)] focus-within:ring-2 focus-within:ring-[var(--color-app-primary)]/30 transition-colors"
          >
            <button type="button" className="p-2.5 text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]">
              <Plus className="h-4 w-4" />
            </button>
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder:text-[var(--color-app-text-subtle)]"
              placeholder={`Escribe en #${activeChannel.name}`}
            />
            <div className="flex items-center gap-1 px-2 text-[var(--color-app-text-muted)]">
              <button type="button" className="h-7 w-7 rounded-md inline-flex items-center justify-center hover:bg-white">
                <Paperclip className="h-4 w-4" />
              </button>
              <button type="button" className="h-7 w-7 rounded-md inline-flex items-center justify-center hover:bg-white">
                <Smile className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="h-7 w-7 rounded-md inline-flex items-center justify-center bg-[var(--color-app-primary)] text-white hover:bg-[var(--color-app-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Member list */}
      <AnimatePresence>
        {showUserList && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-[var(--color-app-surface-alt)] border-l border-[var(--color-app-border)] flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--color-app-border)] bg-white">
              <span className="text-xs font-medium text-[var(--color-app-text-muted)] uppercase tracking-wide">
                Miembros · {profiles.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              <div className="space-y-1">
                <span className="text-xs text-[var(--color-app-text-muted)] px-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-[var(--color-app-success)] rounded-full" /> En línea · 1
                </span>
                {user && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white transition-colors cursor-pointer">
                    <div className="h-7 w-7 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-xs font-medium">
                      {user.avatar || user.name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name} (tú)</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] truncate">{user.role}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs text-[var(--color-app-text-muted)] px-2">
                  Equipo · {profiles.length}
                </span>
                {profiles
                  .filter(p => p.id !== user?.id)
                  .map(member => {
                    const initials = member.full_name
                      .split(' ')
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white transition-colors cursor-pointer opacity-70 hover:opacity-100"
                      >
                        <div className="h-7 w-7 rounded-full bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] flex items-center justify-center text-xs font-medium text-[var(--color-app-text-muted)]">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm truncate">{member.full_name}</p>
                          <p className="text-xs text-[var(--color-app-text-muted)] truncate">{member.role}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
