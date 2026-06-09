import React, { createContext, useContext, ReactNode } from 'react';
import { useSendMessage, useChannels } from '@/lib/api';
import type { MessageType } from '@/types/database';

/**
 * ChatContext es un wrapper minimal sobre los hooks reales.
 * Solo expone `sendSystemMessage` para que el resto de los módulos puedan
 * publicar eventos automáticos al chat sin depender directo del hook.
 *
 * El chat real (renderizado de canales y mensajes) usa los hooks de
 * `@/lib/api` directamente.
 */

interface ChatContextType {
  sendSystemMessage: (
    channelHint: string,
    content: string,
    type?: MessageType
  ) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Mapeo legacy: el código viejo pasaba '1','2','3','4','5'. Los traducimos al
// nombre de canal correspondiente cuando exista.
const LEGACY_CHANNEL_MAP: Record<string, string> = {
  '1': 'general',
  '2': 'anuncios',
  '3': 'ingeniería',
  '4': 'producción',
  '5': 'calidad',
  '6': 'general',
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const { data: channels } = useChannels();
  const { send } = useSendMessage();

  const sendSystemMessage = async (channelHint: string, content: string, type: MessageType = 'SYSTEM') => {
    const targetName = LEGACY_CHANNEL_MAP[channelHint] ?? channelHint;
    const channel = channels.find(c => c.name === targetName) ?? channels.find(c => c.id === channelHint);
    if (!channel) return;
    try {
      await send({
        channel_id: channel.id,
        content,
        user_id: null,
        message_type: type,
      });
    } catch (err) {
      console.warn('sendSystemMessage failed', err);
    }
  };

  return (
    <ChatContext.Provider value={{ sendSystemMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Mantenemos los tipos legacy export para no romper imports existentes
export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
  type?: 'QUALITY' | 'PROJECT' | 'GENERAL';
};

export type Channel = {
  id: string;
  name: string;
  category: 'ADMIN' | 'DEPARTAMENTOS' | 'PROYECTOS';
  description?: string;
  unreadCount?: number;
};
