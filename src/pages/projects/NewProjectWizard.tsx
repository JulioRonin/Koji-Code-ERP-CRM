import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  FileText,
  Box,
  ClipboardList,
  X,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CyberDatePicker } from '@/components/ui/CyberDatePicker';
import { cn } from '@/lib/utils';
import { useCreateProject, useUploadProjectFile, useBulkInsertBom } from '@/lib/api';
import { format } from 'date-fns';
import { useChat } from '@/contexts/ChatContext';

interface Basics {
  name: string;
  client: string;
  description: string;
  startDate?: Date;
  deadline?: Date;
}

interface BomDraft {
  partNumber: string;
  description: string;
  category: string;
  quantity: number;
  uom: string;
  material?: string;
}

interface DrawingFile {
  file: File;
  type: '2D' | '3D';
  partNumber?: string;
}

const STEPS = [
  { id: 1, label: 'Datos básicos',     icon: ClipboardList },
  { id: 2, label: 'OC del cliente',    icon: FileText },
  { id: 3, label: 'BOM / materiales',  icon: Box },
  { id: 4, label: 'Planos 2D / 3D',    icon: Upload },
  { id: 5, label: 'Revisar y crear',   icon: Check },
] as const;

function inferDrawingType(name: string): '2D' | '3D' {
  const lower = name.toLowerCase();
  if (lower.endsWith('.step') || lower.endsWith('.stp') || lower.endsWith('.igs') || lower.endsWith('.stl')) return '3D';
  return '2D';
}

export function NewProjectWizard() {
  const navigate = useNavigate();
  const { sendSystemMessage } = useChat();
  const { create: createProject, loading: creatingProject } = useCreateProject();
  const { upload: uploadFile } = useUploadProjectFile();
  const { insert: insertBom } = useBulkInsertBom();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [basics, setBasics] = useState<Basics>({
    name: '',
    client: '',
    description: '',
  });

  const [poFile, setPoFile] = useState<File | null>(null);
  const [bomDraft, setBomDraft] = useState<BomDraft[]>([]);
  const [bomFileName, setBomFileName] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<DrawingFile[]>([]);

  const canGoNext = (() => {
    if (step === 1) return basics.name.length >= 3 && basics.client.length >= 2 && basics.startDate && basics.deadline;
    return true;
  })();

  const handleBomUpload = (file: File) => {
    setError(null);
    setBomFileName(file.name);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const parsed: BomDraft[] = rows.map(row => ({
          partNumber: String(row.Name ?? row['Part Number'] ?? row['Part Description'] ?? 'N/A'),
          description: String(row['Part Description'] ?? row.Description ?? row.Notes ?? 'Sin descripción'),
          category: String(row.Type ?? row.Category ?? 'General'),
          quantity: Number(row.Qty ?? row.Quantity ?? 1),
          uom: String(row.UOM ?? 'Pzas'),
          material: row.Material ? String(row.Material) : undefined,
        }));
        setBomDraft(parsed);
      } catch (err) {
        console.error(err);
        setError('No se pudo procesar el archivo. Verifica el formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrawingsUpload = (files: FileList) => {
    const items: DrawingFile[] = Array.from(files).map(file => ({
      file,
      type: inferDrawingType(file.name),
      partNumber: bomDraft.find(b => file.name.toLowerCase().includes(b.partNumber.toLowerCase()))?.partNumber,
    }));
    setDrawings(prev => [...prev, ...items]);
  };

  const handleSubmit = async () => {
    if (!basics.startDate || !basics.deadline) return;
    setError(null);

    try {
      const project = await createProject({
        name: basics.name,
        client_name: basics.client,
        description: basics.description || null,
        start_date: format(basics.startDate, 'yyyy-MM-dd'),
        deadline: format(basics.deadline, 'yyyy-MM-dd'),
      });

      // Sube OC del cliente
      if (poFile) {
        await uploadFile({
          projectId: project.id,
          category: 'OC_Cliente',
          file: poFile,
          isClientVisible: false,
        });
      }

      // Inserta BOM
      if (bomDraft.length > 0) {
        await insertBom(
          bomDraft.map(b => ({
            project_id: project.id,
            part_number: b.partNumber,
            description: b.description,
            category: b.category,
            quantity: b.quantity,
            uom: b.uom,
            material: b.material ?? null,
          }))
        );
      }

      // Sube planos
      for (const draw of drawings) {
        await uploadFile({
          projectId: project.id,
          category: draw.type === '3D' ? 'Modelo_3D' : 'Plano_2D',
          file: draw.file,
          isClientVisible: false,
        });
      }

      sendSystemMessage(
        '2',
        `🚀 Proyecto creado vía wizard: [${project.id}] ${project.name} para ${project.client_name}. ${bomDraft.length} partes, ${drawings.length} planos.`,
        'PROJECT'
      );

      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message || 'Error al crear el proyecto.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header con stepper */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <span className="text-sm text-[var(--color-app-text-muted)]">
            Paso {step} de {STEPS.length}
          </span>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Nuevo proyecto</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Configura el proyecto y carga la documentación inicial. Podrás editarlo después.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => !creatingProject && setStep(s.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md transition-colors shrink-0',
                    isActive
                      ? 'bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)]'
                      : isDone
                      ? 'text-[var(--color-app-success)]'
                      : 'text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-alt)]'
                  )}
                >
                  <span
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold',
                      isActive
                        ? 'bg-[var(--color-app-primary)] text-white'
                        : isDone
                        ? 'bg-[var(--color-app-success)] text-white'
                        : 'bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]'
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="h-px flex-1 bg-[var(--color-app-border)] min-w-4" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Steps */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos básicos del proyecto</CardTitle>
            <CardDescription>Información de identificación y plazos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium">Nombre del proyecto</label>
                <Input
                  placeholder="Ej. Eje principal ensamblaje 737-MAX"
                  value={basics.name}
                  onChange={e => setBasics({ ...basics, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cliente</label>
                <Input
                  placeholder="Ej. BRP, Foxconn, Bosch..."
                  value={basics.client}
                  onChange={e => setBasics({ ...basics, client: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha de inicio</label>
                <CyberDatePicker
                  value={basics.startDate}
                  onChange={d => setBasics({ ...basics, startDate: d })}
                  placeholder="DD / MM / YYYY"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fecha de entrega</label>
                <CyberDatePicker
                  value={basics.deadline}
                  onChange={d => setBasics({ ...basics, deadline: d })}
                  placeholder="DD / MM / YYYY"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  placeholder="Detalles, especificaciones generales, alcance..."
                  rows={4}
                  value={basics.description}
                  onChange={e => setBasics({ ...basics, description: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Orden de compra del cliente</CardTitle>
            <CardDescription>Sube el PDF de la OC. Es opcional pero recomendado.</CardDescription>
          </CardHeader>
          <CardContent>
            {poFile ? (
              <div className="flex items-center justify-between p-3 border border-[var(--color-app-border)] rounded-md">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[var(--color-app-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{poFile.name}</p>
                    <p className="text-xs text-[var(--color-app-text-muted)]">
                      {(poFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPoFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-[var(--color-app-border)] rounded-md flex flex-col items-center justify-center py-12 cursor-pointer hover:border-[var(--color-app-primary)] transition-colors">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={e => e.target.files?.[0] && setPoFile(e.target.files[0])}
                />
                <div className="h-12 w-12 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center mb-3">
                  <Upload className="h-5 w-5 text-[var(--color-app-text-muted)]" />
                </div>
                <p className="text-sm font-medium">Arrastra o haz clic para subir la OC</p>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-1">PDF, PNG o JPG</p>
              </label>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de materiales (BOM)</CardTitle>
            <CardDescription>
              Sube un Excel con columnas: <code className="text-xs">Name, Part Description, Type, Qty, UOM</code>.
              Detectamos las partes automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bomDraft.length === 0 ? (
              <label className="border-2 border-dashed border-[var(--color-app-border)] rounded-md flex flex-col items-center justify-center py-12 cursor-pointer hover:border-[var(--color-app-primary)] transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={e => e.target.files?.[0] && handleBomUpload(e.target.files[0])}
                />
                <div className="h-12 w-12 rounded-full bg-[var(--color-app-surface-alt)] flex items-center justify-center mb-3">
                  <Box className="h-5 w-5 text-[var(--color-app-text-muted)]" />
                </div>
                <p className="text-sm font-medium">Subir BOM (Excel / CSV)</p>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-1">.xlsx, .xls, .csv</p>
              </label>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 bg-[var(--color-app-success-soft)] rounded-md">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-app-success)]">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">
                      {bomFileName} — {bomDraft.length} partes detectadas
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBomDraft([]);
                      setBomFileName(null);
                    }}
                  >
                    Reemplazar
                  </Button>
                </div>

                <div className="border border-[var(--color-app-border)] rounded-md max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-app-surface-alt)] sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-[var(--color-app-text-muted)]">Part #</th>
                        <th className="text-left px-3 py-2 font-medium text-[var(--color-app-text-muted)]">Descripción</th>
                        <th className="text-left px-3 py-2 font-medium text-[var(--color-app-text-muted)]">Categoría</th>
                        <th className="text-right px-3 py-2 font-medium text-[var(--color-app-text-muted)]">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomDraft.map((b, i) => (
                        <tr key={i} className="border-t border-[var(--color-app-border)]">
                          <td className="px-3 py-2 font-mono text-xs">{b.partNumber}</td>
                          <td className="px-3 py-2">{b.description}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary">{b.category}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {b.quantity} {b.uom}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Planos 2D y modelos 3D</CardTitle>
            <CardDescription>
              Sube los archivos por pieza. Detectamos 2D vs 3D por extensión e intentamos asociarlos al BOM por nombre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="border-2 border-dashed border-[var(--color-app-border)] rounded-md flex flex-col items-center justify-center py-8 cursor-pointer hover:border-[var(--color-app-primary)] transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,.dwg,.dxf,.step,.stp,.igs,.stl,.png,.jpg,.jpeg"
                className="sr-only"
                onChange={e => e.target.files && handleDrawingsUpload(e.target.files)}
              />
              <Upload className="h-5 w-5 text-[var(--color-app-text-muted)] mb-2" />
              <p className="text-sm font-medium">Subir archivos</p>
              <p className="text-xs text-[var(--color-app-text-muted)] mt-1">
                Acepta PDF, DWG, DXF, STEP, STP, IGS, STL
              </p>
            </label>

            {drawings.length > 0 && (
              <div className="space-y-1.5">
                {drawings.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 border border-[var(--color-app-border)] rounded-md"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Badge variant={d.type === '3D' ? 'default' : 'secondary'}>{d.type}</Badge>
                      <span className="text-sm truncate">{d.file.name}</span>
                      {d.partNumber && (
                        <span className="text-xs text-[var(--color-app-text-muted)] font-mono shrink-0">
                          → {d.partNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-[var(--color-app-text-muted)]">
                        {(d.file.size / 1024).toFixed(1)} KB
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDrawings(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisar y crear</CardTitle>
            <CardDescription>Confirma los datos antes de crear el proyecto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ReviewRow label="Nombre"      value={basics.name} />
            <ReviewRow label="Cliente"     value={basics.client} />
            <ReviewRow label="Inicio"      value={basics.startDate ? format(basics.startDate, 'dd MMM yyyy') : '—'} />
            <ReviewRow label="Entrega"     value={basics.deadline  ? format(basics.deadline,  'dd MMM yyyy') : '—'} />
            <ReviewRow label="OC"          value={poFile ? poFile.name : 'No subida'} />
            <ReviewRow label="BOM"         value={bomDraft.length > 0 ? `${bomDraft.length} partes` : 'No subido'} />
            <ReviewRow label="Planos"      value={drawings.length > 0 ? `${drawings.length} archivos` : 'No subidos'} />
            {basics.description && <ReviewRow label="Descripción" value={basics.description} multiline />}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-3 bg-[var(--color-app-danger-soft)] border border-[var(--color-app-danger)]/30 rounded-md text-sm text-[var(--color-app-danger)]">
          {error}
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || creatingProject}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Anterior
        </Button>
        {step < STEPS.length ? (
          <Button onClick={() => setStep(s => Math.min(STEPS.length, s + 1))} disabled={!canGoNext}>
            Siguiente <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={creatingProject}>
            {creatingProject ? 'Creando...' : 'Crear proyecto'}
            <Check className="h-4 w-4 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', multiline && 'items-start')}>
      <span className="text-[var(--color-app-text-muted)] col-span-1">{label}</span>
      <span className={cn('col-span-2', multiline ? 'whitespace-pre-wrap' : 'truncate')}>{value}</span>
    </div>
  );
}
