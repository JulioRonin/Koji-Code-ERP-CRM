import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClipboardCheck, Check, X, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import {
  useSaveMaintenanceChecklist,
  useUpsertMaintenanceOrder,
  useLinkChecklistOrder,
} from '@/lib/api';
import { checklistItemsFor, familyLabel, MTO_DOC, SHIFTS, todayStr } from '@/lib/maintenance';
import type { ChecklistResult, Machine, MaintenanceChecklistItem } from '@/types/database';
import { effectiveFamily } from './shared';

interface Props {
  open: boolean;
  onClose: () => void;
  machines: Machine[];
  defaultMachineId?: string | null;
  onSaved?: () => void;
}

const SELECT = 'w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40';

/**
 * Checklist diario de arranque (FR-MTO-001, secciones A y B). Si hay una
 * anomalía, genera la orden correctiva (PR-MTO-001: "Anomalía → orden correctiva").
 */
export function DailyChecklistModal({ open, onClose, machines, defaultMachineId, onSaved }: Props) {
  const { user } = useAuth();
  const { sendSystemMessage } = useChat();
  const { run: saveChecklist, loading } = useSaveMaintenanceChecklist();
  const { run: saveOrder } = useUpsertMaintenanceOrder();
  const { run: linkOrder } = useLinkChecklistOrder();

  const [machineId, setMachineId] = useState<string>('');
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState(SHIFTS[0]);
  const [items, setItems] = useState<MaintenanceChecklistItem[]>([]);
  const [anomalies, setAnomalies] = useState('');
  const [createOrder, setCreateOrder] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const machine = useMemo(() => machines.find(m => m.id === machineId) ?? null, [machines, machineId]);
  const family = machine ? effectiveFamily(machine) : null;

  useEffect(() => {
    if (!open) return;
    setMachineId(defaultMachineId ?? machines[0]?.id ?? '');
    setDate(todayStr());
    setShift(SHIFTS[0]);
    setAnomalies('');
    setCreateOrder(true);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMachineId]);

  useEffect(() => {
    setItems(checklistItemsFor(family));
  }, [machineId, family]);

  const failed = items.filter(i => i.result === 'fail');
  const pending = items.filter(i => i.result == null).length;

  const setResult = (key: string, result: ChecklistResult) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, result: i.result === result ? null : result } : i)));

  const markAllOk = () => setItems(prev => prev.map(i => (i.result == null ? { ...i, result: 'ok' } : i)));

  const handleSave = async () => {
    setError(null);
    if (!machine) { setError('Selecciona el equipo.'); return; }
    if (pending > 0) { setError(`Faltan ${pending} punto(s) por revisar.`); return; }
    if (failed.length > 0 && !anomalies.trim()) { setError('Describe la anomalía detectada (sección C).'); return; }
    try {
      const saved = await saveChecklist({
        machine_id: machine.id,
        check_date: date,
        shift,
        operator_name: user?.name ?? null,
        items,
        anomalies: anomalies.trim() || null,
        has_anomaly: failed.length > 0,
        order_id: null,
      });
      if (failed.length > 0 && createOrder) {
        const order = await saveOrder(null, {
          machine_id: machine.id,
          order_type: 'Correctivo',
          status: 'Programada',
          scheduled_date: date,
          original_date: null,
          reprogram_reason: null,
          problem: `${anomalies.trim()}\nPuntos con anomalía: ${failed.map(f => f.label).join('; ')}`,
          tasks: [],
          performed_by: null,
          loto_applied: false,
          loto_removed: false,
          findings: null,
          parts_used: null,
          downtime_hours: null,
          test_ok: false,
          affects_quality: false,
          first_piece_released: false,
          ncr_id: null,
          checklist_id: saved.id,
          started_at: null,
          completed_at: null,
          created_by: user?.name ?? null,
        });
        await linkOrder(saved.id, order.id);
        sendSystemMessage(
          '4', // canal de producción
          `🛠️ Anomalía en ${machine.id} (${machine.type}) · checklist de arranque ${shift}. Se generó la orden correctiva ${order.id}: ${anomalies.trim()}`,
          'PRODUCTION'
        );
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar el checklist.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[var(--color-app-primary)]" /> Checklist diario de arranque
          </DialogTitle>
          <DialogDescription>
            {MTO_DOC.form} · secciones A y B. Marca cada punto: correcto, anomalía o no aplica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Equipo</label>
              <select className={SELECT} value={machineId} onChange={e => setMachineId(e.target.value)}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.id} · {m.type}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Fecha</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-app-text-muted)]">Turno</label>
              <select className={SELECT} value={shift} onChange={e => setShift(e.target.value)}>
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {machine && (
            <p className="text-xs text-[var(--color-app-text-muted)]">
              Familia: <b className="text-[var(--color-app-text)]">{familyLabel(family)}</b>
              {!family && ' — asígnala en Equipos y plan para ver sus puntos específicos.'}
            </p>
          )}

          <div className="rounded-lg border border-[var(--color-app-border)] divide-y divide-[var(--color-app-border)]">
            {items.map((it, idx) => (
              <div key={it.key} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="text-[var(--color-app-text-subtle)] mr-2 tabular-nums">{idx + 1}</span>{it.label}
                  </p>
                  {it.key.startsWith('s') && <p className="text-[10px] text-[var(--color-app-text-subtle)] ml-5">Específico del equipo</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <ResultButton active={it.result === 'ok'} tone="ok" onClick={() => setResult(it.key, 'ok')} icon={<Check className="h-3.5 w-3.5" />} label="OK" />
                  <ResultButton active={it.result === 'fail'} tone="fail" onClick={() => setResult(it.key, 'fail')} icon={<X className="h-3.5 w-3.5" />} label="Anomalía" />
                  <ResultButton active={it.result === 'na'} tone="na" onClick={() => setResult(it.key, 'na')} icon={<Minus className="h-3.5 w-3.5" />} label="N/A" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-app-text-muted)]">{pending} pendiente(s) · {failed.length} anomalía(s)</span>
            <Button variant="outline" size="sm" onClick={markAllOk} disabled={pending === 0}>Marcar pendientes como OK</Button>
          </div>

          {failed.length > 0 && (
            <div className="space-y-2 rounded-lg border border-[var(--color-app-danger)]/30 bg-[var(--color-app-danger-soft)]/30 p-3">
              <label className="text-xs font-medium">Anomalía detectada (sección C) *</label>
              <Textarea rows={3} value={anomalies} onChange={e => setAnomalies(e.target.value)} placeholder="Qué se encontró y en qué punto: fuga de aceite en bancada, ruido en husillo…" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={createOrder} onChange={e => setCreateOrder(e.target.checked)} />
                Generar orden de mantenimiento correctivo y avisar al chat de Producción
              </label>
            </div>
          )}

          {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !machine}>{loading ? 'Guardando…' : 'Guardar checklist'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultButton({ active, tone, onClick, icon, label }: {
  active: boolean; tone: 'ok' | 'fail' | 'na'; onClick: () => void; icon: ReactNode; label: string;
}) {
  const on = tone === 'ok'
    ? 'bg-[var(--color-app-success)] text-white border-[var(--color-app-success)]'
    : tone === 'fail'
    ? 'bg-[var(--color-app-danger)] text-white border-[var(--color-app-danger)]'
    : 'bg-[var(--color-app-text-muted)] text-white border-[var(--color-app-text-muted)]';
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        'h-8 min-w-8 px-2 rounded-md border text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors',
        active ? on : 'bg-white border-[var(--color-app-border-strong)] text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]'
      )}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}
