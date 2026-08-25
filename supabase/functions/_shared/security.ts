import type { createClient } from 'npm:@supabase/supabase-js@2.45.4';

type SupabaseClient = ReturnType<typeof createClient>;

export interface SessionInfo {
  userId: string;
  role: string | null;
}

// Verifica el header x-session-token (autenticación propia de la app — ver
// supabase/migrations/20260805130000_custom_table_based_auth.sql) contra la
// tabla `sessions`. A diferencia de PostgREST, las Edge Functions no resuelven
// current_session_user_id() solas: acá se valida el token a mano, con la
// service role key (que igual se salta RLS, así que esto no depende de
// políticas). Sin esto, cualquiera con la anon key pública podía mandar
// cualquier `userId` en el body y la función lo aceptaba sin más — se salía
// completamente del sistema de sesiones.
export async function resolveSession(supabase: SupabaseClient, req: Request): Promise<SessionInfo | null> {
  const token = req.headers.get('x-session-token');
  if (!token) return null;

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (sessionErr || !session) return null;
  if (new Date(session.expires_at as string).getTime() <= Date.now()) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user_id as string)
    .maybeSingle();

  return { userId: session.user_id as string, role: (profile?.role as string | undefined) ?? null };
}

// Límite de peticiones respaldado por Postgres (tabla rate_limits + función
// check_rate_limit — ver 20260825140000_add_rate_limiting.sql), así el
// conteo es compartido entre todas las instancias de la función, no solo la
// memoria de un proceso. Si el limitador mismo falla (p. ej. un problema de
// red puntual), se falla "abierto" — mejor un chat disponible que tumbar la
// función entera por un error del limitador.
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxPerWindow: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_max_per_window: maxPerWindow,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('checkRateLimit: check_rate_limit falló, dejando pasar la petición:', error);
    return true;
  }
  return data === true;
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'No autorizado' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function rateLimitedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'Demasiadas solicitudes, intenta de nuevo en un momento.' }), {
    status: 429,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Para funciones sin sesión (p. ej. recuperar contraseña): mejor esfuerzo de
// IP del cliente a partir de los headers que reenvía el borde de Supabase.
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}
