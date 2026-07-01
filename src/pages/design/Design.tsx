import React, { useState } from 'react';
import {
  PenTool,
  FileCheck,
  MonitorPlay,
  Clock,
  Search,
  Plus,
  MoreHorizontal,
  FileCode2,
  LayoutDashboard,
  Files,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DesignFileManager } from '@/components/design/DesignFileManager';
import { DesignChecklist } from '@/components/design/DesignChecklist';
import { useProjects } from '@/lib/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusVariant: Record<string, 'success' | 'warning' | 'secondary' | 'default' | 'outline'> = {
  'Cotización': 'warning',
  'Diseño': 'default',
  'Compras': 'secondary',
  'En Producción': 'default',
  'Calidad': 'success',
  'Embarque': 'success',
  'Entregado': 'outline',
  'Cancelado': 'outline',
};

const tabs = [
  { id: 'dashboard', label: 'Tareas',          icon: LayoutDashboard },
  { id: 'files',     label: 'Planos 2D / 3D',  icon: Files },
  { id: 'checklist', label: 'Checklist fab.',  icon: FileCheck },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Design() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: projects } = useProjects();

  // Diseños derivados de proyectos reales de la empresa (sin datos de ejemplo).
  const designTasks = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return projects
      .filter(p => p.status !== 'Entregado' && p.status !== 'Cancelado')
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      .map(p => ({
        id: p.id,
        project: p.id,
        part: p.name,
        designer: p.client_name ?? '—',
        status: p.status,
        dueDate: p.deadline,
      }));
  }, [projects, searchTerm]);

  const kpis = React.useMemo(() => {
    const activos = projects.filter(p => p.status === 'Diseño').length;
    const revision = projects.filter(p => p.status === 'Cotización').length;
    const aprobados = projects.filter(p => ['Compras', 'En Producción', 'Calidad', 'Embarque'].includes(p.status)).length;
    const entregados = projects.filter(p => p.status === 'Entregado').length;
    return { activos, revision, aprobados, entregados };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Diseño e Ingeniería</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Gestión de modelos CAD, revisiones y programación CAM.
          </p>
        </div>
        {activeTab === 'dashboard' && (
          <Button>
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo diseño
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
              activeTab === t.id
                ? 'bg-white text-[var(--color-app-text)] shadow-sm'
                : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'En diseño',        value: String(kpis.activos),    sub: 'Proyectos en fase de diseño',   icon: PenTool },
              { title: 'En cotización',    value: String(kpis.revision),   sub: 'Por definir / aprobar',         icon: Clock },
              { title: 'En manufactura',   value: String(kpis.aprobados),  sub: 'Compras, producción y calidad', icon: FileCheck },
              { title: 'Entregados',       value: String(kpis.entregados), sub: 'Proyectos cerrados',            icon: MonitorPlay },
            ].map(k => (
              <Card key={k.title} className="p-0">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[var(--color-app-text-muted)]">{k.title}</p>
                      <p className="text-2xl font-semibold mt-1">{k.value}</p>
                    </div>
                    <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
                      <k.icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-2">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
              <Input
                placeholder="Buscar diseños o proyectos..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Pieza / entregable</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha límite</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designTasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">{task.project}</TableCell>
                    <TableCell>{task.part}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{task.designer}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[task.status] ?? 'secondary'}>{task.status}</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem>Ver archivos CAD</DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <FileCode2 className="h-4 w-4" /> Planos 2D / 3D
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {designTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-[var(--color-app-text-muted)]">
                      Aún no hay diseños. Crea un proyecto para verlo aquí.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {activeTab === 'files' && <DesignFileManager />}
      {activeTab === 'checklist' && <DesignChecklist />}
    </div>
  );
}
