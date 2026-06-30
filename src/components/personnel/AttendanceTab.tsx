import { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, Clock, Save, AlarmClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useAttendance, useUpsertAttendance, workedHours, compliance,
  type AttendanceRecord, type ComplianceStatus,
} from '@/lib/api';
import type { Profile } from '@/types/database';

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_META: Record<ComplianceStatus, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }> = {
  a_tiempo: { label: 'A tiempo', variant: 'success' },
  retardo: { label: 'Retardo', variant: 'warning' },
  incompleto: { label: 'Sin salida', variant: 'secondary' },
  falta: { label: 'Falta', variant: 'destructive' },
};

/** Tarifa por hora aproximada (sueldo mensual / 30 días / 8 horas). */
const hourlyRate = (monthlySalary: number) => monthlySalary / 30 / 8;

interface Draft {
  id?: string;
  expected_in: string;
  expected_out: string;
  check_in: string | null;
  check_out: string | null;
  paid_hours: number | null;
}

export function AttendanceTab({ staff, isAdmin }: { staff: Profile[]; isAdmin: boolean }) {
  const [workDate, setWorkDate] = useState(todayISO());
  const { data: records, refetch } = useAttendance(workDate);
  const { save } = useUpsertAttendance();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const active = useMemo(() => staff.filter(s => s.status !== 'Inactivo'), [staff]);
  const recByProfile = useMemo(() => {
    const m: Record<string, AttendanceRecord> = {};
    records.forEach(r => { m[r.profile_id] = r; });
    return m;
  }, [records]);

  // Hidrata los borradores cuando cambian los registros / la fecha.
  useEffect(() => {
    const next: Record<string, Draft> = {};
    active.forEach(m => {
      const r = recByProfile[m.id];
      next[m.id] = {
        id: r?.id,
        expected_in: r?.expected_in ?? '09:00',
        expected_out: r?.expected_out ?? '18:00',
        check_in: r?.check_in ?? null,
        check_out: r?.check_out ?? null,
        paid_hours: r?.paid_hours ?? null,
      };
    });
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, workDate, active.length]);

  const getDraft = (id: string): Draft =>
    drafts[id] ?? { expected_in: '09:00', expected_out: '18:00', check_in: null, check_out: null, paid_hours: null };
  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [id]: { ...getDraft(id), ...patch } }));

  const persist = async (member: Profile, d: Draft) => {
    setBusy(member.id);
    try {
      const status = compliance({ ...d, profile_id: member.id, work_date: workDate, status: '', notes: null } as AttendanceRecord);
      await save({
        id: d.id, profile_id: member.id, work_date: workDate,
        expected_in: d.expected_in, expected_out: d.expected_out,
        check_in: d.check_in, check_out: d.check_out, paid_hours: d.paid_hours, status,
      });
      await refetch();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doCheckIn = (member: Profile) => {
    const d = { ...getDraft(member.id), check_in: nowHHMM() };
    setDraft(member.id, { check_in: d.check_in });
    persist(member, d);
  };
  const doCheckOut = (member: Profile) => {
    const cur = getDraft(member.id);
    const check_out = nowHHMM();
    const worked = workedHours({ check_in: cur.check_in, check_out });
    const d = { ...cur, check_out, paid_hours: cur.paid_hours ?? Number(worked.toFixed(2)) };
    setDraft(member.id, { check_out: d.check_out, paid_hours: d.paid_hours });
    persist(member, d);
  };

  const rows = active.map(m => {
    const d = getDraft(m.id);
    const worked = workedHours({ check_in: d.check_in, check_out: d.check_out });
    const paid = d.paid_hours ?? worked;
    const status = compliance({ ...d, profile_id: m.id, work_date: workDate, status: '', notes: null } as AttendanceRecord);
    const pay = paid * hourlyRate(m.salary ?? 0);
    return { member: m, d, worked, paid, status, pay };
  });

  const totals = rows.reduce((t, r) => ({ paid: t.paid + r.paid, pay: t.pay + r.pay }), { paid: 0, pay: 0 });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5"><AlarmClock className="h-3.5 w-3.5" /> Fecha</label>
            <Input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} className="w-44" />
          </div>
          <div className="ml-auto flex gap-6 text-sm">
            <div><span className="text-[var(--color-app-text-muted)]">Horas pagadas: </span><span className="font-semibold tabular-nums">{totals.paid.toFixed(1)} h</span></div>
            <div><span className="text-[var(--color-app-text-muted)]">Monto del día: </span><span className="font-semibold tabular-nums">{money(totals.pay)}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-center">Horario</TableHead>
                <TableHead className="text-center">Entrada</TableHead>
                <TableHead className="text-center">Salida</TableHead>
                <TableHead className="text-right">Trabajadas</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right w-28">Horas pagadas</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Checador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ member, d, worked, paid, status, pay }) => {
                const meta = STATUS_META[status];
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{member.full_name}</div>
                      <div className="text-[11px] text-[var(--color-app-text-muted)]">{member.role}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Input type="time" disabled={!isAdmin} value={d.expected_in} onChange={e => setDraft(member.id, { expected_in: e.target.value })} onBlur={() => persist(member, getDraft(member.id))} className="h-8 w-24 text-xs" />
                        <span className="text-[var(--color-app-text-subtle)]">–</span>
                        <Input type="time" disabled={!isAdmin} value={d.expected_out} onChange={e => setDraft(member.id, { expected_out: e.target.value })} onBlur={() => persist(member, getDraft(member.id))} className="h-8 w-24 text-xs" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input type="time" disabled={!isAdmin} value={d.check_in ?? ''} onChange={e => setDraft(member.id, { check_in: e.target.value || null })} onBlur={() => persist(member, getDraft(member.id))} className="h-8 w-24 text-xs mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input type="time" disabled={!isAdmin} value={d.check_out ?? ''} onChange={e => setDraft(member.id, { check_out: e.target.value || null })} onBlur={() => persist(member, getDraft(member.id))} className="h-8 w-24 text-xs mx-auto" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[var(--color-app-text-muted)]">{worked.toFixed(1)} h</TableCell>
                    <TableCell className="text-center"><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.5" disabled={!isAdmin}
                        value={d.paid_hours ?? ''}
                        placeholder={worked.toFixed(1)}
                        onChange={e => setDraft(member.id, { paid_hours: e.target.value === '' ? null : Number(e.target.value) })}
                        onBlur={() => persist(member, getDraft(member.id))}
                        className="h-8 w-20 text-right text-xs ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(pay)}</TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8" disabled={busy === member.id} onClick={() => doCheckIn(member)} title="Registrar entrada">
                            <LogIn className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8" disabled={busy === member.id} onClick={() => doCheckOut(member)} title="Registrar salida">
                            <LogOut className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8" disabled={busy === member.id} onClick={() => persist(member, getDraft(member.id))} title="Guardar">
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-[var(--color-app-text-muted)]">Sin colaboradores activos.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--color-app-text-muted)] flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Las horas pagadas se calculan automáticamente de la jornada y puedes ajustarlas; el pago estimado usa la
        tarifa por hora (sueldo mensual ÷ 30 ÷ 8). Úsalo como base para percepciones/deducciones en Nómina.
      </p>
    </div>
  );
}
