import type { LanguageCode, Strings } from './lib/i18n';

export interface StoryChoice {
  label: string;
  tag: string;
  reply: string;
}

export interface ChoiceStep {
  kind: 'choice';
  prompt: string;
  choices: [StoryChoice, StoryChoice];
}

// Variante de mecánica: en vez de elegir entre dos frases, un gesto simple
// y sin presión (mantener presionado). No hay fallo ni cronómetro visible —
// soltar antes de tiempo solo reinicia el gesto, se puede reintentar las
// veces que haga falta.
export interface HoldStep {
  kind: 'hold';
  prompt: string;
  holdLabel: string;
  tag: string;
  reply: string;
}

export type StoryStep = ChoiceStep | HoldStep;

export interface StoryEnding {
  title: string;
  body: string;
}

const strings: Strings = {
  es: {
    back: 'Volver',
    gameSpheres: 'Esferas',
    gameRaindrop: 'Melodías',
    gameTrace: 'Trazar',
    gameParticles: 'Partículas',
    gameAscent: 'El Ascenso',
    gameBalance: 'Equilibrio Interior',
    premium: 'Premium',
    spheresEmpty: 'Arrastra desde una esfera hasta su pareja del mismo color.',
    raindropEmpty: 'Toca o desliza el dedo para limpiar las gotas.',
    particlesEmpty: 'Toca y desliza para sembrar partículas de luz.',
    traceEmpty: 'Toca y desliza para trazar líneas suaves.',
    melodyDone: '🎵 Has despejado la melodía por completo.',
    melodyDoneSub: '¿La reconoces? En un momento suena otra.',
    storyRestart: 'Empezar de nuevo',
    hintSpheres: 'Conecta cada esfera con su pareja del mismo color. Sin prisa, sin meta.',
    hintRaindrop: 'Cada gota es una nota. Límpialas a tu ritmo y descubre la melodía.',
    hintTrace: 'Traza líneas suaves con el dedo. Sin meta, sin destino.',
    hintParticles: 'Toca y desliza el dedo. Cada roce enciende una partícula y un tono distinto.',
    hintAscent: 'Elige a tu ritmo. No hay una decisión correcta, solo tu manera de subir.',
    hintBalance: 'Elige lo que resuene más contigo en cada momento. No hay respuesta equivocada.',
  },
  en: {
    back: 'Back',
    gameSpheres: 'Spheres',
    gameRaindrop: 'Melodies',
    gameTrace: 'Trace',
    gameParticles: 'Particles',
    gameAscent: 'The Ascent',
    gameBalance: 'Inner Balance',
    premium: 'Premium',
    spheresEmpty: 'Drag from one sphere to its matching color twin.',
    raindropEmpty: 'Tap or swipe your finger to clear the drops.',
    particlesEmpty: 'Tap and swipe to plant particles of light.',
    traceEmpty: 'Tap and swipe to trace soft lines.',
    melodyDone: "🎵 You've cleared the whole melody.",
    melodyDoneSub: 'Do you recognize it? Another one plays in a moment.',
    storyRestart: 'Start again',
    hintSpheres: 'Connect each sphere with its matching color twin. No rush, no goal.',
    hintRaindrop: 'Each drop is a note. Clear them at your own pace and discover the melody.',
    hintTrace: 'Trace soft lines with your finger. No goal, no destination.',
    hintParticles: 'Tap and swipe your finger. Each touch lights up a particle and a different tone.',
    hintAscent: "Choose at your own pace. There's no right decision, only your own way of climbing.",
    hintBalance: "Choose whatever resonates most with you in each moment. There's no wrong answer.",
  },
  pt: {
    back: 'Voltar',
    gameSpheres: 'Esferas',
    gameRaindrop: 'Melodias',
    gameTrace: 'Traçar',
    gameParticles: 'Partículas',
    gameAscent: 'A Subida',
    gameBalance: 'Equilíbrio Interior',
    premium: 'Premium',
    spheresEmpty: 'Arraste de uma esfera até sua parceira da mesma cor.',
    raindropEmpty: 'Toque ou deslize o dedo para limpar as gotas.',
    particlesEmpty: 'Toque e deslize para semear partículas de luz.',
    traceEmpty: 'Toque e deslize para traçar linhas suaves.',
    melodyDone: '🎵 Você limpou a melodia por completo.',
    melodyDoneSub: 'Você reconhece? Em um instante toca outra.',
    storyRestart: 'Começar de novo',
    hintSpheres: 'Conecte cada esfera com sua parceira da mesma cor. Sem pressa, sem meta.',
    hintRaindrop: 'Cada gota é uma nota. Limpe-as no seu ritmo e descubra a melodia.',
    hintTrace: 'Trace linhas suaves com o dedo. Sem meta, sem destino.',
    hintParticles: 'Toque e deslize o dedo. Cada toque acende uma partícula e um tom diferente.',
    hintAscent: 'Escolha no seu ritmo. Não há uma decisão certa, só o seu jeito de subir.',
    hintBalance: 'Escolha o que mais ressoa com você em cada momento. Não há resposta errada.',
  },
};

export default strings;

// Los tags ('constancia'/'pausa', 'reflexion'/'instinto', 'presencia') son
// claves internas para elegir el final según lo que eligió el usuario — no
// se muestran nunca, así que se mantienen iguales en los 3 idiomas.

function choiceStep(prompt: string, a: StoryChoice, b: StoryChoice): ChoiceStep {
  return { kind: 'choice', prompt, choices: [a, b] };
}

function holdStep(prompt: string, holdLabel: string, tag: string, reply: string): HoldStep {
  return { kind: 'hold', prompt, holdLabel, tag, reply };
}

const ASCENT_BANK_ES: StoryStep[][] = [
  [
    choiceStep(
      'El camino empieza empinado. Ni siquiera has dado el primer paso y ya sientes el peso de la subida.',
      { label: 'Doy el primer paso, aunque sea lento', tag: 'constancia', reply: 'Avanzas despacio, pero avanzas. El camino empieza a moverse contigo.' },
      { label: 'Me quedo un momento mirando la cima', tag: 'pausa', reply: 'Te tomas un segundo para mirar hacia arriba. No es rendirte, es tomar aire antes de empezar.' },
    ),
    choiceStep(
      'Frente a ti hay una cuesta de tierra suelta, del tipo que resbala si no calculas bien el paso.',
      { label: 'Piso firme y avanzo, cuidando cada paso', tag: 'constancia', reply: 'Encuentras un ritmo cuidadoso, paso a paso, sin resbalar.' },
      { label: 'Busco primero con la vista por dónde es menos resbaloso', tag: 'pausa', reply: 'Te tomas un momento para leer el terreno antes de moverte. Ese momento también cuenta.' },
    ),
    choiceStep(
      'No hay nadie más en este camino. Solo tú, la cuesta, y las ganas —o la falta de ellas— de empezar.',
      { label: 'Empiezo aunque las ganas no estén del todo', tag: 'constancia', reply: 'No esperas a tener ganas completas. Simplemente empiezas, y eso ya mueve algo.' },
      { label: 'Me quedo un momento con la falta de ganas, sin pelear con ella', tag: 'pausa', reply: 'Te sientas con esa falta de ganas un rato, sin exigirte sentir otra cosa todavía.' },
    ),
  ],
  [
    choiceStep(
      'A mitad de camino, una duda te alcanza: "¿y si esto no vale la pena?".',
      { label: 'Sigo caminando con la duda a cuestas', tag: 'constancia', reply: 'La duda no desaparece, pero tampoco te detiene. Caminas con ella, no contra ella.' },
      { label: 'Me siento un rato a dejar que la duda hable', tag: 'pausa', reply: 'Te sientas junto a la duda un momento. A veces escucharla es lo que la hace más pequeña.' },
    ),
    choiceStep(
      'Una voz conocida —quizás la tuya, quizás la de alguien más— te dice que no vas a lograrlo.',
      { label: 'Sigo caminando, la voz puede seguir hablando', tag: 'constancia', reply: 'Dejas que la voz hable de fondo, sin obedecerla. Sigues moviendo los pies.' },
      { label: 'Me detengo a mirar de frente esa voz', tag: 'pausa', reply: 'Te giras a mirarla de frente un momento. A veces perder el miedo a verla la hace menos grande.' },
    ),
    holdStep('El peso de la duda pesa más que el camino mismo. Antes de seguir, date un segundo real.', 'Mantén el dedo aquí mientras respiras', 'presencia', 'Te diste ese segundo. Nadie te lo quitó, y el camino te esperó ahí, quieto.'),
  ],
  [
    choiceStep(
      'Las piernas pesan. El cansancio ya no es una idea, es real.',
      { label: 'Aprieto el paso un poco más', tag: 'constancia', reply: 'El cuerpo protesta, pero responde. Un paso, y otro, y otro.' },
      { label: 'Bajo el ritmo, sin dejar de moverme', tag: 'pausa', reply: 'Bajas el ritmo sin detenerte del todo. El cansancio deja de ser un enemigo y pasa a ser solo parte del camino.' },
    ),
    choiceStep(
      'El sol pega distinto ahora. Sientes la garganta seca y las ideas más lentas.',
      { label: 'Sigo, el cuerpo aguanta más de lo que creo', tag: 'constancia', reply: 'Sigues, y el cuerpo —a su manera terca— responde.' },
      { label: 'Busco sombra un momento antes de seguir', tag: 'pausa', reply: 'Encuentras un poco de sombra y te quedas ahí un momento. El camino no se mueve, sigue esperándote.' },
    ),
    choiceStep(
      'Alguien que ya bajaba te dice que falta mucho todavía. No sabes si creerle.',
      { label: 'Sigo mi propio paso, falte lo que falte', tag: 'constancia', reply: 'Decides que tu paso es tuyo, sin importar cuánto diga que falta.' },
      { label: 'Agradezco el aviso y me tomo un respiro con esa información', tag: 'pausa', reply: 'Te tomas un respiro con esa nueva información, sin que te apure ni te frene del todo.' },
    ),
  ],
  [
    choiceStep(
      'Ves la cima, más cerca que nunca, justo cuando menos fuerza sientes tener.',
      { label: 'Uso lo poco que me queda para llegar', tag: 'constancia', reply: 'Con lo último que te queda, das los pasos finales.' },
      { label: 'Respiro hondo antes del último tramo', tag: 'pausa', reply: 'Una última respiración, profunda, antes del tramo final.' },
    ),
    choiceStep(
      'El viento cambia justo antes del final, como si el camino también estuviera despidiéndose de la subida.',
      { label: 'Aprovecho el envión y termino de subir', tag: 'constancia', reply: 'El viento casi te empuja. Aprovechas ese envión hasta arriba.' },
      { label: 'Dejo que el viento me alcance antes de dar el paso final', tag: 'pausa', reply: 'Te quedas un instante sintiendo el viento antes del último paso.' },
    ),
    choiceStep(
      'Ya casi. Lo que sea que te trajo hasta aquí sigue contigo, un paso más.',
      { label: 'Doy ese último paso con todo lo que me trajo hasta aquí', tag: 'constancia', reply: 'Das el último paso con todo lo que te trajo hasta aquí, sin dejar nada atrás.' },
      { label: 'Miro atrás un segundo todo lo recorrido, antes del último paso', tag: 'pausa', reply: 'Miras atrás un instante — todo lo recorrido — antes de dar el paso final.' },
    ),
  ],
];

function buildAscentEndingEs(picks: string[]): StoryEnding {
  const pausas = picks.filter((p) => p === 'pausa').length;
  const constancia = picks.filter((p) => p === 'constancia').length;
  let body: string;
  if (pausas > constancia) {
    body = 'Llegaste tomándote tu tiempo, respirando cuando lo necesitabas. Aquí arriba se ve claro: no hizo falta correr, solo no soltarte del camino.';
  } else if (constancia > pausas) {
    body = 'Llegaste a puro paso firme, casi sin detenerte. Aquí arriba se siente el esfuerzo en cada músculo — y también la certeza de que sí pudiste.';
  } else {
    body = 'Llegaste combinando fuerza y pausa, avanzando y descansando cuando tocaba. Las dos cosas te trajeron hasta aquí.';
  }
  return {
    title: 'Llegaste arriba.',
    body: `${body} El camino no fue igual al de nadie más, pero el esfuerzo constante — a tu manera — fue lo que te sostuvo hasta el final.`,
  };
}

const BALANCE_BANK_ES: StoryStep[][] = [
  [
    choiceStep(
      'Tienes en la cabeza una decisión importante pendiente, y sientes la presión de resolverla ya.',
      { label: 'Analizo cada opción con calma', tag: 'reflexion', reply: 'Te tomas el tiempo de mirar la decisión desde varios ángulos, sin apurarte a cerrar el tema.' },
      { label: 'Sigo lo que mi instinto ya me dice', tag: 'instinto', reply: 'Confías en esa primera respuesta que ya tenías, la que apareció antes de pensar demasiado.' },
    ),
    choiceStep(
      'El reloj no dice nada, pero tú sientes que ya debería estar resuelto esto.',
      { label: 'Suelto la idea de que debía estar resuelto ya', tag: 'reflexion', reply: 'Sueltas esa exigencia de horario que nadie más te puso. La decisión sigue su propio tiempo.' },
      { label: 'Reviso qué fue lo primero que se me ocurrió, sin filtrarlo', tag: 'instinto', reply: 'Vuelves a esa primera idea, la más cruda, antes de que la razón la complique.' },
    ),
    holdStep('Antes de seguir pensando la decisión, date una pausa real, no solo mental.', 'Sostén mientras sueltas el aire', 'presencia', 'Ese aire que soltaste se llevó algo de la urgencia. La decisión sigue ahí, pero un poco más liviana.'),
  ],
  [
    choiceStep(
      'Notas que parte de la presión no viene de la decisión en sí, sino de lo que otros podrían pensar de tu elección.',
      { label: 'Me pregunto qué es lo que yo realmente quiero', tag: 'reflexion', reply: 'Apartas por un momento las voces externas y te haces la pregunta que importa: ¿qué quieres tú?' },
      { label: 'Reconozco esa presión y decido igual', tag: 'instinto', reply: 'Ves la presión con claridad, la nombras, y decides sin dejar que sea ella quien elija por ti.' },
    ),
    choiceStep(
      'Te das cuenta de que ya casi puedes anticipar lo que dirían ciertas personas si te vieran elegir.',
      { label: 'Reconozco esas voces y las dejo del lado de afuera', tag: 'reflexion', reply: 'Nombras esas voces anticipadas y las dejas fuera del círculo de esta decisión.' },
      { label: 'Elijo de todos modos, esas voces no están aquí realmente', tag: 'instinto', reply: 'Recuerdas que esas voces no están realmente en la sala. Decides con quien sí está: tú.' },
    ),
  ],
  [
    choiceStep(
      'Llega el momento de decidir. Ya no hay más información nueva que esperar.',
      { label: 'Elijo la opción que más se alinea con lo que soy', tag: 'reflexion', reply: 'Eliges desde quién eres, no desde el miedo a equivocarte.' },
      { label: 'Elijo y confío en poder ajustar el rumbo después', tag: 'instinto', reply: 'Eliges sabiendo que ninguna decisión es definitiva del todo — siempre se puede ajustar el rumbo.' },
    ),
    choiceStep(
      'No hay una señal externa que te confirme que es el momento. Tendrás que confiar en que sí lo es.',
      { label: 'Confío en el proceso que hice para llegar hasta aquí', tag: 'reflexion', reply: 'Confías en el camino que ya recorriste para llegar a este punto, no solo en el resultado.' },
      { label: 'Confío en que, si algo estuviera mal, ya lo sentiría distinto', tag: 'instinto', reply: 'Confías en esa sensación de fondo — la que no cambió en todo este tiempo.' },
    ),
    choiceStep(
      'Sientes que postergar un poco más no te va a dar más claridad, solo más cansancio.',
      { label: 'Decido ahora, apoyándome en lo que ya reflexioné', tag: 'reflexion', reply: 'Decides ahora, apoyada en todo lo que ya pensaste, no en información nueva que no iba a llegar.' },
      { label: 'Decido ahora, sin darle más vueltas', tag: 'instinto', reply: 'Cortas la vuelta extra. La decisión ya estaba tomada hace rato, solo hacía falta decirlo.' },
    ),
  ],
];

function buildBalanceEndingEs(picks: string[]): StoryEnding {
  const reflexion = picks.filter((p) => p === 'reflexion').length;
  const instinto = picks.filter((p) => p === 'instinto').length;
  let body: string;
  if (reflexion > instinto) {
    body = 'Resolviste esto mirando hacia adentro, con calma. Ese ejercicio de conocerte fue, en el fondo, la verdadera decisión.';
  } else if (instinto > reflexion) {
    body = 'Resolviste esto confiando en lo que ya sabías de ti. Esa confianza también es una forma de autoconocimiento.';
  } else {
    body = 'Resolviste esto combinando reflexión e instinto — dos formas distintas de escucharte a ti mismo.';
  }
  return {
    title: 'Tomaste la decisión.',
    body: `${body} El dilema no desaparece solo por decidir, pero ahora sabes un poco más de cómo te mueves frente a lo difícil. Eso ya es una ganancia.`,
  };
}

const ASCENT_BANK_EN: StoryStep[][] = [
  [
    choiceStep(
      "The path starts steep. You haven't even taken the first step and you already feel the weight of the climb.",
      { label: "I take the first step, even if it's slow", tag: 'constancia', reply: 'You move forward slowly, but you move forward. The path starts shifting with you.' },
      { label: 'I pause a moment to look up at the summit', tag: 'pausa', reply: "You take a second to look upward. It's not giving up — it's taking a breath before you begin." },
    ),
    choiceStep(
      "Ahead of you is a slope of loose dirt, the kind that slips if you don't judge your step well.",
      { label: 'I plant my foot firmly and move on, careful with each step', tag: 'constancia', reply: 'You find a careful rhythm, step by step, without slipping.' },
      { label: "I look ahead first to find where it's less slippery", tag: 'pausa', reply: 'You take a moment to read the ground before moving. That moment counts too.' },
    ),
    choiceStep(
      "There's no one else on this path. Just you, the slope, and the will — or the lack of it — to begin.",
      { label: "I start even if the will isn't fully there", tag: 'constancia', reply: "You don't wait to feel fully ready. You simply begin, and that alone moves something." },
      { label: 'I sit with that lack of will for a moment, without fighting it', tag: 'pausa', reply: 'You sit with that lack of will for a while, without demanding you feel anything else yet.' },
    ),
  ],
  [
    choiceStep(
      'Halfway there, a doubt catches up with you: "what if this isn\'t worth it?"',
      { label: 'I keep walking with the doubt in tow', tag: 'constancia', reply: "The doubt doesn't disappear, but it doesn't stop you either. You walk with it, not against it." },
      { label: 'I sit for a while and let the doubt speak', tag: 'pausa', reply: 'You sit next to the doubt for a moment. Sometimes listening to it is what makes it smaller.' },
    ),
    choiceStep(
      "A familiar voice — maybe yours, maybe someone else's — tells you that you won't make it.",
      { label: 'I keep walking, the voice can keep talking', tag: 'constancia', reply: 'You let the voice talk in the background, without obeying it. You keep moving your feet.' },
      { label: 'I stop to face that voice head-on', tag: 'pausa', reply: 'You turn to look at it head-on for a moment. Sometimes losing the fear of facing it makes it smaller.' },
    ),
    holdStep('The weight of the doubt weighs more than the path itself. Before continuing, give yourself a real second.', 'Keep your finger here while you breathe', 'presencia', 'You gave yourself that second. No one took it from you, and the path waited for you there, still.'),
  ],
  [
    choiceStep(
      "Your legs feel heavy. The tiredness isn't just an idea anymore, it's real.",
      { label: 'I pick up the pace a little more', tag: 'constancia', reply: 'Your body protests, but responds. One step, and another, and another.' },
      { label: 'I slow down, without stopping', tag: 'pausa', reply: 'You slow down without stopping completely. Tiredness stops being an enemy and becomes just part of the path.' },
    ),
    choiceStep(
      'The sun feels different now. Your throat feels dry and your thoughts slower.',
      { label: 'I keep going, my body can handle more than I think', tag: 'constancia', reply: 'You keep going, and your body — stubborn in its own way — responds.' },
      { label: 'I look for shade for a moment before continuing', tag: 'pausa', reply: "You find a bit of shade and stay there a moment. The path doesn't move, it keeps waiting for you." },
    ),
    choiceStep(
      "Someone already coming down tells you there's still a long way to go. You're not sure whether to believe them.",
      { label: 'I keep my own pace, no matter how far it is', tag: 'constancia', reply: 'You decide your pace is yours, no matter how far they say it is.' },
      { label: 'I thank them for the heads-up and take a breath with that information', tag: 'pausa', reply: 'You take a breath with that new information, without letting it rush or completely stop you.' },
    ),
  ],
  [
    choiceStep(
      'You see the summit, closer than ever, right when you feel you have the least strength left.',
      { label: 'I use what little I have left to get there', tag: 'constancia', reply: 'With the last of what you have left, you take the final steps.' },
      { label: 'I take a deep breath before the final stretch', tag: 'pausa', reply: 'One last, deep breath, before the final stretch.' },
    ),
    choiceStep(
      'The wind shifts right before the end, as if the path were also saying goodbye to the climb.',
      { label: 'I ride the momentum and finish the climb', tag: 'constancia', reply: 'The wind almost pushes you. You ride that momentum all the way up.' },
      { label: 'I let the wind reach me before taking the final step', tag: 'pausa', reply: 'You stay a moment, feeling the wind, before the last step.' },
    ),
    choiceStep(
      "Almost there. Whatever brought you this far is still with you, one more step.",
      { label: 'I take that last step with everything that brought me here', tag: 'constancia', reply: 'You take the last step with everything that brought you here, leaving nothing behind.' },
      { label: "I look back for a second at everything I've covered, before the last step", tag: 'pausa', reply: "You look back for an instant — everything you've covered — before taking the final step." },
    ),
  ],
];

function buildAscentEndingEn(picks: string[]): StoryEnding {
  const pausas = picks.filter((p) => p === 'pausa').length;
  const constancia = picks.filter((p) => p === 'constancia').length;
  let body: string;
  if (pausas > constancia) {
    body = "You arrived taking your time, breathing when you needed to. Up here it's clear: there was no need to rush, only to not let go of the path.";
  } else if (constancia > pausas) {
    body = 'You arrived at a steady, unbroken pace, almost without stopping. Up here you feel the effort in every muscle — and also the certainty that you could.';
  } else {
    body = 'You arrived combining strength and pause, moving forward and resting when it was needed. Both things brought you here.';
  }
  return {
    title: 'You made it to the top.',
    body: `${body} The path wasn't the same as anyone else's, but steady effort — in your own way — was what carried you to the end.`,
  };
}

const BALANCE_BANK_EN: StoryStep[][] = [
  [
    choiceStep(
      'You have an important decision pending in your mind, and you feel the pressure to resolve it now.',
      { label: 'I calmly analyze each option', tag: 'reflexion', reply: 'You take the time to look at the decision from several angles, without rushing to close the matter.' },
      { label: "I follow what my instinct is already telling me", tag: 'instinto', reply: 'You trust that first answer you already had, the one that showed up before you overthought it.' },
    ),
    choiceStep(
      "The clock isn't saying anything, but you feel like this should already be resolved.",
      { label: 'I let go of the idea that it should already be resolved', tag: 'reflexion', reply: "You let go of that deadline pressure that nobody else put on you. The decision follows its own time." },
      { label: 'I go back to whatever first came to mind, unfiltered', tag: 'instinto', reply: 'You return to that first idea, the rawest one, before reason complicates it.' },
    ),
    holdStep('Before you keep thinking through the decision, give yourself a real pause, not just a mental one.', 'Hold while you release your breath', 'presencia', 'That breath you released took some of the urgency with it. The decision is still there, but a little lighter.'),
  ],
  [
    choiceStep(
      "You notice part of the pressure isn't coming from the decision itself, but from what others might think of your choice.",
      { label: 'I ask myself what it is that I actually want', tag: 'reflexion', reply: 'You set the outside voices aside for a moment and ask yourself the question that matters: what do you want?' },
      { label: 'I acknowledge that pressure and decide anyway', tag: 'instinto', reply: "You see the pressure clearly, name it, and decide without letting it be the one choosing for you." },
    ),
    choiceStep(
      'You realize you can almost predict what certain people would say if they saw you choose.',
      { label: 'I acknowledge those voices and leave them outside', tag: 'reflexion', reply: 'You name those anticipated voices and leave them outside the circle of this decision.' },
      { label: "I choose anyway, those voices aren't really here", tag: 'instinto', reply: "You remember those voices aren't actually in the room. You decide with the one who is: you." },
    ),
  ],
  [
    choiceStep(
      "The moment to decide arrives. There's no more new information left to wait for.",
      { label: 'I choose the option that most aligns with who I am', tag: 'reflexion', reply: 'You choose from who you are, not from the fear of getting it wrong.' },
      { label: 'I choose and trust I can adjust course later', tag: 'instinto', reply: 'You choose knowing no decision is ever fully final — you can always adjust course.' },
    ),
    choiceStep(
      "There's no outside sign confirming this is the moment. You'll have to trust that it is.",
      { label: 'I trust the process I went through to get here', tag: 'reflexion', reply: 'You trust the path you already walked to reach this point, not just the outcome.' },
      { label: 'I trust that if something were wrong, it would already feel different', tag: 'instinto', reply: "You trust that underlying feeling — the one that hasn't changed through all of this." },
    ),
    choiceStep(
      "You feel that putting it off a bit longer won't bring more clarity, only more tiredness.",
      { label: "I decide now, leaning on everything I've already reflected on", tag: 'reflexion', reply: 'You decide now, resting on everything you already thought through, not on new information that was never going to arrive.' },
      { label: 'I decide now, without going in circles anymore', tag: 'instinto', reply: 'You cut the extra loop short. The decision was already made a while ago, it just needed saying.' },
    ),
  ],
];

function buildBalanceEndingEn(picks: string[]): StoryEnding {
  const reflexion = picks.filter((p) => p === 'reflexion').length;
  const instinto = picks.filter((p) => p === 'instinto').length;
  let body: string;
  if (reflexion > instinto) {
    body = 'You resolved this by looking inward, calmly. That exercise of getting to know yourself was, in the end, the real decision.';
  } else if (instinto > reflexion) {
    body = 'You resolved this by trusting what you already knew about yourself. That trust is also a form of self-knowledge.';
  } else {
    body = 'You resolved this by combining reflection and instinct — two different ways of listening to yourself.';
  }
  return {
    title: 'You made the decision.',
    body: `${body} The dilemma doesn't disappear just by deciding, but now you know a little more about how you move through difficulty. That alone is a gain.`,
  };
}

const ASCENT_BANK_PT: StoryStep[][] = [
  [
    choiceStep(
      'O caminho começa íngreme. Você nem deu o primeiro passo e já sente o peso da subida.',
      { label: 'Dou o primeiro passo, mesmo que devagar', tag: 'constancia', reply: 'Você avança devagar, mas avança. O caminho começa a se mover com você.' },
      { label: 'Fico um momento olhando para o topo', tag: 'pausa', reply: 'Você se dá um segundo para olhar para cima. Não é desistir, é respirar fundo antes de começar.' },
    ),
    choiceStep(
      'À sua frente há uma ladeira de terra solta, do tipo que escorrega se você não calcular bem o passo.',
      { label: 'Piso firme e avanço, cuidando cada passo', tag: 'constancia', reply: 'Você encontra um ritmo cuidadoso, passo a passo, sem escorregar.' },
      { label: 'Primeiro procuro com o olhar por onde é menos escorregadio', tag: 'pausa', reply: 'Você se dá um momento para ler o terreno antes de se mover. Esse momento também conta.' },
    ),
    choiceStep(
      'Não há mais ninguém neste caminho. Só você, a subida, e a vontade — ou a falta dela — de começar.',
      { label: 'Começo mesmo que a vontade não esteja completa', tag: 'constancia', reply: 'Você não espera ter vontade completa. Simplesmente começa, e isso já move algo.' },
      { label: 'Fico um momento com essa falta de vontade, sem lutar contra ela', tag: 'pausa', reply: 'Você fica um tempo com essa falta de vontade, sem se exigir sentir outra coisa ainda.' },
    ),
  ],
  [
    choiceStep(
      'No meio do caminho, uma dúvida te alcança: "e se isso não valer a pena?"',
      { label: 'Continuo caminhando com a dúvida a tiracolo', tag: 'constancia', reply: 'A dúvida não desaparece, mas também não te detém. Você caminha com ela, não contra ela.' },
      { label: 'Sento um tempo para deixar a dúvida falar', tag: 'pausa', reply: 'Você se senta ao lado da dúvida por um momento. Às vezes ouvi-la é o que a torna menor.' },
    ),
    choiceStep(
      'Uma voz conhecida — talvez a sua, talvez a de outra pessoa — te diz que você não vai conseguir.',
      { label: 'Continuo caminhando, a voz pode continuar falando', tag: 'constancia', reply: 'Você deixa a voz falar ao fundo, sem obedecê-la. Continua movendo os pés.' },
      { label: 'Paro para encarar essa voz de frente', tag: 'pausa', reply: 'Você se vira para encará-la de frente por um momento. Às vezes perder o medo de vê-la a torna menor.' },
    ),
    holdStep('O peso da dúvida pesa mais que o próprio caminho. Antes de continuar, dê a si mesmo um segundo de verdade.', 'Mantenha o dedo aqui enquanto respira', 'presencia', 'Você se deu esse segundo. Ninguém tirou isso de você, e o caminho esperou por você ali, parado.'),
  ],
  [
    choiceStep(
      'As pernas pesam. O cansaço já não é uma ideia, é real.',
      { label: 'Aperto um pouco mais o passo', tag: 'constancia', reply: 'O corpo protesta, mas responde. Um passo, e outro, e outro.' },
      { label: 'Diminuo o ritmo, sem deixar de me mover', tag: 'pausa', reply: 'Você diminui o ritmo sem parar de vez. O cansaço deixa de ser um inimigo e passa a ser só parte do caminho.' },
    ),
    choiceStep(
      'O sol bate diferente agora. Você sente a garganta seca e as ideias mais lentas.',
      { label: 'Continuo, o corpo aguenta mais do que eu acho', tag: 'constancia', reply: 'Você continua, e o corpo — à sua maneira teimosa — responde.' },
      { label: 'Procuro sombra um momento antes de seguir', tag: 'pausa', reply: 'Você encontra um pouco de sombra e fica ali um momento. O caminho não se move, continua esperando por você.' },
    ),
    choiceStep(
      'Alguém que já estava descendo te diz que ainda falta muito. Você não sabe se acredita.',
      { label: 'Sigo meu próprio ritmo, falte o que faltar', tag: 'constancia', reply: 'Você decide que seu passo é seu, não importa quanto digam que falta.' },
      { label: 'Agradeço o aviso e tiro um fôlego com essa informação', tag: 'pausa', reply: 'Você tira um fôlego com essa nova informação, sem deixar que te apresse nem te freie de vez.' },
    ),
  ],
  [
    choiceStep(
      'Você vê o topo, mais perto do que nunca, bem quando sente ter menos força.',
      { label: 'Uso o pouco que me resta para chegar', tag: 'constancia', reply: 'Com o último que te resta, você dá os passos finais.' },
      { label: 'Respiro fundo antes do trecho final', tag: 'pausa', reply: 'Uma última respiração, profunda, antes do trecho final.' },
    ),
    choiceStep(
      'O vento muda bem antes do final, como se o caminho também estivesse se despedindo da subida.',
      { label: 'Aproveito o embalo e termino de subir', tag: 'constancia', reply: 'O vento quase te empurra. Você aproveita esse embalo até o topo.' },
      { label: 'Deixo o vento me alcançar antes de dar o passo final', tag: 'pausa', reply: 'Você fica um instante sentindo o vento antes do último passo.' },
    ),
    choiceStep(
      'Já quase lá. O que quer que te trouxe até aqui continua com você, mais um passo.',
      { label: 'Dou esse último passo com tudo o que me trouxe até aqui', tag: 'constancia', reply: 'Você dá o último passo com tudo o que te trouxe até aqui, sem deixar nada para trás.' },
      { label: 'Olho para trás um segundo tudo o que percorri, antes do último passo', tag: 'pausa', reply: 'Você olha para trás um instante — tudo o que percorreu — antes de dar o passo final.' },
    ),
  ],
];

function buildAscentEndingPt(picks: string[]): StoryEnding {
  const pausas = picks.filter((p) => p === 'pausa').length;
  const constancia = picks.filter((p) => p === 'constancia').length;
  let body: string;
  if (pausas > constancia) {
    body = 'Você chegou no seu próprio tempo, respirando quando precisava. Aqui em cima fica claro: não foi preciso correr, só não largar o caminho.';
  } else if (constancia > pausas) {
    body = 'Você chegou em passo firme e constante, quase sem parar. Aqui em cima você sente o esforço em cada músculo — e também a certeza de que conseguiu.';
  } else {
    body = 'Você chegou combinando força e pausa, avançando e descansando quando era hora. As duas coisas te trouxeram até aqui.';
  }
  return {
    title: 'Você chegou ao topo.',
    body: `${body} O caminho não foi igual ao de mais ninguém, mas o esforço constante — do seu jeito — foi o que te sustentou até o final.`,
  };
}

const BALANCE_BANK_PT: StoryStep[][] = [
  [
    choiceStep(
      'Você tem uma decisão importante pendente na cabeça, e sente a pressão de resolvê-la agora.',
      { label: 'Analiso cada opção com calma', tag: 'reflexion', reply: 'Você se dá o tempo de olhar a decisão de vários ângulos, sem se apressar para fechar o assunto.' },
      { label: 'Sigo o que meu instinto já me diz', tag: 'instinto', reply: 'Você confia nessa primeira resposta que já tinha, a que apareceu antes de pensar demais.' },
    ),
    choiceStep(
      'O relógio não diz nada, mas você sente que isso já deveria estar resolvido.',
      { label: 'Solto a ideia de que já deveria estar resolvido', tag: 'reflexion', reply: 'Você solta essa exigência de prazo que ninguém mais te impôs. A decisão segue seu próprio tempo.' },
      { label: 'Reviso o que foi a primeira coisa que me ocorreu, sem filtrar', tag: 'instinto', reply: 'Você volta a essa primeira ideia, a mais crua, antes que a razão a complique.' },
    ),
    holdStep('Antes de continuar pensando na decisão, dê a si mesmo uma pausa de verdade, não só mental.', 'Segure enquanto solta o ar', 'presencia', 'Esse ar que você soltou levou parte da urgência junto. A decisão continua ali, mas um pouco mais leve.'),
  ],
  [
    choiceStep(
      'Você percebe que parte da pressão não vem da decisão em si, mas do que os outros poderiam pensar da sua escolha.',
      { label: 'Me pergunto o que eu realmente quero', tag: 'reflexion', reply: 'Você afasta por um momento as vozes externas e se faz a pergunta que importa: o que você quer?' },
      { label: 'Reconheço essa pressão e decido do mesmo jeito', tag: 'instinto', reply: 'Você vê a pressão com clareza, nomeia ela, e decide sem deixar que seja ela a escolher por você.' },
    ),
    choiceStep(
      'Você percebe que já quase consegue antecipar o que certas pessoas diriam se te vissem escolher.',
      { label: 'Reconheço essas vozes e as deixo do lado de fora', tag: 'reflexion', reply: 'Você nomeia essas vozes antecipadas e as deixa fora do círculo desta decisão.' },
      { label: 'Escolho mesmo assim, essas vozes não estão realmente aqui', tag: 'instinto', reply: 'Você lembra que essas vozes não estão de fato na sala. Decide com quem realmente está: você.' },
    ),
  ],
  [
    choiceStep(
      'Chega o momento de decidir. Já não há mais informação nova para esperar.',
      { label: 'Escolho a opção que mais se alinha com quem eu sou', tag: 'reflexion', reply: 'Você escolhe a partir de quem você é, não do medo de errar.' },
      { label: 'Escolho e confio em poder ajustar o rumo depois', tag: 'instinto', reply: 'Você escolhe sabendo que nenhuma decisão é totalmente definitiva — sempre dá para ajustar o rumo.' },
    ),
    choiceStep(
      'Não há um sinal externo que confirme que é o momento. Você vai ter que confiar que é.',
      { label: 'Confio no processo que fiz para chegar até aqui', tag: 'reflexion', reply: 'Você confia no caminho que já percorreu para chegar até aqui, não só no resultado.' },
      { label: 'Confio que, se algo estivesse errado, eu já sentiria diferente', tag: 'instinto', reply: 'Você confia nessa sensação de fundo — a que não mudou durante todo esse tempo.' },
    ),
    choiceStep(
      'Você sente que adiar um pouco mais não vai trazer mais clareza, só mais cansaço.',
      { label: 'Decido agora, apoiando-me no que já refleti', tag: 'reflexion', reply: 'Você decide agora, apoiada em tudo o que já pensou, não em informação nova que não ia chegar.' },
      { label: 'Decido agora, sem dar mais voltas', tag: 'instinto', reply: 'Você corta a volta extra. A decisão já estava tomada fazia tempo, só faltava dizer.' },
    ),
  ],
];

function buildBalanceEndingPt(picks: string[]): StoryEnding {
  const reflexion = picks.filter((p) => p === 'reflexion').length;
  const instinto = picks.filter((p) => p === 'instinto').length;
  let body: string;
  if (reflexion > instinto) {
    body = 'Você resolveu isso olhando para dentro, com calma. Esse exercício de se conhecer foi, no fundo, a verdadeira decisão.';
  } else if (instinto > reflexion) {
    body = 'Você resolveu isso confiando no que já sabia sobre si mesmo. Essa confiança também é uma forma de autoconhecimento.';
  } else {
    body = 'Você resolveu isso combinando reflexão e instinto — duas formas diferentes de se escutar.';
  }
  return {
    title: 'Você tomou a decisão.',
    body: `${body} O dilema não desaparece só por decidir, mas agora você sabe um pouco mais sobre como se move diante do difícil. Isso já é um ganho.`,
  };
}

export const STORY_BANKS_BY_LANG: Record<LanguageCode, Record<'ascent' | 'balance', StoryStep[][]>> = {
  es: { ascent: ASCENT_BANK_ES, balance: BALANCE_BANK_ES },
  en: { ascent: ASCENT_BANK_EN, balance: BALANCE_BANK_EN },
  pt: { ascent: ASCENT_BANK_PT, balance: BALANCE_BANK_PT },
};

export const STORY_ENDING_BUILDERS_BY_LANG: Record<LanguageCode, Record<'ascent' | 'balance', (picks: string[]) => StoryEnding>> = {
  es: { ascent: buildAscentEndingEs, balance: buildBalanceEndingEs },
  en: { ascent: buildAscentEndingEn, balance: buildBalanceEndingEn },
  pt: { ascent: buildAscentEndingPt, balance: buildBalanceEndingPt },
};
