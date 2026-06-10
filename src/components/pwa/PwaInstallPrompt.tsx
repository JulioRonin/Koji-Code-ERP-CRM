import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'koji_pwa_install_dismissed_at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

/**
 * Banner sutil para invitar a instalar el PWA. Sólo aparece cuando:
 * - el navegador soporta beforeinstallprompt
 * - la app NO está ya instalada
 * - el usuario no ha descartado el banner recientemente
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted' || result.outcome === 'dismissed') {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50">
      <div className="bg-white border border-[var(--color-app-border)] rounded-xl shadow-lg p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-[var(--color-app-primary-soft)] flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-[var(--color-app-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Instala Koji ERP</p>
          <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
            Acceso rápido desde tu pantalla de inicio.
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <Button size="sm" onClick={handleInstall}>
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Ahora no
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-text)] shrink-0"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
