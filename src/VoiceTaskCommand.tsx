import { useEffect, useRef, useState } from 'react';
import { Mic, X, CalendarCheck2, AlertCircle, Bell } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './lib/supabase';
import { ensureMicPermission } from './lib/micPermission';
import { listenOnceNative, speakNative } from './lib/nativeSpeech';
import { NATIVE, DEFAULT_SOUND_KEY, scheduleTaskReminder } from './lib/taskNotifications';
import { useLanguage, useT } from './lib/i18n';
import strings, { SPEECH_LANG_TAG, REMINDER_TITLE } from './VoiceTaskCommand.i18n';

interface Props {
  userId: string;
  // Sube cada vez que corresponde arrancar a escuchar solo, sin toque manual — usado por el
  // atajo nativo de app "Programar por voz" (ver PatientDashboard.tsx y lib/voiceShortcut.ts),
  // tanto en el arranque en frío como al reabrir la app ya corriendo con el shortcut de nuevo.
  autoStartTrigger?: number;
}

// --- Reconocimiento de voz (Web Speech API), mismos tipos mínimos que AiChat.tsx ---
interface SpeechRecognitionResult { transcript: string; }
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: SpeechRecognitionResult; length: number }; length: number };
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

// En build nativa siempre hay una vía de reconocimiento (el plugin nativo, ver
// lib/nativeSpeech.ts), sin depender de que el WebView exponga la Web Speech API del
// navegador (que además, aunque exista como objeto global ahí, no tiene motor real detrás).
const BROWSER_SPEECH_SUPPORTED = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
const VOICE_SUPPORTED = NATIVE || BROWSER_SPEECH_SUPPORTED;
const TTS_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Para español, preferimos un acento latinoamericano neutro sobre el ibérico "es-ES" (que
// suena marcadamente distinto para el público de la app) — mexicano primero, luego colombiano,
// luego el código genérico "es-419" (Latinoamérica y el Caribe).
const SPANISH_REGION_PRIORITY = ['mx', 'co', '419'];

// Heurística simple para preferir voces de mejor calidad (motores neuronales de Google/
// Microsoft) cuando el dispositivo ofrece varias — no hay selector aquí, solo se usa la
// mejor disponible para el idioma actual, a diferencia del selector completo de AiChat.tsx.
function pickBestVoice(voices: SpeechSynthesisVoice[], langTag: string): SpeechSynthesisVoice | undefined {
  const short = langTag.slice(0, 2).toLowerCase();
  const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(short));
  const usable = pool.length > 0 ? pool : voices;
  if (usable.length === 0) return undefined;

  const byQuality = usable.slice().sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      const n = `${v.name} ${v.voiceURI}`.toLowerCase();
      let s = 0;
      if (n.includes('google') || n.includes('microsoft')) s += 4;
      if (n.includes('neural') || n.includes('natural')) s += 4;
      if (v.localService === false) s += 1;
      return s;
    };
    return score(b) - score(a);
  });

  if (short === 'es') {
    for (const region of SPANISH_REGION_PRIORITY) {
      const match = byQuality.find((v) => v.lang.toLowerCase().includes(region));
      if (match) return match;
    }
  }
  return byQuality[0];
}

async function speak(text: string, langTag: string) {
  if (NATIVE) {
    try {
      await speakNative(text, langTag);
    } catch (err) {
      console.error('[Calivia] VoiceTaskCommand speakNative falló:', err);
    }
    return;
  }
  if (!TTS_SUPPORTED) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickBestVoice(window.speechSynthesis.getVoices(), langTag);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || langTag;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('[Calivia] VoiceTaskCommand speak falló:', err);
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function localTimeStr(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type PanelState = 'listening' | 'processing' | 'result' | 'error';

interface ResultInfo {
  ok: boolean;
  message: string;
  needsReminderPermission: boolean;
  taskId: string | null;
}

export default function VoiceTaskCommand({ userId, autoStartTrigger }: Props) {
  const { lang } = useLanguage();
  const t = useT(strings);
  const langTag = SPEECH_LANG_TAG[lang];

  const [open, setOpen] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>('listening');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const closingRef = useRef(false);

  useEffect(() => () => stopRecognition(), []);

  // Atajo de app "Programar por voz": cada vez que autoStartTrigger sube (arranque en frío ya
  // resuelto, o la app se reabrió con el shortcut de nuevo — ver PatientDashboard.tsx), abrimos
  // el panel y arrancamos a escuchar de una, sin esperar el toque manual del botón. En el
  // montaje inicial autoStartTrigger es 0 (falsy), así que no dispara por sí solo.
  useEffect(() => {
    if (autoStartTrigger) void openAndListen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartTrigger]);

  function stopRecognition() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }

  function closePanel() {
    closingRef.current = true;
    stopRecognition();
    if (TTS_SUPPORTED) window.speechSynthesis.cancel();
    setOpen(false);
    setResult(null);
    setTranscript('');
  }

  async function openAndListen() {
    if (!VOICE_SUPPORTED) {
      setErrorMsg(t('errNoVoiceSupport'));
      setPanelState('error');
      setOpen(true);
      return;
    }
    closingRef.current = false;
    setResult(null);
    setTranscript('');
    setErrorMsg('');
    setPanelState('listening');
    setOpen(true);
    await startListening();
  }

  async function startListening() {
    stopRecognition();
    if (NATIVE) {
      await startListeningNative();
      return;
    }
    await startListeningWeb();
  }

  // Build nativa: el SpeechRecognizer real de Android, vía plugin (ver lib/nativeSpeech.ts).
  // El propio recognizer corta la escucha solo al detectar silencio, así que basta un único
  // await — no hay eventos que cablear ni vigía de "no respondió" que armar a mano.
  async function startListeningNative() {
    setPanelState('listening');
    try {
      const text = await listenOnceNative(langTag);
      if (closingRef.current) return;
      setTranscript(text);
      void processCommand(text);
    } catch (err) {
      if (closingRef.current) return;
      console.error('[Calivia] VoiceTaskCommand startListeningNative falló:', err);
      const code = err instanceof Error ? err.message : '';
      if (code === 'speech-recognition-permission-denied') setErrorMsg(t('errMicPermission'));
      else if (code === 'speech-recognition-unavailable') setErrorMsg(t('errNoVoiceSupport'));
      else if (code === 'speech-recognition-empty') setErrorMsg(t('errEmptyTranscript'));
      else setErrorMsg(t('errTranscribeFailed'));
      setPanelState('error');
    }
  }

  // Navegador de escritorio (Chrome/Edge, para desarrollo y pruebas): Web Speech API. En un
  // WebView Android embebido esto NO se usa —ver la nota junto a BROWSER_SPEECH_SUPPORTED—.
  async function startListeningWeb() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition as SpeechRecognitionConstructor;

    const micGranted = await ensureMicPermission();
    if (closingRef.current) return;
    if (!micGranted) {
      setErrorMsg(t('errMicPermission'));
      setPanelState('error');
      return;
    }

    try {
      const recognition = new SR();
      recognition.lang = langTag;
      recognition.continuous = false;
      recognition.interimResults = true;

      let finalTranscript = '';

      // Mismo vigía que AiChat.tsx: si el motor de reconocimiento se queda "escuchando" sin
      // disparar ningún evento (frecuente en algunos Android), forzamos la detención a los 10s.
      const watchdog = window.setTimeout(() => {
        try { recognition.stop(); } catch { /* ignore */ }
        if (!closingRef.current) {
          setErrorMsg(t('errMicNoResponse'));
          setPanelState('error');
        }
        recognitionRef.current = null;
      }, 10000);

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.length > 0) {
            const chunk = r[0].transcript;
            if (i === e.results.length - 1 && typeof (r as any).isFinal === 'boolean' && (r as any).isFinal) {
              finalTranscript += chunk;
            } else {
              interim += chunk;
            }
          }
        }
        setTranscript(finalTranscript + interim);
      };

      recognition.onerror = (e: Event) => {
        window.clearTimeout(watchdog);
        recognitionRef.current = null;
        if (closingRef.current) return;
        const errEvent = e as any;
        if (errEvent.error === 'not-allowed' || errEvent.error === 'service-not-allowed') {
          setErrorMsg(t('errMicNotAllowed'));
          setPanelState('error');
        } else if (errEvent.error !== 'no-speech' && errEvent.error !== 'aborted') {
          setErrorMsg(t('errTranscribeFailed'));
          setPanelState('error');
        } else {
          setPanelState('error');
          setErrorMsg(t('errEmptyTranscript'));
        }
      };

      recognition.onend = () => {
        window.clearTimeout(watchdog);
        recognitionRef.current = null;
        if (closingRef.current) return;
        const text = finalTranscript.trim();
        if (!text) {
          setErrorMsg(t('errEmptyTranscript'));
          setPanelState('error');
          return;
        }
        void processCommand(text);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[Calivia] VoiceTaskCommand startListening falló:', err);
      setErrorMsg(t('errTranscribeFailed'));
      setPanelState('error');
    }
  }

  async function processCommand(text: string) {
    setPanelState('processing');
    try {
      const now = new Date();
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-task`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userId,
          transcript: text,
          lang,
          localDate: localDateStr(now),
          localTime: localTimeStr(now),
        }),
      });
      if (!res.ok) throw new Error(`voice-task ${res.status}`);
      const parsed = await res.json() as { intent: string; title: string; date: string | null; time: string | null; confirmation: string };

      if (closingRef.current) return;

      if (parsed.intent !== 'schedule_task' || !parsed.title) {
        setResult({ ok: false, message: parsed.confirmation, needsReminderPermission: false, taskId: null });
        setPanelState('result');
        void speak(parsed.confirmation, langTag);
        return;
      }

      const due_at = parsed.date && parsed.time ? new Date(`${parsed.date}T${parsed.time}:00`).toISOString() : null;

      const { data: task, error: insErr } = await supabase
        .from('tasks')
        .insert({ user_id: userId, title: parsed.title, due_at, reminder_sound: DEFAULT_SOUND_KEY })
        .select()
        .single();
      if (insErr || !task) throw insErr || new Error('insert-failed');

      let needsReminderPermission = false;
      if (due_at && NATIVE) {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          needsReminderPermission = true;
        } else {
          await scheduleTaskReminder(task, REMINDER_TITLE[lang]);
        }
      }

      if (closingRef.current) return;
      setResult({ ok: true, message: parsed.confirmation, needsReminderPermission, taskId: task.id });
      setPanelState('result');
      void speak(parsed.confirmation, langTag);
    } catch (err) {
      console.error('[Calivia] VoiceTaskCommand processCommand falló:', err);
      if (closingRef.current) return;
      setErrorMsg(t('errRequestFailed'));
      setPanelState('error');
    }
  }

  async function enableRemindersForResult() {
    if (!result?.taskId) return;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    const { data: task } = await supabase.from('tasks').select('*').eq('id', result.taskId).single();
    if (task) await scheduleTaskReminder(task, REMINDER_TITLE[lang]);
    setResult((r) => (r ? { ...r, needsReminderPermission: false } : r));
  }

  return (
    <>
      <button
        type="button"
        className={`voice-cmd-fab ${!VOICE_SUPPORTED ? 'disabled' : ''}`}
        onClick={openAndListen}
        aria-label={t('fabAria')}
        title={t('fabLabel')}
      >
        <Mic size={20} strokeWidth={2} />
      </button>

      {open && (
        <div className="voice-cmd-overlay" onClick={closePanel}>
          <div className="voice-cmd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="voice-cmd-head">
              <span>{t('panelTitle')}</span>
              <button type="button" className="voice-cmd-x" onClick={closePanel} aria-label={t('close')}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {panelState === 'listening' && (
              <div className="voice-cmd-body">
                <div className="voice-cmd-mic-ring"><Mic size={26} strokeWidth={2} /></div>
                <p className="voice-cmd-hint">{transcript || t('hintListening')}</p>
                {!transcript && <p className="voice-cmd-example">{t('hintIdle')}</p>}
              </div>
            )}

            {panelState === 'processing' && (
              <div className="voice-cmd-body">
                <div className="voice-cmd-mic-ring processing"><Mic size={26} strokeWidth={2} /></div>
                <p className="voice-cmd-hint">{transcript}</p>
                <p className="voice-cmd-example">{t('hintProcessing')}</p>
              </div>
            )}

            {panelState === 'result' && result && (
              <div className="voice-cmd-body">
                <div className={`voice-cmd-result-icon ${result.ok ? 'ok' : 'warn'}`}>
                  {result.ok ? <CalendarCheck2 size={24} strokeWidth={2} /> : <AlertCircle size={24} strokeWidth={2} />}
                </div>
                {result.ok && <span className="voice-cmd-badge">{t('taskCreatedBadge')}</span>}
                <p className="voice-cmd-confirmation">{result.message}</p>
                {result.needsReminderPermission && (
                  <button type="button" className="voice-cmd-enable-btn" onClick={enableRemindersForResult}>
                    <Bell size={14} strokeWidth={2} /><span>{t('enableReminders')}</span>
                  </button>
                )}
                {!result.ok && (
                  <button type="button" className="voice-cmd-retry-btn" onClick={openAndListen}>
                    <Mic size={14} strokeWidth={2} /><span>{t('tryAgain')}</span>
                  </button>
                )}
              </div>
            )}

            {panelState === 'error' && (
              <div className="voice-cmd-body">
                <div className="voice-cmd-result-icon warn"><AlertCircle size={24} strokeWidth={2} /></div>
                <p className="voice-cmd-confirmation">{errorMsg}</p>
                <button type="button" className="voice-cmd-retry-btn" onClick={openAndListen}>
                  <Mic size={14} strokeWidth={2} /><span>{t('tryAgain')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .voice-cmd-fab {
          position: fixed; right: 16px; bottom: 196px; z-index: 45;
          width: 52px; height: 52px; border-radius: 50%; border: none;
          background: var(--primary); color: #fff; cursor: pointer;
          display: grid; place-items: center;
          box-shadow: 0 4px 16px rgba(112,130,56,0.35);
          transition: transform 0.12s, box-shadow 0.15s;
        }
        .voice-cmd-fab:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(112,130,56,0.4); }
        .voice-cmd-fab:active { transform: scale(0.92); }
        .voice-cmd-fab.disabled { opacity: 0.4; cursor: not-allowed; }

        .voice-cmd-overlay {
          position: fixed; inset: 0; z-index: 220;
          background: rgba(26,29,26,0.6);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 16px; animation: fadeIn 0.2s ease;
        }
        @media (min-width: 480px) { .voice-cmd-overlay { align-items: center; } }

        .voice-cmd-panel {
          width: 100%; max-width: 380px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          box-shadow: var(--shadow-lg); padding: 18px;
          padding-bottom: max(18px, env(safe-area-inset-bottom));
        }
        .voice-cmd-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .voice-cmd-head span { font-size: 15px; font-weight: 700; color: var(--text); }
        .voice-cmd-x { border: none; background: var(--surface-2); color: var(--text-soft); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: grid; place-items: center; }
        .voice-cmd-x:hover { background: var(--muted); color: var(--text); }

        .voice-cmd-body { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 8px 4px 4px; }

        .voice-cmd-mic-ring {
          width: 64px; height: 64px; border-radius: 50%;
          background: var(--secondary); color: #fff;
          display: grid; place-items: center;
          box-shadow: 0 0 0 0 rgba(140,138,126,0.4);
          animation: breathe 1.5s ease-in-out infinite, micRing 1.5s ease-out infinite;
        }
        .voice-cmd-mic-ring.processing { background: var(--primary); animation: breathe 1.2s ease-in-out infinite; }
        @keyframes micRing {
          0% { box-shadow: 0 0 0 0 rgba(140,138,126,0.35); }
          70% { box-shadow: 0 0 0 14px rgba(140,138,126,0); }
          100% { box-shadow: 0 0 0 0 rgba(140,138,126,0); }
        }

        .voice-cmd-hint { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--text); min-height: 20px; }
        .voice-cmd-example { margin: 0; font-size: 12.5px; color: var(--text-soft); line-height: 1.5; }

        .voice-cmd-result-icon { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; }
        .voice-cmd-result-icon.ok { background: rgba(112,130,56,0.12); color: var(--primary); }
        .voice-cmd-result-icon.warn { background: rgba(196,154,90,0.12); color: var(--warn); }
        .voice-cmd-badge { padding: 3px 10px; border-radius: 999px; background: rgba(112,130,56,0.12); color: var(--primary-600); font-size: 11.5px; font-weight: 700; }
        .voice-cmd-confirmation { margin: 0; font-size: 14.5px; color: var(--text); line-height: 1.5; }

        .voice-cmd-enable-btn, .voice-cmd-retry-btn {
          display: flex; align-items: center; gap: 6px; padding: 9px 16px;
          border-radius: 999px; font-size: 12.5px; font-weight: 700; cursor: pointer;
        }
        .voice-cmd-enable-btn { border: 1px dashed var(--warn); background: rgba(196,154,90,0.08); color: var(--warn); }
        .voice-cmd-retry-btn { border: 1px solid var(--border); background: var(--surface-2); color: var(--text-soft); }
        .voice-cmd-retry-btn:hover { border-color: var(--primary-200); color: var(--primary-600); }
      `}</style>
    </>
  );
}
