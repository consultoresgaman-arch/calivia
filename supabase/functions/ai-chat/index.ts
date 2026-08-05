import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SYSTEM_PROMPT = [
  'Eres el asistente emocional de "Calivia", un refugio digital.',
  'Actúas como un regulador externo y un espejo seguro para la persona.',
  '',
  'TONO: Cálido, profundamente humano, cercano. Frases breves y directas.',
  'PRIORIZA la validación emocional inmediata antes que cualquier consejo.',
  'Ejemplo de validación: "Es normal que sientas el pecho oprimido ahora mismo".',
  '',
  'REGLAS ESTRICTAS:',
  'CERO discursos teóricos largos. Máximo 2-3 frases por respuesta.',
  'CERO diagnósticos. No evalúas patologías ni sugieres medicación.',
  'CERO tonos robóticos o condescendientes. Habla como un humano que realmente se preocupa.',
  'CERO listas o pasos numerados. Solo conversación natural.',
  'CERO frases de manual como "comprendo cómo te sientes" — usa lenguaje fresco y auténtico.',
  '',
  'MÉTODO:',
  '1. Primero valida lo que siente la persona en una frase breve y directa.',
  '2. Luego haz UNA pregunta corta que la ayude a bajar al cuerpo o al momento presente.',
  '3. NO des soluciones prematuras. Solo contiene y refleja.',
  '',
  'RIESGO: Si detectas riesgo inmediato (autolesión, ideación suicida), mantén la calma,',
  'valida, y reconduce suavemente a usar el botón de respiro urgente o contactar a alguien de confianza.',
  '',
  'DERIVACIÓN: Si pide ayuda profesional, comparte: https://calendly.com/consultoresgaman/30min',
].join('\n');

const FALLBACK_REPLIES = [
  'Es normal que sientas eso ahora mismo. Quédate aquí. ¿Puedes notar dónde lo sientes en el cuerpo?',
  'Te escucho. Eso que sientes pesa, y tiene sentido que pese. ¿Cómo está tu respiración ahora?',
  'Lo que me cuentas es difícil. No tienes que resolverlo en este momento. ¿Qué necesitas ahora mismo, hablar o solo estar aquí?',
  'Gracias por decirlo. Eso requiere valor. ¿Puedes poner una mano en el pecho y sentir cómo sube y baja?',
  'Entiendo. Estás cargando mucho. Permítete soltar un poco. ¿Qué parte del cuerpo está más tensa?',
];

function pickFallback(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('pecho') || lower.includes('oprim') || lower.includes('ahog')) {
    return 'Es normal que sientas el pecho oprimido ahora mismo. Tu cuerpo te está diciendo algo. ¿Puedes respirar lento conmigo, solo una?';
  }
  if (lower.includes('miedo') || lower.includes('ansied') || lower.includes('panico') || lower.includes('pánico')) {
    return 'El miedo te recorre entero, lo sé. Estás a salvo en este momento. ¿Puedes mirar a tu alrededor y nombrar tres cosas que ves?';
  }
  if (lower.includes('triste') || lower.includes('solo') || lower.includes('llorar') || lower.includes('vacio') || lower.includes('vacío')) {
    return 'Lo que sientes es real y tiene peso. No estás solo en esto. ¿Puedes dejar que salga lo que necesite salir, sin pelearlo?';
  }
  if (lower.includes('cansado') || lower.includes('agotado') || lower.includes('no puedo más') || lower.includes('no puedo mas')) {
    return 'Se nota que estás al límite. Está bien decir basta. ¿Qué pasaría si por hoy solo descansas, sin más?';
  }
  if (lower.includes('diagnóstico') || lower.includes('diagnostico') || lower.includes('tengo algo')) {
    return 'No puedo darte un diagnóstico, pero puedo acompañarte. Para una evaluación profesional: https://calendly.com/consultoresgaman/30min';
  }
  if (lower.includes('suicid') || lower.includes('hacerme daño') || lower.includes('no quiero seguir')) {
    return 'Lo que me cuentas me importa mucho. Estoy contigo. Ahora mismo necesitas sostén humano: usa el botón de respiro urgente o llama a alguien de confianza. Tu vida importa.';
  }
  return FALLBACK_REPLIES[msg.length % FALLBACK_REPLIES.length];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { userId, message } = await req.json();
    if (!userId || !message) {
      return new Response(JSON.stringify({ error: 'Faltan userId o message' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: history, error: histErr } = await supabase
      .from('chat_logs')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(10);
    if (histErr) throw histErr;

    const convo = (history ?? []).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      const fallback = pickFallback(message);
      await supabase.from('chat_logs').insert({ user_id: userId, role: 'assistant', content: fallback });
      return new Response(JSON.stringify({ reply: fallback, fallback: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...convo,
      { role: 'user', content: message },
    ];

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7, max_tokens: 150 }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => '');
      throw new Error(`OpenAI ${aiRes.status}: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const reply: string = aiJson.choices?.[0]?.message?.content?.trim() || '';
    if (!reply) throw new Error('Respuesta vacía de la IA.');

    await supabase.from('chat_logs').insert({ user_id: userId, role: 'assistant', content: reply });
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
