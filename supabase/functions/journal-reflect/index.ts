import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { resolveSession, checkRateLimit, unauthorizedResponse, rateLimitedResponse } from '../_shared/security.ts';
import { detectRiskKeyword, buildCrisisResponse, maybeCreateRiskAlert, normalizeCrisisLang, type Lang } from '../_shared/crisis.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-session-token',
};

const MAX_CONTENT_LENGTH = 10000;
const DAILY_REFLECTION_LIMIT = 5;

// Las versiones 1.32 y anteriores muestran `reflection` tras guardar. El diario ya
// no responde solo: reciben esta confirmación en lugar de una reflexión.
const SAVED_MESSAGE: Record<Lang, string> = {
  es: 'Tu escrito quedó guardado en tu diario.',
  en: 'Your writing was saved in your journal.',
  pt: 'Seu texto foi salvo no seu diário.',
};

const REFLECTION_PROMPT = [
  'Eres Calivia, un acompañante cálido y humano. La persona escribió en su diario, de corrido y sin',
  'editarse, lo que la abruma, y ahora te pide una reflexión breve sobre ese escrito.',
  '',
  'Responde con 2 a 4 frases, en "tú". Valida lo que siente y refleja lo esencial de lo que escribió,',
  'sin sermones, sin soluciones apresuradas, sin diagnósticos ni etiquetas clínicas, sin listas.',
  'Cierra con calidez, sin una pregunta que le exija más ahora. Responde solo con la reflexión.',
].join('\n');

// Escrito con señal de riesgo: la reflexión se da igual, como contención. El modelo
// solo acompaña; los teléfonos y la ayuda los pone siempre el protocolo determinista
// (buildCrisisResponse), nunca la IA.
const CONTAINMENT_PROMPT = [
  'Eres Calivia, un acompañante cálido y humano. La persona escribió en su diario algo que muestra un',
  'dolor muy intenso, posiblemente con ideas de hacerse daño o de no querer seguir, y te pide una reflexión.',
  '',
  'Responde con 3 a 4 frases, en "tú", con un tono sereno y contenedor:',
  '- Agradece que lo haya puesto en palabras y valida lo que siente, sin minimizarlo ni dramatizarlo.',
  '- Refleja con suavidad lo esencial de lo que escribió, sin repetir detalles de daño ni de métodos.',
  '- Recuérdale que no tiene que cargar esto en soledad y que hablar ahora con alguien de confianza o con',
  '  una línea de ayuda puede aliviar; invítala a respirar contigo un momento.',
  'Nunca des instrucciones, juicios, diagnósticos, sermones ni listas, y no menciones números de teléfono',
  '(la app los muestra aparte). Responde solo con la reflexión.',
].join('\n');

const CONTAINMENT_FALLBACK: Record<Lang, string> = {
  es: 'Gracias por ponerlo en palabras; se nota que estás cargando un dolor muy grande, y lo que sientes importa. No tienes que sostenerlo en soledad: hablar ahora con alguien de confianza o con una línea de ayuda puede aliviar un poco. Si quieres, respira conmigo un momento, lento, sin apuro.',
  en: "Thank you for putting this into words; you're carrying a very heavy pain, and what you feel matters. You don't have to hold it alone: talking now with someone you trust or with a helpline can ease it a little. If you'd like, breathe with me for a moment, slowly, with no rush.",
  pt: 'Obrigada por colocar isso em palavras; dá para ver que você carrega uma dor muito grande, e o que sente importa. Você não precisa segurar isso sem companhia: falar agora com alguém de confiança ou com uma linha de ajuda pode aliviar um pouco. Se quiser, respire comigo um momento, devagar, sem pressa.',
};

const LANGUAGE_DIRECTIVE: Record<Lang, string> = {
  es: '',
  en: '\n\nResponde SIEMPRE en inglés, con el mismo tono cálido y natural.',
  pt: '\n\nResponde SIEMPRE en portugués, con el mismo tono cálido y natural.',
};

const LIMIT_MESSAGE: Record<Lang, string> = {
  es: 'Llegaste al límite de reflexiones de hoy. Mañana podrás pedir más.',
  en: "You've reached today's reflection limit. You can ask for more tomorrow.",
  pt: 'Você atingiu o limite de reflexões de hoje. Amanhã poderá pedir mais.',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Supabase = ReturnType<typeof createClient>;

// Guardar: el texto se guarda tal cual y no se envía a la IA. La única excepción
// es el protocolo de crisis, que sigue activo.
async function saveEntry(supabase: Supabase, userId: string, content: string, lang: Lang): Promise<Response> {
  if (!content) return json({ error: 'Falta content' }, 400);
  if (content.length > MAX_CONTENT_LENGTH) return json({ error: 'El texto es demasiado largo' }, 413);

  const { data: entry, error: insertErr } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, content })
    .select('id, content, created_at, ai_reflection, suggested_tool')
    .single();
  if (insertErr) throw insertErr;

  if (detectRiskKeyword(content)) {
    const alertTask = maybeCreateRiskAlert(supabase, userId, content);
    const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
    if (typeof waitUntil === 'function') waitUntil(alertTask);
    else await alertTask;

    const crisisReply = await buildCrisisResponse(supabase, userId, lang);
    return json({ saved: true, entry, crisis: true, crisisReply, reflection: crisisReply, suggestedTool: 'none', toolReason: '' });
  }

  return json({ saved: true, entry, reflection: SAVED_MESSAGE[lang], suggestedTool: 'none', toolReason: '' });
}

// La 1.34 solo muestra `reflection` cuando hay crisis: ahí va la contención junto a
// la ayuda. Las versiones nuevas usan `containment` y `crisisReply` por separado.
function reflectionResponse(reflection: string, crisisReply: string | undefined): Response {
  if (!crisisReply) return json({ reflection });
  return json({ reflection: `${reflection}\n\n${crisisReply}`, containment: reflection, crisisReply, crisis: true });
}

async function generateReflection(systemPrompt: string, content: string): Promise<string | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return null;
  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.6,
      max_tokens: 240,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!aiRes.ok) {
    console.error('journal-reflect: OpenAI', aiRes.status, (await aiRes.text().catch(() => '')).slice(0, 200));
    return null;
  }
  const aiJson = await aiRes.json();
  const text: string = aiJson.choices?.[0]?.message?.content?.trim() || '';
  return text || null;
}

// Reflexión a pedido: solo entonces el escrito se envía a OpenAI. Las reflexiones
// pedidas se guardan con suggested_tool NULL; las automáticas antiguas lo tienen
// relleno y la app no las muestra.
async function reflectOnEntry(supabase: Supabase, userId: string, entryId: unknown, lang: Lang): Promise<Response> {
  if (typeof entryId !== 'string') return json({ error: 'Falta entryId' }, 400);

  const { data: entry, error: entryErr } = await supabase
    .from('journal_entries')
    .select('id, user_id, content, ai_reflection, suggested_tool')
    .eq('id', entryId)
    .maybeSingle();
  if (entryErr) throw entryErr;
  if (!entry || entry.user_id !== userId) return json({ error: 'Escrito no encontrado' }, 404);

  const content = entry.content as string;
  const risk = Boolean(detectRiskKeyword(content));
  // Con riesgo, la ayuda acompaña siempre a la reflexión, también a una ya guardada.
  const crisisReply = risk ? await buildCrisisResponse(supabase, userId, lang) : undefined;

  if (entry.ai_reflection && entry.suggested_tool === null) {
    return reflectionResponse(entry.ai_reflection as string, crisisReply);
  }

  let reflection: string | null;
  if (risk) {
    // La contención nunca se niega por el límite diario ni por un fallo de la IA.
    reflection = await generateReflection(CONTAINMENT_PROMPT + LANGUAGE_DIRECTIVE[lang], content).catch(() => null);
    reflection ??= CONTAINMENT_FALLBACK[lang];
  } else {
    if (!(await checkRateLimit(supabase, `journal-reflection:${userId}`, DAILY_REFLECTION_LIMIT, 86400))) {
      return json({ error: LIMIT_MESSAGE[lang], dailyLimit: true }, 429);
    }
    reflection = await generateReflection(REFLECTION_PROMPT + LANGUAGE_DIRECTIVE[lang], content);
    if (!reflection) return json({ error: 'No se pudo generar la reflexión' }, 502);
  }

  const { error: updateErr } = await supabase
    .from('journal_entries')
    .update({ ai_reflection: reflection, suggested_tool: null })
    .eq('id', entryId);
  if (updateErr) throw updateErr;

  return reflectionResponse(reflection, crisisReply);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const { userId, action, entryId, content: rawContent, lang: rawLang } = await req.json();
    const lang = normalizeCrisisLang(rawLang);
    if (!userId) return json({ error: 'Falta userId' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const session = await resolveSession(supabase, req);
    if (!session || session.userId !== userId) return unauthorizedResponse(corsHeaders);
    if (!(await checkRateLimit(supabase, `journal-reflect:${userId}`, 20, 60))) {
      return rateLimitedResponse(corsHeaders);
    }

    if (action === 'reflect') return await reflectOnEntry(supabase, userId, entryId, lang);
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    return await saveEntry(supabase, userId, content, lang);
  } catch (err) {
    console.error('journal-reflect failed:', err);
    return json({ error: 'Error interno' }, 500);
  }
});
