import type { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Protocolo de crisis compartido por el chat, el diario y las respuestas a consignas.
export type Lang = 'es' | 'en' | 'pt';

export function normalizeCrisisLang(value: unknown): Lang {
  return value === 'en' || value === 'pt' ? value : 'es';
}

// Lexicón de palabras clave de riesgo en ES/EN/PT. Esto es una heurística de
// texto, NO una evaluación clínica: puede tener falsos negativos (frases de
// riesgo reales que no calcen) y falsos positivos. Se revisan las tres listas
// SIEMPRE, sin importar el idioma declarado por la app, porque una persona
// puede escribir en un idioma distinto al configurado. Además de avisar al
// psicólogo vinculado, dispara la respuesta de crisis determinista (ver
// buildCrisisResponse) para no depender del criterio variable de la IA en
// el momento más delicado.
const RISK_KEYWORDS_ES = [
  'suicid', 'quitarme la vida', 'no quiero seguir viviendo', 'no quiero vivir',
  'terminar con todo', 'terminar con mi vida', 'acabar con mi vida', 'acabar con todo',
  'hacerme daño', 'hacerme dano', 'autolesion', 'autolesión', 'cortarme',
  'no aguanto más', 'no aguanto mas', 'quiero desaparecer', 'desaparecer para siempre',
  'ya no puedo más', 'ya no puedo mas', 'no vale la pena vivir', 'no vale la pena seguir',
  'no quiero estar aquí', 'no quiero estar aqui', 'me quiero matar', 'quiero matarme',
  'matarme', 'me quiero morir', 'quiero morir', 'ya no tiene sentido vivir',
];

const RISK_KEYWORDS_EN = [
  'suicid', 'kill myself', "don't want to live", 'do not want to live',
  'end it all', 'end my life', 'want to die', 'wanna die',
  'hurt myself', 'self harm', 'self-harm', 'cutting myself',
  "can't take it anymore", 'cannot take it anymore', 'want to disappear', 'disappear forever',
  'no reason to live', 'not worth living', "i don't want to be here", 'i do not want to be here',
  'better off dead', 'give up on life',
];

const RISK_KEYWORDS_PT = [
  'suicid', 'tirar minha vida', 'não quero mais viver', 'nao quero mais viver',
  'acabar com tudo', 'acabar com a minha vida', 'quero morrer', 'quero me matar',
  'me machucar', 'automutilação', 'automutilacao', 'me cortar',
  'não aguento mais', 'nao aguento mais', 'quero desaparecer', 'desaparecer para sempre',
  'não vale a pena viver', 'nao vale a pena viver', 'não quero estar aqui', 'nao quero estar aqui',
  'me matar', 'não tem mais sentido viver', 'nao tem mais sentido viver',
];

const ALL_RISK_KEYWORDS = [...RISK_KEYWORDS_ES, ...RISK_KEYWORDS_EN, ...RISK_KEYWORDS_PT];

export function detectRiskKeyword(text: string): string | null {
  const normalized = text.toLowerCase();
  for (const kw of ALL_RISK_KEYWORDS) {
    if (normalized.includes(kw)) return kw;
  }
  return null;
}

// Línea de ayuda principal por país (subconjunto server-side de lib/crisis.ts,
// pensado para incluirse directo en la respuesta de crisis). Mejor esfuerzo:
// verifica siempre estos números contra una fuente oficial antes de confiar
// en ellos como definitivos. El texto se localiza según el idioma del chat,
// no según el país (una persona en Brasil puede tener la app en inglés).
const CRISIS_LINE_BY_COUNTRY: Record<string, Record<Lang, string>> = {
  MX: {
    es: 'SAPTEL: 55 5259-8121 (24/7, llamada o WhatsApp)',
    en: 'SAPTEL: 55 5259-8121 (24/7, call or WhatsApp)',
    pt: 'SAPTEL: 55 5259-8121 (24h, ligação ou WhatsApp)',
  },
  ES: {
    es: '024 — Línea de atención a la conducta suicida (24/7)',
    en: '024 — Spain suicide prevention line (24/7)',
    pt: '024 — Linha de prevenção ao suicídio da Espanha (24h)',
  },
  PT: {
    es: 'SNS 24: 808 24 24 24 (24/7) · SOS Voz Amiga: 213 544 545',
    en: 'SNS 24: 808 24 24 24 (24/7) · SOS Voz Amiga: 213 544 545',
    pt: 'SNS 24: 808 24 24 24 (24h) · SOS Voz Amiga: 213 544 545',
  },
  AR: {
    es: 'Línea 135 — Salud Mental (24/7)',
    en: 'Line 135 — Mental Health (24/7)',
    pt: 'Linha 135 — Saúde Mental (24h)',
  },
  CO: {
    es: 'Línea 106 (24/7)',
    en: 'Line 106 (24/7)',
    pt: 'Linha 106 (24h)',
  },
  CL: {
    es: 'Línea 4141 — Salud Responde, Salud Mental (24/7, llamada o WhatsApp)',
    en: 'Line 4141 — Salud Responde, Mental Health (24/7, call or WhatsApp)',
    pt: 'Linha 4141 — Salud Responde, Saúde Mental (24h, ligação ou WhatsApp)',
  },
  PE: {
    es: 'Línea 113, opción 5 (24/7)',
    en: 'Line 113, option 5 (24/7)',
    pt: 'Linha 113, opção 5 (24h)',
  },
  US: {
    es: '988 Suicide & Crisis Lifeline (24/7)',
    en: '988 Suicide & Crisis Lifeline (24/7)',
    pt: '988 Suicide & Crisis Lifeline (24h)',
  },
  EC: {
    es: 'ECU 911 (24/7)',
    en: 'ECU 911 (24/7)',
    pt: 'ECU 911 (24h)',
  },
  VE: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  BO: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  PY: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  UY: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  GT: {
    es: 'Policía Nacional Civil: 110',
    en: 'National Civil Police: 110',
    pt: 'Polícia Nacional Civil: 110',
  },
  HN: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  SV: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  NI: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  CR: { es: 'Emergencias: 911', en: 'Emergency: 911', pt: 'Emergência: 911' },
  PA: {
    es: 'Sistema Único de Emergencias: 911',
    en: 'Unified Emergency System: 911',
    pt: 'Sistema Único de Emergência: 911',
  },
  DO: { es: 'Sistema 9-1-1', en: '9-1-1 System', pt: 'Sistema 9-1-1' },
  CU: { es: 'Emergencias: 106', en: 'Emergency: 106', pt: 'Emergência: 106' },
  BR: {
    es: 'CVV: 188 (24/7)',
    en: 'CVV: 188 (24/7)',
    pt: 'CVV: 188 (24h)',
  },
};

const CONTACT_BLOCK_TEXT: Record<Lang, { trustedContact: (name: string, phone: string) => string; countryLine: (line: string) => string; genericFallback: string }> = {
  es: {
    trustedContact: (name, phone) => `📞 Llama ahora a ${name}: ${phone} — la persona de confianza que ya guardaste en Calivia.`,
    countryLine: (line) => `📞 Línea de ayuda de tu país: ${line}`,
    genericFallback: '📞 Si estás en peligro inmediato, contacta ya a los servicios de emergencia de tu país (por ejemplo, el 911 o su equivalente local).',
  },
  en: {
    trustedContact: (name, phone) => `📞 Call ${name} right now: ${phone} — the trusted contact you already saved in Calivia.`,
    countryLine: (line) => `📞 Your country's helpline: ${line}`,
    genericFallback: "📞 If you're in immediate danger, contact your country's emergency services right now (for example, 911 or your local equivalent).",
  },
  pt: {
    trustedContact: (name, phone) => `📞 Ligue agora para ${name}: ${phone} — o contato de confiança que você já salvou no Calivia.`,
    countryLine: (line) => `📞 Linha de ajuda do seu país: ${line}`,
    genericFallback: '📞 Se você está em perigo imediato, contate agora os serviços de emergência do seu país (por exemplo, o 190/192 ou o equivalente local).',
  },
};

// Bloque de contacto: SIEMPRE preciso y determinista (nunca rotado ni
// "creativo"), con esta prioridad: (1) el contacto de confianza que la
// persona ya guardó en la app, (2) la línea de crisis de su país, (3) una
// guía genérica de emergencias si no se sabe ninguna de las dos.
async function buildCrisisContactBlock(supabase: ReturnType<typeof createClient>, userId: string, lang: Lang): Promise<string> {
  const copy = CONTACT_BLOCK_TEXT[lang];
  try {
    const { data: contact } = await supabase
      .from('trusted_contacts')
      .select('name, phone')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (contact?.phone) {
      return copy.trustedContact(contact.name, contact.phone);
    }
  } catch (err) {
    console.error('buildCrisisContactBlock: no se pudo obtener el contacto de confianza:', err);
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('country').eq('id', userId).maybeSingle();
    const country = profile?.country as string | undefined;
    if (country && CRISIS_LINE_BY_COUNTRY[country]) {
      return copy.countryLine(CRISIS_LINE_BY_COUNTRY[country][lang]);
    }
  } catch (err) {
    console.error('buildCrisisContactBlock: no se pudo obtener el país del usuario:', err);
  }

  return copy.genericFallback;
}

// Variantes rotadas a mano (nunca generadas por el modelo) para que el
// protocolo de crisis no suene repetitivo con el uso, sin perder ni un
// gramo de control sobre exactamente qué se dice en el momento más delicado.
const CRISIS_OPENINGS: Record<Lang, string[]> = {
  es: [
    'Lo que acabas de compartir me llega hondo, y quiero decírtelo con toda la claridad que pueda: no estás solo en esto. Ahora mismo tu vida importa muchísimo, aunque cueste sentirlo así.',
    'Gracias por confiar en mí con algo tan difícil de decir. Lo que sientes es real y pesa mucho, pero necesito que sepas esto con certeza: no estás solo, y esto que sientes ahora no es lo único que hay.',
    'Te escucho, y lo que dices lo tomo absolutamente en serio. No voy a mirar para otro lado, y quiero que sepas que no estás solo en esto, ni tienes que estarlo.',
    'Esto que me cuentas es de las cosas más importantes que alguien puede compartir, y la tomo con toda la seriedad que merece. No estás solo, aunque en este momento así se sienta.',
  ],
  en: [
    "What you just shared reaches me deeply, and I want to tell you as clearly as I can: you are not alone in this. Right now your life matters enormously, even if it's hard to feel that way.",
    "Thank you for trusting me with something so hard to say. What you feel is real and it weighs a lot, but I need you to know this for certain: you are not alone, and what you feel right now isn't the only thing there is.",
    "I hear you, and I'm taking what you say completely seriously. I'm not going to look away, and I want you to know you are not alone in this, nor do you have to be.",
    "What you're telling me is one of the most important things a person can share, and I'm taking it with all the seriousness it deserves. You are not alone, even if it feels that way right now.",
  ],
  pt: [
    'O que você acabou de compartilhar chega fundo em mim, e quero te dizer com toda a clareza que puder: você não está sozinho nisso. Agora mesmo a sua vida importa muito, mesmo que seja difícil sentir isso assim.',
    'Obrigado por confiar em mim com algo tão difícil de dizer. O que você sente é real e pesa muito, mas preciso que saiba com certeza: você não está sozinho, e o que sente agora não é a única coisa que existe.',
    'Estou te ouvindo, e levo o que você diz absolutamente a sério. Não vou olhar para o outro lado, e quero que saiba que você não está sozinho nisso, nem precisa estar.',
    'O que você está me contando é uma das coisas mais importantes que alguém pode compartilhar, e eu levo isso com toda a seriedade que merece. Você não está sozinho, mesmo que agora pareça assim.',
  ],
};

const CRISIS_ANCHORS: Record<Lang, string[]> = {
  es: [
    'Quiero que hagas algo conmigo un segundo: piensa en las personas que te quieren — ¿tienes hijos, pareja, padres, hermanos, algún amigo cercano? Piénsalos un instante. Ellos son parte de tu ancla, tu motor, una razón real para seguir sosteniéndote.',
    'Detente un momento y piensa en quién te espera hoy, mañana, la próxima semana — alguien que te quiere, así sea una sola persona. Esa persona es parte de por qué vale la pena seguir, aunque ahora cueste verlo.',
    '¿Hay alguien en tu vida —un hijo, tus padres, tu pareja, un hermano, un amigo— que sentiría un vacío enorme si no estuvieras? Piénsalo un segundo. Esa conexión es real, y es tuya.',
    'Te pido un segundo de tu atención: piensa en alguien que te quiera de verdad. No tiene que ser perfecto ni estar cerca ahora mismo, solo que exista. Esa persona es parte de tu ancla en este momento.',
  ],
  en: [
    'I want you to do something with me for a second: think of the people who love you — do you have kids, a partner, parents, siblings, a close friend? Think of them for a moment. They are part of your anchor, your engine, a real reason to keep holding on.',
    'Stop for a moment and think of who is waiting for you today, tomorrow, next week — someone who loves you, even if it is just one person. That person is part of why it is worth continuing, even if it is hard to see that right now.',
    "Is there someone in your life — a child, your parents, your partner, a sibling, a friend — who would feel an enormous void if you weren't there? Think about it for a second. That connection is real, and it's yours.",
    "I'm asking for a second of your attention: think of someone who truly loves you. They don't have to be perfect or nearby right now, just exist. That person is part of your anchor in this moment.",
  ],
  pt: [
    'Quero que você faça algo comigo por um segundo: pense nas pessoas que te amam — você tem filhos, parceiro(a), pais, irmãos, algum amigo próximo? Pense neles por um instante. Eles são parte da sua âncora, do seu motor, um motivo real para continuar se segurando.',
    'Pare um momento e pense em quem está te esperando hoje, amanhã, na próxima semana — alguém que te ama, mesmo que seja uma única pessoa. Essa pessoa é parte do motivo pelo qual vale a pena continuar, mesmo que agora custe enxergar isso.',
    'Existe alguém na sua vida — um filho, seus pais, seu parceiro(a), um irmão, um amigo — que sentiria um vazio enorme se você não estivesse aqui? Pense por um segundo. Essa conexão é real, e é sua.',
    'Peço um segundo da sua atenção: pense em alguém que realmente te ame. Não precisa ser perfeito nem estar perto agora, só existir. Essa pessoa é parte da sua âncora neste momento.',
  ],
};

const CRISIS_TOOL_SUGGESTIONS: Record<Lang, string[]> = {
  es: [
    'Mientras contactas a alguien, prueba algo que puede bajar la intensidad ahora mismo: en "Sonidos" tienes lluvia, latidos y viento suave, ideales para anclar el cuerpo cuando la mente va muy rápido.',
    'Si la cabeza está muy acelerada, el juego "Lluvia de Melodías" en la Zona de Desconexión puede ayudarte a bajar el ritmo un par de minutos mientras das el siguiente paso.',
    'También puedes usar ahora mismo el ejercicio de respiración guiada de este mismo botón de SOS: inhala, exhala, deja que el cuerpo se ancle mientras buscas ayuda.',
    'Un sonido de anclaje —lluvia, latidos o viento— en la sección de Sonidos puede ayudarte a bajar la intensidad del momento mientras contactas a alguien.',
  ],
  en: [
    'While you reach out to someone, try something that can lower the intensity right now: in "Sounds" you have rain, heartbeat, and soft wind, great for anchoring the body when the mind is racing.',
    'If your head is very sped up, the "Melody Rain" game in the Disconnection Zone can help you slow down for a couple of minutes while you take the next step.',
    'You can also use the guided breathing exercise right from this same SOS button: inhale, exhale, let your body anchor while you seek help.',
    'A grounding sound — rain, heartbeat, or wind — in the Sounds section can help lower the intensity of the moment while you reach out to someone.',
  ],
  pt: [
    'Enquanto você contata alguém, experimente algo que pode baixar a intensidade agora mesmo: em "Sons" você tem chuva, batimentos e vento suave, ideais para ancorar o corpo quando a mente vai muito rápido.',
    'Se a cabeça está muito acelerada, o jogo "Chuva de Melodias" na Zona de Desconexão pode te ajudar a baixar o ritmo por alguns minutos enquanto você dá o próximo passo.',
    'Você também pode usar agora mesmo o exercício de respiração guiada deste mesmo botão de SOS: inspire, expire, deixe o corpo se ancorar enquanto busca ajuda.',
    'Um som de ancoragem — chuva, batimentos ou vento — na seção de Sons pode te ajudar a baixar a intensidade do momento enquanto contata alguém.',
  ],
};

const CRISIS_CLOSINGS: Record<Lang, string[]> = {
  es: [
    'Da el siguiente paso ahora, de la mano de lo que tienes cerca. Yo sigo aquí contigo mientras tanto.',
    'No tienes que resolver todo solo en este instante, solo el siguiente paso. Contacta a alguien ahora. Yo me quedo aquí contigo.',
    'Por favor, no te quedes solo con esto: da el paso de contactar a alguien ahora mismo. Sigo aquí, acompañándote.',
    'Un paso a la vez. Contacta a alguien ahora — eso es lo único que necesitas hacer en este momento. Yo estoy aquí contigo.',
  ],
  en: [
    "Take the next step now, hand in hand with what you have nearby. I'm still here with you meanwhile.",
    "You don't have to solve everything alone right this instant, just the next step. Reach out to someone now. I'll stay here with you.",
    "Please don't stay alone with this: take the step of reaching out to someone right now. I'm still here, with you.",
    "One step at a time. Reach out to someone now — that's the only thing you need to do in this moment. I'm here with you.",
  ],
  pt: [
    'Dê o próximo passo agora, com o que você tem por perto. Eu continuo aqui com você enquanto isso.',
    'Você não precisa resolver tudo sozinho agora, só o próximo passo. Contate alguém agora. Eu fico aqui com você.',
    'Por favor, não fique sozinho com isso: dê o passo de contatar alguém agora mesmo. Continuo aqui, acompanhando você.',
    'Um passo de cada vez. Contate alguém agora — isso é a única coisa que você precisa fazer neste momento. Estou aqui com você.',
  ],
};

const CRISIS_CLOSING_SUFFIX: Record<Lang, string> = {
  es: ' También tienes ahí mismo el botón de "Respiro urgente" para un acceso rápido a tus contactos de confianza y a un ejercicio de respiración guiada.',
  en: ' You also have the "Urgent Relief" button right there for quick access to your trusted contacts and a guided breathing exercise.',
  pt: ' Você também tem ali mesmo o botão de "Alívio Urgente" para acesso rápido aos seus contatos de confiança e a um exercício de respiração guiada.',
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Respuesta de crisis: NUNCA generada por el modelo, para que el protocolo
// de seguridad no dependa de que la IA "decida" cumplirlo bien en el momento
// más delicado. La estructura y cada fragmento están escritos y revisados a
// mano; solo la SELECCIÓN entre variantes es aleatoria, para que no suene
// repetitiva sin perder control sobre el contenido exacto.
export async function buildCrisisResponse(supabase: ReturnType<typeof createClient>, userId: string, lang: Lang): Promise<string> {
  const contactBlock = await buildCrisisContactBlock(supabase, userId, lang);
  return [
    pickRandom(CRISIS_OPENINGS[lang]),
    pickRandom(CRISIS_ANCHORS[lang]),
    contactBlock,
    pickRandom(CRISIS_TOOL_SUGGESTIONS[lang]),
    `${pickRandom(CRISIS_CLOSINGS[lang])}${CRISIS_CLOSING_SUFFIX[lang]}`,
  ].join('\n\n');
}

// Sugerencia clínica breve para el profesional (NUNCA se muestra a la
// persona en riesgo — eso sigue siendo 100% determinista, ver
// buildCrisisResponse). Es un apoyo, no un diagnóstico ni un plan de
// tratamiento: el profesional aplica su propio criterio.
const TREATMENT_SUGGESTION_PROMPT = [
  'Eres un asistente clínico que apoya a un psicólogo. Un paciente vinculado a él acaba de escribir un',
  'mensaje que activó un detector de riesgo autolítico/suicida por palabras clave. Sugiere, en 1 a 2',
  'frases breves y en español, un primer enfoque o siguiente paso terapéutico inmediato para que el',
  'profesional lo considere al contactar al paciente. No diagnostiques, no des un plan de tratamiento',
  'completo, no repitas el mensaje textual del paciente. Sé concreto y accionable (evaluación de riesgo',
  'inmediata, contención, contacto telefónico directo, revisar red de apoyo, etc.). Responde solo con la',
  'sugerencia, sin introducción.',
].join(' ');

async function generateTreatmentSuggestion(message: string, apiKey: string | undefined): Promise<string> {
  const fallback = 'Contacta al paciente lo antes posible para evaluar el riesgo directamente y reforzar su red de apoyo y contactos de emergencia.';
  if (!apiKey) return fallback;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: TREATMENT_SUGGESTION_PROMPT },
          { role: 'user', content: message },
        ],
        temperature: 0.4,
        max_tokens: 120,
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const text: string | undefined = json.choices?.[0]?.message?.content?.trim();
    return text || fallback;
  } catch (err) {
    console.error('generateTreatmentSuggestion falló:', err);
    return fallback;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Best-effort: si falla, nunca debe tumbar la alerta en sí (que ya quedó
// guardada en risk_alerts antes de llegar acá) — el correo es un aviso
// adicional, no la fuente de verdad.
async function sendRiskAlertEmail(params: { toEmail: string; patientName: string; reason: string; excerpt: string; suggestion: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('sendRiskAlertEmail: RESEND_API_KEY no configurado, no se pudo avisar por correo.');
    return;
  }
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Calivia <onboarding@resend.dev>';
  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#F5F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="width:40px;height:40px;border-radius:12px;background:#B85C4A;color:#fff;text-align:center;line-height:40px;font-size:18px;">⚠</div>
          <h1 style="margin:16px 0 0;font-size:20px;color:#1a1d1a;">Alerta de riesgo — ${escapeHtml(params.patientName)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;">
          <p style="font-size:13px;color:#8c8a7e;margin:0 0 4px;">MOTIVO</p>
          <p style="font-size:14px;line-height:1.6;color:#3a3a36;margin:0 0 16px;">${escapeHtml(params.reason)}</p>
          <p style="font-size:13px;color:#8c8a7e;margin:0 0 4px;">FRAGMENTO DEL MENSAJE</p>
          <div style="margin:0 0 16px;padding:12px;background:#F5F3EE;border-radius:10px;font-size:13px;color:#3a3a36;font-style:italic;">"${escapeHtml(params.excerpt)}"</div>
          <p style="font-size:13px;color:#8c8a7e;margin:0 0 4px;">SUGERENCIA</p>
          <p style="font-size:14px;line-height:1.6;color:#3a3a36;margin:0 0 20px;">${escapeHtml(params.suggestion)}</p>
          <p style="font-size:12px;color:#8c8a7e;">Abre Calivia para ver el detalle y marcar la alerta como revisada.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: params.toEmail,
        subject: `Alerta de riesgo — ${params.patientName}`,
        html,
        text: `Alerta de riesgo para ${params.patientName}.\n\nMotivo: ${params.reason}\n\nFragmento: "${params.excerpt}"\n\nSugerencia: ${params.suggestion}\n\nAbre Calivia para ver el detalle.`,
      }),
    });
    if (!res.ok) console.error('sendRiskAlertEmail: Resend error', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('sendRiskAlertEmail falló:', err);
  }
}

// Best-effort: si falla cualquier paso acá, no debe romper el chat.
// El "reason" queda solo en el panel del psicólogo (en español), así que no
// se traduce.
export async function maybeCreateRiskAlert(supabase: ReturnType<typeof createClient>, userId: string, message: string) {
  try {
    const matched = detectRiskKeyword(message);
    if (!matched) return;
    // Solo un vínculo YA CONFIRMADO (con código verificado, ver
    // 20260825170000_patient_link_invite_and_code_flow.sql) recibe alertas —
    // una invitación todavía pendiente de aceptar/confirmar no cuenta.
    const { data: link } = await supabase
      .from('patient_links')
      .select('psychologist_id')
      .eq('patient_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!link) return;

    const reason = `Palabra clave de riesgo detectada: "${matched}"`;
    const excerpt = message.slice(0, 200);
    const suggestion = await generateTreatmentSuggestion(message, Deno.env.get('OPENAI_API_KEY'));

    await supabase.from('risk_alerts').insert({
      patient_id: userId,
      psychologist_id: link.psychologist_id,
      reason,
      message_excerpt: excerpt,
      treatment_suggestion: suggestion,
    });

    const [{ data: patientProfile }, { data: psychProfile }] = await Promise.all([
      supabase.from('profiles').select('full_name, preferred_name').eq('id', userId).maybeSingle(),
      supabase.from('profiles').select('recovery_email').eq('id', link.psychologist_id).maybeSingle(),
    ]);

    if (psychProfile?.recovery_email) {
      await sendRiskAlertEmail({
        toEmail: psychProfile.recovery_email as string,
        patientName: (patientProfile?.preferred_name as string) || (patientProfile?.full_name as string) || 'un paciente',
        reason,
        excerpt,
        suggestion,
      });
    }
  } catch (err) {
    console.error('maybeCreateRiskAlert failed:', err);
  }
}
