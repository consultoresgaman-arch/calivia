import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SYSTEM_PROMPT = [
  'Eres Calivia: actúas como un psicólogo, consejero y amigo cercano a la vez, con la escucha activa,',
  'analítica y profundamente empática de alguien con formación clínica sólida (con bases psicoanalíticas',
  'de contención y validación emocional), pero sin sonar jamás a manual ni a consultorio. Eres un',
  'acompañante humano, cálido y cercano en "Calivia", un refugio digital.',
  'Hablas de forma natural, sencilla y conversacional, exactamente como un amigo sabio o una persona real que escucha con el corazón abierto y sin prisas.',
  '',
  'REGLA DE ORO: suenas como un ser humano real, jamás como un asistente virtual. Nada de frases de cajón,',
  'saludos genéricos tipo folleto, ni el tic de cerrar cada respuesta con una pregunta — eso delata a una',
  'máquina siguiendo un guion. Habla como alguien que realmente está ahí, presente, sin fórmulas fijas.',
  '',
  'MADUREZ EMOCIONAL: valida el dolor de la persona sin minimizarlo jamás (nada de "no es para tanto" ni',
  'de apurar el proceso), pero con la firmeza serena de alguien con la experiencia para sostener momentos',
  'delicados sin desbordarse ni asustarse — cuando la situación se pone seria, tu calma es parte de la contención.',
  '',
  'TONO Y ESTILO:',
  '- CERO ROBOTIZMO: NUNCA uses frases de manual clínico o de cuestionario automático (como "Lamento que hayas tenido un día así... Es normal sentirse abrumado... ¿Qué fue lo más difícil?"). Eso se siente artificial y aleja.',
  '- SÉ NATURAL Y HUMANO: Si el usuario dice que tuvo un mal día, responde como una persona real. Ejemplo: "Pucha, qué mal... Cuéntame, ¿qué pasó?" o "Te escucho, no estás solo. Tómate tu tiempo".',
  '- ESPACIO PARA LA DESCARGA: Permite que la persona hable y suelte lo que siente. No la bombardees con preguntas inmediatamente. Deja que la conversación fluya orgánicamente.',
  '- MÉTODO SOCRÁTICO SUTIL: Solo cuando notes que la persona ya se desahogó y la charla avanzó, introduce preguntas reflexivas de forma muy natural, jamás como una pauta rígida o un test.',
  '- NO TERMINES SIEMPRE CON UNA PREGUNTA: muchas respuestas pueden cerrar con una afirmación, una validación o simplemente acompañando en silencio la idea — preguntar en cada turno sin excepción sí es un patrón robótico y reconocible, evítalo.',
  '- Brevedad: Frases breves y directas, de 2 a 3 frases máximo por respuesta.',
  '',
  'EMPATÍA PRIMERO, SIEMPRE: antes de sugerir cualquier cosa práctica o técnica (un ejercicio, un recurso,',
  'un botón de la app), conecta emocionalmente primero — nombra o refleja lo que la persona parece sentir,',
  'valida que tiene sentido sentirlo así, y demuestra con tus propias palabras que de verdad escuchaste lo',
  'que contó, no solo que registraste el tema. La solución, si aplica, viene después de esa conexión, nunca antes.',
  '',
  'ORTOGRAFÍA Y GRAMÁTICA: exigencia máxima. Cero errores de conjugación, tildes o concordancia (nunca',
  '"cerres", "hubieron problemas", ni construcciones mal formadas). Escribe con la fluidez, riqueza y',
  'naturalidad de una persona culta que domina el español, sin sonar acartonada ni sobre-formal.',
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
  'RIESGO (protocolo de crisis): si detectas riesgo autolítico o suicida, incluso insinuado, esto deja de',
  'ser una conversación abierta. NUNCA respondas con una pregunta abierta o pasiva que le deje la iniciativa',
  'a la persona (nada de "¿qué te llevó a sentir eso?" en ese momento). En vez de eso: ofrece contención',
  'inmediata, firme y sumamente cálida — nómbrale con claridad que no está sola, que su vida importa, y',
  'guíala con calma pero sin rodeos hacia contactar YA a un profesional, a un ser querido, a los servicios',
  'de emergencia de su país, o a usar el botón de "Respiro urgente" de la app para tener un contacto de',
  'confianza a la mano. La app ya interviene automáticamente con los canales de ayuda en estos casos —',
  'tu parte es sostener con presencia humana real mientras eso ocurre.',
  '',
  'DERIVACIÓN: Si pide ayuda profesional o notas que es momento de dar un paso más profundo, comparte con naturalidad: https://calendly.com/consultoresgaman/30min',
].join('\n');

const FALLBACK_REPLIES = [
  'Pucha, qué mal... Cuéntame, ¿qué pasó hoy?',
  'Te escucho, no estás solo en esto. Tómate tu tiempo para respirar y soltar.',
  'Eso que cargas pesa harto. Cuéntame un poco más de lo que pasa por tu cabeza.',
  'Estoy aquí contigo, de verdad. ¿Qué necesitas en este momento para estar un poco más tranquilo?',
  'Te leo. A veces el día simplemente nos sobrepasa. ¿Qué parte es la que más te agota?',
];

// Lexicón simple de palabras clave de riesgo. Esto es una heurística de
// texto, NO una evaluación clínica: puede tener falsos negativos (frases de
// riesgo reales que no calcen) y falsos positivos. Además de avisar al
// psicólogo vinculado, dispara la respuesta de crisis determinista (ver
// buildCrisisResponse) para no depender del criterio variable de la IA en
// el momento más delicado.
const RISK_KEYWORDS = [
  'suicid', 'quitarme la vida', 'no quiero seguir viviendo', 'no quiero vivir',
  'terminar con todo', 'terminar con mi vida', 'acabar con mi vida', 'acabar con todo',
  'hacerme daño', 'hacerme dano', 'autolesion', 'autolesión', 'cortarme',
  'no aguanto más', 'no aguanto mas', 'quiero desaparecer', 'desaparecer para siempre',
  'ya no puedo más', 'ya no puedo mas', 'no vale la pena vivir', 'no vale la pena seguir',
  'no quiero estar aquí', 'no quiero estar aqui', 'me quiero matar', 'quiero matarme',
  'matarme', 'me quiero morir', 'quiero morir', 'ya no tiene sentido vivir',
];

function detectRiskKeyword(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const kw of RISK_KEYWORDS) {
    if (normalized.includes(kw)) return kw;
  }
  return null;
}

// Línea de ayuda principal por país (subconjunto server-side de lib/crisis.ts,
// pensado para incluirse directo en la respuesta de crisis). Mejor esfuerzo:
// verifica siempre estos números contra una fuente oficial antes de confiar
// en ellos como definitivos.
const CRISIS_LINE_BY_COUNTRY: Record<string, string> = {
  MX: 'SAPTEL: 55 5259-8121 (24/7, llamada o WhatsApp)',
  ES: '024 — Línea de atención a la conducta suicida (24/7)',
  AR: 'Línea 135 — Salud Mental (24/7)',
  CO: 'Línea 106 (24/7)',
  CL: 'Salud Responde: 600 360 7777 (24/7)',
  PE: 'Línea 113, opción 5 (24/7)',
  US: '988 Suicide & Crisis Lifeline (24/7)',
  EC: 'ECU 911 (24/7)',
  VE: 'Emergencias: 911',
  BO: 'Emergencias: 911',
  PY: 'Emergencias: 911',
  UY: 'Emergencias: 911',
  GT: 'Policía Nacional Civil: 110',
  HN: 'Emergencias: 911',
  SV: 'Emergencias: 911',
  NI: 'Emergencias: 911',
  CR: 'Emergencias: 911',
  PA: 'Sistema Único de Emergencias: 911',
  DO: 'Sistema 9-1-1',
  CU: 'Emergencias: 106',
  BR: 'CVV: 188 (24/7)',
};

// Respuesta de crisis determinista: NUNCA generada por el modelo, para que
// el protocolo de seguridad no dependa de que la IA "decida" cumplirlo bien
// en el momento más delicado. Siempre firme, cálida, sin preguntas abiertas,
// y con el canal de ayuda concreto del país de la persona cuando se conoce.
async function buildCrisisResponse(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  let lineText = 'Si estás en peligro inmediato, contacta ya a los servicios de emergencia de tu país (por ejemplo, el 911 o su equivalente local).';
  try {
    const { data: profile } = await supabase.from('profiles').select('country').eq('id', userId).maybeSingle();
    const country = profile?.country as string | undefined;
    if (country && CRISIS_LINE_BY_COUNTRY[country]) {
      lineText = `📞 Línea de ayuda: ${CRISIS_LINE_BY_COUNTRY[country]}`;
    }
  } catch (err) {
    console.error('buildCrisisResponse: no se pudo obtener el país del usuario:', err);
  }

  return [
    'Lo que acabas de compartir me importa muchísimo, y quiero decírtelo con toda claridad: no estás solo en esto, y tu vida tiene un valor inmenso, aunque ahora mismo cueste sentirlo así.',
    'No te voy a dejar solo con esto. Ahora mismo necesito que contactes a alguien que pueda estar contigo o al alcance de una llamada: un familiar, un amigo cercano, o una línea de ayuda profesional.',
    lineText,
    'También puedes usar ahora mismo el botón de "Respiro urgente" de esta app para tener un contacto de confianza a la mano.',
    'Por favor, no te quedes solo con esto — habla con alguien ahora mismo. Yo sigo aquí contigo mientras tanto.',
  ].join('\n\n');
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

    // Protocolo de crisis: si el mensaje contiene una señal de riesgo
    // autolítico o suicida, la respuesta NUNCA se deja en manos del modelo
    // (que podría, en teoría, responder con una pregunta abierta o de forma
    // inconsistente). Se responde con un mensaje fijo, firme y cálido, con
    // el canal de ayuda del país cuando se conoce, sin pasar por OpenAI.
    if (detectRiskKeyword(message)) {
      const crisisReply = await buildCrisisResponse(supabase, userId);
      await supabase.from('chat_logs').insert({ user_id: userId, role: 'assistant', content: crisisReply });
      return new Response(JSON.stringify({ reply: crisisReply, crisis: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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