/*
Registro de aprobaciones de especialistas.

1. Nueva tabla `professional_approvals`: quién aprobó a cada especialista, cuándo,
   con qué número de registro y dónde se verificó. Las filas no se borran: una
   revocación queda anotada en la misma fila. Solo service_role (SQL Editor).
2. `admin_verify_professional` exige ahora número de registro, fuente de la
   verificación y quién aprueba, y deja la aprobación anotada.
3. Nueva `admin_revoke_professional`: devuelve la cuenta a paciente, corta sus
   vínculos con pacientes y cierra sus sesiones.
4. Un trigger impide que un perfil pase a especialista sin una aprobación vigente,
   venga el cambio de donde venga.
5. La cuenta de especialista existente queda registrada como aprobación previa.
*/

-- ===== 1. Tabla =====

CREATE TABLE IF NOT EXISTS public.professional_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL: si la cuenta se elimina, el registro de la aprobación se conserva.
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  license_number text,
  license_country text,
  verification_source text NOT NULL,
  verification_notes text,
  approved_by text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text
);

CREATE INDEX IF NOT EXISTS professional_approvals_profile_idx
  ON public.professional_approvals (profile_id);

-- Una sola aprobación vigente por cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS professional_approvals_one_active
  ON public.professional_approvals (profile_id) WHERE revoked_at IS NULL;

ALTER TABLE public.professional_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.professional_approvals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.professional_approvals TO service_role;

-- ===== 5. Aprobación previa de la cuenta existente (antes del trigger) =====

INSERT INTO public.professional_approvals
  (profile_id, full_name, license_number, verification_source, verification_notes, approved_by, approved_at)
SELECT p.id, p.full_name, nullif(trim(p.license_number), ''),
       'Aprobación previa al registro',
       'Cuenta de especialista creada antes de existir este registro.',
       'Registro inicial', p.created_at
FROM public.profiles p
WHERE p.role = 'psychologist'
  AND NOT EXISTS (
    SELECT 1 FROM public.professional_approvals a
    WHERE a.profile_id = p.id AND a.revoked_at IS NULL
  );

-- ===== 4. Trigger: sin aprobación vigente no hay especialista =====

CREATE OR REPLACE FUNCTION public.enforce_professional_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'psychologist' AND NOT EXISTS (
    SELECT 1 FROM public.professional_approvals a
    WHERE a.profile_id = NEW.id AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Este perfil no tiene una aprobación de especialista vigente';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_professional_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_enforce_professional_approval ON public.profiles;
CREATE TRIGGER profiles_enforce_professional_approval
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_professional_approval();

-- ===== 2. Aprobar =====

DROP FUNCTION IF EXISTS public.admin_verify_professional(text);

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

  UPDATE public.profiles
    SET role = 'psychologist', license_number = trim(p_license_number)
    WHERE id = v_profile.id;

  RETURN v_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_professional(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_professional(text, text, text, text, text, text) TO service_role;

-- ===== 3. Revocar =====

CREATE OR REPLACE FUNCTION public.admin_revoke_professional(
  p_name text,
  p_revoked_by text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF coalesce(trim(p_revoked_by), '') = '' OR coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Indica quién revoca y el motivo';
  END IF;

  SELECT * INTO v_profile FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name));
  IF NOT FOUND OR v_profile.role <> 'psychologist' THEN
    RAISE EXCEPTION 'No se encontró un especialista con ese nombre';
  END IF;

  -- Primero el rol: el trigger solo mira los cambios hacia especialista.
  UPDATE public.profiles SET role = 'patient' WHERE id = v_profile.id;

  UPDATE public.professional_approvals
    SET revoked_at = now(), revoked_by = trim(p_revoked_by), revoke_reason = trim(p_reason)
    WHERE profile_id = v_profile.id AND revoked_at IS NULL;

  -- Deja de ver a sus pacientes y debe volver a iniciar sesión.
  DELETE FROM public.patient_links WHERE psychologist_id = v_profile.id;
  DELETE FROM public.sessions WHERE user_id = v_profile.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_professional(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_professional(text, text, text) TO service_role;
