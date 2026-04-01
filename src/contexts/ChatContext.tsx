import React, { createContext, useContext, useState, ReactNode } from 'react';

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

interface ChatContextType {
  messages: Record<string, Message[]>;
  channels: Channel[];
  sendMessage: (channelId: string, content: string) => void;
  sendSystemMessage: (channelId: string, content: string, type?: 'QUALITY' | 'PROJECT') => void;
}

const CHANNELS: Channel[] = [
  { id: '1', name: 'general', category: 'ADMIN', description: 'Canal general de la empresa.' },
  { id: '2', name: 'anuncios', category: 'ADMIN', description: 'Comunicados oficiales de Ronin Studio.' },
  { id: '3', name: 'ingeniería', category: 'DEPARTAMENTOS', description: 'Discusión de diseños CAD y CAM.' },
  { id: '4', name: 'producción', category: 'DEPARTAMENTOS', description: 'Coordinación de piso y máquinas.' },
  { id: '5', name: 'calidad', category: 'DEPARTAMENTOS', description: 'Revisiones dimensionales y reportes.' },
  { id: '6', name: 'IMC-2026-042', category: 'PROYECTOS', description: 'Seguimiento: Eje Principal Ensamblaje.' },
  { id: '7', name: 'IMC-2026-048', category: 'PROYECTOS', description: 'Seguimiento: Soportes Estructurales.' },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'm1', senderId: 'STF-001', senderName: 'Roberto Gomez', senderAvatar: 'RG', content: '¿Alguien sabe si ya llegaron los insertos para el torno suizo?', timestamp: '10:45 AM' },
    { id: 'm2', senderId: 'STF-002', senderName: 'Ana Martinez', senderAvatar: 'AM', content: 'Sí Roberto, llegaron hace una hora. Están en el almacén de herramientas.', timestamp: '10:48 AM' },
  ],
  '3': [
    { id: 'm3', senderId: 'STF-001', senderName: 'Roberto Gomez', senderAvatar: 'RG', content: 'Acabo de subir el modelo actualizado para el proyecto IMC-2026-042 a la carpeta de diseño.', timestamp: '09:12 AM' },
    { id: 'm4', senderId: 'STF-003', senderName: 'Julian Herrera', senderAvatar: 'JH', content: 'Perfecto, voy a revisar las tolerancias geométricas ahora mismo.', timestamp: '09:30 AM' },
  ],
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);

  const sendMessage = (channelId: string, content: string) => {
    const msg: Message = {
      id: Date.now().toString(),
      senderId: 'ME',
      senderName: 'Usuario Actual',
      senderAvatar: 'UA',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), msg]
    }));
  };

  const sendSystemMessage = (channelId: string, content: string, type: 'QUALITY' | 'PROJECT' = 'QUALITY') => {
    const msg: Message = {
      id: `sys-${Date.now()}`,
      senderId: 'SYSTEM',
      senderName: 'KOJI-BOT',
      senderAvatar: 'KB',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true,
      type
    };
    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), msg]
    }));
  };

  return (
    <ChatContext.Provider value={{ messages, channels: CHANNELS, sendMessage, sendSystemMessage }}>
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
