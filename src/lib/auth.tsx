import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { getSessionToken, setSessionToken } from './session';
import type { Profile, Role } from './types';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (name: string, password: string) => Promise<void>;
  signUp: (name: string, password: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ profile: null, loading: true });

  useEffect(() => {
    let mounted = true;
    const token = getSessionToken();
    if (!token) {
      setState({ profile: null, loading: false });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('resolve_session', { p_token: token }).maybeSingle<ProfileRow>();
      if (!mounted) return;
      if (error || !data) {
        setSessionToken(null);
        setState({ profile: null, loading: false });
        return;
      }
      setState({ profile: rowToProfile(data), loading: false });
    })();
    return () => { mounted = false; };
  }, []);

  async function signUp(name: string, password: string, role: Role) {
    const { data, error } = await supabase
      .rpc('register_profile', { p_name: name, p_password: password, p_role: role })
      .single<ProfileRowWithSession>();
    if (error) throw error;
    setSessionToken(data.session_token);
    setState({ profile: rowToProfile(data), loading: false });
  }

  async function signIn(name: string, password: string) {
    const { data, error } = await supabase
      .rpc('login_profile', { p_name: name, p_password: password })
      .single<ProfileRowWithSession>();
    if (error) throw error;
    setSessionToken(data.session_token);
    setState({ profile: rowToProfile(data), loading: false });
  }

  async function signOut() {
    const token = getSessionToken();
    setSessionToken(null);
    setState({ profile: null, loading: false });
    if (token) await supabase.rpc('logout_session', { p_token: token });
  }

  async function refreshProfile() {
    const token = getSessionToken();
    if (!token) return;
    const { data, error } = await supabase.rpc('resolve_session', { p_token: token }).maybeSingle<ProfileRow>();
    if (!error && data) setState((s) => ({ ...s, profile: rowToProfile(data) }));
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
