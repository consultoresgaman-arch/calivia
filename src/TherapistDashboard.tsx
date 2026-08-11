import { useEffect, useMemo, useState } from 'react';
import { BarChart3, LogOut, Calendar, FileText, Users, UserPlus, UserMinus, AlertTriangle, Check, UserCog, NotebookPen, ClipboardList, Flame } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import { getAvatarSignedUrl } from './lib/avatar';
import ProfileSettingsModal from './ProfileSettingsModal';
import type { CheckIn, ChatLog, AiReport, Profile, RiskAlert, ClinicalNote } from './lib/types';

const DISCLAIMER =
  'La interpretación clínica final corresponde siempre al profesional. Este reporte es un apoyo analítico, no un diagnóstico.';

const ALERT_DISCLAIMER =
  'Detección automática por palabras clave, no es una evaluación clínica de riesgo. Úsala como una señal a revisar, no como un diagnóstico.';

const LOW_MOOD_THRESHOLD = 2;
const LOW_MOOD_STREAK_DAYS = 3;
const LOW_MOOD_LOOKBACK_DAYS = 10;

// "Prioridad de atención": ¿tuvo este paciente `LOW_MOOD_STREAK_DAYS` días
// calendario CONSECUTIVOS (no solo 3 sueltos) con ánimo bajo, dentro de la
// ventana reciente? Mirar todo el historial haría que un mal momento de
// hace meses siguiera marcado como urgente hoy.
function hasConsecutiveLowMood(patientCheckins: CheckIn[]): boolean {
  const cutoff = Date.now() - LOW_MOOD_LOOKBACK_DAYS * 86400000;
  const lowDates = new Set(
    patientCheckins
      .filter((c) => c.mood <= LOW_MOOD_THRESHOLD && new Date(c.created_at).getTime() >= cutoff)
      .map((c) => c.created_at.slice(0, 10))
  );
  if (lowDates.size < LOW_MOOD_STREAK_DAYS) return false;
  const sorted = Array.from(lowDates).sort();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000);
    streak = diffDays === 1 ? streak + 1 : 1;
    if (streak >= LOW_MOOD_STREAK_DAYS) return true;
  }
  return false;
}

export default function TherapistDashboard() {
  const { profile, signOut } = useAuth();
  const [reports, setReports] = useState<AiReport[]>([]);
  const [patients, setPatients] = useState<Profile[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [linkName, setLinkName] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [assigningTask, setAssigningTask] = useState(false);
  const [taskAssignedMsg, setTaskAssignedMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [rep, pat, chk, chat, alr] = await Promise.all([
        supabase.from('ai_reports').select('*').order('report_date', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('chat_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('risk_alerts').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      if (!mounted) return;
      if (rep.error || pat.error || chk.error || chat.error || alr.error) {
        setError(rep.error?.message || pat.error?.message || chk.error?.message || chat.error?.message || alr.error?.message || 'Error');
      }
      setReports(rep.data ?? []);
      setPatients((pat.data ?? []).filter((p) => p.role === 'patient'));
      setCheckins(chk.data ?? []);
      setChatLogs(chat.data ?? []);
      setAlerts(alr.data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function acknowledgeAlert(id: string) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    await supabase.from('risk_alerts').update({ acknowledged: true }).eq('id', id);
  }

  const patientById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  const pendingAlerts = useMemo(() => alerts.filter((a) => !a.acknowledged), [alerts]);

  const flaggedPatientIds = useMemo(() => {
    const flagged = new Set<string>();
    for (const p of patients) {
      const own = checkins.filter((c) => c.user_id === p.id);
      if (hasConsecutiveLowMood(own)) flagged.add(p.id);
    }
    return flagged;
  }, [patients, checkins]);

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => Number(flaggedPatientIds.has(b.id)) - Number(flaggedPatientIds.has(a.id))),
    [patients, flaggedPatientIds]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const entries: [string, string][] = [];
      if (profile?.avatar_path) {
        const url = await getAvatarSignedUrl(profile.avatar_path);
        if (url) entries.push([profile.id, url]);
      }
      for (const p of patients) {
        if (!p.avatar_path) continue;
        const url = await getAvatarSignedUrl(p.avatar_path);
        if (url) entries.push([p.id, url]);
      }
      if (mounted) setAvatarUrls(Object.fromEntries(entries));
    })();
    return () => { mounted = false; };
  }, [profile?.id, profile?.avatar_path, patients]);

  useEffect(() => {
    if (!selectedPatientId) { setNotes([]); return; }
    let mounted = true;
    setNotesLoading(true);
    (async () => {
      const { data } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setNotes(data ?? []);
      setNotesLoading(false);
    })();
    return () => { mounted = false; };
  }, [selectedPatientId]);

  function togglePatientPanel(patientId: string) {
    setNewNote(''); setNewTaskTitle(''); setTaskAssignedMsg(null);
    setSelectedPatientId((prev) => (prev === patientId ? null : patientId));
  }

  async function addNote() {
    const note = newNote.trim();
    if (!note || !selectedPatientId || !profile || savingNote) return;
    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('clinical_notes')
        .insert({ patient_id: selectedPatientId, psychologist_id: profile.id, note })
        .select()
        .single();
      if (error) throw error;
      if (data) setNotes((prev) => [data, ...prev]);
      setNewNote('');
    } catch (err) {
      console.error('addNote failed:', err);
    } finally {
      setSavingNote(false);
    }
  }

  async function assignTask() {
    const title = newTaskTitle.trim();
    if (!title || !selectedPatientId || assigningTask) return;
    setAssigningTask(true);
    setTaskAssignedMsg(null);
    try {
      const { error } = await supabase.rpc('assign_patient_task', { p_patient_id: selectedPatientId, p_title: title });
      if (error) throw error;
      setNewTaskTitle('');
      setTaskAssignedMsg('Consigna enviada.');
    } catch (err) {
      setTaskAssignedMsg(err instanceof Error ? err.message : 'No se pudo asignar');
    } finally {
      setAssigningTask(false);
    }
  }

  async function linkPatient(e: React.FormEvent) {
    e.preventDefault();
    const name = linkName.trim();
    if (!name || linking) return;
    setLinking(true);
    setLinkError(null);
    try {
      const { data, error } = await supabase.rpc('link_patient', { p_name: name }).single<{ id: string; full_name: string }>();
      if (error) throw error;
      setLinkName('');
      const { data: full } = await supabase.from('profiles').select('*').eq('id', data.id).maybeSingle();
      setPatients((prev) => {
        const withoutExisting = prev.filter((p) => p.id !== data.id);
        return [...(full ? [full as Profile] : []), ...withoutExisting];
      });
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'No se pudo vincular al paciente');
    } finally {
      setLinking(false);
    }
  }

  async function unlinkPatient(patientId: string) {
    await supabase.rpc('unlink_patient', { p_patient_id: patientId });
    setPatients((prev) => prev.filter((p) => p.id !== patientId));
  }

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
            <img src="/logo-calivia.png" alt="Calivia" className="brand-logo-img" />
            <span className="brand-sub">Panel del especialista</span>
          </div>
          <div className="th-user">
            <div className="th-avatar small">
              {avatarUrls[profile?.id ?? ''] ? <img src={avatarUrls[profile!.id]} alt="" /> : (profile?.full_name || '?').charAt(0).toUpperCase()}
            </div>
            <span className="th-user-name">{profile?.full_name || 'Especialista'}</span>
            <button className="th-logout" onClick={() => setProfileModalOpen(true)} type="button" aria-label="Editar perfil" title="Editar perfil">
              <UserCog size={16} strokeWidth={2} />
            </button>
            <button className="th-logout" onClick={signOut} type="button" aria-label="Salir" title="Salir">
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <main className="th-container">
        {error && <div className="th-error">{error}</div>}

        {pendingAlerts.length > 0 && (
          <section className="th-card th-alerts-card">
            <div className="th-section-head alert">
              <div className="th-section-icon alert"><AlertTriangle size={18} strokeWidth={2} /></div>
              <div>
                <h2>Alertas de riesgo ({pendingAlerts.length})</h2>
                <p>{ALERT_DISCLAIMER}</p>
              </div>
            </div>
            <div className="th-alert-list">
              {pendingAlerts.map((a) => {
                const p = patientById.get(a.patient_id);
                return (
                  <div key={a.id} className="th-alert-item">
                    <div className="th-alert-body">
                      <span className="th-alert-patient">{p?.full_name || 'Paciente'}</span>
                      <span className="th-alert-reason">{a.reason}</span>
                      {a.message_excerpt && <span className="th-alert-excerpt">"{a.message_excerpt}"</span>}
                      <span className="th-alert-time">{new Date(a.created_at).toLocaleString('es-CL')}</span>
                    </div>
                    <button className="th-ack-btn" onClick={() => acknowledgeAlert(a.id)} type="button">
                      <Check size={14} strokeWidth={2.5} /><span>Revisada</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="th-card">
          <div className="th-section-head">
            <div className="th-section-icon"><Users size={18} strokeWidth={2} /></div>
            <div>
              <h2>Mis pacientes</h2>
              <p>Vincula pacientes por nombre para ver sus registros y reportes</p>
            </div>
          </div>
          <form className="th-link-form" onSubmit={linkPatient}>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Nombre exacto del paciente"
            />
            <button type="submit" className="th-btn-primary" disabled={linking || !linkName.trim()}>
              <UserPlus size={15} strokeWidth={2} />
              <span>{linking ? 'Vinculando…' : 'Vincular'}</span>
            </button>
          </form>
          {linkError && <p className="th-link-error">{linkError}</p>}
          {!loading && (
            <div className="th-patient-list">
              {patients.length === 0 ? (
                <p className="th-empty-inline">Todavía no tienes pacientes vinculados.</p>
              ) : (
                sortedPatients.map((p) => {
                  const flagged = flaggedPatientIds.has(p.id);
                  return (
                    <div key={p.id} className={`th-patient-chip ${flagged ? 'flagged' : ''} ${selectedPatientId === p.id ? 'selected' : ''}`}>
                      <button type="button" className="th-patient-chip-main" onClick={() => togglePatientPanel(p.id)}>
                        <div className="th-avatar small">
                          {avatarUrls[p.id] ? <img src={avatarUrls[p.id]} alt="" /> : (p.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span>{p.full_name}</span>
                        {flagged && <span className="th-flag-badge" title="3 días seguidos de ánimo bajo"><Flame size={11} strokeWidth={2.5} />Prioridad</span>}
                      </button>
                      <button
                        type="button"
                        className="th-unlink-btn"
                        onClick={() => unlinkPatient(p.id)}
                        aria-label={`Desvincular a ${p.full_name}`}
                        title="Desvincular"
                      >
                        <UserMinus size={14} strokeWidth={2} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {selectedPatientId && (
            <div className="th-patient-panel">
              <div className="th-panel-col">
                <h4><NotebookPen size={14} strokeWidth={2} /> Notas clínicas</h4>
                <p className="th-panel-hint">Privadas — solo tú las ves. El paciente nunca tiene acceso a esto.</p>
                <div className="th-notes-list">
                  {notesLoading ? (
                    <p className="th-empty-inline">Cargando notas…</p>
                  ) : notes.length === 0 ? (
                    <p className="th-empty-inline">Sin notas todavía.</p>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="th-note-item">
                        <p>{n.note}</p>
                        <span>{new Date(n.created_at).toLocaleString('es-CL')}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="th-note-form">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Impresiones de la consulta…"
                    rows={3}
                  />
                  <button type="button" className="th-btn-primary" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                    {savingNote ? 'Guardando…' : 'Agregar nota'}
                  </button>
                </div>
              </div>

              <div className="th-panel-col">
                <h4><ClipboardList size={14} strokeWidth={2} /> Asignar consigna</h4>
                <p className="th-panel-hint">Una pregunta o tarea breve que le aparecerá en sus tareas.</p>
                <div className="th-note-form">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Ej. ¿Qué momento del día fue más liviano hoy?"
                  />
                  <button type="button" className="th-btn-primary" onClick={assignTask} disabled={assigningTask || !newTaskTitle.trim()}>
                    {assigningTask ? 'Enviando…' : 'Asignar'}
                  </button>
                </div>
                {taskAssignedMsg && <p className="th-task-msg">{taskAssignedMsg}</p>}
              </div>
            </div>
          )}
        </section>

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
                    <div className="th-avatar">{(p?.full_name || '?').charAt(0).toUpperCase()}</div>
                    <div>
                      <h3>{p?.full_name || 'Paciente'}</h3>
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
            background: rgba(26,29,26,0.85);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .th-header-inner {
            max-width: 1100px; margin: 0 auto;
            padding: 12px 24px;
            padding-top: max(12px, env(safe-area-inset-top));
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
          }
          .brand { display: flex; align-items: center; gap: 10px; }
          .brand-logo-img { height: 32px; width: auto; display: block; }
          .brand-sub { font-size: 12px; color: var(--dark-text-soft); display: block; }
          .th-user { display: flex; align-items: center; gap: 10px; }
          .th-user-name { font-size: 14px; font-weight: 600; color: var(--dark-text-soft); }
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
          .th-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 11px 20px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-weight: 600; cursor: pointer; box-shadow: 0 2px 10px rgba(112,130,56,0.2); transition: transform 0.12s; }
          .th-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
          .th-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

          .th-link-form { display: flex; gap: 10px; padding: 18px 20px 8px; flex-wrap: wrap; }
          .th-link-form input { flex: 1 1 220px; padding: 11px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
          .th-link-form input:focus { border-color: var(--primary); outline: none; }
          .th-link-error { margin: 0; padding: 0 20px 8px; font-size: 13px; color: var(--danger); }
          .th-patient-list { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 20px 20px; }
          .th-empty-inline { margin: 0; font-size: 13px; color: var(--text-soft); }
          .th-patient-chip { display: flex; align-items: center; gap: 4px; padding: 6px 8px 6px 6px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-2); font-size: 13px; font-weight: 600; color: var(--text); }
          .th-patient-chip.flagged { border-color: rgba(196,91,74,0.35); background: var(--danger-bg); }
          .th-patient-chip.selected { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(112,130,56,0.15); }
          .th-patient-chip-main { display: flex; align-items: center; gap: 8px; border: none; background: transparent; cursor: pointer; padding: 0; font: inherit; color: inherit; }
          .th-flag-badge { display: flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px; background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; }
          .th-avatar.small { width: 26px; height: 26px; font-size: 12px; }
          .th-avatar { overflow: hidden; }
          .th-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .th-unlink-btn { border: none; background: transparent; color: var(--text-muted); cursor: pointer; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; transition: background 0.15s, color 0.15s; flex-shrink: 0; }
          .th-unlink-btn:hover { background: var(--danger-bg); color: var(--danger); }

          .th-patient-panel { display: grid; grid-template-columns: 1fr; gap: 20px; padding: 4px 20px 22px; border-top: 1px solid var(--border-soft); margin-top: 4px; }
          @media (min-width: 720px) { .th-patient-panel { grid-template-columns: 1fr 1fr; } }
          .th-panel-col { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; }
          .th-panel-col h4 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13.5px; font-weight: 700; color: var(--text); }
          .th-panel-hint { margin: 0; font-size: 11.5px; color: var(--text-soft); }
          .th-notes-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
          .th-note-item { padding: 10px 12px; border: 1px solid var(--border-soft); border-radius: var(--radius-sm); background: var(--surface-2); }
          .th-note-item p { margin: 0 0 4px; font-size: 13px; color: var(--text); white-space: pre-wrap; }
          .th-note-item span { font-size: 10.5px; color: var(--text-muted); }
          .th-note-form { display: flex; flex-direction: column; gap: 8px; }
          .th-note-form textarea, .th-note-form input { font: inherit; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); resize: vertical; }
          .th-note-form textarea:focus, .th-note-form input:focus { border-color: var(--primary); outline: none; }
          .th-task-msg { margin: 0; font-size: 12.5px; color: var(--primary-600); font-weight: 600; }

          .th-alerts-card { border-color: rgba(196,91,74,0.3); }
          .th-section-head.alert { border-bottom-color: rgba(196,91,74,0.15); }
          .th-section-icon.alert { background: var(--danger-bg); color: var(--danger); }
          .th-alert-list { display: flex; flex-direction: column; gap: 10px; padding: 14px 20px 20px; }
          .th-alert-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px; border: 1px solid rgba(196,91,74,0.25); border-radius: var(--radius-sm); background: var(--danger-bg); }
          .th-alert-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
          .th-alert-patient { font-size: 14px; font-weight: 700; color: var(--text); }
          .th-alert-reason { font-size: 12.5px; color: var(--danger); font-weight: 600; }
          .th-alert-excerpt { font-size: 12.5px; color: var(--text-soft); font-style: italic; }
          .th-alert-time { font-size: 11px; color: var(--text-muted); }
          .th-ack-btn { display: flex; align-items: center; gap: 5px; padding: 8px 14px; border: 1px solid rgba(196,91,74,0.3); border-radius: 999px; background: var(--surface); color: var(--danger); font-size: 12.5px; font-weight: 700; cursor: pointer; flex-shrink: 0; transition: all 0.15s; }
          .th-ack-btn:hover { background: var(--danger); color: #fff; }

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
      <ProfileSettingsModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </>
  );
}
