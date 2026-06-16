import type { MeetingMinute, MinuteActionItem } from '@/types/database';

/** Contexto del proyecto/junta para redactar la minuta. */
export interface MinuteContext {
  companyName: string;
  clientName: string;
  projectName: string;
  projectId: string;
  meetingTitle: string;
  meetingType: string;
  dateText: string;
}

/** Datos crudos que captura el usuario (el "prompt"). */
export interface MinuteInput {
  purpose: string;
  discussion: string;
  attendees: string[];
  agreements: string[];
  actionItems: MinuteActionItem[];
  location?: string;
}

// ── Utilidades de redacción ──────────────────────────────────────────────

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const endsWithPunct = (s: string) => /[.!?…]$/.test(s.trim());

/** Normaliza una oración: mayúscula inicial + punto final. */
function ensureSentence(s: string): string {
  const t = s.trim();
  if (!t) return '';
  const cap = upperFirst(t);
  return endsWithPunct(cap) ? cap : `${cap}.`;
}

/** Divide un textarea en líneas limpias, quitando viñetas/numeración inicial. */
export function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map(l => l.replace(/^[\s•\-*–·]+/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

/** Parsea "tarea — responsable — fecha" (o con -, |) en un action item. */
export function parseActionItem(line: string): MinuteActionItem {
  const parts = line.split(/\s*[—|]\s*|\s+-\s+/).map(p => p.trim());
  return {
    task: parts[0] ?? line.trim(),
    owner: parts[1] || undefined,
    due: parts[2] || undefined,
  };
}

// ── Composición de la minuta ──────────────────────────────────────────────

/**
 * Redacta de forma algorítmica los párrafos profesionales de la minuta
 * (introducción, desarrollo de temas y cierre) a partir de los datos crudos.
 * El tono es profesional y cálido, buscando la empatía entre cliente y
 * proveedor. El resultado es totalmente editable antes de exportar.
 */
export function composeMinute(input: MinuteInput, ctx: MinuteContext): {
  title: string;
  intro: string;
  topics: string;
  closing: string;
} {
  const purpose = input.purpose.trim();
  const type = ctx.meetingType.toLowerCase();

  const intro =
    `El presente documento integra la minuta de la ${type} correspondiente al proyecto ` +
    `${ctx.projectName} (${ctx.projectId}), celebrada el ${ctx.dateText}. ` +
    `En ${ctx.companyName} agradecemos la participación, el tiempo y la apertura de ` +
    `${ctx.clientName} y de todo el equipo involucrado. ` +
    (purpose
      ? `El objetivo de esta sesión fue ${lowerFirst(ensureSentence(purpose))}`
      : 'El objetivo de esta sesión fue dar seguimiento al avance del proyecto y alinear los próximos pasos de manera conjunta.');

  // Desarrollo: convertimos el texto libre en párrafos legibles.
  const discussionLines = splitLines(input.discussion);
  const topics =
    discussionLines.length > 0
      ? discussionLines.map(ensureSentence).join('\n\n')
      : 'Durante la sesión se revisó el estatus general del proyecto, se atendieron las dudas de las partes y se alinearon los criterios necesarios para su continuidad.';

  const closing =
    `Agradecemos nuevamente la confianza y la disposición para construir soluciones en conjunto. ` +
    `En ${ctx.companyName} reafirmamos nuestro compromiso de mantener una comunicación cercana, ` +
    `clara y oportuna con ${ctx.clientName}, con el fin de asegurar el éxito del proyecto ` +
    `${ctx.projectName}. Quedamos a su entera disposición para cualquier duda o comentario ` +
    `derivado de esta reunión.`;

  return {
    title: `Minuta — ${ctx.meetingTitle}`,
    intro,
    topics,
    closing,
  };
}

// ── Generación del cuerpo enriquecido (HTML) ──────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convierte texto plano (párrafos separados por línea en blanco) en <p>. */
function paragraphsToHtml(text: string): string {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paras.length === 0) return '';
  return paras.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/**
 * Documento HTML profesional (editable) con secciones, lista de acuerdos y
 * tabla de compromisos. Es lo que se carga en el editor enriquecido.
 */
export function composeBodyHtml(input: MinuteInput, ctx: MinuteContext): string {
  const doc = composeMinute(input, ctx);
  let html = '';
  html += `<h2>Introducción</h2>${paragraphsToHtml(doc.intro)}`;
  html += `<h2>Temas tratados</h2>${paragraphsToHtml(doc.topics)}`;

  if (input.agreements.length > 0) {
    html += `<h2>Acuerdos</h2><ol>${input.agreements
      .map(a => `<li>${escapeHtml(a)}</li>`)
      .join('')}</ol>`;
  }

  if (input.actionItems.length > 0) {
    const rows = input.actionItems
      .map(
        (it, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(it.task)}</td><td>${escapeHtml(
            it.owner || ''
          )}</td><td>${escapeHtml(it.due || '')}</td></tr>`
      )
      .join('');
    html +=
      `<h2>Compromisos y próximos pasos</h2>` +
      `<table><thead><tr><th>#</th><th>Compromiso</th><th>Responsable</th><th>Fecha</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>`;
  }

  html += `<h2>Conclusión</h2>${paragraphsToHtml(doc.closing)}`;
  return html;
}

/** Reconstruye el HTML a partir de una minuta vieja (sin bodyHtml). */
export function legacyToBodyHtml(m: {
  intro?: string;
  topics?: string;
  closing?: string;
  agreements?: string[];
  actionItems?: MinuteActionItem[];
}): string {
  let html = '';
  if (m.intro) html += `<h2>Introducción</h2>${paragraphsToHtml(m.intro)}`;
  if (m.topics) html += `<h2>Temas tratados</h2>${paragraphsToHtml(m.topics)}`;
  if (m.agreements && m.agreements.length > 0) {
    html += `<h2>Acuerdos</h2><ol>${m.agreements.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ol>`;
  }
  if (m.actionItems && m.actionItems.length > 0) {
    const rows = m.actionItems
      .map(
        (it, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(it.task)}</td><td>${escapeHtml(it.owner || '')}</td><td>${escapeHtml(it.due || '')}</td></tr>`
      )
      .join('');
    html +=
      `<h2>Compromisos y próximos pasos</h2>` +
      `<table><thead><tr><th>#</th><th>Compromiso</th><th>Responsable</th><th>Fecha</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  if (m.closing) html += `<h2>Conclusión</h2>${paragraphsToHtml(m.closing)}`;
  return html;
}

/** Construye un objeto MeetingMinute completo (datos + documento generado). */
export function buildMinute(input: MinuteInput, ctx: MinuteContext): MeetingMinute {
  const doc = composeMinute(input, ctx);
  const now = new Date().toISOString();
  return {
    purpose: input.purpose,
    discussion: input.discussion,
    attendees: input.attendees,
    agreements: input.agreements,
    actionItems: input.actionItems,
    location: input.location,
    title: doc.title,
    intro: doc.intro,
    topics: doc.topics,
    closing: doc.closing,
    generatedAt: now,
    updatedAt: now,
  };
}
