import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth';
import { getSessionToken } from './lib/session';
import AuthPage from './AuthPage';
import PatientDashboard from './PatientDashboard';
import TherapistDashboard from './TherapistDashboard';
import WelcomeScreen from './WelcomeScreen';
import TermsGate, { CURRENT_TERMS_VERSION } from './TermsGate';
import OfflineScreen from './OfflineScreen';
import { initPushNotifications } from './lib/pushNotifications';

type Phase = 'entry' | 'auth' | 'app';

export default function App() {
  const { profile, loading, offline, retrySession } = useAuth();
  // Si ya hay un token de sesión guardado, arrancamos directo en 'app' para
  // no mostrar ni la bienvenida ni el login mientras se resuelve la sesión
  // en segundo plano (la pantalla de carga cubre esa espera).
  const [phase, setPhase] = useState<Phase>(() => (getSessionToken() ? 'app' : 'entry'));

  useEffect(() => {
    if (profile) setPhase('app');
  }, [profile]);

  useEffect(() => {
    if (profile?.id) void initPushNotifications();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="full-loader">
        <div className="loader-heart" />
        <style>{`
          .full-loader { min-height: 100vh; display: grid; place-items: center; background: var(--bg); }
          .loader-heart { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (offline && !profile) return <OfflineScreen onRetry={retrySession} />;

  if (phase === 'entry') {
    return <WelcomeScreen onEnter={() => setPhase(profile ? 'app' : 'auth')} />;
  }

  if (phase === 'auth' || !profile) {
    return <AuthPage />;
  }

  if (profile.terms_version !== CURRENT_TERMS_VERSION) return <TermsGate />;

  if (profile.role === 'psychologist') return <TherapistDashboard />;

  return <PatientDashboard onExitToHome={() => setPhase('entry')} />;
}
