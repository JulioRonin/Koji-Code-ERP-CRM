import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import type { MeetingMinute, Project, ProjectMeeting } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  minute: MeetingMinute;
  meeting: ProjectMeeting;
  project: Project;
  onClose: () => void;
}

export function MeetingMinutePrint({ minute, meeting, project, onClose }: Props) {
  const { company } = useCompany();
  const brand = company.commercial_name || company.legal_name;
  const d = parseISO(meeting.scheduled_at);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const paragraphs = (text: string) =>
    text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  return createPortal(
    <div id="minute-report-root">
      <style>{`
        @media screen {
          #minute-report-root {
            position: fixed; inset: 0; z-index: 90;
            background: rgba(15,23,42,0.6);
            overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch;
          }
          .min-stage { max-width: 880px; margin: 0 auto; padding: 14px 12px 80px; }
          .min-toolbar { position: sticky; top: 8px; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 10px; }
          .min-page { background: white; border-radius: 10px; padding: 40px 48px; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
        }
        @media print {
          @page { size: letter portrait; margin: 16mm; }
          html, body { background: white !important; height: auto !important; min-height: 0 !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          body > #root { display: none !important; }
          body > #minute-report-root { position: static !important; inset: auto !important; background: white !important; overflow: visible !important; display: block !important; }
          .min-toolbar { display: none !important; }
          .min-stage { max-width: none !important; padding: 0 !important; margin: 0 !important; }
          .min-page { box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
          .min-keep { page-break-inside: avoid; break-inside: avoid; }
          tr { page-break-inside: avoid; }
        }
        #minute-report-root p { line-height: 1.6; }
        #minute-report-root table { border-collapse: collapse; width: 100%; }
        #minute-report-root th, #minute-report-root td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
        #minute-report-root th { background: #f1f5f9; font-weight: 600; }
      `}</style>

      <div className="min-stage">
        <div className="min-toolbar">
          <button onClick={() => window.print()} style={btnPrimary}>
            <Printer style={{ width: 16, height: 16 }} /> Imprimir / Guardar PDF
          </button>
          <button onClick={onClose} style={btnGhost}>
            <X style={{ width: 16, height: 16 }} /> Cerrar
          </button>
        </div>

        <div className="min-page">
          {/* Encabezado */}
          <div className="min-keep" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {company.logo_url && (
                <img src={company.logo_url} alt={brand} style={{ height: 46, width: 46, borderRadius: 8, objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{brand}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {company.legal_name}{company.rfc ? ` · RFC: ${company.rfc}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>MINUTA DE REUNIÓN</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{meeting.meeting_type}</div>
            </div>
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>{minute.title}</h1>

          {/* Datos de la reunión */}
          <div className="min-keep" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
            <Field label="Proyecto" value={`${project.name} (${project.id})`} />
            <Field label="Cliente" value={project.client_name} />
            <Field label="Fecha y hora" value={format(d, "EEEE d 'de' MMMM 'de' yyyy, HH:mm 'h'", { locale: es })} />
            <Field label="Duración" value={`${meeting.duration_minutes} minutos`} />
            {minute.location && <Field label="Lugar / modalidad" value={minute.location} />}
            <Field label="Participantes" value={minute.attendees.length ? minute.attendees.join(', ') : '—'} />
          </div>

          {/* Introducción */}
          <Section title="Introducción">
            {paragraphs(minute.intro).map((p, i) => (
              <p key={i} style={paraStyle}>{p}</p>
            ))}
          </Section>

          {/* Temas tratados */}
          <Section title="Temas tratados">
            {paragraphs(minute.topics).map((p, i) => (
              <p key={i} style={paraStyle}>{p}</p>
            ))}
          </Section>

          {/* Acuerdos */}
          {minute.agreements.length > 0 && (
            <Section title="Acuerdos">
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {minute.agreements.map((a, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#1e293b', marginBottom: 5, lineHeight: 1.5 }}>{a}</li>
                ))}
              </ol>
            </Section>
          )}

          {/* Compromisos / próximos pasos */}
          {minute.actionItems.length > 0 && (
            <Section title="Compromisos y próximos pasos">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '8%', textAlign: 'center' }}>#</th>
                    <th>Compromiso</th>
                    <th style={{ width: '24%' }}>Responsable</th>
                    <th style={{ width: '20%' }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {minute.actionItems.map((it, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center' }}>{i + 1}</td>
                      <td>{it.task}</td>
                      <td>{it.owner || '—'}</td>
                      <td>{it.due || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Cierre */}
          <Section title="Conclusión">
            {paragraphs(minute.closing).map((p, i) => (
              <p key={i} style={paraStyle}>{p}</p>
            ))}
          </Section>

          {/* Firmas */}
          <div className="min-keep" style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            <Signature label={`Por ${brand}`} />
            <Signature label={`Por ${project.client_name}`} />
          </div>

          <div style={{ marginTop: 28, textAlign: 'center', fontSize: 9, color: '#94a3b8' }}>
            {company.legal_name} · Minuta generada el {format(new Date(minute.updatedAt || minute.generatedAt), "d MMM yyyy, HH:mm", { locale: es })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const paraStyle: React.CSSProperties = { fontSize: 12, color: '#1e293b', marginBottom: 10 };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: 'white', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'white', color: '#0f172a', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-keep" style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <div style={{ borderTop: '1px solid #0f172a', paddingTop: 6, fontSize: 11, color: '#334155' }}>{label}</div>
    </div>
  );
}
