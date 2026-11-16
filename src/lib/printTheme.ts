/**
 * Tema de impresión del rediseño para los reportes que se generan como HTML
 * en una ventana nueva (NCR, plan de control, procedimientos, órdenes de
 * mantenimiento…). Se inserta DESPUÉS de los estilos propios de cada reporte:
 * respeta su estructura (clases como .head, .sig, .meta) y le aplica la
 * tipografía, colores y formas del diseño nuevo.
 */

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';

export const PRINT_THEME_CSS = `
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html body { font-family: 'Outfit', Arial, Helvetica, sans-serif; color: #16181D; background: #fff; line-height: 1.45; }
html body h1 { font-family: 'Outfit', Arial, sans-serif; font-weight: 400; font-size: 24px; letter-spacing: -0.02em; line-height: 1.1; margin: 0; }
html body h2 { font-family: 'Outfit', Arial, sans-serif; font-weight: 500; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #6B7079; border: 0; padding: 0; margin: 22px 0 8px; }
html body h3 { font-weight: 500; font-size: 13px; margin: 14px 0 6px; }
html body b, html body strong, html body th { font-weight: 500; }
html body .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 2px solid #16181D; }
html body .sub, html body .muted { color: #6B7079; }
html body table { border-collapse: separate; border-spacing: 0; width: 100%; }
html body th { background: #F5F6F8; color: #6B7079; font-weight: 400; font-size: 10px; text-align: left; padding: 7px 9px; border: 0 !important; }
html body tr > th:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
html body tr > th:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
html body td { padding: 7px 9px; border: 0 !important; border-bottom: 1px solid #EEF0F3 !important; vertical-align: top; }
html body table.meta td, html body table.meta th { background: transparent; border: 0 !important; padding: 2px 10px 2px 0; white-space: nowrap; }
html body .head table.meta { width: auto; flex-shrink: 0; }
html body .sig { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 44px; }
html body .sig > div { border-top: 1px solid #16181D !important; padding-top: 6px; text-align: center; color: #6B7079; font-size: 11px; }
html body .box, html body .card, html body .note { background: #F5F6F8; border: 0 !important; border-radius: 16px; padding: 12px 14px; }
html body .badge, html body .pill { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 10.5px; background: #ECEDF0; color: #474C55; border: 0 !important; }
html body .ok { color: #146C35; } html body .ng, html body .bad { color: #9B1C1C; }
html body code, html body .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
html body .k-foot { margin-top: 26px; text-align: right; font-size: 10px; color: #A3A8B1; }
`;

/**
 * Inserta fuentes + tema en un documento HTML completo (string). Si el
 * documento ya trae <style>, el tema va después para sobrescribir lo común.
 */
export function withPrintTheme(html: string, brand?: string | null): string {
  const theme = `${FONTS}<style>${PRINT_THEME_CSS}</style>`;
  let out = html.includes('</head>')
    ? html.replace('</head>', `${theme}</head>`)
    : html.replace(/<\/style>/i, `</style>${theme}`);
  if (!out.includes(theme)) out = theme + out;
  const foot = `<div class="k-foot">${brand ? `${escapeHtml(brand)} · ` : ''}powered by KANRI</div>`;
  return out.includes('</body>') ? out.replace('</body>', `${foot}</body>`) : out + foot;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
