import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ChatProvider } from './contexts/ChatContext.tsx';
import { PresenceProvider } from './contexts/PresenceContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { CompanyProvider } from './contexts/CompanyContext.tsx';
import { TenantProvider } from './contexts/TenantContext.tsx';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/layout/ErrorBoundary.tsx';

// Registra el service worker (PWA). autoUpdate: recarga en silencio al haber nueva versión.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantProvider>
      <CompanyProvider>
        <AuthProvider>
          <ChatProvider>
            <PresenceProvider>
              <ErrorBoundary fullScreen>
                <App />
              </ErrorBoundary>
            </PresenceProvider>
          </ChatProvider>
        </AuthProvider>
      </CompanyProvider>
    </TenantProvider>
  </StrictMode>,
);
