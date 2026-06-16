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
