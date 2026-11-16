import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { crumbsForPath } from '@/lib/navigation';
import { TopBar } from './TopBar';
import { NavRail } from './NavRail';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { isBlocked, isOnTrial } from '@/lib/saas';
import { Subscription } from '@/pages/saas/Subscription';
import { ErrorBoundary } from './ErrorBoundary';
import { cn } from '@/lib/utils';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { company } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant, loading: tenantLoading } = useTenant();
  const { user } = useAuth();

  // Gating de suscripción: si la demo terminó (o el pago está vencido) y no es
  // el dueño de plataforma, se bloquea el acceso con la pantalla de planes.
  const blocked = isBlocked(tenant) && !user?.isPlatformOwner;
  const onTrial = isOnTrial(tenant);

  // Contador en vivo de la demo: refresca cada minuto para que SÍ se vea bajar.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!onTrial) return;
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [onTrial]);

  const end = tenant.subscription.currentPeriodEnd;
  const remainingMs = end ? Math.max(0, new Date(end).getTime() - Date.now()) : 0;
  const trialDays = Math.floor(remainingMs / 86_400_000);
  const trialHours = Math.floor((remainingMs % 86_400_000) / 3_600_000);

  // Cierra el drawer al navegar
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // ⌘K / Ctrl+K abre la búsqueda global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Espera a resolver la empresa activa antes de montar los módulos: así los
  // hooks de datos ya filtran por la empresa correcta (evita ver, por un
  // instante, datos/marca de otra empresa al entrar).
  if (tenantLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[var(--color-app-bg)]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--color-app-primary)]" />
      </div>
    );
  }

  // Demo terminada → pantalla de suscripción a pantalla completa.
  if (blocked) {
    return <Subscription blocked />;
  }

  const crumbs = crumbsForPath(location.pathname);
  const detail = crumbs && location.pathname !== crumbs.modulePath
    ? decodeURIComponent(location.pathname.slice(crumbs.modulePath.length + 1).split('/')[0])
    : null;
  const brandName = company.commercial_name || company.legal_name;

  return (
    <div
      className="h-[100dvh] w-full overflow-hidden bg-[var(--color-app-frame)] text-[var(--color-app-text)] font-sans md:p-3"
      style={{
        // Safe-area del notch/barra iOS aplicado aquí (caja border-box: NO infla
        // la altura), en lugar de en el <body>.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Lienzo redondeado del rediseño (a pantalla completa en móvil) */}
      <div className="h-full flex flex-col overflow-hidden bg-[var(--color-app-bg)] md:rounded-[32px] md:shadow-[0_0_0_6px_rgba(255,255,255,.6)]">
        <TopBar onOpenNav={() => setSidebarOpen(true)} onOpenSearch={() => setSearchOpen(true)} />

        {/* Banner de demo con días restantes */}
        {onTrial && (
          <button
            onClick={() => navigate('/subscription')}
            className="mx-4 md:mx-6 mb-2 shrink-0 self-start inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs bg-[var(--color-app-accent)] text-[var(--color-app-accent-ink)] hover:brightness-95 transition"
          >
            <Clock className="h-3.5 w-3.5" />
            Demo · te quedan{' '}
            <strong className="font-medium">
              {trialDays > 0
                ? `${trialDays} día${trialDays === 1 ? '' : 's'} ${trialHours} h`
                : `${trialHours} h`}
            </strong>
            · <span className="underline">Elegir un plan</span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 pb-6 md:px-6 md:pb-8 max-w-[1600px] mx-auto w-full md:grid md:grid-cols-[56px_minmax(0,1fr)] md:gap-6 lg:gap-8">
            <NavRail />
            <div className="app-content min-w-0 pt-2 md:pt-4">
              {crumbs && (
                <nav className="mb-3 flex items-center gap-3 text-sm text-[var(--color-app-text-muted)]" aria-label="Ruta">
                  {detail ? (
                    <Link to={crumbs.modulePath} className="hover:text-[var(--color-app-text)] transition-colors">{crumbs.module}</Link>
                  ) : (
                    <span>{crumbs.area}</span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className={cn('text-[var(--color-app-text)]', detail && 'font-mono text-[13px]')}>{detail ?? crumbs.module}</span>
                </nav>
              )}
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
              <p className="mt-10 text-right text-xs text-[var(--color-app-text-subtle)]">
                {brandName ? `${brandName} · ` : ''}powered by KANRI
              </p>
            </div>
          </div>
        </div>
      </div>

      <MobileNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <PwaInstallPrompt />
    </div>
  );
}
