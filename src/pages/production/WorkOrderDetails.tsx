import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Wrench,
  Factory,
  User,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useWorkOrders,
  useMachines,
  useTechnicians,
  useWorkOrderStages,
  useCreateWorkOrderStages,
  useStartStage,
  usePauseStage,
  useCompleteStage,
  DEFAULT_STAGE_TEMPLATES,
  ensureDefaultStagesForDemo,
} from '@/lib/api';
import type { WorkOrderStage, StageStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const stageBadge: Record<StageStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  Pendiente:    'secondary',
  'En Proceso': 'default',
  Pausado:      'warning',
  Completado:   'success',
  Saltado:      'outline',
};

function formatMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export function WorkOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: workOrders } = useWorkOrders();
  const { data: machines } = useMachines();
  const { data: technicians } = useTechnicians();

  const workOrder = workOrders.find(w => w.id === id);
  const machine = machines.find(m => m.id === workOrder?.machine_id);
  const technician = technicians.find(t => t.id === workOrder?.assigned_technician_id);

  const { data: stages, refetch: refetchStages, loading: loadingStages } = useWorkOrderStages(workOrder?.id);
  const { create: createStages, loading: creatingStages } = useCreateWorkOrderStages();
  const { start: startStage } = useStartStage();
  const { pause: pauseStage } = usePauseStage();
  const { complete: completeStage } = useCompleteStage();

  // Auto-genera etapas demo para WO sin etapas
  useEffect(() => {
    if (!workOrder) return;
    if (loadingStages) return;
    if (stages.length > 0) return;
    const seeded = ensureDefaultStagesForDemo(workOrder);
    if (seeded.length > 0) refetchStages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrder?.id, loadingStages]);

  const totalEstimated = useMemo(
    () => stages.reduce((acc, s) => acc + (s.estimated_minutes || 0), 0),
    [stages]
  );
  const totalActual = useMemo(
    () => stages.reduce((acc, s) => acc + (s.actual_minutes || 0), 0),
    [stages]
  );
  const completedCount = stages.filter(s => s.status === 'Completado').length;
  const overallProgress = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  const handleStart = async (stage: WorkOrderStage) => {
    await startStage({ stage_id: stage.id, operator_id: user?.id ?? null });
    await refetchStages();
  };

  const handlePause = async (stage: WorkOrderStage) => {
    await pauseStage({ stage_id: stage.id });
    await refetchStages();
  };

  const handleComplete = async (stage: WorkOrderStage) => {
    await completeStage({ stage_id: stage.id });
    await refetchStages();
  };

  const handleCreateDefaults = async () => {
    if (!workOrder) return;
    await createStages({
      work_order_id: workOrder.id,
      stages: DEFAULT_STAGE_TEMPLATES.map(t => ({ name: t.name, estimated_minutes: t.estimated_minutes })),
    });
    await refetchStages();
  };

  if (!workOrder) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-app-text-muted)]">Orden de trabajo no encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/production')}>
          ← Volver a producción
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/production')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--color-app-text)]">{workOrder.id}</h1>
              <Badge variant={workOrder.status === 'Completado' ? 'success' : 'default'}>
                {workOrder.status}
              </Badge>
            </div>
            <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
              Proyecto <span className="font-mono">{workOrder.project_id}</span> · {workOrder.quantity} pzas
            </p>
          </div>
        </div>
      </div>

      {/* KPIs WO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Factory}
          label="Máquina"
          value={machine ? machine.id : '—'}
          sub={machine?.type ?? ''}
        />
        <KpiCard
          icon={User}
          label="Técnico asignado"
          value={technician ? technician.full_name : '—'}
          sub={technician?.role ?? ''}
        />
        <KpiCard
          icon={Clock}
          label="Tiempo estimado / real"
          value={formatMinutes(totalEstimated)}
          sub={`Real: ${formatMinutes(totalActual)}`}
        />
        <KpiCard
          icon={ListChecks}
          label="Avance"
          value={`${overallProgress}%`}
          sub={`${completedCount} / ${stages.length} etapas`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Etapas / Operaciones
            </CardTitle>
            <CardDescription>
              Cada etapa registra tiempo real al iniciarla / pausarla.
            </CardDescription>
          </div>
          {stages.length === 0 && (
            <Button onClick={handleCreateDefaults} disabled={creatingStages}>
              Cargar plantilla CNC
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-app-text-muted)]">
              Esta orden aún no tiene etapas. Carga la plantilla CNC para empezar.
            </div>
          ) : (
            <div className="space-y-2">
              {stages.map(stage => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  onStart={() => handleStart(stage)}
                  onPause={() => handlePause(stage)}
                  onComplete={() => handleComplete(stage)}
                />
              ))}
            </div>
          )}

          {stages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-app-border)] flex items-center justify-between text-sm">
              <div className="space-y-1">
                <p className="text-[var(--color-app-text-muted)]">Avance global</p>
                <Progress value={overallProgress} className="h-1.5 w-64" />
              </div>
              <p className="font-medium tabular-nums">{overallProgress}%</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
            <p className="text-base font-semibold mt-1 truncate">{value}</p>
            {sub && <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5 truncate">{sub}</p>}
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function StageRow({
  stage,
  onStart,
  onPause,
  onComplete,
}: {
  stage: WorkOrderStage;
  onStart: () => void;
  onPause: () => void;
  onComplete: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 border border-[var(--color-app-border)] rounded-md',
        stage.status === 'En Proceso' && 'border-[var(--color-app-primary)]/40 bg-[var(--color-app-primary-soft)]/20',
        stage.status === 'Completado' && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-7 w-7 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center text-xs font-medium text-[var(--color-app-text-muted)]">
          {stage.sequence}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-sm">{stage.name}</p>
          <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
            Estimado: {formatMinutes(stage.estimated_minutes)} · Real: {formatMinutes(stage.actual_minutes)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={stageBadge[stage.status]}>{stage.status}</Badge>
        <div className="flex items-center gap-1">
          {(stage.status === 'Pendiente' || stage.status === 'Pausado') && (
            <Button size="icon" variant="outline" className="h-8 w-8" title="Iniciar" onClick={onStart}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          {stage.status === 'En Proceso' && (
            <>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Pausar" onClick={onPause}>
                <Pause className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" title="Completar" onClick={onComplete}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {stage.status === 'Pendiente' && stage.sequence > 1 && (
            <span className="text-xs text-[var(--color-app-text-muted)] ml-1">Esperando etapa previa</span>
          )}
        </div>
      </div>
    </div>
  );
}
