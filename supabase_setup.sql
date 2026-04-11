-- ═══════════════════════════════════════════════════════════════
--  BIOTERIO — Script de configuración de base de datos Supabase
--  Ejecutar en: supabase.com → Tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- ── Tabla de animales ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS animales (
  id               TEXT PRIMARY KEY,
  codigo           TEXT NOT NULL,
  sexo             TEXT NOT NULL CHECK (sexo IN ('hembra', 'macho')),
  fecha_nacimiento TEXT,
  id_madre         TEXT,
  id_padre         TEXT,
  estado           TEXT DEFAULT 'activo'
                   CHECK (estado IN ('activo', 'en_apareamiento', 'en_cria', 'retirado', 'fallecido')),
  notas            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla de camadas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS camadas (
  id                TEXT PRIMARY KEY,
  id_madre          TEXT,
  id_padre          TEXT,
  fecha_copula      TEXT,
  fecha_separacion  TEXT,      -- fecha en que se separó la pareja (fin del apareamiento)
  fecha_nacimiento  TEXT,
  gestacion_real    INTEGER,
  total_crias       INTEGER,
  crias_machos      INTEGER,
  crias_hembras     INTEGER,
  total_destetados  INTEGER,
  fecha_destete     TEXT,
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security (RLS) — Solo usuarios autenticados ────────
ALTER TABLE animales ENABLE ROW LEVEL SECURITY;
ALTER TABLE camadas  ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario con sesión activa puede leer y escribir
CREATE POLICY "Solo usuarios autenticados"
  ON animales FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo usuarios autenticados"
  ON camadas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
--  LISTO. Ahora creá los usuarios en:
--  supabase.com → Tu proyecto → Authentication → Users → Invite
-- ═══════════════════════════════════════════════════════════════
