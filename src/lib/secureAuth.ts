import { getSessionToken } from './session';

type SecureAuthAction = 'login' | 'reset-password' | 'confirm-link';

// Login, recuperación de contraseña y confirmación de vínculo pasan por la Edge
// Function secure-auth, que cuenta cada intento en una transacción propia. El
// `message` del Error es el texto del backend, para usarlo con localizeBackendError.
export async function callSecureAuth<T>(action: SecureAuthAction, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/secure-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'x-session-token': getSessionToken() ?? '',
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json as T;
}
