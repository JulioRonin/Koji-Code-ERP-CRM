import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsync } from './useAsync';
import { scopeByTenant } from './tenantScope';
import type { AsyncState, MutationState } from './types';

export interface AttendanceRecord {
  id: string;
  tenant_id?: string | null;
  profile_id: string;
  work_date: string;        // YYYY-MM-DD
  expected_in: string;      // HH:MM
  expected_out: string;     // HH:MM
  check_in: string | null;  // HH:MM
  check_out: string | null; // HH:MM
  paid_hours: number | null;
  status: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

const KEY = 'kanri_demo_attendance';

function read(): AttendanceRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as AttendanceRecord[]; } catch { return []; }
}
function write(rows: AttendanceRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}
function newId(): string {
  return (crypto?.randomUUID && crypto.randomUUID()) || `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Minutos desde medianoche para una hora 'HH:MM' (o null). */
export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Horas trabajadas entre check_in y check_out (0 si falta alguno). */
export function workedHours(r: Pick<AttendanceRecord, 'check_in' | 'check_out'>): number {
  const a = toMinutes(r.check_in);
  const b = toMinutes(r.check_out);
  if (a == null || b == null || b <= a) return 0;
  return (b - a) / 60;
}

export type ComplianceStatus = 'a_tiempo' | 'retardo' | 'incompleto' | 'falta';

/** Evalúa el cumplimiento del horario (con tolerancia en minutos). */
export function compliance(r: AttendanceRecord, toleranceMin = 10): ComplianceStatus {
  if (!r.check_in) return 'falta';
  if (!r.check_out) return 'incompleto';
  const inMin = toMinutes(r.check_in);
  const expIn = toMinutes(r.expected_in);
  if (inMin != null && expIn != null && inMin > expIn + toleranceMin) return 'retardo';
  return 'a_tiempo';
}

export function useAttendance(workDate: string): AsyncState<AttendanceRecord[]> {
  return useAsync<AttendanceRecord[]>(
    async () => {
      if (!supabase) return read().filter(r => r.work_date === workDate);
      const { data, error } = await scopeByTenant(supabase.from('attendance_records').select('*'))
        .eq('work_date', workDate);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    [],
    [workDate]
  );
}

export interface AttendanceInput {
  id?: string;
  profile_id: string;
  work_date: string;
  expected_in?: string;
  expected_out?: string;
  check_in?: string | null;
  check_out?: string | null;
  paid_hours?: number | null;
  status?: string;
  notes?: string | null;
}

export function useUpsertAttendance() {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });

  const save = useCallback(async (input: AttendanceInput): Promise<AttendanceRecord> => {
    setState({ loading: true, error: null });
    try {
      const now = new Date().toISOString();
      const payload = {
        profile_id: input.profile_id,
        work_date: input.work_date,
        expected_in: input.expected_in ?? '09:00',
        expected_out: input.expected_out ?? '18:00',
        check_in: input.check_in ?? null,
        check_out: input.check_out ?? null,
        paid_hours: input.paid_hours ?? null,
        status: input.status ?? 'pendiente',
        notes: input.notes ?? null,
      };

      if (!supabase) {
        const rows = read();
        const idx = rows.findIndex(r => input.id ? r.id === input.id : (r.profile_id === input.profile_id && r.work_date === input.work_date));
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...payload, updated_at: now };
          write(rows);
          setState({ loading: false, error: null });
          return rows[idx];
        }
        const created: AttendanceRecord = { id: newId(), tenant_id: null, created_at: now, updated_at: now, ...payload };
        write([created, ...rows]);
        setState({ loading: false, error: null });
        return created;
      }

      // Upsert por (profile_id, work_date) — clave única en la tabla.
      const { data, error } = await supabase
        .from('attendance_records')
        .upsert({ ...payload, updated_at: now }, { onConflict: 'profile_id,work_date' })
        .select('*')
        .single();
      if (error) throw error;
      setState({ loading: false, error: null });
      return data as AttendanceRecord;
    } catch (err) {
      const e = err as Error;
      setState({ loading: false, error: e });
      throw e;
    }
  }, []);

  return { save, ...state };
}
