/*
# Permite cambiar la contraseña propia estando logueado

## Contexto
Hasta ahora un usuario solo podía cambiar su contraseña vía el flujo de
"olvidé mi contraseña" (código de recuperación por correo) o si un admin
usaba `admin_reset_password`. No existía forma de fijar una contraseña
personalizada estando ya autenticado (p.ej. justo después de que un admin
le entregara una clave temporal). `change_password` cubre ese caso: valida
la sesión y la contraseña actual, y actualiza el hash.
*/

CREATE OR REPLACE FUNCTION public.change_password(p_current_password text, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := public.current_session_user_id();
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  SELECT password_hash INTO v_hash FROM public.profiles WHERE id = v_uid;

  IF v_hash IS NULL OR v_hash <> crypt(p_current_password, v_hash) THEN
    RAISE EXCEPTION 'La contraseña actual es incorrecta';
  END IF;

  UPDATE public.profiles SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_password(text, text) TO anon;
