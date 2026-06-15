import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateMachine, useUpdateMachine } from '@/lib/api/production';
import type { Machine, MachineStatus } from '@/types/database';

const STATUS_OPTIONS: MachineStatus[] = [
  'Disponible',
  'Operando',
  'Setup',
  'Mantenimiento',
  'Fuera_Servicio',
];

const STATUS_LABEL: Record<MachineStatus, string> = {
  Disponible: 'Disponible',
  Operando: 'Operando',
  Setup: 'Setup',
  Mantenimiento: 'Mantenimiento',
  Fuera_Servicio: 'Fuera de servicio',
};

interface MachineFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el modal entra en modo edición. */
  machine?: Machine | null;
  onSaved: () => void;
}

export function MachineFormModal({ open, onOpenChange, machine, onSaved }: MachineFormModalProps) {
  const isEdit = !!machine;
  const { create, loading: creating } = useCreateMachine();
  const { update, loading: updating } = useUpdateMachine();

  const [id, setId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<MachineStatus>('Disponible');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Resincroniza el formulario cada vez que se abre o cambia la máquina.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setId(machine?.id ?? '');
    setType(machine?.type ?? '');
    setStatus(machine?.status ?? 'Disponible');
    setLocation(machine?.location ?? '');
    setNotes(machine?.notes ?? '');
  }, [open, machine]);

  const saving = creating || updating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id.trim()) {
      setError('El código de la máquina es obligatorio (ej. CNC-001).');
      return;
    }
    if (!type.trim()) {
      setError('El tipo o modelo de la máquina es obligatorio.');
      return;
    }

    try {
      if (isEdit && machine) {
        await update(machine.id, {
          type: type.trim(),
          status,
          location: location.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await create({
          id: id.trim(),
          type: type.trim(),
          status,
          location: location.trim() || null,
          notes: notes.trim() || null,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar máquina' : 'Dar de alta máquina'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza el estado, ubicación o notas del equipo.'
              : 'Registra un equipo en el catálogo del piso de producción.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-[var(--color-app-danger-soft)] border border-[var(--color-app-danger)]/30 rounded-md text-sm text-[var(--color-app-danger)]">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="machine-id">Código / ID</Label>
            <Input
              id="machine-id"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="CNC-001"
              disabled={isEdit}
              autoFocus={!isEdit}
            />
            {isEdit && (
              <p className="text-xs text-[var(--color-app-text-subtle)]">
                El código no se puede modificar una vez creado.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="machine-type">Tipo / modelo</Label>
            <Input
              id="machine-type"
              value={type}
              onChange={e => setType(e.target.value)}
              placeholder="Centro de maquinado vertical / Haas VF-2"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={status} onValueChange={v => setStatus(v as MachineStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="machine-location">Ubicación</Label>
            <Input
              id="machine-location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Nave 1 — Celda A"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="machine-notes">Notas</Label>
            <Textarea
              id="machine-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Capacidades, mantenimiento programado, observaciones…"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Dar de alta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
