import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Factory,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Package,
  FileText,
  Calendar,
  Lock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useClientPortalData } from '@/lib/api';
import type { ProjectStatus } from '@/types/database';
import { cn } from '@/lib/utils';

const stageOrder: ProjectStatus[] = [
  'Cotización',
  'Diseño',
  'Compras',
  'En Producción',
  'Calidad',
  'Embarque',
  'Entregado',
];

const stageLabels: Record<ProjectStatus, string> = {
  Cotización:     'Cotización',
  Diseño:         'Diseño',
  Compras:        'Procura',
  'En Producción': 'Producción',
  Calidad:        'Control de calidad',
  Embarque:       'Embarque',
  Entregado:      'Entregado',
  Cancelado:      'Cancelado',
};

export function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const { data, loading } = useClientPortalData(token);

  const { project, parts, inspections, visibleFiles } = data;

  const currentStageIndex = useMemo(() => {
    if (!project) return -1;
    if (project.status === 'Cancelado') return -1;
    return stageOrder.indexOf(project.status);
  }, [project]);

  const inspectionsPassed = inspections.filter(i => i.result === 'Aprobado').length;
  const inspectionsTotal = inspections.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-app-bg)] flex items-center justify-center">
        <div className="text-sm text-[var(--color-app-text-muted)]">Cargando...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--color-app-bg)] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[var(--color-app-warning-soft)] flex items-center justify-center">
              <Lock className="h-5 w-5 text-[var(--color-app-warning)]" />
            </div>
            <h2 className="text-lg font-semibold">Enlace inválido o expirado</h2>
            <p className="text-sm text-[var(--color-app-text-muted)]">
              Este enlace de seguimiento ya no es válido. Contacta a tu representante
              para que te envíe uno nuevo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)]">
      {/* Brand bar */}
      <header className="bg-white border-b border-[var(--color-app-border)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[var(--color-app-primary)] flex items-center justify-center text-white font-semibold">
              K
            </div>
            <div>
              <p className="font-semibold text-sm">KANRI</p>
              <p className="text-xs text-[var(--color-app-text-muted)]">Portal de seguimiento</p>
            </div>
          </div>
          <div className="text-xs text-[var(--color-app-text-muted)] hidden sm:block">
            Acceso seguro · cliente
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Hero / proyecto */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[var(--color-app-text-muted)] uppercase tracking-wide">
                  Proyecto activo
                </p>
                <h1 className="text-2xl font-semibold mt-1">{project.name}</h1>
                <p className="text-sm text-[var(--color-app-text-muted)] mt-1 font-mono">{project.id}</p>
                {project.description && (
                  <p className="text-sm mt-3 max-w-xl leading-relaxed">{project.description}</p>
                )}
              </div>
              <div className="text-left md:text-right space-y-2 shrink-0">
                <Badge variant="default">{stageLabels[project.status]}</Badge>
                <div className="text-sm">
                  <p className="text-[var(--color-app-text-muted)] text-xs">Entrega estimada</p>
                  <p className="font-semibold">
                    {format(new Date(project.deadline), 'dd MMM yyyy', { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-app-text-muted)]">Avance global</span>
                <span className="font-semibold">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Timeline de etapas */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-[var(--color-app-text-muted)] uppercase tracking-wide mb-4">
              Línea de tiempo
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {stageOrder.map((stage, i) => {
                const isDone = i < currentStageIndex;
                const isCurrent = i === currentStageIndex;
                return (
                  <div
                    key={stage}
                    className={cn(
                      'p-3 rounded-md border text-center',
                      isDone && 'bg-[var(--color-app-success-soft)] border-[var(--color-app-success)]/30',
                      isCurrent && 'bg-[var(--color-app-primary-soft)] border-[var(--color-app-primary)]/30',
                      !isDone && !isCurrent && 'bg-white border-[var(--color-app-border)]'
                    )}
                  >
                    <div className="flex justify-center mb-1.5">
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-[var(--color-app-success)]" />
                      ) : isCurrent ? (
                        <Clock className="h-5 w-5 text-[var(--color-app-primary)]" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-[var(--color-app-border-strong)]" />
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-xs font-medium',
                        isDone && 'text-[var(--color-app-success)]',
                        isCurrent && 'text-[var(--color-app-primary)]',
                        !isDone && !isCurrent && 'text-[var(--color-app-text-muted)]'
                      )}
                    >
                      {stageLabels[stage]}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <PortalKpi icon={Factory}      label="Partes en el proyecto" value={String(parts.length)} />
          <PortalKpi icon={Package}      label="Inspecciones realizadas" value={String(inspectionsTotal)} />
          <PortalKpi icon={ShieldCheck}  label="Inspecciones aprobadas"  value={String(inspectionsPassed)} />
          <PortalKpi
            icon={Calendar}
            label="Días para entrega"
            value={String(
              Math.max(
                0,
                Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              )
            )}
          />
        </div>

        {/* Inspecciones recientes */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-[var(--color-app-text-muted)] uppercase tracking-wide mb-4">
              Inspecciones recientes
            </h2>
            {inspections.length === 0 ? (
              <p className="text-sm text-[var(--color-app-text-muted)]">
                Aún no hay inspecciones registradas.
              </p>
            ) : (
              <div className="space-y-2">
                {inspections.slice(0, 5).map(insp => (
                  <div
                    key={insp.id}
                    className="flex items-center justify-between p-3 border border-[var(--color-app-border)] rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium">{insp.inspection_type}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                        {format(new Date(insp.inspection_date), 'dd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                    <Badge variant={insp.result === 'Aprobado' ? 'success' : 'destructive'}>
                      {insp.result}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentos compartidos */}
        {visibleFiles.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-[var(--color-app-text-muted)] uppercase tracking-wide mb-4">
                Documentos compartidos
              </h2>
              <div className="space-y-2">
                {visibleFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 border border-[var(--color-app-border)] rounded-md"
                  >
                    <div className="h-9 w-9 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center">
                      <FileText className="h-4 w-4 text-[var(--color-app-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] capitalize">
                        {file.category.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-[var(--color-app-text-muted)] py-4">
          KANRI · {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}

function PortalKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
        </div>
      </CardContent>
    </Card>
  );
}
