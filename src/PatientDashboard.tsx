import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MessageCircle, Wind, Gamepad2, LogOut, TrendingUp, CheckSquare, Home, CalendarClock, CloudRain, NotebookPen, UserCog, HeartPulse, Video } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import { getAvatarSignedUrl } from './lib/avatar';
import { refreshCrisisContacts } from './lib/crisisContacts';
import { useHeartbeatSound } from './lib/useHeartbeatSound';
import AiChat from './AiChat';
import SosModal from './SosModal';
import DisconnectionZone from './DisconnectionZone';
import ScheduleModal from './ScheduleModal';
import WeeklyProgress from './WeeklyProgress';
import TaskManager from './TaskManager';
import SoundGallery from './SoundGallery';
import QuickCheckIn from './QuickCheckIn';
import JournalSpace from './JournalSpace';
import MicroPause from './MicroPause';
import DailySpark from './DailySpark';
import ProfileSettingsModal from './ProfileSettingsModal';
import VoiceTaskCommand from './VoiceTaskCommand';
import { useT } from './lib/i18n';
import { initVoiceShortcut, voiceShortcutReady, wasLaunchedFromVoiceShortcut, onVoiceShortcutReopen } from './lib/voiceShortcut';
import strings from './PatientDashboard.i18n';

// Debe coincidir con DAILY_MESSAGE_LIMIT en supabase/functions/ai-chat/index.ts.
const MAX_DAILY_MESSAGES = 50;
const VIDEO_LINK_VISIBLE_HOURS = 6;

type Section = 'chat' | 'breathe' | 'games' | 'progress' | 'tasks' | 'sounds' | 'journal';

interface Props {
  onExitToHome?: () => void;
}

export default function PatientDashboard({ onExitToHome }: Props) {
  const { profile, signOut } = useAuth();
  const t = useT(strings);
  const [section, setSection] = useState<Section>('chat');
  // Atajo nativo de app "Programar por voz" (mantener presionado el ícono → ver
  // android/app/src/main/res/xml/shortcuts.xml). Cada vez que este contador sube, le decimos
  // a VoiceTaskCommand que abra el panel y arranque a escuchar de una — tanto en el arranque
  // en frío (la app recién abrió por el shortcut) como si la persona vuelve a tocarlo con
  // Calivia ya corriendo.
  const [voiceShortcutTrigger, setVoiceShortcutTrigger] = useState(0);
  const [messagesSent, setMessagesSent] = useState(0);
  const [sosOpen, setSosOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [savingRecoveryEmail, setSavingRecoveryEmail] = useState(false);
  const [recoveryEmailMsg, setRecoveryEmailMsg] = useState<string | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(true);
  const [sosInitialGrounding, setSosInitialGrounding] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState<{ psychologistId: string; name: string }[]>([]);
  const [linkActionId, setLinkActionId] = useState<string | null>(null);
  const [approvalCode, setApprovalCode] = useState<{ name: string; code: string } | null>(null);
  const [linkedProfessional, setLinkedProfessional] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revokingLink, setRevokingLink] = useState(false);
  const [revokeError, setRevokeError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const calmSpace = useHeartbeatSound();

  // Las pestañas viven en la cabecera fija; al cambiar de sección se empieza desde arriba.
  useEffect(() => { window.scrollTo(0, 0); }, [section]);

  useEffect(() => {
    let active = true;
    initVoiceShortcut();
    voiceShortcutReady().then(() => {
      if (active && wasLaunchedFromVoiceShortcut()) {
        setSection('tasks');
        setVoiceShortcutTrigger((n) => n + 1);
      }
    });
    const stopListening = onVoiceShortcutReopen(() => {
      setSection('tasks');
      setVoiceShortcutTrigger((n) => n + 1);
    });
    return () => { active = false; stopListening(); };
  }, []);

  useEffect(() => {
    let mounted = true;
    getAvatarSignedUrl(profile?.avatar_path).then((url) => { if (mounted) setAvatarUrl(url); });
    return () => { mounted = false; };
  }, [profile?.avatar_path]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('chat_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .eq('role', 'user')
        .gte('created_at', dayStart.toISOString());
      if (mounted) setMessagesSent(count ?? 0);
    })();
    return () => { mounted = false; };
  }, [profile?.id]);

  // Los modales son estado de React, no historial: sin esto, Atrás cerraría la app
  // en medio del SOS.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (sosOpen) { setSosOpen(false); setSosInitialGrounding(false); }
      else if (disconnectOpen) setDisconnectOpen(false);
      else if (scheduleOpen) setScheduleOpen(false);
      else if (profileModalOpen) setProfileModalOpen(false);
      else if (menuOpen) setMenuOpen(false);
      else if (section !== 'chat') setSection('chat');
      else void CapacitorApp.minimizeApp();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [sosOpen, disconnectOpen, scheduleOpen, profileModalOpen, menuOpen, section]);

  async function loadPendingLinks() {
    const { data: links } = await supabase.from('patient_links').select('psychologist_id').eq('status', 'pending');
    if (!links || links.length === 0) { setPendingLinks([]); return; }
    const ids = links.map((l) => l.psychologist_id);
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    setPendingLinks(links.map((l) => ({
      psychologistId: l.psychologist_id,
      name: profs?.find((p) => p.id === l.psychologist_id)?.full_name ?? t('defaultProfessional'),
    })));
  }

  async function loadLinkedProfessional() {
    const { data: link } = await supabase
      .from('patient_links')
      .select('psychologist_id')
      .eq('patient_id', profile!.id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!link) { setLinkedProfessional(null); return; }
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', link.psychologist_id).maybeSingle();
    setLinkedProfessional(prof?.full_name ?? t('defaultProfessional'));
  }

  useEffect(() => {
    loadPendingLinks();
    loadLinkedProfessional();
    void refreshCrisisContacts(profile!.id);
  }, []);

  // Se consulta al abrir y al volver a la app: el especialista puede enviar el enlace
  // mientras la persona tiene Calivia en segundo plano.
  useEffect(() => {
    let mounted = true;
    async function loadVideoSession() {
      const since = new Date(Date.now() - VIDEO_LINK_VISIBLE_HOURS * 3600000).toISOString();
      const { data } = await supabase
        .from('video_sessions')
        .select('meet_url')
        .eq('patient_id', profile!.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setVideoUrl(data?.meet_url ?? null);
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void loadVideoSession();
    }
    void loadVideoSession();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [profile?.id]);

  async function revokeLink() {
    setRevokingLink(true);
    setRevokeError(false);
    const { error } = await supabase.rpc('patient_revoke_link');
    setRevokingLink(false);
    if (error) { setRevokeError(true); return; }
    setConfirmingRevoke(false);
    setLinkedProfessional(null);
  }

  async function respondToLink(psychologistId: string, accept: boolean) {
    setLinkActionId(psychologistId);
    try {
      if (accept) {
        const name = pendingLinks.find((l) => l.psychologistId === psychologistId)?.name ?? t('defaultProfessional');
        const { data, error } = await supabase.rpc('accept_patient_link', { p_psychologist_id: psychologistId }).single<{ code: string }>();
        if (error) throw error;
        setApprovalCode({ name, code: data.code });
      } else {
        await supabase.rpc('reject_patient_link', { p_psychologist_id: psychologistId });
      }
      setPendingLinks((prev) => prev.filter((l) => l.psychologistId !== psychologistId));
    } finally {
      setLinkActionId(null);
    }
  }

  async function saveRecoveryEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingRecoveryEmail(true);
    setRecoveryEmailMsg(null);
    try {
      const { error } = await supabase.rpc('set_recovery_email', { p_email: recoveryEmail.trim() });
      if (error) throw error;
      setRecoveryEmailMsg(t('recoverySaved'));
    } catch (err) {
      setRecoveryEmailMsg(err instanceof Error ? err.message : t('recoverySaveFailed'));
    } finally {
      setSavingRecoveryEmail(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <img src="/logo-calivia.png" alt="Calivia" className="brand-logo-img" />
          </div>
          <div className="header-actions">
            {onExitToHome && (
              <button className="hdr-btn" onClick={onExitToHome} type="button" aria-label={t('backHome')} title={t('backHome')}>
                <Home size={16} strokeWidth={2} />
                <span className="hdr-btn-label">{t('home')}</span>
              </button>
            )}
            <button
              className="hdr-btn hdr-btn-calendly"
              onClick={() => setScheduleOpen(true)}
              type="button"
              aria-label={t('scheduleAria')}
              title={t('schedule')}
            >
              <CalendarClock size={16} strokeWidth={2} />
              <span className="hdr-btn-label">{t('schedule')}</span>
            </button>
            <div className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
              <div className="user-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : (profile?.full_name || '?').charAt(0).toUpperCase()}
              </div>
              {menuOpen && (
                <div className="user-menu anim-pop" onClick={(e) => e.stopPropagation()}>
                  <div className="user-menu-info">
                    <div className="user-menu-name">{profile?.full_name || t('defaultUserName')}</div>
                  </div>
                  {pendingLinks.length > 0 && (
                    <div className="user-menu-links">
                      <span>{t('linkRequests')}</span>
                      {pendingLinks.map((l) => (
                        <div key={l.psychologistId} className="user-menu-link-row">
                          <p>{t('linkRequestText', { name: l.name })}</p>
                          <div className="user-menu-link-actions">
                            <button
                              type="button"
                              className="user-menu-link-accept"
                              disabled={linkActionId === l.psychologistId}
                              onClick={() => respondToLink(l.psychologistId, true)}
                            >
                              {t('accept')}
                            </button>
                            <button
                              type="button"
                              className="user-menu-link-reject"
                              disabled={linkActionId === l.psychologistId}
                              onClick={() => respondToLink(l.psychologistId, false)}
                            >
                              {t('reject')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {approvalCode && (
                    <div className="user-menu-approval-code">
                      <span>{t('approvalCodeTitle', { name: approvalCode.name })}</span>
                      <strong>{approvalCode.code}</strong>
                      <p>{t('approvalCodeHint')}</p>
                      <button type="button" onClick={() => setApprovalCode(null)}>{t('approvalCodeDismiss')}</button>
                    </div>
                  )}
                  {linkedProfessional && (
                    <div className="user-menu-links">
                      <span>{t('linkedProfessionalTitle')}</span>
                      <p>{confirmingRevoke ? t('revokeLinkConfirm', { name: linkedProfessional }) : linkedProfessional}</p>
                      {revokeError && <p>{t('revokeLinkFailed')}</p>}
                      <div className="user-menu-link-actions">
                        {confirmingRevoke ? (
                          <>
                            <button type="button" className="user-menu-link-reject" disabled={revokingLink} onClick={revokeLink}>
                              {t('revokeLinkYes')}
                            </button>
                            <button type="button" className="user-menu-link-accept" disabled={revokingLink} onClick={() => { setConfirmingRevoke(false); setRevokeError(false); }}>
                              {t('revokeLinkCancel')}
                            </button>
                          </>
                        ) : (
                          <button type="button" className="user-menu-link-reject" onClick={() => setConfirmingRevoke(true)}>
                            {t('revokeLink')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <button className="user-menu-edit-profile" onClick={() => { setMenuOpen(false); setProfileModalOpen(true); }} type="button">
                    <UserCog size={16} strokeWidth={2} /><span>{t('editProfile')}</span>
                  </button>
                  <form className="user-menu-recovery" onSubmit={saveRecoveryEmail}>
                    <span>{t('recoveryEmailLabel')}</span>
                    <p>{t('recoveryEmailHint')}</p>
                    <div className="user-menu-recovery-row">
                      <input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder={t('recoveryEmailPlaceholder')}
                      />
                      <button type="submit" disabled={savingRecoveryEmail}>
                        {savingRecoveryEmail ? '…' : t('saveShort')}
                      </button>
                    </div>
                    {recoveryEmailMsg && <p className="user-menu-recovery-msg">{recoveryEmailMsg}</p>}
                  </form>
                  <button className="user-menu-logout" onClick={signOut} type="button">
                    <LogOut size={16} strokeWidth={2} /><span>{t('logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="tabs-bar" aria-label="Secciones">
          <div className="section-tabs">
            <button className={`stab ${section === 'chat' ? 'active' : ''}`} onClick={() => setSection('chat')} type="button">
              <MessageCircle size={16} strokeWidth={2} /><span>{t('tabChat')}</span>
            </button>
            <button className={`stab ${section === 'breathe' ? 'active' : ''}`} onClick={() => setSection('breathe')} type="button">
              <Wind size={16} strokeWidth={2} /><span>{t('tabBreathe')}</span>
            </button>
            <button className={`stab ${section === 'games' ? 'active' : ''}`} onClick={() => setSection('games')} type="button">
              <Gamepad2 size={16} strokeWidth={2} /><span>{t('tabGames')}</span>
            </button>
            <button className={`stab ${section === 'progress' ? 'active' : ''}`} onClick={() => setSection('progress')} type="button">
              <TrendingUp size={16} strokeWidth={2} /><span>{t('tabProgress')}</span>
            </button>
            <button className={`stab ${section === 'tasks' ? 'active' : ''}`} onClick={() => setSection('tasks')} type="button">
              <CheckSquare size={16} strokeWidth={2} /><span>{t('tabTasks')}</span>
            </button>
            <button className={`stab ${section === 'sounds' ? 'active' : ''}`} onClick={() => setSection('sounds')} type="button">
              <CloudRain size={16} strokeWidth={2} /><span>{t('tabSounds')}</span>
            </button>
            <button className={`stab ${section === 'journal' ? 'active' : ''}`} onClick={() => setSection('journal')} type="button">
              <NotebookPen size={16} strokeWidth={2} /><span>{t('tabJournal')}</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="refugio">
        {videoUrl && (
          <a className="video-join" href={videoUrl} target="_blank" rel="noopener noreferrer">
            <Video size={18} strokeWidth={2} />
            <span>{t('videoJoin')}</span>
          </a>
        )}

        {section === 'chat' && showCheckIn && (
          <QuickCheckIn userId={profile!.id} onDismiss={() => setShowCheckIn(false)} />
        )}

        {section === 'chat' && <DailySpark />}


        {section === 'chat' && (
          <div className="chat-section anim-fade">
            <AiChat
              userId={profile!.id}
              messagesSent={messagesSent}
              maxDaily={MAX_DAILY_MESSAGES}
              onMessageSent={() => setMessagesSent((n) => n + 1)}
              onOpenSos={() => setSosOpen(true)}
            />
          </div>
        )}

        {section === 'breathe' && (
          <div className="breathe-section anim-fade" onClick={() => setSosOpen(true)} role="button" tabIndex={0}>
            <div className="breathe-card">
              <div className="breathe-aura" />
              <div className="organic-figure breathe-organic" />
              <h2>{t('breatheTitle')}</h2>
              <p>{t('breatheSubtitle')}</p>
            </div>
          </div>
        )}

        {section === 'games' && (
          <div className="games-section anim-fade" onClick={() => setDisconnectOpen(true)} role="button" tabIndex={0}>
            <div className="games-card">
              <div className="games-icon"><Gamepad2 size={28} strokeWidth={1.5} /></div>
              <h2>{t('gamesTitle')}</h2>
              <p>{t('gamesSubtitle')}</p>
            </div>
          </div>
        )}

        {section === 'progress' && (
          <div className="progress-section anim-fade">
            <WeeklyProgress userId={profile!.id} />
          </div>
        )}

        {section === 'tasks' && (
          <div className="progress-section anim-fade">
            <TaskManager userId={profile!.id} />
          </div>
        )}

        {section === 'sounds' && (
          <div className="progress-section anim-fade">
            <SoundGallery />
          </div>
        )}

        {section === 'journal' && (
          <div className="progress-section anim-fade">
            <JournalSpace
              userId={profile!.id}
              onOpenSos={() => setSosOpen(true)}
              onOpenGrounding={() => { setSosInitialGrounding(true); setSosOpen(true); }}
            />
          </div>
        )}
      </main>

      <MicroPause />
      <VoiceTaskCommand userId={profile!.id} autoStartTrigger={voiceShortcutTrigger} />

      <div className="sos-dock">
        <button className={`calm-fab ${calmSpace.playing ? 'active' : ''}`} onClick={calmSpace.toggle} type="button">
          <HeartPulse size={20} strokeWidth={2} /><span>{t('calmSpace')}</span>
        </button>
        <button className="sos-fab" onClick={() => setSosOpen(true)} type="button">
          <Wind size={20} strokeWidth={2} /><span>{t('urgentBreath')}</span>
        </button>
      </div>

      <SosModal
        open={sosOpen}
        onClose={() => { setSosOpen(false); setSosInitialGrounding(false); }}
        initialGrounding={sosInitialGrounding}
      />
      <DisconnectionZone
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
      />
      <ScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
      <ProfileSettingsModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      <style>{`
        .app-header { position: sticky; top: 0; z-index: 40; background: rgba(26,29,26,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .header-inner { max-width: 560px; margin: 0 auto; padding: 12px 20px; padding-top: max(12px, env(safe-area-inset-top)); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .brand { display: flex; align-items: center; gap: 8px; }
        .brand-logo-img { height: 30px; width: auto; display: block; }
        .header-actions { display: flex; align-items: center; gap: 6px; }
        .hdr-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 12px;
          border: 1px solid var(--border); background: var(--surface);
          color: var(--text-soft); border-radius: 999px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          text-decoration: none; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .hdr-btn:hover { background: var(--muted); color: var(--text); border-color: var(--primary-200); }
        .hdr-btn-calendly:hover { color: var(--primary-600); border-color: var(--primary-200); }
        .hdr-btn-label { display: none; }
        @media (min-width: 420px) { .hdr-btn-label { display: inline; } }
        .user-chip { position: relative; cursor: pointer; }
        .user-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--secondary-200), var(--secondary)); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; overflow: hidden; }
        .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .user-menu-edit-profile { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; margin-bottom: 8px; border: none; background: var(--surface-2); color: var(--text-soft); border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .user-menu-edit-profile:hover { background: var(--muted); color: var(--text); }
        .user-menu { position: absolute; top: 40px; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 14px; min-width: 240px; max-width: 280px; z-index: 50; }
        .user-menu-info { padding-bottom: 10px; border-bottom: 1px solid var(--border-soft); margin-bottom: 10px; }
        .user-menu-name { font-size: 14px; font-weight: 700; }
        .user-menu-email { font-size: 12px; color: var(--text-soft); margin-top: 2px; }
        .video-join { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; padding: 13px 16px; border-radius: 14px; background: var(--primary); color: #fff; font-size: 15px; font-weight: 700; text-decoration: none; }
        .user-menu-links { display: flex; flex-direction: column; gap: 8px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--border-soft); }
        .user-menu-links > span { font-size: 12px; font-weight: 700; color: var(--text); }
        .user-menu-link-row { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 10px; background: var(--surface-2); }
        .user-menu-link-row p { margin: 0; font-size: 12px; color: var(--text-soft); line-height: 1.4; }
        .user-menu-link-actions { display: flex; gap: 6px; }
        .user-menu-link-accept, .user-menu-link-reject { flex: 1; padding: 6px 8px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; }
        .user-menu-link-accept { background: var(--primary); color: #fff; }
        .user-menu-link-reject { background: transparent; border: 1px solid var(--border); color: var(--text-soft); }
        .user-menu-link-accept:disabled, .user-menu-link-reject:disabled { opacity: 0.6; cursor: default; }
        .user-menu-approval-code { display: flex; flex-direction: column; gap: 4px; padding: 10px; margin-bottom: 10px; border-radius: 10px; background: rgba(112,130,56,0.1); border: 1px dashed var(--primary-200); }
        .user-menu-approval-code > span { font-size: 12px; font-weight: 700; color: var(--text); }
        .user-menu-approval-code strong { font-size: 22px; letter-spacing: 0.12em; color: var(--primary-600); }
        .user-menu-approval-code p { margin: 0; font-size: 11.5px; color: var(--text-soft); line-height: 1.4; }
        .user-menu-approval-code button { align-self: flex-start; margin-top: 2px; padding: 0; border: none; background: none; font-size: 11.5px; color: var(--text-soft); text-decoration: underline; cursor: pointer; }
        .user-menu-recovery { display: flex; flex-direction: column; gap: 4px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid var(--border-soft); }
        .user-menu-recovery > span { font-size: 12px; font-weight: 700; color: var(--text); }
        .user-menu-recovery p { margin: 0; font-size: 11px; color: var(--text-soft); line-height: 1.4; }
        .user-menu-recovery-row { display: flex; gap: 6px; margin-top: 4px; }
        .user-menu-recovery-row input { flex: 1; min-width: 0; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); font-size: 12.5px; }
        .user-menu-recovery-row input:focus { border-color: var(--primary); outline: none; }
        .user-menu-recovery-row button { padding: 7px 10px; border: none; border-radius: 8px; background: var(--primary); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .user-menu-recovery-row button:disabled { opacity: 0.6; }
        .user-menu-recovery-msg { margin: 2px 0 0; font-size: 11px; color: var(--primary-600); }
        .user-menu-logout { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: var(--surface-2); color: var(--text-soft); border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .user-menu-logout:hover { background: var(--danger-bg); color: var(--danger); }


        .refugio { max-width: 560px; margin: 0 auto; padding: 16px 20px 100px; display: flex; flex-direction: column; gap: 16px; min-height: calc(100vh - 60px); }

        .tabs-bar { max-width: 560px; margin: 0 auto; padding: 0 20px 10px; }
        .section-tabs { display: flex; gap: 6px; background: var(--surface-2); padding: 5px; border-radius: 14px; border: 1px solid var(--border-soft); overflow-x: auto; scrollbar-width: none; }
        .section-tabs::-webkit-scrollbar { display: none; }
        .stab { flex: 1 0 auto; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border: none; background: transparent; color: var(--text-soft); font-size: 13px; font-weight: 600; border-radius: 10px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
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

        .progress-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; }

        .sos-dock { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); background: linear-gradient(180deg, transparent, var(--bg) 30%); z-index: 30; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .sos-fab { display: flex; align-items: center; gap: 8px; padding: 14px 28px; border: none; border-radius: 999px; background: var(--secondary); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(140,138,126,0.25); transition: transform 0.12s; max-width: 320px; width: 100%; justify-content: center; }
        .sos-fab:hover { transform: translateY(-2px); }
        .sos-fab:active { transform: scale(0.97); }
        .calm-fab { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border: 1px solid var(--primary-200); border-radius: 999px; background: var(--surface); color: var(--primary-600); font-size: 13.5px; font-weight: 700; cursor: pointer; transition: transform 0.12s, background 0.15s; max-width: 320px; width: 100%; justify-content: center; }
        .calm-fab.active { background: rgba(112,130,56,0.12); }
        .calm-fab:hover { transform: translateY(-1px); }
        .calm-fab:active { transform: scale(0.97); }
      `}</style>
    </>
  );
}
