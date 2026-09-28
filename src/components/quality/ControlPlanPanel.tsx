import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Copy, Printer, Download, ShieldAlert, Wand2, AlertTriangle, ClipboardList, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useControlPlan,
  useUpsertControlPlan,
  useControlPlanItems,
  useUpsertControlPlanItem,
  useDeleteControlPlanItem,
  useBomItems,
  useInstruments,
  calibrationState,
  type ControlPlanItemInput,
} from '@/lib/api';
import type { ControlPlanItem, ControlPlanPhase, Project } from '@/types/database';
import { CorrectiveActionModal, Field } from './CorrectiveActionModal';
import { CONTROL_METHODS, FREQUENCIES, SELECT_CLS } from './capaMeta';

const PHASES: ControlPlanPhase[] = ['Prototipo', 'Pre-lanzamiento', 'Producción'];

function blankItem(projectId: string, partNumber = '', sort = 0): ControlPlanItemInput {
  return {
    project_id: projectId,
    bom_item_id: null,
    part_number: partNumber || null,
    operation_no: '',
    operation: '',
    machine: '',
    characteristic_no: '',
    characteristic: '',
    char_type: 'Producto',
    special_char: null,
    specification: '',
    evaluation_technique: '',
    instrument_id: null,
    sample_size: '1 pza',
    frequency: '1a pieza',
    control_method: 'Hoja de inspección',
    reaction_plan: 'Detener, segregar y abrir NCR. Ajustar proceso y reinspeccionar las piezas desde la última conforme.',
    responsible: 'Operador / Calidad',
    sort_order: sort,
  };
}

/** Plantilla típica de un proyecto de maquinado CNC. */
function machiningTemplate(projectId: string, part: string, base: number): ControlPlanItemInput[] {
  const b = blankItem(projectId, part);
  return [
    { ...b, sort_order: base + 1, operation_no: '10', operation: 'Recibo de material', characteristic_no: '1', characteristic: 'Material y certificado de calidad', char_type: 'Producto', specification: 'Según plano / certificado de molino', evaluation_technique: 'Revisión documental', sample_size: '1 cert.', frequency: 'Por lote', control_method: 'Inspección de recibo', reaction_plan: 'Rechazar lote y abrir NCR a proveedor.', responsible: 'Calidad / Compras' },
    { ...b, sort_order: base + 2, operation_no: '20', operation: 'Maquinado CNC', machine: 'Torno / Centro de maquinado', characteristic_no: '2', characteristic: 'Dimensiones críticas del plano', special_char: 'CC', specification: 'Según plano (tolerancias indicadas)', evaluation_technique: 'Micrómetro / Vernier', sample_size: '1 pza', frequency: '1a pieza', control_method: 'Inspección de 1a pieza' },
    { ...b, sort_order: base + 3, operation_no: '20', operation: 'Maquinado CNC', machine: 'Torno / Centro de maquinado', characteristic_no: '3', characteristic: 'Dimensiones en proceso', specification: 'Según plano', evaluation_technique: 'Micrómetro / Gauge', sample_size: '1 pza', frequency: 'Cada 5 piezas', control_method: 'Hoja de inspección' },
    { ...b, sort_order: base + 4, operation_no: '20', operation: 'Maquinado CNC', characteristic_no: '4', characteristic: 'Parámetros de corte (velocidad, avance, desgaste de herramienta)', char_type: 'Proceso', specification: 'Según hoja de proceso', evaluation_technique: 'Verificación en máquina', sample_size: '—', frequency: 'Por turno', control_method: 'Hoja de proceso', responsible: 'Operador' },
    { ...b, sort_order: base + 5, operation_no: '20', operation: 'Maquinado CNC', characteristic_no: '5', characteristic: 'Acabado superficial (Ra)', specification: 'Ra según plano', evaluation_technique: 'Rugosímetro / comparador', sample_size: '1 pza', frequency: 'Por lote', control_method: 'Inspección visual' },
    { ...b, sort_order: base + 6, operation_no: '90', operation: 'Inspección final', characteristic_no: '6', characteristic: 'Reporte dimensional completo', special_char: 'CC', specification: 'Todas las cotas del plano', evaluation_technique: 'CMM / altímetro', sample_size: 'Según muestreo', frequency: 'Por lote', control_method: 'Reporte dimensional (CMM)', reaction_plan: 'Retener lote, abrir NCR y 100% de inspección.', responsible: 'Calidad' },
  ];
}

export function ControlPlanPanel({ project }: { project: Project }) {
  const { company } = useCompany();
  const { data: plan, refetch: refetchPlan, error: planError } = useControlPlan(project.id);
  const { save: savePlan, loading: savingPlan } = useUpsertControlPlan();
  const { data: items, refetch, mutate, error: itemsError } = useControlPlanItems(project.id);
  const { save: saveItem } = useUpsertControlPlanItem();
  const { remove } = useDeleteControlPlanItem();
  const { data: bom } = useBomItems(project.id);
  const { data: instruments } = useInstruments();

  const [header, setHeader] = useState({ phase: 'Producción' as ControlPlanPhase, revision: 'A', prepared_by: '', approved_by: '', key_contact: '' });
  const [headerMsg, setHeaderMsg] = useState<string | null>(null);
  const [partFilter, setPartFilter] = useState('');
  const [modal, setModal] = useState<{ open: boolean; id: string | null; form: ControlPlanItemInput } | null>(null);
  const [caFor, setCaFor] = useState<ControlPlanItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHeader({
      phase: plan?.phase ?? 'Producción',
      revision: plan?.revision ?? 'A',
      prepared_by: plan?.prepared_by ?? '',
      approved_by: plan?.approved_by ?? '',
      key_contact: plan?.key_contact ?? '',
    });
  }, [plan]);

  const parts = useMemo(() => {
    const set = new Set<string>();
    bom.filter(b => b.production_relevant !== false).forEach(b => set.add(b.part_number));
    items.forEach(i => i.part_number && set.add(i.part_number));
    return Array.from(set).sort();
  }, [bom, items]);

  const rows = useMemo(() => (partFilter ? items.filter(i => i.part_number === partFilter) : items), [items, partFilter]);
  const instrumentName = (id: string | null) => (id ? instruments.find(i => i.id === id) : null);
  const nextSort = () => (items.length ? Math.max(...items.map(i => i.sort_order)) + 1 : 1);
  const specialCount = items.filter(i => i.special_char).length;
  const overdueInstr = items.filter(i => {
    const ins = instrumentName(i.instrument_id);
    return ins && calibrationState(ins.next_calibration) === 'overdue';
  }).length;

  const handleSaveHeader = async () => {
    setHeaderMsg(null);
    try {
      await savePlan(plan?.id ?? null, { project_id: project.id, ...header });
      await refetchPlan();
      setHeaderMsg('Encabezado guardado.');
    } catch (e) {
      setHeaderMsg((e as Error).message);
    }
  };

  const handleSaveItem = async () => {
    if (!modal) return;
    if (!modal.form.characteristic.trim()) { setError('La característica es obligatoria.'); return; }
    setError(null);
    try {
      await saveItem(modal.id, modal.form);
      setModal(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (it: ControlPlanItem) => {
    if (!window.confirm(`¿Eliminar la característica "${it.characteristic}" del plan de control?`)) return;
    mutate(prev => prev.filter(x => x.id !== it.id));
    try { await remove(it.id); } catch (e) { await refetch(); window.alert((e as Error).message); }
  };

  const handleTemplate = async () => {
    const part = partFilter || parts[0] || '';
    if (!window.confirm(`Se agregarán 6 características típicas de maquinado${part ? ` para ${part}` : ''}. Después ajústalas al plano. ¿Continuar?`)) return;
    try {
      for (const row of machiningTemplate(project.id, part, nextSort())) await saveItem(null, row);
      await refetch();
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const toForm = (it: ControlPlanItem): ControlPlanItemInput => {
    const { id: _i, created_at: _c, updated_at: _u, tenant_id: _t, ...rest } = it;
    return rest;
  };

  const exportCsv = () => {
    const head = ['Parte', 'Op.', 'Operación', 'Máquina', 'Car. No.', 'Característica', 'Tipo', 'Clase', 'Especificación', 'Técnica', 'Instrumento', 'Muestra', 'Frecuencia', 'Método de control', 'Plan de reacción', 'Responsable'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map(i => [i.part_number, i.operation_no, i.operation, i.machine, i.characteristic_no, i.characteristic, i.char_type, i.special_char, i.specification, i.evaluation_technique, instrumentName(i.instrument_id)?.name, i.sample_size, i.frequency, i.control_method, i.reaction_plan, i.responsible].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-de-control-${project.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPlan = () => {
    const e = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const brand = company.legal_name || company.commercial_name || 'KANRI';
    const body = rows.map(i => `<tr><td>${e(i.part_number)}</td><td>${e(i.operation_no)}</td><td>${e(i.operation)}</td><td>${e(i.machine)}</td><td>${e(i.characteristic_no)}</td><td>${i.char_type === 'Producto' ? e(i.characteristic) : ''}</td><td>${i.char_type === 'Proceso' ? e(i.characteristic) : ''}</td><td style="text-align:center"><b>${e(i.special_char)}</b></td><td>${e(i.specification)}</td><td>${e(i.evaluation_technique)}${i.instrument_id ? `<br><i>${e(instrumentName(i.instrument_id)?.name)}</i>` : ''}</td><td>${e(i.sample_size)}</td><td>${e(i.frequency)}</td><td>${e(i.control_method)}</td><td>${e(i.reaction_plan)}</td><td>${e(i.responsible)}</td></tr>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plan de control ${e(project.id)}</title>
<style>@page{size:letter landscape;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#16181D;font-size:9.5px;margin:0}h1{font-size:15px;margin:0}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 4px;vertical-align:top;text-align:left}th{background:#eee;font-size:9px}
.meta{margin:6px 0 8px}.meta td{border:1px solid #bbb}.sig{display:flex;gap:30px;margin-top:26px}.sig div{flex:1;border-top:1px solid #999;padding-top:3px;text-align:center;color:#475569}</style></head><body>
<h1>PLAN DE CONTROL · ${e(header.phase.toUpperCase())}</h1>
<table class="meta"><tr><td><b>Empresa:</b> ${e(brand)}</td><td><b>No. plan:</b> CP-${e(project.id)}</td><td><b>Revisión:</b> ${e(header.revision)}</td><td><b>Fecha:</b> ${new Date().toLocaleDateString('es-MX')}</td></tr>
<tr><td><b>Proyecto:</b> ${e(project.id)} — ${e(project.name)}</td><td><b>Cliente:</b> ${e(project.client_name)}</td><td><b>Contacto clave:</b> ${e(header.key_contact)}</td><td><b>Parte:</b> ${e(partFilter || 'Todas')}</td></tr></table>
<table><tr><th rowspan="2">Parte</th><th rowspan="2">Op.</th><th rowspan="2">Operación</th><th rowspan="2">Máquina</th><th colspan="3">Características</th><th rowspan="2">Clase esp.</th><th colspan="5">Métodos</th><th rowspan="2">Plan de reacción</th><th rowspan="2">Resp.</th></tr>
<tr><th>No.</th><th>Producto</th><th>Proceso</th><th>Especificación / tolerancia</th><th>Técnica de evaluación</th><th>Muestra</th><th>Frecuencia</th><th>Método de control</th></tr>${body}</table>
<div class="sig"><div>Elaboró: ${e(header.prepared_by)}</div><div>Aprobó: ${e(header.approved_by)}</div><div>Aprobación del cliente</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const setF = <K extends keyof ControlPlanItemInput>(k: K, v: ControlPlanItemInput[K]) =>
    setModal(m => (m ? { ...m, form: { ...m.form, [k]: v } } : m));

  const loadError = planError ?? itemsError;

  return (
    <div className="space-y-4">
      {loadError && (
        <p className="text-sm rounded-md border border-[var(--color-app-warning)]/40 bg-[var(--color-app-warning-soft)]/30 px-3 py-2">{loadError.message}</p>
      )}

      {/* Encabezado del plan */}
      <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Fase">
            <select className={SELECT_CLS} value={header.phase} onChange={e => setHeader(h => ({ ...h, phase: e.target.value as ControlPlanPhase }))}>
              {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Revisión">
            <Input value={header.revision} onChange={e => setHeader(h => ({ ...h, revision: e.target.value }))} className="h-9" />
          </Field>
          <Field label="Elaboró">
            <Input value={header.prepared_by} onChange={e => setHeader(h => ({ ...h, prepared_by: e.target.value }))} className="h-9" />
          </Field>
          <Field label="Aprobó">
            <Input value={header.approved_by} onChange={e => setHeader(h => ({ ...h, approved_by: e.target.value }))} className="h-9" />
          </Field>
          <Field label="Contacto clave">
            <Input value={header.key_contact} onChange={e => setHeader(h => ({ ...h, key_contact: e.target.value }))} className="h-9" />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 mt-3">
          {headerMsg && <span className="text-xs text-[var(--color-app-text-muted)]">{headerMsg}</span>}
          <Button size="sm" variant="outline" onClick={handleSaveHeader} disabled={savingPlan}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> {savingPlan ? 'Guardando…' : 'Guardar encabezado'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={cn(SELECT_CLS, 'w-auto max-w-[220px]')} value={partFilter} onChange={e => setPartFilter(e.target.value)}>
          <option value="">Todas las piezas ({items.length})</option>
          {parts.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-[var(--color-app-text-muted)]">
          {specialCount} característica(s) especial(es)
          {overdueInstr > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-[var(--color-app-danger)]">
              <AlertTriangle className="h-3 w-3" /> {overdueInstr} con instrumento vencido
            </span>
          )}
        </span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-9" onClick={handleTemplate}>
          <Wand2 className="h-4 w-4 mr-1.5" /> Plantilla de maquinado
        </Button>
        <Button size="sm" variant="outline" className="h-9" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-1.5" /> CSV
        </Button>
        <Button size="sm" variant="outline" className="h-9" onClick={printPlan} disabled={rows.length === 0}>
          <Printer className="h-4 w-4 mr-1.5" /> Imprimir
        </Button>
        <Button size="sm" className="h-9" onClick={() => { setError(null); setModal({ open: true, id: null, form: blankItem(project.id, partFilter, nextSort()) }); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Característica
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-[var(--color-app-border)] bg-white overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-app-text-muted)] space-y-2">
            <ClipboardList className="h-6 w-6 mx-auto text-[var(--color-app-text-subtle)]" />
            <p>Sin características en el plan de control.</p>
            <p className="text-xs">Usa “Plantilla de maquinado” para arrancar y ajústala al plano.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Parte · Op.</TableHead>
                <TableHead>Característica</TableHead>
                <TableHead>Especificación</TableHead>
                <TableHead className="hidden lg:table-cell">Medición</TableHead>
                <TableHead className="hidden md:table-cell">Muestra / frecuencia</TableHead>
                <TableHead className="hidden xl:table-cell">Plan de reacción</TableHead>
                <TableHead className="w-28 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(it => {
                const ins = instrumentName(it.instrument_id);
                const cs = ins ? calibrationState(ins.next_calibration) : null;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="whitespace-nowrap align-top">
                      <p className="font-mono text-xs">{it.part_number ?? '—'}</p>
                      <p className="text-[11px] text-[var(--color-app-text-muted)]">Op. {it.operation_no || '—'} · {it.operation || '—'}</p>
                    </TableCell>
                    <TableCell className="align-top max-w-[220px]">
                      <div className="flex items-start gap-1.5">
                        {it.special_char && (
                          <Badge variant={it.special_char === 'CC' ? 'destructive' : 'warning'} className="text-[10px] shrink-0">{it.special_char}</Badge>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{it.characteristic}</p>
                          <p className="text-[11px] text-[var(--color-app-text-muted)]">{it.char_type}{it.characteristic_no ? ` · #${it.characteristic_no}` : ''}{it.machine ? ` · ${it.machine}` : ''}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">{it.specification || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell align-top text-sm">
                      {it.evaluation_technique || '—'}
                      {ins && (
                        <span className={cn('block text-[11px]', cs === 'overdue' ? 'text-[var(--color-app-danger)] font-medium' : cs === 'due_soon' ? 'text-[var(--color-app-warning)]' : 'text-[var(--color-app-text-muted)]')}>
                          {ins.name}{cs === 'overdue' ? ' · calibración vencida' : cs === 'due_soon' ? ' · por calibrar' : ''}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell align-top text-sm">
                      {it.sample_size || '—'}
                      <span className="block text-[11px] text-[var(--color-app-text-muted)]">{it.frequency} · {it.control_method}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell align-top text-xs text-[var(--color-app-text-muted)] max-w-[240px]">{it.reaction_plan || '—'}</TableCell>
                    <TableCell className="align-top text-right">
                      <div className="inline-flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Levantar acción correctiva" onClick={() => setCaFor(it)}>
                          <ShieldAlert className="h-3.5 w-3.5 text-[var(--color-app-warning)]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => setModal({ open: true, id: null, form: { ...toForm(it), characteristic_no: '', sort_order: nextSort() } })}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setError(null); setModal({ open: true, id: it.id, form: toForm(it) }); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-app-danger)]" title="Eliminar" onClick={() => handleDelete(it)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal de característica */}
      <Dialog open={!!modal} onOpenChange={v => !v && setModal(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.id ? 'Editar característica' : 'Nueva característica'}</DialogTitle>
            <DialogDescription>Qué se controla, cómo se mide, cada cuánto y qué hacer si sale de especificación.</DialogDescription>
          </DialogHeader>
          {modal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Pieza">
                  <Input list="cp-parts" value={modal.form.part_number ?? ''} onChange={e => setF('part_number', e.target.value || null)} className="font-mono" />
                  <datalist id="cp-parts">{parts.map(p => <option key={p} value={p} />)}</datalist>
                </Field>
                <Field label="No. operación">
                  <Input value={modal.form.operation_no ?? ''} onChange={e => setF('operation_no', e.target.value)} placeholder="20" />
                </Field>
                <Field label="Operación">
                  <Input value={modal.form.operation ?? ''} onChange={e => setF('operation', e.target.value)} placeholder="Torneado CNC" />
                </Field>
                <Field label="Máquina">
                  <Input value={modal.form.machine ?? ''} onChange={e => setF('machine', e.target.value)} placeholder="Torno 2" />
                </Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Car. No.">
                  <Input value={modal.form.characteristic_no ?? ''} onChange={e => setF('characteristic_no', e.target.value)} placeholder="20.3" />
                </Field>
                <div className="col-span-2 md:col-span-2">
                  <Field label="Característica *">
                    <Input value={modal.form.characteristic} onChange={e => setF('characteristic', e.target.value)} placeholder="Ø exterior" />
                  </Field>
                </div>
                <Field label="Tipo">
                  <select className={SELECT_CLS} value={modal.form.char_type} onChange={e => setF('char_type', e.target.value as ControlPlanItemInput['char_type'])}>
                    <option value="Producto">Producto</option>
                    <option value="Proceso">Proceso</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Field label="Especificación / tolerancia">
                    <Input value={modal.form.specification ?? ''} onChange={e => setF('specification', e.target.value)} placeholder="Ø25.00 ±0.02 mm" />
                  </Field>
                </div>
                <Field label="Clase especial">
                  <select className={SELECT_CLS} value={modal.form.special_char ?? ''} onChange={e => setF('special_char', (e.target.value || null) as ControlPlanItemInput['special_char'])}>
                    <option value="">Normal</option>
                    <option value="CC">CC · Crítica</option>
                    <option value="SC">SC · Significativa</option>
                  </select>
                </Field>
                <Field label="Responsable">
                  <Input value={modal.form.responsible ?? ''} onChange={e => setF('responsible', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Técnica de evaluación">
                  <Input value={modal.form.evaluation_technique ?? ''} onChange={e => setF('evaluation_technique', e.target.value)} placeholder="Micrómetro 0-25" />
                </Field>
                <Field label="Instrumento (calibración)">
                  <select className={SELECT_CLS} value={modal.form.instrument_id ?? ''} onChange={e => setF('instrument_id', e.target.value || null)}>
                    <option value="">— Ninguno —</option>
                    {instruments.map(i => {
                      const cs = calibrationState(i.next_calibration);
                      return <option key={i.id} value={i.id}>{i.name}{cs === 'overdue' ? ' (vencido)' : cs === 'due_soon' ? ' (por calibrar)' : ''}</option>;
                    })}
                  </select>
                </Field>
                <Field label="Muestra">
                  <Input value={modal.form.sample_size ?? ''} onChange={e => setF('sample_size', e.target.value)} placeholder="5 pzas" />
                </Field>
                <Field label="Frecuencia">
                  <Input list="cp-freq" value={modal.form.frequency ?? ''} onChange={e => setF('frequency', e.target.value)} />
                  <datalist id="cp-freq">{FREQUENCIES.map(f => <option key={f} value={f} />)}</datalist>
                </Field>
              </div>
              <Field label="Método de control">
                <Input list="cp-methods" value={modal.form.control_method ?? ''} onChange={e => setF('control_method', e.target.value)} />
                <datalist id="cp-methods">{CONTROL_METHODS.map(f => <option key={f} value={f} />)}</datalist>
              </Field>
              <Field label="Plan de reacción">
                <Textarea rows={2} value={modal.form.reaction_plan ?? ''} onChange={e => setF('reaction_plan', e.target.value)} />
              </Field>
              {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveItem}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan de reacción → acción correctiva */}
      <CorrectiveActionModal
        open={!!caFor}
        lockProject
        onClose={() => setCaFor(null)}
        initial={caFor ? {
          project_id: project.id,
          source_area: 'Calidad',
          source_type: 'Plan de control',
          control_plan_item_id: caFor.id,
          source_ref: `CP-${project.id} · ${caFor.part_number ?? ''} op.${caFor.operation_no ?? ''} #${caFor.characteristic_no ?? ''}`,
          title: `Característica fuera de control: ${caFor.characteristic}`,
          problem: `Especificación ${caFor.specification ?? '—'} (${caFor.part_number ?? ''}, op. ${caFor.operation_no ?? ''}). Plan de reacción: ${caFor.reaction_plan ?? '—'}`,
          priority: caFor.special_char === 'CC' ? 'Alta' : 'Media',
        } : undefined}
      />
    </div>
  );
}
