import { BIO } from './constants'

/**
 * Calcula la fecha esperada de separación de la pareja (fecha_copula + 15 días).
 */
export function calcularFechaSeparacion(fechaCopula) {
  if (!fechaCopula) return null
  return sumarDias(parseDate(fechaCopula), BIO.DURACION_APAREAMIENTO_DIAS)
}

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

// ─── MOTOR PREDICTIVO ────────────────────────────────────────────────────────

/**
 * Dado un apareamiento (fecha_cópula), calcula el rango de parto esperado.
 * La concepción puede ocurrir entre 1 y 5 días post-cópula (un ciclo estral).
 * Si ya vino en calor ese mismo día: concepción en 1 día.
 * Si falló ese ciclo: próximo ciclo en 5 días → concepción día 5.
 * Gestación: 23 días desde la concepción.
 */
export function calcularRangoParto(fechaCopula) {
  if (!fechaCopula) return null
  const copula = parseDate(fechaCopula)
  // Concepción mínima: 1 día después
  const concepcionMin = sumarDias(copula, BIO.VENTANA_CONCEPCION_MIN)
  // Concepción máxima: 5 días después (un ciclo completo)
  const concepcionMax = sumarDias(copula, BIO.VENTANA_CONCEPCION_MAX)
  // Parto esperado
  const partoMin = sumarDias(concepcionMin, BIO.GESTACION_DIAS)
  const partoMax = sumarDias(concepcionMax, BIO.GESTACION_DIAS)
  // El más probable: concepción a los 2-3 días (promedio)
  const concepcionProbable = sumarDias(copula, 2)
  const partoProbable = sumarDias(concepcionProbable, BIO.GESTACION_DIAS)

  return { partoMin, partoMax, partoProbable }
}

/**
 * Calcula la fecha de destete dado el nacimiento.
 */
export function calcularDestete(fechaNacimiento) {
  if (!fechaNacimiento) return null
  return sumarDias(parseDate(fechaNacimiento), BIO.DESTETE_DIAS)
}

/**
 * Calcula la fecha de madurez reproductiva dado el nacimiento.
 */
export function calcularMadurez(fechaNacimiento) {
  if (!fechaNacimiento) return null
  return sumarDias(parseDate(fechaNacimiento), BIO.MADUREZ_DIAS)
}

// ─── LATENCIA DE FERTILIZACIÓN ───────────────────────────────────────────────

/**
 * Calcula la latencia de fertilización de una camada.
 * latencia = (fecha_nacimiento - gestacion) - fecha_copula
 * Esto nos dice cuántos días tardó el macho en preñar a la hembra.
 *
 * Usa gestacion_real si está disponible; si no, usa el default 23.
 */
export function calcularLatencia(camada) {
  const { fecha_copula, fecha_nacimiento, gestacion_real } = camada
  if (!fecha_copula || !fecha_nacimiento) return null

  const gestacion = gestacion_real ?? BIO.GESTACION_DIAS
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
 *   1–5 días  → 10 (1er ciclo, muy bueno)
 *   6–10 días → 7  (2do ciclo, aceptable)
 *  11–15 días → 5  (3er ciclo, lento)
 *  fuera de rango → null
 */
export function scorePorLatencia(latencia) {
  if (latencia === null || latencia === undefined) return null
  if (latencia >= 1 && latencia <= 5)  return 10
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
export function generarTareas(camadas, animales) {
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
      const fechaSep = calcularFechaSeparacion(camada.fecha_copula)
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
      const pastSeparacion = camada.fecha_separacion || diasDesdeCopula >= BIO.DURACION_APAREAMIENTO_DIAS
      if (pastSeparacion) {
        const rango = calcularRangoParto(camada.fecha_copula)
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
      const fechaDestete = calcularDestete(camada.fecha_nacimiento)
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
      const fechaMadurez = calcularMadurez(camada.fecha_nacimiento)
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

/**
 * Genera todos los eventos del calendario a partir de camadas.
 */
export function generarEventosCalendario(camadas, animales) {
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

      const destete = calcularDestete(camada.fecha_nacimiento)
      if (destete && !camada.fecha_destete) {
        eventos.push({
          id: `destete-${camada.id}`,
          fecha: destete.toISOString().split('T')[0],
          tipo: 'destete',
          titulo: `Destete: ${nombreMadre}`,
          color: 'orange',
        })
      }

      const madurez = calcularMadurez(camada.fecha_nacimiento)
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
      const rango = calcularRangoParto(camada.fecha_copula)
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
      const fechaSep = calcularFechaSeparacion(camada.fecha_copula)
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
