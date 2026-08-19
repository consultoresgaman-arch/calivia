import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// El WebView embebido de una app Android (a diferencia de Chrome como navegador
// independiente) NO trae un motor real detrás de la Web Speech API del navegador
// (window.SpeechRecognition / webkitSpeechRecognition): la llamada a .start() nunca dispara
// resultado, error ni fin — se queda "escuchando" para siempre en silencio. Por eso en build
// nativa usamos este plugin (@capacitor-community/speech-recognition), que envuelve el
// SpeechRecognizer real de Android, en vez de la API del navegador (que sí sirve para
// pruebas en Chrome/Edge de escritorio, ver micPermission.ts).

export async function ensureNativeSpeechPermission(): Promise<boolean> {
  const status = await SpeechRecognition.checkPermissions();
  if (status.speechRecognition === 'granted') return true;
  const requested = await SpeechRecognition.requestPermissions();
  return requested.speechRecognition === 'granted';
}

// Escucha una sola vez y resuelve con la transcripción final (el propio SpeechRecognizer de
// Android corta la escucha solo, al detectar silencio tras hablar — no hace falta manejar
// nosotros el corte). Lanza un Error con un código corto y estable en el `message` para que
// el llamador elija el texto de error correcto sin acoplarse a mensajes específicos del plugin.
export async function listenOnceNative(langTag: string): Promise<string> {
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('speech-recognition-unavailable');

  const granted = await ensureNativeSpeechPermission();
  if (!granted) throw new Error('speech-recognition-permission-denied');

  try {
    const { matches } = await SpeechRecognition.start({
      language: langTag,
      maxResults: 1,
      popup: false,
      partialResults: false,
    });
    const transcript = matches?.[0]?.trim();
    if (!transcript) throw new Error('speech-recognition-empty');
    return transcript;
  } catch (err) {
    // El plugin rechaza con uno de estos mensajes exactos, uno por cada código de error de
    // Android SpeechRecognizer (ver getErrorText() en su lado nativo) — los traducimos a
    // nuestro propio vocabulario estable para que quien llama no dependa de esos strings.
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'speech-recognition-empty') throw err;
    if (msg === 'No match' || msg === 'No speech input') throw new Error('speech-recognition-empty');
    if (msg === 'Insufficient permissions') throw new Error('speech-recognition-permission-denied');
    throw new Error('speech-recognition-failed');
  }
}

// Mismo problema, del lado de la respuesta hablada: window.speechSynthesis tampoco tiene un
// motor de verdad detrás dentro del WebView embebido — utterance.speak() no truena, pero
// tampoco suena nada. Por eso en build nativa usamos este otro plugin
// (@capacitor-community/text-to-speech), que envuelve el TextToSpeech real de Android.
//
// Muchos dispositivos (verificado en pruebas reales) NO traen ninguna voz "es-MX" ni "es-CO"
// instalada — solo "es-ES" (España) y "es-US" ("español Estados Unidos", el acento más
// parecido a un latino neutro que Google TTS ofrece de fábrica en la mayoría de equipos). Por
// eso "us" entra como respaldo real dentro de la lista de prioridad, no solo mx/co explícitos.
const SPANISH_REGION_PRIORITY = ['mx', 'co', '419', 'us'];

interface NativeVoiceLike {
  lang: string;
  localService: boolean;
}

// Puntúa cada voz candidata por dos cosas — cuál pesa más que cuál importa: (1) qué tan cerca
// está su región del acento latino pedido (ver SPANISH_REGION_PRIORITY), y (2) su calidad: en
// Google TTS, las voces "de red" (localService: false, sufijo "-network") son las sintetizadas
// en la nube — mucho más naturales y con mejor pronunciación que las locales/heredadas
// ("-local", o la variante vieja sin sufijo tipo "es-ES-language"), que suenan robóticas y a
// veces comen sonidos (ver el caso real: "llamada" sonando como "lamada").
function scoreNativeVoice(voice: NativeVoiceLike, short: string): number {
  let regionScore = 0;
  if (short === 'es') {
    const langLower = voice.lang.toLowerCase();
    const rank = SPANISH_REGION_PRIORITY.findIndex((r) => langLower.includes(r));
    if (rank >= 0) regionScore = (SPANISH_REGION_PRIORITY.length - rank) * 10;
  }
  const qualityScore = voice.localService === false ? 4 : 0;
  return regionScore + qualityScore;
}

// Busca, dentro de la lista que devuelve el propio plugin, el índice de la mejor voz para el
// idioma pedido. Se le pasa el ÍNDICE a `speak()`, no la voz en sí.
function pickNativeVoiceIndex(voices: NativeVoiceLike[], langTag: string): number | undefined {
  const short = langTag.slice(0, 2).toLowerCase();
  const withIndex = voices.map((voice, index) => ({ voice, index }));
  const langMatch = withIndex.filter(({ voice }) => voice.lang.toLowerCase().startsWith(short));
  const pool = langMatch.length > 0 ? langMatch : withIndex;
  if (pool.length === 0) return undefined;

  return pool.slice().sort((a, b) => scoreNativeVoice(b.voice, short) - scoreNativeVoice(a.voice, short))[0].index;
}

export async function speakNative(text: string, langTag: string): Promise<void> {
  let voiceIndex: number | undefined;
  try {
    const { voices } = await TextToSpeech.getSupportedVoices();
    voiceIndex = pickNativeVoiceIndex(voices, langTag);
  } catch (err) {
    console.error('[Calivia] speakNative: no se pudo obtener la lista de voces, sigo con la voz por defecto:', err);
  }
  await TextToSpeech.speak({ text, lang: langTag, rate: 0.95, voice: voiceIndex });
}
