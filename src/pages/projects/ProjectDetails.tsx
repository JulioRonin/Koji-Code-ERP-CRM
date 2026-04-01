import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  Circle, 
  FileText,
  MessageSquare,
  BarChart3,
  Plus,
  Send,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GanttChart } from '@/components/projects/GanttChart';
import { ProjectReport } from '@/components/projects/ProjectReport';

// Mock data for the specific project
const getMockProject = (id: string) => ({
  id,
  name: 'Eje Principal Ensamblaje',
  client: 'BRP',
  status: 'En Producción',
  progress: 75,
  startDate: '2026-03-01',
  deadline: '2026-04-15',
  manager: 'Carlos M.',
  description: 'Fabricación de 500 ejes principales para el nuevo modelo de motor. Requiere maquinado CNC de alta precisión y tratamiento térmico.',
  tasks: [
    { id: 1, name: 'Revisión de planos', status: 'completed', date: '2026-03-02' },
    { id: 2, name: 'Compra de material (Acero 4140)', status: 'completed', date: '2026-03-05' },
    { id: 3, name: 'Programación CAM', status: 'completed', date: '2026-03-10' },
    { id: 4, name: 'Maquinado CNC (Fase 1)', status: 'in-progress', date: '2026-03-15' },
    { id: 5, name: 'Tratamiento Térmico', status: 'pending', date: '2026-03-25' },
    { id: 6, name: 'Inspección de Calidad Final', status: 'pending', date: '2026-04-05' },
  ],
  history: [
    { id: 1, user: 'Carlos M.', action: 'creó el proyecto', date: '2026-03-01T09:00:00Z', type: 'system' },
    { id: 2, user: 'Ana G.', action: 'aprobó los planos de diseño', date: '2026-03-02T14:30:00Z', type: 'system' },
    { id: 3, user: 'Luis R.', action: 'generó la orden de compra PO-2026-089', date: '2026-03-05T11:15:00Z', type: 'system' },
    { id: 4, user: 'Sistema', action: 'cambió el estado a "En Producción"', date: '2026-03-15T08:00:00Z', type: 'system' },
  ]
});

const GANTT_MOCK_DATA = [
  { id: 't1', name: 'Procura de Acero 4140', department: 'Compras' as const, startDay: 0, duration: 5, progress: 100, status: 'completed' as const },
  { id: 't2', name: 'Diseño CAD/CAM', department: 'Diseño' as const, startDay: 2, duration: 8, progress: 100, status: 'completed' as const },
  { id: 't3', name: 'Maquinado CNC Fase 1', department: 'Producción' as const, startDay: 10, duration: 12, progress: 65, status: 'in-progress' as const },
  { id: 't4', name: 'Tratamiento Térmico', department: 'Producción' as const, startDay: 22, duration: 4, progress: 0, status: 'pending' as const },
  { id: 't5', name: 'Inspección No Destructiva', department: 'Calidad' as const, startDay: 26, duration: 3, progress: 0, status: 'pending' as const },
  { id: 't6', name: 'Empaque y Logística', department: 'Producción' as const, startDay: 29, duration: 2, progress: 0, status: 'pending' as const },
];

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // In a real app, these would come from an API/Global State
  const initialProject = getMockProject(id || 'IMC-2026-042');
  const [status, setStatus] = useState(initialProject.status);
  const [history, setHistory] = useState(initialProject.history);
  const [newNote, setNewNote] = useState('');
  const [isMasterPlanOpen, setIsMasterPlanOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const noteEntry = {
      id: history.length + 1,
      user: 'Usuario Actual',
      action: `agregó una nota: "${newNote}"`,
      date: new Date().toISOString(),
      type: 'note'
    };
    
    setHistory([noteEntry, ...history]);
    setNewNote('');
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    const statusEntry = {
      id: history.length + 1,
      user: 'Usuario Actual',
      action: `cambió el estado a "${newStatus}"`,
      date: new Date().toISOString(),
      type: 'system'
    };
    setHistory([statusEntry, ...history]);
  };

  const statusColors: Record<string, string> = {
    'Cotización': 'warning',
    'Diseño': 'secondary',
    'En Producción': 'default',
    'Calidad': 'success',
    'Entregado': 'outline'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/projects')} className="border-[var(--color-neon-cyan-dim)] text-[var(--color-neon-cyan)]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-mono font-bold tracking-widest text-[var(--color-neon-cyan)] uppercase drop-shadow-[0_0_8px_var(--color-neon-cyan)]">{initialProject.name}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                    <Badge className="cursor-pointer hover:scale-105 transition-transform" variant={statusColors[status] as any}>
                      {status} <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-[var(--color-cyber-panel)] border-[var(--color-neon-cyan-dim)] text-[var(--color-text-main)] font-mono">
                  <DropdownMenuLabel className="text-[var(--color-text-muted)] text-[10px] uppercase">Cambiar Estado</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[var(--color-neon-cyan-dim)]/20" />
                  {Object.keys(statusColors).map((s) => (
                    <DropdownMenuItem 
                      key={s} 
                      onClick={() => handleStatusChange(s)}
                      className="hover:bg-[var(--color-neon-cyan-dim)]/20 cursor-pointer uppercase text-xs"
                    >
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm font-mono text-[var(--color-text-muted)] uppercase tracking-wider">{initialProject.id} • Cliente: {initialProject.client}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsMasterPlanOpen(true)}
            className="font-mono font-bold tracking-widest border-[var(--color-neon-purple)] text-[var(--color-neon-purple)] hover:bg-[var(--color-neon-purple)]/10 shadow-[0_0_5px_var(--color-neon-purple)]"
          >
            <BarChart3 className="mr-2 h-4 w-4" /> MASTER PLAN
          </Button>
          <Button 
            onClick={() => setIsReportOpen(true)}
            className="font-mono font-bold tracking-widest bg-[var(--color-neon-cyan)] text-black hover:bg-[var(--color-neon-cyan)]/80 shadow-[0_0_10px_var(--color-neon-cyan)]"
          >
            <Plus className="mr-2 h-4 w-4" /> GENERAR REPORTE
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Overview & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[var(--color-neon-cyan-dim)]/30">
            <CardHeader>
              <CardTitle className="text-[var(--color-neon-cyan)] uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Resumen del Proyecto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-mono font-medium text-[var(--color-text-muted)] flex items-center gap-2 uppercase tracking-wider">
                    <User className="h-4 w-4 text-[var(--color-neon-cyan)]" /> Manager
                  </p>
                  <p className="text-sm font-mono font-medium text-[var(--color-text-main)]">{initialProject.manager}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-mono font-medium text-[var(--color-text-muted)] flex items-center gap-2 uppercase tracking-wider">
                    <Calendar className="h-4 w-4 text-[var(--color-neon-cyan)]" /> Inicio
                  </p>
                  <p className="text-sm font-mono font-medium text-[var(--color-text-main)]">
                    28 feb 2026
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-mono font-medium text-[var(--color-text-muted)] flex items-center gap-2 uppercase tracking-wider">
                    <Clock className="h-4 w-4 text-[var(--color-neon-cyan)]" /> Entrega
                  </p>
                  <p className="text-sm font-mono font-medium text-[var(--color-text-main)]">
                    14 abr 2026
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-mono font-medium uppercase tracking-wider">
                  <span className="text-[var(--color-text-muted)]">Progreso General</span>
                  <span className="text-[var(--color-neon-cyan)] font-bold">{initialProject.progress}%</span>
                </div>
                <Progress value={initialProject.progress} className="h-2 bg-[var(--color-neon-cyan-dim)]/20 shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
              </div>

              <div className="space-y-2 p-4 rounded-lg bg-[var(--color-neon-cyan-dim)]/5 border border-[var(--color-neon-cyan-dim)]/20">
                <p className="text-sm font-mono font-medium text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Descripción
                </p>
                <p className="text-sm font-mono text-[var(--color-text-main)] leading-relaxed italic">
                  "{initialProject.description}"
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--color-neon-cyan-dim)]/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[var(--color-neon-cyan)] uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Plan de Trabajo (WBS)
                </CardTitle>
                <CardDescription className="font-mono text-[var(--color-text-muted)] text-[10px] uppercase">Tareas y fases del proyecto</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="border-[var(--color-neon-cyan-dim)] font-mono text-xs uppercase hover:bg-[var(--color-neon-cyan-dim)]/20">Añadir Tarea</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {initialProject.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-md border border-[var(--color-neon-cyan-dim)] bg-[var(--color-cyber-panel)] shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] group hover:border-[var(--color-neon-cyan)] transition-colors">
                    <div className="flex items-center gap-3">
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                      ) : task.status === 'in-progress' ? (
                        <div className="h-5 w-5 rounded-full border-2 border-[var(--color-neon-cyan)] border-t-transparent animate-spin shadow-[0_0_5px_var(--color-neon-cyan)]" />
                      ) : (
                        <Circle className="h-5 w-5 text-[var(--color-text-muted)]" />
                      )}
                      <div>
                        <p className={cn(
                          "text-sm font-mono font-medium uppercase tracking-wider",
                          task.status === 'completed' ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-main)] group-hover:text-[var(--color-neon-cyan)] transition-colors"
                        )}>
                          {task.name}
                        </p>
                        <p className="text-[10px] font-mono text-[var(--color-text-muted)]">
                          Programado: {format(new Date(task.date), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      task.status === 'completed' ? 'success' :
                      task.status === 'in-progress' ? 'default' : 'secondary'
                    } className="text-[10px] tracking-tighter">
                      {task.status === 'completed' ? 'Completado' :
                       task.status === 'in-progress' ? 'En Proceso' : 'Pendiente'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: History & Notes */}
        <div className="space-y-6">
          <Card className="border-[var(--color-neon-cyan-dim)]/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--color-neon-cyan)] uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> Actividad y Notas
              </CardTitle>
              <CardDescription className="font-mono text-[var(--color-text-muted)] text-[10px] uppercase">Historial de cambios y eventos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Note Form */}
              <div className="space-y-2">
                <Textarea 
                  placeholder="ESCRIBIR NOTA..." 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="bg-black/50 border-[var(--color-neon-cyan-dim)]/30 font-mono text-xs focus-visible:ring-[var(--color-neon-cyan)]"
                />
                <Button 
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="w-full font-mono text-xs font-bold tracking-widest bg-[var(--color-neon-cyan)] text-black"
                >
                  <Send className="mr-2 h-3 w-3" /> AGREGAR NOTA
                </Button>
              </div>

              <div className="relative border-l border-[var(--color-neon-cyan-dim)]/30 ml-3 space-y-6 pt-2">
                {history.map((item) => (
                  <div key={item.id} className="relative pl-6">
                    <span className={cn(
                      "absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-[var(--color-cyber-panel)] shadow-[0_0_5px_currentColor]",
                      item.type === 'note' ? "bg-[var(--color-neon-purple)] text-[var(--color-neon-purple)]" : "bg-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)]"
                    )} />
                    <div className="flex flex-col space-y-1">
                      <p className="text-[11px] font-mono text-[var(--color-text-main)] leading-tight">
                        <span className="font-bold text-[var(--color-neon-cyan)] uppercase">{item.user}</span> {item.action}
                      </p>
                      <p className="text-[9px] font-mono text-[var(--color-text-muted)] uppercase">
                        {format(new Date(item.date), "dd MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--color-neon-cyan-dim)]/30">
            <CardHeader>
              <CardTitle className="text-[var(--color-neon-cyan)] uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-5 w-5" /> Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-md border border-transparent hover:border-[var(--color-neon-cyan-dim)] hover:bg-[var(--color-neon-cyan-dim)]/10 cursor-pointer transition-all">
                <div className="p-2 bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] rounded-sm border border-[var(--color-neon-cyan)]">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-mono font-medium text-[var(--color-text-main)]">Planos_V2.pdf</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">2.4 MB • SUBIDO HACE 2 DÍAS</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-md border border-transparent hover:border-[var(--color-neon-cyan-dim)] hover:bg-[var(--color-neon-cyan-dim)]/10 cursor-pointer transition-all">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-sm border border-amber-500">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-mono font-medium text-[var(--color-text-main)]">Cotización.pdf</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">1.1 MB • SUBIDO HACE 1 SEMANA</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Master Plan Modal */}
      <Dialog open={isMasterPlanOpen} onOpenChange={setIsMasterPlanOpen}>
        <DialogContent className="max-w-5xl bg-[var(--color-cyber-panel)] border-[var(--color-neon-purple)]/50 text-white font-mono p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0 border-b border-[var(--color-neon-cyan-dim)]/20 bg-black/40">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-[0.2em] text-[var(--color-neon-purple)] drop-shadow-[0_0_10px_var(--color-neon-purple)] uppercase">
                  MASTER PLAN / GANTT VIEW
                </DialogTitle>
                <DialogDescription className="text-[var(--color-text-muted)] text-[10px] uppercase font-mono tracking-widest">
                  CRONOGRAMA INTEGRADO DE DEPARTAMENTOS • PROYECTO {initialProject.id}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="border-[var(--color-neon-cyan)] text-[var(--color-neon-cyan)] animate-pulse">
                REAL-TIME DATA
              </Badge>
            </div>
          </DialogHeader>
          <div className="p-6 bg-black/60 relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
            <GanttChart startDate={initialProject.startDate} tasks={GANTT_MOCK_DATA} />
          </div>
          <div className="p-4 bg-black/80 border-t border-[var(--color-neon-cyan-dim)]/10 flex justify-end">
            <Button variant="outline" onClick={() => setIsMasterPlanOpen(false)} className="border-[var(--color-neon-cyan-dim)] text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan-dim)]/20 uppercase text-xs tracking-widest">
              Cerrar Vista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Report Modal */}
      <ProjectReport 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
        project={{...initialProject, status}} 
        ganttTasks={GANTT_MOCK_DATA}
      />
    </div>
  );
}
