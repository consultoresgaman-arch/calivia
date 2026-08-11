import { Sparkles } from 'lucide-react';

// Frases cortas, en el mismo tono cálido y sin clichés que el resto de
// Calivia — nada de frases de calendario ni de manual de autoayuda
// genérico. Selección estable por día (mismo texto todo el día, distinto
// al día siguiente), sin llamada a red.
const SPARKS: string[] = [
  'No tienes que tener el día resuelto a las nueve de la mañana. Basta con el siguiente paso.',
  'Lo que hoy sientes pesado no dice nada de tu fuerza — solo de lo grande que es lo que estás cargando.',
  'A veces avanzar es simplemente no soltar del todo. Eso también cuenta.',
  'No necesitas sentirte listo para empezar. La mayoría de las veces las ganas llegan después del primer paso, no antes.',
  'Está bien que hoy solo alcance para lo mínimo. Lo mínimo, hecho con cuidado, también es válido.',
  'Nadie te enseñó a hacer esto perfecto. Estás aprendiendo sobre la marcha, como todos.',
  'Puedes estar orgulloso de algo pequeño. No hace falta esperar la victoria grande para reconocerte algo.',
  'Descansar no es rendirse. Es parte del mismo camino, solo que más lento por un rato.',
  'Lo que te cuesta hoy no te va a costar siempre igual. Cambia, aunque ahora no lo notes.',
  'No tienes que explicarle a todos por qué estás cansado. A veces basta con que tú lo sepas y te trates bien por eso.',
  'Compararte con quien eras hace un año no es justo con quien eres hoy, cargando lo de hoy.',
  'Un mensaje que no respondiste, una tarea que quedó a medias — no te define. Es solo un día, no un veredicto.',
  'Pedir ayuda no es la señal de que algo se rompió. Es la señal de que sigues intentando arreglarlo.',
  'Puedes cambiar de opinión sobre lo que decidiste ayer. Eso no es debilidad, es seguir vivo en la decisión.',
  'A veces el progreso se ve igual que quedarse quieto un rato, respirando, sin huir.',
  'No hace falta sentir motivación para merecer algo bueno hoy.',
  'Tu ritmo no tiene que parecerse al de nadie más para ser un ritmo válido.',
  'Está bien no tener ganas de hablar. También está bien tenerlas mañana.',
  'Lo que te sostiene hoy no siempre se ve como fuerza. A veces se ve como simplemente seguir aquí.',
  'No todo lo que sientes tiene que resolverse hoy. Algunas cosas solo necesitan compañía mientras pasan.',
  'Ser amable contigo mismo hoy no es un premio que hay que ganarse.',
  'El cansancio de cuidar a otros también cuenta. Tú también necesitas que te cuiden un poco.',
  'No estás atrasado en tu propia vida. No existe ese examen.',
  'A veces la valentía se parece más a levantarse otra vez que a no haberse caído nunca.',
  'Puedes soltar algo hoy sin tener que reemplazarlo enseguida por otra cosa.',
  'Lo que te enoja también te está diciendo algo. No hace falta apagarlo, solo escucharlo con calma.',
  'No tienes que sonreír para que el día cuente. Puede contar tal como lo estás viviendo.',
  'Ese miedo que sientes no te hace menos capaz. Solo te hace humano frente a algo que importa.',
  'Un buen día no siempre se nota de inmediato. A veces se nota recién al mirar atrás.',
  'Está bien que algo que antes te costaba menos, hoy te cueste más. No es un retroceso, es solo hoy.',
  'No necesitas tener todas las respuestas para merecer paz esta noche.',
  'Lo que hoy hiciste con lo poco que tenías, ya es algo real.',
  'Puedes cuidarte sin tener que justificarlo con lo mucho que hiciste antes.',
  'Nadie ve todo el esfuerzo que te cuesta sostenerte. Pero tú sí lo sabes, y también cuenta.',
  'Está bien pedir que te repitan las cosas con paciencia. No todos los días se procesa igual de rápido.',
  'Lo que sientes que "debería" ser fácil, a veces simplemente no lo es hoy. Y no pasa nada.',
  'No hace falta tener el problema resuelto para merecer un momento de calma.',
  'Ese paso que sientes pequeño, desde donde partiste, quizás no lo sea tanto.',
  'Puedes estar bien y cansado al mismo tiempo. No es una contradicción.',
  'Lo que te cuesta soltar hoy, sigue teniendo sentido que te cueste. No hay que apurar el duelo.',
];

function todayIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return dayOfYear % SPARKS.length;
}

export default function DailySpark() {
  const spark = SPARKS[todayIndex()];

  return (
    <div className="spark-card anim-fade">
      <div className="spark-icon"><Sparkles size={16} strokeWidth={2} /></div>
      <p className="spark-text">{spark}</p>

      <style>{`
        .spark-card {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface-2);
        }
        .spark-icon {
          flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
          background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center;
          margin-top: 1px;
        }
        .spark-text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--text); font-weight: 500; }
      `}</style>
    </div>
  );
}
