import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Heart, Zap, Volume2 } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from './lib/supabase';
import type { ChatLog } from './lib/types';
import { isCheckoutConfigured, openCheckout } from './lib/payments';

interface MicPermissionPlugin {
  requestMicPermission(): Promise<{ granted: boolean }>;
}

const MicPermission = registerPlugin<MicPermissionPlugin>('MicPermission');

function voiceQualityScore(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;
  if (n.includes('google')) score += 4;
  if (n.includes('neural') || n.includes('natural')) score += 4;
  if (n.includes('network') || n.includes('online') || n.includes('cloud') || n.includes('plus')) score += 2;
  if (v.localService === false) score += 1;
  if (n.includes('compact') || n.includes('robot') || n.includes('espeak')) score -= 5;
  return score;
}

const SYSTEM_NOTE = 'Soy Calivia (la unión de calma y alivio). Un espacio de acompañamiento, no sustituyo la atención profesional.';

const QUICK_PROMPTS = [
  'No sé por dónde empezar',
  'Necesito un momento para respirar',
  'Hoy fue un día difícil',
  'Solo quiero que alguien me escuche',
];

// Protocolo de espera (anti-interrupción): si el usuario sigue escribiendo
// mensajes seguidos (mientras la IA todavía está "pensando" o apenas
// terminó de responder), no lanzamos otro análisis largo — solo un acuse
// breve, local, y esperamos a que haya una pausa real antes de responder.
const FRAGMENT_QUIET_MS = 3500;
const BURST_ACK_REPLIES = [
  'Te sigo leyendo, continúa.',
  'Aquí estoy. Sigue, tómate tu tiempo.',
  'Te escucho, continúa cuando quieras.',
];

const FALLBACK_GREETINGS = {
  morning: 'Buenos días, soy Calivia. ¿Cómo te sientes para comenzar tu día?',
  afternoon: 'Hola, buenas tardes, soy Calivia. Recuerda que debes comer, o ¿ya has comido? ¿Cómo va tu día?',
  night: 'Hola, soy Calivia. ¿Cómo estuvo tu día hoy? ¿Ya has cenado?',
};

function getTimeOfDay(): 'morning' | 'afternoon' | 'night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'afternoon';
  return 'night';
}

const SOCRATIC_FOLLOWUPS = [
  'Y cuando eso pasó, ¿qué parte crees que fue tuya y qué parte fue del otro lado? Pienso que hay algo ahí que no estás mirando.',
  'Déjame preguntarte algo directo: ¿estás reaccionando a lo que pasó o a lo que te imaginas que significa? A veces nos enojamos con la historia, no con los hechos.',
  'Pongo en la mesa algo incómodo: dices que no tuviste elección, pero siempre hay una. ¿Qué ganaste al quedarte callado? ¿Qué estabas protegiendo?',
  'Te escucho, pero noto que te estás quedando en lo que el otro hizo mal. ¿Y tú? ¿Qué responsabilidad tienes en cómo terminó?',
  'Parémonos aquí un momento. Dices "no puedo más", pero llevas días diciéndolo sin cambiar nada. ¿Qué te impide dar el primer paso? ¿Miedo o costumbre?',
  'Voy a cuestionarte algo: ¿de verdad crees que eso que sientes es miedo al cambio, o es miedo a perder el control de una situación que ya no te sirve?',
  'Te lo digo sin rodeos: estás pidiendo que el otro cambie para no tener que moverte tú. ¿Qué pasaría si el otro no cambia? ¿Te quedarías así para siempre?',
  'Noto un patrón: todo lo que cuentas tiene al otro como protagonista y a ti como espectador. ¿Cuándo vas a tomar el rol principal de tu historia?',
];

const CLOSURE_REPLIES = [
  'Eso que acabas de decir es tuyo, no mío. Quédate con eso. Cuando lo pongas en práctica, vuelve y me cuentas.',
  'Me gustó lo que dijiste. No te voy a dar un discurso, solo esto: confío en que lo vas a hacer bien.',
  'Buena reflexión. Ese insight es el primer paso. El segundo es actuar. Aquí estaré cuando lo necesites.',
  'Llegaste ahí por ti mismo, que es como debe ser. Sigue ese instinto, no te traiciones.',
];

function generateClientFallback(message: string, conversation: ChatLog[]): string {
  const userTurns = conversation.filter((m) => m.role === 'user');
  const isFirstMessage = userTurns.length === 0;

  if (isFirstMessage) return FALLBACK_GREETINGS[getTimeOfDay()];

  const lower = message.toLowerCase();
  const assistantTurns = conversation.filter((m) => m.role === 'assistant');
  const lastAssistant = assistantTurns[assistantTurns.length - 1];

  if (lower.includes('significa') && (lower.includes('calivia') || lower.includes('tu nombre'))) {
    return 'Calivia nace de la unión entre calma y alivio. Es el significado real de este espacio: un refugio diseñado para ofrecerte exactamente eso, un lugar donde puedas pausar y encontrar sosiego.';
  }
  if (lower.includes('diagnóstico') || lower.includes('diagnostico') || lower.includes('tengo algo')) {
    return 'No tengo la capacidad de dar un diagnóstico clínico, pero puedo acompañarte. Para una evaluación profesional, te invito a agendar una sesión con el especialista: https://calendly.com/consultoresgaman/30min';
  }
  if (lower.includes('riesgo') || lower.includes('suicid') || lower.includes('hacerme daño') || lower.includes('no quiero seguir')) {
    return 'Lo que me cuentas requiere ayuda inmediata. Estoy contigo, pero ahora mismo necesitas hablar con alguien que pueda sostenerte en persona. Usa el botón de respiro urgente o llama a alguien de confianza ahora mismo. Tu vida importa más que cualquier mensaje.';
  }

  if (lastAssistant && (lastAssistant.content.includes('Ponme en contexto') || lastAssistant.content.includes('qué fue lo que pasó'))) {
    return SOCRATIC_FOLLOWUPS[message.length % SOCRATIC_FOLLOWUPS.length];
  }
  if (lower.includes('gracias') || lower.includes('me sirve') || lower.includes('tiene sentido')) {
    return CLOSURE_REPLIES[message.length % CLOSURE_REPLIES.length];
  }
  if (message.includes('?') && (lower.includes('qué hago') || lower.includes('que hago') || lower.includes('cómo'))) {
    return 'No te voy a dar la respuesta, porque no es mía para dar. Déjame preguntarte: si yo no estuviera aquí y tuvieras que decidir solo, ¿qué harías? Esa intuición que aparece cuando nadie te dice qué hacer... ¿qué te dice?';
  }

  return SOCRATIC_FOLLOWUPS[message.length % SOCRATIC_FOLLOWUPS.length];
}

interface SpeechRecognitionResult {
  transcript: string;
}
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

interface Props {
  userId: string;
  name?: string | null;
  messagesSent: number;
  maxFree: number;
  onMessageSent: () => void;
}

export default function AiChat({ userId, name, messagesSent, maxFree, onMessageSent }: Props) {
  const [messages, setMessages] = useState<ChatLog[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [voicesLoading, setVoicesLoading] = useState(true);
  const hasSelectedVoiceRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fragmentTimerRef = useRef<number | null>(null);
  const ackIndexRef = useRef(0);
  // Ref sincrónico (no el estado `sending`, que puede quedar un instante
  // desactualizado por el renderizado de React) para saber sin ambigüedad
  // si ya hay una cadena de mensajes en curso — así dos mensajes mandados
  // casi al mismo tiempo nunca disparan dos llamadas a la IA en paralelo.
  const chainActiveRef = useRef(false);

  const limitReached = messagesSent >= maxFree;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setVoiceSupported(false);

    const synthAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (!synthAvailable) {
      setVoicesLoading(false);
      return;
    }

    let settled = false;

    function loadVoices() {
      try {
        const allVoices = window.speechSynthesis.getVoices();
        if (allVoices.length === 0) return;

        const spanishVoices = allVoices.filter((v) => v.lang.toLowerCase().includes('es'));
        const pool = spanishVoices.length > 0 ? spanishVoices : allVoices;
        const highQuality = pool.filter((v) => voiceQualityScore(v) > 0);
        const usable = (highQuality.length > 0 ? highQuality : pool)
          .slice()
          .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));
        setVoices(usable);
        if (!hasSelectedVoiceRef.current) {
          hasSelectedVoiceRef.current = true;
          const preferred = usable.find((v) => v.lang.toLowerCase().includes('co') || v.lang.toLowerCase().includes('419')) || usable[0];
          setSelectedVoiceUri(preferred.voiceURI);
        }
        settled = true;
        setVoicesLoading(false);
      } catch (err) {
        console.error('[Calivia] loadVoices falló:', err);
        settled = true;
        setVoicesLoading(false);
      }
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Algunos WebView (sobre todo en Android) nunca disparan "voiceschanged"
    // ni devuelven voces — sin este plazo, el selector se queda cargando
    // para siempre. Si a los 2.5s no hay nada, dejamos de esperar y
    // ocultamos el selector en vez de mostrar un spinner infinito.
    const timeout = window.setTimeout(() => {
      if (!settled) {
        console.error('[Calivia] speechSynthesis.getVoices() nunca devolvió voces en 2.5s (ni voiceschanged disparó); ocultando el selector.');
        setVoicesLoading(false);
      }
    }, 2500);

    return () => {
      window.clearTimeout(timeout);
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  function speakResponse(text: string) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (voices.length > 0 && selectedVoiceUri) {
        const chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceUri);
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
      }

      utterance.rate = 0.93;
      utterance.pitch = 0.96;
      window.speechSynthesis.speak(utterance);
    }
  }

  useEffect(() => () => {
    if (fragmentTimerRef.current) clearTimeout(fragmentTimerRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (!mounted) return;
      if (error) setError(error.message);
      else setMessages(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  function stopRecognition() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setRecording(false);
  }

  // En Android, el WebView solo concede getUserMedia si la app ya tiene el
  // permiso RECORD_AUDIO otorgado a nivel de sistema — si nunca se lo hemos
  // pedido de forma nativa, el WebView lo deniega en silencio. Por eso primero
  // pasamos por el plugin nativo (MicPermissionPlugin, ver MainActivity.java),
  // que dispara el diálogo real de Android, y solo después llamamos a
  // getUserMedia (que en navegadores normales es la única vía y es inofensivo).
  async function ensureMicPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        // Si el puente nativo tarda o nunca responde, no dejamos el botón
        // colgado esperando para siempre: a los 5s seguimos con el flujo web.
        const timeout = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('mic-plugin-timeout')), 5000);
        });
        const { granted } = await Promise.race([MicPermission.requestMicPermission(), timeout]);
        if (!granted) return false;
      } catch (err) {
        console.error('[Calivia] MicPermission.requestMicPermission falló o expiró, sigo con getUserMedia como respaldo:', err);
      }
    }
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      console.error('[Calivia] getUserMedia denegó el acceso al micrófono:', err);
      return false;
    }
  }

  async function startVoiceInput() {
    if (!voiceSupported || recording) {
      stopRecognition();
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition as SpeechRecognitionConstructor;
    if (!SR) {
      console.error('[Calivia] startVoiceInput: SpeechRecognition no está disponible en este navegador.');
      setError('Tu navegador no soporta dictado por voz.');
      return;
    }

    stopRecognition();
    setError(null);

    try {
      const micGranted = await ensureMicPermission();
      if (!micGranted) {
        setError('Necesitamos permiso de micrófono para dictar por voz. Revísalo en los ajustes de la app.');
        return;
      }

      const recognition = new SR();
      recognition.lang = 'es-CO';
      recognition.continuous = false;
      recognition.interimResults = true;

      let finalTranscript = '';

      // Puente nativo de audio: en algunos dispositivos Android el motor de
      // reconocimiento se queda "escuchando" en silencio para siempre sin
      // disparar ni onresult ni onerror ni onend (p. ej. si el servicio de
      // reconocimiento del sistema no responde). Sin este vigía, el botón
      // quedaría atrapado indefinidamente en el estado de grabación.
      const watchdog = window.setTimeout(() => {
        console.error('[Calivia] SpeechRecognition no dio señales de vida a tiempo; forzando detención.');
        try { recognition.stop(); } catch { /* ignore */ }
        setError('El micrófono no respondió. Verifica que el servicio de reconocimiento de voz de tu dispositivo esté activo e intenta de nuevo.');
        setRecording(false);
        recognitionRef.current = null;
      }, 10000);

      (recognition as any).onstart = () => {
        console.info('[Calivia] SpeechRecognition: sesión iniciada correctamente.');
      };

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          if (result.length > 0) {
            const transcript = result[0].transcript;
            if (i === e.results.length - 1 && typeof (result as any).isFinal === 'boolean' && (result as any).isFinal) {
              finalTranscript += transcript;
            } else {
              interim += transcript;
            }
          }
        }
        setInput(finalTranscript + interim);
      };

      recognition.onerror = (e: Event) => {
        const errEvent = e as any;
        console.error('[Calivia] SpeechRecognition onerror:', errEvent.error);
        window.clearTimeout(watchdog);
        if (errEvent.error === 'not-allowed' || errEvent.error === 'service-not-allowed') {
          setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
        } else if (errEvent.error !== 'no-speech' && errEvent.error !== 'aborted') {
          setError('No se pudo transcribir la voz. Intenta escribir tu mensaje.');
        }
        setRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        window.clearTimeout(watchdog);
        setRecording(false);
        recognitionRef.current = null;
        const textToSend = finalTranscript.trim();
        if (textToSend) {
          setInput('');
          send(null, textToSend, true);
        }
      };

      recognitionRef.current = recognition;
      setRecording(true);
      setError(null);
      recognition.start();
    } catch (err) {
      console.error('[Calivia] startVoiceInput falló inesperadamente:', err);
      setError('No se pudo iniciar el dictado por voz. Intenta de nuevo.');
      setRecording(false);
      recognitionRef.current = null;
    }
  }

  async function send(e: React.FormEvent | null, overrideText?: string, isVoice: boolean = false) {
    e?.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || limitReached) return;
    stopRecognition();
    setError(null);
    setInput('');

    // Marca la cadena como activa ANTES de cualquier `await`, de forma
    // sincrónica — así un segundo mensaje mandado un instante después
    // siempre ve que ya hay algo en curso, sin depender del timing del
    // estado de React. La caja de texto nunca se deshabilita por esto:
    // solo cambia si esperamos con un acuse o llamamos a la IA de una vez.
    const joiningActiveChain = chainActiveRef.current;
    chainActiveRef.current = true;

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: tempId, user_id: userId, role: 'user', content: text, created_at: now }]);

    let saved: ChatLog;
    try {
      const { data, error: insErr } = await supabase
        .from('chat_logs')
        .insert({ user_id: userId, role: 'user', content: text })
        .select()
        .single();
      if (insErr) throw insErr;
      saved = data;
      setMessages((m) => m.map((x) => (x.id === tempId ? saved : x)));
      onMessageSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(text);
      if (!fragmentTimerRef.current) chainActiveRef.current = false;
      return;
    }

    // Protocolo de espera: si ya había una cadena en curso (la IA sigue
    // respondiendo, o el usuario acaba de escribir hace un momento), este
    // mensaje es probablemente un fragmento de algo más largo. Solo un
    // acuse breve, y reiniciamos la espera — sin bloquear el input.
    if (joiningActiveChain || fragmentTimerRef.current) {
      if (fragmentTimerRef.current) clearTimeout(fragmentTimerRef.current);
      const ack = BURST_ACK_REPLIES[ackIndexRef.current % BURST_ACK_REPLIES.length];
      ackIndexRef.current++;
      setMessages((m) => [...m, { id: `ack-${Date.now()}`, user_id: userId, role: 'assistant', content: ack, created_at: new Date().toISOString() }]);
      fragmentTimerRef.current = window.setTimeout(async () => {
        fragmentTimerRef.current = null;
        ackIndexRef.current = 0;
        await callAssistant(text, isVoice);
        if (!fragmentTimerRef.current) chainActiveRef.current = false;
      }, FRAGMENT_QUIET_MS);
      return;
    }

    await callAssistant(text, isVoice);
    if (!fragmentTimerRef.current) chainActiveRef.current = false;
  }

  async function callAssistant(text: string, isVoice: boolean) {
    setSending(true);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const localTime = new Date().toTimeString().slice(0, 5);
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ userId, message: text, localTime }),
      });

      let reply: string = '';
      let isFallback = false;

      if (res.ok) {
        const json = await res.json();
        reply = json.reply ?? json.message ?? '';
        if (!reply) throw new Error('Respuesta vacía del asistente.');
        isFallback = !!json.fallback;
      } else if (res.status >= 500) {
        reply = generateClientFallback(text, messages);
        isFallback = true;
      } else {
        const txt = await res.text().catch(() => '');
        throw new Error(`El asistente no respondió (${res.status}). ${txt.slice(0, 120)}`);
      }

      setUsingFallback(isFallback);
      const assistantLog: ChatLog = { id: `a-${Date.now()}`, user_id: userId, role: 'assistant', content: reply, created_at: new Date().toISOString() };
      setMessages((m) => [...m, assistantLog]);

      if (isVoice) {
        speakResponse(reply);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-card">
      <div className="chat-head">
        <div className="chat-icon">
          <Heart size={18} strokeWidth={2} />
        </div>
        <div className="chat-head-info">
          <h2>Calivia</h2>
          <p>{SYSTEM_NOTE}</p>
        </div>
      </div>

      {(voicesLoading || voices.length > 0) && (
      <div className="voice-selector-bar">
        <label htmlFor="voice-select">
          <Volume2 size={14} /> Voz de Calivia:
        </label>
        <select
          id="voice-select"
          value={selectedVoiceUri}
          onChange={(e) => setSelectedVoiceUri(e.target.value)}
          aria-label="Seleccionar voz de Calivia"
          disabled={voicesLoading}
        >
          {voices.length > 0 ? (
            voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))
          ) : (
            <option value="">Buscando voces…</option>
          )}
        </select>
      </div>
      )}

      <div className="chat-body" ref={scrollRef}>
        {loading ? (
          <div className="chat-empty">Cargando tu espacio…</div>
        ) : messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <Heart size={24} strokeWidth={1.5} />
            </div>
            <p>{FALLBACK_GREETINGS[getTimeOfDay()]}</p>
            <p className="chat-welcome-sub">Te escucho, sin prisa.</p>
            <div className="quick-prompts">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} type="button" className="quick-chip" onClick={() => send(null, q, false)} disabled={limitReached}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg-row ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="msg-avatar"><Heart size={12} strokeWidth={2} /></div>
              )}
              <div className={`bubble ${m.role}`}>
                <div className="bubble-text">{m.content}</div>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="msg-row assistant">
            <div className="msg-avatar"><Heart size={12} strokeWidth={2} /></div>
            <div className="bubble assistant">
              <div className="bubble-text">
                <span className="typing-dot" /> <span className="typing-dot" style={{ animationDelay: '0.2s' }} /> <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && !limitReached && (
        <div className="quick-prompts quick-prompts-slim">
          {QUICK_PROMPTS.map((q) => (
            <button key={q} type="button" className="quick-chip" onClick={() => send(null, q, false)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {usingFallback && !sending && (
        <div className="chat-fallback-note">
          Calivia está en modo de respaldo. Tus mensajes siguen siendo escuchados.
        </div>
      )}
      {error && <div className="chat-error">{error}</div>}
      {limitReached && !sending && (
        <div className="chat-limit">
          <p>Has alcanzado el límite diario de la Versión Calma.</p>
          {isCheckoutConfigured() ? (
            <button
              className="chat-limit-cta"
              type="button"
              onClick={() => openCheckout({ userId, name })}
            >
              <Zap size={14} strokeWidth={2.5} /><span>Desbloquear Calivia Ilimitada</span>
            </button>
          ) : (
            <p className="chat-limit-sub">Explora Calivia Ilimitada arriba.</p>
          )}
        </div>
      )}

      <form className="chat-input" onSubmit={(e) => send(e, undefined, false)}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={limitReached ? 'Límite diario alcanzado…' : recording ? 'Escuchando… habla ahora' : 'Escribe lo que traes dentro…'}
          disabled={limitReached}
          aria-label="Mensaje a Calivia"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e, undefined, false); }
          }}
        />
        <button
          type="button"
          className={`mic-btn ${recording ? 'rec' : ''} ${!voiceSupported ? 'disabled' : ''}`}
          onClick={startVoiceInput}
          disabled={limitReached || !voiceSupported}
          aria-label={recording ? 'Detener grabación' : 'Hablar al micrófono'}
          title={voiceSupported ? 'Dictar por voz y recibir respuesta hablada' : 'Tu navegador no soporta dictado por voz'}
        >
          <Mic size={18} strokeWidth={2} />
        </button>
        <button type="submit" className="send-btn" disabled={!input.trim() || limitReached}>
          <Send size={18} strokeWidth={2} />
        </button>
      </form>

      <style>{`
        .chat-card { display: flex; flex-direction: column; height: 100%; min-height: 380px; }
        .chat-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-soft); }
        .chat-icon {
          width: 38px; height: 38px; border-radius: 12px;
          background: rgba(112,130,56,0.12); color: var(--primary);
          display: grid; place-items: center; flex-shrink: 0;
        }
        .chat-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
        .chat-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }

        .voice-selector-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 10px; margin-top: 8px; background: var(--surface-2);
          border-radius: 8px; border: 1px solid var(--border-soft); font-size: 12px; color: var(--text-soft);
        }
        .voice-selector-bar label { display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .voice-selector-bar select {
          padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--surface); color: var(--text); font-size: 12px; max-width: 180px;
        }

        .chat-body {
          flex: 1; overflow-y: auto; padding: 16px 4px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .chat-empty { text-align: center; color: var(--text-soft); font-size: 14px; padding: 20px; }
        .chat-welcome {
          text-align: center; padding: 28px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .chat-welcome-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: rgba(112,130,56,0.1); color: var(--primary);
          display: grid; place-items: center; margin-bottom: 4px;
        }
        .chat-welcome p { margin: 0; font-size: 15px; color: var(--text); font-weight: 500; }
        .chat-welcome-sub { font-size: 13px !important; color: var(--text-soft) !important; font-weight: 400 !important; }

        .quick-prompts { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 6px; }
        .quick-prompts-slim { justify-content: flex-start; padding: 10px 2px 0; margin-top: 0; }
        .quick-chip {
          padding: 8px 14px; border: 1px solid var(--border); border-radius: 999px;
          background: var(--surface-2); color: var(--text-soft);
          font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .quick-chip:hover:not(:disabled) { border-color: var(--primary-200); color: var(--primary-600); background: rgba(112,130,56,0.06); }
        .quick-chip:disabled { opacity: 0.45; cursor: not-allowed; }

        .msg-row { display: flex; align-items: flex-end; gap: 8px; }
        .msg-row.user { justify-content: flex-end; }
        .msg-avatar {
          width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
          background: rgba(112,130,56,0.12); color: var(--primary);
          display: grid; place-items: center;
        }

        .bubble {
          max-width: 78%; padding: 11px 15px;
          border-radius: 18px; font-size: 14px; line-height: 1.6;
          animation: fadeIn 0.25s ease;
          box-shadow: 0 1px 2px rgba(58,58,54,0.04);
        }
        .bubble.user {
          background: var(--primary);
          color: #fff;
          border-bottom-right-radius: 6px;
        }
        .bubble.assistant {
          background: var(--surface-2);
          color: var(--text);
          border: 1px solid var(--border-soft);
          border-bottom-left-radius: 6px;
        }
        .bubble-text { white-space: pre-wrap; }
        .typing-dot {
          display: inline-block; width: 7px; height: 7px;
          border-radius: 50%; background: var(--text-muted);
          animation: dotPulse 1s infinite;
        }

        .chat-fallback-note {
          margin: 8px 2px; padding: 8px 12px;
          background: rgba(196,154,90,0.1); color: var(--warn);
          border-radius: var(--radius-xs); font-size: 12px;
          text-align: center; font-weight: 500;
        }
        .chat-error {
          margin: 8px 2px; padding: 10px 14px;
          background: var(--danger-bg); color: var(--danger);
          border-radius: var(--radius-sm); font-size: 13px;
          border: 1px solid rgba(184,92,74,0.2);
        }
        .chat-limit {
          margin: 8px 2px; padding: 12px 14px;
          background: rgba(196,154,90,0.1); color: var(--warn);
          border-radius: var(--radius-sm); font-size: 13px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .chat-limit p { margin: 0; }
        .chat-limit-sub { color: var(--warn); }
        .chat-limit-cta {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 18px; border: none; border-radius: 999px;
          background: var(--primary); color: #fff;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: transform 0.12s, box-shadow 0.15s;
          box-shadow: 0 2px 10px rgba(112,130,56,0.25);
        }
        .chat-limit-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(112,130,56,0.3); }

        .chat-input {
          display: flex; gap: 8px; padding-top: 12px;
          border-top: 1px solid var(--border-soft); align-items: flex-end;
        }
        .chat-input textarea {
          flex: 1; padding: 12px 14px;
          border: 1px solid var(--border); border-radius: 14px;
          background: var(--surface); resize: none;
          min-height: 44px; max-height: 100px;
          transition: border-color 0.15s;
          line-height: 1.5;
        }
        .chat-input textarea:focus { border-color: var(--primary); outline: none; }
        .chat-input textarea:disabled { opacity: 0.5; }

        .mic-btn, .send-btn {
          width: 44px; height: 44px; border-radius: 50%;
          border: none; cursor: pointer;
          display: grid; place-items: center;
          flex-shrink: 0;
          transition: transform 0.12s, background 0.15s, box-shadow 0.15s;
        }
        .mic-btn {
          background: var(--surface-2); color: var(--text-soft);
          border: 1px solid var(--border);
        }
        .mic-btn:hover:not(:disabled) { background: var(--muted); color: var(--primary); }
        .mic-btn:active:not(:disabled) { transform: scale(0.86); }
        .mic-btn.rec {
          background: var(--secondary); color: #fff;
          border-color: var(--secondary);
          box-shadow: 0 0 0 0 rgba(140,138,126,0.4);
          animation: breathe 1.5s ease-in-out infinite, micRing 1.5s ease-out infinite;
        }
        @keyframes micRing {
          0% { box-shadow: 0 0 0 0 rgba(140,138,126,0.35); }
          70% { box-shadow: 0 0 0 12px rgba(140,138,126,0); }
          100% { box-shadow: 0 0 0 0 rgba(140,138,126,0); }
        }
        .mic-btn.disabled { opacity: 0.35; cursor: not-allowed; }
        .mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn {
          background: var(--primary);
          color: #fff;
          box-shadow: 0 2px 8px rgba(112,130,56,0.2);
        }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 12px rgba(112,130,56,0.3); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
      `}</style>
    </section>
  );
}