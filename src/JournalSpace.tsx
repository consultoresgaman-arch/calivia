import { useState } from 'react';
import { NotebookPen, CloudRain, Gamepad2, Vibrate, Send } from 'lucide-react';
import { useLanguage, useT } from './lib/i18n';
import strings from './JournalSpace.i18n';

interface Props {
  userId: string;
  onOpenSounds: () => void;
  onOpenGames: () => void;
  onOpenVibration: () => void;
}

interface Reflection {
  reflection: string;
  suggestedTool: 'sounds' | 'games' | 'vibration' | 'none';
  toolReason: string;
}

export default function JournalSpace({ userId, onOpenSounds, onOpenGames, onOpenVibration }: Props) {
  const { lang } = useLanguage();
  const t = useT(strings);
  const TOOL_META = {
    sounds: { icon: CloudRain, label: t('goToSounds') },
    games: { icon: Gamepad2, label: t('goToGames') },
    vibration: { icon: Vibrate, label: t('goToVibration') },
  } as const;
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Reflection | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journal-reflect`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ userId, content: text, lang }),
      });
      if (!res.ok) throw new Error(t('processError', { status: res.status }));
      const json = await res.json();
      setResult({ reflection: json.reflection, suggestedTool: json.suggestedTool, toolReason: json.toolReason });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unexpectedError'));
    } finally {
      setSending(false);
    }
  }

  function startOver() {
    setContent('');
    setResult(null);
    setError(null);
  }

  function goToTool() {
    if (!result || result.suggestedTool === 'none') return;
    if (result.suggestedTool === 'sounds') onOpenSounds();
    else if (result.suggestedTool === 'games') onOpenGames();
    else if (result.suggestedTool === 'vibration') onOpenVibration();
  }

  const tool = result && result.suggestedTool !== 'none' ? TOOL_META[result.suggestedTool] : null;
  const ToolIcon = tool?.icon;

  return (
    <section className="js-card">
      <div className="js-head">
        <div className="js-icon"><NotebookPen size={18} strokeWidth={2} /></div>
        <div>
          <h2>{t('title')}</h2>
          <p>{t('subtitle')}</p>
        </div>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="js-form">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('placeholder')}
            rows={7}
            disabled={sending}
          />
          {error && <div className="js-error">{error}</div>}
          <button type="submit" className="js-submit" disabled={sending || !content.trim()}>
            {sending ? t('reading') : (<><Send size={15} strokeWidth={2} /><span>{t('submit')}</span></>)}
          </button>
        </form>
      ) : (
        <div className="js-result anim-fade">
          <p className="js-reflection">{result.reflection}</p>
          {tool && ToolIcon && (
            <div className="js-suggestion">
              <p className="js-suggestion-reason">{result.toolReason}</p>
              <button type="button" className="js-suggestion-btn" onClick={goToTool}>
                <ToolIcon size={16} strokeWidth={2} /><span>{tool.label}</span>
              </button>
            </div>
          )}
          <button type="button" className="js-again" onClick={startOver}>{t('writeMore')}</button>
        </div>
      )}

      <style>{`
        .js-card { display: flex; flex-direction: column; gap: 14px; }
        .js-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--border-soft); }
        .js-icon { width: 38px; height: 38px; border-radius: 12px; background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .js-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
        .js-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }

        .js-form { display: flex; flex-direction: column; gap: 10px; }
        .js-form textarea {
          padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface-2); resize: vertical; min-height: 140px; line-height: 1.6; font-size: 14px;
        }
        .js-form textarea:focus { border-color: var(--primary); outline: none; background: var(--surface); }
        .js-error { padding: 10px 14px; background: var(--danger-bg); color: var(--danger); border-radius: var(--radius-sm); font-size: 13px; }
        .js-submit {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px; border: none; border-radius: 14px; background: var(--primary); color: #fff;
          font-size: 14px; font-weight: 700; cursor: pointer; transition: transform 0.12s;
        }
        .js-submit:hover:not(:disabled) { transform: translateY(-1px); }
        .js-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .js-result { display: flex; flex-direction: column; gap: 14px; }
        .js-reflection { margin: 0; padding: 16px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 14.5px; line-height: 1.65; color: var(--text); }
        .js-suggestion { display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; padding: 14px; border: 1px dashed var(--border); border-radius: var(--radius-sm); }
        .js-suggestion-reason { margin: 0; font-size: 13px; color: var(--text-soft); }
        .js-suggestion-btn { display: flex; align-items: center; gap: 7px; padding: 10px 18px; border: none; border-radius: 999px; background: var(--primary); color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer; }
        .js-suggestion-btn:hover { transform: translateY(-1px); }
        .js-again { align-self: center; border: none; background: transparent; color: var(--text-soft); font-size: 13px; font-weight: 600; text-decoration: underline; cursor: pointer; }
        .js-again:hover { color: var(--primary-600); }
      `}</style>
    </section>
  );
}
