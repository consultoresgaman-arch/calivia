import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SYSTEM_PROMPT = [
  'Eres un acompañante humano, cálido, cercano y profundamente empático en "Calivia", un refugio digital.',
  'Hablas de forma natural, sencilla y conversacional, exactamente como un amigo sabio o una persona real que escucha con el corazón abierto y sin prisas.',
  '',
  'TONO Y ESTILO:',
  '- CERO ROBOTIZMO: NUNCA uses frases de manual clínico o de cuestionario automático (como "Lamento que hayas tenido un día así... Es normal sentirse abrumado... ¿Qué fue lo más difícil?"). Eso se siente artificial y aleja.',
  '- SÉ NATURAL Y HUMANO: Si el usuario dice que tuvo un mal día, responde como una persona real. Ejemplo: "Pucha, qué mal... Cuéntame, ¿qué pasó?" o "Te escucho, no estás solo. Tómate tu tiempo".',
  '- ESPACIO PARA LA DESCARGA: Permite que la persona hable y suelte lo que siente. No la bombardees con preguntas inmediatamente. Deja que la conversación fluya orgánicamente.',
  '- MÉTODO SOCRÁTICO SUTIL: Solo cuando notes que la persona ya se desahogó y la charla avanzó, introduce preguntas reflexivas de forma muy natural, jamás como una pauta rígida o un test.',
  '- Brevedad: Frases breves y directas, de 2 a 3 frases máximo por respuesta.',
  '',
  'REGLAS ESTRICTAS:',
  '- CERO discursos teóricos largos.',
  '- CERO diagnósticos. No evalúas patologías ni sugieres medicación.',
  '- CERO tonos condescendientes o frases de manual como "comprendo cómo te sientes" — usa lenguaje fresco y auténtico.',
  '- CERO listas o pasos numerados. Solo conversación humana.',
  '',
  'TRATO: Siempre de "tú", nunca de "usted". Prohibido terminantemente diagnosticar o usar',
  'etiquetas clínicas (nada de "eso suena a depresión", "tienes síntomas de ansiedad", etc.),',
  'incluso si la persona te lo pide directamente — redirige con calidez, nunca con un rótulo.',
  '',
  'PROTOCOLO DE ANGUSTIA (desahogo vs. distracción): Cuando sientas carga emocional alta,',
  'ofrece con naturalidad dos caminos y respeta al cien por ciento cuál elija la persona, sin',
  'insistir en el otro: (a) seguir soltando todo lo que necesite contigo, sin editarse, o (b) tomar',
  'distancia un momento con algo más sensorial —los sonidos de anclaje, un juego, o el ejercicio de',
  'vibración— y volver después si quiere. Pregúntalo como algo genuino, por ejemplo: "¿prefieres',
  'seguir contándome, o prefieres soltarlo un rato con algo más del cuerpo, como respirar o los',
  'sonidos?" Lo que responda es lo que sigue. Nunca lo cuestiones ni lo redirijas al otro camino.',
  '',
  'PROTOCOLO DE ESPERA: Si un mensaje llega muy corto o cortado, como si la persona siguiera',
  'escribiendo, no lo analices ni respondas largo todavía — la app ya agrupa los mensajes seguidos y',
  'solo te los pasa cuando la persona hizo una pausa real. Cuando te llega el mensaje, asume que es',
  'porque terminó de decir lo que traía por ahora, y ahí sí respondes con calma.',
  '',
  'RIESGO: Si detectas riesgo inmediato (autolesión, ideación suicida), mantén la calma, muestra cercanía humana real, valida y reconduce suavemente a usar el botón de respiro urgente o contactar a alguien de confianza.',
  '',
  'DERIVACIÓN: Si pide ayuda profesional o notas que es momento de dar un paso más profundo, comparte con naturalidad: https://calendly.com/consultoresgaman/30min',
].join('\n');

const FALLBACK_REPLIES = [
  'Pucha, qué mal... Cuéntame, ¿qué pasó hoy?',
  'Te escucho, no estás solo en esto. Tómate tu tiempo para respirar y soltar.',
  'Eso que cargpes pesa harto. ¿Quieres contarme un poco más de lo que pasa por tu cabeza?',
  'Estoy aquí contigo, de verdad. ¿Qué necesitas en este momento para estar un poco más tranquilo?',
  'Te leo. A veces el día simplemente nos sobrepasa. ¿Qué parte es la que más te agota?',
];

// Lexicón simple de palabras clave de riesgo. Esto es una heurística de
// texto, NO una evaluación clínica: puede tener falsos negativos (frases de
// riesgo reales que no calcen) y falsos positivos. Sirve para avisar al
// psicólogo vinculado, nunca para decidir nada por sí sola.
const RISK_KEYWORDS = [
  'suicid', 'quitarme la vida', 'no quiero seguir viviendo', 'no quiero vivir',
  'terminar con todo', 'terminar con mi vida', 'hacerme daño', 'hacerme dano',
  'autolesion', 'autolesión', 'cortarme', 'no aguanto más', 'no aguanto mas',
  'quiero desaparecer', 'ya no puedo más', 'ya no puedo mas', 'no vale la pena vivir',
  'no quiero estar aquí', 'no quiero estar aqui',
];

function detectRiskKeyword(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const kw of RISK_KEYWORDS) {
    if (normalized.includes(kw)) return kw;
  }
  return null;
}

// Best-effort: si falla cualquier paso acá, no debe romper el chat.
async function maybeCreateRiskAlert(supabase: ReturnType<typeof createClient>, userId: string, message: string) {
  try {
    const matched = detectRiskKeyword(message);
    if (!matched) return;
    const { data: link } = await supabase
      .from('patient_links')
      .select('psychologist_id')
      .eq('patient_id', userId)
      .maybeSingle();
    if (!link) return;
    await supabase.from('risk_alerts').insert({
      patient_id: userId,
      psychologist_id: link.psychologist_id,
      reason: `Palabra clave de riesgo detectada: "${matched}"`,
      message_excerpt: message.slice(0, 200),
    });
  } catch (err) {
    console.error('maybeCreateRiskAlert failed:', err);
  }
}

function pickFallback(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('pecho') || lower.includes('oprim') || lower.includes('ahog')) {
    return 'Pucha, se siente feo cuando el pecho se aprieta así. Quédate aquí conmigo, respira hondo y dime si puedes notar dónde pesa más.';
  }
  if (lower.includes('miedo') || lower.includes('ansied') || lower.includes('panico') || lower.includes('pánico')) {
    return 'El miedo recorre todo el cuerpo, lo sé bien. Pero aquí estás seguro. ¿Ves algo a tu alrededor que te ayude a volver al presente?';
  }
  if (lower.includes('triste') || lower.includes('solo') || lower.includes('llorar') || lower.includes('vacio') || lower.includes('vacío')) {
    return 'Ese vacío pesa un montón. Deja que salga lo que tenga que salir, no tienes que disimular conmigo.';
  }
  if (lower.includes('cansado') || lower.includes('agotado') || lower.includes('no puedo más') || lower.includes('no puedo mas')) {
    return 'Se nota que estás al límite de tus fuerzas. Está bien parar un segundo. ¿Qué pasaría si por ahora solo te permites descansar?';
  }
  if (lower.includes('diagnóstico') || lower.includes('diagnostico') || lower.includes('tengo algo')) {
    return 'No puedo darte un diagnóstico, pero sí acompañarte de cerca. Si quieres dar el paso con un profesional, puedes agendar acá: https://calendly.com/consultoresgaman/30min';
  }
  if (lower.includes('suicid') || lower.includes('hacerme daño') || lower.includes('no quiero seguir')) {
    return 'Lo que me dices me importa muchísimo y no estás solo. Por favor, usa el botón de respiro urgente de la app o habla con alguien de confianza ahora mismo. Tu vida vale.';
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

    await maybeCreateRiskAlert(supabase, userId, message);

    const { data: history, error: histErr } = await supabase
      .from('chat_logs')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(10);
    if (histErr) throw histErr;

    const convo = (history ?? []).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    // Memoria entre sesiones: los reportes diarios ya resumen patrones de
    // ánimo y palabras clave. Se los pasamos como contexto silencioso para
    // que mantenga continuidad, nunca para que los recite o los mencione
    // como fuente ("según tus reportes...").
    let memoryContext = '';
    const { data: pastReports } = await supabase
      .from('ai_reports')
      .select('report_date, mood_summary, keywords')
      .eq('user_id', userId)
      .order('report_date', { ascending: false })
      .limit(5);
    if (pastReports && pastReports.length > 0) {
      const lines = pastReports.map((r) =>
        `- ${r.report_date}: ${r.mood_summary}${r.keywords?.length ? ` (patrones: ${r.keywords.join(', ')})` : ''}`
      );
      memoryContext = [
        '',
        'MEMORIA DE SESIONES ANTERIORES (contexto interno para continuidad; NUNCA la recites ni digas frases como "según tus reportes" — solo úsala para comprender mejor a la persona de forma natural):',
        ...lines,
      ].join('\n');
    }

    if (!apiKey) {
      const fallback = pickFallback(message);
      await supabase.from('chat_logs').insert({ user_id: userId, role: 'assistant', content: fallback });
      return new Response(JSON.stringify({ reply: fallback, fallback: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + memoryContext },
      ...convo,
      { role: 'user', content: message },
    ];

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.8, max_tokens: 150 }),
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