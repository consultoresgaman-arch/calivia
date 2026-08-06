import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Square, Trash2, Bell, BellOff, Plus } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { TaskItem } from './lib/types';

interface Props {
  userId: string;
}

const NOTIF_SUPPORTED = typeof window !== 'undefined' && 'Notification' in window;

function formatDue(dueAt: string): string {
  const d = new Date(dueAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hoy ${time}`;
  if (isTomorrow) return `Mañana ${time}`;
  return `${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${time}`;
}

export default function TaskManager({ userId }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [dueInput, setDueInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    NOTIF_SUPPORTED ? Notification.permission : 'denied'
  );
  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('done', { ascending: true })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (!mounted) return;
      setTasks(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  // Reloj propio: re-evalúa cada 20s qué tareas están vencidas para resaltarlas
  // y, si hay permiso, disparar una notificación. Solo funciona con la app
  // abierta en el navegador — no hay push del lado servidor todavía.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (notifPermission !== 'granted') return;
    for (const t of tasks) {
      if (t.done || !t.due_at || notifiedRef.current.has(t.id)) continue;
      if (new Date(t.due_at).getTime() <= now) {
        notifiedRef.current.add(t.id);
        try { new Notification('Calivia · Recordatorio', { body: t.title }); } catch { /* ignore */ }
      }
    }
  }, [now, tasks, notifPermission]);

  const pending = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  async function requestNotifPermission() {
    if (!NOTIF_SUPPORTED) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const due_at = dueInput ? new Date(dueInput).toISOString() : null;
      const { data } = await supabase
        .from('tasks')
        .insert({ user_id: userId, title: t, due_at })
        .select()
        .single();
      if (data) setTasks((prev) => [...prev, data]);
      setTitle('');
      setDueInput('');
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(t: TaskItem) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await supabase.from('tasks').update({ done: !t.done }).eq('id', t.id);
  }

  async function removeTask(id: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  }

  return (
    <section className="tk-card">
      <div className="tk-head">
        <div className="tk-icon"><CheckSquare size={18} strokeWidth={2} /></div>
        <div>
          <h2>Tareas del día</h2>
          <p>Pendientes laborales, de estudio o personales, con hora si quieres recordatorio.</p>
        </div>
      </div>

      {NOTIF_SUPPORTED && notifPermission !== 'granted' && (
        <button className="tk-notif-btn" onClick={requestNotifPermission} type="button">
          <Bell size={14} strokeWidth={2} />
          <span>Activar recordatorios en este navegador</span>
        </button>
      )}
      {!NOTIF_SUPPORTED && (
        <div className="tk-notif-note"><BellOff size={13} strokeWidth={2} /><span>Tu navegador no soporta notificaciones; los recordatorios solo se ven aquí dentro.</span></div>
      )}
      {NOTIF_SUPPORTED && notifPermission === 'granted' && (
        <p className="tk-notif-hint">Los recordatorios suenan mientras tengas Calivia abierta en este navegador.</p>
      )}

      <form className="tk-form" onSubmit={addTask}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿Qué necesitas hacer?"
          required
        />
        <input
          type="datetime-local"
          value={dueInput}
          onChange={(e) => setDueInput(e.target.value)}
          aria-label="Hora del recordatorio (opcional)"
        />
        <button type="submit" className="tk-add-btn" disabled={adding || !title.trim()}>
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </form>

      {loading ? (
        <div className="tk-loading">Cargando tus tareas…</div>
      ) : tasks.length === 0 ? (
        <div className="tk-empty">Sin tareas por ahora. Agrega la primera arriba.</div>
      ) : (
        <div className="tk-list">
          {pending.map((t) => {
            const overdue = !!t.due_at && new Date(t.due_at).getTime() <= now;
            return (
              <div key={t.id} className={`tk-item ${overdue ? 'overdue' : ''}`}>
                <button className="tk-check" onClick={() => toggleDone(t)} type="button" aria-label="Marcar hecha">
                  <Square size={19} strokeWidth={2} />
                </button>
                <div className="tk-body">
                  <span className="tk-title">{t.title}</span>
                  {t.due_at && <span className="tk-due">{formatDue(t.due_at)}</span>}
                </div>
                <button className="tk-delete" onClick={() => removeTask(t.id)} type="button" aria-label="Eliminar">
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
            );
          })}
          {done.length > 0 && (
            <>
              <div className="tk-divider"><span>Hechas</span></div>
              {done.map((t) => (
                <div key={t.id} className="tk-item done">
                  <button className="tk-check checked" onClick={() => toggleDone(t)} type="button" aria-label="Marcar pendiente">
                    <CheckSquare size={19} strokeWidth={2} />
                  </button>
                  <div className="tk-body">
                    <span className="tk-title">{t.title}</span>
                  </div>
                  <button className="tk-delete" onClick={() => removeTask(t.id)} type="button" aria-label="Eliminar">
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <style>{`
        .tk-card { display: flex; flex-direction: column; gap: 14px; }
        .tk-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--border-soft); }
        .tk-icon { width: 38px; height: 38px; border-radius: 12px; background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .tk-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
        .tk-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }

        .tk-notif-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; border: 1px dashed var(--border); background: transparent; color: var(--text-soft); border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .tk-notif-btn:hover { border-color: var(--primary-200); color: var(--primary-600); }
        .tk-notif-note, .tk-notif-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-soft); margin: 0; }

        .tk-form { display: flex; flex-wrap: wrap; gap: 8px; }
        .tk-form input[type="text"] { flex: 1 1 160px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
        .tk-form input[type="datetime-local"] { flex: 1 1 150px; padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); font-size: 13px; color: var(--text-soft); }
        .tk-form input:focus { border-color: var(--primary); outline: none; }
        .tk-add-btn { width: 42px; height: 42px; border: none; border-radius: 50%; background: var(--primary); color: #fff; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; transition: transform 0.12s; }
        .tk-add-btn:hover:not(:disabled) { transform: scale(1.05); }
        .tk-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .tk-loading, .tk-empty { text-align: center; color: var(--text-soft); font-size: 14px; padding: 20px; }

        .tk-list { display: flex; flex-direction: column; gap: 8px; }
        .tk-item { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
        .tk-item.overdue { border-color: var(--warn); background: rgba(196,154,90,0.08); }
        .tk-item.done { opacity: 0.55; }
        .tk-check { border: none; background: transparent; color: var(--text-soft); cursor: pointer; display: grid; place-items: center; flex-shrink: 0; padding: 2px; }
        .tk-check.checked { color: var(--primary); }
        .tk-check:hover { color: var(--primary); }
        .tk-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .tk-title { font-size: 14px; font-weight: 600; color: var(--text); }
        .tk-item.done .tk-title { text-decoration: line-through; }
        .tk-due { font-size: 12px; color: var(--text-soft); font-weight: 500; }
        .tk-item.overdue .tk-due { color: var(--warn); font-weight: 700; }
        .tk-delete { border: none; background: transparent; color: var(--text-muted); cursor: pointer; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; transition: background 0.15s, color 0.15s; }
        .tk-delete:hover { background: var(--danger-bg); color: var(--danger); }
        .tk-divider { display: flex; align-items: center; gap: 12px; padding: 6px 0 0; color: var(--text-muted); font-size: 12px; font-weight: 500; }
        .tk-divider::before, .tk-divider::after { content: ''; flex: 1; height: 1px; background: var(--border-soft); }
      `}</style>
    </section>
  );
}
