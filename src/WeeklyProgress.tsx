import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { supabase } from './lib/supabase';
import { MOOD_EMOJI, MOOD_LABELS, MOOD_COLOR } from './lib/types';
import type { CheckIn } from './lib/types';

interface Props {
  userId: string;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = domingo .. 6 = sábado
  const diff = day === 0 ? -6 : 1 - day; // retrocede hasta el lunes
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function WeeklyProgress({ userId }: Props) {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const todayKey = localDateKey(new Date());
  const isSunday = new Date().getDay() === 0;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: true });
      if (!mounted) return;
      setCheckins(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId, weekStart]);

  const moodByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkins) map.set(localDateKey(new Date(c.created_at)), c.mood);
    return map;
  }, [checkins]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    return { key, label: DAY_LABELS[i], mood: moodByDay.get(key) ?? null, isToday: key === todayKey };
  }), [weekStart, moodByDay, todayKey]);

  const todayMood = moodByDay.get(todayKey) ?? null;

  async function logMood(mood: number) {
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await supabase.from('checkins').insert({ user_id: userId, mood }).select().single();
      if (data) setCheckins((prev) => [...prev, data]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="wp-card">
      <div className="wp-head">
        <div className="wp-icon"><TrendingUp size={18} strokeWidth={2} /></div>
        <div>
          <h2>Tu semana</h2>
          <p>Cómo ha fluctuado tu ánimo de lunes a domingo</p>
        </div>
      </div>

      {isSunday && (
        <div className="wp-sunday-banner">Hoy es domingo, un buen momento para mirar cómo estuvo tu semana.</div>
      )}

      <div className="wp-checkin">
        <p className="wp-checkin-label">
          {todayMood ? '¿Cambió algo? Puedes actualizar tu ánimo de hoy.' : '¿Cómo te sientes ahora?'}
        </p>
        <div className="wp-mood-row">
          {[1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              type="button"
              className={`wp-mood-btn ${todayMood === m ? 'active' : ''}`}
              onClick={() => logMood(m)}
              disabled={saving}
              aria-label={MOOD_LABELS[m]}
              title={MOOD_LABELS[m]}
            >
              <span>{MOOD_EMOJI[m]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="wp-loading">Cargando tu semana…</div>
      ) : (
        <div className="wp-chart" role="img" aria-label="Gráfico de ánimo de la semana, de lunes a domingo">
          {days.map((d, i) => {
            const hasData = d.mood !== null;
            const pct = hasData ? Math.max(10, (d.mood! / 5) * 100) : 8;
            const color = hasData ? MOOD_COLOR[d.mood!] : 'var(--border)';
            return (
              <div key={d.key} className="wp-bar-col">
                {activeDay === i && (
                  <div className="wp-tooltip">{hasData ? MOOD_LABELS[d.mood!] : 'Sin registro este día'}</div>
                )}
                <button
                  type="button"
                  className="wp-bar-hit"
                  onClick={() => setActiveDay(activeDay === i ? null : i)}
                  aria-label={`${d.label}: ${hasData ? MOOD_LABELS[d.mood!] : 'Sin registro'}`}
                >
                  <span className="wp-bar-emoji">{hasData ? MOOD_EMOJI[d.mood!] : '·'}</span>
                  <span
                    className={`wp-bar ${hasData ? '' : 'empty'}`}
                    style={{ height: `${pct}%`, background: color }}
                  />
                </button>
                <span className={`wp-bar-day ${d.isToday ? 'today' : ''}`}>{d.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .wp-card { display: flex; flex-direction: column; gap: 16px; }
        .wp-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--border-soft); }
        .wp-icon { width: 38px; height: 38px; border-radius: 12px; background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .wp-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
        .wp-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }

        .wp-sunday-banner { padding: 10px 14px; background: rgba(112,130,56,0.08); color: var(--primary-600); border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; text-align: center; }

        .wp-checkin { display: flex; flex-direction: column; gap: 10px; align-items: center; }
        .wp-checkin-label { margin: 0; font-size: 13.5px; color: var(--text-soft); text-align: center; }
        .wp-mood-row { display: flex; gap: 8px; }
        .wp-mood-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2); font-size: 20px; cursor: pointer; display: grid; place-items: center; transition: all 0.15s; }
        .wp-mood-btn:hover:not(:disabled) { border-color: var(--primary-200); transform: translateY(-1px); }
        .wp-mood-btn.active { border-color: var(--primary); background: rgba(112,130,56,0.1); box-shadow: 0 0 0 2px rgba(112,130,56,0.15); }
        .wp-mood-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .wp-loading { text-align: center; color: var(--text-soft); font-size: 14px; padding: 20px; }

        .wp-chart { display: flex; align-items: flex-end; justify-content: space-between; gap: 6px; height: 160px; padding: 20px 4px 0; }
        .wp-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; position: relative; }
        .wp-bar-hit { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; border: none; background: transparent; cursor: pointer; padding: 0; }
        .wp-bar-emoji { font-size: 15px; line-height: 1; }
        .wp-bar { width: 20px; max-width: 24px; border-radius: 4px 4px 0 0; transition: height 0.4s ease; }
        .wp-bar.empty { border: 1px dashed var(--border); background: transparent !important; }
        .wp-bar-day { font-size: 11px; font-weight: 600; color: var(--text-muted); }
        .wp-bar-day.today { color: var(--primary-600); }

        .wp-tooltip {
          position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
          margin-bottom: 6px; padding: 5px 10px; border-radius: 8px;
          background: var(--text); color: var(--surface); font-size: 11px; font-weight: 600;
          white-space: nowrap; z-index: 2; animation: fadeIn 0.15s ease;
        }
      `}</style>
    </section>
  );
}
