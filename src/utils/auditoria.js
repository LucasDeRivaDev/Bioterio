// ─────────────────────────────────────────────────────────────────────────────
// auditoria.js — Motor de auditoría histórica y comparación de períodos
// Compara dos intervalos de tiempo y genera métricas, patrones y causas.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularIndiceSanitario, calcularIndiceAmbiental } from './sanitario'
import { buildPedigree, estadisticasColonia } from './genealogia'

// ── Presets de período ───────────────────────────────────────────────────────
export function getPresetsPeriodo() {
  const hoy = new Date()
  function restarDias(n) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - n)
    return d.toISOString().split('T')[0]
  }
  const hoyStr = hoy.toISOString().split('T')[0]

  return [
    {
      id: 'mes',
      label: 'Último mes',
      desdeB: restarDias(30), hastaB: hoyStr,
      desdeA: restarDias(60), hastaA: restarDias(30),
    },
    {
      id: 'trimestre',
      label: 'Último trimestre',
      desdeB: restarDias(90), hastaB: hoyStr,
      desdeA: restarDias(180), hastaA: restarDias(90),
    },
    {
      id: 'semestre',
      label: 'Último semestre',
      desdeB: restarDias(180), hastaB: hoyStr,
      desdeA: restarDias(360), hastaA: restarDias(180),
    },
    {
      id: 'anual',
      label: 'Último año',
      desdeB: restarDias(365), hastaB: hoyStr,
      desdeA: restarDias(730), hastaA: restarDias(365),
    },
  ]
}

// ── Filtrar por período ──────────────────────────────────────────────────────
export function filtrarPorPeriodo(items, campo, desde, hasta) {
  if (!items?.length) return []
  return items.filter(item => {
    const f = item[campo]
    return f && f >= desde && f <= hasta
  })
}

// ── Métricas reproductivas ───────────────────────────────────────────────────
export function calcularMetricasReproduccion(camadas) {
  if (!camadas?.length) return {
    total: 0, exitosos: 0, fallidos: 0, enCurso: 0,
    fertilidad: 0, latenciaMedia: null,
    tamanoCamadaMedio: 0, supervivenciaMedio: 0,
    proporcionSexual: 0.5, eficienciaRepro: 0,
    abortos: 0, reabsorciones: 0, partosFallidos: 0,
  }

  const conParto  = camadas.filter(c => c.fecha_nacimiento && !c.failure_flag)
  const fallidas  = camadas.filter(c => c.failure_flag)
  const enCurso   = camadas.filter(c => !c.fecha_nacimiento && !c.failure_flag)

  const efectivas = conParto.filter(c => (c.total_crias || 0) > 0)
  const tamanoCamadaMedio = efectivas.length
    ? efectivas.reduce((s, c) => s + (c.total_crias || 0), 0) / efectivas.length
    : 0

  const conDestete = conParto.filter(c => (c.total_destetados || 0) > 0 && (c.total_crias || 0) > 0)
  const supervivenciaMedio = conDestete.length
    ? conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
    : 0

  const conSexo = efectivas.filter(c => (c.crias_machos || 0) + (c.crias_hembras || 0) > 0)
  const proporcionSexual = conSexo.length
    ? conSexo.reduce((s, c) => {
        const tot = (c.crias_machos || 0) + (c.crias_hembras || 0)
        return s + (c.crias_hembras || 0) / tot
      }, 0) / conSexo.length
    : 0.5

  const conLatencia = conParto.filter(c => c.fecha_copula && c.fecha_nacimiento)
  const latencias   = conLatencia.map(c => {
    const dias = Math.round((new Date(c.fecha_nacimiento) - new Date(c.fecha_copula)) / 86400000)
    return Math.max(0, dias - 21)
  })
  const latenciaMedia = latencias.length
    ? latencias.reduce((s, v) => s + v, 0) / latencias.length
    : null

  const total      = conParto.length + fallidas.length
  const fertilidad = total > 0 ? conParto.length / total : 0

  const abortos      = fallidas.filter(c => c.failure_type === 'reabsorcion').length
  const reabsorciones = fallidas.filter(c => c.failure_type === 'failed_pregnancy').length
  const partosFallidos = fallidas.filter(c => c.failure_type === 'no_birth' || c.failure_type === 'unknown').length

  const eficienciaRepro = (fertilidad * 0.5 + supervivenciaMedio * 0.5) * 100

  return {
    total, exitosos: conParto.length, fallidos: fallidas.length, enCurso: enCurso.length,
    fertilidad, latenciaMedia, tamanoCamadaMedio, supervivenciaMedio,
    proporcionSexual, eficienciaRepro, abortos, reabsorciones, partosFallidos,
  }
}

// ── Métricas de producción ───────────────────────────────────────────────────
export function calcularMetricasProduccion(camadasConParto, sacrificiosPeriodo, entregasPeriodo) {
  const efectivas = camadasConParto.filter(c => c.fecha_nacimiento && !c.failure_flag)
  const nacidos     = efectivas.reduce((s, c) => s + (c.total_crias || 0), 0)
  const destetados  = efectivas.reduce((s, c) => s + (c.total_destetados || 0), 0)
  const sacrificados = sacrificiosPeriodo.reduce((s, s2) => s + (s2.cantidad || 0), 0)
  const entregados   = entregasPeriodo.reduce((s, e) => s + (e.cantidad || 0), 0)
  const eficiencia   = nacidos > 0 ? (destetados / nacidos) * 100 : 0

  return { nacidos, destetados, sacrificados, entregados, totalProduccion: destetados, eficiencia }
}

// ── Métricas sanitarias ──────────────────────────────────────────────────────
export function calcularMetricasSanidad(incidentes, camadasPeriodo, bioterioId) {
  const graves        = incidentes.filter(i => i.severidad === 'grave').length
  const moderados     = incidentes.filter(i => i.severidad === 'moderado').length
  const leves         = incidentes.filter(i => i.severidad === 'leve').length
  const malformaciones = incidentes.filter(i => i.tipo_categoria === 'crias').length
  const abiertos      = incidentes.filter(i => !i.resuelto).length
  const mortalidadNeonatal = incidentes.filter(i => i.tipo_incidente === 'muerte_neonatal').length

  let indiceSanitario = 100
  try { indiceSanitario = calcularIndiceSanitario(camadasPeriodo, incidentes, bioterioId) }
  catch { /* fallback 100 */ }

  return {
    indiceSanitario, total: incidentes.length,
    graves, moderados, leves, malformaciones, abiertos, mortalidadNeonatal,
  }
}

// ── Métricas ambientales ─────────────────────────────────────────────────────
export function calcularMetricasAmbiente(temperaturas, bioterioId) {
  let indiceAmbiental = 0
  try { indiceAmbiental = calcularIndiceAmbiental(temperaturas, bioterioId) }
  catch { /* fallback */ }

  const registros = temperaturas.filter(t =>
    bioterioId === 'ratas'
      ? t.bioterio_id === 'ratas'
      : ['ratones', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos'].includes(t.bioterio_id)
  )

  if (!registros.length) return { indiceAmbiental, tempMedia: null, diasFueraRango: 0, diasAtencion: 0, estabilidad: 100, totalRegistros: 0 }

  const temps = registros.map(r => r.current_temp).filter(v => v != null)
  const tempMedia = temps.length ? temps.reduce((s, v) => s + v, 0) / temps.length : null

  const diasFueraRango = registros.filter(r => r.current_temp < 18 || r.current_temp > 26).length
  const diasAtencion   = registros.filter(r =>
    (r.current_temp >= 18 && r.current_temp < 20) || (r.current_temp > 24 && r.current_temp <= 26)
  ).length

  let oscilaciones = 0
  for (let i = 1; i < registros.length; i++) {
    if (Math.abs((registros[i].current_temp || 0) - (registros[i - 1].current_temp || 0)) > 3) oscilaciones++
  }
  const estabilidad = registros.length > 1
    ? Math.max(0, 100 - (oscilaciones / (registros.length - 1)) * 100)
    : 100

  return { indiceAmbiental, tempMedia, diasFueraRango, diasAtencion, estabilidad, totalRegistros: registros.length }
}

// ── Métricas genéticas ───────────────────────────────────────────────────────
export function calcularMetricasGenetica(animalesActivos, todasCamadas) {
  try {
    const pedigree = buildPedigree(animalesActivos, todasCamadas)
    const stats    = estadisticasColonia(animalesActivos, todasCamadas, pedigree)
    return {
      fMedia:              stats.fMedia ?? 0,
      animalesSinAncestros: stats.sinAncestros ?? 0,
      animalesAltoF:        stats.altoF ?? 0,
      totalAnimales:        animalesActivos.length,
      diversidadEstimada:   Math.max(0, 100 - (stats.fMedia ?? 0) * 100),
    }
  } catch {
    return {
      fMedia: 0, animalesSinAncestros: 0, animalesAltoF: 0,
      totalAnimales: animalesActivos.length, diversidadEstimada: 100,
    }
  }
}

// ── Índice global de rendimiento (0–100) ─────────────────────────────────────
export function calcularIndiceGlobal({ repro, prod, sanidad, ambiente }) {
  const puntosRepro    = (repro.fertilidad || 0) * 50 + (repro.supervivenciaMedio || 0) * 50
  const puntosProd     = Math.min(100, prod.eficiencia || 0)
  const puntosSanidad  = sanidad.indiceSanitario || 0
  const puntosAmbiente = ambiente.indiceAmbiental || 0

  return Math.round(Math.max(0, Math.min(100,
    puntosRepro    * 0.30 +
    puntosProd     * 0.25 +
    puntosSanidad  * 0.25 +
    puntosAmbiente * 0.20
  )))
}

// ── Índice de estabilidad de colonia (0–100) ──────────────────────────────────
export function calcularIndiceEstabilidad({ repro, sanidad, ambiente, genetica }) {
  return Math.round(Math.max(0, Math.min(100,
    (repro.fertilidad || 0) * 100 * 0.30 +
    (sanidad.indiceSanitario || 0)  * 0.25 +
    (ambiente.indiceAmbiental || 0) * 0.20 +
    (genetica.diversidadEstimada || 100) * 0.25
  )))
}

// ── Señal de comparación ─────────────────────────────────────────────────────
function señal(a, b, mayorEsMejor = true, umbral = 0.05) {
  if (a == null || b == null || (a === 0 && b === 0)) return 'neutro'
  const delta   = b - a
  const ref     = Math.abs(a) || 1
  const cambio  = delta / ref

  if (Math.abs(cambio) < umbral) return 'estable'
  const mejora  = mayorEsMejor ? delta > 0 : delta < 0
  const grande  = Math.abs(cambio) > 0.25
  return mejora ? (grande ? 'mejora_significativa' : 'mejora') : (grande ? 'deterioro_significativo' : 'deterioro')
}

// ── Comparar dos períodos ─────────────────────────────────────────────────────
export function compararPeriodos(mA, mB) {
  const { repro: rA, prod: pA, sanidad: sA, ambiente: aA, genetica: gA, indiceGlobal: igA, indiceEstabilidad: ieA } = mA
  const { repro: rB, prod: pB, sanidad: sB, ambiente: aB, genetica: gB, indiceGlobal: igB, indiceEstabilidad: ieB } = mB

  function diff(vA, vB, mayor = true) {
    return { A: vA, B: vB, delta: (vB ?? 0) - (vA ?? 0), senal: señal(vA, vB, mayor) }
  }

  return {
    // Globales
    indiceGlobal:      diff(igA, igB),
    indiceEstabilidad: diff(ieA, ieB),
    // Reproducción
    fertilidad:       diff(rA.fertilidad,        rB.fertilidad),
    exitosos:         diff(rA.exitosos,           rB.exitosos),
    fallidos:         diff(rA.fallidos,           rB.fallidos, false),
    latenciaMedia:    diff(rA.latenciaMedia ?? 0, rB.latenciaMedia ?? 0, false),
    tamanoCamada:     diff(rA.tamanoCamadaMedio,  rB.tamanoCamadaMedio),
    supervivencia:    diff(rA.supervivenciaMedio, rB.supervivenciaMedio),
    proporcionSexual: { A: rA.proporcionSexual, B: rB.proporcionSexual, delta: (rB.proporcionSexual || 0.5) - (rA.proporcionSexual || 0.5), senal: 'neutro' },
    eficienciaRepro:  diff(rA.eficienciaRepro,   rB.eficienciaRepro),
    abortos:          diff(rA.abortos,            rB.abortos, false),
    // Producción
    nacidos:          diff(pA.nacidos,      pB.nacidos),
    destetados:       diff(pA.destetados,   pB.destetados),
    entregados:       diff(pA.entregados,   pB.entregados),
    sacrificados:     { A: pA.sacrificados, B: pB.sacrificados, delta: pB.sacrificados - pA.sacrificados, senal: 'neutro' },
    eficienciaProd:   diff(pA.eficiencia,   pB.eficiencia),
    // Sanidad
    indiceSanitario:  diff(sA.indiceSanitario, sB.indiceSanitario),
    incidentesTotal:  diff(sA.total,           sB.total, false),
    graves:           diff(sA.graves,           sB.graves, false),
    malformaciones:   diff(sA.malformaciones,   sB.malformaciones, false),
    mortalidadNeonatal: diff(sA.mortalidadNeonatal, sB.mortalidadNeonatal, false),
    // Ambiente
    indiceAmbiental:  diff(aA.indiceAmbiental, aB.indiceAmbiental),
    tempMedia:        { A: aA.tempMedia, B: aB.tempMedia, delta: (aB.tempMedia ?? 0) - (aA.tempMedia ?? 0), senal: 'neutro' },
    diasFueraRango:   diff(aA.diasFueraRango, aB.diasFueraRango, false),
    estabilidadTemp:  diff(aA.estabilidad,    aB.estabilidad),
    // Genética
    fMedia:           diff(gA.fMedia,             gB.fMedia, false),
    diversidad:       diff(gA.diversidadEstimada, gB.diversidadEstimada),
    animalesAltoF:    diff(gA.animalesAltoF,       gB.animalesAltoF, false),
  }
}

// ── Detectar patrones globales ────────────────────────────────────────────────
export function detectarPatronesGlobales(comp) {
  const patrones = []
  const clave = [comp.fertilidad, comp.supervivencia, comp.indiceSanitario, comp.indiceAmbiental]

  const mejoras     = clave.filter(m => m.senal?.includes('mejora')).length
  const deterioros  = clave.filter(m => m.senal?.includes('deterioro')).length

  if (mejoras >= 3)    patrones.push({ nivel: 'positivo', patron: '🟢 Mejora sostenida', descripcion: 'La mayoría de los indicadores clave mejoró entre períodos.' })
  if (deterioros >= 3) patrones.push({ nivel: 'critico',  patron: '🔴 Deterioro generalizado', descripcion: 'La mayoría de los indicadores clave empeoró. Revisión urgente recomendada.' })

  if (comp.nacidos.delta > 0 && comp.supervivencia.delta < -0.05)
    patrones.push({ nivel: 'alerta', patron: '⚠️ Posible sobreexplotación', descripcion: 'Producción aumentó pero la supervivencia de crías bajó.' })

  if (comp.fMedia.senal?.includes('deterioro') && comp.malformaciones.delta > 0)
    patrones.push({ nivel: 'riesgo', patron: '⚫ Riesgo genético progresivo', descripcion: 'Consanguinidad en alza con más malformaciones detectadas.' })

  if (comp.diasFueraRango.delta > 5 && comp.fertilidad.delta < -0.05)
    patrones.push({ nivel: 'alerta', patron: '🌡️ Estrés ambiental → fertilidad', descripcion: 'Más días fuera del rango térmico correlacionan con menor fertilidad.' })

  if (!patrones.length)
    patrones.push({ nivel: 'estable', patron: '🟡 Colonia estable', descripcion: 'Los indicadores globales permanecen estables entre períodos.' })

  return patrones
}

// ── Motor causal histórico ────────────────────────────────────────────────────
export function motorCausalHistorico(comp) {
  const hipotesis = []

  // Producción ↑ + Supervivencia ↓
  if (comp.nacidos.delta > 5 && comp.supervivencia.delta < -0.05)
    hipotesis.push({ nivel: 'alerta', problema: 'Producción ↑ pero supervivencia al destete ↓', factores: ['Posible sobreexplotación de reproductores', 'Estrés reproductivo crónico', 'Densidad elevada en jaulas'], recomendacion: 'Reducir ritmo de apareamientos y revisar descanso post-parto.' })

  // Temperatura + fertilidad
  if (comp.diasFueraRango.delta > 3 && comp.fertilidad.delta < -0.05)
    hipotesis.push({ nivel: 'alerta', problema: 'Inestabilidad térmica → baja fertilidad', factores: ['Temperatura fuera de rango en el período', 'Estrés calórico reduce tasa de concepción'], recomendacion: 'Monitorear temperatura diaria. Objetivo 20–24 °C estable.' })

  // Incidentes graves + tamaño de camada
  if (comp.graves.delta > 1 && comp.tamanoCamada.delta < -1)
    hipotesis.push({ nivel: 'critico', problema: 'Incidentes graves correlacionan con menor tamaño de camada', factores: ['Posible patología subyacente no identificada', 'Condición sanitaria general deteriorada'], recomendacion: 'Revisar historial de incidentes graves. Consultar veterinario.' })

  // Consanguinidad + malformaciones
  if (comp.fMedia.delta > 0.05 && comp.malformaciones.delta > 1)
    hipotesis.push({ nivel: 'critico', problema: 'Consanguinidad ↑ correlaciona con más malformaciones', factores: ['Depresión consanguínea progresiva', 'Falta de renovación genética externa'], recomendacion: 'Urgente: introducir animales de otra colonia. Rotar líneas.' })

  // Latencia ↑
  if (comp.latenciaMedia.delta > 3)
    hipotesis.push({ nivel: 'alerta', problema: 'Latencia de fecundación aumentó', factores: ['Posible fatiga reproductiva en machos', 'Machos de edad avanzada', 'Relación macho:hembra desbalanceada'], recomendacion: 'Revisar edad de machos activos. Considerar rotación.' })

  // Producción ↑ + incidentes ↑
  if (comp.nacidos.delta > 10 && comp.incidentesTotal.delta > 2)
    hipotesis.push({ nivel: 'alerta', problema: 'Más producción + más incidentes → posible saturación', factores: ['Hacinamiento en jaulas', 'Reducción en atención individual'], recomendacion: 'Revisar densidad por jaula antes de aumentar producción.' })

  // Mejora ambiental + mejora fertilidad (positivo)
  if (comp.indiceAmbiental.delta > 5 && comp.fertilidad.delta > 0.05)
    hipotesis.push({ nivel: 'positivo', problema: 'Mejora ambiental → mejor fertilidad', factores: ['Temperatura más estable', 'Condiciones de alojamiento mejoradas'], recomendacion: 'Mantener condiciones actuales. Documentar cambios implementados.' })

  // Abortos ↑
  if (comp.abortos.delta > 1)
    hipotesis.push({ nivel: 'alerta', problema: 'Aumento de abortos/reabsorciones', factores: ['Estrés reproductivo', 'Posible déficit nutricional', 'Temperatura fuera de rango durante gestación'], recomendacion: 'Revisar nutrición de gestantes y temperatura durante gestación.' })

  return hipotesis
}

// ── Resumen automático ─────────────────────────────────────────────────────────
export function generarResumenAutomatico(comp, hipotesis) {
  const lineas = []

  const delta = comp.indiceGlobal.delta
  if (Math.abs(delta) >= 3)
    lineas.push(`El índice global ${delta > 0 ? 'mejoró' : 'empeoró'} ${Math.abs(delta).toFixed(0)} puntos (${comp.indiceGlobal.A} → ${comp.indiceGlobal.B}).`)

  if (comp.fertilidad.senal?.includes('mejora'))
    lineas.push(`Fertilidad mejoró: ${(comp.fertilidad.A * 100).toFixed(0)}% → ${(comp.fertilidad.B * 100).toFixed(0)}%.`)
  else if (comp.fertilidad.senal?.includes('deterioro'))
    lineas.push(`Fertilidad bajó: ${(comp.fertilidad.A * 100).toFixed(0)}% → ${(comp.fertilidad.B * 100).toFixed(0)}%.`)

  if (comp.tamanoCamada.senal?.includes('deterioro'))
    lineas.push(`Tamaño de camada disminuyó: ${comp.tamanoCamada.A.toFixed(1)} → ${comp.tamanoCamada.B.toFixed(1)} crías/parto.`)

  if (comp.nacidos.delta !== 0)
    lineas.push(`Producción: ${comp.nacidos.A}→${comp.nacidos.B} nacidos. ${comp.destetados.A}→${comp.destetados.B} destetados.`)

  if (comp.graves.delta > 0)
    lineas.push(`⚠️ Incidentes graves: ${comp.graves.A} → ${comp.graves.B}.`)

  const criticos = hipotesis.filter(h => h.nivel === 'critico')
  if (criticos.length)
    lineas.push(`🔴 Causas críticas: ${criticos.map(h => h.problema).join('. ')}`)

  return lineas.length ? lineas.join('\n') : 'Sin cambios significativos detectados entre los períodos seleccionados.'
}

// ── Métricas de renovación de reproductores ───────────────────────────────────
export function calcularMetricasRenovacion(todosAnimalesBio, animalesRetiradosPeriodo) {
  const LIMITE = 270
  const ALERTA = 240
  const hoy = new Date()

  const activos = todosAnimalesBio.filter(a =>
    ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado)
  )
  const machos  = activos.filter(a => a.sexo === 'macho')
  const hembras = activos.filter(a => a.sexo === 'hembra')

  const conFecha = activos.filter(a => a.fecha_nacimiento)
  const edadMedia = conFecha.length
    ? conFecha.reduce((s, a) => s + Math.round((hoy - new Date(a.fecha_nacimiento)) / 86400000), 0) / conFecha.length
    : null

  const proximosLimite = activos.filter(a => {
    if (!a.fecha_nacimiento) return false
    const dias = Math.round((hoy - new Date(a.fecha_nacimiento)) / 86400000)
    return dias >= ALERTA && dias < LIMITE
  }).length

  const excedidos = activos.filter(a => {
    if (!a.fecha_nacimiento) return false
    return Math.round((hoy - new Date(a.fecha_nacimiento)) / 86400000) >= LIMITE
  }).length

  const retirados = animalesRetiradosPeriodo.length
  const tasaRenovacion = activos.length > 0 ? (retirados / activos.length) * 100 : 0

  return {
    totalActivos: activos.length,
    machos: machos.length,
    hembras: hembras.length,
    edadMedia,
    proximosLimite,
    excedidos,
    retirados,
    tasaRenovacion,
  }
}

// ── Métricas de producción de híbridos F1 ─────────────────────────────────────
export function calcularMetricasHibridos(camadasF1) {
  if (!camadasF1?.length) return {
    total: 0, exitosos: 0, fallidos: 0,
    nacidos: 0, destetados: 0, eficiencia: 0,
    tiempoMedioDestete: null, tamanoCamadaMedio: 0,
  }

  const exitosos = camadasF1.filter(c => c.fecha_nacimiento && !c.failure_flag)
  const fallidos = camadasF1.filter(c => c.failure_flag)

  const nacidos    = exitosos.reduce((s, c) => s + (c.total_crias || 0), 0)
  const destetados = exitosos.reduce((s, c) => s + (c.total_destetados || 0), 0)
  const eficiencia = nacidos > 0 ? (destetados / nacidos) * 100 : 0
  const tamanoCamadaMedio = exitosos.length
    ? exitosos.reduce((s, c) => s + (c.total_crias || 0), 0) / exitosos.length
    : 0

  const conDestete = exitosos.filter(c => c.fecha_nacimiento && c.fecha_destete)
  const tiempoMedioDestete = conDestete.length
    ? conDestete.reduce((s, c) =>
        s + Math.round((new Date(c.fecha_destete) - new Date(c.fecha_nacimiento)) / 86400000), 0
      ) / conDestete.length
    : null

  return {
    total: camadasF1.length, exitosos: exitosos.length, fallidos: fallidos.length,
    nacidos, destetados, eficiencia, tiempoMedioDestete, tamanoCamadaMedio,
  }
}

// ── Tendencias históricas mes a mes ───────────────────────────────────────────
export function calcularTendencias(todasCamadas, todosIncidentes, todasTemperaturas, bioterioId, meses = 12) {
  const hoy = new Date()
  const puntos = []

  for (let i = meses - 1; i >= 0; i--) {
    const inicio   = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const fin      = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0)
    const desdeStr = inicio.toISOString().split('T')[0]
    const hastaStr = fin.toISOString().split('T')[0]

    const camadas    = filtrarPorPeriodo(todasCamadas, 'fecha_copula', desdeStr, hastaStr)
    const incidentes = filtrarPorPeriodo(todosIncidentes, 'fecha', desdeStr, hastaStr)
    const temps      = filtrarPorPeriodo(todasTemperaturas, 'date', desdeStr, hastaStr)

    const repro = calcularMetricasReproduccion(camadas)
    const prod  = calcularMetricasProduccion(
      camadas.filter(c => c.fecha_nacimiento && !c.failure_flag), [], []
    )

    const tempsFiltradas = temps.filter(t =>
      bioterioId === 'ratas'
        ? t.bioterio_id === 'ratas'
        : ['ratones', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos'].includes(t.bioterio_id)
    )
    const tempMedia = tempsFiltradas.length
      ? tempsFiltradas.reduce((s, t) => s + (t.current_temp || 0), 0) / tempsFiltradas.length
      : null

    puntos.push({
      mes: inicio.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      fertilidad: +(repro.fertilidad * 100).toFixed(1),
      nacidos: prod.nacidos,
      destetados: prod.destetados,
      tamanoCamada: +repro.tamanoCamadaMedio.toFixed(1),
      supervivencia: +(repro.supervivenciaMedio * 100).toFixed(1),
      incidentes: incidentes.length,
      graves: incidentes.filter(i => i.severidad === 'grave').length,
      tempMedia: tempMedia !== null ? +tempMedia.toFixed(1) : null,
    })
  }

  return puntos
}

// ── Regresión lineal simple (helper interno) ──────────────────────────────────
function computeSlope(values) {
  const valid = values.map((v, i) => ({ v, i })).filter(({ v }) => v != null && !isNaN(v))
  if (valid.length < 2) return 0
  const n    = valid.length
  const sumX = valid.reduce((s, { i }) => s + i, 0)
  const sumY = valid.reduce((s, { v }) => s + v, 0)
  const sumXY = valid.reduce((s, { v, i }) => s + v * i, 0)
  const sumX2 = valid.reduce((s, { i }) => s + i * i, 0)
  const denom = n * sumX2 - sumX * sumX
  return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
}

// ── Proyección lineal de una métrica ─────────────────────────────────────────
// tendencias = array mensual de calcularTendencias()
// metrica = nombre del campo (ej: 'fertilidad')
// mesesFuturos = cuántos meses proyectar
// minVal / maxVal = límites del clamp
export function proyectarTendenciaLineal(tendencias, metrica, mesesFuturos = 6, minVal = 0, maxVal = Infinity) {
  if (tendencias.length < 3) return []
  const valores = tendencias.map(d => d[metrica] ?? null)
  const slope   = computeSlope(valores)
  const valid   = valores.filter(v => v != null)
  const last    = valid.length > 0 ? valid[valid.length - 1] : 0
  const n       = valores.length

  return Array.from({ length: mesesFuturos }, (_, i) => ({
    mes:   `+${i + 1}m`,
    valor: Math.round(Math.max(minVal, Math.min(maxVal, last + slope * (i + 1))) * 10) / 10,
    slope,
  }))
}

// ── Índice Evolución Bioterio (0–100) ─────────────────────────────────────────
// Responde: ¿la gestión histórica mejora o empeora la estabilidad futura?
// Usa las pendientes de los últimos 6 meses de datos mensuales.
export function calcularIndiceEvolucion(tendencias) {
  if (!tendencias || tendencias.length < 3) return { score: 50, nivel: 'sin datos', pendientes: {} }

  const datos = tendencias.slice(-6)

  const normalize = (slope, max = 3) => Math.max(-1, Math.min(1, slope / max))

  const slopeF = computeSlope(datos.map(d => d.fertilidad))      // + es bueno
  const slopeS = computeSlope(datos.map(d => d.supervivencia))   // + es bueno
  const slopeI = computeSlope(datos.map(d => d.incidentes))      // - es bueno
  const slopeG = computeSlope(datos.map(d => d.graves))          // - es bueno
  const slopeN = computeSlope(datos.map(d => d.nacidos))         // + es bueno

  const score = 50
    + normalize(slopeF, 5)  * 20
    + normalize(slopeS, 5)  * 20
    + normalize(-slopeI, 2) * 15
    + normalize(-slopeG, 1) * 15
    + normalize(slopeN, 5)  * 10

  const scoreRound = Math.round(Math.max(0, Math.min(100, score)))

  let nivel, emoji, color
  if (scoreRound >= 68) { nivel = 'Mejorando'; emoji = '🟢'; color = '#00e676' }
  else if (scoreRound >= 42) { nivel = 'Estable';    emoji = '🟡'; color = '#ffb300' }
  else { nivel = 'Deteriorando'; emoji = '🔴'; color = '#ff6b80' }

  return {
    score: scoreRound,
    nivel, emoji, color,
    pendientes: { fertilidad: slopeF, supervivencia: slopeS, incidentes: slopeI, nacidos: slopeN },
  }
}

// ── Recomendaciones priorizadas ───────────────────────────────────────────────
export function generarRecomendaciones(comp, hipotesis) {
  const recs = []

  for (const h of hipotesis) {
    recs.push({
      prioridad: h.nivel === 'critico' ? 1 : h.nivel === 'alerta' ? 2 : 4,
      icono: h.nivel === 'critico' ? '🔴' : h.nivel === 'alerta' ? '🟡' : '🟢',
      texto: h.recomendacion,
    })
  }

  if (comp.fMedia.senal?.includes('deterioro'))   recs.push({ prioridad: 2, icono: '🧬', texto: 'Consanguinidad aumentando — evaluar renovación genética.' })
  if (comp.latenciaMedia.delta > 3)               recs.push({ prioridad: 2, icono: '♂', texto: 'Latencia de fecundación subió — revisar edad y estado de machos.' })
  if (comp.diasFueraRango.delta > 5)              recs.push({ prioridad: 2, icono: '🌡️', texto: 'Más días fuera del rango térmico — revisar climatización.' })
  if (comp.supervivencia.senal?.includes('deterioro')) recs.push({ prioridad: 2, icono: '🐣', texto: 'Supervivencia al destete bajó — revisar nutrición de madres.' })
  if (comp.indiceGlobal.delta > 5)                recs.push({ prioridad: 4, icono: '✅', texto: 'Rendimiento global mejoró — mantener las condiciones actuales.' })

  return recs.sort((a, b) => a.prioridad - b.prioridad)
}
