import React, { useState } from 'react';
import {
  Settings,
  PlayCircle,
  AlertTriangle,
  Search,
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Plus,
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
import { ProductionStatusHeader } from '@/components/production/ProductionStatusHeader';
import { ProductionProjectView } from '@/components/production/ProductionProjectView';
import { cn } from '@/lib/utils';

const mockMachines = [
  { id: 'CNC-001', type: 'Centro de Maquinado 3 ejes', status: 'Operando', currentJob: 'Eje Principal (OP1)', operator: 'Juan P.', progress: 65, efficiency: 92 },
  { id: 'CNC-002', type: 'Torno CNC',                  status: 'Setup',     currentJob: 'Bujes Bronce',     operator: 'Raúl M.',  progress: 0,  efficiency: 78 },
  { id: 'CNC-003', type: 'Centro de Maquinado 5 ejes', status: 'Mantenimiento', currentJob: '—',            operator: '—',         progress: 0,  efficiency: 0 },
  { id: 'CNC-004', type: 'Torno Suizo',                status: 'Operando',  currentJob: 'Pernos Especiales', operator: 'Diego T.', progress: 88, efficiency: 95 },
];

const mockWorkOrders = [
  { id: 'WO-2026-089', project: 'IMC-2026-042', part: 'Eje Principal', qty: 500, completed: 325, machine: 'CNC-001', status: 'En Proceso' },
  { id: 'WO-2026-090', project: 'IMC-2026-045', part: 'Bujes Bronce',  qty: 1200, completed: 0,    machine: 'CNC-002', status: 'Setup' },
  { id: 'WO-2026-091', project: 'IMC-2026-039', part: 'Carcasa Alum.', qty: 50,   completed: 50,   machine: 'CNC-003', status: 'Completado' },
  { id: 'WO-2026-092', project: 'IMC-2026-048', part: 'Pernos',        qty: 5000, completed: 4400, machine: 'CNC-004', status: 'En Proceso' },
];

const machineLeftColor: Record<string, string> = {
  Operando: 'border-l-[var(--color-app-success)]',
  Setup: 'border-l-[var(--color-app-warning)]',
  Mantenimiento: 'border-l-[var(--color-app-danger)]',
};

const statusBadgeVariant: Record<string, 'success' | 'default' | 'warning'> = {
  Completado: 'success',
  'En Proceso': 'default',
  Setup: 'warning',
};

const tabs = [
  { id: 'floor',    label: 'Piso de fábrica',     icon: LayoutDashboard },
  { id: 'planning', label: 'Planificación',        icon: ClipboardList },
  { id: 'status',   label: 'Estatus de proyectos', icon: BarChart3 },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Production() {
  const [activeTab, setActiveTab] = useState<Tab>('floor');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Producción</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Monitoreo de piso, máquinas y órdenes de trabajo.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva orden de trabajo
        </Button>
      </div>

      <ProductionStatusHeader />

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

      {activeTab === 'floor' && (
        <>
          {/* Machine cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {mockMachines.map(m => (
              <Card
                key={m.id}
                className={cn('border-l-4 p-0', machineLeftColor[m.status])}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{m.id}</CardTitle>
                  {m.status === 'Operando' && <PlayCircle className="h-4 w-4 text-[var(--color-app-success)]" />}
                  {m.status === 'Setup' && <Settings className="h-4 w-4 text-[var(--color-app-warning)]" />}
                  {m.status === 'Mantenimiento' && <AlertTriangle className="h-4 w-4 text-[var(--color-app-danger)]" />}
                </CardHeader>
                <CardContent className="space-y-3 pb-5">
                  <p className="text-xs text-[var(--color-app-text-muted)]">{m.type}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-app-text-muted)]">Estado</span>
                      <span className="font-medium">{m.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-app-text-muted)]">OEE</span>
                      <span className="font-medium">{m.efficiency}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-app-text-muted)]">Operador</span>
                      <span className="font-medium">{m.operator}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-3 border-t border-[var(--color-app-border)]">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-app-text-muted)] truncate max-w-[140px]">{m.currentJob}</span>
                      <span className="font-medium tabular-nums">{m.progress}%</span>
                    </div>
                    <Progress value={m.progress} className="h-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Active work orders */}
          <Card className="p-0">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div>
                  <CardTitle>Órdenes de trabajo activas</CardTitle>
                  <CardDescription>Monitoreo en tiempo real</CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                  <Input
                    placeholder="Buscar WO o ID de proyecto..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID orden</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Pieza</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockWorkOrders.map(wo => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-xs">{wo.id}</TableCell>
                      <TableCell className="font-mono text-xs">{wo.project}</TableCell>
                      <TableCell>{wo.part}</TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)]">{wo.machine}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[wo.status] ?? 'secondary'}>
                          {wo.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 w-36">
                          <Progress value={(wo.completed / wo.qty) * 100} className="h-1.5" />
                          <span className="text-xs text-[var(--color-app-text-muted)] tabular-nums">
                            {wo.completed} / {wo.qty}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">Reportar avance</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'planning' && <ProductionProjectView />}

      {activeTab === 'status' && (
        <Card>
          <CardHeader>
            <CardTitle>Reporte de estatus</CardTitle>
            <CardDescription>Selecciona un proyecto para ver el desglose detallado.</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center border-t border-dashed border-[var(--color-app-border)]">
            <p className="text-sm text-[var(--color-app-text-muted)]">
              Selecciona un proyecto en el panel superior para desplegar el reporte.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
