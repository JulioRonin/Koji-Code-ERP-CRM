import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  FileText, 
  Printer, 
  Download, 
  TrendingUp, 
  Users, 
  Activity, 
  CheckCircle2, 
  Calendar, 
  User 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GanttChart } from './GanttChart';

interface ProjectReportProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    client: string;
    status: string;
    progress: number;
    startDate: string;
    deadline: string;
    manager: string;
    description: string;
    tasks: any[];
  };
  ganttTasks: any[];
}

const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];

export function ProjectReport({ isOpen, onClose, project, ganttTasks }: ProjectReportProps) {
  // Chart Data Preparation
  const deptPerformanceData = [
    { name: 'Compras', complete: 100, pending: 0 },
    { name: 'Diseño', complete: 100, pending: 0 },
    { name: 'Producción', complete: 65, pending: 35 },
    { name: 'Calidad', complete: 0, pending: 100 },
  ];

  const progressTimelineData = [
    { date: '01 Mar', progress: 0 },
    { date: '10 Mar', progress: 15 },
    { date: '15 Mar', progress: 35 },
    { date: '20 Mar', progress: 55 },
    { date: '31 Mar', progress: 75 },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] bg-[#020617] border-[var(--color-neon-cyan)]/30 text-white font-mono p-0 overflow-hidden flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            body * { visibility: hidden; }
            #report-content, #report-content * { visibility: visible; }
            #report-content { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
            .bg-\\[\\#020617\\] { background: white !important; color: black !important; }
            .text-white { color: black !important; }
            .border-white\\/5 { border-color: #eee !important; }
            .shadow-\\[0_0_50px_rgba\\(6\\,182\\,212\\,0\\.1\\)\\] { box-shadow: none !important; }
          }
        `}} />

        {/* Report Toolbar */}
        <div className="no-print p-4 bg-black/40 border-b border-[var(--color-neon-cyan-dim)]/20 flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-sm bg-[var(--color-neon-cyan)] flex items-center justify-center text-black font-bold text-xs uppercase shadow-[0_0_10px_var(--color-neon-cyan)]">
              K
            </div>
            <span className="font-bold tracking-[0.2em] uppercase text-sm">REPORTE GENERADO: {format(new Date(), 'HH:mm:ss')}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="border-[var(--color-neon-cyan-dim)] text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan)]/10 uppercase text-xs tracking-widest font-bold">
              <Printer className="mr-2 h-4 w-4" /> IMPRIMIR PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="border-white/10 text-white hover:bg-white/10 uppercase text-xs tracking-widest font-bold font-mono">
              Cerrar
            </Button>
          </div>
        </div>

        {/* Report Content */}
        <div id="report-content" className="flex-1 overflow-y-auto p-12 space-y-12 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
          {/* Header / Letterhead */}
          <div className="flex justify-between items-start border-b border-[var(--color-neon-cyan-dim)]/30 pb-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[var(--color-neon-cyan)] font-bold tracking-[0.3em] uppercase text-xs">SISTEMA INTEGRAL DE MANUFACTURA</p>
                <div className="flex flex-col">
                  <h1 className="text-4xl font-black tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] uppercase">KOJI CODE <span className="text-[var(--color-neon-cyan)]">ERP</span></h1>
                  <p className="text-[10px] font-mono text-[var(--color-neon-purple)] uppercase tracking-[0.5em] opacity-80 mt-1">by Ronin studio</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--color-text-muted)] uppercase">REPORTE TÉCNICO DE PROYECTO</p>
                <p className="text-xl font-bold uppercase tracking-widest">{project.name}</p>
                <p className="text-sm font-medium text-[var(--color-neon-cyan)] uppercase">ID: {project.id} • CLIENTE: {project.client}</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <Badge variant="outline" className="text-lg py-1 px-4 border-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)] uppercase">
                {project.status}
              </Badge>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">EMITIDO: {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: es })}</p>
              <div className="pt-4 flex flex-col items-end gap-1">
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-tighter">PROJECT MANAGER</span>
                <span className="text-sm font-bold uppercase">{project.manager}</span>
              </div>
            </div>
          </div>

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-black/40 border-[var(--color-neon-cyan-dim)]/20 p-6 flex flex-col items-center justify-center text-center space-y-2">
              <TrendingUp className="h-6 w-6 text-[var(--color-neon-cyan)]" />
              <p className="text-3xl font-black text-white">{project.progress}%</p>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Avance General</p>
            </Card>
            <Card className="bg-black/40 border-[var(--color-neon-cyan-dim)]/20 p-6 flex flex-col items-center justify-center text-center space-y-2">
              <Activity className="h-6 w-6 text-[var(--color-neon-purple)]" />
              <p className="text-3xl font-black text-white">NOMINAL</p>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Estado Operativo</p>
            </Card>
            <Card className="bg-black/40 border-[var(--color-neon-cyan-dim)]/20 p-6 flex flex-col items-center justify-center text-center space-y-2">
              <Calendar className="h-6 w-6 text-[var(--color-neon-blue)]" />
              <p className="text-3xl font-black text-white">15 DÍAS</p>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Restantes para Entrega</p>
            </Card>
            <Card className="bg-black/40 border-[var(--color-neon-cyan-dim)]/20 p-6 flex flex-col items-center justify-center text-center space-y-2">
              <Users className="h-6 w-6 text-emerald-400" />
              <p className="text-3xl font-black text-white">4 DEPTS.</p>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">En Sincronía</p>
            </Card>
          </div>

          {/* Content Body: Charts & Detailed Gantt */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Chart 1: Deparment Distribution */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-neon-cyan)] flex items-center gap-2">
                <BarChart className="h-4 w-4" /> Desempeño por Departamento
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptPerformanceData} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                    <XAxis type="number" stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Bar dataKey="complete" fill="var(--color-neon-cyan)" stackId="a" radius={[0, 2, 2, 0]} barSize={20} />
                    <Bar dataKey="pending" fill="rgba(255,255,255,0.1)" stackId="a" radius={[0, 2, 2, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Timeline Progress */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-neon-purple)] flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Curva de Progreso (S-Curve)
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" strokeOpacity={0.5} />
                    <XAxis dataKey="date" stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Line type="monotone" dataKey="progress" stroke="var(--color-neon-cyan)" strokeWidth={3} dot={{ fill: '#06b6d4', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Master Plan Integration */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-neon-cyan)] flex items-center gap-2 border-b border-[var(--color-neon-cyan-dim)]/20 pb-2">
              <CheckCircle2 className="h-4 w-4" /> Visualización de Cronograma (Gantt)
            </h3>
            <div className="p-6 bg-black/30 rounded border border-white/5">
              <GanttChart startDate={project.startDate} tasks={ganttTasks} />
            </div>
          </div>

          {/* Description & Notes Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest font-mono">Resumen Ejecutivo</h3>
              <p className="text-sm font-mono leading-relaxed text-gray-300 italic border-l-2 border-[var(--color-neon-cyan)] pl-4">
                "{project.description}"
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest font-mono">Estatus Técnico</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-xs uppercase font-mono">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  PROCURA DE MATERIAL AL 100%
                </li>
                <li className="flex items-center gap-3 text-xs uppercase font-mono">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  DISEÑO Y PROGRAMACIÓN FINALIZADA
                </li>
                <li className="flex items-center gap-3 text-xs uppercase font-mono">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-neon-cyan)] shadow-[0_0_5px_var(--color-neon-cyan)]" />
                  MAQUINADO CNC EN PROCESO (FASE 1 DE 2)
                </li>
                <li className="flex items-center gap-3 text-xs uppercase font-mono opacity-50">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                  TRATAMIENTO TÉRMICO PENDIENTE
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Signatures */}
          <div className="pt-24 grid grid-cols-2 gap-24 font-mono">
            <div className="border-t border-white/20 pt-4 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-widest">RESPONSABLE DE PROYECTO</span>
              <span className="text-sm font-black uppercase mt-2">{project.manager}</span>
            </div>
            <div className="border-t border-white/20 pt-4 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-widest">CONTROL DE CALIDAD</span>
              <span className="text-sm font-black uppercase mt-2">SISTEMA AUTOMATIZADO</span>
            </div>
          </div>
          
          <div className="pt-12 text-center">
            <p className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase tracking-[0.5em]">KOJI CODE ERP • by Ronin studio • 2026</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
