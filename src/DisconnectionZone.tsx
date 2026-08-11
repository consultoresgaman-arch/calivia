import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import { X, Volume2, VolumeX, Circle, Leaf, CloudRain, Lock, Sparkles, Mountain, Scale } from 'lucide-react';
import { openCheckout } from './lib/payments';

interface Props {
  open: boolean;
  onClose: () => void;
  isPremium: boolean;
  userId: string;
  name?: string | null;
}

type GameId = 'spheres' | 'trace' | 'raindrop' | 'particles' | 'ascent' | 'balance';

interface Sphere {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  matched: boolean;
  spawning: boolean;
}

interface Drop {
  id: number;
  x: number;
  y: number;
  speed: number;
  popped: boolean;
  noteIndex: number;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  age: number;
}

interface TracePoint {
  x: number;
  y: number;
  age: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  hue: number;
  age: number;
}

interface StoryChoice {
  label: string;
  tag: string;
  reply: string;
}

interface StoryStep {
  prompt: string;
  choices: StoryChoice[];
}

interface StoryEnding {
  title: string;
  body: string;
}

// "El Ascenso" (La Travesía de la Vida): cuatro obstáculos cotidianos, cada
// uno con dos formas igual de válidas de seguir adelante (seguir con
// constancia o tomarse una pausa). Ninguna elección es un error ni corta el
// camino — todas llevan a la cima, solo que por rutas distintas.
const ASCENT_STEPS: StoryStep[] = [
  {
    prompt: 'El camino empieza empinado. Ni siquiera has dado el primer paso y ya sientes el peso de la subida.',
    choices: [
      { label: 'Doy el primer paso, aunque sea lento', tag: 'constancia', reply: 'Avanzas despacio, pero avanzas. El camino empieza a moverse contigo.' },
      { label: 'Me quedo un momento mirando la cima', tag: 'pausa', reply: 'Te tomas un segundo para mirar hacia arriba. No es rendirte, es tomar aire antes de empezar.' },
    ],
  },
  {
    prompt: 'A mitad de camino, una duda te alcanza: "¿y si esto no vale la pena?".',
    choices: [
      { label: 'Sigo caminando con la duda a cuestas', tag: 'constancia', reply: 'La duda no desaparece, pero tampoco te detiene. Caminas con ella, no contra ella.' },
      { label: 'Me siento un rato a dejar que la duda hable', tag: 'pausa', reply: 'Te sientas junto a la duda un momento. A veces escucharla es lo que la hace más pequeña.' },
    ],
  },
  {
    prompt: 'Las piernas pesan. El cansancio ya no es una idea, es real.',
    choices: [
      { label: 'Aprieto el paso un poco más', tag: 'constancia', reply: 'El cuerpo protesta, pero responde. Un paso, y otro, y otro.' },
      { label: 'Bajo el ritmo, sin dejar de moverme', tag: 'pausa', reply: 'Bajas el ritmo sin detenerte del todo. El cansancio deja de ser un enemigo y pasa a ser solo parte del camino.' },
    ],
  },
  {
    prompt: 'Ves la cima, más cerca que nunca, justo cuando menos fuerza sientes tener.',
    choices: [
      { label: 'Uso lo poco que me queda para llegar', tag: 'constancia', reply: 'Con lo último que te queda, das los pasos finales.' },
      { label: 'Respiro hondo antes del último tramo', tag: 'pausa', reply: 'Una última respiración, profunda, antes del tramo final.' },
    ],
  },
];

function buildAscentEnding(picks: string[]): StoryEnding {
  const pausas = picks.filter((p) => p === 'pausa').length;
  const constancia = picks.filter((p) => p === 'constancia').length;
  let body: string;
  if (pausas > constancia) {
    body = 'Llegaste tomándote tu tiempo, respirando cuando lo necesitabas. Aquí arriba se ve claro: no hizo falta correr, solo no soltarte del camino.';
  } else if (constancia > pausas) {
    body = 'Llegaste a puro paso firme, casi sin detenerte. Aquí arriba se siente el esfuerzo en cada músculo — y también la certeza de que sí pudiste.';
  } else {
    body = 'Llegaste combinando fuerza y pausa, avanzando y descansando cuando tocaba. Las dos cosas te trajeron hasta aquí.';
  }
  return {
    title: 'Llegaste arriba.',
    body: `${body} El camino no fue igual al de nadie más, pero el esfuerzo constante — a tu manera — fue lo que te sostuvo hasta el final.`,
  };
}

// "El Equilibrio Interior" (El Desafío de las Decisiones Clave): un dilema
// personal resuelto en tres momentos, alternando entre mirar hacia adentro
// (reflexión) y confiar en lo que ya se sabe de uno mismo (instinto).
const BALANCE_STEPS: StoryStep[] = [
  {
    prompt: 'Tienes en la cabeza una decisión importante pendiente, y sientes la presión de resolverla ya.',
    choices: [
      { label: 'Analizo cada opción con calma', tag: 'reflexion', reply: 'Te tomas el tiempo de mirar la decisión desde varios ángulos, sin apurarte a cerrar el tema.' },
      { label: 'Sigo lo que mi instinto ya me dice', tag: 'instinto', reply: 'Confías en esa primera respuesta que ya tenías, la que apareció antes de pensar demasiado.' },
    ],
  },
  {
    prompt: 'Notas que parte de la presión no viene de la decisión en sí, sino de lo que otros podrían pensar de tu elección.',
    choices: [
      { label: 'Me pregunto qué es lo que yo realmente quiero', tag: 'reflexion', reply: 'Apartas por un momento las voces externas y te haces la pregunta que importa: ¿qué quieres tú?' },
      { label: 'Reconozco esa presión y decido igual', tag: 'instinto', reply: 'Ves la presión con claridad, la nombras, y decides sin dejar que sea ella quien elija por ti.' },
    ],
  },
  {
    prompt: 'Llega el momento de decidir. Ya no hay más información nueva que esperar.',
    choices: [
      { label: 'Elijo la opción que más se alinea con lo que soy', tag: 'reflexion', reply: 'Eliges desde quién eres, no desde el miedo a equivocarte.' },
      { label: 'Elijo y confío en poder ajustar el rumbo después', tag: 'instinto', reply: 'Eliges sabiendo que ninguna decisión es definitiva del todo — siempre se puede ajustar el rumbo.' },
    ],
  },
];

function buildBalanceEnding(picks: string[]): StoryEnding {
  const reflexion = picks.filter((p) => p === 'reflexion').length;
  const instinto = picks.filter((p) => p === 'instinto').length;
  let body: string;
  if (reflexion > instinto) {
    body = 'Resolviste esto mirando hacia adentro, con calma. Ese ejercicio de conocerte fue, en el fondo, la verdadera decisión.';
  } else if (instinto > reflexion) {
    body = 'Resolviste esto confiando en lo que ya sabías de ti. Esa confianza también es una forma de autoconocimiento.';
  } else {
    body = 'Resolviste esto combinando reflexión e instinto — dos formas distintas de escucharte a ti mismo.';
  }
  return {
    title: 'Tomaste la decisión.',
    body: `${body} El dilema no desaparece solo por decidir, pero ahora sabes un poco más de cómo te mueves frente a lo difícil. Eso ya es una ganancia.`,
  };
}

const STORY_STEPS: Record<'ascent' | 'balance', StoryStep[]> = { ascent: ASCENT_STEPS, balance: BALANCE_STEPS };
const STORY_ENDING_BUILDERS: Record<'ascent' | 'balance', (picks: string[]) => StoryEnding> = {
  ascent: buildAscentEnding,
  balance: buildBalanceEnding,
};

const SPHERE_COLORS = ['#A8B87E', '#8FAF6B', '#C9A66B', '#B08BC0', '#6FA8B8'];
const PAIR_COUNT = 4;
const MAX_DROPS = 9;

// Notas (A4=440Hz) usadas para armar las melodías tradicionales de dominio
// público del repertorio — sencillas, lentas y ampliamente reconocibles.
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.0, A4 = 440.0, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, DS5 = 622.25, E5 = 659.25;

const MELODIES: number[][] = [
  // Estrellita dónde estás / Twinkle Twinkle Little Star
  [C4, C4, G4, G4, A4, A4, G4, F4, F4, E4, E4, D4, D4, C4],
  // Fray Santiago / Frère Jacques
  [C4, D4, E4, C4, C4, D4, E4, C4, E4, F4, G4, E4, F4, G4],
  // Himno a la Alegría (Oda a la Alegría, Beethoven)
  [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, E4, D4, D4],
  // Für Elise (Beethoven) — motivo de apertura
  [E5, DS5, E5, DS5, E5, B4, D5, C5, A4, C4, E4, A4, B4, E4],
  // Arroz con leche (canción de cuna tradicional)
  [G4, G4, G4, E4, F4, G4, A4, G4, F4, E4, D4, C4, D4, C4],
];

const PARTICLE_HUES = [82, 96, 40, 270, 195];

export default function DisconnectionZone({ open, onClose, isPremium, userId, name }: Props) {
  const [game, setGame] = useState<GameId>('spheres');
  const [soundOn, setSoundOn] = useState(false);

  const [spheres, setSpheres] = useState<Sphere[]>([]);
  const [dragFrom, setDragFrom] = useState<Sphere | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const [drops, setDrops] = useState<Drop[]>([]);
  const wipingRef = useRef(false);
  const [melodyDone, setMelodyDone] = useState(false);
  const spawnedInRoundRef = useRef(0);
  const resolvedInRoundRef = useRef(0);
  const melodyIndexRef = useRef(0);

  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [tracePoints, setTracePoints] = useState<TracePoint[]>([]);

  const [particles, setParticles] = useState<Particle[]>([]);
  const nextParticleId = useRef(0);

  const [storyIndex, setStoryIndex] = useState(0);
  const [storyLog, setStoryLog] = useState<string[]>([]);
  const [storyPicks, setStoryPicks] = useState<string[]>([]);
  const [storyEnding, setStoryEnding] = useState<StoryEnding | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const nextSphereId = useRef(0);
  const nextDropId = useRef(0);
  const nextRippleId = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const tracingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const ensureAudio = useCallback((): AudioContext => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioRef.current.state === 'suspended') audioRef.current.resume().catch(() => {});
    return audioRef.current;
  }, []);

  function playChime(freq: number) {
    if (!soundOn) return;
    try {
      const ctx = ensureAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 1);
    } catch { /* ignore */ }
  }

  function playChord(freqs: number[]) {
    if (!soundOn) return;
    try {
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.035, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 1.8);
      });
    } catch { /* ignore */ }
  }

  function makeSphere(color: string): Sphere {
    return {
      id: nextSphereId.current++,
      x: 12 + Math.random() * 76,
      y: 14 + Math.random() * 66,
      size: 46 + Math.random() * 20,
      color,
      matched: false,
      spawning: true,
    };
  }

  function settleSpawns() {
    setTimeout(() => {
      setSpheres((prev) => prev.map((s) => (s.spawning ? { ...s, spawning: false } : s)));
    }, 30);
  }

  // Spheres game: spawn N matching color pairs
  useEffect(() => {
    if (!open || game !== 'spheres') return;
    const colors = [...SPHERE_COLORS].sort(() => Math.random() - 0.5).slice(0, PAIR_COUNT);
    const initial: Sphere[] = [];
    colors.forEach((c) => { initial.push(makeSphere(c)); initial.push(makeSphere(c)); });
    setSpheres(initial);
    settleSpawns();
    setDragFrom(null);
    setDragPos(null);
  }, [open, game]);

  // Raindrop game ("Lluvia de Melodías"): cada gota lleva una nota secuencial
  // de la melodía activa. Se resuelve (suene o no) al tocarla o al caer sin
  // tocar. Al terminar una melodía, suena un acorde suave y empieza otra
  // distinta del repertorio.
  function pickNextMelodyIndex(excludeIndex: number) {
    if (MELODIES.length <= 1) return 0;
    let idx = excludeIndex;
    while (idx === excludeIndex) idx = Math.floor(Math.random() * MELODIES.length);
    return idx;
  }

  function startMelodyRound(pickNew: boolean) {
    if (pickNew) melodyIndexRef.current = pickNextMelodyIndex(melodyIndexRef.current);
    spawnedInRoundRef.current = 0;
    resolvedInRoundRef.current = 0;
    setMelodyDone(false);
  }

  function resolveNote() {
    resolvedInRoundRef.current++;
    const seq = MELODIES[melodyIndexRef.current];
    if (resolvedInRoundRef.current >= seq.length) {
      setMelodyDone(true);
      playChord([C4, E4, G4]);
      setTimeout(() => startMelodyRound(true), 4500);
    }
  }

  useEffect(() => {
    if (!open || game !== 'raindrop') return;
    setDrops([]); setRipples([]);
    melodyIndexRef.current = Math.floor(Math.random() * MELODIES.length);
    startMelodyRound(false);
    function spawn() {
      setDrops((prev) => {
        const active = prev.filter((d) => !d.popped);
        if (active.length >= MAX_DROPS) return prev;
        const seq = MELODIES[melodyIndexRef.current];
        if (spawnedInRoundRef.current >= seq.length) return prev;
        const noteIndex = spawnedInRoundRef.current;
        spawnedInRoundRef.current++;
        return [...prev, {
          id: nextDropId.current++, x: 8 + Math.random() * 84, y: -4,
          speed: 0.22 + Math.random() * 0.14, popped: false, noteIndex,
        }];
      });
    }
    spawn();
    const interval = setInterval(spawn, 900);
    return () => clearInterval(interval);
  }, [open, game]);

  // Raindrop animation loop
  useEffect(() => {
    if (!open || game !== 'raindrop') return;
    function tick() {
      setDrops((prev) => {
        const next: Drop[] = [];
        for (const d of prev) {
          if (d.popped) { next.push(d); continue; }
          const ny = d.y + d.speed;
          if (ny >= 105) { resolveNote(); continue; }
          next.push({ ...d, y: ny });
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open, game]);

  useEffect(() => {
    if (ripples.length === 0) return;
    const interval = setInterval(() => {
      setRipples((r) => r.map((rip) => ({ ...rip, age: rip.age + 1 })).filter((rip) => rip.age < 60));
    }, 40);
    return () => clearInterval(interval);
  }, [ripples.length]);

  // Trace game
  useEffect(() => {
    if (!open || game !== 'trace') return;
    setTracePoints([]);
    const interval = setInterval(() => {
      setTracePoints((prev) => prev.map((p) => ({ ...p, age: p.age + 1 })).filter((p) => p.age < 80));
    }, 50);
    return () => clearInterval(interval);
  }, [open, game]);

  // Particles game: touch-reactive floating particles, pitch follows touch height
  useEffect(() => {
    if (!open || game !== 'particles') return;
    setParticles([]);
    const interval = setInterval(() => {
      setParticles((prev) => prev.map((p) => ({ ...p, age: p.age + 1 })).filter((p) => p.age < 70));
    }, 40);
    return () => clearInterval(interval);
  }, [open, game]);

  // Story games (ascent / balance): se reinician al abrir o al cambiar de juego.
  useEffect(() => {
    if (!open || (game !== 'ascent' && game !== 'balance')) return;
    setStoryIndex(0); setStoryLog([]); setStoryPicks([]); setStoryEnding(null);
  }, [open, game]);

  function chooseStoryOption(choice: StoryChoice) {
    if (game !== 'ascent' && game !== 'balance') return;
    const steps = STORY_STEPS[game];
    const nextPicks = [...storyPicks, choice.tag];
    setStoryPicks(nextPicks);
    setStoryLog((prev) => [...prev, choice.reply]);
    playChime(392 + Math.random() * 60);
    const next = storyIndex + 1;
    if (next >= steps.length) {
      setStoryEnding(STORY_ENDING_BUILDERS[game](nextPicks));
    }
    setStoryIndex(next);
  }

  function restartStory() {
    setStoryIndex(0); setStoryLog([]); setStoryPicks([]); setStoryEnding(null);
  }

  function pointerToPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
  }

  // --- Spheres: drag from one, release over its color twin to connect ---
  function startSphereDrag(e: React.PointerEvent, s: Sphere) {
    if (s.matched) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragFrom(s);
    setDragPos({ x: s.x, y: s.y });
  }

  function moveSphereDrag(e: React.PointerEvent) {
    if (!dragFrom) return;
    setDragPos(pointerToPercent(e.clientX, e.clientY));
  }

  function sphereAtPoint(clientX: number, clientY: number, excludeId: number): Sphere | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    for (const s of spheres) {
      if (s.id === excludeId || s.matched) continue;
      const cx = rect.left + (s.x / 100) * rect.width;
      const cy = rect.top + (s.y / 100) * rect.height;
      if (Math.hypot(clientX - cx, clientY - cy) <= s.size / 2 + 16) return s;
    }
    return null;
  }

  function endSphereDrag(e: React.PointerEvent) {
    if (!dragFrom) return;
    const target = sphereAtPoint(e.clientX, e.clientY, dragFrom.id);
    if (target && target.color === dragFrom.color) {
      const a = dragFrom;
      setSpheres((prev) => prev.map((s) => (s.id === a.id || s.id === target.id) ? { ...s, matched: true } : s));
      playChime(440 + Math.random() * 80);
      setTimeout(() => {
        setSpheres((prev) => {
          const rest = prev.filter((s) => s.id !== a.id && s.id !== target.id);
          const color = SPHERE_COLORS[Math.floor(Math.random() * SPHERE_COLORS.length)];
          return [...rest, makeSphere(color), makeSphere(color)];
        });
        settleSpawns();
      }, 650);
    }
    setDragFrom(null);
    setDragPos(null);
  }

  // --- Raindrop: tap or swipe-wipe to pop drops ---
  function popDrop(d: Drop) {
    setDrops((prev) => prev.map((x) => (x.id === d.id ? { ...x, popped: true } : x)));
    setRipples((r) => [...r, { id: nextRippleId.current++, x: d.x, y: d.y, age: 0 }]);
    playChime(MELODIES[melodyIndexRef.current][d.noteIndex]);
    resolveNote();
    setTimeout(() => setDrops((prev) => prev.filter((x) => x.id !== d.id)), 500);
  }

  function wipeHit(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const hit = drops.find((d) => !d.popped && Math.hypot(d.x - px, d.y - py) < 7);
    if (hit) popDrop(hit);
  }

  // --- Trace ---
  function startTrace(e: React.PointerEvent) {
    tracingRef.current = true;
    addTracePoint(e);
  }

  function addTracePoint(e: React.PointerEvent) {
    if (!tracingRef.current || game !== 'trace') return;
    const pct = pointerToPercent(e.clientX, e.clientY);
    setTracePoints((prev) => [...prev, { x: pct.x, y: pct.y, age: 0 }]);
    if (Math.random() < 0.3) playChime(528 + Math.random() * 60);
  }

  function endTrace() {
    tracingRef.current = false;
  }

  // --- Particles ---
  function spawnParticles(e: React.PointerEvent) {
    const pct = pointerToPercent(e.clientX, e.clientY);
    const hue = PARTICLE_HUES[Math.floor(Math.random() * PARTICLE_HUES.length)];
    setParticles((prev) => [...prev, {
      id: nextParticleId.current++, x: pct.x, y: pct.y,
      size: 10 + Math.random() * 20, hue, age: 0,
    }]);
    if (Math.random() < 0.45) playChime(220 + (100 - pct.y) * 3.2);
  }

  function toggleSound() {
    if (!soundOn) ensureAudio();
    setSoundOn(!soundOn);
  }

  function selectGame(g: GameId, locked: boolean) {
    if (locked) { openCheckout({ userId, name }); return; }
    setGame(g);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (game === 'trace') startTrace(e);
    else if (game === 'raindrop') { wipingRef.current = true; wipeHit(e); }
    else if (game === 'particles') { tracingRef.current = true; spawnParticles(e); }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (game === 'spheres') moveSphereDrag(e);
    else if (game === 'trace') addTracePoint(e);
    else if (game === 'raindrop' && wipingRef.current) wipeHit(e);
    else if (game === 'particles' && tracingRef.current) spawnParticles(e);
  }

  function handlePointerUp(e: React.PointerEvent) {
    wipingRef.current = false;
    tracingRef.current = false;
    if (game === 'spheres') endSphereDrag(e);
    else if (game === 'trace') endTrace();
  }

  if (!open) return null;

  const games: { id: GameId; title: string; icon: typeof Leaf; locked: boolean }[] = [
    { id: 'spheres', title: 'Esferas', icon: Circle, locked: false },
    { id: 'raindrop', title: 'Melodías', icon: CloudRain, locked: false },
    { id: 'trace', title: 'Trazar', icon: Leaf, locked: !isPremium },
    { id: 'particles', title: 'Partículas', icon: Sparkles, locked: !isPremium },
    { id: 'ascent', title: 'El Ascenso', icon: Mountain, locked: !isPremium },
    { id: 'balance', title: 'Equilibrio Interior', icon: Scale, locked: !isPremium },
  ];

  return (
    <div className="dz-overlay">
      <div className="dz-bar">
        <button className="dz-close" onClick={onClose} type="button"><X size={20} /><span>Volver</span></button>
        <button className={`dz-sound ${soundOn ? 'active' : ''}`} onClick={toggleSound} type="button">
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      <div className="dz-game-selector">
        {games.map((g) => {
          const Icon = g.icon;
          return (
            <button key={g.id} className={`dz-game-tab ${game === g.id ? 'active' : ''} ${g.locked ? 'locked' : ''}`}
              onClick={() => selectGame(g.id, g.locked)} type="button">
              {g.locked ? <Lock size={13} /> : <Icon size={14} />}
              <span>{g.title}</span>
              {g.locked && <span className="dz-premium-badge">Premium</span>}
            </button>
          );
        })}
      </div>

      <div
        className="dz-canvas"
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
      >
        <div className="dz-glow" />

        {game === 'spheres' && (
          <>
            {spheres.filter((s) => !s.matched).length === 0 && (
              <div className="dz-empty"><p>Arrastra desde una esfera hasta su pareja del mismo color.</p></div>
            )}
            {spheres.map((s) => (
              <div key={s.id}
                className={`dz-sphere ${s.matched ? 'matched' : ''} ${s.spawning ? 'spawning' : ''}`}
                style={{
                  left: `${s.x}%`, top: `${s.y}%`,
                  width: `${s.size}px`, height: `${s.size}px`,
                  background: `radial-gradient(circle at 32% 28%, ${s.color}, ${s.color}99)`,
                  '--drift-x': `${(Math.random() - 0.5) * 20}px`,
                } as CSSProperties}
                onPointerDown={(e) => startSphereDrag(e, s)}
              />
            ))}
            {dragFrom && dragPos && (
              <svg className="dz-trace-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
                <line x1={dragFrom.x} y1={dragFrom.y} x2={dragPos.x} y2={dragPos.y}
                  stroke={dragFrom.color} strokeWidth="0.8" strokeLinecap="round" opacity="0.75" />
              </svg>
            )}
          </>
        )}

        {game === 'raindrop' && (
          <>
            {drops.length === 0 && !melodyDone && (
              <div className="dz-empty"><p>Toca o desliza el dedo para limpiar las gotas.</p></div>
            )}
            {drops.map((d) => (
              <div key={d.id}
                className={`dz-raindrop ${d.popped ? 'popped' : ''}`}
                style={{ left: `${d.x}%`, top: `${d.y}%`, '--drift-x': `${(Math.random() - 0.5) * 16}px` } as CSSProperties}
                onPointerDown={(e) => { e.stopPropagation(); if (!d.popped) popDrop(d); }}
              />
            ))}
            {ripples.map((r) => (
              <div key={r.id} className="dz-ripple"
                style={{ left: `${r.x}%`, top: `${r.y}%`, '--ripple-size': `${r.age * 2}px`, '--ripple-opacity': Math.max(0, 1 - r.age / 60) } as CSSProperties} />
            ))}
            {melodyDone && (
              <div className="dz-melody-msg anim-pop">
                <p>🎵 Has despejado la melodía por completo.</p>
                <p className="dz-melody-msg-sub">¿La reconoces? En un momento suena otra.</p>
              </div>
            )}
          </>
        )}

        {game === 'particles' && (
          <>
            {particles.length === 0 && (
              <div className="dz-empty"><p>Toca y desliza para sembrar partículas de luz.</p></div>
            )}
            {particles.map((p) => {
              const opacity = Math.max(0, 1 - p.age / 70);
              const scale = 1 + p.age / 70;
              return (
                <div key={p.id} className="dz-particle"
                  style={{
                    left: `${p.x}%`, top: `${p.y}%`,
                    width: `${p.size}px`, height: `${p.size}px`,
                    background: `radial-gradient(circle, hsla(${p.hue},55%,62%,0.9), hsla(${p.hue},55%,52%,0))`,
                    opacity, transform: `translate(-50%, -50%) scale(${scale})`,
                  }} />
              );
            })}
          </>
        )}

        {game === 'trace' && (
          <>
            <div className="dz-empty"><p>Toca y desliza para trazar líneas suaves.</p></div>
            <svg className="dz-trace-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
              {tracePoints.length >= 2 && tracePoints.map((p, i) => {
                if (i === 0) return null;
                const prev = tracePoints[i - 1];
                const opacity = Math.max(0, 1 - p.age / 80);
                return <line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke="rgba(168,184,126,0.6)" strokeWidth="0.4" opacity={opacity} strokeLinecap="round" />;
              })}
            </svg>
            {tracePoints.map((p, i) => {
              const opacity = Math.max(0, 1 - p.age / 80);
              return <div key={i} className="dz-trace-dot" style={{ left: `${p.x}%`, top: `${p.y}%`, opacity }} />;
            })}
          </>
        )}

        {(game === 'ascent' || game === 'balance') && (
          <div className="dz-story">
            {storyLog.length > 0 && (
              <div className="dz-story-feed">
                {storyLog.map((line, i) => <p key={i} className="dz-story-line">{line}</p>)}
              </div>
            )}
            {!storyEnding ? (
              <div className="dz-story-step anim-pop" key={storyIndex}>
                <p className="dz-story-prompt">{STORY_STEPS[game][storyIndex].prompt}</p>
                <div className="dz-story-choices">
                  {STORY_STEPS[game][storyIndex].choices.map((c) => (
                    <button key={c.label} className="dz-story-choice" onClick={() => chooseStoryOption(c)} type="button">
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="dz-story-ending anim-pop">
                <p className="dz-story-ending-title">{storyEnding.title}</p>
                <p className="dz-story-ending-body">{storyEnding.body}</p>
                <button className="dz-story-restart" onClick={restartStory} type="button">Empezar de nuevo</button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="dz-hint">
        {game === 'spheres' && 'Conecta cada esfera con su pareja del mismo color. Sin prisa, sin meta.'}
        {game === 'raindrop' && 'Cada gota es una nota. Límpialas a tu ritmo y descubre la melodía.'}
        {game === 'trace' && 'Traza líneas suaves con el dedo. Sin meta, sin destino.'}
        {game === 'particles' && 'Toca y desliza el dedo. Cada roce enciende una partícula y un tono distinto.'}
        {game === 'ascent' && 'Elige a tu ritmo. No hay una decisión correcta, solo tu manera de subir.'}
        {game === 'balance' && 'Elige lo que resuene más contigo en cada momento. No hay respuesta equivocada.'}
      </p>

      <style>{`
        .dz-overlay {
          position: fixed; inset: 0; z-index: 250;
          background:
            radial-gradient(ellipse at 20% 30%, rgba(112,130,56,0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(229,217,182,0.12) 0%, transparent 50%),
            linear-gradient(165deg, #F5F3EE 0%, #EDE9E0 100%);
          display: flex; flex-direction: column; animation: fadeIn 0.3s ease;
        }
        .dz-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; padding-top: max(14px, env(safe-area-inset-top)); gap: 12px; }
        .dz-close { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .dz-close:hover { background: var(--muted); color: var(--text); }
        .dz-sound { width: 40px; height: 40px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 50%; cursor: pointer; display: grid; place-items: center; }
        .dz-sound.active { color: var(--primary); border-color: var(--primary-200); }

        .dz-game-selector { display: flex; gap: 6px; padding: 0 20px 12px; overflow-x: auto; scrollbar-width: none; }
        .dz-game-selector::-webkit-scrollbar { display: none; }
        .dz-game-tab { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .dz-game-tab.active { border-color: var(--primary); color: var(--primary); background: rgba(112,130,56,0.06); }
        .dz-game-tab.locked { color: var(--text-muted); border-style: dashed; }
        .dz-premium-badge { padding: 2px 7px; border-radius: 999px; background: rgba(196,154,90,0.16); color: var(--warn); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }

        .dz-canvas { flex: 1; position: relative; overflow: hidden; touch-action: none; }
        .dz-glow { position: absolute; top: 50%; left: 50%; width: 280px; height: 280px; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(168,184,126,0.12) 0%, transparent 70%); filter: blur(30px); pointer-events: none; }
        .dz-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--text-soft); font-size: 15px; max-width: 260px; pointer-events: none; animation: fadeIn 0.5s ease; }

        .dz-sphere {
          position: absolute; border-radius: 50%; cursor: grab;
          box-shadow: 0 4px 14px rgba(58,58,54,0.12), inset 0 2px 4px rgba(255,255,255,0.3);
          transition: opacity 0.35s ease, transform 0.35s ease;
          transform: translate(-50%, -50%); opacity: 0.92;
          user-select: none; -webkit-user-select: none; touch-action: none;
        }
        .dz-sphere.spawning { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        .dz-sphere.matched { animation: driftAway 0.65s ease-out forwards; pointer-events: none; }
        .dz-sphere:active { cursor: grabbing; }

        .dz-raindrop {
          position: absolute; transform: translate(-50%, -50%);
          width: 13px; height: 19px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          background: linear-gradient(180deg, rgba(168,184,126,0.65), rgba(112,130,56,0.85));
          filter: blur(0.5px); touch-action: none; cursor: pointer;
        }
        .dz-raindrop.popped { animation: driftAway 0.5s ease-out forwards; pointer-events: none; }
        .dz-ripple { position: absolute; border-radius: 50%; border: 2px solid rgba(112,130,56,0.4); width: var(--ripple-size); height: var(--ripple-size); opacity: var(--ripple-opacity); transform: translate(-50%, -50%); pointer-events: none; transition: width 0.04s linear, height 0.04s linear, opacity 0.04s linear; }

        .dz-melody-msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; max-width: 280px; }
        .dz-melody-msg p { margin: 0; color: var(--text-soft); font-size: 15px; font-weight: 600; }
        .dz-melody-msg-sub { margin-top: 4px !important; font-size: 13px !important; font-weight: 500 !important; color: var(--text-muted) !important; }

        .dz-particle { position: absolute; border-radius: 50%; pointer-events: none; transition: opacity 0.06s linear, transform 0.06s linear; }

        .dz-trace-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        .dz-trace-dot { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: rgba(168,184,126,0.8); transform: translate(-50%, -50%); pointer-events: none; transition: opacity 0.1s; }

        .dz-story { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 28px 24px; overflow-y: auto; }
        .dz-story-feed { display: flex; flex-direction: column; gap: 8px; max-width: 420px; width: 100%; opacity: 0.55; }
        .dz-story-line { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
        .dz-story-step { max-width: 420px; width: 100%; text-align: center; display: flex; flex-direction: column; gap: 18px; }
        .dz-story-prompt { margin: 0; font-size: 17px; font-weight: 600; color: var(--text); line-height: 1.5; }
        .dz-story-choices { display: flex; flex-direction: column; gap: 10px; }
        .dz-story-choice { padding: 14px 18px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14.5px; font-weight: 600; cursor: pointer; text-align: left; transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s ease; }
        .dz-story-choice:hover { border-color: var(--primary-200); background: rgba(112,130,56,0.06); }
        .dz-story-choice:active { transform: scale(0.98); }
        .dz-story-ending { max-width: 420px; width: 100%; text-align: center; display: flex; flex-direction: column; gap: 14px; }
        .dz-story-ending-title { margin: 0; font-size: 19px; font-weight: 700; color: var(--primary-600); }
        .dz-story-ending-body { margin: 0; font-size: 15px; color: var(--text-soft); line-height: 1.6; }
        .dz-story-restart { align-self: center; margin-top: 6px; padding: 10px 22px; border-radius: 999px; border: 1px solid var(--primary-200); background: rgba(112,130,56,0.08); color: var(--primary-600); font-size: 13.5px; font-weight: 700; cursor: pointer; }
        .dz-story-restart:hover { background: rgba(112,130,56,0.14); }

        .dz-hint { text-align: center; padding: 12px 20px 24px; padding-bottom: max(24px, env(safe-area-inset-bottom)); font-size: 14px; color: var(--text-soft); margin: 0; }
      `}</style>
    </div>
  );
}
