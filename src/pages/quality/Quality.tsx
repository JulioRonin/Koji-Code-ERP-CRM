import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertOctagon, 
  FileSignature, 
  Ruler,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  FileUp,
  History,
  RotateCcw,
  Zap,
  LayoutDashboard,
  Calendar,
  User,
  Info,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';

type QualityStatus = 'PENDIENTE' | 'EN REVISIÓN' | 'APROBADO' | 'RECHAZADO (NCR)';

const mockInspections = [
  { id: 'QA-2026-055', project: 'IMC-2026-042', part: 'Eje Principal', type: 'Primera Pieza', inspector: 'Elena V.', date: '2026-03-29', result: 'Aprobado' },
  { id: 'QA-2026-056', project: 'IMC-2026-048', part: 'Soporte A', type: 'En Proceso', inspector: 'Marcos D.', date: '2026-03-29', result: 'Rechazado' },
  { id: 'QA-2026-057', project: 'IMC-2026-039', part: 'Carcasa Alum', type: 'Final', inspector: 'Elena V.', date: '2026-03-28', result: 'Aprobado' },
  { id: 'QA-2026-058', project: 'IMC-2026-045', part: 'Molde Base', type: 'Recibo Material', inspector: 'Marcos D.', date: '2026-03-28', result: 'Aprobado' },
];

const mockNCRs = [
  { id: 'NCR-2026-012', project: 'IMC-2026-048', issue: 'Tolerancia de diámetro exterior fuera de rango (+0.05mm)', severity: 'Alta', status: 'Abierta', date: '2026-03-29' },
  { id: 'NCR-2026-011', project: 'IMC-2026-035', issue: 'Acabado superficial rugoso en cara frontal', severity: 'Media', status: 'En Investigación', date: '2026-03-25' },
  { id: 'NCR-2026-010', project: 'IMC-2026-042', issue: 'Material recibido sin certificado de calidad', severity: 'Baja', status: 'Cerrada', date: '2026-03-20' },
];

const mockInstruments = [
  { id: 'INS-001', name: 'Vernier Digital 6"', brand: 'Mitutoyo', lastCal: '2026-01-15', nextCal: '2027-01-15', status: 'Calibrado' },
  { id: 'INS-002', name: 'Micrómetro 0-25mm', brand: 'Starrett', lastCal: '2025-06-12', nextCal: '2026-06-12', status: 'Calibrado' },
  { id: 'INS-003', name: 'CMM Bridge Type', brand: 'Zeiss', lastCal: '2025-04-01', nextCal: '2026-04-01', status: 'Vencido' },
];

export function Quality() {
  const { sendSystemMessage } = useChat();
  const [activeTab, setActiveTab] = useState<'project_control' | 'inspections' | 'ncrs' | 'instruments'>('project_control');
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECTS[0].id);
  const [partStatuses, setPartStatuses] = useState<Record<string, QualityStatus>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const selectedProject = PROJECTS.find(p => p.id === selectedProjectId);
  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  const handleStatusChange = (partId: string, status: QualityStatus) => {
    setPartStatuses(prev => ({ ...prev, [partId]: status }));
    
    if (status === 'RECHAZADO (NCR)') {
      const part = parts.find(p => p.id === partId);
      sendSystemMessage('5', `⚠️ ALERTA DE CALIDAD: La pieza [${part?.partNumber}] (${part?.description}) del proyecto ${selectedProjectId} ha sido RECHAZADA. Se requiere apertura de NCR.`, 'QUALITY');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-neon font-cyber uppercase tracking-widest">Aseguramiento de Calidad</h1>
          <p className="text-sm text-cyber-muted font-mono uppercase text-[10px] tracking-[0.2em]">Inspecciones, No Conformidades (NCR) y calibración ISO 9001.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-black/60 border-cyber-red text-cyber-red hover:bg-cyber-red/10 font-cyber text-xs">
            <AlertOctagon className="mr-2 h-4 w-4" /> REPORTAR NCR
          </Button>
          <Button className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber text-xs shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            <Plus className="mr-2 h-4 w-4" /> NUEVA INSPECCIÓN
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Tasa de Aprobación', val: '96.5%', icon: ShieldCheck, color: 'text-emerald-400', desc: 'Últimos 30 días' },
          { title: 'NCRs Abiertas', val: '2', icon: AlertOctagon, color: 'text-cyber-red', desc: 'Requieren acción correctiva' },
          { title: 'Inspecciones Hoy', val: '12', icon: FileSignature, color: 'text-cyber-neon', desc: '4 pendientes de firma' },
          { title: 'Calibraciones', val: '3', icon: Ruler, color: 'text-cyber-accent', desc: 'Semanas 12-14: Instrumentos' }
        ].map(kpi => (
          <Card key={kpi.title} className="bg-cyber-panel/40 border-cyber-border backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-bold text-cyber-muted font-mono uppercase tracking-widest">{kpi.title}</CardTitle>
              <kpi.icon className={cn("h-4 w-4", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold font-cyber", kpi.color)}>{kpi.val}</div>
              <p className="text-[9px] text-cyber-muted font-mono uppercase mt-1">{kpi.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-black/40 border border-cyber-border rounded-lg w-fit">
        {[
          { id: 'project_control', label: 'CONTROL PROYECTOS', icon: LayoutDashboard },
          { id: 'inspections', label: 'HISTORIAL INSPECCIONES', icon: FileSignature },
          { id: 'ncrs', label: 'NO CONFORMIDADES', icon: AlertOctagon },
          { id: 'instruments', label: 'INSTRUMENTOS', icon: Ruler }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase transition-all rounded-md tracking-widest",
              activeTab === tab.id 
                ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
                : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
            )}
          >
            <tab.icon className="h-3 w-3" /> {tab.label}
          </button>
        ))}
      </div>

      {/* --- Project Control Tab (MAIN) --- */}
      {activeTab === 'project_control' && (
        <div className="space-y-6">
          <Card className="bg-cyber-panel/40 border-cyber-border overflow-hidden">
             <div className="bg-cyber-neon/5 border-b border-cyber-border p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-[0.3em]">PROYECTO BAJO INSPECCIÓN</label>
                  <select 
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="block w-full md:w-72 bg-black/60 border border-cyber-neon/30 text-white font-mono text-sm uppercase rounded-md p-2 focus:ring-1 focus:ring-cyber-neon outline-none"
                  >
                    {PROJECTS.map(p => (
                      <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyber-neon/10 rounded border border-cyber-neon/20">
                        <ShieldCheck className="h-4 w-4 text-cyber-neon" />
                      </div>
                      <div>
                        <p className="text-[9px] text-cyber-muted uppercase font-mono tracking-tighter">Progreso QA</p>
                        <p className="text-xs font-bold text-cyber-text font-mono">65% COMPLETADO</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyber-red/10 rounded border border-cyber-red/20">
                        <AlertOctagon className="h-4 w-4 text-cyber-red" />
                      </div>
                      <div>
                        <p className="text-[9px] text-cyber-muted uppercase font-mono tracking-tighter">NCRs Activas</p>
                        <p className="text-xs font-bold text-cyber-red font-mono">01 PENDIENTE</p>
                      </div>
                   </div>
                </div>
             </div>
             <CardContent className="p-0">
               <Table>
                 <TableHeader className="bg-black/40">
                   <TableRow className="border-cyber-border hover:bg-transparent">
                     <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4 pl-6">ID / Referencia</TableHead>
                     <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Descripción de Parte</TableHead>
                     <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Fabricado por</TableHead>
                     <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Estatus Calidad</TableHead>
                     <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Documentación</TableHead>
                     <TableHead className="text-right text-cyber-muted font-mono text-[10px] uppercase py-4 pr-6">Acciones</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {parts.map(part => (
                     <TableRow key={part.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors">
                       <TableCell className="font-mono text-xs text-cyber-neon pl-6">{part.partNumber}</TableCell>
                       <TableCell className="text-cyber-text text-xs uppercase font-medium">{part.description}</TableCell>
                       <TableCell>
                          <div className="flex items-center gap-2">
                             <div className="w-5 h-5 rounded-full bg-cyber-accent/20 border border-cyber-accent/30 flex items-center justify-center text-[8px] text-cyber-accent font-bold">ST</div>
                             <span className="text-[10px] text-cyber-muted font-mono uppercase">Staff de Piso</span>
                          </div>
                       </TableCell>
                       <TableCell>
                          <select 
                            value={partStatuses[part.id] || 'PENDIENTE'}
                            onChange={(e) => handleStatusChange(part.id, e.target.value as QualityStatus)}
                            className={cn(
                              "bg-black/40 border text-[10px] font-mono px-2 py-1 rounded outline-none transition-all",
                              (partStatuses[part.id] || 'PENDIENTE') === 'APROBADO' ? "border-emerald-500 text-emerald-400" :
                              (partStatuses[part.id] || 'PENDIENTE') === 'RECHAZADO (NCR)' ? "border-cyber-red text-cyber-red" :
                              (partStatuses[part.id] || 'PENDIENTE') === 'EN REVISIÓN' ? "border-cyber-accent text-cyber-accent" :
                              "border-cyber-muted text-cyber-muted"
                            )}
                          >
                            <option value="PENDIENTE">PENDIENTE</option>
                            <option value="EN REVISIÓN">EN REVISIÓN</option>
                            <option value="APROBADO">APROBADO</option>
                            <option value="RECHAZADO (NCR)">RECHAZADO (NCR)</option>
                          </select>
                       </TableCell>
                       <TableCell>
                          <div className="flex gap-2">
                             <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] bg-cyber-neon/5 text-cyber-neon border border-cyber-neon/20 hover:bg-cyber-neon/20">
                                <FileUp className="h-3 w-3 mr-1" /> CERT. MAT
                             </Button>
                             <Button variant="ghost" size="sm" className="h-7 px-2 text-[8px] bg-cyber-accent/5 text-cyber-accent border border-cyber-accent/20 hover:bg-cyber-accent/20">
                                <FileUp className="h-3 w-3 mr-1" /> DIMENSIONAL
                             </Button>
                          </div>
                       </TableCell>
                       <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" className="h-8 text-cyber-muted hover:text-cyber-neon">
                             <ChevronRight className="h-4 w-4" />
                          </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </CardContent>
          </Card>
        </div>
      )}

      {/* --- Historical Inspections Tab --- */}
      {activeTab === 'inspections' && (
        <Card className="bg-cyber-panel/40 border-cyber-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyber-neon font-cyber text-sm uppercase tracking-widest">Historial de Reportes Generados</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
                <Input placeholder="FILTRAR POR ID O PIEZA..." className="pl-9 h-9 bg-black/40 border-cyber-border text-xs text-cyber-text font-mono" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-black/20">
                <TableRow className="border-cyber-border hover:bg-transparent">
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4 pl-6">QA-ID</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Proyecto / Pieza</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Inspector</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Fecha</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Resultado</TableHead>
                  <TableHead className="text-right text-cyber-muted font-mono text-[10px] uppercase py-4 pr-6">Archivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockInspections.map((insp) => (
                  <TableRow key={insp.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors">
                    <TableCell className="font-mono text-[10px] text-cyber-neon pl-6">{insp.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-cyber-text uppercase">{insp.part}</span>
                        <span className="text-[9px] text-cyber-muted font-mono">{insp.project}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-cyber-muted font-mono uppercase">{insp.inspector}</TableCell>
                    <TableCell className="text-[10px] text-cyber-muted font-mono">{insp.date}</TableCell>
                    <TableCell>
                      <Badge variant={insp.result === 'Aprobado' ? 'success' : 'destructive'} className="text-[8px] uppercase tracking-tighter">
                        {insp.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="h-8 text-cyber-muted hover:text-cyber-neon font-mono text-[10px] uppercase">
                        VER PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* --- NCR Management Tab --- */}
      {activeTab === 'ncrs' && (
        <Card className="bg-cyber-panel/40 border-cyber-border">
          <CardHeader>
            <CardTitle className="text-cyber-neon font-cyber text-sm uppercase tracking-widest">Control de No Conformidades (ISO 9001:2015)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-black/20">
                <TableRow className="border-cyber-border hover:bg-transparent">
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4 pl-6">NCR-ID</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Problema / Desviación</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Severidad</TableHead>
                  <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Estado</TableHead>
                  <TableHead className="text-right text-cyber-muted font-mono text-[10px] uppercase py-4 pr-6">Gestión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockNCRs.map((ncr) => (
                  <TableRow key={ncr.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors">
                    <TableCell className="font-mono text-[10px] text-cyber-red pl-6">{ncr.id}</TableCell>
                    <TableCell className="max-w-md">
                        <p className="text-xs font-bold text-cyber-text uppercase">{ncr.project} - DESVIACIÓN DETECTADA</p>
                        <p className="text-[10px] text-cyber-muted font-mono italic mt-1 leading-tight">{ncr.issue}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[8px] uppercase font-bold",
                        ncr.severity === 'Alta' ? "bg-cyber-red text-white" : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                      )}>
                        {ncr.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[8px] uppercase tracking-tighter border-cyber-muted text-cyber-muted">
                        {ncr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="h-8 text-cyber-muted hover:text-cyber-neon font-mono text-[10px] uppercase">
                        ANALIZAR RC
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* --- Instruments & Calibration Tab --- */}
      {activeTab === 'instruments' && (
        <Card className="bg-cyber-panel/40 border-cyber-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-cyber-neon font-cyber text-sm uppercase tracking-widest">Maestro de Instrumentos de Medición</CardTitle>
            <Button size="sm" className="bg-cyber-accent text-cyber-dark hover:bg-cyber-accent/80 font-cyber text-[10px] uppercase shadow-[0_0_10px_rgba(255,0,176,0.2)]">
              <Plus className="mr-2 h-3 w-3" /> Registrar Instrumento
            </Button>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader className="bg-black/20">
                  <TableRow className="border-cyber-border">
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4 pl-6">ID</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Instrumento</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Marca</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Última Calibración</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Siguiente Vencimiento</TableHead>
                    <TableHead className="text-right text-cyber-muted font-mono text-[10px] uppercase py-4 pr-6">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockInstruments.map((tool) => (
                    <TableRow key={tool.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors">
                      <TableCell className="font-mono text-[10px] text-cyber-accent pl-6">{tool.id}</TableCell>
                      <TableCell className="text-xs font-bold text-cyber-text uppercase">{tool.name}</TableCell>
                      <TableCell className="text-[10px] text-cyber-muted font-mono uppercase">{tool.brand}</TableCell>
                      <TableCell className="text-[10px] text-cyber-muted font-mono">{tool.lastCal}</TableCell>
                      <TableCell className={cn(
                        "text-[10px] font-mono font-bold",
                        tool.status === 'Vencido' ? "text-cyber-red" : "text-cyber-muted"
                      )}>
                        {tool.nextCal}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge variant={tool.status === 'Calibrado' ? 'success' : 'destructive'} className="text-[8px] uppercase tracking-tighter">
                           {tool.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

