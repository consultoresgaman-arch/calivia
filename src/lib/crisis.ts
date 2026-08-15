import type { LanguageCode } from './i18n';

export interface CrisisLine {
  name: string;
  phone: string;
  hours?: string;
  notes?: string;
}

export const CRISIS_LINES: Record<string, { label: string; lines: CrisisLine[] }> = {
  MX: {
    label: 'México',
    lines: [
      { name: 'SAPTEL (Servicio de Atención Telefónica)', phone: '55 5259-8121', hours: '24/7', notes: 'Llamada o WhatsApp' },
      { name: 'LOCATEL (CDMX)', phone: '55 5658-1111', hours: '24/7' },
      { name: 'Línea de la Vida (SALUD)', phone: '800 290 0024', hours: '24/7' },
    ],
  },
  ES: {
    label: 'España',
    lines: [
      { name: 'Teléfono de la Esperanza', phone: '717 003 717', hours: '24/7' },
      { name: '024 (Prevención del suicidio)', phone: '024', hours: '24/7' },
      { name: 'Emergencias', phone: '112', hours: '24/7' },
    ],
  },
  PT: {
    label: 'Portugal',
    lines: [
      { name: 'SNS 24', phone: '808 24 24 24', hours: '24/7' },
      { name: 'SOS Voz Amiga', phone: '213 544 545', hours: '16h–24h', notes: 'Verifica el horario vigente' },
      { name: 'Emergencias', phone: '112', hours: '24/7' },
    ],
  },
  AR: {
    label: 'Argentina',
    lines: [
      { name: 'Línea 135 (Salud Mental)', phone: '135', hours: '24/7' },
      { name: 'Teléfono de la Esperanza', phone: '0800 222 0070', hours: '24/7' },
      { name: 'Emergencias', phone: '107', hours: '24/7' },
    ],
  },
  CO: {
    label: 'Colombia',
    lines: [
      { name: 'Línea 106 (Suicidio)', phone: '106', hours: '24/7' },
      { name: 'Línea Amigo', phone: '01 8000 911 700', hours: '24/7' },
      { name: 'Emergencias', phone: '123', hours: '24/7' },
    ],
  },
  CL: {
    label: 'Chile',
    lines: [
      { name: 'Línea 4141 (Salud Responde — Salud Mental)', phone: '4141', hours: '24/7', notes: 'Llamada o WhatsApp' },
      { name: 'Emergencias', phone: '131', hours: '24/7' },
    ],
  },
  PE: {
    label: 'Perú',
    lines: [
      { name: 'Línea 113 (Suicidio - MINSAL)', phone: '113', hours: '24/7', notes: 'Opción 5' },
      { name: 'Teléfono de la Esperanza', phone: '01 422 0000', hours: '24/7' },
      { name: 'Emergencias', phone: '105', hours: '24/7' },
    ],
  },
  US: {
    label: 'Estados Unidos',
    lines: [
      { name: '988 Suicide & Crisis Lifeline', phone: '988', hours: '24/7' },
      { name: 'Crisis Text Line', phone: 'Text HOME to 741741', hours: '24/7' },
      { name: 'Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  EC: {
    label: 'Ecuador',
    lines: [
      { name: 'ECU 911 (Emergencias)', phone: '911', hours: '24/7' },
      { name: 'Salud Mental (Ministerio de Salud Pública)', phone: '171', hours: '24/7', notes: 'Verifica el número vigente en tu localidad' },
    ],
  },
  VE: {
    label: 'Venezuela',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7', notes: 'Verifica el número vigente en tu localidad' },
    ],
  },
  BO: {
    label: 'Bolivia',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7', notes: 'Verifica el número vigente en tu localidad' },
    ],
  },
  PY: {
    label: 'Paraguay',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7', notes: 'Verifica el número vigente en tu localidad' },
    ],
  },
  UY: {
    label: 'Uruguay',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  GT: {
    label: 'Guatemala',
    lines: [
      { name: 'Policía Nacional Civil', phone: '110', hours: '24/7' },
      { name: 'Bomberos Voluntarios', phone: '122', hours: '24/7' },
    ],
  },
  HN: {
    label: 'Honduras',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  SV: {
    label: 'El Salvador',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  NI: {
    label: 'Nicaragua',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  CR: {
    label: 'Costa Rica',
    lines: [
      { name: 'Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  PA: {
    label: 'Panamá',
    lines: [
      { name: 'Sistema Único de Emergencias', phone: '911', hours: '24/7' },
    ],
  },
  DO: {
    label: 'República Dominicana',
    lines: [
      { name: 'Sistema 9-1-1', phone: '911', hours: '24/7' },
    ],
  },
  CU: {
    label: 'Cuba',
    lines: [
      { name: 'Emergencias', phone: '106', hours: '24/7', notes: 'Verifica el número vigente en tu localidad' },
    ],
  },
  BR: {
    label: 'Brasil',
    lines: [
      { name: 'CVV — Centro de Valorização da Vida', phone: '188', hours: '24/7' },
      { name: 'SAMU (Emergência médica)', phone: '192', hours: '24/7' },
      { name: 'Polícia', phone: '190', hours: '24/7' },
    ],
  },
};

// Los nombres institucionales (SAPTEL, CVV, etc.) son nombres propios reales y
// no se traducen. Solo se localizan las etiquetas de país y los términos
// genéricos que se repiten entre países (Emergencias, notas, etc.).
const COUNTRY_LABELS: Record<string, Record<LanguageCode, string>> = {
  MX: { es: 'México', en: 'Mexico', pt: 'México' },
  ES: { es: 'España', en: 'Spain', pt: 'Espanha' },
  PT: { es: 'Portugal', en: 'Portugal', pt: 'Portugal' },
  AR: { es: 'Argentina', en: 'Argentina', pt: 'Argentina' },
  CO: { es: 'Colombia', en: 'Colombia', pt: 'Colômbia' },
  CL: { es: 'Chile', en: 'Chile', pt: 'Chile' },
  PE: { es: 'Perú', en: 'Peru', pt: 'Peru' },
  US: { es: 'Estados Unidos', en: 'United States', pt: 'Estados Unidos' },
  EC: { es: 'Ecuador', en: 'Ecuador', pt: 'Equador' },
  VE: { es: 'Venezuela', en: 'Venezuela', pt: 'Venezuela' },
  BO: { es: 'Bolivia', en: 'Bolivia', pt: 'Bolívia' },
  PY: { es: 'Paraguay', en: 'Paraguay', pt: 'Paraguai' },
  UY: { es: 'Uruguay', en: 'Uruguay', pt: 'Uruguai' },
  GT: { es: 'Guatemala', en: 'Guatemala', pt: 'Guatemala' },
  HN: { es: 'Honduras', en: 'Honduras', pt: 'Honduras' },
  SV: { es: 'El Salvador', en: 'El Salvador', pt: 'El Salvador' },
  NI: { es: 'Nicaragua', en: 'Nicaragua', pt: 'Nicarágua' },
  CR: { es: 'Costa Rica', en: 'Costa Rica', pt: 'Costa Rica' },
  PA: { es: 'Panamá', en: 'Panama', pt: 'Panamá' },
  DO: { es: 'República Dominicana', en: 'Dominican Republic', pt: 'República Dominicana' },
  CU: { es: 'Cuba', en: 'Cuba', pt: 'Cuba' },
  BR: { es: 'Brasil', en: 'Brazil', pt: 'Brasil' },
};

const GENERIC_NAME_TERMS: Record<string, Record<LanguageCode, string>> = {
  Emergencias: { es: 'Emergencias', en: 'Emergency', pt: 'Emergência' },
  Policía: { es: 'Policía', en: 'Police', pt: 'Polícia' },
  'Bomberos Voluntarios': { es: 'Bomberos Voluntarios', en: 'Volunteer Firefighters', pt: 'Bombeiros Voluntários' },
  'Sistema 9-1-1': { es: 'Sistema 9-1-1', en: '9-1-1 System', pt: 'Sistema 9-1-1' },
  'Sistema Único de Emergencias': { es: 'Sistema Único de Emergencias', en: 'Unified Emergency System', pt: 'Sistema Único de Emergência' },
};

const GENERIC_NOTE_TERMS: Record<string, Record<LanguageCode, string>> = {
  'Llamada o WhatsApp': { es: 'Llamada o WhatsApp', en: 'Call or WhatsApp', pt: 'Ligação ou WhatsApp' },
  'Verifica el número vigente en tu localidad': {
    es: 'Verifica el número vigente en tu localidad',
    en: 'Check the current number for your area',
    pt: 'Verifique o número vigente na sua região',
  },
  'Verifica el horario vigente': {
    es: 'Verifica el horario vigente',
    en: 'Check the current hours',
    pt: 'Verifique o horário vigente',
  },
  'Opción 5': { es: 'Opción 5', en: 'Option 5', pt: 'Opção 5' },
};

export function localizeCountryLabel(code: string, lang: LanguageCode): string {
  return COUNTRY_LABELS[code]?.[lang] ?? CRISIS_LINES[code]?.label ?? code;
}

export function localizeCrisisLine(line: CrisisLine, lang: LanguageCode): CrisisLine {
  return {
    ...line,
    name: GENERIC_NAME_TERMS[line.name]?.[lang] ?? line.name,
    notes: line.notes ? GENERIC_NOTE_TERMS[line.notes]?.[lang] ?? line.notes : undefined,
  };
}

export const COUNTRY_OPTIONS = Object.entries(CRISIS_LINES).map(([code, v]) => ({
  code,
  label: v.label,
}));
