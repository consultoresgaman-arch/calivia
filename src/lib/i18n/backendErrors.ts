import type { LanguageCode } from './languages';

// Los mensajes de error de las funciones RPC de Supabase están fijos en español
// (definidos en las migraciones SQL). Este mapa traduce los que puede ver un
// paciente; cualquier mensaje no listado se muestra tal cual llega del backend.
const BACKEND_ERRORS: Record<string, Record<LanguageCode, string>> = {
  'El nombre no puede estar vacío': {
    es: 'El nombre no puede estar vacío',
    en: 'Name cannot be empty',
    pt: 'O nome não pode estar vazio',
  },
  'La contraseña debe tener al menos 6 caracteres': {
    es: 'La contraseña debe tener al menos 6 caracteres',
    en: 'Password must be at least 6 characters',
    pt: 'A senha deve ter pelo menos 6 caracteres',
  },
  'Rol inválido': {
    es: 'Rol inválido',
    en: 'Invalid role',
    pt: 'Função inválida',
  },
  'Ese nombre ya está en uso': {
    es: 'Ese nombre ya está en uso',
    en: 'That name is already taken',
    pt: 'Esse nome já está em uso',
  },
  'Nombre o contraseña incorrectos': {
    es: 'Nombre o contraseña incorrectos',
    en: 'Incorrect name or password',
    pt: 'Nome ou senha incorretos',
  },
  'Sesión inválida': {
    es: 'Sesión inválida',
    en: 'Invalid session',
    pt: 'Sessão inválida',
  },
  'Correo inválido': {
    es: 'Correo inválido',
    en: 'Invalid email',
    pt: 'E-mail inválido',
  },
  'Código inválido o vencido': {
    es: 'Código inválido o vencido',
    en: 'Invalid or expired code',
    pt: 'Código inválido ou expirado',
  },
};

export function localizeBackendError(message: string, lang: LanguageCode): string {
  return BACKEND_ERRORS[message]?.[lang] ?? message;
}
