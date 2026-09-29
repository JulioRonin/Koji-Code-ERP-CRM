import { useEffect, useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { useBomItems, useCreateNcr, useProjects, useUpsertCorrectiveAction } from '@/lib/api';
import type { BomItem, Ncr, NcrSeverity } from '@/types/database';
import { DEFECT_TYPES, DETECTED_AREAS, SELECT_CLS } from './capaMeta';
import { Field } from './CorrectiveActionModal';
import { QMS_DOC } from './qmsDoc';

const SEVERITIES: NcrSeverity[] = ['Baja', 'Media', 'Alta', 'Crítica'];
const DEFAULT_CONTAINMENT = 'Pieza(s) identificada(s) con etiqueta roja y segregada(s) en área de cuarentena. Se revisa el lote en proceso.';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama con la NCR creada (p. ej. para marcar la pieza como RECHAZADA). */
  onCreated?: (ncr: Ncr) => void | Promise<void>;
  projectId?: string;
  /** Pieza rechazada (cuando se abre desde la bandeja de calidad). */
  item?: BomItem | null;
  lockProject?: boolean;
  /** Área donde se detectó. */
  detectedArea?: string;
}

/**
 * Pasos B1–B2 de la sección 8 (TPNC) del PR-CAL-001: registro de la NCR y
 * contención inmediata. La disposición, causa raíz, acciones y cierre (B3–B6)
 * se trabajan después desde "Analizar".
 */
export function NcrFormModal({ open, onClose, onCreated, projectId, item, lockProject, detectedArea }: Props) {
  const { user } = useAuth();
  const { sendSystemMessage } = useChat();
  const { data: projects } = useProjects();
  const { create, loading } = useCreateNcr();
  const { save: saveCa } = useUpsertCorrectiveAction();

  const [project, setProject] = useState<string | null>(projectId ?? item?.project_id ?? null);
  const { data: bom } = useBomItems(project ?? undefined);
  const [bomItemId, setBomItemId] = useState<string>('');
  const [partNumber, setPartNumber] = useState('');
  const [qty, setQty] = useState('1');
  const [area, setArea] = useState(detectedArea ?? 'Calidad');
  const [defect, setDefect] = useState(DEFECT_TYPES[0]);
  const [severity, setSeverity] = useState<NcrSeverity>('Media');
  const [description, setDescription] = useState('');
  const [containment, setContainment] = useState(DEFAULT_CONTAINMENT);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [raiseCa, setRaiseCa] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProject(projectId ?? item?.project_id ?? null);
    setBomItemId(item?.id ?? '');
    setPartNumber(item?.part_number ?? '');
    setQty(String(item ? item.production_quantity ?? item.quantity ?? 1 : 1));
    setArea(detectedArea ?? 'Calidad');
    setDefect(DEFECT_TYPES[0]);
    setSeverity('Media');
    setDescription('');
    setContainment(DEFAULT_CONTAINMENT);
    setNotifyCustomer(false);
    setRaiseCa(true);
    setError(null);
  }, [open, projectId, item, detectedArea]);

  const pickPart = (id: string) => {
    setBomItemId(id);
    const b = bom.find(x => x.id === id);
    if (b) {
      setPartNumber(b.part_number);
      setQty(String(b.production_quantity ?? b.quantity ?? 1));
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!project) { setError('Selecciona el proyecto.'); return; }
    if (!description.trim()) { setError('Describe la no conformidad (qué característica, valor medido vs especificación).'); return; }
    if (!containment.trim()) { setError('Registra la acción de contención inmediata.'); return; }
    try {
      const ncr = await create({
        project_id: project,
        bom_item_id: bomItemId || null,
        part_number: partNumber.trim() || null,
        quantity_affected: Number(qty) || null,
        detected_area: area,
        defect_type: defect,
        severity,
        issue_description: description.trim(),
        containment: containment.trim(),
        notify_customer: notifyCustomer,
      });

      if (raiseCa) {
        await saveCa(null, {
          project_id: project,
          source_area: 'Calidad',
          source_type: 'NCR',
          source_ref: ncr.id,
          ncr_id: ncr.id,
          control_plan_item_id: null,
          title: `Eliminar causa de ${defect.toLowerCase()} en ${partNumber || 'pieza'}`,
          problem: description.trim(),
          root_cause: null,
          action_type: 'Correctiva',
          action: null,
          responsible: user?.name ?? null,
          due_date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
          priority: severity === 'Alta' || severity === 'Crítica' ? 'Alta' : 'Media',
          status: 'Abierta',
          verification: null,
          effective: null,
          verified_by: null,
          verified_at: null,
          created_by: user?.name ?? null,
        }).catch(() => { /* la NCR ya quedó; la acción se puede levantar después */ });
      }

      sendSystemMessage(
        '5',
        `🔴 ${ncr.id} abierta · ${partNumber || 'pieza'} (${qty} pzas) · ${defect} · severidad ${severity}. Proyecto ${project}. Contención: ${containment.trim()}`,
        'QUALITY'
      );
      await onCreated?.(ncr);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'No se pudo registrar la NCR.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-[var(--color-app-danger)]" />
            Registrar no conformidad (NCR)
          </DialogTitle>
          <DialogDescription>
            {QMS_DOC.code} §{QMS_DOC.section} ({QMS_DOC.sectionShort}), pasos B1–B2: identificar, segregar, registrar y contener. Disposición, causa raíz y cierre (B3–B6) se completan en “Analizar”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Proyecto *">
              <Combobox
                options={projects.map(p => ({ value: p.id, label: `${p.id} — ${p.name}`, hint: p.client_name }))}
                value={project}
                onChange={v => { setProject(v); setBomItemId(''); }}
                placeholder="Selecciona proyecto"
                searchPlaceholder="Buscar proyecto…"
                disabled={lockProject || !!item}
              />
            </Field>
            <Field label="Pieza del BOM">
              <select className={SELECT_CLS} value={bomItemId} onChange={e => pickPart(e.target.value)} disabled={!!item || !project}>
                <option value="">— Sin pieza específica —</option>
                {bom.map(b => <option key={b.id} value={b.id}>{b.part_number}{b.description ? ` · ${b.description.slice(0, 40)}` : ''}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="No. de parte">
              <Input value={partNumber} onChange={e => setPartNumber(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Cantidad afectada">
              <Input type="number" min={0} value={qty} onChange={e => setQty(e.target.value)} />
            </Field>
            <Field label="Detectado en">
              <select className={SELECT_CLS} value={area} onChange={e => setArea(e.target.value)}>
                {DETECTED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Severidad">
              <select className={SELECT_CLS} value={severity} onChange={e => setSeverity(e.target.value as NcrSeverity)}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Tipo de defecto">
            <div className="flex flex-wrap gap-1.5">
              {DEFECT_TYPES.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDefect(d)}
                  className={
                    'px-2.5 py-1 rounded-full border text-xs transition-colors ' +
                    (defect === d
                      ? 'border-[var(--color-app-danger)] bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] font-medium'
                      : 'border-[var(--color-app-border)] bg-white text-[var(--color-app-text-muted)] hover:border-[var(--color-app-border-strong)]')
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Descripción de la no conformidad *">
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Ø exterior 25.06 mm vs especificación 25.00 ±0.02 (op. 20, torno 2). 3 de 10 piezas fuera." />
          </Field>

          <Field label="Contención inmediata *">
            <Textarea rows={2} value={containment} onChange={e => setContainment(e.target.value)} />
          </Field>

          <div className="flex flex-col sm:flex-row gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={raiseCa} onChange={e => setRaiseCa(e.target.checked)} />
              Levantar acción correctiva en el action list
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} />
              Requiere notificar al cliente
            </label>
          </div>

          {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-[var(--color-app-danger)] hover:bg-[var(--color-app-danger)]/90">
            {loading ? 'Registrando…' : item ? 'Rechazar y abrir NCR' : 'Abrir NCR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
