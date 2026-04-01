import React, { useState, useRef, useEffect } from 'react';
import { 
  Hash, 
  Send, 
  Paperclip, 
  Smile, 
  Users, 
  Settings, 
  Mic, 
  Headphones, 
  Bell,
  Search,
  MoreVertical,
  Plus,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { STAFF_MEMBERS } from '@/data/crmData';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useChat, Message, Channel } from '@/contexts/ChatContext';
import { Bot } from 'lucide-react';

export function Chat() {
  const { messages, channels, sendMessage } = useChat();
  const [activeChannelId, setActiveChannelId] = useState('1');
  const [newMessage, setNewMessage] = useState('');
  const [showUserList, setShowUserList] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId)!;
  const currentMessages = messages[activeChannelId] || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, activeChannelId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessage(activeChannelId, newMessage);
    setNewMessage('');
  };

  return (
    <div className="flex h-[calc(100vh-120px)] border border-cyber-border rounded-lg overflow-hidden bg-cyber-dark/80 backdrop-blur-xl">
      {/* 1. Channel Sidebar (Left) */}
      <div className="w-64 bg-black/40 border-r border-cyber-border flex flex-col no-print">
        <div className="p-4 border-b border-cyber-border bg-cyber-neon/5 flex items-center justify-between">
          <h2 className="text-xs font-cyber font-bold text-cyber-neon tracking-widest uppercase italic">Ronin Studio</h2>
          <MoreVertical className="h-4 w-4 text-cyber-muted cursor-pointer hover:text-cyber-neon" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {['ADMIN', 'DEPARTAMENTOS', 'PROYECTOS'].map(cat => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-[9px] font-mono font-bold text-cyber-muted uppercase tracking-[0.2em]">{cat}</span>
                <Plus className="h-3 w-3 text-cyber-muted cursor-pointer hover:text-cyber-neon" />
              </div>
              {channels.filter(c => c.category === cat).map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group relative",
                    activeChannelId === channel.id 
                      ? "bg-cyber-neon/10 text-cyber-neon shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] border-l-2 border-cyber-neon" 
                      : "text-cyber-muted hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Hash className={cn("h-4 w-4", activeChannelId === channel.id ? "text-cyber-neon" : "text-cyber-muted")} />
                  <span className="text-xs font-mono font-medium truncate uppercase">{channel.name}</span>
                  {channel.unreadCount && channel.unreadCount > 0 && (
                    <span className="absolute right-2 h-2 w-2 bg-cyber-red rounded-full" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* User Status Bar */}
        <div className="p-3 bg-black/40 border-t border-cyber-border flex items-center gap-3">
           <div className="relative">
              <div className="h-8 w-8 rounded-full bg-cyber-neon text-cyber-dark flex items-center justify-center font-bold text-xs ring-2 ring-cyber-neon/30">UA</div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-black" />
           </div>
           <div className="flex-1">
              <p className="text-[10px] font-bold text-white font-mono uppercase tracking-widest leading-none">Usuario</p>
              <p className="text-[8px] text-cyber-muted font-mono uppercase mt-1">En Línea</p>
           </div>
           <div className="flex gap-1">
              <Mic className="h-4 w-4 text-cyber-muted hover:text-cyber-neon cursor-pointer" />
              <Headphones className="h-4 w-4 text-cyber-muted hover:text-cyber-neon cursor-pointer" />
              <Settings className="h-4 w-4 text-cyber-muted hover:text-cyber-neon cursor-pointer" />
           </div>
        </div>
      </div>

      {/* 2. Main Chat Area (Center) */}
      <div className="flex-1 flex flex-col relative bg-gradient-to-b from-black/20 to-black/40">
        {/* Chat Header */}
        <div className="h-12 border-b border-cyber-border px-4 flex items-center justify-between no-print backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-cyber-muted" />
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-widest">{activeChannel.name}</h3>
            <span className="text-[10px] text-cyber-muted font-mono hidden md:block border-l border-cyber-border pl-2 uppercase">{activeChannel.description}</span>
          </div>
          <div className="flex items-center gap-4 text-cyber-muted">
            <Bell className="h-4 w-4 hover:text-cyber-neon cursor-pointer" />
            <Users 
              className={cn("h-4 w-4 cursor-pointer transition-colors", showUserList ? "text-cyber-neon" : "hover:text-cyber-neon")} 
              onClick={() => setShowUserList(!showUserList)}
            />
            <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-cyber-border">
              <Search className="h-3 w-3" />
              <input className="bg-transparent border-none outline-none text-[10px] font-mono text-white w-24" placeholder="BUSCAR..." />
            </div>
            <Info className="h-4 w-4 hover:text-cyber-neon cursor-pointer" />
          </div>
        </div>

        {/* Message Log */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-cyber-neon/20"
        >
          {currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
               <Hash className="h-16 w-16 text-cyber-muted" />
               <div className="space-y-1">
                 <p className="text-cyber-neon font-mono text-sm uppercase tracking-widest">Este es el inicio del canal #{activeChannel.name}</p>
                 <p className="text-[10px] text-cyber-muted font-mono uppercase">Comienza a escribir para comunicarte con tu equipo.</p>
               </div>
            </div>
          ) : (
            currentMessages.map((msg, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id} 
                className={cn(
                  "group flex gap-4 hover:bg-white/5 -mx-6 px-6 py-1 transition-colors relative",
                  msg.isSystem && "bg-black/20 border-l-2",
                  msg.type === 'QUALITY' && "border-cyber-red",
                  msg.type === 'PROJECT' && "border-cyber-neon"
                )}
              >
                <div className={cn(
                  "h-10 w-10 shrink-0 rounded-full bg-black border flex items-center justify-center font-bold shadow-[0_0_10px_rgba(0,240,255,0.1)]",
                  msg.isSystem ? "border-cyber-red/50 text-cyber-red" : "border-cyber-neon/30 text-cyber-neon"
                )}>
                  {msg.isSystem ? <Bot className="h-5 w-5" /> : msg.senderAvatar}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-widest flex items-center gap-1",
                      msg.isSystem ? "text-cyber-red" : "text-cyber-neon"
                    )}>
                      {msg.senderName} 
                      {msg.isSystem && <ShieldCheck className="h-3 w-3" />}
                    </span>
                    <span className="text-[9px] text-cyber-muted font-mono">{msg.timestamp}</span>
                    {msg.isSystem && (
                      <Badge variant="outline" className="text-[7px] h-3 uppercase font-mono border-cyber-red text-cyber-red">ALERTA SISTEMA</Badge>
                    )}
                  </div>
                  <p className={cn(
                    "text-xs leading-relaxed font-mono",
                    msg.isSystem ? "text-white/90 italic" : "text-[var(--color-text-main)]"
                  )}>
                    {msg.content}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 no-print">
          <form 
            onSubmit={handleSendMessage}
            className="group relative flex items-center bg-black/60 border border-cyber-border rounded-lg ring-1 ring-cyber-neon/5 focus-within:border-cyber-neon focus-within:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all"
          >
            <div className="p-3">
              <Plus className="h-5 w-5 text-cyber-muted hover:bg-cyber-neon/10 hover:text-cyber-neon rounded-full transition-all cursor-pointer" />
            </div>
            <input 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs text-white p-3 font-mono placeholder:text-cyber-muted/50" 
              placeholder={`MENSAJE PARA #${activeChannel.name.toUpperCase()}`} 
            />
            <div className="flex items-center gap-3 px-4 text-cyber-muted">
              <Zap className="h-4 w-4 hover:text-amber-400 cursor-pointer" />
              <Paperclip className="h-4 w-4 hover:text-cyber-neon cursor-pointer" />
              <Smile className="h-4 w-4 hover:text-cyber-accent cursor-pointer" />
              <button type="submit" className="text-cyber-neon hover:scale-110 active:scale-95 transition-transform disabled:opacity-50">
                <Send className="h-4 w-4 shadow-[0_0_10px_rgba(0,240,255,1)]" />
              </button>
            </div>
            {/* Input Decorations */}
            <div className="absolute -left-[1px] top-1/2 -translate-y-1/2 h-4 w-[2px] bg-cyber-neon hidden group-focus-within:block" />
          </form>
        </div>
      </div>

      {/* 3. Member List (Right) */}
      <AnimatePresence>
        {showUserList && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="w-60 bg-black/40 border-l border-cyber-border flex flex-col no-print overflow-hidden"
          >
            <div className="p-4 border-b border-cyber-border h-12 flex items-center">
              <span className="text-[10px] font-mono font-bold text-cyber-muted uppercase tracking-[0.3em]">MIEMBROS — {STAFF_MEMBERS.length + 1}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-cyber-muted uppercase px-2 font-bold tracking-widest italic flex items-center gap-2">
                   <div className="h-1 w-1 bg-cyber-neon rounded-full animate-pulse" /> EN LÍNEA — 1
                </span>
                <div className="group flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer transition-colors">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-cyber-neon text-cyber-dark flex items-center justify-center font-bold text-xs">UA</div>
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-black" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-cyber-neon uppercase font-mono">Tú</span>
                    <span className="text-[8px] text-cyber-muted font-mono uppercase italic tracking-tighter">Administrador del Sistema</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[9px] font-mono text-cyber-muted uppercase px-2 font-bold tracking-widest italic">FUERA DE LÍNEA — {STAFF_MEMBERS.length}</span>
                {STAFF_MEMBERS.map(member => (
                  <div key={member.id} className="group flex items-center gap-2 px-2 py-1 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:bg-white/5 rounded cursor-pointer transition-all">
                    <div className="relative">
                      <div className="h-8 w-8 rounded-full bg-black border border-cyber-border flex items-center justify-center font-bold text-xs text-cyber-muted group-hover:text-cyber-neon group-hover:border-cyber-neon transition-colors">
                        {member.avatar}
                      </div>
                      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-gray-500 rounded-full border-2 border-black" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 group-hover:text-cyber-neon uppercase font-mono">{member.name}</span>
                      <span className="text-[8px] text-gray-500 font-mono uppercase truncate w-32">{member.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
