import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { resolveSession, checkRateLimit, unauthorizedResponse, rateLimitedResponse } from '../_shared/security.ts';
import { detectRiskKeyword, buildCrisisResponse, maybeCreateRiskAlert, normalizeCrisisLang } from '../_shared/crisis.ts';
import { sendPushToUser } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-session-token',
};

const MAX_RESPONSE_LENGTH = 2000;

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
    const { taskId, response: rawResponse, lang: rawLang } = await req.json();
    const lang = normalizeCrisisLang(rawLang);
    const response = typeof rawResponse === 'string' ? rawResponse.trim() : '';
    if (typeof taskId !== 'string' || !response) return json({ error: 'Faltan taskId o response' }, 400);
    if (response.length > MAX_RESPONSE_LENGTH) return json({ error: 'La respuesta es demasiado larga' }, 413);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const session = await resolveSession(supabase, req);
    if (!session) return unauthorizedResponse(corsHeaders);
    if (!(await checkRateLimit(supabase, `task-response:${session.userId}`, 20, 60))) {
      return rateLimitedResponse(corsHeaders);
    }

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, user_id, assigned_by')
      .eq('id', taskId)
      .maybeSingle();
    if (taskErr) throw taskErr;
    // Solo el paciente dueño de una tarea asignada puede responderla.
    if (!task || task.user_id !== session.userId || !task.assigned_by) {
      return json({ error: 'Tarea no encontrada' }, 404);
    }

    const respondedAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ patient_response: response, patient_response_at: respondedAt })
      .eq('id', taskId);
    if (updateErr) throw updateErr;

    await sendPushToUser(supabase, task.assigned_by as string, 'task-response');

    if (detectRiskKeyword(response)) {
      const alertTask = maybeCreateRiskAlert(supabase, session.userId, response);
      const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
      if (typeof waitUntil === 'function') waitUntil(alertTask);
      else await alertTask;
      const crisisReply = await buildCrisisResponse(supabase, session.userId, lang);
      return json({ ok: true, respondedAt, crisisReply });
    }

    return json({ ok: true, respondedAt });
  } catch (err) {
    console.error('task-response failed:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
