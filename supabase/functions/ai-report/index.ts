import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DISCLAIMER = 'La interpretación clínica final corresponde siempre al profesional (Rubén Salguero).';

const REPORT_PROMPT = [
  'Eres un asistente analítico que apoya al terapeuta Rubén Salguero generando reportes diarios de pacientes.',
  'Recibirás los registros de ánimo (check-ins) y los mensajes del chat de acompañamiento de un paciente en un día.',
  'Devuelve EXCLUSIVAMENTE un JSON válido con esta forma:',
  '{"mood_summary": "texto", "keywords": ["palabra1","palabra2"], "suggestions": "texto"}',
  '- mood_summary: resumen breve del estado emocional del día (2-4 frases).',
  '- keywords: 3-8 palabras clave o patrones detectados (emociones, temas, riesgos).',
  '- suggestions: 2-4 sugerencias de enfoque terapéutico para la próxima sesión.',
  'No incluyas la cláusula de descargo en el JSON; se añade en el frontend.',
  'Si no hay datos suficientes, responde con mood_summary="Sin datos suficientes para el día.", keywords=[], suggestions="Continuar con el acompañamiento habitual."',
].join(' ');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { date } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: 'Fecha inválida (esperado YYYY-MM-DD)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find all patients with activity on this date
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    const [checkinsRes, chatsRes, existingRes] = await Promise.all([
      supabase.from('checkins').select('id, user_id, mood, message, created_at').gte('created_at', start).lte('created_at', end),
      supabase.from('chat_logs').select('id, user_id, role, content, created_at').gte('created_at', start).lte('created_at', end),
      supabase.from('ai_reports').select('user_id').eq('report_date', date),
    ]);
    if (checkinsRes.error || chatsRes.error || existingRes.error) {
      throw new Error(checkinsRes.error?.message || chatsRes.error?.message || existingRes.error?.message);
    }

    const checkins = checkinsRes.data ?? [];
    const chats = chatsRes.data ?? [];
    const already = new Set((existingRes.data ?? []).map((r) => r.user_id));

    const activeIds = new Set<string>([...checkins.map((c) => c.user_id), ...chats.map((c) => c.user_id)]);
    const pending = [...activeIds].filter((id) => !already.has(id));

    if (pending.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: 'No hay pacientes pendientes para esta fecha.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const reports: { user_id: string; report_date: string; mood_summary: string; keywords: string[]; suggestions: string; raw_context: Record<string, unknown> }[] = [];

    for (const userId of pending) {
      const userCheckins = checkins.filter((c) => c.user_id === userId);
      const userChats = chats.filter((c) => c.user_id === userId);

      const contextText = [
        userCheckins.length > 0
          ? `Check-ins del día:\n${userCheckins.map((c) => `- Ánimo ${c.mood}/5: ${c.message || '(sin mensaje)'}`).join('\n')}`
          : 'Sin check-ins el día.',
        userChats.length > 0
          ? `Mensajes del chat de acompañamiento:\n${userChats.map((c) => `${c.role === 'user' ? 'Paciente' : 'Asistente'}: ${c.content}`).join('\n')}`
          : 'Sin mensajes de chat el día.',
      ].join('\n\n');

      let parsed: { mood_summary: string; keywords: string[]; suggestions: string };

      if (!apiKey) {
        // Deterministic fallback when no AI key is configured
        const moods = userCheckins.map((c) => c.mood);
        const avg = moods.length ? (moods.reduce((s, m) => s + m, 0) / moods.length) : 0;
        parsed = {
          mood_summary: avg
            ? `Ánimo promedio del día: ${avg.toFixed(1)}/5 a partir de ${userCheckins.length} registro(s). ${userChats.length ? `Se registraron ${userChats.length} mensajes de acompañamiento.` : 'Sin interacción de chat.'}`
            : 'Sin check-ins el día. Actividad limitada al chat de acompañamiento.',
          keywords: moods.length ? [`ánimo ${avg.toFixed(1)}`, userCheckins.length > 1 ? 'varios registros' : 'un registro'] : ['sin check-ins'],
          suggestions: 'Continuar con el acompañamiento habitual y revisar el contexto en la próxima sesión.',
        };
      } else {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: REPORT_PROMPT },
              { role: 'user', content: contextText },
            ],
            temperature: 0.4,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          }),
        });
        if (!aiRes.ok) {
          const txt = await aiRes.text().catch(() => '');
          throw new Error(`OpenAI ${aiRes.status}: ${txt.slice(0, 200)}`);
        }
        const aiJson = await aiRes.json();
        const content = aiJson.choices?.[0]?.message?.content ?? '';
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = { mood_summary: content || 'Sin resumen disponible.', keywords: [], suggestions: 'Revisar manualmente.' };
        }
      }

      reports.push({
        user_id: userId,
        report_date: date,
        mood_summary: parsed.mood_summary || 'Sin resumen.',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
        suggestions: parsed.suggestions || 'Continuar con el acompañamiento habitual.',
        raw_context: { checkins: userCheckins.length, chats: userChats.length, disclaimer: DISCLAIMER },
      });
    }

    // Insert reports (upsert on conflict)
    if (reports.length > 0) {
      const { error: insErr } = await supabase.from('ai_reports').upsert(reports, { onConflict: 'user_id,report_date' });
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ generated: reports.length, disclaimer: DISCLAIMER }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
