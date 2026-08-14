export type Role = 'patient' | 'psychologist';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  country: string | null;
  is_premium: boolean;
  created_at: string;
  avatar_path: string | null;
  phone: string | null;
  license_number: string | null;
  bio: string | null;
}

export interface PatientLink {
  id: string;
  psychologist_id: string;
  patient_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface ClinicalNote {
  id: string;
  patient_id: string;
  psychologist_id: string;
  note: string;
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

export interface RiskAlert {
  id: string;
  patient_id: string;
  psychologist_id: string;
  reason: string;
  message_excerpt: string | null;
  acknowledged: boolean;
  created_at: string;
}

export interface TaskItem {
  id: string;
  user_id: string;
  title: string;
  due_at: string | null;
  done: boolean;
  created_at: string;
  assigned_by: string | null;
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
