import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertOctagon, CheckCircle2, Circle, Printer, Plus, ShieldCheck, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  useUpdateNcr, useCorrectiveActions, useUpdateManufacturingStatus, useProjects, CA_OPEN_STATUSES,
} from '@/lib/api';
import type { CorrectiveAction, Ncr, NcrDisposition, NcrStatus } from '@/types/database';
import { CorrectiveActionModal, Field } from './CorrectiveActionModal';
import {
  CA_STATUS_VARIANT, DISPOSITIONS, DISPOSITION_META, NCR_STATUS_VARIANT, SELECT_CLS, SEVERITY_VARIANT,
} from './capaMeta';
import { QMS_DOC, QMS_SECTION_LABEL } from './qmsDoc';

/** Pasos B2–B6 de la sección 8 (TPNC) del PR-CAL-001; B1 es el registro de la NCR. */
const STEPS = [
  { n: 1, code: 'B2', label: 'Contención' },
  { n: 2, code: 'B3', label: 'Disposición' },
  { n: 3, code: 'B4', label: 'Causa raíz' },
  { n: 4, code: 'B5', label: 'Acciones' },
  { n: 5, code: 'B6', label: 'Verificación y cierre' },
] as const;

interface Props {
  ncr: Ncr | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Procedimiento de producto no conforme (ISO 9001 §8.7 / §10.2) sobre una NCR:
 * 1 contención · 2 disposición (MRB) · 3 causa raíz (5 porqués) · 4 acciones
 * correctivas · 5 verificación de eficacia y cierre. Genera un registro
 * imprimible como evidencia para auditoría.
 */
export function NcrDetailModal({ ncr, open, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const { company } = useCompany();
  const { data: projects } = useProjects();
  const { update, loading } = useUpdateNcr();
  const { update: updateMfg } = useUpdateManufacturingStatus();
  const { data: allCas, refetch: refetchCas } = useCorrectiveActions(ncr?.project_id);

  const [step, setStep] = useState<number>(1);
  const [containment, setContainment] = useState('');
  const [disposition, setDisposition] = useState<NcrDisposition | ''>('');
  const [dispositionNotes, setDispositionNotes] = useState('');
  const [applyToPart, setApplyToPart] = useState(true);
  const [whys, setWhys] = useState<string[]>(['', '', '', '', '']);
  const [rootCause, setRootCause] = useState('');
  const [verification, setVerification] = useState('');
  const [effective, setEffective] = useState<'' | 'si' | 'no'>('');
  const [cost, setCost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [caModal, setCaModal] = useState<{ open: boolean; action: CorrectiveAction | null }>({ open: false, action: null });

  useEffect(() => {
    if (!open || !ncr) return;
    setContainment(ncr.containment ?? '');
    setDisposition(ncr.disposition ?? '');
    setDispositionNotes(ncr.disposition_notes ?? '');
    setApplyToPart(true);
    const w = Array.isArray(ncr.why_analysis) ? ncr.why_analysis : [];
    setWhys([0, 1, 2, 3, 4].map(i => w[i] ?? ''));
    setRootCause(ncr.root_cause ?? '');
    setVerification(ncr.verification ?? '');
    setEffective(ncr.effective == null ? '' : ncr.effective ? 'si' : 'no');
    setCost(ncr.cost_impact != null ? String(ncr.cost_impact) : '');
    setError(null);
    setNotice(null);
    // Abre en el primer paso pendiente.
    setStep(!ncr.containment ? 1 : !ncr.disposition ? 2 : !ncr.root_cause ? 3 : ncr.status === 'Cerrada' ? 5 : 4);
    // Solo al abrir otra NCR: los refetch posteriores no reinician el formulario ni el paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ncr?.id]);

  const linked = useMemo(() => (ncr ? allCas.filter(a => a.ncr_id === ncr.id || a.source_ref === ncr.id) : []), [allCas, ncr]);
  const openLinked = linked.filter(a => CA_OPEN_STATUSES.includes(a.status));

  if (!ncr) return null;
  const closed = ncr.status === 'Cerrada';
  const project = projects.find(p => p.id === ncr.project_id);

  const done: Record<number, boolean> = {
    1: !!containment.trim(),
    2: !!disposition,
    3: !!rootCause.trim(),
    4: linked.length > 0,
    5: closed,
  };

  const deriveStatus = (): NcrStatus => {
    if (closed) return 'Cerrada';
    if (linked.length > 0) return 'Acción Correctiva';
    if (rootCause.trim() || whys.some(w => w.trim())) return 'En Investigación';
    return 'Abierta';
  };

  const buildPatch = (status: NcrStatus): Partial<Ncr> => {
    const dispositionChanged = (disposition || null) !== (ncr.disposition ?? null);
    return {
      containment: containment.trim() || null,
      disposition: (disposition || null) as NcrDisposition | null,
      disposition_notes: dispositionNotes.trim() || null,
      ...(dispositionChanged && disposition
        ? { disposition_by: user?.name ?? null, disposition_at: new Date().toISOString() }
        : {}),
      why_analysis: whys.map(w => w.trim()).filter(Boolean),
      root_cause: rootCause.trim() || null,
      action_plan: linked.map(a => `${a.id}: ${a.title}`).join('\n') || ncr.action_plan,
      verification: verification.trim() || null,
      effective: effective === '' ? null : effective === 'si',
      cost_impact: cost ? Number(cost) : null,
      status,
    };
  };

  /** Aplica la disposición al estatus de la pieza (retrabajo → producción, etc.). */
  const maybeApplyDisposition = async () => {
    if (!applyToPart || !disposition || !ncr.bom_item_id) return;
    if ((disposition || null) === (ncr.disposition ?? null)) return;
    const next = DISPOSITION_META[disposition].next;
    await updateMfg(ncr.bom_item_id, next);
    setNotice(`Pieza actualizada a “${next}” por disposición ${disposition}.`);
  };

  const handleSave = async () => {
    setError(null);
    try {
      await update(ncr.id, buildPatch(deriveStatus()));
      await maybeApplyDisposition().catch(e => setError(`NCR guardada, pero no se actualizó la pieza: ${(e as Error).message}`));
      onChanged?.();
      setNotice(n => n ?? 'Avance guardado.');
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar.');
    }
  };

  const handleClose = async () => {
    setError(null);
    const missing: string[] = [];
    if (!containment.trim()) missing.push('contención');
    if (!disposition) missing.push('disposición');
    if (!rootCause.trim()) missing.push('causa raíz');
    if (!verification.trim()) missing.push('verificación de eficacia');
    if (missing.length) { setError(`Para cerrar falta: ${missing.join(', ')}.`); return; }
    if (openLinked.length > 0 && !window.confirm(`Hay ${openLinked.length} acción(es) correctiva(s) sin cerrar. ¿Cerrar la NCR de todos modos?`)) return;
    try {
      await update(ncr.id, { ...buildPatch('Cerrada'), closed_at: new Date().toISOString() });
      await maybeApplyDisposition().catch(() => {});
      onChanged?.();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'No se pudo cerrar.');
    }
  };

  const handleReopen = async () => {
    try {
      await update(ncr.id, { status: 'En Investigación', closed_at: null });
      onChanged?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const printRecord = () => {
    const brand = company.legal_name || company.commercial_name || 'KANRI';
    const e = (s: unknown) => String(s ?? '—').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const row = (k: string, v: unknown) => `<tr><th>${k}</th><td>${e(v)}</td></tr>`;
    const casRows = linked.map(a => `<tr><td>${e(a.id)}</td><td>${e(a.title)}</td><td>${e(a.responsible)}</td><td>${e(a.due_date)}</td><td>${e(a.status)}</td><td>${a.effective == null ? '—' : a.effective ? 'Sí' : 'No'}</td></tr>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(ncr.id)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#16181D;margin:24px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 6px;color:#475569;border-bottom:1px solid #ddd;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f4f4f2;width:26%;font-weight:600}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16181D;padding-bottom:8px}.sig{display:flex;gap:40px;margin-top:40px}.sig div{flex:1;border-top:1px solid #999;padding-top:4px;text-align:center;color:#475569}
.cas th{width:auto}</style></head><body>
<div class="head"><div><h1>Reporte de No Conformidad</h1><div>${e(brand)} · ${e(QMS_SECTION_LABEL)} · Rev. ${QMS_DOC.revision} (ISO 9001 §8.7 / §10.2)</div></div><div style="text-align:right"><b style="font-size:16px">${e(ncr.id)}</b><div>Estatus: ${e(ncr.status)}</div><div>${e(format(new Date(ncr.created_at), 'dd MMM yyyy', { locale: es }))}</div></div></div>
<h2>B1 · Identificación y registro</h2><table>${row('Proyecto', `${ncr.project_id}${project ? ' — ' + project.name : ''}`)}${row('Cliente', project?.client_name)}${row('No. de parte', ncr.part_number)}${row('Cantidad afectada', ncr.quantity_affected)}${row('Detectado en', ncr.detected_area)}${row('Tipo de defecto', ncr.defect_type)}${row('Severidad', ncr.severity)}${row('Descripción', ncr.issue_description)}${row('Notificar al cliente', ncr.notify_customer ? 'Sí' : 'No')}</table>
<h2>B2 · Contención</h2><table>${row('Acción de contención', containment)}</table>
<h2>B3 · Disposición (MRB)</h2><table>${row('Disposición', disposition)}${row('Justificación', dispositionNotes)}${row('Decidió', ncr.disposition_by)}${row('Fecha', ncr.disposition_at ? format(new Date(ncr.disposition_at), 'dd MMM yyyy', { locale: es }) : '')}</table>
<h2>B4 · Análisis de causa raíz (5 porqués)</h2><table>${whys.map((w, i) => row(`¿Por qué? ${i + 1}`, w)).join('')}${row('Causa raíz', rootCause)}</table>
<h2>B5 · Acciones correctivas</h2>${linked.length ? `<table class="cas"><tr><th>Folio</th><th>Acción</th><th>Responsable</th><th>Compromiso</th><th>Estatus</th><th>Eficaz</th></tr>${casRows}</table>` : '<p>Sin acciones registradas.</p>'}
<h2>B6 · Verificación de eficacia y cierre</h2><table>${row('Verificación', verification)}${row('¿Eficaz?', effective === '' ? '' : effective === 'si' ? 'Sí' : 'No')}${row('Costo de la no calidad (MXN)', cost)}${row('Fecha de cierre', ncr.closed_at ? format(new Date(ncr.closed_at), 'dd MMM yyyy', { locale: es }) : '')}</table>
<div class="sig"><div>Calidad</div><div>Producción</div><div>Gerencia / MRB</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`;
    // Sin "noopener": con él window.open devuelve null y no podríamos escribir el registro.
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { setError('Permite ventanas emergentes para imprimir el registro.'); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-[var(--color-app-danger)]" />
            <span className="font-mono">{ncr.id}</span>
            <Badge variant={NCR_STATUS_VARIANT[ncr.status]}>{ncr.status}</Badge>
            <Badge variant={SEVERITY_VARIANT[ncr.severity] ?? 'secondary'}>{ncr.severity}</Badge>
          </DialogTitle>
          <DialogDescription>
            {ncr.project_id}{project ? ` · ${project.name}` : ''} · {ncr.part_number ?? 'sin pieza'}{ncr.quantity_affected ? ` · ${ncr.quantity_affected} pzas` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Descripción */}
        <div className="rounded-lg border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)]/30 p-3 text-sm">
          <p className="text-[11px] font-medium text-[var(--color-app-text-muted)] uppercase tracking-wide">
            {ncr.defect_type ?? 'No conformidad'} · detectado en {ncr.detected_area ?? '—'} · {format(new Date(ncr.created_at), 'dd MMM yyyy', { locale: es })}
          </p>
          <p className="mt-1">{ncr.issue_description}</p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-5 gap-1">
          {STEPS.map(s => (
            <button
              key={s.n}
              // Cambiar de paso guarda el avance (no se pierde lo capturado al cerrar).
              onClick={async () => { if (!closed && s.n !== step) await handleSave(); setStep(s.n); }}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] transition-colors border',
                step === s.n
                  ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)]/40 text-[var(--color-app-text)] font-medium'
                  : 'border-transparent text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]'
              )}
            >
              {done[s.n] ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--color-app-success)]" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <span className="text-center leading-tight">{s.code} · {s.label}</span>
            </button>
          ))}
        </div>

        <div className="min-h-[220px]">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-app-text-muted)]">
                Evita que el producto no conforme llegue al cliente: identifícalo (etiqueta roja), segrégalo y revisa piezas en proceso, en almacén y ya embarcadas.
              </p>
              <Field label="Acción de contención">
                <Textarea rows={5} value={containment} onChange={e => setContainment(e.target.value)} disabled={closed} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-app-text-muted)]">
                Decisión del comité de revisión de material (MRB). La disposición puede actualizar el estatus de la pieza automáticamente.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DISPOSITIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    disabled={closed}
                    onClick={() => setDisposition(d)}
                    className={cn(
                      'text-left rounded-lg border p-3 transition-colors disabled:opacity-60',
                      disposition === d
                        ? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary-soft)]/40'
                        : 'border-[var(--color-app-border)] hover:border-[var(--color-app-border-strong)] bg-white'
                    )}
                  >
                    <p className="text-sm font-medium">{d}</p>
                    <p className="text-[11px] text-[var(--color-app-text-muted)] mt-0.5">{DISPOSITION_META[d].hint}</p>
                  </button>
                ))}
              </div>
              {disposition === 'Usar como está' && !ncr.notify_customer && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--color-app-warning)]">
                  <AlertTriangle className="h-3.5 w-3.5" /> Una concesión normalmente requiere autorización escrita del cliente.
                </p>
              )}
              <Field label="Justificación / autorización">
                <Textarea rows={2} value={dispositionNotes} onChange={e => setDispositionNotes(e.target.value)} placeholder="Quién autorizó, condiciones, número de concesión…" disabled={closed} />
              </Field>
              {ncr.bom_item_id && disposition && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={applyToPart} onChange={e => setApplyToPart(e.target.checked)} disabled={closed} />
                  Actualizar la pieza a <b>{DISPOSITION_META[disposition].next}</b> al guardar
                </label>
              )}
              {ncr.disposition_by && (
                <p className="text-[11px] text-[var(--color-app-text-muted)]">
                  Última disposición por {ncr.disposition_by}{ncr.disposition_at ? ` · ${format(new Date(ncr.disposition_at), 'dd MMM yyyy HH:mm', { locale: es })}` : ''}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--color-app-text-muted)]">
                Pregunta “¿por qué?” hasta llegar a la causa de fondo (método, máquina, material, mano de obra, medición, medio ambiente).
              </p>
              {whys.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-app-text-muted)] w-[5.5rem] shrink-0 whitespace-nowrap">¿Por qué? {i + 1}</span>
                  <Input
                    value={w}
                    disabled={closed}
                    onChange={e => setWhys(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={i === 0 ? 'Ej. El diámetro salió 0.06 mm arriba' : ''}
                  />
                </div>
              ))}
              <Field label="Causa raíz (conclusión)">
                <Textarea rows={2} value={rootCause} onChange={e => setRootCause(e.target.value)} disabled={closed} />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--color-app-text-muted)]">
                  Acciones para eliminar la causa raíz. Aparecen también en el action list del proyecto.
                </p>
                <Button size="sm" onClick={() => setCaModal({ open: true, action: null })} disabled={closed}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva acción
                </Button>
              </div>
              {linked.length === 0 ? (
                <p className="text-sm text-[var(--color-app-text-muted)] text-center py-6 rounded-lg border border-dashed border-[var(--color-app-border)]">
                  Sin acciones ligadas a esta NCR.
                </p>
              ) : (
                <div className="space-y-2">
                  {linked.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setCaModal({ open: true, action: a })}
                      className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-[var(--color-app-border)] bg-white p-3 hover:border-[var(--color-app-border-strong)]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-[11px] text-[var(--color-app-text-muted)]">
                          <span className="font-mono">{a.id}</span> · {a.responsible ?? 'sin responsable'} · compromiso {a.due_date ?? '—'}
                        </p>
                      </div>
                      <Badge variant={CA_STATUS_VARIANT[a.status]}>{a.status}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                {[
                  ['Contención', done[1]],
                  ['Disposición', done[2]],
                  ['Causa raíz', done[3]],
                  [`Acciones ${linked.length - openLinked.length}/${linked.length}`, linked.length > 0 && openLinked.length === 0],
                  ['Verificación', !!verification.trim()],
                ].map(([label, ok]) => (
                  <span
                    key={String(label)}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2 py-1.5',
                      ok ? 'border-[var(--color-app-success)]/40 text-[var(--color-app-success)]' : 'border-[var(--color-app-border)] text-[var(--color-app-text-muted)]'
                    )}
                  >
                    {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} {label}
                  </span>
                ))}
              </div>
              <Field label="Verificación de eficacia (evidencia)">
                <Textarea rows={3} value={verification} onChange={e => setVerification(e.target.value)} disabled={closed} placeholder="Ej. Se inspeccionaron 3 lotes posteriores (30 pzas) sin desviación en Ø exterior." />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="¿La acción fue eficaz?">
                  <select className={SELECT_CLS} value={effective} onChange={e => setEffective(e.target.value as '' | 'si' | 'no')} disabled={closed}>
                    <option value="">Pendiente</option>
                    <option value="si">Sí — no se ha repetido</option>
                    <option value="no">No — reabrir análisis</option>
                  </select>
                </Field>
                <Field label="Costo de la no calidad (MXN)">
                  <Input type="number" min={0} value={cost} onChange={e => setCost(e.target.value)} disabled={closed} placeholder="Material + horas de retrabajo" />
                </Field>
              </div>
            </div>
          )}
        </div>

        {notice && <p className="text-sm text-[var(--color-app-success)]">{notice}</p>}
        {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={printRecord}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir registro
          </Button>
          <div className="flex-1" />
          {closed ? (
            <Button variant="outline" onClick={handleReopen} disabled={loading}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reabrir
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleSave} disabled={loading}>
                {loading ? 'Guardando…' : 'Guardar avance'}
              </Button>
              {step < 5 ? (
                <Button onClick={async () => { await handleSave(); setStep(s => Math.min(5, s + 1)); }} disabled={loading}>
                  Siguiente paso
                </Button>
              ) : (
                <Button onClick={handleClose} disabled={loading} className="bg-[var(--color-app-success)] hover:bg-[var(--color-app-success)]/90">
                  <ShieldCheck className="h-4 w-4 mr-1.5" /> Cerrar NCR
                </Button>
              )}
            </>
          )}
        </DialogFooter>

        <CorrectiveActionModal
          open={caModal.open}
          action={caModal.action}
          lockProject
          initial={{
            project_id: ncr.project_id,
            source_area: 'Calidad',
            source_type: 'NCR',
            ncr_id: ncr.id,
            source_ref: ncr.id,
            title: `Eliminar causa: ${ncr.defect_type ?? 'no conformidad'} en ${ncr.part_number ?? 'pieza'}`,
            problem: ncr.issue_description,
            root_cause: rootCause || null,
            priority: ncr.severity === 'Alta' || ncr.severity === 'Crítica' ? 'Alta' : 'Media',
          }}
          onClose={() => setCaModal({ open: false, action: null })}
          onSaved={async () => { await refetchCas(); onChanged?.(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
