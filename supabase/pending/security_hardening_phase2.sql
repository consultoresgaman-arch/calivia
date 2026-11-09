/*
# Endurecimiento de seguridad — fase 2

NO APLICAR hasta que la versión nueva de la app (web y Android) esté publicada
y las versiones antiguas ya no se usen. Las versiones antiguas dejarán de poder
iniciar sesión y el panel del especialista fallará por su select('*').

Está fuera de supabase/migrations a propósito, para que `supabase db push` no
la aplique sola. Cuando llegue el momento, muévela allí con un nombre fechado.

## Cambios
1. El login y la confirmación de vínculo solo pasan por `secure-auth`.
2. El cliente deja de poder leer password_hash, recovery_email y los datos de
   facturación de `profiles`.
*/

REVOKE ALL ON FUNCTION public.login_profile(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_profile(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.confirm_patient_link_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_patient_link_code(text, text) TO service_role;

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, full_name, role, country, is_premium, premium_until, created_at, avatar_path, phone,
  license_number, bio, preferred_name, occupation, terms_accepted_at, terms_version,
  persona_name_espejo, persona_name_amigo, persona_name_acompanante,
  professional_title, booking_url, session_price, directory_visible
) ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';
