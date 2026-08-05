import { useEffect, useState } from 'react';
import { MessageCircle, Wind, Gamepad2, LogOut, Heart } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import AiChat from './AiChat';
import FreemiumBanner from './FreemiumBanner';
import SosModal from './SosModal';
import DisconnectionZone from './DisconnectionZone';

const MAX_FREE_MESSAGES = 20;

type Section = 'chat' | 'breathe' | 'games';

interface Props {
  onSos?: () => void;
  onDisconnect?: () => void;
}

export default function PatientDashboard(_props: Props) {
  const { profile, signOut } = useAuth();
  const [section, setSection] = useState<Section>('chat');
  const [messagesSent, setMessagesSent] = useState(0);
  const [sosOpen, setSosOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('chat_logs')
        .select('created_at')
        .eq('user_id', profile!.id)
        .eq('role', 'user');
      if (!mounted || !data) return;
      const todayCount = data.filter((c) => c.created_at.slice(0, 10) === today).length;
      setMessagesSent(todayCount);
    })();
    return () => { mounted = false; };
  }, [profile, today]);

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark"><Heart size={18} strokeWidth={2} /></div>
            <span className="brand-name">Calivia</span>
          </div>
          <div className="header-actions">
            <div className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
              <div className="user-avatar">{(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}</div>
              {menuOpen && (
                <div className="user-menu anim-pop" onClick={(e) => e.stopPropagation()}>
                  <div className="user-menu-info">
                    <div className="user-menu-name">{profile?.full_name || 'Usuario'}</div>
                    <div className="user-menu-email">{profile?.email}</div>
                  </div>
                  <button className="user-menu-logout" onClick={signOut} type="button">
                    <LogOut size={16} strokeWidth={2} /><span>Salir</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="refugio">
        {section === 'chat' && <FreemiumBanner messagesToday={messagesSent} maxFree={MAX_FREE_MESSAGES} />}

        <div className="section-tabs">
          <button className={`stab ${section === 'chat' ? 'active' : ''}`} onClick={() => setSection('chat')} type="button">
            <MessageCircle size={16} strokeWidth={2} /><span>Conversar</span>
          </button>
          <button className={`stab ${section === 'breathe' ? 'active' : ''}`} onClick={() => setSection('breathe')} type="button">
            <Wind size={16} strokeWidth={2} /><span>Respirar</span>
          </button>
          <button className={`stab ${section === 'games' ? 'active' : ''}`} onClick={() => setSection('games')} type="button">
            <Gamepad2 size={16} strokeWidth={2} /><span>Desconectar</span>
          </button>
        </div>

        {section === 'chat' && (
          <div className="chat-section anim-fade">
            <AiChat userId={profile!.id} messagesSent={messagesSent} maxFree={MAX_FREE_MESSAGES} onMessageSent={() => setMessagesSent((n) => n + 1)} />
          </div>
        )}

        {section === 'breathe' && (
          <div className="breathe-section anim-fade" onClick={() => setSosOpen(true)} role="button" tabIndex={0}>
            <div className="breathe-card">
              <div className="breathe-aura" />
              <div className="organic-figure breathe-organic" />
              <h2>Respira a mi ritmo</h2>
              <p>Toca para abrir el refugio de respiración</p>
            </div>
          </div>
        )}

        {section === 'games' && (
          <div className="games-section anim-fade" onClick={() => setDisconnectOpen(true)} role="button" tabIndex={0}>
            <div className="games-card">
              <div className="games-icon"><Gamepad2 size={28} strokeWidth={1.5} /></div>
              <h2>Zona de desconexión</h2>
              <p>Ejercicios táctiles para frenar la rumiación</p>
            </div>
          </div>
        )}
      </main>

      <div className="sos-dock">
        <button className="sos-fab" onClick={() => setSosOpen(true)} type="button">
          <Wind size={20} strokeWidth={2} /><span>Respiro urgente</span>
        </button>
      </div>

      <SosModal open={sosOpen} onClose={() => setSosOpen(false)} />
      <DisconnectionZone open={disconnectOpen} onClose={() => setDisconnectOpen(false)} isPremium={false} />

      <style>{`
        .app-header { position: sticky; top: 0; z-index: 40; background: rgba(245,243,238,0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-soft); }
        .header-inner { max-width: 560px; margin: 0 auto; padding: 12px 20px; padding-top: max(12px, env(safe-area-inset-top)); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .brand { display: flex; align-items: center; gap: 8px; }
        .brand-mark { width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(135deg, var(--primary-200), var(--primary)); color: #fff; display: grid; place-items: center; }
        .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .user-chip { position: relative; cursor: pointer; }
        .user-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--secondary-200), var(--secondary)); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; }
        .user-menu { position: absolute; top: 40px; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 14px; min-width: 200px; z-index: 50; }
        .user-menu-info { padding-bottom: 10px; border-bottom: 1px solid var(--border-soft); margin-bottom: 10px; }
        .user-menu-name { font-size: 14px; font-weight: 700; }
        .user-menu-email { font-size: 12px; color: var(--text-soft); margin-top: 2px; }
        .user-menu-logout { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: var(--surface-2); color: var(--text-soft); border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .user-menu-logout:hover { background: var(--danger-bg); color: var(--danger); }

        .refugio { max-width: 560px; margin: 0 auto; padding: 16px 20px 100px; display: flex; flex-direction: column; gap: 16px; min-height: calc(100vh - 60px); }

        .section-tabs { display: flex; gap: 6px; background: var(--surface-2); padding: 5px; border-radius: 14px; border: 1px solid var(--border-soft); }
        .stab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border: none; background: transparent; color: var(--text-soft); font-size: 13px; font-weight: 600; border-radius: 10px; cursor: pointer; transition: all 0.15s; }
        .stab.active { background: var(--surface); color: var(--primary-600); box-shadow: 0 2px 6px rgba(58,58,54,0.06); }

        .chat-section { flex: 1; display: flex; flex-direction: column; min-height: 420px; }
        .chat-section .chat-card { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; display: flex; flex-direction: column; }

        .breathe-section { cursor: pointer; }
        .breathe-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 60px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px; position: relative; overflow: hidden; transition: border-color 0.2s; }
        .breathe-card:hover { border-color: var(--primary-200); }
        .breathe-aura { position: absolute; top: 50%; left: 50%; width: 200px; height: 200px; transform: translate(-50%, -60%); background: radial-gradient(circle, rgba(112,130,56,0.12) 0%, transparent 70%); filter: blur(20px); }
        .breathe-organic { width: 120px; height: 120px; background: linear-gradient(135deg, var(--primary-200), var(--primary)); animation: organicPulse 6s ease-in-out infinite; position: relative; z-index: 1; }
        .breathe-card h2 { margin: 0; font-size: 18px; font-weight: 700; }
        .breathe-card p { margin: 0; font-size: 14px; color: var(--text-soft); }

        .games-section { cursor: pointer; }
        .games-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 60px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px; transition: border-color 0.2s; }
        .games-card:hover { border-color: var(--primary-200); }
        .games-icon { width: 64px; height: 64px; border-radius: 20px; background: rgba(112,130,56,0.1); color: var(--primary); display: grid; place-items: center; }
        .games-card h2 { margin: 0; font-size: 18px; font-weight: 700; }
        .games-card p { margin: 0; font-size: 14px; color: var(--text-soft); }

        .sos-dock { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); background: linear-gradient(180deg, transparent, var(--bg) 30%); z-index: 30; display: flex; justify-content: center; }
        .sos-fab { display: flex; align-items: center; gap: 8px; padding: 14px 28px; border: none; border-radius: 999px; background: var(--secondary); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(140,138,126,0.25); transition: transform 0.12s; max-width: 320px; width: 100%; justify-content: center; }
        .sos-fab:hover { transform: translateY(-2px); }
        .sos-fab:active { transform: scale(0.97); }
      `}</style>
    </>
  );
}
