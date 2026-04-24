import { BIO, MAX_APAREAMIENTOS } from './constants'

// Sumar días a una fecha (retorna Date)
export function sumarDias(fecha, dias) {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  return d
}

// Diferencia en días entre dos fechas (b - a)
export function difDias(fechaA, fechaB) {
  const a = new Date(fechaA)
  const b = new Date(fechaB)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

// Formatear fecha a string legible
export function formatFecha(fecha, opts = {}) {
  if (!fecha) return '—'
  const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : new Date(fecha)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opts,
  })
}

// Fecha de hoy sin hora (string YYYY-MM-DD)
export function hoy() {
  return new Date().toISOString().split('T')[0]
}

// Convertir string YYYY-MM-DD a Date (mediodía para evitar offset)
export function parseDate(str) {
  if (!str) return null
  return new Date(str + 'T12:00:00')
}

/**
 * Calcula la fecha esperada de separación de la pareja (fecha_copula + 15 días).
 */
export function calcularFechaSeparacion(fechaCopula, bio = BIO) {
  if (!fechaCopula) return null
  return sumarDias(parseDate(fechaCopula), bio.DURACION_APAREAMIENTO_DIAS)
}

// ─── MOTOR PREDICTIVO ────────────────────────────────────────────────────────

/**
 * Dado un apareamiento (fecha_cópula), calcula el rango de parto esperado.
 * La concepción puede ocurrir entre 1 y 5 días post-cópula (un ciclo estral).
 * Si ya vino en calor ese mismo día: concepción en 1 día.
 * Si falló ese ciclo: próximo ciclo en 5 días → concepción día 5.
 * Gestación: 23 días desde la concepción.
 */
export function calcularRangoParto(fechaCopula, bio = BIO) {
  if (!fechaCopula) return null
  const copula = parseDate(fechaCopula)
  const concepcionMin = sumarDias(copula, bio.VENTANA_CONCEPCION_MIN)
  const concepcionMax = sumarDias(copula, bio.VENTANA_CONCEPCION_MAX)
  const partoMin = sumarDias(concepcionMin, bio.GESTACION_DIAS)
  const partoMax = sumarDias(concepcionMax, bio.GESTACION_DIAS)
  const concepcionProbable = sumarDias(copula, 2)
  const partoProbable = sumarDias(concepcionProbable, bio.GESTACION_DIAS)

  return { partoMin, partoMax, partoProbable }
}

/**
 * Calcula la fecha de destete dado el nacimiento.
 */
export function calcularDestete(fechaNacimiento, bio = BIO) {
  if (!fechaNacimiento) return null
  return sumarDias(parseDate(fechaNacimiento), bio.DESTETE_DIAS)
}

/**
 * Calcula la fecha de madurez reproductiva dado el nacimiento.
 */
export function calcularMadurez(fechaNacimiento, bio = BIO) {
  if (!fechaNacimiento) return null
  return sumarDias(parseDate(fechaNacimiento), bio.MADUREZ_DIAS)
}

// ─── LATENCIA DE FERTILIZACIÓN ───────────────────────────────────────────────

/**
 * Calcula la latencia de fertilización de una camada.
 * latencia = (fecha_nacimiento - gestacion) - fecha_copula
 * Esto nos dice cuántos días tardó el macho en preñar a la hembra.
 *
 * Usa gestacion_real si está disponible; si no, usa el default 23.
 */
export function calcularLatencia(camada, bio = BIO) {
  const { fecha_copula, fecha_nacimiento, gestacion_real } = camada
  if (!fecha_copula || !fecha_nacimiento) return null

  const gestacion = gestacion_real ?? bio.GESTACION_DIAS
  const nacimiento = parseDate(fecha_nacimiento)
  const concepcion = new Date(nacimiento)
  concepcion.setDate(concepcion.getDate() - gestacion)

  const copula = parseDate(fecha_copula)
  const latencia = difDias(copula, concepcion)

  // Si la latencia es negativa o muy alta, probablemente error de datos
  if (latencia < 0 || latencia > 30) return null
  return latencia
}

/**
 * Interpreta la latencia de fertilización en texto.
 */
export function interpretarLatencia(dias) {
  if (dias === null || dias === undefined) return '—'
  if (dias <= 2) return 'Excelente (1er ciclo rápido)'
  if (dias <= 5) return 'Normal (1er ciclo)'
  if (dias <= 10) return 'Aceptable (2do ciclo)'
  if (dias <= 15) return 'Lento (3er ciclo)'
  return 'Muy lento'
}

// ─── MÉTRICAS DE RENDIMIENTO MACHO ───────────────────────────────────────────

/**
 * Asigna un score discreto a una latencia de fertilización.
 * Reglas:
 *   0–5 días  → 10 (fecundación inmediata o 1er ciclo, óptimo)
 *   6–10 días → 7  (2do ciclo, aceptable)
 *  11–15 días → 5  (3er ciclo, lento)
 *  negativo   → null (error de datos)
 *  fuera de rango → null
 */
export function scorePorLatencia(latencia) {
  if (latencia === null || latencia === undefined) return null
  if (latencia < 0) return null
  if (latencia >= 0 && latencia <= 5)  return 10
  if (latencia >= 6 && latencia <= 10) return 7
  if (latencia >= 11 && latencia <= 15) return 5
  return null
}

/**
 * Calcula métricas de rendimiento para un macho dado todas las camadas.
 * El score_promedio es el indicador principal: promedio de scores discretos por apareamiento.
 */
export function calcularRendimientoMacho(machoId, camadas) {
  const camadasMacho = camadas.filter(
    (c) => c.id_padre === machoId && c.fecha_nacimiento
  )

  if (camadasMacho.length === 0) {
    return {
      machoId,
      total_camadas: 0,
      latencias: [],
      scores_individuales: [],
      promedio_latencia: null,
      min_latencia: null,
      max_latencia: null,
      score_promedio: null,
      score: null,
    }
  }

  const latencias = camadasMacho
    .map((c) => calcularLatencia(c))
    .filter((l) => l !== null)

  const scores_individuales = latencias.map((l) => scorePorLatencia(l)).filter((s) => s !== null)

  const promedio_latencia =
    latencias.length > 0
      ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length * 10) / 10
      : null

  const score_promedio =
    scores_individuales.length > 0
      ? Math.round(scores_individuales.reduce((a, b) => a + b, 0) / scores_individuales.length * 10) / 10
      : null

  return {
    machoId,
    total_camadas: camadasMacho.length,
    latencias,
    scores_individuales,
    promedio_latencia,
    min_latencia: latencias.length > 0 ? Math.min(...latencias) : null,
    max_latencia: latencias.length > 0 ? Math.max(...latencias) : null,
    score_promedio,
    score: score_promedio, // alias para compatibilidad
  }
}

// ─── TAREAS DEL DÍA ──────────────────────────────────────────────────────────

/**
 * Genera todas las tareas automáticas del sistema a partir de camadas y animales.
 * Incluye vencidas, de hoy y próximas (7 días).
 */
export function generarTareas(camadas, animales, bio = BIO) {
  const hoyStr = hoy()
  const hoyDate = parseDate(hoyStr)
  const tareas = []

  camadas.forEach((camada) => {
    const madre = animales.find((a) => a.id === camada.id_madre)
    const padre = animales.find((a) => a.id === camada.id_padre)
    const nombreMadre = madre ? madre.codigo : 'Madre desconocida'
    const nombrePadre = padre ? padre.codigo : '?'

    // 0. Separación de pareja (solo si está en período de apareamiento activo)
    if (camada.fecha_copula && !camada.fecha_separacion && !camada.fecha_nacimiento) {
      const fechaSep = calcularFechaSeparacion(camada.fecha_copula, bio)
      if (fechaSep) {
        const diasHasta = difDias(hoyDate, fechaSep)
        if (diasHasta >= -7 && diasHasta <= 7) {
          tareas.push({
            id: `separacion-${camada.id}`,
            tipo: 'separacion',
            prioridad: diasHasta < 0 ? 'vencida' : diasHasta === 0 ? 'hoy' : 'proxima',
            fecha: fechaSep.toISOString().split('T')[0],
            descripcion: `Separar pareja: ${nombreMadre} × ${nombrePadre}`,
            detalle: `Cópula: ${formatFecha(camada.fecha_copula)} · Fin período de convivencia`,
            camadaId: camada.id,
          })
        }
      }
    }

    // 1. Parto esperado (solo si no hay fecha_nacimiento real aún Y ya pasó el período de apareamiento)
    if (!camada.fecha_nacimiento && camada.fecha_copula) {
      const diasDesdeCopula = difDias(parseDate(camada.fecha_copula), hoyDate)
      const pastSeparacion = camada.fecha_separacion || diasDesdeCopula >= bio.DURACION_APAREAMIENTO_DIAS
      if (pastSeparacion) {
        const rango = calcularRangoParto(camada.fecha_copula, bio)
        if (rango) {
          const { partoMin, partoMax, partoProbable } = rango
          const diasHastaMin = difDias(hoyDate, partoMin)
          const diasHastaMax = difDias(hoyDate, partoMax)

          // Si estamos en la ventana de parto (desde partoMin hasta partoMax + 2 días)
          if (diasHastaMin <= 2 && diasHastaMax >= -2) {
            let prioridad
            if (difDias(hoyDate, partoMin) < 0 && difDias(hoyDate, partoMax) < 0) {
              prioridad = 'vencida'
            } else if (difDias(hoyDate, partoMin) === 0 || difDias(hoyDate, partoMax) === 0) {
              prioridad = 'hoy'
            } else {
              prioridad = 'proxima'
            }

            tareas.push({
              id: `parto-${camada.id}`,
              tipo: 'control_parto',
              prioridad,
              fecha: partoProbable.toISOString().split('T')[0],
              descripcion: `Controlar parto de ${nombreMadre} × ${nombrePadre}`,
              detalle: `Ventana: ${formatFecha(partoMin)} — ${formatFecha(partoMax)}`,
              camadaId: camada.id,
            })
          }
        }
      }
    }

    // 2. Destete (si hay nacimiento pero no hay fecha_destete registrada)
    if (camada.fecha_nacimiento && !camada.fecha_destete) {
      const fechaDestete = calcularDestete(camada.fecha_nacimiento, bio)
      if (fechaDestete) {
        const diasHasta = difDias(hoyDate, fechaDestete)
        if (diasHasta >= -3 && diasHasta <= 7) {
          tareas.push({
            id: `destete-${camada.id}`,
            tipo: 'destete',
            prioridad: diasHasta < 0 ? 'vencida' : diasHasta === 0 ? 'hoy' : 'proxima',
            fecha: fechaDestete.toISOString().split('T')[0],
            descripcion: `Destetar camada de ${nombreMadre}`,
            detalle: `Nacimiento: ${formatFecha(camada.fecha_nacimiento)} · ${camada.total_crias ?? '?'} crías`,
            camadaId: camada.id,
          })
        }
      }
    }

    // 3. Madurez reproductiva de las crías
    if (camada.fecha_nacimiento && camada.total_crias > 0) {
      const fechaMadurez = calcularMadurez(camada.fecha_nacimiento, bio)
      if (fechaMadurez) {
        const diasHasta = difDias(hoyDate, fechaMadurez)
        if (diasHasta >= -1 && diasHasta <= 7) {
          tareas.push({
            id: `madurez-${camada.id}`,
            tipo: 'madurez',
            prioridad: diasHasta < 0 ? 'vencida' : diasHasta === 0 ? 'hoy' : 'proxima',
            fecha: fechaMadurez.toISOString().split('T')[0],
            descripcion: `Crías de ${nombreMadre} alcanzan madurez reproductiva`,
            detalle: `${camada.total_crias} crías · Separar por sexo si es necesario`,
            camadaId: camada.id,
          })
        }
      }
    }

    // 4. Alerta crítica: camada con menos de 8 crías → evaluar/sacrificar hembra
    if (camada.fecha_nacimiento && camada.total_crias != null && camada.total_crias < 8 && !camada.failure_flag) {
      tareas.push({
        id: `evaluar-hembra-${camada.id}`,
        tipo: 'evaluar_hembra',
        prioridad: 'vencida',
        fecha: camada.fecha_nacimiento,
        descripcion: `Evaluar / Sacrificar hembra ${nombreMadre}`,
        detalle: `Camada de ${camada.total_crias} crías (< 8) — Score CRÍTICO (0). Recomendada para sacrificio.`,
        camadaId: camada.id,
        madreId: camada.id_madre,
      })
    }

    // 5. Alerta crítica: supervivencia < 80% → alta pérdida de crías
    if (
      camada.total_destetados != null &&
      camada.total_crias != null &&
      camada.total_crias > 0 &&
      !camada.failure_flag
    ) {
      const rate = camada.total_destetados / camada.total_crias
      if (rate < 0.8) {
        const perdidas = camada.total_crias - camada.total_destetados
        tareas.push({
          id: `supervivencia-critica-${camada.id}`,
          tipo: 'evaluar_hembra',
          prioridad: 'vencida',
          fecha: camada.fecha_destete ?? camada.fecha_nacimiento,
          descripcion: `Alta pérdida de crías — Evaluar hembra ${nombreMadre}`,
          detalle: `Supervivencia ${Math.round(rate * 100)}% (${perdidas} pérdida${perdidas !== 1 ? 's' : ''} de ${camada.total_crias}) — Score CRÍTICO (0). Revisar / considerar descarte.`,
          camadaId: camada.id,
          madreId: camada.id_madre,
        })
      }
    }
  })

  // 6. Fin de ciclo reproductivo: hembra con MAX_APAREAMIENTOS apareamientos y último ya destetado
  const hembraIds = [...new Set(camadas.filter((c) => c.id_madre).map((c) => c.id_madre))]
  hembraIds.forEach((hembraId) => {
    const madre = animales.find((a) => a.id === hembraId)
    // Solo hembras todavía activas (no sacrificadas/retiradas)
    if (!madre || madre.estado === 'fallecido' || madre.estado === 'retirado') return

    const camadasMadre = camadas.filter((c) => c.id_madre === hembraId)
    if (camadasMadre.length < MAX_APAREAMIENTOS) return

    // La última camada debe estar destetada para que el ciclo esté "completo"
    const ultimaDestetada = camadasMadre
      .filter((c) => c.fecha_destete)
      .sort((a, b) => b.fecha_destete.localeCompare(a.fecha_destete))[0]
    if (!ultimaDestetada) return

    const nombreMadre = madre.codigo
    tareas.push({
      id: `fin-ciclo-${hembraId}`,
      tipo: 'fin_ciclo',
      prioridad: 'vencida',
      fecha: ultimaDestetada.fecha_destete,
      descripcion: `Fin de ciclo reproductivo — ${nombreMadre}`,
      detalle: `${camadasMadre.length} apareamientos completados (máx. ${MAX_APAREAMIENTOS}). Recomendada para sacrificio.`,
      madreId: hembraId,
    })
  })

  // Ordenar: vencidas primero, luego hoy, luego próximas; dentro de cada grupo por fecha
  const orden = { vencida: 0, hoy: 1, proxima: 2 }
  tareas.sort((a, b) => {
    if (orden[a.prioridad] !== orden[b.prioridad])
      return orden[a.prioridad] - orden[b.prioridad]
    return a.fecha.localeCompare(b.fecha)
  })

  return tareas
}

// ─── SCORES REPRODUCTIVOS ─────────────────────────────────────────────────────

/**
 * Score por tamaño de camada.
 * 10–12 crías → 10 | 8–9 → 7 | <8 → 0 (CRÍTICO — penalización máxima)
 */
export function scoreTamanoCamada(totalCrias) {
  if (totalCrias == null) return null
  if (totalCrias >= 10) return 10
  if (totalCrias >= 8)  return 7
  return 0
}

/**
 * Score por proporción sexual.
 * Más hembras → 10 | Igual → 7 | Más machos → 5
 */
export function scoreProporcionSexual(machos, hembras) {
  if (machos == null || hembras == null) return null
  if (hembras === machos) return 10
  if (hembras > machos) return 8
  return 5
}

/**
 * Score de supervivencia al destete.
 * 100% → 10 | 80–99% → 7 | <80% → 0 (CRÍTICO)
 */
export function scoreSupervivencia(totalCrias, totalDestetados) {
  if (totalCrias == null || totalCrias === 0 || totalDestetados == null) return null
  const rate = totalDestetados / totalCrias
  if (rate >= 1) return 10
  if (rate >= 0.8) return 7
  return 0
}

/**
 * Calcula todos los scores de una camada en un objeto.
 * Todos los scores son independientes — no se calcula total.
 */
export function calcularScoresCamada(camada) {
  const latencia    = calcularLatencia(camada)
  const timeScore   = scorePorLatencia(latencia)
  const litterScore = scoreTamanoCamada(camada.total_crias)
  const sexScore    = scoreProporcionSexual(camada.crias_machos, camada.crias_hembras)
  const survScore   = scoreSupervivencia(camada.total_crias, camada.total_destetados)

  const lossCount = (camada.total_crias != null && camada.total_destetados != null)
    ? Math.max(0, camada.total_crias - camada.total_destetados)
    : null

  const survivalRate = (camada.total_crias > 0 && camada.total_destetados != null)
    ? camada.total_destetados / camada.total_crias
    : null

  return {
    time_score:       timeScore,
    litter_size_score: litterScore,
    sex_ratio_score:  sexScore,
    survival_score:   survScore,
    loss_count:       lossCount,
    survival_rate:    survivalRate,
    latencia,
  }
}

/**
 * Calcula el perfil histórico promedio de una hembra.
 * Solo camadas con fecha_nacimiento (datos reales).
 */
export function calcularPerfilHembra(hembraId, camadas) {
  const hist = camadas.filter((c) => c.id_madre === hembraId && c.fecha_nacimiento)
  if (hist.length === 0) return null

  const scores = hist.map((c) => calcularScoresCamada(c))

  function avg(key) {
    const vals = scores.map((s) => s[key]).filter((v) => v != null)
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
  }

  return {
    total_camadas:         hist.length,
    avg_time_score:        avg('time_score'),
    avg_litter_size_score: avg('litter_size_score'),
    avg_sex_ratio_score:   avg('sex_ratio_score'),
    avg_survival_score:    avg('survival_score'),
  }
}

const LABEL_FALLO = {
  no_birth:           'Sin parto',
  failed_pregnancy:   'Preñez fallida',
  reabsorption:       'Reabsorción sospechada',
  unknown:            'Fallo desconocido',
}

/**
 * Calcula la confiabilidad reproductiva de una hembra basada en su historial.
 * Considera: fallos registrados (failure_flag) + camadas con < 8 crías.
 *
 * Niveles:
 *  ok        → sin eventos negativos
 *  leve      → 1 evento (fallo o camada baja)
 *  moderada  → 2 fallos registrados
 *  critica   → 3+ eventos combinados
 */
export function calcularConfiabilidadHembra(hembraId, camadas) {
  const hist = camadas.filter((c) => c.id_madre === hembraId)
  if (hist.length === 0) return null

  const fallos       = hist.filter((c) => c.failure_flag)
  const camadasBajas = hist.filter((c) => c.total_crias != null && c.total_crias < 8 && !c.failure_flag)
  const combinados   = fallos.length + camadasBajas.length

  const ultimoFallo = [...fallos]
    .sort((a, b) => (b.fecha_copula ?? '').localeCompare(a.fecha_copula ?? ''))
    [0]

  let nivel, mensaje
  if (combinados >= 3) {
    nivel   = 'critica'
    mensaje = 'Baja confiabilidad — considerar descarte'
  } else if (fallos.length >= 2) {
    nivel   = 'moderada'
    mensaje = 'Alerta moderada — 2 o más fallos registrados'
  } else if (combinados >= 1) {
    nivel   = 'leve'
    mensaje = fallos.length === 0
      ? 'Camada con menos de 8 crías — monitorear'
      : 'Fallo reproductivo registrado — monitorear'
  } else {
    nivel   = 'ok'
    mensaje = null
  }

  return {
    fallos:       fallos.length,
    camadasBajas: camadasBajas.length,
    combinados,
    nivel,
    mensaje,
    ultimoFallo:  ultimoFallo
      ? (LABEL_FALLO[ultimoFallo.failure_type] ?? ultimoFallo.failure_type ?? 'Sin tipo')
      : null,
    totalCamadas: hist.length,
  }
}

/**
 * Genera todos los eventos del calendario a partir de camadas.
 */
export function generarEventosCalendario(camadas, animales, bio = BIO) {
  const eventos = []

  camadas.forEach((camada) => {
    const madre = animales.find((a) => a.id === camada.id_madre)
    const nombreMadre = madre ? madre.codigo : '?'

    // Evento de nacimiento real
    if (camada.fecha_nacimiento) {
      eventos.push({
        id: `nac-real-${camada.id}`,
        fecha: camada.fecha_nacimiento,
        tipo: 'nacimiento',
        titulo: `Nacimiento: ${nombreMadre}`,
        color: 'green',
      })

      const destete = calcularDestete(camada.fecha_nacimiento, bio)
      if (destete && !camada.fecha_destete) {
        eventos.push({
          id: `destete-${camada.id}`,
          fecha: destete.toISOString().split('T')[0],
          tipo: 'destete',
          titulo: `Destete: ${nombreMadre}`,
          color: 'orange',
        })
      }

      const madurez = calcularMadurez(camada.fecha_nacimiento, bio)
      if (madurez) {
        eventos.push({
          id: `madurez-${camada.id}`,
          fecha: madurez.toISOString().split('T')[0],
          tipo: 'madurez',
          titulo: `Madurez crías: ${nombreMadre}`,
          color: 'purple',
        })
      }
    }

    // Parto esperado (si no hay nacimiento real)
    if (!camada.fecha_nacimiento && camada.fecha_copula) {
      const rango = calcularRangoParto(camada.fecha_copula, bio)
      if (rango) {
        eventos.push({
          id: `parto-esp-${camada.id}`,
          fecha: rango.partoProbable.toISOString().split('T')[0],
          tipo: 'parto_esperado',
          titulo: `Parto esperado: ${nombreMadre}`,
          color: 'blue',
        })
      }
    }

    // Cópula
    if (camada.fecha_copula) {
      eventos.push({
        id: `copula-${camada.id}`,
        fecha: camada.fecha_copula,
        tipo: 'copula',
        titulo: `Cópula: ${nombreMadre}`,
        color: 'gray',
      })
    }

    // Separación confirmada
    if (camada.fecha_separacion) {
      eventos.push({
        id: `sep-${camada.id}`,
        fecha: camada.fecha_separacion,
        tipo: 'separacion',
        titulo: `Separación: ${nombreMadre}`,
        color: 'teal',
      })
    } else if (camada.fecha_copula && !camada.fecha_nacimiento) {
      // Separación esperada (si aún no ocurrió)
      const fechaSep = calcularFechaSeparacion(camada.fecha_copula, bio)
      if (fechaSep) {
        eventos.push({
          id: `sep-esp-${camada.id}`,
          fecha: fechaSep.toISOString().split('T')[0],
          tipo: 'separacion',
          titulo: `Separar pareja: ${nombreMadre}`,
          color: 'teal',
        })
      }
    }
  })

  return eventos
}
