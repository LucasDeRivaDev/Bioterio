-- ═══════════════════════════════════════════════════════════════
--  Migración: tipo de `incidentes.animal_ids` → text[]
-- ───────────────────────────────────────────────────────────────
--  Problema: `animal_ids` es uuid[], pero el formulario de incidentes
--  guarda ahí los grupos de crías en stock como pseudo-ids de texto
--  (ej. "stock:mnur1quvu0oy:hembra"). Al insertar falla con:
--    invalid input syntax for type uuid: "stock:...:hembra"
--
--  La columna debe ser text[] porque mezcla:
--    · UUIDs de reproductores reales
--    · pseudo-ids "stock:<camada_id>:<sexo>" de grupos de crías
--  (el render de chips en Incidentes.jsx parsea esos "stock:" ids).
--
--  La columna singular `animal_id` sigue siendo uuid (FK a animales):
--  guarda solo el primer reproductor real, así que no se toca.
--
--  Ejecutar en: Supabase → SQL Editor → pegar y correr.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE incidentes
  ALTER COLUMN animal_ids TYPE text[] USING animal_ids::text[];
