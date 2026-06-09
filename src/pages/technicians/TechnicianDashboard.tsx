import React, { useState } from 'react';
import {
  CheckCircle2,
  Play,
  FileText,
  Eye,
  MessageSquare,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

type PartStatus = 'PENDIENTE' | 'EN PROCESO' | 'TERMINADO';

const INITIAL_PARTS = [
  { id: 'PART-001', project: 'IMC-2026-042', name: 'Eje Principal', qty: 2, status: 'PENDIENTE' as PartStatus, priority: 'Alta', deadline: '2026-04-05', customer: 'BRP' },
  { id: 'PART-002', project: 'IMC-2026-042', name: 'Buje de Bronce', qty: 10, status: 'EN PROCESO' as PartStatus, priority: 'Media', deadline: '2026-04-05', customer: 'BRP' },
  { id: 'PART-003', project: 'IMC-2026-048', name: 'Soporte Base', qty: 4, status: 'PENDIENTE' as PartStatus, priority: 'Baja', deadline: '2026-04-10', customer: 'Aptiv' },
];

const priorityBadge: Record<string, 'destructive' | 'warning' | 'secondary'> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

const statusBadge: Record<PartStatus, 'secondary' | 'default' | 'success'> = {
  PENDIENTE: 'secondary',
  'EN PROCESO': 'default',
  TERMINADO: 'success',
};

export function TechnicianDashboard() {
  const { user, logout } = useAuth();
  const [parts, setParts] = useState(INITIAL_PARTS);

  const updateStatus = (id: string, newStatus: PartStatus) => {
    setParts(prev => prev.map(p => (p.id === id ? { ...p, status: newStatus } : p)));
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-app-text)] p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-lg font-semibold">
            {user?.avatar || user?.name?.[0] || 'T'}
          </div>
          <div>
            <h1 className="text-lg font-semibold">{user?.name}</h1>
            <p className="text-sm text-[var(--color-app-text-muted)]">
              {user?.role} · {user?.department}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-xs text-[var(--color-app-text-muted)]">Turno actual</p>
            <p className="text-sm font-medium">Matutino · 07:00 – 16:00</p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Salir
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-[var(--color-app-text-muted)]" /> Resumen de hoy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-[var(--color-app-surface-alt)]">
                <p className="text-xs text-[var(--color-app-text-muted)]">Piezas asignadas</p>
                <p className="text-2xl font-semibold mt-1">{parts.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-app-info-soft)]">
                <p className="text-xs text-[var(--color-app-info)]">En proceso</p>
                <p className="text-2xl font-semibold mt-1 text-[var(--color-app-info)]">
                  {parts.filter(p => p.status === 'EN PROCESO').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-app-success-soft)]">
                <p className="text-xs text-[var(--color-app-success)]">Terminadas</p>
                <p className="text-2xl font-semibold mt-1 text-[var(--color-app-success)]">
                  {parts.filter(p => p.status === 'TERMINADO').length}
                </p>
              </div>
            </CardContent>
          </Card>

          <button className="w-full text-left p-4 rounded-lg border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)] hover:bg-[var(--color-app-danger-soft)]/80 transition-colors flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[var(--color-app-danger)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-app-danger)]">Reportar incidencia</p>
              <p className="text-xs text-[var(--color-app-text-muted)]">Paro de máquina o defecto</p>
            </div>
          </button>
        </div>

        {/* Worklist */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-app-text-muted)] mb-2">
            Mis órdenes de fabricación
          </h2>

          {parts.map(part => (
            <motion.div
              layout
              key={part.id}
              className={cn(
                'bg-white border border-[var(--color-app-border)] rounded-xl p-5 transition-colors hover:border-[var(--color-app-primary)]/40',
                part.status === 'TERMINADO' && 'opacity-70'
              )}
            >
              <div className="flex flex-col md:flex-row justify-between gap-5">
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        {part.project}
                      </Badge>
                      <span className="text-xs text-[var(--color-app-text-muted)]">
                        Cliente: {part.customer}
                      </span>
                      <Badge variant={priorityBadge[part.priority]}>
                        {part.priority}
                      </Badge>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--color-app-text)]">
                      {part.name}
                      <span className="text-[var(--color-app-text-muted)] text-sm font-normal ml-2">
                        × {part.qty} pzas
                      </span>
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> Ver 2D/3D
                    </Button>
                    <Button size="sm" variant="outline">
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> Hoja de proceso
                    </Button>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Chat proyecto
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col justify-between items-end gap-4 min-w-[200px]">
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-app-text-muted)] mb-1">Estado</p>
                    <Badge variant={statusBadge[part.status]}>{part.status}</Badge>
                    <p className="text-xs text-[var(--color-app-text-muted)] mt-2">
                      Entrega: {part.deadline}
                    </p>
                  </div>

                  <div>
                    {part.status === 'PENDIENTE' && (
                      <Button onClick={() => updateStatus(part.id, 'EN PROCESO')}>
                        <Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar
                      </Button>
                    )}
                    {part.status === 'EN PROCESO' && (
                      <Button onClick={() => updateStatus(part.id, 'TERMINADO')}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Terminar
                      </Button>
                    )}
                    {part.status === 'TERMINADO' && (
                      <div className="inline-flex items-center gap-1.5 text-[var(--color-app-success)] text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Completado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
