import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Share2,
  Check,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useClientPortalToken,
  useGenerateClientPortalToken,
} from '@/lib/api';
import type { Project } from '@/types/database';

interface ShareClientLinkModalProps {
  project: Project;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal unificado para generar y compartir el link del portal del cliente.
 * Muestra QR, link copiable, envío por correo y WhatsApp.
 */
export function ShareClientLinkModal({ project, open, onClose }: ShareClientLinkModalProps) {
  const { data: existingToken, refetch } = useClientPortalToken(project.id);
  const { generate, loading: generating } = useGenerateClientPortalToken();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const portalUrl = existingToken ? `${baseUrl}/cliente/${existingToken}` : null;

  useEffect(() => {
    if (!portalUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(portalUrl, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [portalUrl]);

  const handleGenerate = async () => {
    await generate(project.id);
    await refetch();
  };

  const handleCopy = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleShareNative = async () => {
    if (!portalUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Avance del proyecto · ${project.name}`,
          text: `Sigue el avance del proyecto ${project.name} en tiempo real:`,
          url: portalUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopy();
    }
  };

  const mailSubject = encodeURIComponent(`Avance del proyecto · ${project.name}`);
  const mailBody = encodeURIComponent(
    `Estimado equipo de ${project.client_name},\n\n` +
      `Compartimos el enlace donde pueden seguir en tiempo real el avance del proyecto ${project.name} (${project.id}):\n\n` +
      `${portalUrl}\n\n` +
      `Saludos,\nKoji Code ERP`
  );
  const mailtoUrl = `mailto:?subject=${mailSubject}&body=${mailBody}`;

  const whatsappText = encodeURIComponent(
    `*Avance del proyecto ${project.name}*\n` +
      `Sigue el avance en tiempo real:\n${portalUrl}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[var(--color-app-text-muted)]" />
            Compartir con el cliente
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{project.name}</span> · {project.client_name}
          </DialogDescription>
        </DialogHeader>

        {!portalUrl ? (
          <div className="text-center py-8 space-y-4">
            <div className="h-14 w-14 rounded-full bg-[var(--color-app-primary-soft)] flex items-center justify-center mx-auto">
              <Shield className="h-6 w-6 text-[var(--color-app-primary)]" />
            </div>
            <div>
              <p className="font-medium">Aún no se ha generado un enlace</p>
              <p className="text-sm text-[var(--color-app-text-muted)] mt-1">
                El cliente verá: línea de tiempo del proyecto, KPIs, inspecciones y
                documentos. Acceso de solo lectura, sin necesidad de cuenta. Caduca
                en 90 días.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} size="lg">
              {generating ? 'Generando...' : 'Generar enlace seguro'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* QR */}
            {qrDataUrl && (
              <div className="flex items-center gap-4 p-4 bg-[var(--color-app-surface-alt)] rounded-md">
                <div className="bg-white p-2 rounded-md border border-[var(--color-app-border)] shrink-0">
                  <img src={qrDataUrl} alt="QR del portal" className="w-24 h-24" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <Badge variant="success" className="mb-1">Enlace activo</Badge>
                  <p className="text-xs text-[var(--color-app-text-muted)]">
                    El cliente escanea el QR o abre el link para ver el avance en
                    tiempo real.
                  </p>
                </div>
              </div>
            )}

            {/* Link */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--color-app-text-muted)]">Enlace del portal</label>
              <div className="flex items-center gap-2 p-2 bg-white border border-[var(--color-app-border)] rounded-md">
                <span className="text-xs font-mono text-[var(--color-app-text-muted)] truncate flex-1">
                  {portalUrl}
                </span>
                <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <a href={mailtoUrl}>
                  <Mail className="h-4 w-4 mr-1.5" /> Enviar por correo
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
                </a>
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--color-app-text-muted)] pt-2 border-t border-[var(--color-app-border)]">
              <span>Caduca en 90 días desde su generación.</span>
              <button
                onClick={() => window.open(portalUrl, '_blank')}
                className="text-[var(--color-app-primary)] hover:underline inline-flex items-center gap-1"
              >
                Vista previa <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button onClick={handleShareNative} className="w-full">
                <Share2 className="h-4 w-4 mr-1.5" /> Compartir...
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
