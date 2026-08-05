import { useEffect, useRef, useState } from 'react';
import { X, Phone, UserPlus, Trash2, Volume2, VolumeX } from 'lucide-react';
import { CRISIS_LINES } from './lib/crisis';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface TrustedContact {
  id: string;
  name: string;
  phone: string;
}

type BreathPhase = 'inhale' | 'exhale';

const PHASE_DURATION: Record<BreathPhase, number> = { inhale: 4000, exhale: 6000 };

export default function SosModal({ open, onClose }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [country, setCountry] = useState(profile?.country ?? '');
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
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

  useEffect(() => { setCountry(profile?.country ?? ''); }, [profile?.country]);

  useEffect(() => {
    if (!open) return;
    setContactsLoading(true);
    (async () => {
      const { data } = await supabase
        .from('trusted_contacts')
        .select('id, name, phone')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: true });
      setContacts(data ?? []);
      setContactsLoading(false);
    })();
  }, [open, profile]);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setPhase('inhale'); setCycle(0);
      stopAmbientAudio();
      return;
    }
    function next() {
      setPhase((p) => {
        const np: BreathPhase = p === 'inhale' ? 'exhale' : 'inhale';
        if (np === 'inhale') setCycle((c) => c + 1);
        timerRef.current = window.setTimeout(next, PHASE_DURATION[np]);
        return np;
      });
    }
    timerRef.current = window.setTimeout(next, PHASE_DURATION.inhale);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [open]);

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
      if (data) { setContacts((c) => [...c, data]); setNewName(''); setNewPhone(''); setShowContactForm(false); }
    } finally { setSavingContact(false); }
  }

  async function deleteContact(id: string) {
    await supabase.from('trusted_contacts').delete().eq('id', id);
    setContacts((c) => c.filter((x) => x.id !== id));
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
    const target = phase === 'inhale' ? 1200 : 400;
    filterRef.current.frequency.cancelScheduledValues(audioCtxRef.current.currentTime);
    filterRef.current.frequency.linearRampToValueAtTime(target, audioCtxRef.current.currentTime + 1);
  }, [phase, audioOn]);

  function toggleAudio() {
    if (audioOn) { stopAmbientAudio(); setAudioOn(false); }
    else { startAmbientAudio(); setAudioOn(true); }
  }

  useEffect(() => () => stopAmbientAudio(), []);

  if (!open) return null;
  const countryInfo = country ? CRISIS_LINES[country] : null;
  const isExpanding = phase === 'inhale';

  return (
    <div className="sos-overlay" onClick={onClose}>
      <div className="sos-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="sos-close" onClick={onClose} aria-label="Cerrar" type="button"><X size={20} /></button>

        <div className="breath-zone">
          <div className="breath-aura" />
          <div
            className={`organic-figure ${isExpanding ? 'expand' : 'contract'}`}
            style={{ transition: `transform ${PHASE_DURATION[phase]}ms ease-in-out, border-radius ${PHASE_DURATION[phase]}ms ease-in-out` }}
          />
          <div className="breath-label" key={phase + cycle}>
            <span className="breath-phase">{isExpanding ? 'Inhala' : 'Exhala'}</span>
            {cycle > 0 && <span className="breath-cycle">Ciclo {cycle + 1}</span>}
          </div>
          <button className={`audio-toggle ${audioOn ? 'active' : ''}`} onClick={toggleAudio} type="button">
            {audioOn ? <Volume2 size={16} strokeWidth={2} /> : <VolumeX size={16} strokeWidth={2} />}
            <span>{audioOn ? 'Sonido activado' : 'Activar lluvia suave'}</span>
          </button>
        </div>

        <div className="sos-divider"><span>Contacto de confianza</span></div>
        <div className="sos-contacts">
          {contactsLoading ? (
            <p className="sos-contacts-empty">Cargando…</p>
          ) : contacts.length === 0 ? (
            <p className="sos-contacts-empty">Agrega a alguien en quien confías para llamarlo en momentos difíciles.</p>
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
                <button className="trusted-delete" onClick={() => deleteContact(c.id)} type="button" aria-label="Eliminar">
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </div>
            ))
          )}
          {showContactForm ? (
            <form className="contact-form" onSubmit={addContact}>
              <input type="text" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              <input type="tel" placeholder="+56 9 1234 5678" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
              <div className="contact-form-actions">
                <button type="submit" className="contact-save" disabled={savingContact}>{savingContact ? 'Guardando…' : 'Guardar'}</button>
                <button type="button" className="contact-cancel" onClick={() => setShowContactForm(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="add-contact-btn" onClick={() => setShowContactForm(true)} type="button">
              <UserPlus size={15} strokeWidth={2} /><span>Agregar contacto</span>
            </button>
          )}
        </div>

        <div className="sos-divider"><span>Líneas de emergencia</span></div>
        <div className="sos-country">
          <label htmlFor="sos-country">Tu país</label>
          <select id="sos-country" value={country} disabled={saving}
            onChange={(e) => { setCountry(e.target.value); saveCountry(e.target.value); }}>
            <option value="">Selecciona…</option>
            {Object.entries(CRISIS_LINES).map(([code, v]) => <option key={code} value={code}>{v.label}</option>)}
          </select>
        </div>
        {countryInfo && (
          <div className="sos-lines">
            {countryInfo.lines.map((line) => (
              <a key={line.phone} className="sos-line" href={`tel:${line.phone.replace(/\s/g, '')}`}>
                <div className="sos-line-icon"><Phone size={18} strokeWidth={2} /></div>
                <div className="sos-line-body">
                  <span className="sos-line-name">{line.name}</span>
                  <span className="sos-line-phone">{line.phone}</span>
                  {line.hours && <span className="sos-line-hours">{line.hours}{line.notes ? ` · ${line.notes}` : ''}</span>}
                </div>
              </a>
            ))}
          </div>
        )}
        <p className="sos-disclaimer">Si tu vida corre peligro, contacta inmediatamente a los servicios de emergencia locales.</p>
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
        .breath-label { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 44px; }
        .breath-phase { font-size: 18px; font-weight: 700; color: var(--text); animation: fadeIn 0.3s ease; }
        .breath-cycle { font-size: 12px; color: var(--text-soft); font-weight: 500; }

        .audio-toggle {
          display: flex; align-items: center; gap: 6px; padding: 8px 16px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text-soft); border-radius: 999px;
          font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .audio-toggle:hover { background: var(--muted); color: var(--text); }
        .audio-toggle.active { background: rgba(112,130,56,0.1); border-color: var(--primary); color: var(--primary-600); }

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
