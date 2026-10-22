-- ═══════════════════════════════════════════════════════════════
--  Migración: alertas/tareas descartadas del Dashboard → Supabase
-- ───────────────────────────────────────────────────────────────
--  Antes vivían en localStorage (appMosca_tareas_descartadas_{bioterio}),
--  así que descartar una alerta solo valía para ese navegador.
--  Ahora se comparten entre todos los usuarios y dispositivos.
--
--  Una fila por bioterio + tarea. `fecha` = día del descarte; la app
--  oculta la alerta 30 días y después la vuelve a mostrar si sigue vigente
--  (y borra las filas expiradas).
--
--  Lo que haya en localStorage de cada navegador se sube solo la próxima
--  vez que se abra el Dashboard.
--
--  Ejecutar en: Supabase → SQL Editor → pegar y correr.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tareas_descartadas (
  bioterio_id text NOT NULL,
  tarea_id    text NOT NULL,
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (bioterio_id, tarea_id)
);

ALTER TABLE tareas_descartadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo usuarios autenticados" ON tareas_descartadas;

CREATE POLICY "Solo usuarios autenticados"
  ON tareas_descartadas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
