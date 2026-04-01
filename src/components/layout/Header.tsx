import React from 'react';
import { User, Radio, LogOut, Settings, Shield, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="h-20 flex items-center justify-between px-8 border-b border-erp-purple/20 bg-erp-bg/80 backdrop-blur-sm shrink-0">
      <div className="flex flex-col">
        <h2 className="text-xl font-black text-erp-text-bright tracking-widest uppercase">Desktop Manufacturing Pipeline</h2>
        <div className="h-[1px] w-full bg-gradient-to-r from-erp-cyan/50 to-transparent"></div>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 text-[10px] font-mono font-bold tracking-[0.2em] text-erp-cyan">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>PRODUCTION_NOMINAL</span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-mono font-bold tracking-[0.2em] text-erp-text-bright bg-erp-panel/60 px-3 py-1.5 rounded border border-erp-border">
          <div className="w-1.5 h-1.5 rounded-full bg-erp-cyan shadow-[var(--shadow-glow-cyan)] animate-pulse"></div>
          <span>SYSTEM LIVE</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-10 h-10 rounded-full bg-erp-panel border border-erp-purple/50 flex items-center justify-center hover:border-erp-cyan transition-all shadow-[var(--shadow-glow-purple)] group relative overflow-hidden">
              <div className="absolute inset-0 bg-erp-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {user?.avatar ? (
                <span className="text-sm font-black text-erp-cyan">{user.avatar}</span>
              ) : (
                <User className="w-5 h-5 text-erp-purple group-hover:text-erp-cyan transition-colors" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-erp-sidebar border-erp-purple/30 text-erp-text font-mono shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <DropdownMenuLabel className="p-4 bg-erp-panel/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-erp-cyan/10 border border-erp-cyan flex items-center justify-center text-erp-cyan text-lg font-black italic">
                   {user?.avatar}
                </div>
                <div className="flex flex-col">
                  <p className="text-xs font-black text-white uppercase tracking-wider">{user?.name}</p>
                  <p className="text-[9px] text-erp-cyan font-bold uppercase tracking-tight">{user?.role}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-erp-purple/20" />
            
            <div className="p-1">
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-erp-cyan/10 focus:bg-erp-cyan/10 group rounded-md"
              >
                <UserCircle className="w-4 h-4 text-erp-purple group-hover:text-erp-cyan" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-erp-text group-hover:text-white">Perfil de Usuario</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-erp-cyan/10 focus:bg-erp-cyan/10 group rounded-md"
              >
                <Shield className="w-4 h-4 text-erp-purple group-hover:text-erp-cyan" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-erp-text group-hover:text-white">Seguridad</span>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className="bg-erp-purple/20" />
            
            <div className="p-1">
              <DropdownMenuItem 
                onClick={logout}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-erp-red-neon/10 focus:bg-erp-red-neon/10 group rounded-md"
              >
                <LogOut className="w-4 h-4 text-erp-red-neon animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-erp-red-neon">Desconectarse</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
