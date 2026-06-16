import { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Table as TableIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
  Pilcrow,
} from 'lucide-react';

/** Estilos compartidos por el editor y la vista de impresión del documento. */
export const RICH_CONTENT_CSS = `
.rte-content { font-size: 13px; color: #1e293b; line-height: 1.6; word-break: break-word; }
.rte-content:focus { outline: none; }
.rte-content h1 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 14px 0 8px; }
.rte-content h2 { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: .5px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
.rte-content h3 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 12px 0 6px; }
.rte-content p { margin: 0 0 10px; }
.rte-content ul, .rte-content ol { margin: 0 0 10px; padding-left: 22px; }
.rte-content li { margin-bottom: 4px; }
.rte-content table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; }
.rte-content th, .rte-content td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
.rte-content th { background: #f1f5f9; font-weight: 600; }
.rte-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 6px 0; }
.rte-content strong, .rte-content b { font-weight: 700; }
.rte-content a { color: #2563eb; text-decoration: underline; }
`;

interface Props {
  initialHtml: string;
  onChange: (html: string) => void;
  /** Cambia este valor para forzar recargar el contenido (p. ej. al regenerar). */
  resetKey?: number | string;
  minHeight?: number;
}

export function RichTextEditor({ initialHtml, onChange, resetKey, minHeight = 280 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editor NO controlado: fijamos el HTML solo al montar o al cambiar resetKey,
  // para no mover el cursor en cada tecla.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || '<p><br></p>';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  };

  const insertHtml = (html: string) => {
    ref.current?.focus();
    document.execCommand('insertHTML', false, html);
    emit();
  };

  const insertTable = () => {
    const dims = window.prompt('Insertar tabla — filas x columnas (ej. 3x3):', '3x3') || '';
    const m = dims.match(/(\d+)\s*[x×,]\s*(\d+)/);
    const rows = Math.min(30, Math.max(1, m ? Number(m[1]) : 3));
    const cols = Math.min(10, Math.max(1, m ? Number(m[2]) : 3));
    let html = '<table><thead><tr>';
    for (let c = 0; c < cols; c++) html += `<th>Columna ${c + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows - 1; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    insertHtml(html);
  };

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => insertHtml(`<img src="${reader.result}" alt="imagen" /><p><br></p>`);
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-md border border-[var(--color-app-border-strong)] bg-white overflow-hidden">
      <style>{RICH_CONTENT_CSS}</style>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)]/60 sticky top-0 z-10">
        <Tb onClick={() => exec('bold')} title="Negritas"><Bold className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('italic')} title="Cursiva"><Italic className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('underline')} title="Subrayado"><Underline className="h-3.5 w-3.5" /></Tb>
        <Sep />
        <Tb onClick={() => exec('formatBlock', 'H2')} title="Título de sección"><Heading2 className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('formatBlock', 'H3')} title="Subtítulo"><Heading3 className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('formatBlock', 'P')} title="Texto normal"><Pilcrow className="h-3.5 w-3.5" /></Tb>
        <Sep />
        <Tb onClick={() => exec('insertUnorderedList')} title="Lista con viñetas"><List className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('insertOrderedList')} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></Tb>
        <Sep />
        <Tb onClick={() => exec('justifyLeft')} title="Alinear a la izquierda"><AlignLeft className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('justifyCenter')} title="Centrar"><AlignCenter className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => exec('justifyRight')} title="Alinear a la derecha"><AlignRight className="h-3.5 w-3.5" /></Tb>
        <Sep />
        <Tb onClick={insertTable} title="Insertar tabla"><TableIcon className="h-3.5 w-3.5" /></Tb>
        <Tb onClick={() => fileRef.current?.click()} title="Insertar imagen"><ImageIcon className="h-3.5 w-3.5" /></Tb>
        <Sep />
        <Tb onClick={() => exec('removeFormat')} title="Quitar formato"><Eraser className="h-3.5 w-3.5" /></Tb>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleImageFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Área editable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="rte-content px-4 py-3 overflow-auto"
        style={{ minHeight }}
      />
    </div>
  );
}

function Tb({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()} // no perder la selección del editor
      onClick={onClick}
      className="h-7 w-7 inline-flex items-center justify-center rounded text-[var(--color-app-text-muted)] hover:bg-white hover:text-[var(--color-app-text)] transition-colors"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-[var(--color-app-border)]" />;
}
