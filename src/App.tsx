/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/auth/Login';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Projects } from './pages/projects/Projects';
import { ProjectDetails } from './pages/projects/ProjectDetails';
import { NewProjectWizard } from './pages/projects/NewProjectWizard';
import { Purchasing } from './pages/purchasing/Purchasing';
import { Inventory } from './pages/inventory/Inventory';
import { Design } from './pages/design/Design';
import { Production } from './pages/production/Production';
import { WorkOrderDetails } from './pages/production/WorkOrderDetails';
import { Quality } from './pages/quality/Quality';
import { Technicians } from './pages/technicians/Technicians';
import { Personnel } from './pages/crm/Personnel';
import { Customers } from './pages/crm/Customers';
import { Shipping } from './pages/shipping/Shipping';
import { ClientPortal } from './pages/client-portal/ClientPortal';
import { Pmo } from './pages/pmo/Pmo';
import { Quotes } from './pages/quotes/Quotes';
import { QuoteBuilder } from './pages/quotes/QuoteBuilder';
import { Integrations } from './pages/settings/Integrations';
import { CompanySettingsPage } from './pages/settings/CompanySettingsPage';
import { Pricing } from './pages/saas/Pricing';
import { Onboarding } from './pages/saas/Onboarding';
import { PlatformAdmin } from './pages/saas/PlatformAdmin';
import { LandingHome } from './pages/saas/LandingHome';
import { Subscription } from './pages/saas/Subscription';
import { Billing } from './pages/billing/Billing';
import { Finance } from './pages/finance/Finance';
import { Cobranza } from './pages/finance/Cobranza';
import { Chat } from './pages/chat/Chat';
import { useAuth } from './contexts/AuthContext';
import { TechnicianDashboard } from './pages/technicians/TechnicianDashboard';
import { canAccessPath, defaultRouteForRole } from './lib/permissions';

// Role-based Access Guard
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading, isRecovery } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-cyber-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyber-neon"></div>
      </div>
    );
  }

  // Si el usuario llegó por un enlace de recuperación, NO lo dejamos entrar
  // al ERP: lo mandamos a fijar su nueva contraseña.
  if (isRecovery) {
    return <Navigate to="/reset-password" replace />;
  }

  if (!isAuthenticated) {
    // Puerta de entrada: pantalla de inicio con opciones (login / registrar /
    // demo), no el login directo.
    return <Navigate to="/welcome" state={{ from: location }} replace />;
  }

  // Aunque haya sesión, al abrir la raíz mostramos primero la pantalla de
  // inicio para que el usuario elija (entrar / registrar otra empresa). Una vez
  // que entra (markEntered), navega normal dentro de la app.
  const entered = (() => {
    try {
      return sessionStorage.getItem('kanri_entered') === '1';
    } catch {
      return true;
    }
  })();
  if (!entered && location.pathname === '/') {
    return <Navigate to="/welcome" replace />;
  }

  // Técnicos viven en /technician-portal pero pueden ir a /chat para
  // discutir piezas concretas. Cualquier otra ruta los regresa al portal.
  if (
    user?.role === 'Técnico' &&
    !location.pathname.startsWith('/technician-portal') &&
    !location.pathname.startsWith('/chat')
  ) {
    return <Navigate to="/technician-portal" replace />;
  }
  if (user?.role !== 'Técnico' && location.pathname.startsWith('/technician-portal')) {
    return <Navigate to="/" replace />;
  }

  // Permisos por ruta — single source of truth en src/lib/permissions.ts
  // (incluye overrides de permisos por usuario, si los tiene).
  if (!canAccessPath(user?.role, location.pathname, user?.permissions)) {
    return <Navigate to={defaultRouteForRole(user?.role)} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/welcome" element={<LandingHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/platform" element={
          <ProtectedRoute><PlatformAdmin /></ProtectedRoute>
        } />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public Client Portal (magic-link, no auth guard) */}
        <Route path="/cliente/:token" element={<ClientPortal />} />

        {/* Technician Specific Terminal */}
        <Route path="/technician-portal" element={
          <ProtectedRoute>
            <TechnicianDashboard />
          </ProtectedRoute>
        } />

        {/* Unified ERP Interface */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="projects/new" element={<ProtectedRoute><NewProjectWizard /></ProtectedRoute>} />
          <Route path="projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          <Route path="purchasing" element={<ProtectedRoute><Purchasing /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="design" element={<ProtectedRoute><Design /></ProtectedRoute>} />
          <Route path="production" element={<ProtectedRoute><Production /></ProtectedRoute>} />
          <Route path="production/wo/:id" element={<ProtectedRoute><WorkOrderDetails /></ProtectedRoute>} />
          <Route path="shipping" element={<ProtectedRoute><Shipping /></ProtectedRoute>} />
          <Route path="pmo" element={<ProtectedRoute><Pmo /></ProtectedRoute>} />
          <Route path="customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
          <Route path="quotes/:id" element={<ProtectedRoute><QuoteBuilder /></ProtectedRoute>} />
          <Route path="settings/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
          <Route path="quality" element={<ProtectedRoute><Quality /></ProtectedRoute>} />
          <Route path="technicians" element={<ProtectedRoute><Technicians /></ProtectedRoute>} />
          <Route path="personnel" element={<ProtectedRoute><Personnel /></ProtectedRoute>} />
          <Route path="chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="cobranza" element={<ProtectedRoute><Cobranza /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><CompanySettingsPage /></ProtectedRoute>} />
          <Route path="subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
          
          {/* Universal Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

