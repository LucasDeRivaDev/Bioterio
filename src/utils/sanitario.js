// ── Categorías y tipos de incidente ──────────────────────────────────────────

export const CATEGORIAS = {
  sanitario: {
    label: 'Sanitario',
    icon: '🩺',
    color: '#ff6b80',
    tipos: [
      { id: 'alopecia',          label: 'Alopecia' },
      { id: 'hematuria',         label: 'Hematuria' },
      { id: 'perdida_peso',      label: 'Pérdida de peso' },
      { id: 'heridas',           label: 'Heridas / peleas' },
      { id: 'muerte_inesperada', label: 'Muerte inesperada' },
    ],
  },
  reproductivo: {
    label: 'Reproductivo',
    icon: '🧬',
    color: '#a78bfa',
    tipos: [
      { id: 'aborto',          label: 'Aborto' },
      { id: 'reabsorcion',     label: 'Reabsorción' },
      { id: 'infertilidad',    label: 'Infertilidad' },
      { id: 'parto_fallido',   label: 'Parto fallido' },
      { id: 'camada_pequeña',  label: 'Camada pequeña' },
    ],
  },
  crias: {
    label: 'Crías',
    icon: '🐣',
    color: '#40c4ff',
    tipos: [
      { id: 'ausencia_cola',        label: 'Ausencia de cola' },
      { id: 'ausencia_extremidad',  label: 'Ausencia de extremidad' },
      { id: 'tamaño_reducido',      label: 'Tamaño muy reducido' },
      { id: 'alopecia_neonatal',    label: 'Alopecia neonatal' },
      { id: 'muerte_neonatal',      label: 'Muerte neonatal' },
      { id: 'malformacion',         label: 'Malformación' },
      { id: 'retraso_crecimiento',  label: 'Retraso de crecimiento' },
      { id: 'tamaño_asimetrico',    label: 'Crías mucho más pequeñas que hermanas' },
    ],
  },
  ambiental: {
    label: 'Ambiental',
    icon: '🌡️',
    color: '#ffb300',
    tipos: [
      { id: 'temperatura',       label: 'Temperatura fuera de rango' },
      { id: 'ruido',             label: 'Ruido excesivo' },
      { id: 'falla_agua',        label: 'Falla en agua' },
      { id: 'falla_alimento',    label: 'Falla en alimento' },
      { id: 'incidente_manejo',  label: 'Incidente de manejo' },
    ],
  },
  otro: {
    label: 'Otro',
    icon: '📝',
    color: '#8a9bb0',
    tipos: [
      { id: 'otro', label: 'Otro (texto libre)' },
    ],
  },
}

export const SEVERIDADES = [
  { id: 'leve',     label: 'Leve',     color: '#ffb300', bg: 'rgba(255,179,0,0.10)' },
  { id: 'moderado', label: 'Moderado', color: '#ff9800', bg: 'rgba(255,152,0,0.10)' },
  { id: 'grave',    label: 'Grave',    color: '#ff6b80', bg: 'rgba(255,107,128,0.10)' },
]

export const LISTA_BIOTERIOS = [
  { id: 'todos',            label: 'Todos',    color: '#8a9bb0' },
  { id: 'ratas',            label: 'Ratas',    color: '#00e676' },
  { id: 'ratones_balbc',    label: 'BALB/C',   color: '#40c4ff' },
  { id: 'ratones_c57',      label: 'C57',      color: '#a78bfa' },
  { id: 'ratones_hibridos', label: 'Híbridos', color: '#ffb300' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getCategoriaInfo(catId) {
  return CATEGORIAS[catId] ?? CATEGORIAS.otro
}

export function getTipoLabel(catId, tipoId) {
  const cat = CATEGORIAS[catId]
  if (!cat) return tipoId ?? '—'
  return cat.tipos.find(t => t.id === tipoId)?.label ?? tipoId ?? '—'
}

export function getSeveridadInfo(sevId) {
  return SEVERIDADES.find(s => s.id === sevId) ?? SEVERIDADES[0]
}

export function labelBioterio(id) {
  return LISTA_BIOTERIOS.find(b => b.id === id)?.label ?? id ?? '—'
}

export function colorBioterio(id) {
  return LISTA_BIOTERIOS.find(b => b.id === id)?.color ?? '#8a9bb0'
}

// ── Calcular índice sanitario por colonia (0–100) ─────────────────────────────
// Penalizaciones:
//   Incidentes graves recientes (90d): −8 c/u (máx −24)
//   Incidentes moderados:              −4 c/u (máx −16)
//   Incidentes leves:                  −1 c/u (máx −5)
//   Fallos reproductivos recientes:    −5 c/u (máx −20)
//   Supervivencia < 70%:               −15
//   Supervivencia 70–85%:              −7
//   Patrones críticos detectados:      −10 por patrón

export function calcularIndiceSanitario(camadas, incidentes, bioterioId) {
  let score = 100
  const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const inc = bioterioId && bioterioId !== 'todos'
    ? incidentes.filter(i => i.bioterio_id === bioterioId)
    : incidentes
  const cam = bioterioId && bioterioId !== 'todos'
    ? camadas.filter(c => c.bioterio_id === bioterioId)
    : camadas

  // Penalizar incidentes recientes sin resolver
  const recientes = inc.filter(i => i.fecha >= hace90 && !i.resuelto)
  score -= Math.min(24, recientes.filter(i => i.severidad === 'grave').length * 8)
  score -= Math.min(16, recientes.filter(i => i.severidad === 'moderado').length * 4)
  score -= Math.min(5,  recientes.filter(i => i.severidad === 'leve').length * 1)

  // Penalizar fallos reproductivos recientes
  const fallos = cam.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace90)
  score -= Math.min(20, fallos.length * 5)

  // Penalizar supervivencia baja
  const conDestete = cam.filter(c => c.total_crias > 0 && c.total_destetados != null)
  if (conDestete.length > 0) {
    const sr = conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
    if (sr < 0.70) score -= 15
    else if (sr < 0.85) score -= 7
  }

  // Penalizar patrones críticos
  const patrones = detectarPatrones(inc)
  score -= patrones.filter(p => p.nivel === 'critico').length * 10

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function nivelIndice(score) {
  if (score >= 80) return { label: 'Estable',  emoji: '🟢', color: '#00e676', bg: 'rgba(0,230,118,0.08)',   border: 'rgba(0,230,118,0.25)' }
  if (score >= 50) return { label: 'Atención', emoji: '🟡', color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   border: 'rgba(255,179,0,0.25)' }
  return                  { label: 'Riesgo',   emoji: '🔴', color: '#ff6b80', bg: 'rgba(255,107,128,0.08)', border: 'rgba(255,107,128,0.25)' }
}

// ── Detectar patrones repetitivos ─────────────────────────────────────────────
// Patrón: mismo tipo_incidente, ≥3 ocurrencias en 90 días,
// afectando ≥2 animales/camadas distintos O con ≥4 registros totales.

export function detectarPatrones(incidentes) {
  const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const recientes = incidentes.filter(i => i.fecha >= hace90 && !i.resuelto)

  const grupos = {}
  recientes.forEach(i => {
    const key = i.tipo_incidente || 'otro'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(i)
  })

  const patrones = []
  Object.entries(grupos).forEach(([tipo, items]) => {
    if (items.length < 3) return
    const animalesU = new Set(items.filter(i => i.animal_id).map(i => i.animal_id)).size
    const camadasU  = new Set(items.filter(i => i.camada_id).map(i => i.camada_id)).size
    const bioU      = [...new Set(items.map(i => i.bioterio_id))]
    if (animalesU >= 2 || camadasU >= 2 || items.length >= 4) {
      // Inferir categoría desde el primer ítem
      const catId = items[0]?.tipo_categoria ?? 'otro'
      patrones.push({
        tipo,
        tipoLabel: getTipoLabel(catId, tipo),
        catId,
        catInfo: getCategoriaInfo(catId),
        count: items.length,
        items,
        animalesU,
        camadasU,
        bioteriosU: bioU,
        nivel: items.length >= 5 ? 'critico' : 'alerta',
      })
    }
  })

  return patrones.sort((a, b) => b.count - a.count)
}

// ── Tendencias mensuales (últimos N meses) ────────────────────────────────────
export function generarTendencias(incidentes, meses = 6) {
  const ahora = new Date()
  const data = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-AR', { month: 'short' })
    const del = incidentes.filter(inc => inc.fecha?.startsWith(key))
    data.push({
      mes: key, label,
      total: del.length,
      graves:    del.filter(x => x.severidad === 'grave').length,
      moderados: del.filter(x => x.severidad === 'moderado').length,
      leves:     del.filter(x => x.severidad === 'leve').length,
      resueltos: del.filter(x => x.resuelto).length,
    })
  }
  const ultimo    = data[meses - 1]
  const penultimo = data[meses - 2]
  const tendencia = !penultimo || penultimo.total === 0
    ? 0
    : Math.round(((ultimo.total - penultimo.total) / penultimo.total) * 100)
  return { meses: data, tendencia }
}

// ── SQL para ejecutar en Supabase ─────────────────────────────────────────────
// (Solo referencia — no se ejecuta desde el cliente)
//
// ALTER TABLE incidentes
//   ADD COLUMN IF NOT EXISTS tipo_categoria text DEFAULT 'otro',
//   ADD COLUMN IF NOT EXISTS tipo_incidente  text DEFAULT 'otro',
//   ADD COLUMN IF NOT EXISTS severidad       text DEFAULT 'leve',
//   ADD COLUMN IF NOT EXISTS animal_id       uuid REFERENCES animales(id) ON DELETE SET NULL,
//   ADD COLUMN IF NOT EXISTS camada_id       uuid REFERENCES camadas(id)  ON DELETE SET NULL,
//   ADD COLUMN IF NOT EXISTS resuelto        boolean DEFAULT false;
