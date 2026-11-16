import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { specText, specLimits, readingPasses, characteristicResult } from '@/lib/dimensional';
import type { BomItem, DimensionalReport } from '@/types/database';

interface Props {
  report: DimensionalReport;
  item: BomItem;
  projectName?: string;
  baseImage: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  Borrador: 'BORRADOR',
  Aprobado: 'APROBADO',
  Rechazado: 'RECHAZADO',
};

export function DimensionalReportPrint({ report, item, projectName, baseImage, onClose }: Props) {
  const { company } = useCompany();
  const brand = company.commercial_name || company.legal_name;
  const balloons = report.payload?.balloons ?? [];
  const characteristics = report.payload?.characteristics ?? [];
  const n = report.sample_size;
  const pieces = Array.from({ length: n }, (_, i) => i);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const overallOk = characteristics.every(c => characteristicResult(c) !== false);

  return createPortal(
    <div id="dim-report-root">
      <style>{`
        @media screen {
          #dim-report-root {
            position: fixed; inset: 0; z-index: 80;
            background: rgba(22,24,29,0.45); backdrop-filter: blur(4px);
            overflow-y: auto; overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .dim-stage { max-width: 980px; margin: 0 auto; padding: 14px 12px 80px; }
          .dim-toolbar { position: sticky; top: 8px; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 10px; }
          .dim-page { background: white; border-radius: 28px; padding: 36px 40px; box-shadow: 0 18px 50px rgba(22,24,29,.25); }
        }
        @media print {
          @page { size: letter portrait; margin: 12mm; }
          html, body { background: white !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          body > * { display: none !important; }
          body > #dim-report-root { position: static !important; inset: auto !important; background: white !important; overflow: visible !important; display: block !important; }
          .dim-toolbar { display: none !important; }
          .dim-stage { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          .dim-page { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
          .dim-keep { page-break-inside: avoid; break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
        }
        #dim-report-root { font-family: 'Outfit', Arial, sans-serif; color: #16181D; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #dim-report-root table { border-collapse: separate; border-spacing: 0; width: 100%; }
        #dim-report-root th, #dim-report-root td { border-bottom: 1px solid #EEF0F3; padding: 6px 7px; font-size: 11px; }
        #dim-report-root td { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; }
        #dim-report-root td:nth-child(2) { font-family: 'Outfit', Arial, sans-serif; font-size: 11.5px; }
        #dim-report-root th { background: #F5F6F8; color: #6B7079; text-align: left; font-weight: 400; border-bottom: 0; }
        #dim-report-root th:first-child { border-radius: 10px 0 0 10px; }
        #dim-report-root th:last-child { border-radius: 0 10px 10px 0; }
      `}</style>

      <div className="dim-stage">
        <div className="dim-toolbar">
          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#16181D', color: 'white', borderRadius: 999, padding: '11px 18px', fontSize: 14 }}
          >
            <Printer style={{ width: 16, height: 16 }} /> Imprimir / Guardar PDF
          </button>
          <button
            onClick={onClose}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', color: '#16181D', borderRadius: 999, padding: '11px 18px', fontSize: 14 }}
          >
            <X style={{ width: 16, height: 16 }} /> Cerrar
          </button>
        </div>

        <div className="dim-page">
          {/* Encabezado */}
          <div className="dim-keep" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #16181D', paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {company.logo_url && (
                <img src={company.logo_url} alt={brand} style={{ height: 44, width: 44, borderRadius: 14, objectFit: 'contain' }} />
              )}
              <div>
                <div style={{ fontSize: 16, color: '#16181D' }}>{brand}</div>
                <div style={{ fontSize: 11, color: '#6B7079' }}>
                  {company.legal_name}{company.rfc ? ` · RFC: ${company.rfc}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', color: '#16181D' }}>Reporte de inspección dimensional</div>
              <div style={{ fontSize: 11, color: '#6B7079' }}>First Article Inspection · ISO 9001</div>
              <div style={{ fontSize: 11, color: '#6B7079', fontFamily: "'JetBrains Mono', monospace" }}>Folio {report.id}</div>
            </div>
          </div>

          {/* Datos de la pieza */}
          <div className="dim-keep" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
            <Field label="No. de parte" value={report.part_number || item.part_number} />
            <Field label="Descripción" value={item.description || '—'} />
            <Field label="Material" value={item.material || '—'} />
            <Field label="Proyecto" value={projectName || item.project_id} />
            <Field label="Inspector" value={report.inspector_name || '—'} />
            <Field label="Fecha" value={new Date(report.updated_at || report.created_at).toLocaleDateString('es-MX')} />
            <Field label="Tamaño de muestra" value={`${n} pza${n === 1 ? '' : 's'}`} />
            <Field
              label="Resultado"
              value={STATUS_LABEL[report.status] || report.status}
              valueColor={report.status === 'Aprobado' ? '#146C35' : report.status === 'Rechazado' ? '#B91C1C' : '#6B7079'}
            />
          </div>

          {/* Plano globalizado */}
          {baseImage && (
            <div className="dim-keep" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, color: '#6B7079' }}>Plano globalizado</div>
              <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#F5F6F8', padding: 8 }}>
                <img src={baseImage} alt="Plano" style={{ display: 'block', width: '100%' }} />
                {balloons.map(b => {
                  const bc = characteristics.find(c => c.n === b.n);
                  const bad = bc ? characteristicResult(bc) === false : false;
                  return (
                  <div
                    key={b.n}
                    style={{
                      position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 24, height: 24, borderRadius: '9999px',
                      background: bad ? '#B91C1C' : '#16181D', color: 'white', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid white',
                    }}
                  >
                    {b.n}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabla de características */}
          <table>
            <thead>
              <tr>
                <th style={{ width: 28, textAlign: 'center' }}>#</th>
                <th>Característica</th>
                <th>Especificación</th>
                <th style={{ textAlign: 'center' }}>LSL</th>
                <th style={{ textAlign: 'center' }}>USL</th>
                {pieces.map(j => (
                  <th key={j} style={{ textAlign: 'center' }}>Pza {j + 1}</th>
                ))}
                <th style={{ textAlign: 'center' }}>Result.</th>
              </tr>
            </thead>
            <tbody>
              {characteristics.length === 0 && (
                <tr>
                  <td colSpan={6 + n} style={{ textAlign: 'center', color: '#A3A8B1' }}>Sin características capturadas</td>
                </tr>
              )}
              {characteristics.map(c => {
                const { lsl, usl } = specLimits(c);
                const res = characteristicResult(c);
                return (
                  <tr key={c.n}>
                    <td style={{ textAlign: 'center' }}>{c.n}</td>
                    <td>{c.label || '—'}</td>
                    <td>{specText(c)}</td>
                    <td style={{ textAlign: 'center' }}>{lsl == null ? '—' : lsl.toFixed(3)}</td>
                    <td style={{ textAlign: 'center' }}>{usl == null ? '—' : usl.toFixed(3)}</td>
                    {pieces.map(j => {
                      const r = c.readings[j] ?? null;
                      const pass = readingPasses(c, r);
                      return (
                        <td
                          key={j}
                          style={{
                            textAlign: 'center',
                            color: pass === false ? '#B91C1C' : pass === true ? '#146C35' : '#16181D',
                            fontWeight: pass === false ? 600 : 400,
                          }}
                        >
                          {r == null ? '—' : r}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', borderRadius: 999, padding: '2px 9px', fontFamily: "'Outfit', sans-serif", fontSize: 11, background: res === false ? '#FBE4E1' : res === true ? '#DDF3E4' : '#ECEDF0', color: res === false ? '#9B1C1C' : res === true ? '#146C35' : '#474C55' }}>
                        {res === false ? 'NG' : res === true ? 'OK' : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {report.notes && (
            <div className="dim-keep" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6B7079', marginBottom: 6 }}>Observaciones</div>
              <div style={{ fontSize: 11, color: '#474C55', whiteSpace: 'pre-wrap' }}>{report.notes}</div>
            </div>
          )}

          {/* Conclusión + firmas */}
          <div className="dim-keep" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6B7079', marginBottom: 2 }}>Dictamen general</div>
              <div style={{ display: 'inline-block', marginTop: 4, borderRadius: 999, padding: '6px 14px', fontSize: 14, background: overallOk ? '#DDF3E4' : '#FBE4E1', color: overallOk ? '#146C35' : '#9B1C1C' }}>
                {overallOk ? 'Conforme' : 'No conforme'}
              </div>
            </div>
            <div style={{ textAlign: 'center', paddingTop: 18 }}>
              <div style={{ borderTop: '1px solid #16181D', paddingTop: 4, fontSize: 11, color: '#474C55' }}>
                {report.inspector_name || 'Inspector de Calidad'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22, textAlign: 'right', fontSize: 9.5, color: '#A3A8B1' }}>
            {company.legal_name} · Documento controlado del Sistema de Gestión de Calidad · powered by KANRI
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: '#F5F6F8', borderRadius: 14, padding: '9px 11px' }}>
      <div style={{ fontSize: 9.5, color: '#6B7079', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ fontSize: 12.5, marginTop: 2, color: valueColor || '#16181D' }}>{value}</div>
    </div>
  );
}
