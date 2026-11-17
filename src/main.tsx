import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { AuthProvider } from './lib/auth';
import { LanguageProvider } from './lib/i18n';
import ErrorBoundary from './ErrorBoundary';
import UpdateNotice from './UpdateNotice';
import InstallPrompt from './InstallPrompt';
import './index.css';

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Vercel Web Analytics: cuenta visitas a la web sin cookies. Solo en el sitio
// publicado; la app nativa no tiene esa ruta. El componente toma la ruta única
// del proyecto de VITE_VERCEL_OBSERVABILITY_BASEPATH, que Vercel define al compilar;
// la versión React del paquete no la lee sola, por eso se pasa explícitamente.
const trackWebVisits = !Capacitor.isNativePlatform() && location.hostname.endsWith('vercel.app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
        <UpdateNotice />
        <InstallPrompt />
        {trackWebVisits && (
          <Analytics
            basePath={import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH}
            configString={import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG}
          />
        )}
      </ErrorBoundary>
    </LanguageProvider>
  </StrictMode>
);
