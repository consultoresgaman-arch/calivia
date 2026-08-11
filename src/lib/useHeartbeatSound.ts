import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Latido sintetizado con Web Audio API (sin archivo de audio): un seno de
 * 55Hz por el cuerpo grave más un armónico a 110Hz para que se perciba en
 * altavoces de celular (que rondan mal por debajo de ~150-200Hz). Extraído
 * de SoundGallery para reusarlo también en el acceso rápido "Espacio de Calma".
 */
export function useHeartbeatSound() {
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  function ensureCtx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioCtxRef.current;
  }

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const ctx = audioCtxRef.current;
    const masterGain = masterGainRef.current;
    if (ctx && masterGain) {
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    }
    setPlaying(false);
  }, []);

  const start = useCallback(async () => {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    activeRef.current = true;
    setPlaying(true);

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.42;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    function thump(delay: number) {
      if (!activeRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
      osc.connect(gain); gain.connect(masterGain);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);

      const harmonic = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      harmonic.type = 'sine';
      harmonic.frequency.value = 110;
      harmonicGain.gain.setValueAtTime(0, ctx.currentTime + delay);
      harmonicGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.03);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      harmonic.connect(harmonicGain); harmonicGain.connect(masterGain);
      harmonic.start(ctx.currentTime + delay);
      harmonic.stop(ctx.currentTime + delay + 0.35);
    }

    function cycle(t: number) {
      if (!activeRef.current) return;
      thump(t);
      thump(t + 0.22);
      timeoutRef.current = window.setTimeout(() => cycle(0), 950);
    }
    cycle(0);
  }, []);

  const toggle = useCallback(() => {
    if (activeRef.current) stop(); else start();
  }, [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { playing, start, stop, toggle };
}
