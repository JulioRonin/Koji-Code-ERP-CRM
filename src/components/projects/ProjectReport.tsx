import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  Printer,
  TrendingUp,
  Users,
  Activity,
  CheckCircle2,
  Calendar,
  Flag,
  AlertTriangle,
  ShieldCheck,
  X,
  MessageSquare,
  CalendarClock,
  XCircle,
  Presentation,
  Rows,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GanttChart } from './GanttChart';
import {
  useMasterPlan,
  useMasterPlanTasks,
  useProjectTasks,
  useProjectNotes,
  useProjectMeetings,
} from '@/lib/api';
import type { ProjectNote, ProjectMeeting, CompanySettings } from '@/types/database';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

const fmtDate = (s: string | null | undefined) => {
  if (!s) return '—';
  try {
    const d = parseISO(s);
    return isValid(d) ? format(d, 'dd MMM yyyy', { locale: es }) : '—';
  } catch {
    return '—';
  }
};

const DEPT_COLORS: Record<string, string> = {
  Compras:    '#7c3aed',
  Diseño:     '#0ea5e9',
  Producción: '#0369a1',
  Calidad:    '#15803d',
  Embarque:   '#0d9488',
};

interface ProjectReportProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    client: string;
    status: string;
    progress: number;
    startDate: string;
    deadline: string;
    manager: string;
    description: string;
    tasks: any[];
  };
  ganttTasks: any[];
}

/**
 * Reporte PMI — formato presentación profesional, multi-página,
 * lista para imprimir o "Guardar como PDF" desde el navegador.
 */
export function ProjectReport({ isOpen, onClose, project, ganttTasks }: ProjectReportProps) {
  const { data: masterPlan, refetch: refetchPlan } = useMasterPlan(project.id);
  const { data: masterPlanTasks, refetch: refetchTasks } = useMasterPlanTasks(masterPlan?.id);
  const { data: projectTasks, refetch: refetchProjTasks } = useProjectTasks(project.id);
  const { data: notes, refetch: refetchNotes } = useProjectNotes(project.id);
  const { data: meetings, refetch: refetchMeetings } = useProjectMeetings(project.id);
  const { company } = useCompany();

  // Al abrir el reporte, refresca TODO para que las cifras de avance,
  // hitos, juntas y notas sean las más recientes (el reporte queda montado
  // en el árbol, así que sin esto mostraría datos del primer render).
  useEffect(() => {
    if (!isOpen) return;
    refetchPlan();
    refetchTasks();
    refetchProjTasks();
    refetchNotes();
    refetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Bloquea el scroll de fondo mientras el reporte está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const today = new Date();
  const deadlineDate = (() => {
    try {
      const d = parseISO(project.deadline);
      return isValid(d) ? d : today;
    } catch {
      return today;
    }
  })();
  const daysToDeadline = Math.max(0, differenceInDays(deadlineDate, today));

  // KPIs derivados
  const stats = useMemo(() => {
    const tasks = masterPlanTasks;
    const total = tasks.length;
    const completed = tasks.filter(t => t.progress >= 100).length;
    const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
    const pending = tasks.filter(t => t.progress === 0).length;
    const milestones = tasks.filter(t => t.is_milestone);
    const critical = tasks.filter(t => t.is_critical_path);
    const completedMilestones = milestones.filter(m => m.progress >= 100).length;
    const avgProgress = total > 0
      ? Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / total)
      : project.progress;
    return {
      total, completed, inProgress, pending,
      milestones: milestones.length, completedMilestones,
      critical: critical.length,
      avgProgress,
    };
  }, [masterPlanTasks, project.progress]);

  // Desempeño por departamento (avance promedio real del master plan)
  const deptPerformanceData = useMemo(() => {
    const depts = ['Compras', 'Diseño', 'Producción', 'Calidad', 'Embarque'];
    return depts
      .map(d => {
        const tasks = masterPlanTasks.filter(t => t.department === d);
        if (tasks.length === 0) return { name: d, complete: 0, pending: 100, hasData: false };
        const avg = Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length);
        return { name: d, complete: avg, pending: 100 - avg, hasData: true };
      })
      .filter(d => d.hasData);
  }, [masterPlanTasks]);

  // S-curve sintética basada en avance acumulado
  const progressTimelineData = useMemo(() => {
    if (masterPlanTasks.length === 0) return [];
    const sorted = [...masterPlanTasks].sort(
      (a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime()
    );
    const total = sorted.length;
    let acc = 0;
    return sorted
      .filter((_, i) => i % Math.max(1, Math.floor(total / 6)) === 0 || _ === sorted[sorted.length - 1])
      .map(t => {
        const idx = sorted.findIndex(x => x.id === t.id);
        const completedUpTo = sorted.slice(0, idx + 1).filter(x => x.progress >= 100).length;
        acc = Math.round((completedUpTo / total) * 100);
        return {
          date: format(parseISO(t.end_date), 'dd MMM', { locale: es }),
          progress: acc,
        };
      });
  }, [masterPlanTasks]);

  // Próximos hitos
  const upcomingMilestones = useMemo(() => {
    return masterPlanTasks
      .filter(t => t.is_milestone)
      .sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime())
      .slice(0, 6);
  }, [masterPlanTasks]);

  // Tareas ad-hoc dated
  const datedTasks = useMemo(
    () => projectTasks.filter(t => t.start_date && t.end_date),
    [projectTasks]
  );

  // ── Modo de visualización: documento (scroll) o presentación (slides) ──
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [mode, setMode] = React.useState<'document' | 'slides'>('document');
  const [slideIndex, setSlideIndex] = React.useState(0);
  const [slideCount, setSlideCount] = React.useState(0);

  // Enumera las páginas (.pmi-page) y muestra/oculta según el modo.
  // En presentación se ve una a la vez; en documento todas (scrolleable).
  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const root = reportRef.current;
    if (!root) return;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('.pmi-page'));
    setSlideCount(pages.length);
    pages.forEach((p, i) => {
      p.style.display = mode === 'slides' && i !== slideIndex ? 'none' : '';
    });
  }, [isOpen, mode, slideIndex, masterPlanTasks, ganttTasks, deptPerformanceData, progressTimelineData, notes, meetings]);

  // Mantiene slideIndex dentro de rango
  React.useEffect(() => {
    if (slideCount > 0 && slideIndex >= slideCount) setSlideIndex(slideCount - 1);
  }, [slideCount, slideIndex]);

  const goPrev = React.useCallback(() => setSlideIndex(i => Math.max(0, i - 1)), []);
  const goNext = React.useCallback(
    () => setSlideIndex(i => Math.min(Math.max(0, slideCount - 1), i + 1)),
    [slideCount]
  );

  // Navegación con teclado en modo presentación
  React.useEffect(() => {
    if (!isOpen || mode !== 'slides') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, mode, goNext, goPrev]);

  const enterPresent = async () => {
    setSlideIndex(0);
    setMode('slides');
    try {
      await rootRef.current?.requestFullscreen?.();
    } catch {
      /* fullscreen opcional */
    }
  };

  const exitPresent = React.useCallback(async () => {
    setMode('document');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  // Escape contextual: en presentación vuelve a documento; en documento cierra.
  // Y si el usuario sale de pantalla completa (Esc nativo), vuelve a documento.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mode === 'slides') {
        e.preventDefault();
        exitPresent();
      } else {
        onClose();
      }
    };
    const onFsChange = () => {
      if (!document.fullscreenElement && mode === 'slides') setMode('document');
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [isOpen, mode, onClose, exitPresent]);

  const handlePrint = () => {
    // Pequeño delay para que recharts y el layout se asienten antes del print
    setTimeout(() => window.print(), 120);
  };

  if (!isOpen) return null;

  return createPortal(
    <div id="koji-report-root" ref={rootRef} className={mode === 'slides' ? 'mode-slides' : 'mode-doc'}>
      <style>{`
        /* ── PANTALLA ── overlay scrolleable robusto ── */
        @media screen {
          #koji-report-root {
            position: fixed; inset: 0; z-index: 60;
            background: rgba(15, 23, 42, 0.55);
            overflow-y: auto; overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .report-stage {
            max-width: 960px; margin: 0 auto;
            padding: 14px 12px 80px;
          }
          .report-toolbar {
            position: sticky; top: 8px; z-index: 5;
          }
          #pmi-report {
            width: 100%; background: #f1f5f9;
            border-radius: 10px; overflow: hidden;
          }
          #pmi-report .pmi-page { min-height: auto; padding: 36px 40px; }

          /* ── Modo presentación (PowerPoint) ── */
          #koji-report-root.mode-slides { background: #0b1220; }
          #koji-report-root.mode-slides .report-stage {
            max-width: 1200px; padding: 12px 16px 96px;
            min-height: 100%; display: flex; flex-direction: column; justify-content: center;
          }
          #koji-report-root.mode-slides #pmi-report { background: transparent; overflow: visible; }
          #koji-report-root.mode-slides .pmi-page {
            background: white; border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,.5);
            max-width: 1120px; margin: 0 auto; width: 100%;
            min-height: 66vh; padding: 44px 56px;
          }
          .report-nav {
            position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
            z-index: 70;
          }
        }
        /* ── IMPRESIÓN ── oculta la app y deja fluir TODAS las páginas ── */
        @media print {
          @page { size: letter portrait; margin: 12mm; }
          html, body {
            background: white !important;
            height: auto !important; min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important; padding: 0 !important;
          }
          body > #root { display: none !important; }
          body > #koji-report-root {
            position: static !important; inset: auto !important;
            background: white !important; overflow: visible !important;
            display: block !important; padding: 0 !important; margin: 0 !important;
          }
          .report-stage { max-width: none !important; padding: 0 !important; margin: 0 !important; display: block !important; }
          .report-toolbar, .report-nav, .no-print-pmi { display: none !important; }
          #pmi-report {
            max-width: none !important; width: 100% !important;
            background: white !important; color: black !important;
            border-radius: 0 !important; overflow: visible !important; height: auto !important;
          }
          /* CLAVE: aunque en presentación las demás páginas estén ocultas
             por JS (display:none inline), en impresión SE FUERZAN todas. */
          .pmi-page {
            display: block !important;
            page-break-after: always; break-after: page;
            page-break-inside: avoid;
            padding: 4mm 2mm !important; margin: 0 auto !important;
            max-width: none !important; min-height: 0 !important;
            box-shadow: none !important; background: white !important;
            border-radius: 0 !important;
          }
          .pmi-page:last-child { page-break-after: auto; break-after: auto; }
          .pmi-keep { page-break-inside: avoid; break-inside: avoid; }
          #pmi-report svg { max-width: 100% !important; }
          #pmi-report img { max-width: 100% !important; }
          #pmi-report thead { display: table-header-group; }
          #pmi-report tr { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      {/* Backdrop para cerrar (solo pantalla, solo en modo documento) */}
      {mode === 'document' && (
        <div
          className="no-print-pmi"
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: -1 }}
        />
      )}

      <div className="report-stage">
        {/* Toolbar (oculta al imprimir) */}
        <div className="report-toolbar no-print-pmi flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-lg border border-[var(--color-app-border)] bg-white shadow-sm">
          <div className="text-sm min-w-0 truncate">
            <span className="font-medium">{mode === 'slides' ? 'Presentación' : 'Reporte ejecutivo'}</span>
            <span className="text-[var(--color-app-text-muted)] ml-2">· {project.id}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mode === 'document' ? (
              <Button variant="outline" size="sm" onClick={enterPresent}>
                <Presentation className="h-3.5 w-3.5 mr-1.5" /> Presentar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={exitPresent}>
                <Rows className="h-3.5 w-3.5 mr-1.5" /> Ver documento
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Descargar PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Documento / Slides */}
        <div id="pmi-report" ref={reportRef}>
          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 1 — PORTADA
              ─────────────────────────────────────────────────────────────── */}
          <PortadaPage project={project} masterPlan={masterPlan} stats={stats} company={company} />

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 2 — RESUMEN EJECUTIVO
              ─────────────────────────────────────────────────────────────── */}
          <ExecSummaryPage
            project={project}
            stats={stats}
            daysToDeadline={daysToDeadline}
            deadlineDate={deadlineDate}
            masterPlan={masterPlan}
          />

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 3 — SCOREBOARD DE ETAPAS
              ─────────────────────────────────────────────────────────────── */}
          {masterPlanTasks.length > 0 && (
            <ScoreboardPage tasks={masterPlanTasks} />
          )}

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 4 — CRONOGRAMA GANTT
              ─────────────────────────────────────────────────────────────── */}
          {ganttTasks.length > 0 && (
            <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
              <PageHeader title="Cronograma del proyecto" subtitle="Vista Gantt · línea de base" />
              <p className="text-xs text-[#475569] mb-4">
                Líneas rojas: actividades en ruta crítica · ★ tareas ad-hoc añadidas fuera del plan formal.
              </p>
              <div className="pmi-keep">
                <GanttChart
                  startDate={masterPlan?.baseline_start ?? project.startDate}
                  tasks={ganttTasks}
                />
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 5 — MÉTRICAS Y ANÁLISIS
              ─────────────────────────────────────────────────────────────── */}
          {(deptPerformanceData.length > 0 || progressTimelineData.length > 0) && (
            <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
              <PageHeader title="Métricas y análisis" subtitle="Desempeño en tiempo real" />
              <div className="grid grid-cols-1 gap-8">
                {deptPerformanceData.length > 0 && (
                  <div className="pmi-keep">
                    <h3 className="text-sm font-semibold text-[#0f172a] mb-3">Desempeño por departamento</h3>
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptPerformanceData} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }} />
                          <Bar dataKey="complete" fill="#0369a1" stackId="a" radius={[0, 4, 4, 0]} barSize={18} />
                          <Bar dataKey="pending" fill="#e2e8f0" stackId="a" radius={[0, 4, 4, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {progressTimelineData.length > 0 && (
                  <div className="pmi-keep">
                    <h3 className="text-sm font-semibold text-[#0f172a] mb-3">Curva de progreso (S-Curve)</h3>
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressTimelineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }} />
                          <Line type="monotone" dataKey="progress" stroke="#0369a1" strokeWidth={2.5} dot={{ fill: '#0369a1', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

              {/* Próximos hitos */}
              {upcomingMilestones.length > 0 && (
                <div className="mt-8 pmi-keep">
                  <h3 className="text-sm font-semibold text-[#0f172a] mb-3 flex items-center gap-2">
                    <Flag className="h-4 w-4 text-[#0369a1]" /> Próximos hitos
                  </h3>
                  <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f8fafc]">
                        <tr className="text-left text-xs text-[#475569]">
                          <th className="px-3 py-2 font-semibold">WBS</th>
                          <th className="px-3 py-2 font-semibold">Actividad</th>
                          <th className="px-3 py-2 font-semibold">Depto.</th>
                          <th className="px-3 py-2 font-semibold">Fecha objetivo</th>
                          <th className="px-3 py-2 font-semibold text-right">Avance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingMilestones.map(m => (
                          <tr key={m.id} className="border-t border-[#e2e8f0]">
                            <td className="px-3 py-2 font-mono text-xs text-[#475569]">{m.wbs_code}</td>
                            <td className="px-3 py-2 font-medium">{m.name}</td>
                            <td className="px-3 py-2">
                              {m.department && (
                                <span className="inline-flex items-center gap-1.5 text-xs">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DEPT_COLORS[m.department] }} />
                                  {m.department}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">{fmtDate(m.end_date)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{m.progress}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 6 — RIESGOS Y TAREAS ADICIONALES
              ─────────────────────────────────────────────────────────────── */}
          <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
            <PageHeader title="Riesgos y observaciones" subtitle="Identificación y seguimiento" />

            <div className="space-y-6">
              {masterPlan?.risk_summary ? (
                <div className="pmi-keep">
                  <h3 className="text-sm font-semibold text-[#0f172a] mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#b45309]" /> Riesgos identificados
                  </h3>
                  <div className="p-4 bg-[#fef3c7]/30 border border-[#fde68a] rounded-md text-sm leading-relaxed whitespace-pre-wrap">
                    {masterPlan.risk_summary}
                  </div>
                </div>
              ) : (
                <div className="pmi-keep">
                  <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Riesgos identificados</h3>
                  <p className="text-sm text-[#94a3b8] italic">
                    Sin riesgos documentados en el Master Plan.
                  </p>
                </div>
              )}

              {datedTasks.length > 0 && (
                <div className="pmi-keep">
                  <h3 className="text-sm font-semibold text-[#0f172a] mb-2">
                    Tareas adicionales fuera del plan formal
                  </h3>
                  <div className="border border-[#e2e8f0] rounded-md divide-y divide-[#e2e8f0]">
                    {datedTasks.map(t => (
                      <div key={t.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                        {t.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-[#15803d] shrink-0" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-[#0369a1] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{t.name}</p>
                          <p className="text-xs text-[#475569]">
                            {t.department ?? 'Sin asignar'} · {fmtDate(t.start_date)} → {fmtDate(t.end_date)}
                          </p>
                        </div>
                        <span className="text-xs tabular-nums font-medium">{t.progress}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 7 — NOTAS Y HALLAZGOS + JUNTAS
              ─────────────────────────────────────────────────────────────── */}
          <NotesAndMeetingsPage notes={notes} meetings={meetings} />

          {/* ───────────────────────────────────────────────────────────────
              PÁGINA 8 — FIRMAS Y CIERRE
              ─────────────────────────────────────────────────────────────── */}
          <SignaturePage project={project} company={company} />
        </div>
      </div>

      {/* Barra de navegación de presentación */}
      {mode === 'slides' && (
        <div className="report-nav no-print-pmi flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/95 shadow-lg border border-[var(--color-app-border)]">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={goPrev} disabled={slideIndex === 0}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium tabular-nums min-w-[60px] text-center">
            {slideCount === 0 ? '–' : `${slideIndex + 1} / ${slideCount}`}
          </span>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={goNext} disabled={slideIndex >= slideCount - 1}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>,
    document.body
  );
}

// ============================================================================
// SUB-COMPONENTES POR PÁGINA
// ============================================================================

function PortadaPage({
  project,
  masterPlan,
  stats,
  company,
}: {
  project: ProjectReportProps['project'];
  masterPlan: ReturnType<typeof useMasterPlan>['data'];
  stats: { avgProgress: number; milestones: number; critical: number; total: number };
  company: CompanySettings;
}) {
  const brandName = company.commercial_name || company.legal_name;
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'E';
  return (
    <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm relative overflow-hidden">
      {/* Banda superior */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-[var(--color-app-primary)]" />
      <div className="absolute top-2 left-0 right-0 h-1 bg-[var(--color-app-primary-soft)]" />

      {/* Logo + ID */}
      <div className="flex items-start justify-between pt-12 mb-20">
        <div className="flex items-center gap-3">
          {company.logo_url ? (
            <img src={company.logo_url} alt={brandName} className="h-14 w-14 rounded-md object-cover shadow-sm bg-white" />
          ) : (
            <div className="h-14 w-14 rounded-md bg-[var(--color-app-primary)] flex items-center justify-center text-white font-bold text-2xl shadow-sm">
              {brandInitial}
            </div>
          )}
          <div>
            <p className="font-bold text-lg text-[#0f172a] leading-tight">{brandName}</p>
            <p className="text-xs text-[#475569]">{company.tagline || ''}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] font-medium">
            Documento PMI · Confidencial
          </p>
          <p className="text-xs font-mono text-[#475569] mt-1">{project.id}</p>
        </div>
      </div>

      {/* Título principal */}
      <div className="text-center mb-16">
        <p className="text-xs uppercase tracking-[0.3em] text-[#0369a1] font-semibold mb-4">
          Reporte ejecutivo de proyecto
        </p>
        <h1 className="text-4xl font-bold text-[#0f172a] mb-3 leading-tight">{project.name}</h1>
        <div className="inline-block px-4 py-1.5 bg-[#f1f5f9] rounded-full">
          <p className="text-sm text-[#475569]">
            Cliente: <span className="font-semibold text-[#0f172a]">{project.client}</span>
          </p>
        </div>
      </div>

      {/* Indicadores rápidos en la portada */}
      <div className="grid grid-cols-3 gap-4 mb-16">
        <PortadaStat label="Avance general" value={`${stats.avgProgress}%`} tone="primary" />
        <PortadaStat label="Actividades" value={String(stats.total)} />
        <PortadaStat label="Hitos / críticos" value={`${stats.milestones} / ${stats.critical}`} />
      </div>

      {/* Datos del documento */}
      <div className="border-t border-[#e2e8f0] pt-6 grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
        <InfoRow label="Estado actual"  value={project.status} />
        <InfoRow label="Manager del proyecto" value={project.manager} />
        <InfoRow label="Fecha de inicio" value={fmtDate(project.startDate)} />
        <InfoRow label="Fecha de entrega" value={fmtDate(project.deadline)} />
        {masterPlan && (
          <>
            <InfoRow label="Metodología" value={masterPlan.methodology} />
            <InfoRow label="Plantilla utilizada" value={masterPlan.template_used ?? '—'} />
          </>
        )}
      </div>

      {/* Footer portada */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-xs text-[#94a3b8]">
          Emitido el{' '}
          <span className="font-medium text-[#475569]">
            {format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
          </span>
        </p>
      </div>
    </div>
  );
}

function ExecSummaryPage({
  project,
  stats,
  daysToDeadline,
  deadlineDate,
  masterPlan,
}: {
  project: ProjectReportProps['project'];
  stats: { avgProgress: number; total: number; completed: number; inProgress: number; pending: number; milestones: number; completedMilestones: number; critical: number };
  daysToDeadline: number;
  deadlineDate: Date;
  masterPlan: ReturnType<typeof useMasterPlan>['data'];
}) {
  const isAtRisk = daysToDeadline < 14 && stats.avgProgress < 70;

  return (
    <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
      <PageHeader title="Resumen ejecutivo" subtitle="Visión general del proyecto" />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiBox icon={TrendingUp} label="Avance global"   value={`${stats.avgProgress}%`} />
        <KpiBox icon={Activity}   label="Estado"          value="Operando" tone="success" />
        <KpiBox icon={Calendar}   label="Días para entrega" value={String(daysToDeadline)} tone={daysToDeadline < 14 ? 'warning' : undefined} />
        <KpiBox icon={Users}      label="Hitos completados" value={`${stats.completedMilestones} / ${stats.milestones}`} />
      </div>

      {/* Descripción / contexto */}
      <div className="mb-6 pmi-keep">
        <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Contexto del proyecto</h3>
        <p className="text-sm leading-relaxed text-[#334155] whitespace-pre-wrap">
          {project.description || `Proyecto de manufactura CNC para ${project.client}. Sin descripción adicional registrada.`}
        </p>
      </div>

      {/* Estado narrativo */}
      <div className={cn(
        'p-4 rounded-md border pmi-keep',
        isAtRisk
          ? 'bg-[#fef2f2] border-[#fecaca]'
          : stats.avgProgress >= 80
          ? 'bg-[#f0fdf4] border-[#bbf7d0]'
          : 'bg-[#eff6ff] border-[#bfdbfe]'
      )}>
        <h3 className="text-sm font-semibold text-[#0f172a] mb-2 flex items-center gap-2">
          {isAtRisk ? <AlertTriangle className="h-4 w-4 text-[#b91c1c]" /> : <ShieldCheck className="h-4 w-4 text-[#15803d]" />}
          Análisis del PMI
        </h3>
        <p className="text-sm text-[#334155] leading-relaxed">
          El proyecto presenta un avance global del{' '}
          <strong>{stats.avgProgress}%</strong>
          {stats.total > 0 && (
            <>
              {' '}distribuido entre{' '}
              <strong>{stats.completed}</strong> actividades completadas,{' '}
              <strong>{stats.inProgress}</strong> en proceso y{' '}
              <strong>{stats.pending}</strong> pendientes.
            </>
          )}{' '}
          Restan <strong>{daysToDeadline} días</strong> para la fecha de entrega comprometida con el cliente
          ({format(deadlineDate, "d 'de' MMMM", { locale: es })}).
          {stats.critical > 0 && (
            <>
              {' '}Hay <strong>{stats.critical}</strong> actividad{stats.critical === 1 ? '' : 'es'} en ruta crítica
              que requiere{stats.critical === 1 ? '' : 'n'} monitoreo continuo.
            </>
          )}
          {masterPlan && (
            <>
              {' '}El plan formal se ejecuta bajo metodología{' '}
              <strong>{masterPlan.methodology}</strong>{' '}
              con plantilla <strong>{masterPlan.template_used}</strong>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function ScoreboardPage({ tasks }: { tasks: ReturnType<typeof useMasterPlanTasks>['data'] }) {
  return (
    <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
      <PageHeader title="Scoreboard de etapas" subtitle="Estado detallado por actividad" />

      {/* Sin break-inside:avoid — si hay muchas actividades, la tabla pagina
          fila por fila en lugar de cortarse o dejar una página en blanco. */}
      <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs text-[#475569]">
              <th className="px-3 py-2 font-semibold">WBS</th>
              <th className="px-3 py-2 font-semibold">Actividad</th>
              <th className="px-3 py-2 font-semibold">Depto.</th>
              <th className="px-3 py-2 font-semibold">Inicio</th>
              <th className="px-3 py-2 font-semibold">Fin</th>
              <th className="px-3 py-2 font-semibold text-right">Avance</th>
              <th className="px-3 py-2 font-semibold text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const status =
                t.progress >= 100 ? 'done' : t.progress > 0 ? 'wip' : 'pending';
              return (
                <tr key={t.id} className="border-t border-[#e2e8f0] text-sm">
                  <td className="px-3 py-2 font-mono text-xs text-[#475569]">
                    <div className="flex items-center gap-1.5">
                      {t.wbs_code}
                      {t.is_milestone && <Flag className="h-3 w-3 text-[#b45309]" />}
                      {t.is_critical_path && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#b91c1c]" title="Ruta crítica" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2">
                    {t.department && (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DEPT_COLORS[t.department] }} />
                        {t.department}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#475569]">{fmtDate(t.start_date)}</td>
                  <td className="px-3 py-2 text-xs text-[#475569]">{fmtDate(t.end_date)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${t.progress}%`,
                            backgroundColor: status === 'done' ? '#15803d' : '#0369a1',
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-xs font-medium w-9 text-right">{t.progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {status === 'done' && <Badge variant="success">Completado</Badge>}
                    {status === 'wip' && <Badge variant="default">En proceso</Badge>}
                    {status === 'pending' && <Badge variant="secondary">Pendiente</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SignaturePage({
  project,
  company,
}: {
  project: ProjectReportProps['project'];
  company: CompanySettings;
}) {
  const brandName = company.commercial_name || company.legal_name;
  return (
    <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
      <PageHeader title="Cierre y firmas" subtitle="Validación del reporte" />

      <div className="text-sm text-[#334155] mb-12 leading-relaxed">
        <p>
          Este documento es un reporte ejecutivo emitido por la oficina de gestión de proyectos (PMO)
          de {brandName} para el proyecto <strong>{project.name}</strong> ({project.id}).
        </p>
        <p className="mt-3">
          La información contenida es responsabilidad del manager del proyecto y del equipo de control
          de calidad. Cualquier discrepancia debe ser reportada dentro de los próximos 5 días hábiles
          al equipo PMO.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-12 mt-24 mb-16 pmi-keep">
        <Signature title="Responsable del proyecto" name={project.manager} />
        <Signature title="Validación del PMI" name={`Oficina PMO · ${brandName}`} />
      </div>

      <div className="grid grid-cols-2 gap-12 pmi-keep">
        <Signature title="Control de Calidad" name="Equipo QA" />
        <Signature title="Aceptación del cliente" name={project.client} />
      </div>

      <div className="absolute bottom-8 left-0 right-0 text-center text-xs text-[#94a3b8] mt-12">
        <p>
          {brandName}
          {company.rfc ? ` · RFC ${company.rfc}` : ''} · Reporte PMI ·{' '}
          {format(new Date(), 'yyyy', { locale: es })} · Documento emitido el{' '}
          {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b-2 border-[#0369a1] pb-3 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-[#0369a1] font-semibold mb-1">
        {subtitle}
      </p>
      <h2 className="text-2xl font-bold text-[#0f172a]">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#94a3b8] font-medium mb-0.5">{label}</p>
      <p className="font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function PortadaStat({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 border text-center',
        tone === 'primary'
          ? 'bg-[#0369a1] text-white border-[#0369a1]'
          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a]'
      )}
    >
      <p
        className={cn(
          'text-[10px] uppercase tracking-wide font-medium',
          tone === 'primary' ? 'text-white/80' : 'text-[#94a3b8]'
        )}
      >
        {label}
      </p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function KpiBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'success' | 'warning';
}) {
  return (
    <div className="rounded-lg p-4 border border-[#e2e8f0] bg-white text-center">
      <div className="h-8 w-8 rounded-md bg-[#f1f5f9] mx-auto flex items-center justify-center mb-2">
        <Icon className="h-4 w-4 text-[#475569]" />
      </div>
      <p
        className={cn(
          'text-xl font-bold tabular-nums',
          tone === 'success' && 'text-[#15803d]',
          tone === 'warning' && 'text-[#b45309]'
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-[#94a3b8] mt-1">{label}</p>
    </div>
  );
}

function Signature({ title, name }: { title: string; name: string }) {
  return (
    <div className="text-center">
      <div className="border-t-2 border-[#cbd5e1] pt-2">
        <p className="text-xs text-[#475569] mb-0.5">{title}</p>
        <p className="text-sm font-semibold text-[#0f172a]">{name}</p>
      </div>
    </div>
  );
}

// ============================================================================
// PÁGINA 7 — Notas, hallazgos y juntas
// ============================================================================

function NotesAndMeetingsPage({
  notes,
  meetings,
}: {
  notes: ProjectNote[];
  meetings: ProjectMeeting[];
}) {
  const noteTypeLabel: Record<string, string> = {
    note: 'Nota del equipo',
    system: 'Sistema',
    status_change: 'Cambio de estado',
    milestone: 'Hito',
  };
  const noteTypeColor: Record<string, string> = {
    note: '#0369a1',
    system: '#94a3b8',
    status_change: '#b45309',
    milestone: '#15803d',
  };

  const meetingTypeColor: Record<string, string> = {
    'Kick-off':  '#0369a1',
    Semanal:     '#0ea5e9',
    Quincenal:   '#7c3aed',
    Mensual:     '#15803d',
    Hito:        '#b45309',
    Cierre:      '#0d9488',
  };

  return (
    <div className="pmi-page bg-white max-w-[850px] mx-auto my-6 shadow-sm">
      <PageHeader title="Notas y hallazgos" subtitle="Historial documental del proyecto" />

      {/* JUNTAS */}
      {meetings.length > 0 && (
        <div className="mb-8 pmi-keep">
          <h3 className="text-sm font-semibold text-[#0f172a] mb-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#0369a1]" /> Calendario de juntas de seguimiento
          </h3>
          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc]">
                <tr className="text-left text-xs text-[#475569]">
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Junta</th>
                  <th className="px-3 py-2 font-semibold">Fecha / hora</th>
                  <th className="px-3 py-2 font-semibold">Asistentes</th>
                  <th className="px-3 py-2 font-semibold text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map(m => {
                  const date = new Date(m.scheduled_at);
                  const color = meetingTypeColor[m.meeting_type] ?? '#94a3b8';
                  return (
                    <tr key={m.id} className="border-t border-[#e2e8f0]">
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium"
                          style={{ color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {m.meeting_type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{m.title}</p>
                        {m.notes && (
                          <p className="text-[10px] text-[#475569] mt-0.5 truncate max-w-[280px]">
                            {m.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {format(date, "dd MMM yyyy", { locale: es })}
                        <br />
                        <span className="text-[10px] text-[#94a3b8]">
                          {format(date, 'HH:mm')} · {m.duration_minutes} min
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#475569]">
                        {m.attendees.length > 0 ? m.attendees.join(', ') : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {m.status === 'Realizada' ? (
                          <Badge variant="success">Realizada</Badge>
                        ) : m.status === 'Cancelada' ? (
                          <Badge variant="outline">Cancelada</Badge>
                        ) : (
                          <Badge variant="secondary">Programada</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTAS Y HALLAZGOS */}
      <div className="pmi-keep">
        <h3 className="text-sm font-semibold text-[#0f172a] mb-2 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#0369a1]" /> Notas y hallazgos del equipo
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm text-[#94a3b8] italic">
            Sin notas registradas aún. Las notas agregadas desde el proyecto aparecerán aquí
            ordenadas cronológicamente.
          </p>
        ) : (
          <div className="border-l-2 border-[#e2e8f0] pl-4 space-y-3">
            {notes.map(n => {
              const color = noteTypeColor[n.note_type] ?? '#0369a1';
              return (
                <div key={n.id} className="relative">
                  <span
                    className="absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-[#0f172a]">
                      {n.user_name ?? 'Sistema'}
                    </span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${color}18`,
                        color,
                      }}
                    >
                      {noteTypeLabel[n.note_type] ?? n.note_type}
                    </span>
                    <span className="text-[10px] text-[#94a3b8]">
                      {format(new Date(n.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm text-[#334155] leading-snug">{n.action}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
