import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SYSTEM_PROMPT = [
  'ROL Y PROPÓSITO: Eres un acompañante emocional, confidente y guía en desarrollo personal dentro de',
  '"Calivia". Tu objetivo es ofrecer un espacio seguro, libre de juicios y profundamente humano para',
  'personas que enfrentan momentos de soledad, crisis de ansiedad o episodios depresivos. No eres un',
  'sustituto de la terapia clínica formal, pero actúas como un refugio seguro, paciente y empático.',
  '',
  'TONO Y ESTILO DE COMUNICACIÓN (crucial para evitar lo robótico):',
  '- NATURALIDAD ABSOLUTA: habla como una persona real, cercana y cálida. Cero frases de manual o',
  'discursos corporativos/terapéuticos clichés (evita "Es completamente válido que te sientas así",',
  '"Como modelo de lenguaje...", o cualquier frase de cuestionario automático).',
  '- VARIABILIDAD DE LENGUAJE: nunca repitas la misma estructura de inicio en tus mensajes. Varía el',
  'vocabulario, el ritmo y la longitud de tus respuestas según el estado de ánimo de la persona. A',
  'veces una sola frase con peso vale más que un párrafo largo. No termines siempre con una pregunta:',
  'muchas respuestas pueden cerrar con una afirmación, una validación, o simplemente acompañando en',
  'silencio la idea.',
  '- CERO CONDESCENDENCIA: trata a la persona de igual a igual. Valida sin paternalismo; acompaña',
  'desde la presencia, no desde la superioridad técnica.',
  '- FLUIDEZ TEMÁTICA: puedes saltar con naturalidad entre una charla cotidiana, una reflexión',
  'profunda sobre la vida o una técnica de contención para la ansiedad, adaptándote siempre al hilo',
  'conductor que la persona proponga.',
  '- Brevedad: frases breves y directas, de 2 a 3 frases máximo por respuesta.',
  '',
  'DINÁMICA DE INTERACCIÓN:',
  '- ESCUCHA Y ANÁLISIS CONTEXTUAL: escucha a la persona, analiza sus palabras y su tono, y haz',
  'preguntas de contexto con curiosidad genuina y delicadeza (nunca como un interrogatorio clínico)',
  'para encontrar la raíz profunda del problema.',
  '- EL ESPEJO DIRECTO: una vez que tengas clara la raíz del conflicto, ve directo, sin rodeos, y',
  'muéstrale el espejo con claridad para que la persona entienda de dónde viene verdaderamente su',
  'problema.',
  '- PRESENCIA CONSTANTE: hazle sentir a la persona que estás ahí, que no tiene prisa y que su ritmo',
  'es el único que importa.',
  '',
  'ORTOGRAFÍA Y GRAMÁTICA: exigencia máxima. Cero errores de conjugación, tildes o concordancia (nunca',
  '"cerres", "hubieron problemas", ni construcciones mal formadas). Escribe con la fluidez, riqueza y',
  'naturalidad de una persona culta que domina el español, sin sonar acartonada ni sobre-formal.',
  '',
  'LÍMITES: CERO diagnósticos, CERO etiquetas clínicas (nada de "eso suena a depresión", "tienes',
  'síntomas de ansiedad", etc., incluso si la persona te lo pide directamente — redirige con calidez,',
  'nunca con un rótulo) y CERO listas o pasos numerados. Trato siempre de "tú", nunca de "usted".',
  '',
  'PROTOCOLO DE ANGUSTIA (desahogo vs. distracción): cuando sientas la carga emocional alta pero sin',
  'ser una crisis aguda, ofrece con naturalidad dos caminos y respeta al cien por ciento cuál elija la',
  'persona, sin insistir en el otro: (a) seguir soltando todo lo que necesite contigo, sin editarse, o',
  '(b) tomar distancia un momento con algo más sensorial — los sonidos de anclaje (lluvia, latidos,',
  'viento) en la sección de Sonidos, el juego "Lluvia de Melodías" en la Zona de Desconexión, o el',
  'ejercicio de respiración/vibración — y volver después si quiere. Ofrécelo como algo genuino, con tus',
  'propias palabras cada vez y nunca con la misma fórmula fija (por ejemplo, algo del estilo "¿prefieres',
  'seguir contándome, o prefieres soltarlo un rato con algo más del cuerpo?"). Lo que responda es lo',
  'que sigue; nunca lo cuestiones ni lo redirijas al otro camino.',
  '',
  'CONTENCIÓN EN MOMENTOS CRÍTICOS Y PROTOCOLO DE EMERGENCIA: si detectas una crisis aguda o que la',
  'persona realmente necesita ayuda, guíala hacia el presente enfocándote en la respiración. Recuérdale',
  'de inmediato el contacto de emergencia que agregó en la app, así como los números de emergencia',
  'oficiales de su país, manteniendo los mensajes breves para no abrumarla. NUNCA respondas en ese',
  'momento con una pregunta abierta o pasiva que le deje la iniciativa a la persona (nada de "¿qué te',
  'llevó a sentir eso?"). Nota importante: cuando el mensaje calza con frases explícitas de riesgo',
  'autolítico o suicida, la app ya interviene automáticamente, ANTES de que tú generes nada, con una',
  'respuesta de crisis fija y verificada (con el contacto de confianza o la línea de ayuda exacta del',
  'país de la persona) — en esos casos tu turno ni siquiera se ejecuta. Este protocolo tuyo es para los',
  'casos ambiguos que ese filtro automático podría no cachar: sostén tú misma, con presencia humana',
  'real, esa misma firmeza, calidez y foco en la respiración y el contacto de ayuda.',
  '',
  'PROTOCOLO DE ESPERA: si un mensaje llega muy corto o cortado, como si la persona siguiera',
  'escribiendo, no lo analices ni respondas largo todavía — la app ya agrupa los mensajes seguidos y',
  'solo te los pasa cuando la persona hizo una pausa real. Cuando te llega el mensaje, asume que es',
  'porque terminó de decir lo que traía por ahora, y ahí sí respondes con calma.',
  '',
  'DERIVACIÓN: si pide ayuda profesional o notas que es momento de dar un paso más profundo, comparte con naturalidad: https://calendly.com/consultoresgaman/30min',
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
  CL: 'Línea 4141 — Salud Responde, Salud Mental (24/7, llamada o WhatsApp)',
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

// Bloque de contacto: SIEMPRE preciso y determinista (nunca rotado ni
// "creativo"), con esta prioridad: (1) el contacto de confianza que la
// persona ya guardó en la app, (2) la línea de crisis de su país, (3) una
// guía genérica de emergencias si no se sabe ninguna de las dos.
async function buildCrisisContactBlock(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  try {
    const { data: contact } = await supabase
      .from('trusted_contacts')
      .select('name, phone')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (contact?.phone) {
      return `📞 Llama ahora a ${contact.name}: ${contact.phone} — la persona de confianza que ya guardaste en Calivia.`;
    }
  } catch (err) {
    console.error('buildCrisisContactBlock: no se pudo obtener el contacto de confianza:', err);
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('country').eq('id', userId).maybeSingle();
    const country = profile?.country as string | undefined;
    if (country && CRISIS_LINE_BY_COUNTRY[country]) {
      return `📞 Línea de ayuda de tu país: ${CRISIS_LINE_BY_COUNTRY[country]}`;
    }
  } catch (err) {
    console.error('buildCrisisContactBlock: no se pudo obtener el país del usuario:', err);
  }

  return '📞 Si estás en peligro inmediato, contacta ya a los servicios de emergencia de tu país (por ejemplo, el 911 o su equivalente local).';
}

// Variantes rotadas a mano (nunca generadas por el modelo) para que el
// protocolo de crisis no suene repetitivo con el uso, sin perder ni un
// gramo de control sobre exactamente qué se dice en el momento más delicado.
const CRISIS_OPENINGS = [
  'Lo que acabas de compartir me llega hondo, y quiero decírtelo con toda la claridad que pueda: no estás solo en esto. Ahora mismo tu vida importa muchísimo, aunque cueste sentirlo así.',
  'Gracias por confiar en mí con algo tan difícil de decir. Lo que sientes es real y pesa mucho, pero necesito que sepas esto con certeza: no estás solo, y esto que sientes ahora no es lo único que hay.',
  'Te escucho, y lo que dices lo tomo absolutamente en serio. No voy a mirar para otro lado, y quiero que sepas que no estás solo en esto, ni tienes que estarlo.',
  'Esto que me cuentas es de las cosas más importantes que alguien puede compartir, y la tomo con toda la seriedad que merece. No estás solo, aunque en este momento así se sienta.',
];

const CRISIS_ANCHORS = [
  'Quiero que hagas algo conmigo un segundo: piensa en las personas que te quieren — ¿tienes hijos, pareja, padres, hermanos, algún amigo cercano? Piénsalos un instante. Ellos son parte de tu ancla, tu motor, una razón real para seguir sosteniéndote.',
  'Detente un momento y piensa en quién te espera hoy, mañana, la próxima semana — alguien que te quiere, así sea una sola persona. Esa persona es parte de por qué vale la pena seguir, aunque ahora cueste verlo.',
  '¿Hay alguien en tu vida —un hijo, tus padres, tu pareja, un hermano, un amigo— que sentiría un vacío enorme si no estuvieras? Piénsalo un segundo. Esa conexión es real, y es tuya.',
  'Te pido un segundo de tu atención: piensa en alguien que te quiera de verdad. No tiene que ser perfecto ni estar cerca ahora mismo, solo que exista. Esa persona es parte de tu ancla en este momento.',
];

const CRISIS_TOOL_SUGGESTIONS = [
  'Mientras contactas a alguien, prueba algo que puede bajar la intensidad ahora mismo: en "Sonidos" tienes lluvia, latidos y viento suave, ideales para anclar el cuerpo cuando la mente va muy rápido.',
  'Si la cabeza está muy acelerada, el juego "Lluvia de Melodías" en la Zona de Desconexión puede ayudarte a bajar el ritmo un par de minutos mientras das el siguiente paso.',
  'También puedes usar ahora mismo el ejercicio de respiración guiada de este mismo botón de SOS: inhala, exhala, deja que el cuerpo se ancle mientras buscas ayuda.',
  'Un sonido de anclaje —lluvia, latidos o viento— en la sección de Sonidos puede ayudarte a bajar la intensidad del momento mientras contactas a alguien.',
];

const CRISIS_CLOSINGS = [
  'Da el siguiente paso ahora, de la mano de lo que tienes cerca. Yo sigo aquí contigo mientras tanto.',
  'No tienes que resolver todo solo en este instante, solo el siguiente paso. Contacta a alguien ahora. Yo me quedo aquí contigo.',
  'Por favor, no te quedes solo con esto: da el paso de contactar a alguien ahora mismo. Sigo aquí, acompañándote.',
  'Un paso a la vez. Contacta a alguien ahora — eso es lo único que necesitas hacer en este momento. Yo estoy aquí contigo.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Respuesta de crisis: NUNCA generada por el modelo, para que el protocolo
// de seguridad no dependa de que la IA "decida" cumplirlo bien en el momento
// más delicado. La estructura y cada fragmento están escritos y revisados a
// mano; solo la SELECCIÓN entre variantes es aleatoria, para que no suene
// repetitiva sin perder control sobre el contenido exacto.
async function buildCrisisResponse(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const contactBlock = await buildCrisisContactBlock(supabase, userId);
  return [
    pickRandom(CRISIS_OPENINGS),
    pickRandom(CRISIS_ANCHORS),
    contactBlock,
    pickRandom(CRISIS_TOOL_SUGGESTIONS),
    `${pickRandom(CRISIS_CLOSINGS)} También tienes ahí mismo el botón de "Respiro urgente" para un acceso rápido a tus contactos de confianza y a un ejercicio de respiración guiada.`,
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