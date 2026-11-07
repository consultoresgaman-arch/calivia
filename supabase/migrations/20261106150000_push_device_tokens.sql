/*
# Tokens de dispositivo para notificaciones push

Cada fila vincula un token de Firebase Cloud Messaging con una cuenta. Solo lo
leen y escriben las Edge Functions con service_role: el cliente nunca ve los
tokens de otras personas ni puede asignarse uno ajeno. El token es la clave
primaria para que un teléfono compartido notifique solo a la cuenta activa.
*/

CREATE TABLE IF NOT EXISTS public.device_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'android' CHECK (platform IN ('android')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
-- Sin políticas a propósito: el acceso pasa solo por service_role.

REVOKE ALL ON public.device_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO service_role;
