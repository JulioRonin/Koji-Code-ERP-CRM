import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CaArea } from '@/types/database';
import { CorrectiveActionModal } from './CorrectiveActionModal';

/**
 * Botón para que cualquier área (Producción, Diseño, Compras…) levante una
 * acción correctiva que alimenta el action list del proyecto.
 */
export function NewCorrectiveActionButton({
  area,
  projectId,
  label = 'Acción correctiva',
  size = 'default',
}: {
  area: CaArea;
  projectId?: string | null;
  label?: string;
  size?: 'default' | 'sm';
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <>
      <Button variant="outline" size={size} onClick={() => { setDone(null); setOpen(true); }} title={done ? `Registrada: ${done}` : undefined}>
        <ShieldAlert className="h-4 w-4 mr-1.5" /> {done ? `${label} ✓` : label}
      </Button>
      <CorrectiveActionModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={ca => setDone(ca.id)}
        initial={{ source_area: area, source_type: area === 'Compras' ? 'Proveedor' : 'Mejora', project_id: projectId ?? null }}
      />
    </>
  );
}
