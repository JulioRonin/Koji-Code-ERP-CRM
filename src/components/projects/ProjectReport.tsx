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
} from 'recharts';
import {
  Printer,
  TrendingUp,
  Users,
  Activity,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function ProjectReport({ isOpen, onClose, project, ganttTasks }: ProjectReportProps) {
  const deptPerformanceData = [
    { name: 'Compras',    complete: 100, pending: 0 },
    { name: 'Diseño',     complete: 100, pending: 0 },
    { name: 'Producción', complete: 65,  pending: 35 },
    { name: 'Calidad',    complete: 0,   pending: 100 },
  ];

  const progressTimelineData = [
    { date: '01 Mar', progress: 0 },
    { date: '10 Mar', progress: 15 },
    { date: '15 Mar', progress: 35 },
    { date: '20 Mar', progress: 55 },
    { date: '31 Mar', progress: 75 },
  ];

  const handlePrint = () => window.print();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[92vh] p-0 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="no-print px-5 py-3 border-b border-[var(--color-app-border)] flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-[var(--color-app-primary)] flex items-center justify-center text-white font-semibold text-sm">
              K
            </div>
            <span className="text-sm font-medium text-[var(--color-app-text)]">
              Reporte ejecutivo · {format(new Date(), 'dd MMM yyyy HH:mm', { locale: es })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir / PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </div>

        {/* Report */}
        <div id="report-content" className="flex-1 overflow-y-auto p-10 space-y-10 bg-white">
          {/* Letterhead */}
          <div className="flex justify-between items-start border-b border-[var(--color-app-border)] pb-6">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[var(--color-app-text-muted)]">Sistema integral de manufactura</p>
                <h1 className="text-3xl font-bold text-[var(--color-app-text)] mt-0.5">
                  Koji Code <span className="text-[var(--color-app-primary)]">ERP</span>
                </h1>
              </div>
              <div>
                <p className="text-xs text-[var(--color-app-text-muted)]">Reporte técnico de proyecto</p>
                <p className="text-lg font-semibold text-[var(--color-app-text)] mt-1">{project.name}</p>
                <p className="text-sm text-[var(--color-app-text-muted)]">
                  <span className="font-mono">{project.id}</span> · Cliente: {project.client}
                </p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <Badge variant="default">{project.status}</Badge>
              <p className="text-xs text-[var(--color-app-text-muted)]">
                Emitido: {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: es })}
              </p>
              <div className="pt-2">
                <p className="text-xs text-[var(--color-app-text-muted)]">Project Manager</p>
                <p className="text-sm font-medium">{project.manager}</p>
              </div>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, value: `${project.progress}%`,  label: 'Avance general' },
              { icon: Activity,    value: 'Operando',              label: 'Estado operativo' },
              { icon: Calendar,    value: '15 días',               label: 'Restantes para entrega' },
              { icon: Users,       value: '4 deptos.',             label: 'En sincronía' },
            ].map(k => (
              <Card key={k.label} className="p-5 flex flex-col items-center text-center gap-1.5">
                <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center mb-1">
                  <k.icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                </div>
                <p className="text-2xl font-semibold">{k.value}</p>
                <p className="text-xs text-[var(--color-app-text-muted)]">{k.label}</p>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-app-text)]">
                Desempeño por departamento
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptPerformanceData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }} />
                    <Bar dataKey="complete" fill="#0369a1" stackId="a" radius={[0, 4, 4, 0]} barSize={18} />
                    <Bar dataKey="pending" fill="#e2e8f0" stackId="a" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-app-text)]">
                Curva de progreso (S-Curve)
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }} />
                    <Line type="monotone" dataKey="progress" stroke="#0369a1" strokeWidth={2.5} dot={{ fill: '#0369a1', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Gantt */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--color-app-text)] border-b border-[var(--color-app-border)] pb-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Cronograma del proyecto
            </h3>
            <div className="p-4 bg-[var(--color-app-surface-alt)] rounded-md border border-[var(--color-app-border)]">
              <GanttChart startDate={project.startDate} tasks={ganttTasks} />
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-[var(--color-app-text-muted)]">Resumen ejecutivo</h3>
              <p className="text-sm leading-relaxed text-[var(--color-app-text)] border-l-2 border-[var(--color-app-primary)] pl-3">
                {project.description}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-[var(--color-app-text-muted)]">Estatus técnico</h3>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-success)]" />
                  Procura de material al 100%
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-success)]" />
                  Diseño y programación finalizada
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-primary)]" />
                  Maquinado CNC en proceso (fase 1 de 2)
                </li>
                <li className="flex items-center gap-2 text-[var(--color-app-text-muted)]">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-app-text-subtle)]" />
                  Tratamiento térmico pendiente
                </li>
              </ul>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-16 grid grid-cols-2 gap-16">
            <div className="border-t border-[var(--color-app-border-strong)] pt-3 flex flex-col items-center">
              <span className="text-xs text-[var(--color-app-text-muted)]">Responsable de proyecto</span>
              <span className="text-sm font-medium mt-1">{project.manager}</span>
            </div>
            <div className="border-t border-[var(--color-app-border-strong)] pt-3 flex flex-col items-center">
              <span className="text-xs text-[var(--color-app-text-muted)]">Control de calidad</span>
              <span className="text-sm font-medium mt-1">Sistema automatizado</span>
            </div>
          </div>

          <div className="text-center pt-6">
            <p className="text-xs text-[var(--color-app-text-subtle)]">
              Koji Code ERP · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
