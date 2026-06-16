import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { GanttChart } from './GanttChart';

interface GanttTask {
  id: string;
  name: string;
  department: 'Compras' | 'Diseño' | 'Producción' | 'Calidad';
  startDay: number;
  duration: number;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed';
}

interface Props {
  startDate: string;
  tasks: GanttTask[];
  endDate?: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * Vista imprimible / descargable del Gantt en orientación HORIZONTAL,
 * ajustada al ancho de la hoja (carta apaisada). Usa el patrón portal +
 * @media print del resto de reportes para que solo se imprima el cronograma.
 */
export function GanttPrint({ startDate, tasks, endDate, title, subtitle, onClose }: Props) {
  const { company } = useCompany();
  const brand = company.commercial_name || company.legal_name;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div id="gantt-print-root">
      <style>{`
        @media screen {
          #gantt-print-root {
            position: fixed; inset: 0; z-index: 90;
            background: rgba(15,23,42,0.6);
            overflow: auto; -webkit-overflow-scrolling: touch;
          }
          .gp-stage { max-width: 1200px; margin: 0 auto; padding: 14px 12px 80px; }
          .gp-toolbar { position: sticky; top: 8px; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 10px; }
          .gp-page { background: white; border-radius: 10px; padding: 28px 32px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
        }
        @media print {
          @page { size: letter landscape; margin: 10mm; }
          html, body { background: white !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          body > * { display: none !important; }
          body > #gantt-print-root { position: static !important; inset: auto !important; background: white !important; overflow: visible !important; display: block !important; }
          .gp-toolbar { display: none !important; }
          .gp-stage { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          .gp-page { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        }
      `}</style>

      <div className="gp-stage">
        <div className="gp-toolbar">
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

        <div className="gp-page">
          {/* Encabezado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {company.logo_url && (
                <img src={company.logo_url} alt={brand} style={{ height: 40, width: 40, borderRadius: 8, objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{brand}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{title}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>CRONOGRAMA · GANTT</div>
              {subtitle && <div style={{ fontSize: 11, color: '#64748b' }}>{subtitle}</div>}
            </div>
          </div>

          {/* Gantt ajustado al ancho de la hoja */}
          <GanttChart startDate={startDate} tasks={tasks} endDate={endDate} noAnimation />
        </div>
      </div>
    </div>,
    document.body
  );
}
