import { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { uploadAvatar, getAvatarSignedUrl } from './lib/avatar';
import { useT } from './lib/i18n';
import LanguageSelector from './LanguageSelector';
import strings from './ProfileSettingsModal.i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileSettingsModal({ open, onClose }: Props) {
  const { profile, refreshProfile } = useAuth();
  const t = useT(strings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isPsychologist = profile?.role === 'psychologist';

  useEffect(() => {
    // Solo inicializa el formulario al ABRIR el modal — si dependiera de
    // `profile` completo, el refreshProfile() que dispara handleSave() lo
    // volvería a correr justo después de guardar y borraría el mensaje
    // "Guardado." (y cualquier edición sin guardar) casi al instante.
    if (!open || !profile) return;
    setPhone(profile.phone ?? '');
    setLicenseNumber(profile.license_number ?? '');
    setBio(profile.bio ?? '');
    setMessage(null);
    getAvatarSignedUrl(profile.avatar_path).then(setAvatarUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !profile) return null;

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;
    setUploadingAvatar(true);
    setMessage(null);
    try {
      const path = await uploadAvatar(profile.id, file);
      const url = await getAvatarSignedUrl(path);
      setAvatarUrl(url);
      await refreshProfile();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() || null, license_number: licenseNumber.trim() || null, bio: bio.trim() || null })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setMessage(t('saved'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="psm-overlay">
      <div className="psm-bar">
        <button className="psm-close" onClick={onClose} type="button"><X size={20} /><span>{t('back')}</span></button>
      </div>

      <div className="psm-content">
        <h2>{t('title')}</h2>

        <div className="psm-avatar-row">
          <div className="psm-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{profile.full_name.charAt(0).toUpperCase()}</span>}
            {uploadingAvatar && <div className="psm-avatar-loading"><Loader2 size={18} className="psm-spin" /></div>}
          </div>
          <button className="psm-avatar-btn" onClick={() => fileInputRef.current?.click()} type="button" disabled={uploadingAvatar}>
            <Camera size={14} strokeWidth={2} /><span>{t('changePhoto')}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarPick} hidden />
        </div>

        <div className="psm-field">
          <span>{t('language')}</span>
          <LanguageSelector />
        </div>

        {isPsychologist && (
          <div className="psm-fields">
            <label className="psm-field">
              <span>{t('phone')}</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" />
            </label>
            <label className="psm-field">
              <span>{t('licenseNumber')}</span>
              <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder={t('licensePlaceholder')} />
            </label>
            <label className="psm-field">
              <span>{t('bio')}</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder={t('bioPlaceholder')} />
            </label>
          </div>
        )}

        {message && <p className="psm-message">{message}</p>}

        {isPsychologist && (
          <button className="psm-save" onClick={handleSave} disabled={saving} type="button">
            {saving ? t('saving') : t('saveChanges')}
          </button>
        )}
      </div>

      <style>{`
        .psm-overlay {
          position: fixed; inset: 0; z-index: 260;
          background: linear-gradient(165deg, #F5F3EE 0%, #EDE9E0 100%);
          display: flex; flex-direction: column; animation: fadeIn 0.3s ease; overflow-y: auto;
        }
        .psm-bar { display: flex; align-items: center; padding: 14px 20px; padding-top: max(14px, env(safe-area-inset-top)); }
        .psm-close { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .psm-close:hover { background: var(--muted); color: var(--text); }

        .psm-content { max-width: 420px; width: 100%; margin: 0 auto; padding: 8px 24px 40px; display: flex; flex-direction: column; gap: 20px; }
        .psm-content h2 { margin: 0; font-size: 20px; color: var(--text); }

        .psm-avatar-row { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .psm-avatar { position: relative; width: 84px; height: 84px; border-radius: 50%; background: linear-gradient(135deg, var(--secondary-200), var(--secondary)); color: #fff; display: grid; place-items: center; font-size: 28px; font-weight: 700; overflow: hidden; }
        .psm-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .psm-avatar-loading { position: absolute; inset: 0; background: rgba(0,0,0,0.35); display: grid; place-items: center; color: #fff; }
        .psm-spin { animation: spin 0.9s linear infinite; }
        .psm-avatar-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .psm-avatar-btn:hover:not(:disabled) { border-color: var(--primary-200); color: var(--text); }
        .psm-avatar-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .psm-fields { display: flex; flex-direction: column; gap: 14px; }
        .psm-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-soft); }
        .psm-field input, .psm-field textarea { font: inherit; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); resize: vertical; }
        .psm-field input:focus, .psm-field textarea:focus { outline: 2px solid var(--primary-200); border-color: var(--primary-200); }

        .psm-message { margin: 0; font-size: 13px; color: var(--primary-600); font-weight: 600; }
        .psm-save { padding: 12px; border: none; border-radius: 999px; background: var(--primary); color: #fff; font-size: 14.5px; font-weight: 700; cursor: pointer; }
        .psm-save:hover:not(:disabled) { background: var(--primary-600); }
        .psm-save:disabled { opacity: 0.6; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
