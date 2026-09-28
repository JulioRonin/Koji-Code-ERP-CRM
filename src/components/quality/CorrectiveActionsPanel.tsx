import { useMemo, useState } from 'react';
import { Plus, Search, Layers, Pencil, Trash2, AlertTriangle, ListChecks, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useCorrectiveActions,
  useDeleteCorrectiveAction,
  useProjects,
  isCaOverdue,
  CA_OPEN_STATUSES,
  type CorrectiveActionInput,
} from '@/lib/api';
import type { CaArea, CaStatus, CorrectiveAction } from '@/types/database';
import { CorrectiveActionModal } from './CorrectiveActionModal';
import { AREA_COLOR, CA_AREAS, CA_STATUSES, CA_STATUS_VARIANT, PRIORITY_VARIANT, SELECT_CLS } from './capaMeta';

interface Props {
  /** Si se indica, muestra solo las acciones de ese proyecto. */
  projectId?: string;
  /** Área preseleccionada al crear (p. ej. "Producción"). */
  defaultArea?: CaArea;
  title?: string;
  description?: string;
  /** Sin tarjeta envolvente (para usarse dentro de otra tarjeta/tab). */
  bare?: boolean;
}

/**
 * Action list de acciones correctivas (CAPA). Recibe entradas de todas las
 * áreas (Calidad, Producción, Diseño, Compras…) y lleva el seguimiento hasta la
 * verificación de eficacia.
 */
export function CorrectiveActionsPanel({ projectId, defaultArea, title, description, bare }: Props) {
  const { data: actions, refetch, mutate, error } = useCorrectiveActions(projectId);
  const { data: projects } = useProjects();
  const { remove } = useDeleteCorrectiveAction();

  const [search, setSearch] = useState('');
  const [area, setArea] = useState<CaArea | 'TODAS'>('TODAS');
  const [status, setStatus] = useState<CaStatus | 'ABIERTAS' | 'TODOS'>('ABIERTAS');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [groupByArea, setGroupByArea] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; action: CorrectiveAction | null }>({ open: false, action: null });

  const projectName = (id: string | null) => (id ? projects.find(p => p.id === id)?.name ?? id : 'General');

  const kpis = useMemo(() => {
    const open = actions.filter(a => CA_OPEN_STATUSES.includes(a.status));
    const overdue = open.filter(isCaOverdue);
    const closed = actions.filter(a => a.status === 'Cerrada');
    const effective = closed.filter(a => a.effective !== false).length;
    return {
      open: open.length,
      overdue: overdue.length,
      verifying: actions.filter(a => a.status === 'En verificación').length,
      closed: closed.length,
      effectiveness: closed.length > 0 ? Math.round((effective / closed.length) * 100) : null,
    };
  }, [actions]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actions.filter(a => {
      if (area !== 'TODAS' && a.source_area !== area) return false;
      if (status === 'ABIERTAS' && !CA_OPEN_STATUSES.includes(a.status)) return false;
      if (status !== 'ABIERTAS' && status !== 'TODOS' && a.status !== status) return false;
      if (!projectId && projectFilter && a.project_id !== projectFilter) return false;
      if (!q) return true;
      return [a.id, a.title, a.responsible, a.source_ref, a.problem, a.project_id]
        .some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [actions, search, area, status, projectFilter, projectId]);

  const groups = useMemo(() => {
    if (!groupByArea) return null;
    return CA_AREAS.map(a => ({ area: a, rows: rows.filter(r => r.source_area === a) })).filter(g => g.rows.length > 0);
  }, [rows, groupByArea]);

  const handleDelete = async (a: CorrectiveAction) => {
    if (!window.confirm(`¿Eliminar la acción ${a.id}? Esta acción no se puede deshacer.`)) return;
    mutate(prev => prev.filter(x => x.id !== a.id));
    try { await remove(a.id); } catch (e) { await refetch(); window.alert((e as Error).message); }
  };

  const exportCsv = () => {
    const head = ['Folio', 'Proyecto', 'Área', 'Origen', 'Referencia', 'Título', 'Problema', 'Causa raíz', 'Tipo', 'Acción', 'Responsable', 'Compromiso', 'Prioridad', 'Estatus', 'Eficaz', 'Verificación', 'Creada'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map(a => [
      a.id, a.project_id ?? 'General', a.source_area, a.source_type, a.source_ref ?? a.ncr_id ?? '', a.title, a.problem, a.root_cause,
      a.action_type, a.action, a.responsible, a.due_date, a.priority, a.status,
      a.effective == null ? '' : a.effective ? 'Sí' : 'No', a.verification, a.created_at.slice(0, 10),
    ].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `acciones-correctivas${projectId ? `-${projectId}` : ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const initial: Partial<CorrectiveActionInput> = {
    project_id: projectId ?? (projectFilter || null),
    source_area: defaultArea ?? 'Calidad',
    source_type: defaultArea && defaultArea !== 'Calidad' ? 'Mejora' : 'NCR',
  };

  const body = (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Abiertas" value={kpis.open} color="var(--color-app-danger)" />
        <Stat label="Vencidas" value={kpis.overdue} color={kpis.overdue > 0 ? 'var(--color-app-danger)' : 'var(--color-app-text)'} hint="fecha compromiso pasada" />
        <Stat label="En verificación" value={kpis.verifying} color="var(--color-app-primary)" />
        <Stat
          label="Cerradas"
          value={kpis.closed}
          color="var(--color-app-success)"
          hint={kpis.effectiveness == null ? 'sin cierres aún' : `${kpis.effectiveness}% eficaces`}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
          <Input placeholder="Buscar folio, título, responsable…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <select className={cn(SELECT_CLS, 'w-auto')} value={area} onChange={e => setArea(e.target.value as CaArea | 'TODAS')}>
          <option value="TODAS">Todas las áreas</option>
          {CA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={cn(SELECT_CLS, 'w-auto')} value={status} onChange={e => setStatus(e.target.value as CaStatus | 'ABIERTAS' | 'TODOS')}>
          <option value="ABIERTAS">Abiertas (pendientes)</option>
          <option value="TODOS">Todos los estatus</option>
          {CA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {!projectId && (
          <select className={cn(SELECT_CLS, 'w-auto max-w-[220px]')} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
          </select>
        )}
        <Button variant={groupByArea ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => setGroupByArea(v => !v)}>
          <Layers className="h-4 w-4 mr-1.5" /> Agrupar por área
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-9" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1.5" /> CSV
        </Button>
        <Button size="sm" className="h-9" onClick={() => setModal({ open: true, action: null })}>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva acción
        </Button>
      </div>

      {error && (
        <p className="text-sm rounded-md border border-[var(--color-app-warning)]/40 bg-[var(--color-app-warning-soft)]/30 px-3 py-2 text-[var(--color-app-text)]">
          {error.message}
        </p>
      )}

      {/* Lista */}
      <div className="rounded-lg border border-[var(--color-app-border)] overflow-hidden bg-white">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">
            {actions.length === 0 ? 'Sin acciones correctivas registradas.' : 'Sin resultados para el filtro actual.'}
          </div>
        ) : groups ? (
          <div className="divide-y divide-[var(--color-app-border)]">
            {groups.map(g => (
              <div key={g.area}>
                <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-app-surface-alt)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: AREA_COLOR[g.area] }} />
                  <span className="text-sm font-medium">{g.area}</span>
                  <span className="text-xs text-[var(--color-app-text-muted)]">{g.rows.length}</span>
                </div>
                <CaTable rows={g.rows} showProject={!projectId} projectName={projectName} onEdit={a => setModal({ open: true, action: a })} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        ) : (
          <CaTable rows={rows} showProject={!projectId} projectName={projectName} onEdit={a => setModal({ open: true, action: a })} onDelete={handleDelete} />
        )}
      </div>

      <CorrectiveActionModal
        open={modal.open}
        action={modal.action}
        initial={initial}
        lockProject={!!projectId}
        onClose={() => setModal({ open: false, action: null })}
        onSaved={() => refetch()}
      />
    </div>
  );

  if (bare) return body;
  return (
    <Card className="p-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-[var(--color-app-primary)]" />
          {title ?? 'Acciones correctivas'}
        </CardTitle>
        <CardDescription>
          {description ?? 'Action list de todas las áreas: Calidad, Producción, Diseño, Compras… hasta verificar su eficacia.'}
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function CaTable({
  rows, showProject, projectName, onEdit, onDelete,
}: {
  rows: CorrectiveAction[];
  showProject: boolean;
  projectName: (id: string | null) => string;
  onEdit: (a: CorrectiveAction) => void;
  onDelete: (a: CorrectiveAction) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Folio</TableHead>
          <TableHead>Acción</TableHead>
          <TableHead className="hidden md:table-cell">Área / origen</TableHead>
          <TableHead className="hidden lg:table-cell">Responsable</TableHead>
          <TableHead>Compromiso</TableHead>
          <TableHead>Estatus</TableHead>
          <TableHead className="w-20 text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(a => {
          const overdue = isCaOverdue(a);
          return (
            <TableRow key={a.id} className="cursor-pointer" onClick={() => onEdit(a)}>
              <TableCell className="font-mono text-xs whitespace-nowrap">{a.id}</TableCell>
              <TableCell className="max-w-sm">
                <p className="font-medium text-sm truncate">{a.title}</p>
                <p className="text-xs text-[var(--color-app-text-muted)] truncate">
                  {showProject ? `${projectName(a.project_id)} · ` : ''}{a.action_type}
                  {a.source_ref || a.ncr_id ? ` · ${a.ncr_id ?? a.source_ref}` : ''}
                </p>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: AREA_COLOR[a.source_area] ?? '#94a3b8' }} />
                  {a.source_area}
                </span>
                <p className="text-[11px] text-[var(--color-app-text-muted)]">{a.source_type}</p>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm">{a.responsible ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap">
                <span className={cn('text-sm', overdue && 'text-[var(--color-app-danger)] font-medium')}>
                  {a.due_date ?? '—'}
                </span>
                {overdue && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-app-danger)]">
                    <AlertTriangle className="h-3 w-3" /> vencida
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={CA_STATUS_VARIANT[a.status]}>{a.status}</Badge>
                  <Badge variant={PRIORITY_VARIANT[a.priority]} className="text-[10px]">{a.priority}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={e => { e.stopPropagation(); onEdit(a); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-app-danger)]" title="Eliminar" onClick={e => { e.stopPropagation(); onDelete(a); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-app-border)] bg-white p-3">
      <p className="text-[11px] text-[var(--color-app-text-muted)]">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {hint && <p className="text-[10px] text-[var(--color-app-text-subtle)]">{hint}</p>}
    </div>
  );
}
