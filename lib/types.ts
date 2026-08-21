export type Role = 'patient' | 'psychologist';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  mood: number;
  message: string | null;
  created_at: string;
}

export interface CheckInWithProfile extends CheckIn {
  profiles: Pick<Profile, 'email' | 'full_name'> | null;
}

export const MOOD_LABELS: Record<number, string> = {
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Neutral',
  4: 'Bien',
  5: 'Muy bien',
};

export const MOOD_EMOJI: Record<number, string> = {
  1: '😔',
  2: '😕',
  3: '😐',
  4: '🙂',
  5: '😄',
};

export const MOOD_COLOR: Record<number, string> = {
  1: '#dc2626',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#16a34a',
};
