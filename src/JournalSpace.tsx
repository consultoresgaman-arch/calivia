import { useEffect, useState } from 'react';
import { NotebookPen, Save, Trash2, LifeBuoy, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useLanguage, useT, type LanguageCode } from './lib/i18n';
import { getSessionToken } from './lib/session';
import strings from './JournalSpace.i18n';
import { CRISIS_FALLBACK_REPLY } from './AiChat.i18n';
import { detectRiskKeyword } from './lib/riskDetection';

interface Props {
  userId: string;
  onOpenSos: () => void;
}

interface JournalEntry {
  id: string;
  content: string;
  created_at: string;
  ai_reflection: string | null;
  suggested_tool: string | null;
}

// Solo se muestran las reflexiones pedidas con el botón. Las automáticas de versiones
// anteriores tienen suggested_tool relleno y quedan ocultas.
function requestedReflection(entry: JournalEntry): string | null {
  return entry.ai_reflection && entry.suggested_tool === null ? entry.ai_reflection : null;
}

export const JOURNAL_DRAFT_PREFIX = 'calivia.journal-draft.';
const MAX_CONTENT_LENGTH = 10000;
const DATE_LOCALE: Record<LanguageCode, string> = { es: 'es-CL', en: 'en-US', pt: 'pt-PT' };

function readDraft(userId: string): string {
  try {
    return localStorage.getItem(JOURNAL_DRAFT_PREFIX + userId) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(userId: string, value: string): void {
  try {
    if (value) localStorage.setItem(JOURNAL_DRAFT_PREFIX + userId, value);
    else localStorage.removeItem(JOURNAL_DRAFT_PREFIX + userId);
  } catch {
    /* ignore */
  }
}

// Espacio para escribir sin respuesta: lo escrito solo se guarda, para releerlo
// cuando la persona quiera. La IA solo lo lee si se pide una reflexión de un escrito;
// el protocolo de crisis lo revisa siempre.
export default function JournalSpace({ userId, onOpenSos }: Props) {
  const { lang } = useLanguage();
  const t = useT(strings);
  // El borrador vive en el dispositivo para no perder lo escrito si la app se cierra.
  const [content, setContent] = useState(() => readDraft(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [crisisReply, setCrisisReply] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reflectingId, setReflectingId] = useState<string | null>(null);
  const [reflectionError, setReflectionError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => { writeDraft(userId, content); }, [userId, content]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error: listErr } = await supabase
        .from('journal_entries')
        .select('id, content, created_at, ai_reflection, suggested_tool')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!mounted) return;
      if (listErr) setLoadError(true);
      else setEntries(data ?? []);
      setLoadingEntries(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    setSavedNotice(false);
    setCrisisReply(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journal-reflect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-session-token': getSessionToken() ?? '',
        },
        body: JSON.stringify({ userId, content: text, lang }),
      });
      if (!res.ok) throw new Error(`journal ${res.status}`);
      const json = await res.json();
      if (json.entry) setEntries((prev) => [json.entry as JournalEntry, ...prev]);
      setContent('');
      setSavedNotice(true);
      if (json.crisis && json.crisisReply) setCrisisReply(json.crisisReply as string);
    } catch (err) {
      console.error('[Calivia] guardar en el diario falló:', err);
      setError(t('saveFailed'));
      // Sin conexión no se puede guardar, pero la ayuda de crisis está dentro de la app.
      if (detectRiskKeyword(text)) setCrisisReply(CRISIS_FALLBACK_REPLY[lang]);
    } finally {
      setSaving(false);
    }
  }

  async function requestReflection(entry: JournalEntry) {
    if (reflectingId) return;
    setReflectingId(entry.id);
    setReflectionError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journal-reflect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'x-session-token': getSessionToken() ?? '',
        },
        body: JSON.stringify({ userId, action: 'reflect', entryId: entry.id, lang }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 && json.dailyLimit) {
        setReflectionError({ id: entry.id, message: t('reflectionLimit') });
        return;
      }
      if (!res.ok || !json.reflection) throw new Error(`reflect ${res.status}`);
      if (json.crisis) {
        setCrisisReply(json.reflection as string);
        return;
      }
      setEntries((prev) => prev.map((x) => (x.id === entry.id
        ? { ...x, ai_reflection: json.reflection as string, suggested_tool: null }
        : x)));
    } catch (err) {
      console.error('[Calivia] pedir reflexión falló:', err);
      setReflectionError({ id: entry.id, message: t('reflectionFailed') });
    } finally {
      setReflectingId(null);
    }
  }

  async function deleteEntry(id: string) {
    const { error: deleteErr } = await supabase.from('journal_entries').delete().eq('id', id);
    if (deleteErr) {
      setError(t('deleteFailed'));
      return;
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <section className="js-card">
      <div className="js-head">
        <div className="js-icon"><NotebookPen size={18} strokeWidth={2} /></div>
        <div>
          <h2>{t('title')}</h2>
          <p>{t('subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="js-form">
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setSavedNotice(false); }}
          placeholder={t('placeholder')}
          rows={8}
          maxLength={MAX_CONTENT_LENGTH}
          disabled={saving}
          aria-label={t('placeholder')}
        />
        {error && <div className="js-error">{error}</div>}
        {savedNotice && <p className="js-saved" role="status">{t('saved')}</p>}
        <button type="submit" className="js-submit" disabled={saving || !content.trim()}>
          {saving ? t('saving') : (<><Save size={15} strokeWidth={2} /><span>{t('save')}</span></>)}
        </button>
      </form>

      {crisisReply && (
        <div className="js-crisis" role="alert">
          <p>{crisisReply}</p>
          <button type="button" className="js-crisis-btn" onClick={onOpenSos}>
            <LifeBuoy size={16} strokeWidth={2} /><span>{t('openHelp')}</span>
          </button>
        </div>
      )}

      <div className="js-entries">
        <h3>{t('entriesTitle')}</h3>
        {loadingEntries ? (
          <p className="js-muted">{t('loading')}</p>
        ) : loadError ? (
          <p className="js-muted">{t('loadFailed')}</p>
        ) : entries.length === 0 ? (
          <p className="js-muted">{t('empty')}</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="js-entry">
              <time dateTime={entry.created_at}>
                {new Date(entry.created_at).toLocaleString(DATE_LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
              <p>{entry.content}</p>
              {requestedReflection(entry) ? (
                <div className="js-reflection">
                  <span><Sparkles size={12} strokeWidth={2} /> {t('reflectionLabel')}</span>
                  <p>{requestedReflection(entry)}</p>
                </div>
              ) : (
                <button
                  type="button"
                  className="js-reflect-btn"
                  onClick={() => requestReflection(entry)}
                  disabled={reflectingId !== null}
                >
                  <Sparkles size={13} strokeWidth={2} />
                  <span>{reflectingId === entry.id ? t('reflecting') : t('askReflection')}</span>
                </button>
              )}
              {reflectionError?.id === entry.id && <p className="js-reflect-error">{reflectionError.message}</p>}
              {confirmDeleteId === entry.id ? (
                <div className="js-entry-actions">
                  <span>{t('deleteConfirm')}</span>
                  <button type="button" className="js-delete-yes" onClick={() => deleteEntry(entry.id)}>{t('deleteYes')}</button>
                  <button type="button" className="js-link" onClick={() => setConfirmDeleteId(null)}>{t('cancel')}</button>
                </div>
              ) : (
                <div className="js-entry-actions">
                  <button type="button" className="js-link" onClick={() => setConfirmDeleteId(entry.id)} aria-label={t('delete')}>
                    <Trash2 size={13} strokeWidth={2} /><span>{t('delete')}</span>
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      <style>{`
        .js-card { display: flex; flex-direction: column; gap: 14px; }
        .js-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--border-soft); }
        .js-icon { width: 38px; height: 38px; border-radius: 12px; background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .js-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
        .js-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }

        .js-form { display: flex; flex-direction: column; gap: 10px; }
        .js-form textarea {
          width: 100%; font: inherit; font-size: 15px; line-height: 1.6;
          padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface-2); color: var(--text); resize: vertical; min-height: 180px;
        }
        .js-form textarea:focus { border-color: var(--primary); outline: none; background: var(--surface); }
        .js-error { padding: 10px 14px; background: var(--danger-bg); color: var(--danger); border-radius: var(--radius-sm); font-size: 13px; }
        .js-saved { margin: 0; font-size: 13px; font-weight: 600; color: var(--primary-600); }
        .js-submit {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 13px; border: none; border-radius: 14px;
          background: var(--primary); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
        }
        .js-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .js-crisis { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: var(--radius-sm); background: rgba(196,154,90,0.12); }
        .js-crisis p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--text); white-space: pre-wrap; }
        .js-crisis-btn { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px; border: none; border-radius: 999px; background: var(--primary); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }

        .js-entries { display: flex; flex-direction: column; gap: 10px; padding-top: 6px; }
        .js-entries h3 { margin: 0; font-size: 14px; font-weight: 700; color: var(--text); }
        .js-muted { margin: 0; font-size: 13px; color: var(--text-soft); }
        .js-entry { padding: 12px 14px; border: 1px solid var(--border-soft); border-radius: var(--radius-sm); background: var(--surface-2); }
        .js-entry time { display: block; margin-bottom: 6px; font-size: 11.5px; color: var(--text-muted); }
        .js-entry p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--text); white-space: pre-wrap; word-break: break-word; }
        .js-entry-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 8px; font-size: 12.5px; color: var(--text-soft); }
        .js-link { display: inline-flex; align-items: center; gap: 4px; padding: 2px; border: none; background: transparent; color: var(--text-soft); font-size: 12.5px; cursor: pointer; }
        .js-reflection { margin-top: 10px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--border-soft); }
        .js-reflection span { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 4px; font-size: 11.5px; font-weight: 600; color: var(--primary-600); }
        .js-reflection p { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--text); white-space: pre-wrap; }
        .js-reflect-btn { display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--primary-600); font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .js-reflect-btn:disabled { opacity: 0.55; cursor: default; }
        .js-reflect-error { margin: 6px 0 0; font-size: 12.5px; color: var(--danger); }
        .js-delete-yes { padding: 5px 12px; border: none; border-radius: 999px; background: var(--danger); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; }
      `}</style>
    </section>
  );
}
