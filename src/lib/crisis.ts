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
      { name: 'Salud Responde', phone: '600 360 7777', hours: '24/7' },
      { name: 'Teléfono de la Esperanza', phone: '600 805 333', hours: '24/7' },
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

export const COUNTRY_OPTIONS = Object.entries(CRISIS_LINES).map(([code, v]) => ({
  code,
  label: v.label,
}));
