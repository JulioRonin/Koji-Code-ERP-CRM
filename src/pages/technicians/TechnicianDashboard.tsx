import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Play, 
  FileText, 
  Eye, 
  MessageSquare,
  AlertTriangle,
  History,
  User,
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

// Mock assigned parts
const INITIAL_ASSIGNED_PARTS = [
  { id: 'PART-001', project: 'IMC-2026-042', name: 'Eje Principal', qty: 2, status: 'PENDIENTE', priority: 'ALTA', deadline: '2026-04-05', customer: 'BRP' },
  { id: 'PART-002', project: 'IMC-2026-042', name: 'Buje de Bronce', qty: 10, status: 'EN PROCESO', priority: 'MEDIA', deadline: '2026-04-05', customer: 'BRP' },
  { id: 'PART-003', project: 'IMC-2026-048', name: 'Soporte Base', qty: 4, status: 'PENDIENTE', priority: 'BAJA', deadline: '2026-04-10', customer: 'Aptiv' },
];

export function TechnicianDashboard() {
  const { user, logout } = useAuth();
  const [parts, setParts] = useState(INITIAL_ASSIGNED_PARTS);

  const updateStatus = (id: string, newStatus: string) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  return (
    <div className="min-h-screen bg-cyber-dark text-white font-mono p-4 md:p-8">
      {/* Header Profile */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-black/40 border border-cyber-border p-6 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-cyber-neon/20 border border-cyber-neon flex items-center justify-center text-cyber-neon text-2xl font-black shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            {user?.avatar}
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-widest">{user?.name}</h1>
            <p className="text-[10px] text-cyber-neon font-bold uppercase tracking-[0.2em]">{user?.role} — {user?.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block mr-4">
            <p className="text-[10px] text-cyber-muted uppercase font-bold tracking-widest">Turno Actual</p>
            <p className="text-sm font-bold text-cyber-accent uppercase tracking-tighter">Matutino (07:00 - 16:00)</p>
          </div>
          <Button 
            variant="outline" 
            onClick={logout}
            className="border-cyber-red/50 text-cyber-red hover:bg-cyber-red/10 group"
          >
            <LogOut className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform" /> SALIR
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Statistics Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-black/60 border-cyber-border shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-cyber-muted uppercase tracking-[0.3em] flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-cyber-neon" /> RESUMEN DE HOY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-cyber-neon/5 border border-cyber-neon/20">
                <p className="text-[9px] text-cyber-muted uppercase font-bold">Piezas Asignadas</p>
                <p className="text-3xl font-black text-cyber-neon">{parts.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-cyber-accent/5 border border-cyber-accent/20">
                <p className="text-[9px] text-cyber-muted uppercase font-bold">En Proceso</p>
                <p className="text-3xl font-black text-cyber-accent">
                  {parts.filter(p => p.status === 'EN PROCESO').length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[9px] text-cyber-muted uppercase font-bold">Terminadas</p>
                <p className="text-3xl font-black text-emerald-400">
                  {parts.filter(p => p.status === 'TERMINADO').length}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="bg-cyber-red/5 border border-cyber-red/20 p-4 rounded-lg flex items-center gap-4 group cursor-pointer hover:bg-cyber-red/10 transition-all">
             <AlertTriangle className="h-8 w-8 text-cyber-red group-hover:scale-110 transition-transform" />
             <div>
                <p className="text-xs font-black text-cyber-red uppercase tracking-widest leading-none">Reportar Incidencia</p>
                <p className="text-[8px] text-cyber-muted uppercase mt-1">Paro de máquina o defecto</p>
             </div>
          </div>
        </div>

        {/* Main Worklist Column */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-sm font-black text-cyber-neon uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
             <div className="h-2 w-2 bg-cyber-neon animate-pulse rounded-full" /> MIS ÓRDENES DE FABRICACIÓN
          </h2>

          <div className="space-y-4">
            {parts.map((part) => (
              <motion.div 
                layout
                key={part.id}
                className={cn(
                  "bg-black/60 border border-cyber-border rounded-xl p-6 transition-all hover:border-cyber-neon/50 group relative overflow-hidden",
                  part.status === 'TERMINADO' && "opacity-60 grayscale-[0.8]"
                )}
              >
                {/* Priority Indicator */}
                <div className={cn(
                   "absolute top-0 right-0 px-6 py-1 text-[8px] font-black uppercase tracking-widest",
                   part.priority === 'ALTA' ? "bg-cyber-red text-white" : 
                   part.priority === 'MEDIA' ? "bg-amber-500 text-black" : "bg-cyber-muted text-white"
                )}>
                  PRIORIDAD {part.priority}
                </div>

                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Badge variant="outline" className="text-cyber-neon border-cyber-neon/30 text-[9px] font-mono">{part.project}</Badge>
                        <span className="text-[10px] text-cyber-muted font-bold tracking-widest uppercase">CLIENTE: {part.customer}</span>
                      </div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">{part.name} <span className="text-cyber-muted text-sm ml-2">x{part.qty} PZAS</span></h3>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <Button size="sm" className="bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/20 hover:bg-cyber-neon/20 h-8 text-[10px] font-bold uppercase tracking-widest">
                        <Eye className="w-3 h-3 mr-2" /> VER 2D/3D
                      </Button>
                      <Button size="sm" className="bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 h-8 text-[10px] font-bold uppercase tracking-widest">
                        <FileText className="w-3 h-3 mr-2" /> HOJA DE PROCESO
                      </Button>
                      <Button size="sm" className="bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 h-8 text-[10px] font-bold uppercase tracking-widest">
                        <MessageSquare className="w-3 h-3 mr-2" /> CHAT PROYECTO
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end gap-6 min-w-[200px]">
                    <div className="text-right">
                       <p className="text-[9px] text-cyber-muted uppercase font-bold tracking-widest">Estado Actual</p>
                       <Badge className={cn(
                         "mt-1 uppercase text-[10px] font-black italic tracking-widest px-3",
                         part.status === 'PENDIENTE' ? "bg-gray-500/20 text-gray-400" :
                         part.status === 'EN PROCESO' ? "bg-cyber-accent text-black animate-pulse" : "bg-emerald-500 text-black"
                       )}>
                         {part.status}
                       </Badge>
                       <p className="text-[9px] text-cyber-muted uppercase font-bold mt-2 font-mono">Entrega: {part.deadline}</p>
                    </div>

                    <div className="flex gap-2">
                       {part.status === 'PENDIENTE' && (
                         <Button 
                           onClick={() => updateStatus(part.id, 'EN PROCESO')}
                           className="bg-cyber-accent text-black hover:bg-cyber-accent/80 font-black text-[10px] uppercase tracking-widest"
                         >
                           <Play className="w-3 h-3 mr-2" /> INICIAR
                         </Button>
                       )}
                       {part.status === 'EN PROCESO' && (
                         <Button 
                           onClick={() => updateStatus(part.id, 'TERMINADO')}
                           className="bg-emerald-500 text-black hover:bg-emerald-500/80 font-black text-[10px] uppercase tracking-widest px-6 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                         >
                           <CheckCircle2 className="w-3 h-3 mr-2" /> TERMINAR
                         </Button>
                       )}
                       {part.status === 'TERMINADO' && (
                         <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase">
                            <CheckCircle2 className="h-4 w-4" /> TRABAJO COMPLETADO
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                {/* Inner Glow Decorative */}
                {part.status === 'EN PROCESO' && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyber-accent shadow-[0_0_15px_rgba(255,0,176,0.5)]" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
