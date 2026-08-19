// Intérprete de comandos de voz estilo "Alexa" para programar tareas (ver
// VoiceTaskCommand.tsx). No conversa ni guarda nada en la base de datos —
// solo recibe la transcripción de lo que dijo la persona más su fecha/hora
// local de referencia, y devuelve un JSON con la tarea entendida. El cliente
// es quien inserta en `tasks` (mismo camino autenticado por sesión que usa
// TaskManager.tsx), así esta función no necesita tocar la base de datos.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type Lang = 'es' | 'en' | 'pt';

function normalizeLang(value: unknown): Lang {
  return value === 'en' || value === 'pt' ? value : 'es';
}

interface VoiceTaskResult {
  intent: 'schedule_task' | 'unclear';
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm (24h)
  confirmation: string;
}

const WEEKDAY_NAMES: Record<Lang, string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  pt: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
};

const CLARIFY_PROMPT: Record<Lang, string> = {
  es: 'No alcancé a entender bien qué tarea quieres programar. ¿Puedes repetirlo con la tarea y la hora?',
  en: "I didn't quite catch what task you want to schedule. Can you repeat it with the task and the time?",
  pt: 'Não entendi bem qual tarefa você quer programar. Pode repetir com a tarefa e o horário?',
};

// Índices de día de semana que debe usar el modelo en "weekday_index" (mismo orden que
// WEEKDAY_NAMES y que JS Date.getDay(): 0 = domingo/Sunday, ..., 6 = sábado/Saturday).
const WEEKDAY_INDEX_HINT: Record<Lang, string> = {
  es: '0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado',
  en: '0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday',
  pt: '0=domingo, 1=segunda-feira, 2=terça-feira, 3=quarta-feira, 4=quinta-feira, 5=sexta-feira, 6=sábado',
};

// El modelo NUNCA hace la aritmética de fechas (súmale que sea "hoy" o "mañana" según la hora,
// o cuál es la próxima ocurrencia de un día de la semana) — eso quedó demostrado poco confiable
// incluso con ejemplos resueltos paso a paso en el prompt. En vez de eso, el modelo solo
// CLASIFICA qué tipo de referencia de día usó la persona ("day_reference"), y todo el cálculo
// de la fecha final ocurre después, en código determinístico (ver resolveDayReference más abajo).
function buildSystemPrompt(lang: Lang, ref: { date: string; time: string; weekday: string }): string {
  const header: Record<Lang, string[]> = {
    es: [
      'Eres un interpretador de comandos de voz para programar tareas y recordatorios dentro de la app',
      'Calivia, con un estilo tipo "Alexa". Recibes la transcripción literal de lo que dijo la persona',
      '(puede empezar con "Calivia," u otra palabra de activación, y verbos como "programa", "agenda" o',
      '"recuérdame"; ignora esas partes). Tu único trabajo es devolver un JSON — nunca converses, nunca',
      'añadas texto fuera del JSON. NUNCA hagas cálculos de fechas tú mismo (eso lo hace el sistema',
      'después) — tu trabajo es solo identificar QUÉ dijo la persona, no calcular a qué fecha corresponde.',
      '',
      'PASO OBLIGATORIO ANTES QUE NADA: decide si el mensaje es REALMENTE un pedido de programar, agendar o',
      'anotar una tarea/recordatorio. La mayoría de lo que puede llegar por este micrófono NO lo es —',
      'saludos, charla casual, preguntas generales, comentarios— y en esos casos tu única salida válida es',
      '{"intent":"unclear","title":"","day_reference":"unspecified","explicit_date":null,"weekday_index":null,',
      '"weekday_next_week":false,"time":null,"confirmation":"<pide que repita con la tarea y la hora>"}.',
      'NUNCA tomes un saludo, una pregunta o un comentario y lo conviertas en el "title" de una tarea',
      'inventada. Ejemplos que SIEMPRE son "unclear" (ninguno es una tarea, sin importar lo que digan',
      'después): "hola", "hola, cómo estás", "buenos días", "qué día es hoy", "cómo está el clima",',
      '"gracias, hasta luego", "oye", cualquier pregunta que no pida agendar algo. Solo usa "schedule_task"',
      'cuando el mensaje describe con claridad ALGO QUE HACER (una tarea, un pendiente, una cita, un',
      'recordatorio) — con o sin hora. Ante cualquier duda, responde "unclear".',
      '',
      `FECHA Y HORA ACTUALES DE REFERENCIA (solo para tu contexto, no las uses para calcular nada tú`,
      `mismo): hoy es ${ref.weekday} ${ref.date}, y son las ${ref.time} (hora local de la persona, 24h).`,
      '',
      'CÓMO CLASIFICAR "day_reference" (elige exactamente una opción):',
      '- "today": la persona dijo explícitamente "hoy".',
      '- "tomorrow": la persona dijo explícitamente "mañana".',
      '- "explicit_date": dio una fecha de calendario concreta (ej. "el 5 de septiembre"); ponla en',
      '  "explicit_date" como "YYYY-MM-DD" (asume el año actual salvo que diga otro).',
      '- "weekday": nombró un día de la semana (ej. "el miércoles", "el próximo lunes"); pon el número en',
      `  "weekday_index" usando esta tabla: ${WEEKDAY_INDEX_HINT[lang]}. Pon "weekday_next_week": true SOLO`,
      '  si dijo explícitamente "próximo/a" o "la semana que viene/entrante"; si no lo dijo, "false".',
      '- "unspecified": NO mencionó ningún día de ninguna forma (puede que sí haya dado una hora, como',
      '  "para las 14:00" sin decir cuándo) — este es el caso más común.',
      'Cuando "day_reference" no sea "explicit_date" ni "weekday", deja "explicit_date" y "weekday_index"',
      'en null.',
      '',
      'FORMATO DE SALIDA (JSON estricto, sin texto adicional ni markdown):',
      '{',
      '  "intent": "schedule_task" | "unclear",',
      '  "title": string,                 // la tarea en sí, corta y clara, sin la hora ni verbos como',
      '                                    // "programa"',
      '  "day_reference": "today" | "tomorrow" | "explicit_date" | "weekday" | "unspecified",',
      '  "explicit_date": string | null,  // "YYYY-MM-DD", solo si day_reference es "explicit_date"',
      '  "weekday_index": number | null,  // 0-6, solo si day_reference es "weekday"',
      '  "weekday_next_week": boolean,    // true solo si dijeron "próximo/a" o "la semana que viene"',
      '  "time": string | null,           // "HH:mm" en 24 horas, o null si no se mencionó una hora',
      '  "confirmation": string           // frase breve y cálida en español confirmando lo agendado (máx.',
      '                                    // 20 palabras), o pidiendo que repita si "intent" es "unclear"',
      '}',
      '',
      'Si la tarea SÍ se entiende pero falta la hora, usa "schedule_task" con "time": null — eso no es',
      '"unclear", porque la tarea en sí quedó clara. Ejemplo de confirmación con hora: "Listo, programado:',
      'almuerzo a las 14:00". Ejemplo sin hora: "Listo, agregué \'llamar al dentista\' a tus tareas, sin hora',
      'fija."',
    ],
    en: [
      'You are a voice-command interpreter for scheduling tasks and reminders inside the Calivia app, in',
      'an "Alexa"-like style. You receive the literal transcript of what the person said (it may start with',
      '"Calivia," or another wake word, and verbs like "schedule", "set" or "remind me"; ignore those',
      'parts). Your only job is to return a JSON — never converse, never add text outside the JSON. NEVER',
      'do date math yourself (a separate system does that afterward) — your job is only to identify WHAT',
      'the person said, not to calculate which date it corresponds to.',
      '',
      'MANDATORY FIRST STEP: decide whether the message is REALLY a request to schedule, set, or note a',
      'task/reminder. Most of what can arrive through this microphone is NOT that — greetings, casual chat,',
      'general questions, comments — and in those cases your only valid output is',
      '{"intent":"unclear","title":"","day_reference":"unspecified","explicit_date":null,"weekday_index":null,',
      '"weekday_next_week":false,"time":null,"confirmation":"<ask them to repeat with the task and time>"}.',
      'NEVER take a greeting, a question, or a comment and turn it into the "title" of a made-up task.',
      'Examples that are ALWAYS "unclear" (none of these is a task, no matter what follows): "hi", "hi, how',
      'are you", "good morning", "what day is it", "how is the weather", "thanks, bye", "hey", any question',
      'that is not asking to schedule something. Only use "schedule_task" when the message clearly',
      'describes SOMETHING TO DO (a task, a to-do, an appointment, a reminder) — with or without a time.',
      'When in doubt, answer "unclear".',
      '',
      `CURRENT REFERENCE DATE AND TIME (for your context only, do not use it to calculate anything`,
      `yourself): today is ${ref.weekday} ${ref.date}, and it is ${ref.time} (the person's local time, 24h).`,
      '',
      'HOW TO CLASSIFY "day_reference" (pick exactly one):',
      '- "today": the person explicitly said "today".',
      '- "tomorrow": the person explicitly said "tomorrow".',
      '- "explicit_date": they gave a concrete calendar date (e.g. "on September 5th"); put it in',
      '  "explicit_date" as "YYYY-MM-DD" (assume the current year unless they say otherwise).',
      '- "weekday": they named a weekday (e.g. "on Wednesday", "next Monday"); put the number in',
      `  "weekday_index" using this table: ${WEEKDAY_INDEX_HINT[lang]}. Set "weekday_next_week": true ONLY`,
      '  if they explicitly said "next" or "next week"; otherwise "false".',
      '- "unspecified": they did NOT mention any day at all (they may have given a time, like "at 2pm",',
      '  without saying which day) — this is the most common case.',
      'When "day_reference" is neither "explicit_date" nor "weekday", leave "explicit_date" and',
      '"weekday_index" as null.',
      '',
      'OUTPUT FORMAT (strict JSON, no extra text or markdown):',
      '{',
      '  "intent": "schedule_task" | "unclear",',
      '  "title": string,                 // the task itself, short and clear, without the time or verbs',
      '                                    // like "schedule"',
      '  "day_reference": "today" | "tomorrow" | "explicit_date" | "weekday" | "unspecified",',
      '  "explicit_date": string | null,  // "YYYY-MM-DD", only if day_reference is "explicit_date"',
      '  "weekday_index": number | null,  // 0-6, only if day_reference is "weekday"',
      '  "weekday_next_week": boolean,    // true only if they said "next" or "next week"',
      '  "time": string | null,           // "HH:mm" in 24h, or null if no time was mentioned',
      '  "confirmation": string           // short, warm English sentence confirming what was scheduled',
      '                                    // (max 20 words), or asking them to repeat if "intent" is',
      '                                    // "unclear"',
      '}',
      '',
      'If the task IS clear but the time is missing, use "schedule_task" with "time": null — that is not',
      '"unclear", since the task itself was clear. Confirmation example with a time: "Got it, scheduled:',
      'lunch at 2pm." Example without a time: "Got it, I added \'call the dentist\' to your tasks, with no',
      'fixed time."',
    ],
    pt: [
      'Você é um interpretador de comandos de voz para programar tarefas e lembretes dentro do app Calivia,',
      'com um estilo tipo "Alexa". Você recebe a transcrição literal do que a pessoa disse (pode começar',
      'com "Calivia," ou outra palavra de ativação, e verbos como "programe", "agende" ou "me lembre";',
      'ignore essas partes). Seu único trabalho é devolver um JSON — nunca converse, nunca adicione texto',
      'fora do JSON. NUNCA faça cálculos de data você mesmo (um sistema separado faz isso depois) — seu',
      'trabalho é só identificar O QUE a pessoa disse, não calcular a que data isso corresponde.',
      '',
      'PASSO OBRIGATÓRIO ANTES DE QUALQUER COISA: decida se a mensagem é REALMENTE um pedido para programar,',
      'agendar ou anotar uma tarefa/lembrete. A maior parte do que pode chegar por este microfone NÃO é',
      'isso — saudações, papo casual, perguntas gerais, comentários — e nesses casos sua única saída válida',
      'é {"intent":"unclear","title":"","day_reference":"unspecified","explicit_date":null,',
      '"weekday_index":null,"weekday_next_week":false,"time":null,"confirmation":"<peça para repetir com a',
      'tarefa e o horário>"}. NUNCA pegue uma saudação, uma pergunta ou um comentário e transforme isso no',
      '"title" de uma tarefa inventada. Exemplos que são SEMPRE "unclear" (nenhum deles é uma tarefa, não',
      'importa o que vier depois): "oi", "oi, tudo bem?", "bom dia", "que dia é hoje", "como está o tempo",',
      '"obrigado, até mais", "ei", qualquer pergunta que não peça para agendar algo. Só use "schedule_task"',
      'quando a mensagem descreve com clareza ALGO A FAZER (uma tarefa, uma pendência, um compromisso, um',
      'lembrete) — com ou sem horário. Na dúvida, responda "unclear".',
      '',
      `DATA E HORA ATUAIS DE REFERÊNCIA (apenas para seu contexto, não use para calcular nada você mesmo):`,
      `hoje é ${ref.weekday}, ${ref.date}, e são ${ref.time} (horário local da pessoa, 24h).`,
      '',
      'COMO CLASSIFICAR "day_reference" (escolha exatamente uma opção):',
      '- "today": a pessoa disse explicitamente "hoje".',
      '- "tomorrow": a pessoa disse explicitamente "amanhã".',
      '- "explicit_date": ela deu uma data de calendário concreta (ex. "dia 5 de setembro"); coloque em',
      '  "explicit_date" como "YYYY-MM-DD" (assuma o ano atual, a menos que diga outro).',
      '- "weekday": ela citou um dia da semana (ex. "na quarta-feira", "na próxima segunda"); coloque o',
      `  número em "weekday_index" usando esta tabela: ${WEEKDAY_INDEX_HINT[lang]}. Coloque`,
      '  "weekday_next_week": true SOMENTE se ela disse explicitamente "próximo/a" ou "semana que vem";',
      '  caso contrário, "false".',
      '- "unspecified": ela NÃO mencionou nenhum dia de forma alguma (pode ter dado um horário, como "às',
      '  14h", sem dizer quando) — este é o caso mais comum.',
      'Quando "day_reference" não for "explicit_date" nem "weekday", deixe "explicit_date" e',
      '"weekday_index" como null.',
      '',
      'FORMATO DE SAÍDA (JSON estrito, sem texto adicional nem markdown):',
      '{',
      '  "intent": "schedule_task" | "unclear",',
      '  "title": string,                 // a tarefa em si, curta e clara, sem o horário nem verbos como',
      '                                    // "programe"',
      '  "day_reference": "today" | "tomorrow" | "explicit_date" | "weekday" | "unspecified",',
      '  "explicit_date": string | null,  // "YYYY-MM-DD", só se day_reference for "explicit_date"',
      '  "weekday_index": number | null,  // 0-6, só se day_reference for "weekday"',
      '  "weekday_next_week": boolean,    // true só se disseram "próximo/a" ou "semana que vem"',
      '  "time": string | null,           // "HH:mm" em 24 horas, ou null se nenhum horário foi mencionado',
      '  "confirmation": string           // frase breve e calorosa em português confirmando o agendamento',
      '                                    // (máx. 20 palavras), ou pedindo para repetir se "intent" for',
      '                                    // "unclear"',
      '}',
      '',
      'Se a tarefa ESTÁ clara mas falta o horário, use "schedule_task" com "time": null — isso não é',
      '"unclear", pois a tarefa em si ficou clara. Exemplo de confirmação com horário: "Prontinho,',
      'programado: almoço às 14h." Exemplo sem horário: "Prontinho, adicionei \'ligar para o dentista\' nas',
      'suas tarefas, sem horário fixo."',
    ],
  };
  return header[lang].join('\n');
}

// Resuelve la fecha final ("YYYY-MM-DD") a partir de la clasificación del modelo — toda la
// aritmética vive acá, en código determinístico, no en el modelo.
function resolveDayReference(
  parsed: any,
  today: string,
  nowTime: string,
  time: string | null,
): string | null {
  switch (parsed.day_reference) {
    case 'today':
      return today;
    case 'tomorrow':
      return addDays(today, 1);
    case 'explicit_date':
      return typeof parsed.explicit_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.explicit_date)
        ? parsed.explicit_date
        : null;
    case 'weekday': {
      const idx = Number(parsed.weekday_index);
      if (!Number.isInteger(idx) || idx < 0 || idx > 6) return null;
      const todayIdx = new Date(`${today}T00:00:00`).getDay();
      let delta = (idx - todayIdx + 7) % 7;
      // "próximo/next" solo empuja una semana completa cuando el día nombrado es HOY mismo
      // (para distinguir "hoy" de "el mismo día de la semana que viene"). Para cualquier otro
      // día, "el próximo lunes" y "el lunes" a secas se refieren a la MISMA ocurrencia más
      // cercana hacia adelante — sumar una semana extra ahí sería un salto de más.
      if (delta === 0 && parsed.weekday_next_week === true) delta += 7;
      return addDays(today, delta);
    }
    default:
      // "unspecified" (o cualquier valor inesperado): si dieron hora sin día, asumimos hoy —
      // salvo que esa hora ya haya pasado, en cuyo caso es mañana (comparación de strings
      // "HH:mm" con padding fijo, 100% confiable).
      if (time) return time <= nowTime ? addDays(today, 1) : today;
      return null;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Respaldo sin IA (si no hay OPENAI_API_KEY configurada): heurística simple de regex para
// los patrones más comunes en los tres idiomas. No entiende días de la semana ni fechas
// relativas complejas — solo hora explícita y "hoy/mañana" — pero mantiene la función
// utilizable en modo degradado, igual que el fallback local de ai-chat/index.ts.
function regexFallback(transcript: string, lang: Lang, today: string, nowTime: string): VoiceTaskResult {
  const lower = transcript.toLowerCase();

  let date: string | null = null;
  const tomorrowWords: Record<Lang, string[]> = {
    es: ['mañana'],
    en: ['tomorrow'],
    pt: ['amanhã', 'amanha'],
  };
  const todayWords: Record<Lang, string[]> = {
    es: ['hoy'],
    en: ['today'],
    pt: ['hoje'],
  };
  if (tomorrowWords[lang].some((w) => lower.includes(w))) {
    date = addDays(today, 1);
  } else if (todayWords[lang].some((w) => lower.includes(w))) {
    date = today;
  }

  let time: string | null = null;
  const hhmm = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const hOnly = lower.match(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/);
  const hOnly24 = !hhmm && !hOnly ? lower.match(/\b(1[0-2]|0?[1-9])\s*(h|hrs|hs)\b/) : null;
  if (hhmm) {
    time = `${pad2(Number(hhmm[1]))}:${hhmm[2]}`;
  } else if (hOnly) {
    let h = Number(hOnly[1]) % 12;
    if (hOnly[2] === 'pm') h += 12;
    time = `${pad2(h)}:00`;
  } else if (hOnly24) {
    time = `${pad2(Number(hOnly24[1]))}:00`;
  }

  // Si dio hora pero no día, y esa hora ya pasó hoy, asumimos que se refiere a mañana —
  // mismo comportamiento "tipo Alexa" que aplican los asistentes de voz comunes.
  if (time && !date) {
    date = time <= nowTime ? addDays(today, 1) : today;
  }

  const stripWords: Record<Lang, RegExp> = {
    es: /^(calivia,?\s*)?(programa|agenda|recuérdame|recuerdame|agrega|añade|anota)\s*/i,
    en: /^(calivia,?\s*)?(schedule|set|remind me( to)?|add|create)\s*/i,
    pt: /^(calivia,?\s*)?(programe|agende|me lembre( de)?|adicione|anote)\s*/i,
  };
  let title = transcript.trim().replace(stripWords[lang], '');
  if (hhmm) title = title.replace(hhmm[0], '');
  if (hOnly) title = title.replace(hOnly[0], '');
  if (hOnly24) title = title.replace(hOnly24[0], '');
  const connectorWords: Record<Lang, RegExp> = {
    es: /\b(para|a las?|el|este|esta)\b/gi,
    en: /\b(for|at|on)\b/gi,
    pt: /\b(para|às|as|no|na|este|esta)\b/gi,
  };
  title = title.replace(connectorWords[lang], ' ').replace(/\s+/g, ' ').trim();
  if (title.endsWith('.')) title = title.slice(0, -1).trim();

  if (!title) {
    return { intent: 'unclear', title: '', date: null, time: null, confirmation: CLARIFY_PROMPT[lang] };
  }

  const confirmDone: Record<Lang, (t: string, time: string | null) => string> = {
    es: (t, time) => (time ? `Listo, programado: ${t} a las ${time}` : `Listo, agregué "${t}" a tus tareas.`),
    en: (t, time) => (time ? `Got it, scheduled: ${t} at ${time}` : `Got it, I added "${t}" to your tasks.`),
    pt: (t, time) => (time ? `Prontinho, programado: ${t} às ${time}` : `Prontinho, adicionei "${t}" nas suas tarefas.`),
  };

  return {
    intent: 'schedule_task',
    title,
    date,
    time,
    confirmation: confirmDone[lang](title, time),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { userId, transcript, lang: rawLang, localDate, localTime } = await req.json();
    const lang = normalizeLang(rawLang);
    if (!userId || typeof transcript !== 'string' || !transcript.trim()) {
      return new Response(JSON.stringify({ error: 'Faltan userId o transcript' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const today = typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : new Date().toISOString().slice(0, 10);
    const nowTime = typeof localTime === 'string' && /^\d{2}:\d{2}$/.test(localTime) ? localTime : new Date().toTimeString().slice(0, 5);
    const weekdayIdx = new Date(`${today}T${nowTime}:00`).getDay();
    const weekdayName = WEEKDAY_NAMES[lang][Number.isNaN(weekdayIdx) ? 0 : weekdayIdx];

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify(regexFallback(transcript, lang, today, nowTime)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt(lang, { date: today, time: nowTime, weekday: weekdayName }) },
      { role: 'user', content: transcript },
    ];

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.1, max_tokens: 200, response_format: { type: 'json_object' } }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => '');
      throw new Error(`OpenAI ${aiRes.status}: ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw: string = aiJson.choices?.[0]?.message?.content?.trim() || '';
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* cae al fallback abajo */ }

    // "unclear" viene A PROPÓSITO con title:"" — eso NO es un fallo de parseo. Solo caemos al
    // respaldo por regex si el JSON vino corrupto, o si dice "schedule_task" pero sin ninguna
    // tarea identificable (lo cual sí sería un fallo real del modelo).
    const intent = parsed?.intent === 'schedule_task' ? 'schedule_task' : parsed?.intent === 'unclear' ? 'unclear' : null;
    const brokenSchedule = intent === 'schedule_task' && (typeof parsed.title !== 'string' || !parsed.title.trim());
    if (!parsed || !intent || brokenSchedule) {
      return new Response(JSON.stringify(regexFallback(transcript, lang, today, nowTime)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const time: string | null = intent === 'schedule_task' && typeof parsed.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : null;
    const date: string | null = intent === 'schedule_task' ? resolveDayReference(parsed, today, nowTime, time) : null;

    // Para "unclear" usamos siempre nuestro propio texto fijo (CLARIFY_PROMPT), nunca el que
    // devuelve el modelo: en la práctica a veces copiaba literal el placeholder del ejemplo del
    // prompt ("<pide que repita...>") en vez de generar una frase real.
    const confirmation = intent === 'unclear'
      ? CLARIFY_PROMPT[lang]
      : (typeof parsed.confirmation === 'string' && parsed.confirmation.trim() ? parsed.confirmation.trim().slice(0, 300) : CLARIFY_PROMPT[lang]);

    const result: VoiceTaskResult = {
      intent,
      title: intent === 'schedule_task' ? String(parsed.title).slice(0, 200).trim() : '',
      date,
      time,
      confirmation,
    };

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
