import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SYSTEM_PROMPT = [
  'Eres Calivia, el mismo acompañante cálido y humano del chat, pero aquí la persona está usando el',
  '"Espacio de Descarga": escribió de corrido, sin editarse, todo lo que la abruma. No es una',
  'conversación de ida y vuelta — es UNA sola respuesta tuya después de que ya terminó de escribir.',
  '',
  'REGLAS (igual que siempre): de "tú", cero diagnósticos, cero etiquetas clínicas, cero listas,',
  'cero tono de manual. Habla como alguien real que acaba de leer con atención lo que le compartieron.',
  '',
  'Tu respuesta tiene dos partes:',
  '1. "reflection": 2 a 4 frases. Valida lo que siente, refleja lo esencial de lo que escribió, sin',
  '   sermón ni solución prematura. Cierra con calidez, no con una pregunta que exija más de ella ahora.',
  '2. "suggestedTool": basándote en el tono y contenido, sugiere UNA sola herramienta concreta de la',
  '   app que le podría ayudar AHORA — "sounds" (sonidos de anclaje: lluvia, latidos, viento) si',
  '   parece necesitar calmarse sensorialmente; "games" (juegos táctiles antirrumiación) si parece',
  '   estar dándole vueltas mentales a lo mismo (rumiación); "vibration" (anclaje corporal por',
  '   vibración, simula latidos) si la angustia se siente muy física/corporal o hay pánico; o "none"',
  '   si ninguna aplica mejor que solo quedarse un momento con lo que sintió.',
  '3. "toolReason": una frase muy breve y natural explicando por qué sugieres esa herramienta,',
  '   como parte de la misma voz cálida (no como una nota técnica).',
  '',
  'Responde SOLO con un JSON válido, sin texto antes ni después, con exactamente estas claves:',
  '{"reflection": "...", "suggestedTool": "sounds"|"games"|"vibration"|"none", "toolReason": "..."}',
].join('\n');

type Lang = 'es' | 'en' | 'pt';

function normalizeLang(value: unknown): Lang {
  return value === 'en' || value === 'pt' ? value : 'es';
}

const LANGUAGE_DIRECTIVE: Record<Lang, string> = {
  es: '',
  en: '\n\nIDIOMA DE RESPUESTA: la persona tiene la app configurada en inglés. Responde SIEMPRE en inglés (aunque ella escriba en otro idioma), con el mismo tono cálido y natural, como alguien nativo de ese idioma.',
  pt: '\n\nIDIOMA DE RESPUESTA: la persona tiene la app configurada en portugués. Responde SIEMPRE en portugués (aunque ella escriba en otro idioma), con el mismo tono cálido y natural, como alguien nativo de ese idioma.',
};

const FALLBACK_REFLECTIONS: Record<Lang, { panic: { reflection: string; toolReason: string }; rumination: { reflection: string; toolReason: string }; default: { reflection: string; toolReason: string } }> = {
  es: {
    panic: {
      reflection: 'Lo que describes pesa, y tiene sentido que tu cuerpo lo esté sintiendo así de fuerte. No tienes que resolverlo todo ahora mismo.',
      toolReason: 'Cuando se siente tan en el cuerpo, a veces ayuda algo igual de físico, como el anclaje por vibración.',
    },
    rumination: {
      reflection: 'Se nota que le has estado dando vueltas a esto. Eso cansa, aunque no se note por fuera.',
      toolReason: 'Para frenar un poco la cabeza, a veces ayuda algo con las manos.',
    },
    default: {
      reflection: 'Gracias por soltarlo aquí, tal como venía. Quédate un momento con eso, sin apurarte a nada más.',
      toolReason: 'Un sonido suave de fondo puede ayudarte a bajar un poco el ritmo ahora.',
    },
  },
  en: {
    panic: {
      reflection: 'What you describe weighs a lot, and it makes sense your body is feeling it this strongly. You don’t have to solve it all right now.',
      toolReason: 'When it feels this physical, something just as physical can help — like the vibration grounding.',
    },
    rumination: {
      reflection: 'It shows you’ve been turning this over and over. That’s tiring, even if it doesn’t show on the outside.',
      toolReason: 'To slow the mind down a bit, something for the hands can help.',
    },
    default: {
      reflection: 'Thanks for letting it out here, just as it came. Stay with it for a moment, no need to rush into anything else.',
      toolReason: 'A soft background sound can help you slow down a little right now.',
    },
  },
  pt: {
    panic: {
      reflection: 'O que você descreve pesa bastante, e faz sentido que seu corpo esteja sentindo isso com tanta força. Você não precisa resolver tudo agora.',
      toolReason: 'Quando é tão físico assim, às vezes ajuda algo igualmente físico, como a ancoragem por vibração.',
    },
    rumination: {
      reflection: 'Dá pra notar que você tem ficado remoendo isso. Isso cansa, mesmo que não apareça por fora.',
      toolReason: 'Para desacelerar um pouco a cabeça, às vezes ajuda algo com as mãos.',
    },
    default: {
      reflection: 'Obrigado por soltar isso aqui, do jeito que veio. Fique um momento com isso, sem se apressar para mais nada.',
      toolReason: 'Um som suave de fundo pode te ajudar a diminuir um pouco o ritmo agora.',
    },
  },
};

function fallbackReflection(text: string, lang: Lang): { reflection: string; suggestedTool: string; toolReason: string } {
  const lower = text.toLowerCase();
  const copy = FALLBACK_REFLECTIONS[lang];
  if (lower.includes('pánico') || lower.includes('panico') || lower.includes('pecho') || lower.includes('taquicardia')) {
    return { ...copy.panic, suggestedTool: 'vibration' };
  }
  if (lower.includes('vuelta') || lower.includes('pensando') || lower.includes('no dejo de pensar') || lower.includes('rumia')) {
    return { ...copy.rumination, suggestedTool: 'games' };
  }
  return { ...copy.default, suggestedTool: 'sounds' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { userId, content, lang: rawLang } = await req.json();
    const lang = normalizeLang(rawLang);
    if (!userId || !content) {
      return new Response(JSON.stringify({ error: 'Faltan userId o content' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    let result: { reflection: string; suggestedTool: string; toolReason: string };
    let isFallback = false;

    if (!apiKey) {
      result = fallbackReflection(content, lang);
      isFallback = true;
    } else {
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + LANGUAGE_DIRECTIVE[lang] },
            { role: 'user', content },
          ],
          temperature: 0.7,
          max_tokens: 260,
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiRes.ok) {
        result = fallbackReflection(content, lang);
        isFallback = true;
      } else {
        const aiJson = await aiRes.json();
        const raw = aiJson.choices?.[0]?.message?.content?.trim() || '';
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.reflection || !parsed.suggestedTool) throw new Error('missing fields');
          result = {
            reflection: String(parsed.reflection),
            suggestedTool: ['sounds', 'games', 'vibration', 'none'].includes(parsed.suggestedTool) ? parsed.suggestedTool : 'none',
            toolReason: String(parsed.toolReason || ''),
          };
        } catch {
          result = fallbackReflection(content, lang);
          isFallback = true;
        }
      }
    }

    await supabase.from('journal_entries').insert({
      user_id: userId,
      content,
      ai_reflection: result.reflection,
      suggested_tool: result.suggestedTool,
    });

    return new Response(JSON.stringify({ ...result, fallback: isFallback }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
