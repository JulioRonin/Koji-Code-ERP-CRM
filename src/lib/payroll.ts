/**
 * Cálculo de nómina (modelo pragmático para MX). Una sola fuente de la verdad
 * para percepciones, deducciones y neto. Los montos se editan por colaborador
 * en cada periodo; el sueldo base viene del perfil (mensual).
 */

export type Periodicity = 'mensual' | 'quincenal' | 'semanal';

export const PERIODICITY_LABEL: Record<Periodicity, string> = {
  mensual: 'Mensual',
  quincenal: 'Quincenal',
  semanal: 'Semanal',
};

/** Fracción del sueldo mensual que corresponde al periodo. */
export function periodFactor(p: Periodicity): number {
  if (p === 'quincenal') return 0.5;
  if (p === 'semanal') return 7 / 30;
  return 1;
}

export interface PayrollLineInput {
  monthlySalary: number; // sueldo base mensual (del perfil)
  periodicity: Periodicity;
  absences: number;      // faltas (días) en el periodo
  bonus: number;         // bono / otras percepciones
  deductions: number;    // deducciones (IMSS/ISR/otras) capturadas
}

export interface PayrollLineResult {
  basePeriod: number;     // sueldo del periodo (antes de faltas)
  absenceDiscount: number;
  perceptions: number;    // total de percepciones
  deductions: number;
  net: number;            // neto a pagar
}

export function computePayrollLine(input: PayrollLineInput): PayrollLineResult {
  const basePeriod = input.monthlySalary * periodFactor(input.periodicity);
  const dailyRate = input.monthlySalary / 30;
  const absenceDiscount = Math.max(0, input.absences) * dailyRate;
  const perceptions = Math.max(0, basePeriod - absenceDiscount) + Math.max(0, input.bonus);
  const deductions = Math.max(0, input.deductions);
  const net = perceptions - deductions;
  return { basePeriod, absenceDiscount, perceptions, deductions, net };
}

/** Estimación rápida de deducciones (IMSS+ISR aprox.) como % de percepciones.
 *  Es solo una ayuda; el admin puede sobreescribir el monto. */
export function estimateDeductions(perceptions: number, pct: number): number {
  return Math.round(perceptions * (pct / 100));
}

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

export interface PayrollExportRow {
  name: string;
  perceptions: number;
  deductions: number;
  net: number;
}

/** Genera el CSV de dispersión bancaria del periodo. */
export function payrollCsv(periodLabel: string, rows: PayrollExportRow[]): string {
  const header = ['Colaborador', 'Periodo', 'Percepciones', 'Deducciones', 'Neto a pagar'];
  const lines = rows.map(r =>
    [csv(r.name), csv(periodLabel), r.perceptions.toFixed(2), r.deductions.toFixed(2), r.net.toFixed(2)].join(',')
  );
  const total = rows.reduce((s, r) => s + r.net, 0);
  lines.push(['TOTAL', csv(periodLabel), '', '', total.toFixed(2)].join(','));
  return [header.join(','), ...lines].join('\n');
}

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export { money as payrollMoney };
