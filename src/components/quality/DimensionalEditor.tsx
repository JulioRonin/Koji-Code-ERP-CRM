import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Save,
  Printer,
  Plus,
  Minus,
  Trash2,
  MousePointerClick,
  Upload,
  ImageOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getFileDownloadUrl,
  useSaveDimensionalReport,
  uploadDimensionalFile,
} from '@/lib/api';
import { specLimits, readingPasses, characteristicResult } from '@/lib/dimensional';
import { useDimensionalBaseImage } from './useDimensionalBaseImage';
import { DimensionalReportPrint } from './DimensionalReportPrint';
import type {
  BomItem,
  DimensionalBalloon,
  DimensionalCharacteristic,
  DimensionalReport,
  DimensionalStatus,
} from '@/types/database';

interface Props {
  report: DimensionalReport;
  item: BomItem;
  projectName?: string;
  onClose: () => void;
  onSaved: (report: DimensionalReport) => void;
}

const UNITS = ['mm', 'in', '°', 'µm'];

export function DimensionalEditor({ report, item, projectName, onClose, onSaved }: Props) {
  const { save, loading: saving } = useSaveDimensionalReport();
  const { image, setImage, loading: imgLoading } = useDimensionalBaseImage(report, item);

  const [balloons, setBalloons] = useState<DimensionalBalloon[]>(report.payload?.balloons ?? []);
  const [chars, setChars] = useState<DimensionalCharacteristic[]>(report.payload?.characteristics ?? []);
  const [sampleSize, setSampleSize] = useState<number>(report.sample_size || 1);
  const [title, setTitle] = useState(report.title ?? `Inspección ${item.part_number}`);
  const [inspector, setInspector] = useState(report.inspector_name ?? '');
  const [status, setStatus] = useState<DimensionalStatus>(report.status ?? 'Borrador');
  const [notes, setNotes] = useState(report.notes ?? '');
  const [selected, setSelected] = useState<number | null>(null);
  const [addMode, setAddMode] = useState(true);
  const [uploadedPath, setUploadedPath] = useState<string | null>(report.drawing_image);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgWrapRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pieces = useMemo(() => Array.from({ length: sampleSize }, (_, i) => i), [sampleSize]);
  const nextN = useMemo(() => (balloons.reduce((mx, b) => Math.max(mx, b.n), 0) + 1), [balloons]);

  // Bloquea el scroll del body mientras el editor está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Sample size ──
  const changeSample = (delta: number) => {
    const next = Math.max(1, Math.min(20, sampleSize + delta));
    setSampleSize(next);
    setChars(prev =>
      prev.map(c => {
        const readings = c.readings.slice(0, next);
        while (readings.length < next) readings.push(null);
        return { ...c, readings };
      })
    );
  };

  // ── Balloons ──
  const coordsFromEvent = (clientX: number, clientY: number) => {
    const rect = imgWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Si venimos de arrastrar una burbuja, no creamos una nueva.
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (!addMode || draggingRef.current != null) return;
    const c = coordsFromEvent(e.clientX, e.clientY);
    if (!c) return;
    const n = nextN;
    setBalloons(prev => [...prev, { n, x: c.x, y: c.y }]);
    setChars(prev => [
      ...prev,
      { n, label: '', nominal: null, tolPlus: null, tolMinus: null, unit: 'mm', instrument: null, readings: Array(sampleSize).fill(null) },
    ]);
    setSelected(n);
  };

  // Arrastrar burbuja
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current == null) return;
      didDragRef.current = true;
      const c = coordsFromEvent(e.clientX, e.clientY);
      if (!c) return;
      const n = draggingRef.current;
      setBalloons(prev => prev.map(b => (b.n === n ? { ...b, x: c.x, y: c.y } : b)));
    };
    const onUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const removeChar = (n: number) => {
    setBalloons(prev => prev.filter(b => b.n !== n));
    setChars(prev => prev.filter(c => c.n !== n));
    if (selected === n) setSelected(null);
  };

  const updateChar = (n: number, patch: Partial<DimensionalCharacteristic>) => {
    setChars(prev => prev.map(c => (c.n === n ? { ...c, ...patch } : c)));
  };

  const updateReading = (n: number, idx: number, value: string) => {
    const num = value.trim() === '' ? null : Number(value);
    setChars(prev =>
      prev.map(c => {
        if (c.n !== n) return c;
        const readings = [...c.readings];
        readings[idx] = num != null && Number.isNaN(num) ? null : num;
        return { ...c, readings };
      })
    );
  };

  const numField = (v: number | null): string => (v == null ? '' : String(v));
  const parseNum = (s: string): number | null => {
    if (s.trim() === '') return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  };

  // ── Subir imagen base (foto/plano) ──
  const handleUpload = async (file: File) => {
    setError(null);
    try {
      const path = await uploadDimensionalFile(file, item.project_id, item.part_number);
      setUploadedPath(path);
      const signed = await getFileDownloadUrl(path);
      setImage(signed ?? URL.createObjectURL(file));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ── Reporte "vivo" para imprimir / guardar ──
  const buildReport = (): DimensionalReport => ({
    ...report,
    part_number: report.part_number ?? item.part_number,
    title,
    inspector_name: inspector || null,
    status,
    notes: notes || null,
    sample_size: sampleSize,
    drawing_image: uploadedPath,
    payload: { balloons, characteristics: chars },
  });

  const handleSave = async () => {
    setError(null);
    try {
      const saved = await save(buildReport());
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const okCount = chars.filter(c => characteristicResult(c) === true).length;
  const ngCount = chars.filter(c => characteristicResult(c) === false).length;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[var(--color-app-bg)] flex flex-col">
      {/* Barra superior */}
      <div className="shrink-0 border-b border-[var(--color-app-border)] bg-white px-4 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full max-w-md text-sm font-semibold text-[var(--color-app-text)] bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--color-app-primary)]/40 rounded px-1 -ml-1"
          />
          <p className="text-xs text-[var(--color-app-text-muted)] font-mono">
            {item.part_number} · {report.id}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-[var(--color-app-success-soft)] text-[var(--color-app-success)] font-medium">{okCount} OK</span>
            <span className="px-2 py-0.5 rounded bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] font-medium">{ngCount} NG</span>
          </div>
          <Select value={status} onValueChange={v => setStatus(v as DimensionalStatus)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Borrador">Borrador</SelectItem>
              <SelectItem value="Aprobado">Aprobado</SelectItem>
              <SelectItem value="Rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setPrinting(true)} className="h-8">
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Guardar
          </Button>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-app-surface-alt)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)] text-sm border-b border-[var(--color-app-danger)]/30">
          {error}
        </div>
      )}

      {/* Cuerpo: plano | tabla */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Lienzo del plano */}
        <div className="lg:w-1/2 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--color-app-border)]">
          <div className="shrink-0 px-3 py-2 flex items-center gap-2 bg-[var(--color-app-surface-alt)]/50">
            <Button
              variant={addMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddMode(v => !v)}
              className="h-7 text-xs"
            >
              <MousePointerClick className="h-3.5 w-3.5 mr-1" />
              {addMode ? 'Click en el plano = nueva medición' : 'Activar colocar burbujas'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-7 text-xs">
              <Upload className="h-3.5 w-3.5 mr-1" /> Subir foto/plano
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = '';
              }}
            />
            <span className="text-xs text-[var(--color-app-text-muted)] ml-auto">{balloons.length} burbujas</span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto bg-[var(--color-app-surface-alt)]/30 p-4">
            {imgLoading ? (
              <div className="h-full flex items-center justify-center text-[var(--color-app-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando plano…
              </div>
            ) : image ? (
              <div
                ref={imgWrapRef}
                onClick={handleCanvasClick}
                className={`relative inline-block mx-auto bg-white shadow-sm ${addMode ? 'cursor-crosshair' : 'cursor-default'}`}
              >
                <img src={image} alt="Plano" className="block max-w-full select-none" draggable={false} />
                {balloons.map(b => (
                  <button
                    key={b.n}
                    onPointerDown={e => {
                      e.stopPropagation();
                      draggingRef.current = b.n;
                      didDragRef.current = false;
                      setSelected(b.n);
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      setSelected(b.n);
                    }}
                    style={{ left: `${b.x}%`, top: `${b.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full text-[11px] font-bold text-white flex items-center justify-center border-2 border-white shadow touch-none ${
                      selected === b.n ? 'bg-[var(--color-app-primary)] ring-2 ring-[var(--color-app-primary)]/40' : 'bg-[var(--color-app-danger)]'
                    }`}
                    title={`Medición ${b.n} (arrastra para mover)`}
                  >
                    {b.n}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-[var(--color-app-text-muted)] gap-3">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm max-w-xs">
                  Esta pieza no tiene plano 2D ni imagen. Sube una foto o el plano para globalizarlo.
                </p>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1.5" /> Subir imagen
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de mediciones */}
        <div className="lg:w-1/2 min-h-0 flex flex-col">
          <div className="shrink-0 px-3 py-2 flex items-center gap-2 bg-[var(--color-app-surface-alt)]/50 flex-wrap">
            <span className="text-xs font-medium text-[var(--color-app-text)]">Reporte de inspección</span>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-[var(--color-app-text-muted)]">Muestra:</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => changeSample(-1)}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-medium tabular-nums w-6 text-center">{sampleSize}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => changeSample(1)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <input
              value={inspector}
              onChange={e => setInspector(e.target.value)}
              placeholder="Inspector"
              className="h-7 px-2 text-xs rounded border border-[var(--color-app-border-strong)] bg-white w-full sm:w-40"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {chars.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-sm text-[var(--color-app-text-muted)] p-6">
                Haz click sobre una cota del plano para crear la medición 1, 2, 3… Cada burbuja
                genera un renglón aquí donde capturas nominal, tolerancias y las lecturas por pieza.
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-[var(--color-app-surface-alt)] z-10">
                  <tr className="text-[var(--color-app-text-muted)]">
                    <th className="p-1.5 border border-[var(--color-app-border)] w-8">#</th>
                    <th className="p-1.5 border border-[var(--color-app-border)] text-left min-w-[110px]">Característica</th>
                    <th className="p-1.5 border border-[var(--color-app-border)] w-16">Nominal</th>
                    <th className="p-1.5 border border-[var(--color-app-border)] w-14">Tol +</th>
                    <th className="p-1.5 border border-[var(--color-app-border)] w-14">Tol −</th>
                    <th className="p-1.5 border border-[var(--color-app-border)] w-14">Unidad</th>
                    {pieces.map(j => (
                      <th key={j} className="p-1.5 border border-[var(--color-app-border)] w-16">Pza {j + 1}</th>
                    ))}
                    <th className="p-1.5 border border-[var(--color-app-border)] w-12">Res.</th>
                    <th className="p-1.5 border border-[var(--color-app-border)] w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {chars.map(c => {
                    const { lsl, usl } = specLimits(c);
                    const res = characteristicResult(c);
                    const isSel = selected === c.n;
                    return (
                      <tr
                        key={c.n}
                        className={isSel ? 'bg-[var(--color-app-primary-soft)]/40' : 'hover:bg-[var(--color-app-surface-alt)]/40'}
                        onClick={() => setSelected(c.n)}
                      >
                        <td className="p-0 border border-[var(--color-app-border)] text-center">
                          <div className="h-5 w-5 mx-auto rounded-full bg-[var(--color-app-danger)] text-white font-bold flex items-center justify-center text-[10px]">
                            {c.n}
                          </div>
                        </td>
                        <td className="p-0 border border-[var(--color-app-border)]">
                          <input
                            value={c.label}
                            onChange={e => updateChar(c.n, { label: e.target.value })}
                            placeholder="Ø, largo…"
                            className="w-full h-7 px-1.5 bg-transparent focus:outline-none focus:bg-white"
                          />
                        </td>
                        <td className="p-0 border border-[var(--color-app-border)]">
                          <input
                            value={numField(c.nominal)}
                            onChange={e => updateChar(c.n, { nominal: parseNum(e.target.value) })}
                            inputMode="decimal"
                            className="w-full h-7 px-1.5 text-center bg-transparent focus:outline-none focus:bg-white tabular-nums"
                          />
                        </td>
                        <td className="p-0 border border-[var(--color-app-border)]">
                          <input
                            value={numField(c.tolPlus)}
                            onChange={e => updateChar(c.n, { tolPlus: parseNum(e.target.value) })}
                            inputMode="decimal"
                            placeholder="+"
                            className="w-full h-7 px-1.5 text-center bg-transparent focus:outline-none focus:bg-white tabular-nums"
                          />
                        </td>
                        <td className="p-0 border border-[var(--color-app-border)]">
                          <input
                            value={numField(c.tolMinus)}
                            onChange={e => updateChar(c.n, { tolMinus: parseNum(e.target.value) })}
                            inputMode="decimal"
                            placeholder="−"
                            className="w-full h-7 px-1.5 text-center bg-transparent focus:outline-none focus:bg-white tabular-nums"
                          />
                        </td>
                        <td className="p-0 border border-[var(--color-app-border)]">
                          <select
                            value={c.unit}
                            onChange={e => updateChar(c.n, { unit: e.target.value })}
                            className="w-full h-7 px-1 bg-transparent focus:outline-none text-center"
                          >
                            {UNITS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        {pieces.map(j => {
                          const r = c.readings[j] ?? null;
                          const pass = readingPasses(c, r);
                          return (
                            <td key={j} className="p-0 border border-[var(--color-app-border)]">
                              <input
                                value={numField(r)}
                                onChange={e => updateReading(c.n, j, e.target.value)}
                                inputMode="decimal"
                                className={`w-full h-7 px-1.5 text-center bg-transparent focus:outline-none focus:bg-white tabular-nums ${
                                  pass === false ? 'text-[var(--color-app-danger)] font-semibold' : pass === true ? 'text-[var(--color-app-success)]' : ''
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="p-1 border border-[var(--color-app-border)] text-center font-bold">
                          <span className={res === false ? 'text-[var(--color-app-danger)]' : res === true ? 'text-[var(--color-app-success)]' : 'text-[var(--color-app-text-subtle)]'}>
                            {res === false ? 'NG' : res === true ? 'OK' : '—'}
                          </span>
                          {(lsl != null || usl != null) && (
                            <div className="text-[9px] text-[var(--color-app-text-subtle)] font-normal leading-tight">
                              {lsl != null ? lsl.toFixed(2) : '—'}/{usl != null ? usl.toFixed(2) : '—'}
                            </div>
                          )}
                        </td>
                        <td className="p-0 border border-[var(--color-app-border)] text-center">
                          <button
                            onClick={e => { e.stopPropagation(); removeChar(c.n); }}
                            className="h-7 w-7 inline-flex items-center justify-center text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-danger)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--color-app-border)] p-2">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observaciones del reporte…"
              rows={2}
              className="w-full text-xs px-2 py-1.5 rounded border border-[var(--color-app-border-strong)] bg-white resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-app-primary)]/40"
            />
          </div>
        </div>
      </div>

      {printing && (
        <DimensionalReportPrint
          report={buildReport()}
          item={item}
          projectName={projectName}
          baseImage={image}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>,
    document.body
  );
}
