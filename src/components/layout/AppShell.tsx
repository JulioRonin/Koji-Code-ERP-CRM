import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

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

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex bg-[var(--color-app-bg)] text-[var(--color-app-text)] font-sans">
      {/* Sidebar — drawer en mobile, fijo en desktop */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col h-full min-w-0 w-full">
        <Header onToggleSidebar={() => setSidebarOpen(v => !v)} />
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
