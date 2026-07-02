import { useMemo, useState } from 'react';
import { Download, Save, Banknote, Wand2, Receipt as ReceiptIcon, History, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCompany } from '@/contexts/CompanyContext';
import { usePayrollRuns, useSavePayrollRun, type PayrollItem } from '@/lib/api';
import {
  computePayrollLine, estimateDeductions, payrollCsv, payrollMoney as money,
  PERIODICITY_LABEL, type Periodicity,
} from '@/lib/payroll';
import type { Profile } from '@/types/database';

interface Adj { absences: number; bonus: number; deductions: number }

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function defaultPeriodLabel(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function PayrollTab({ staff, isAdmin }: { staff: Profile[]; isAdmin: boolean }) {
  const { data: runs, refetch } = usePayrollRuns();
  const { save, loading: saving } = useSavePayrollRun();
  const [periodicity, setPeriodicity] = useState<Periodicity>('mensual');
  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel());
  const [estPct, setEstPct] = useState('0');
  const [adj, setAdj] = useState<Record<string, Adj>>({});
  const [receipt, setReceipt] = useState<{ member: Profile; line: ReturnType<typeof computePayrollLine> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const active = useMemo(() => staff.filter(s => s.status !== 'Inactivo'), [staff]);

  const getAdj = (id: string): Adj => adj[id] ?? { absences: 0, bonus: 0, deductions: 0 };
  const setRow = (id: string, patch: Partial<Adj>) =>
    setAdj(prev => ({ ...prev, [id]: { ...getAdj(id), ...patch } }));

  const lines = useMemo(() => active.map(m => {
    const a = getAdj(m.id);
    const line = computePayrollLine({
      monthlySalary: m.salary ?? 0,
      periodicity,
      absences: a.absences,
      bonus: a.bonus,
      deductions: a.deductions,
    });
    return { member: m, adj: a, line };
  }), [active, adj, periodicity]);

  const totals = useMemo(() => lines.reduce(
    (t, l) => ({
      perceptions: t.perceptions + l.line.perceptions,
      deductions: t.deductions + l.line.deductions,
      net: t.net + l.line.net,
    }),
    { perceptions: 0, deductions: 0, net: 0 }
  ), [lines]);

  const applyEstimate = () => {
    const pct = Number(estPct) || 0;
    setAdj(prev => {
      const next = { ...prev };
      lines.forEach(l => {
        const cur = next[l.member.id] ?? { absences: 0, bonus: 0, deductions: 0 };
        next[l.member.id] = { ...cur, deductions: estimateDeductions(l.line.perceptions, pct) };
      });
      return next;
    });
  };

  const toItems = (): PayrollItem[] => lines.map(l => ({
    profile_id: l.member.id,
    name: l.member.full_name,
    monthly_salary: l.member.salary ?? 0,
    absences: l.adj.absences,
    bonus: l.adj.bonus,
    deductions: l.line.deductions,
    perceptions: l.line.perceptions,
    net: l.line.net,
  }));

  const exportCsv = () => {
    const csv = payrollCsv(periodLabel, lines.map(l => ({
      name: l.member.full_name, perceptions: l.line.perceptions, deductions: l.line.deductions, net: l.line.net,
    })));
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina-${periodLabel.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const persist = async (status: 'borrador' | 'dispersada') => {
    setMsg(null);
    try {
      await save({ period_label: periodLabel, periodicity, status, items: toItems() });
      await refetch();
      setMsg(status === 'dispersada' ? 'Nómina dispersada y guardada.' : 'Borrador guardado.');
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Colaboradores" value={String(active.length)} icon={Banknote} />
        <KpiCard label="Percepciones" value={money(totals.perceptions)} icon={Banknote} />
        <KpiCard label="Deducciones" value={money(totals.deductions)} icon={Banknote} />
        <KpiCard label="Neto a pagar" value={money(totals.net)} icon={Banknote} highlight />
      </div>

      {/* Controles del periodo */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Periodo</label>
            <Input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Periodicidad</label>
            <select
              value={periodicity}
              onChange={e => setPeriodicity(e.target.value as Periodicity)}
              className="h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40"
            >
              {(Object.keys(PERIODICITY_LABEL) as Periodicity[]).map(p => (
                <option key={p} value={p}>{PERIODICITY_LABEL[p]}</option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Estimar deducciones (%)</label>
              <div className="flex gap-1.5">
                <Input type="number" value={estPct} onChange={e => setEstPct(e.target.value)} className="w-20" />
                <Button variant="outline" size="sm" className="h-9" onClick={applyEstimate} title="Aplicar % a todos">
                  <Wand2 className="h-3.5 w-3.5 mr-1" /> Aplicar
                </Button>
              </div>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" className="h-9" disabled={saving} onClick={() => persist('borrador')}>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Guardar borrador
                </Button>
                <Button size="sm" className="h-9" disabled={saving} onClick={() => persist('dispersada')}>
                  <Banknote className="h-3.5 w-3.5 mr-1.5" /> Dispersar nómina
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {msg && (
        <div className="p-2.5 rounded-md bg-[var(--color-app-success-soft)]/60 border border-[var(--color-app-success)]/30 text-sm">{msg}</div>
      )}

      {/* Tabla editable */}
      <Card className="p-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Sueldo base</TableHead>
                <TableHead className="text-right w-20">Faltas</TableHead>
                <TableHead className="text-right w-28">Bono</TableHead>
                <TableHead className="text-right">Percepciones</TableHead>
                <TableHead className="text-right w-28">Deducciones</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Recibo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map(({ member, adj: a, line }) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{member.full_name}</div>
                    <div className="text-[11px] text-[var(--color-app-text-muted)]">{member.role}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[var(--color-app-text-muted)]">{money(member.salary ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" disabled={!isAdmin} value={a.absences || ''} onChange={e => setRow(member.id, { absences: Number(e.target.value) || 0 })} className="h-8 w-16 text-right ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" disabled={!isAdmin} value={a.bonus || ''} onChange={e => setRow(member.id, { bonus: Number(e.target.value) || 0 })} className="h-8 w-24 text-right ml-auto" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(line.perceptions)}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" disabled={!isAdmin} value={a.deductions || ''} onChange={e => setRow(member.id, { deductions: Number(e.target.value) || 0 })} className="h-8 w-24 text-right ml-auto" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{money(line.net)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setReceipt({ member, line })} title="Recibo">
                      <ReceiptIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-[var(--color-app-text-muted)]">Sin colaboradores activos.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Historial de corridas */}
      {runs.length > 0 && (
        <Card className="p-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Corridas guardadas</CardTitle>
            <CardDescription>Historial de nóminas generadas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Periodicidad</TableHead>
                  <TableHead className="text-center">Colaboradores</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Generada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.period_label}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{PERIODICITY_LABEL[r.periodicity]}</TableCell>
                    <TableCell className="text-center tabular-nums">{r.items?.length ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{money(r.total_net)}</TableCell>
                    <TableCell className="text-center"><Badge variant={r.status === 'dispersada' ? 'success' : 'secondary'}>{r.status}</Badge></TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)] text-sm">{new Date(r.created_at).toLocaleDateString('es-MX')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {receipt && (
        <ReceiptModal member={receipt.member} line={receipt.line} period={periodLabel} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; highlight?: boolean }) {
  return (
    <Card className="p-0">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--color-app-text-muted)]">{label}</p>
          <p className={`text-xl font-semibold mt-1 ${highlight ? 'text-[var(--color-app-primary)]' : ''}`}>{value}</p>
        </div>
        <Icon className="h-5 w-5 text-[var(--color-app-text-muted)]" />
      </CardContent>
    </Card>
  );
}

function ReceiptModal({ member, line, period, onClose }: {
  member: Profile; line: ReturnType<typeof computePayrollLine>; period: string; onClose: () => void;
}) {
  const { company } = useCompany();
  const brand = company.commercial_name || company.legal_name || 'KANRI';

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <style>{`@media print { body * { visibility: hidden; } #recibo, #recibo * { visibility: visible; } #recibo { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } }`}</style>
        <div className="no-print px-5 py-3 border-b border-[var(--color-app-border)] flex justify-between items-center">
          <span className="text-sm font-medium">Recibo de nómina</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir</Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
        <div id="recibo" className="p-6 text-[#0f172a] space-y-4">
          <div className="flex justify-between items-start border-b border-[#e2e8f0] pb-3">
            <div>
              <p className="font-bold">{company.legal_name || brand}</p>
              {company.rfc && <p className="text-xs text-[#475569] font-mono">RFC: {company.rfc}</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold">Recibo de nómina</p>
              <p className="text-xs text-[#475569]">{period}</p>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-medium">{member.full_name}</p>
            <p className="text-xs text-[#475569]">{member.role} · {member.department}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <Row label="Sueldo del periodo" value={money(line.basePeriod)} />
              {line.absenceDiscount > 0 && <Row label="Descuento por faltas" value={`- ${money(line.absenceDiscount)}`} />}
              <Row label="Percepciones" value={money(line.perceptions)} strong />
              <Row label="Deducciones" value={`- ${money(line.deductions)}`} />
              <tr className="border-t-2 border-[#0f172a]">
                <td className="py-2 font-bold">Neto a pagar</td>
                <td className="py-2 text-right font-bold tabular-nums">{money(line.net)}</td>
              </tr>
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-10 pt-8">
            <div className="border-t border-[#cbd5e1] pt-1 text-center text-xs text-[#475569]">Firma del colaborador</div>
            <div className="border-t border-[#cbd5e1] pt-1 text-center text-xs text-[#475569]">Por la empresa</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className="border-b border-[#e2e8f0]">
      <td className={`py-1.5 ${strong ? 'font-medium' : 'text-[#475569]'}`}>{label}</td>
      <td className={`py-1.5 text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}
