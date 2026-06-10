import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ChatProvider } from './contexts/ChatContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { registerSW } from 'virtual:pwa-register';

// Registra el service worker (PWA). autoUpdate: recarga en silencio al haber nueva versión.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ChatProvider>
        <App />
      </ChatProvider>
    </AuthProvider>
  </StrictMode>,
);
