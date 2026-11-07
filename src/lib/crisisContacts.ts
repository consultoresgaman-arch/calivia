import { supabase } from './supabase';

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
}

export interface LinkedSpecialist {
  name: string;
  phone: string;
}

export interface CrisisContacts {
  contacts: TrustedContact[];
  specialist: LinkedSpecialist | null;
}

const CACHE_PREFIX = 'calivia.crisis-contacts.';

// Se guardan en el dispositivo porque hacen falta justo cuando puede no haber red.
export function readCachedCrisisContacts(userId: string): CrisisContacts {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CrisisContacts>;
      return { contacts: parsed.contacts ?? [], specialist: parsed.specialist ?? null };
    }
  } catch {
    /* caché no disponible o corrupta: se sigue sin contactos guardados */
  }
  return { contacts: [], specialist: null };
}

export function cacheCrisisContacts(userId: string, value: CrisisContacts): void {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function clearCachedCrisisContacts(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

// Devuelve null si algo falla, para que quien llama conserve la copia guardada
// en vez de reemplazarla por una lista vacía cuando no hay conexión.
export async function refreshCrisisContacts(userId: string): Promise<CrisisContacts | null> {
  const [contactsRes, linkRes] = await Promise.all([
    supabase.from('trusted_contacts').select('id, name, phone').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('patient_links').select('psychologist_id').eq('patient_id', userId).eq('status', 'accepted').maybeSingle(),
  ]);
  if (contactsRes.error || linkRes.error) return null;

  let specialist: LinkedSpecialist | null = null;
  if (linkRes.data) {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', linkRes.data.psychologist_id)
      .maybeSingle();
    if (error) return null;
    if (data?.phone) specialist = { name: data.full_name, phone: data.phone };
  }

  const value: CrisisContacts = { contacts: contactsRes.data ?? [], specialist };
  cacheCrisisContacts(userId, value);
  return value;
}
