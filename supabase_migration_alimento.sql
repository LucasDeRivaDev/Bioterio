-- ═══════════════════════════════════════════════════════════════
--  BIOTERIO — Tablas de alimento
--  Ejecutar en: supabase.com → Tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- ── Censos de alimento ───────────────────────────────────────────
-- Cada vez que el usuario pesa el stock disponible en depósito/bolsas
CREATE TABLE IF NOT EXISTS alimento_censos (
  id                      TEXT PRIMARY KEY,
  fecha                   TEXT NOT NULL,
  hora                    TEXT,
  stock_kg                NUMERIC NOT NULL DEFAULT 0,
  relleno_kg              NUMERIC NOT NULL DEFAULT 0,
  consumo_estimado_g_dia  INTEGER,
  composicion             JSONB,   -- { lactantes, repro, crias, jovenes, adultos: { count, totalGDia } }
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ingresos de alimento ─────────────────────────────────────────
-- Compras / reposición de bolsas al depósito
CREATE TABLE IF NOT EXISTS alimento_ingresos (
  id         TEXT PRIMARY KEY,
  fecha      TEXT NOT NULL,
  kg         NUMERIC NOT NULL DEFAULT 0,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reposiciones de alimento en jaulas ──────────────────────────
-- Cuando se traslada alimento del depósito a las jaulas
CREATE TABLE IF NOT EXISTS alimento_reposiciones (
  id               TEXT PRIMARY KEY,
  fecha            TEXT NOT NULL,
  hora             TEXT,
  tipo_reposicion  TEXT NOT NULL DEFAULT 'completa' CHECK (tipo_reposicion IN ('completa', 'parcial')),
  kg               NUMERIC NOT NULL DEFAULT 0,
  bioterios        JSONB NOT NULL DEFAULT '[]',   -- array de bioterio_ids
  categorias       JSONB NOT NULL DEFAULT '[]',   -- array de categorías
  notas            TEXT,
  confirmada       BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Estimaciones rápidas ─────────────────────────────────────────
-- Ajustes de stock sin censo completo
CREATE TABLE IF NOT EXISTS alimento_estimaciones (
  id         TEXT PRIMARY KEY,
  fecha      TEXT NOT NULL,
  tipo       TEXT NOT NULL,
  kg         NUMERIC NOT NULL DEFAULT 0,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────────
ALTER TABLE alimento_censos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alimento_ingresos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE alimento_reposiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE alimento_estimaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo usuarios autenticados"
  ON alimento_censos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo usuarios autenticados"
  ON alimento_ingresos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo usuarios autenticados"
  ON alimento_reposiciones FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo usuarios autenticados"
  ON alimento_estimaciones FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
--  LISTO. Las 4 tablas de alimento ya están disponibles.
-- ═══════════════════════════════════════════════════════════════
