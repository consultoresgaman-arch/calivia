export type Role = 'patient' | 'psychologist';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  country: string | null;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  mood: number; // 1..5
  message: string | null;
  created_at: string;
}

export interface ChatLog {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiReport {
  id: string;
  user_id: string;
  report_date: string;
  mood_summary: string;
  keywords: string[];
  suggestions: string;
  raw_context: Record<string, unknown> | null;
  created_at: string;
}

export const MOOD_LABELS: Record<number, string> = {
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Neutral',
  4: 'Bien',
  5: 'Muy bien',
};

export const MOOD_EMOJI: Record<number, string> = {
  1: '😞',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

export const MOOD_COLOR: Record<number, string> = {
  1: '#c0392b',
  2: '#e67e22',
  3: '#d4ac0d',
  4: '#7cb342',
  5: '#2e7d32',
};
