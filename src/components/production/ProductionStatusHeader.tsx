import React, { useState } from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Target,
  Box,
  ChevronDown
} from 'lucide-react';
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function ProductionStatusHeader() {
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECTS[0].id);
  const project = PROJECTS.find(p => p.id === selectedProjectId);
  const bom = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  
  // Mocking status data for demonstration
  const totalParts = bom ? bom.items.length : 0;
  const assignedParts = Math.floor(totalParts * 0.8);
  const finishedParts = Math.floor(totalParts * 0.3);
  const progress = totalParts > 0 ? (finishedParts / totalParts) * 100 : 0;

  return (
    <div className="bg-cyber-panel/40 border border-cyber-border rounded-xl p-6 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
        
        {/* Project Selector */}
        <div className="space-y-3 w-full xl:w-1/3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-cyber-neon" />
            <span className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-widest">Monitoreo por Proyecto</span>
          </div>
          <div className="relative group">
            <select 
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-black/60 border border-cyber-neon/30 text-white font-cyber text-sm uppercase rounded-lg p-3 appearance-none focus:ring-1 focus:ring-cyber-neon outline-none cursor-pointer group-hover:border-cyber-neon/60 transition-all"
            >
              {PROJECTS.map(p => (
                <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyber-neon pointer-events-none transition-transform group-hover:translate-y-[-40%]" />
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 flex-1 w-full">
          <div className="space-y-1 bg-black/20 p-3 rounded-lg border border-white/5 hover:border-cyber-neon/20 transition-all">
            <p className="text-[9px] text-cyber-muted uppercase font-mono tracking-tighter flex items-center gap-1">
              <Box className="h-3 w-3" /> Total Piezas
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-cyber-text font-mono tracking-tighter">{totalParts}</span>
              <span className="text-[9px] text-cyber-muted font-mono uppercase">Items</span>
            </div>
          </div>

          <div className="space-y-1 bg-black/20 p-3 rounded-lg border border-white/5 hover:border-cyber-neon/20 transition-all">
            <p className="text-[9px] text-cyber-muted uppercase font-mono tracking-tighter flex items-center gap-1">
              <Clock className="h-3 w-3" /> Asignadas
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-cyber-accent font-mono tracking-tighter">{assignedParts}</span>
              <span className="text-[9px] text-cyber-muted font-mono uppercase">WIP</span>
            </div>
          </div>

          <div className="space-y-1 bg-black/20 p-3 rounded-lg border border-white/5 hover:border-cyber-neon/20 transition-all">
            <p className="text-[9px] text-cyber-muted uppercase font-mono tracking-tighter flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Terminadas
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-400 font-mono tracking-tighter">{finishedParts}</span>
              <span className="text-[9px] text-cyber-muted font-mono uppercase">Listo</span>
            </div>
          </div>

          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-white/5 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[9px] text-cyber-muted uppercase font-mono tracking-tighter">Progreso Global</p>
              <span className="text-xs font-bold text-cyber-neon font-cyber">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

      </div>
    </div>
  );
}
