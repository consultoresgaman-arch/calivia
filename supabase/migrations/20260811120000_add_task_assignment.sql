/*
# Asignación de tareas por el especialista

## Propósito
Hoy `tasks` es 100% self-service (RLS exige `user_id = current_session_user_id()`
en INSERT), así que un psicólogo no puede crearle una tarea a su paciente
directamente. En vez de abrir una política de INSERT cruzada (que tendría
que reautorizar con cuidado el resto de las reglas), se agrega una función
`SECURITY DEFINER` — mismo patrón que `link_patient`/`admin_grant_premium` —
que valida el vínculo paciente-psicólogo antes de insertar.

## Columna `assigned_by`
Nullable: null cuando la tarea la creó el propio paciente (caso normal,
sigue igual), o el id del psicólogo cuando vino de `assign_patient_task`.
Sirve para que el cliente muestre "De tu especialista" sin ambigüedad.
*/

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.assign_patient_task(p_patient_id uuid, p_title text)
RETURNS TABLE(id uuid, title text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_psych uuid := public.current_session_user_id();
  v_title text := trim(p_title);
  v_id uuid;
BEGIN
  IF v_psych IS NULL OR NOT public.is_psychologist(v_psych) THEN
    RAISE EXCEPTION 'Solo un psicólogo puede asignar tareas';
  END IF;
  IF NOT public.is_linked_patient(v_psych, p_patient_id) THEN
    RAISE EXCEPTION 'Ese paciente no está vinculado a tu cuenta';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'La consigna no puede estar vacía';
  END IF;

  INSERT INTO public.tasks (user_id, title, assigned_by)
  VALUES (p_patient_id, v_title, v_psych)
  RETURNING tasks.id INTO v_id;

  RETURN QUERY SELECT t.id, t.title, t.created_at FROM public.tasks t WHERE t.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_patient_task(uuid, text) TO anon;
