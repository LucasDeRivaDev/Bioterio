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
      { id: 'canibalismo',       label: 'Canibalismo' },
      { id: 'bajo_peso',         label: 'Bajo peso corporal' },
    ],
  },
  reproductivo: {
    label: 'Reproductivo',
    icon: '🧬',
    color: '#a78bfa',
    tipos: [
      { id: 'aborto',            label: 'Aborto' },
      { id: 'reabsorcion',       label: 'Reabsorción' },
      { id: 'infertilidad',      label: 'Infertilidad' },
      { id: 'parto_fallido',     label: 'Parto fallido' },
      { id: 'camada_pequeña',    label: 'Camada pequeña' },
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
      { id: 'tamaño_asimetrico',    label: 'Crías muy pequeñas vs hermanas' },
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
// ÍNDICE DE ESTABILIDAD AMBIENTAL (0–100)
// ─────────────────────────────────────────────────────────────────────────────
// Temperatura ideal: 20–24°C | Óptimo: 22 ±2°C
// Penalizaciones:
//   Días en riesgo (<18°C o >26°C) últimos 30d: −8/día (máx −40)
//   Días en atención (18-20°C o 24-26°C):        −3/día (máx −15)
//   Oscilaciones bruscas (>4°C entre días):      −5/evento (máx −20)
//   Sin datos en últimos 7 días:                 −25

export const TEMP_RANGO = { idealMin: 20, idealMax: 24, optimo: 22 }

export function clasificarTemperatura(temp) {
  if (temp === null || temp === undefined) return { nivel: 'sin_dato', color: '#4a5f7a', label: 'Sin dato' }
  const n = Number(temp)
  if (n >= 20 && n <= 24) return { nivel: 'normal',   color: '#00e676', label: `${n}°C — Normal`   }
  if ((n >= 18 && n < 20) || (n > 24 && n <= 26)) return { nivel: 'atencion', color: '#ffb300', label: `${n}°C — Atención` }
  return                                                  { nivel: 'riesgo',   color: '#ff6b80', label: `${n}°C — Riesgo`   }
}

export function calcularIndiceAmbiental(temperaturas, bioterioId) {
  let score = 100

  const temps = bioterioId && bioterioId !== 'todos'
    ? temperaturas.filter(t => t.bioterio_id === bioterioId)
    : temperaturas

  if (temps.length === 0) return 60 // Sin datos: índice moderado por default

  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const hace7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10)
  const recientes = temps.filter(t => t.date >= hace30)

  // Sin datos recientes
  const tempsSemana = temps.filter(t => t.date >= hace7)
  if (tempsSemana.length === 0) score -= 25

  // Días fuera de rango
  let diasRiesgo = 0, diasAtencion = 0
  recientes.forEach(t => {
    const cl = clasificarTemperatura(t.current_temp)
    if (cl.nivel === 'riesgo')   diasRiesgo++
    else if (cl.nivel === 'atencion') diasAtencion++
  })
  score -= Math.min(40, diasRiesgo   * 8)
  score -= Math.min(15, diasAtencion * 3)

  // Oscilaciones bruscas entre días consecutivos
  const ordenadas = [...recientes].sort((a, b) => a.date.localeCompare(b.date))
  let oscilaciones = 0
  for (let i = 1; i < ordenadas.length; i++) {
    const t1 = ordenadas[i - 1].current_temp ?? 0
    const t2 = ordenadas[i].current_temp ?? 0
    if (Math.abs(t2 - t1) > 4) oscilaciones++
  }
  score -= Math.min(20, oscilaciones * 5)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function nivelAmbiental(score) {
  if (score >= 80) return { label: 'Estable',  emoji: '🟢', color: '#00e676', bg: 'rgba(0,230,118,0.08)',   border: 'rgba(0,230,118,0.25)' }
  if (score >= 50) return { label: 'Variable', emoji: '🟡', color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   border: 'rgba(255,179,0,0.25)' }
  return                  { label: 'Riesgo',   emoji: '🔴', color: '#ff6b80', bg: 'rgba(255,107,128,0.08)', border: 'rgba(255,107,128,0.25)' }
}

// Stats rápidos de temperatura para un bioterio
export function statsTemperatura(temperaturas, bioterioId) {
  const temps = bioterioId && bioterioId !== 'todos'
    ? temperaturas.filter(t => t.bioterio_id === bioterioId)
    : temperaturas

  if (temps.length === 0) return { promedio: null, min: null, max: null, diasRiesgo: 0, diasAtencion: 0, total: 0 }

  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const recientes = temps.filter(t => t.date >= hace30 && t.current_temp != null)
  if (recientes.length === 0) return { promedio: null, min: null, max: null, diasRiesgo: 0, diasAtencion: 0, total: 0 }

  const vals = recientes.map(t => Number(t.current_temp))
  const promedio = vals.reduce((s, v) => s + v, 0) / vals.length
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  let diasRiesgo = 0, diasAtencion = 0
  recientes.forEach(t => {
    const cl = clasificarTemperatura(t.current_temp)
    if (cl.nivel === 'riesgo')   diasRiesgo++
    else if (cl.nivel === 'atencion') diasAtencion++
  })
  return { promedio: +promedio.toFixed(1), min, max, diasRiesgo, diasAtencion, total: recientes.length }
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

  // ── Detectar períodos de temperatura alta (>25°C por ≥2 días) ────────────
  const periodosCalor = []
  let inicioCalor = null
  tempsOrdenadas.forEach((t, i) => {
    if (Number(t.current_temp) > 25) {
      if (!inicioCalor) inicioCalor = t.date
    } else {
      if (inicioCalor) {
        const fin = tempsOrdenadas[i - 1].date
        const dias = Math.ceil((new Date(fin) - new Date(inicioCalor)) / 86400000) + 1
        if (dias >= 2) periodosCalor.push({ inicio: inicioCalor, fin, dias, tipo: 'calor', maxTemp: Math.max(...tempsOrdenadas.filter(x => x.date >= inicioCalor && x.date <= fin).map(x => Number(x.current_temp))) })
        inicioCalor = null
      }
    }
  })
  if (inicioCalor) {
    const fin = tempsOrdenadas[tempsOrdenadas.length - 1].date
    const dias = Math.ceil((new Date(fin) - new Date(inicioCalor)) / 86400000) + 1
    if (dias >= 2) periodosCalor.push({ inicio: inicioCalor, fin, dias, tipo: 'calor', maxTemp: Math.max(...tempsOrdenadas.filter(x => x.date >= inicioCalor && x.date <= fin).map(x => Number(x.current_temp))) })
  }

  // ── Detectar períodos de frío (<18°C) ────────────────────────────────────
  const periodosFrio = []
  let inicioFrio = null
  tempsOrdenadas.forEach((t, i) => {
    if (Number(t.current_temp) < 18) {
      if (!inicioFrio) inicioFrio = t.date
    } else {
      if (inicioFrio) {
        const fin = tempsOrdenadas[i - 1].date
        const dias = Math.ceil((new Date(fin) - new Date(inicioFrio)) / 86400000) + 1
        if (dias >= 2) periodosFrio.push({ inicio: inicioFrio, fin, dias, tipo: 'frio' })
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
        label: `Temperatura >25°C (${periodo.dias}d) → ↑ mortalidad`,
        descripcion: `${muertes.length} muerte(s) registrada(s) en los ${ventanaDias} días siguientes al período de calor (${periodo.inicio} – ${periodo.fin}, máx ${periodo.maxTemp}°C)`,
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
        label: `Temperatura alta → ↑ fallos reproductivos`,
        descripcion: `${fallos.length} fallo(s) reproductivo(s) en los ${ventanaDias} días siguientes al período de calor`,
        nivel: fallos.length >= 2 ? 'critico' : 'alerta',
        fuerza: fallos.length >= 2 ? 'fuerte' : 'posible',
        evidencia: `${fallos.length} fallos · max ${periodo.maxTemp}°C`,
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
        label: `Temperatura baja → ↑ fallos reproductivos`,
        descripcion: `${fallos.length} fallo(s) en los ${ventanaDias} días siguientes a temperatura <18°C (${periodo.inicio} – ${periodo.fin})`,
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
    const tempsAltas90 = tempsBio.filter(t => t.date >= hace90 && (Number(t.current_temp) > 25))
    if (tempsAltas90.length >= 3) factores.push(`temperatura >25°C (${tempsAltas90.length}d)`)
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

  // ── Temperatura alta prolongada ───────────────────────────────────────────
  const tempsAltas7 = tempsBio.filter(t => t.date >= hace7 && Number(t.current_temp) > 25)
  if (tempsAltas7.length >= 5) {
    alertas.push({ nivel: 'urgente',   icon: '🌡️', titulo: 'Temperatura crítica prolongada', descripcion: `${tempsAltas7.length} días con >25°C esta semana. Riesgo alto de mortalidad neonatal e infertilidad.`, accion: 'Intervención inmediata en sistema de climatización' })
  } else if (tempsAltas7.length >= 3) {
    alertas.push({ nivel: 'critico',   icon: '🌡️', titulo: 'Temperatura elevada esta semana',  descripcion: `${tempsAltas7.length} días con temperatura >25°C. Monitorear reproducción y supervivencia.`, accion: 'Revisar ventilación y control térmico' })
  } else if (tempsAltas7.length >= 1) {
    alertas.push({ nivel: 'importante', icon: '🌡️', titulo: 'Temperatura fuera de rango',        descripcion: `${tempsAltas7.length} día(s) con temperatura >25°C en los últimos 7 días.`, accion: 'Monitorear temperatura de cerca' })
  }

  // ── Frío extremo ──────────────────────────────────────────────────────────
  const tempsFrias7 = tempsBio.filter(t => t.date >= hace7 && Number(t.current_temp) < 18)
  if (tempsFrias7.length >= 2) {
    alertas.push({ nivel: 'critico', icon: '❄️', titulo: 'Temperatura baja', descripcion: `${tempsFrias7.length} días con <18°C. Puede afectar reproducción y bienestar.`, accion: 'Revisar calefacción' })
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

  // 3. Temperatura alta esta semana
  const tempsAltas = tempsBio.filter(t => t.date >= hace7 && Number(t.current_temp) > 25)
  if (tempsAltas.length >= 2) {
    recomendaciones.push({ prioridad: 'alta', icono: '❄️', accion: 'Verificar y ajustar sistema de ventilación/refrigeración', motivo: `${tempsAltas.length} días con temperatura >25°C esta semana` })
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
// Detecta si fertilidad↓ mortalidad↑ malformaciones↑ en tendencia reciente
// ─────────────────────────────────────────────────────────────────────────────

export function detectarDeterioroProgresivo(camadas, incidentes, bioterioId) {
  const ventanas = [30, 60, 90, 180, 365]
  const hoy    = new Date()
  const hoyStr = hoy.toISOString().slice(0, 10)
  const resultado = {}

  const camBio = bioterioId && bioterioId !== 'todos' ? camadas.filter(c => c.bioterio_id === bioterioId) : camadas
  const incBio = bioterioId && bioterioId !== 'todos' ? incidentes.filter(i => i.bioterio_id === bioterioId) : incidentes

  for (const dias of ventanas) {
    const desde = new Date(hoy.getTime() - dias * 86400000).toISOString().slice(0, 10)

    const camPer = camBio.filter(c => (c.fecha_copula ?? '') >= desde && (c.fecha_copula ?? '') <= hoyStr)
    const incPer = incBio.filter(i => i.fecha >= desde && i.fecha <= hoyStr)

    const conParto  = camPer.filter(c => c.fecha_nacimiento && !c.failure_flag)
    const totalCam  = camPer.filter(c => c.fecha_copula).length
    const fertilidad = totalCam > 0 ? conParto.length / totalCam : null

    const conDestete = conParto.filter(c => c.total_crias > 0 && c.total_destetados != null)
    const supervivencia = conDestete.length > 0
      ? conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
      : null

    const mortalidadNeo  = incPer.filter(i => i.tipo_incidente === 'muerte_neonatal').length
    const malformaciones = incPer.filter(i =>
      ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente)
    ).length
    const fallos = camPer.filter(c => c.failure_flag).length

    resultado[dias] = { dias, desde, fertilidad, supervivencia, mortalidadNeo, malformaciones, fallos, totalCamadas: totalCam }
  }

  const v30  = resultado[30]
  const v90  = resultado[90]
  const v180 = resultado[180]

  // fertilidad más reciente peor que más larga
  const fertilidadDet = v30.fertilidad !== null && v180.fertilidad !== null && v30.fertilidad < v180.fertilidad - 0.10
  // mortalidad neonatal se acelera (30d dense > ritmo 90d/3)
  const mortalidadSube = v90.mortalidadNeo > 0 && v30.mortalidadNeo > v90.mortalidadNeo / 3
  // malformaciones crecen en ventana corta
  const malformCrece = v90.malformaciones > 0 && v30.malformaciones > v90.malformaciones / 3

  const señales = [fertilidadDet, mortalidadSube, malformCrece].filter(Boolean).length
  const tieneDeterioro = señales >= 2 || (señales >= 1 && v30.fallos >= 2)

  const ventanaSignificativa = [30, 60, 90].find(v => {
    const d = resultado[v]
    return (d.fertilidad !== null && d.fertilidad < 0.60) || d.mortalidadNeo >= 3 || d.malformaciones >= 3
  }) ?? null

  return {
    ventanas: resultado,
    tieneDeterioro,
    ventanaSignificativa,
    señalesActivas: señales,
    patron: tieneDeterioro ? 'Deterioro progresivo — fertilidad↓ mortalidad↑ malformaciones↑' : null,
    nivel: tieneDeterioro ? (ventanaSignificativa && ventanaSignificativa <= 60 ? 'critico' : 'alerta') : 'ok',
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
  const tempsAltas7 = tempBio.filter(t => t.date >= hace7 && Number(t.current_temp) > 25)
  if (tempsAltas7.length >= 3) {
    decisiones.push({ prioridad: 1, nivel: 'critico', icono: '🌡️', tipo: 'ambiental',
      accion: 'Intervenir en climatización — temperatura >25°C varios días',
      motivo: `${tempsAltas7.length} días con temperatura >25°C esta semana`,
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
