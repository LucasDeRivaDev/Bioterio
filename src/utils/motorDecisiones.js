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
export function calcularCandidatosRenovacion(stockReal, animales, camadas, bio, bioterioId, todosPedigreeAnimales = null) {
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

    const priorityScore = scoreGenetica + scoreFamilia + scoreEdad + scoreDisp

    // Nivel de consanguinidad para mostrar en UI
    let nivelF = 'bajo'
    if (fPadres >= 0.25) nivelF = 'alto'
    else if (fPadres >= 0.125) nivelF = 'moderado'
    else if (fPadres >= 0.0625) nivelF = 'leve'

    candidatos.push({
      jaulaId:           bloque.jaulaId,
      camadaId:          bloque.camadaId,
      total:             bloque.total,
      machos:            bloque.machos,
      hembras:           bloque.hembras,
      diasVida,
      tiempoHastaUtilidad,
      fPadres:           Math.round(fPadres * 1000) / 1000,
      fPorcentaje:       (fPadres * 100).toFixed(1) + '%',
      nivelF,
      scoreFamiliar:     Math.round(scoreFamiliar * 10) / 10,
      priorityScore:     Math.round(priorityScore * 10) / 10,
      recomendado:       nivelF !== 'alto' && scoreFamiliar >= 5,
      advertencia:       nivelF === 'alto'
        ? `Consanguinidad alta (${(fPadres * 100).toFixed(1)}%) — riesgo acumulación genética`
        : nivelF === 'moderado'
        ? `Consanguinidad moderada (${(fPadres * 100).toFixed(1)}%) — vigilar tendencia`
        : null,
    })
  }

  return candidatos.sort((a, b) => b.priorityScore - a.priorityScore)
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
}) {
  let score = 0
  const detalle = {}

  // ── 1. RENOVACIÓN (25 pts) ────────────────────────────────────────────────
  let renovacion = 25
  const { reproductores } = stockReal
  const LIMITE_DIAS = 270, ALERTA_DIAS = 240
  const hoyDate = new Date()
  hoyDate.setHours(0, 0, 0, 0)

  // Reproductores próximos al límite de edad
  const machosConEdad = reproductores.machos.filter(m => {
    if (!m.fecha_nacimiento) return false
    const dias = difDias(m.fecha_nacimiento, hoyDate)
    return dias >= ALERTA_DIAS
  })
  renovacion -= Math.min(15, machosConEdad.length * 5)

  // Sin candidatos disponibles para renovación
  if (candidatosRenovacion.length === 0) renovacion -= 10
  else if (candidatosRenovacion.filter(c => c.recomendado).length === 0) renovacion -= 5

  // Déficit de reproductores
  if (!minimos.ok) {
    renovacion -= minimos.alertas.filter(a => a.critico).length * 8
  }
  detalle.renovacion = Math.max(0, renovacion)

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

  const scoreClamp = Math.max(0, Math.min(100, score))

  let nivel, emoji, color
  if (scoreClamp >= 80) { nivel = 'Estable';   emoji = '🟢'; color = '#00e676' }
  else if (scoreClamp >= 60) { nivel = 'Vigilar';  emoji = '🟡'; color = '#ffb300' }
  else if (scoreClamp >= 35) { nivel = 'Riesgo';   emoji = '🔴'; color = '#ff6b80' }
  else                     { nivel = 'Crítico';  emoji = '⚫'; color = '#9c27b0' }

  return { score: scoreClamp, nivel, emoji, color, detalle }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 8 — ÍNDICE DE RENOVACIÓN GENÉTICA (0-100)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Índice de renovación genética de la colonia (0-100).
 * Basado en diversidad, consanguinidad, tendencia y calidad de línea.
 */
export function calcularIndiceGeneticoRenovacion(animales, camadas, bioterioId) {
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
