-- ═══════════════════════════════════════════════════════════════
--  Migración: políticas RLS para la tabla `incidentes`
-- ───────────────────────────────────────────────────────────────
--  Problema: la tabla `incidentes` tiene RLS habilitado pero NO tiene
--  ninguna política. Resultado:
--    · SELECT  → devuelve [] sin error (por eso la tabla "parece vacía")
--    · INSERT/UPDATE/DELETE → error 42501
--      "new row violates row-level security policy for table incidentes"
--  Esto rompe el alta de incidentes ("No se pudo guardar. Verificá la conexión").
--
--  Solución: misma política que el resto de las tablas (animales, camadas, …):
--  cualquier usuario con sesión activa puede leer y escribir.
--
--  Ejecutar en: Supabase → SQL Editor → pegar y correr.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE incidentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo usuarios autenticados" ON incidentes;

CREATE POLICY "Solo usuarios autenticados"
  ON incidentes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
