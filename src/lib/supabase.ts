import { createClient } from '@supabase/supabase-js';
import { getSessionToken } from './session';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
}

// No usamos supabase.auth: la identidad viaja en este header personalizado,
// que las políticas RLS leen vía current_session_user_id() (ver migración
// 20260805130000_custom_table_based_auth.sql).
function fetchWithSessionToken(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getSessionToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('x-session-token', token);
  return fetch(input, { ...init, headers });
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithSessionToken },
});
