import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects, useProfiles, useNcrs, useUpsertCorrectiveAction, type CorrectiveActionInput } from '@/lib/api';
import type { CaArea, CorrectiveAction } from '@/types/database';
import {
  CA_ACTION_TYPES, CA_AREAS, CA_PRIORITIES, CA_SOURCE_TYPES, CA_STATUSES, SELECT_CLS,
} from './capaMeta';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (ca: CorrectiveAction) => void;
  /** Acción existente a editar. */
  action?: CorrectiveAction | null;
  /** Valores iniciales para una acción nueva (área, proyecto, NCR de origen…). */
  initial?: Partial<CorrectiveActionInput>;
  /** Bloquea el proyecto (cuando se abre desde el detalle de un proyecto). */
  lockProject?: boolean;
}

function emptyInput(user: string | null, initial?: Partial<CorrectiveActionInput>): CorrectiveActionInput {
  const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return {
    project_id: null,
    source_area: 'Calidad',
    source_type: 'NCR',
    source_ref: null,
    ncr_id: null,
    control_plan_item_id: null,
    title: '',
    problem: null,
    root_cause: null,
    action_type: 'Correctiva',
    action: null,
    responsible: null,
    due_date: in14,
    priority: 'Media',
    status: 'Abierta',
    verification: null,
    effective: null,
    verified_by: null,
    verified_at: null,
    created_by: user,
    ...initial,
  };
}

/**
 * Alta / edición de una acción correctiva (CAPA). Se usa desde Calidad,
 * Producción, Diseño, Compras y el detalle del proyecto — el "área de origen"
 * indica quién levantó la acción.
 */
export function CorrectiveActionModal({ open, onClose, onSaved, action, initial, lockProject }: Props) {
  const { user } = useAuth();
  const { data: projects } = useProjects();
  const { data: profiles } = useProfiles();
  const [form, setForm] = useState<CorrectiveActionInput>(() => emptyInput(user?.name ?? null, initial));
  const { data: ncrs } = useNcrs(form.project_id ?? undefined);
  const { save, loading } = useUpsertCorrectiveAction();
  const [error, setError] = useState<string | null>(null);

  // Rehidrata al abrir (nueva o edición).
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (action) {
      const { id: _id, created_at: _c, updated_at: _u, tenant_id: _t, ...rest } = action;
      setForm(rest);
    } else {
      setForm(emptyInput(user?.name ?? null, initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action]);

  const set = <K extends keyof CorrectiveActionInput>(k: K, v: CorrectiveActionInput[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const closing = form.status === 'Cerrada';
  const people = useMemo(() => profiles.map(p => p.full_name).filter(Boolean), [profiles]);

  const handleSave = async () => {
    setError(null);
    if (!form.title.trim()) { setError('Escribe un título para la acción.'); return; }
    if (!form.responsible?.trim()) { setError('Asigna un responsable.'); return; }
    if (closing && !form.verification?.trim()) {
      setError('Para cerrar la acción registra la verificación de eficacia (evidencia).');
      return;
    }
    try {
      const saved = await save(action?.id ?? null, {
        ...form,
        title: form.title.trim(),
        effective: closing ? (form.effective ?? true) : form.effective,
        verified_at: closing ? (form.verified_at ?? new Date().toISOString().slice(0, 10)) : form.verified_at,
        verified_by: closing ? (form.verified_by || user?.name || null) : form.verified_by,
      });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar la acción.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-app-primary)]" />
            {action ? `Acción correctiva ${action.id}` : 'Nueva acción correctiva'}
          </DialogTitle>
          <DialogDescription>
            Problema → causa raíz → acción → responsable y fecha → verificación de eficacia (ISO 9001 §10.2).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Origen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Área de origen">
              <select className={SELECT_CLS} value={form.source_area} onChange={e => set('source_area', e.target.value as CaArea)}>
                {CA_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Tipo de origen">
              <select className={SELECT_CLS} value={form.source_type} onChange={e => set('source_type', e.target.value as CorrectiveActionInput['source_type'])}>
                {CA_SOURCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select className={SELECT_CLS} value={form.priority} onChange={e => set('priority', e.target.value as CorrectiveActionInput['priority'])}>
                {CA_PRIORITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Proyecto">
              <Combobox
                options={projects.map(p => ({ value: p.id, label: `${p.id} — ${p.name}`, hint: p.client_name }))}
                value={form.project_id}
                onChange={v => setForm(f => ({ ...f, project_id: v, ncr_id: null }))}
                placeholder="General (sin proyecto)"
                searchPlaceholder="Buscar proyecto…"
                disabled={lockProject}
              />
            </Field>
            <Field label="Referencia / NCR de origen">
              {form.source_type === 'NCR' && ncrs.length > 0 ? (
                <select
                  className={SELECT_CLS}
                  value={form.ncr_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, ncr_id: e.target.value || null, source_ref: e.target.value || f.source_ref }))}
                >
                  <option value="">— Sin NCR —</option>
                  {ncrs.map(n => <option key={n.id} value={n.id}>{n.id} · {n.part_number || n.issue_description.slice(0, 40)}</option>)}
                </select>
              ) : (
                <Input
                  value={form.source_ref ?? ''}
                  onChange={e => set('source_ref', e.target.value || null)}
                  placeholder="Folio de auditoría, queja, OC, plano…"
                />
              )}
            </Field>
          </div>

          <Field label="Título de la acción *">
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej. Ajustar compensación de herramienta en torno 2" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Descripción del problema">
              <Textarea rows={3} value={form.problem ?? ''} onChange={e => set('problem', e.target.value || null)} placeholder="Qué pasó, dónde, cuántas piezas…" />
            </Field>
            <Field label="Causa raíz">
              <Textarea rows={3} value={form.root_cause ?? ''} onChange={e => set('root_cause', e.target.value || null)} placeholder="Resultado de 5 porqués / Ishikawa" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo de acción">
              <select className={SELECT_CLS} value={form.action_type} onChange={e => set('action_type', e.target.value as CorrectiveActionInput['action_type'])}>
                {CA_ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Responsable *">
              <Input
                list="capa-people"
                value={form.responsible ?? ''}
                onChange={e => set('responsible', e.target.value || null)}
                placeholder="Nombre"
              />
              <datalist id="capa-people">
                {people.map(n => <option key={n} value={n} />)}
              </datalist>
            </Field>
            <Field label="Fecha compromiso">
              <Input type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value || null)} />
            </Field>
          </div>

          <Field label="Acción a implementar">
            <Textarea rows={3} value={form.action ?? ''} onChange={e => set('action', e.target.value || null)} placeholder="Qué se va a hacer para eliminar la causa y evitar que se repita" />
          </Field>

          {/* Seguimiento y verificación */}
          <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)] p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Estatus">
                <select className={SELECT_CLS} value={form.status} onChange={e => set('status', e.target.value as CorrectiveActionInput['status'])}>
                  {CA_STATUSES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Verificó">
                <Input value={form.verified_by ?? ''} onChange={e => set('verified_by', e.target.value || null)} placeholder={user?.name ?? 'Nombre'} />
              </Field>
              <Field label="¿Fue eficaz?">
                <select
                  className={SELECT_CLS}
                  value={form.effective == null ? '' : form.effective ? 'si' : 'no'}
                  onChange={e => set('effective', e.target.value === '' ? null : e.target.value === 'si')}
                >
                  <option value="">Pendiente</option>
                  <option value="si">Sí, eficaz</option>
                  <option value="no">No — reabrir análisis</option>
                </select>
              </Field>
            </div>
            <Field label={closing ? 'Verificación de eficacia (evidencia) *' : 'Verificación de eficacia (evidencia)'}>
              <Textarea rows={2} value={form.verification ?? ''} onChange={e => set('verification', e.target.value || null)} placeholder="Ej. 3 lotes consecutivos sin rechazo; Cpk 1.45 en característica 20.3" />
            </Field>
          </div>

          {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Guardando…' : 'Guardar acción'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <label className="text-xs font-medium text-[var(--color-app-text-muted)]">{label}</label>
      {children}
    </div>
  );
}
