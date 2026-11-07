import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { resolveSession, checkRateLimit, unauthorizedResponse, rateLimitedResponse } from '../_shared/security.ts';
import { sendPushToUser } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-session-token',
};

const MAX_TOKEN_LENGTH = 4096;

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
    const { action, token, taskId } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const session = await resolveSession(supabase, req);
    if (!session) return unauthorizedResponse(corsHeaders);
    if (!(await checkRateLimit(supabase, `push:${session.userId}`, 30, 60))) {
      return rateLimitedResponse(corsHeaders);
    }

    if (action === 'register' || action === 'unregister') {
      if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
        return json({ error: 'Token inválido' }, 400);
      }
      if (action === 'unregister') {
        const { error } = await supabase.from('device_tokens').delete().eq('token', token).eq('user_id', session.userId);
        if (error) throw error;
        return json({ ok: true });
      }
      const { error } = await supabase.from('device_tokens').upsert({
        token,
        user_id: session.userId,
        platform: 'android',
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'task-assigned') {
      if (typeof taskId !== 'string') return json({ error: 'Falta taskId' }, 400);
      const { data: task, error } = await supabase
        .from('tasks')
        .select('user_id, assigned_by')
        .eq('id', taskId)
        .maybeSingle();
      if (error) throw error;
      if (!task || task.assigned_by !== session.userId) return json({ error: 'Tarea no encontrada' }, 404);
      await sendPushToUser(supabase, task.user_id as string, 'task');
      return json({ ok: true });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (err) {
    console.error('push failed:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
