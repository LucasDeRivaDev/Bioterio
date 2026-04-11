-- ═══════════════════════════════════════════════════════════════
--  MIGRACIÓN: Estado de apareamiento y separación de pareja
--  Ejecutar en: supabase.com → Tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna fecha_separacion a camadas (si no existe)
ALTER TABLE camadas ADD COLUMN IF NOT EXISTS fecha_separacion TEXT;

-- 2. Actualizar CHECK constraint de animales para incluir 'en_apareamiento'
ALTER TABLE animales DROP CONSTRAINT IF EXISTS animales_estado_check;
ALTER TABLE animales ADD CONSTRAINT animales_estado_check
  CHECK (estado IN ('activo', 'en_apareamiento', 'en_cria', 'retirado', 'fallecido'));

-- ═══════════════════════════════════════════════════════════════
--  LISTO. Los registros existentes no se modifican.
--  El nuevo estado 'en_apareamiento' se asigna automáticamente
--  al registrar nuevos apareamientos desde la app.
-- ═══════════════════════════════════════════════════════════════
