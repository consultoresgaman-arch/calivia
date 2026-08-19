import type { LanguageCode, Strings } from './lib/i18n';

const strings: Strings = {
  es: {
    fabLabel: 'Comando de voz',
    fabAria: 'Programar una tarea por voz',
    panelTitle: 'Comando de voz',
    hintIdle: 'Toca el micrófono y dilo, por ejemplo: "Calivia, programa mi almuerzo para las 14:00".',
    hintListening: 'Escuchando… habla ahora',
    hintProcessing: 'Entendiendo lo que dijiste…',
    tryAgain: 'Intentar de nuevo',
    close: 'Cerrar',
    taskCreatedBadge: 'Tarea agregada',
    enableReminders: 'Activar recordatorios para que suene la alarma',
    errNoVoiceSupport: 'Tu navegador no soporta dictado por voz.',
    errMicPermission: 'Necesitamos permiso de micrófono para escucharte. Revísalo en los ajustes de la app.',
    errMicNoResponse: 'El micrófono no respondió. Verifica que el reconocimiento de voz de tu dispositivo esté activo e intenta de nuevo.',
    errMicNotAllowed: 'No se pudo acceder al micrófono. Revisa los permisos del navegador.',
    errTranscribeFailed: 'No se pudo transcribir la voz. Intenta de nuevo.',
    errEmptyTranscript: 'No alcancé a escuchar nada. Intenta de nuevo.',
    errRequestFailed: 'No pude procesar el comando. Intenta de nuevo en un momento.',
    errTaskSaveFailed: 'Entendí la tarea pero no pude guardarla. Intenta de nuevo.',
  },
  en: {
    fabLabel: 'Voice command',
    fabAria: 'Schedule a task by voice',
    panelTitle: 'Voice command',
    hintIdle: 'Tap the mic and say it, for example: "Calivia, schedule my lunch for 2pm".',
    hintListening: 'Listening… speak now',
    hintProcessing: 'Understanding what you said…',
    tryAgain: 'Try again',
    close: 'Close',
    taskCreatedBadge: 'Task added',
    enableReminders: 'Enable reminders so the alarm rings',
    errNoVoiceSupport: "Your browser doesn't support voice dictation.",
    errMicPermission: "We need microphone permission to hear you. Check it in the app's settings.",
    errMicNoResponse: "The microphone didn't respond. Check that your device's speech recognition is active and try again.",
    errMicNotAllowed: "Couldn't access the microphone. Check your browser permissions.",
    errTranscribeFailed: "Couldn't transcribe your voice. Try again.",
    errEmptyTranscript: "I didn't catch anything. Try again.",
    errRequestFailed: "Couldn't process the command. Try again in a moment.",
    errTaskSaveFailed: "I understood the task but couldn't save it. Try again.",
  },
  pt: {
    fabLabel: 'Comando de voz',
    fabAria: 'Programar uma tarefa por voz',
    panelTitle: 'Comando de voz',
    hintIdle: 'Toque no microfone e diga, por exemplo: "Calivia, programe meu almoço para as 14h".',
    hintListening: 'Ouvindo… fale agora',
    hintProcessing: 'Entendendo o que você disse…',
    tryAgain: 'Tentar de novo',
    close: 'Fechar',
    taskCreatedBadge: 'Tarefa adicionada',
    enableReminders: 'Ativar lembretes para o alarme tocar',
    errNoVoiceSupport: 'Seu navegador não suporta ditado por voz.',
    errMicPermission: 'Precisamos de permissão do microfone para te ouvir. Verifique nas configurações do app.',
    errMicNoResponse: 'O microfone não respondeu. Verifique se o reconhecimento de voz do seu dispositivo está ativo e tente novamente.',
    errMicNotAllowed: 'Não foi possível acessar o microfone. Verifique as permissões do navegador.',
    errTranscribeFailed: 'Não foi possível transcrever sua voz. Tente novamente.',
    errEmptyTranscript: 'Não consegui ouvir nada. Tente novamente.',
    errRequestFailed: 'Não consegui processar o comando. Tente novamente em instantes.',
    errTaskSaveFailed: 'Entendi a tarefa mas não consegui salvá-la. Tente novamente.',
  },
};

export default strings;

// Tag BCP-47 para el reconocimiento (STT) y la síntesis (TTS) de voz nativos del
// navegador, según el idioma elegido en la app (igual que en AiChat.i18n.ts).
export const SPEECH_LANG_TAG: Record<LanguageCode, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-PT',
};

export const REMINDER_TITLE: Record<LanguageCode, string> = {
  es: 'Calivia · Recordatorio',
  en: 'Calivia · Reminder',
  pt: 'Calivia · Lembrete',
};
