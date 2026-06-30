import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { isBlocked, isOnTrial, daysLeft } from '@/lib/saas';
import { Subscription } from '@/pages/saas/Subscription';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { user } = useAuth();

  // Gating de suscripción: si la demo terminó (o el pago está vencido) y no es
  // el dueño de plataforma, se bloquea el acceso con la pantalla de planes.
  const blocked = isBlocked(tenant) && !user?.isPlatformOwner;
  const onTrial = isOnTrial(tenant);
  const left = daysLeft(tenant);

  // Cierra el drawer al navegar
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock del body cuando el drawer está abierto en móvil
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Demo terminada → pantalla de suscripción a pantalla completa.
  if (blocked) {
    return <Subscription blocked />;
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex bg-[var(--color-app-bg)] text-[var(--color-app-text)] font-sans">
      {/* Sidebar — drawer en mobile, fijo en desktop */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col h-full min-w-0 w-full">
        <Header onToggleSidebar={() => setSidebarOpen(v => !v)} />

        {/* Banner de demo con días restantes */}
        {onTrial && (
          <button
            onClick={() => navigate('/subscription')}
            className="shrink-0 w-full flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium bg-[var(--color-app-primary-soft)] text-[var(--color-app-primary)] hover:brightness-95 transition"
          >
            <Clock className="h-3.5 w-3.5" />
            Demo · te quedan <strong>{left} día{left === 1 ? '' : 's'}</strong> · <span className="underline">Elegir un plan</span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 py-4 md:px-8 md:py-6 max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>

      <PwaInstallPrompt />
    </div>
  );
}
