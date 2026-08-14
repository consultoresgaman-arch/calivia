/*
# Cierra dos huecos de seguridad: reseteo de contraseña y vínculo paciente-psicólogo

## 1. `create_password_reset_code` ya no es llamable por `anon`
Estaba `GRANT`eada a `anon` y devuelve el código de recuperación de 6
dígitos en su respuesta. Como el rol `anon` es exactamente el que usa la
`anon key` pública embebida en el cliente, cualquiera podía llamarla
directo contra la API REST (saltándose la Edge Function
`request-password-reset`, que es la única que debería usarla) y leer el
código en la respuesta, sin necesidad de acceso al correo de la víctima.
Combinado con `reset_password_with_code` (también pública, sin límite de
intentos), esto permitía secuestrar cualquier cuenta.

Se revoca el `EXECUTE` de `anon`/`authenticated`/`public` y se deja solo
para `service_role`. La Edge Function ya usa la service role key, así que
sigue funcionando exactamente igual; el código deja de poder pedirse desde
el navegador.

## 2. `link_patient` ahora requiere que el paciente acepte
Antes, cualquier cuenta registrada con `role = 'psychologist'` (que
cualquiera puede elegir libremente al registrarse, sin verificación) podía
vincularse a cualquier paciente por nombre y quedar con acceso de lectura
inmediato a sus check-ins, chats con la IA, reportes y notas clínicas.

`patient_links` gana una columna `status` ('pending' | 'accepted').
`link_patient` ahora crea el vínculo en 'pending' en vez de darlo por
aceptado. `is_linked_patient()` (usada en TODAS las políticas RLS que
dependían del vínculo) solo cuenta vínculos 'accepted'. Se agregan
`accept_patient_link` / `reject_patient_link`, invocables solo por el
propio paciente. Los vínculos ya existentes se marcan 'accepted' para no
romper relaciones psicólogo-paciente ya en uso.

También se agrega una política de SELECT en `profiles` para que el
paciente pueda ver el nombre del psicólogo que le mandó la solicitud
(antes no tenía ninguna visibilidad sobre perfiles de psicólogos).
*/

-- ===== 1. create_password_reset_code: cerrar acceso directo desde el cliente =====

REVOKE ALL ON FUNCTION public.create_password_reset_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_password_reset_code(text) FROM anon;
REVOKE ALL ON FUNCTION public.create_password_reset_code(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_password_reset_code(text) TO service_role;

-- ===== 2. patient_links: estado pending/accepted =====

ALTER TABLE public.patient_links ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';
ALTER TABLE public.patient_links DROP CONSTRAINT IF EXISTS patient_links_status_check;
ALTER TABLE public.patient_links ADD CONSTRAINT patient_links_status_check CHECK (status IN ('pending', 'accepted'));

-- Vínculos creados antes de este cambio siguen operando (ya eran de facto
-- aceptados: no existía ningún paso de consentimiento).
UPDATE public.patient_links SET status = 'accepted' WHERE status IS NULL;

CREATE OR REPLACE FUNCTION public.is_linked_patient(psych_id uuid, pat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_links l
    WHERE l.psychologist_id = psych_id AND l.patient_id = pat_id AND l.status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.link_patient(p_name text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_psych uuid := public.current_session_user_id();
  v_patient_id uuid;
BEGIN
  IF v_psych IS NULL OR NOT public.is_psychologist(v_psych) THEN
    RAISE EXCEPTION 'Solo un psicólogo puede vincular pacientes';
  END IF;

  SELECT p.id INTO v_patient_id FROM public.profiles p
    WHERE lower(trim(p.full_name)) = lower(trim(p_name)) AND p.role = 'patient';

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un paciente con ese nombre';
  END IF;

  INSERT INTO public.patient_links (psychologist_id, patient_id, status)
  VALUES (v_psych, v_patient_id, 'pending')
  ON CONFLICT (patient_id) DO UPDATE
    SET psychologist_id = EXCLUDED.psychologist_id, status = 'pending', created_at = now();

  RETURN QUERY SELECT p.id, p.full_name FROM public.profiles p WHERE p.id = v_patient_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_patient_link(p_psychologist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient uuid := public.current_session_user_id();
BEGIN
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;
  UPDATE public.patient_links
  SET status = 'accepted'
  WHERE psychologist_id = p_psychologist_id AND patient_id = v_patient AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una solicitud pendiente de ese profesional';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_patient_link(p_psychologist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient uuid := public.current_session_user_id();
BEGIN
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;
  DELETE FROM public.patient_links
  WHERE psychologist_id = p_psychologist_id AND patient_id = v_patient AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_patient_link(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.reject_patient_link(uuid) TO anon;

-- El paciente necesita poder leer sus propias filas de patient_links
-- (pendientes y aceptadas) para mostrarlas en su panel.
DROP POLICY IF EXISTS "patient_links_select_for_patient" ON public.patient_links;
CREATE POLICY "patient_links_select_for_patient"
ON public.patient_links FOR SELECT
TO anon
USING (patient_id = public.current_session_user_id());

-- El paciente necesita poder ver el nombre del psicólogo que le mandó una
-- solicitud (o con quien ya está vinculado) para poder decidir.
DROP POLICY IF EXISTS "profiles_select_linked_psychologist_by_patient" ON public.profiles;
CREATE POLICY "profiles_select_linked_psychologist_by_patient"
ON public.profiles FOR SELECT
TO anon
USING (
  role = 'psychologist'
  AND EXISTS (
    SELECT 1 FROM public.patient_links l
    WHERE l.psychologist_id = profiles.id AND l.patient_id = public.current_session_user_id()
  )
);
