/*
Foto del especialista en la tarjeta de "Agendar".

1. `is_directory_specialist(uuid)`: verdadero si el perfil es especialista con
   aprobación vigente y tarjeta activa (las mismas condiciones del directorio).
2. Nueva política de storage: un usuario con sesión puede leer la foto de esos
   especialistas. Las fotos de pacientes siguen visibles solo para su dueño y su
   especialista vinculado; si el especialista desactiva su tarjeta, su foto deja
   de ser visible para el resto.
3. `list_directory_specialists()` devuelve también la ruta de la foto.
*/

CREATE OR REPLACE FUNCTION public.is_directory_specialist(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.professional_approvals a ON a.profile_id = p.id AND a.revoked_at IS NULL
    WHERE p.id = p_id
      AND p.role = 'psychologist'
      AND p.directory_visible
      AND p.booking_url IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_directory_specialist(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.is_directory_specialist(uuid) TO anon;

DROP POLICY IF EXISTS avatars_select_directory_specialist ON storage.objects;
CREATE POLICY avatars_select_directory_specialist ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'avatars'
    AND public.current_session_user_id() IS NOT NULL
    AND public.is_directory_specialist(((storage.foldername(name))[1])::uuid)
  );

DROP FUNCTION IF EXISTS public.list_directory_specialists();

CREATE FUNCTION public.list_directory_specialists()
RETURNS TABLE (
  id uuid,
  full_name text,
  professional_title text,
  bio text,
  country text,
  avatar_path text,
  booking_url text,
  session_price text,
  is_linked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.professional_title, p.bio, p.country, p.avatar_path,
         p.booking_url, p.session_price,
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

NOTIFY pgrst, 'reload schema';
