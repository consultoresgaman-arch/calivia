import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Volume2, VolumeX, Leaf, CloudRain } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  isPremium: boolean;
}

type GameId = 'dissolve' | 'trace' | 'raindrop';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  dissipated: boolean;
  driftX: number;
  driftY: number;
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

const MAX_PARTICLES = 24;
const PARTICLE_COLORS = ['#A8B87E', '#C4C2B8', '#E5D9B6', '#B5BBA8', '#D0CCC0'];

export default function DisconnectionZone({ open, onClose, isPremium }: Props) {
  const [game, setGame] = useState<GameId>('dissolve');
  const [soundOn, setSoundOn] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [tracePoints, setTracePoints] = useState<TracePoint[]>([]);
  const [drops, setDrops] = useState<{ id: number; y: number }[]>([]);
  const [cleared, setCleared] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const nextId = useRef(0);
  const nextRippleId = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<number | null>(null);
  const tracingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const ensureAudio = useCallback((): AudioContext => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  // Dissolve game: spawn floating particles
  useEffect(() => {
    if (!open || game !== 'dissolve') return;
    setParticles([]); setCleared(0);
    const timer = setInterval(() => {
      setParticles((prev) => {
        const visible = prev.filter((p) => !p.dissipated);
        if (visible.length >= MAX_PARTICLES) return prev;
        const id = nextId.current++;
        return [...prev, {
          id, x: 8 + Math.random() * 84, y: 8 + Math.random() * 84,
          size: 36 + Math.random() * 32, opacity: 0,
          dissipated: false, driftX: 0, driftY: 0,
        }];
      });
    }, 1200);
    for (let i = 0; i < 6; i++) setTimeout(() => {
      setParticles((prev) => [...prev, {
        id: nextId.current++, x: 8 + Math.random() * 84, y: 8 + Math.random() * 84,
        size: 36 + Math.random() * 32, opacity: 0, dissipated: false, driftX: 0, driftY: 0,
      }]);
    }, i * 200);
    return () => clearInterval(timer);
  }, [open, game]);

  // Dissolve animation
  useEffect(() => {
    if (!open || game !== 'dissolve') return;
    function animate() {
      setParticles((prev) => prev.map((p) => {
        if (p.dissipated) return { ...p, opacity: Math.max(0, p.opacity - 0.04), x: p.x + p.driftX, y: p.y + p.driftY };
        const opacity = Math.min(0.85, p.opacity + 0.02);
        return { ...p, opacity };
      }).filter((p) => p.opacity > 0.02));
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open, game]);

  // Raindrop game
  useEffect(() => {
    if (!open || game !== 'raindrop') return;
    setCleared(0); setRipples([]);
    let dropId = 0;
    const timer = setInterval(() => {
      const id = dropId++;
      setDrops([{ id, y: 0 }]);
      setTimeout(() => setDrops((d) => d.map((dr) => dr.id === id ? { ...dr, y: 100 } : dr)), 50);
      setTimeout(() => {
        setDrops((d) => d.filter((dr) => dr.id !== id));
        setRipples((r) => [...r, { id: nextRippleId.current++, x: 20 + Math.random() * 60, y: 45 + Math.random() * 20, age: 0 }]);
        playChime(396 + Math.random() * 80);
        setCleared((c) => c + 1);
      }, 2400);
    }, 3000);
    return () => clearInterval(timer);
  }, [open, game, soundOn]);

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
    setTracePoints([]); setCleared(0);
    const interval = setInterval(() => {
      setTracePoints((prev) => prev.map((p) => ({ ...p, age: p.age + 1 })).filter((p) => p.age < 80));
    }, 50);
    return () => clearInterval(interval);
  }, [open, game]);

  function pointerToPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
  }

  function startDissolveDrag(e: React.PointerEvent, p: Particle) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragIdRef.current = p.id;
  }

  function moveDissolveDrag(e: React.PointerEvent) {
    if (dragIdRef.current === null) return;
    const pct = pointerToPercent(e.clientX, e.clientY);
    setParticles((prev) => prev.map((p) => p.id === dragIdRef.current ? { ...p, x: pct.x, y: pct.y } : p));
  }

  function endDissolveDrag(_e: React.PointerEvent) {
    if (dragIdRef.current === null) return;
    const p = particles.find((pp) => pp.id === dragIdRef.current);
    if (p) {
      const dx = (Math.random() - 0.5) * 2;
      const dy = -1 - Math.random();
      setParticles((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, dissipated: true, driftX: dx, driftY: dy } : pp));
      setCleared((c) => c + 1);
      playChime(396 + Math.random() * 110);
    }
    dragIdRef.current = null;
  }

  function tapParticle(p: Particle) {
    if (p.dissipated) return;
    setParticles((prev) => prev.map((pp) => pp.id === p.id ? { ...pp, dissipated: true, driftX: 0, driftY: -1 } : pp));
    setCleared((c) => c + 1);
    playChime(440 + Math.random() * 80);
  }

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
    setCleared((c) => c + 1);
  }

  function toggleSound() {
    if (!soundOn) ensureAudio();
    setSoundOn(!soundOn);
  }

  function selectGame(g: GameId) {
    if (g === 'trace' && !isPremium) return;
    setGame(g);
  }

  if (!open) return null;

  const games: { id: GameId; title: string; icon: typeof Leaf; locked: boolean }[] = [
    { id: 'dissolve', title: 'Disolver', icon: Leaf, locked: false },
    { id: 'raindrop', title: 'Lluvia', icon: CloudRain, locked: false },
    { id: 'trace', title: 'Trazar', icon: Leaf, locked: !isPremium },
  ];

  return (
    <div className="dz-overlay">
      <div className="dz-bar">
        <button className="dz-close" onClick={onClose} type="button"><X size={20} /><span>Volver</span></button>
        <div className="dz-counter"><span>{cleared} {game === 'trace' ? 'trazos' : 'disueltas'}</span></div>
        <button className={`dz-sound ${soundOn ? 'active' : ''}`} onClick={toggleSound} type="button">
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      <div className="dz-game-selector">
        {games.map((g) => {
          const Icon = g.icon;
          return (
            <button key={g.id} className={`dz-game-tab ${game === g.id ? 'active' : ''} ${g.locked ? 'locked' : ''}`}
              onClick={() => selectGame(g.id)} type="button" disabled={g.locked}>
              <Icon size={14} /><span>{g.title}</span>
            </button>
          );
        })}
      </div>

      <div
        className="dz-canvas"
        ref={canvasRef}
        onPointerMove={game === 'dissolve' ? moveDissolveDrag : game === 'trace' ? addTracePoint : undefined}
        onPointerUp={game === 'dissolve' ? endDissolveDrag : game === 'trace' ? endTrace : undefined}
        onPointerCancel={game === 'dissolve' ? endDissolveDrag : game === 'trace' ? endTrace : undefined}
        onPointerDown={game === 'trace' ? startTrace : undefined}
      >
        <div className="dz-glow" />

        {game === 'dissolve' && (
          <>
            {particles.filter((p) => !p.dissipated).length === 0 && (
              <div className="dz-empty"><p>Desliza las partículas para que se desvanezcan.</p></div>
            )}
            {particles.map((p) => {
              const color = PARTICLE_COLORS[p.id % PARTICLE_COLORS.length];
              return (
                <div key={p.id}
                  className={`dz-particle ${p.dissipated ? 'dissipated' : ''}`}
                  style={{
                    left: `${p.x}%`, top: `${p.y}%`,
                    width: `${p.size}px`, height: `${p.size}px`,
                    opacity: p.opacity,
                    background: `radial-gradient(circle at 32% 28%, ${color}, ${color}88)`,
                  }}
                  onPointerDown={(e) => startDissolveDrag(e, p)}
                  onClick={() => tapParticle(p)}
                  role="button" tabIndex={0}
                />
              );
            })}
          </>
        )}

        {game === 'raindrop' && (
          <>
            <div className="dz-empty"><p>Mira la gota caer. Solo observa.</p></div>
            {drops.map((d) => <div key={d.id} className="dz-raindrop" style={{ top: `${d.y}%` }} />)}
            {ripples.map((r) => (
              <div key={r.id} className="dz-ripple"
                style={{ left: `${r.x}%`, top: `${r.y}%`, '--ripple-size': `${r.age * 2}px`, '--ripple-opacity': Math.max(0, 1 - r.age / 60) } as React.CSSProperties} />
            ))}
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
      </div>

      <p className="dz-hint">
        {game === 'dissolve' && 'Desliza cada partícula para que se desvanezca. Sin prisa.'}
        {game === 'raindrop' && 'Solo observa. La gota cae sola, las ondas se expanden solas.'}
        {game === 'trace' && 'Traza líneas suaves con el dedo. Sin meta, sin destino.'}
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
        .dz-counter { font-size: 13px; color: var(--text-soft); font-weight: 500; }
        .dz-sound { width: 40px; height: 40px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 50%; cursor: pointer; display: grid; place-items: center; }
        .dz-sound.active { color: var(--primary); border-color: var(--primary-200); }

        .dz-game-selector { display: flex; gap: 6px; padding: 0 20px 12px; overflow-x: auto; scrollbar-width: none; }
        .dz-game-selector::-webkit-scrollbar { display: none; }
        .dz-game-tab { display: flex; align-items: center; gap: 5px; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-soft); border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .dz-game-tab.active { border-color: var(--primary); color: var(--primary); background: rgba(112,130,56,0.06); }
        .dz-game-tab.locked { opacity: 0.4; cursor: not-allowed; }

        .dz-canvas { flex: 1; position: relative; overflow: hidden; touch-action: none; }
        .dz-glow { position: absolute; top: 50%; left: 50%; width: 280px; height: 280px; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(168,184,126,0.12) 0%, transparent 70%); filter: blur(30px); pointer-events: none; }
        .dz-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--text-soft); font-size: 15px; max-width: 260px; pointer-events: none; animation: fadeIn 0.5s ease; }

        .dz-particle { position: absolute; border-radius: 50%; cursor: grab; box-shadow: 0 4px 14px rgba(58,58,54,0.1), inset 0 2px 4px rgba(255,255,255,0.3); transition: opacity 0.3s; will-change: transform, opacity; transform: translate(-50%, -50%); user-select: none; -webkit-user-select: none; touch-action: none; }
        .dz-particle.dissipated { animation: driftAway 0.8s ease-out forwards; pointer-events: none; }
        .dz-particle:active { cursor: grabbing; }

        .dz-raindrop { position: absolute; left: 50%; transform: translateX(-50%); width: 12px; height: 18px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: linear-gradient(180deg, rgba(168,184,126,0.6), rgba(112,130,56,0.8)); filter: blur(0.5px); transition: top 2.3s cubic-bezier(0.4,0,0.2,1); }
        .dz-ripple { position: absolute; border-radius: 50%; border: 2px solid rgba(112,130,56,0.4); width: var(--ripple-size); height: var(--ripple-size); opacity: var(--ripple-opacity); transform: translate(-50%, -50%); pointer-events: none; transition: width 0.04s linear, height 0.04s linear, opacity 0.04s linear; }

        .dz-trace-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        .dz-trace-dot { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: rgba(168,184,126,0.8); transform: translate(-50%, -50%); pointer-events: none; transition: opacity 0.1s; }

        .dz-hint { text-align: center; padding: 12px 20px 24px; padding-bottom: max(24px, env(safe-area-inset-bottom)); font-size: 14px; color: var(--text-soft); margin: 0; }
      `}</style>
    </div>
  );
}
