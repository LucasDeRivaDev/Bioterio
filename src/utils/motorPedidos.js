// ─────────────────────────────────────────────────────────────────────────────
// motorPedidos.js — Motor de planificación y gestión de pedidos de producción
// Parejas · Fechas · Reproductores · Viabilidad · Escenarios · Calendario
// ─────────────────────────────────────────────────────────────────────────────

import { difDias, parseDate, calcularPerfilHembra, calcularRendimientoMacho } from './calculos'
import { getBio } from './constants'
import { buildPedigree, calcularFCoeficiente } from './genealogia'
import { getMinimosCriticos, getReservas } from './motorDecisiones'

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
export function calcularParejasNecesarias(pedido, camadas) {
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
  const parejas = calcularParejasNecesarias(pedido, camadas)
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
    // Texto para la UI: nunca mostrar "Operación segura" si rompe mínimos
    etiquetaRiesgo: (rompeHembras || rompeMachos)
      ? '🔴 Riesgo colonia'
      : riesgoNivel === 'advertencia'
      ? '🟠 Advertencia'
      : '🟢 Sin riesgo para la colonia',
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
  reproductoresSeleccionados,
  animalesListos,
  impactoColonia,
  capacidadFutura,
  indiceSanitario = 100,
  riesgoMultifactorial = null,  // resultado de evaluarRiesgoMultifactorialPedido
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

  let score = Math.max(0, Math.min(100,
    detalle.tiempo + detalle.reproductores + detalle.minimos +
    detalle.stockActual + detalle.capacidad + detalle.sanitario
  ))

  // 7. Penalización multifactorial (genética + temperatura + incidentes + consanguinidad)
  if (riesgoMultifactorial) {
    if (riesgoMultifactorial.nivel === 'critico')  score = Math.max(0, score - 15)
    else if (riesgoMultifactorial.nivel === 'alerta') score = Math.max(0, score - 7)
    detalle.riesgoMultifactorial = riesgoMultifactorial.penalizacion ?? 0
  }

  // REGLA DURA: si se rompen mínimos reproductivos → nunca mostrar "Viable"
  // Cap a 59 para forzar "Con riesgo" o peor, nunca "Viable" (≥75)
  const rompeMinimosCriticos = impactoColonia.riesgoNivel === 'critico'
  if (rompeMinimosCriticos) {
    score = Math.min(score, 59)
  }

  return { score: Math.round(score), detalle, rompeMinimosCriticos }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 9b — RIESGO MULTIFACTORIAL DE PEDIDO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa los factores de riesgo que pueden comprometer el éxito del pedido:
 *   - Genética: F promedio de los reproductores sugeridos
 *   - Supervivencia: tasa histórica baja en últimos 90 días
 *   - Temperatura: días fuera de rango en últimos 14 días
 *   - Incidentes graves activos en el bioterio
 *   - Malformaciones recientes (90 días)
 *
 * Retorna: { nivel: 'ok'|'info'|'alerta'|'critico', bloquear, penalizacion, factores[] }
 */
export function evaluarRiesgoMultifactorialPedido({
  reproductoresSeleccionados,
  camadas,
  temperaturas,
  incidentes,
  bioterioId,
}) {
  const factores = []
  let penalizacion = 0

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hace90 = new Date(hoy); hace90.setDate(hace90.getDate() - 90)
  const hace14 = new Date(hoy); hace14.setDate(hace14.getDate() - 14)
  const ISO90  = hace90.toISOString().slice(0, 10)
  const ISO14  = hace14.toISOString().slice(0, 10)

  // 1. F promedio de los reproductores sugeridos
  const todos = [
    ...(reproductoresSeleccionados?.hembrasSugeridas ?? []),
    ...(reproductoresSeleccionados?.machosSugeridos  ?? []),
  ]
  if (todos.length > 0) {
    const fProm = todos.reduce((a, e) => a + (e.fAnimal ?? 0), 0) / todos.length
    if (fProm >= 0.25) {
      factores.push({ tipo: 'genetico', nivel: 'critico',
        desc: `F promedio selección ${(fProm * 100).toFixed(1)}% — depresión consanguínea probable en crías` })
      penalizacion += 15
    } else if (fProm >= 0.125) {
      factores.push({ tipo: 'genetico', nivel: 'alerta',
        desc: `F promedio selección ${(fProm * 100).toFixed(1)}% — consanguinidad moderada` })
      penalizacion += 7
    }
  }

  // 2. Supervivencia baja en últimos 90 días
  const cam90 = camadas.filter(c =>
    c.bioterio_id === bioterioId &&
    c.fecha_nacimiento >= ISO90 &&
    c.total_crias > 0 &&
    c.total_destetados != null
  )
  if (cam90.length >= 3) {
    const srProm = cam90.reduce((a, c) => a + c.total_destetados / c.total_crias, 0) / cam90.length
    if (srProm < 0.55) {
      factores.push({ tipo: 'supervivencia', nivel: 'critico',
        desc: `Supervivencia al destete últimos 90d: ${(srProm * 100).toFixed(0)}% — muy por debajo de la media` })
      penalizacion += 12
    } else if (srProm < 0.70) {
      factores.push({ tipo: 'supervivencia', nivel: 'alerta',
        desc: `Supervivencia al destete últimos 90d: ${(srProm * 100).toFixed(0)}% — reducida` })
      penalizacion += 5
    }
  }

  // 3. Temperatura fuera de rango últimos 14 días
  const RANGO_MIN = 18, RANGO_MAX = 26
  const temps14 = (temperaturas ?? []).filter(t =>
    t.bioterio_id === bioterioId && t.date >= ISO14 && t.current_temp != null
  )
  const diasFueraRango = temps14.filter(t =>
    t.current_temp < RANGO_MIN || t.current_temp > RANGO_MAX
  ).length
  if (diasFueraRango >= 5) {
    factores.push({ tipo: 'ambiental', nivel: 'critico',
      desc: `${diasFueraRango} días fuera de rango térmico en últimos 14d — estrés sostenido` })
    penalizacion += 10
  } else if (diasFueraRango >= 2) {
    factores.push({ tipo: 'ambiental', nivel: 'alerta',
      desc: `${diasFueraRango} días fuera de rango térmico en últimos 14d` })
    penalizacion += 4
  }

  // 4. Incidentes graves activos
  const incGraves = (incidentes ?? []).filter(i =>
    (i.bioterio_id === bioterioId || !i.bioterio_id) &&
    i.severidad === 'grave' &&
    !i.resuelto
  )
  if (incGraves.length >= 3) {
    factores.push({ tipo: 'sanitario', nivel: 'critico',
      desc: `${incGraves.length} incidentes graves activos sin resolver — no recomendable iniciar nuevas camadas` })
    penalizacion += 15
  } else if (incGraves.length >= 1) {
    factores.push({ tipo: 'sanitario', nivel: 'alerta',
      desc: `${incGraves.length} incidente(s) grave(s) activo(s) — monitoreo obligatorio` })
    penalizacion += 6
  }

  // 5. Malformaciones recientes (90 días) — en incidentes o camadas
  const malform90 = (incidentes ?? []).filter(i =>
    (i.bioterio_id === bioterioId || !i.bioterio_id) &&
    (i.tipo_incidente === 'malformacion' || i.tipo_categoria === 'crias') &&
    i.fecha >= ISO90
  ).length

  if (malform90 >= 3) {
    factores.push({ tipo: 'genetico', nivel: 'critico',
      desc: `${malform90} malformaciones registradas en 90 días — posible problema genético sistémico` })
    penalizacion += 12
  } else if (malform90 >= 1) {
    factores.push({ tipo: 'genetico', nivel: 'alerta',
      desc: `${malform90} malformación(es) reciente(s) — vigilar líneas afectadas` })
    penalizacion += 4
  }

  // Nivel global
  const nivelFinal = penalizacion >= 30 ? 'critico'
    : penalizacion >= 12 ? 'alerta'
    : penalizacion >= 1  ? 'info'
    : 'ok'

  const bloquear = nivelFinal === 'critico'

  return { nivel: nivelFinal, bloquear, penalizacion, factores }
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
  const hist = calcularProduccionHistorica(camadas, pedido.bioterioId)

  // Escenario A: buffer completo
  const parejasA = calcularParejasNecesarias(pedido, camadas)

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
  pedido,
  reproductoresSeleccionados, capacidadFutura, impactoColonia,
  indiceSanitario, pedidosTodos = [],
}) {
  const { bioterioId } = pedido
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
  const parejasA = calcularParejasNecesarias(pedido, camadas)
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
      id: 'a', label: 'Recomendada', emoji: '🟢',
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
      id: 'b', label: 'Conservadora', emoji: '🟡',
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
      id: 'c', label: 'Con retraso (+2 sem)', emoji: '🔵',
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

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 18 — REPRODUCTORES PRÓXIMOS A MADURAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detecta animales que aún no alcanzaron el 85% de madurez pero están en
 * el rango 60–85%. Usados para mostrar "disponibles en Xd" en lugar de
 * "sin candidatos".
 */
export function detectarReproductoresProximos(pedido, animales) {
  const { bioterioId } = pedido
  const bio = getBio(bioterioId)
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const MIN_MADURO  = Math.round(bio.MADUREZ_DIAS * 0.85)
  const MIN_PROXIMO = Math.round(bio.MADUREZ_DIAS * 0.60)

  const proximos = animales
    .filter(a =>
      a.bioterio_id === bioterioId &&
      a.estado === 'activo' &&
      !a.exportado_hibridos &&
      a.fecha_nacimiento
    )
    .map(a => {
      const diasVida = difDias(a.fecha_nacimiento, hoyDate)
      if (diasVida >= MIN_MADURO) return null  // ya maduro — lo toma seleccionarReproductoresOptimos
      if (diasVida < MIN_PROXIMO) return null  // demasiado joven
      return { animal: a, diasVida, diasParaMadurar: MIN_MADURO - diasVida }
    })
    .filter(Boolean)
    .sort((a, b) => a.diasParaMadurar - b.diasParaMadurar)

  return {
    proximos,
    hembrasProximas: proximos.filter(p => p.animal.sexo === 'hembra'),
    machosProximos:  proximos.filter(p => p.animal.sexo === 'macho'),
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 19 — PRODUCCIÓN EN CURSO
// Detecta camadas activas (en gestación / cría) cuyos animales estarán
// disponibles en el rango de edad requerido al momento de la entrega.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Proyecta cuántos animales del tipo/sexo/edad requeridos por el pedido
 * ya están "en camino" a partir de camadas activas del bioterio.
 *
 * Consideraciones:
 *   - Camadas con fecha_nacimiento: usa datos reales de la camada
 *   - Camadas con fecha_copula sin parto: proyecta nacimiento (cópula + gestación + ventana/2)
 *   - Ventana de edad aceptable: [edadRequerida−14d, edadRequerida+42d]
 */
export function calcularProduccionEnCurso(pedido, camadas, sacrificios, entregas) {
  const { bioterioId, cantidad, sexo, edadSemanas, fechaEntrega } = pedido
  const necesarios = Number(cantidad) || 0
  const vacío = { tandas: [], totalProyectado: 0, necesarios, cubiertoConProduccion: false, porcentajeCubierto: 0 }

  if (!edadSemanas || !fechaEntrega) return vacío

  const bio = getBio(bioterioId)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const entregaDate = parseDate(fechaEntrega)
  if (!entregaDate) return vacío

  const edadDias   = Number(edadSemanas) * 7
  const MARGEN_MIN = 14   // hasta 2 semanas más joven que lo requerido
  const MARGEN_MAX = 42   // hasta 6 semanas más viejo

  const hist = calcularProduccionHistorica(camadas, bioterioId)
  const propSexo = sexo === 'hembras' ? hist.propHembras
    : sexo === 'machos' ? (1 - hist.propHembras)
    : 1

  // Bajas acumuladas por camada (sacrificios + entregas)
  const bajasPor = {}
  for (const s of (sacrificios ?? [])) {
    if (s.camada_id) bajasPor[s.camada_id] = (bajasPor[s.camada_id] || 0) + (s.cantidad || 0)
  }
  for (const e of (entregas ?? [])) {
    if (e.camada_id) bajasPor[e.camada_id] = (bajasPor[e.camada_id] || 0) + (e.cantidad || 0)
  }

  const toISO = d => d.toISOString().split('T')[0]
  const tandas = []

  for (const c of camadas) {
    if (c.bioterio_id !== bioterioId || c.failure_flag) continue

    let nacimiento = null
    let esFutura   = false
    let estado     = ''

    if (c.fecha_nacimiento) {
      nacimiento = parseDate(c.fecha_nacimiento)
      estado     = c.fecha_destete ? 'destetada' : 'en_cria'
    } else if (c.fecha_copula) {
      const copula = parseDate(c.fecha_copula)
      if (!copula) continue
      nacimiento = new Date(copula)
      nacimiento.setDate(nacimiento.getDate() + bio.GESTACION_DIAS + Math.round(bio.VENTANA_CONCEPCION_MAX / 2))
      estado   = 'en_gestacion'
      esFutura = true
    } else continue

    if (!nacimiento) continue

    // ¿Los animales tendrán la edad correcta en la fecha de entrega?
    const edadAlEntrega = Math.round((entregaDate - nacimiento) / 86400000)
    if (edadAlEntrega < edadDias - MARGEN_MIN) continue  // nacerán demasiado tarde
    if (edadAlEntrega > edadDias + MARGEN_MAX) continue  // ya serán muy viejos
    if (nacimiento > entregaDate) continue               // nacen después de la entrega

    // Cantidad disponible del sexo requerido
    let dispDelSexo = 0
    if (!esFutura && c.total_crias) {
      const bajas    = bajasPor[c.id] || 0
      const total    = Math.max(0, (c.total_destetados ?? Math.round(c.total_crias * hist.tasaSupervivencia)) - bajas)
      if (c.crias_hembras != null && c.crias_machos != null && c.total_crias > 0) {
        const propH = c.crias_hembras / c.total_crias
        dispDelSexo = sexo === 'hembras' ? Math.round(total * propH)
          : sexo === 'machos' ? Math.round(total * (1 - propH))
          : total
      } else {
        dispDelSexo = Math.round(total * propSexo)
      }
    } else {
      // Gestación en curso → usar promedios históricos
      dispDelSexo = Math.round(hist.promedioTamano * hist.tasaSupervivencia * propSexo)
    }

    if (dispDelSexo <= 0) continue

    // Fecha en que alcanzarán la edad requerida
    const fechaDisponible = new Date(nacimiento)
    fechaDisponible.setDate(fechaDisponible.getDate() + bio.DESTETE_DIAS + edadDias)

    tandas.push({
      camadaId:            c.id,
      fechaNacimiento:     toISO(nacimiento),
      fechaDisponible:     toISO(fechaDisponible),
      diasHastaDisponible: Math.round((fechaDisponible - hoy) / 86400000),
      dispDelSexo,
      esFutura,
      estado,
    })
  }

  tandas.sort((a, b) => a.fechaDisponible.localeCompare(b.fechaDisponible))

  const totalProyectado = tandas.reduce((a, t) => a + t.dispDelSexo, 0)
  return {
    tandas,
    totalProyectado,
    necesarios,
    cubiertoConProduccion:   totalProyectado >= necesarios,
    porcentajeCubierto: Math.min(100, Math.round((totalProyectado / Math.max(1, necesarios)) * 100)),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 20 — PEDIDO ESCALONADO
// Divide un pedido en N tandas con fechas de entrega periódicas y
// calcula el cronograma reproductivo de cada una.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera las N tandas de un pedido escalonado.
 * Cada tanda tiene su propio cronograma biológico (cópula → entrega).
 * Retorna null si el pedido no es escalonado o le faltan datos.
 */
export function calcularPedidoEscalonado(pedido) {
  if (pedido.modalidad !== 'escalonada') return null
  const { fechaEntrega, cantidadPorTanda, frecuenciaDias, tandasTotal, bioterioId } = pedido
  if (!fechaEntrega || !cantidadPorTanda || !frecuenciaDias || !tandasTotal) return null

  const bio  = getBio(bioterioId)
  const base = parseDate(fechaEntrega)
  if (!base) return null

  const toISO = d => d.toISOString().split('T')[0]
  const tandas = []

  for (let i = 0; i < Number(tandasTotal); i++) {
    const fechaEsta = new Date(base)
    fechaEsta.setDate(fechaEsta.getDate() + i * Number(frecuenciaDias))
    const pedidoTanda = {
      ...pedido,
      cantidad:     Number(cantidadPorTanda),
      fechaEntrega: toISO(fechaEsta),
    }
    const fechas = calcularFechasOptimas(pedidoTanda, bio)
    tandas.push({
      numero:       i + 1,
      cantidad:     Number(cantidadPorTanda),
      fechaEntrega: toISO(fechaEsta),
      fechas,
    })
  }

  return {
    tandas,
    totalAnimales:    Number(cantidadPorTanda) * Number(tandasTotal),
    cantidadPorTanda: Number(cantidadPorTanda),
    frecuenciaDias:   Number(frecuenciaDias),
    tandasTotal:      Number(tandasTotal),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 21 — CAPACIDAD REPRODUCTIVA DINÁMICA
// Clasifica animales en categorías y determina qué generación llega
// a la edad requerida en la fecha de entrega.
// ─────────────────────────────────────────────────────────────────────────────

export function calcularCapacidadReproductivaDinamica(pedido, animales, camadas, jaulas, sacrificios, entregas) {
  const { bioterioId, fechaEntrega, edadSemanas } = pedido
  const bio    = getBio(bioterioId)
  const hist   = calcularProduccionHistorica(camadas, bioterioId)
  const minimos = getMinimosCriticos(bioterioId)

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']

  const LIMITE_DIAS  = 270
  const MADUREZ_MIN  = Math.round(bio.MADUREZ_DIAS * 0.85)
  const MADUREZ_PROX = Math.round(bio.MADUREZ_DIAS * 0.60)

  const todosAnimalesBio = (animales ?? []).filter(a =>
    a.bioterio_id === bioterioId && !a.exportado_hibridos
  )

  // ── Clasificar reproductores ───────────────────────────────────────────────
  const minimoH = minimos.hembras_colonia ?? 0
  const minimoM = minimos.machos_colonia  ?? 0
  let hembrasProtegidas = 0
  let machosProtegidos  = 0

  const protegidos         = []
  const disponiblesRepro   = []
  const futurosReproductores = []
  const noAptos            = []

  const hembrasActivas = todosAnimalesBio.filter(a => a.sexo === 'hembra' && estadosActivos.includes(a.estado)).length
  const machosActivos  = todosAnimalesBio.filter(a => a.sexo === 'macho'  && estadosActivos.includes(a.estado)).length

  for (const a of todosAnimalesBio) {
    if (!estadosActivos.includes(a.estado)) continue
    const diasVida = a.fecha_nacimiento ? difDias(a.fecha_nacimiento, hoy) : bio.MADUREZ_DIAS + 30

    if (diasVida > LIMITE_DIAS) {
      noAptos.push({ animal: a, razon: 'Superó límite de edad', diasVida }); continue
    }
    if (diasVida >= MADUREZ_PROX && diasVida < MADUREZ_MIN) {
      futurosReproductores.push({ animal: a, diasVida, diasParaMadurar: MADUREZ_MIN - diasVida }); continue
    }
    if (diasVida < MADUREZ_PROX) continue

    // Maduro — ¿es parte de los mínimos protegidos?
    if (a.sexo === 'hembra' && hembrasProtegidas < minimoH) {
      hembrasProtegidas++; protegidos.push({ animal: a, diasVida })
    } else if (a.sexo === 'macho' && machosProtegidos < minimoM) {
      machosProtegidos++;  protegidos.push({ animal: a, diasVida })
    } else {
      disponiblesRepro.push({ animal: a, diasVida })
    }
  }

  // ── Clasificar stock (crías en jaulas) ────────────────────────────────────
  const bajasPor = {}
  for (const s of (sacrificios ?? [])) {
    if (s.camada_id) bajasPor[s.camada_id] = (bajasPor[s.camada_id] || 0) + (s.cantidad || 0)
  }
  for (const e of (entregas ?? [])) {
    if (e.camada_id) bajasPor[e.camada_id] = (bajasPor[e.camada_id] || 0) + (e.cantidad || 0)
  }

  const entregaDate = fechaEntrega ? parseDate(fechaEntrega) : null
  const edadDias    = edadSemanas  ? Number(edadSemanas) * 7 : 0

  let stockLibre       = 0
  let futurosEntregables = 0

  for (const jaula of (jaulas ?? [])) {
    const camada = camadas.find(c => c.id === jaula.camada_id)
    if (!camada || camada.bioterio_id !== bioterioId || camada.failure_flag || !camada.fecha_nacimiento) continue

    const bajas = bajasPor[jaula.camada_id] || 0
    const total = Math.max(0, (jaula.total || 0) - bajas)
    if (total <= 0) continue

    const diasVida = difDias(camada.fecha_nacimiento, hoy)

    if (entregaDate && edadDias > 0) {
      const edadAlEntrega = Math.round((entregaDate - new Date(camada.fecha_nacimiento)) / 86400000)
      if (edadAlEntrega >= edadDias - 14 && edadAlEntrega <= edadDias + 42) {
        if (diasVida >= edadDias) stockLibre += total
        else futurosEntregables += Math.round(total * hist.tasaSupervivencia)
        continue
      }
    }
    if (diasVida >= MADUREZ_MIN) stockLibre += total
    else futurosEntregables += Math.round(total * hist.tasaSupervivencia)
  }

  // ── Análisis de generaciones ──────────────────────────────────────────────
  const diasHastaEntrega = entregaDate ? Math.round((entregaDate - hoy) / 86400000) : null
  const cicloGen1 = bio.DURACION_APAREAMIENTO_DIAS + bio.GESTACION_DIAS + bio.VENTANA_CONCEPCION_MAX + bio.DESTETE_DIAS + edadDias
  const cicloGen2 = cicloGen1 + bio.MADUREZ_DIAS + bio.DURACION_APAREAMIENTO_DIAS + bio.GESTACION_DIAS + bio.VENTANA_CONCEPCION_MAX + bio.DESTETE_DIAS

  let generacionRequerida    = 'Gen0'
  let descripcionGeneracion  = 'Solo el stock actual llega a tiempo'
  let emoji                  = '0️⃣'

  if (diasHastaEntrega !== null) {
    if (diasHastaEntrega < edadDias) {
      generacionRequerida   = 'Sin tiempo'; emoji = '⛔'
      descripcionGeneracion = 'Tiempo insuficiente — el stock actual tampoco llega a la edad requerida'
    } else if (diasHastaEntrega >= cicloGen2) {
      generacionRequerida   = 'Gen2'; emoji = '🧬'
      descripcionGeneracion = `Hay tiempo para 2 generaciones — los nietos de los reproductores actuales llegarán a ${edadSemanas} semanas el día de la entrega`
    } else if (diasHastaEntrega >= cicloGen1) {
      generacionRequerida   = 'Gen1'; emoji = '🐀'
      descripcionGeneracion = `Los hijos de los reproductores actuales llegarán exactamente a ${edadSemanas} semanas en la fecha de entrega`
    } else {
      generacionRequerida   = 'Gen0'; emoji = '📦'
      descripcionGeneracion = `Solo el stock actual llega a tiempo — no hay margen para producir una nueva generación completa`
    }
  }

  return {
    protegidos, disponiblesRepro, futurosReproductores, noAptos,
    hembrasProtegidas, machosProtegidos,
    hembrasDisponiblesRepro: disponiblesRepro.filter(r => r.animal.sexo === 'hembra').length,
    machosDisponiblesRepro:  disponiblesRepro.filter(r => r.animal.sexo === 'macho').length,
    hembrasActivas, machosActivos, minimoH, minimoM,
    stockLibre, futurosEntregables,
    totalEntregable: stockLibre + futurosEntregables,
    generacionRequerida, descripcionGeneracion, emoji,
    diasHastaEntrega,
    cicloGen1, cicloGen2,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 22 — CRECIMIENTO COLATERAL
// Calcula los excedentes que genera el pedido: hembras sobrantes,
// machos sobrantes, futuros reproductores, buffer para la colonia.
// ─────────────────────────────────────────────────────────────────────────────

export function calcularCrecimientoColateral(pedido, parejasInfo, hist) {
  const criasTotal       = parejasInfo.animalesEstimados
  const criasDelSexo     = parejasInfo.animalesDelSexo ?? Math.round(criasTotal * 0.5)
  const excedente        = Math.max(0, criasDelSexo - pedido.cantidad)
  const totalExcedente   = Math.max(0, criasTotal - pedido.cantidad)

  const hembrasSobrantes = Math.round(totalExcedente * hist.propHembras)
  const machosSobrantes  = Math.round(totalExcedente * (1 - hist.propHembras))

  const futuraReproductorasH = Math.round(hembrasSobrantes * 0.55)
  const futuraReproductoresM = Math.round(machosSobrantes  * 0.30)

  return {
    criasTotal, excedente, totalExcedente,
    hembrasSobrantes, machosSobrantes,
    futuraReproductorasH, futuraReproductoresM,
    potencialRenovacion: futuraReproductorasH > 0 || futuraReproductoresM > 0,
    descripcion: totalExcedente > 0
      ? `El pedido genera ~${totalExcedente} animales extra: ${hembrasSobrantes}♀ + ${machosSobrantes}♂ sobrantes.${futuraReproductorasH > 0 ? ` ~${futuraReproductorasH} hembras pueden convertirse en futuras reproductoras.` : ''}`
      : 'El pedido usa exactamente los animales necesarios — sin excedente reproductivo.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 23 — ESTRATEGIAS BIOLÓGICAS (7 tipos)
// Cada estrategia modifica realmente el comportamiento reproductivo:
// parejas, timing, generaciones, saturación, buffer, riesgos.
// ─────────────────────────────────────────────────────────────────────────────

function _scoreEstrategiaBio({ probabilidad, riesgoBiologico, riesgoGenetico, rompeMinimos, saturacion, viable = true }) {
  if (!viable || rompeMinimos) return 0
  return probabilidad - riesgoBiologico * 0.25 - riesgoGenetico * 0.2 - (saturacion ? 10 : 0)
}

function _optimalBio(estrategias, indiceSanitario) {
  const viables = estrategias.filter(e => e.viable !== false && !e.rompeMinimos)
  const candidatos = viables.length > 0 ? viables : estrategias.filter(e => e.viable !== false)
  const sinSaturar = candidatos.filter(e => !e.saturacion)
  const final = sinSaturar.length > 0 ? sinSaturar : candidatos

  // Penalizar estrategia bajo_impacto si el índice sanitario es bueno (no hace falta)
  final.sort((a, b) => {
    const sA = _scoreEstrategiaBio(a) + (indiceSanitario < 70 && a.id === 'bajo_impacto' ? 8 : 0)
    const sB = _scoreEstrategiaBio(b) + (indiceSanitario < 70 && b.id === 'bajo_impacto' ? 8 : 0)
    return sB - sA
  })

  const elegida = final[0]
  if (!elegida) return null

  const razones = []
  if (!elegida.rompeMinimos)    razones.push('respeta los mínimos de la colonia')
  if (!elegida.saturacion)      razones.push('no satura instalaciones')
  razones.push(`${elegida.probabilidad}% de probabilidad de cumplimiento`)
  if (elegida.crecimientoColateral?.totalExcedente > 0)
    razones.push(`genera ${elegida.crecimientoColateral.totalExcedente} animales extra de buffer`)

  return { id: elegida.id, nombre: elegida.nombre, emoji: elegida.emoji, razon: razones.join(' · '), estrategia: elegida }
}

export function generarEstrategiasBiologicas(pedido, camadas, animales, jaulas, indiceSanitario) {
  const bio    = getBio(pedido.bioterioId)
  const hist   = calcularProduccionHistorica(camadas, pedido.bioterioId)
  const minimos = getMinimosCriticos(pedido.bioterioId)
  const fechasBase = calcularFechasOptimas(pedido, bio)

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']
  const hembrasTotal = (animales ?? []).filter(a =>
    a.bioterio_id === pedido.bioterioId && a.sexo === 'hembra' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length
  const machosTotal = (animales ?? []).filter(a =>
    a.bioterio_id === pedido.bioterioId && a.sexo === 'macho' &&
    estadosActivos.includes(a.estado) && !a.exportado_hibridos
  ).length
  const jaulasCount = (jaulas ?? []).filter(j => {
    const c = camadas.find(c2 => c2.id === j.camada_id)
    return c?.bioterio_id === pedido.bioterioId && !c?.failure_flag
  }).length

  const propSexo   = pedido.sexo === 'hembras' ? hist.propHembras
    : pedido.sexo === 'machos' ? (1 - hist.propHembras) : 1
  const utilPorPareja = hist.promedioTamano * hist.tasaSupervivencia * propSexo

  const parejasBase   = utilPorPareja > 0 ? Math.ceil(pedido.cantidad / utilPorPareja) : pedido.cantidad
  const parejasBuffer = Math.ceil(parejasBase / hist.tasaExito)
  const parejasMax    = Math.ceil(parejasBuffer * 1.5)

  const machosBase   = Math.max(1, Math.ceil(parejasBase   / 3))
  const machosBuffer = Math.max(1, Math.ceil(parejasBuffer / 3))
  const machosMax    = Math.max(1, Math.ceil(parejasMax    / 3))

  const diasHastaEntrega = fechasBase?.diasHastaEntrega ?? 999

  function calcProb(parejas, factor) {
    return Math.min(97, Math.max(20, Math.round(
      hist.tasaExito * hist.tasaSupervivencia * 100 * Math.min(1.7, factor) * (hist.conDatos ? 1.1 : 0.85)
    )))
  }
  function rompeMin(h, m) {
    return (hembrasTotal - h) < (minimos.hembras_colonia ?? 0) ||
           (machosTotal  - m) < (minimos.machos_colonia  ?? 0)
  }
  function colateral(parejas) {
    const p = calcularParejasNecesarias({ ...pedido, _parejas: parejas }, camadas)
    return calcularCrecimientoColateral(pedido, p, hist)
  }

  // Helpers de fechas modificadas
  const toISO = d => d.toISOString().split('T')[0]
  function fechasConRetraso(diasExtra) {
    if (!fechasBase) return null
    const f = { ...fechasBase }
    const campos = ['fechaCopula','fechaSeparacion','fechaNacimiento','fechaDestete']
    for (const k of campos) {
      if (f[k]) {
        const d = new Date(f[k]); d.setDate(d.getDate() + diasExtra)
        f[k] = toISO(d)
      }
    }
    f.diasHastaCopula = (f.diasHastaCopula ?? 0) + diasExtra
    return f
  }

  // Reproductores mayores (cerca del límite)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const ALERTA_DIAS = 240
  const viejos = (animales ?? []).filter(a =>
    a.bioterio_id === pedido.bioterioId && estadosActivos.includes(a.estado) &&
    !a.exportado_hibridos && a.fecha_nacimiento &&
    difDias(a.fecha_nacimiento, hoy) >= ALERTA_DIAS
  ).length

  // Ciclo para estrategia generacional
  const cicloCompleto = bio.DURACION_APAREAMIENTO_DIAS + bio.GESTACION_DIAS +
    bio.VENTANA_CONCEPCION_MAX + bio.DESTETE_DIAS + bio.MADUREZ_DIAS
  const esViableMultigen = diasHastaEntrega >= cicloCompleto * 1.5 + (Number(pedido.edadSemanas ?? 8) * 7)

  const parejasGen1 = Math.ceil(parejasBuffer * 0.65)
  const machosGen1  = Math.max(1, Math.ceil(parejasGen1 / 3))

  const estrategias = [

    // ── 1. Conservadora ───────────────────────────────────────────────────────
    {
      id: 'conservadora', nombre: 'Conservadora', emoji: '🛡️',
      descripcion: 'Mínimas parejas, menor impacto en la colonia, riesgo de quedar corto',
      hembrasNecesarias: parejasBase, machosNecesarios: machosBase,
      parejasTotal: parejasBase, jaulasNuevas: parejasBase,
      jaulasTotal: jaulasCount + parejasBase,
      tiempoExtra: 0, usaGeneracion: 'actual', usaF1: false,
      necesitaExpansion: false,
      riesgoBiologico: 38, riesgoGenetico: 20,
      impactoColonia: 'bajo',
      probabilidad: calcProb(parejasBase, 1.0),
      crecimientoColateral: colateral(parejasBase),
      rompeMinimos: rompeMin(parejasBase, machosBase),
      saturacion: (jaulasCount + parejasBase) > 20,
      viable: true,
      porQueElegir: 'Cuando la colonia está al mínimo o el espacio de jaulas es limitado',
      riesgos: ['Sin buffer — un fallo reproductivo puede comprometer la entrega completa'],
      fechasModificadas: fechasBase,
    },

    // ── 2. Balanceada ─────────────────────────────────────────────────────────
    {
      id: 'balanceada', nombre: 'Balanceada', emoji: '⚖️',
      descripcion: 'Buffer estándar, alta probabilidad de cumplimiento, impacto moderado',
      hembrasNecesarias: parejasBuffer, machosNecesarios: machosBuffer,
      parejasTotal: parejasBuffer, jaulasNuevas: parejasBuffer,
      jaulasTotal: jaulasCount + parejasBuffer,
      tiempoExtra: 0, usaGeneracion: 'actual', usaF1: false,
      necesitaExpansion: false,
      riesgoBiologico: 18, riesgoGenetico: 18,
      impactoColonia: 'moderado',
      probabilidad: calcProb(parejasBuffer, 1 / hist.tasaExito),
      crecimientoColateral: colateral(parejasBuffer),
      rompeMinimos: rompeMin(parejasBuffer, machosBuffer),
      saturacion: (jaulasCount + parejasBuffer) > 20,
      viable: true,
      porQueElegir: 'Estrategia general — equilibra seguridad con uso razonable de la colonia',
      riesgos: [],
      fechasModificadas: fechasBase,
    },

    // ── 3. Expansiva ──────────────────────────────────────────────────────────
    {
      id: 'expansiva', nombre: 'Expansiva', emoji: '📈',
      descripcion: 'Máximo buffer, mayor probabilidad, genera excedentes para stock y futuros reproductores',
      hembrasNecesarias: parejasMax, machosNecesarios: machosMax,
      parejasTotal: parejasMax, jaulasNuevas: parejasMax,
      jaulasTotal: jaulasCount + parejasMax,
      tiempoExtra: 0, usaGeneracion: 'actual', usaF1: false,
      necesitaExpansion: true,
      riesgoBiologico: 10, riesgoGenetico: 22,
      impactoColonia: 'alto',
      probabilidad: calcProb(parejasMax, 1.5),
      crecimientoColateral: colateral(parejasMax),
      rompeMinimos: rompeMin(parejasMax, machosMax),
      saturacion: (jaulasCount + parejasMax) > 20,
      viable: true,
      porQueElegir: `Genera ~${Math.max(0, Math.round(parejasMax * hist.promedioTamano * hist.tasaSupervivencia) - pedido.cantidad)} animales extra — ideal para pedidos recurrentes o renovar la colonia`,
      riesgos: ['Mayor uso de reproductores activos', 'Puede saturar jaulas temporalmente'],
      fechasModificadas: fechasBase,
    },

    // ── 4. Escalonada (2 ondas) ───────────────────────────────────────────────
    {
      id: 'escalonada', nombre: 'Escalonada (2 ondas)', emoji: '📅',
      descripcion: 'Divide el pedido en 2 grupos separados — menor pico de saturación, menor estrés reproductivo',
      hembrasNecesarias: parejasBuffer, machosNecesarios: machosBuffer,
      parejasTotal: parejasBuffer,
      jaulasNuevas: Math.ceil(parejasBuffer / 2), // pico simultáneo
      jaulasTotal: jaulasCount + Math.ceil(parejasBuffer / 2),
      tiempoExtra: 14, usaGeneracion: 'actual', usaF1: false,
      necesitaExpansion: false,
      riesgoBiologico: 16, riesgoGenetico: 14,
      impactoColonia: 'moderado',
      probabilidad: Math.min(96, calcProb(parejasBuffer, 1 / hist.tasaExito) + 4),
      crecimientoColateral: colateral(parejasBuffer),
      rompeMinimos: rompeMin(parejasBuffer, machosBuffer),
      saturacion: (jaulasCount + Math.ceil(parejasBuffer / 2)) > 20,
      viable: true,
      porQueElegir: 'Menor pico simultáneo de jaulas — ideal cuando el espacio es el mayor limitante',
      riesgos: ['La segunda onda requiere planificación cuidadosa para coincidir con la entrega'],
      fechasModificadas: fechasBase,
      esCronogramaEscalonado: true,
      cantidadPorOla: Math.ceil(pedido.cantidad / 2),
      frecuenciaOlas: 14,
    },

    // ── 5. Renovación automática ──────────────────────────────────────────────
    {
      id: 'renovacion', nombre: 'Renovación automática', emoji: '🔄',
      descripcion: `Usa los ${viejos} reproductores de mayor edad primero — el pedido impulsa el ciclo de renovación natural`,
      hembrasNecesarias: parejasBuffer, machosNecesarios: machosBuffer,
      parejasTotal: parejasBuffer, jaulasNuevas: parejasBuffer,
      jaulasTotal: jaulasCount + parejasBuffer,
      tiempoExtra: 0, usaGeneracion: 'actual', usaF1: false,
      necesitaExpansion: false,
      riesgoBiologico: 25, riesgoGenetico: 12,
      impactoColonia: 'bajo',
      probabilidad: Math.max(25, calcProb(parejasBuffer, 1 / hist.tasaExito) - (viejos > 0 ? 5 : 0)),
      crecimientoColateral: colateral(parejasBuffer),
      rompeMinimos: rompeMin(parejasBuffer, machosBuffer),
      saturacion: (jaulasCount + parejasBuffer) > 20,
      viable: true,
      porQueElegir: viejos > 0
        ? `${viejos} reproductores cerca del límite de edad — el pedido los aprovecha antes de retiro obligatorio`
        : 'Útil cuando hay reproductores de alta edad que deben usarse prioritariamente',
      riesgos: viejos > 0
        ? ['Reproductores mayores pueden tener menor tasa de fertilización', 'Monitorear performance más de cerca']
        : [],
      reproductooresViejos: viejos,
      fechasModificadas: fechasBase,
    },

    // ── 6. Bajo impacto sanitario ─────────────────────────────────────────────
    {
      id: 'bajo_impacto', nombre: 'Bajo impacto sanitario', emoji: '🌿',
      descripcion: 'Mismas parejas pero con 2 semanas extra de preparación — menor estrés, mayor calidad reproductiva',
      hembrasNecesarias: parejasBuffer, machosNecesarios: machosBuffer,
      parejasTotal: parejasBuffer, jaulasNuevas: parejasBuffer,
      jaulasTotal: jaulasCount + parejasBuffer,
      tiempoExtra: 14, usaGeneracion: 'actual', usaF1: false,
      necesitaExpansion: false,
      riesgoBiologico: 12, riesgoGenetico: 16,
      impactoColonia: 'moderado',
      probabilidad: Math.min(97, calcProb(parejasBuffer, 1 / hist.tasaExito) + 5),
      crecimientoColateral: colateral(parejasBuffer),
      rompeMinimos: rompeMin(parejasBuffer, machosBuffer),
      saturacion: (jaulasCount + parejasBuffer) > 20,
      viable: diasHastaEntrega > (fechasBase?.diasMinimos ?? 0) + 14,
      porQueElegir: 'Recomendada cuando el índice sanitario está reducido o los reproductores necesitan acondicionamiento',
      riesgos: ['Requiere 14 días extra en el cronograma — verificar que la fecha de entrega lo permite'],
      fechasModificadas: fechasConRetraso(14),
    },

    // ── 7. Crecimiento progresivo (bi-generacional) ───────────────────────────
    {
      id: 'progresivo', nombre: 'Crecimiento progresivo', emoji: '🧬',
      descripcion: esViableMultigen
        ? 'Gen0 → Gen1 → entrega: menos reproductores iniciales, máxima diversidad genética'
        : `Requiere más tiempo del disponible — se aplica con datos bibliográficos`,
      hembrasNecesarias: parejasGen1, machosNecesarios: machosGen1,
      parejasTotal: parejasGen1, jaulasNuevas: parejasGen1,
      jaulasTotal: jaulasCount + parejasGen1,
      tiempoExtra: 0, usaGeneracion: esViableMultigen ? 'gen1' : 'actual',
      usaF1: false, necesitaExpansion: false,
      riesgoBiologico: esViableMultigen ? 18 : 28,
      riesgoGenetico: 5,
      impactoColonia: 'bajo',
      probabilidad: esViableMultigen
        ? Math.min(96, calcProb(parejasBuffer, 1.2))
        : calcProb(parejasBuffer, 1 / hist.tasaExito),
      crecimientoColateral: colateral(parejasBuffer),
      rompeMinimos: rompeMin(parejasGen1, machosGen1),
      saturacion: (jaulasCount + parejasGen1) > 20,
      viable: esViableMultigen,
      porQueElegir: esViableMultigen
        ? `Para pedidos grandes a largo plazo — mínimo impacto inicial, máxima diversidad genética de las crías`
        : `No viable con el tiempo actual — se necesitan al menos ${Math.round((cicloCompleto * 1.5 + Number(pedido.edadSemanas ?? 8) * 7) / 30)} meses`,
      riesgos: esViableMultigen
        ? ['Requiere seguimiento de 2 generaciones', 'La calidad de Gen1 es crítica para el resultado final']
        : ['Tiempo insuficiente para ciclo bi-generacional completo'],
      fechasModificadas: fechasBase,
    },
  ]

  const optima = _optimalBio(estrategias, indiceSanitario)
  return { estrategias, optima }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 24 — PLAN OPERATIVO GPS
// Convierte la estrategia óptima en una lista de pasos concretos con
// fechas, acciones y descripciones en lenguaje claro.
// ─────────────────────────────────────────────────────────────────────────────

export function generarPlanOperativo(pedido, estrategia, fechasOptimas, parejasInfo, bio) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const toISO = d => d.toISOString().split('T')[0]
  const sumar = (fecha, dias) => {
    if (!fecha) return null
    const d = new Date(fecha); d.setDate(d.getDate() + dias); return toISO(d)
  }
  const diasDesdeHoy = fecha => {
    if (!fecha) return null
    const d = parseDate(fecha); return d ? Math.round((d - hoy) / 86400000) : null
  }

  const fechas = estrategia?.fechasModificadas ?? fechasOptimas
  if (!fechas) return []

  const hembras     = estrategia?.hembrasNecesarias ?? parejasInfo?.hembrasNecesarias ?? '?'
  const machos      = estrategia?.machosNecesarios  ?? parejasInfo?.machosNecesarios  ?? '?'
  const criasEst    = estrategia?.crecimientoColateral?.criasTotal ?? parejasInfo?.animalesEstimados ?? '?'

  const pasos = []

  // ── Paso 0: preparación (si hay tiempo extra o es su primera acción) ───────
  const diasParaPrep = Math.max(0, (fechas.diasHastaCopula ?? 0) - 3)
  const fechaPrep    = diasParaPrep === 0 ? toISO(hoy) : sumar(toISO(hoy), diasParaPrep)
  pasos.push({
    numero: pasos.length + 1,
    fecha: fechaPrep,
    diasRestantes: diasParaPrep,
    tipo: 'preparacion',
    emoji: '✅',
    accion: `Seleccionar ${hembras} hembras y ${machos} machos`,
    descripcion: `Elegir los reproductores de mayor score reproductivo. ${estrategia?.id === 'renovacion' ? 'Priorizar los de mayor edad.' : 'Priorizar los con menor consanguinidad (F < 12.5%).'} Verificar salud y condición corporal antes de iniciar.`,
    urgente: diasParaPrep <= 3,
    importante: false,
  })

  // ── Paso 1: inicio de cópulas ─────────────────────────────────────────────
  if (fechas.fechaCopula) {
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechas.fechaCopula,
      diasRestantes: fechas.diasHastaCopula ?? diasDesdeHoy(fechas.fechaCopula),
      tipo: 'copula',
      emoji: '🔗',
      accion: `Iniciar ${hembras} apareamientos`,
      descripcion: `Unir ${hembras}♀ con ${machos}♂${estrategia?.esCronogramaEscalonado ? ` (primera onda: ${estrategia.cantidadPorOla} animales)` : ''}. Registrar fecha de cópula en el sistema para calcular la fecha de parto automáticamente.`,
      urgente: (fechas.diasHastaCopula ?? 0) <= 7 && (fechas.diasHastaCopula ?? 0) >= 0,
      importante: false,
    })
  }

  // ── Segunda onda si es escalonada ─────────────────────────────────────────
  if (estrategia?.esCronogramaEscalonado && fechas.fechaCopula) {
    const fechaCopula2 = sumar(fechas.fechaCopula, estrategia.frecuenciaOlas ?? 14)
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechaCopula2,
      diasRestantes: diasDesdeHoy(fechaCopula2),
      tipo: 'copula',
      emoji: '🔗',
      accion: `Iniciar segunda onda — ${estrategia.cantidadPorOla} animales`,
      descripcion: `${estrategia.frecuenciaOlas ?? 14} días después de la primera onda. Repartir la carga reproductiva reduce el pico de jaulas necesarias.`,
      urgente: false,
      importante: false,
    })
  }

  // ── Paso 2: separación de parejas ─────────────────────────────────────────
  if (fechas.fechaSeparacion) {
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechas.fechaSeparacion,
      diasRestantes: diasDesdeHoy(fechas.fechaSeparacion),
      tipo: 'separacion',
      emoji: '↗️',
      accion: 'Separar los machos',
      descripcion: `Retirar los machos después de ${bio?.DURACION_APAREAMIENTO_DIAS ?? 15} días de apareamiento. Las hembras quedan en jaulas individuales para la gestación.`,
      urgente: false,
      importante: false,
    })
  }

  // ── Paso 3: verificación de gestación ────────────────────────────────────
  if (fechas.fechaNacimiento) {
    const fechaVerif = sumar(fechas.fechaNacimiento, -7)
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechaVerif,
      diasRestantes: diasDesdeHoy(fechaVerif),
      tipo: 'verificacion',
      emoji: '🔍',
      accion: 'Verificar signos de gestación',
      descripcion: 'Revisar aumento de peso y tamaño abdominal. Registrar hembras con confirmación positiva. Preparar jaulas de parto.',
      urgente: false,
      importante: false,
    })

    // ── Paso 4: partos ────────────────────────────────────────────────────
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechas.fechaNacimiento,
      diasRestantes: diasDesdeHoy(fechas.fechaNacimiento),
      tipo: 'parto',
      emoji: '🐣',
      accion: `Partos esperados — ~${criasEst} crías`,
      descripcion: `Revisar diariamente. Registrar cada camada en el sistema apenas nazca. Anotar total de crías, sexo y cualquier anomalía.`,
      urgente: false,
      importante: false,
    })
  }

  // ── Paso 5: destete ───────────────────────────────────────────────────────
  if (fechas.fechaDestete) {
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechas.fechaDestete,
      diasRestantes: diasDesdeHoy(fechas.fechaDestete),
      tipo: 'destete',
      emoji: '🧬',
      accion: 'Destete y separación por sexo',
      descripcion: `Separar crías a los ${bio?.DESTETE_DIAS ?? 21} días. Organizar jaulas separando machos y hembras. Registrar en stock para seguimiento.`,
      urgente: false,
      importante: false,
    })
  }

  // ── Paso extra: selección de F1 (estrategia generacional) ────────────────
  if (estrategia?.usaGeneracion === 'gen1' && estrategia.viable && fechas.fechaDestete) {
    const fechaSelF1 = sumar(fechas.fechaDestete, bio?.MADUREZ_DIAS ?? 75)
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechaSelF1,
      diasRestantes: diasDesdeHoy(fechaSelF1),
      tipo: 'seleccion',
      emoji: '🎯',
      accion: `Seleccionar reproductores F1 — ${hembras}♀ y ${machos}♂`,
      descripcion: 'Los mejores animales de esta camada se convierten en reproductores para la siguiente generación. Mayor diversidad genética garantizada.',
      urgente: false,
      importante: false,
    })
  }

  // ── Paso final: entrega ───────────────────────────────────────────────────
  if (fechas.fechaEntrega) {
    const diasEntrega = diasDesdeHoy(fechas.fechaEntrega)
    pasos.push({
      numero: pasos.length + 1,
      fecha: fechas.fechaEntrega,
      diasRestantes: diasEntrega,
      tipo: 'entrega',
      emoji: '📦',
      accion: `Entrega — ${pedido.cantidad} ${pedido.sexo === 'ambos' ? 'animales (♂+♀)' : pedido.sexo} de ${pedido.edadSemanas} semanas`,
      descripcion: pedido.solicitante
        ? `Entregar a ${pedido.solicitante}. Verificar edad y cantidad antes de la entrega. Registrar la entrega en el módulo de Entregas.`
        : `Verificar edad (${pedido.edadSemanas} semanas) y cantidad (${pedido.cantidad}). Registrar en el módulo de Entregas.`,
      urgente: (diasEntrega ?? 0) <= 14 && (diasEntrega ?? 0) >= 0,
      importante: true,
    })
  }

  return pasos
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 25 — PRÓXIMA ACCIÓN
// Determina el paso más urgente del plan operativo para mostrarlo
// de forma prominente en la vista principal.
// ─────────────────────────────────────────────────────────────────────────────

export function determinarProximaAccion(planOperativo) {
  if (!planOperativo || planOperativo.length === 0) {
    return {
      existe: false,
      emoji: '📋',
      accion: 'Completar datos del pedido',
      descripcion: 'Ingresá la fecha de entrega y la edad requerida para generar el plan operativo',
      urgente: false,
      diasRestantes: null,
      tipo: null,
    }
  }

  // El primer paso pendiente con fecha futura o inminente
  const pendientes = planOperativo
    .filter(p => p.diasRestantes !== null && p.diasRestantes >= -7)
    .sort((a, b) => (a.diasRestantes ?? 9999) - (b.diasRestantes ?? 9999))

  const siguiente = pendientes[0]
  if (!siguiente) {
    return {
      existe: true,
      emoji: '✅',
      accion: 'Pedido en ejecución',
      descripcion: 'Todas las acciones inmediatas están completadas. Monitorear el progreso hasta la entrega.',
      urgente: false,
      diasRestantes: 0,
      tipo: 'info',
    }
  }

  return {
    existe: true,
    emoji: siguiente.emoji,
    accion: siguiente.accion,
    descripcion: siguiente.descripcion,
    urgente: siguiente.urgente || (siguiente.diasRestantes ?? 0) <= 3,
    diasRestantes: siguiente.diasRestantes,
    fecha: siguiente.fecha,
    tipo: siguiente.tipo,
    importante: siguiente.importante,
  }
}
