import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertOctagon,
  FileSignature,
  Ruler,
  Search,
  Plus,
  FileUp,
  LayoutDashboard,
  ChevronRight,
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
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';
import { useInspections, useNcrs, useInstruments } from '@/lib/api';

type QualityStatus = 'PENDIENTE' | 'EN REVISIÓN' | 'APROBADO' | 'RECHAZADO (NCR)';

const severityVariant: Record<string, 'destructive' | 'warning' | 'secondary'> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

const statusBadge = (status: QualityStatus) => {
  switch (status) {
    case 'APROBADO': return 'success';
    case 'RECHAZADO (NCR)': return 'destructive';
    case 'EN REVISIÓN': return 'warning';
    default: return 'secondary';
  }
};

const tabs = [
  { id: 'project_control', label: 'Control por proyecto', icon: LayoutDashboard },
  { id: 'inspections',     label: 'Historial inspecciones', icon: FileSignature },
  { id: 'ncrs',            label: 'No conformidades',     icon: AlertOctagon },
  { id: 'instruments',     label: 'Instrumentos',         icon: Ruler },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Quality() {
  const { sendSystemMessage } = useChat();
  const [activeTab, setActiveTab] = useState<Tab>('project_control');
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECTS[0].id);
  const [partStatuses, setPartStatuses] = useState<Record<string, QualityStatus>>({});

  const { data: inspections } = useInspections();
  const { data: ncrs } = useNcrs();
  const { data: instruments } = useInstruments();

  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  const handleStatusChange = (partId: string, status: QualityStatus) => {
    setPartStatuses(prev => ({ ...prev, [partId]: status }));

    if (status === 'RECHAZADO (NCR)') {
      const part = parts.find(p => p.id === partId);
      sendSystemMessage(
        '5',
        `⚠️ Alerta de calidad: La pieza [${part?.partNumber}] (${part?.description}) del proyecto ${selectedProjectId} ha sido RECHAZADA. Se requiere apertura de NCR.`,
        'QUALITY'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Calidad</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Inspecciones, no conformidades (NCR) y calibración ISO 9001.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <AlertOctagon className="h-4 w-4 mr-1.5" /> Reportar NCR
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-1.5" /> Nueva inspección
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Tasa de aprobación', value: '96.5%', icon: ShieldCheck,  tone: 'success', desc: 'Últimos 30 días' },
          { title: 'NCRs abiertas',      value: '2',     icon: AlertOctagon, tone: 'danger',  desc: 'Requieren acción' },
          { title: 'Inspecciones hoy',   value: '12',    icon: FileSignature, tone: 'primary', desc: '4 pendientes de firma' },
          { title: 'Calibraciones',      value: '3',     icon: Ruler,        tone: 'warning', desc: 'Semanas 12-14' },
        ].map(k => (
          <Card key={k.title} className="p-0">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[var(--color-app-text-muted)]">{k.title}</p>
                  <p
                    className={cn(
                      'text-2xl font-semibold mt-1',
                      k.tone === 'success' && 'text-[var(--color-app-success)]',
                      k.tone === 'danger' && 'text-[var(--color-app-danger)]',
                      k.tone === 'warning' && 'text-[var(--color-app-warning)]',
                      k.tone === 'primary' && 'text-[var(--color-app-text)]'
                    )}
                  >
                    {k.value}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
                  <k.icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                </div>
              </div>
              <p className="text-xs text-[var(--color-app-text-muted)] mt-2">{k.desc}</p>
            </CardContent>
          </Card>
        ))}
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

      {activeTab === 'project_control' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">Proyecto bajo inspección</label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="block w-full md:w-80 h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              >
                {PROJECTS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-white rounded-md border border-[var(--color-app-border)]">
                <p className="text-xs text-[var(--color-app-text-muted)]">Progreso QA</p>
                <p className="text-sm font-semibold">65% completado</p>
              </div>
              <div className="px-4 py-2 bg-white rounded-md border border-[var(--color-app-border)]">
                <p className="text-xs text-[var(--color-app-text-muted)]">NCRs activas</p>
                <p className="text-sm font-semibold text-[var(--color-app-danger)]">1 pendiente</p>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID / Referencia</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Fabricado por</TableHead>
                  <TableHead>Estatus calidad</TableHead>
                  <TableHead>Documentación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map(part => {
                  const currentStatus = partStatuses[part.id] || 'PENDIENTE';
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-mono text-xs">{part.partNumber}</TableCell>
                      <TableCell>{part.description}</TableCell>
                      <TableCell className="text-[var(--color-app-text-muted)]">Staff de piso</TableCell>
                      <TableCell>
                        <select
                          value={currentStatus}
                          onChange={e => handleStatusChange(part.id, e.target.value as QualityStatus)}
                          className={cn(
                            'h-8 px-2 rounded-md border bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40',
                            currentStatus === 'APROBADO' && 'border-[var(--color-app-success)] text-[var(--color-app-success)]',
                            currentStatus === 'RECHAZADO (NCR)' && 'border-[var(--color-app-danger)] text-[var(--color-app-danger)]',
                            currentStatus === 'EN REVISIÓN' && 'border-[var(--color-app-warning)] text-[var(--color-app-warning)]',
                            currentStatus === 'PENDIENTE' && 'border-[var(--color-app-border-strong)] text-[var(--color-app-text-muted)]'
                          )}
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="EN REVISIÓN">En revisión</option>
                          <option value="APROBADO">Aprobado</option>
                          <option value="RECHAZADO (NCR)">Rechazado (NCR)</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <FileUp className="h-3 w-3 mr-1" /> Cert. material
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <FileUp className="h-3 w-3 mr-1" /> Dimensional
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'inspections' && (
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Historial de inspecciones</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
              <Input placeholder="Filtrar por ID o pieza..." className="pl-9 h-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QA-ID</TableHead>
                  <TableHead>Proyecto / pieza</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Archivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map(insp => (
                  <TableRow key={insp.id}>
                    <TableCell className="font-mono text-xs">{insp.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{insp.inspection_type}</span>
                        <span className="text-xs text-[var(--color-app-text-muted)] font-mono">{insp.project_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {insp.inspector_id ?? '—'}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {new Date(insp.inspection_date).toLocaleDateString('es-MX')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={insp.result === 'Aprobado' ? 'success' : 'destructive'}>
                        {insp.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Ver PDF</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ncrs' && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Control de no conformidades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NCR-ID</TableHead>
                  <TableHead>Problema / desviación</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Gestión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncrs.map(ncr => (
                  <TableRow key={ncr.id}>
                    <TableCell className="font-mono text-xs text-[var(--color-app-danger)]">{ncr.id}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="font-medium">{ncr.project_id}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">{ncr.issue_description}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityVariant[ncr.severity]}>{ncr.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ncr.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Analizar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'instruments' && (
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Maestro de instrumentos</CardTitle>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Registrar instrumento
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Instrumento</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Última calibración</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map(tool => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-mono text-xs">{tool.id}</TableCell>
                    <TableCell className="font-medium">{tool.name}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{tool.brand ?? '—'}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{tool.last_calibration ?? '—'}</TableCell>
                    <TableCell
                      className={cn(
                        'text-sm',
                        tool.status === 'Vencido'
                          ? 'text-[var(--color-app-danger)] font-medium'
                          : 'text-[var(--color-app-text-muted)]'
                      )}
                    >
                      {tool.next_calibration ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={tool.status === 'Calibrado' ? 'success' : 'destructive'}>{tool.status}</Badge>
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
