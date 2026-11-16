import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileDown, PencilRuler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BigNumber, Panel, Pill, Segmented, useMediaQuery } from '@/components/kanri';
import {
  getFileDownloadUrl, useBomItems, useDimensionalReports, useProjects, useSaveDimensionalReport, useUpdateManufacturingStatus,
} from '@/lib/api';
import { characteristicResult, isAttribute, specLimits, specText } from '@/lib/dimensional';
import { cn } from '@/lib/utils';
import type { BomItem, DimensionalCharacteristic, DimensionalReport, DimensionalStatus } from '@/types/database';
import { DimensionalModal } from './DimensionalModal';
import { DimensionalReportPrint } from './DimensionalReportPrint';
import { NcrFormModal } from './NcrFormModal';

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(3));
const TAB_LABEL: Record<DimensionalStatus, string> = { Borrador: 'Pendientes', Aprobado: 'Aprobadas', Rechazado: 'Rechazadas' };

/** Inspección dimensional (rediseño): bandeja por estatus + reporte con globos y mediciones. */
export function DimensionalInspections() {
  const { data: reports, refetch, mutate } = useDimensionalReports();
  const { data: bom, refetch: refetchBom } = useBomItems();
  const { data: projects } = useProjects();
  const { save } = useSaveDimensionalReport();
  const { update: updateMfg } = useUpdateManufacturingStatus();
  const wide = useMediaQuery('(min-width: 1100px)');

  const [tab, setTab] = useState<DimensionalStatus>('Borrador');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<BomItem | null>(null);
  const [printing, setPrinting] = useState<{ report: DimensionalReport; item: BomItem; image: string | null } | null>(null);
  const [ncrItem, setNcrItem] = useState<BomItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => reports.filter(r => r.status === tab), [reports, tab]);
  const selected = list.find(r => r.id === selectedId) ?? list[0] ?? null;
  const itemOf = (r: DimensionalReport) => bom.find(b => b.id === r.bom_item_id) ?? null;
  const projectName = (id: string) => projects.find(p => p.id === id)?.name;

  const setStatus = async (r: DimensionalReport, status: DimensionalStatus) => {
    setBusy(true);
    setError(null);
    const prev = r.status;
    mutate(all => all.map(x => (x.id === r.id ? { ...x, status } : x)));
    try {
      await save({ ...r, status });
      const item = itemOf(r);
      // Aprobar libera la pieza (TERMINADO). Rechazar abre la NCR; al
      // registrarla, la pieza queda RECHAZADA (mismo flujo que la bandeja).
      if (item && status === 'Aprobado' && item.manufacturing_status !== 'TERMINADO') await updateMfg(item.id, 'TERMINADO');
      if (status === 'Rechazado' && item) setNcrItem(item);
      await Promise.all([refetch(), refetchBom()]);
    } catch (e) {
      mutate(all => all.map(x => (x.id === r.id ? { ...x, status: prev } : x)));
      setError((e as Error).message || 'No se pudo actualizar el reporte.');
    } finally {
      setBusy(false);
    }
  };

  const print = async (r: DimensionalReport) => {
    const item = itemOf(r);
    if (!item) { setError('No se encontró la pieza del reporte.'); return; }
    let image: string | null = null;
    if (r.drawing_image) image = r.drawing_image.startsWith('data:') ? r.drawing_image : await getFileDownloadUrl(r.drawing_image);
    setPrinting({ report: r, item, image });
  };

  const card = (r: DimensionalReport) => {
    const on = wide && selected?.id === r.id;
    return (
      <button
        key={r.id}
        onClick={() => (wide ? setSelectedId(r.id) : setSelectedId(r.id))}
        className={cn(
          'k-rise w-full text-left rounded-[24px] p-5 transition-all duration-200',
          on ? 'bg-white shadow-[0_0_0_2px_var(--color-app-ink)]' : 'bg-[var(--color-app-surface-alt)] hover:bg-white',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-[var(--color-app-text-muted)] truncate">{r.part_number || r.id.slice(0, 8)}</span>
          <span className="text-xs text-[var(--color-app-text-muted)] whitespace-nowrap">{r.sample_size} pzs</span>
        </div>
        <p className="mt-2 text-[17px] leading-snug">{r.title || r.part_number || 'Reporte dimensional'}</p>
        <p className="mt-1 font-mono text-xs text-[var(--color-app-text-muted)]">{r.project_id}</p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-[var(--color-app-text-muted)]">Inspección dimensional · ISO 9001 §8.6</p>
        <Segmented<DimensionalStatus>
          value={tab}
          onChange={v => { setTab(v); setSelectedId(null); }}
          items={(['Borrador', 'Aprobado', 'Rechazado'] as DimensionalStatus[]).map(s => ({ id: s, label: TAB_LABEL[s], count: reports.filter(r => r.status === s).length }))}
        />
      </div>
      {error && <p className="text-sm text-[var(--color-app-danger)]">{error}</p>}

      {list.length === 0 ? (
        <Panel>
          <p className="py-10 text-center text-sm text-[var(--color-app-text-muted)]">
            {tab === 'Borrador'
              ? 'No hay reportes pendientes. Crea uno desde "Control por proyecto" → pieza → Reporte dimensional.'
              : `Sin reportes ${TAB_LABEL[tab].toLowerCase()}.`}
          </p>
        </Panel>
      ) : (
        <div className={cn('grid gap-3 items-start', wide && 'grid-cols-[minmax(240px,320px)_minmax(0,1fr)]')}>
          <div className="space-y-2.5">{list.map(card)}</div>
          {selected && (
            <ReportDetail
              key={selected.id}
              report={selected}
              projectName={projectName(selected.project_id)}
              busy={busy}
              hasItem={!!itemOf(selected)}
              onApprove={() => setStatus(selected, 'Aprobado')}
              onReject={() => setStatus(selected, 'Rechazado')}
              onReopen={() => setStatus(selected, 'Borrador')}
              onEdit={() => { const it = itemOf(selected); if (it) setEditItem(it); }}
              onPrint={() => print(selected)}
            />
          )}
        </div>
      )}

      {editItem && (
        <DimensionalModal
          item={editItem}
          projectName={projectName(editItem.project_id)}
          open
          onOpenChange={o => { if (!o) setEditItem(null); }}
          onChanged={() => { void refetch(); }}
        />
      )}
      {printing && (
        <DimensionalReportPrint
          report={printing.report}
          item={printing.item}
          projectName={projectName(printing.report.project_id)}
          baseImage={printing.image}
          onClose={() => setPrinting(null)}
        />
      )}
      <NcrFormModal
        open={!!ncrItem}
        item={ncrItem}
        projectId={ncrItem?.project_id}
        onClose={() => setNcrItem(null)}
        onCreated={async () => {
          if (ncrItem) await updateMfg(ncrItem.id, 'RECHAZADO');
          await refetchBom();
        }}
      />
    </div>
  );
}

function ReportDetail({ report, projectName, busy, hasItem, onApprove, onReject, onReopen, onEdit, onPrint }: {
  report: DimensionalReport; projectName?: string; busy: boolean; hasItem: boolean;
  onApprove: () => void; onReject: () => void; onReopen: () => void; onEdit: () => void; onPrint: () => void;
}) {
  const chars = report.payload?.characteristics ?? [];
  const balloons = report.payload?.balloons ?? [];
  const results = chars.map(c => characteristicResult(c));
  const ok = results.filter(r => r === true).length;
  const ng = results.filter(r => r === false).length;
  const pendingChars = chars.length - ok - ng;
  const allOk = chars.length > 0 && ok === chars.length;
  const pending = report.status === 'Borrador';
  const resultOf = (n: number) => results[chars.findIndex(c => c.n === n)];

  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    const path = report.drawing_image;
    if (!path) return;
    if (path.startsWith('data:') || path.startsWith('http')) { setImage(path); return; }
    getFileDownloadUrl(path).then(u => { if (!cancel) setImage(u); });
    return () => { cancel = true; };
  }, [report.drawing_image]);

  const aspect = report.payload?.imageAspect ?? 0.55;
  const verdict = !pending
    ? `Dictamen emitido: ${report.status === 'Aprobado' ? 'aprobado' : 'rechazado'}.`
    : chars.length === 0
      ? 'Sin características capturadas: abre el editor para agregarlas.'
      : ng > 0
        ? `${ng} característica(s) fuera de tolerancia — no se puede liberar.`
        : pendingChars > 0
          ? `${pendingChars} característica(s) sin medición.`
          : 'Todas las características dentro de tolerancia.';

  return (
    <section className="k-rise rounded-[30px] bg-white p-6 min-w-0 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--color-app-text-muted)]">
            {report.part_number || report.id.slice(0, 8)} · {report.project_id}
          </p>
          <h2 className="mt-1.5 text-[24px] leading-tight font-normal tracking-[-0.01em]">
            Reporte dimensional · {report.title || report.part_number || 'pieza'}
          </h2>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-1">
            Muestra {report.sample_size} pzs{report.inspector_name ? ` · Inspector ${report.inspector_name}` : ''}
            {projectName ? ` · ${projectName}` : ''} · {format(new Date(report.updated_at || report.created_at), 'd MMM yyyy', { locale: es })}
          </p>
        </div>
        <Pill tone={report.status === 'Aprobado' ? 'green' : report.status === 'Rechazado' ? 'red' : 'blue'}>
          {report.status === 'Borrador' ? 'En calidad' : report.status}
        </Pill>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Plano con globos */}
        <div
          className="relative rounded-[22px] overflow-hidden bg-[var(--color-app-surface-muted)]"
          style={{ aspectRatio: `${1 / Math.max(0.2, aspect)}`, maxHeight: 360, ...(image ? {} : { background: 'repeating-linear-gradient(135deg,#E3E6EC 0 2px,transparent 2px 12px)' }) }}
        >
          {image && <img src={image} alt="Plano" className="absolute inset-0 w-full h-full object-contain" />}
          {balloons.map((b, i) => {
            const res = resultOf(b.n);
            return (
              <span
                key={b.n}
                className="absolute -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-xs text-white border-2 border-white shadow-sm"
                style={{
                  left: `${b.x}%`, top: `${b.y}%`, background: res === false ? '#B91C1C' : '#16181D',
                  animation: `k-rise 500ms cubic-bezier(.2,.9,.3,1.2) ${200 + i * 60}ms both`,
                }}
              >
                {b.n}
              </span>
            );
          })}
          {!image && <span className="absolute left-3 bottom-3 font-mono text-[11px] text-[var(--color-app-text-muted)] bg-white/70 px-2 py-1 rounded-lg">plano PDF · globalizado</span>}
        </div>
        <div className="grid gap-3 content-start">
          <div className="rounded-[20px] bg-[var(--color-app-surface-muted)] p-4">
            <p className="text-sm text-[var(--color-app-text-muted)]">Características OK</p>
            <BigNumber value={ok} unit={`/ ${chars.length}`} size="md" className="mt-1" />
          </div>
          <div className={cn('rounded-[20px] p-4', ng > 0 ? 'bg-[#FBE4E1] text-[#9B1C1C]' : 'bg-[var(--color-app-surface-muted)]')}>
            <p className={cn('text-sm', ng > 0 ? '' : 'text-[var(--color-app-text-muted)]')}>Fuera de tolerancia</p>
            <BigNumber value={ng} size="md" className="mt-1" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr className="text-xs text-[var(--color-app-text-muted)] text-left">
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)] rounded-l-xl w-10">#</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)]">Característica</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)] text-right">Nominal</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)] text-right">LSL / USL</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)]">Medición</th>
              <th className="font-normal px-3 py-2.5 bg-[var(--color-app-bg)] text-right rounded-r-xl">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {chars.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--color-app-text-muted)]">Sin características.</td></tr>
            )}
            {chars.map((c, i) => <CharRow key={c.n} c={c} res={results[i]} />)}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-sm', pending && !allOk && chars.length > 0 ? 'text-[#9B1C1C]' : 'text-[var(--color-app-text-muted)]')}>{verdict}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={onPrint} disabled={!hasItem}><FileDown className="h-4 w-4 mr-1.5" /> PDF</Button>
          {pending && <Button variant="outline" size="lg" onClick={onEdit} disabled={!hasItem}><PencilRuler className="h-4 w-4 mr-1.5" /> Capturar</Button>}
          {pending ? (
            <>
              <Button variant="outline" size="lg" onClick={onReject} disabled={busy}>{ng > 0 ? 'Rechazar y levantar NCR' : 'Rechazar'}</Button>
              <Button size="lg" onClick={onApprove} disabled={busy || !allOk}>Aprobar y liberar</Button>
            </>
          ) : (
            <Button variant="outline" size="lg" onClick={onReopen} disabled={busy}>Reabrir</Button>
          )}
        </div>
      </div>
    </section>
  );
}

function CharRow({ c, res }: { c: DimensionalCharacteristic; res: boolean | null }) {
  const attr = isAttribute(c);
  const { lsl, usl } = specLimits(c);
  const readings = c.readings.filter(r => r != null);
  return (
    <tr className={cn(res === false && 'bg-[#FDF6F5]')}>
      <td className="px-3 py-3 border-b border-[#EEF0F3]">{c.n}</td>
      <td className="px-3 py-3 border-b border-[#EEF0F3]">{c.label}</td>
      <td className="px-3 py-3 border-b border-[#EEF0F3] text-right font-mono text-[13px] whitespace-nowrap">{attr ? 'Calibre' : specText(c)}</td>
      <td className="px-3 py-3 border-b border-[#EEF0F3] text-right font-mono text-[13px] text-[var(--color-app-text-muted)] whitespace-nowrap">
        {attr ? 'pasa / no pasa' : `${fmt(lsl)} / ${fmt(usl)}`}
      </td>
      <td className="px-3 py-3 border-b border-[#EEF0F3]">
        <div className="flex flex-wrap gap-1">
          {readings.length === 0 ? <span className="text-[var(--color-app-text-subtle)]">—</span> : readings.slice(0, 6).map((r, i) => (
            <span key={i} className="font-mono text-[12px] px-2 py-1 rounded-lg bg-[var(--color-app-surface-muted)]">{typeof r === 'number' ? r.toFixed(3) : r}</span>
          ))}
          {readings.length > 6 && <span className="text-xs text-[var(--color-app-text-muted)] self-center">+{readings.length - 6}</span>}
        </div>
      </td>
      <td className="px-3 py-3 border-b border-[#EEF0F3] text-right">
        {res == null ? <Pill>—</Pill> : <Pill tone={res ? 'green' : 'red'}>{res ? 'OK' : 'NG'}</Pill>}
      </td>
    </tr>
  );
}
