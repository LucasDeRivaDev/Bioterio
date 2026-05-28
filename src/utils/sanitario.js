// ── Categorías y tipos de incidente ──────────────────────────────────────────

export const CATEGORIAS = {
  ambiental: {
    label: 'Ambiental',
    icon: '🌡️',
    color: '#ffb300',
    tipos: [
      { id: 'temperatura_alta',  label: 'Temperatura alta' },
      { id: 'temperatura_baja',  label: 'Temperatura baja' },
      { id: 'oscilacion',        label: 'Oscilación térmica' },
      { id: 'aire',              label: 'Ventilación / Aire' },
      { id: 'calefaccion',       label: 'Calefacción' },
      { id: 'humedad',           label: 'Humedad' },
      { id: 'corte_energia',     label: 'Corte de energía' },
      { id: 'equipo',            label: 'Falla de equipo' },
      { id: 'termostato',        label: 'Termostato' },
      // backward compat — viejos registros
      { id: 'temperatura',       label: 'Temperatura fuera de rango', hidden: true },
      { id: 'ruido',             label: 'Ruido excesivo', hidden: true },
      { id: 'falla_agua',        label: 'Falla en agua', hidden: true },
      { id: 'falla_alimento',    label: 'Falla en alimento', hidden: true },
      { id: 'incidente_manejo',  label: 'Incidente de manejo', hidden: true },
      { id: 'otros',             label: 'Otros' },
    ],
  },
  sanitario: {
    label: 'Sanitario',
    icon: '🩺',
    color: '#ff6b80',
    tipos: [
      { id: 'muerte_inesperada', label: 'Mortalidad' },
      { id: 'alopecia',          label: 'Alopecia' },
      { id: 'perdida_peso',      label: 'Pérdida / bajo peso' },
      { id: 'heridas',           label: 'Heridas / peleas' },
      { id: 'hematuria',         label: 'Hematuria' },
      { id: 'canibalismo',       label: 'Canibalismo' },
      // backward compat
      { id: 'bajo_peso',         label: 'Bajo peso corporal', hidden: true },
      { id: 'otros',             label: 'Otros' },
    ],
  },
  reproductivo: {
    label: 'Reproductivo',
    icon: '🧬',
    color: '#a78bfa',
    tipos: [
      { id: 'aborto',            label: 'Aborto' },
      { id: 'no_prenez',         label: 'No preñez' },
      { id: 'malformacion',      label: 'Malformación' },
      { id: 'camada_pequeña',    label: 'Camada pequeña' },
      { id: 'muerte_neonatal',   label: 'Mortalidad neonatal' },
      { id: 'infertilidad',      label: 'Infertilidad' },
      { id: 'reabsorcion',       label: 'Reabsorción' },
      // backward compat
      { id: 'parto_fallido',     label: 'Parto fallido', hidden: true },
      { id: 'otros',             label: 'Otros' },
    ],
  },
  manejo: {
    label: 'Manejo',
    icon: '🧤',
    color: '#00e676',
    tipos: [
      { id: 'cambio_cama',       label: 'Cambio de cama' },
      { id: 'alimento',          label: 'Alimento' },
      { id: 'error_humano',      label: 'Error humano' },
      { id: 'manipulacion',      label: 'Manipulación' },
      { id: 'jaula_mal_armada',  label: 'Jaula mal armada' },
      { id: 'escape_animales',   label: 'Escape de animales' },
      { id: 'otros',             label: 'Otros' },
    ],
  },
  // backward compat — categoría crías (oculta en formulario, visible en lista)
  crias: {
    label: 'Crías',
    icon: '🐣',
    color: '#40c4ff',
    hidden: true,
    tipos: [
      { id: 'ausencia_cola',        label: 'Ausencia de cola' },
      { id: 'ausencia_extremidad',  label: 'Ausencia de extremidad' },
      { id: 'tamaño_reducido',      label: 'Tamaño muy reducido' },
      { id: 'alopecia_neonatal',    label: 'Alopecia neonatal' },
      { id: 'muerte_neonatal',      label: 'Muerte neonatal' },
      { id: 'malformacion',         label: 'Malformación' },
      { id: 'retraso_crecimiento',  label: 'Retraso de crecimiento' },
      { id: 'tamaño_asimetrico',    label: 'Crías muy pequeñas vs hermanas' },
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

// Categorías visibles en el formulario (excluye las ocultas por backward compat)
export const CATEGORIAS_FORM = Object.fromEntries(
  Object.entries(CATEGORIAS).filter(([, cat]) => !cat.hidden)
)

// Tipos visibles en el formulario (excluye hidden dentro de cada categoría)
export function getTiposForm(catId) {
  const cat = CATEGORIAS[catId]
  if (!cat) return []
  return cat.tipos.filter(t => !t.hidden)
}

// Categorías que habilitan asociación genealógica (padre / madre)
export const CATS_GENEALOGICAS = ['sanitario', 'reproductivo', 'crias']

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

// ─────────────────────────────────────────────────────────────────────────────
// ÍNDICE SANITARIO (0–100)
// ─────────────────────────────────────────────────────────────────────────────
// Penalizaciones:
//   Incidentes graves recientes (90d): −8 c/u (máx −24)
//   Incidentes moderados:              −4 c/u (máx −16)
//   Incidentes leves:                  −1 c/u (máx −5)
//   Fallos reproductivos recientes:    −5 c/u (máx −20)
//   Supervivencia < 70%:               −15
//   Supervivencia 70–85%:              −7
//   Patrones críticos detectados:      −10 por patrón
//   Mortalidad neonatal reciente:      −5 c/u (máx −15)
//   Canibalismo registrado (90d):      −7 c/u (máx −14)

export function calcularIndiceSanitario(camadas, incidentes, bioterioId) {
  let score = 100
  const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const inc = bioterioId && bioterioId !== 'todos'
    ? incidentes.filter(i => i.bioterio_id === bioterioId)
    : incidentes
  const cam = bioterioId && bioterioId !== 'todos'
    ? camadas.filter(c => c.bioterio_id === bioterioId)
    : camadas

  const recientes = inc.filter(i => i.fecha >= hace90 && !i.resuelto)
  score -= Math.min(24, recientes.filter(i => i.severidad === 'grave').length * 8)
  score -= Math.min(16, recientes.filter(i => i.severidad === 'moderado').length * 4)
  score -= Math.min(5,  recientes.filter(i => i.severidad === 'leve').length * 1)

  // Mortalidad neonatal
  const muertesNeo = recientes.filter(i => i.tipo_incidente === 'muerte_neonatal')
  score -= Math.min(15, muertesNeo.length * 5)

  // Canibalismo
  const canibalismo = recientes.filter(i => i.tipo_incidente === 'canibalismo')
  score -= Math.min(14, canibalismo.length * 7)

  // Fallos reproductivos
  const fallos = cam.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace90)
  score -= Math.min(20, fallos.length * 5)

  // Supervivencia al destete
  const conDestete = cam.filter(c => c.total_crias > 0 && c.total_destetados != null)
  if (conDestete.length > 0) {
    const sr = conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
    if (sr < 0.70) score -= 15
    else if (sr < 0.85) score -= 7
  }

  // Patrones críticos
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

// ── Tendencias mensuales ─────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR TÉRMICO — EXPOSICIÓN REAL POR TIEMPO EN RANGO
// ─────────────────────────────────────────────────────────────────────────────
// Temperatura ideal: 20–24°C | Óptimo: 22 ±2°C
//
// MODELO DE DISTRIBUCIÓN DIARIA:
//   current_temp = temperatura predominante (70% del día)
//   min_temp     = excursión fría breve, ej: 5-15 min antes de que encienda calefacción (15%)
//   max_temp     = pico cálido breve por inercia térmica / altura del sensor (15%)
//
// CLASIFICACIÓN DE ZONAS:
//   < 18°C  → frío extremo
//   18-20°C → frío leve
//   20-24°C → normal (óptimo)
//   24-26°C → calor leve
//   > 26°C  → calor extremo
//
// PENALIZACIÓN EN ÍNDICE AMBIENTAL:
//   Exposición sostenida en zona riesgo (>10%): −20 (máx −35)
//   Exposición sostenida en zona atención (>15%): −10 (máx −15)
//   Picos breves (<5% en zona riesgo): penalización mínima (−2)
//   Oscilaciones bruscas en current_temp entre días (>4°C): −5/evento (máx −15)
//   Sin datos en últimos 7 días: −25
// ─────────────────────────────────────────────────────────────────────────────

export const TEMP_RANGO = { idealMin: 20, idealMax: 24, optimo: 22 }

// Clasificación de un punto de temperatura (para display)
export function clasificarTemperatura(temp) {
  if (temp === null || temp === undefined) return { nivel: 'sin_dato', color: '#4a5f7a', label: 'Sin dato' }
  const n = Number(temp)
  if (n >= 20 && n <= 24) return { nivel: 'normal',   color: '#00e676', label: `${n}°C — Normal`   }
  if ((n >= 18 && n < 20) || (n > 24 && n <= 26)) return { nivel: 'atencion', color: '#ffb300', label: `${n}°C — Atención` }
  return                                                  { nivel: 'riesgo',   color: '#ff6b80', label: `${n}°C — Riesgo`   }
}

// Zona de temperatura (5 categorías)
function zonaTemp(t) {
  if (t == null) return null
  const n = Number(t)
  if (n < 18)  return 'frio_extremo'
  if (n < 20)  return 'frio'
  if (n <= 24) return 'normal'
  if (n <= 26) return 'calor'
  return 'calor_extremo'
}

// ── calcularExposicionTermica ─────────────────────────────────────────────────
// Calcula el tiempo acumulado estimado en cada zona térmica.
// Usa el modelo de pesos: current=70%, min=15%, max=15%.
// Si min o max son null, su peso se redistribuye a current.
//
// Retorna:
//   frio_extremo, frio, normal, calor, calor_extremo  → porcentajes (0-100)
//   totalRegistros, conDatosMinMax, confianza, zonaPredominate

export function calcularExposicionTermica(temperaturas, bioterioId, dias = 30) {
  const temps = (bioterioId && bioterioId !== 'todos'
    ? temperaturas.filter(t => t.bioterio_id === bioterioId)
    : temperaturas
  ).filter(t => t.current_temp != null)

  if (temps.length === 0) return null

  const fechaCorte = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  const recientes  = temps.filter(t => t.date >= fechaCorte)
  if (recientes.length === 0) return null

  const acum = { frio_extremo: 0, frio: 0, normal: 0, calor: 0, calor_extremo: 0 }
  let conDatosMinMax = 0

  recientes.forEach(t => {
    const tieneMin = t.min_temp != null
    const tieneMax = t.max_temp != null

    const wCurrent = tieneMin && tieneMax ? 0.70 : tieneMin || tieneMax ? 0.80 : 1.00
    const wMin     = tieneMin ? 0.15 : 0
    const wMax     = tieneMax ? 0.15 : 0

    const zCurrent = zonaTemp(t.current_temp)
    const zMin     = tieneMin ? zonaTemp(t.min_temp)  : null
    const zMax     = tieneMax ? zonaTemp(t.max_temp)  : null

    if (zCurrent) acum[zCurrent] += wCurrent
    if (zMin)     acum[zMin]     += wMin
    if (zMax)     acum[zMax]     += wMax

    if (tieneMin && tieneMax) conDatosMinMax++
  })

  const total = Object.values(acum).reduce((s, v) => s + v, 0)
  if (total === 0) return null

  // Convertir a porcentajes redondeados a 1 decimal
  const pct = {}
  Object.keys(acum).forEach(k => { pct[k] = +((acum[k] / total) * 100).toFixed(1) })

  // Zona predominante
  const zonaPred = Object.entries(pct).reduce((a, b) => b[1] > a[1] ? b : a)[0]

  // Confianza según % de registros con min+max
  const pctMinMax = recientes.length > 0 ? conDatosMinMax / recientes.length : 0
  const confianza = pctMinMax >= 0.7 ? 'alta' : pctMinMax >= 0.3 ? 'media' : 'baja'

  return {
    ...pct,
    totalRegistros: recientes.length,
    conDatosMinMax,
    confianza,
    zonaPredominante: zonaPred,
    // Grupos agrupados para display
    enRangoOptimo:   pct.normal,
    enAtencion:      +(pct.frio + pct.calor).toFixed(1),
    enRiesgo:        +(pct.frio_extremo + pct.calor_extremo).toFixed(1),
  }
}

// ── calcularIndiceAmbiental ───────────────────────────────────────────────────
// Índice 0-100 basado en EXPOSICIÓN TÉRMICA SOSTENIDA, no en picos aislados.
// Un registro con current=22°C, min=19°C, max=25°C se clasifica como:
//   70% normal + 15% atención (fría) + 15% atención (cálida) = 88% en normal/atención
//   → penalización mínima (pico breve, no exposición sostenida)

export function calcularIndiceAmbiental(temperaturas, bioterioId) {
  let score = 100

  const temps = (bioterioId && bioterioId !== 'todos'
    ? temperaturas.filter(t => t.bioterio_id === bioterioId)
    : temperaturas
  ).filter(t => t.current_temp != null)

  if (temps.length === 0) return 60

  const hace7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  // Sin datos recientes
  if (!temps.some(t => t.date >= hace7)) score -= 25

  // Calcular exposición térmica en los últimos 30 días
  const exp = calcularExposicionTermica(temperaturas, bioterioId, 30)

  if (exp) {
    // Exposición en zona de RIESGO (frio_extremo + calor_extremo)
    const pctRiesgo = exp.enRiesgo
    if (pctRiesgo > 25) score -= 35         // exposición muy sostenida → crítico
    else if (pctRiesgo > 10) score -= 20    // exposición notable → importante
    else if (pctRiesgo > 5)  score -= 10    // exposición moderada
    else if (pctRiesgo > 2)  score -= 4     // picos frecuentes pero breves
    else if (pctRiesgo > 0)  score -= 2     // pico aislado → casi no penaliza

    // Exposición en zona de ATENCIÓN (frio + calor leve)
    const pctAtencion = exp.enAtencion
    if (pctAtencion > 30)    score -= 15    // muy común → preocupante
    else if (pctAtencion > 15) score -= 8   // frecuente
    else if (pctAtencion > 5)  score -= 3   // normal dado thermostat cycling
    // <5% → no penaliza (variación normal)
  }

  // Oscilaciones bruscas en temperatura PREDOMINANTE (current_temp) entre días consecutivos
  // Solo considera current_temp, no min/max, para evitar penalizar cycling del termostato
  const recientes = [...temps.filter(t => t.date >= hace30)].sort((a, b) => a.date.localeCompare(b.date))
  let oscilaciones = 0
  for (let i = 1; i < recientes.length; i++) {
    const t1 = Number(recientes[i - 1].current_temp)
    const t2 = Number(recientes[i].current_temp)
    if (Math.abs(t2 - t1) > 3) oscilaciones++   // umbral 3°C entre días (era 4°C)
  }
  score -= Math.min(15, oscilaciones * 4)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function nivelAmbiental(score) {
  if (score >= 80) return { label: 'Estable',  emoji: '🟢', color: '#00e676', bg: 'rgba(0,230,118,0.08)',   border: 'rgba(0,230,118,0.25)' }
  if (score >= 50) return { label: 'Variable', emoji: '🟡', color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   border: 'rgba(255,179,0,0.25)' }
  return                  { label: 'Riesgo',   emoji: '🔴', color: '#ff6b80', bg: 'rgba(255,107,128,0.08)', border: 'rgba(255,107,128,0.25)' }
}

// Stats rápidos de temperatura + distribución de exposición térmica
export function statsTemperatura(temperaturas, bioterioId) {
  const temps = (bioterioId && bioterioId !== 'todos'
    ? temperaturas.filter(t => t.bioterio_id === bioterioId)
    : temperaturas
  ).filter(t => t.current_temp != null)

  if (temps.length === 0) return { promedio: null, min: null, max: null, diasRiesgo: 0, diasAtencion: 0, total: 0, exposicion: null }

  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const recientes = temps.filter(t => t.date >= hace30)
  if (recientes.length === 0) return { promedio: null, min: null, max: null, diasRiesgo: 0, diasAtencion: 0, total: 0, exposicion: null }

  // Promedio de current_temp (temperatura predominante)
  const vals = recientes.map(t => Number(t.current_temp))
  const promedio = vals.reduce((s, v) => s + v, 0) / vals.length

  // Min/max de current_temp (para mostrar el rango de mediciones del día)
  const minActual = Math.min(...vals)
  const maxActual = Math.max(...vals)

  // Días donde la current_temp (predominante) estaba fuera de rango
  let diasRiesgo = 0, diasAtencion = 0
  recientes.forEach(t => {
    const cl = clasificarTemperatura(t.current_temp)
    if (cl.nivel === 'riesgo')        diasRiesgo++
    else if (cl.nivel === 'atencion') diasAtencion++
  })

  // Exposición térmica por tiempo (modelo ponderado)
  const exposicion = calcularExposicionTermica(temperaturas, bioterioId, 30)

  return {
    promedio:  +promedio.toFixed(1),
    min:       minActual,
    max:       maxActual,
    diasRiesgo,
    diasAtencion,
    total:     recientes.length,
    exposicion,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRELACIONES TEMPERATURA → INCIDENTES / REPRODUCCIÓN
// ─────────────────────────────────────────────────────────────────────────────
// Ventanas: 1, 3, 7, 14, 30, 90 días

export function detectarCorrelaciones(temperaturas, incidentes, camadas, ventanaDias = 7) {
  const correlaciones = []

  const tempsOrdenadas = [...temperaturas]
    .filter(t => t.current_temp != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (tempsOrdenadas.length < 3) return correlaciones

  // ── Detectar períodos de calor SOSTENIDO (current_temp >24°C por ≥3 días) ──
  // Solo usa current_temp (temperatura predominante del día), NO min/max.
  // Un pico máximo aislado (inercia térmica, diferencia de altura del sensor)
  // no genera un período de calor — debe ser la temperatura predominante.
  // Se requieren ≥3 días consecutivos para considerar "período sostenido".
  const periodosCalor = []
  let inicioCalor = null
  tempsOrdenadas.forEach((t, i) => {
    if (Number(t.current_temp) > 24) {
      if (!inicioCalor) inicioCalor = t.date
    } else {
      if (inicioCalor) {
        const fin = tempsOrdenadas[i - 1].date
        const dias = Math.ceil((new Date(fin) - new Date(inicioCalor)) / 86400000) + 1
        // Mínimo 3 días sostenidos para generar correlación
        if (dias >= 3) {
          const segmento = tempsOrdenadas.filter(x => x.date >= inicioCalor && x.date <= fin)
          periodosCalor.push({
            inicio: inicioCalor, fin, dias, tipo: 'calor',
            maxTemp:  Math.max(...segmento.map(x => Number(x.current_temp))),
            maxPico:  Math.max(...segmento.map(x => x.max_temp != null ? Number(x.max_temp) : Number(x.current_temp))),
          })
        }
        inicioCalor = null
      }
    }
  })
  if (inicioCalor) {
    const fin = tempsOrdenadas[tempsOrdenadas.length - 1].date
    const dias = Math.ceil((new Date(fin) - new Date(inicioCalor)) / 86400000) + 1
    if (dias >= 3) {
      const segmento = tempsOrdenadas.filter(x => x.date >= inicioCalor && x.date <= fin)
      periodosCalor.push({
        inicio: inicioCalor, fin, dias, tipo: 'calor',
        maxTemp: Math.max(...segmento.map(x => Number(x.current_temp))),
        maxPico: Math.max(...segmento.map(x => x.max_temp != null ? Number(x.max_temp) : Number(x.current_temp))),
      })
    }
  }

  // ── Detectar períodos de frío SOSTENIDO (current_temp <19°C por ≥3 días) ──
  // Igual lógica: solo current_temp, ≥3 días.
  // Un mínimo breve de 19°C (antes de que encienda calefacción) no cuenta.
  const periodosFrio = []
  let inicioFrio = null
  tempsOrdenadas.forEach((t, i) => {
    if (Number(t.current_temp) < 19) {
      if (!inicioFrio) inicioFrio = t.date
    } else {
      if (inicioFrio) {
        const fin = tempsOrdenadas[i - 1].date
        const dias = Math.ceil((new Date(fin) - new Date(inicioFrio)) / 86400000) + 1
        if (dias >= 3) periodosFrio.push({ inicio: inicioFrio, fin, dias, tipo: 'frio' })
        inicioFrio = null
      }
    }
  })

  // ── Evaluar cada período de calor ────────────────────────────────────────
  periodosCalor.forEach(periodo => {
    const ventanaFin = new Date(new Date(periodo.fin).getTime() + ventanaDias * 86400000).toISOString().slice(0, 10)

    const incPost = incidentes.filter(i => i.fecha > periodo.fin && i.fecha <= ventanaFin)

    // Mortalidad
    const muertes = incPost.filter(i => ['muerte_inesperada', 'muerte_neonatal'].includes(i.tipo_incidente))
    if (muertes.length > 0) {
      correlaciones.push({
        tipo: 'calor_mortalidad',
        icono: '🌡️→💀',
        label: `Temperatura sostenida >24°C (${periodo.dias}d) → ↑ mortalidad`,
        descripcion: `${muertes.length} muerte(s) en los ${ventanaDias}d siguientes al período de calor sostenido (${periodo.inicio} – ${periodo.fin}, temp. predominante máx ${periodo.maxTemp}°C)`,
        nivel: muertes.length >= 3 ? 'critico' : 'alerta',
        fuerza: muertes.length >= 3 ? 'fuerte' : 'probable',
        evidencia: `${muertes.length} inc · ${periodo.dias}d calor`,
        fecha: periodo.inicio,
      })
    }

    // Fallos reproductivos
    const fallos = camadas.filter(c => c.failure_flag && (c.fecha_copula ?? '') > periodo.fin && (c.fecha_copula ?? '') <= ventanaFin)
    if (fallos.length > 0) {
      correlaciones.push({
        tipo: 'calor_infertilidad',
        icono: '🌡️→🧬',
        label: `Calor sostenido (${periodo.dias}d) → ↑ fallos reproductivos`,
        descripcion: `${fallos.length} fallo(s) reproductivo(s) en los ${ventanaDias}d siguientes al período de calor sostenido (${periodo.dias}d consecutivos con temp. predominante >24°C)`,
        nivel: fallos.length >= 2 ? 'critico' : 'alerta',
        fuerza: fallos.length >= 2 ? 'fuerte' : 'posible',
        evidencia: `${fallos.length} fallos · ${periodo.dias}d >24°C · max pico ${periodo.maxPico ?? periodo.maxTemp}°C`,
        fecha: periodo.inicio,
      })
    }

    // Baja supervivencia de camadas nacidas en ese período
    const camadasCalor = camadas.filter(c =>
      c.fecha_nacimiento > periodo.inicio &&
      c.fecha_nacimiento <= ventanaFin &&
      c.total_crias > 0 && c.total_destetados != null
    )
    const bajaSuperv = camadasCalor.filter(c => c.total_destetados / c.total_crias < 0.7)
    if (bajaSuperv.length > 0) {
      correlaciones.push({
        tipo: 'calor_supervivencia',
        icono: '🌡️→🐣',
        label: `Calor → ↓ supervivencia de crías`,
        descripcion: `${bajaSuperv.length} camada(s) con supervivencia <70% nacidas durante o post período de calor`,
        nivel: 'alerta',
        fuerza: 'posible',
        evidencia: `${bajaSuperv.length} camadas afectadas`,
        fecha: periodo.inicio,
      })
    }
  })

  // ── Evaluar períodos de frío ─────────────────────────────────────────────
  periodosFrio.forEach(periodo => {
    const ventanaFin = new Date(new Date(periodo.fin).getTime() + ventanaDias * 86400000).toISOString().slice(0, 10)
    const fallos = camadas.filter(c => c.failure_flag && (c.fecha_copula ?? '') > periodo.fin && (c.fecha_copula ?? '') <= ventanaFin)
    if (fallos.length > 0) {
      correlaciones.push({
        tipo: 'frio_infertilidad',
        icono: '❄️→🧬',
        label: `Frío sostenido (${periodo.dias}d) → ↑ fallos reproductivos`,
        descripcion: `${fallos.length} fallo(s) en los ${ventanaDias}d siguientes a temperatura predominante <19°C durante ${periodo.dias} días consecutivos (${periodo.inicio} – ${periodo.fin})`,
        nivel: 'alerta',
        fuerza: 'posible',
        evidencia: `${fallos.length} fallos`,
        fecha: periodo.inicio,
      })
    }
  })

  // ── Correlación saturación → mortalidad ──────────────────────────────────
  // Si hay > 10 camadas activas simultáneas y hay mortalidad neonatal → posible relación
  const camadasActivas = camadas.filter(c => c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)
  if (camadasActivas.length > 10) {
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const muertes30 = incidentes.filter(i => ['muerte_neonatal', 'canibalismo'].includes(i.tipo_incidente) && i.fecha >= hace30)
    if (muertes30.length >= 2) {
      correlaciones.push({
        tipo: 'saturacion_mortalidad',
        icono: '🏠→💀',
        label: `Alta densidad (${camadasActivas.length} camadas activas) → ↑ mortalidad/canibalismo`,
        descripcion: `Con ${camadasActivas.length} camadas activas simultáneas, el hacinamiento puede explicar ${muertes30.length} incidente(s) reciente(s).`,
        nivel: 'alerta',
        fuerza: 'posible',
        evidencia: `${camadasActivas.length} camadas · ${muertes30.length} inc`,
        fecha: new Date().toISOString().slice(0, 10),
      })
    }
  }

  return correlaciones.sort((a, b) => {
    const orden = { critico: 0, alerta: 1 }
    return (orden[a.nivel] ?? 2) - (orden[b.nivel] ?? 2)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR CAUSAL — ¿Por qué está pasando esto?
// ─────────────────────────────────────────────────────────────────────────────

export function generarMotorCausal(incidentes, temperaturas, camadas, animales, bioterioId) {
  const causas = []
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const hace90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)

  const incBio = bioterioId && bioterioId !== 'todos'
    ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes
  const camBio = bioterioId && bioterioId !== 'todos'
    ? camadas.filter(c => c.bioterio_id === bioterioId) : camadas
  const tempsBio = bioterioId && bioterioId !== 'todos'
    ? temperaturas.filter(t => t.bioterio_id === bioterioId) : temperaturas

  // ── Camadas con baja supervivencia ───────────────────────────────────────
  const conDestete = camBio.filter(c => c.total_crias > 0 && c.total_destetados != null && (c.fecha_nacimiento ?? '') >= hace90)
  const supervBaja = conDestete.filter(c => (c.total_destetados / c.total_crias) < 0.7)
  if (supervBaja.length >= 2) {
    const factores = []
    // Solo cuenta días donde la temp. PREDOMINANTE supera el umbral (no picos aislados)
    const tempsAltas90 = tempsBio.filter(t => t.date >= hace90 && (Number(t.current_temp) > 24))
    if (tempsAltas90.length >= 5) factores.push(`calor sostenido >24°C (${tempsAltas90.length}d temp. predominante)`)
    const cani = incBio.filter(i => i.tipo_incidente === 'canibalismo' && i.fecha >= hace90)
    if (cani.length > 0) factores.push(`canibalismo (${cani.length} registros)`)
    const camadasAct = camBio.filter(c => c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)
    if (camadasAct.length > 8) factores.push(`alta densidad (${camadasAct.length} camadas activas)`)

    causas.push({
      problema: '↓ Supervivencia de crías al destete',
      icon: '🐣',
      descripcion: `${supervBaja.length} camadas con menos del 70% de supervivencia en 90 días`,
      factores: factores.length > 0 ? factores : ['causa no determinada — revisar nidales y manejo'],
      recomendacion: 'Revisar temperatura, reducir densidad, evaluar estrés materno y calidad de nidales',
      nivel: supervBaja.length >= 4 ? 'critico' : 'alerta',
    })
  }

  // ── Infertilidad / fallos reproductivos ──────────────────────────────────
  const fallosRecientes = camBio.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace30)
  if (fallosRecientes.length >= 2) {
    const factores = []
    const tempsAltas30 = tempsBio.filter(t => t.date >= hace30 && Number(t.current_temp) > 24)
    if (tempsAltas30.length >= 3) factores.push(`temperatura ≥24°C (${tempsAltas30.length}d en 30d)`)
    const infertInc = incBio.filter(i => i.tipo_incidente === 'infertilidad' && i.fecha >= hace90)
    if (infertInc.length > 0) factores.push(`incidentes de infertilidad registrados`)
    const reproduce = animales.filter(a => a.bioterio_id === bioterioId && a.sexo === 'macho' && a.estado === 'activo')
    if (reproduce.length === 0) factores.push('posible ausencia de machos activos')

    causas.push({
      problema: '↑ Fallos reproductivos',
      icon: '🧬',
      descripcion: `${fallosRecientes.length} fallos en los últimos 30 días`,
      factores: factores.length > 0 ? factores : ['posible estrés, consanguinidad o edad avanzada de reproductores'],
      recomendacion: 'Verificar temperatura, revisar edad y genética de reproductores. Evaluar rotación de machos.',
      nivel: fallosRecientes.length >= 3 ? 'critico' : 'alerta',
    })
  }

  // ── Incidentes graves sin resolver ───────────────────────────────────────
  const gravesAbiertos = incBio.filter(i => i.severidad === 'grave' && !i.resuelto)
  if (gravesAbiertos.length >= 2) {
    const categorias = [...new Set(gravesAbiertos.map(i => CATEGORIAS[i.tipo_categoria]?.label ?? 'Otro'))]
    causas.push({
      problema: 'Incidentes graves activos sin resolver',
      icon: '🚨',
      descripcion: `${gravesAbiertos.length} incidentes graves sin atender — riesgo de escalada`,
      factores: categorias,
      recomendacion: 'Atender inmediatamente. Considerar cuarentena si hay sospecha sanitaria.',
      nivel: 'critico',
    })
  }

  // ── Patrón repetitivo (posible causa sistémica) ───────────────────────────
  const patrones = detectarPatrones(incBio)
  const patronesCriticos = patrones.filter(p => p.nivel === 'critico')
  if (patronesCriticos.length > 0) {
    const p = patronesCriticos[0]
    causas.push({
      problema: `Patrón repetitivo: ${p.tipoLabel}`,
      icon: '📈',
      descripcion: `${p.count} incidentes del mismo tipo en 90 días afectando ${p.animalesU + p.camadasU} individuos/camadas distintos`,
      factores: ['posible causa sistémica — ambiental, genética o de manejo'],
      recomendacion: 'Investigar causa raíz. Revisar procedimientos, genética de la línea y condiciones ambientales.',
      nivel: 'critico',
    })
  }

  // ── Malformaciones repetitivas ────────────────────────────────────────────
  const malformaciones = incBio.filter(i =>
    ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente) &&
    i.fecha >= hace180
  )
  if (malformaciones.length >= 3) {
    causas.push({
      problema: '↑ Malformaciones congénitas',
      icon: '⚠️',
      descripcion: `${malformaciones.length} registros de malformaciones en 180 días`,
      factores: ['posible deterioro genético por consanguinidad elevada', 'evaluar línea reproductiva'],
      recomendacion: 'Analizar genealogía y coeficiente F. Incorporar nuevos reproductores con baja consanguinidad.',
      nivel: malformaciones.length >= 5 ? 'critico' : 'alerta',
    })
  }

  return causas.sort((a, b) => {
    const ord = { critico: 0, alerta: 1 }
    return (ord[a.nivel] ?? 2) - (ord[b.nivel] ?? 2)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ÍNDICE DE RIESGO GENÉTICO (0–100)
// ─────────────────────────────────────────────────────────────────────────────
// Factores: consanguinidad + malformaciones + infertilidad + supervivencia
// fCoefMapa = Map<animalId, F> precalculado (para no importar genealogy aquí)

export function calcularIndiceRiesgoGenetico(animales, camadas, incidentes, fCoefMapa = new Map()) {
  let score = 0

  // ── Consanguinidad promedio ───────────────────────────────────────────────
  const activos = animales.filter(a => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
  if (activos.length > 0 && fCoefMapa.size > 0) {
    const fValues = activos.map(a => fCoefMapa.get(a.id) ?? 0)
    const fProm = fValues.reduce((s, f) => s + f, 0) / fValues.length
    if (fProm > 0.25) score += 35
    else if (fProm > 0.125) score += 20
    else if (fProm > 0.0625) score += 10
    else if (fProm > 0) score += 3
  }

  // ── Malformaciones (últimos 180d) ─────────────────────────────────────────
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  const malformaciones = incidentes.filter(i =>
    ['malformacion', 'ausencia_cola', 'ausencia_extremidad', 'alopecia_neonatal'].includes(i.tipo_incidente) &&
    i.fecha >= hace180
  )
  score += Math.min(25, malformaciones.length * 8)

  // ── Fallos reproductivos (últimos 90d) ────────────────────────────────────
  const hace90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const fallos = camadas.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace90)
  score += Math.min(20, fallos.length * 5)

  // ── Baja supervivencia al destete ─────────────────────────────────────────
  const conDestete = camadas.filter(c => c.total_crias > 0 && c.total_destetados != null)
  if (conDestete.length > 0) {
    const sr = conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
    if (sr < 0.70) score += 20
    else if (sr < 0.85) score += 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function nivelRiesgoGenetico(score) {
  if (score <= 20) return { label: 'Bajo',     emoji: '🟢', color: '#00e676', bg: 'rgba(0,230,118,0.08)',   border: 'rgba(0,230,118,0.25)' }
  if (score <= 50) return { label: 'Moderado', emoji: '🟡', color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   border: 'rgba(255,179,0,0.25)' }
  return                  { label: 'Alto',     emoji: '🔴', color: '#ff6b80', bg: 'rgba(255,107,128,0.08)', border: 'rgba(255,107,128,0.25)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTAS MULTI-NIVEL  🟡 Atención / 🟠 Importante / 🔴 Crítico / ⚫ Urgente
// ─────────────────────────────────────────────────────────────────────────────

export const NIVEL_ALERTA = {
  atencion:   { emoji: '🟡', label: 'Atención',   color: '#ffb300', urgencia: 1 },
  importante: { emoji: '🟠', label: 'Importante', color: '#ff9800', urgencia: 2 },
  critico:    { emoji: '🔴', label: 'Crítico',    color: '#ff6b80', urgencia: 3 },
  urgente:    { emoji: '⚫', label: 'Urgente',    color: '#e0e0e0', urgencia: 4, bgOverride: '#1a0a0a' },
}

export function generarAlertasSanitarias(incidentes, temperaturas, camadas, animales, bioterioId) {
  const alertas = []
  const hace7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const hace90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const incBio   = bioterioId && bioterioId !== 'todos' ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes
  const tempsBio = bioterioId && bioterioId !== 'todos' ? temperaturas.filter(t => t.bioterio_id === bioterioId) : temperaturas
  const camBio   = bioterioId && bioterioId !== 'todos' ? camadas.filter(c => c.bioterio_id === bioterioId) : camadas

  // ── Temperatura alta SOSTENIDA (current_temp = temperatura predominante) ──
  // Solo current_temp — no se alertan picos máximos aislados de 5-15 min.
  // Se requieren ≥3 días con temp. predominante >24°C para generar alerta real.
  const tempsAltas7 = tempsBio.filter(t => t.date >= hace7 && Number(t.current_temp) > 24)
  if (tempsAltas7.length >= 5) {
    alertas.push({ nivel: 'urgente',    icon: '🌡️', titulo: 'Temperatura predominante crítica (semana)', descripcion: `${tempsAltas7.length}d con temperatura predominante >24°C. Exposición térmica sostenida — riesgo de mortalidad neonatal e infertilidad.`, accion: 'Intervención inmediata en climatización' })
  } else if (tempsAltas7.length >= 3) {
    alertas.push({ nivel: 'critico',    icon: '🌡️', titulo: 'Calor sostenido esta semana',              descripcion: `${tempsAltas7.length}d con temperatura predominante >24°C. Monitorear reproducción y supervivencia.`, accion: 'Revisar ventilación y control térmico' })
  }
  // 1-2 días → no se alerta (puede ser variabilidad normal sin impacto real)

  // ── Frío extremo SOSTENIDO (<18°C en temperatura predominante) ────────────
  const tempsFrias7 = tempsBio.filter(t => t.date >= hace7 && Number(t.current_temp) < 18)
  if (tempsFrias7.length >= 3) {
    alertas.push({ nivel: 'critico', icon: '❄️', titulo: 'Frío sostenido (temp. predominante <18°C)', descripcion: `${tempsFrias7.length}d con temperatura predominante <18°C. Exposición prolongada — puede afectar reproducción.`, accion: 'Revisar calefacción' })
  } else if (tempsFrias7.length >= 1) {
    alertas.push({ nivel: 'importante', icon: '❄️', titulo: 'Temperatura baja detectada', descripcion: `${tempsFrias7.length}d con temperatura predominante <18°C. Si se repite, revisar calefacción.`, accion: 'Monitorear' })
  }

  // ── Incidentes graves sin resolver ────────────────────────────────────────
  const gravesAbiertos = incBio.filter(i => i.severidad === 'grave' && !i.resuelto && i.fecha >= hace30)
  if (gravesAbiertos.length >= 3) {
    alertas.push({ nivel: 'urgente',    icon: '🚨', titulo: 'Múltiples incidentes graves activos', descripcion: `${gravesAbiertos.length} incidentes graves sin resolver en 30 días.`, accion: 'Intervención inmediata — evaluar cuarentena' })
  } else if (gravesAbiertos.length >= 1) {
    alertas.push({ nivel: 'critico',    icon: '⚠️', titulo: 'Incidente grave sin resolver', descripcion: `${gravesAbiertos.length} incidente(s) grave(s) activo(s).`, accion: 'Atender urgentemente' })
  }

  // ── Fallos reproductivos frecuentes ──────────────────────────────────────
  const fallos30 = camBio.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace30)
  if (fallos30.length >= 4) {
    alertas.push({ nivel: 'urgente',    icon: '🧬', titulo: 'Alta tasa de fallos reproductivos', descripcion: `${fallos30.length} fallos en 30 días. Revisar temperatura, consanguinidad y estrés.`, accion: 'Suspender apareamientos temporalmente' })
  } else if (fallos30.length >= 2) {
    alertas.push({ nivel: 'importante', icon: '🧬', titulo: 'Fallos reproductivos frecuentes',   descripcion: `${fallos30.length} fallos en 30 días.`, accion: 'Evaluar reproductores y condiciones ambientales' })
  }

  // ── Mortalidad neonatal ────────────────────────────────────────────────────
  const muertesNeo30 = incBio.filter(i => i.tipo_incidente === 'muerte_neonatal' && i.fecha >= hace30 && !i.resuelto)
  if (muertesNeo30.length >= 3) {
    alertas.push({ nivel: 'critico', icon: '🐣', titulo: '↑ Mortalidad neonatal', descripcion: `${muertesNeo30.length} muertes neonatales en 30 días.`, accion: 'Revisar temperatura, densidad y calidad de madres' })
  }

  // ── Canibalismo ────────────────────────────────────────────────────────────
  const canibal30 = incBio.filter(i => i.tipo_incidente === 'canibalismo' && i.fecha >= hace30)
  if (canibal30.length >= 2) {
    alertas.push({ nivel: 'critico', icon: '⚠️', titulo: 'Canibalismo recurrente', descripcion: `${canibal30.length} episodios de canibalismo en 30 días. Indicador de estrés severo.`, accion: 'Reducir densidad, revisar temperatura y manejo' })
  }

  // ── Patrón crítico ─────────────────────────────────────────────────────────
  const patrones = detectarPatrones(incBio)
  const patronesCriticos = patrones.filter(p => p.nivel === 'critico')
  patronesCriticos.forEach(p => {
    alertas.push({ nivel: 'importante', icon: '📈', titulo: `Patrón repetitivo: ${p.tipoLabel}`, descripcion: `${p.count} registros en 90 días — posible causa sistémica.`, accion: 'Investigar causa subyacente' })
  })

  // ── Malformaciones ─────────────────────────────────────────────────────────
  const malform90 = incBio.filter(i => ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente) && i.fecha >= hace90)
  if (malform90.length >= 3) {
    alertas.push({ nivel: 'importante', icon: '🔬', titulo: '↑ Malformaciones congénitas', descripcion: `${malform90.length} en 90 días — posible deterioro genético.`, accion: 'Evaluar consanguinidad. Incorporar reproductores nuevos.' })
  }

  return alertas.sort((a, b) =>
    (NIVEL_ALERTA[b.nivel]?.urgencia ?? 0) - (NIVEL_ALERTA[a.nivel]?.urgencia ?? 0)
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ¿QUÉ HACER HOY?  — Motor de recomendaciones diarias
// ─────────────────────────────────────────────────────────────────────────────

export function generarRecomendacionesHoy(incidentes, temperaturas, camadas, animales, bioterioId) {
  const recomendaciones = []
  const hoy  = new Date().toISOString().slice(0, 10)
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const incBio   = bioterioId && bioterioId !== 'todos' ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes
  const tempsBio = bioterioId && bioterioId !== 'todos' ? temperaturas.filter(t => t.bioterio_id === bioterioId) : temperaturas
  const camBio   = bioterioId && bioterioId !== 'todos' ? camadas.filter(c => c.bioterio_id === bioterioId) : camadas

  // 1. Incidentes graves sin resolver
  const gravesAbiertos = incBio.filter(i => i.severidad === 'grave' && !i.resuelto)
  if (gravesAbiertos.length > 0) {
    recomendaciones.push({ prioridad: 'urgente', icono: '🚨', accion: `Atender ${gravesAbiertos.length} incidente(s) grave(s) sin resolver`, motivo: 'Riesgo activo sin resolución' })
  }

  // 2. Sin registro de temperatura hoy
  const tempHoy = tempsBio.find(t => t.date === hoy)
  if (!tempHoy) {
    recomendaciones.push({ prioridad: 'alta', icono: '🌡️', accion: 'Registrar temperatura del bioterio hoy', motivo: 'Sin registro de temperatura en el día actual' })
  }

  // 3. Calor sostenido esta semana (≥3 días con temp. predominante >24°C)
  const tempsAltas = tempsBio.filter(t => t.date >= hace7 && Number(t.current_temp) > 24)
  if (tempsAltas.length >= 3) {
    recomendaciones.push({ prioridad: 'alta', icono: '🌡️', accion: 'Verificar y ajustar sistema de ventilación/refrigeración', motivo: `${tempsAltas.length}d con temperatura predominante >24°C esta semana (exposición sostenida)` })
  }

  // 4. Camadas vencidas (>28d sin destetar)
  const camadasVencidas = camBio.filter(c => {
    if (!c.fecha_nacimiento || c.fecha_destete || c.failure_flag) return false
    const dias = Math.floor((Date.now() - new Date(c.fecha_nacimiento).getTime()) / 86400000)
    return dias > 28
  })
  if (camadasVencidas.length > 0) {
    recomendaciones.push({ prioridad: 'alta', icono: '🐣', accion: `Destetar ${camadasVencidas.length} camada(s) — pasaron la edad de destete`, motivo: 'Crías con más de 28 días sin destetar' })
  }

  // 5. Fallos reproductivos recientes
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const fallos30 = camBio.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace30)
  if (fallos30.length >= 2) {
    recomendaciones.push({ prioridad: 'media', icono: '🧬', accion: 'Revisar estado sanitario de reproductores activos', motivo: `${fallos30.length} fallos reproductivos en los últimos 30 días` })
  }

  // 6. Incidentes moderados sin resolver (>3)
  const modSinResolver = incBio.filter(i => i.severidad === 'moderado' && !i.resuelto)
  if (modSinResolver.length >= 3) {
    recomendaciones.push({ prioridad: 'media', icono: '⚠️', accion: `Revisar ${modSinResolver.length} incidentes moderados pendientes`, motivo: 'Acumulación de incidentes sin resolver' })
  }

  // 7. Todo estable
  if (gravesAbiertos.length === 0 && camadasVencidas.length === 0 && tempsAltas.length === 0) {
    recomendaciones.push({ prioridad: 'info', icono: '✅', accion: 'Monitoreo rutinario — colonia estable', motivo: 'Sin alertas activas' })
  }

  const orden = { urgente: 0, alta: 1, media: 2, info: 3 }
  return recomendaciones.sort((a, b) => (orden[a.prioridad] ?? 99) - (orden[b.prioridad] ?? 99))
}

// ─────────────────────────────────────────────────────────────────────────────
// ÍNDICE DE ESTABILIDAD GLOBAL DE COLONIA (0–100)
// Compuesto de: sanitario + ambiental + genético + reproductivo
// ─────────────────────────────────────────────────────────────────────────────

export function calcularIndiceEstabilidadGlobal({
  indiceSanitario,
  indiceAmbiental,
  indiceRiesgoGenetico,   // 0=bajo riesgo → bueno, 100=alto riesgo → malo
  tasaFallos,             // 0.0–1.0
  tasaSupervivencia,      // 0.0–1.0
}) {
  // Sanitario: 35% del score
  const compSanitario = indiceSanitario * 0.35

  // Ambiental: 25%
  const compAmbiental = indiceAmbiental * 0.25

  // Genético: invertido (bajo riesgo = buen score): 20%
  const compGenetico = (100 - indiceRiesgoGenetico) * 0.20

  // Reproductivo (supervivencia + tasa de éxito): 20%
  const exitoRep = 1 - (tasaFallos ?? 0)
  const compRepro = ((tasaSupervivencia ?? 0.85) * 0.5 + exitoRep * 0.5) * 100 * 0.20

  return Math.max(0, Math.min(100, Math.round(compSanitario + compAmbiental + compGenetico + compRepro)))
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRELACIONES MULTI-VENTANA  (1, 3, 7, 14, 30, 90 días)
// Corre detectarCorrelaciones con cada ventana y desduplicar por tipo+fecha
// quedándose con la detección más precisa (ventana más corta).
// ─────────────────────────────────────────────────────────────────────────────

export function detectarCorrelacionesMultiventana(temperaturas, incidentes, camadas) {
  const ventanas = [1, 3, 7, 14, 30, 90]
  const todas = []
  ventanas.forEach(v => {
    detectarCorrelaciones(temperaturas, incidentes, camadas, v)
      .forEach(c => todas.push({ ...c, ventana: v }))
  })
  // Si el mismo tipo+fecha aparece en múltiples ventanas → quedarse con la más corta
  const dedup = new Map()
  todas.forEach(c => {
    const key = `${c.tipo}_${c.fecha}`
    if (!dedup.has(key) || c.ventana < dedup.get(key).ventana) dedup.set(key, c)
  })
  return [...dedup.values()].sort((a, b) => {
    const orden = { critico: 0, alerta: 1 }
    return (orden[a.nivel] ?? 2) - (orden[b.nivel] ?? 2)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUEOS SANITARIOS — ¿Qué animales/líneas no deberían reproducirse?
// ─────────────────────────────────────────────────────────────────────────────
// Evalúa reproductores activos y detecta cuáles presentan riesgo crítico
// (consanguinidad alta, fallos repetidos, malformaciones, edad límite).
// Retorna un Map para consulta rápida desde CamadaForm + lista de acciones
// automáticas a aplicar sobre renovación/apareamientos/pedidos.

export function generarBloqueosSanitarios(animales, camadas, incidentes, fCoefMapa = new Map(), bioterioId) {
  const animalesBloqueados = new Map() // Map<animalId, {animal,motivos,nivel,esBloqueo,accion}>
  const lineaEnRiesgo      = []
  const accionesSugeridas  = []

  const hace90  = new Date(Date.now() -  90 * 86400000).toISOString().slice(0, 10)
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)

  const activos = animales.filter(a =>
    ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado) &&
    (!bioterioId || bioterioId === 'todos' || a.bioterio_id === bioterioId)
  )

  activos.forEach(animal => {
    const motivos = []
    let nivelMax = null
    const subirNivel = (n) => { if (!nivelMax || n === 'critico') nivelMax = n }

    // ── Consanguinidad (F de Wright) ─────────────────────────────────────────
    const f = fCoefMapa.get(animal.id) ?? 0
    if (f > 0.25) {
      motivos.push(`consanguinidad muy alta (F=${(f * 100).toFixed(1)}%)`)
      subirNivel('critico')
    } else if (f > 0.125) {
      motivos.push(`consanguinidad moderada (F=${(f * 100).toFixed(1)}%)`)
      subirNivel('alerta')
    }

    // ── Fallos reproductivos repetidos (hembras) ──────────────────────────────
    if (animal.sexo === 'hembra') {
      const fallos = camadas.filter(c =>
        c.id_madre === animal.id && c.failure_flag && (c.fecha_copula ?? '') >= hace90
      )
      if (fallos.length >= 3) {
        motivos.push(`${fallos.length} fallos reproductivos en 90 días`)
        subirNivel('critico')
      } else if (fallos.length >= 2) {
        motivos.push(`${fallos.length} fallos reproductivos recientes`)
        subirNivel('alerta')
      }
    }

    // ── Malformaciones en camadas del animal ──────────────────────────────────
    const camadasAnimal = animal.sexo === 'hembra'
      ? camadas.filter(c => c.id_madre === animal.id && (c.fecha_nacimiento ?? '') >= hace180)
      : camadas.filter(c => c.id_padre === animal.id && (c.fecha_nacimiento ?? '') >= hace180)

    const conMalf = camadasAnimal.filter(c =>
      incidentes.some(i =>
        i.camada_id === c.id &&
        ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente)
      )
    )
    if (conMalf.length >= 2) {
      motivos.push(`${conMalf.length} camadas con malformaciones registradas`)
      subirNivel('critico')
    } else if (conMalf.length === 1) {
      motivos.push('camada con malformaciones detectadas')
      subirNivel('alerta')
    }

    // ── Edad límite reproductiva ──────────────────────────────────────────────
    if (animal.fecha_nacimiento) {
      const edadDias = Math.floor((Date.now() - new Date(animal.fecha_nacimiento).getTime()) / 86400000)
      if (animal.sexo === 'macho' && edadDias > 270) {
        motivos.push(`edad reproductiva superada (${edadDias}d, límite 270d)`)
        subirNivel('critico')
      } else if (animal.sexo === 'hembra' && edadDias > 365) {
        motivos.push(`edad avanzada para reproducción (${edadDias}d)`)
        subirNivel('alerta')
      }
    }

    if (motivos.length > 0 && nivelMax) {
      const esBloqueo = nivelMax === 'critico'
      animalesBloqueados.set(animal.id, {
        animal,
        motivos,
        nivel: nivelMax,
        esBloqueo,
        accion: esBloqueo
          ? 'Excluir de nuevos apareamientos'
          : 'Usar con precaución — monitorear resultado',
      })
    }
  })

  // ── Construir lineaEnRiesgo + accionesSugeridas ───────────────────────────
  animalesBloqueados.forEach(b => {
    if (b.esBloqueo) {
      lineaEnRiesgo.push({ codigo: b.animal.codigo, animal: b.animal, nivel: b.nivel, motivos: b.motivos })
      accionesSugeridas.push({
        tipo: 'bloqueo_animal',
        target: b.animal.codigo,
        accion: `Excluir ${b.animal.codigo} — ${b.motivos[0]}`,
        nivel: 'critico',
        prioridad: 0,
      })
    }
  })

  const criticos = [...animalesBloqueados.values()].filter(b => b.esBloqueo)

  if (criticos.length > 0) {
    accionesSugeridas.push({
      tipo: 'renovacion',
      target: 'colonia',
      accion: `Incorporar ${criticos.length} reemplazos — ${criticos.length} reproductor(es) en riesgo crítico`,
      nivel: 'critico',
      prioridad: 1,
    })
  }

  // Si >30% de los reproductores están bloqueados → suspender nuevos apareamientos
  if (activos.length > 0 && criticos.length / activos.length > 0.3) {
    accionesSugeridas.push({
      tipo: 'suspender_apareamientos',
      target: 'colonia',
      accion: `Suspender nuevos apareamientos — ${Math.round(criticos.length / activos.length * 100)}% de reproductores en riesgo`,
      nivel: 'urgente',
      prioridad: 0,
    })
  }

  return {
    animalesBloqueados,
    lineaEnRiesgo: lineaEnRiesgo.sort((a, b) => a.codigo.localeCompare(b.codigo)),
    accionesSugeridas: accionesSugeridas.sort((a, b) => a.prioridad - b.prioridad),
    totalBloqueados:    criticos.length,
    totalAdvertencias:  [...animalesBloqueados.values()].filter(b => !b.esBloqueo).length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR CAUSAL COMPLETO — 6 factores multidimensionales
// Temperatura · Consanguinidad · Saturación · Genética · Renovación · Incidentes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extiende generarMotorCausal con factores genéticos (fCoefMapa),
 * saturación+mortalidad y renovación con reproductores viejos+fallos.
 * @param {Map<string,number>} fCoefMapa  Map<animalId, F> precalculado
 */
export function generarMotorCausalCompleto(
  incidentes, temperaturas, camadas, animales, bioterioId,
  fCoefMapa = new Map()
) {
  const causas = generarMotorCausal(incidentes, temperaturas, camadas, animales, bioterioId)

  const hace30  = new Date(Date.now() - 30  * 86400000).toISOString().slice(0, 10)
  const hace90  = new Date(Date.now() - 90  * 86400000).toISOString().slice(0, 10)
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)

  const incBio  = bioterioId && bioterioId !== 'todos' ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes
  const camBio  = bioterioId && bioterioId !== 'todos' ? camadas.filter(c => c.bioterio_id === bioterioId) : camadas
  const animBio = bioterioId && bioterioId !== 'todos' ? animales.filter(a => a.bioterio_id === bioterioId) : animales

  // ── Factor genético: consanguinidad real × malformaciones ─────────────────
  if (fCoefMapa.size > 0) {
    const activos = animBio.filter(a => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
    const fValues = activos.map(a => fCoefMapa.get(a.id) ?? 0)
    const fProm   = fValues.length > 0 ? fValues.reduce((s, f) => s + f, 0) / fValues.length : 0

    const malform180 = incBio.filter(i =>
      ['malformacion', 'ausencia_cola', 'ausencia_extremidad', 'alopecia_neonatal'].includes(i.tipo_incidente) &&
      i.fecha >= hace180
    )

    if (fProm >= 0.125 && malform180.length >= 2 && !causas.some(c => c.accion === 'bloquear_cruzas')) {
      causas.push({
        problema: '↑ Consanguinidad + malformaciones — deterioro genético progresivo',
        icon: '🧬',
        descripcion: `F promedio activos: ${(fProm * 100).toFixed(1)}% · ${malform180.length} malformaciones en 180d`,
        factores: [
          `Consanguinidad promedio: ${(fProm * 100).toFixed(1)}% (${fProm >= 0.25 ? 'muy alta' : 'moderada'})`,
          `${malform180.length} malformaciones congénitas en 180 días`,
          'Combinación indica depresión consanguínea en progreso',
        ],
        recomendacion: 'Incorporar animales de baja consanguinidad. Evitar cruzas entre relacionados hasta F < 6.25%. Revisar pedigree de reproductores activos.',
        accion: 'bloquear_cruzas',
        nivel: fProm >= 0.25 ? 'critico' : 'alerta',
      })
    }
  }

  // ── Factor saturación + mortalidad → reducir producción ───────────────────
  const camadasActivas = camBio.filter(c => c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)
  const muertes30 = incBio.filter(i =>
    ['muerte_neonatal', 'canibalismo'].includes(i.tipo_incidente) && i.fecha >= hace30
  )
  if (camadasActivas.length > 10 && muertes30.length >= 3 && !causas.some(c => c.accion === 'reducir_produccion')) {
    causas.push({
      problema: '↑ Saturación + ↑ mortalidad — reducir producción',
      icon: '🏠',
      descripcion: `${camadasActivas.length} camadas activas · ${muertes30.length} muertes/canibalismo en 30d`,
      factores: [
        `Alta densidad: ${camadasActivas.length} camadas activas simultáneas`,
        `${muertes30.length} eventos de mortalidad o canibalismo en 30 días`,
        'Hacinamiento reduce supervivencia y bienestar animal',
      ],
      recomendacion: 'Reducir producción: pausar nuevos apareamientos hasta bajar la densidad. Revisar capacidad máxima de instalaciones.',
      accion: 'reducir_produccion',
      nivel: camadasActivas.length > 15 || muertes30.length >= 5 ? 'critico' : 'alerta',
    })
  }

  // ── Factor renovación: reproductores viejos + fallos recientes ────────────
  const ALERTA_EDAD = 240
  const hoyDt = new Date()
  hoyDt.setHours(0, 0, 0, 0)
  const reprosViejos = animBio.filter(a => {
    if (!['activo', 'en_apareamiento', 'en_cria'].includes(a.estado) || !a.fecha_nacimiento) return false
    return Math.floor((hoyDt - new Date(a.fecha_nacimiento)) / 86400000) >= ALERTA_EDAD
  })
  const fallos90 = camBio.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace90)
  if (reprosViejos.length >= 2 && fallos90.length >= 2) {
    causas.push({
      problema: '↑ Reproductores en edad límite + ↑ fallos — renovar línea',
      icon: '♻️',
      descripcion: `${reprosViejos.length} reproductores ≥ ${ALERTA_EDAD}d · ${fallos90.length} fallos en 90d`,
      factores: [
        `${reprosViejos.length} reproductores con ${ALERTA_EDAD}+ días de vida`,
        `${fallos90.length} fallos reproductivos en 90 días`,
        'Declive reproductivo asociado a edad y agotamiento de línea',
      ],
      recomendacion: 'Promover candidatos jóvenes de baja consanguinidad desde stock. Retirar reproductores que superen el límite de edad.',
      accion: 'renovar',
      nivel: 'alerta',
    })
  }

  return causas.sort((a, b) => {
    const ord = { critico: 0, alerta: 1 }
    return (ord[a.nivel] ?? 2) - (ord[b.nivel] ?? 2)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERIORO PROGRESIVO — Ventanas 30 / 60 / 90 / 180 / 365 días
// Detecta deterioro reproductivo progresivo interpretando el contexto biológico activo.
// NO asume que ausencia de partos = fracaso. Primero evalúa si hay gestaciones en curso,
// apareamientos activos o partos pendientes antes de concluir deterioro.
//
// @param animales  — lista de animales del bioterio (para evaluar contexto activo)
// @param bio       — parámetros biológicos de la especie (para ventana de gestación)
// ─────────────────────────────────────────────────────────────────────────────

export function detectarDeterioroProgresivo(camadas, incidentes, bioterioId, animales = [], bio = null) {
  // Ventana de gestación para distinguir "en espera" de "demorado"
  const GESTACION_MAX = bio?.GESTACION_MAX ?? 26  // días máximo normal (con margen)

  const VENTANAS = [30, 60, 90, 180, 365]
  const hoy    = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyStr = hoy.toISOString().slice(0, 10)

  const camBio  = bioterioId && bioterioId !== 'todos' ? camadas.filter(c => c.bioterio_id === bioterioId)  : camadas
  const incBio  = bioterioId && bioterioId !== 'todos' ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes
  const animBio = bioterioId && bioterioId !== 'todos' ? animales.filter(a => a.bioterio_id === bioterioId)  : animales

  // ── Contexto reproductivo activo HOY ───────────────────────────────────────
  const apareamientosActivos = animBio.filter(a => a.estado === 'en_apareamiento').length
  const lactanciasActivas    = animBio.filter(a => a.estado === 'en_cria').length
  // Partos pendientes = camadas con cópula, sin nacimiento, sin fallo
  const partosPendientes     = camBio.filter(c => c.fecha_copula && !c.fecha_nacimiento && !c.failure_flag).length
  // Destetes pendientes = nacieron pero aún no se destetaron
  const destesPendientes     = camBio.filter(c => c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag).length

  // ── Calcular métricas por ventana temporal ─────────────────────────────────
  const resultadoObj = {}
  const resultadoArr = []

  for (const dias of VENTANAS) {
    const desde = new Date(hoy.getTime() - dias * 86400000).toISOString().slice(0, 10)

    const camPer = camBio.filter(c => (c.fecha_copula ?? '') >= desde && (c.fecha_copula ?? '') <= hoyStr)
    const incPer = incBio.filter(i => i.fecha >= desde && i.fecha <= hoyStr)

    const conParto = camPer.filter(c => c.fecha_nacimiento && !c.failure_flag)
    const conFallo = camPer.filter(c => c.failure_flag)
    const totalCam = camPer.filter(c => c.fecha_copula).length

    // Apareamientos que TODAVÍA están dentro de la ventana normal de gestación
    // → no cuentan como fallo, su resultado aún es incierto
    const enEsperaVigentes = camPer.filter(c => {
      if (c.fecha_nacimiento || c.failure_flag) return false
      const ms = hoy - new Date(c.fecha_copula)
      const diasDesde = Math.floor(ms / 86400000)
      return diasDesde <= GESTACION_MAX
    })

    // Apareamientos que pasaron el máximo sin parto ni fallo registrado
    const enEsperaDemoradas = camPer.filter(c => {
      if (c.fecha_nacimiento || c.failure_flag) return false
      const ms = hoy - new Date(c.fecha_copula)
      const diasDesde = Math.floor(ms / 86400000)
      return diasDesde > GESTACION_MAX
    })

    // Completadas = tuvieron parto confirmado O fallo confirmado (resultado conocido)
    const camadasCompletadas = conParto.length + conFallo.length

    // Fertilidad REAL: solo sobre completadas. No incluir "en espera" como fracaso.
    const fertilidadReal = camadasCompletadas >= 2
      ? conParto.length / camadasCompletadas
      : null  // datos insuficientes → indeterminado

    // Confianza de la métrica de fertilidad para esta ventana
    let confianza, contexto
    if (camadasCompletadas >= 4) {
      confianza = 'alta'
      contexto  = null
    } else if (camadasCompletadas >= 2) {
      confianza = 'media'
      contexto  = enEsperaVigentes.length > 0
        ? `${enEsperaVigentes.length} gestación(es) activa(s) — resultado aún pendiente`
        : null
    } else if (camadasCompletadas === 1) {
      confianza = 'baja'
      contexto  = enEsperaVigentes.length > 0
        ? `Solo 1 completada — ${enEsperaVigentes.length} gestando actualmente`
        : 'Pocos eventos — interpretación limitada'
    } else {
      // 0 completadas
      if (enEsperaVigentes.length > 0) {
        confianza = 'espera'
        contexto  = `${enEsperaVigentes.length} parto(s) en espera — sin datos suficientes aún`
      } else if (enEsperaDemoradas.length > 0) {
        confianza = 'baja'
        contexto  = `${enEsperaDemoradas.length} apareamiento(s) demorado(s) — verificar estado`
      } else if (totalCam > 0) {
        confianza = 'baja'
        contexto  = 'Sin resultado registrado en este período'
      } else {
        confianza = 'sin_datos'
        contexto  = 'Sin apareamientos en este período'
      }
    }

    const conDestete   = conParto.filter(c => c.total_crias > 0 && c.total_destetados != null)
    const supervivencia = conDestete.length >= 2
      ? conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
      : null

    const mortalidadNeo  = incPer.filter(i => i.tipo_incidente === 'muerte_neonatal').length
    const malformaciones = incPer.filter(i =>
      ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente)
    ).length
    const fallos = conFallo.length

    const entry = {
      dias, desde,
      fertilidad:        fertilidadReal,   // solo sobre completadas
      confianza,
      contexto,
      supervivencia,
      mortalidadNeo,
      malformaciones,
      fallos,
      totalCamadas:      totalCam,
      camadasCompletadas,
      enEsperaVigentes:  enEsperaVigentes.length,
      enEsperaDemoradas: enEsperaDemoradas.length,
    }
    resultadoObj[dias] = entry
    resultadoArr.push(entry)
  }

  const v30  = resultadoObj[30]
  const v90  = resultadoObj[90]
  const v180 = resultadoObj[180]

  // ── SEÑAL 1: Fertilidad deteriorando ──────────────────────────────────────
  // Solo aplica si AMBAS ventanas tienen suficientes completadas Y no hay gestaciones
  // activas que expliquen el descenso reciente (serían las "en espera vigentes")
  const fertilidadDet = (
    v30.fertilidad !== null && v180.fertilidad !== null &&
    v30.camadasCompletadas >= 2 && v180.camadasCompletadas >= 2 &&
    v30.fertilidad < v180.fertilidad - 0.10 &&
    v30.enEsperaVigentes === 0   // no hay gestaciones activas en ese período
  )

  // ── SEÑAL 2: Mortalidad neonatal acelerándose ──────────────────────────────
  const mortalidadSube = v90.mortalidadNeo > 0 && v30.mortalidadNeo > v90.mortalidadNeo / 3

  // ── SEÑAL 3: Malformaciones creciendo ─────────────────────────────────────
  const malformCrece = v90.malformaciones > 0 && v30.malformaciones > v90.malformaciones / 3

  // Señales como array de strings (para poder mapear en UI)
  const señalesActivas = []
  if (fertilidadDet)   señalesActivas.push('Fertilidad en descenso — diferencia >10% entre 30d y 180d')
  if (mortalidadSube)  señalesActivas.push('Mortalidad neonatal en aumento — ritmo 30d supera media 90d')
  if (malformCrece)    señalesActivas.push('Malformaciones congénitas en aumento')

  const tieneDeterioro = señalesActivas.length >= 2 ||
    (señalesActivas.length >= 1 && v30.fallos >= 2)

  // ── Confianza global (basada en ventana 30d) ───────────────────────────────
  const confianzaGlobal = v30.camadasCompletadas >= 4 ? 'alta'
    : v30.camadasCompletadas >= 2 ? 'media'
    : v30.enEsperaVigentes > 0 ? 'baja'
    : 'sin_datos'

  // ── Hay actividad reproductiva activa HOY ─────────────────────────────────
  const hayContextoActivo = apareamientosActivos > 0 || lactanciasActivas > 0 || partosPendientes > 0

  // ── Resumen contextual (no alarmista, refleja estado biológico real) ───────
  let resumen
  if (!tieneDeterioro) {
    if (hayContextoActivo) {
      const partes = []
      if (partosPendientes > 0)   partes.push(`${partosPendientes} parto(s) en espera`)
      if (lactanciasActivas > 0)  partes.push(`${lactanciasActivas} hembra(s) en cría`)
      if (apareamientosActivos > 0) partes.push(`${apareamientosActivos} apareamiento(s) activo(s)`)
      resumen = `Actividad reproductiva continúa — ${partes.join(' · ')}`
    } else if (v30.enEsperaVigentes > 0) {
      resumen = `${v30.enEsperaVigentes} parto(s) esperado(s) — actividad normal`
    } else if (v30.totalCamadas === 0) {
      resumen = 'Sin apareamientos en los últimos 30 días'
    } else {
      resumen = 'Sin señales de deterioro reproductivo'
    }
  } else {
    resumen = `Deterioro detectado: ${señalesActivas.length} señal(es) activa(s) — ${señalesActivas[0]}`
  }

  // ── Ventana más corta con valores preocupantes ─────────────────────────────
  const ventanaSignificativa = [30, 60, 90].find(v => {
    const d = resultadoObj[v]
    return (d.fertilidad !== null && d.camadasCompletadas >= 2 && d.fertilidad < 0.60) ||
           d.mortalidadNeo >= 3 || d.malformaciones >= 3
  }) ?? null

  return {
    ventanas:            resultadoArr,   // array — para .map() en UI
    ventanasObj:         resultadoObj,   // objeto — para acceso por clave
    tieneDeterioro,
    ventanaSignificativa,
    señalesActivas,                      // array de strings
    patron: tieneDeterioro
      ? `Deterioro progresivo — ${señalesActivas.join(' · ').toLowerCase()}`
      : null,
    nivel: tieneDeterioro
      ? (ventanaSignificativa && ventanaSignificativa <= 60 ? 'critico' : 'alerta')
      : 'ok',
    confianzaGlobal,
    resumen,
    hayContextoActivo,
    contextoActivo: { apareamientosActivos, lactanciasActivas, partosPendientes, destesPendientes },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISIONES CONCRETAS HOY — Motor multifactorial de acciones
// Cruza los 6 factores y produce acciones priorizadas y específicas
// ─────────────────────────────────────────────────────────────────────────────

export function generarDecisionesHoy(
  incidentes, temperaturas, camadas, animales, bioterioId,
  fCoefMapa = new Map(),
  candidatosRenovacion = [],
  saturacion = null
) {
  const decisiones = []
  const hoy    = new Date().toISOString().slice(0, 10)
  const hace7  = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10)
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const hace90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const incBio  = bioterioId && bioterioId !== 'todos' ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes
  const camBio  = bioterioId && bioterioId !== 'todos' ? camadas.filter(c => c.bioterio_id === bioterioId) : camadas
  const animBio = bioterioId && bioterioId !== 'todos' ? animales.filter(a => a.bioterio_id === bioterioId) : animales
  const tempBio = bioterioId && bioterioId !== 'todos' ? temperaturas.filter(t => t.bioterio_id === bioterioId) : temperaturas

  // 0. URGENTE: incidentes graves sin resolver
  const gravesAbiertos = incBio.filter(i => i.severidad === 'grave' && !i.resuelto)
  if (gravesAbiertos.length > 0) {
    decisiones.push({ prioridad: 0, nivel: 'urgente', icono: '🚨', tipo: 'sanitario',
      accion: `Atender ${gravesAbiertos.length} incidente(s) grave(s) sin resolver`,
      motivo: 'Riesgo activo sin resolución — puede escalar',
    })
  }

  // 1. CRÍTICO: consanguinidad alta → bloquear cruzas
  if (fCoefMapa.size > 0) {
    const activos  = animBio.filter(a => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
    const fValues  = activos.map(a => fCoefMapa.get(a.id) ?? 0).filter(f => f > 0)
    const fProm    = fValues.length > 0 ? fValues.reduce((s, f) => s + f, 0) / fValues.length : 0
    const malform90 = incBio.filter(i =>
      ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente) && i.fecha >= hace90
    )
    if (fProm >= 0.25 || (fProm >= 0.125 && malform90.length >= 2)) {
      decisiones.push({ prioridad: 1, nivel: 'critico', icono: '🧬', tipo: 'genetico',
        accion: `Evitar nuevas cruzas entre reproductores relacionados (F=${(fProm * 100).toFixed(1)}%)`,
        motivo: `Consanguinidad ${fProm >= 0.25 ? 'muy alta' : 'moderada'} + ${malform90.length} malformaciones en 90d`,
      })
    }
  }

  // 2. CRÍTICO: temperatura fuera de rango prolongada
  // Usa current_temp (temp. predominante) — no picos breves de max_temp
  const tempsAltas7 = tempBio.filter(t => t.date >= hace7 && Number(t.current_temp) > 24)
  if (tempsAltas7.length >= 3) {
    decisiones.push({ prioridad: 1, nivel: 'critico', icono: '🌡️', tipo: 'ambiental',
      accion: `Intervenir en climatización — temperatura sostenida >24°C (${tempsAltas7.length}d)`,
      motivo: `${tempsAltas7.length}d esta semana con temperatura predominante >24°C (exposición sostenida, no picos breves)`,
    })
  } else if (!tempBio.find(t => t.date === hoy)) {
    decisiones.push({ prioridad: 3, nivel: 'atencion', icono: '🌡️', tipo: 'ambiental',
      accion: 'Registrar temperatura del bioterio hoy',
      motivo: 'Sin dato de temperatura en el día actual',
    })
  }

  // 3. CRÍTICO: saturación + mortalidad → reducir producción
  const camadasActivas = camBio.filter(c => c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)
  const muertes30 = incBio.filter(i => ['muerte_neonatal', 'canibalismo'].includes(i.tipo_incidente) && i.fecha >= hace30)
  if (camadasActivas.length > 10 && muertes30.length >= 3) {
    decisiones.push({ prioridad: 1, nivel: 'critico', icono: '🏠', tipo: 'saturacion',
      accion: 'Reducir producción — pausar nuevos apareamientos por alta densidad',
      motivo: `${camadasActivas.length} camadas activas · ${muertes30.length} muertes/canibalismo en 30d`,
    })
  } else if (saturacion?.esSignificativo) {
    decisiones.push({ prioridad: 2, nivel: 'importante', icono: '📊', tipo: 'saturacion',
      accion: 'Evaluar reducción del ritmo de producción — superávit detectado',
      motivo: 'Superávit puede sobrecargar instalaciones en el próximo ciclo',
    })
  }

  // 4. IMPORTANTE: reproductores viejos + fallos → renovar
  const ALERTA_EDAD = 240
  const hoyDt2 = new Date(); hoyDt2.setHours(0, 0, 0, 0)
  const reprosViejos = animBio.filter(a => {
    if (!['activo', 'en_apareamiento', 'en_cria'].includes(a.estado) || !a.fecha_nacimiento) return false
    return Math.floor((hoyDt2 - new Date(a.fecha_nacimiento)) / 86400000) >= ALERTA_EDAD
  })
  const fallos30 = camBio.filter(c => c.failure_flag && (c.fecha_copula ?? '') >= hace30)
  if (reprosViejos.length >= 2 && fallos30.length >= 2) {
    const mejor = candidatosRenovacion.find(c => c.recomendado)
    decisiones.push({ prioridad: 2, nivel: 'importante', icono: '♻️', tipo: 'renovacion',
      accion: mejor
        ? `Promover línea estable a reproductor (jaula ${mejor.jaulaId?.slice(0, 8)}…) — F bajo, buen historial`
        : 'Renovar reproductores — buscar candidatos jóvenes de baja consanguinidad',
      motivo: `${reprosViejos.length} reproductores en edad límite · ${fallos30.length} fallos en 30d`,
    })
  }

  // 5. IMPORTANTE: camadas vencidas
  const camadasVencidas = camBio.filter(c => {
    if (!c.fecha_nacimiento || c.fecha_destete || c.failure_flag) return false
    return Math.floor((Date.now() - new Date(c.fecha_nacimiento).getTime()) / 86400000) > 28
  })
  if (camadasVencidas.length > 0) {
    decisiones.push({ prioridad: 2, nivel: 'importante', icono: '🐣', tipo: 'reproductivo',
      accion: `Destetar ${camadasVencidas.length} camada(s) — superaron los 28 días`,
      motivo: 'Crías con más de 28 días pueden estresarse y comprometer la madre',
    })
  }

  // 6. ATENCIÓN: fallos frecuentes sin causa anterior
  if (fallos30.length >= 2 && reprosViejos.length < 2) {
    decisiones.push({ prioridad: 3, nivel: 'atencion', icono: '🧬', tipo: 'reproductivo',
      accion: 'Revisar estado sanitario y genético de reproductores activos',
      motivo: `${fallos30.length} fallos reproductivos en los últimos 30 días`,
    })
  }

  // 7. Promover línea estable si todo bien
  if (!decisiones.some(d => d.prioridad <= 2)) {
    const mejor = candidatosRenovacion.find(c => c.recomendado && c.nivelF === 'bajo')
    if (mejor) {
      decisiones.push({ prioridad: 4, nivel: 'info', icono: '⭐', tipo: 'renovacion',
        accion: 'Evaluar promoción de línea estable — buen candidato disponible en stock',
        motivo: 'Jaula con F bajo y buen historial familiar detectada',
      })
    }
  }

  // 8. Todo OK
  if (decisiones.length === 0) {
    decisiones.push({ prioridad: 99, nivel: 'info', icono: '✅', tipo: 'info',
      accion: 'Monitoreo rutinario — colonia estable en todos los factores',
      motivo: 'Sin alertas multifactoriales activas',
    })
  }

  return decisiones.sort((a, b) => a.prioridad - b.prioridad)
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTAS GENEALÓGICAS — incidentes repetidos en misma línea genética
// ─────────────────────────────────────────────────────────────────────────────
//
// Detecta patrones de incidentes sanitarios/reproductivos vinculados a animales
// específicos (padre/madre) o líneas genealógicas, y genera alertas persistentes
// que reducen la prioridad reproductiva de los implicados.
//
// Retorna: array de alertas con { tipo, nivel, animal?, incidentes, mensaje, accion }

// Extrae todos los IDs de animales de un incidente
// (incluye animal_id singular + animal_ids array)
function getAnimalIdsDeIncidente(inc) {
  const ids = new Set()
  if (inc.animal_id) ids.add(inc.animal_id)
  if (Array.isArray(inc.animal_ids)) inc.animal_ids.forEach(id => { if (id) ids.add(id) })
  return ids
}

export function detectarAlertasGenealógicas(incidentes, animales) {
  const alertas = []
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)

  // Solo incidentes genealógicos relevantes (no ambientales ni de manejo)
  const relevantes = incidentes.filter(i =>
    CATS_GENEALOGICAS.includes(i.tipo_categoria) &&
    i.fecha >= hace180
  )

  if (relevantes.length === 0) return alertas

  // ── Animales implicados directamente (via animal_id / animal_ids) ──────────
  // IDs ya cubiertos por alertas de padre/madre (para no duplicar)
  const idsPadreMadre = new Set()
  relevantes.forEach(i => {
    if (i.padre_id) idsPadreMadre.add(i.padre_id)
    if (i.madre_id) idsPadreMadre.add(i.madre_id)
  })

  const porAnimalDirecto = {}
  relevantes.forEach(i => {
    getAnimalIdsDeIncidente(i).forEach(id => {
      ;(porAnimalDirecto[id] = porAnimalDirecto[id] ?? []).push(i)
    })
  })

  Object.entries(porAnimalDirecto).forEach(([animalId, incs]) => {
    if (incs.length < 2) return
    const animal = animales.find(a => a.id === animalId)
    if (!animal) return
    // Si este animal ya genera alerta como padre/madre, no duplicar
    if (idsPadreMadre.has(animalId)) return
    const nivel = incs.length >= 4 ? 'critico' : incs.length >= 3 ? 'alerta' : 'atencion'
    const sexLabel = animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'
    alertas.push({
      tipo: 'animal_implicado',
      nivel,
      animal,
      incidentes: incs,
      mensaje: `⚠️ ${sexLabel} ${animal.codigo} implicado en ${incs.length} incidentes (180d)`,
      accion: nivel === 'critico'
        ? 'Múltiples incidentes críticos — evaluar retiro de reproducción'
        : 'Monitorear — reducir prioridad reproductiva de este animal',
    })
  })

  // ── Agrupar por padre_id / madre_id ───────────────────────────────────────
  const porPadre = {}
  const porMadre = {}
  relevantes.forEach(i => {
    if (i.padre_id) ;(porPadre[i.padre_id] = porPadre[i.padre_id] ?? []).push(i)
    if (i.madre_id) ;(porMadre[i.madre_id] = porMadre[i.madre_id] ?? []).push(i)
  })

  Object.entries(porPadre).forEach(([padreId, incs]) => {
    if (incs.length < 2) return
    const animal = animales.find(a => a.id === padreId)
    if (!animal) return
    const nivel = incs.length >= 4 ? 'critico' : incs.length >= 3 ? 'alerta' : 'atencion'
    alertas.push({
      tipo: 'padre_implicado',
      nivel,
      animal,
      incidentes: incs,
      mensaje: `⚠️ Padre ${animal.codigo} implicado en ${incs.length} incidentes sanitarios/reproductivos (180d)`,
      accion: nivel === 'critico'
        ? 'Suspender reproducción inmediatamente — evaluar reemplazo'
        : 'Reducir prioridad reproductiva — monitorear próximas camadas',
    })
  })

  Object.entries(porMadre).forEach(([madreId, incs]) => {
    if (incs.length < 2) return
    const animal = animales.find(a => a.id === madreId)
    if (!animal) return
    const nivel = incs.length >= 4 ? 'critico' : incs.length >= 3 ? 'alerta' : 'atencion'
    alertas.push({
      tipo: 'madre_implicada',
      nivel,
      animal,
      incidentes: incs,
      mensaje: `⚠️ Madre ${animal.codigo} implicada en ${incs.length} incidentes sanitarios/reproductivos (180d)`,
      accion: nivel === 'critico'
        ? 'Suspender reproducción inmediatamente — evaluar retiro'
        : 'Reducir prioridad reproductiva — vigilar próximo ciclo',
    })
  })

  // ── Malformaciones repetidas en misma pareja ──────────────────────────────
  const TIPOS_MALFORMACION = new Set([
    'malformacion', 'ausencia_cola', 'ausencia_extremidad',
    'tamaño_reducido', 'retraso_crecimiento', 'tamaño_asimetrico',
  ])
  const malformaciones = relevantes.filter(i => TIPOS_MALFORMACION.has(i.tipo_incidente))

  const parejasMalformacion = new Set() // para no duplicar en familia_implicada
  if (malformaciones.length >= 2) {
    const byPair = {}
    malformaciones.forEach(i => {
      const k = [i.padre_id ?? '', i.madre_id ?? ''].filter(Boolean).sort().join('|')
      if (k) (byPair[k] = byPair[k] ?? []).push(i)
    })
    Object.entries(byPair).forEach(([k, incs]) => {
      if (incs.length < 2) return
      parejasMalformacion.add(k)
      const padreAnimal = incs[0].padre_id ? animales.find(a => a.id === incs[0].padre_id) : null
      const madreAnimal = incs[0].madre_id ? animales.find(a => a.id === incs[0].madre_id) : null
      const lineaLabel = [padreAnimal?.codigo, madreAnimal?.codigo].filter(Boolean).join(' × ') || 'línea desconocida'
      alertas.push({
        tipo: 'malformacion_repetida',
        nivel: incs.length >= 3 ? 'critico' : 'alerta',
        animal: padreAnimal ?? madreAnimal,
        incidentes: incs,
        mensaje: `🧬 Malformación repetida (${incs.length}x) en línea ${lineaLabel}`,
        accion: 'Calcular coeficiente F — posible consanguinidad. Suspender cruza y evaluar renovación de línea',
      })
    })
  }

  // ── Familia implicada (cualquier tipo de incidente repetido en misma pareja) ─
  const byFamilia = {}
  relevantes.forEach(i => {
    if (i.padre_id || i.madre_id) {
      const k = [i.padre_id ?? '', i.madre_id ?? ''].filter(Boolean).sort().join('|')
      if (k) (byFamilia[k] = byFamilia[k] ?? []).push(i)
    }
  })
  Object.entries(byFamilia).forEach(([k, incs]) => {
    if (incs.length < 2) return
    // Si ya está cubierto como malformacion_repetida, no agregar familia_implicada
    if (parejasMalformacion.has(k)) return
    const ids = k.split('|')
    const animalesPareja = ids.map(id => animales.find(a => a.id === id)).filter(Boolean)
    const label = animalesPareja.map(a => a.codigo).filter(Boolean).join(' × ') || 'familia'
    const nivel = incs.length >= 4 ? 'critico' : incs.length >= 3 ? 'alerta' : 'atencion'
    alertas.push({
      tipo: 'familia_implicada',
      nivel,
      animal: animalesPareja[0] ?? null,
      incidentes: incs,
      mensaje: `⚠️ Familia ${label} acumula ${incs.length} incidentes repetidos (180d)`,
      accion: 'Revisar compatibilidad genética — considerar cambio de pareja reproductiva',
    })
  })

  // ── Línea genética con alta incidencia por campo linea_genetica ────────────
  const porLinea = {}
  relevantes.filter(i => i.linea_genetica).forEach(i => {
    ;(porLinea[i.linea_genetica] = porLinea[i.linea_genetica] ?? []).push(i)
  })
  Object.entries(porLinea).forEach(([linea, incs]) => {
    if (incs.length < 3) return
    const graves = incs.filter(i => i.severidad === 'grave').length
    alertas.push({
      tipo: 'linea_problematica',
      nivel: graves >= 2 ? 'critico' : 'alerta',
      incidentes: incs,
      mensaje: `⚠️ Línea "${linea}" acumula ${incs.length} incidentes (${graves} graves) en 180d`,
      accion: 'Revisar estado de reproductores de esta línea — considerar renovación',
    })
  })

  return alertas.sort((a, b) => {
    const ord = { critico: 0, alerta: 1, atencion: 2 }
    return (ord[a.nivel] ?? 3) - (ord[b.nivel] ?? 3)
  })
}

// Retorna Set de IDs de animales marcados como problemáticos por alertas genealógicas
// Nivel 'critico' o 'alerta' — se usa para reducir score en candidatos a reproducción
export function getAnimalesProblematicosGenea(alertasGenea) {
  const set = new Set()
  alertasGenea.forEach(a => {
    if (['critico', 'alerta'].includes(a.nivel) && a.animal) {
      set.add(a.animal.id)
    }
  })
  return set
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL — Referencia para Supabase
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ NOTA IMPORTANTE: Las siguientes tablas aún usan localStorage y DEBEN
//    migrarse a Supabase. Crear estas tablas antes de la migración:
//
// -- Notas / recordatorios del dashboard
// CREATE TABLE IF NOT EXISTS notas (
//   id text PRIMARY KEY,
//   bioterio_id text NOT NULL,
//   fecha date NOT NULL,
//   titulo text NOT NULL,
//   descripcion text,
//   completada boolean DEFAULT false,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
//
// -- Planes de apareamiento
// CREATE TABLE IF NOT EXISTS planes_apareamiento (
//   id text PRIMARY KEY,
//   bioterio_id text NOT NULL,
//   fecha_planeada date NOT NULL,
//   fuente_a jsonb,   -- { tipo: 'reproductor'|'jaula', id, sexo, codigo }
//   fuente_b jsonb,
//   notas text,
//   completado boolean DEFAULT false,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE planes_apareamiento ENABLE ROW LEVEL SECURITY;
//
// -- Reservas de animales/jaulas
// CREATE TABLE IF NOT EXISTS reservas (
//   id text PRIMARY KEY,
//   tipo text NOT NULL,   -- 'renovacion'|'hibridos'|'pedido'|'produccion'
//   animal_id uuid REFERENCES animales(id) ON DELETE CASCADE,
//   jaula_id text,
//   bioterio_id text NOT NULL,
//   motivo text,
//   fecha date,
//   created_at timestamptz DEFAULT now()
// );
// ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
//
// -- Censos y compras de viruta
// CREATE TABLE IF NOT EXISTS censos_viruta (
//   id text PRIMARY KEY,
//   fecha date NOT NULL,
//   hora time,
//   stock_kg numeric,
//   relleno_kg numeric DEFAULT 0,
//   cambio_cama jsonb,   -- { tipo: 'si'|'no'|'parcial', bioteriosAfectados: [] }
//   notas text,
//   created_at timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS ingresos_viruta (
//   id text PRIMARY KEY,
//   fecha date NOT NULL,
//   cantidad_kg numeric NOT NULL,
//   notas text,
//   created_at timestamptz DEFAULT now()
// );
//
// -- Censos y reposiciones de alimento
// CREATE TABLE IF NOT EXISTS censos_alimento (
//   id text PRIMARY KEY,
//   fecha date NOT NULL,
//   hora time,
//   stock_kg numeric,
//   relleno_kg numeric DEFAULT 0,
//   composicion jsonb,   -- { lactantes, repro, crias, jovenes, adultos }
//   notas text,
//   created_at timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS ingresos_alimento (
//   id text PRIMARY KEY,
//   fecha date NOT NULL,
//   cantidad_kg numeric NOT NULL,
//   notas text,
//   created_at timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS reposiciones_alimento (
//   id text PRIMARY KEY,
//   fecha date NOT NULL,
//   hora time,
//   tipo text,   -- 'completa'|'parcial'
//   cantidad_kg numeric,
//   bioterios jsonb,
//   categorias jsonb,
//   notas text,
//   created_at timestamptz DEFAULT now()
// );
//
// -- SQL ejecutada en Supabase para incidentes (referencia histórica):
// ALTER TABLE incidentes
//   ADD COLUMN IF NOT EXISTS tipo_categoria text DEFAULT 'otro',
//   ADD COLUMN IF NOT EXISTS tipo_incidente  text DEFAULT 'otro',
//   ADD COLUMN IF NOT EXISTS severidad       text DEFAULT 'leve',
//   ADD COLUMN IF NOT EXISTS animal_id       uuid REFERENCES animales(id) ON DELETE SET NULL,
//   ADD COLUMN IF NOT EXISTS camada_id       uuid REFERENCES camadas(id)  ON DELETE SET NULL,
//   ADD COLUMN IF NOT EXISTS resuelto        boolean DEFAULT false;
