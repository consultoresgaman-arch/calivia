import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { resolveSession, clientIp } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-session-token',
};

const MAX_NAME_LENGTH = 120;
const MAX_PASSWORD_LENGTH = 200;
const TOO_MANY_ATTEMPTS = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';

type Supabase = ReturnType<typeof createClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// A diferencia de checkRateLimit (_shared/security.ts), acá se falla "cerrado":
// si el limitador no responde, no se evalúa la credencial. Cada llamada es su
// propia transacción, así que el intento queda contado aunque luego falle.
async function allowAttempt(supabase: Supabase, key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max_per_window: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('secure-auth: check_rate_limit falló:', error);
    return false;
  }
  return data === true;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH;
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_PASSWORD_LENGTH;
}

async function handleLogin(supabase: Supabase, req: Request, body: Record<string, unknown>): Promise<Response> {
  const { name, password } = body;
  if (!isValidName(name) || !isValidPassword(password)) {
    return json({ error: 'Nombre o contraseña incorrectos' }, 401);
  }

  const ipOk = await allowAttempt(supabase, `login-ip:${clientIp(req)}`, 30, 300);
  const nameOk = await allowAttempt(supabase, `login:${normalizeName(name)}`, 10, 300);
  if (!ipOk || !nameOk) return json({ error: TOO_MANY_ATTEMPTS }, 429);

  const { data, error } = await supabase.rpc('auth_login', { p_name: name, p_password: password });
  if (error) {
    console.error('secure-auth: auth_login falló:', error);
    return json({ error: 'Error interno' }, 500);
  }
  const profile = Array.isArray(data) ? data[0] : null;
  if (!profile) return json({ error: 'Nombre o contraseña incorrectos' }, 401);
  return json({ profile });
}

async function handleResetPassword(supabase: Supabase, req: Request, body: Record<string, unknown>): Promise<Response> {
  const { name, code, newPassword } = body;
  if (!isValidName(name) || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return json({ error: 'Código inválido o vencido' }, 400);
  }
  if (!isValidPassword(newPassword) || newPassword.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
  }

  const ipOk = await allowAttempt(supabase, `pwreset-try-ip:${clientIp(req)}`, 20, 900);
  const nameOk = await allowAttempt(supabase, `pwreset-try:${normalizeName(name)}`, 5, 900);
  if (!ipOk || !nameOk) return json({ error: TOO_MANY_ATTEMPTS }, 429);

  const { data, error } = await supabase.rpc('reset_password_with_code', {
    p_name: name,
    p_code: code.trim(),
    p_new_password: newPassword,
  });
  if (error) {
    console.error('secure-auth: reset_password_with_code falló:', error);
    return json({ error: 'Error interno' }, 500);
  }
  if (data !== true) return json({ error: 'Código inválido o vencido' }, 400);
  return json({ ok: true });
}

async function handleConfirmLink(supabase: Supabase, req: Request, body: Record<string, unknown>): Promise<Response> {
  const session = await resolveSession(supabase, req);
  if (!session) return json({ error: 'No autorizado' }, 401);
  if (session.role !== 'psychologist') return json({ error: 'Solo un psicólogo puede confirmar un vínculo' }, 403);

  const { patientName, code } = body;
  if (!isValidName(patientName) || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return json({ error: 'Código incorrecto o no hay una confirmación pendiente con ese paciente' }, 400);
  }

  if (!(await allowAttempt(supabase, `confirm-link:${session.userId}`, 10, 300))) {
    return json({ error: TOO_MANY_ATTEMPTS }, 429);
  }

  const { data, error } = await supabase.rpc('auth_confirm_patient_link', {
    p_psych: session.userId,
    p_patient_name: patientName,
    p_code: code.trim(),
  });
  if (error) {
    console.error('secure-auth: auth_confirm_patient_link falló:', error);
    return json({ error: 'Error interno' }, 500);
  }
  const patient = Array.isArray(data) ? data[0] : null;
  if (!patient) return json({ error: 'Código incorrecto o no hay una confirmación pendiente con ese paciente' }, 400);
  return json({ patient });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (body?.action) {
      case 'login': return await handleLogin(supabase, req, body);
      case 'reset-password': return await handleResetPassword(supabase, req, body);
      case 'confirm-link': return await handleConfirmLink(supabase, req, body);
      default: return json({ error: 'Acción inválida' }, 400);
    }
  } catch (err) {
    console.error('secure-auth failed:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
