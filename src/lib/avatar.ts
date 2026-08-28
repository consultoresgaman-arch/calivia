import { supabase } from './supabase';

const BUCKET = 'avatars';
const SIGNED_URL_TTL_SECONDS = 3600;

// Evita pedir una URL firmada nueva cada vez que un componente re-renderiza
// mostrando el mismo avatar; se refresca sola un minuto antes de vencer.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Sube el archivo a `{userId}/avatar.<ext>` en el bucket privado `avatars`
 * y actualiza `profiles.avatar_path`. Devuelve la ruta guardada.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  signedUrlCache.delete(path);

  const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (updateError) throw updateError;

  return path;
}

/**
 * Pide (o reusa del caché) una URL firmada para mostrar el avatar. Devuelve
 * null si no hay avatar, o si la persona que pregunta no tiene permiso
 * (RLS de storage.objects: dueño, o psicólogo vinculado a ese paciente).
 *
 * `strict`: si es true, en vez de devolver null ante un error real de
 * `createSignedUrl` (red, storage, etc.) lo relanza. Lo usa el flujo de
 * subida en ProfileSettingsModal para que un fallo justo después de subir
 * la foto no quede completamente silencioso (antes: la persona subía la
 * foto, la subida en sí funcionaba, pero si esta llamada fallaba el avatar
 * se quedaba en el círculo gris sin ningún mensaje de error).
 */
export async function getAvatarSignedUrl(path: string | null | undefined, strict = false): Promise<string | null> {
  if (!path) return null;

  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('[Calivia] getAvatarSignedUrl falló:', path, error);
    if (strict) throw error ?? new Error('No se pudo generar el enlace de la foto de perfil.');
    return null;
  }

  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000 });
  return data.signedUrl;
}
