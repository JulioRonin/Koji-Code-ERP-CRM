import React, { useEffect, useMemo, useState } from 'react';
import {
  Truck,
  Plus,
  Printer,
  Package,
  QrCode,
  ChevronRight,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useShipments,
  useCreateShipment,
  useShippingLabels,
  useCreateShippingLabel,
  useShippingLabelItems,
  useUpdateShipmentStatus,
  useProjects,
  useGenerateClientPortalToken,
  useClientPortalToken,
} from '@/lib/api';
import type { Shipment, ShippingLabel, ShipmentStatus } from '@/types/database';
import { BoxLabel } from '@/components/shipping/BoxLabel';
import { cn } from '@/lib/utils';

const statusBadge: Record<ShipmentStatus, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  Preparando:   'secondary',
  Listo:        'warning',
  'En Tránsito': 'default',
  Entregado:    'success',
  Cancelado:    'outline',
};

export function Shipping() {
  const { data: projects } = useProjects();
  const { data: shipments, refetch: refetchShipments } = useShipments();
  const { create: createShipment } = useCreateShipment();
  const { update: updateShipmentStatus } = useUpdateShipmentStatus();

  const [creatingForProject, setCreatingForProject] = useState<string | ''>('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const handleCreateShipment = async () => {
    if (!creatingForProject) return;
    await createShipment({ project_id: creatingForProject });
    setCreatingForProject('');
    await refetchShipments();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Embarques</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Packing lists, etiquetas QR y portal de seguimiento para clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={creatingForProject}
            onChange={e => setCreatingForProject(e.target.value)}
            className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
          >
            <option value="">Selecciona proyecto...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.name}
              </option>
            ))}
          </select>
          <Button onClick={handleCreateShipment} disabled={!creatingForProject}>
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo embarque
          </Button>
        </div>
      </div>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>Embarques activos</CardTitle>
          <CardDescription>Cada embarque agrupa una o más cajas con etiquetas QR.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {shipments.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-app-text-muted)]">
              No hay embarques. Selecciona un proyecto arriba y crea el primero.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Carrier / tracking</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map(s => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedShipment(s)}>
                    <TableCell className="font-mono text-xs">{s.id}</TableCell>
                    <TableCell className="font-mono text-xs">{s.project_id}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[s.status]}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">
                      {s.carrier ?? '—'} {s.tracking_number ? `· ${s.tracking_number}` : ''}
                    </TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)] text-sm">
                      {new Date(s.created_at).toLocaleDateString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedShipment && (
        <ShipmentDrawer
          shipment={selectedShipment}
          onClose={() => setSelectedShipment(null)}
          onStatusChange={async (status, tracking) => {
            await updateShipmentStatus(selectedShipment.id, status, tracking);
            await refetchShipments();
            setSelectedShipment({ ...selectedShipment, status, tracking_number: tracking ?? selectedShipment.tracking_number });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ShipmentDrawer({
  shipment,
  onClose,
  onStatusChange,
}: {
  shipment: Shipment;
  onClose: () => void;
  onStatusChange: (status: ShipmentStatus, tracking?: string) => Promise<void>;
}) {
  const { data: projects } = useProjects();
  const project = projects.find(p => p.id === shipment.project_id);
  const { data: labels, refetch: refetchLabels } = useShippingLabels(shipment.id);
  const { create: createLabel } = useCreateShippingLabel();
  const { generate: generateToken } = useGenerateClientPortalToken();
  const { data: existingToken } = useClientPortalToken(shipment.project_id);

  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [printingLabel, setPrintingLabel] = useState<ShippingLabel | null>(null);
  const [carrierInput, setCarrierInput] = useState(shipment.carrier ?? '');
  const [trackingInput, setTrackingInput] = useState(shipment.tracking_number ?? '');

  const [labelDraft, setLabelDraft] = useState({
    boxNumber: `1 de ${labels.length + 1}`,
    weight: '',
    dimensions: '',
    items: [{ description: '', quantity: 1, uom: 'Pzas' }] as { description: string; quantity: number; uom: string }[],
  });

  const handleCreateLabel = async () => {
    await createLabel({
      shipment_id: shipment.id,
      box_number: labelDraft.boxNumber || `${labels.length + 1}`,
      weight_kg: labelDraft.weight ? Number(labelDraft.weight) : undefined,
      dimensions_cm: labelDraft.dimensions || undefined,
      items: labelDraft.items.filter(it => it.description),
    });
    setShowCreateLabel(false);
    setLabelDraft({
      boxNumber: `${labels.length + 2} de ${labels.length + 2}`,
      weight: '',
      dimensions: '',
      items: [{ description: '', quantity: 1, uom: 'Pzas' }],
    });
    await refetchLabels();
  };

  const handlePrint = async (label: ShippingLabel) => {
    let token = existingToken;
    if (!token) {
      token = await generateToken(shipment.project_id);
    }
    setPrintingLabel(label);
    // Pequeño delay para que el modal renderice antes del print
    setTimeout(() => window.print(), 200);
  };

  const trackingBaseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/cliente`;
  }, []);

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-[var(--color-app-text-muted)]" />
            {shipment.id} · {project?.name ?? shipment.project_id}
          </DialogTitle>
          <DialogDescription>
            Crea cajas con etiquetas QR y actualiza el estatus del embarque.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status + carrier */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-app-text-muted)]">Estado actual</p>
                  <Badge variant={statusBadge[shipment.status]}>{shipment.status}</Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(['Preparando', 'Listo', 'En Tránsito', 'Entregado'] as ShipmentStatus[]).map(s => (
                    <Button
                      key={s}
                      variant={shipment.status === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onStatusChange(s, trackingInput || undefined)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--color-app-text-muted)]">Carrier</label>
                  <Input value={carrierInput} onChange={e => setCarrierInput(e.target.value)} placeholder="DHL, Estafeta..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--color-app-text-muted)]">Tracking number</label>
                  <Input value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="Número de guía" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Labels list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Cajas / etiquetas ({labels.length})
                </CardTitle>
              </div>
              <Button size="sm" onClick={() => setShowCreateLabel(s => !s)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva caja
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {showCreateLabel && (
                <div className="p-3 border border-[var(--color-app-border)] rounded-md bg-[var(--color-app-surface-alt)]/50 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-app-text-muted)]">Caja #</label>
                      <Input
                        value={labelDraft.boxNumber}
                        onChange={e => setLabelDraft({ ...labelDraft, boxNumber: e.target.value })}
                        placeholder="1 de 5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-app-text-muted)]">Peso (kg)</label>
                      <Input
                        type="number"
                        value={labelDraft.weight}
                        onChange={e => setLabelDraft({ ...labelDraft, weight: e.target.value })}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-[var(--color-app-text-muted)]">Dimensiones</label>
                      <Input
                        value={labelDraft.dimensions}
                        onChange={e => setLabelDraft({ ...labelDraft, dimensions: e.target.value })}
                        placeholder="30x20x15"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-app-text-muted)]">Contenido</label>
                    {labelDraft.items.map((it, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_80px_36px] gap-2">
                        <Input
                          value={it.description}
                          onChange={e => {
                            const next = [...labelDraft.items];
                            next[i] = { ...next[i], description: e.target.value };
                            setLabelDraft({ ...labelDraft, items: next });
                          }}
                          placeholder="Descripción de la pieza"
                        />
                        <Input
                          type="number"
                          value={it.quantity}
                          onChange={e => {
                            const next = [...labelDraft.items];
                            next[i] = { ...next[i], quantity: Number(e.target.value) };
                            setLabelDraft({ ...labelDraft, items: next });
                          }}
                          placeholder="Qty"
                        />
                        <Input
                          value={it.uom}
                          onChange={e => {
                            const next = [...labelDraft.items];
                            next[i] = { ...next[i], uom: e.target.value };
                            setLabelDraft({ ...labelDraft, items: next });
                          }}
                          placeholder="UOM"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() =>
                            setLabelDraft({
                              ...labelDraft,
                              items: labelDraft.items.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLabelDraft({
                          ...labelDraft,
                          items: [...labelDraft.items, { description: '', quantity: 1, uom: 'Pzas' }],
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar pieza
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setShowCreateLabel(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateLabel}>Crear etiqueta</Button>
                  </div>
                </div>
              )}

              {labels.length === 0 && !showCreateLabel && (
                <p className="text-center text-sm text-[var(--color-app-text-muted)] py-4">
                  Aún no hay cajas. Crea la primera arriba.
                </p>
              )}

              {labels.map(label => (
                <LabelRow
                  key={label.id}
                  label={label}
                  onPrint={() => handlePrint(label)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="no-print-in-label">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>

        {/* Print preview (oculto en pantalla salvo al imprimir) */}
        {printingLabel && project && existingToken && (
          <BoxLabelPrintWrapper
            project={project}
            shipment={shipment}
            label={printingLabel}
            trackingUrl={`${trackingBaseUrl}/${existingToken}`}
            onDone={() => setPrintingLabel(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabelRow({ label, onPrint }: { label: ShippingLabel; onPrint: () => void }) {
  const { data: items } = useShippingLabelItems(label.id);
  return (
    <div className="flex items-center justify-between p-3 border border-[var(--color-app-border)] rounded-md">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center">
          <QrCode className="h-4 w-4 text-[var(--color-app-text-muted)]" />
        </div>
        <div>
          <p className="text-sm font-medium">Caja {label.box_number}</p>
          <p className="text-xs text-[var(--color-app-text-muted)]">
            {items.length} items · {label.weight_kg ? `${label.weight_kg} kg` : 'sin peso'}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onPrint}>
        <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir
      </Button>
    </div>
  );
}

function BoxLabelPrintWrapper({
  project,
  shipment,
  label,
  trackingUrl,
  onDone,
}: {
  project: any;
  shipment: Shipment;
  label: ShippingLabel;
  trackingUrl: string;
  onDone: () => void;
}) {
  const { data: items } = useShippingLabelItems(label.id);

  useEffect(() => {
    const handler = () => onDone();
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] bg-white/95 flex items-center justify-center">
      <BoxLabel project={project} shipment={shipment} label={label} items={items} trackingUrl={trackingUrl} />
    </div>
  );
}

