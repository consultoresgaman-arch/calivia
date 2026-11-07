import { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader2, Eye, Smile, HeartHandshake } from 'lucide-react';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { getSessionToken } from './lib/session';
import { uploadAvatar, getAvatarSignedUrl } from './lib/avatar';
import { useT, useLanguage, localizeBackendError } from './lib/i18n';
import LanguageSelector from './LanguageSelector';
import strings from './ProfileSettingsModal.i18n';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileSettingsModal({ open, onClose }: Props) {
  const { profile, refreshProfile, signOut } = useAuth();
  const t = useT(strings);
  const { lang } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [preferredName, setPreferredName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [personaNameEspejo, setPersonaNameEspejo] = useState('');
  const [personaNameAmigo, setPersonaNameAmigo] = useState('');
  const [personaNameAcompanante, setPersonaNameAcompanante] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [savingRecoveryEmail, setSavingRecoveryEmail] = useState(false);
  const [recoveryEmailMessage, setRecoveryEmailMessage] = useState<string | null>(null);
  const [recoveryEmailError, setRecoveryEmailError] = useState<string | null>(null);

  const isPsychologist = profile?.role === 'psychologist';

  useEffect(() => {
    // Solo inicializa el formulario al ABRIR el modal — si dependiera de
    // `profile` completo, el refreshProfile() que dispara handleSave() lo
    // volvería a correr justo después de guardar y borraría el mensaje
    // "Guardado." (y cualquier edición sin guardar) casi al instante.
    if (!open || !profile) return;
    setPreferredName(profile.preferred_name ?? '');
    setOccupation(profile.occupation ?? '');
    setPersonaNameEspejo(profile.persona_name_espejo ?? '');
    setPersonaNameAmigo(profile.persona_name_amigo ?? '');
    setPersonaNameAcompanante(profile.persona_name_acompanante ?? '');
    setPhone(profile.phone ?? '');
    setLicenseNumber(profile.license_number ?? '');
    setBio(profile.bio ?? '');
    setMessage(null);
    setAvatarMessage(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage(null);
    setPasswordError(null);
    setRecoveryEmail('');
    setRecoveryEmailMessage(null);
    setRecoveryEmailError(null);
    setConfirmingDelete(false);
    setDeletePassword('');
    setDeleteError(null);
    getAvatarSignedUrl(profile.avatar_path).then(setAvatarUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !profile) return null;

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;
    setUploadingAvatar(true);
    setAvatarMessage(null);
    try {
      const path = await uploadAvatar(profile.id, file);
      // La subida en sí ya está confirmada acá — lo que sigue es solo pedir
      // la URL firmada para mostrarla. Si esa segunda llamada falla justo
      // después del upsert (p. ej. una demora breve de consistencia del
      // storage), reintentamos una vez antes de darlo por perdido, en vez
      // de dejar el círculo en gris sin explicación aunque la foto sí se
      // haya guardado.
      let url: string | null;
      try {
        url = await getAvatarSignedUrl(path, true);
      } catch (firstErr) {
        console.error('[Calivia] primer intento de getAvatarSignedUrl falló, reintentando:', firstErr);
        await new Promise((resolve) => setTimeout(resolve, 800));
        url = await getAvatarSignedUrl(path, true);
      }
      setAvatarUrl(url);
      await refreshProfile();
    } catch (err) {
      console.error('[Calivia] handleAvatarPick falló:', err);
      setAvatarMessage(err instanceof Error ? err.message : t('uploadFailed'));
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
        .update({
          preferred_name: preferredName.trim() || null,
          occupation: occupation.trim() || null,
          persona_name_espejo: personaNameEspejo.trim() || null,
          persona_name_amigo: personaNameAmigo.trim() || null,
          persona_name_acompanante: personaNameAcompanante.trim() || null,
          phone: phone.trim() || null,
          license_number: licenseNumber.trim() || null,
          bio: bio.trim() || null,
        })
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

  async function handleChangePassword() {
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'));
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.rpc('change_password', {
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(t('passwordChanged'));
    } catch (err) {
      setPasswordError(err instanceof Error ? localizeBackendError(err.message, lang) : t('passwordChangeFailed'));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-session-token': getSessionToken() ?? '',
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.status === 403) { setDeleteError(t('deleteWrongPassword')); return; }
      if (!res.ok) { setDeleteError(t('deleteFailed')); return; }
      await signOut();
    } catch (err) {
      console.error('[Calivia] handleDeleteAccount falló:', err);
      setDeleteError(t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveRecoveryEmail() {
    setRecoveryEmailMessage(null);
    setRecoveryEmailError(null);
    setSavingRecoveryEmail(true);
    try {
      const { error } = await supabase.rpc('set_recovery_email', { p_email: recoveryEmail.trim() });
      if (error) throw new Error(error.message);
      setRecoveryEmail('');
      setRecoveryEmailMessage(t('alertEmailSaved'));
    } catch (err) {
      setRecoveryEmailError(err instanceof Error ? localizeBackendError(err.message, lang) : t('saveFailed'));
    } finally {
      setSavingRecoveryEmail(false);
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
          {avatarMessage && <p className="psm-message psm-message-error psm-avatar-message">{avatarMessage}</p>}
        </div>

        <div className="psm-field">
          <span>{t('language')}</span>
          <LanguageSelector />
        </div>

        <div className="psm-fields">
          <h3 className="psm-subtitle">{t('changePassword')}</h3>
          <label className="psm-field">
            <span>{t('currentPassword')}</span>
            <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="psm-field">
            <span>{t('newPassword')}</span>
            <input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label className="psm-field">
            <span>{t('confirmPassword')}</span>
            <input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          {passwordError && <p className="psm-message psm-message-error">{passwordError}</p>}
          {passwordMessage && <p className="psm-message">{passwordMessage}</p>}
          <button
            className="psm-save"
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            type="button"
          >
            {changingPassword ? t('changingPassword') : t('changePassword')}
          </button>
        </div>

        {!isPsychologist && (
          <div className="psm-fields">
            <label className="psm-field">
              <span>{t('preferredNameLabel')}</span>
              <input type="text" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder={t('preferredNamePlaceholder')} />
            </label>
            <label className="psm-field">
              <span>{t('occupationLabel')}</span>
              <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder={t('occupationPlaceholder')} />
            </label>
          </div>
        )}

        {!isPsychologist && (
          <div className="psm-fields">
            <h3 className="psm-subtitle">{t('personaNamesTitle')}</h3>
            <p className="psm-hint">{t('personaNamesHint')}</p>
            <label className="psm-field psm-persona-field">
              <span><Eye size={14} strokeWidth={2} /> {t('personaNameEspejoLabel')}</span>
              <input type="text" value={personaNameEspejo} onChange={(e) => setPersonaNameEspejo(e.target.value)} placeholder={t('personaNameEspejoPlaceholder')} maxLength={30} />
            </label>
            <label className="psm-field psm-persona-field">
              <span><Smile size={14} strokeWidth={2} /> {t('personaNameAmigoLabel')}</span>
              <input type="text" value={personaNameAmigo} onChange={(e) => setPersonaNameAmigo(e.target.value)} placeholder={t('personaNameAmigoPlaceholder')} maxLength={30} />
            </label>
            <label className="psm-field psm-persona-field">
              <span><HeartHandshake size={14} strokeWidth={2} /> {t('personaNameAcompananteLabel')}</span>
              <input type="text" value={personaNameAcompanante} onChange={(e) => setPersonaNameAcompanante(e.target.value)} placeholder={t('personaNameAcompanantePlaceholder')} maxLength={30} />
            </label>
          </div>
        )}

        {isPsychologist && (
          <div className="psm-fields">
            <h3 className="psm-subtitle">{t('alertEmailTitle')}</h3>
            <p className="psm-hint">{t('alertEmailHint')}</p>
            <label className="psm-field">
              <span>{t('alertEmailLabel')}</span>
              <input type="email" autoComplete="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder={t('alertEmailPlaceholder')} />
            </label>
            {recoveryEmailError && <p className="psm-message psm-message-error">{recoveryEmailError}</p>}
            {recoveryEmailMessage && <p className="psm-message">{recoveryEmailMessage}</p>}
            <button
              className="psm-save"
              onClick={handleSaveRecoveryEmail}
              disabled={savingRecoveryEmail || !recoveryEmail.trim()}
              type="button"
            >
              {savingRecoveryEmail ? t('alertEmailSaving') : t('alertEmailSave')}
            </button>
          </div>
        )}

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

        <button className="psm-save" onClick={handleSave} disabled={saving} type="button">
          {saving ? t('saving') : t('saveChanges')}
        </button>

        <a className="psm-policy-link" href="https://calivia.vercel.app/privacidad.html" target="_blank" rel="noopener noreferrer">
          {t('privacyPolicy')}
        </a>

        <div className="psm-fields psm-danger-zone">
          <h3 className="psm-subtitle">{t('deleteTitle')}</h3>
          {confirmingDelete ? (
            <>
              <p className="psm-hint">{t('deleteWarning')}</p>
              <label className="psm-field">
                <span>{t('deletePasswordLabel')}</span>
                <input type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </label>
              {deleteError && <p className="psm-message psm-message-error">{deleteError}</p>}
              <button className="psm-delete" onClick={handleDeleteAccount} disabled={deleting || !deletePassword} type="button">
                {deleting ? t('deleting') : t('deleteConfirm')}
              </button>
              <button className="psm-delete-cancel" onClick={() => { setConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }} disabled={deleting} type="button">
                {t('deleteCancel')}
              </button>
            </>
          ) : (
            <button className="psm-delete-cancel" onClick={() => setConfirmingDelete(true)} type="button">{t('deleteButton')}</button>
          )}
        </div>
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
        .psm-subtitle { margin: 0; font-size: 14px; color: var(--text); }
        .psm-hint { margin: -8px 0 0; font-size: 12px; color: var(--text-soft); line-height: 1.5; }
        .psm-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-soft); }
        .psm-persona-field span { display: flex; align-items: center; gap: 6px; }
        .psm-field input, .psm-field textarea { font: inherit; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); resize: vertical; }
        .psm-field input:focus, .psm-field textarea:focus { outline: 2px solid var(--primary-200); border-color: var(--primary-200); }

        .psm-message { margin: 0; font-size: 13px; color: var(--primary-600); font-weight: 600; }
        .psm-message-error { color: var(--danger); }
        .psm-avatar-message { text-align: center; max-width: 260px; }
        .psm-policy-link { display: block; margin-top: 16px; font-size: 13px; font-weight: 600; color: var(--primary-600); }
        .psm-danger-zone { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-soft); }
        .psm-delete { padding: 12px; border: none; border-radius: 999px; background: var(--danger); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .psm-delete:disabled { opacity: 0.5; cursor: default; }
        .psm-delete-cancel { padding: 10px; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--text-soft); font-size: 13px; font-weight: 600; cursor: pointer; }
        .psm-save { padding: 12px; border: none; border-radius: 999px; background: var(--primary); color: #fff; font-size: 14.5px; font-weight: 700; cursor: pointer; }
        .psm-save:hover:not(:disabled) { background: var(--primary-600); }
        .psm-save:disabled { opacity: 0.6; cursor: not-allowed; }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
