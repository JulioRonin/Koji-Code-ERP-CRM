import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Play,
  FileText,
  Eye,
  MessageSquare,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Search,
  ClipboardCheck,
  Hourglass,
  ChevronDown,
  ChevronRight,
  Pause,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import {
  useBomItems,
  useProjects,
  useUpdateManufacturingStatus,
  getFileDownloadUrl,
} from '@/lib/api';
import type { BomItem, ManufacturingStatus, Project } from '@/types/database';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<ManufacturingStatus, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  PENDIENTE: 'secondary',
  'EN PROCESO': 'default',
  CALIDAD: 'warning',
  TERMINADO: 'success',
  RECHAZADO: 'destructive',
};

async function openStorageFile(path: string | null) {
  if (!path) return;
  const url = await getFileDownloadUrl(path);
  if (url) window.open(url, '_blank', 'noopener');
}

interface ProjectGroup {
  project: Project | undefined;
  projectId: string;
  items: BomItem[];
  total: number;
  pending: number;
  inProcess: number;
  inQuality: number;
  finished: number;
  rejected: number;
  progress: number;
}

export function TechnicianDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: allBomItems, refetch: refetchBom } = useBomItems();
  const { data: projects } = useProjects();
  const { update: updateMfg } = useUpdateManufacturingStatus();

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // ── Filtra SÓLO las piezas asignadas a este técnico ──────────────
  // Filtro defensivo: si el user.id no existe (no debería pasar) muestra lista vacía.
  const myItems = useMemo(() => {
    if (!user?.id) return [];
    return allBomItems.filter(
      i => i.assigned_technician_id === user.id && i.production_relevant !== false
    );
  }, [allBomItems, user?.id]);

  // ── Agrupa por proyecto con KPIs ──────────────────────────────────
  const groups: ProjectGroup[] = useMemo(() => {
    const map = new Map<string, BomItem[]>();
    myItems.forEach(item => {
      if (!map.has(item.project_id)) map.set(item.project_id, []);
      map.get(item.project_id)!.push(item);
    });
    const result: ProjectGroup[] = [];
    map.forEach((items, projectId) => {
      const project = projects.find(p => p.id === projectId);
      const total = items.length;
      const pending = items.filter(i => i.manufacturing_status === 'PENDIENTE').length;
      const inProcess = items.filter(i => i.manufacturing_status === 'EN PROCESO').length;
      const inQuality = items.filter(i => i.manufacturing_status === 'CALIDAD').length;
      const finished = items.filter(i => i.manufacturing_status === 'TERMINADO').length;
      const rejected = items.filter(i => i.manufacturing_status === 'RECHAZADO').length;
      const progress = total > 0 ? Math.round((finished / total) * 100) : 0;
      result.push({
        project,
        projectId,
        items,
        total,
        pending,
        inProcess,
        inQuality,
        finished,
        rejected,
        progress,
      });
    });
    // Orden: proyectos con piezas pendientes / en proceso arriba
    return result.sort((a, b) => {
      const ap = a.total - a.finished;
      const bp = b.total - b.finished;
      return bp - ap;
    });
  }, [myItems, projects]);

  // KPIs globales del técnico
  const kpis = useMemo(() => {
    const total = myItems.length;
    const pending = myItems.filter(i => i.manufacturing_status === 'PENDIENTE').length;
    const inProcess = myItems.filter(i => i.manufacturing_status === 'EN PROCESO').length;
    const finished = myItems.filter(i => i.manufacturing_status === 'TERMINADO').length;
    return { total, pending, inProcess, finished };
  }, [myItems]);

  // Filtro por búsqueda (sólo afecta a las listas dentro de cada proyecto)
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(
          i =>
            i.part_number.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, search]);

  // Auto-expande el primer proyecto en la primera carga
  React.useEffect(() => {
    if (expandedProjects.size === 0 && groups.length > 0) {
      setExpandedProjects(new Set([groups[0].projectId]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length === 0]);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSetStatus = async (item: BomItem, next: ManufacturingStatus) => {
    if (next === item.manufacturing_status) return;
    setBusyId(item.id);
    setError(null);
    try {
      await updateMfg(item.id, next);
      await refetchBom();
    } catch (err) {
      setError((err as Error).message || 'No se pudo actualizar el estatus.');
    } finally {
      setBusyId(null);
    }
  };

  const openChatForPart = (item: BomItem, group: ProjectGroup) => {
    const project = group.project;
    const prefill =
      `📦 *Pieza ${item.part_number}* — ${item.description ?? ''}\n` +
      `Proyecto ${project?.id ?? group.projectId}${project ? ` (${project.name})` : ''}\n` +
      `Cantidad: ${item.quantity} ${item.uom}\n` +
      `Estatus actual: ${item.manufacturing_status}\n\n` +
      `Hola equipo, `;
    navigate(
      `/chat?prefill=${encodeURIComponent(prefill)}&channel=ch-produccion`
    );
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

      {/* KPIs personales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiBox
          icon={LayoutDashboard}
          label="Asignadas"
          value={kpis.total}
          sub="piezas totales"
        />
        <KpiBox
          icon={Hourglass}
          label="Pendientes"
          value={kpis.pending}
          sub="por iniciar"
          tone="muted"
        />
        <KpiBox
          icon={Play}
          label="En proceso"
          value={kpis.inProcess}
          sub="trabajando"
          tone="primary"
        />
        <KpiBox
          icon={CheckCircle2}
          label="Terminadas"
          value={kpis.finished}
          sub={kpis.total > 0 ? `${Math.round((kpis.finished / kpis.total) * 100)}% del total` : '—'}
          tone="success"
        />
      </div>

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-3 mb-5 items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input
            placeholder="Buscar parte o descripción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          onClick={() =>
            navigate(
              '/chat?prefill=' +
                encodeURIComponent(
                  `⚠️ *Reporte de incidencia*\n` +
                    `Operador: ${user?.name ?? ''}\n` +
                    `Turno: Matutino\n\n` +
                    `Describir incidencia: `
                ) +
                '&channel=ch-produccion'
            )
          }
          className="p-3 rounded-lg border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)] hover:bg-[var(--color-app-danger-soft)]/80 transition-colors flex items-center gap-3 md:w-auto"
        >
          <AlertTriangle className="h-5 w-5 text-[var(--color-app-danger)] shrink-0" />
          <div className="text-left">
            <p className="text-sm font-medium text-[var(--color-app-danger)]">
              Reportar incidencia
            </p>
            <p className="text-xs text-[var(--color-app-text-muted)]">
              Paro de máquina o defecto
            </p>
          </div>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs">
            ×
          </button>
        </div>
      )}

      {/* Proyectos asignados */}
      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--color-app-text-muted)] space-y-2">
            <Wrench className="h-8 w-8 mx-auto text-[var(--color-app-text-subtle)]" />
            <p className="font-medium">
              {myItems.length === 0
                ? 'Aún no tienes piezas asignadas.'
                : 'No hay piezas con ese filtro.'}
            </p>
            <p className="text-xs">
              {myItems.length === 0
                ? 'Cuando el coordinador de producción te asigne piezas las verás aquí.'
                : 'Limpia el buscador para verlas todas.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const expanded = expandedProjects.has(group.projectId);
            return (
              <Card key={group.projectId} className="p-0 overflow-hidden">
                <button
                  onClick={() => toggleProject(group.projectId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-app-surface-alt)]/50 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--color-app-text-muted)] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {group.projectId}
                        </Badge>
                        <h3 className="text-sm font-semibold truncate">
                          {group.project?.name ?? 'Proyecto sin nombre'}
                        </h3>
                      </div>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                        {group.total} piezas asignadas a ti · {group.finished} terminadas ·{' '}
                        {group.inProcess} en proceso
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden md:block w-32">
                      <div className="flex justify-between text-[10px] text-[var(--color-app-text-muted)] mb-1">
                        <span>Avance</span>
                        <span className="font-medium">{group.progress}%</span>
                      </div>
                      <Progress value={group.progress} className="h-1.5" />
                    </div>
                    <Badge
                      variant={
                        group.progress === 100 ? 'success' : group.inProcess > 0 ? 'default' : 'secondary'
                      }
                    >
                      {group.progress === 100
                        ? 'Completo'
                        : group.inProcess > 0
                        ? 'En curso'
                        : 'Pendiente'}
                    </Badge>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-[var(--color-app-border)] p-4 space-y-3 bg-[var(--color-app-surface-alt)]/30">
                    {/* Mini-KPIs del proyecto */}
                    <div className="grid grid-cols-4 gap-2">
                      <MiniStat label="Pendientes" value={group.pending} />
                      <MiniStat label="En proceso" value={group.inProcess} tone="primary" />
                      <MiniStat label="Calidad" value={group.inQuality} tone="warning" />
                      <MiniStat label="Terminadas" value={group.finished} tone="success" />
                    </div>

                    <div className="space-y-2">
                      {group.items.map(item => (
                        <TechnicianPartCard
                          key={item.id}
                          item={item}
                          group={group}
                          busy={busyId === item.id}
                          onSetStatus={next => handleSetStatus(item, next)}
                          onOpenChat={() => openChatForPart(item, group)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────

function KpiBox({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  tone?: 'muted' | 'primary' | 'success';
}) {
  const color =
    tone === 'success'
      ? 'text-[var(--color-app-success)]'
      : tone === 'primary'
      ? 'text-[var(--color-app-primary)]'
      : tone === 'muted'
      ? 'text-[var(--color-app-text-muted)]'
      : 'text-[var(--color-app-text)]';
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
            <p className={cn('text-2xl font-semibold mt-1 tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-[var(--color-app-text-muted)] mt-0.5">{sub}</p>
          </div>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'primary' | 'warning' | 'success';
}) {
  const bg =
    tone === 'success'
      ? 'bg-[var(--color-app-success-soft)] text-[var(--color-app-success)]'
      : tone === 'warning'
      ? 'bg-[var(--color-app-warning-soft)] text-[var(--color-app-warning)]'
      : tone === 'primary'
      ? 'bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
      : 'bg-white text-[var(--color-app-text)]';
  return (
    <div className={cn('p-2 rounded-md border border-[var(--color-app-border)]', bg)}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

interface PartCardProps {
  item: BomItem;
  group: ProjectGroup;
  busy: boolean;
  onSetStatus: (next: ManufacturingStatus) => void;
  onOpenChat: () => void;
}

function TechnicianPartCard({ item, busy, onSetStatus, onOpenChat }: PartCardProps) {
  const done = item.manufacturing_status === 'TERMINADO';
  const rejected = item.manufacturing_status === 'RECHAZADO';

  return (
    <div
      className={cn(
        'bg-white border border-[var(--color-app-border)] rounded-lg p-4 transition-colors',
        done && 'opacity-70',
        rejected && 'border-[var(--color-app-danger)]/30'
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-semibold">{item.part_number}</span>
            <Badge variant="outline" className="text-[10px]">
              {item.quantity} {item.uom}
            </Badge>
            <Badge variant={STATUS_VARIANT[item.manufacturing_status]}>
              {item.manufacturing_status}
            </Badge>
          </div>
          <p className="text-sm text-[var(--color-app-text-muted)] truncate">
            {item.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.drawing_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openStorageFile(item.drawing_url)}
                className="h-7"
              >
                <Eye className="w-3 h-3 mr-1" /> Plano 2D
              </Button>
            )}
            {item.model_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openStorageFile(item.model_url)}
                className="h-7"
              >
                <FileText className="w-3 h-3 mr-1" /> Modelo 3D
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onOpenChat} className="h-7">
              <MessageSquare className="w-3 h-3 mr-1" /> Chat de la pieza
            </Button>
          </div>
        </div>

        {/* Acciones de estatus */}
        <div className="flex flex-row md:flex-col gap-1.5 md:min-w-[140px] md:items-stretch">
          {item.manufacturing_status === 'PENDIENTE' && (
            <Button onClick={() => onSetStatus('EN PROCESO')} disabled={busy} className="flex-1">
              <Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar
            </Button>
          )}
          {item.manufacturing_status === 'EN PROCESO' && (
            <>
              <Button
                onClick={() => onSetStatus('CALIDAD')}
                disabled={busy}
                variant="outline"
                className="flex-1"
              >
                <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> A calidad
              </Button>
              <Button onClick={() => onSetStatus('PENDIENTE')} disabled={busy} variant="ghost" className="flex-1">
                <Pause className="w-3.5 h-3.5 mr-1.5" /> Pausar
              </Button>
            </>
          )}
          {item.manufacturing_status === 'CALIDAD' && (
            <>
              <Button
                onClick={() => onSetStatus('TERMINADO')}
                disabled={busy}
                className="flex-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Aprobada
              </Button>
              <Button
                onClick={() => onSetStatus('EN PROCESO')}
                disabled={busy}
                variant="outline"
                className="flex-1"
              >
                Reabrir
              </Button>
            </>
          )}
          {done && (
            <div className="inline-flex items-center justify-center gap-1.5 text-[var(--color-app-success)] text-sm font-medium px-3 py-2 rounded-md bg-[var(--color-app-success-soft)]">
              <CheckCircle2 className="h-4 w-4" /> Completada
            </div>
          )}
          {rejected && (
            <Button
              onClick={() => onSetStatus('EN PROCESO')}
              disabled={busy}
              variant="outline"
              className="flex-1"
            >
              Reintentar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
