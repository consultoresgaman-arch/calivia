import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
        <UpdateNotice />
        <InstallPrompt />
      </ErrorBoundary>
    </LanguageProvider>
  </StrictMode>
);
