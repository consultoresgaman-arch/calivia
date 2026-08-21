/*
# Add premium billing fields to profiles

## Purpose
Soporta la pasarela de pago (Lemon Squeezy): cuando un paciente alcanza el
límite diario de mensajes de la IA, puede suscribirse a "Calivia Ilimitada".
El webhook de Lemon Squeezy (supabase/functions/lemonsqueezy-webhook)
marca al perfil como premium tras un pago confirmado.

## 1. Modified tables
- `profiles`
  - ADD `is_premium` (boolean, not null, default false) — desbloquea mensajes
    ilimitados y el resto de las dinámicas táctiles.
  - ADD `premium_since` (timestamptz, nullable) — fecha de activación.
  - ADD `lemonsqueezy_customer_id` (text, nullable) — id de cliente en Lemon
    Squeezy, útil para enlazar al portal de gestión de la suscripción.
  - ADD `lemonsqueezy_subscription_id` (text, nullable) — id de la
    suscripción activa, para poder revertir `is_premium` en cancelaciones.

## 2. Security
- Estas columnas solo deben cambiar desde el webhook (que usa la
  `service_role` key y por tanto no pasa por RLS de cliente). Un trigger
  `protect_premium_columns` bloquea cualquier intento de modificarlas desde
  una sesión autenticada normal (rol `authenticated`), incluso aunque la
  política `profiles_update_own` permita actualizar el resto del perfil.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_since timestamptz,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text;

CREATE OR REPLACE FUNCTION public.protect_premium_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.is_premium := OLD.is_premium;
    NEW.premium_since := OLD.premium_since;
    NEW.lemonsqueezy_customer_id := OLD.lemonsqueezy_customer_id;
    NEW.lemonsqueezy_subscription_id := OLD.lemonsqueezy_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_premium_columns_trigger ON public.profiles;
CREATE TRIGGER protect_premium_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_premium_columns();
