import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { getSessionToken, setSessionToken } from './session';
import { callSecureAuth } from './secureAuth';
import { clearCachedCrisisContacts } from './crisisContacts';
import { unregisterPushNotifications } from './pushNotifications';
import type { Profile, Role } from './types';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  offline: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (name: string, password: string) => Promise<void>;
  signUp: (name: string, password: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retrySession: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'calivia.cached_profile';
const SESSION_CHECK_TIMEOUT_MS = 10000;

// Copia del perfil para que la app y el SOS abran sin conexión.
function readCachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function cacheProfile(profile: Profile | null): void {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface ProfileRow {
  id: string;
  full_name: string;
  role: Role;
  country: string | null;
  is_premium: boolean;
  created_at: string;
  avatar_path: string | null;
  phone: string | null;
  license_number: string | null;
  bio: string | null;
  preferred_name: string | null;
  occupation: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  persona_name_espejo: string | null;
  persona_name_amigo: string | null;
  persona_name_acompanante: string | null;
}

interface ProfileRowWithSession extends ProfileRow {
  session_token: string;
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    role: row.role,
    country: row.country,
    is_premium: row.is_premium,
    created_at: row.created_at,
    avatar_path: row.avatar_path,
    phone: row.phone,
    license_number: row.license_number,
    bio: row.bio,
    preferred_name: row.preferred_name,
    occupation: row.occupation,
    terms_accepted_at: row.terms_accepted_at,
    terms_version: row.terms_version,
    persona_name_espejo: row.persona_name_espejo,
    persona_name_amigo: row.persona_name_amigo,
    persona_name_acompanante: row.persona_name_acompanante,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ profile: null, loading: true, offline: false });

  function applyProfile(profile: Profile) {
    cacheProfile(profile);
    setState({ profile, loading: false, offline: false });
  }

  function clearSession() {
    setSessionToken(null);
    cacheProfile(null);
    setState({ profile: null, loading: false, offline: false });
  }

  // Solo se cierra la sesión si el servidor responde que ya no es válida. Un fallo
  // de red no dice nada sobre la sesión, y borrarla dejaría a la persona fuera de
  // la app y de su SOS justo cuando no tiene conexión.
  const restoreSession = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      setState({ profile: null, loading: false, offline: false });
      return;
    }
    const timeout = new Promise<{ data: null; error: Error }>((resolve) => {
      window.setTimeout(() => resolve({ data: null, error: new Error('session-check-timeout') }), SESSION_CHECK_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([
      supabase.rpc('resolve_session', { p_token: token }).maybeSingle<ProfileRow>(),
      timeout,
    ]);
    if (error) {
      setState({ profile: readCachedProfile(), loading: false, offline: true });
      return;
    }
    if (!data) {
      clearSession();
      return;
    }
    applyProfile(rowToProfile(data));
  }, []);

  useEffect(() => {
    void restoreSession();
    const onOnline = () => { void restoreSession(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [restoreSession]);

  async function signUp(name: string, password: string, role: Role) {
    const { data, error } = await supabase
      .rpc('register_profile', { p_name: name, p_password: password, p_role: role })
      .single<ProfileRowWithSession>();
    if (error) throw error;
    setSessionToken(data.session_token);
    applyProfile(rowToProfile(data));
  }

  async function signIn(name: string, password: string) {
    const { profile } = await callSecureAuth<{ profile: ProfileRowWithSession }>('login', { name, password });
    setSessionToken(profile.session_token);
    applyProfile(rowToProfile(profile));
  }

  async function signOut() {
    await unregisterPushNotifications();
    const token = getSessionToken();
    clearSession();
    clearCachedCrisisContacts();
    if (token) await supabase.rpc('logout_session', { p_token: token });
  }

  async function refreshProfile() {
    const token = getSessionToken();
    if (!token) return;
    const { data, error } = await supabase.rpc('resolve_session', { p_token: token }).maybeSingle<ProfileRow>();
    if (!error && data) {
      const profile = rowToProfile(data);
      cacheProfile(profile);
      setState((s) => ({ ...s, profile }));
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile, retrySession: restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
