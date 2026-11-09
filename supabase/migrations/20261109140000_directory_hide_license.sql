/*
El directorio de "Agendar" deja de devolver el número de registro: un número
público puede copiarse para suplantar al profesional. La tarjeta muestra solo que
el especialista fue verificado por Calivia; el número queda en
professional_approvals, que solo ve service_role.

Por la misma razón, aprobar ya no copia el número al perfil (los pacientes
vinculados pueden leer el perfil de su especialista), y se borra el que hubiera.
*/

DROP FUNCTION IF EXISTS public.list_directory_specialists();

CREATE FUNCTION public.list_directory_specialists()
RETURNS TABLE (
  id uuid,
  full_name text,
  professional_title text,
  bio text,
  country text,
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

CREATE OR REPLACE FUNCTION public.admin_verify_professional(
  p_name text,
  p_license_number text,
  p_license_country text,
  p_verification_source text,
  p_approved_by text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_approval_id uuid;
BEGIN
  IF coalesce(trim(p_license_number), '') = '' THEN
    RAISE EXCEPTION 'Falta el número de registro profesional';
  END IF;
  IF coalesce(trim(p_verification_source), '') = '' THEN
    RAISE EXCEPTION 'Indica dónde verificaste el registro (por ejemplo, Superintendencia de Salud)';
  END IF;
  IF coalesce(trim(p_approved_by), '') = '' THEN
    RAISE EXCEPTION 'Indica quién aprueba';
  END IF;

  SELECT * INTO v_profile FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró una cuenta con ese nombre';
  END IF;
  IF v_profile.role <> 'patient' THEN
    RAISE EXCEPTION 'Esa cuenta ya es de especialista';
  END IF;

  INSERT INTO public.professional_approvals
    (profile_id, full_name, license_number, license_country, verification_source, verification_notes, approved_by)
  VALUES
    (v_profile.id, v_profile.full_name, trim(p_license_number), nullif(trim(p_license_country), ''),
     trim(p_verification_source), nullif(trim(p_notes), ''), trim(p_approved_by))
  RETURNING id INTO v_approval_id;

  UPDATE public.profiles SET role = 'psychologist' WHERE id = v_profile.id;

  RETURN v_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_professional(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_professional(text, text, text, text, text, text) TO service_role;

UPDATE public.profiles SET license_number = NULL WHERE license_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';
