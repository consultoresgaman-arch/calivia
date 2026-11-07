import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { resolveSession, checkRateLimit, unauthorizedResponse, rateLimitedResponse } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-session-token',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const { password } = await req.json();
    if (typeof password !== 'string' || !password || password.length > 200) {
      return json({ error: 'Contraseña incorrecta' }, 403);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const session = await resolveSession(supabase, req);
    if (!session) return unauthorizedResponse(corsHeaders);
    if (!(await checkRateLimit(supabase, `delete-account:${session.userId}`, 5, 900))) {
      return rateLimitedResponse(corsHeaders);
    }

    const { data: valid, error: verifyErr } = await supabase.rpc('verify_user_password', {
      p_user_id: session.userId,
      p_password: password,
    });
    if (verifyErr) throw verifyErr;
    if (valid !== true) return json({ error: 'Contraseña incorrecta' }, 403);

    const { data: files, error: listErr } = await supabase.storage.from('avatars').list(session.userId);
    if (listErr) throw listErr;
    if (files && files.length > 0) {
      const { error: removeErr } = await supabase.storage
        .from('avatars')
        .remove(files.map((file) => `${session.userId}/${file.name}`));
      if (removeErr) throw removeErr;
    }

    // La cascada borra sesiones, chats, registros de ánimo, diario, tareas, contactos,
    // reportes, alertas, notas clínicas, vínculos, videollamadas y dispositivos.
    const { error: deleteErr } = await supabase.from('profiles').delete().eq('id', session.userId);
    if (deleteErr) throw deleteErr;

    return json({ deleted: true });
  } catch (err) {
    console.error('delete-account failed:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
