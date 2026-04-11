-- ═══════════════════════════════════════════════════════════════
--  MIGRACIÓN: Tabla de jaulas (distribución de stock por jaula)
--  Ejecutar en: supabase.com → Tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jaulas (
  id         TEXT PRIMARY KEY,
  camada_id  TEXT NOT NULL,
  total      INTEGER DEFAULT 0,
  machos     INTEGER,
  hembras    INTEGER,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jaulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo usuarios autenticados"
  ON jaulas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
--  LISTO. Las jaulas se crean automáticamente desde la app
--  cuando se registra el destete de una camada.
-- ═══════════════════════════════════════════════════════════════
