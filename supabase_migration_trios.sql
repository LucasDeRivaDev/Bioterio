-- ═══════════════════════════════════════════════════════════════
--  MIGRACIÓN: Tríos reproductivos en planes de apareamiento (BALB/c)
--  Ejecutar en: supabase.com → Tu proyecto → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Segunda hembra del plan: { bloqueId, tipo, codigo, total, edad }.
-- NULL en los planes de pareja (1 macho + 1 hembra), que no cambian.
ALTER TABLE planes_apareamiento ADD COLUMN IF NOT EXISTS hembra2 jsonb;

-- ═══════════════════════════════════════════════════════════════
--  LISTO. Los planes existentes no se modifican.
-- ═══════════════════════════════════════════════════════════════
