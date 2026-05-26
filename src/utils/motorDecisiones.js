// ─────────────────────────────────────────────────────────────────────────────
// motorDecisiones.js — Sistema unificado de decisiones para la colonia
// Saturación · Renovación · Capacidad · Reemplazos · Producción futura
// ─────────────────────────────────────────────────────────────────────────────

import { getBio } from './constants'
import { difDias, parseDate, calcularRangoParto, calcularDestete, calcularMadurez } from './calculos'
import { calcularFCoeficiente, buildPedigree, estadisticasColonia } from './genealogia'

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 1 — MÍNIMOS OBLIGATORIOS POR BIOTERIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mínimos reproductivos por bioterio.
 * Los reproductores para híbridos NO se comparten — se marcan como reservados.
 */
export const MINIMOS_CRITICOS = {
  ratas: {
    machos_colonia:  3,
    hembras_colonia: 2,
    machos_hibridos: 0,
    hembras_hibridos: 0,
  },
  ratones_c57: {
    machos_colonia:  2,
    hembras_colonia: 2,
    machos_hibridos: 0,
    hembras_hibridos: 2, // exclusivos para F1 — NO compartir con colonia
  },
  ratones_balbc: {
    machos_colonia:  2,
    hembras_colonia: 2,
    machos_hibridos: 2, // exclusivos para F1 — NO compartir con colonia
    hembras_hibridos: 0,
  },
  ratones_hibridos: {
    machos_colonia:  0, // Híbridos usan reproductores exportados de BAL/C y C57
    hembras_colonia: 0,
    machos_hibridos: 0,
    hembras_hibridos: 0,
  },
}

export function getMinimosCriticos(bioterioId) {
  return MINIMOS_CRITICOS[bioterioId] ?? MINIMOS_CRITICOS.ratas
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 2 — STOCK REAL POR CATEGORÍA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el stock real activo, separado por categoría.
 * Fuente: SOLO animales vivos, jaulas actuales, excluyendo históricos y cerrados.
 *
 * @returns {object} { reproductores, stock, jaulas, totales }
 */
export function calcularStockReal(animales, camadas, jaulas, sacrificios, entregas, bio, bioterioId) {
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const estadosVivos = ['activo', 'en_apareamiento', 'en_cria']

  // ── REPRODUCTORES ──────────────────────────────────────────────────────────
  const repros = animales.filter(
    a => a.bioterio_id === bioterioId && estadosVivos.includes(a.estado)
  )
  const machos    = repros.filter(a => a.sexo === 'macho')
  const hembras   = repros.filter(a => a.sexo === 'hembra')
  const gestantes = hembras.filter(a => a.estado === 'en_cria')
  const apareadas = hembras.filter(a => a.estado === 'en_apareamiento')
  const activasLibres = hembras.filter(a => a.estado === 'activo')

  // Reproductores exportados para híbridos (solo si viene marcado)
  const exportadosHibridos = repros.filter(a => a.exportado_hibridos)
  const machosHibridos  = exportadosHibridos.filter(a => a.sexo === 'macho')
  const hembrasHibridos = exportadosHibridos.filter(a => a.sexo === 'hembra')

  // ── STOCK POR JAULA ────────────────────────────────────────────────────────
  const jaulasDeBioterio = jaulas.filter(j => {
    const camada = camadas.find(c => c.id === j.camada_id)
    return camada && camada.bioterio_id === bioterioId
  })

  // Calcular bajas por sacrificio y entrega para cada camada
  const sacrificiosPorCamada = {}
  for (const s of sacrificios) {
    if (s.camada_id) {
      sacrificiosPorCamada[s.camada_id] = (sacrificiosPorCamada[s.camada_id] || 0) + (s.cantidad || 0)
    }
  }
  const entregasPorCamada = {}
  for (const e of entregas) {
    if (e.camada_id) {
      entregasPorCamada[e.camada_id] = (entregasPorCamada[e.camada_id] || 0) + (e.cantidad || 0)
    }
  }

  let crias = 0, jovenes = 0, adultos = 0
  let jaulasCrias = 0, jaulasJovenes = 0, jaulasAdultos = 0

  const CRIAS_MAX_DIAS    = 42   // < 6 semanas
  const JOVENES_MAX_DIAS  = bio?.STOCK_ADULTOS_DIAS ?? 70 // 6-10 semanas

  const bloquesProcesados = []

  for (const jaula of jaulasDeBioterio) {
    const camada = camadas.find(c => c.id === jaula.camada_id)
    if (!camada || !camada.fecha_nacimiento) continue
    if (camada.failure_flag) continue

    const sacri   = sacrificiosPorCamada[jaula.camada_id] || 0
    const entrega = entregasPorCamada[jaula.camada_id] || 0
    const total   = (jaula.total || 0) - sacri - entrega
    if (total <= 0) continue

    const diasVida = difDias(camada.fecha_nacimiento, hoyDate)

    let categoria
    if (diasVida < CRIAS_MAX_DIAS) {
      categoria = 'crias'; crias += total; jaulasCrias++
    } else if (diasVida < JOVENES_MAX_DIAS) {
      categoria = 'jovenes'; jovenes += total; jaulasJovenes++
    } else {
      categoria = 'adultos'; adultos += total; jaulasAdultos++
    }

    bloquesProcesados.push({
      jaulaId:  jaula.id,
      camadaId: camada.id,
      total, machos: jaula.machos, hembras: jaula.hembras,
      diasVida, categoria,
      madreId: camada.id_madre, padreId: camada.id_padre,
      fechaNacimiento: camada.fecha_nacimiento,
    })
  }

  // Jaulas apareadas = 1 jaula reproductores (pareja activa = 1 jaula, NO 2)
  const jaulasRepro = apareadas.length // cada hembra en apareamiento representa una pareja activa

  return {
    reproductores: {
      machos, hembras, gestantes, apareadas, activasLibres,
      machosHibridos, hembrasHibridos,
      totalMachos:  machos.length,
      totalHembras: hembras.length,
    },
    stock: {
      crias, jovenes, adultos,
      jaulasCrias, jaulasJovenes, jaulasAdultos,
      bloques: bloquesProcesados,
    },
    jaulas: {
      repro: jaulasRepro,
      stock: jaulasCrias + jaulasJovenes + jaulasAdultos,
      total: jaulasRepro + jaulasCrias + jaulasJovenes + jaulasAdultos,
    },
    totales: {
      animalesRepro: repros.length,
      animalesStock: crias + jovenes + adultos,
      animalesTotal: repros.length + crias + jovenes + adultos,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 3 — VERIFICACIÓN DE MÍNIMOS CRÍTICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si el stock actual cumple con los mínimos obligatorios.
 * Jerarquía: Supervivencia > Reproductivos > Híbridos.
 */
export function verificarMinimosCriticos(stockReal, bioterioId) {
  const minimos = getMinimosCriticos(bioterioId)
  const { reproductores } = stockReal
  const alertas = []

  // Machos colonia
  const machosColonia = reproductores.machos.filter(m => !m.exportado_hibridos)
  if (machosColonia.length < minimos.machos_colonia) {
    alertas.push({
      tipo:      'deficit_machos_colonia',
      jerarquia: 1,
      actual:    machosColonia.length,
      minimo:    minimos.machos_colonia,
      deficit:   minimos.machos_colonia - machosColonia.length,
      mensaje:   `Déficit de machos reproductores: ${machosColonia.length}/${minimos.machos_colonia}`,
      critico:   true,
    })
  }

  // Hembras colonia
  const hembrasColonia = reproductores.hembras.filter(h => !h.exportado_hibridos)
  if (hembrasColonia.length < minimos.hembras_colonia) {
    alertas.push({
      tipo:      'deficit_hembras_colonia',
      jerarquia: 1,
      actual:    hembrasColonia.length,
      minimo:    minimos.hembras_colonia,
      deficit:   minimos.hembras_colonia - hembrasColonia.length,
      mensaje:   `Déficit de hembras reproductoras: ${hembrasColonia.length}/${minimos.hembras_colonia}`,
      critico:   true,
    })
  }

  // Reproductores híbridos (si aplica)
  if (minimos.machos_hibridos > 0 && reproductores.machosHibridos.length < minimos.machos_hibridos) {
    alertas.push({
      tipo:      'deficit_machos_hibridos',
      jerarquia: 3,
      actual:    reproductores.machosHibridos.length,
      minimo:    minimos.machos_hibridos,
      deficit:   minimos.machos_hibridos - reproductores.machosHibridos.length,
      mensaje:   `Déficit de machos para F1: ${reproductores.machosHibridos.length}/${minimos.machos_hibridos}`,
      critico:   false,
    })
  }
  if (minimos.hembras_hibridos > 0 && reproductores.hembrasHibridos.length < minimos.hembras_hibridos) {
    alertas.push({
      tipo:      'deficit_hembras_hibridos',
      jerarquia: 3,
      actual:    reproductores.hembrasHibridos.length,
      minimo:    minimos.hembras_hibridos,
      deficit:   minimos.hembras_hibridos - reproductores.hembrasHibridos.length,
      mensaje:   `Déficit de hembras para F1: ${reproductores.hembrasHibridos.length}/${minimos.hembras_hibridos}`,
      critico:   false,
    })
  }

  return {
    ok:        alertas.length === 0,
    alertas:   alertas.sort((a, b) => a.jerarquia - b.jerarquia),
    critico:   alertas.some(a => a.critico),
    machos:    { actual: machosColonia.length, minimo: minimos.machos_colonia },
    hembras:   { actual: hembrasColonia.length, minimo: minimos.hembras_colonia },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 4 — PROYECCIÓN TEMPORAL (30 / 60 / 90 / 180 días)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula eventos reproductivos esperados en el horizonte temporal indicado.
 * Solo usa datos de camadas activas (no history cerrado).
 */
export function calcularProyeccion(camadas, animales, bio, bioterioId, diasHorizonte = 90) {
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const camadasBioterio = camadas.filter(c => c.bioterio_id === bioterioId && !c.failure_flag)

  // ── PARTOS PENDIENTES ──────────────────────────────────────────────────────
  // Camadas con cópula pero sin nacimiento registrado
  const partosPendientes = camadasBioterio
    .filter(c => c.fecha_copula && !c.fecha_nacimiento)
    .map(c => {
      const rango = calcularRangoParto(c.fecha_copula, bio)
      if (!rango) return null
      const diasHastaParto = difDias(hoyDate, rango.partoProbable)
      return {
        camadaId:     c.id,
        madreId:      c.id_madre,
        padreId:      c.id_padre,
        fechaCopula:  c.fecha_copula,
        partoProbable: rango.partoProbable,
        partoMin:     rango.partoMin,
        partoMax:     rango.partoMax,
        diasRestantes: diasHastaParto,
        enHorizonte:  diasHastaParto >= 0 && diasHastaParto <= diasHorizonte,
        vencido:      diasHastaParto < 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  // ── DESTETES PENDIENTES ───────────────────────────────────────────────────
  // Camadas con nacimiento pero sin destete — generan stock al destetar
  const destesPendientes = camadasBioterio
    .filter(c => c.fecha_nacimiento && !c.fecha_destete)
    .map(c => {
      const fechaDestete = calcularDestete(c.fecha_nacimiento, bio)
      if (!fechaDestete) return null
      const diasHastaDestete = difDias(hoyDate, fechaDestete)
      return {
        camadaId:     c.id,
        madreId:      c.id_madre,
        totalCrias:   c.total_crias ?? 0,
        fechaNac:     c.fecha_nacimiento,
        fechaDestete,
        diasRestantes: diasHastaDestete,
        enHorizonte:  diasHastaDestete >= 0 && diasHastaDestete <= diasHorizonte,
        vencido:      diasHastaDestete < 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)

  // ── MADURECES DE STOCK ────────────────────────────────────────────────────
  // Crías en stock que alcanzan madurez reproductiva en el horizonte
  // (posibles candidatos a promover)
  const madurecesPendientes = []

  // ── REPRODUCTORES PRÓXIMOS A LÍMITE ──────────────────────────────────────
  const LIMITE_EDAD = bioterioId === 'ratas' ? 270 : 270 // mismo límite
  const ALERTA_EDAD = bioterioId === 'ratas' ? 240 : 240

  const reproProximosLimite = animales
    .filter(a => a.bioterio_id === bioterioId && ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
    .map(a => {
      if (!a.fecha_nacimiento) return null
      const diasVida = difDias(a.fecha_nacimiento, hoyDate)
      const diasHastaLimite = LIMITE_EDAD - diasVida
      const enHorizonte = diasHastaLimite >= 0 && diasHastaLimite <= diasHorizonte
      if (!enHorizonte && diasVida < ALERTA_EDAD) return null
      return {
        animalId:      a.id,
        codigo:        a.codigo,
        sexo:          a.sexo,
        diasVida,
        diasHastaLimite,
        enAlerta:      diasVida >= ALERTA_EDAD,
        alcanzaLimite: diasHastaLimite >= 0 && diasHastaLimite <= diasHorizonte,
        yaLimite:      diasVida >= LIMITE_EDAD,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.diasHastaLimite - b.diasHastaLimite)

  // ── ESTIMACIÓN DE PRODUCCIÓN ─────────────────────────────────────────────
  // Basada en historial de camadas completadas del mismo bioterio
  const camadasHistorial = camadas.filter(c =>
    c.bioterio_id === bioterioId && c.total_crias > 0 && !c.failure_flag
  )
  const promediosCamada = camadasHistorial.length > 0
    ? camadasHistorial.reduce((acc, c) => acc + (c.total_crias || 0), 0) / camadasHistorial.length
    : 8 // valor bibliográfico promedio

  const criasEsperadasHorizonte = partosPendientes
    .filter(p => p.enHorizonte)
    .length * promediosCamada

  const destesPendientesEnHorizonte = destesPendientes.filter(d => d.enHorizonte)
  const stockEsperadoDeDestetes = destesPendientesEnHorizonte
    .reduce((acc, d) => acc + (d.totalCrias || promediosCamada), 0)

  return {
    partosPendientes:   partosPendientes.filter(p => p.enHorizonte || p.vencido),
    destesPendientes:   destesPendientes.filter(d => d.enHorizonte || d.vencido),
    reproProximosLimite,
    madurecesPendientes,
    estimacion: {
      criasEsperadas:     Math.round(criasEsperadasHorizonte),
      stockDeDestetes:    Math.round(stockEsperadoDeDestetes),
      promedioCamada:     Math.round(promediosCamada * 10) / 10,
      camadasConHistorial: camadasHistorial.length,
    },
    diasHorizonte,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 5 — CANDIDATOS A RENOVACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa los bloques de stock como candidatos para promover a reproductores.
 * Prioridad: menor consanguinidad + mejor score familiar + edad óptima.
 *
 * Edad óptima: animales más cercanos a la madurez (no los más viejos).
 * Ej: prefiere 78 días sobre 160 días si ambos superaron la madurez.
 */
export function calcularCandidatosRenovacion(stockReal, animales, camadas, bio, bioterioId, todosPedigreeAnimales = null, lineasProblematicas = new Map()) {
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const MADUREZ    = bio?.MADUREZ_DIAS ?? 56
  const MADUREZ_MIN = Math.round(MADUREZ * 0.85)  // 85% de la madurez → puede ser promovido pronto
  const MADUREZ_MAX = MADUREZ * 3                  // > 3x madurez → demasiado mayor, menos óptimo

  // Construir pedigree con todos los animales disponibles
  const todosAnimales = todosPedigreeAnimales ?? animales
  const pedigree = buildPedigree(todosAnimales, camadas)

  // Calcular scores reproductivos de padres para evaluar calidad familiar
  function scoreFamiliarCamada(idMadre, idPadre) {
    let score = 0
    let factores = 0
    const camadasMadre = camadas.filter(c => c.id_madre === idMadre && c.total_crias > 0 && !c.failure_flag)
    if (camadasMadre.length > 0) {
      const promDestetados = camadasMadre.reduce((a, c) => a + (c.total_destetados || c.total_crias || 0), 0) / camadasMadre.length
      score += Math.min(10, promDestetados)
      factores++
    }
    const camadasPadre = camadas.filter(c => c.id_padre === idPadre && c.total_crias > 0 && !c.failure_flag)
    if (camadasPadre.length > 0) {
      const promTamano = camadasPadre.reduce((a, c) => a + (c.total_crias || 0), 0) / camadasPadre.length
      score += Math.min(10, promTamano)
      factores++
    }
    return factores > 0 ? score / factores : 5 // neutro si no hay datos
  }

  const candidatos = []

  for (const bloque of stockReal.stock.bloques) {
    const { diasVida } = bloque
    if (diasVida < MADUREZ_MIN) continue // aún no llegaron a madurez

    // Calcular consanguinidad de los padres (F de la camada como proxy de los hijos)
    let fPadres = 0
    try {
      if (bloque.madreId && bloque.padreId && pedigree[bloque.madreId] && pedigree[bloque.padreId]) {
        fPadres = calcularFCoeficiente(bloque.madreId, bloque.padreId, pedigree) ?? 0
      }
    } catch { fPadres = 0 }

    const scoreFamiliar = scoreFamiliarCamada(bloque.madreId, bloque.padreId)

    // Tiempo hasta utilidad: animales EN madurez = 0 días, los que faltan = días restantes
    const tiempoHastaUtilidad = Math.max(0, MADUREZ - diasVida)

    // Penalizar animales muy viejos (pasaron el óptimo reproductivo)
    const penalizacionEdad = diasVida > MADUREZ * 1.5
      ? Math.min(20, (diasVida - MADUREZ * 1.5) / 10)
      : 0

    // Score de prioridad (0-100):
    // - 40% genética: menor F = mejor
    // - 30% calidad familiar: mayor score = mejor
    // - 20% edad: más cerca de madurez óptima = mejor
    // - 10% disponibilidad: tiene machos o hembras
    const scoreGenetica = (1 - fPadres) * 40
    const scoreFamilia  = (scoreFamiliar / 10) * 30
    const scoreEdad     = tiempoHastaUtilidad === 0
      ? 20 - penalizacionEdad
      : Math.max(0, (1 - tiempoHastaUtilidad / MADUREZ) * 20)
    const scoreDisp     = ((bloque.machos || 0) + (bloque.hembras || 0) > 0) ? 10 : 5

    const priorityScoreBase = scoreGenetica + scoreFamilia + scoreEdad + scoreDisp

    // Nivel de consanguinidad para mostrar en UI
    let nivelF = 'bajo'
    if (fPadres >= 0.25) nivelF = 'alto'
    else if (fPadres >= 0.125) nivelF = 'moderado'
    else if (fPadres >= 0.0625) nivelF = 'leve'

    // Penalización si los padres tienen líneas problemáticas (malformaciones/infertilidad)
    const problMadre = lineasProblematicas.get(bloque.madreId)
    const problPadre = lineasProblematicas.get(bloque.padreId)
    const penLinea = (problMadre?.nivel === 'critico' || problPadre?.nivel === 'critico') ? 30
      : (problMadre?.nivel === 'moderado' || problPadre?.nivel === 'moderado') ? 15
      : (problMadre || problPadre) ? 7
      : 0
    const esLineaProblematica = penLinea > 0
    const priorityScore = Math.max(0, priorityScoreBase - penLinea)

    const advertenciaLinea = esLineaProblematica
      ? `Línea con historial problemático: ${[problMadre, problPadre].filter(Boolean).flatMap(p => p.razones).slice(0, 2).join(' · ')}`
      : null

    candidatos.push({
      jaulaId:              bloque.jaulaId,
      camadaId:             bloque.camadaId,
      total:                bloque.total,
      machos:               bloque.machos,
      hembras:              bloque.hembras,
      diasVida,
      tiempoHastaUtilidad,
      fPadres:              Math.round(fPadres * 1000) / 1000,
      fPorcentaje:          (fPadres * 100).toFixed(1) + '%',
      nivelF,
      scoreFamiliar:        Math.round(scoreFamiliar * 10) / 10,
      priorityScore:        Math.round(priorityScore * 10) / 10,
      esLineaProblematica,
      recomendado:          nivelF !== 'alto' && scoreFamiliar >= 5 && !esLineaProblematica,
      advertencia:          advertenciaLinea ?? (nivelF === 'alto'
        ? `Consanguinidad alta (${(fPadres * 100).toFixed(1)}%) — riesgo acumulación genética`
        : nivelF === 'moderado'
        ? `Consanguinidad moderada (${(fPadres * 100).toFixed(1)}%) — vigilar tendencia`
        : null),
    })
  }

  return candidatos.sort((a, b) => b.priorityScore - a.priorityScore)
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 5b — PERFIL INDIVIDUAL DE REPRODUCTOR
// Analiza cada animal con todos los factores: edad, fertilidad, consanguinidad,
// línea familiar, sanidad. Genera motivos tipificados para mostrar en UI.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perfil completo de un reproductor con motivos clasificados.
 *
 * Tipos de motivo: 'edad' | 'fertilidad' | 'consanguinidad' | 'familia' | 'sanidad'
 * Niveles:         'critico' | 'alerta' | 'info'
 */
export function calcularPerfilReproductor(animal, camadas, pedigree, incidentes = [], lineasProblematicas = new Map(), bio = null) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const LIMITE_EDAD = 270
  const ALERTA_EDAD = 240
  const motivos = []

  // ── 1. EDAD ──────────────────────────────────────────────────────────────
  let diasVida = 0
  let diasHastaLimite = null
  if (animal.fecha_nacimiento) {
    diasVida = difDias(animal.fecha_nacimiento, hoy)
    diasHastaLimite = LIMITE_EDAD - diasVida
    if (diasVida >= LIMITE_EDAD) {
      motivos.push({ tipo: 'edad', descripcion: `Límite superado (${diasVida}d)`, nivel: 'critico' })
    } else if (diasVida >= ALERTA_EDAD) {
      motivos.push({ tipo: 'edad', descripcion: `${diasHastaLimite}d para el límite (${diasVida}d)`, nivel: 'alerta' })
    }
  }

  // ── 2. FERTILIDAD ────────────────────────────────────────────────────────
  if (animal.sexo === 'hembra') {
    const camadasAnimal = camadas.filter(c => c.id_madre === animal.id)
    const fallos  = camadasAnimal.filter(c => c.failure_flag)
    const exitos  = camadasAnimal.filter(c => !c.failure_flag && c.total_crias > 0 && c.fecha_destete)
    if      (fallos.length >= 3) motivos.push({ tipo: 'fertilidad', descripcion: `${fallos.length} fallos reproductivos`, nivel: 'critico' })
    else if (fallos.length >= 2) motivos.push({ tipo: 'fertilidad', descripcion: `${fallos.length} fallos reproductivos`, nivel: 'alerta' })
    else if (fallos.length === 1) motivos.push({ tipo: 'fertilidad', descripcion: '1 fallo reproductivo', nivel: 'info' })
    if (exitos.length >= 2) {
      const tasa = exitos.reduce((acc, c) => acc + (c.total_destetados || 0) / (c.total_crias || 1), 0) / exitos.length
      if (tasa < 0.6) motivos.push({ tipo: 'fertilidad', descripcion: `Supervivencia baja (${(tasa * 100).toFixed(0)}%)`, nivel: 'alerta' })
    }
  } else {
    const camadasPadre = camadas.filter(c => c.id_padre === animal.id)
    const fallosMacho  = camadasPadre.filter(c => c.failure_flag)
    if      (fallosMacho.length >= 3) motivos.push({ tipo: 'fertilidad', descripcion: `${fallosMacho.length} fallos con pareja`, nivel: 'alerta' })
    else if (fallosMacho.length >= 2) motivos.push({ tipo: 'fertilidad', descripcion: `${fallosMacho.length} fallos con pareja`, nivel: 'info' })
  }

  // ── 3. CONSANGUINIDAD PROPIA ──────────────────────────────────────────────
  let fPropio = 0
  try {
    if (animal.id_madre && animal.id_padre && pedigree) {
      fPropio = calcularFCoeficiente(animal.id_madre, animal.id_padre, pedigree) ?? 0
    }
  } catch { fPropio = 0 }
  if      (fPropio >= 0.25)   motivos.push({ tipo: 'consanguinidad', descripcion: `F muy alto: ${(fPropio * 100).toFixed(1)}%`, nivel: 'critico' })
  else if (fPropio >= 0.125)  motivos.push({ tipo: 'consanguinidad', descripcion: `F moderado: ${(fPropio * 100).toFixed(1)}%`, nivel: 'alerta' })
  else if (fPropio >= 0.0625) motivos.push({ tipo: 'consanguinidad', descripcion: `F leve: ${(fPropio * 100).toFixed(1)}%`, nivel: 'info' })

  // ── 4. LÍNEA FAMILIAR ─────────────────────────────────────────────────────
  const problLinea = lineasProblematicas.get(animal.id)
  if (problLinea) {
    const nivelLinea = problLinea.nivel === 'critico' ? 'critico' : problLinea.nivel === 'moderado' ? 'alerta' : 'info'
    motivos.push({ tipo: 'familia', descripcion: `Línea problemática: ${problLinea.razones[0]}`, nivel: nivelLinea })
  }

  // ── 5. SANIDAD ────────────────────────────────────────────────────────────
  const incGraves = incidentes.filter(i => i.animal_id === animal.id && i.severidad === 'grave' && !i.resuelto)
  if (incGraves.length > 0) motivos.push({ tipo: 'sanidad', descripcion: `${incGraves.length} incidente(s) grave(s) activos`, nivel: 'alerta' })

  const nivelAlerta = motivos.some(m => m.nivel === 'critico') ? 'critico'
    : motivos.some(m => m.nivel === 'alerta') ? 'alerta'
    : motivos.length > 0 ? 'info' : 'ok'

  const necesitaReemplazo = nivelAlerta === 'critico'
    || (nivelAlerta === 'alerta' && diasHastaLimite !== null && diasHastaLimite <= 30)

  return { animal, diasVida, diasHastaLimite, fPropio, motivos, nivelAlerta, necesitaReemplazo }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 6 — VERIFICACIÓN DE JERARQUÍA ANTES DE SACRIFICAR / ENTREGAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si una acción (sacrificio, entrega) es segura según la jerarquía.
 * NUNCA permite que una acción inferior rompa una prioridad superior.
 *
 * Jerarquía:
 * 1. Supervivencia colonia (mínimos reproductores)
 * 2. Mínimos reproductivos
 * 3. Producción híbridos
 * 4. Pedidos futuros
 * 5. Renovación automática
 * 6. Calidad genética
 * 7. Consanguinidad
 * 8. Saturación
 * 9. Sacrificios
 */
export function verificarJerarquiaAntesSacrificio(animal, stockReal, minimos, bioterioId) {
  const bloqueos = []
  const advertencias = []

  if (!animal) return { permitir: true, bloqueos: [], advertencias: [] }

  const { reproductores } = stockReal
  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']

  // ── JERARQUÍA 1-2: ¿Es reproductor? ──────────────────────────────────────
  if (estadosActivos.includes(animal.estado)) {
    const machosColonia = reproductores.machos.filter(m => !m.exportado_hibridos).length
    const hembrasColonia = reproductores.hembras.filter(h => !h.exportado_hibridos).length

    if (animal.sexo === 'macho' && !animal.exportado_hibridos) {
      const despuesDeSacrificio = machosColonia - 1
      if (despuesDeSacrificio < (minimos.machos_colonia ?? 0)) {
        bloqueos.push({
          jerarquia: 1,
          razon: `Quedarían solo ${despuesDeSacrificio} machos — mínimo obligatorio: ${minimos.machos_colonia}`,
        })
      }
    }
    if (animal.sexo === 'hembra' && !animal.exportado_hibridos) {
      const despuesDeSacrificio = hembrasColonia - 1
      if (despuesDeSacrificio < (minimos.hembras_colonia ?? 0)) {
        bloqueos.push({
          jerarquia: 1,
          razon: `Quedarían solo ${despuesDeSacrificio} hembras — mínimo obligatorio: ${minimos.hembras_colonia}`,
        })
      }
    }
  }

  // ── JERARQUÍA 3: Reproductores para híbridos ──────────────────────────────
  if (animal.exportado_hibridos) {
    bloqueos.push({
      jerarquia: 3,
      razon: 'Animal reservado para producción de híbridos F1 — no puede ser sacrificado',
    })
  }

  // ── JERARQUÍA 5: ¿Es el único candidato a renovación? ────────────────────
  const reservas = getReservas()
  if (reservas[animal.id]?.tipo === 'renovacion') {
    advertencias.push({
      jerarquia: 5,
      razon: `Animal reservado para renovación (${reservas[animal.id].motivo})`,
    })
  }

  // ── JERARQUÍA 8: Saturación ───────────────────────────────────────────────
  // (Aquí se podría verificar capacidad máxima de jaulas, por ahora sin límite configurado)

  return {
    permitir:    bloqueos.length === 0,
    bloqueos:    bloqueos.sort((a, b) => a.jerarquia - b.jerarquia),
    advertencias,
    bloqueo:     bloqueos.length > 0 ? bloqueos[0] : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 7 — ÍNDICE DE ESTABILIDAD DE COLONIA (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula un índice compuesto de estabilidad de la colonia (0-100).
 *
 * Componentes:
 * - Renovación (25 pts): reproductores en edad óptima, candidatos disponibles
 * - Genética (20 pts): diversidad, F promedio, tendencia
 * - Producción (20 pts): partos activos, tasas de supervivencia
 * - Híbridos (15 pts): reproductores disponibles para F1 (si aplica)
 * - Sanitario (10 pts): índice sanitario externo
 * - Saturación (10 pts): jaulas vs capacidad ideal
 */
export function calcularIndiceEstabilidad({
  stockReal,
  minimos,
  proyeccion,
  candidatosRenovacion = [],
  indiceGenetico = null,
  indiceSanitario = 100,
  camadas = [],
  bioterioId,
  motorUnificado = null,   // opcional: si se pasa, usa su indiceRenovacion
}) {
  let score = 0
  const detalle = {}

  // ── 1. RENOVACIÓN (25 pts) ────────────────────────────────────────────────
  // Si el motor unificado está disponible, usa su índice de renovación directamente
  const { reproductores } = stockReal
  let renovacion
  if (motorUnificado !== null) {
    renovacion = Math.round(motorUnificado.indiceRenovacion * 0.25)
  } else {
    renovacion = 25
    const LIMITE_DIAS = 270, ALERTA_DIAS = 240
    const hoyDate = new Date()
    hoyDate.setHours(0, 0, 0, 0)
    const machosConEdad = reproductores.machos.filter(m => {
      if (!m.fecha_nacimiento) return false
      return difDias(m.fecha_nacimiento, hoyDate) >= ALERTA_DIAS
    })
    renovacion -= Math.min(15, machosConEdad.length * 5)
    if (candidatosRenovacion.length === 0) renovacion -= 10
    else if (candidatosRenovacion.filter(c => c.recomendado).length === 0) renovacion -= 5
    if (!minimos.ok) renovacion -= minimos.alertas.filter(a => a.critico).length * 8
  }
  detalle.renovacion = Math.max(0, Math.min(25, renovacion))

  // ── 2. GENÉTICA (20 pts) ──────────────────────────────────────────────────
  let genetica = 20
  if (indiceGenetico !== null) {
    genetica = Math.round(indiceGenetico.score * 0.2)
  } else {
    // Estimación básica sin pedigree completo
    const sinPadres = reproductores.machos.filter(m => !m.id_madre && !m.id_padre).length
    const total     = reproductores.machos.length + reproductores.hembras.length
    if (total > 0) {
      const sinHistorial = (reproductores.machos.filter(m => !m.id_madre).length +
                            reproductores.hembras.filter(h => !h.id_madre).length) / total
      genetica -= Math.round(sinHistorial * 10)
    }
  }
  detalle.genetica = Math.max(0, Math.min(20, genetica))

  // ── 3. PRODUCCIÓN (20 pts) ────────────────────────────────────────────────
  let produccion = 20
  const camadasBio = camadas.filter(c => c.bioterio_id === bioterioId && !c.failure_flag)
  const camadasCompletas = camadasBio.filter(c => c.fecha_destete && c.total_crias > 0)

  if (camadasCompletas.length > 0) {
    const tasaSupervivencia = camadasCompletas.reduce((acc, c) => {
      const s = (c.total_destetados || 0) / (c.total_crias || 1)
      return acc + s
    }, 0) / camadasCompletas.length
    if (tasaSupervivencia < 0.7) produccion -= 15
    else if (tasaSupervivencia < 0.85) produccion -= 7

    const camadasConFallo = camadas.filter(c =>
      c.bioterio_id === bioterioId && c.failure_flag
    ).length
    produccion -= Math.min(10, camadasConFallo * 2)
  }

  // Sin partos activos (sin actividad reproductiva)
  const embarazosActivos = reproductores.gestantes.length + reproductores.apareadas.length
  if (embarazosActivos === 0 && reproductores.totalMachos > 0 && reproductores.totalHembras > 0) {
    produccion -= 5 // colonia estancada
  }
  detalle.produccion = Math.max(0, Math.min(20, produccion))

  // ── 4. HÍBRIDOS (15 pts) ─────────────────────────────────────────────────
  let hibridos = 15
  if (['ratones_balbc', 'ratones_c57'].includes(bioterioId)) {
    const minimoH = getMinimosCriticos(bioterioId)
    const machosH = reproductores.machosHibridos.length
    const hembrasH = reproductores.hembrasHibridos.length
    if (machosH < minimoH.machos_hibridos) hibridos -= 10
    if (hembrasH < minimoH.hembras_hibridos) hibridos -= 10
  }
  // Para bioterios sin requerimiento de híbridos, puntuación completa
  detalle.hibridos = Math.max(0, Math.min(15, hibridos))

  // ── 5. SANITARIO (10 pts) ─────────────────────────────────────────────────
  const sanitario = Math.round((indiceSanitario / 100) * 10)
  detalle.sanitario = Math.max(0, Math.min(10, sanitario))

  // ── 6. SATURACIÓN (10 pts) ────────────────────────────────────────────────
  // Sin capacidad máxima configurada, evaluamos solo si hay reproductores activos
  let saturacion = 10
  if (reproductores.totalMachos + reproductores.totalHembras > 20) {
    saturacion -= 3 // muchos reproductores, posible saturación
  }
  detalle.saturacion = Math.max(0, Math.min(10, saturacion))

  score = detalle.renovacion + detalle.genetica + detalle.produccion +
          detalle.hibridos + detalle.sanitario + detalle.saturacion

  // REGLA DURA: con déficit activo de reproductores → máximo 85
  const hayDeficitActivo = motorUnificado
    ? motorUnificado.hayDeficit
    : !minimos.ok && minimos.alertas.some(a => a.critico)
  if (hayDeficitActivo) score = Math.min(score, 85)

  const scoreClamp = Math.max(0, Math.min(100, score))

  let nivel, emoji, color
  if (scoreClamp >= 80) { nivel = 'Estable';   emoji = '🟢'; color = '#00e676' }
  else if (scoreClamp >= 60) { nivel = 'Vigilar';  emoji = '🟡'; color = '#ffb300' }
  else if (scoreClamp >= 35) { nivel = 'Riesgo';   emoji = '🔴'; color = '#ff6b80' }
  else                       { nivel = 'Crítico';  emoji = '⚫'; color = '#9c27b0' }

  return { score: scoreClamp, nivel, emoji, color, detalle }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 8 — ÍNDICE DE RENOVACIÓN GENÉTICA (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Índice de renovación genética de la colonia (0-100).
 * Basado en diversidad, consanguinidad, tendencia y calidad de línea.
 * Params opcionales: { stockReal, candidatos, proyeccionAvanzada } — enriquecen el índice con
 * déficit reproductivo, reemplazos disponibles y riesgo futuro.
 */
export function calcularIndiceGeneticoRenovacion(animales, camadas, bioterioId, extras = {}) {
  const { stockReal = null, candidatos = [], proyeccionAvanzada = null } = extras
  const todosAnimalesColonia = animales.filter(
    a => a.bioterio_id === bioterioId && ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado)
  )

  if (todosAnimalesColonia.length === 0) return {
    score: 50, nivel: 'Sin datos', emoji: '⚪', color: '#666',
    fPromedio: 0, tendencia: 'estable', animalesConPadres: 0,
  }

  const pedigree = buildPedigree(animales, camadas)

  // F individual de cada reproductor activo
  const fValues = todosAnimalesColonia
    .map(a => {
      try {
        if (!a.id_madre && !a.id_padre) return null
        return calcularFCoeficiente(a.id_madre, a.id_padre, pedigree) ?? null
      } catch { return null }
    })
    .filter(f => f !== null)

  const animalesConPadres = fValues.length
  const fPromedio = animalesConPadres > 0
    ? fValues.reduce((a, b) => a + b, 0) / fValues.length
    : 0

  let score = 100
  let advertencias = []

  // Penalizar F promedio alto
  if (fPromedio >= 0.25)       { score -= 40; advertencias.push('Consanguinidad muy alta en reproductores') }
  else if (fPromedio >= 0.125) { score -= 20; advertencias.push('Consanguinidad moderada — vigilar tendencia') }
  else if (fPromedio >= 0.0625){ score -= 10 }

  // Penalizar animales sin genealogía (no podemos calcular riesgo)
  const sinGenealogia = todosAnimalesColonia.length - animalesConPadres
  if (sinGenealogia > 0) {
    const ratioSinGenealogia = sinGenealogia / todosAnimalesColonia.length
    score -= Math.round(ratioSinGenealogia * 15)
    if (ratioSinGenealogia > 0.5) advertencias.push('Más del 50% sin genealogía registrada')
  }

  // Calcular tendencia: comparar F en últimas 2 camadas vs anteriores
  const camadasCompletasOrdenadas = camadas
    .filter(c => c.bioterio_id === bioterioId && c.total_crias > 0 && !c.failure_flag && c.fecha_nacimiento)
    .sort((a, b) => b.fecha_nacimiento.localeCompare(a.fecha_nacimiento))

  let tendencia = 'estable'
  if (camadasCompletasOrdenadas.length >= 4) {
    const recientes  = camadasCompletasOrdenadas.slice(0, 2)
    const anteriores = camadasCompletasOrdenadas.slice(2, 4)
    const fRecientes   = recientes.map(c => { try { return calcularFCoeficiente(c.id_madre, c.id_padre, pedigree) ?? 0 } catch { return 0 } })
    const fAnteriores  = anteriores.map(c => { try { return calcularFCoeficiente(c.id_madre, c.id_padre, pedigree) ?? 0 } catch { return 0 } })
    const avgRec = fRecientes.reduce((a,b)=>a+b,0)/fRecientes.length
    const avgAnt = fAnteriores.reduce((a,b)=>a+b,0)/fAnteriores.length
    if (avgRec > avgAnt + 0.05) { tendencia = 'deteriorando'; score -= 15; advertencias.push('Tendencia creciente de consanguinidad') }
    else if (avgRec < avgAnt - 0.02) tendencia = 'mejorando'
  }

  // ── FACTORES ADICIONALES (enriquecimiento con déficit y proyección) ─────────

  // Déficit actual de reproductores → penaliza renovación aunque la genética sea buena
  if (stockReal) {
    const minimosCfg = getMinimosCriticos(bioterioId)
    const machosActual   = stockReal.reproductores.machos.filter(m => !m.exportado_hibridos).length
    const hembrasActual  = stockReal.reproductores.hembras.filter(h => !h.exportado_hibridos).length

    if (machosActual < minimosCfg.machos_colonia) {
      const pct = machosActual / Math.max(1, minimosCfg.machos_colonia)
      score -= Math.round((1 - pct) * 20)
      advertencias.push(`Déficit de machos: ${machosActual}/${minimosCfg.machos_colonia}`)
    }
    if (hembrasActual < minimosCfg.hembras_colonia) {
      const pct = hembrasActual / Math.max(1, minimosCfg.hembras_colonia)
      score -= Math.round((1 - pct) * 20)
      advertencias.push(`Déficit de hembras: ${hembrasActual}/${minimosCfg.hembras_colonia}`)
    }
  }

  // Reemplazos disponibles en stock → bonifica si hay candidatos listos
  if (candidatos.length > 0) {
    const listos  = candidatos.filter(c => c.recomendado && c.tiempoHastaUtilidad === 0)
    const proximos = candidatos.filter(c => c.tiempoHastaUtilidad > 0 && c.tiempoHastaUtilidad <= 60)
    if      (listos.length > 0)   score += 10
    else if (proximos.length > 0) score += 5
    else { score -= 10; advertencias.push('Sin candidatos de renovación disponibles en stock') }
  } else if (stockReal) {
    score -= 10
    advertencias.push('Sin animales en stock para renovación')
  }

  // Riesgo futuro (proyección 60d)
  if (proyeccionAvanzada) {
    const data60 = proyeccionAvanzada.horizontes?.[60]
    if (data60?.deficit?.hayDeficit && !data60.deficit.puedeCubrirConStock) {
      score -= 15
      advertencias.push('Déficit proyectado en 60d sin cobertura de stock')
    } else if (data60?.deficit?.hayDeficit) {
      score -= 7
      advertencias.push('Déficit proyectado en 60d — hay candidatos para promover')
    }
  }

  const scoreClamp = Math.max(0, Math.min(100, score))
  let nivel, emoji, color
  if (scoreClamp >= 80)      { nivel = 'Renovación saludable'; emoji = '🟢'; color = '#00e676' }
  else if (scoreClamp >= 55) { nivel = 'Vigilar';              emoji = '🟡'; color = '#ffb300' }
  else                       { nivel = 'Riesgo genético';      emoji = '🔴'; color = '#ff6b80' }

  return {
    score: scoreClamp, nivel, emoji, color,
    fPromedio: Math.round(fPromedio * 1000) / 1000,
    fPorcentaje: (fPromedio * 100).toFixed(1) + '%',
    tendencia, animalesConPadres,
    totalReproductores: todosAnimalesColonia.length,
    advertencias,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 9 — SIMULADOR DE IMPACTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simula el impacto de sacrificar o retirar un animal de la colonia.
 * Muestra estado ANTES y DESPUÉS en: stock, mínimos, genética, híbridos.
 */
export function simularImpactoSacrificio(animal, stockReal, minimos, bioterioId, indiceEstabilidadActual) {
  if (!animal) return null

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']
  const esReproductor = estadosActivos.includes(animal.estado)

  // Simular stock sin este animal
  const stockSimulado = {
    ...stockReal,
    reproductores: {
      ...stockReal.reproductores,
      machos: animal.sexo === 'macho' && esReproductor
        ? stockReal.reproductores.machos.filter(m => m.id !== animal.id)
        : stockReal.reproductores.machos,
      hembras: animal.sexo === 'hembra' && esReproductor
        ? stockReal.reproductores.hembras.filter(h => h.id !== animal.id)
        : stockReal.reproductores.hembras,
    }
  }
  stockSimulado.reproductores.totalMachos  = stockSimulado.reproductores.machos.length
  stockSimulado.reproductores.totalHembras = stockSimulado.reproductores.hembras.length

  const minimosDespues = verificarMinimosCriticos(stockSimulado, bioterioId)

  // Verificar bloqueos de jerarquía
  const bloqueo = verificarJerarquiaAntesSacrificio(animal, stockReal, minimos, bioterioId)

  const impactos = []

  if (!bloqueo.permitir) {
    impactos.push({
      tipo:    'critico',
      mensaje: bloqueo.bloqueo?.razon,
      nivel:   'bloquear',
    })
  }

  if (!minimosDespues.ok) {
    minimosDespues.alertas.forEach(a =>
      impactos.push({ tipo: 'deficit', mensaje: a.mensaje, nivel: a.critico ? 'bloquear' : 'advertir' })
    )
  }

  if (animal.exportado_hibridos) {
    impactos.push({ tipo: 'hibridos', mensaje: 'Se pierde un reproductor para producción F1', nivel: 'advertir' })
  }

  return {
    animal,
    permitir:       bloqueo.permitir && !minimosDespues.critico,
    bloqueos:       bloqueo.bloqueos,
    advertencias:   bloqueo.advertencias,
    impactos,
    antes: {
      machos:  stockReal.reproductores.totalMachos,
      hembras: stockReal.reproductores.totalHembras,
      ok:      true,
      score:   indiceEstabilidadActual?.score ?? null,
    },
    despues: {
      machos:  stockSimulado.reproductores.totalMachos,
      hembras: stockSimulado.reproductores.totalHembras,
      ok:      minimosDespues.ok,
      alertas: minimosDespues.alertas,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 10 — SISTEMA DE RESERVAS (localStorage extendido)
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY_RESERVAS = 'appMosca_reservas'

/**
 * Tipos de reserva:
 *  - renovacion: candidato a promover como reproductor
 *  - hibridos:   reservado exclusivamente para producción F1
 *  - pedido:     apartado para un pedido de investigador
 *  - produccion: reservado para ciclo reproductivo planificado
 */
export function getReservas() {
  try {
    const raw = localStorage.getItem(LS_KEY_RESERVAS)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function reservarAnimal(animalId, tipo, motivo = '', bioterioId = '') {
  const reservas = getReservas()
  reservas[animalId] = { tipo, motivo, bioterioId, fecha: new Date().toISOString().split('T')[0] }
  try { localStorage.setItem(LS_KEY_RESERVAS, JSON.stringify(reservas)) } catch {}
}

export function liberarReserva(animalId) {
  const reservas = getReservas()
  delete reservas[animalId]
  try { localStorage.setItem(LS_KEY_RESERVAS, JSON.stringify(reservas)) } catch {}
}

export function esReservado(animalId) {
  const reservas = getReservas()
  return !!reservas[animalId]
}

export function getReservadosPorTipo(tipo) {
  const reservas = getReservas()
  return Object.entries(reservas)
    .filter(([, r]) => r.tipo === tipo)
    .map(([id, r]) => ({ id, ...r }))
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 11 — DÉFICIT FUTURO POR HORIZONTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el estado proyectado de la colonia en 4 horizontes temporales.
 * Retorna alertas específicas por horizonte.
 */
export function calcularDeficitFuturo(animales, camadas, jaulas, sacrificios, entregas, bio, bioterioId) {
  const horizontes = [30, 60, 90, 180]
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)
  const minimos = getMinimosCriticos(bioterioId)

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']

  // Reproductores actuales y sus fechas de vencimiento
  const repros = animales.filter(
    a => a.bioterio_id === bioterioId && estadosActivos.includes(a.estado)
  )

  const resultado = {}

  for (const dias of horizontes) {
    const alertas = []
    const fechaFutura = new Date(hoyDate)
    fechaFutura.setDate(fechaFutura.getDate() + dias)

    // Reproductores que vencen en este horizonte (llegarán al límite de edad)
    const LIMITE = 270
    const machosSacrificiados = repros.filter(m => {
      if (m.sexo !== 'macho' || !m.fecha_nacimiento) return false
      const diasVidaEnFuturo = difDias(m.fecha_nacimiento, fechaFutura)
      const diasVidaHoy = difDias(m.fecha_nacimiento, hoyDate)
      return diasVidaEnFuturo >= LIMITE && diasVidaHoy < LIMITE
    })
    const hembrasSacrificiadas = repros.filter(h => {
      if (h.sexo !== 'hembra' || !h.fecha_nacimiento) return false
      const diasVidaEnFuturo = difDias(h.fecha_nacimiento, fechaFutura)
      const diasVidaHoy = difDias(h.fecha_nacimiento, hoyDate)
      return diasVidaEnFuturo >= LIMITE && diasVidaHoy < LIMITE
    })

    // Machos y hembras disponibles en el futuro (los actuales menos los que vencen)
    const machosColoniaActuales = repros.filter(m => m.sexo === 'macho' && !m.exportado_hibridos)
    const hembrasColoniaActuales = repros.filter(h => h.sexo === 'hembra' && !h.exportado_hibridos)
    const machosFuturos  = machosColoniaActuales.length  - machosSacrificiados.filter(m => !m.exportado_hibridos).length
    const hembrasFuturas = hembrasColoniaActuales.length - hembrasSacrificiadas.filter(h => !h.exportado_hibridos).length

    // Partos esperados (nuevas crías disponibles para promover)
    const partos = camadas.filter(c => {
      if (c.bioterio_id !== bioterioId || c.failure_flag || c.fecha_nacimiento) return false
      const rango = calcularRangoParto(c.fecha_copula, bio)
      if (!rango) return false
      const diasHastaParto = difDias(hoyDate, rango.partoProbable)
      return diasHastaParto >= 0 && diasHastaParto <= dias
    })

    if (machosFuturos < minimos.machos_colonia) {
      alertas.push({
        tipo:    'deficit_machos',
        deficit: minimos.machos_colonia - machosFuturos,
        mensaje: `Déficit de ${minimos.machos_colonia - machosFuturos} macho(s) en ${dias} días`,
        partosCubren: partos.length > 0,
      })
    }
    if (hembrasFuturas < minimos.hembras_colonia) {
      alertas.push({
        tipo:    'deficit_hembras',
        deficit: minimos.hembras_colonia - hembrasFuturas,
        mensaje: `Déficit de ${minimos.hembras_colonia - hembrasFuturas} hembra(s) en ${dias} días`,
        partosCubren: partos.length > 0,
      })
    }

    resultado[dias] = {
      alertas,
      ok:              alertas.length === 0,
      machosFuturos,
      hembrasFuturas,
      vencenMachos:    machosSacrificiados.length,
      vencenHembras:   hembrasSacrificiadas.length,
      partosEsperados: partos.length,
    }
  }

  return resultado
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 12 — HELPERS DE NIVEL / UI
// ─────────────────────────────────────────────────────────────────────────────

export function nivelEstabilidad(score) {
  if (score >= 80) return { label: 'Estable',  emoji: '🟢', color: '#00e676', bg: 'rgba(0,230,118,0.08)', borde: 'rgba(0,230,118,0.25)' }
  if (score >= 60) return { label: 'Vigilar',  emoji: '🟡', color: '#ffb300', bg: 'rgba(255,179,0,0.08)',  borde: 'rgba(255,179,0,0.25)' }
  if (score >= 35) return { label: 'Riesgo',   emoji: '🔴', color: '#ff6b80', bg: 'rgba(255,61,87,0.08)',  borde: 'rgba(255,61,87,0.25)' }
  return              { label: 'Crítico', emoji: '⚫', color: '#9c27b0', bg: 'rgba(156,39,176,0.08)', borde: 'rgba(156,39,176,0.25)' }
}

export function colorNivelF(nivelF) {
  if (nivelF === 'alto')     return '#ff6b80'
  if (nivelF === 'moderado') return '#ffb300'
  if (nivelF === 'leve')     return '#ffd740'
  return '#00e676'
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 13 — BLOQUEO DE APAREAMIENTO POR CONSANGUINIDAD + INCIDENTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa si un apareamiento entre madre y padre debe bloquearse o advertirse.
 * Cruza: coeficiente F + malformaciones previas de esta pareja + infertilidad materna.
 *
 * @param {string}  madreId   - ID de la hembra
 * @param {string}  padreId   - ID del macho
 * @param {object}  pedigree  - resultado de buildPedigree(animales, camadas)
 * @param {array}   camadas   - todas las camadas del bioterio
 * @param {array}   incidentes - todos los incidentes
 * @returns {{ bloquear, nivel, fCoeficiente, fPorcentaje, bloqueos[], advertencias[] }}
 */
export function evaluarBloqueoApareamiento(madreId, padreId, pedigree, camadas, incidentes) {
  const bloqueos     = []
  const advertencias = []

  if (!madreId || !padreId || !pedigree) {
    return { bloquear: false, nivel: 'ok', fCoeficiente: 0, fPorcentaje: '0.0%', bloqueos, advertencias }
  }

  // Consanguinidad madre ↔ padre
  let f = 0
  try { f = calcularFCoeficiente(madreId, padreId, pedigree) ?? 0 } catch { f = 0 }

  if (f >= 0.25) {
    bloqueos.push({ tipo: 'consanguinidad_critica', nivel: 'bloquear',
      razon: `F = ${(f * 100).toFixed(1)}% — consanguinidad muy alta. Cruce bloqueado automáticamente.` })
  } else if (f >= 0.125) {
    advertencias.push({ tipo: 'consanguinidad_alta', nivel: 'advertencia',
      razon: `F = ${(f * 100).toFixed(1)}% — consanguinidad moderada-alta. Considerar otra pareja.` })
  } else if (f >= 0.0625) {
    advertencias.push({ tipo: 'consanguinidad_leve', nivel: 'info',
      razon: `F = ${(f * 100).toFixed(1)}% — consanguinidad leve. Vigilar tendencia.` })
  }

  // Malformaciones en camadas previas de ESTA MISMA pareja (últimos 180d)
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  const camadasPareja = camadas.filter(c => c.id_madre === madreId && c.id_padre === padreId)
  const malformEnPareja = incidentes.filter(i =>
    ['malformacion', 'ausencia_cola', 'ausencia_extremidad'].includes(i.tipo_incidente) &&
    i.fecha >= hace180 &&
    camadasPareja.some(c => c.id === i.camada_id)
  )
  if (malformEnPareja.length >= 2) {
    bloqueos.push({
      tipo: 'malformaciones_previas',
      nivel: f >= 0.125 ? 'bloquear' : 'advertencia',
      razon: `${malformEnPareja.length} malformaciones en camadas previas de esta pareja en 180d.`,
    })
  } else if (malformEnPareja.length === 1 && f >= 0.125) {
    advertencias.push({ tipo: 'malformacion_y_consanguinidad', nivel: 'advertencia',
      razon: `1 malformación en camada previa de esta pareja + consanguinidad moderada.` })
  }

  // Infertilidad crónica de la madre
  const fallosMadre = camadas.filter(c => c.id_madre === madreId && c.failure_flag)
  if (fallosMadre.length >= 3) {
    advertencias.push({ tipo: 'infertilidad_materna', nivel: 'advertencia',
      razon: `La madre tiene ${fallosMadre.length} fallos reproductivos — posible infertilidad crónica.` })
  }

  const debeBloquear = bloqueos.some(b => b.nivel === 'bloquear')
  const nivel = debeBloquear ? 'bloquear'
    : (bloqueos.length > 0 || advertencias.some(a => a.nivel === 'advertencia')) ? 'advertencia'
    : advertencias.length > 0 ? 'info'
    : 'ok'

  return { bloquear: debeBloquear, nivel, fCoeficiente: f, fPorcentaje: (f * 100).toFixed(1) + '%', bloqueos, advertencias }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 14 — DETECCIÓN DE LÍNEAS PROBLEMÁTICAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifica animales cuya línea tiene historial problemático:
 * malformaciones recurrentes, infertilidad crónica o incidentes graves vinculados.
 *
 * Resultado: Map<animalId, { nivel: 'leve'|'moderado'|'critico', razones: string[] }>
 * Usado para penalizar candidatos a renovación y advertir en apareamientos.
 */
export function detectarLineasProblematicas(animales, camadas, incidentes) {
  const problemas = new Map()
  const hace180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)

  function agregar(animalId, razon, nivel) {
    if (!animalId) return
    const e = problemas.get(animalId) ?? { nivel: 'leve', razones: [] }
    e.razones.push(razon)
    if (nivel === 'critico' || (nivel === 'moderado' && e.nivel === 'leve')) e.nivel = nivel
    problemas.set(animalId, e)
  }

  // Fallos reproductivos por hembra
  for (const a of animales) {
    if (a.sexo !== 'hembra') continue
    const fallos = camadas.filter(c => c.id_madre === a.id && c.failure_flag)
    if      (fallos.length >= 5) agregar(a.id, `${fallos.length} fallos reproductivos`, 'critico')
    else if (fallos.length >= 3) agregar(a.id, `${fallos.length} fallos reproductivos`, 'moderado')
  }

  // Malformaciones e infertilidad por incidente → vincular a padres de esa camada
  const malformPorCamada = new Map()
  for (const inc of incidentes) {
    if (!inc.camada_id) continue
    if (
      ['malformacion', 'ausencia_cola', 'ausencia_extremidad', 'alopecia_neonatal'].includes(inc.tipo_incidente) &&
      inc.fecha >= hace180
    ) {
      malformPorCamada.set(inc.camada_id, (malformPorCamada.get(inc.camada_id) || 0) + 1)
    }
    if (inc.tipo_incidente === 'infertilidad' && inc.fecha >= hace180 && inc.animal_id) {
      agregar(inc.animal_id, 'Infertilidad registrada (180d)', 'moderado')
    }
  }

  for (const [camadaId, count] of malformPorCamada.entries()) {
    const cam = camadas.find(c => c.id === camadaId)
    if (!cam) continue
    const nivel = count >= 3 ? 'critico' : count >= 2 ? 'moderado' : 'leve'
    agregar(cam.id_madre, `${count} malformación(es) en camadas (180d)`, nivel)
    agregar(cam.id_padre, `${count} malformación(es) en camadas (180d)`, nivel)
  }

  return problemas
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 15 — MOTOR UNIFICADO DE RENOVACIÓN
// Conecta: déficit + renovación + edad límite + promoción + consanguinidad + sanidad
// Genera un plan de acciones priorizadas con candidatos concretos del stock.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Motor único que analiza la colonia y genera acciones conectadas:
 *   Déficit → Reemplazo → Candidato → Impacto en índice
 *
 * Prioridades: 0=urgente (déficit) · 1=crítico (límite/infertilidad) · 2=alerta · 3=info
 *
 * Ejemplo de flujo: M10 llega al límite de 36d → motor busca M15 en stock →
 * sugiere promoverlo → indica "+8 pts renovación si se ejecuta"
 */
export function calcularMotorRenovacionUnificado(
  stockReal, animales, camadas, bio, bioterioId,
  indiceGenetico = null, indiceSanitario = 100, incidentes = [], todosPedigreeAnimales = null
) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const MADUREZ = bio?.MADUREZ_DIAS ?? 56
  const minimos = getMinimosCriticos(bioterioId)
  const todosAnimales = todosPedigreeAnimales ?? animales
  const pedigree = buildPedigree(todosAnimales, camadas)
  const lineasProblematicas = detectarLineasProblematicas(animales, camadas, incidentes)

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']
  const reproductores = animales.filter(
    a => a.bioterio_id === bioterioId && estadosActivos.includes(a.estado)
  )

  // Perfil completo de cada reproductor
  const perfiles = reproductores.map(a =>
    calcularPerfilReproductor(a, camadas, pedigree, incidentes, lineasProblematicas, bio)
  )

  // Déficit actual (colonia principal, sin híbridos)
  const machosColonia  = stockReal.reproductores.machos.filter(m => !m.exportado_hibridos)
  const hembrasColonia = stockReal.reproductores.hembras.filter(h => !h.exportado_hibridos)
  const deficitMachos  = Math.max(0, minimos.machos_colonia  - machosColonia.length)
  const deficitHembras = Math.max(0, minimos.hembras_colonia - hembrasColonia.length)

  // Bloques de stock con animales que ya superaron la madurez
  const bloquesListos = stockReal.stock.bloques.filter(b => {
    const c = camadas.find(cam => cam.id === b.camadaId)
    return c && difDias(c.fecha_nacimiento, hoy) >= MADUREZ
  })
  const bloquesMachos  = bloquesListos.filter(b => (b.machos  || 0) > 0)
  const bloquesHembras = bloquesListos.filter(b => (b.hembras || 0) > 0)

  // Candidatos bloques ya usados (para no asignar el mismo a dos acciones)
  const candidatosUsados = new Set()

  function mejorBloque(sexo) {
    const lista = sexo === 'macho' ? bloquesMachos : bloquesHembras
    return lista.find(b => !candidatosUsados.has(b.jaulaId)) ?? null
  }

  const accionesRecomendadas = []

  // ── PRIORIDAD 0: DÉFICIT ACTIVO ───────────────────────────────────────────
  for (let i = 0; i < deficitMachos; i++) {
    const bloque = mejorBloque('macho')
    if (bloque) candidatosUsados.add(bloque.jaulaId)
    accionesRecomendadas.push({
      tipo:               'deficit',
      prioridad:          0,
      sexo:               'macho',
      animalSaliente:     null,
      candidato:          bloque,
      motivosPrincipales: ['Déficit activo de machos reproductores'],
      descripcionCorta:   `Cubrir déficit ♂ — promover ${bloque ? 'candidato listo' : 'próxima camada'}`,
      resolucionPosible:  !!bloque,
      impactoEnIndice:    bloque ? '+10 pts renovación' : null,
    })
  }
  for (let i = 0; i < deficitHembras; i++) {
    const bloque = mejorBloque('hembra')
    if (bloque) candidatosUsados.add(bloque.jaulaId)
    accionesRecomendadas.push({
      tipo:               'deficit',
      prioridad:          0,
      sexo:               'hembra',
      animalSaliente:     null,
      candidato:          bloque,
      motivosPrincipales: ['Déficit activo de hembras reproductoras'],
      descripcionCorta:   `Cubrir déficit ♀ — promover ${bloque ? 'candidata lista' : 'próxima camada'}`,
      resolucionPosible:  !!bloque,
      impactoEnIndice:    bloque ? '+10 pts renovación' : null,
    })
  }

  // ── PRIORIDADES 1-2: REPRODUCTORES QUE NECESITAN REEMPLAZO ───────────────
  const necesitanReemplazo = perfiles
    .filter(p => p.necesitaReemplazo)
    .sort((a, b) => {
      const nA = a.nivelAlerta === 'critico' ? 3 : a.nivelAlerta === 'alerta' ? 2 : 1
      const nB = b.nivelAlerta === 'critico' ? 3 : b.nivelAlerta === 'alerta' ? 2 : 1
      return nB - nA
    })

  for (const perfil of necesitanReemplazo) {
    const bloque = mejorBloque(perfil.animal.sexo)
    if (bloque) candidatosUsados.add(bloque.jaulaId)
    const motivosTexto = perfil.motivos
      .filter(m => m.nivel !== 'info')
      .map(m => `${m.tipo}: ${m.descripcion}`)
    accionesRecomendadas.push({
      tipo:               'reemplazo',
      prioridad:          perfil.nivelAlerta === 'critico' ? 1 : 2,
      sexo:               perfil.animal.sexo,
      animalSaliente:     perfil.animal,
      candidato:          bloque,
      motivosPrincipales: motivosTexto,
      descripcionCorta:   `Reemplazar ${perfil.animal.codigo} → ${bloque ? 'promover candidato listo' : 'sin candidato aún'}`,
      resolucionPosible:  !!bloque,
      impactoEnIndice:    bloque ? '+5 pts renovación' : null,
    })
  }

  // ── ÍNDICE DE RENOVACIÓN UNIFICADO (0-100) ────────────────────────────────
  let indiceRenovacion = 100

  // Penalizar déficit activo (mayor penalización porque es la prioridad máxima)
  indiceRenovacion -= deficitMachos  * 20
  indiceRenovacion -= deficitHembras * 20

  // Penalizar reproductores con alertas
  for (const p of perfiles) {
    if      (p.nivelAlerta === 'critico') indiceRenovacion -= 12
    else if (p.nivelAlerta === 'alerta')  indiceRenovacion -= 6
    else if (p.nivelAlerta === 'info')    indiceRenovacion -= 2
  }

  // Bonus por candidatos listos disponibles
  const totalCandidatos = bloquesMachos.length + bloquesHembras.length
  indiceRenovacion += Math.min(12, totalCandidatos * 3)

  // Bonus si todos los problemas tienen solución disponible
  if (accionesRecomendadas.length > 0 && accionesRecomendadas.every(a => a.resolucionPosible)) {
    indiceRenovacion += 5
  }

  // REGLA DURA: déficit activo → máximo 80
  if (deficitMachos > 0 || deficitHembras > 0) {
    indiceRenovacion = Math.min(indiceRenovacion, 80)
  }
  // Acciones críticas sin candidato → máximo 70
  if (accionesRecomendadas.some(a => a.prioridad <= 1 && !a.resolucionPosible)) {
    indiceRenovacion = Math.min(indiceRenovacion, 70)
  }

  indiceRenovacion = Math.max(0, Math.min(100, Math.round(indiceRenovacion)))

  return {
    perfiles,
    deficitActual:        { machos: deficitMachos, hembras: deficitHembras },
    necesitanReemplazo,
    accionesRecomendadas: accionesRecomendadas.sort((a, b) => a.prioridad - b.prioridad),
    indiceRenovacion,
    lineasProblematicas,
    pedigree,
    hayDeficit:      deficitMachos > 0 || deficitHembras > 0,
    todasResolubles: accionesRecomendadas.length > 0 && accionesRecomendadas.every(a => a.resolucionPosible),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 16 — PROYECCIÓN AVANZADA (patrón reproductivo + simulación completa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Patrón de apareamiento por defecto: 1 nueva pareja cada 21 días.
 * Configurable por el usuario desde PlanificacionColonia.
 */
export const PATRON_APAREAMIENTO_DEFAULT = { parejasCada: 21 }

/**
 * Simula la colonia en 4 horizontes (30/60/90/180d) usando:
 *   - Apareamientos activos (fecha_copula sin fecha_nacimiento)
 *   - Patrón histórico/configurado (1 pareja libre cada X días)
 *   - Partos, destetes, supervivencia y mortalidad históricos
 *   - Reproductores que alcanzan el límite de edad (270d)
 *   - Candidatos en stock que alcanzan madurez en el horizonte
 *   - Saturación de jaulas estimada (~10 crías/jaula)
 *
 * @param {object} configuracion - { parejasCada: number } (default PATRON_APAREAMIENTO_DEFAULT)
 * @returns {{ horizontes: object, patrones: object }}
 */
export function calcularProyeccionAvanzada(
  animales, camadas, jaulas, sacrificios, entregas, bio, bioterioId,
  configuracion = {}
) {
  const { parejasCada = 21 } = { ...PATRON_APAREAMIENTO_DEFAULT, ...configuracion }
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const GESTACION = bio?.GESTACION_DIAS ?? 21
  const MADUREZ   = bio?.MADUREZ_DIAS   ?? 56
  const LIMITE    = 270

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']
  const minimos = getMinimosCriticos(bioterioId)

  // Historial productivo
  const camadasBio = camadas.filter(c => c.bioterio_id === bioterioId)
  const exitosas   = camadasBio.filter(c => !c.failure_flag && c.total_crias > 0)
  const fallidas   = camadasBio.filter(c => c.failure_flag)

  const promCrias = exitosas.length > 0
    ? exitosas.reduce((a, c) => a + (c.total_crias || 0), 0) / exitosas.length
    : (bioterioId === 'ratas' ? 10 : 8)

  const conDestete = exitosas.filter(c => c.fecha_destete && (c.total_destetados ?? 0) > 0)
  const tasaSuperv = conDestete.length > 0
    ? conDestete.reduce((a, c) => a + c.total_destetados / c.total_crias, 0) / conDestete.length
    : 0.85

  const tasaFallo = camadasBio.length > 0 ? fallidas.length / camadasBio.length : 0.15

  // Reproductores actuales
  const repros         = animales.filter(a => a.bioterio_id === bioterioId && estadosActivos.includes(a.estado))
  const machosActivos  = repros.filter(a => a.sexo === 'macho'  && !a.exportado_hibridos)
  const hembrasActivas = repros.filter(a => a.sexo === 'hembra' && !a.exportado_hibridos)
  const hembrasLibres    = hembrasActivas.filter(a => a.estado === 'activo')
  const hembrasApareadas = hembrasActivas.filter(a => a.estado === 'en_apareamiento')
  const hembrasEnCria    = hembrasActivas.filter(a => a.estado === 'en_cria')
  const parejasLibres    = Math.min(machosActivos.length, hembrasLibres.length)

  const apareamientosActivos = camadasBio.filter(c => c.fecha_copula && !c.fecha_nacimiento && !c.failure_flag)
  const enLactancia          = camadasBio.filter(c => c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)

  const sacrPorCamada = {}
  for (const s of sacrificios) {
    if (s.camada_id) sacrPorCamada[s.camada_id] = (sacrPorCamada[s.camada_id] || 0) + (s.cantidad || 0)
  }
  const entrPorCamada = {}
  for (const e of entregas) {
    if (e.camada_id) entrPorCamada[e.camada_id] = (entrPorCamada[e.camada_id] || 0) + (e.cantidad || 0)
  }

  const jaulasBio      = jaulas.filter(j => { const c = camadas.find(cc => cc.id === j.camada_id); return c && c.bioterio_id === bioterioId })
  const jaulasActuales = jaulasBio.length

  const resultados = {}

  for (const h of [30, 60, 90, 180]) {
    const fechaFin = new Date(hoyDate)
    fechaFin.setDate(fechaFin.getDate() + h)

    // Partos de apareamientos activos ya en curso
    const partosDeActivos = apareamientosActivos.filter(c => {
      const rango = calcularRangoParto(c.fecha_copula, bio)
      if (!rango) return false
      const dias = difDias(hoyDate, rango.partoProbable)
      return dias >= 0 && dias <= h
    }).length

    // Partos del patrón: cada par libre puede apuntarse en día 0 → parto en GESTACION,
    // luego en día parejasCada → parto en parejasCada+GESTACION, etc.
    let partosPatron = 0
    if (parejasLibres > 0 && h >= GESTACION) {
      const ciclosPorPar = Math.floor((h - GESTACION) / parejasCada) + 1
      partosPatron = Math.round(parejasLibres * ciclosPorPar * (1 - tasaFallo))
    }

    const totalPartos   = partosDeActivos + partosPatron
    const criasDePartos = Math.round(totalPartos * promCrias * tasaSuperv)

    // Crías de destetes pendientes en el horizonte
    const destesPend = enLactancia.filter(c => {
      const fd = calcularDestete(c.fecha_nacimiento, bio)
      if (!fd) return false
      const dias = difDias(hoyDate, fd)
      return dias >= 0 && dias <= h
    })
    const criasDeDestetes = Math.round(
      destesPend.reduce((acc, c) => acc + ((c.total_crias || promCrias) * tasaSuperv), 0)
    )
    const totalCrias = criasDePartos + criasDeDestetes

    // Jaulas nuevas (~10 crías/jaula)
    const jaulasNuevas  = Math.ceil(totalCrias / 10)
    const jaulasProyect = jaulasActuales + jaulasNuevas
    const saturacion    = jaulasProyect > 30 ? 'alta' : jaulasProyect > 20 ? 'media' : 'baja'

    // Bajas por edad límite
    const machosBajas = machosActivos.filter(m => {
      if (!m.fecha_nacimiento) return false
      return difDias(m.fecha_nacimiento, fechaFin) >= LIMITE && difDias(m.fecha_nacimiento, hoyDate) < LIMITE
    }).length
    const hembrasBajas = hembrasActivas.filter(hx => {
      if (!hx.fecha_nacimiento) return false
      return difDias(hx.fecha_nacimiento, fechaFin) >= LIMITE && difDias(hx.fecha_nacimiento, hoyDate) < LIMITE
    }).length

    // Candidatos del stock actual que alcanzan madurez dentro del horizonte
    let candidatosMaduran = 0
    for (const j of jaulasBio) {
      const c = camadas.find(cc => cc.id === j.camada_id)
      if (!c || !c.fecha_nacimiento || c.failure_flag) continue
      const diasVida = difDias(c.fecha_nacimiento, hoyDate)
      const faltaParaMadurez = MADUREZ - diasVida
      if (faltaParaMadurez > 0 && faltaParaMadurez <= h) {
        const vivos = (j.total || 0) - (sacrPorCamada[j.camada_id] || 0) - (entrPorCamada[j.camada_id] || 0)
        if (vivos > 0) candidatosMaduran++
      }
    }

    const machosFuturos  = Math.max(0, machosActivos.length  - machosBajas)
    const hembrasFuturas = Math.max(0, hembrasActivas.length - hembrasBajas)
    const deficitMachos  = Math.max(0, (minimos.machos_colonia  || 0) - machosFuturos)
    const deficitHembras = Math.max(0, (minimos.hembras_colonia || 0) - hembrasFuturas)
    const hayDeficit     = deficitMachos > 0 || deficitHembras > 0
    const puedeCubrir    = hayDeficit && candidatosMaduran >= (deficitMachos + deficitHembras)

    resultados[h] = {
      diasHorizonte: h,
      partos:  { total: totalPartos, deActivos: partosDeActivos, dePatron: partosPatron },
      crias:   { dePartos: criasDePartos, deDestetes: criasDeDestetes, total: totalCrias },
      jaulas:  { actuales: jaulasActuales, nuevas: jaulasNuevas, proyectadas: jaulasProyect, saturacion },
      reproductores: { machosFuturos, hembrasFuturas, machosBajas, hembrasBajas, candidatosMaduran },
      deficit: {
        machos: deficitMachos, hembras: deficitHembras,
        total: deficitMachos + deficitHembras,
        hayDeficit, puedeCubrirConStock: puedeCubrir,
      },
      ok: !hayDeficit,
    }
  }

  return {
    horizontes: resultados,
    patrones: {
      parejasCada,
      promCrias:         Math.round(promCrias * 10) / 10,
      tasaSupervivencia: Math.round(tasaSuperv * 100),
      tasaFallo:         Math.round(tasaFallo * 100),
      parejasLibres, hembrasLibres: hembrasLibres.length,
      hembrasApareadas: hembrasApareadas.length, hembrasEnCria: hembrasEnCria.length,
      machosActivos: machosActivos.length,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 17 — SUGERENCIAS AUTOMÁTICAS DE PROMOCIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dado el resultado de calcularProyeccionAvanzada, genera sugerencias concretas
 * de qué animales promover de stock a reproductores para cubrir déficits proyectados.
 *
 * Criterios de selección (peso en priorityScore):
 *   1. Edad más cercana a madurez reproductiva mínima
 *   2. Mejor genética (F de padres más bajo)
 *   3. Mejor score familiar
 *   4. Sin líneas problemáticas
 *   5. Mayor disponibilidad de sexo correcto en la jaula
 *
 * @returns {Array} Sugerencias ordenadas por urgencia (urgente → importante → preventivo)
 */
export function sugerirPromocionesAutomaticas(
  proyeccionAvanzada, candidatos, animales, camadas, bio, bioterioId
) {
  const minimos     = getMinimosCriticos(bioterioId)
  const sugerencias = []
  const vistosJaula = new Set()

  for (const h of [30, 60, 90, 180]) {
    const data = proyeccionAvanzada.horizontes[h]
    if (!data?.deficit?.hayDeficit) continue

    const urgencia = h <= 30 ? 'urgente' : h <= 60 ? 'importante' : 'preventivo'
    const defsAResolver = []
    if (data.deficit.machos  > 0) defsAResolver.push({ sexo: 'macho',  cantidad: data.deficit.machos  })
    if (data.deficit.hembras > 0) defsAResolver.push({ sexo: 'hembra', cantidad: data.deficit.hembras })

    for (const { sexo, cantidad } of defsAResolver) {
      const aptos = candidatos
        .filter(c => {
          const tieneSexo  = sexo === 'macho' ? (c.machos  || 0) > 0 : (c.hembras || 0) > 0
          const disponible = c.tiempoHastaUtilidad <= h
          return tieneSexo && disponible && !vistosJaula.has(c.jaulaId)
        })
        .slice(0, cantidad)

      for (const cand of aptos) {
        vistosJaula.add(cand.jaulaId)
        const camada     = camadas.find(c => c.id === cand.camadaId)
        const madre      = animales.find(a => a.id === camada?.id_madre)
        const padre      = animales.find(a => a.id === camada?.id_padre)
        const cantSexo   = sexo === 'macho' ? cand.machos : cand.hembras
        const minimoSexo = sexo === 'macho' ? minimos.machos_colonia : minimos.hembras_colonia
        const actualFut  = sexo === 'macho' ? data.reproductores.machosFuturos : data.reproductores.hembrasFuturas

        sugerencias.push({
          horizonte: h, tipo: `promover_${sexo}`, urgencia,
          problema:  `Déficit de ${cantidad} ${sexo}(s) proyectado en ${h}d`,
          solucion:  cand.tiempoHastaUtilidad === 0
            ? `Promover ${cantSexo} ${sexo}(s) · ${cand.diasVida}d de vida — listo ahora`
            : `Promover ${cantSexo} ${sexo}(s) · ${cand.diasVida}d de vida — listo en ${cand.tiempoHastaUtilidad}d`,
          impacto:   `${sexo === 'macho' ? '♂' : '♀'} ${actualFut} → ${actualFut + cantSexo} (mínimo: ${minimoSexo})`,
          candidato: cand, listo: cand.tiempoHastaUtilidad === 0, enDias: cand.tiempoHastaUtilidad,
          padres:    { madre: madre?.codigo ?? '—', padre: padre?.codigo ?? '—' },
          criterios: [
            `${cand.diasVida}d de vida`,
            cand.nivelF === 'bajo' ? 'Genética saludable (F bajo)' : `F padres: ${cand.fPorcentaje}`,
            `Score familiar: ${cand.scoreFamiliar}/10`,
            `Prioridad: ${cand.priorityScore}/100`,
            !cand.advertencia ? 'Sin líneas problemáticas' : null,
          ].filter(Boolean),
        })
      }
    }
  }

  // Dedup: mismo candidato → solo el horizonte más urgente
  const dedup = new Map()
  for (const s of sugerencias.sort((a, b) => a.horizonte - b.horizonte)) {
    const key = `${s.candidato.jaulaId}-${s.tipo}`
    if (!dedup.has(key)) dedup.set(key, s)
  }

  const orden = { urgente: 0, importante: 1, preventivo: 2 }
  return [...dedup.values()].sort((a, b) => orden[a.urgencia] - orden[b.urgencia])
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 18 — ¿PUEDE LA COLONIA SOSTENER PRODUCCIÓN?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evalúa si la colonia puede sostener producción futura considerando
 * déficits proyectados, disponibilidad de reemplazos y saturación.
 *
 * @returns {{ puede: bool, nivel: string, conclusion: string, riesgos: Array, produccion90d: object }}
 */
export function evaluarSostenibilidadColonia(proyeccionAvanzada, stockReal, bioterioId) {
  const riesgos     = []
  let puedeProducir = true

  for (const h of [30, 60, 90, 180]) {
    const data = proyeccionAvanzada.horizontes[h]
    if (!data) continue

    if (data.deficit.hayDeficit && !data.deficit.puedeCubrirConStock) {
      puedeProducir = false
      const detalle = [
        data.deficit.machos  > 0 ? `${data.deficit.machos} macho(s)`  : null,
        data.deficit.hembras > 0 ? `${data.deficit.hembras} hembra(s)` : null,
      ].filter(Boolean).join(' y ')
      riesgos.push({
        horizonte: h,
        nivel:     h <= 60 ? 'critico' : 'advertencia',
        mensaje:   `Déficit de ${detalle} en ${h}d sin reemplazos disponibles`,
      })
    } else if (data.deficit.hayDeficit) {
      riesgos.push({
        horizonte: h, nivel: 'advertencia',
        mensaje:   `Déficit en ${h}d — hay candidatos en stock para promover`,
      })
    }

    if (data.jaulas.saturacion === 'alta') {
      riesgos.push({
        horizonte: h, nivel: 'info',
        mensaje:   `Saturación alta proyectada en ${h}d (~${data.jaulas.proyectadas} jaulas estimadas)`,
      })
    }
  }

  const datos90        = proyeccionAvanzada.horizontes[90]
  const produccionBaja = datos90 && datos90.partos.total < 2

  const conclusion = !puedeProducir
    ? 'La colonia NO puede sostener producción sin intervención urgente'
    : riesgos.some(r => r.nivel === 'advertencia')
    ? 'La colonia puede sostener producción con intervenciones preventivas'
    : produccionBaja
    ? 'Producción proyectada baja — revisar apareamientos activos'
    : 'La colonia puede sostener producción en todos los horizontes analizados'

  const nivel = !puedeProducir ? 'critico'
    : riesgos.some(r => r.nivel === 'advertencia') ? 'vigilar'
    : 'ok'

  return {
    puede: puedeProducir, nivel, conclusion, riesgos,
    produccion90d: datos90
      ? { partos: datos90.partos.total, crias: datos90.crias.total, jaulas: datos90.jaulas.proyectadas }
      : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 19 — MOTOR "¿QUÉ HACER HOY?" (planificación)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera acciones concretas priorizadas para evitar déficits futuros.
 * Prioridad 0 = urgente / 1 = esta semana / 2 = próximas semanas / 3 = preventivo / 4 = info
 *
 * @returns {Array<{ prioridad, tipo, icono, titulo, descripcion, accion }>}
 */
export function generarAccionesHoyPlanificacion(
  proyeccionAvanzada, sugerencias, minimosCfg, stockReal, bioterioId
) {
  const acciones   = []
  const { reproductores } = stockReal
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  const machosActual  = reproductores.machos.filter(m => !m.exportado_hibridos).length
  const hembrasActual = reproductores.hembras.filter(h => !h.exportado_hibridos).length

  // 0. Déficit ACTUAL → acción inmediata
  if (machosActual < (minimosCfg.machos_colonia || 0)) {
    const def      = minimosCfg.machos_colonia - machosActual
    const hayPromo = sugerencias.some(s => s.tipo === 'promover_macho' && s.listo)
    acciones.push({
      prioridad: 0, tipo: 'deficit_actual', icono: '🔴',
      titulo:    `Promover ${def} macho(s) hoy`,
      descripcion: hayPromo
        ? 'Hay candidatos listos en stock — promover inmediatamente para cubrir déficit actual'
        : 'Sin candidatos listos — iniciar apareamiento de emergencia',
      accion: hayPromo ? 'promover_stock' : 'iniciar_apareamiento',
    })
  }

  if (hembrasActual < (minimosCfg.hembras_colonia || 0)) {
    const def      = minimosCfg.hembras_colonia - hembrasActual
    const hayPromo = sugerencias.some(s => s.tipo === 'promover_hembra' && s.listo)
    acciones.push({
      prioridad: 0, tipo: 'deficit_actual', icono: '🔴',
      titulo:    `Promover ${def} hembra(s) hoy`,
      descripcion: hayPromo
        ? 'Hay candidatas listas en stock — promover para cubrir déficit actual'
        : 'Sin candidatas listas — priorizar apareamientos',
      accion: hayPromo ? 'promover_stock' : 'iniciar_apareamiento',
    })
  }

  // 1. Déficit en 30-60d → reservar candidatos esta semana
  const data30 = proyeccionAvanzada.horizontes[30]
  const data60 = proyeccionAvanzada.horizontes[60]
  if (data30?.deficit.hayDeficit || data60?.deficit.hayDeficit) {
    const sugsPendientes = sugerencias.filter(
      s => (s.urgencia === 'urgente' || s.urgencia === 'importante') && !s.listo
    )
    if (sugsPendientes.length > 0) {
      acciones.push({
        prioridad: 1, tipo: 'deficit_proximo', icono: '🟠',
        titulo:    `Reservar ${sugsPendientes.length} candidato(s) en stock`,
        descripcion: 'Madurarán pronto — reservarlos antes de que sean entregados o sacrificados (déficit proyectado en 30-60d)',
        accion: 'reservar_candidatos',
      })
    }
  }

  // 2. Hembras libres sin aparear → oportunidad de apareamiento
  const libres    = reproductores.activasLibres?.length ?? 0
  const apareadas = reproductores.apareadas?.length     ?? 0
  if (libres > 0 && machosActual > 0 && apareadas === 0) {
    acciones.push({
      prioridad: 2, tipo: 'apareamiento_posible', icono: '🟡',
      titulo:    `Iniciar apareamiento (${libres} hembra${libres > 1 ? 's' : ''} libre${libres > 1 ? 's' : ''})`,
      descripcion: 'Hay hembras activas sin aparear — iniciar para generar nueva camada y mantener producción',
      accion: 'iniciar_apareamiento',
    })
  }

  // 3. Reproductores próximos al límite → planificar reemplazo
  const enAlerta = [
    ...reproductores.machos.filter(m => !m.exportado_hibridos),
    ...reproductores.hembras.filter(h => !h.exportado_hibridos),
  ].filter(a => a.fecha_nacimiento && difDias(a.fecha_nacimiento, hoyDate) >= 240)

  if (enAlerta.length > 0) {
    acciones.push({
      prioridad: 3, tipo: 'reemplazo_reproductores', icono: '🟡',
      titulo:    `Planificar reemplazo (${enAlerta.length} reproductor${enAlerta.length > 1 ? 'es' : ''} en alerta)`,
      descripcion: 'Alcanzarán el límite de 270d próximamente — reservar candidatos para renovación antes de perder capacidad reproductiva',
      accion: 'reservar_renovacion',
    })
  }

  // 4. Sin acciones urgentes → colonia estable
  if (Object.values(proyeccionAvanzada.horizontes).every(d => d.ok) && acciones.length === 0) {
    acciones.push({
      prioridad: 4, tipo: 'colonia_estable', icono: '🟢',
      titulo:    'Colonia estable',
      descripcion: 'Sin déficits proyectados en ningún horizonte. Continuar monitoreo regular.',
      accion: null,
    })
  }

  return acciones.sort((a, b) => a.prioridad - b.prioridad)
}
