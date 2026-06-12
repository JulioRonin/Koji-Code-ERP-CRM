import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertOctagon,
  FileSignature,
  Ruler,
  Search,
  Plus,
  FileUp,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  Inbox,
  Wrench,
  RefreshCw,
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
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';
import {
  useInspections,
  useNcrs,
  useInstruments,
  useProjects,
  useBomItems,
  useTechnicians,
  useUpdateManufacturingStatus,
  getFileDownloadUrl,
} from '@/lib/api';
import type { BomItem, ManufacturingStatus } from '@/types/database';

const severityVariant: Record<string, 'destructive' | 'warning' | 'secondary'> = {
  Alta: 'destructive',
  Media: 'warning',
  Baja: 'secondary',
};

/**
 * Orden de prioridad para mostrar las bandejas: lo que Producción acaba de
 * enviar (CALIDAD) primero, luego el flujo natural de fabricación.
 */
const STATUS_ORDER: ManufacturingStatus[] = [
  'CALIDAD',
  'EN PROCESO',
  'PENDIENTE',
  'RECHAZADO',
  'TERMINADO',
];

const STATUS_META: Record<
  ManufacturingStatus,
  { label: string; description: string; tone: 'warning' | 'primary' | 'secondary' | 'success' | 'destructive'; icon: React.ComponentType<{ className?: string }> }
> = {
  CALIDAD: {
    label: 'Bandeja de calidad',
    description: 'Piezas que Producción envió para inspección.',
    tone: 'warning',
    icon: Inbox,
  },
  'EN PROCESO': {
    label: 'En fabricación',
    description: 'Producción está trabajándolas en piso.',
    tone: 'primary',
    icon: Wrench,
  },
  PENDIENTE: {
    label: 'Pendientes',
    description: 'Aún no inician producción.',
    tone: 'secondary',
    icon: Wrench,
  },
  TERMINADO: {
    label: 'Aprobadas',
    description: 'Pasaron inspección y están listas.',
    tone: 'success',
    icon: CheckCircle2,
  },
  RECHAZADO: {
    label: 'Rechazadas',
    description: 'Con NCR — requieren acción correctiva.',
    tone: 'destructive',
    icon: XCircle,
  },
};

const tabs = [
  { id: 'project_control', label: 'Control por proyecto', icon: LayoutDashboard },
  { id: 'inspections',     label: 'Historial inspecciones', icon: FileSignature },
  { id: 'ncrs',            label: 'No conformidades',     icon: AlertOctagon },
  { id: 'instruments',     label: 'Instrumentos',         icon: Ruler },
] as const;
type Tab = (typeof tabs)[number]['id'];

async function openStorageFile(path: string | null) {
  if (!path) return;
  const url = await getFileDownloadUrl(path);
  if (url) window.open(url, '_blank', 'noopener');
}

export function Quality() {
  const { sendSystemMessage } = useChat();
  const [activeTab, setActiveTab] = useState<Tab>('project_control');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ManufacturingStatus | 'TODOS'>('TODOS');
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<ManufacturingStatus>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useProjects();
  const { data: bomItems, refetch: refetchBom } = useBomItems(selectedProjectId || undefined);
  const { data: technicians } = useTechnicians();
  const { data: inspections } = useInspections();
  const { data: ncrs } = useNcrs();
  const { data: instruments } = useInstruments();
  const { update: updateMfg } = useUpdateManufacturingStatus();

  React.useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Filtra a piezas de producción y aplica search + status filter
  const allParts = useMemo(() => bomItems.filter(p => p.production_relevant !== false), [bomItems]);
  const filteredParts = useMemo(() => {
    let list = allParts;
    if (statusFilter !== 'TODOS') list = list.filter(p => p.manufacturing_status === statusFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        p =>
          p.part_number.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          (technicians.find(t => t.id === p.assigned_technician_id)?.full_name ?? '')
            .toLowerCase()
            .includes(q)
      );
    }
    return list;
  }, [allParts, statusFilter, searchTerm, technicians]);

  // Agrupa por status en el orden definido
  const groups = useMemo(() => {
    const map = new Map<ManufacturingStatus, BomItem[]>();
    STATUS_ORDER.forEach(s => map.set(s, []));
    filteredParts.forEach(p => {
      if (!map.has(p.manufacturing_status)) map.set(p.manufacturing_status, []);
      map.get(p.manufacturing_status)!.push(p);
    });
    return STATUS_ORDER.map(s => ({ status: s, items: map.get(s) ?? [] }));
  }, [filteredParts]);

  const counts = useMemo(() => {
    const c: Record<ManufacturingStatus | 'TODOS', number> = {
      TODOS: allParts.length,
      PENDIENTE: 0,
      'EN PROCESO': 0,
      CALIDAD: 0,
      TERMINADO: 0,
      RECHAZADO: 0,
    };
    allParts.forEach(p => {
      c[p.manufacturing_status] = (c[p.manufacturing_status] || 0) + 1;
    });
    return c;
  }, [allParts]);

  // Auto-expande CALIDAD por default (es la prioridad), colapsa el resto
  React.useEffect(() => {
    if (!selectedProjectId) return;
    setCollapsedStatuses(new Set(['PENDIENTE', 'EN PROCESO', 'TERMINADO', 'RECHAZADO']));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const toggleGroup = (s: ManufacturingStatus) => {
    setCollapsedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const setStatus = async (item: BomItem, next: ManufacturingStatus) => {
    if (next === item.manufacturing_status) return;
    setBusyId(item.id);
    setError(null);
    try {
      await updateMfg(item.id, next);
      await refetchBom();
      if (next === 'RECHAZADO') {
        sendSystemMessage(
          '5',
          `⚠️ Pieza [${item.part_number}] (${item.description}) del proyecto ${selectedProjectId} RECHAZADA. Requiere apertura de NCR.`,
          'QUALITY'
        );
      }
    } catch (err) {
      setError((err as Error).message || 'No se pudo actualizar el estatus.');
    } finally {
      setBusyId(null);
    }
  };

  const qaProgress = counts.TODOS > 0 ? Math.round((counts.TERMINADO / counts.TODOS) * 100) : 0;
  const approvalRate =
    counts.TERMINADO + counts.RECHAZADO > 0
      ? Math.round((counts.TERMINADO / (counts.TERMINADO + counts.RECHAZADO)) * 100 * 10) / 10
      : 100;
  const openNcrs = ncrs.filter(n => n.status === 'Abierta').length;

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

      {/* KPIs en vivo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Tasa de aprobación"
          value={`${approvalRate}%`}
          desc={`${counts.TERMINADO} ok / ${counts.RECHAZADO} NCR`}
          icon={ShieldCheck}
          tone="success"
        />
        <KpiCard
          title="En bandeja de calidad"
          value={String(counts.CALIDAD)}
          desc="Esperando inspección"
          icon={Inbox}
          tone="warning"
        />
        <KpiCard
          title="NCRs abiertas"
          value={String(openNcrs)}
          desc="Requieren acción"
          icon={AlertOctagon}
          tone="danger"
        />
        <KpiCard
          title="Calibraciones"
          value={String(instruments.filter(i => i.status !== 'Calibrado').length)}
          desc="Instrumentos pendientes"
          icon={Ruler}
          tone="warning"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md whitespace-nowrap',
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
              <label className="text-xs text-[var(--color-app-text-muted)]">
                Proyecto bajo inspección
              </label>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="block w-full md:w-80 h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
              >
                {projects.length === 0 && <option value="">No hay proyectos</option>}
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 items-end">
              <div className="px-4 py-2 bg-white rounded-md border border-[var(--color-app-border)]">
                <p className="text-xs text-[var(--color-app-text-muted)]">Progreso QA</p>
                <p className="text-sm font-semibold">{qaProgress}% completado</p>
              </div>
              <div className="px-4 py-2 bg-white rounded-md border border-[var(--color-app-border)]">
                <p className="text-xs text-[var(--color-app-text-muted)]">En bandeja</p>
                <p className="text-sm font-semibold text-[var(--color-app-warning)]">
                  {counts.CALIDAD} piezas
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchBom()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refrescar
              </Button>
            </div>
          </div>

          {/* Toolbar: search + status filter */}
          <div className="p-4 border-b border-[var(--color-app-border)] space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                <Input
                  placeholder="Buscar parte, descripción o técnico…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-app-text-muted)] mr-1">
                Estado:
              </span>
              {(
                ['TODOS', 'CALIDAD', 'EN PROCESO', 'PENDIENTE', 'TERMINADO', 'RECHAZADO'] as const
              ).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={
                    'h-7 px-2.5 rounded-md border text-xs transition-colors ' +
                    (statusFilter === s
                      ? 'bg-[var(--color-app-primary)] text-white border-[var(--color-app-primary)]'
                      : 'bg-white border-[var(--color-app-border)] hover:border-[var(--color-app-primary)]/40')
                  }
                >
                  {s === 'TODOS' ? 'Todos' : STATUS_META[s].label}{' '}
                  <span className="opacity-70 ml-1">{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="m-4 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-xs">
                ×
              </button>
            </div>
          )}

          {/* Bandejas por estatus */}
          <div className="p-4 space-y-3">
            {filteredParts.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
                {allParts.length === 0
                  ? 'Sin piezas de producción en este proyecto.'
                  : 'Ningún item coincide con los filtros actuales.'}
              </div>
            ) : (
              groups.map(group => {
                if (group.items.length === 0) return null;
                const meta = STATUS_META[group.status];
                const collapsed = collapsedStatuses.has(group.status);
                const Icon = meta.icon;
                const isPriority = group.status === 'CALIDAD';
                return (
                  <div
                    key={group.status}
                    className={
                      'rounded-md border ' +
                      (isPriority
                        ? 'border-[var(--color-app-warning)]/40 bg-[var(--color-app-warning-soft)]/20'
                        : 'border-[var(--color-app-border)] bg-white')
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.status)}
                      className="w-full p-3 flex items-center justify-between hover:bg-[var(--color-app-surface-alt)]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                        )}
                        <div
                          className={cn(
                            'h-8 w-8 rounded-md flex items-center justify-center',
                            meta.tone === 'warning' && 'bg-[var(--color-app-warning-soft)] text-[var(--color-app-warning)]',
                            meta.tone === 'primary' && 'bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]',
                            meta.tone === 'secondary' && 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]',
                            meta.tone === 'success' && 'bg-[var(--color-app-success-soft)] text-[var(--color-app-success)]',
                            meta.tone === 'destructive' && 'bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            {meta.label}
                            <Badge
                              variant={
                                meta.tone === 'success'
                                  ? 'success'
                                  : meta.tone === 'destructive'
                                  ? 'destructive'
                                  : meta.tone === 'warning'
                                  ? 'warning'
                                  : meta.tone === 'primary'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {group.items.length}
                            </Badge>
                            {isPriority && (
                              <Badge variant="warning" className="text-[10px]">
                                ⚡ Prioridad
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-[var(--color-app-text-muted)]">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    </button>
                    {!collapsed && (
                      <div className="border-t border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
                        {group.items.map(item => (
                          <QualityRow
                            key={item.id}
                            item={item}
                            technicianName={
                              technicians.find(t => t.id === item.assigned_technician_id)?.full_name
                            }
                            busy={busyId === item.id}
                            onSetStatus={s => setStatus(item, s)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
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
                        <span className="text-xs text-[var(--color-app-text-muted)] font-mono">
                          {insp.project_id}
                        </span>
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
                      <Button variant="ghost" size="sm">
                        Ver PDF
                      </Button>
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
                    <TableCell className="font-mono text-xs text-[var(--color-app-danger)]">
                      {ncr.id}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="font-medium">{ncr.project_id}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                        {ncr.issue_description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityVariant[ncr.severity]}>{ncr.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ncr.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Analizar
                      </Button>
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
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {tool.brand ?? '—'}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {tool.last_calibration ?? '—'}
                    </TableCell>
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
                      <Badge variant={tool.status === 'Calibrado' ? 'success' : 'destructive'}>
                        {tool.status}
                      </Badge>
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

// ─── Sub-componentes ─────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  desc,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'success' | 'danger' | 'warning' | 'primary';
}) {
  const color =
    tone === 'success'
      ? 'text-[var(--color-app-success)]'
      : tone === 'danger'
      ? 'text-[var(--color-app-danger)]'
      : tone === 'warning'
      ? 'text-[var(--color-app-warning)]'
      : 'text-[var(--color-app-text)]';
  return (
    <Card className="p-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--color-app-text-muted)]">{title}</p>
            <p className={cn('text-2xl font-semibold mt-1', color)}>{value}</p>
          </div>
          <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
            <Icon className="h-4 w-4 text-[var(--color-app-text-muted)]" />
          </div>
        </div>
        <p className="text-xs text-[var(--color-app-text-muted)] mt-2">{desc}</p>
      </CardContent>
    </Card>
  );
}

interface QualityRowProps {
  item: BomItem;
  technicianName?: string;
  busy: boolean;
  onSetStatus: (next: ManufacturingStatus) => void;
}

function QualityRow({ item, technicianName, busy, onSetStatus }: QualityRowProps) {
  const isCalidad = item.manufacturing_status === 'CALIDAD';
  const isAprobada = item.manufacturing_status === 'TERMINADO';
  const isRechazada = item.manufacturing_status === 'RECHAZADO';

  return (
    <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--color-app-surface-alt)]/40">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-mono font-semibold">{item.part_number}</span>
          <Badge variant="outline" className="text-[10px]">
            {item.production_quantity ?? item.quantity} {item.uom}
          </Badge>
          {technicianName && (
            <span className="text-[11px] text-[var(--color-app-text-muted)]">
              Fabricado por <strong className="text-[var(--color-app-text)]">{technicianName}</strong>
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-app-text-muted)] truncate">{item.description}</p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {item.drawing_url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openStorageFile(item.drawing_url)}
              className="h-6 text-[10px]"
            >
              <Eye className="w-3 h-3 mr-1" /> Plano 2D
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-6 text-[10px]">
            <FileUp className="w-3 h-3 mr-1" /> Cert. material
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px]">
            <FileUp className="w-3 h-3 mr-1" /> Dimensional
          </Button>
        </div>
      </div>

      <div className="flex flex-row gap-1.5 shrink-0">
        {isCalidad && (
          <>
            <Button
              size="sm"
              onClick={() => onSetStatus('TERMINADO')}
              disabled={busy}
              className="h-8"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetStatus('RECHAZADO')}
              disabled={busy}
              className="h-8 text-[var(--color-app-danger)]"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar (NCR)
            </Button>
          </>
        )}
        {isAprobada && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetStatus('CALIDAD')}
            disabled={busy}
            className="h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir
          </Button>
        )}
        {isRechazada && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetStatus('CALIDAD')}
            disabled={busy}
            className="h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Re-inspeccionar
          </Button>
        )}
        {!isCalidad && !isAprobada && !isRechazada && (
          <span className="text-[11px] text-[var(--color-app-text-muted)] italic px-2 py-1">
            Esperando que Producción la libere
          </span>
        )}
      </div>
    </div>
  );
}

