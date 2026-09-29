import { useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/CompanyContext';
import { QMS_DOC } from './qmsDoc';

/**
 * Pasos B1–B6 de la sección 8 (TPNC) del PR-CAL-001. Deben coincidir con el
 * diagrama B y la tabla de actividades del PDF del procedimiento.
 */
const STEPS: { code: string; title: string; what: string; who: string; when: string; record: string }[] = [
  {
    code: 'B1',
    title: 'Identificar, segregar y registrar',
    what: 'Quien detecta detiene el uso de la pieza, la marca con etiqueta roja y la lleva al área de cuarentena. Calidad registra la NCR (pieza, cantidad, dónde se detectó, tipo de defecto, severidad). En KANRI, rechazar una pieza obliga a registrar su NCR.',
    who: 'Quien detecta · Responsable de Calidad',
    when: 'Mismo turno',
    record: 'NCR (NCR-AAAA-######)',
  },
  {
    code: 'B2',
    title: 'Contención',
    what: 'Se revisa el lote en proceso, el inventario y lo ya embarcado para que ningún producto no conforme llegue al cliente. Si ya se entregó, se notifica al cliente.',
    who: 'Calidad · Jefe de Producción',
    when: '24 h',
    record: 'NCR · paso Contención',
  },
  {
    code: 'B3',
    title: 'Disposición (MRB)',
    what: 'Calidad, Producción e Ingeniería deciden: Retrabajo, Reparación, Reinspección 100%, Usar como está (solo con concesión escrita del cliente, aprobada por la Dirección), Devolver a proveedor o Desecho. Lo retrabajado o reparado se vuelve a inspeccionar.',
    who: 'Calidad · Producción · Ingeniería',
    when: '48 h',
    record: 'NCR · paso Disposición (quién y cuándo)',
  },
  {
    code: 'B4',
    title: 'Causa raíz',
    what: 'Se aplican 5 porqués (o Ishikawa: método, máquina, material, mano de obra, medición, medio ambiente) hasta la causa de fondo.',
    who: 'Calidad + área responsable',
    when: '5 días hábiles',
    record: 'NCR · paso Causa raíz',
  },
  {
    code: 'B5',
    title: 'Acción correctiva',
    what: 'Se registran acciones para eliminar la causa, con responsable y fecha compromiso, en el action list. Cualquier área (Calidad, Producción, Diseño, Compras) puede levantar acciones.',
    who: 'Responsable asignado',
    when: 'Fecha compromiso',
    record: 'Acción correctiva (CA-AAAA-######)',
  },
  {
    code: 'B6',
    title: 'Verificación de eficacia y cierre',
    what: 'Se comprueba con evidencia que el problema no se repite (lotes posteriores, auditoría). Si no fue eficaz, se vuelve a analizar la causa. Se cierran la NCR y la acción.',
    who: 'Responsable de Calidad',
    when: '30 días tras implementar',
    record: 'NCR · paso Verificación · registro impreso',
  },
];

const CRITERIA = [
  'Se requiere acción correctiva si la severidad es Alta o Crítica, la falla es repetitiva, o viene de una queja del cliente o de una auditoría. En los demás casos la NCR puede cerrarse con la disposición y una justificación registrada.',
  'No se rechaza sin NCR: toda pieza rechazada queda identificada, segregada y registrada.',
  '“Usar como está” solo con concesión escrita del cliente, aprobada por la Dirección.',
  'Si el producto ya salió de planta: notificar al cliente y evaluar su recuperación.',
  'Los registros se conservan como información documentada (ISO 9001 §7.5).',
];

const KPIS = ['NCR abiertas por severidad', 'Contención en ≤ 24 h', 'Acciones correctivas vencidas', '% de acciones eficaces', 'Costo de la no calidad'];

/**
 * Sección 8 del PR-CAL-001: Tratamiento de Producto No Conforme y Acción
 * Correctiva (TPNC). ISO 9001:2015 §8.7 y §10.2.
 */
export function NonconformingProcedureCard() {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const brand = company.legal_name || company.commercial_name || 'KANRI';

  const print = () => {
    const e = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const rows = STEPS.map(s => `<tr><td><b>${s.code}. ${e(s.title)}</b><br>${e(s.what)}</td><td>${e(s.who)}</td><td>${e(s.when)}</td><td>${e(s.record)}</td></tr>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${QMS_DOC.code} §${QMS_DOC.section} ${QMS_DOC.sectionShort}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#16181D;margin:28px;font-size:12px;line-height:1.45}h1{font-size:17px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 6px;color:#475569}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f4f2}
.head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #16181D;padding-bottom:8px}.meta td{border:none;padding:1px 0}.sub{color:#475569}</style></head><body>
<div class="head"><div><div class="sub">${e(brand)} · ${QMS_DOC.code} ${e(QMS_DOC.title)}</div><h1>Sección ${QMS_DOC.section} — ${e(QMS_DOC.sectionTitle)} (${QMS_DOC.sectionShort})</h1></div>
<table class="meta" style="width:auto"><tr><td>Documento:&nbsp;</td><td><b>${QMS_DOC.code}</b></td></tr><tr><td>Revisión:&nbsp;</td><td><b>${QMS_DOC.revision}</b> · ${QMS_DOC.revisionDate}</td></tr><tr><td>Creación:&nbsp;</td><td>${QMS_DOC.createdDate}</td></tr></table></div>
<h2>Objetivo</h2><p>Que el producto que no cumple requisitos se identifique y controle para evitar su uso o entrega no intencional, y que se elimine la causa para que no se repita (ISO 9001:2015 §8.7 y §10.2).</p>
<h2>Desarrollo</h2><table><tr><th style="width:48%">Actividad</th><th>Responsable</th><th>Plazo</th><th>Registro</th></tr>${rows}</table>
<h2>Criterios</h2><ul>${CRITERIA.map(c => `<li>${e(c)}</li>`).join('')}</ul>
<h2>Indicadores</h2><ul>${KPIS.map(c => `<li>${e(c)}</li>`).join('')}</ul>
<p class="sub" style="margin-top:24px;font-size:10px">Esta sección forma parte del ${QMS_DOC.code} ${e(QMS_DOC.title)}, Rev. ${QMS_DOC.revision}. La versión vigente está en el sistema de gestión; una copia impresa es copia no controlada.</p>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[var(--color-app-surface-alt)]/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]">
            <BookOpenCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Sección {QMS_DOC.section} · {QMS_DOC.sectionTitle} ({QMS_DOC.sectionShort})
            </p>
            <p className="text-xs text-[var(--color-app-text-muted)]">
              {QMS_DOC.code} {QMS_DOC.title} · Rev. {QMS_DOC.revision} — ISO 9001 §8.7 / §10.2 · pasos B1–B6: registro → contención → disposición → causa raíz → acción → verificación
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <CardContent className="pt-0 pb-5 space-y-4">
          <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {STEPS.map(s => (
              <li key={s.code} className="rounded-lg border border-[var(--color-app-border)] bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="h-6 min-w-6 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold bg-[var(--color-app-text)] text-white shrink-0">{s.code}</span>
                  <p className="text-sm font-semibold">{s.title}</p>
                </div>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-2 leading-relaxed">{s.what}</p>
                <div className="mt-2 space-y-0.5 text-[11px]">
                  <p><span className="text-[var(--color-app-text-subtle)]">Responsable:</span> {s.who}</p>
                  <p><span className="text-[var(--color-app-text-subtle)]">Plazo:</span> {s.when}</p>
                  <p><span className="text-[var(--color-app-text-subtle)]">Registro:</span> {s.record}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-[var(--color-app-surface-alt)] p-3">
              <p className="font-semibold mb-1">Criterios</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[var(--color-app-text-muted)]">{CRITERIA.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
            <div className="rounded-lg bg-[var(--color-app-surface-alt)] p-3">
              <p className="font-semibold mb-1">Indicadores</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[var(--color-app-text-muted)]">{KPIS.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--color-app-text-subtle)]">
              Creación {QMS_DOC.createdDate} · Rev. {QMS_DOC.revision} del {QMS_DOC.revisionDate}
            </p>
            <Button variant="outline" size="sm" onClick={print}>
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir sección {QMS_DOC.section}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
