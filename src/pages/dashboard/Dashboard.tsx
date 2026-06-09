import React from 'react';
import { useNavigate } from 'react-router-dom';
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

// Mock data — en español, números realistas para una planta CNC
const kpis = [
  {
    label: 'Proyectos activos',
    value: '14',
    delta: '+2',
    trend: 'up' as const,
    sublabel: 'vs. mes anterior',
    icon: Factory,
  },
  {
    label: 'Piezas en producción',
    value: '3,482',
    delta: '+186',
    trend: 'up' as const,
    sublabel: 'esta semana',
    icon: Package,
  },
  {
    label: 'A tiempo (OTD)',
    value: '94.2%',
    delta: '−1.8%',
    trend: 'down' as const,
    sublabel: 'últimos 30 días',
    icon: CheckCircle2,
  },
  {
    label: 'NCRs abiertas',
    value: '3',
    delta: '+1',
    trend: 'down' as const,
    sublabel: 'requieren acción',
    icon: AlertTriangle,
  },
];

type ProjectRow = {
  id: string;
  name: string;
  client: string;
  status: 'En Producción' | 'Diseño' | 'Calidad' | 'Cotización' | 'Entregado';
  progress: number;
  deadline: string;
  pm: string;
};

const activeProjects: ProjectRow[] = [
  { id: 'IMC-2026-042', name: 'Eje Principal Ensamblaje', client: 'BRP', status: 'En Producción', progress: 75, deadline: '15 abr 2026', pm: 'Carlos M.' },
  { id: 'IMC-2026-045', name: 'Moldes de Inyección', client: 'Foxconn', status: 'Diseño', progress: 22, deadline: '20 abr 2026', pm: 'Ana G.' },
  { id: 'IMC-2026-039', name: 'Carcasas de Aluminio', client: 'Bosch', status: 'Calidad', progress: 95, deadline: '30 mar 2026', pm: 'Carlos M.' },
  { id: 'IMC-2026-048', name: 'Soportes Estructurales', client: 'Aptiv', status: 'Cotización', progress: 8, deadline: '05 may 2026', pm: 'Luis R.' },
  { id: 'IMC-2026-050', name: 'Herramentales Varios', client: 'Lear', status: 'Diseño', progress: 14, deadline: '10 may 2026', pm: 'Luis R.' },
];

const statusBadge: Record<ProjectRow['status'], { variant: 'default' | 'success' | 'warning' | 'secondary' | 'outline'; label: string }> = {
  'En Producción':  { variant: 'default',  label: 'En producción' },
  'Diseño':         { variant: 'secondary', label: 'Diseño' },
  'Calidad':        { variant: 'success',  label: 'Calidad' },
  'Cotización':     { variant: 'warning',  label: 'Cotización' },
  'Entregado':      { variant: 'outline',  label: 'Entregado' },
};

const recentActivity = [
  { id: 1, when: 'hace 12 min', who: 'Sistema', what: 'Inspección final aprobada · IMC-2026-039 · Carcasa Alum.', tone: 'success' as const },
  { id: 2, when: 'hace 1 h',     who: 'Marcos D.', what: 'NCR abierta · IMC-2026-048 · Soporte A (tolerancia +0.05mm)', tone: 'danger' as const },
  { id: 3, when: 'hace 2 h',     who: 'Compras',   what: 'PO-2026-129 emitida · Acero 4140 (20 barras)', tone: 'info' as const },
  { id: 4, when: 'hace 3 h',     who: 'Carlos M.', what: 'Avance reportado · WO-2026-089 · 325/500 piezas', tone: 'info' as const },
];

export function Dashboard() {
  const navigate = useNavigate();

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
                {activeProjects.map(p => (
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
                    <TableCell className="text-[var(--color-app-text-muted)]">{p.client}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[p.status].variant}>
                        {statusBadge[p.status].label}
                      </Badge>
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
                      {p.deadline}
                    </TableCell>
                  </TableRow>
                ))}
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
