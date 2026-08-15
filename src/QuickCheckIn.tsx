import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { MOOD_EMOJI, MOOD_LABELS_I18N } from './lib/types';
import { useLanguage, useT } from './lib/i18n';
import strings from './QuickCheckIn.i18n';

interface Props {
  userId: string;
  onDismiss: () => void;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function QuickCheckIn({ userId, onDismiss }: Props) {
  const { lang } = useLanguage();
  const t = useT(strings);
  const moodLabels = MOOD_LABELS_I18N[lang];
  const [saving, setSaving] = useState(false);
  const [savedMood, setSavedMood] = useState<number | null>(null);

  const todayKey = localDateKey(new Date());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('checkins')
        .select('mood, created_at')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString());
      if (!mounted || !data) return;
      const todays = data.filter((c) => localDateKey(new Date(c.created_at)) === todayKey);
      if (todays.length > 0) onDismiss();
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function logMood(mood: number) {
    if (saving) return;
    setSaving(true);
    try {
      await supabase.from('checkins').insert({ user_id: userId, mood });
      setSavedMood(mood);
      setTimeout(onDismiss, 1400);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qci-card anim-fade">
      <button className="qci-close" onClick={onDismiss} type="button" aria-label={t('close')}>
        <X size={14} strokeWidth={2} />
      </button>
      {savedMood ? (
        <p className="qci-thanks">{t('thanks', { emoji: MOOD_EMOJI[savedMood] })}</p>
      ) : (
        <>
          <p className="qci-label">{t('label')}</p>
          <div className="qci-row">
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                type="button"
                className="qci-btn"
                onClick={() => logMood(m)}
                disabled={saving}
                aria-label={moodLabels[m]}
                title={moodLabels[m]}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
        </>
      )}

      <style>{`
        .qci-card {
          position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 12px 32px 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface-2);
        }
        .qci-close {
          position: absolute; top: 8px; right: 8px; border: none; background: transparent;
          color: var(--text-muted); cursor: pointer; width: 22px; height: 22px; border-radius: 50%;
          display: grid; place-items: center;
        }
        .qci-close:hover { background: var(--muted); color: var(--text-soft); }
        .qci-label { margin: 0; font-size: 13px; font-weight: 600; color: var(--text); }
        .qci-row { display: flex; gap: 6px; }
        .qci-btn {
          width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border);
          background: var(--surface); font-size: 17px; cursor: pointer;
          display: grid; place-items: center; transition: transform 0.15s, border-color 0.15s;
        }
        .qci-btn:hover:not(:disabled) { border-color: var(--primary-200); transform: translateY(-1px); }
        .qci-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .qci-thanks { margin: 4px 0; font-size: 13.5px; font-weight: 600; color: var(--primary-600); }
      `}</style>
    </div>
  );
}
