import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useProfiles } from '@/lib/api';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

/**
 * Presencia: quién de la empresa está conectado ahora mismo. Usa Supabase
 * Realtime Presence en un canal por empresa; cada sesión anuncia su id,
 * nombre y rol. En modo demo simula a parte del equipo en línea.
 */
export interface OnlineUser {
  id: string;
  name: string;
  role: string;
}

interface PresenceValue {
  /** Conectados (sin incluirte a ti). */
  online: OnlineUser[];
  isOnline: (id: string) => boolean;
}

const PresenceContext = createContext<PresenceValue>({ online: [], isOnline: () => false });

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: profiles } = useProfiles();
  const [live, setLive] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const db = supabase;
    const channel = db.channel(`presence-${tenant.id}`, { config: { presence: { key: user.id } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlineUser>();
        const list: OnlineUser[] = [];
        for (const [key, metas] of Object.entries(state)) {
          const m = metas[0];
          if (key !== user.id && m) list.push({ id: key, name: m.name, role: m.role });
        }
        setLive(list);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: user.id, name: user.name, role: user.role });
        }
      });
    return () => { void db.removeChannel(channel); };
  }, [user?.id, user?.name, user?.role, tenant.id]);

  // Demo: parte del equipo "en línea" para poder probar el chat directo.
  const demo = useMemo<OnlineUser[]>(() => {
    if (supabase) return [];
    return profiles
      .filter(p => p.id !== user?.id && p.status === 'Activo')
      .slice(0, 5)
      .map(p => ({ id: p.id, name: p.full_name, role: p.role }));
  }, [profiles, user?.id]);

  const online = supabase ? live : demo;
  const value = useMemo<PresenceValue>(() => ({
    online,
    isOnline: (id: string) => online.some(u => u.id === id),
  }), [online]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceValue {
  return useContext(PresenceContext);
}
