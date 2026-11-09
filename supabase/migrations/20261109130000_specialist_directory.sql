/*
Directorio de especialistas en "Agendar".

1. Nuevas columnas en profiles: título profesional, enlace de agenda (https),
   valor de la sesión y si el especialista quiere aparecer en el directorio.
   El especialista las edita en su perfil (GRANT UPDATE por columna, como el resto).
2. Nueva `list_directory_specialists()`: devuelve solo datos públicos de los
   especialistas con aprobación vigente que activaron el directorio. El número de
   registro sale del registro de aprobaciones (el verificado), no del perfil.
   Requiere sesión iniciada. Así no hace falta abrir la tabla profiles.
3. La cuenta existente queda visible con el enlace y el valor que ya se mostraban.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_title text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS session_price text,
  ADD COLUMN IF NOT EXISTS directory_visible boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_professional_title_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_professional_title_len
  CHECK (professional_title IS NULL OR char_length(professional_title) <= 80);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_booking_url_https;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_booking_url_https
  CHECK (booking_url IS NULL OR (booking_url ~ '^https://[^[:space:]]+$' AND char_length(booking_url) <= 300));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_session_price_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_session_price_len
  CHECK (session_price IS NULL OR char_length(session_price) <= 60);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len
  CHECK (bio IS NULL OR char_length(bio) <= 500) NOT VALID;

GRANT UPDATE (professional_title, booking_url, session_price, directory_visible) ON public.profiles TO anon;

CREATE OR REPLACE FUNCTION public.list_directory_specialists()
RETURNS TABLE (
  id uuid,
  full_name text,
  professional_title text,
  bio text,
  country text,
  license_number text,
  license_country text,
  booking_url text,
  session_price text,
  is_linked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.professional_title, p.bio, p.country,
         a.license_number, a.license_country, p.booking_url, p.session_price,
         EXISTS (
           SELECT 1 FROM public.patient_links l
           WHERE l.psychologist_id = p.id
             AND l.patient_id = public.current_session_user_id()
             AND l.status = 'accepted'
         ) AS is_linked
  FROM public.profiles p
  JOIN public.professional_approvals a ON a.profile_id = p.id AND a.revoked_at IS NULL
  WHERE public.current_session_user_id() IS NOT NULL
    AND p.role = 'psychologist'
    AND p.directory_visible
    AND p.booking_url IS NOT NULL
  ORDER BY is_linked DESC, a.approved_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_directory_specialists() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.list_directory_specialists() TO anon;

-- La cuenta existente conserva lo que "Agendar" ya mostraba.
UPDATE public.profiles
SET booking_url = 'https://calendly.com/consultoresgaman/60min',
    session_price = '$35.000 CLP (~$38 USD)',
    directory_visible = true
WHERE role = 'psychologist' AND booking_url IS NULL;

NOTIFY pgrst, 'reload schema';
