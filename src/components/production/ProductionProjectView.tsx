import React, { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  FolderSearch,
  ChevronRight,
  Calendar,
  Info,
  Search,
  PenTool,
  FileOutput,
  FileCode2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useProjects,
  useBomItems,
  getFileDownloadUrl,
  useUpdateManufacturingStatus,
  useTechnicians,
  useAssignTechnician,
  useMachines,
  useCreateWorkOrder,
  useUpdateMachine,
} from '@/lib/api';
import type { BomItem, ManufacturingStatus } from '@/types/database';
import { CheckCircle2, Circle, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { TableControls } from '@/components/shared/TableControls';
import { applyTableState, type FieldDef, type TableState } from '@/lib/tableControls';
import { PRODUCTION_FIELDS } from '@/lib/bomFields';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

async function openStorageFile(path: string | null) {
  if (!path) return;
  const url = await getFileDownloadUrl(path);
  if (url) window.open(url, '_blank', 'noopener');
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  try {
    const d = parseISO(s);
    return isValid(d) ? format(d, 'dd MMM yyyy', { locale: es }) : '—';
  } catch {
    return '—';
  }
};

const MFG_STATUSES: ManufacturingStatus[] = [
  'PENDIENTE',
  'EN PROCESO',
  'CALIDAD',
  'TERMINADO',
  'RECHAZADO',
];

interface Props {
  /** Si se pasan, la vista usa los datos del padre (Production page) y
   *  delega la selección/refetch hacia arriba. Si no, mantiene su propio
   *  estado interno para que el componente siga siendo usable suelto. */
  projects?: import('@/types/database').Project[];
  bomItems?: BomItem[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onChanged?: () => Promise<void> | void;
}

export function ProductionProjectView(props: Props = {}) {
  // Estado controlado vs interno
  const controlled = props.selectedProjectId !== undefined;
  const [internalProjectId, setInternalProjectId] = useState<string | null>(null);
  const effectiveProjectId = controlled ? props.selectedProjectId ?? null : internalProjectId;
  const setSelectedProjectId = (id: string | null) => {
    if (controlled) {
      props.onSelectProject?.(id ?? '');
    } else {
      setInternalProjectId(id);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<BomItem | null>(null);
  const { data: technicians } = useTechnicians();
  const { data: machines } = useMachines();
  // Sólo dispara la consulta interna si el padre NO está pasándonos datos.
  // Tener ambas (internal + props) causaba doble fetch y carreras entre
  // refetchs que dejaban la lista vacía durante una fracción de segundo.
  const internalProjects = useProjects().data;
  const projectsList = props.projects ?? internalProjects;
  const internalBom = useBomItems(
    props.bomItems === undefined ? effectiveProjectId ?? undefined : undefined
  );
  const parts = props.bomItems ?? internalBom.data;
  const refetchParts = async () => {
    if (props.onChanged) await props.onChanged();
    else await internalBom.refetch();
  };
  const { update: updateMfg, loading: updatingMfg } = useUpdateManufacturingStatus();
  const { assign: assignTech } = useAssignTechnician();
  const { create: createWorkOrder } = useCreateWorkOrder();
  const { update: updateMachine } = useUpdateMachine();
  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Estado de la modal de "Generar plan de producción"
  const [planTechId, setPlanTechId] = useState('');
  const [planMachineId, setPlanMachineId] = useState('');
  const [planPriority, setPlanPriority] = useState<'Normal' | 'Alta' | 'Urgente'>('Normal');
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  // Cuando se abre la modal con una pieza nueva, hidrata los selectores
  React.useEffect(() => {
    if (selectedPart) {
      setPlanTechId(selectedPart.assigned_technician_id ?? '');
      setPlanMachineId('');
      setPlanPriority('Normal');
      setPlanError(null);
    }
  }, [selectedPart?.id]);

  // Filtros/agrupación configurables (tipo Airtable)
  const [tableState, setTableState] = useState<TableState>({
    search: '',
    groupBy: null,
    filters: [],
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleConfirmPlan = async () => {
    if (!selectedPart) return;
    if (!planTechId) {
      setPlanError('Selecciona un técnico antes de confirmar.');
      return;
    }
    setPlanSaving(true);
    setPlanError(null);
    try {
      await assignTech(selectedPart.id, planTechId);
      if (selectedPart.manufacturing_status === 'PENDIENTE') {
        await updateMfg(selectedPart.id, 'EN PROCESO');
      }
      // Si se eligió una máquina, generamos la orden de trabajo que la ocupa
      // y la marcamos como Operando para que el piso refleje el estatus.
      if (planMachineId) {
        await createWorkOrder({
          project_id: selectedPart.project_id,
          bom_item_id: selectedPart.id,
          machine_id: planMachineId,
          assigned_technician_id: planTechId,
          quantity: selectedPart.production_quantity ?? selectedPart.quantity ?? 1,
          priority: planPriority,
          status: 'En Proceso',
        });
        await updateMachine(planMachineId, { status: 'Operando' });
      }
      await refetchParts();
      setIsPlanningModalOpen(false);
      setSelectedPart(null);
    } catch (err) {
      setPlanError((err as Error).message || 'No se pudo confirmar la asignación.');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleUnassign = async () => {
    if (!selectedPart) return;
    setPlanSaving(true);
    setPlanError(null);
    try {
      await assignTech(selectedPart.id, null);
      await refetchParts();
      setIsPlanningModalOpen(false);
      setSelectedPart(null);
    } catch (err) {
      setPlanError((err as Error).message || 'No se pudo desasignar.');
    } finally {
      setPlanSaving(false);
    }
  };

  const setStatus = async (item: BomItem, next: ManufacturingStatus) => {
    if (next === item.manufacturing_status) return;
    setBusyToggleId(item.id);
    setToggleError(null);
    try {
      await updateMfg(item.id, next);
      await refetchParts();
    } catch (err) {
      setToggleError((err as Error).message || 'No se pudo actualizar.');
    } finally {
      setBusyToggleId(null);
    }
  };

  const selectedProject = projectsList.find(p => p.id === effectiveProjectId);

  // Sólo las piezas marcadas para fabricar entran al plan de producción. Los
  // consumibles, hardware y demás insumos viven en el módulo de Compras
  // pero no aparecen aquí.
  const productionParts = parts.filter(p => p.production_relevant !== false);

  // Inyectamos un campo dinámico "Técnico" alimentado por los técnicos en uso
  // en este proyecto (más "Sin asignar"), para poder filtrar y agrupar piezas
  // por quien las tiene.
  const productionFields = useMemo<FieldDef<BomItem>[]>(() => {
    const namesInUse = new Set<string>();
    productionParts.forEach(p => {
      if (!p.assigned_technician_id) {
        namesInUse.add('Sin asignar');
        return;
      }
      const name = technicians.find(t => t.id === p.assigned_technician_id)?.full_name;
      if (name) namesInUse.add(name);
    });
    const technicianField: FieldDef<BomItem> = {
      key: 'technician',
      label: 'Técnico',
      type: 'select',
      options: Array.from(namesInUse).sort((a, b) => {
        if (a === 'Sin asignar') return 1;
        if (b === 'Sin asignar') return -1;
        return a.localeCompare(b);
      }),
      get: r =>
        r.assigned_technician_id
          ? technicians.find(t => t.id === r.assigned_technician_id)?.full_name ?? 'Sin asignar'
          : 'Sin asignar',
    };
    return [...PRODUCTION_FIELDS, technicianField];
  }, [productionParts, technicians]);

  const { filtered: filteredParts, groups } = applyTableState(
    productionParts,
    productionFields,
    tableState
  );
  if (!effectiveProjectId) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-medium flex items-center gap-2 text-[var(--color-app-text)]">
          <FolderSearch className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Selección de proyecto
        </h2>
        {projectsList.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              No hay proyectos creados. Crea uno en el módulo Proyectos para empezar.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsList.map(project => (
              <Card
                key={project.id}
                className="p-0 hover:border-[var(--color-app-primary)]/40 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="font-mono text-xs">{project.id}</Badge>
                    <ChevronRight className="h-4 w-4 text-[var(--color-app-text-subtle)]" />
                  </div>
                  <CardTitle className="text-base mt-2">{project.name}</CardTitle>
                  <CardDescription>Cliente: {project.client_name}</CardDescription>
                </CardHeader>
                <CardContent className="pb-5">
                  <div className="flex justify-between items-center text-xs text-[var(--color-app-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {fmtDate(project.deadline)}
                    </span>
                    <span className="text-[var(--color-app-primary)]">Ver lista →</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelectedProjectId(null)}>
            ← Volver
          </Button>
          <div>
            <h2 className="text-base font-semibold">{selectedProject?.name}</h2>
            <p className="text-xs text-[var(--color-app-text-muted)] font-mono">
              {selectedProject?.id} · {productionParts.length} piezas ·{' '}
              {productionParts.filter(p => p.manufacturing_status === 'TERMINADO').length}{' '}
              terminadas
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await refetchParts();
            } catch {
              /* ignore */
            }
          }}
          title="Volver a cargar los datos del proyecto"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refrescar
        </Button>
      </div>

      {toggleError && (
        <div className="p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex items-center justify-between">
          <span>{toggleError}</span>
          <button onClick={() => setToggleError(null)} className="text-xs">
            ×
          </button>
        </div>
      )}

      {/* Controles configurables tipo Airtable */}
      <TableControls
        fields={productionFields}
        state={tableState}
        onChange={setTableState}
        searchPlaceholder="Buscar parte, descripción o categoría…"
      />

      <Card className="p-0">
        <CardContent className="p-0">
          {filteredParts.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-app-text-muted)]">
              {productionParts.length === 0
                ? 'Sin partes en el BOM de este proyecto. Cárgalas desde Compras → BOM / Listas.'
                : 'Ningún item coincide con los filtros actuales.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID parte</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead className="text-center">Referencias</TableHead>
                  <TableHead>Estatus compra</TableHead>
                  <TableHead>Plan producción</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(group => {
                  const isAll = group.key === '__all__';
                  const collapsed = collapsedGroups.has(group.key);
                  return (
                    <React.Fragment key={group.key}>
                      {!isAll && (
                        <TableRow
                          className="bg-[var(--color-app-surface-alt)]/80 cursor-pointer hover:bg-[var(--color-app-surface-alt)]"
                          onClick={() => toggleGroup(group.key)}
                        >
                          <TableCell colSpan={8} className="py-2">
                            <div className="flex items-center gap-2 text-xs">
                              {collapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              <span className="font-semibold uppercase tracking-wide">
                                {group.label}
                              </span>
                              <Badge variant="outline">{group.items.length}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {(isAll || !collapsed) &&
                        group.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.part_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.description}</span>
                        <span className="text-xs text-[var(--color-app-text-muted)]">{item.category}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)] tabular-nums">
                      {item.production_quantity ?? item.quantity} {item.uom}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          title={item.model_url ? 'Abrir modelo 3D' : 'Sin modelo 3D — súbelo en Diseño'}
                          disabled={!item.model_url}
                          onClick={() => openStorageFile(item.model_url)}
                          className={
                            item.model_url
                              ? 'p-1.5 rounded-md bg-[var(--color-app-primary-soft)] hover:bg-[var(--color-app-primary)]/20 transition-colors cursor-pointer'
                              : 'p-1.5 rounded-md bg-[var(--color-app-surface-alt)] opacity-40 cursor-not-allowed'
                          }
                        >
                          <FileOutput
                            className={
                              item.model_url
                                ? 'h-3.5 w-3.5 text-[var(--color-app-primary)]'
                                : 'h-3.5 w-3.5 text-[var(--color-app-text-muted)]'
                            }
                          />
                        </button>
                        <button
                          type="button"
                          title={item.drawing_url ? 'Abrir plano 2D (PDF)' : 'Sin plano 2D — súbelo en Diseño'}
                          disabled={!item.drawing_url}
                          onClick={() => openStorageFile(item.drawing_url)}
                          className={
                            item.drawing_url
                              ? 'p-1.5 rounded-md bg-[var(--color-app-primary-soft)] hover:bg-[var(--color-app-primary)]/20 transition-colors cursor-pointer'
                              : 'p-1.5 rounded-md bg-[var(--color-app-surface-alt)] opacity-40 cursor-not-allowed'
                          }
                        >
                          <FileCode2
                            className={
                              item.drawing_url
                                ? 'h-3.5 w-3.5 text-[var(--color-app-primary)]'
                                : 'h-3.5 w-3.5 text-[var(--color-app-text-muted)]'
                            }
                          />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.bom_status === 'Recibido' || item.bom_status === 'Stock'
                            ? 'success'
                            : item.bom_status === 'Solicitado' || item.bom_status === 'Tránsito'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {item.bom_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusDropdown
                        item={item}
                        busy={busyToggleId === item.id || updatingMfg}
                        onChange={s => setStatus(item, s)}
                      />
                    </TableCell>
                    <TableCell>
                      {item.assigned_technician_id ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-app-primary)] text-white text-[10px] font-medium flex items-center justify-center">
                            {(
                              technicians.find(t => t.id === item.assigned_technician_id)
                                ?.full_name || '?'
                            )
                              .split(' ')
                              .map(s => s[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="text-xs truncate max-w-[120px]">
                            {technicians.find(t => t.id === item.assigned_technician_id)
                              ?.full_name ?? 'Asignado'}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Sin asignar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={item.assigned_technician_id ? 'outline' : 'default'}
                        onClick={() => {
                          setSelectedPart(item);
                          setPlanTechId(item.assigned_technician_id ?? '');
                          setPlanMachineId('');
                          setPlanPriority('Normal');
                          setPlanError(null);
                          setIsPlanningModalOpen(true);
                        }}
                      >
                        {item.assigned_technician_id ? 'Editar plan' : 'Asignar plan'}
                      </Button>
                    </TableCell>
                  </TableRow>
                        ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Planning Modal */}
      {isPlanningModalOpen && selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-0">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" /> Generar plan de producción
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {selectedPart.part_number} · {selectedPart.description}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsPlanningModalOpen(false)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Asignar técnico</label>
                <select
                  value={planTechId}
                  onChange={e => setPlanTechId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                >
                  <option value="">Selecciona técnico…</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.full_name} — {tech.role}
                    </option>
                  ))}
                </select>
                {technicians.length === 0 && (
                  <p className="text-[10px] text-[var(--color-app-warning)] leading-snug">
                    No hay técnicos registrados. Regístralos en Personal →
                    Registrar personal (rol "Técnico").
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Máquina</label>
                  <select
                    value={planMachineId}
                    onChange={e => setPlanMachineId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                  >
                    <option value="">Selecciona equipo…</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                        {m.type ? ` (${m.type})` : ''}
                      </option>
                    ))}
                  </select>
                  {machines.length === 0 && (
                    <p className="text-[10px] text-[var(--color-app-warning)] leading-snug">
                      No hay máquinas registradas. Dalas de alta en Producción →
                      Piso de fábrica → Nueva máquina.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Prioridad</label>
                  <select
                    value={planPriority}
                    onChange={e => setPlanPriority(e.target.value as 'Normal' | 'Alta' | 'Urgente')}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                  >
                    <option>Normal</option>
                    <option>Alta</option>
                    <option>Urgente</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-[var(--color-app-surface-alt)] rounded-md border border-[var(--color-app-border)] space-y-2">
                <h4 className="text-xs font-medium text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Referencias de ingeniería vinculadas
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedPart?.model_url ? (
                    <button
                      type="button"
                      onClick={() => openStorageFile(selectedPart.model_url)}
                      className="inline-flex"
                    >
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-white">
                        <FileOutput className="h-3 w-3" /> Modelo 3D
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant="secondary" className="gap-1 opacity-60">
                      <FileOutput className="h-3 w-3" /> Sin 3D
                    </Badge>
                  )}
                  {selectedPart?.drawing_url ? (
                    <button
                      type="button"
                      onClick={() => openStorageFile(selectedPart.drawing_url)}
                      className="inline-flex"
                    >
                      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-white">
                        <FileCode2 className="h-3 w-3" /> Plano 2D
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant="secondary" className="gap-1 opacity-60">
                      <FileCode2 className="h-3 w-3" /> Sin 2D
                    </Badge>
                  )}
                </div>
              </div>

              {planError && (
                <div className="p-2 rounded-md bg-[var(--color-app-danger-soft)] text-xs text-[var(--color-app-danger)]">
                  {planError}
                </div>
              )}

              {selectedPart?.assigned_technician_id && (
                <div className="p-2.5 rounded-md bg-[var(--color-app-primary-soft)]/40 border border-[var(--color-app-primary)]/20 text-xs flex items-center justify-between gap-2">
                  <span>
                    Actualmente asignada a:{' '}
                    <strong>
                      {technicians.find(t => t.id === selectedPart.assigned_technician_id)?.full_name ?? '—'}
                    </strong>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-app-danger)] h-7"
                    onClick={handleUnassign}
                    disabled={planSaving}
                  >
                    Desasignar
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsPlanningModalOpen(false)}
                  disabled={planSaving}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmPlan}
                  disabled={planSaving || !planTechId}
                >
                  {planSaving ? 'Guardando…' : 'Confirmar asignación'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Status dropdown ──────────────────────────────────────────────────

const STATUS_VARIANT: Record<ManufacturingStatus, 'secondary' | 'default' | 'success' | 'warning' | 'destructive'> = {
  PENDIENTE: 'secondary',
  'EN PROCESO': 'default',
  CALIDAD: 'warning',
  TERMINADO: 'success',
  RECHAZADO: 'destructive',
};

function StatusDropdown({
  item,
  busy,
  onChange,
}: {
  item: BomItem;
  busy: boolean;
  onChange: (s: ManufacturingStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 group disabled:opacity-50"
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-app-primary)]" />
          ) : item.manufacturing_status === 'TERMINADO' ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--color-app-success)]" />
          ) : (
            <Circle className="h-4 w-4 text-[var(--color-app-text-subtle)] group-hover:text-[var(--color-app-primary)]" />
          )}
          <Badge variant={STATUS_VARIANT[item.manufacturing_status]} className="cursor-pointer">
            {item.manufacturing_status}
            <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Cambiar estatus</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MFG_STATUSES.map(s => (
          <DropdownMenuItem
            key={s}
            onClick={() => onChange(s)}
            className={item.manufacturing_status === s ? 'font-semibold' : ''}
          >
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
