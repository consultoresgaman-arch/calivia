import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Heart, Zap, Volume2, Eye, Smile, HeartHandshake } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/auth';
import { getSessionToken } from './lib/session';
import type { ChatLog } from './lib/types';
import { isCheckoutConfigured, openCheckout } from './lib/payments';
import { ensureMicPermission } from './lib/micPermission';
import { listenOnceNative, speakNative, stopNativeListening, stopNativeSpeech } from './lib/nativeSpeech';
import { useLanguage, useT, localizeBackendError, type LanguageCode } from './lib/i18n';
import strings, {
  SYSTEM_NOTE,
  QUICK_PROMPTS,
  FALLBACK_GREETINGS,
  PERSONA_INTROS,
  BURST_ACK_REPLIES,
  SOCRATIC_FOLLOWUPS,
  CLOSURE_REPLIES,
  CRISIS_FALLBACK_REPLY,
  MEANING_REPLY,
  DIAGNOSIS_REPLY,
  NO_ANSWER_REPLY,
  RISK_KEYWORDS,
  MEANING_TRIGGERS,
  DIAGNOSIS_TRIGGERS,
  GRATITUDE_TRIGGERS,
  ADVICE_TRIGGERS,
  SPEECH_LANG_TAG,
} from './AiChat.i18n';

// Nombres conocidos de voces en español cálidas/femeninas de los motores de
// alta calidad más comunes (Google, Microsoft/Edge), para preferirlas cuando
// estén disponibles. Es una heurística de nombre, no una garantía.
const WARM_VOICE_NAMES = [
  'elvira', 'helena', 'sabina', 'paulina', 'monica', 'mónica', 'lucia', 'lucía',
  'esperanza', 'conchita', 'lupe', 'dalia', 'salome', 'salomé', 'camila', 'valentina',
];

function voiceQualityScore(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;
  if (n.includes('google')) score += 4;
  if (n.includes('microsoft')) score += 4;
  if (n.includes('neural') || n.includes('natural')) score += 4;
  if (n.includes('network') || n.includes('online') || n.includes('cloud') || n.includes('plus')) score += 2;
  if (WARM_VOICE_NAMES.some((name) => n.includes(name))) score += 3;
  if (v.localService === false) score += 1;
  if (n.includes('compact') || n.includes('robot') || n.includes('espeak')) score -= 5;
  return score;
}

const VOICE_INPUT_ENABLED = true;
const NATIVE = Capacitor.isNativePlatform();

// Modos de personalidad seleccionables desde la barra de botones del chat.
// `null` = personalidad por defecto de Calivia (sin ningún botón activo).
// El modo activo viaja en cada request a supabase/functions/ai-chat, que
// decide ahí qué prompt de sistema inyectar (ver MODE_SYSTEM_PROMPTS en ese
// archivo) — el protocolo de crisis determinista sigue corriendo igual sin
// importar el modo, así que la seguridad no depende de esta elección.
type ChatMode = 'espejo' | 'amigo' | 'acompanante';

function isChatMode(value: string | null): value is ChatMode {
  return value === 'espejo' || value === 'amigo' || value === 'acompanante';
}

const MODE_OPTIONS: { id: ChatMode; Icon: typeof Eye; labelKey: 'modeEspejo' | 'modeAmigo' | 'modeAcompanante' }[] = [
  { id: 'espejo', Icon: Eye, labelKey: 'modeEspejo' },
  { id: 'amigo', Icon: Smile, labelKey: 'modeAmigo' },
  { id: 'acompanante', Icon: HeartHandshake, labelKey: 'modeAcompanante' },
];

// Columna de profiles donde vive el nombre personalizado de cada persona
// (editable desde ProfileSettingsModal) — si está vacía, se usa el nombre
// genérico del modo (Espejo/Amigo/Acompañante).
const PERSONA_NAME_FIELD: Record<ChatMode, 'persona_name_espejo' | 'persona_name_amigo' | 'persona_name_acompanante'> = {
  espejo: 'persona_name_espejo',
  amigo: 'persona_name_amigo',
  acompanante: 'persona_name_acompanante',
};

// Protocolo de espera (anti-interrupción): si el usuario sigue escribiendo
// mensajes seguidos (mientras la IA todavía está "pensando" o apenas
// terminó de responder), no lanzamos otro análisis largo — solo un acuse
// breve, local, y esperamos a que haya una pausa real antes de responder.
const FRAGMENT_QUIET_MS = 3500;

function getTimeOfDay(): 'morning' | 'afternoon' | 'night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'afternoon';
  return 'night';
}

// Mismo lexicón de riesgo del backend (supabase/functions/ai-chat/index.ts),
// para que el protocolo de crisis funcione igual de firme incluso si esta
// respuesta de respaldo local es la que termina usándose (sin conexión). Se
// revisan los tres idiomas a la vez, sin importar el idioma de la interfaz.
const ALL_RISK_KEYWORDS = [...RISK_KEYWORDS.es, ...RISK_KEYWORDS.en, ...RISK_KEYWORDS.pt];

function detectRiskKeyword(text: string): boolean {
  const normalized = text.toLowerCase();
  return ALL_RISK_KEYWORDS.some((kw) => normalized.includes(kw));
}

function generateClientFallback(message: string, conversation: ChatLog[], lang: LanguageCode): string {
  // El protocolo de crisis va primero, incluso antes del saludo de bienvenida:
  // si el primer mensaje de la persona ya es una señal de riesgo, jamás debe
  // recibir un saludo genérico en su lugar.
  if (detectRiskKeyword(message)) return CRISIS_FALLBACK_REPLY[lang];

  const userTurns = conversation.filter((m) => m.role === 'user');
  const isFirstMessage = userTurns.length === 0;

  if (isFirstMessage) return FALLBACK_GREETINGS[lang][getTimeOfDay()];

  const lower = message.toLowerCase();
  const assistantTurns = conversation.filter((m) => m.role === 'assistant');
  const lastAssistant = assistantTurns[assistantTurns.length - 1];

  const meaning = MEANING_TRIGGERS[lang];
  if (meaning.primary.some((k) => lower.includes(k)) && meaning.secondary.some((k) => lower.includes(k))) {
    return MEANING_REPLY[lang];
  }
  if (DIAGNOSIS_TRIGGERS[lang].some((k) => lower.includes(k))) {
    return DIAGNOSIS_REPLY[lang];
  }

  if (lastAssistant && (lastAssistant.content.includes('Ponme en contexto') || lastAssistant.content.includes('qué fue lo que pasó'))) {
    return SOCRATIC_FOLLOWUPS[lang][message.length % SOCRATIC_FOLLOWUPS[lang].length];
  }
  if (GRATITUDE_TRIGGERS[lang].some((k) => lower.includes(k))) {
    return CLOSURE_REPLIES[lang][message.length % CLOSURE_REPLIES[lang].length];
  }
  if (message.includes('?') && ADVICE_TRIGGERS[lang].some((k) => lower.includes(k))) {
    return NO_ANSWER_REPLY[lang];
  }

  return SOCRATIC_FOLLOWUPS[lang][message.length % SOCRATIC_FOLLOWUPS[lang].length];
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
  const { lang } = useLanguage();
  const t = useT(strings);
  const { profile, refreshProfile } = useAuth();
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
  const [ttsBlocked, setTtsBlocked] = useState(false);
  const lastReplyRef = useRef<string>('');
  const [onboarding, setOnboarding] = useState(false);
  const onboardingTriggeredRef = useRef(false);

  // Modo de personalidad activo — vive solo en sessionStorage (se guarda "en
  // la sesión", no permanentemente), separado por usuario para no filtrarse
  // entre cuentas si el navegador se comparte.
  const [mode, setMode] = useState<ChatMode | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = sessionStorage.getItem(`calivia-chat-mode-${userId}`);
      return isChatMode(stored) ? stored : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (mode) sessionStorage.setItem(`calivia-chat-mode-${userId}`, mode);
      else sessionStorage.removeItem(`calivia-chat-mode-${userId}`);
    } catch { /* ignore */ }
  }, [mode, userId]);

  // Espejo sincrónico de `mode`, para que el bucle de modo voz (que puede
  // seguir vivo a través de varios renders — ver runVoiceTurn más abajo)
  // etiquete cada mensaje con la persona realmente activa en ese instante,
  // no con la que estaba activa cuando arrancó la escucha.
  const modeRef = useRef<ChatMode | null>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const bottomRef = useRef<HTMLDivElement>(null);
  // Evita animar el scroll la primera vez que se pinta un hilo (carga
  // inicial o cambio de modo) — ahí queremos aparecer YA abajo del todo, no
  // deslizarnos visiblemente por decenas de mensajes viejos. Se reactiva
  // (vuelve a `false`) cada vez que cambia `mode`, para que el hilo nuevo
  // también abra directo al final en vez de heredar el "ya se animó una vez"
  // de otro hilo distinto.
  const hasAutoScrolledRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fragmentTimerRef = useRef<number | null>(null);
  const ackIndexRef = useRef(0);
  // Texto (y modo voz) que está esperando el protocolo de espera de arriba —
  // si la app se va a segundo plano o se cierra mientras se espera esa pausa,
  // lo disparamos de inmediato en vez de esperar los 3.5s completos, para no
  // dejar un mensaje del usuario (ya guardado) sin que Calivia llegue siquiera
  // a intentar responderlo.
  const pendingFragmentRef = useRef<{ text: string; isVoice: boolean } | null>(null);
  // Modo voz: conversación continua por micrófono. Mientras está activo, cada
  // vez que la persona termina de hablar el mensaje se manda solo (sin tocar
  // enviar) y, apenas Calivia termina de responder en voz, se vuelve a
  // escuchar — hasta que se toca el botón de nuevo para apagarlo. `voiceModeRef`
  // es la fuente de verdad sincrónica que lee el bucle async (runVoiceTurn);
  // `voiceModeActive` es solo para reflejarlo en la UI.
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const voiceModeRef = useRef(false);
  // Espejo sincrónico de `limitReached` (prop derivada) para que el bucle de
  // modo voz, que puede seguir vivo a través de varios renders, siempre lea
  // el valor más reciente en vez de quedarse con el de cuando arrancó.
  const limitReachedRef = useRef(false);
  // Ref sincrónico (no el estado `sending`, que puede quedar un instante
  // desactualizado por el renderizado de React) para saber sin ambigüedad
  // si ya hay una cadena de mensajes en curso — así dos mensajes mandados
  // casi al mismo tiempo nunca disparan dos llamadas a la IA en paralelo.
  const chainActiveRef = useRef(false);

  const limitReached = messagesSent >= maxFree;
  useEffect(() => { limitReachedRef.current = limitReached; }, [limitReached]);

  useEffect(() => {
    // En build nativa siempre hay una vía de reconocimiento (el plugin nativo, ver
    // lib/nativeSpeech.ts), aunque el WebView no traiga la Web Speech API del navegador (que
    // además, aunque exista como objeto global ahí, no tiene motor real detrás — ver
    // runVoiceTurnWeb más abajo).
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!NATIVE && !SR) setVoiceSupported(false);

    // En build nativa la respuesta hablada sale por el plugin nativo (ver speakResponse más
    // abajo), no por window.speechSynthesis (que tampoco tiene motor real detrás del WebView
    // embebido — mismo problema que el reconocimiento). El selector de voz de acá es
    // específico de las voces del navegador, así que en nativo no tiene nada que cargar.
    if (NATIVE) {
      setVoicesLoading(false);
      return;
    }

    const synthAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (!synthAvailable) {
      setVoicesLoading(false);
      return;
    }

    let settled = false;
    hasSelectedVoiceRef.current = false;

    function loadVoices() {
      try {
        const allVoices = window.speechSynthesis.getVoices();
        if (allVoices.length === 0) return;

        const langVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith(lang));
        const pool = langVoices.length > 0 ? langVoices : allVoices;
        const highQuality = pool.filter((v) => voiceQualityScore(v) > 0);
        const usable = (highQuality.length > 0 ? highQuality : pool)
          .slice()
          .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));
        setVoices(usable);
        if (!hasSelectedVoiceRef.current) {
          hasSelectedVoiceRef.current = true;
          // Para español, preferimos un acento latinoamericano neutro sobre el ibérico
          // "es-ES" — mexicano primero, luego colombiano, luego el código genérico "es-419"
          // (Latinoamérica y el Caribe).
          const preferred = (lang === 'es'
            ? usable.find((v) => v.lang.toLowerCase().includes('mx'))
              || usable.find((v) => v.lang.toLowerCase().includes('co'))
              || usable.find((v) => v.lang.toLowerCase().includes('419'))
            : undefined) || usable[0];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Devuelve una promesa que resuelve cuando termina de hablar (o falla/se
  // bloquea) — el modo voz la espera antes de volver a escuchar, así nunca
  // se superpone con la respuesta que Calivia todavía está leyendo.
  function speakResponse(text: string): Promise<void> {
    lastReplyRef.current = text;

    if (NATIVE) {
      return speakNative(text, SPEECH_LANG_TAG[lang]).catch((err) => {
        console.error('[Calivia] speakResponse (nativo) falló:', err);
      });
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        let chosenVoice: SpeechSynthesisVoice | undefined;
        if (voices.length > 0 && selectedVoiceUri) {
          chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceUri);
          if (chosenVoice) utterance.voice = chosenVoice;
        }
        utterance.lang = chosenVoice?.lang || SPEECH_LANG_TAG[lang];
        utterance.rate = 0.95;
        utterance.pitch = 1;

        // Algunos navegadores bloquean la reproducción automática de audio por
        // políticas de seguridad si no hay un gesto directo del usuario en ese
        // instante. Si el motor nunca llega a "empezar" a hablar, lo tratamos
        // como bloqueado y mostramos un botón para activarlo con un toque.
        let started = false;
        let settled = false;
        const finish = () => { if (!settled) { settled = true; resolve(); } };

        utterance.onstart = () => { started = true; setTtsBlocked(false); };
        utterance.onerror = (e) => {
          console.error('[Calivia] speechSynthesis onerror:', (e as any).error);
          if (!started) setTtsBlocked(true);
          finish();
        };
        utterance.onend = () => finish();
        window.speechSynthesis.speak(utterance);
        window.setTimeout(() => {
          if (!started && window.speechSynthesis.speaking === false) {
            setTtsBlocked(true);
            finish();
          }
        }, 600);
      } catch (err) {
        console.error('[Calivia] speakResponse falló:', err);
        setTtsBlocked(true);
        resolve();
      }
    });
  }

  function replayLastResponse() {
    if (lastReplyRef.current) void speakResponse(lastReplyRef.current);
  }

  useEffect(() => () => {
    if (fragmentTimerRef.current) clearTimeout(fragmentTimerRef.current);
  }, []);

  // Si este componente se desmonta (p. ej. la persona cambia de pestaña
  // dentro de la app) con el modo voz activo, hay que apagarlo — si no, el
  // bucle de escucha seguiría vivo de fondo, llamando a setState sobre un
  // componente que ya no está montado.
  useEffect(() => () => {
    stopVoiceMode();
  }, []);

  // Si la app pasa a segundo plano (o se cierra) mientras el protocolo de
  // espera todavía está contando los FRAGMENT_QUIET_MS antes de llamar a
  // Calivia, disparamos esa llamada de inmediato en vez de esperar el resto
  // del plazo — así el pedido a la función ya queda en curso del lado del
  // servidor (que guarda la respuesta en Supabase apenas la genera,
  // independientemente de si el navegador sigue conectado) en vez de
  // perderse por completo si el proceso muere antes de que se cumpla la espera.
  useEffect(() => {
    function flushPendingFragment() {
      if (!fragmentTimerRef.current || !pendingFragmentRef.current) return;
      clearTimeout(fragmentTimerRef.current);
      fragmentTimerRef.current = null;
      const { text, isVoice } = pendingFragmentRef.current;
      pendingFragmentRef.current = null;
      ackIndexRef.current = 0;
      void callAssistant(text, isVoice).finally(() => {
        chainActiveRef.current = false;
      });
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flushPendingFragment();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushPendingFragment);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushPendingFragment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setUsingFallback(false);
    hasAutoScrolledRef.current = false;
    (async () => {
      // Igual que el bug ya corregido en supabase/functions/ai-chat/index.ts:
      // 'ascending: true' + 'limit' trae las N filas MÁS ANTIGUAS de toda la
      // conversación, no las más recientes. Pasadas las primeras 100 réplicas
      // de una cuenta, reabrir la app mostraba solo el arranque de la
      // conversación y "perdía" todo lo reciente, incluido lo último escrito
      // — el historial seguía en Supabase, pero la pantalla nunca llegaba a
      // pedirlo. El fix: pedir las más recientes en orden descendente y
      // reordenarlas a cronológico antes de mostrarlas.
      // Cada modo de personalidad tiene su propio hilo (chat_logs.mode) — al
      // cambiar de modo se recarga acá con el filtro correcto, así que la
      // conversación visible "se resetea" a la de esa persona, no a la de otra.
      let query = supabase
        .from('chat_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      query = mode ? query.eq('mode', mode) : query.is('mode', null);
      const { data, error } = await query;
      if (!mounted) return;
      if (error) setError(localizeBackendError(error.message, lang));
      else setMessages((data ?? []).slice().reverse());
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId, mode]);

  // Saludo obligatorio de bienvenida: si el chat está totalmente vacío (usuario
  // nuevo, sin ningún chat_log todavía), Calivia se presenta y pregunta nombre
  // y ocupación sin esperar a que la persona escriba primero. El backend
  // (supabase/functions/ai-chat, flujo `init`) decide si de verdad corresponde
  // saludar (chat vacío + sin preferred_name) — este disparo es best-effort y
  // se protege con un ref para no repetirse dentro del mismo montaje.
  useEffect(() => {
    if (loading || messages.length > 0 || onboardingTriggeredRef.current) return;
    onboardingTriggeredRef.current = true;
    let cancelled = false;
    setOnboarding(true);
    (async () => {
      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'x-session-token': getSessionToken() ?? '',
          },
          body: JSON.stringify({ userId, message: '', lang, init: true }),
        });
        if (!cancelled && res.ok) {
          const json = await res.json();
          if (json.reply) {
            setMessages((m) => (m.length === 0
              ? [{ id: `onb-${Date.now()}`, user_id: userId, role: 'assistant', content: json.reply, created_at: new Date().toISOString() }]
              : m));
          }
        }
      } catch (err) {
        console.error('[Calivia] saludo de bienvenida (init) falló:', err);
      } finally {
        if (!cancelled) setOnboarding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, messages.length, userId, lang]);

  // scrollIntoView (en vez de calcular scrollHeight de un contenedor puntual)
  // porque el que de verdad scrollea acá es la página completa, no
  // necesariamente el div del chat — así funciona sin importar cuál de los
  // ancestros sea el que tiene el overflow real.
  useEffect(() => {
    if (loading) return;
    const behavior = hasAutoScrolledRef.current ? 'smooth' : 'auto';
    hasAutoScrolledRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, [messages, sending, loading]);

  function stopRecognition() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setRecording(false);
  }

  // Apaga el modo voz por completo: corta cualquier escucha o habla en curso
  // (nativa o web) y deja de programar el siguiente turno. Es la única forma
  // de salir — se dispara al tocar el mic de nuevo, o si algo falla en serio.
  function stopVoiceMode() {
    voiceModeRef.current = false;
    setVoiceModeActive(false);
    stopRecognition();
    if (NATIVE) {
      void stopNativeListening();
      void stopNativeSpeech();
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }

  // Botón de mic: alterna el modo voz completo (conversación continua), no
  // una sola grabación. Prendido, sigue escuchando → mandando → escuchando
  // hasta que se lo apague con el mismo botón.
  async function toggleVoiceMode() {
    if (!voiceSupported) return;
    if (voiceModeRef.current) {
      stopVoiceMode();
      return;
    }
    if (limitReachedRef.current) return;
    setError(null);
    voiceModeRef.current = true;
    setVoiceModeActive(true);
    await runVoiceTurn();
  }

  // Un "turno": escucha una vez y, si salió algo, lo manda. Si el modo voz
  // sigue activo al terminar, se vuelve a llamar a sí misma — cada llamada
  // recursiva queda detrás de un `await`, así que no acumula stack aunque la
  // conversación dure muchos turnos.
  async function runVoiceTurn(): Promise<void> {
    if (!voiceModeRef.current) return;
    if (limitReachedRef.current) {
      stopVoiceMode();
      return;
    }
    if (NATIVE) {
      await runVoiceTurnNative();
    } else {
      await runVoiceTurnWeb();
    }
    if (voiceModeRef.current) {
      await runVoiceTurn();
    }
  }

  // Build nativa: el SpeechRecognizer real de Android, vía plugin (ver lib/nativeSpeech.ts) —
  // el WebView embebido no tiene motor real detrás de la Web Speech API del navegador (esa sí
  // sirve para pruebas de escritorio en Chrome/Edge, ver runVoiceTurnWeb).
  async function runVoiceTurnNative(): Promise<void> {
    setRecording(true);
    let transcript: string | null = null;
    try {
      transcript = await listenOnceNative(SPEECH_LANG_TAG[lang]);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'speech-recognition-empty') {
        // Silencio: no es un error real, solo no hubo nada que mandar — sigue escuchando.
        transcript = '';
      } else {
        console.error('[Calivia] runVoiceTurnNative falló:', err);
        if (code === 'speech-recognition-permission-denied') setError(t('errMicPermission'));
        else if (code === 'speech-recognition-unavailable') setError(t('errNoVoiceSupport'));
        else setError(t('errTranscribeFailed'));
        transcript = null;
      }
    } finally {
      setRecording(false);
    }

    if (transcript === null) {
      stopVoiceMode();
      return;
    }
    if (!voiceModeRef.current) return;
    const text = transcript.trim();
    if (text) {
      setInput(text);
      await send(null, text, true);
    }
  }

  async function runVoiceTurnWeb(): Promise<void> {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition as SpeechRecognitionConstructor;
    if (!SR) {
      console.error('[Calivia] runVoiceTurnWeb: SpeechRecognition no está disponible en este navegador.');
      setError(t('errNoVoiceSupport'));
      stopVoiceMode();
      return;
    }

    let micGranted = false;
    try {
      micGranted = await ensureMicPermission();
    } catch (err) {
      console.error('[Calivia] ensureMicPermission falló:', err);
    }
    if (!micGranted) {
      setError(t('errMicPermission'));
      stopVoiceMode();
      return;
    }
    if (!voiceModeRef.current) return;

    // null = error duro (hay que apagar el modo voz); string (posiblemente
    // vacío) = lo transcrito, incluso si no se dijo nada por silencio.
    const transcript = await new Promise<string | null>((resolve) => {
      try {
        const recognition = new SR();
        recognition.lang = SPEECH_LANG_TAG[lang];
        recognition.continuous = false;
        recognition.interimResults = true;

        let finalTranscript = '';
        let hardError = false;

        // Puente nativo de audio: en algunos dispositivos Android el motor de
        // reconocimiento se queda "escuchando" en silencio para siempre sin
        // disparar ni onresult ni onerror ni onend (p. ej. si el servicio de
        // reconocimiento del sistema no responde). Sin este vigía, el botón
        // quedaría atrapado indefinidamente en el estado de grabación.
        const watchdog = window.setTimeout(() => {
          console.error('[Calivia] SpeechRecognition no dio señales de vida a tiempo; forzando detención.');
          try { recognition.stop(); } catch { /* ignore */ }
          setError(t('errMicNoResponse'));
          hardError = true;
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
              const transcriptPart = result[0].transcript;
              if (i === e.results.length - 1 && typeof (result as any).isFinal === 'boolean' && (result as any).isFinal) {
                finalTranscript += transcriptPart;
              } else {
                interim += transcriptPart;
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
            setError(t('errMicNotAllowed'));
            hardError = true;
          } else if (errEvent.error !== 'no-speech' && errEvent.error !== 'aborted') {
            setError(t('errTranscribeFailed'));
            hardError = true;
          }
          setRecording(false);
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          window.clearTimeout(watchdog);
          setRecording(false);
          recognitionRef.current = null;
          resolve(hardError ? null : finalTranscript);
        };

        recognitionRef.current = recognition;
        setRecording(true);
        setError(null);
        recognition.start();
      } catch (err) {
        console.error('[Calivia] runVoiceTurnWeb falló inesperadamente:', err);
        setError(t('errVoiceInputFailed'));
        setRecording(false);
        recognitionRef.current = null;
        resolve(null);
      }
    });

    if (transcript === null) {
      stopVoiceMode();
      return;
    }
    if (!voiceModeRef.current) return;
    const text = transcript.trim();
    if (text) {
      await send(null, text, true);
    }
  }

  async function send(e: React.FormEvent | null, overrideText?: string, isVoice: boolean = false) {
    e?.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || limitReached) return;
    // Si la persona escribe o toca enviar/un chip a mano mientras el modo voz
    // está prendido, eso es una intervención manual: apaga el modo voz en vez
    // de dejarlo corriendo en paralelo (evita una posible doble escucha/envío).
    // El propio bucle de voz es el único que llama a send() con isVoice=true.
    if (voiceModeRef.current && !isVoice) {
      stopVoiceMode();
    }
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

    const sendMode = modeRef.current;
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: tempId, user_id: userId, role: 'user', content: text, created_at: now, mode: sendMode }]);

    let saved: ChatLog;
    try {
      const { data, error: insErr } = await supabase
        .from('chat_logs')
        .insert({ user_id: userId, role: 'user', content: text, mode: sendMode })
        .select()
        .single();
      if (insErr) throw insErr;
      saved = data;
      setMessages((m) => m.map((x) => (x.id === tempId ? saved : x)));
      onMessageSent();
    } catch (err) {
      setError(err instanceof Error ? localizeBackendError(err.message, lang) : t('errUnexpected'));
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
      const ack = BURST_ACK_REPLIES[lang][ackIndexRef.current % BURST_ACK_REPLIES[lang].length];
      ackIndexRef.current++;
      setMessages((m) => [...m, { id: `ack-${Date.now()}`, user_id: userId, role: 'assistant', content: ack, created_at: new Date().toISOString() }]);
      pendingFragmentRef.current = { text, isVoice };
      fragmentTimerRef.current = window.setTimeout(async () => {
        fragmentTimerRef.current = null;
        pendingFragmentRef.current = null;
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
          'x-session-token': getSessionToken() ?? '',
        },
        body: JSON.stringify({ userId, message: text, localTime, lang, mode: modeRef.current }),
      });

      let reply: string = '';
      let isFallback = false;

      if (res.ok) {
        const json = await res.json();
        reply = json.reply ?? json.message ?? '';
        if (!reply) throw new Error(t('errEmptyReply'));
        isFallback = !!json.fallback;
      } else if (res.status >= 500) {
        reply = generateClientFallback(text, messages, lang);
        isFallback = true;
      } else {
        const txt = await res.text().catch(() => '');
        throw new Error(t('errAssistantNoResponse', { status: res.status, detail: txt.slice(0, 120) }));
      }

      setUsingFallback(isFallback);
      const assistantLog: ChatLog = { id: `a-${Date.now()}`, user_id: userId, role: 'assistant', content: reply, created_at: new Date().toISOString() };
      setMessages((m) => [...m, assistantLog]);

      // El flujo de perfilado (ver ai-chat/index.ts) puede haber guardado
      // preferred_name/occupation en este intercambio — pero el `profile` de
      // AuthContext solo se actualiza llamando a esto explícitamente. Sin
      // este refresh, ese `profile` local se queda desactualizado (piensa
      // que preferred_name sigue vacío) hasta que algo más lo refresque —
      // y si la persona abre "Editar perfil" mientras tanto y guarda
      // cualquier cosa, ese formulario reescribe preferred_name/occupation
      // desde su copia local vieja, BORRANDO el nombre que ya se había
      // guardado. Solo hace falta mientras el nombre siga sin capturarse;
      // una vez capturado, esta condición deja de cumplirse sola.
      if (!profile?.preferred_name) {
        void refreshProfile();
      }

      if (isVoice) {
        // El modo voz espera a que termine de hablar antes de volver a
        // escuchar (ver runVoiceTurn) — por eso se espera acá también.
        await speakResponse(reply);
      }
    } catch (err) {
      const msg = err instanceof Error ? localizeBackendError(err.message, lang) : t('errUnexpected');
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  // Cambiar de persona a mitad de una escucha/respuesta hablada sería
  // confuso (¿quién te está respondiendo, la de antes o la nueva?) — cortar
  // el modo voz acá hace que el cambio de botón sea un punto limpio de corte.
  function handleModeClick(id: ChatMode) {
    if (voiceModeRef.current) stopVoiceMode();
    setMode((m) => (m === id ? null : id));
  }

  function personaLabel(id: ChatMode, labelKey: 'modeEspejo' | 'modeAmigo' | 'modeAcompanante'): string {
    const custom = profile?.[PERSONA_NAME_FIELD[id]]?.trim();
    return custom || t(labelKey);
  }

  return (
    <section className="chat-card">
      <div className="chat-head">
        <div className="chat-icon">
          <Heart size={18} strokeWidth={2} />
        </div>
        <div className="chat-head-info">
          <h2>{mode ? personaLabel(mode, MODE_OPTIONS.find((o) => o.id === mode)!.labelKey) : 'Calivia'}</h2>
          <p>{mode ? t('chattingWithPersona') : SYSTEM_NOTE[lang]}</p>
        </div>
      </div>

      {(voicesLoading || voices.length > 0) && (
      <div className="voice-selector-bar">
        <label htmlFor="voice-select">
          <Volume2 size={14} /> {t('voiceLabel')}
        </label>
        <select
          id="voice-select"
          value={selectedVoiceUri}
          onChange={(e) => setSelectedVoiceUri(e.target.value)}
          aria-label={t('voiceSelectAria')}
          disabled={voicesLoading}
        >
          {voices.length > 0 ? (
            voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))
          ) : (
            <option value="">{t('searchingVoices')}</option>
          )}
        </select>
      </div>
      )}

      <div className="chat-body">
        {loading || onboarding ? (
          <div className="chat-empty">{t('loadingSpace')}</div>
        ) : messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              {mode ? (
                (() => { const { Icon } = MODE_OPTIONS.find((o) => o.id === mode)!; return <Icon size={24} strokeWidth={1.5} />; })()
              ) : (
                <Heart size={24} strokeWidth={1.5} />
              )}
            </div>
            <p>{mode ? PERSONA_INTROS[mode][lang] : FALLBACK_GREETINGS[lang][getTimeOfDay()]}</p>
            <p className="chat-welcome-sub">{t('welcomeSub')}</p>
            <div className="quick-prompts">
              {QUICK_PROMPTS[lang].map((q) => (
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
        <div ref={bottomRef} />
      </div>


      {usingFallback && !sending && (
        <div className="chat-fallback-note">
          {t('fallbackNote')}
        </div>
      )}
      {ttsBlocked && (
        <button type="button" className="tts-blocked-note" onClick={replayLastResponse}>
          <Volume2 size={14} strokeWidth={2} /><span>{t('ttsBlockedNote')}</span>
        </button>
      )}
      {error && <div className="chat-error">{error}</div>}
      {limitReached && !sending && (
        <div className="chat-limit">
          <p>{t('limitReached')}</p>
          {isCheckoutConfigured() ? (
            <button
              className="chat-limit-cta"
              type="button"
              onClick={() => openCheckout({ userId, name })}
            >
              <Zap size={14} strokeWidth={2.5} /><span>{t('unlockUnlimited')}</span>
            </button>
          ) : (
            <p className="chat-limit-sub">{t('exploreUnlimited')}</p>
          )}
        </div>
      )}

      <div className="mode-selector-bar" role="group" aria-label={t('modeSelectorAria')}>
        {MODE_OPTIONS.map(({ id, Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            className={`mode-btn ${mode === id ? 'active' : ''}`}
            onClick={() => handleModeClick(id)}
            disabled={limitReached || onboarding}
            aria-pressed={mode === id}
          >
            <Icon size={14} strokeWidth={2} />
            <span>{personaLabel(id, labelKey)}</span>
          </button>
        ))}
      </div>

      <form className="chat-input" onSubmit={(e) => send(e)}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            limitReached ? t('inputPlaceholderLimit')
              : recording ? t('inputPlaceholderListening')
              : voiceModeActive ? t('inputPlaceholderVoiceMode')
              : t('inputPlaceholderDefault')
          }
          disabled={limitReached || onboarding}
          aria-label={t('inputAria')}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
          }}
        />
        {VOICE_INPUT_ENABLED && (
          <button
            type="button"
            className={`mic-btn ${voiceModeActive ? 'voice-active' : ''} ${recording ? 'rec' : ''} ${!voiceSupported ? 'disabled' : ''}`}
            onClick={toggleVoiceMode}
            disabled={limitReached || !voiceSupported || onboarding}
            aria-pressed={voiceModeActive}
            aria-label={voiceModeActive ? t('stopRecording') : t('speakToMic')}
            title={voiceSupported ? t('micTitleSupported') : t('micTitleUnsupported')}
          >
            <Mic size={18} strokeWidth={2} />
          </button>
        )}
        <button type="submit" className="send-btn" disabled={!input.trim() || limitReached || onboarding}>
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
        .tts-blocked-note {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; margin: 8px 0; padding: 9px 12px;
          background: rgba(112,130,56,0.08); color: var(--primary);
          border: 1px dashed var(--primary-200); border-radius: var(--radius-xs);
          font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .tts-blocked-note:hover { background: rgba(112,130,56,0.14); }
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

        .mode-selector-bar {
          display: flex; gap: 6px; padding-top: 10px;
          border-top: 1px solid var(--border-soft);
        }
        .mode-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-soft);
          font-size: 12.5px; font-weight: 600; cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        .mode-btn:hover:not(:disabled) { border-color: var(--primary-200); color: var(--primary-600); background: rgba(112,130,56,0.06); }
        .mode-btn.active {
          background: var(--primary); color: #fff; border-color: var(--primary);
          box-shadow: 0 2px 8px rgba(112,130,56,0.25);
        }
        .mode-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .chat-input {
          display: flex; gap: 8px; padding-top: 12px;
          align-items: flex-end;
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
        .mic-btn.voice-active {
          background: var(--primary); color: #fff;
          border-color: var(--primary);
        }
        .mic-btn.rec {
          background: var(--primary); color: #fff;
          border-color: var(--primary);
          box-shadow: 0 0 0 0 rgba(112,130,56,0.4);
          animation: breathe 1.5s ease-in-out infinite, micRing 1.5s ease-out infinite;
        }
        @keyframes micRing {
          0% { box-shadow: 0 0 0 0 rgba(112,130,56,0.35); }
          70% { box-shadow: 0 0 0 12px rgba(112,130,56,0); }
          100% { box-shadow: 0 0 0 0 rgba(112,130,56,0); }
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