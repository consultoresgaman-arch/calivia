/*
# Limpieza: políticas RLS muertas del modelo de auth anterior

`select_all_profiles_for_psychologist` (en `profiles`) y
`select_all_checkins_for_psychologist` (en `checkins`) quedaron de antes de
la migración `20260805130000_custom_table_based_auth.sql`, que reemplazó
Supabase Auth por sesiones propias. Ambas usan `auth.uid()`, que esta app
ya no genera nunca (el cliente solo usa la anon key, sin JWT de sesión), así
que hoy son inertes en la práctica.

Pero su lógica es defectuosa por diseño: el `EXISTS` de cada una no filtra
por la fila evaluada, así que si `auth.uid()` alguna vez resolviera a un
perfil con `role = 'psychologist'` (p. ej. si se reactivara el login nativo
de Supabase Auth por error), esa policy le daría a ese usuario acceso de
lectura a TODAS las filas de la tabla, sin importar vínculo alguno —
saltándose por completo `is_linked_patient()`. Se eliminan como
higiene de RLS; las políticas vigentes (`profiles_select_own_or_psychologist`,
`checkins_select_own_or_psychologist`, basadas en
`current_session_user_id()` + `is_linked_patient()`) ya cubren el caso de
uso real.
*/

DROP POLICY IF EXISTS "select_all_profiles_for_psychologist" ON public.profiles;
DROP POLICY IF EXISTS "select_all_checkins_for_psychologist" ON public.checkins;
