import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, ListChecks, AlertOctagon, ShieldCheck, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNcrs, useCorrectiveActions, useControlPlanItems, CA_OPEN_STATUSES } from '@/lib/api';
import type { Ncr, Project } from '@/types/database';
import { ControlPlanPanel } from './ControlPlanPanel';
import { CorrectiveActionsPanel } from './CorrectiveActionsPanel';
import { NcrFormModal } from './NcrFormModal';
import { NcrDetailModal } from './NcrDetailModal';
import { NCR_STATUS_VARIANT, SEVERITY_VARIANT } from './capaMeta';

type Tab = 'plan' | 'capa' | 'ncr';

/**
 * Calidad del proyecto: plan de control (maquinado), action list de acciones
 * correctivas de todas las áreas y no conformidades del proyecto.
 */
export function ProjectQualityCard({ project }: { project: Project }) {
  const [tab, setTab] = useState<Tab>('plan');
  const { data: ncrs, refetch: refetchNcrs } = useNcrs(project.id);
  const { data: cas, refetch: refetchCas } = useCorrectiveActions(project.id);
  const { data: planItems, refetch: refetchPlan } = useControlPlanItems(project.id);

  // Cada panel maneja sus propios datos; al cambiar de tab refrescamos los
  // contadores para que reflejen lo que se registró en el otro tab.
  useEffect(() => {
    refetchNcrs();
    refetchCas();
    refetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const [newNcr, setNewNcr] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail: Ncr | null = ncrs.find(n => n.id === detailId) ?? null;
  const setDetail = (n: Ncr | null) => setDetailId(n?.id ?? null);

  const openCas = cas.filter(a => CA_OPEN_STATUSES.includes(a.status)).length;
  const openNcrs = ncrs.filter(n => n.status !== 'Cerrada').length;

  const tabs = useMemo(() => [
    { id: 'plan' as const, label: 'Plan de control', icon: ClipboardList, count: planItems.length },
    { id: 'capa' as const, label: 'Acciones correctivas', icon: ListChecks, count: openCas },
    { id: 'ncr' as const, label: 'No conformidades', icon: AlertOctagon, count: openNcrs },
  ], [planItems.length, openCas, openNcrs]);

  return (
    <Card className="p-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Calidad del proyecto
        </CardTitle>
        <CardDescription>Plan de control, acciones correctivas de todas las áreas y producto no conforme.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit max-w-full overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md whitespace-nowrap',
                tab === t.id ? 'bg-white text-[var(--color-app-text)] shadow-sm' : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {t.count > 0 && (
                <span className="text-[10px] tabular-nums rounded-full px-1.5 py-0.5 bg-[var(--color-app-border)]">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'plan' && <ControlPlanPanel project={project} />}

        {tab === 'capa' && <CorrectiveActionsPanel projectId={project.id} bare />}

        {tab === 'ncr' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--color-app-text-muted)]">
                {ncrs.length} NCR · {openNcrs} abierta(s). Da clic para seguir el procedimiento.
              </p>
              <Button size="sm" variant="outline" onClick={() => setNewNcr(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Reportar NCR
              </Button>
            </div>
            {ncrs.length === 0 ? (
              <p className="text-sm text-center text-[var(--color-app-text-muted)] py-8 rounded-lg border border-dashed border-[var(--color-app-border)]">
                Sin no conformidades en este proyecto.
              </p>
            ) : (
              <div className="space-y-2">
                {ncrs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setDetail(n)}
                    className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-[var(--color-app-border)] bg-white p-3 hover:border-[var(--color-app-border-strong)]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        <span className="font-mono text-xs text-[var(--color-app-danger)] mr-2">{n.id}</span>
                        {n.part_number ?? ''} {n.defect_type ? `· ${n.defect_type}` : ''}
                      </p>
                      <p className="text-xs text-[var(--color-app-text-muted)] truncate">{n.issue_description}</p>
                      <p className="text-[11px] text-[var(--color-app-text-subtle)]">
                        {format(new Date(n.created_at), 'dd MMM yyyy', { locale: es })}
                        {n.disposition ? ` · Disposición: ${n.disposition}` : ' · sin disposición'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={NCR_STATUS_VARIANT[n.status]}>{n.status}</Badge>
                      <Badge variant={SEVERITY_VARIANT[n.severity] ?? 'secondary'} className="text-[10px]">{n.severity}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <NcrFormModal open={newNcr} onClose={() => setNewNcr(false)} projectId={project.id} lockProject onCreated={() => refetchNcrs()} />
      <NcrDetailModal ncr={detail} open={!!detail} onClose={() => setDetail(null)} onChanged={() => refetchNcrs()} />
    </Card>
  );
}
