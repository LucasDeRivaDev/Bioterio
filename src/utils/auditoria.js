// ─────────────────────────────────────────────────────────────────────────────
// auditoria.js — Motor de auditoría histórica y comparación de períodos
// Compara dos intervalos de tiempo y genera métricas, patrones y causas.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularIndiceSanitario, calcularIndiceAmbiental } from './sanitario'
import { buildPedigree, estadisticasColonia } from './genealogia'

// ── Presets de período ───────────────────────────────────────────────────────
export function getPresetsPeriodo() {
  const hoy = new Date()
  // Formato local YYYY-MM-DD — toISOString() devuelve UTC y corre la fecha después de las 21:00 (ART)
  function fmtLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function restarDias(n) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - n)
    return fmtLocal(d)
  }
  const hoyStr = fmtLocal(hoy)

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

// ─────────────────────────────────────────────────────────────────────────────
// NUEVO MOTOR ESTRATÉGICO — v2
// Interpreta contexto operativo, no solo cantidad producida.
// ─────────────────────────────────────────────────────────────────────────────

// ── Perfiles operativos ───────────────────────────────────────────────────────
export const PERFILES_OPERATIVOS = {
  expansion:            { id: 'expansion',            emoji: '📈', label: 'Expansión activa',       color: '#00e676' },
  produccion_intensiva: { id: 'produccion_intensiva', emoji: '⚡', label: 'Producción intensiva',   color: '#40c4ff' },
  estabilizacion:       { id: 'estabilizacion',       emoji: '⚖️', label: 'Estabilización',         color: '#ffb300' },
  conservacion:         { id: 'conservacion',         emoji: '🛡️', label: 'Conservación',           color: '#a78bfa' },
  reduccion_estrategica:{ id: 'reduccion_estrategica',emoji: '↘️', label: 'Reducción estratégica',  color: '#4fc3f7' },
  recuperacion_sanitaria:{ id: 'recuperacion_sanitaria',emoji: '🏥', label: 'Recuperación sanitaria', color: '#ff9800' },
  renovacion_genetica:  { id: 'renovacion_genetica',  emoji: '🧬', label: 'Renovación genética',    color: '#ce93d8' },
  emergencia:           { id: 'emergencia',            emoji: '🚨', label: 'Emergencia',             color: '#ff6b80' },
}

// ── Detectar perfil operativo automáticamente ─────────────────────────────────
export function detectarPerfilOperativo(comp, mA, mB) {
  const prodBajo       = comp.nacidos.delta < -3 || (mA.prod.nacidos > 0 && mB.prod.nacidos < mA.prod.nacidos * 0.8)
  const prodAlto       = comp.nacidos.delta > 3  || (mA.prod.nacidos > 0 && mB.prod.nacidos > mA.prod.nacidos * 1.2)
  const fertBaja       = mB.repro.fertilidad < 0.45
  const fertOk         = mB.repro.fertilidad >= 0.65
  const sanitarioBajo  = mB.sanidad.indiceSanitario < 60 || mB.sanidad.graves > 2
  const sanitarioMejora= comp.indiceSanitario?.delta > 3
  const consangriticoAlt= mB.genetica.fMedia > 0.125
  const renovActiva    = mB.renovacion.retirados >= 2
  const excedidos      = mB.renovacion.excedidos > 0

  if (fertBaja && sanitarioBajo)                          return PERFILES_OPERATIVOS.emergencia
  if (sanitarioBajo || (prodBajo && sanitarioMejora))     return PERFILES_OPERATIVOS.recuperacion_sanitaria
  if (consangriticoAlt && renovActiva)                    return PERFILES_OPERATIVOS.renovacion_genetica
  if (prodAlto && fertOk && !sanitarioBajo)               return PERFILES_OPERATIVOS.expansion
  if (prodAlto)                                           return PERFILES_OPERATIVOS.produccion_intensiva
  if (prodBajo && !sanitarioBajo && mB.repro.fertilidad >= 0.55) return PERFILES_OPERATIVOS.reduccion_estrategica
  if (!prodAlto && !prodBajo && !excedidos && !consangriticoAlt)  return PERFILES_OPERATIVOS.conservacion
  return PERFILES_OPERATIVOS.estabilizacion
}

// ── Interpretación contextual en lenguaje humano ──────────────────────────────
export function interpretarCambioContextual(comp, perfil, mA, mB) {
  const fertB  = (mB.repro.fertilidad * 100).toFixed(0)
  const survB  = (mB.repro.supervivenciaMedio * 100).toFixed(0)
  const sanB   = Math.round(mB.sanidad.indiceSanitario)
  const deltaN  = comp.nacidos.delta
  const pctProd = mA.prod.nacidos > 0 ? Math.abs(Math.round((deltaN / mA.prod.nacidos) * 100)) : 0

  const sanDelta  = comp.indiceSanitario?.delta ?? 0
  const survSenal = comp.supervivencia?.senal ?? ''
  const gravesB   = mB.sanidad.graves ?? 0
  const fPct      = (mB.genetica.fMedia * 100).toFixed(1)

  switch (perfil.id) {
    case 'reduccion_estrategica':
      return `La producción se redujo ${pctProd}%, pero la fertilidad se mantuvo en ${fertB}% y la supervivencia en ${survB}%. ` +
        (sanDelta > 3
          ? `El índice sanitario mejoró ${Math.round(sanDelta)} puntos — la reducción de carga reproductiva contribuyó positivamente a la salud de la colonia.`
          : `No se detectó deterioro biológico. El sistema interpreta una reducción controlada y saludable.`)

    case 'expansion':
      return `La colonia expandió producción ${pctProd > 0 ? `un ${pctProd}%` : ''} con fertilidad del ${fertB}% y supervivencia del ${survB}%.` +
        (gravesB === 0
          ? ` Sin incidentes graves en el período — la expansión muestra señales de sostenibilidad.`
          : ` Se registraron ${gravesB} incidente(s) grave(s). Monitorear desgaste reproductivo.`)

    case 'produccion_intensiva':
      return `Período de alta producción: ${mB.prod.nacidos} nacidos con fertilidad ${fertB}% y supervivencia ${survB}%.` +
        (survSenal.includes('deterioro')
          ? ` La supervivencia al destete bajó respecto al período anterior — monitorear desgaste de reproductoras.`
          : ` La eficiencia reproductiva se sostiene.`)

    case 'emergencia':
      return `La colonia presenta señales de deterioro real: fertilidad del ${fertB}% por debajo del umbral crítico.` +
        (gravesB > 0 ? ` ${gravesB} incidente(s) grave(s) en el período.` : '') +
        ` Se recomienda intervención inmediata y revisión completa de reproductores.`

    case 'recuperacion_sanitaria':
      return (pctProd > 5 && deltaN < 0 ? `La producción bajó ${pctProd}% mientras el bioterio atraviesa una situación sanitaria. ` : '') +
        `Índice sanitario actual: ${sanB}/100.` +
        (sanDelta > 0
          ? ` Mejoró ${Math.round(sanDelta)} puntos respecto al período anterior — el proceso de recuperación avanza.`
          : ` Requiere monitoreo activo para recuperar estabilidad.`)

    case 'renovacion_genetica': {
      const ret = mB.renovacion.retirados
      return `Se renovaron ${ret} reproductor(es) en el período, con consanguinidad actual F = ${fPct}%.` +
        (parseFloat(fPct) > 12.5
          ? ` Continuar con rotación de líneas para reducir el coeficiente de consanguinidad.`
          : ` La diversidad genética se mantiene en rango manejable.`)
    }

    case 'conservacion':
      return `La colonia opera en modo conservación con ${mB.renovacion.totalActivos} reproductores activos.` +
        ` Fertilidad ${fertB}%, supervivencia ${survB}%. ` +
        `El ritmo estable es coherente con el objetivo de preservar el plantel reproductor.`

    default: // estabilizacion
      return `La colonia opera de forma estable con fertilidad ${fertB}% y supervivencia ${survB}%.` +
        (Math.abs(deltaN) < 5 ? ` La producción se mantiene sin cambios significativos.` : '')
  }
}

// ── Solo alertas que representan problemas reales ─────────────────────────────
export function generarAlertasReales(comp, mA, mB) {
  const alertas = []

  if (mB.repro.fertilidad < 0.40)
    alertas.push({ nivel: 'critico', emoji: '🔴', texto: `Fertilidad crítica: ${(mB.repro.fertilidad * 100).toFixed(0)}% — menos de 4 de cada 10 apareamientos resulta en parto exitoso.` })

  if (mB.sanidad.graves > 2)
    alertas.push({ nivel: 'critico', emoji: '🔴', texto: `${mB.sanidad.graves} incidentes graves en el período. Revisar causas y estado sanitario general.` })

  if (mB.repro.fertilidad >= 0.40 && mB.repro.fertilidad < 0.55)
    alertas.push({ nivel: 'importante', emoji: '🟠', texto: `Fertilidad baja (${(mB.repro.fertilidad * 100).toFixed(0)}%). Investigar causa: edad de reproductores, estrés ambiental o fatiga reproductiva.` })

  if (mB.genetica.fMedia > 0.125)
    alertas.push({ nivel: 'importante', emoji: '🟠', texto: `Consanguinidad por encima del umbral crítico (F = ${(mB.genetica.fMedia * 100).toFixed(1)}%). Iniciar renovación genética.` })

  if ((mB.renovacion.excedidos ?? 0) > 0)
    alertas.push({ nivel: 'importante', emoji: '🟠', texto: `${mB.renovacion.excedidos} reproductor(es) superaron el límite de edad (>270d). Reemplazar antes de que afecte la tasa de éxito.` })

  if (comp.supervivencia?.senal === 'deterioro_significativo')
    alertas.push({ nivel: 'importante', emoji: '🟠', texto: `Supervivencia al destete cayó significativamente (${(comp.supervivencia.A * 100).toFixed(0)}% → ${(comp.supervivencia.B * 100).toFixed(0)}%). Revisar nutrición de madres.` })

  if ((comp.abortos?.delta ?? 0) > 1)
    alertas.push({ nivel: 'atencion', emoji: '🟡', texto: `Aumento de abortos/reabsorciones (${comp.abortos.A} → ${comp.abortos.B}). Evaluar estrés ambiental durante gestación.` })

  if ((mB.ambiente?.diasFueraRango ?? 0) > 8)
    alertas.push({ nivel: 'atencion', emoji: '🟡', texto: `${mB.ambiente.diasFueraRango} días fuera del rango térmico óptimo en el período. Controlar climatización.` })

  if (comp.latenciaMedia?.delta > 4)
    alertas.push({ nivel: 'atencion', emoji: '🟡', texto: `Latencia de fecundación aumentó (${comp.latenciaMedia.A?.toFixed(0) ?? '—'}d → ${comp.latenciaMedia.B?.toFixed(0) ?? '—'}d). Revisar condición y edad de machos.` })

  if ((mB.sanidad.abiertos ?? 0) > 3)
    alertas.push({ nivel: 'atencion', emoji: '🟡', texto: `${mB.sanidad.abiertos} incidentes sin resolver. Darles seguimiento para evitar progresión.` })

  // Ordenar: critico → importante → atencion
  const ord = { critico: 0, importante: 1, atencion: 2 }
  return alertas.sort((a, b) => (ord[a.nivel] ?? 3) - (ord[b.nivel] ?? 3))
}

// ── Índice de sustentabilidad (0–100) ─────────────────────────────────────────
// Mide salud y estabilidad de la colonia — NO penaliza menor producción.
export function calcularIndiceSustentabilidad(mA, mB, comp) {
  const { repro, sanidad, genetica, renovacion, ambiente } = mB

  // Fertilidad (30%): 80%+ = máximo, 0% = 0
  const fertScore = Math.min(100, (repro.fertilidad || 0) * 125)
  // Supervivencia (25%): 85%+ = máximo, 0% = 0
  const survScore = Math.min(100, (repro.supervivenciaMedio || 0) * 118)
  // Sanidad (25%): directo 0–100
  const sanScore  = sanidad.indiceSanitario || 0
  // Genética (10%): F=0 → 100pts, F=0.25 → 0pts
  const divScore  = Math.max(0, 100 - (genetica.fMedia || 0) * 400)
  // Reproductores (10%): penaliza excedidos y próximos al límite
  let renoScore = 100
  renoScore -= (renovacion.excedidos || 0) * 15
  renoScore -= (renovacion.proximosLimite || 0) * 7
  renoScore = Math.max(0, renoScore)

  let score = fertScore * 0.30 + survScore * 0.25 + sanScore * 0.25 + divScore * 0.10 + renoScore * 0.10

  // Penalizaciones extra por problemas reales
  score -= (sanidad.graves || 0) * 2
  score -= (sanidad.malformaciones || 0) * 1

  return Math.round(Math.max(0, Math.min(100, score)))
}

// ── Etiqueta de estado según sustentabilidad ──────────────────────────────────
export function etiquetaEstado(score) {
  if (score >= 75) return { label: 'Sostenible',     emoji: '🟢', color: '#00e676', descripcion: 'La colonia opera en condiciones óptimas de sustentabilidad.' }
  if (score >= 55) return { label: 'Estable',        emoji: '🟡', color: '#ffb300', descripcion: 'La colonia opera normalmente con áreas de atención.' }
  if (score >= 35) return { label: 'En observación', emoji: '🟠', color: '#ff9800', descripcion: 'Hay indicadores que requieren seguimiento activo.' }
  return             { label: 'En riesgo',          emoji: '🔴', color: '#ff6b80', descripcion: 'La colonia presenta riesgos que requieren intervención.' }
}

// ── Acciones recomendadas contextuales ───────────────────────────────────────
export function generarAccionesRecomendadas(comp, perfil, mA, mB, hipotesis) {
  const acciones = []

  // Según perfil operativo
  switch (perfil.id) {
    case 'emergencia':
      acciones.push({ p: 0, icono: '🚨', texto: 'Intervención inmediata — revisar todos los reproductores y condiciones sanitarias.' })
      break
    case 'recuperacion_sanitaria':
      acciones.push({ p: 0, icono: '🏥', texto: 'Priorizar salud sobre producción. Reducir carga reproductiva hasta estabilizar el índice sanitario.' })
      break
    case 'expansion':
      if (mB.repro.fertilidad < 0.75) acciones.push({ p: 1, icono: '📊', texto: 'Fertilidad por debajo del óptimo para expansión. Revisar selección de reproductores.' })
      break
    case 'reduccion_estrategica':
      acciones.push({ p: 3, icono: '✅', texto: 'Reducción controlada en curso. Mantener estrategia y monitorear fertilidad mensualmente.' })
      break
    case 'renovacion_genetica':
      acciones.push({ p: 1, icono: '🧬', texto: 'Continuar rotación de líneas genéticas. Evitar cruces con F ≥ 12.5%.' })
      break
    case 'conservacion':
      acciones.push({ p: 3, icono: '🛡️', texto: 'Modo conservación activo. Mantener plantel estable y evaluar renovación cuando el índice sanitario lo permita.' })
      break
  }

  // Según señales del análisis comparativo
  if ((comp.latenciaMedia?.delta ?? 0) > 3)
    acciones.push({ p: 2, icono: '♂', texto: 'Latencia de fecundación subió — revisar edad y condición de machos activos.' })
  if ((mB.ambiente?.diasFueraRango ?? 0) > 5 || (comp.diasFueraRango?.delta ?? 0) > 4)
    acciones.push({ p: 2, icono: '🌡️', texto: 'Temperatura fuera de rango — revisar y ajustar climatización del bioterio.' })
  if (comp.supervivencia?.senal?.includes('deterioro'))
    acciones.push({ p: 2, icono: '🐣', texto: 'Supervivencia al destete bajó — revisar nutrición de madres gestantes y densidad por jaula.' })
  if ((mB.renovacion?.excedidos ?? 0) > 0)
    acciones.push({ p: 1, icono: '🔄', texto: `${mB.renovacion.excedidos} reproductor(es) superaron el límite de edad. Reemplazar para mantener calidad reproductiva.` })
  if (mB.genetica?.fMedia > 0.125)
    acciones.push({ p: 1, icono: '🧬', texto: 'Consanguinidad por encima del límite seguro. Considerar introducir animales de líneas externas.' })

  // Desde hipótesis causales (solo las importantes)
  for (const h of hipotesis) {
    if (h.nivel === 'critico' || h.nivel === 'alerta') {
      acciones.push({ p: h.nivel === 'critico' ? 1 : 2, icono: h.nivel === 'critico' ? '🔴' : '🟡', texto: h.recomendacion })
    }
  }

  // Si no hay acciones urgentes
  if (acciones.length === 0)
    acciones.push({ p: 4, icono: '✅', texto: 'Sin acciones urgentes. Mantener condiciones actuales y monitoreo regular.' })

  // Deduplicar y ordenar
  const seen = new Set()
  return acciones
    .sort((a, b) => a.p - b.p)
    .filter(a => { if (seen.has(a.texto)) return false; seen.add(a.texto); return true })
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
