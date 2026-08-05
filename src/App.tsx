import { useEffect, useState } from 'react';
import { useAuth } from './lib/auth';
import AuthPage from './AuthPage';
import PatientDashboard from './PatientDashboard';
import TherapistDashboard from './TherapistDashboard';
import WelcomeScreen from './WelcomeScreen';
import SosModal from './SosModal';
import DisconnectionZone from './DisconnectionZone';

type Phase = 'entry' | 'auth' | 'app';

export default function App() {
  const { session, profile, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>('entry');
  const [sosOpen, setSosOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    if (session && profile) setPhase('app');
  }, [session, profile]);

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

  if (phase === 'entry') {
    return <WelcomeScreen onEnter={() => setPhase(session && profile ? 'app' : 'auth')} />;
  }

  if (phase === 'auth' || !session || !profile) {
    return <AuthPage />;
  }

  if (profile.role === 'psychologist') return <TherapistDashboard />;

  return (
    <>
      <PatientDashboard
        onSos={() => setSosOpen(true)}
        onDisconnect={() => setDisconnectOpen(true)}
      />
      <SosModal open={sosOpen} onClose={() => setSosOpen(false)} />
      <DisconnectionZone open={disconnectOpen} onClose={() => setDisconnectOpen(false)} isPremium={false} />
    </>
  );
}
