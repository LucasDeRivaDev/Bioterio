// ─────────────────────────────────────────────────────────────────────────────
// motorPedidos.js — Motor de planificación y gestión de pedidos de producción
// Parejas · Fechas · Reproductores · Viabilidad · Escenarios · Calendario
// ─────────────────────────────────────────────────────────────────────────────

import { difDias, parseDate, formatFecha, calcularPerfilHembra, calcularRendimientoMacho } from './calculos'
import { getBio } from './constants'
import { buildPedigree, calcularFCoeficiente } from './genealogia'
import { getMinimosCriticos, getReservas, reservarAnimal, liberarReserva } from './motorDecisiones'

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 1 — PRODUCCIÓN HISTÓRICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae estadísticas históricas de producción para un bioterio.
 * Usadas como base para todos los cálculos de parejas y probabilidades.
 */
export function calcularProduccionHistorica(camadas, bioterioId) {
  const historia = camadas.filter(c =>
    c.bioterio_id === bioterioId && c.total_crias > 0 && !c.failure_flag
  )
  const totalCamadas = camadas.filter(c => c.bioterio_id === bioterioId).length
  const totalFallos  = camadas.filter(c => c.bioterio_id === bioterioId && c.failure_flag).length

  if (historia.length === 0) {
    // Valores bibliográficos por defecto
    const bio = getBio(bioterioId)
    const promBiblio = bioterioId === 'ratas' ? 10 : 8
    return {
      promedioTamano:    promBiblio,
      tasaSupervivencia: 0.80,
      tasaExito:         0.85,
      propHembras:       0.50,
      nCamadas:          0,
      conDatos:          false,
    }
  }

  const promedioTamano = historia.reduce((a, c) => a + (c.total_crias || 0), 0) / historia.length

  const conDestete     = historia.filter(c => (c.total_destetados ?? 0) > 0)
  const tasaSupervivencia = conDestete.length > 0
    ? conDestete.reduce((a, c) => a + c.total_destetados / c.total_crias, 0) / conDestete.length
    : 0.80

  const tasaExito = totalCamadas > 0 ? (totalCamadas - totalFallos) / totalCamadas : 0.85

  // Proporción histórica de hembras por camada
  const conSexo = historia.filter(c =>
    c.crias_hembras != null && c.crias_machos != null && c.total_crias > 0
  )
  const propHembras = conSexo.length > 0
    ? conSexo.reduce((a, c) => a + c.crias_hembras / c.total_crias, 0) / conSexo.length
    : 0.50

  return {
    promedioTamano:    Math.round(promedioTamano * 10) / 10,
    tasaSupervivencia: Math.round(tasaSupervivencia * 100) / 100,
    tasaExito:         Math.round(tasaExito * 100) / 100,
    propHembras:       Math.round(propHembras * 100) / 100,
    nCamadas:          historia.length,
    conDatos:          historia.length >= 3,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 3 — PAREJAS NECESARIAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula cuántas parejas reproductoras se necesitan para cubrir el pedido,
 * incluyendo buffer por tasa de fallos y supervivencia.
 *
 * Lógica:
 *   animalesTipoSexo = promedioTamano × supervivencia × propSexo
 *   parejasBase      = ceil(cantidad / animalesTipoSexo)
 *   parejasConBuffer = ceil(parejasBase / tasaExito)
 */
export function calcularParejasNecesarias(pedido, camadas, bio) {
  const { cantidad, sexo, bioterioId } = pedido
  const hist = calcularProduccionHistorica(camadas, bioterioId)

  // Fracción del sexo requerido esperada por camada
  const propSexo =
    sexo === 'hembras' ? hist.propHembras
    : sexo === 'machos' ? (1 - hist.propHembras)
    : 1 // 'ambos' → todos los animales

  const animalesUtilesPorCamada = hist.promedioTamano * hist.tasaSupervivencia * propSexo

  const parejasBase = animalesUtilesPorCamada > 0
    ? Math.ceil(cantidad / animalesUtilesPorCamada)
    : cantidad

  const parejasConBuffer = Math.ceil(parejasBase / hist.tasaExito)

  // 1 macho puede cubrir hasta 3 hembras
  const hembrasNecesarias = parejasConBuffer
  const machosNecesarios  = Math.max(1, Math.ceil(parejasConBuffer / 3))

  // Probabilidad de cumplimiento: tasa base × factor de buffer × ajuste por datos
  const bufferFactor = parejasConBuffer / Math.max(1, parejasBase)
  const probabilidad = Math.min(98, Math.max(25, Math.round(
    hist.tasaExito * hist.tasaSupervivencia * 100 * Math.min(1.5, bufferFactor) * (hist.conDatos ? 1.1 : 0.85)
  )))

  // Estimación total de animales producidos (todos los sexos)
  const animalesEstimados = Math.round(
    parejasConBuffer * hist.promedioTamano * hist.tasaSupervivencia
  )

  return {
    hembrasNecesarias,
    machosNecesarios,
    parejasNecesarias: parejasConBuffer,
    animalesEstimados,
    animalesDelSexo:   Math.round(animalesEstimados * propSexo),
    probabilidad,
    hist,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 4 — FECHAS ÓPTIMAS (timeline inverso desde la entrega)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula las fechas clave del ciclo reproductivo partiendo de la fecha de entrega.
 * Trabaja hacia atrás:
 *   Entrega ← edadSemanas ← Destete ← DESTETE_DIAS ← Parto ← GESTACION_DIAS+VENTANA_MAX ← Cópula
 */
export function calcularFechasOptimas(pedido, bio) {
  const { fechaEntrega, edadSemanas } = pedido
  if (!fechaEntrega || !edadSemanas) return null

  const entregaDate = parseDate(fechaEntrega)
  if (!entregaDate) return null

  const edadDias = edadSemanas * 7

  // Nacimiento ideal
  const fechaNacimiento = new Date(entregaDate)
  fechaNacimiento.setDate(fechaNacimiento.getDate() - edadDias)

  // Destete
  const fechaDestete = new Date(fechaNacimiento)
  fechaDestete.setDate(fechaDestete.getDate() + bio.DESTETE_DIAS)

  // Cópula: retroceder gestación + ventana máxima de concepción
  const fechaCopula = new Date(fechaNacimiento)
  fechaCopula.setDate(fechaCopula.getDate() - bio.GESTACION_DIAS - bio.VENTANA_CONCEPCION_MAX)

  // Separación de pareja: 15 días después de la cópula
  const fechaSeparacion = new Date(fechaCopula)
  fechaSeparacion.setDate(fechaSeparacion.getDate() + bio.DURACION_APAREAMIENTO_DIAS)

  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const toISO = d => d.toISOString().split('T')[0]

  const diasHastaCopula   = Math.round((fechaCopula   - hoyDate) / 86400000)
  const diasHastaEntrega  = Math.round((entregaDate   - hoyDate) / 86400000)
  const diasMinimos       = bio.DURACION_APAREAMIENTO_DIAS + bio.GESTACION_DIAS +
                            bio.VENTANA_CONCEPCION_MAX + bio.DESTETE_DIAS + edadDias

  const viable       = diasHastaEntrega >= diasMinimos
  const urgente      = diasHastaCopula >= 0 && diasHastaCopula <= 14
  const copulaVencida = diasHastaCopula < 0

  return {
    fechaCopula:      toISO(fechaCopula),
    fechaSeparacion:  toISO(fechaSeparacion),
    fechaNacimiento:  toISO(fechaNacimiento),
    fechaDestete:     toISO(fechaDestete),
    fechaEntrega,
    diasHastaCopula,
    diasHastaEntrega,
    diasMinimos,
    edadDias,
    viable,
    urgente,
    copulaVencida,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 5 — SELECCIÓN ÓPTIMA DE REPRODUCTORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Selecciona y rankea reproductores disponibles para el pedido.
 * Prioriza: score reproductivo + baja consanguinidad + edad óptima.
 * Excluye animales reservados, ya en apareamiento o fuera del rango de edad.
 */
export function seleccionarReproductoresOptimos(pedido, animales, camadas, todosAnimalesBase = null) {
  const { bioterioId } = pedido
  const bio     = getBio(bioterioId)
  const parejas = calcularParejasNecesarias(pedido, camadas, bio)
  const hembrasN = parejas.hembrasNecesarias
  const machosN  = parejas.machosNecesarios

  const LIMITE_DIAS = 270
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const pedigreeBase = todosAnimalesBase ?? animales
  const pedigree = buildPedigree(pedigreeBase, camadas)
  const reservas = getReservas()

  function evaluarAnimal(animal, esMacho) {
    if (reservas[animal.id]) return null  // reservado para otro uso

    const diasVida = animal.fecha_nacimiento
      ? difDias(animal.fecha_nacimiento, hoyDate)
      : bio.MADUREZ_DIAS + 30  // sin fecha → asumimos adulto

    if (diasVida < Math.round(bio.MADUREZ_DIAS * 0.85)) return null  // muy joven
    if (diasVida > LIMITE_DIAS) return null                           // límite superado

    // Score reproductivo histórico
    let scoreRepro = 5
    try {
      if (esMacho) {
        const r = calcularRendimientoMacho(animal.id, camadas)
        scoreRepro = r?.score_promedio ?? 5
      } else {
        const p = calcularPerfilHembra(animal.id, camadas)
        if (p) {
          const vals = [p.avg_time_score, p.avg_litter_size_score, p.avg_sex_ratio_score, p.avg_survival_score]
            .filter(v => v != null)
          scoreRepro = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 5
        }
      }
    } catch { scoreRepro = 5 }

    // Consanguinidad individual (F del animal)
    let fAnimal = 0
    try {
      if (animal.id_madre && animal.id_padre) {
        fAnimal = calcularFCoeficiente(animal.id_madre, animal.id_padre, pedigree) ?? 0
      }
    } catch { fAnimal = 0 }

    // Penalización por edad superior al óptimo (> 1.5× madurez)
    const optimo = bio.MADUREZ_DIAS * 1.5
    const penEdad = diasVida > optimo ? Math.min(15, (diasVida - optimo) / optimo * 10) : 0

    // Score compuesto:  40% reproducción · 30% genética · 20% edad · 10% disponibilidad
    const sRepro = (Math.min(10, scoreRepro) / 10) * 40
    const sGene  = (1 - Math.min(1, fAnimal)) * 30
    const sEdad  = Math.max(0, 20 - penEdad)
    const sDispo = 10
    const score  = Math.round(sRepro + sGene + sEdad + sDispo)

    const nivelF = fAnimal >= 0.25 ? 'alto' : fAnimal >= 0.125 ? 'moderado' : fAnimal >= 0.0625 ? 'leve' : 'bajo'

    return {
      animal,
      diasVida,
      scoreRepro: Math.round(scoreRepro * 10) / 10,
      fAnimal:    Math.round(fAnimal * 1000) / 1000,
      fPorc:      (fAnimal * 100).toFixed(1) + '%',
      nivelF,
      score,
    }
  }

  const aptos = animales.filter(a =>
    a.bioterio_id === bioterioId &&
    a.estado === 'activo' &&
    !a.exportado_hibridos
  )

  const hembrasEval = aptos
    .filter(a => a.sexo === 'hembra')
    .map(a => evaluarAnimal(a, false))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  const machosEval = aptos
    .filter(a => a.sexo === 'macho')
    .map(a => evaluarAnimal(a, true))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  return {
    hembrasSugeridas:    hembrasEval.slice(0, hembrasN),
    machosSugeridos:     machosEval.slice(0, machosN),
    todasHembras:        hembrasEval,
    todosMachos:         machosEval,
    hembrasDisponibles:  hembrasEval.length,
    machosDisponibles:   machosEval.length,
    hembrasNecesarias:   hembrasN,
    machosNecesarios:    machosN,
    suficientesHembras:  hembrasEval.length >= hembrasN,
    suficientesMachos:   machosEval.length >= machosN,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 6 — ANIMALES YA DISPONIBLES EN STOCK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta animales de stock que ya cumplen los requerimientos del pedido
 * (edad dentro del rango requerido ± 4 semanas).
 */
export function detectarAnimalesListos(pedido, jaulas, camadas, sacrificios, entregas) {
  const { bioterioId, cantidad, sexo, edadSemanas } = pedido
  if (!edadSemanas) return { disponibles: 0, necesarios: cantidad, deficit: cantidad, porcentajeCubierto: 0, jaulas: [], cubiertoConStock: false }

  const edadMinDias = edadSemanas * 7
  const edadMaxDias = edadMinDias + 28  // ventana de 4 semanas

  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  // Bajas acumuladas por camada
  const bajasPorCamada = {}
  for (const s of (sacrificios ?? [])) {
    if (s.camada_id) bajasPorCamada[s.camada_id] = (bajasPorCamada[s.camada_id] || 0) + (s.cantidad || 0)
  }
  for (const e of (entregas ?? [])) {
    if (e.camada_id) bajasPorCamada[e.camada_id] = (bajasPorCamada[e.camada_id] || 0) + (e.cantidad || 0)
  }

  let disponibles = 0
  const jaulasListas = []

  for (const jaula of (jaulas ?? [])) {
    const camada = camadas.find(c => c.id === jaula.camada_id)
    if (!camada?.fecha_nacimiento || camada.bioterio_id !== bioterioId || camada.failure_flag) continue

    const diasVida = difDias(camada.fecha_nacimiento, hoyDate)
    if (diasVida < edadMinDias || diasVida > edadMaxDias) continue

    const bajas  = bajasPorCamada[jaula.camada_id] || 0
    const total  = Math.max(0, (jaula.total || 0) - bajas)
    if (total <= 0) continue

    let dispEnJaula = 0
    if (sexo === 'ambos')    dispEnJaula = total
    else if (sexo === 'machos')  dispEnJaula = jaula.machos  || Math.floor(total * 0.5)
    else                         dispEnJaula = jaula.hembras || Math.floor(total * 0.5)

    if (dispEnJaula > 0) {
      disponibles += dispEnJaula
      jaulasListas.push({ jaulaId: jaula.id, camadaId: camada.id, diasVida, disponiblesEnJaula: dispEnJaula, total })
    }
  }

  return {
    disponibles,
    necesarios:           cantidad,
    deficit:              Math.max(0, cantidad - disponibles),
    superavit:            Math.max(0, disponibles - cantidad),
    cubiertoConStock:     disponibles >= cantidad,
    porcentajeCubierto:   Math.min(100, Math.round((disponibles / Math.max(1, cantidad)) * 100)),
    jaulas:               jaulasListas,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 7 — CAPACIDAD FUTURA DE JAULAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estima el impacto sobre la capacidad de jaulas del bioterio.
 */
export function evaluarCapacidadFutura(parejasInfo, jaulasActualesCount) {
  const jaulasNuevas  = parejasInfo.parejasNecesarias
  const jaulasTotal   = jaulasActualesCount + jaulasNuevas

  const UMBRAL = 20  // umbral configurable a futuro
  const pctUso = Math.round((jaulasTotal / UMBRAL) * 100)
  const saturada = jaulasTotal > UMBRAL

  return {
    jaulasActuales:   jaulasActualesCount,
    jaulasNuevas,
    jaulasTotal,
    porcentajeUso:    Math.min(200, pctUso),
    saturada,
    ok:               !saturada,
    advertencia:
      saturada
        ? `+${jaulasNuevas} jaulas → ${jaulasTotal} total (umbral: ${UMBRAL}) — riesgo de saturación`
        : pctUso > 75
        ? `Se utilizará el ${pctUso}% de capacidad estimada (${jaulasTotal}/${UMBRAL} jaulas)`
        : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 8 — IMPACTO SOBRE LA COLONIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa si cumplir el pedido compromete la estabilidad reproductiva de la colonia.
 * Verifica mínimos críticos antes y después de reservar los reproductores.
 */
export function evaluarImpactoColonia(pedido, reproductoresSeleccionados, animales) {
  const { bioterioId } = pedido
  const { hembrasSugeridas, machosSugeridos } = reproductoresSeleccionados
  const minimos = getMinimosCriticos(bioterioId)

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']

  const hembrasActivas = animales.filter(a =>
    a.bioterio_id === bioterioId && a.sexo === 'hembra' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length

  const machosActivos = animales.filter(a =>
    a.bioterio_id === bioterioId && a.sexo === 'macho' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length

  const hembrasDespues = hembrasActivas - hembrasSugeridas.length
  const machosDespues  = machosActivos  - machosSugeridos.length

  const rompeHembras = hembrasDespues < (minimos.hembras_colonia ?? 0)
  const rompeMachos  = machosDespues  < (minimos.machos_colonia  ?? 0)

  const impactos = []
  if (rompeHembras) impactos.push({ tipo: 'critico', mensaje: `Quedarían ${hembrasDespues} hembras — mínimo: ${minimos.hembras_colonia}` })
  if (rompeMachos)  impactos.push({ tipo: 'critico', mensaje: `Quedarían ${machosDespues} machos — mínimo: ${minimos.machos_colonia}` })
  if (!rompeHembras && hembrasDespues <= (minimos.hembras_colonia ?? 0) + 1)
    impactos.push({ tipo: 'advertencia', mensaje: `Hembras al límite mínimo tras este pedido (${hembrasDespues})` })

  const riesgoNivel = impactos.some(i => i.tipo === 'critico')   ? 'critico'
    : impactos.some(i => i.tipo === 'advertencia')               ? 'advertencia'
    : 'ok'

  return {
    hembrasActivas, machosActivos,
    hembrasUsadas:  hembrasSugeridas.length,
    machosUsados:   machosSugeridos.length,
    hembrasDespues, machosDespues,
    minimoHembras:  minimos.hembras_colonia,
    minimoMachos:   minimos.machos_colonia,
    rompeHembras, rompeMachos,
    riesgoNivel, impactos,
    estabilidadEmpeora: riesgoNivel !== 'ok',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 9 — ÍNDICE DE VIABILIDAD (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Índice compuesto 0-100 que integra todos los factores relevantes.
 *
 * Componentes:
 *   - Tiempo suficiente       25 pts
 *   - Reproductores disponibles 20 pts
 *   - Mínimos no comprometidos 20 pts
 *   - Stock ya disponible     15 pts
 *   - Capacidad de jaulas     10 pts
 *   - Estado sanitario        10 pts
 */
export function calcularIndiceViabilidad({
  fechasOptimas,
  parejasNecesarias,
  reproductoresSeleccionados,
  animalesListos,
  impactoColonia,
  capacidadFutura,
  indiceSanitario = 100,
}) {
  const detalle = {}

  // 1. Tiempo (25 pts)
  let tiempo = 0
  if (fechasOptimas?.viable && !fechasOptimas.copulaVencida) {
    tiempo = fechasOptimas.urgente ? 14 : 25
  } else if (fechasOptimas?.copulaVencida) {
    tiempo = animalesListos.cubiertoConStock ? 18 : 0
  }
  detalle.tiempo = tiempo

  // 2. Reproductores (20 pts)
  const { suficientesHembras, suficientesMachos, hembrasDisponibles } = reproductoresSeleccionados
  let repros = 0
  if (suficientesHembras && suficientesMachos) repros = 20
  else if (suficientesHembras || suficientesMachos) repros = 11
  else if (hembrasDisponibles > 0) repros = 5
  detalle.reproductores = repros

  // 3. Mínimos respetados (20 pts)
  const minPts = impactoColonia.riesgoNivel === 'critico' ? 0
    : impactoColonia.riesgoNivel === 'advertencia' ? 11
    : 20
  detalle.minimos = minPts

  // 4. Stock actual disponible (15 pts)
  const stockPts = animalesListos.cubiertoConStock ? 15
    : Math.round((animalesListos.porcentajeCubierto / 100) * 15)
  detalle.stockActual = stockPts

  // 5. Capacidad (10 pts)
  detalle.capacidad = capacidadFutura.saturada ? 3 : capacidadFutura.ok ? 10 : 6

  // 6. Sanitario (10 pts)
  detalle.sanitario = Math.round((indiceSanitario / 100) * 10)

  const score = Math.max(0, Math.min(100,
    detalle.tiempo + detalle.reproductores + detalle.minimos +
    detalle.stockActual + detalle.capacidad + detalle.sanitario
  ))

  return { score, detalle }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 10 — SIMULACIÓN DE ESCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera dos escenarios alternativos:
 *   A) Recomendado — buffer completo, alta probabilidad
 *   B) Mínimo       — sin buffer, menos impacto en colonia
 */
export function simularEscenarios(pedido, camadas) {
  const bio  = getBio(pedido.bioterioId)
  const hist = calcularProduccionHistorica(camadas, pedido.bioterioId)

  // Escenario A: buffer completo
  const parejasA = calcularParejasNecesarias(pedido, camadas, bio)

  // Escenario B: sin buffer (parejasBase exacta)
  const propSexo = pedido.sexo === 'hembras' ? hist.propHembras
    : pedido.sexo === 'machos' ? (1 - hist.propHembras)
    : 1
  const animalesUtiles = hist.promedioTamano * hist.tasaSupervivencia * propSexo
  const parejasBaseB = animalesUtiles > 0
    ? Math.ceil(pedido.cantidad / animalesUtiles)
    : pedido.cantidad

  const probB = Math.min(90, Math.max(20, Math.round(
    hist.tasaExito * hist.tasaSupervivencia * 80
  )))

  return {
    a: {
      label:           'Recomendado',
      emoji:           '🟢',
      hembras:         parejasA.hembrasNecesarias,
      machos:          parejasA.machosNecesarios,
      jaulasNuevas:    parejasA.parejasNecesarias,
      animalesEstimados: parejasA.animalesEstimados,
      probabilidad:    parejasA.probabilidad,
      descripcion:     'Buffer completo — alta seguridad de cumplimiento, mayor uso de la colonia',
    },
    b: {
      label:           'Mínimo',
      emoji:           '🟡',
      hembras:         parejasBaseB,
      machos:          Math.max(1, Math.ceil(parejasBaseB / 3)),
      jaulasNuevas:    parejasBaseB,
      animalesEstimados: Math.round(parejasBaseB * hist.promedioTamano * hist.tasaSupervivencia),
      probabilidad:    probB,
      descripcion:     'Sin buffer — menor impacto en colonia, riesgo de quedar corto',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 11 — CALENDARIO DEL PEDIDO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera la línea de tiempo de eventos asociados al pedido.
 */
export function generarCalendarioPedido(pedido, fechasOptimas, parejasInfo) {
  if (!fechasOptimas) return []

  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const eventos = [
    {
      fecha: fechasOptimas.fechaCopula,
      tipo:  'copula',
      emoji: '🔗',
      label: 'Iniciar apareamientos',
      desc:  `Unir ${parejasInfo?.hembrasNecesarias ?? '?'} hembras con ${parejasInfo?.machosNecesarios ?? '?'} machos`,
    },
    {
      fecha: fechasOptimas.fechaSeparacion,
      tipo:  'separacion',
      emoji: '↗️',
      label: 'Separar parejas',
      desc:  'Retirar machos — hembras en período de gestación',
    },
    {
      fecha: fechasOptimas.fechaNacimiento,
      tipo:  'parto',
      emoji: '🐣',
      label: 'Partos esperados',
      desc:  `Estimado: ${parejasInfo?.animalesEstimados ?? '?'} crías totales`,
    },
    {
      fecha: fechasOptimas.fechaDestete,
      tipo:  'destete',
      emoji: '🧬',
      label: 'Destete',
      desc:  'Separar crías — iniciar seguimiento de stock',
    },
    {
      fecha: fechasOptimas.fechaEntrega,
      tipo:  'entrega',
      emoji: '📦',
      label: 'Entrega al investigador',
      desc:  `${pedido.cantidad} ${pedido.sexo === 'ambos' ? 'animales (♂+♀)' : pedido.sexo} · ${pedido.edadSemanas} semanas`,
      importante: true,
    },
  ]

  return eventos
    .filter(ev => ev.fecha)
    .map(ev => {
      const d = parseDate(ev.fecha)
      const diasRestantes = d ? Math.round((d - hoyDate) / 86400000) : null
      return { ...ev, diasRestantes }
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 12 — PROYECCIÓN POR HORIZONTES (30/60/90/180 días)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Indica el estado del pedido en cada horizonte temporal.
 */
export function proyeccionHorizontes(fechasOptimas) {
  if (!fechasOptimas) return {}

  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const estadosPorHorizonte = {}

  for (const dias of [30, 60, 90, 180]) {
    const limite = new Date(hoyDate)
    limite.setDate(limite.getDate() + dias)

    const enH = fecha => fecha && parseDate(fecha) && parseDate(fecha) <= limite

    let estado, emoji, label
    if (enH(fechasOptimas.fechaEntrega)) {
      estado = 'entregado';          emoji = '✅'; label = 'Entregado'
    } else if (enH(fechasOptimas.fechaDestete)) {
      estado = 'stock_disponible';   emoji = '📦'; label = 'Stock disponible'
    } else if (enH(fechasOptimas.fechaNacimiento)) {
      estado = 'en_cria';            emoji = '🐣'; label = 'En cría'
    } else if (enH(fechasOptimas.fechaCopula)) {
      estado = 'en_apareamiento';    emoji = '🔗'; label = 'En apareamiento'
    } else {
      estado = 'pendiente_copula';   emoji = '⏳'; label = 'Pendiente de cópula'
    }

    estadosPorHorizonte[dias] = { estado, emoji, label }
  }

  return estadosPorHorizonte
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 13 — SUPERÁVIT DE REPRODUCTORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta si hay más reproductores de los necesarios en el bioterio y
 * recomienda reducir renovación para liberar recursos.
 *
 * Umbral de superávit: count > mínimo × FACTOR_SUPERAVIT
 *   - Verde: dentro del rango óptimo
 *   - Naranja: superávit moderado (> mínimo × 1.5)
 *   - Rojo: superávit crítico (> mínimo × 2.5) — saturación
 */
export function detectarSuperavit(animales, bioterioId) {
  const minimos = getMinimosCriticos(bioterioId)
  const FACTOR_MOD  = 1.5
  const FACTOR_CRIT = 2.5
  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']

  const hembras = animales.filter(a =>
    a.bioterio_id === bioterioId && a.sexo === 'hembra' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length

  const machos = animales.filter(a =>
    a.bioterio_id === bioterioId && a.sexo === 'macho' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length

  const minH = minimos.hembras_colonia ?? 2
  const minM = minimos.machos_colonia  ?? 1

  const superavitH = Math.max(0, hembras - minH)
  const superavitM = Math.max(0, machos  - minM)

  const nivelH =
    hembras > minH * FACTOR_CRIT ? 'critico'
    : hembras > minH * FACTOR_MOD ? 'moderado'
    : hembras > minH ? 'leve'
    : 'ok'

  const nivelM =
    machos > minM * FACTOR_CRIT ? 'critico'
    : machos > minM * FACTOR_MOD ? 'moderado'
    : machos > minM ? 'leve'
    : 'ok'

  const haySuperavit = nivelH !== 'ok' || nivelM !== 'ok'
  const esSignificativo = nivelH === 'moderado' || nivelH === 'critico' ||
                          nivelM === 'moderado' || nivelM === 'critico'

  const recomendaciones = []
  if (nivelH === 'critico')
    recomendaciones.push(`Hay ${superavitH} hembras extra sobre el mínimo — reducir renovación o sacrificar para liberar capacidad`)
  else if (nivelH === 'moderado')
    recomendaciones.push(`${superavitH} hembras por encima del mínimo — considerar pausar reemplazos`)

  if (nivelM === 'critico')
    recomendaciones.push(`Hay ${superavitM} machos extra sobre el mínimo — reducir renovación`)
  else if (nivelM === 'moderado')
    recomendaciones.push(`${superavitM} machos por encima del mínimo — considerar pausar reemplazos`)

  return {
    hembras, machos,
    minimoHembras: minH, minimoMachos: minM,
    superavitH, superavitM,
    nivelH, nivelM,
    haySuperavit, esSignificativo,
    recomendaciones,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 14 — HELPERS DE NIVEL Y UI
// ─────────────────────────────────────────────────────────────────────────────

export function nivelViabilidad(score) {
  if (score >= 75) return { label: 'Viable',        emoji: '🟢', color: '#00e676', bg: 'rgba(0,230,118,0.08)',  borde: 'rgba(0,230,118,0.25)' }
  if (score >= 50) return { label: 'Con riesgo',    emoji: '🟡', color: '#ffb300', bg: 'rgba(255,179,0,0.08)',  borde: 'rgba(255,179,0,0.25)' }
  if (score >= 25) return { label: 'Comprometido',  emoji: '🔴', color: '#ff6b80', bg: 'rgba(255,61,87,0.08)',  borde: 'rgba(255,61,87,0.25)' }
  return               { label: 'Inviable',         emoji: '⚫', color: '#9c27b0', bg: 'rgba(156,39,176,0.08)', borde: 'rgba(156,39,176,0.25)' }
}

export function labelBioterio(id) {
  return {
    ratas:            '🐀 Ratas',
    ratones_balbc:    '🐭 BALB/C',
    ratones_c57:      '🐭 C57',
    ratones_hibridos: '🧬 Híbridos F1',
  }[id] ?? id
}

export function labelSexo(s) {
  if (s === 'machos')  return '♂ Machos'
  if (s === 'hembras') return '♀ Hembras'
  return '♂♀ Ambos sexos'
}

export function labelUso(u) {
  if (u === 'investigacion') return '🔬 Investigación'
  if (u === 'produccion')    return '🏭 Producción'
  return '📦 Stock'
}

export function colorEstadoPedido(estado) {
  if (estado === 'en_proceso')  return { color: '#40c4ff', bg: 'rgba(64,196,255,0.08)',  borde: 'rgba(64,196,255,0.25)' }
  if (estado === 'completado')  return { color: '#00e676', bg: 'rgba(0,230,118,0.08)',   borde: 'rgba(0,230,118,0.25)' }
  if (estado === 'cancelado')   return { color: '#ff6b80', bg: 'rgba(255,107,128,0.08)', borde: 'rgba(255,107,128,0.25)' }
  return                         { color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   borde: 'rgba(255,179,0,0.25)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 15 — EVALUACIÓN DE IMPACTO ESTRATÉGICO (10 dimensiones)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa si cumplir el pedido empeora el estado futuro de la colonia.
 * Analiza 10 dimensiones: renovación · saturación · genética · consanguinidad ·
 * híbridos · capacidad · sanidad · pedidos futuros · mínimos · estabilidad.
 */
export function evaluarImpactoEstrategico({
  pedido, animales, camadas, jaulas,
  reproductoresSeleccionados, capacidadFutura, impactoColonia,
  indiceSanitario, pedidosTodos = [],
}) {
  const { bioterioId } = pedido
  const minimos = getMinimosCriticos(bioterioId)
  const ALERTA_DIAS = 240

  const riesgos = []
  const dimensiones = {}

  const { hembrasSugeridas, machosSugeridos } = reproductoresSeleccionados
  const seleccionados = [...hembrasSugeridas, ...machosSugeridos]

  // 1. RENOVACIÓN — ¿usa reproductores cerca del límite de edad?
  const cercaLimite = seleccionados.filter(e => e.diasVida >= ALERTA_DIAS)
  if (cercaLimite.length >= 2) {
    riesgos.push({ dimension: 'renovacion', nivel: 'critico',
      mensaje: `${cercaLimite.length} reproductores seleccionados cerca del límite de edad (${ALERTA_DIAS}d) — acelera la necesidad de renovación` })
  } else if (cercaLimite.length === 1) {
    riesgos.push({ dimension: 'renovacion', nivel: 'advertencia',
      mensaje: `1 reproductor seleccionado cerca del límite de edad — considerar reemplazo tras este pedido` })
  }
  dimensiones.renovacion = cercaLimite.length >= 2 ? 'critico' : cercaLimite.length === 1 ? 'advertencia' : 'ok'

  // 2. SATURACIÓN — ¿el pedido satura las jaulas?
  if (capacidadFutura.saturada) {
    riesgos.push({ dimension: 'saturacion', nivel: 'critico',
      mensaje: `+${capacidadFutura.jaulasNuevas} jaulas → total ${capacidadFutura.jaulasTotal} (umbral 20) — saturación de instalaciones` })
  } else if (capacidadFutura.porcentajeUso > 75) {
    riesgos.push({ dimension: 'saturacion', nivel: 'advertencia',
      mensaje: `Se usará el ${capacidadFutura.porcentajeUso}% de la capacidad estimada — margen reducido para otros apareamientos` })
  }
  dimensiones.saturacion = capacidadFutura.saturada ? 'critico' : capacidadFutura.porcentajeUso > 75 ? 'advertencia' : 'ok'

  // 3. GENÉTICA — F promedio de los reproductores seleccionados
  const fPromedio = seleccionados.length > 0
    ? seleccionados.reduce((a, e) => a + (e.fAnimal ?? 0), 0) / seleccionados.length : 0
  if (fPromedio >= 0.25) {
    riesgos.push({ dimension: 'genetica', nivel: 'critico',
      mensaje: `F promedio de la selección: ${(fPromedio * 100).toFixed(1)}% — riesgo de depresión consanguínea en las crías` })
  } else if (fPromedio >= 0.125) {
    riesgos.push({ dimension: 'genetica', nivel: 'advertencia',
      mensaje: `F promedio de la selección: ${(fPromedio * 100).toFixed(1)}% — consanguinidad moderada en crías esperadas` })
  }
  dimensiones.genetica = fPromedio >= 0.25 ? 'critico' : fPromedio >= 0.125 ? 'advertencia' : 'ok'

  // 4. CONSANGUINIDAD — idem pero umbral menor (leve = 6.25%)
  dimensiones.consanguinidad = fPromedio >= 0.25 ? 'critico' : fPromedio >= 0.0625 ? 'advertencia' : 'ok'

  // 5. HÍBRIDOS — ¿usa animales marcados para F1?
  const usaExportados = seleccionados.filter(e => e.animal?.exportado_hibridos)
  if (usaExportados.length > 0) {
    riesgos.push({ dimension: 'hibridos', nivel: 'critico',
      mensaje: `${usaExportados.length} reproductor(es) marcados para Híbridos F1 en la selección — compromete producción de cruzas` })
  }
  dimensiones.hibridos = usaExportados.length > 0 ? 'critico' : 'ok'

  // 6. CAPACIDAD — igual que saturación
  dimensiones.capacidad = dimensiones.saturacion

  // 7. SANIDAD — índice sanitario bajo
  if (indiceSanitario < 50) {
    riesgos.push({ dimension: 'sanidad', nivel: 'critico',
      mensaje: `Índice sanitario crítico (${indiceSanitario}/100) — no recomendable iniciar nuevas camadas hasta resolver incidentes activos` })
  } else if (indiceSanitario < 75) {
    riesgos.push({ dimension: 'sanidad', nivel: 'advertencia',
      mensaje: `Índice sanitario reducido (${indiceSanitario}/100) — mayor riesgo de fallos reproductivos en este pedido` })
  }
  dimensiones.sanidad = indiceSanitario < 50 ? 'critico' : indiceSanitario < 75 ? 'advertencia' : 'ok'

  // 8. PEDIDOS FUTUROS — otros pedidos pendientes del mismo bioterio
  const otrosPendientes = pedidosTodos.filter(p =>
    p.id !== pedido.id && p.bioterioId === bioterioId &&
    ['pendiente', 'en_proceso'].includes(p.estado)
  )
  if (otrosPendientes.length >= 2) {
    riesgos.push({ dimension: 'pedidos_futuros', nivel: 'advertencia',
      mensaje: `${otrosPendientes.length} pedidos adicionales pendientes — reservar reproductores ahora puede dificultar su ejecución` })
  }
  dimensiones.pedidos_futuros = otrosPendientes.length >= 2 ? 'advertencia' : 'ok'

  // 9. REPRODUCTORES MÍNIMOS — del impacto sobre colonia existente
  dimensiones.reproductores_minimos = impactoColonia.riesgoNivel

  // 10. ESTABILIDAD COLONIA — evaluación global
  const nCriticos    = Object.values(dimensiones).filter(v => v === 'critico').length
  const nAdvertencias = Object.values(dimensiones).filter(v => v === 'advertencia').length
  dimensiones.estabilidad = nCriticos >= 2 ? 'critico' : nCriticos >= 1 || nAdvertencias >= 3 ? 'advertencia' : 'ok'

  // ¿Cumplir el pedido empeora el estado futuro?
  const empeoraEstado = nCriticos >= 1 || nAdvertencias >= 3

  return {
    riesgos, dimensiones, empeoraEstado,
    nCriticos, nAdvertencias,
    fPromedioSeleccionados: fPromedio,
    otrosPendientes: otrosPendientes.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 16 — ÍNDICE DE IMPACTO FUTURO (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Índice 0-100 que mide si cumplir el pedido mejora o deteriora la colonia.
 * 🟢 ≥67  mejora o neutro positivo
 * 🟡 33-66 neutro
 * 🔴 <33   deteriora
 */
export function calcularIndiceImpactoFuturo(impactoEstrategico, indiceSanitario, superavit) {
  let score = 100
  const { dimensiones } = impactoEstrategico

  if (dimensiones.renovacion === 'critico')          score -= 20
  else if (dimensiones.renovacion === 'advertencia') score -= 8

  if (dimensiones.saturacion === 'critico')          score -= 18
  else if (dimensiones.saturacion === 'advertencia') score -= 7

  if (dimensiones.genetica === 'critico')            score -= 18
  else if (dimensiones.genetica === 'advertencia')   score -= 7

  if (dimensiones.hibridos === 'critico')            score -= 20

  if (dimensiones.sanidad === 'critico')             score -= 20
  else if (dimensiones.sanidad === 'advertencia')    score -= 8

  if (dimensiones.reproductores_minimos === 'critico')     score -= 25
  else if (dimensiones.reproductores_minimos === 'advertencia') score -= 10

  if (dimensiones.pedidos_futuros === 'advertencia') score -= 5

  // Bonus si hay superávit (el pedido ayuda a equilibrar)
  if (superavit?.esSignificativo) score += 10
  if (indiceSanitario >= 90) score += 5

  score = Math.max(0, Math.min(100, Math.round(score)))

  const emoji  = score >= 67 ? '🟢' : score >= 34 ? '🟡' : '🔴'
  const label  = score >= 67 ? 'mejora colonia' : score >= 34 ? 'neutro' : 'deteriora colonia'
  const color  = score >= 67 ? '#00e676' : score >= 34 ? '#ffb300' : '#ff6b80'
  const bg     = score >= 67 ? 'rgba(0,230,118,0.08)' : score >= 34 ? 'rgba(255,179,0,0.08)' : 'rgba(255,61,87,0.08)'
  const borde  = score >= 67 ? 'rgba(0,230,118,0.25)' : score >= 34 ? 'rgba(255,179,0,0.25)' : 'rgba(255,61,87,0.25)'

  return { score, emoji, label, color, bg, borde }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 17 — SIMULADOR ESTRATÉGICO (Escenarios A / B / C)
// ─────────────────────────────────────────────────────────────────────────────

function _scoreEscenario({ cumplimiento, saturada, rompeMinimo, indiceSanitario, bonusPreparacion = false }) {
  let s = Math.round(cumplimiento * 0.4)         // hasta 40 pts
  s += rompeMinimo ? 0 : 25                      // 25 pts — mínimos respetados
  s += saturada    ? 0 : 20                      // 20 pts — sin saturación
  s += Math.round((indiceSanitario / 100) * 10)  // hasta 10 pts — sanidad
  if (bonusPreparacion) s += 5                   // 5 pts — más tiempo de preparación
  return Math.min(100, Math.max(0, s))
}

/**
 * Genera tres escenarios con análisis multidimensional y elige la estrategia óptima
 * según la jerarquía de prioridades (supervivencia > mínimos > híbridos > pedidos ...).
 */
export function simularEscenariosEstrategicos(pedido, camadas, animales, jaulas, indiceSanitario) {
  const bio    = getBio(pedido.bioterioId)
  const hist   = calcularProduccionHistorica(camadas, pedido.bioterioId)
  const minimos = getMinimosCriticos(pedido.bioterioId)
  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']

  const hembrasTotal = animales.filter(a =>
    a.bioterio_id === pedido.bioterioId && a.sexo === 'hembra' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length
  const machosTotal = animales.filter(a =>
    a.bioterio_id === pedido.bioterioId && a.sexo === 'macho' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length
  const jaulasCount = (jaulas ?? []).filter(j => {
    const c = camadas.find(c2 => c2.id === j.camada_id)
    return c?.bioterio_id === pedido.bioterioId && !c?.failure_flag
  }).length

  // ── Escenario A: Buffer completo ──────────────────────────────────────────
  const parejasA = calcularParejasNecesarias(pedido, camadas, bio)
  const jaulasA  = jaulasCount + parejasA.parejasNecesarias
  const saturadaA = jaulasA > 20
  const hResta_A  = hembrasTotal - parejasA.hembrasNecesarias
  const mResta_A  = machosTotal  - parejasA.machosNecesarios
  const rompeA    = hResta_A < (minimos.hembras_colonia ?? 0) || mResta_A < (minimos.machos_colonia ?? 0)

  // ── Escenario B: Sin buffer ───────────────────────────────────────────────
  const propSexo = pedido.sexo === 'hembras' ? hist.propHembras
    : pedido.sexo === 'machos' ? (1 - hist.propHembras) : 1
  const animalesUtiles = hist.promedioTamano * hist.tasaSupervivencia * propSexo
  const parejasBaseB = animalesUtiles > 0
    ? Math.ceil(pedido.cantidad / animalesUtiles) : pedido.cantidad
  const machosBaseB = Math.max(1, Math.ceil(parejasBaseB / 3))
  const probB    = Math.min(88, Math.max(20, Math.round(hist.tasaExito * hist.tasaSupervivencia * 80)))
  const jaulasB  = jaulasCount + parejasBaseB
  const saturadaB = jaulasB > 20
  const hResta_B  = hembrasTotal - parejasBaseB
  const mResta_B  = machosTotal  - machosBaseB
  const rompeB    = hResta_B < (minimos.hembras_colonia ?? 0) || mResta_B < (minimos.machos_colonia ?? 0)

  // ── Escenario C: Retrasar 2 semanas (mismo buffer, menos presión inmediata) ──
  const probC    = Math.min(97, parejasA.probabilidad + 5)
  const jaulasC  = jaulasA  // mismas jaulas que A, diferente timing
  const saturadaC = jaulasC > 20
  const hResta_C  = hResta_A
  const mResta_C  = mResta_A
  const rompeC    = rompeA

  const escenarios = [
    {
      id: 'a', label: 'Recomendado', emoji: '🟢',
      hembras: parejasA.hembrasNecesarias, machos: parejasA.machosNecesarios,
      jaulasNuevas: parejasA.parejasNecesarias, jaulasTotal: jaulasA,
      animalesEstimados: parejasA.animalesEstimados,
      probabilidad: parejasA.probabilidad, retraso: 0,
      saturada: saturadaA, rompeMinimo: rompeA,
      hembrasRestantes: hResta_A, machosRestantes: mResta_A,
      descripcion: 'Buffer completo — alta seguridad de cumplimiento, mayor uso de la colonia',
      score: _scoreEscenario({ cumplimiento: parejasA.probabilidad, saturada: saturadaA, rompeMinimo: rompeA, indiceSanitario }),
    },
    {
      id: 'b', label: 'Mínimo', emoji: '🟡',
      hembras: parejasBaseB, machos: machosBaseB,
      jaulasNuevas: parejasBaseB, jaulasTotal: jaulasB,
      animalesEstimados: Math.round(parejasBaseB * hist.promedioTamano * hist.tasaSupervivencia),
      probabilidad: probB, retraso: 0,
      saturada: saturadaB, rompeMinimo: rompeB,
      hembrasRestantes: hResta_B, machosRestantes: mResta_B,
      descripcion: 'Sin buffer — menor impacto en colonia, riesgo de quedar corto en cantidad',
      score: _scoreEscenario({ cumplimiento: probB, saturada: saturadaB, rompeMinimo: rompeB, indiceSanitario }),
    },
    {
      id: 'c', label: 'Retrasar 2 sem', emoji: '🔵',
      hembras: parejasA.hembrasNecesarias, machos: parejasA.machosNecesarios,
      jaulasNuevas: parejasA.parejasNecesarias, jaulasTotal: jaulasC,
      animalesEstimados: parejasA.animalesEstimados,
      probabilidad: probC, retraso: 14,
      saturada: saturadaC, rompeMinimo: rompeC,
      hembrasRestantes: hResta_C, machosRestantes: mResta_C,
      descripcion: 'Mismo buffer, cópulas en 14 días — menos presión inmediata, +5% probabilidad por mejor preparación',
      score: _scoreEscenario({ cumplimiento: probC, saturada: saturadaC, rompeMinimo: rompeC, indiceSanitario, bonusPreparacion: true }),
    },
  ]

  const optima = _determinarEstrategiaOptima(escenarios)
  return { escenarios, optima }
}

/**
 * Jerarquía de decisión:
 * 1. No romper mínimos  2. No saturar  3. Mayor score (cumplimiento + sanidad + preparación)
 */
function _determinarEstrategiaOptima(escenarios) {
  const sinRomper   = escenarios.filter(e => !e.rompeMinimo)
  const candidatos1 = sinRomper.length > 0 ? sinRomper : escenarios
  const sinSaturar  = candidatos1.filter(e => !e.saturada)
  const candidatos2 = sinSaturar.length > 0 ? sinSaturar : candidatos1
  candidatos2.sort((a, b) => b.score - a.score)
  const elegido = candidatos2[0]

  let razon
  if (elegido.rompeMinimo) {
    razon = 'Ningún escenario respeta los mínimos — se selecciona el de menor daño a la colonia'
  } else if (elegido.saturada) {
    razon = 'Todos los escenarios saturan las jaulas — se selecciona el de mayor cumplimiento'
  } else {
    razon = `Mínimos respetados · ${elegido.saturada ? 'jaulas al límite' : 'sin saturación'} · ${elegido.probabilidad}% de cumplimiento`
  }

  return { id: elegido.id, label: elegido.label, emoji: elegido.emoji, razon }
}
