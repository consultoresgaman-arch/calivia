import { useEffect, useRef, useState } from 'react';
import { CloudRain, HeartPulse, Wind, Lock, Play, Pause } from 'lucide-react';
import { openCheckout } from './lib/payments';
import { useHeartbeatSound } from './lib/useHeartbeatSound';

interface Props {
  isPremium: boolean;
  userId: string;
  name?: string | null;
}

type SoundId = 'rain' | 'heartbeat' | 'wind';

interface SoundDef {
  id: SoundId;
  title: string;
  desc: string;
  icon: typeof CloudRain;
  locked: boolean;
}

export default function SoundGallery({ isPremium, userId, name }: Props) {
  const [playing, setPlaying] = useState<SoundId | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const stopFnRef = useRef<(() => void) | null>(null);

  const sounds: SoundDef[] = [
    { id: 'rain', title: 'Lluvia fina', desc: 'Un manto suave de lluvia constante', icon: CloudRain, locked: false },
    { id: 'heartbeat', title: 'Latidos', desc: 'Un pulso calmo, como un corazón en reposo', icon: HeartPulse, locked: !isPremium },
    { id: 'wind', title: 'Viento blanco', desc: 'Un soplo continuo que cubre el ruido mental', icon: Wind, locked: !isPremium },
  ];

  function ensureCtx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioCtxRef.current;
  }

  function stopCurrent() {
    if (stopFnRef.current) {
      try { stopFnRef.current(); } catch { /* ignore */ }
      stopFnRef.current = null;
    }
    nodesRef.current.forEach((n) => { try { (n as any).disconnect?.(); } catch { /* ignore */ } });
    nodesRef.current = [];
  }

  function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function playRain(ctx: AudioContext) {
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start();
    nodesRef.current = [source, filter, gain];
    stopFnRef.current = () => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => { try { source.stop(); } catch { /* ignore */ } }, 450);
    };
  }

  function playWind(ctx: AudioContext) {
    const source = ctx.createBufferSource();
    source.buffer = makeNoiseBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 1);
    // Lento vaivén de intensidad, como ráfagas de viento.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start();
    nodesRef.current = [source, filter, gain, lfo, lfoGain];
    stopFnRef.current = () => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      setTimeout(() => { try { source.stop(); lfo.stop(); } catch { /* ignore */ } }, 450);
    };
  }

  const heartbeat = useHeartbeatSound();

  async function toggle(sound: SoundDef) {
    if (sound.locked) {
      openCheckout({ userId, name });
      return;
    }

    if (sound.id === 'heartbeat') {
      stopCurrent();
      setPlaying(null);
      heartbeat.toggle();
      return;
    }

    heartbeat.stop();
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* ignore */ } }

    if (playing === sound.id) {
      stopCurrent();
      setPlaying(null);
      return;
    }
    stopCurrent();
    if (sound.id === 'rain') playRain(ctx);
    else if (sound.id === 'wind') playWind(ctx);
    setPlaying(sound.id);
  }

  useEffect(() => () => stopCurrent(), []);

  return (
    <section className="sg-card">
      <div className="sg-head">
        <div className="sg-icon"><CloudRain size={18} strokeWidth={2} /></div>
        <div>
          <h2>Galería de sonidos</h2>
          <p>Ambientes suaves para acompañar tu respiración o tu descanso</p>
        </div>
      </div>

      <div className="sg-list">
        {sounds.map((s) => {
          const Icon = s.icon;
          const isPlaying = s.id === 'heartbeat' ? heartbeat.playing : playing === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`sg-item ${isPlaying ? 'playing' : ''} ${s.locked ? 'locked' : ''}`}
              onClick={() => toggle(s)}
            >
              <div className="sg-item-icon"><Icon size={20} strokeWidth={1.8} /></div>
              <div className="sg-item-body">
                <span className="sg-item-title">{s.title}{s.locked && <Lock size={12} strokeWidth={2.5} />}</span>
                <span className="sg-item-desc">{s.locked ? 'Disponible con Calivia Ilimitada' : s.desc}</span>
              </div>
              <div className="sg-item-action">
                {s.locked ? <Lock size={16} strokeWidth={2} /> : isPlaying ? <Pause size={18} strokeWidth={2} /> : <Play size={18} strokeWidth={2} />}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .sg-card { display: flex; flex-direction: column; gap: 14px; }
        .sg-head { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--border-soft); }
        .sg-icon { width: 38px; height: 38px; border-radius: 12px; background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .sg-head h2 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
        .sg-head p { margin: 2px 0 0; font-size: 12px; color: var(--text-soft); }

        .sg-list { display: flex; flex-direction: column; gap: 10px; }
        .sg-item { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); cursor: pointer; text-align: left; transition: border-color 0.15s, background 0.15s; }
        .sg-item:hover { border-color: var(--primary-200); }
        .sg-item.playing { border-color: var(--primary); background: rgba(112,130,56,0.08); }
        .sg-item.locked { opacity: 0.75; }
        .sg-item-icon { width: 40px; height: 40px; border-radius: 12px; background: rgba(112,130,56,0.1); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .sg-item-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .sg-item-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: var(--text); }
        .sg-item-desc { font-size: 12.5px; color: var(--text-soft); }
        .sg-item-action { width: 36px; height: 36px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); color: var(--text-soft); display: grid; place-items: center; flex-shrink: 0; }
        .sg-item.playing .sg-item-action { background: var(--primary); border-color: var(--primary); color: #fff; }
      `}</style>
    </section>
  );
}
