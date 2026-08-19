/*
# Sonido de recordatorio por tarea

## Propósito
Permitir elegir, al crear una tarea, cuál de los tonos de alarma incluidos
en la app suena para esa tarea en particular (para poder distinguir una
tarea de otra solo por el sonido). El valor es una clave interna ('classic',
'soft', 'urgent', 'chime') que el cliente mapea a un archivo de sonido
empaquetado en la app — no es un nombre de archivo ni una ruta.
*/

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_sound text NOT NULL DEFAULT 'classic';
