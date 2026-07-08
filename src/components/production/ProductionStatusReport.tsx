import { useMemo } from 'react';
import { Users, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTechnicians } from '@/lib/api';
import type { BomItem, ManufacturingStatus } from '@/types/database';

interface Props {
  projectName?: string;
  selectedProjectId: string;
  bomItems: BomItem[];
}

const STATUS_ORDER: ManufacturingStatus[] = [
  'PENDIENTE',
  'EN PROCESO',
  'CALIDAD',
  'TERMINADO',
  'RECHAZADO',
];

const STATUS_META: Record<
  ManufacturingStatus,
  { label: string; color: string; badge: 'secondary' | 'default' | 'warning' | 'success' | 'destructive' }
> = {
  PENDIENTE: { label: 'Pendiente', color: 'var(--color-app-text-subtle)', badge: 'secondary' },
  'EN PROCESO': { label: 'En proceso', color: 'var(--color-app-primary)', badge: 'default' },
  CALIDAD: { label: 'En calidad', color: 'var(--color-app-warning)', badge: 'warning' },
  TERMINADO: { label: 'Terminada', color: 'var(--color-app-success)', badge: 'success' },
  RECHAZADO: { label: 'Rechazada', color: 'var(--color-app-danger)', badge: 'destructive' },
};

interface TechRow {
  id: string | null;
  name: string;
  total: number;
  qty: number;
  counts: Record<ManufacturingStatus, number>;
}

function StatTile({
  label, hint, value, suffix, color, emphasis,
}: {
  label: string;
  hint: string;
  value: number;
  suffix: string;
  color: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: emphasis ? color : 'var(--color-app-border)',
        background: emphasis ? 'color-mix(in srgb, var(--color-app-primary) 7%, white)' : 'white',
      }}
    >
      <div className="text-xs font-medium text-[var(--color-app-text-muted)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
        <span className="text-xs text-[var(--color-app-text-muted)]">{suffix}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--color-app-text-subtle)]">{hint}</div>
    </div>
  );
}

export function ProductionStatusReport({ projectName, selectedProjectId, bomItems }: Props) {
  const { data: technicians } = useTechnicians();

  const parts = useMemo(() => bomItems.filter(p => p.production_relevant !== false), [bomItems]);
  const total = parts.length;
  const totalQty = useMemo(
    () => parts.reduce((s, p) => s + (p.production_quantity ?? p.quantity ?? 0), 0),
    [parts]
  );

  // Distribución por estatus (conteo de piezas/renglones).
  const byStatus = useMemo(() => {
    const acc: Record<ManufacturingStatus, number> = {
      PENDIENTE: 0, 'EN PROCESO': 0, CALIDAD: 0, TERMINADO: 0, RECHAZADO: 0,
    };
    parts.forEach(p => {
      const s = (p.manufacturing_status ?? 'PENDIENTE') as ManufacturingStatus;
      if (acc[s] != null) acc[s] += 1;
    });
    return acc;
  }, [parts]);

  // Carga por técnico.
  const techRows = useMemo<TechRow[]>(() => {
    const map = new Map<string | null, TechRow>();
    const ensure = (id: string | null, name: string): TechRow => {
      let row = map.get(id);
      if (!row) {
        row = {
          id, name, total: 0, qty: 0,
          counts: { PENDIENTE: 0, 'EN PROCESO': 0, CALIDAD: 0, TERMINADO: 0, RECHAZADO: 0 },
        };
        map.set(id, row);
      }
      return row;
    };
    parts.forEach(p => {
      const techId = p.assigned_technician_id ?? null;
      const name = techId
        ? technicians.find(t => t.id === techId)?.full_name ?? 'Técnico'
        : 'Sin asignar';
      const row = ensure(techId, name);
      row.total += 1;
      row.qty += p.production_quantity ?? p.quantity ?? 0;
      const s = (p.manufacturing_status ?? 'PENDIENTE') as ManufacturingStatus;
      if (row.counts[s] != null) row.counts[s] += 1;
    });
    // Asignados primero (orden desc por total), "Sin asignar" al final.
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return b.total - a.total;
    });
  }, [parts, technicians]);

  if (!selectedProjectId || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reporte de estatus</CardTitle>
          <CardDescription>Panorama de avance por estatus y por técnico.</CardDescription>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center border-t border-dashed border-[var(--color-app-border)]">
          <p className="text-sm text-[var(--color-app-text-muted)]">
            {selectedProjectId
              ? 'Este proyecto no tiene piezas de producción.'
              : 'Selecciona un proyecto en el panel superior para desplegar el reporte.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Producción real = lo que ya salió de máquina (en calidad + terminado).
  const realProduced = byStatus.CALIDAD + byStatus.TERMINADO;

  return (
    <div className="space-y-6">
      {/* Tiles de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Producción real"
          hint="en calidad + terminadas"
          value={realProduced}
          suffix={`${pct(realProduced)}%`}
          color="var(--color-app-primary)"
          emphasis
        />
        <StatTile label="Terminadas" hint="aprobadas" value={byStatus.TERMINADO} suffix={`${pct(byStatus.TERMINADO)}%`} color="var(--color-app-success)" />
        <StatTile label="En proceso" hint="en el piso" value={byStatus['EN PROCESO']} suffix="WIP" color="var(--color-app-warning)" />
        <StatTile label="Total piezas" hint={`${totalQty.toLocaleString('es-MX')} unidades`} value={total} suffix="a fabricar" color="var(--color-app-text)" />
      </div>

      {/* Distribución por estatus */}
      <Card className="p-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-[var(--color-app-primary)]" />
                Distribución por estatus
              </CardTitle>
              <CardDescription>
                {projectName ?? selectedProjectId} · {total} piezas · {totalQty.toLocaleString('es-MX')} unidades
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          {STATUS_ORDER.map(s => {
            const meta = STATUS_META[s];
            const count = byStatus[s];
            return (
              <div key={s} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                    <span className="font-medium text-[var(--color-app-text)]">{meta.label}</span>
                  </span>
                  <span className="text-[var(--color-app-text-muted)] tabular-nums">
                    {count} <span className="text-[var(--color-app-text-subtle)]">({pct(count)}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-app-surface-alt)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct(count)}%`, background: meta.color }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Carga por técnico */}
      <Card className="p-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--color-app-primary)]" />
            Avance por técnico
          </CardTitle>
          <CardDescription>Piezas asignadas y cuántas llevan listas en este proyecto.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Técnico</TableHead>
                <TableHead className="text-center">Asignadas</TableHead>
                {STATUS_ORDER.map(s => (
                  <TableHead key={s} className="text-center">{STATUS_META[s].label}</TableHead>
                ))}
                <TableHead className="w-40">Listas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techRows.map(row => {
                const donePct = row.total > 0 ? Math.round((row.counts.TERMINADO / row.total) * 100) : 0;
                return (
                  <TableRow key={row.id ?? 'unassigned'}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={row.id ? 'font-medium' : 'italic text-[var(--color-app-text-muted)]'}>
                          {row.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">{row.total}</TableCell>
                    {STATUS_ORDER.map(s => (
                      <TableCell key={s} className="text-center tabular-nums">
                        {row.counts[s] > 0 ? (
                          <Badge variant={STATUS_META[s].badge} className="text-[10px] tabular-nums">
                            {row.counts[s]}
                          </Badge>
                        ) : (
                          <span className="text-[var(--color-app-text-subtle)]">—</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={donePct} className="h-1.5 flex-1" />
                        <span className="text-xs text-[var(--color-app-text-muted)] tabular-nums w-9 text-right">
                          {donePct}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
