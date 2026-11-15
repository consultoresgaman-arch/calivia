import { useEffect, useRef, useState } from 'react';
import { X, Phone, UserPlus, Trash2, Volume2, VolumeX, Vibrate, ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import { CRISIS_LINES, localizeCountryLabel, localizeCrisisLine } from './lib/crisis';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import {
  cacheCrisisContacts, readCachedCrisisContacts, refreshCrisisContacts,
  type LinkedSpecialist, type TrustedContact,
} from './lib/crisisContacts';
import { useLanguage, useT } from './lib/i18n';
import strings from './SosModal.i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  initialGrounding?: boolean;
}

// Un latido: lub, pausa corta, dub, descanso largo (~70 lpm). Se dispara con
// el plugin nativo Haptics en vez de navigator.vibrate() porque el WebView
// de Android no implementa la Vibration API de forma confiable.
const HEARTBEAT_CYCLE = { lub: 90, gapAfterLub: 100, dub: 120, rest: 700 };
const VIBRATION_LIKELY_SUPPORTED =
  Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && 'vibrate' in navigator);

type BreathPhase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';
type BreathPattern = 'box' | 'calm';

// Cuadrada: 4-4-4-4 con retención. Relajante: exhalación más larga, sin retención.
const PATTERNS: Record<BreathPattern, { phase: BreathPhase; secs: number }[]> = {
  box: [
    { phase: 'inhale', secs: 4 },
    { phase: 'holdIn', secs: 4 },
    { phase: 'exhale', secs: 4 },
    { phase: 'holdOut', secs: 4 },
  ],
  calm: [
    { phase: 'inhale', secs: 4 },
    { phase: 'exhale', secs: 6 },
  ],
};
const PATTERN_KEY = 'calivia.breath-pattern';

function readPattern(): BreathPattern {
  try {
    return localStorage.getItem(PATTERN_KEY) === 'calm' ? 'calm' : 'box';
  } catch {
    return 'box';
  }
}

interface BreathState { step: number; sec: number; cycle: number }
const BREATH_START: BreathState = { step: 0, sec: 0, cycle: 0 };

export default function SosModal({ open, onClose, initialGrounding }: Props) {
  const { profile, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const t = useT(strings);
  const [country, setCountry] = useState(profile?.country ?? '');
  const [saving, setSaving] = useState(false);
  const [pattern, setPattern] = useState<BreathPattern>(readPattern);
  const [breath, setBreath] = useState<BreathState>(BREATH_START);
  // La figura parte contraída y se expande un instante después, para que el
  // primer "Inhala" también se vea crecer.
  const [breathStarted, setBreathStarted] = useState(false);
  const steps = PATTERNS[pattern];
  const { phase, secs } = steps[breath.step];
  const cycle = breath.cycle;

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [specialist, setSpecialist] = useState<LinkedSpecialist | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [audioOn, setAudioOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);

  const [groundingActive, setGroundingActive] = useState(false);
  const [vibrating, setVibrating] = useState(false);
  const vibrationActiveRef = useRef(false);
  const vibrationTimeoutRef = useRef<number | null>(null);

  useEffect(() => { setCountry(profile?.country ?? ''); }, [profile?.country]);

  useEffect(() => {
    if (open && initialGrounding) setGroundingActive(true);
  }, [open, initialGrounding]);

  useEffect(() => {
    if (!open) return;
    // Primero la copia guardada: sin conexión es lo único disponible, y con
    // conexión evita que los teléfonos tarden en aparecer en plena crisis.
    const cached = readCachedCrisisContacts(profile!.id);
    setContacts(cached.contacts);
    setSpecialist(cached.specialist);
    setContactsLoading(cached.contacts.length === 0 && !cached.specialist);
    (async () => {
      try {
        const fresh = await refreshCrisisContacts(profile!.id);
        if (fresh) {
          setContacts(fresh.contacts);
          setSpecialist(fresh.specialist);
        }
      } finally {
        setContactsLoading(false);
      }
    })();
  }, [open, profile]);

  useEffect(() => {
    if (!open) {
      stopAmbientAudio();
      setGroundingActive(false);
      stopGroundingVibration();
    }
  }, [open]);

  // Avanza un segundo a la vez: el número del conteo y el cambio de fase salen
  // del mismo reloj, así nunca se desfasan.
  useEffect(() => {
    setBreath(BREATH_START);
    setBreathStarted(false);
    if (!open) return;
    const startTimer = window.setTimeout(() => setBreathStarted(true), 60);
    const tick = window.setInterval(() => {
      setBreath((s) => {
        const list = PATTERNS[pattern];
        if (s.sec + 1 < list[s.step].secs) return { ...s, sec: s.sec + 1 };
        const step = (s.step + 1) % list.length;
        return { step, sec: 0, cycle: step === 0 ? s.cycle + 1 : s.cycle };
      });
    }, 1000);
    return () => { window.clearTimeout(startTimer); window.clearInterval(tick); };
  }, [open, pattern]);

  function choosePattern(p: BreathPattern) {
    setPattern(p);
    try {
      localStorage.setItem(PATTERN_KEY, p);
    } catch {
      /* ignore */
    }
  }

  async function saveCountry(c: string) {
    setSaving(true);
    try {
      await supabase.from('profiles').update({ country: c || null }).eq('id', profile!.id);
      await refreshProfile();
    } finally { setSaving(false); }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    setSavingContact(true);
    try {
      const { data } = await supabase
        .from('trusted_contacts')
        .insert({ user_id: profile!.id, name: newName.trim(), phone: newPhone.trim() })
        .select('id, name, phone').single();
      if (data) {
        const next = [...contacts, data];
        setContacts(next);
        cacheCrisisContacts(profile!.id, { contacts: next, specialist });
        setNewName(''); setNewPhone(''); setShowContactForm(false);
      }
    } finally { setSavingContact(false); }
  }

  async function deleteContact(id: string) {
    const { error } = await supabase.from('trusted_contacts').delete().eq('id', id);
    if (error) return;
    const next = contacts.filter((x) => x.id !== id);
    setContacts(next);
    cacheCrisisContacts(profile!.id, { contacts: next, specialist });
  }

  function ensureAudioCtx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioCtxRef.current;
  }

  function startAmbientAudio() {
    const ctx = ensureAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer; source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 600; filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.8);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start();
    noiseSourceRef.current = source; noiseGainRef.current = gain; filterRef.current = filter;
  }

  function stopAmbientAudio() {
    if (noiseGainRef.current && audioCtxRef.current) {
      noiseGainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.4);
    }
    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(audioCtxRef.current ? audioCtxRef.current.currentTime + 0.5 : 0); } catch { /* ignore */ }
      noiseSourceRef.current = null;
    }
    noiseGainRef.current = null; filterRef.current = null;
  }

  useEffect(() => {
    if (!audioOn || !filterRef.current || !audioCtxRef.current) return;
    const target = phase === 'inhale' || phase === 'holdIn' ? 1200 : 400;
    filterRef.current.frequency.cancelScheduledValues(audioCtxRef.current.currentTime);
    filterRef.current.frequency.linearRampToValueAtTime(target, audioCtxRef.current.currentTime + 1);
  }, [phase, audioOn]);

  function toggleAudio() {
    if (audioOn) { stopAmbientAudio(); setAudioOn(false); }
    else { startAmbientAudio(); setAudioOn(true); }
  }

  function scheduleVibration(delay: number, next: () => void) {
    vibrationTimeoutRef.current = window.setTimeout(() => {
      if (!vibrationActiveRef.current) return;
      next();
    }, delay);
  }

  function runHeartbeatCycle() {
    if (!vibrationActiveRef.current) return;
    Haptics.vibrate({ duration: HEARTBEAT_CYCLE.lub }).catch(() => {});
    scheduleVibration(HEARTBEAT_CYCLE.gapAfterLub, () => {
      Haptics.vibrate({ duration: HEARTBEAT_CYCLE.dub }).catch(() => {});
      scheduleVibration(HEARTBEAT_CYCLE.rest, runHeartbeatCycle);
    });
  }

  function startGroundingVibration() {
    setVibrating(true);
    vibrationActiveRef.current = true;
    runHeartbeatCycle();
  }

  function stopGroundingVibration() {
    setVibrating(false);
    vibrationActiveRef.current = false;
    if (vibrationTimeoutRef.current) {
      clearTimeout(vibrationTimeoutRef.current);
      vibrationTimeoutRef.current = null;
    }
  }

  useEffect(() => () => { stopAmbientAudio(); stopGroundingVibration(); }, []);

  if (!open) return null;
  const countryInfo = country ? CRISIS_LINES[country] : null;
  const isExpanded = breathStarted && (phase === 'inhale' || phase === 'holdIn');
  const isHolding = phase === 'holdIn' || phase === 'holdOut';

  return (
    <div className="sos-overlay" onClick={onClose}>
      <div className="sos-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sos-close" onClick={onClose} aria-label={t('close')} type="button"><X size={20} /></button>

        {groundingActive ? (
          <div className="ground-view">
            <button
              className="ground-back"
              onClick={() => { stopGroundingVibration(); setGroundingActive(false); }}
              type="button"
            >
              <ArrowLeft size={16} strokeWidth={2} /><span>{t('back')}</span>
            </button>
            <div
              className={`ground-zone ${vibrating ? 'active' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); startGroundingVibration(); }}
              onPointerUp={stopGroundingVibration}
              onPointerCancel={stopGroundingVibration}
              onPointerLeave={stopGroundingVibration}
            >
              <div className="ground-pulse" />
              <p className="ground-instruction">
                {vibrating ? t('breathingWithRhythm') : t('keepFingersHere')}
              </p>
              {!VIBRATION_LIKELY_SUPPORTED && (
                <p className="ground-fallback-note">
                  {t('noVibrationSupport')}
                </p>
              )}
            </div>
          </div>
        ) : (
        <>
        <div className="breath-zone">
          <div className="breath-aura" />
          <div className="breath-patterns" role="group" aria-label={t('patternLabel')}>
            {(['box', 'calm'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`breath-pattern ${pattern === p ? 'active' : ''}`}
                aria-pressed={pattern === p}
                onClick={() => choosePattern(p)}
              >
                {t(p === 'box' ? 'patternBox' : 'patternCalm')}
              </button>
            ))}
          </div>
          <div className="breath-figure-wrap">
            <div
              className={`organic-figure ${isExpanded ? 'expand' : 'contract'} ${isHolding ? 'holding' : ''}`}
              style={{ transition: isHolding ? undefined : `transform ${secs * 1000}ms ease-in-out, border-radius ${secs * 1000}ms ease-in-out` }}
            />
            <span className="breath-count" key={`${breath.step}-${breath.sec}`} aria-hidden="true">{breath.sec + 1}</span>
          </div>
          <div className="breath-label" key={phase + cycle} aria-live="polite">
            <span className="breath-phase">{t(phase)}</span>
            <span className="breath-cycle">{t('cycle', { n: cycle + 1 })}</span>
          </div>
          <button className={`audio-toggle ${audioOn ? 'active' : ''}`} onClick={toggleAudio} type="button">
            {audioOn ? <Volume2 size={16} strokeWidth={2} /> : <VolumeX size={16} strokeWidth={2} />}
            <span>{audioOn ? t('soundOn') : t('soundOff')}</span>
          </button>
          <button className="grounding-entry-btn" onClick={() => setGroundingActive(true)} type="button">
            <Vibrate size={15} strokeWidth={2} /><span>{t('groundingEntry')}</span>
          </button>
        </div>

        {specialist && (
          <>
            <div className="sos-divider"><span>{t('yourSpecialist')}</span></div>
            <div className="sos-contacts">
              <div className="trusted-contact">
                <a className="trusted-call" href={`tel:${specialist.phone.replace(/\s/g, '')}`}>
                  <div className="trusted-icon"><Phone size={16} strokeWidth={2} /></div>
                  <div className="trusted-body">
                    <span className="trusted-name">{specialist.name}</span>
                    <span className="trusted-phone">{specialist.phone}</span>
                  </div>
                </a>
              </div>
              <p className="sos-contacts-empty">{t('specialistAvailabilityNote')}</p>
            </div>
          </>
        )}

        <div className="sos-divider"><span>{t('trustedContact')}</span></div>
        <div className="sos-contacts">
          {contactsLoading ? (
            <p className="sos-contacts-empty">{t('loading')}</p>
          ) : contacts.length === 0 ? (
            <p className="sos-contacts-empty">{t('noContactsHint')}</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="trusted-contact">
                <a className="trusted-call" href={`tel:${c.phone.replace(/\s/g, '')}`}>
                  <div className="trusted-icon"><Phone size={16} strokeWidth={2} /></div>
                  <div className="trusted-body">
                    <span className="trusted-name">{c.name}</span>
                    <span className="trusted-phone">{c.phone}</span>
                  </div>
                </a>
                <button className="trusted-delete" onClick={() => deleteContact(c.id)} type="button" aria-label={t('delete')}>
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
            ))
          )}
          {showContactForm ? (
            <form className="contact-form" onSubmit={addContact}>
              <input type="text" placeholder={t('namePlaceholder')} value={newName} onChange={(e) => setNewName(e.target.value)} required />
              <input type="tel" placeholder="+56 9 1234 5678" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
              <div className="contact-form-actions">
                <button type="submit" className="contact-save" disabled={savingContact}>{savingContact ? t('saving') : t('save')}</button>
                <button type="button" className="contact-cancel" onClick={() => setShowContactForm(false)}>{t('cancel')}</button>
              </div>
            </form>
          ) : (
            <button className="add-contact-btn" onClick={() => setShowContactForm(true)} type="button">
              <UserPlus size={15} strokeWidth={2} /><span>{t('addContact')}</span>
            </button>
          )}
        </div>

        <div className="sos-divider"><span>{t('emergencyLines')}</span></div>
        <div className="sos-country">
          <label htmlFor="sos-country">{t('yourCountry')}</label>
          <select id="sos-country" value={country} disabled={saving}
            onChange={(e) => { setCountry(e.target.value); saveCountry(e.target.value); }}>
            <option value="">{t('selectCountry')}</option>
            {Object.keys(CRISIS_LINES).map((code) => <option key={code} value={code}>{localizeCountryLabel(code, lang)}</option>)}
          </select>
        </div>
        {countryInfo && (
          <div className="sos-lines">
            {countryInfo.lines.map((rawLine) => {
              const line = localizeCrisisLine(rawLine, lang);
              return (
                <a key={line.phone} className="sos-line" href={`tel:${line.phone.replace(/\s/g, '')}`}>
                  <div className="sos-line-icon"><Phone size={18} strokeWidth={2} /></div>
                  <div className="sos-line-body">
                    <span className="sos-line-name">{line.name}</span>
                    <span className="sos-line-phone">{line.phone}</span>
                    {line.hours && <span className="sos-line-hours">{line.hours}{line.notes ? ` · ${line.notes}` : ''}</span>}
                  </div>
                </a>
              );
            })}
          </div>
        )}
        <p className="sos-disclaimer">{t('disclaimer')}</p>
        </>
        )}
      </div>

      <style>{`
        .sos-overlay {
          position: fixed; inset: 0; background: rgba(26,29,26,0.6);
          backdrop-filter: blur(6px); display: grid; place-items: center;
          padding: 16px; z-index: 200; animation: fadeIn 0.2s ease;
        }
        .sos-modal {
          width: 100%; max-width: 400px; background: var(--surface);
          border-radius: var(--radius); box-shadow: var(--shadow-lg);
          max-height: 92vh; overflow-y: auto; animation: pop 0.25s ease;
          position: relative;
        }
        .sos-close {
          position: absolute; top: 14px; right: 14px; z-index: 2;
          border: none; background: rgba(0,0,0,0.06); color: var(--text-soft);
          width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
          display: grid; place-items: center; transition: background 0.15s;
        }
        .sos-close:hover { background: var(--muted); }

        .breath-zone {
          padding: 36px 20px 24px; display: flex; flex-direction: column;
          align-items: center; gap: 16px; position: relative;
        }
        .breath-aura {
          position: absolute; top: 30px; left: 50%;
          width: 220px; height: 220px; transform: translateX(-50%);
          background: radial-gradient(circle, rgba(112,130,56,0.15) 0%, transparent 70%);
          filter: blur(20px); pointer-events: none;
        }
        .organic-figure {
          width: 160px; height: 160px;
          background: linear-gradient(135deg, var(--primary-200), var(--primary));
          box-shadow: 0 4px 30px rgba(112,130,56,0.2);
          position: relative; z-index: 1;
        }
        .organic-figure.expand {
          transform: scale(1.15);
          border-radius: 52% 48% 48% 52% / 48% 52% 48% 52%;
        }
        .organic-figure.contract {
          transform: scale(0.7);
          border-radius: 48% 52% 52% 48% / 52% 48% 52% 48%;
        }
        .breath-patterns {
          display: flex; gap: 4px; padding: 4px; border-radius: 999px;
          background: var(--surface-2); border: 1px solid var(--border); position: relative; z-index: 1;
        }
        .breath-pattern {
          padding: 6px 12px; border: none; border-radius: 999px; background: transparent;
          color: var(--text-soft); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .breath-pattern.active { background: var(--primary); color: #fff; }
        .breath-figure-wrap {
          position: relative; width: 190px; height: 190px;
          display: grid; place-items: center;
        }
        .breath-count {
          position: absolute; inset: 0; display: grid; place-items: center; z-index: 2;
          font-size: 46px; font-weight: 800; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.18);
          animation: fadeIn 0.25s ease; pointer-events: none;
        }
        .organic-figure.holding { animation: breathHold 2s ease-in-out infinite; }
        @keyframes breathHold {
          0%, 100% { box-shadow: 0 4px 30px rgba(112,130,56,0.2); }
          50% { box-shadow: 0 4px 44px rgba(112,130,56,0.45); }
        }
        .breath-label { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 52px; }
        .breath-phase { font-size: 24px; font-weight: 800; color: var(--text); animation: fadeIn 0.3s ease; }
        .breath-cycle { font-size: 12px; color: var(--text-soft); font-weight: 500; }

        .audio-toggle {
          display: flex; align-items: center; gap: 6px; padding: 8px 16px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text-soft); border-radius: 999px;
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .audio-toggle:hover { background: var(--muted); color: var(--text); }
        .audio-toggle.active { background: rgba(112,130,56,0.1); border-color: var(--primary); color: var(--primary-600); }

        .grounding-entry-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 16px;
          border: 1px solid var(--secondary-200); background: transparent;
          color: var(--secondary); border-radius: 999px;
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .grounding-entry-btn:hover { background: rgba(140,138,126,0.08); }

        .ground-view { display: flex; flex-direction: column; min-height: 420px; padding: 16px 20px 20px; }
        .ground-back {
          display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
          padding: 8px 14px; border: 1px solid var(--border); background: var(--surface);
          color: var(--text-soft); border-radius: 999px; font-size: 13px; font-weight: 600;
          cursor: pointer; margin-bottom: 8px;
        }
        .ground-back:hover { background: var(--muted); color: var(--text); }
        .ground-zone {
          position: relative; flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 22px;
          border-radius: 24px; border: 2px dashed var(--border); background: var(--surface-2);
          cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none;
          transition: border-color 0.2s, background 0.2s; text-align: center; padding: 32px 20px;
        }
        .ground-zone.active { border-color: var(--secondary); border-style: solid; background: rgba(140,138,126,0.08); }
        .ground-pulse {
          width: 96px; height: 96px; border-radius: 50%;
          background: radial-gradient(circle, var(--secondary-200), var(--secondary));
          box-shadow: 0 4px 24px rgba(140,138,126,0.3);
          animation: heartbeatPulse 0.86s ease-in-out infinite;
        }
        .ground-zone.active .ground-pulse { box-shadow: 0 4px 32px rgba(140,138,126,0.5); }
        @keyframes heartbeatPulse {
          0%, 100% { transform: scale(0.85); }
          15% { transform: scale(1.08); }
          30% { transform: scale(0.92); }
          45% { transform: scale(1.15); }
          60% { transform: scale(0.85); }
        }
        .ground-instruction { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
        .ground-fallback-note { font-size: 12.5px; color: var(--text-soft); margin: 0; max-width: 260px; line-height: 1.5; }

        .sos-divider { display: flex; align-items: center; gap: 12px; padding: 16px 22px 0; color: var(--text-muted); font-size: 12px; font-weight: 500; }
        .sos-divider::before, .sos-divider::after { content: ''; flex: 1; height: 1px; background: var(--border-soft); }

        .sos-contacts { padding: 14px 22px; display: flex; flex-direction: column; gap: 10px; }
        .sos-contacts-empty { font-size: 13px; color: var(--text-soft); margin: 0; line-height: 1.5; }
        .trusted-contact { display: flex; align-items: center; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
        .trusted-call { display: flex; align-items: center; gap: 12px; flex: 1; text-decoration: none; color: var(--text); min-width: 0; }
        .trusted-icon { width: 36px; height: 36px; border-radius: 12px; background: rgba(112,130,56,0.1); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .trusted-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .trusted-name { font-weight: 600; font-size: 14px; }
        .trusted-phone { font-size: 13px; color: var(--primary-600); font-weight: 500; }
        .trusted-delete { border: none; background: transparent; color: var(--text-muted); cursor: pointer; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; transition: background 0.15s, color 0.15s; }
        .trusted-delete:hover { background: var(--danger-bg); color: var(--danger); }
        .add-contact-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: 1px dashed var(--border); background: transparent; color: var(--text-soft); font-size: 13px; font-weight: 600; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s; }
        .add-contact-btn:hover { border-color: var(--primary); color: var(--primary); }
        .contact-form { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); }
        .contact-form input { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); }
        .contact-form input:focus { border-color: var(--primary); outline: none; }
        .contact-form-actions { display: flex; gap: 8px; }
        .contact-save { flex: 1; padding: 9px; border: none; border-radius: var(--radius-xs); background: var(--primary); color: #fff; font-weight: 600; cursor: pointer; font-size: 14px; }
        .contact-save:disabled { opacity: 0.5; }
        .contact-cancel { padding: 9px 14px; border: 1px solid var(--border); border-radius: var(--radius-xs); background: var(--surface); color: var(--text-soft); font-weight: 600; cursor: pointer; font-size: 14px; }

        .sos-country { padding: 14px 22px 8px; }
        .sos-country label { font-size: 13px; font-weight: 600; color: var(--text-soft); display: block; margin-bottom: 6px; }
        .sos-country select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); }
        .sos-lines { padding: 8px 22px 16px; display: flex; flex-direction: column; gap: 10px; }
        .sos-line { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); text-decoration: none; color: var(--text); transition: border-color 0.15s; }
        .sos-line:hover { border-color: var(--primary); }
        .sos-line-icon { width: 38px; height: 38px; border-radius: 12px; background: rgba(112,130,56,0.1); color: var(--primary); display: grid; place-items: center; flex-shrink: 0; }
        .sos-line-body { display: flex; flex-direction: column; gap: 2px; }
        .sos-line-name { font-weight: 600; font-size: 14px; }
        .sos-line-phone { font-weight: 700; color: var(--danger); font-size: 15px; }
        .sos-line-hours { font-size: 12px; color: var(--text-soft); }
        .sos-disclaimer { margin: 0; padding: 14px 22px 20px; font-size: 12px; color: var(--text-soft); line-height: 1.55; border-top: 1px solid var(--border-soft); }
      `}</style>
    </div>
  );
}
