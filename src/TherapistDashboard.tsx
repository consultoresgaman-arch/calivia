import { useEffect, useMemo, useState } from 'react';
import { Heart, BarChart3, LogOut, Calendar, FileText, Users } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import type { CheckIn, ChatLog, AiReport, Profile } from './lib/types';

const DISCLAIMER =
  'La interpretación clínica final corresponde siempre al profesional. Este reporte es un apoyo analítico, no un diagnóstico.';

export default function TherapistDashboard() {
  const { profile, signOut } = useAuth();
  const [reports, setReports] = useState<AiReport[]>([]);
  const [patients, setPatients] = useState<Profile[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [rep, pat, chk, chat] = await Promise.all([
        supabase.from('ai_reports').select('*').order('report_date', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('chat_logs').select('*').order('created_at', { ascending: false }).limit(500),
      ]);
      if (!mounted) return;
      if (rep.error || pat.error || chk.error || chat.error) {
        setError(rep.error?.message || pat.error?.message || chk.error?.message || chat.error?.message || 'Error');
      }
      setReports(rep.data ?? []);
      setPatients((pat.data ?? []).filter((p) => p.role === 'patient'));
      setCheckins(chk.data ?? []);
      setChatLogs(chat.data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const patientById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  const reportsForDate = useMemo(
    () => reports.filter((r) => r.report_date === selectedDate),
    [reports, selectedDate]
  );

  const pendingPatients = useMemo(() => {
    const activeIds = new Set<string>();
    for (const c of checkins) { if (c.created_at.slice(0, 10) === selectedDate) activeIds.add(c.user_id); }
    for (const c of chatLogs) { if (c.created_at.slice(0, 10) === selectedDate) activeIds.add(c.user_id); }
    const withReport = new Set(reportsForDate.map((r) => r.user_id));
    return patients.filter((p) => activeIds.has(p.id) && !withReport.has(p.id));
  }, [checkins, chatLogs, reportsForDate, patients, selectedDate]);

  async function generateAll() {
    if (generating || pendingPatients.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-report`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ date: selectedDate }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Generación fallida (${res.status}). ${txt.slice(0, 160)}`);
      }
      const { data, error } = await supabase.from('ai_reports').select('*').order('report_date', { ascending: false });
      if (error) throw error;
      setReports(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar reportes');
    } finally {
      setGenerating(false);
    }
  }

  const todayStats = useMemo(() => {
    const dayCheckins = checkins.filter((c) => c.created_at.slice(0, 10) === selectedDate);
    const avg = dayCheckins.length ? dayCheckins.reduce((s, c) => s + c.mood, 0) / dayCheckins.length : 0;
    return { count: dayCheckins.length, avg };
  }, [checkins, selectedDate]);

  const activeCount = useMemo(() => {
    const ids = new Set<string>();
    for (const c of checkins) { if (c.created_at.slice(0, 10) === selectedDate) ids.add(c.user_id); }
    for (const c of chatLogs) { if (c.created_at.slice(0, 10) === selectedDate) ids.add(c.user_id); }
    return ids.size;
  }, [checkins, chatLogs, selectedDate]);

  return (
    <>
      <header className="th-header">
        <div className="th-header-inner">
          <div className="brand">
            <div className="brand-mark"><Heart size={20} strokeWidth={2} /></div>
            <div>
              <span className="brand-name">Calivia</span>
              <span className="brand-sub">Panel del especialista</span>
            </div>
          </div>
          <div className="th-user">
            <span className="th-user-name">{profile?.full_name || 'Especialista'}</span>
            <button className="th-logout" onClick={signOut} type="button" aria-label="Salir">
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <main className="th-container">
        {error && <div className="th-error">{error}</div>}

        <section className="th-card">
          <div className="th-section-head">
            <div className="th-section-icon"><BarChart3 size={18} strokeWidth={2} /></div>
            <div>
              <h2>Reportes diarios</h2>
              <p>Resumen de estado emocional, patrones y sugerencias de enfoque</p>
            </div>
          </div>
          <div className="th-controls">
            <label className="th-field">
              <span>Fecha</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            </label>
            <button className="th-btn-primary" onClick={generateAll} disabled={generating || pendingPatients.length === 0}>
              {generating ? 'Generando…' : pendingPatients.length === 0 ? 'Sin pendientes' : `Generar ${pendingPatients.length} reporte(s)`}
            </button>
          </div>
        </section>

        <section className="th-stats">
          <div className="th-stat"><div className="th-stat-label"><FileText size={14} /> Registros del día</div><div className="th-stat-value">{todayStats.count}</div></div>
          <div className="th-stat"><div className="th-stat-label"><BarChart3 size={14} /> Ánimo promedio</div><div className="th-stat-value">{todayStats.avg ? todayStats.avg.toFixed(1) : '—'}</div></div>
          <div className="th-stat"><div className="th-stat-label"><Users size={14} /> Pacientes activos</div><div className="th-stat-value">{activeCount}</div></div>
          <div className="th-stat"><div className="th-stat-label"><Calendar size={14} /> Reportes generados</div><div className="th-stat-value">{reportsForDate.length}</div></div>
        </section>

        {loading ? (
          <div className="th-card th-empty">Cargando…</div>
        ) : reportsForDate.length === 0 ? (
          <div className="th-card th-empty">
            No hay reportes para {selectedDate}. {pendingPatients.length > 0 && `Hay ${pendingPatients.length} paciente(s) con actividad pendiente.`}
          </div>
        ) : (
          <div className="th-reports">
            {reportsForDate.map((r) => {
              const p = patientById.get(r.user_id);
              return (
                <article key={r.id} className="th-card th-report">
                  <header className="th-report-head">
                    <div className="th-avatar">{(p?.full_name || p?.email || '?').charAt(0).toUpperCase()}</div>
                    <div>
                      <h3>{p?.full_name || 'Paciente'}</h3>
                      <span>{p?.email}</span>
                    </div>
                  </header>
                  <div className="th-report-section">
                    <h4>Resumen emocional</h4>
                    <p>{r.mood_summary}</p>
                  </div>
                  {r.keywords.length > 0 && (
                    <div className="th-report-section">
                      <h4>Palabras clave / patrones</h4>
                      <div className="th-keywords">{r.keywords.map((k, i) => <span key={i} className="th-keyword">{k}</span>)}</div>
                    </div>
                  )}
                  <div className="th-report-section">
                    <h4>Sugerencias de enfoque</h4>
                    <p>{r.suggestions}</p>
                  </div>
                  <footer className="th-disclaimer">{DISCLAIMER}</footer>
                </article>
              );
            })}
          </div>
        )}

        <style>{`
          .th-header {
            position: sticky; top: 0; z-index: 40;
            background: rgba(245,243,238,0.88);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-soft);
          }
          .th-header-inner {
            max-width: 1100px; margin: 0 auto;
            padding: 12px 24px;
            padding-top: max(12px, env(safe-area-inset-top));
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
          }
          .brand { display: flex; align-items: center; gap: 10px; }
          .brand-mark { width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, var(--primary-200), var(--primary)); color: #fff; display: grid; place-items: center; box-shadow: var(--shadow-warm); }
          .brand-name { font-size: 18px; font-weight: 700; color: var(--text); display: block; letter-spacing: -0.02em; }
          .brand-sub { font-size: 12px; color: var(--text-soft); display: block; }
          .th-user { display: flex; align-items: center; gap: 10px; }
          .th-user-name { font-size: 14px; font-weight: 600; color: var(--text-soft); }
          .th-logout { width: 36px; height: 36px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 50%; cursor: pointer; display: grid; place-items: center; transition: all 0.15s; }
          .th-logout:hover { background: var(--danger-bg); color: var(--danger); border-color: rgba(196,91,74,0.2); }

          .th-container { max-width: 1100px; margin: 0 auto; padding: 24px 20px 48px; display: flex; flex-direction: column; gap: 20px; }
          .th-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
          .th-error { background: var(--danger-bg); color: var(--danger); padding: 12px 16px; border-radius: var(--radius-sm); font-size: 14px; border: 1px solid rgba(196,91,74,0.15); }
          .th-section-head { display: flex; align-items: center; gap: 10px; padding: 18px 20px 14px; border-bottom: 1px solid var(--border-soft); }
          .th-section-icon { width: 36px; height: 36px; border-radius: 12px; background: rgba(112,130,56,0.1); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
          .th-section-head h2 { margin: 0; font-size: 16px; font-weight: 700; }
          .th-section-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }
          .th-controls { padding: 18px 20px 20px; display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
          .th-field { display: flex; flex-direction: column; gap: 6px; }
          .th-field > span { font-size: 13px; font-weight: 600; color: var(--text-soft); }
          .th-field input { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
          .th-field input:focus { border-color: var(--primary); outline: none; }
          .th-btn-primary { padding: 11px 20px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-weight: 600; cursor: pointer; box-shadow: 0 2px 10px rgba(112,130,56,0.2); transition: transform 0.12s; }
          .th-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
          .th-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

          .th-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
          @media (min-width: 720px) { .th-stats { grid-template-columns: repeat(4, 1fr); } }
          .th-stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 18px; box-shadow: var(--shadow); }
          .th-stat-label { font-size: 12px; color: var(--text-soft); margin-bottom: 4px; display: flex; align-items: center; gap: 5px; font-weight: 500; }
          .th-stat-label svg { color: var(--primary); }
          .th-stat-value { font-size: 26px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }

          .th-empty { padding: 28px; text-align: center; color: var(--text-soft); font-size: 14px; }
          .th-reports { display: grid; grid-template-columns: 1fr; gap: 16px; }
          @media (min-width: 860px) { .th-reports { grid-template-columns: 1fr 1fr; } }
          .th-report { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
          .th-report-head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-soft); }
          .th-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--secondary-200), var(--secondary)); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
          .th-report-head h3 { margin: 0; font-size: 15px; font-weight: 700; }
          .th-report-head span { font-size: 12px; color: var(--text-soft); }
          .th-report-section h4 { margin: 0 0 6px; font-size: 11px; font-weight: 700; color: var(--primary-600); text-transform: uppercase; letter-spacing: 0.05em; }
          .th-report-section p { margin: 0; font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
          .th-keywords { display: flex; flex-wrap: wrap; gap: 6px; }
          .th-keyword { padding: 4px 10px; background: rgba(112,130,56,0.12); color: var(--text); border-radius: 999px; font-size: 12px; font-weight: 600; }
          .th-disclaimer { font-size: 11px; color: var(--text-soft); line-height: 1.5; padding-top: 10px; border-top: 1px solid var(--border-soft); font-style: italic; }
        `}</style>
      </main>
    </>
  );
}
