-- Agregar columna grupo_investigacion a la tabla entregas
-- Grupo de investigación receptor de cada entrega de animales

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS grupo_investigacion text;
