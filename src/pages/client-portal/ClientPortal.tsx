import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Factory, CheckCircle2, Clock, ShieldCheck, Package, FileText, Calendar, Lock, QrCode,
  ListChecks, Image as ImageIcon, Circle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useClientPortalData, getFileDownloadUrl } from '@/lib/api';
import type { ProjectStatus, ProjectFile } from '@/types/database';
import { cn } from '@/lib/utils';

const IMG_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const isImageFile = (f: ProjectFile) =>
  f.category === 'Foto' || (f.mime_type?.startsWith('image/') ?? false) || IMG_RE.test(f.file_name);

const stageOrder: ProjectStatus[] = ['Cotización', 'Diseño', 'Compras', 'En Producción', 'Calidad', 'Embarque', 'Entregado'];
const stageLabels: Record<ProjectStatus, string> = {
  Cotización: 'Cotización', Diseño: 'Diseño', Compras: 'Procura', 'En Producción': 'Producción',
  Calidad: 'Calidad', Embarque: 'Embarque', Entregado: 'Entregado', Cancelado: 'Cancelado',
};

const KANRI_INK = '#16181D';
const KANRI_ACCENT = '#E2401F';

export function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const { data, loading } = useClientPortalData(token);
  const { project, parts, visibleFiles, brand } = data;

  const accent = brand?.primary_color && /^#[0-9a-fA-F]{6}$/.test(brand.primary_color) ? brand.primary_color : KANRI_ACCENT;
  const brandName = brand?.name || 'KANRI';

  const currentStageIndex = useMemo(() => {
    if (!project || project.status === 'Cancelado') return -1;
    return stageOrder.indexOf(project.status);
  }, [project]);

  // Conteos reales a partir de las piezas (bom_items). Las inspecciones formales
  // (quality_inspections) suelen estar vacías; el estatus de fabricación de cada
  // pieza es el dato real de calidad.
  const prodParts = useMemo(() => parts.filter(p => p.production_relevant !== false), [parts]);
  const approvedParts = prodParts.filter(p => p.manufacturing_status === 'TERMINADO').length;
  const inQualityParts = prodParts.filter(p => p.manufacturing_status === 'CALIDAD').length;
  // "Inspeccionadas" = todo lo que ya pasó (o está en) control de calidad.
  const inspectedParts = approvedParts + inQualityParts + prodParts.filter(p => p.manufacturing_status === 'RECHAZADO').length;

  // Separa archivos visibles en imágenes (galería) y documentos.
  const imageFiles = useMemo(() => visibleFiles.filter(isImageFile), [visibleFiles]);
  const docFiles = useMemo(() => visibleFiles.filter(f => !isImageFile(f)), [visibleFiles]);

  // Resuelve URLs (firmadas) de las imágenes para mostrarlas en la galería.
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        imageFiles.map(async f => [f.id, (await getFileDownloadUrl(f.storage_path)) ?? ''] as const)
      );
      if (!cancelled) setImgUrls(Object.fromEntries(entries.filter(([, u]) => u)));
    })();
    return () => { cancelled = true; };
  }, [imageFiles]);

  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    QRCode.toDataURL(window.location.href, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr).catch(() => setQr(null));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center text-sm text-[#8A9099]">Cargando…</div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold">Enlace inválido o expirado</h2>
            <p className="text-sm text-[#8A9099]">Este enlace de seguimiento ya no es válido. Contacta a tu representante para obtener uno nuevo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(project.deadline).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#16181D]">
      {/* Brand bar (empresa emisora) */}
      <header style={{ background: KANRI_INK }} className="text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brandName} className="h-10 w-10 rounded-md object-contain bg-white p-0.5" />
            ) : (
              <div className="h-10 w-10 rounded-md flex items-center justify-center text-white font-bold" style={{ background: accent }}>
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-sm leading-tight">{brandName}</p>
              <p className="text-[11px] text-white/60">{brand?.tagline || 'Portal de seguimiento'}</p>
            </div>
          </div>
          <span className="text-[11px] text-white/60 hidden sm:inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Acceso seguro · solo lectura
          </span>
        </div>
      </header>

      {/* Hero con acento de la empresa */}
      <div style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }} className="text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-xs uppercase tracking-widest text-white/70">Seguimiento de proyecto</p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{project.name}</h1>
              <p className="text-sm text-white/80 mt-1 font-mono">{project.id} · {project.client_name}</p>
            </div>
            <div className="text-left md:text-right">
              <Badge className="bg-white/20 text-white border-0">{stageLabels[project.status]}</Badge>
              <p className="text-xs text-white/70 mt-1.5">Entrega estimada</p>
              <p className="font-semibold">{format(new Date(project.deadline), "dd 'de' MMM yyyy", { locale: es })}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-1.5"><span className="text-white/80">Avance global</span><span className="font-bold">{project.progress}%</span></div>
            <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Timeline */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-[#8A9099] uppercase tracking-wide mb-4">Etapas del proyecto</h2>
            <div className="flex items-center">
              {stageOrder.map((stage, i) => {
                const done = i < currentStageIndex;
                const current = i === currentStageIndex;
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && <span className="absolute top-3.5 right-1/2 w-full h-0.5" style={{ background: done || current ? accent : '#e2e2e2' }} />}
                    <span className="relative z-10 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={done ? { background: accent, color: '#fff' } : current ? { background: '#fff', border: `2px solid ${accent}`, color: accent } : { background: '#efefef', color: '#aaa' }}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : current ? <Clock className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={cn('text-[10px] mt-1.5 text-center leading-tight', current ? 'font-semibold' : 'text-[#8A9099]')} style={current ? { color: accent } : undefined}>
                      {stageLabels[stage]}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <PortalKpi icon={Factory} label="Partes del proyecto" value={String(prodParts.length)} accent={accent} />
          <PortalKpi icon={Package} label="Inspeccionadas" value={String(inspectedParts)} accent={accent} sub={`${inQualityParts} en calidad`} />
          <PortalKpi icon={ShieldCheck} label="Aprobadas" value={String(approvedParts)} accent={accent} sub={prodParts.length > 0 ? `${Math.round((approvedParts / prodParts.length) * 100)}%` : undefined} />
          <PortalKpi icon={Calendar} label="Días para entrega" value={String(daysLeft)} accent={accent} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Hitos del proyecto */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-[#8A9099] uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Hitos del proyecto
              </h2>
              <div className="space-y-2">
                {stageOrder.map((stage, i) => {
                  const done = currentStageIndex > i;
                  const current = currentStageIndex === i;
                  const state = done ? 'Completado' : current ? 'En curso' : 'Pendiente';
                  return (
                    <div key={stage} className="flex items-center justify-between p-3 border border-[#eee] rounded-md">
                      <div className="flex items-center gap-3">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />
                        ) : current ? (
                          <Clock className="h-4 w-4" style={{ color: accent }} />
                        ) : (
                          <Circle className="h-4 w-4 text-[#cbd5e1]" />
                        )}
                        <div>
                          <p className={cn('text-sm', current ? 'font-semibold' : 'font-medium')}>{stageLabels[stage]}</p>
                          {stage === 'Entregado' && (
                            <p className="text-xs text-[#8A9099] mt-0.5">
                              Entrega estimada: {format(new Date(project.deadline), 'dd MMM yyyy', { locale: es })}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={done ? 'success' : current ? 'default' : 'secondary'}>{state}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* QR para guardar el enlace */}
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <h2 className="text-sm font-semibold text-[#8A9099] uppercase tracking-wide mb-3 flex items-center gap-1.5"><QrCode className="h-4 w-4" /> Guarda tu enlace</h2>
              {qr ? <img src={qr} alt="QR del portal" className="w-36 h-36" /> : <div className="w-36 h-36 bg-[#eee] rounded" />}
              <p className="text-xs text-[#8A9099] mt-3 leading-relaxed">Escanea con tu celular para volver a este seguimiento cuando quieras.</p>
            </CardContent>
          </Card>
        </div>

        {/* Galería de imágenes del proyecto */}
        {imageFiles.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-[#8A9099] uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Imágenes del proyecto
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {imageFiles.map(file => {
                  const url = imgUrls[file.id];
                  return (
                    <a
                      key={file.id}
                      href={url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg overflow-hidden border border-[#eee] bg-[#f4f4f2] aspect-square"
                      title={file.file_name}
                    >
                      {url ? (
                        <img src={url} alt={file.file_name} className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-[#cbd5e1]" />
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documentos */}
        {docFiles.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-[#8A9099] uppercase tracking-wide mb-4">Documentos compartidos</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                {docFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border border-[#eee] rounded-md">
                    <div className="h-9 w-9 rounded-md flex items-center justify-center" style={{ background: `${accent}18` }}>
                      <FileText className="h-4 w-4" style={{ color: accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-[#8A9099] capitalize">{file.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-[#8A9099] py-4">
          {brandName} · {new Date().getFullYear()} · <span className="opacity-70">powered by KANRI</span>
        </p>
      </main>
    </div>
  );
}

function PortalKpi({ icon: Icon, label, value, accent, sub }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string; accent: string; sub?: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#8A9099]">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {sub && <p className="text-[11px] text-[#8A9099] mt-0.5">{sub}</p>}
          </div>
          <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: `${accent}18` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
