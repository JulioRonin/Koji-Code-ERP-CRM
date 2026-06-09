/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Projects } from './pages/projects/Projects';
import { ProjectDetails } from './pages/projects/ProjectDetails';
import { NewProjectWizard } from './pages/projects/NewProjectWizard';
import { Purchasing } from './pages/purchasing/Purchasing';
import { Design } from './pages/design/Design';
import { Production } from './pages/production/Production';
import { WorkOrderDetails } from './pages/production/WorkOrderDetails';
import { Quality } from './pages/quality/Quality';
import { Technicians } from './pages/technicians/Technicians';
import { Personnel } from './pages/crm/Personnel';
import { Shipping } from './pages/shipping/Shipping';
import { ClientPortal } from './pages/client-portal/ClientPortal';
import { Pmo } from './pages/pmo/Pmo';
import { Integrations } from './pages/settings/Integrations';
import { 
  Billing, 
  Settings 
} from './pages/Placeholders';
import { Chat } from './pages/chat/Chat';
import { useAuth } from './contexts/AuthContext';
import { TechnicianDashboard } from './pages/technicians/TechnicianDashboard';

// Role-based Access Guard
const ProtectedRoute = ({ 
  children, 
  allowedDepartments = ['ALL'] 
}: { 
  children: React.ReactNode, 
  allowedDepartments?: string[] 
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-cyber-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyber-neon"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Technician Specific Redirection
  if (user?.department === 'Técnico' && !location.pathname.startsWith('/technician-portal')) {
    return <Navigate to="/technician-portal" replace />;
  }

  // Prevent Non-Technicians from accessing the portal
  if (user?.department !== 'Técnico' && location.pathname.startsWith('/technician-portal')) {
    return <Navigate to="/" replace />;
  }

  // Access Control by Department
  const canAccess = allowedDepartments.includes('ALL') || 
                   (user && allowedDepartments.includes(user.department)) ||
                   (user && ['Administrador', 'Administración / PM', 'Compras'].includes(user.department)); // Admins see everything

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

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
          
          <Route path="projects" element={
            <ProtectedRoute allowedDepartments={['Producción', 'Diseño']}>
               <Projects />
            </ProtectedRoute>
          } />

          <Route path="projects/new" element={
            <ProtectedRoute allowedDepartments={['Producción', 'Diseño']}>
               <NewProjectWizard />
            </ProtectedRoute>
          } />

          <Route path="projects/:id" element={
            <ProtectedRoute allowedDepartments={['Producción', 'Diseño']}>
               <ProjectDetails />
            </ProtectedRoute>
          } />

          <Route path="purchasing" element={
            <ProtectedRoute allowedDepartments={['Producción']}>
               <Purchasing />
            </ProtectedRoute>
          } />

          <Route path="design" element={
            <ProtectedRoute allowedDepartments={['Producción', 'Diseño']}>
                <Design />
            </ProtectedRoute>
          } />

          <Route path="production" element={
            <ProtectedRoute allowedDepartments={['Producción']}>
                <Production />
            </ProtectedRoute>
          } />

          <Route path="production/wo/:id" element={
            <ProtectedRoute allowedDepartments={['Producción']}>
                <WorkOrderDetails />
            </ProtectedRoute>
          } />

          <Route path="shipping" element={
            <ProtectedRoute allowedDepartments={['Producción']}>
                <Shipping />
            </ProtectedRoute>
          } />

          <Route path="pmo" element={
            <ProtectedRoute allowedDepartments={['Producción']}>
                <Pmo />
            </ProtectedRoute>
          } />

          <Route path="settings/integrations" element={
            <ProtectedRoute allowedDepartments={[]}>
                <Integrations />
            </ProtectedRoute>
          } />

          <Route path="quality" element={
            <ProtectedRoute allowedDepartments={['Producción', 'Calidad']}>
                <Quality />
            </ProtectedRoute>
          } />

          <Route path="technicians" element={
            <ProtectedRoute allowedDepartments={['Producción']}>
               <Technicians />
            </ProtectedRoute>
          } />

          <Route path="personnel" element={
            <ProtectedRoute allowedDepartments={[]}> {/* Admins only via fallback check in ProtectedRoute */}
               <Personnel />
            </ProtectedRoute>
          } />

          <Route path="chat" element={<Chat />} />
          
          <Route path="billing" element={
            <ProtectedRoute allowedDepartments={[]}> {/* Admins only */}
              <Billing />
            </ProtectedRoute>
          } />

          <Route path="settings" element={<Settings />} />
          
          {/* Universal Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

