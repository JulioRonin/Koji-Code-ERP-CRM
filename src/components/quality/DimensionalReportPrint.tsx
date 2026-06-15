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
            background: rgba(15,23,42,0.6);
            overflow-y: auto; overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          .dim-stage { max-width: 980px; margin: 0 auto; padding: 14px 12px 80px; }
          .dim-toolbar { position: sticky; top: 8px; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 10px; }
          .dim-page { background: white; border-radius: 10px; padding: 32px 36px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
        }
        @media print {
          @page { size: letter portrait; margin: 12mm; }
          html, body { background: white !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          body > #root { display: none !important; }
          body > #dim-report-root { position: static !important; inset: auto !important; background: white !important; overflow: visible !important; display: block !important; }
          .dim-toolbar { display: none !important; }
          .dim-stage { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          .dim-page { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
          .dim-keep { page-break-inside: avoid; break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
        }
        #dim-report-root table { border-collapse: collapse; width: 100%; }
        #dim-report-root th, #dim-report-root td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 11px; }
        #dim-report-root th { background: #f1f5f9; text-align: left; font-weight: 600; }
      `}</style>

      <div className="dim-stage">
        <div className="dim-toolbar">
          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: 'white', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
          >
            <Printer style={{ width: 16, height: 16 }} /> Imprimir / Guardar PDF
          </button>
          <button
            onClick={onClose}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', color: '#0f172a', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
          >
            <X style={{ width: 16, height: 16 }} /> Cerrar
          </button>
        </div>

        <div className="dim-page">
          {/* Encabezado */}
          <div className="dim-keep" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {company.logo_url && (
                <img src={company.logo_url} alt={brand} style={{ height: 44, width: 44, borderRadius: 8, objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{brand}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {company.legal_name}{company.rfc ? ` · RFC: ${company.rfc}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>REPORTE DE INSPECCIÓN DIMENSIONAL</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>First Article Inspection · ISO 9001</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Folio: {report.id}</div>
            </div>
          </div>

          {/* Datos de la pieza */}
          <div className="dim-keep" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
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
              valueColor={report.status === 'Aprobado' ? '#16a34a' : report.status === 'Rechazado' ? '#dc2626' : '#64748b'}
            />
          </div>

          {/* Plano globalizado */}
          {baseImage && (
            <div className="dim-keep" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#0f172a' }}>Plano globalizado</div>
              <div style={{ position: 'relative', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: 'white' }}>
                <img src={baseImage} alt="Plano" style={{ display: 'block', width: '100%' }} />
                {balloons.map(b => (
                  <div
                    key={b.n}
                    style={{
                      position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 22, height: 22, borderRadius: '9999px',
                      background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid white', boxShadow: '0 0 0 1px #dc2626',
                    }}
                  >
                    {b.n}
                  </div>
                ))}
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
                  <td colSpan={6 + n} style={{ textAlign: 'center', color: '#94a3b8' }}>Sin características capturadas</td>
                </tr>
              )}
              {characteristics.map(c => {
                const { lsl, usl } = specLimits(c);
                const res = characteristicResult(c);
                return (
                  <tr key={c.n}>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.n}</td>
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
                            color: pass === false ? '#dc2626' : pass === true ? '#16a34a' : '#0f172a',
                            fontWeight: pass === false ? 700 : 400,
                          }}
                        >
                          {r == null ? '—' : r}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 700, color: res === false ? '#dc2626' : res === true ? '#16a34a' : '#94a3b8' }}>
                      {res === false ? 'NG' : res === true ? 'OK' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {report.notes && (
            <div className="dim-keep" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Observaciones</div>
              <div style={{ fontSize: 11, color: '#334155', whiteSpace: 'pre-wrap' }}>{report.notes}</div>
            </div>
          )}

          {/* Conclusión + firmas */}
          <div className="dim-keep" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Dictamen general</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: overallOk ? '#16a34a' : '#dc2626' }}>
                {overallOk ? 'CONFORME' : 'NO CONFORME'}
              </div>
            </div>
            <div style={{ textAlign: 'center', paddingTop: 18 }}>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: 4, fontSize: 11, color: '#334155' }}>
                {report.inspector_name || 'Inspector de Calidad'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, color: '#94a3b8' }}>
            {company.legal_name} · Documento controlado del Sistema de Gestión de Calidad
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: valueColor || '#0f172a' }}>{value}</div>
    </div>
  );
}
