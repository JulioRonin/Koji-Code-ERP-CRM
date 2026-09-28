import { useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/contexts/CompanyContext';

/** Pasos del procedimiento: se usan para la vista en pantalla y la versión impresa. */
const STEPS: { n: number; title: string; what: string; who: string; when: string; record: string }[] = [
  {
    n: 1,
    title: 'Detección',
    what: 'Cualquier persona que detecte una pieza fuera de especificación (inspección, piso, recibo de material o reclamo del cliente) detiene su uso.',
    who: 'Quien detecta (Calidad, Producción, Compras, Cliente)',
    when: 'Inmediato',
    record: '—',
  },
  {
    n: 2,
    title: 'Identificación, segregación y registro',
    what: 'Se marca con etiqueta roja, se mueve al área de cuarentena y se registra la NCR en KANRI (Calidad → Rechazar / Reportar NCR). La pieza queda en estatus RECHAZADO.',
    who: 'Inspector de Calidad',
    when: 'Mismo turno',
    record: 'NCR (folio NCR-AAAA-######)',
  },
  {
    n: 3,
    title: 'Contención',
    what: 'Se revisa el lote en proceso, el inventario y lo ya embarcado para asegurar que ningún producto no conforme llegue al cliente.',
    who: 'Calidad con Producción',
    when: '24 h',
    record: 'NCR · paso 1 “Contención”',
  },
  {
    n: 4,
    title: 'Disposición (MRB)',
    what: 'Se decide: Retrabajo, Reparación, Reinspección 100%, Usar como está (concesión con autorización del cliente), Devolver a proveedor o Desecho. Tras un retrabajo la pieza se vuelve a inspeccionar.',
    who: 'Comité MRB: Calidad, Producción, Ingeniería (y cliente si aplica)',
    when: '48 h',
    record: 'NCR · paso 2 “Disposición”',
  },
  {
    n: 5,
    title: 'Análisis de causa raíz',
    what: 'Se aplican 5 porqués / Ishikawa (método, máquina, material, mano de obra, medición, medio ambiente) hasta llegar a la causa de fondo.',
    who: 'Calidad + área responsable',
    when: '5 días hábiles',
    record: 'NCR · paso 3 “Causa raíz”',
  },
  {
    n: 6,
    title: 'Acción correctiva',
    what: 'Se registran acciones en el action list del proyecto con responsable y fecha compromiso. Las áreas de Producción, Diseño y Compras también levantan acciones desde su módulo.',
    who: 'Responsable asignado (cualquier área)',
    when: 'Según fecha compromiso',
    record: 'Acción correctiva (folio CA-AAAA-######)',
  },
  {
    n: 7,
    title: 'Verificación de eficacia y cierre',
    what: 'Se comprueba con evidencia que el problema no se repite (lotes posteriores, Cpk, auditoría). Si no fue eficaz, se reabre el análisis. Se cierra la NCR.',
    who: 'Calidad',
    when: '30 días después de implementar',
    record: 'NCR · paso 5 · registro impreso firmado',
  },
];

const CRITERIA = [
  'Severidad Alta o Crítica: acción correctiva obligatoria.',
  'Si el producto ya salió de planta: notificar al cliente y evaluar recuperación.',
  '“Usar como está” solo con concesión autorizada por el cliente.',
  'Las piezas retrabajadas se reinspeccionan antes de liberarse.',
  'Los registros se conservan como información documentada (ISO 9001 §7.5).',
];

const KPIS = ['NCR abiertas y por severidad', 'Tasa de aprobación de inspección', 'Acciones correctivas vencidas', '% de acciones eficaces', 'Costo de la no calidad'];

/**
 * Procedimiento documentado de control de producto no conforme y acción
 * correctiva (PR-CAL-001). Evidencia para auditorías ISO 9001.
 */
export function NonconformingProcedureCard() {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const brand = company.legal_name || company.commercial_name || 'KANRI';

  const print = () => {
    const e = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const rows = STEPS.map(s => `<tr><td><b>${s.n}. ${e(s.title)}</b><br>${e(s.what)}</td><td>${e(s.who)}</td><td>${e(s.when)}</td><td>${e(s.record)}</td></tr>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>PR-CAL-001</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#16181D;margin:28px;font-size:12px;line-height:1.45}h1{font-size:18px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 6px;color:#475569}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f4f4f2}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #16181D;padding-bottom:8px}.meta td{border:none;padding:1px 0}.sig{display:flex;gap:40px;margin-top:44px}.sig div{flex:1;border-top:1px solid #999;padding-top:4px;text-align:center;color:#475569}</style></head><body>
<div class="head"><div><h1>Control de producto no conforme y acción correctiva</h1><div>${e(brand)}</div></div>
<table class="meta" style="width:auto"><tr><td>Código:&nbsp;</td><td><b>PR-CAL-001</b></td></tr><tr><td>Revisión:&nbsp;</td><td>A</td></tr><tr><td>Fecha:&nbsp;</td><td>${today}</td></tr></table></div>
<h2>1. Objetivo</h2><p>Asegurar que el producto que no cumple con los requisitos se identifique y controle para prevenir su uso o entrega no intencional, y eliminar las causas de las no conformidades para que no se repitan.</p>
<h2>2. Alcance</h2><p>Materia prima, producto en proceso, producto terminado, piezas devueltas por el cliente y material/servicios de proveedores, en todos los proyectos de maquinado.</p>
<h2>3. Referencias</h2><p>ISO 9001:2015 §8.7 Control de las salidas no conformes · §10.2 No conformidad y acción correctiva · §7.5 Información documentada. Plan de control del proyecto (AIAG/APQP).</p>
<h2>4. Desarrollo</h2><table><tr><th style="width:48%">Actividad</th><th>Responsable</th><th>Plazo</th><th>Registro</th></tr>${rows}</table>
<h2>5. Criterios</h2><ul>${CRITERIA.map(c => `<li>${e(c)}</li>`).join('')}</ul>
<h2>6. Indicadores</h2><ul>${KPIS.map(c => `<li>${e(c)}</li>`).join('')}</ul>
<div class="sig"><div>Elaboró · Calidad</div><div>Revisó · Producción</div><div>Aprobó · Dirección</div></div>
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
            <p className="text-sm font-semibold">Procedimiento PR-CAL-001 · Producto no conforme y acción correctiva</p>
            <p className="text-xs text-[var(--color-app-text-muted)]">
              ISO 9001 §8.7 / §10.2 — 7 pasos: detección → contención → disposición → causa raíz → acción → verificación
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <CardContent className="pt-0 pb-5 space-y-4">
          <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {STEPS.map(s => (
              <li key={s.n} className="rounded-lg border border-[var(--color-app-border)] bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold bg-[var(--color-app-text)] text-white shrink-0">{s.n}</span>
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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={print}>
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir procedimiento
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
