import { useState } from 'react';
import { useAuth } from './lib/auth';
import { Heart, Calendar, LogOut, Wind } from 'lucide-react';

interface Props {
  onAgenda: () => void;
  onSos: () => void;
}

export function AppHeader({ onAgenda, onSos }: Props) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark">
            <Heart size={20} strokeWidth={2} />
          </div>
          <span className="brand-name">Calivia</span>
        </div>

        <div className="header-actions">
          <button className="hdr-btn" onClick={onAgenda} type="button" aria-label="Agenda del psicólogo">
            <Calendar size={17} strokeWidth={2} />
            <span className="hdr-label">Agenda</span>
          </button>
          <button className="hdr-btn hdr-sos" onClick={onSos} type="button" aria-label="Respiro urgente">
            <Wind size={17} strokeWidth={2} />
            <span className="hdr-label">Respiro</span>
          </button>
          <div className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
            <div className="user-avatar">
              {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
            </div>
            {menuOpen && (
              <div className="user-menu anim-pop" onClick={(e) => e.stopPropagation()}>
                <div className="user-menu-info">
                  <div className="user-menu-name">{profile?.full_name || 'Usuario'}</div>
                  <div className="user-menu-email">{profile?.email}</div>
                </div>
                <button className="user-menu-logout" onClick={signOut} type="button">
                  <LogOut size={16} strokeWidth={2} />
                  <span>Salir</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .app-header {
          position: sticky; top: 0; z-index: 40;
          background: rgba(245,243,238,0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-soft);
        }
        .header-inner {
          max-width: 560px; margin: 0 auto;
          padding: 12px 20px;
          padding-top: max(12px, env(safe-area-inset-top));
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .brand { display: flex; align-items: center; gap: 8px; }
        .brand-mark {
          width: 36px; height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--primary-200), var(--primary));
          color: #fff;
          display: grid; place-items: center;
          box-shadow: var(--shadow-warm);
        }
        .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .hdr-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-soft);
          border-radius: 999px;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .hdr-btn:hover { background: var(--muted); color: var(--text); border-color: var(--primary-200); }
        .hdr-sos {
          color: var(--secondary);
          border-color: var(--secondary-200);
        }
        .hdr-sos:hover { background: rgba(140,138,126,0.08); color: var(--secondary); border-color: var(--secondary); }
        .hdr-label { display: none; }
        @media (min-width: 400px) { .hdr-label { display: inline; } }

        .user-chip { position: relative; cursor: pointer; }
        .user-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--secondary-200), var(--secondary));
          color: #fff;
          display: grid; place-items: center;
          font-weight: 700; font-size: 14px;
          flex-shrink: 0;
          transition: transform 0.12s;
        }
        .user-chip:hover .user-avatar { transform: scale(1.05); }

        .user-menu {
          position: absolute; top: 42px; right: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow-lg);
          padding: 14px;
          min-width: 200px;
          z-index: 50;
        }
        .user-menu-info { padding-bottom: 10px; border-bottom: 1px solid var(--border-soft); margin-bottom: 10px; }
        .user-menu-name { font-size: 14px; font-weight: 700; color: var(--text); }
        .user-menu-email { font-size: 12px; color: var(--text-soft); margin-top: 2px; }
        .user-menu-logout {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 8px 12px;
          border: none; background: var(--surface-2);
          color: var(--text-soft);
          border-radius: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .user-menu-logout:hover { background: var(--danger-bg); color: var(--danger); }
      `}</style>
    </header>
  );
}
