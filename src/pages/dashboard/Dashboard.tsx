import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp,
  TrendingDown,
  Factory,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useProjects, useWorkOrders, useNcrs, useInspections } from '@/lib/api';
import type { ProjectStatus } from '@/types/database';

const statusBadge: Partial<Record<ProjectStatus, { variant: 'default' | 'success' | 'warning' | 'secondary' | 'outline'; label: string }>> = {
  'En Producción': { variant: 'default',   label: 'En producción' },
  'Diseño':        { variant: 'secondary', label: 'Diseño' },
  'Compras':       { variant: 'secondary', label: 'Compras' },
  'Calidad':       { variant: 'success',   label: 'Calidad' },
  'Embarque':      { variant: 'success',   label: 'Embarque' },
  'Cotización':    { variant: 'warning',   label: 'Cotización' },
  'Entregado':     { variant: 'outline',   label: 'Entregado' },
  'Cancelado':     { variant: 'outline',   label: 'Cancelado' },
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: workOrders } = useWorkOrders();
  const { data: openNcrs } = useNcrs();
  const { data: inspections } = useInspections();

  // KPIs derivados de datos reales
  const kpis = useMemo(() => {
    const activeProjectsCount = projects.filter(
      p => p.status !== 'Entregado' && p.status !== 'Cancelado'
    ).length;

    const partsInProduction = workOrders
      .filter(w => w.status === 'En Proceso' || w.status === 'Setup')
      .reduce((acc, w) => acc + Number(w.quantity || 0), 0);

    const finishedRecently = inspections.filter(i => i.result === 'Aprobado').length;
    const totalChecked = inspections.length || 1;
    const otd = ((finishedRecently / totalChecked) * 100).toFixed(1);

    const openNcrCount = openNcrs.filter(n => n.status !== 'Cerrada').length;

    return [
      { label: 'Proyectos activos',      value: String(activeProjectsCount), delta: '', trend: 'up' as const,   sublabel: 'en pipeline',      icon: Factory },
      { label: 'Piezas en producción',   value: partsInProduction.toLocaleString(), delta: '', trend: 'up' as const, sublabel: 'cantidad WO activa', icon: Package },
      { label: 'Aprobación QA',          value: `${otd}%`,                   delta: '', trend: 'up' as const,   sublabel: 'inspecciones realizadas', icon: CheckCircle2 },
      { label: 'NCRs abiertas',          value: String(openNcrCount),        delta: '', trend: 'down' as const, sublabel: 'requieren acción',       icon: AlertTriangle },
    ];
  }, [projects, workOrders, inspections, openNcrs]);

  // Top 5 proyectos activos por deadline próximo
  const activeProjects = useMemo(() => {
    return [...projects]
      .filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado')
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5);
  }, [projects]);

  // Feed de actividad sintético (mientras no haya audit_logs cableado)
  const recentActivity = useMemo(() => {
    const out: { id: string; when: string; who: string; what: string; tone: 'success' | 'danger' | 'info' }[] = [];
    openNcrs.slice(0, 1).forEach(n => {
      out.push({
        id: `act-ncr-${n.id}`,
        when: formatRelativo(n.created_at),
        who: 'Calidad',
        what: `NCR ${n.severity.toLowerCase()} abierta · ${n.project_id} · ${n.issue_description.slice(0, 60)}...`,
        tone: 'danger',
      });
    });
    inspections.slice(0, 1).forEach(i => {
      out.push({
        id: `act-qa-${i.id}`,
        when: formatRelativo(i.inspection_date),
        who: 'Sistema',
        what: `Inspección ${i.result.toLowerCase()} · ${i.project_id}`,
        tone: i.result === 'Aprobado' ? 'success' : 'danger',
      });
    });
    workOrders.slice(0, 2).forEach(w => {
      out.push({
        id: `act-wo-${w.id}`,
        when: formatRelativo(w.updated_at),
        who: 'Producción',
        what: `Avance ${w.id} · ${w.completed_qty}/${w.quantity} pzas`,
        tone: 'info',
      });
    });
    return out.slice(0, 4);
  }, [openNcrs, inspections, workOrders]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Resumen operativo</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Estado en tiempo real de proyectos, producción y calidad.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/projects')}>
            Ver proyectos
          </Button>
          <Button onClick={() => navigate('/projects')}>
            Nuevo proyecto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className="p-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-app-text-muted)]">{kpi.label}</span>
                  <span className="text-2xl font-semibold text-[var(--color-app-text)]">{kpi.value}</span>
                </div>
                <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
                  <kpi.icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                {kpi.delta && (
                  <>
                    {kpi.trend === 'up' ? (
                      <TrendingUp className="h-3.5 w-3.5 text-[var(--color-app-success)]" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-[var(--color-app-danger)]" />
                    )}
                    <span
                      className={cn(
                        'font-medium',
                        kpi.trend === 'up' ? 'text-[var(--color-app-success)]' : 'text-[var(--color-app-danger)]'
                      )}
                    >
                      {kpi.delta}
                    </span>
                  </>
                )}
                <span className="text-[var(--color-app-text-muted)]">{kpi.sublabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active projects table */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Proyectos activos</CardTitle>
              <CardDescription>Pipeline actual de manufactura</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[180px]">Avance</TableHead>
                  <TableHead>Entrega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProjects.map(p => {
                  const badge = statusBadge[p.status] ?? { variant: 'secondary' as const, label: p.status };
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-[var(--color-app-text)]">{p.name}</span>
                          <span className="text-xs text-[var(--color-app-text-muted)] font-mono">{p.id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)]">{p.client_name}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} className="h-1.5 w-24" />
                          <span className="text-xs font-medium text-[var(--color-app-text-muted)] tabular-nums w-9 text-right">
                            {p.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)] text-sm">
                        {format(new Date(p.deadline), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Últimos eventos del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map(a => (
              <div key={a.id} className="flex gap-3">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full mt-1.5 shrink-0',
                    a.tone === 'success' && 'bg-[var(--color-app-success)]',
                    a.tone === 'danger' && 'bg-[var(--color-app-danger)]',
                    a.tone === 'info' && 'bg-[var(--color-app-primary)]'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-app-text)] leading-snug">{a.what}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-app-text-muted)]">
                    <Clock className="h-3 w-3" />
                    <span>{a.when}</span>
                    <span>·</span>
                    <span>{a.who}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatRelativo(iso: string): string {
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'justo ahora';
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 30) return `hace ${diffD} d`;
    return format(date, 'dd MMM', { locale: es });
  } catch {
    return iso;
  }
}
