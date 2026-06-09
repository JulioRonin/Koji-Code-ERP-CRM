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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DesignFileManager } from '@/components/design/DesignFileManager';
import { DesignChecklist } from '@/components/design/DesignChecklist';
import { cn } from '@/lib/utils';

const mockDesignTasks = [
  { id: 'DSG-001', project: 'IMC-2026-042', part: 'Eje Principal',  designer: 'Miguel A.',  status: 'Aprobado',    camStatus: 'Completado', dueDate: '2026-03-30' },
  { id: 'DSG-002', project: 'IMC-2026-045', part: 'Molde Base',     designer: 'Sofía L.',   status: 'En Revisión', camStatus: 'Pendiente',  dueDate: '2026-04-02' },
  { id: 'DSG-003', project: 'IMC-2026-048', part: 'Soporte A',       designer: 'Miguel A.',  status: 'Borrador',    camStatus: 'Pendiente',  dueDate: '2026-04-05' },
  { id: 'DSG-004', project: 'IMC-2026-050', part: 'Herramental 1',   designer: 'Roberto C.', status: 'Aprobado',    camStatus: 'En Proceso', dueDate: '2026-04-01' },
];

const cadVariant: Record<string, 'success' | 'warning' | 'secondary'> = {
  Aprobado: 'success',
  'En Revisión': 'warning',
  Borrador: 'secondary',
};

const camVariant: Record<string, 'success' | 'default' | 'outline'> = {
  Completado: 'success',
  'En Proceso': 'default',
  Pendiente: 'outline',
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
              { title: 'Diseños activos',  value: '14', sub: 'En fase de modelado',         icon: PenTool },
              { title: 'En revisión',      value: '5',  sub: 'Esperando aprobación cliente', icon: Clock },
              { title: 'Aprobados (mes)',  value: '28', sub: 'Listos para manufactura',     icon: FileCheck },
              { title: 'Programas CAM',    value: '8',  sub: 'En cola de programación',     icon: MonitorPlay },
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
                  <TableHead>ID diseño</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Diseñador</TableHead>
                  <TableHead>Estado CAD</TableHead>
                  <TableHead>Estado CAM</TableHead>
                  <TableHead>Fecha límite</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDesignTasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">{task.id}</TableCell>
                    <TableCell className="font-mono text-xs">{task.project}</TableCell>
                    <TableCell>{task.part}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{task.designer}</TableCell>
                    <TableCell>
                      <Badge variant={cadVariant[task.status] ?? 'secondary'}>{task.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={camVariant[task.camStatus] ?? 'outline'}>{task.camStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{task.dueDate}</TableCell>
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
                          <DropdownMenuItem>Aprobar diseño</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2">
                            <FileCode2 className="h-4 w-4" /> Asignar a CAM
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
