import type { LanguageCode, Strings } from './lib/i18n';

// Textos de interfaz (botones, labels, placeholders, mensajes de estado/error).
const strings: Strings = {
  es: {
    voiceLabel: 'Voz de Calivia:',
    voiceSelectAria: 'Seleccionar voz de Calivia',
    searchingVoices: 'Buscando voces…',
    loadingSpace: 'Cargando tu espacio…',
    welcomeSub: 'Te escucho, sin prisa.',
    fallbackNote: 'Calivia está en modo de respaldo. Tus mensajes siguen siendo escuchados.',
    ttsBlockedNote: 'Tu navegador bloqueó el audio automático — toca aquí para escuchar la respuesta',
    limitReached: 'Has alcanzado el límite diario de la Versión Calma.',
    unlockUnlimited: 'Desbloquear Calivia Ilimitada',
    exploreUnlimited: 'Explora Calivia Ilimitada arriba.',
    inputPlaceholderLimit: 'Límite diario alcanzado…',
    inputPlaceholderListening: 'Escuchando… habla ahora',
    inputPlaceholderDefault: 'Escribe lo que traes dentro…',
    inputAria: 'Mensaje a Calivia',
    stopRecording: 'Detener grabación',
    speakToMic: 'Hablar al micrófono',
    micTitleSupported: 'Dictar por voz y recibir respuesta hablada',
    micTitleUnsupported: 'Tu navegador no soporta dictado por voz',
    errNoVoiceSupport: 'Tu navegador no soporta dictado por voz.',
    errMicPermission: 'Necesitamos permiso de micrófono para dictar por voz. Revísalo en los ajustes de la app.',
    errMicNoResponse: 'El micrófono no respondió. Verifica que el servicio de reconocimiento de voz de tu dispositivo esté activo e intenta de nuevo.',
    errMicNotAllowed: 'No se pudo acceder al micrófono. Revisa los permisos del navegador.',
    errTranscribeFailed: 'No se pudo transcribir la voz. Intenta escribir tu mensaje.',
    errVoiceInputFailed: 'No se pudo iniciar el dictado por voz. Intenta de nuevo.',
    errUnexpected: 'Error inesperado',
    errEmptyReply: 'Respuesta vacía del asistente.',
    errAssistantNoResponse: 'El asistente no respondió ({{status}}). {{detail}}',
  },
  en: {
    voiceLabel: "Calivia's voice:",
    voiceSelectAria: "Select Calivia's voice",
    searchingVoices: 'Looking for voices…',
    loadingSpace: 'Loading your space…',
    welcomeSub: "I'm listening, no rush.",
    fallbackNote: "Calivia is in backup mode. Your messages are still being heard.",
    ttsBlockedNote: 'Your browser blocked automatic audio — tap here to hear the reply',
    limitReached: "You've reached today's limit for the Calm version.",
    unlockUnlimited: 'Unlock Calivia Unlimited',
    exploreUnlimited: 'Explore Calivia Unlimited above.',
    inputPlaceholderLimit: 'Daily limit reached…',
    inputPlaceholderListening: 'Listening… speak now',
    inputPlaceholderDefault: "Write what's on your mind…",
    inputAria: 'Message to Calivia',
    stopRecording: 'Stop recording',
    speakToMic: 'Speak into the microphone',
    micTitleSupported: 'Dictate by voice and get a spoken reply',
    micTitleUnsupported: "Your browser doesn't support voice dictation",
    errNoVoiceSupport: "Your browser doesn't support voice dictation.",
    errMicPermission: "We need microphone permission to dictate by voice. Check it in the app's settings.",
    errMicNoResponse: "The microphone didn't respond. Check that your device's speech recognition service is active and try again.",
    errMicNotAllowed: "Couldn't access the microphone. Check your browser permissions.",
    errTranscribeFailed: "Couldn't transcribe your voice. Try typing your message.",
    errVoiceInputFailed: "Couldn't start voice dictation. Try again.",
    errUnexpected: 'Unexpected error',
    errEmptyReply: 'Empty reply from the assistant.',
    errAssistantNoResponse: "The assistant didn't respond ({{status}}). {{detail}}",
  },
  pt: {
    voiceLabel: 'Voz da Calivia:',
    voiceSelectAria: 'Selecionar a voz da Calivia',
    searchingVoices: 'Procurando vozes…',
    loadingSpace: 'Carregando seu espaço…',
    welcomeSub: 'Estou te ouvindo, sem pressa.',
    fallbackNote: 'A Calivia está em modo de backup. Suas mensagens continuam sendo ouvidas.',
    ttsBlockedNote: 'Seu navegador bloqueou o áudio automático — toque aqui para ouvir a resposta',
    limitReached: 'Você atingiu o limite diário da Versão Calma.',
    unlockUnlimited: 'Desbloquear Calivia Ilimitada',
    exploreUnlimited: 'Conheça a Calivia Ilimitada acima.',
    inputPlaceholderLimit: 'Limite diário atingido…',
    inputPlaceholderListening: 'Ouvindo… fale agora',
    inputPlaceholderDefault: 'Escreva o que você está sentindo…',
    inputAria: 'Mensagem para a Calivia',
    stopRecording: 'Parar gravação',
    speakToMic: 'Falar no microfone',
    micTitleSupported: 'Ditar por voz e receber resposta falada',
    micTitleUnsupported: 'Seu navegador não suporta ditado por voz',
    errNoVoiceSupport: 'Seu navegador não suporta ditado por voz.',
    errMicPermission: 'Precisamos de permissão do microfone para ditar por voz. Verifique nas configurações do app.',
    errMicNoResponse: 'O microfone não respondeu. Verifique se o serviço de reconhecimento de voz do seu dispositivo está ativo e tente novamente.',
    errMicNotAllowed: 'Não foi possível acessar o microfone. Verifique as permissões do navegador.',
    errTranscribeFailed: 'Não foi possível transcrever sua voz. Tente digitar sua mensagem.',
    errVoiceInputFailed: 'Não foi possível iniciar o ditado por voz. Tente novamente.',
    errUnexpected: 'Erro inesperado',
    errEmptyReply: 'Resposta vazia do assistente.',
    errAssistantNoResponse: 'O assistente não respondeu ({{status}}). {{detail}}',
  },
};

export default strings;

// Tag BCP-47 para el reconocimiento (STT) y la síntesis (TTS) de voz nativos
// del navegador, según el idioma elegido en la app.
export const SPEECH_LANG_TAG: Record<LanguageCode, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-PT',
};

// --- Contenido conversacional del fallback local (sin conexión al backend) ---
// Esto SÍ se muestra directamente al usuario dentro de las burbujas del chat,
// a diferencia del prompt de sistema que se envía a la IA real (ese vive en
// supabase/functions/ai-chat/index.ts y no se toca aquí).

export const SYSTEM_NOTE: Record<LanguageCode, string> = {
  es: 'Soy Calivia (la unión de calma y alivio). Un espacio de acompañamiento, no sustituyo la atención profesional.',
  en: "I'm Calivia (the union of calm and relief). A space to accompany you — I don't replace professional care.",
  pt: 'Sou a Calivia (a união de calma e alívio). Um espaço de acompanhamento — não substituo o cuidado profissional.',
};

export const QUICK_PROMPTS: Record<LanguageCode, string[]> = {
  es: ['No sé por dónde empezar', 'Necesito un momento para respirar', 'Hoy fue un día difícil', 'Solo quiero que alguien me escuche'],
  en: ["I don't know where to start", 'I need a moment to breathe', 'Today was a hard day', 'I just want someone to listen'],
  pt: ['Não sei por onde começar', 'Preciso de um momento para respirar', 'Hoje foi um dia difícil', 'Só quero que alguém me escute'],
};

interface Greetings {
  morning: string;
  afternoon: string;
  night: string;
}

export const FALLBACK_GREETINGS: Record<LanguageCode, Greetings> = {
  es: {
    morning: 'Buenos días, soy Calivia. ¿Cómo te sientes para comenzar tu día?',
    afternoon: 'Hola, buenas tardes, soy Calivia. Recuerda que debes comer, o ¿ya has comido? ¿Cómo va tu día?',
    night: 'Hola, soy Calivia. ¿Cómo estuvo tu día hoy? ¿Ya has cenado?',
  },
  en: {
    morning: "Good morning, I'm Calivia. How are you feeling as you start your day?",
    afternoon: "Hi, good afternoon, I'm Calivia. Remember to eat — or have you eaten already? How's your day going?",
    night: "Hi, I'm Calivia. How was your day today? Have you had dinner yet?",
  },
  pt: {
    morning: 'Bom dia, sou a Calivia. Como você está se sentindo para começar o dia?',
    afternoon: 'Oi, boa tarde, sou a Calivia. Lembre-se de comer, ou você já comeu? Como está o seu dia?',
    night: 'Oi, sou a Calivia. Como foi o seu dia hoje? Você já jantou?',
  },
};

export const BURST_ACK_REPLIES: Record<LanguageCode, string[]> = {
  es: ['Te sigo leyendo, continúa.', 'Aquí estoy. Sigue, tómate tu tiempo.', 'Te escucho, continúa cuando quieras.'],
  en: ["I'm still reading, go on.", "I'm here. Keep going, take your time.", "I'm listening, continue whenever you're ready."],
  pt: ['Continuo lendo, pode seguir.', 'Estou aqui. Continue, no seu tempo.', 'Estou te ouvindo, continue quando quiser.'],
};

export const SOCRATIC_FOLLOWUPS: Record<LanguageCode, string[]> = {
  es: [
    'Y cuando eso pasó, ¿qué parte crees que fue tuya y qué parte fue del otro lado? Pienso que hay algo ahí que no estás mirando.',
    'Déjame preguntarte algo directo: ¿estás reaccionando a lo que pasó o a lo que te imaginas que significa? A veces nos enojamos con la historia, no con los hechos.',
    'Pongo en la mesa algo incómodo: dices que no tuviste elección, pero siempre hay una. ¿Qué ganaste al quedarte callado? ¿Qué estabas protegiendo?',
    'Te escucho, pero noto que te estás quedando en lo que el otro hizo mal. ¿Y tú? ¿Qué responsabilidad tienes en cómo terminó?',
    'Parémonos aquí un momento. Dices "no puedo más", pero llevas días diciéndolo sin cambiar nada. ¿Qué te impide dar el primer paso? ¿Miedo o costumbre?',
    'Voy a cuestionarte algo: ¿de verdad crees que eso que sientes es miedo al cambio, o es miedo a perder el control de una situación que ya no te sirve?',
    'Te lo digo sin rodeos: estás pidiendo que el otro cambie para no tener que moverte tú. ¿Qué pasaría si el otro no cambia? ¿Te quedarías así para siempre?',
    'Noto un patrón: todo lo que cuentas tiene al otro como protagonista y a ti como espectador. ¿Cuándo vas a tomar el rol principal de tu historia?',
  ],
  en: [
    "And when that happened, what part do you think was yours, and what part was on the other side? I think there's something there you're not looking at.",
    'Let me ask you something direct: are you reacting to what happened, or to what you imagine it means? Sometimes we get angry at the story, not the facts.',
    'Let me put something uncomfortable on the table: you say you had no choice, but there is always one. What did you gain by staying quiet? What were you protecting?',
    "I hear you, but I notice you're staying focused on what the other person did wrong. And you? What responsibility do you have in how it ended?",
    'Let\'s pause here a moment. You say "I can\'t take it anymore," but you\'ve been saying that for days without changing anything. What\'s stopping you from taking the first step? Fear, or habit?',
    "I'm going to challenge you on something: do you really believe what you're feeling is fear of change, or is it fear of losing control of a situation that no longer serves you?",
    "I'll say it plainly: you're asking the other person to change so you don't have to move. What would happen if they don't change? Would you stay like this forever?",
    'I notice a pattern: everything you describe has the other person as the protagonist and you as the spectator. When are you going to take the lead role in your own story?',
  ],
  pt: [
    'E quando isso aconteceu, que parte você acha que foi sua e que parte foi do outro lado? Acho que há algo aí que você não está enxergando.',
    'Deixa eu te perguntar algo direto: você está reagindo ao que aconteceu ou ao que você imagina que isso significa? Às vezes ficamos com raiva da história, não dos fatos.',
    'Vou colocar algo incômodo na mesa: você diz que não teve escolha, mas sempre há uma. O que você ganhou ao ficar calado? O que você estava protegendo?',
    'Estou te ouvindo, mas percebo que você está preso no que o outro fez de errado. E você? Que responsabilidade você tem em como isso terminou?',
    'Vamos parar aqui um momento. Você diz "não aguento mais", mas já faz dias que diz isso sem mudar nada. O que te impede de dar o primeiro passo? Medo ou hábito?',
    'Vou te questionar sobre algo: você realmente acha que o que sente é medo da mudança, ou é medo de perder o controle de uma situação que já não te serve?',
    'Vou te falar sem rodeios: você está pedindo que o outro mude para você não precisar se mover. E se o outro não mudar? Você ficaria assim para sempre?',
    'Percebo um padrão: tudo que você conta tem o outro como protagonista e você como espectador. Quando você vai assumir o papel principal da sua própria história?',
  ],
};

export const CLOSURE_REPLIES: Record<LanguageCode, string[]> = {
  es: [
    'Eso que acabas de decir es tuyo, no mío. Quédate con eso. Cuando lo pongas en práctica, vuelve y me cuentas.',
    'Me gustó lo que dijiste. No te voy a dar un discurso, solo esto: confío en que lo vas a hacer bien.',
    'Buena reflexión. Ese insight es el primer paso. El segundo es actuar. Aquí estaré cuando lo necesites.',
    'Llegaste ahí por ti mismo, que es como debe ser. Sigue ese instinto, no te traiciones.',
  ],
  en: [
    "What you just said is yours, not mine. Hold on to that. When you put it into practice, come back and tell me.",
    "I liked what you said. I won't give you a speech, just this: I trust you'll do well.",
    "Good reflection. That insight is the first step. The second is acting on it. I'll be here when you need me.",
    "You got there on your own, which is how it should be. Follow that instinct, don't betray yourself.",
  ],
  pt: [
    'O que você acabou de dizer é seu, não meu. Guarde isso. Quando colocar em prática, volte e me conte.',
    'Gostei do que você disse. Não vou te dar um discurso, só isto: confio que você vai se sair bem.',
    'Boa reflexão. Esse insight é o primeiro passo. O segundo é agir. Estarei aqui quando precisar.',
    'Você chegou até aí sozinho, e é assim que deve ser. Siga esse instinto, não se traia.',
  ],
};

export const CRISIS_FALLBACK_REPLY: Record<LanguageCode, string> = {
  es: [
    'Lo que acabas de compartir me llega hondo, y quiero decírtelo con toda claridad: no estás solo en esto, y tu vida tiene un valor inmenso, aunque ahora mismo cueste sentirlo así.',
    'Piensa un segundo en las personas que te quieren —hijos, pareja, padres, hermanos, algún amigo cercano— y sostente en esa idea un momento: son parte de tu ancla, tu motor, una razón real para seguir.',
    'Si estás en peligro inmediato, contacta ya a los servicios de emergencia de tu país (por ejemplo, el 911 o su equivalente local). Mientras tanto, un sonido de anclaje en "Sonidos" (lluvia, latidos, viento) puede ayudarte a bajar la intensidad.',
    'Usa ahora mismo el botón de "Respiro urgente" de esta app para tener a la mano un contacto de confianza y un ejercicio de respiración guiada. No te quedes solo con esto — habla con alguien ahora.',
  ].join('\n\n'),
  en: [
    'What you just shared reaches me deeply, and I want to tell you clearly: you are not alone in this, and your life has immense value, even if it is hard to feel that right now.',
    "Take a second to think about the people who love you — children, a partner, parents, siblings, a close friend — and hold onto that thought for a moment: they're part of your anchor, your drive, a real reason to keep going.",
    'If you are in immediate danger, contact your local emergency services right now (for example, 911 or your local equivalent). In the meantime, a grounding sound in "Sounds" (rain, heartbeat, wind) can help bring the intensity down.',
    'Use the "Urgent breath" button in this app right now to have a trusted contact and a guided breathing exercise on hand. Don\'t stay alone with this — talk to someone now.',
  ].join('\n\n'),
  pt: [
    'O que você acabou de compartilhar me toca profundamente, e quero te dizer com toda clareza: você não está sozinho nisso, e sua vida tem um valor imenso, mesmo que agora seja difícil sentir isso.',
    'Pense por um segundo nas pessoas que te amam — filhos, parceiro(a), pais, irmãos, algum amigo próximo — e se apoie nessa ideia por um momento: eles são parte da sua âncora, do seu motor, um motivo real para continuar.',
    'Se você está em perigo imediato, entre em contato agora com os serviços de emergência do seu país (por exemplo, o 112 ou o equivalente local). Enquanto isso, um som de ancoragem em "Sons" (chuva, batimentos, vento) pode ajudar a baixar a intensidade.',
    'Use agora o botão "Respiro urgente" deste app para ter à mão um contato de confiança e um exercício de respiração guiada. Não fique sozinho com isso — fale com alguém agora.',
  ].join('\n\n'),
};

export const MEANING_REPLY: Record<LanguageCode, string> = {
  es: 'Calivia nace de la unión entre calma y alivio. Es el significado real de este espacio: un refugio diseñado para ofrecerte exactamente eso, un lugar donde puedas pausar y encontrar sosiego.',
  en: "Calivia comes from the union of calm and relief. That's the real meaning of this space: a refuge designed to offer you exactly that — a place to pause and find peace.",
  pt: 'Calivia nasce da união entre calma e alívio. Esse é o real significado deste espaço: um refúgio pensado para te oferecer exatamente isso, um lugar onde você possa pausar e encontrar sossego.',
};

export const DIAGNOSIS_REPLY: Record<LanguageCode, string> = {
  es: 'No tengo la capacidad de dar un diagnóstico clínico, pero puedo acompañarte. Para una evaluación profesional, te invito a agendar una sesión con el especialista: https://calendly.com/consultoresgaman/30min',
  en: "I'm not able to give a clinical diagnosis, but I can be here with you. For a professional evaluation, I invite you to book a session with the specialist: https://calendly.com/consultoresgaman/30min",
  pt: 'Não tenho a capacidade de dar um diagnóstico clínico, mas posso te acompanhar. Para uma avaliação profissional, te convido a agendar uma sessão com o especialista: https://calendly.com/consultoresgaman/30min',
};

export const NO_ANSWER_REPLY: Record<LanguageCode, string> = {
  es: 'No te voy a dar la respuesta, porque no es mía para dar. Déjame preguntarte: si yo no estuviera aquí y tuvieras que decidir solo, ¿qué harías? Esa intuición que aparece cuando nadie te dice qué hacer... ¿qué te dice?',
  en: "I'm not going to give you the answer, because it's not mine to give. Let me ask you: if I weren't here and you had to decide on your own, what would you do? That gut feeling that shows up when no one tells you what to do... what is it telling you?",
  pt: 'Não vou te dar a resposta, porque ela não é minha para dar. Deixa eu te perguntar: se eu não estivesse aqui e você tivesse que decidir sozinho, o que faria? Aquela intuição que aparece quando ninguém te diz o que fazer... o que ela te diz?',
};

// Palabras clave de riesgo autolítico/suicida. Se revisan TODAS juntas, sin
// importar el idioma de la interfaz, porque la persona puede escribir en
// cualquier idioma independientemente de en qué idioma tenga la app.
export const RISK_KEYWORDS: Record<LanguageCode, string[]> = {
  es: [
    'suicid', 'quitarme la vida', 'no quiero seguir viviendo', 'no quiero vivir',
    'terminar con todo', 'terminar con mi vida', 'acabar con mi vida', 'acabar con todo',
    'hacerme daño', 'hacerme dano', 'autolesion', 'autolesión', 'cortarme',
    'no aguanto más', 'no aguanto mas', 'quiero desaparecer', 'desaparecer para siempre',
    'ya no puedo más', 'ya no puedo mas', 'no vale la pena vivir', 'no vale la pena seguir',
    'no quiero estar aquí', 'no quiero estar aqui', 'me quiero matar', 'quiero matarme',
    'matarme', 'me quiero morir', 'quiero morir', 'ya no tiene sentido vivir',
  ],
  en: [
    'suicid', 'kill myself', 'want to die', 'i want to die', 'don\'t want to live', 'do not want to live',
    'end it all', 'end my life', 'ending my life', 'hurt myself', 'self harm', 'self-harm',
    'cutting myself', 'can\'t take it anymore', 'cannot take it anymore', 'want to disappear',
    'disappear forever', 'not worth living', 'not worth going on', 'don\'t want to be here',
    'do not want to be here', 'kill me', 'no longer want to live',
  ],
  pt: [
    'suicid', 'tirar minha vida', 'não quero mais viver', 'nao quero mais viver',
    'acabar com tudo', 'acabar com minha vida', 'acabar com a minha vida', 'me machucar',
    'automutilação', 'automutilacao', 'autolesão', 'autolesao', 'me cortar',
    'não aguento mais', 'nao aguento mais', 'quero desaparecer', 'desaparecer para sempre',
    'não vale a pena viver', 'nao vale a pena viver', 'não quero estar aqui', 'nao quero estar aqui',
    'quero me matar', 'me matar', 'quero morrer', 'não faz mais sentido viver', 'nao faz mais sentido viver',
  ],
};

// Frases del USUARIO que disparan respuestas fijas del fallback local. Igual
// que con RISK_KEYWORDS, se buscan en los tres idiomas a la vez.
export const MEANING_TRIGGERS: Record<LanguageCode, { primary: string[]; secondary: string[] }> = {
  es: { primary: ['significa'], secondary: ['calivia', 'tu nombre'] },
  en: { primary: ['mean', 'meaning'], secondary: ['calivia', 'your name'] },
  pt: { primary: ['significa'], secondary: ['calivia', 'seu nome'] },
};

export const DIAGNOSIS_TRIGGERS: Record<LanguageCode, string[]> = {
  es: ['diagnóstico', 'diagnostico', 'tengo algo'],
  en: ['diagnosis', 'diagnose', 'what do i have'],
  pt: ['diagnóstico', 'diagnostico', 'tenho algo'],
};

export const GRATITUDE_TRIGGERS: Record<LanguageCode, string[]> = {
  es: ['gracias', 'me sirve', 'tiene sentido'],
  en: ['thank you', 'thanks', 'that helps', 'makes sense'],
  pt: ['obrigado', 'obrigada', 'me ajuda', 'faz sentido'],
};

export const ADVICE_TRIGGERS: Record<LanguageCode, string[]> = {
  es: ['qué hago', 'que hago', 'cómo'],
  en: ['what should i do', 'what do i do', 'how'],
  pt: ['o que eu faço', 'o que faço', 'como'],
};
