import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { BIO_RATAS, BIO_RATONES } from '../utils/constants'
import { difDias, parseDate, hoy, formatFecha } from '../utils/calculos'
import { generarId } from '../utils/storage'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowLeft, RefreshCw, Plus, TrendingUp, Wheat, ClipboardList, ShoppingBag } from 'lucide-react'

// ── Tasas de consumo por especie y categoría (g/día por animal) ───────────────
const TASAS = {
  rata: {
    crias:    { min: 5,  max: 14, label: 'Crías' },
    jovenes:  { min: 10, max: 20, label: 'Jóvenes' },
    adultos:  { min: 20, max: 35, label: 'Adultos' },
    repro:    { min: 20, max: 35, label: 'Reproductor adulto' },
    lactante: { min: 30, max: 40, label: 'Hembra lactante' },
  },
  raton: {
    crias:    { min: 3, max: 5,  label: 'Crías' },
    jovenes:  { min: 5, max: 7,  label: 'Jóvenes' },
    adultos:  { min: 6, max: 8,  label: 'Adultos' },
    repro:    { min: 6, max: 8,  label: 'Reproductor adulto' },
    lactante: { min: 10, max: 15, label: 'Hembra lactante' },
  },
}

// ── Bioterios que participan del cálculo global ───────────────────────────────
const TODOS_BIOTERIOS = [
  { id: 'ratas',            especie: 'rata',  bio: BIO_RATAS },
  { id: 'ratones_balbc',    especie: 'raton', bio: BIO_RATONES },
  { id: 'ratones_c57',      especie: 'raton', bio: BIO_RATONES },
  { id: 'ratones_hibridos', especie: 'raton', bio: BIO_RATONES },
]

// Claves de categorías para el modelo adaptativo por categoría
const CAT_KEYS = ['lactantes', 'repro', 'crias', 'jovenes', 'adultos']

// ── localStorage ──────────────────────────────────────────────────────────────
const LS_CENSOS       = 'appMosca_alimento_censos'
const LS_INGRESOS     = 'appMosca_alimento_ingresos'
const LS_REPOSICIONES = 'appMosca_alimento_reposiciones'

// Bioterios disponibles para selección en reposición parcial
const OPCIONES_BIOTERIOS = [
  { id: 'ratas',            label: 'Ratas',   color: '#00e676' },
  { id: 'ratones_balbc',    label: 'BAL/C',   color: '#40c4ff' },
  { id: 'ratones_c57',      label: 'C57',     color: '#a78bfa' },
  { id: 'ratones_hibridos', label: 'Híbridos',color: '#ffb300' },
]
const OPCIONES_CATEGORIAS = [
  { id: 'lactantes', label: 'Hembras lactantes' },
  { id: 'repro',     label: 'Reproductores' },
  { id: 'crias',     label: 'Crías' },
  { id: 'jovenes',   label: 'Jóvenes' },
  { id: 'adultos',   label: 'Adultos' },
]

function cargarLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') }
  catch { return [] }
}
function guardarLS(key, lista) {
  localStorage.setItem(key, JSON.stringify(lista))
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

function mid(tasa) { return (tasa.min + tasa.max) / 2 }

function edadDias(fechaNacimiento) {
  if (!fechaNacimiento) return null
  return difDias(parseDate(fechaNacimiento), parseDate(hoy()))
}

function clasificarEdadStock(dias, bio) {
  if (dias < 42)                      return 'crias'
  if (dias < bio.STOCK_ADULTOS_DIAS)  return 'jovenes'
  return 'adultos'
}

function stockCamada(camada, sacrificios, entregas) {
  const sac  = sacrificios.filter(s => s.camada_id === camada.id).reduce((s, x) => s + x.cantidad, 0)
  const ent  = entregas.filter(e => e.camada_id === camada.id).reduce((s, x) => s + x.cantidad, 0)
  const base = camada.total_destetados ?? camada.total_crias ?? 0
  return Math.max(0, base - sac - ent)
}

function consumoGrupo(count, tasa) {
  return { count, min: count * tasa.min, max: count * tasa.max, mid: count * mid(tasa) }
}

function sumarConsumo(a, b) {
  return { count: a.count + b.count, min: a.min + b.min, max: a.max + b.max, mid: a.mid + b.mid }
}

const VACIO = { count: 0, min: 0, max: 0, mid: 0 }

// ── Cálculo principal por bioterio ────────────────────────────────────────────

function calcularConsumo(bioId, especie, bio, animales, camadas, jaulas, sacrificios, entregas) {
  const tasas = TASAS[especie]
  const activos = ['activo', 'en_apareamiento', 'en_cria']

  const lactantes = animales.filter(a =>
    a.sexo === 'hembra' &&
    a.estado === 'en_cria' &&
    camadas.some(c => c.id_madre === a.id && c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)
  )

  const otrasHembras = animales.filter(a =>
    a.sexo === 'hembra' &&
    activos.includes(a.estado) &&
    !lactantes.find(l => l.id === a.id)
  )

  const machos = animales.filter(a =>
    a.sexo === 'macho' && activos.includes(a.estado)
  )

  const reproLactantes = consumoGrupo(lactantes.length, tasas.lactante)
  const reproOtros     = consumoGrupo(otrasHembras.length + machos.length, tasas.repro)

  const jaulasIds = new Set(jaulas.map(j => j.camada_id))
  let stockCrias = { ...VACIO }, stockJovenes = { ...VACIO }, stockAdultos = { ...VACIO }

  function acumularStock(total, fechaNacimiento) {
    const edad = edadDias(fechaNacimiento)
    if (edad === null) return
    const cat = clasificarEdadStock(edad, bio)
    if      (cat === 'crias')   stockCrias   = sumarConsumo(stockCrias,   consumoGrupo(total, tasas.crias))
    else if (cat === 'jovenes') stockJovenes = sumarConsumo(stockJovenes, consumoGrupo(total, tasas.jovenes))
    else                        stockAdultos = sumarConsumo(stockAdultos, consumoGrupo(total, tasas.adultos))
  }

  jaulas.forEach(jaula => {
    const camada = camadas.find(c => c.id === jaula.camada_id)
    if (!camada || camada.incluir_en_stock === false || jaula.total <= 0) return
    acumularStock(jaula.total, camada.fecha_nacimiento)
  })

  camadas.forEach(camada => {
    if (!camada.fecha_destete || camada.incluir_en_stock === false) return
    if (jaulasIds.has(camada.id)) return
    const stock = stockCamada(camada, sacrificios, entregas)
    if (stock <= 0) return
    acumularStock(stock, camada.fecha_nacimiento)
  })

  const totalMin = reproLactantes.min + reproOtros.min + stockCrias.min + stockJovenes.min + stockAdultos.min
  const totalMax = reproLactantes.max + reproOtros.max + stockCrias.max + stockJovenes.max + stockAdultos.max

  return {
    reproLactantes,
    reproOtros,
    stockCrias,
    stockJovenes,
    stockAdultos,
    totalMin,
    totalMax,
    totalMid: (totalMin + totalMax) / 2,
  }
}

// ── Probabilidad de relleno de jaulas según día y hora del censo ─────────────
// El alimento se repone típicamente el lunes (post-fin de semana) y el viernes
// (pre-fin de semana). Si el censo se toma DESPUÉS del relleno, la caída de
// stock incluye alimento trasladado a jaulas que aún no fue consumido.
// → Resultado: { prob, label, nivel: 'alto'|'medio'|'bajo'|null }

function diaSemanaLocal(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() // 0=dom · 1=lun · 5=vie · 6=sab
}

function probRellenoPorHorario(fecha, hora) {
  if (!hora) return { prob: 0, label: null, nivel: null }
  const dia = diaSemanaLocal(fecha)
  const h   = parseInt(hora.split(':')[0])

  if (dia === 1) { // Lunes: reposición post-fin de semana
    if (h < 9)  return { prob: 0.10, label: 'Lunes temprano — relleno poco probable aún',      nivel: 'bajo'  }
    if (h < 11) return { prob: 0.55, label: 'Lunes mañana — posible relleno post-fin de semana', nivel: 'medio' }
    return             { prob: 0.85, label: 'Posible relleno post-fin de semana',                nivel: 'alto'  }
  }
  if (dia === 5) { // Viernes: reposición pre-fin de semana
    if (h < 10) return { prob: 0.20, label: 'Viernes temprano — relleno poco probable aún',       nivel: 'bajo'  }
    if (h < 13) return { prob: 0.65, label: 'Viernes mañana — posible relleno pre-fin de semana', nivel: 'medio' }
    return             { prob: 0.90, label: 'Posible relleno pre-fin de semana',                  nivel: 'alto'  }
  }
  if (dia >= 2 && dia <= 4) { // Mar–Jue: rutina
    if (h < 9)  return { prob: 0.05, label: null,                                    nivel: null   }
    if (h < 14) return { prob: 0.25, label: 'Horario de relleno rutinario posible', nivel: 'bajo' }
    return             { prob: 0.15, label: null,                                    nivel: null   }
  }
  return { prob: 0.05, label: null, nivel: null } // Fin de semana
}

// ── Snapshot de composición al registrar un censo ────────────────────────────
// Guarda cuántos animales había de cada categoría y cuánto consumían (g/día total)
// para poder aprender factores independientes por categoría.

function composicionActual(datosBioterios) {
  const comp = {
    lactantes: { count: 0, totalGDia: 0 },
    repro:     { count: 0, totalGDia: 0 },
    crias:     { count: 0, totalGDia: 0 },
    jovenes:   { count: 0, totalGDia: 0 },
    adultos:   { count: 0, totalGDia: 0 },
  }
  TODOS_BIOTERIOS.forEach(({ id }) => {
    const d = datosBioterios[id]
    comp.lactantes.count   += d.reproLactantes.count;  comp.lactantes.totalGDia += d.reproLactantes.mid
    comp.repro.count       += d.reproOtros.count;      comp.repro.totalGDia     += d.reproOtros.mid
    comp.crias.count       += d.stockCrias.count;      comp.crias.totalGDia     += d.stockCrias.mid
    comp.jovenes.count     += d.stockJovenes.count;    comp.jovenes.totalGDia   += d.stockJovenes.mid
    comp.adultos.count     += d.stockAdultos.count;    comp.adultos.totalGDia   += d.stockAdultos.mid
  })
  return comp
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsumoAlimento() {
  const { limpiarBioterio } = useBioterioActivo()

  const [datosBioterios, setDatosBioterios] = useState(null)
  const [cargando, setCargando]             = useState(true)
  const [error, setError]                   = useState(null)

  const [censos,   setCensos]   = useState(() => cargarLS(LS_CENSOS))
  const [ingresos, setIngresos] = useState(() => cargarLS(LS_INGRESOS))

  const [reposiciones, setReposiciones] = useState(() => cargarLS(LS_REPOSICIONES))

  const [modalCenso,       setModalCenso]       = useState(false)
  const [modalIngreso,     setModalIngreso]     = useState(false)
  const [modalReposicion,  setModalReposicion]  = useState(false)  // standalone confirm
  const [reposPreCenso,    setReposPreCenso]    = useState(null)   // reposición desde census modal

  // ── Fetch paralelo de los 4 bioterios ──
  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const resultados = await Promise.all(
        TODOS_BIOTERIOS.map(({ id }) =>
          Promise.all([
            supabase.from('animales').select('*').eq('bioterio_id', id),
            supabase.from('camadas').select('*').eq('bioterio_id', id),
            supabase.from('jaulas').select('*').eq('bioterio_id', id),
            supabase.from('sacrificios').select('*').eq('bioterio_id', id),
            supabase.from('entregas').select('*').eq('bioterio_id', id),
          ])
        )
      )

      const datos = {}
      TODOS_BIOTERIOS.forEach(({ id, especie, bio }, i) => {
        const [{ data: animales }, { data: camadas }, { data: jaulas }, { data: sacrificios }, { data: entregas }] = resultados[i]
        datos[id] = calcularConsumo(
          id, especie, bio,
          animales ?? [], camadas ?? [], jaulas ?? [], sacrificios ?? [], entregas ?? []
        )
      })
      setDatosBioterios(datos)
    } catch (e) {
      console.error('Error al cargar consumo:', e)
      setError('No se pudo cargar la información. Verificá la conexión.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Totales globales ──
  const global = useMemo(() => {
    if (!datosBioterios) return null
    return TODOS_BIOTERIOS.reduce(
      (acc, { id }) => {
        const d = datosBioterios[id]
        return { min: acc.min + d.totalMin, max: acc.max + d.totalMax, mid: acc.mid + d.totalMid }
      },
      { min: 0, max: 0, mid: 0 }
    )
  }, [datosBioterios])

  // ── Censos ordenados por fecha ──
  const censosOrdenados = useMemo(
    () => [...censos].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [censos]
  )

  const ultimoCenso = censosOrdenados.length > 0 ? censosOrdenados[censosOrdenados.length - 1] : null

  // ── Relleno aprendido: promedio histórico de censos con rellenoKg > 0 ──
  const rellenoAprendido = useMemo(() => {
    const conRelleno = censosOrdenados.filter(c => (c.rellenoKg ?? 0) > 0)
    if (conRelleno.length === 0) return null
    const avg = conRelleno.reduce((s, c) => s + (c.rellenoKg ?? 0), 0) / conRelleno.length
    return { avg, n: conRelleno.length }
  }, [censosOrdenados])

  // ── Aviso de relleno para el último censo ──
  const avisoRelleno = (() => {
    if (!ultimoCenso?.hora) return null
    const info = probRellenoPorHorario(ultimoCenso.fecha, ultimoCenso.hora)
    if (info.prob < 0.45) return null
    const tieneCorreccion = (ultimoCenso.rellenoKg ?? 0) > 0
    return { ...info, tieneCorreccion }
  })()

  // ── Stock actual: último censo + ingresos posteriores ──
  const ingresosPostCenso = ultimoCenso
    ? ingresos.filter(i => i.fecha >= ultimoCenso.fecha)
    : []

  const stockActualKg = ultimoCenso !== null
    ? ultimoCenso.kg + ingresosPostCenso.reduce((s, i) => s + i.kg, 0)
    : null

  // ── Calibración adaptativa con EWMA — global + por categoría ──
  //
  // Global: factor de ajuste promedio sobre todos los períodos (backward compat.)
  // Por categoría: cada categoría aprende su propio factor SOLO en los períodos
  // donde tuvo animal-días > 0. Las que no estuvieron presentes no se modifican.
  // La atribución es proporcional al baseline bibliográfico del período.
  const calibracion = useMemo(() => {
    if (censosOrdenados.length < 2) return null
    const ahoraDate = parseDate(hoy())

    // Acumuladores por categoría
    const catAcc = {}
    CAT_KEYS.forEach(k => { catAcc[k] = { periodos: 0, totalAnimalDias: 0, sumFP: 0, sumP: 0 } })

    const pares = []

    for (let i = 0; i < censosOrdenados.length - 1; i++) {
      const prev = censosOrdenados[i]
      const cur  = censosOrdenados[i + 1]
      const dias = difDias(parseDate(prev.fecha), parseDate(cur.fecha))
      if (dias <= 0) continue

      const ingresosEnPeriodo = ingresos
        .filter(c => c.fecha >= prev.fecha && c.fecha < cur.fecha)
        .reduce((s, c) => s + c.kg, 0)

      // Reposiciones confirmadas en el período (mayor prioridad que rellenoKg del censo)
      const reposicionesEnPeriodo = reposiciones
        .filter(r => r.fecha > prev.fecha && r.fecha <= cur.fecha)
        .reduce((s, r) => s + (r.kg ?? 0), 0)

      // consumidoObservadoG = total del faltante (consumo + alimento trasladado a jaulas)
      // rellenoCorreccionG  = alimento repuesto en jaulas (confirmado > declarado en censo)
      // consumidoG          = consumo real de los animales
      const consumidoObservadoG = (prev.kg + ingresosEnPeriodo - cur.kg) * 1000
      const rellenoCorreccionG  = reposicionesEnPeriodo > 0
        ? reposicionesEnPeriodo * 1000
        : (cur.rellenoKg ?? 0) * 1000
      const reposicionConfirmada = reposicionesEnPeriodo > 0
      const consumidoG          = consumidoObservadoG - rellenoCorreccionG
      if (consumidoG <= 0) continue
      if (!prev.consumoEstimadoGDia || prev.consumoEstimadoGDia <= 0) continue

      const realGDia  = consumidoG / dias
      const factor    = realGDia / prev.consumoEstimadoGDia
      // Peso EWMA: vida media ~90 días. Bonus ×1.4 si la reposición fue confirmada
      const diasAtras = Math.max(0, difDias(parseDate(cur.fecha), ahoraDate))
      const pesoBase  = Math.exp(-diasAtras / 90)
      const peso      = reposicionConfirmada ? pesoBase * 1.4 : pesoBase

      pares.push({ fechaInicio: prev.fecha, fechaFin: cur.fecha, dias, realGDia, estimadoGDia: prev.consumoEstimadoGDia, factor, peso, consumidoObservadoG, rellenoCorreccionG, reposicionConfirmada })

      // Aprendizaje por categoría: solo si el censo anterior tiene snapshot de composición
      if (prev.composicion) {
        const pc = prev.composicion
        const cc = cur.composicion ?? null

        // Calcular consumo esperado (baseline bibliográfico) para cada categoría en este período
        let totalExpGDia = 0
        const catData = {}
        CAT_KEYS.forEach(k => {
          const pv = pc[k] ?? { count: 0, totalGDia: 0 }
          const cv = cc?.[k] ?? pv  // si el censo siguiente no tiene composición, usa el anterior
          const avgTotalGDia = ((pv.totalGDia ?? 0) + (cv.totalGDia ?? 0)) / 2
          const avgCount     = (pv.count + cv.count) / 2
          catData[k] = { avgCount, avgTotalGDia, animalDias: avgCount * dias }
          totalExpGDia += avgTotalGDia
        })

        if (totalExpGDia > 0) {
          // Factor de este período = real / bibliográfico (atribución proporcional)
          // Las categorías con animal-días = 0 no acumulan → su factor no cambia
          const catFactor = realGDia / totalExpGDia
          CAT_KEYS.forEach(k => {
            const cat = catData[k]
            if (cat.animalDias <= 0 || cat.avgTotalGDia <= 0) return
            catAcc[k].periodos++
            catAcc[k].totalAnimalDias += cat.animalDias
            catAcc[k].sumFP += catFactor * peso
            catAcc[k].sumP  += peso
          })
        }
      }
    }

    if (pares.length === 0) return null

    const pesoTotal  = pares.reduce((s, p) => s + p.peso, 0)
    const factorEWMA = pares.reduce((s, p) => s + p.factor * p.peso, 0) / pesoTotal

    // Confianza global
    const diasDesdeUltimo   = Math.max(0, difDias(parseDate(censosOrdenados[censosOrdenados.length - 1].fecha), ahoraDate))
    const confianzaBase     = Math.min(75, pares.length * 20)
    const bonusCalidad      = pares.length >= 4 ? 10 : 0
    const nConfirmados      = pares.filter(p => p.reposicionConfirmada).length
    const bonusConfirmados  = Math.min(15, nConfirmados * 5) // hasta +15% por reposiciones confirmadas
    const penalizacion      = diasDesdeUltimo > 30 ? Math.min(35, (diasDesdeUltimo - 30) * 0.7) : 0
    const confianza         = Math.round(Math.max(5, confianzaBase + bonusCalidad + bonusConfirmados - penalizacion))

    // Construir factores por categoría
    const tieneComposicion = censosOrdenados.some(c => c.composicion)
    const perCategoria = {}
    CAT_KEYS.forEach(k => {
      const acc = catAcc[k]
      if (!tieneComposicion || acc.periodos === 0 || acc.sumP === 0) {
        // Sin datos propios → usar factor global como fallback
        perCategoria[k] = { factor: factorEWMA, confianza: 0, periodos: 0, animalDias: 0, usandoGlobal: true }
        return
      }
      const cf = acc.sumFP / acc.sumP
      const cb = Math.min(60, acc.periodos * 20)
      const bd = acc.totalAnimalDias > 200 ? 15 : acc.totalAnimalDias > 50 ? 8 : 0
      const pn = diasDesdeUltimo > 30 ? Math.min(30, (diasDesdeUltimo - 30) * 0.7) : 0
      perCategoria[k] = {
        factor:      cf,
        confianza:   Math.round(Math.max(0, cb + bd - pn)),
        periodos:    acc.periodos,
        animalDias:  Math.round(acc.totalAnimalDias),
        usandoGlobal: false,
      }
    })

    return { factor: factorEWMA, muestras: pares.length, pares, confianza, perCategoria, nConfirmados }
  }, [censosOrdenados, ingresos, reposiciones])

  const consumoBase = global?.mid ?? 0

  // Consumo ajustado: cada categoría usa su propio factor aprendido.
  // Si no hay datos por categoría, usa el factor global como fallback.
  const consumoAjustado = (() => {
    if (!datosBioterios || !calibracion?.perCategoria) {
      return calibracion ? consumoBase * calibracion.factor : consumoBase
    }
    const pc = calibracion.perCategoria
    let total = 0
    TODOS_BIOTERIOS.forEach(({ id }) => {
      const d = datosBioterios[id]
      total += d.reproLactantes.mid * pc.lactantes.factor
      total += d.reproOtros.mid     * pc.repro.factor
      total += d.stockCrias.mid     * pc.crias.factor
      total += d.stockJovenes.mid   * pc.jovenes.factor
      total += d.stockAdultos.mid   * pc.adultos.factor
    })
    return total
  })()

  // ── Predicción de duración basada en stock actual ──
  const diasEstimados = useMemo(() => {
    if (stockActualKg === null || stockActualKg <= 0 || consumoBase <= 0) return null
    return Math.floor((stockActualKg * 1000) / consumoAjustado)
  }, [stockActualKg, consumoBase, consumoAjustado])

  const fechaAgotamiento = useMemo(() => {
    if (!diasEstimados) return null
    const d = new Date()
    d.setDate(d.getDate() + diasEstimados)
    return formatFecha(d)
  }, [diasEstimados])

  // ── Insights por categoría — usa factor propio de cada una ──
  const categoryInsights = useMemo(() => {
    if (!datosBioterios || !calibracion) return null
    const pc = calibracion.perCategoria
    const resultado = []

    TODOS_BIOTERIOS.forEach(({ id, especie }) => {
      const d   = datosBioterios[id]
      const cfg = BIOTERIOS_CONFIG[id]
      const tasas = TASAS[especie]

      const cats = [
        { key: 'lactantes', label: 'Hembras lactantes', dato: d.reproLactantes, tasa: tasas.lactante, color: '#ce93d8' },
        { key: 'repro',     label: 'Reproductores',     dato: d.reproOtros,     tasa: tasas.repro,    color: '#40c4ff' },
        { key: 'crias',     label: 'Crías',             dato: d.stockCrias,     tasa: tasas.crias,    color: '#00e676' },
        { key: 'jovenes',   label: 'Jóvenes',           dato: d.stockJovenes,   tasa: tasas.jovenes,  color: '#ffb300' },
        { key: 'adultos',   label: 'Adultos',           dato: d.stockAdultos,   tasa: tasas.adultos,  color: '#ff6b80' },
      ].filter(c => c.dato.count > 0)

      if (cats.length === 0) return

      cats.forEach(c => {
        const catCal       = pc?.[c.key]
        const factor       = catCal?.factor      ?? calibracion.factor
        const confianza    = catCal?.confianza    ?? 0
        const animalDias   = catCal?.animalDias   ?? 0
        const usandoGlobal = catCal?.usandoGlobal ?? true
        const midBiblio    = mid(c.tasa)
        const midAdaptado  = midBiblio * factor
        const pct          = (factor - 1) * 100
        resultado.push({
          bioId: id, bioLabel: cfg.labelCorto, bioColor: cfg.color, bioIcon: cfg.icon,
          label: c.label, key: c.key, color: c.color, count: c.dato.count,
          midBiblio, midAdaptado, pct,
          totalBiblio: c.dato.mid, totalAdaptado: c.dato.mid * factor,
          confianza, animalDias, usandoGlobal,
        })
      })
    })

    return resultado
  }, [datosBioterios, calibracion])

  // ── Tabla resumen del modelo por categoría (agregado multi-bioterio) ──
  const tablaModelo = useMemo(() => {
    if (!datosBioterios || !calibracion?.perCategoria) return null
    const pc = calibracion.perCategoria

    const catMeta = {
      lactantes: { label: 'Hembras lactantes', color: '#ce93d8' },
      repro:     { label: 'Reproductores',     color: '#40c4ff' },
      crias:     { label: 'Crías',             color: '#00e676' },
      jovenes:   { label: 'Jóvenes',           color: '#ffb300' },
      adultos:   { label: 'Adultos',           color: '#ff6b80' },
    }

    return CAT_KEYS.map(k => {
      let totalCount = 0, totalGDiaBiblio = 0
      TODOS_BIOTERIOS.forEach(({ id }) => {
        const d = datosBioterios[id]
        const { count, mid: gDia } = k === 'lactantes' ? { count: d.reproLactantes.count, mid: d.reproLactantes.mid }
          : k === 'repro'    ? { count: d.reproOtros.count,    mid: d.reproOtros.mid }
          : k === 'crias'    ? { count: d.stockCrias.count,    mid: d.stockCrias.mid }
          : k === 'jovenes'  ? { count: d.stockJovenes.count,  mid: d.stockJovenes.mid }
                             : { count: d.stockAdultos.count,  mid: d.stockAdultos.mid }
        totalCount      += count
        totalGDiaBiblio += gDia
      })

      const catCal       = pc[k]
      const factor       = catCal?.factor      ?? calibracion.factor
      const confianza    = catCal?.confianza    ?? 0
      const animalDias   = catCal?.animalDias   ?? 0
      const usandoGlobal = catCal?.usandoGlobal ?? true

      const gDiaBiblioPerAnimal  = totalCount > 0 ? totalGDiaBiblio / totalCount : 0
      const gDiaAdaptadoPerAnimal = gDiaBiblioPerAnimal * factor

      return {
        key: k,
        label:   catMeta[k].label,
        color:   catMeta[k].color,
        totalCount,
        gDiaBiblioPerAnimal,
        gDiaAdaptadoPerAnimal,
        totalGDiaBiblio,
        totalGDiaAdaptado: totalGDiaBiblio * factor,
        factor, confianza, animalDias, usandoGlobal,
      }
    }).filter(c => c.totalCount > 0 || c.animalDias > 0)
  }, [datosBioterios, calibracion])

  // ── Eventos especiales detectados ──
  const eventosEspeciales = useMemo(() => {
    if (!datosBioterios) return []
    const eventos = []

    TODOS_BIOTERIOS.forEach(({ id }) => {
      const d   = datosBioterios[id]
      const cfg = BIOTERIOS_CONFIG[id]
      if (d.totalMid === 0) return

      const totalRepro = d.reproLactantes.count + d.reproOtros.count
      const totalStock = d.stockCrias.count + d.stockJovenes.count + d.stockAdultos.count

      if (d.reproLactantes.count > 0) {
        const pctLact = totalRepro > 0 ? (d.reproLactantes.count / totalRepro) * 100 : 0
        if (pctLact > 35) {
          eventos.push({
            icon: '🍼', color: '#ce93d8',
            label: `Alta lactancia — ${cfg.labelCorto}`,
            detalle: `${d.reproLactantes.count} hembras amamantando (${Math.round(pctLact)}% del plantel reproductor) → mayor consumo real esperado`,
          })
        }
      }

      if (totalStock > 0 && totalRepro > 0 && totalStock / totalRepro > 6) {
        eventos.push({
          icon: '📦', color: '#ffb300',
          label: `Población de stock alta — ${cfg.labelCorto}`,
          detalle: `${totalStock} animales en jaulas de stock vs ${totalRepro} reproductores`,
        })
      }
    })

    if (calibracion) {
      if (calibracion.factor > 1.2) {
        eventos.push({
          icon: '⬆️', color: '#ff6b80',
          label: 'Consumo real supera lo bibliográfico',
          detalle: `+${Math.round((calibracion.factor - 1) * 100)}% sobre el valor de referencia — el modelo ya incorpora este ajuste`,
        })
      } else if (calibracion.factor < 0.85) {
        eventos.push({
          icon: '⬇️', color: '#40c4ff',
          label: 'Consumo real por debajo de lo bibliográfico',
          detalle: `${Math.round((1 - calibracion.factor) * 100)}% menos que el valor de referencia — posible excedente de stock`,
        })
      }
    }

    return eventos
  }, [datosBioterios, calibracion])

  // ── Línea temporal de movimientos ──
  const movimientos = useMemo(() => {
    const items = [
      ...censos.map(c => ({ ...c, tipo: 'censo' })),
      ...ingresos.map(i => ({ ...i, tipo: 'ingreso' })),
      ...reposiciones.map(r => ({ ...r, tipo: 'reposicion' })),
    ]
    return items.sort((a, b) => {
      const cmp = b.fecha.localeCompare(a.fecha)
      if (cmp !== 0) return cmp
      // mismo día: reposición antes que censo para que aparezca correctamente
      const orden = { reposicion: 0, censo: 1, ingreso: 2 }
      return (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9)
    })
  }, [censos, ingresos, reposiciones])

  // ── Gráfico: estimado vs real por par de censos ──
  const datosGrafico = useMemo(() => {
    if (!calibracion) return []
    return calibracion.pares.map(p => ({
      fecha: formatFecha(p.fechaInicio, { month: '2-digit', day: '2-digit', year: undefined }),
      estimado: Math.round(p.estimadoGDia / 100) / 10,
      real: Math.round(p.realGDia / 100) / 10,
    })).slice(-8)
  }, [calibracion])

  // ── Consumo para censos helper ──
  // Prioridad: reposiciones confirmadas (standalone) > rellenoKg declarado en el censo
  function consumoPorCenso(censoActual, idx) {
    const prev = censosOrdenados[idx - 1]
    if (!prev) return null
    const dias = difDias(parseDate(prev.fecha), parseDate(censoActual.fecha))
    if (dias <= 0) return null
    const ingresosG = ingresos
      .filter(c => c.fecha >= prev.fecha && c.fecha < censoActual.fecha)
      .reduce((s, c) => s + c.kg, 0) * 1000
    const consumidoObservadoG = (prev.kg + ingresosG / 1000 - censoActual.kg) * 1000
    if (consumidoObservadoG <= 0) return null

    // Reposiciones confirmadas en el período (mayor prioridad)
    const reposicionesEnPeriodo = reposiciones
      .filter(r => r.fecha > prev.fecha && r.fecha <= censoActual.fecha)
      .reduce((s, r) => s + (r.kg ?? 0), 0)

    const rellenoG       = reposicionesEnPeriodo > 0
      ? reposicionesEnPeriodo * 1000
      : (censoActual.rellenoKg ?? 0) * 1000
    const fuenteRelleno  = reposicionesEnPeriodo > 0
      ? 'confirmado'
      : ((censoActual.rellenoKg ?? 0) > 0 ? 'declarado' : 'ninguno')

    const consumidoRealG = Math.max(0, consumidoObservadoG - rellenoG)
    return {
      consumidoObservadoG,
      rellenoG,
      consumidoG: consumidoRealG,
      dias,
      realGDia: consumidoRealG / dias,
      fuenteRelleno,
    }
  }

  // ── Registrar censo ──
  function registrarCenso(fecha, kg, hora, rellenoKg) {
    const consumoEstimadoGDia = Math.round(consumoAjustado)
    const comp = datosBioterios ? composicionActual(datosBioterios) : null
    const nuevo = {
      id: generarId(),
      fecha,
      hora:      hora      || null,
      kg,
      rellenoKg: rellenoKg || 0,
      consumoEstimadoGDia,
      composicion: comp,
    }
    const nuevos = [...censos, nuevo]
    setCensos(nuevos)
    guardarLS(LS_CENSOS, nuevos)
    setModalCenso(false)
  }

  function eliminarCensoItem(id) {
    const nuevos = censos.filter(c => c.id !== id)
    setCensos(nuevos)
    guardarLS(LS_CENSOS, nuevos)
  }

  // ── Registrar ingreso ──
  function registrarIngreso(fecha, kg) {
    const nuevo = { id: generarId(), fecha, kg }
    const nuevos = [...ingresos, nuevo]
    setIngresos(nuevos)
    guardarLS(LS_INGRESOS, nuevos)
    setModalIngreso(false)
  }

  function eliminarIngresoItem(id) {
    const nuevos = ingresos.filter(i => i.id !== id)
    setIngresos(nuevos)
    guardarLS(LS_INGRESOS, nuevos)
  }

  // ── Reposiciones ──
  function registrarReposicion(datos) {
    const nuevo = { id: generarId(), confirmada: true, ...datos }
    const nuevas = [...reposiciones, nuevo]
    setReposiciones(nuevas)
    guardarLS(LS_REPOSICIONES, nuevas)
    setModalReposicion(false)
    setReposPreCenso(null)
  }

  function eliminarReposicionItem(id) {
    const nuevas = reposiciones.filter(r => r.id !== id)
    setReposiciones(nuevas)
    guardarLS(LS_REPOSICIONES, nuevas)
  }

  // Confirmación rápida desde un censo (crea reposición sin abrir modal completo)
  function confirmarReposicionRapida(fecha, hora) {
    setModalReposicion({ fecha, hora })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050810' }}>

      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,179,0,0.15)', background: 'rgba(13,21,40,0.6)' }}
      >
        <button
          onClick={limpiarBioterio}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono transition-colors"
          style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,179,0,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,179,0,0.07)' }}
        >
          <ArrowLeft size={14} />
          Volver al selector
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white text-base">Consumo global de alimento</h1>
          <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
            Ratas + Ratones (Balb/C · C57 · Híbridos)
          </p>
        </div>
        <button
          onClick={cargarDatos}
          disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full space-y-6">

        {error && (
          <div className="rounded-2xl px-5 py-4 text-sm font-mono" style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
            ⚠️ {error}
          </div>
        )}

        {cargando && !datosBioterios && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ffb300', borderTopColor: 'transparent' }} />
            <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>Calculando consumo de los 4 bioterios...</span>
          </div>
        )}

        {global && (
          <>
            {/* ── Tarjeta resumen global ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.8)', border: '1.5px solid rgba(255,179,0,0.3)', boxShadow: '0 0 30px rgba(255,179,0,0.06)' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,179,0,0.15)', background: 'rgba(255,179,0,0.05)' }}>
                <Wheat size={20} style={{ color: '#ffb300' }} />
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Consumo diario — todos los bioterios</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    Rango bibliográfico: {Math.round(global.min)} – {Math.round(global.max)} g/día
                  </div>
                </div>
              </div>

              {/* Esperado / Adaptado / Confianza */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {/* Consumo esperado (bibliográfico) */}
                <div className="px-6 py-4 text-center">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a5f7a' }}>Consumo esperado</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: '#c9d4e0' }}>
                    {consumoBase >= 1000 ? `${(consumoBase / 1000).toFixed(2)} kg` : `${Math.round(consumoBase)} g`}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#3d5068' }}>referencia bibliográfica</div>
                </div>

                {/* Consumo adaptado (aprendido) */}
                <div className="px-6 py-4 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: calibracion ? '#40c4ff' : '#4a5f7a' }}>
                    Consumo adaptado
                  </div>
                  <div className="text-2xl font-bold font-mono" style={{ color: calibracion ? '#ffb300' : '#3d5068' }}>
                    {calibracion
                      ? (consumoAjustado >= 1000 ? `${(consumoAjustado / 1000).toFixed(2)} kg` : `${Math.round(consumoAjustado)} g`)
                      : '—'}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#3d5068' }}>
                    {calibracion
                      ? `${calibracion.factor > 1 ? '+' : ''}${Math.round((calibracion.factor - 1) * 100)}% vs bibliográfico · ×${calibracion.factor.toFixed(2)}`
                      : 'sin censos aún'}
                  </div>
                </div>

                {/* Confianza */}
                <div className="px-6 py-4 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a5f7a' }}>Confianza del modelo</div>
                  {calibracion ? (
                    <>
                      <div
                        className="text-2xl font-bold font-mono"
                        style={{ color: calibracion.confianza >= 60 ? '#00e676' : calibracion.confianza >= 35 ? '#ffb300' : '#ff6b80' }}
                      >
                        {calibracion.confianza}%
                      </div>
                      {/* Barra de confianza */}
                      <div className="mt-2 mx-auto w-24 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${calibracion.confianza}%`,
                            background: calibracion.confianza >= 60 ? '#00e676' : calibracion.confianza >= 35 ? '#ffb300' : '#ff6b80',
                          }}
                        />
                      </div>
                      <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>
                        {calibracion.muestras} par{calibracion.muestras !== 1 ? 'es' : ''} de censos
                        {(calibracion.nConfirmados ?? 0) > 0 && (
                          <span style={{ color: '#00e676' }}> · {calibracion.nConfirmados} confirmado{calibracion.nConfirmados !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold font-mono" style={{ color: '#3d5068' }}>—</div>
                      <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>necesitás ≥2 censos</div>
                    </>
                  )}
                </div>
              </div>

              {/* Desglose rápido por bioterio */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {TODOS_BIOTERIOS.map(({ id }) => {
                  const cfg = BIOTERIOS_CONFIG[id]
                  const d   = datosBioterios[id]
                  const adj = calibracion ? d.totalMid * calibracion.factor : d.totalMid
                  return (
                    <div key={id} className="px-4 py-3 text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="text-xs font-mono mb-1" style={{ color: cfg.color }}>{cfg.icon} {cfg.labelCorto}</div>
                      <div className="font-bold font-mono text-sm" style={{ color: '#c9d4e0' }}>
                        {adj >= 1000 ? `${(adj / 1000).toFixed(2)} kg` : `${Math.round(adj)} g`}
                      </div>
                      {calibracion && (
                        <div className="text-xs font-mono" style={{ color: '#3d5068' }}>
                          biblio: {d.totalMid >= 1000 ? `${(d.totalMid / 1000).toFixed(2)} kg` : `${Math.round(d.totalMid)} g`}
                        </div>
                      )}
                      <div className="text-xs" style={{ color: '#3d5068' }}>/día</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Panel de stock y predicción ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <div className="px-6 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid rgba(0,230,118,0.12)', background: 'rgba(0,230,118,0.04)' }}>
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">Stock y predicción de duración</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                    Basado en el último censo más los ingresos registrados
                  </div>
                </div>
                <button
                  onClick={() => setModalReposicion(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0"
                  style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.16)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.08)' }}
                >
                  ✅ Confirmar reposición
                </button>
              </div>

              {stockActualKg === null ? (
                <div className="px-6 py-8 text-center text-sm font-mono" style={{ color: '#3d5068' }}>
                  Registrá el primer censo para ver la predicción de duración
                </div>
              ) : (
                <div className="px-6 py-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Stock actual */}
                    <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
                      <div className="text-xs font-mono mb-1" style={{ color: '#4a5f7a' }}>Stock actual</div>
                      <div className="text-xl font-bold font-mono" style={{ color: '#00e676' }}>
                        {stockActualKg.toFixed(1)} kg
                      </div>
                    </div>

                    {/* Último censo */}
                    <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
                      <div className="text-xs font-mono mb-1" style={{ color: '#4a5f7a' }}>Último censo</div>
                      <div className="font-bold font-mono text-sm" style={{ color: '#a78bfa' }}>
                        {ultimoCenso.kg.toFixed(1)} kg
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                        {formatFecha(ultimoCenso.fecha)}
                      </div>
                    </div>

                    {/* Último ingreso */}
                    <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-xs font-mono mb-1" style={{ color: '#4a5f7a' }}>Último ingreso</div>
                      {ingresos.length > 0 ? (() => {
                        const ult = [...ingresos].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
                        return (
                          <>
                            <div className="font-bold font-mono text-sm" style={{ color: '#00e676' }}>+{ult.kg.toFixed(1)} kg</div>
                            <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>{formatFecha(ult.fecha)}</div>
                          </>
                        )
                      })() : (
                        <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>Sin ingresos</div>
                      )}
                    </div>

                    {/* Duración estimada */}
                    <div
                      className="rounded-xl px-4 py-3 text-center"
                      style={{
                        background: diasEstimados < 7 ? 'rgba(255,61,87,0.08)' : diasEstimados < 14 ? 'rgba(255,179,0,0.07)' : 'rgba(0,230,118,0.06)',
                        border: `1px solid ${diasEstimados < 7 ? 'rgba(255,61,87,0.3)' : diasEstimados < 14 ? 'rgba(255,179,0,0.25)' : 'rgba(0,230,118,0.2)'}`,
                      }}
                    >
                      <div className="text-xs font-mono mb-1" style={{ color: '#4a5f7a' }}>Duración estimada</div>
                      {diasEstimados ? (
                        <>
                          <div
                            className="text-xl font-bold font-mono"
                            style={{ color: diasEstimados < 7 ? '#ff6b80' : diasEstimados < 14 ? '#ffb300' : '#00e676' }}
                          >
                            {diasEstimados} días
                          </div>
                          <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                            {fechaAgotamiento}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>—</div>
                      )}
                    </div>
                  </div>

                  {ingresosPostCenso.length > 0 && (
                    <div className="mt-3 text-xs font-mono" style={{ color: '#4a5f7a' }}>
                      {ingresosPostCenso.length} ingreso{ingresosPostCenso.length > 1 ? 's' : ''} post-censo: +{ingresosPostCenso.reduce((s, i) => s + i.kg, 0).toFixed(1)} kg sumados al stock
                    </div>
                  )}

                  {/* Fila consumo real vs corregido (basado en el último par de censos) */}
                  {(() => {
                    const idx = censosOrdenados.length - 1
                    if (idx < 1) return null
                    const ultimo = censosOrdenados[idx]
                    const cp = consumoPorCenso(ultimo, idx)
                    if (!cp) return null
                    const colorFuente = cp.fuenteRelleno === 'confirmado' ? '#00e676'
                      : cp.fuenteRelleno === 'declarado' ? '#ffb300' : '#4a5f7a'
                    const labelFuente = cp.fuenteRelleno === 'confirmado' ? '✅ Reposición confirmada'
                      : cp.fuenteRelleno === 'declarado' ? '⚠️ Relleno declarado'
                      : '— Sin corrección'
                    return (
                      <div className="mt-4 rounded-xl px-4 py-3"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
                          <div>
                            <div className="text-xs font-mono mb-0.5" style={{ color: '#4a5f7a' }}>Observado (última ventana)</div>
                            <div className="font-bold font-mono text-sm" style={{ color: '#c9d4e0' }}>
                              {Math.round(cp.consumidoObservadoG / cp.dias)} g/día
                            </div>
                          </div>
                          {cp.rellenoG > 0 && (
                            <>
                              <div style={{ color: '#3a5068', fontSize: 18 }}>−</div>
                              <div>
                                <div className="text-xs font-mono mb-0.5" style={{ color: '#4a5f7a' }}>Alimento en jaulas</div>
                                <div className="font-bold font-mono text-sm" style={{ color: '#ffb300' }}>
                                  {(cp.rellenoG / cp.dias / 1000).toFixed(2)} kg/día
                                </div>
                              </div>
                              <div style={{ color: '#3a5068', fontSize: 18 }}>=</div>
                            </>
                          )}
                          <div>
                            <div className="text-xs font-mono mb-0.5" style={{ color: '#4a5f7a' }}>Consumo real estimado</div>
                            <div className="font-bold font-mono text-sm" style={{ color: '#00e676' }}>
                              {Math.round(cp.consumidoG / cp.dias)} g/día
                              <span className="font-normal ml-1" style={{ color: '#4a5f7a' }}>
                                ({(cp.consumidoG / 1000).toFixed(2)} kg en {cp.dias}d)
                              </span>
                            </div>
                          </div>
                          <div className="ml-auto shrink-0">
                            <span className="text-xs font-mono px-2 py-1 rounded-lg"
                              style={{ background: `${colorFuente}12`, border: `1px solid ${colorFuente}35`, color: colorFuente }}>
                              {labelFuente}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* ── Aviso de posible relleno en el último censo ── */}
            {avisoRelleno && (
              <div className="rounded-xl px-4 py-3.5 flex items-start gap-3"
                style={{
                  background: avisoRelleno.tieneCorreccion ? 'rgba(0,230,118,0.06)' : 'rgba(255,179,0,0.07)',
                  border: `1px solid ${avisoRelleno.tieneCorreccion ? 'rgba(0,230,118,0.25)' : 'rgba(255,179,0,0.25)'}`,
                }}>
                <span className="text-base shrink-0 mt-0.5">{avisoRelleno.tieneCorreccion ? '✅' : '⚠️'}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold"
                    style={{ color: avisoRelleno.tieneCorreccion ? '#00e676' : '#ffb300' }}>
                    {avisoRelleno.tieneCorreccion
                      ? `Relleno registrado — consumo real corregido`
                      : avisoRelleno.label}
                  </div>
                  <div className="text-xs font-mono mt-1" style={{ color: '#6a8099' }}>
                    {avisoRelleno.tieneCorreccion
                      ? `El último censo registró ${ultimoCenso.rellenoKg.toFixed(1)} kg de relleno — se descontaron del consumo calculado.`
                      : `Último censo: ${ultimoCenso.hora} hs del ${formatFecha(ultimoCenso.fecha)} · Probabilidad de relleno: ${Math.round(avisoRelleno.prob * 100)}% · Al registrar el próximo censo podés indicar cuánto alimento repusiste en las jaulas para mejorar la precisión.`}
                  </div>
                </div>
              </div>
            )}

            {/* ── Eventos especiales ── */}
            {eventosEspeciales.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
                  Eventos detectados
                </h2>
                {eventosEspeciales.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-4 py-3 flex items-start gap-3"
                    style={{ background: `${ev.color}0e`, border: `1px solid ${ev.color}30` }}
                  >
                    <span className="text-base shrink-0">{ev.icon}</span>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: ev.color }}>{ev.label}</div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>{ev.detalle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tabla de modelo adaptativo por categoría ── */}
            {tablaModelo && tablaModelo.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(64,196,255,0.18)' }}>
                <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(64,196,255,0.12)', background: 'rgba(64,196,255,0.04)' }}>
                  <TrendingUp size={18} style={{ color: '#40c4ff' }} />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white">Modelo adaptativo por categoría</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                      Cada categoría aprende su propio factor — solo se ajusta cuando estuvo presente entre censos
                    </div>
                  </div>
                </div>

                {/* Cabecera de la tabla */}
                <div className="px-5 py-2 grid grid-cols-12 gap-2 text-xs font-mono font-semibold uppercase tracking-wider"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#3d5068' }}>
                  <div className="col-span-3">Categoría</div>
                  <div className="col-span-2 text-right">Bibliográfico</div>
                  <div className="col-span-2 text-right">Adaptado</div>
                  <div className="col-span-2 text-right">Ajuste</div>
                  <div className="col-span-2 text-right">Confianza</div>
                  <div className="col-span-1 text-right">A-días</div>
                </div>

                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {tablaModelo.map(row => {
                    const confianzaColor = row.confianza >= 60 ? '#00e676' : row.confianza >= 30 ? '#ffb300' : row.confianza > 0 ? '#ff6b80' : '#3d5068'
                    const pct = (row.factor - 1) * 100
                    const ajusteColor = pct > 5 ? '#ff6b80' : pct < -5 ? '#40c4ff' : '#00e676'
                    return (
                      <div key={row.key} className="px-5 py-3 grid grid-cols-12 gap-2 items-center">
                        {/* Nombre */}
                        <div className="col-span-3 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.color }} />
                          <div>
                            <div className="text-xs font-semibold" style={{ color: '#c9d4e0' }}>{row.label}</div>
                            <div className="text-xs font-mono" style={{ color: '#3d5068' }}>×{row.totalCount} animales</div>
                          </div>
                        </div>

                        {/* Bibliográfico */}
                        <div className="col-span-2 text-right">
                          <div className="text-xs font-mono" style={{ color: '#6a8099' }}>
                            {row.gDiaBiblioPerAnimal.toFixed(1)} g/animal
                          </div>
                          <div className="text-xs font-mono" style={{ color: '#3d5068' }}>
                            {row.totalGDiaBiblio >= 1000 ? `${(row.totalGDiaBiblio/1000).toFixed(2)}kg` : `${Math.round(row.totalGDiaBiblio)}g`}/día
                          </div>
                        </div>

                        {/* Adaptado */}
                        <div className="col-span-2 text-right">
                          <div className="text-xs font-mono font-semibold" style={{ color: row.usandoGlobal ? '#4a5f7a' : row.color }}>
                            {row.gDiaAdaptadoPerAnimal.toFixed(1)} g/animal
                          </div>
                          <div className="text-xs font-mono" style={{ color: '#3d5068' }}>
                            {row.totalGDiaAdaptado >= 1000 ? `${(row.totalGDiaAdaptado/1000).toFixed(2)}kg` : `${Math.round(row.totalGDiaAdaptado)}g`}/día
                          </div>
                        </div>

                        {/* Ajuste % */}
                        <div className="col-span-2 text-right">
                          {row.usandoGlobal ? (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5f7a' }}>
                              global
                            </span>
                          ) : (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: pct > 5 ? 'rgba(255,107,128,0.12)' : pct < -5 ? 'rgba(64,196,255,0.12)' : 'rgba(0,230,118,0.10)',
                                color: ajusteColor,
                              }}>
                              {pct > 0 ? '+' : ''}{Math.round(pct)}%
                            </span>
                          )}
                        </div>

                        {/* Confianza */}
                        <div className="col-span-2 text-right">
                          <div className="text-xs font-mono font-bold" style={{ color: confianzaColor }}>
                            {row.confianza > 0 ? `${row.confianza}%` : '—'}
                          </div>
                          {/* Barra de confianza */}
                          <div className="mt-1 ml-auto w-16 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${row.confianza}%`, background: confianzaColor, transition: 'width 0.3s' }} />
                          </div>
                          {row.usandoGlobal && row.confianza === 0 && (
                            <div className="text-xs font-mono mt-0.5" style={{ color: '#2a3a50' }}>sin obs.</div>
                          )}
                        </div>

                        {/* Animal-días */}
                        <div className="col-span-1 text-right">
                          <div className="text-xs font-mono" style={{ color: row.animalDias > 0 ? '#4a5f7a' : '#2a3a50' }}>
                            {row.animalDias > 0 ? row.animalDias.toLocaleString() : '—'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Leyenda */}
                <div className="px-6 py-2 text-xs font-mono" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#3d5068' }}>
                  <span style={{ color: '#4a5f7a' }}>A-días</span> = animal-días observados entre censos ·
                  <span style={{ color: '#4a5f7a' }}> global</span> = sin censos propios, usa el factor general ·
                  Confianza crece con más censos y más animal-días acumulados
                </div>
              </div>
            )}

            {/* ── Insights por categoría (desglose por bioterio) ── */}
            {categoryInsights && categoryInsights.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(64,196,255,0.12)' }}>
                <div className="px-6 py-3 flex items-center gap-3"
                  style={{ borderBottom: '1px solid rgba(64,196,255,0.08)', background: 'rgba(64,196,255,0.03)' }}>
                  <div>
                    <div className="font-bold text-xs text-white">Adaptación por bioterio y categoría</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                      Desglose detallado — los factores son globales por categoría, aplicados a cada colonia
                    </div>
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {categoryInsights.map((ins, i) => (
                    <div key={i} className="px-5 py-2.5 flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                        style={{ background: `${ins.bioColor}18`, color: ins.bioColor, minWidth: '52px', textAlign: 'center' }}>
                        {ins.bioIcon} {ins.bioLabel}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: ins.color }} />
                        <span className="text-xs" style={{ color: '#8a9bb0' }}>{ins.label}</span>
                        <span className="text-xs font-mono" style={{ color: '#3d5068' }}>×{ins.count}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                          {ins.midBiblio.toFixed(1)} g
                        </div>
                        <span className="text-xs" style={{ color: '#3d5068' }}>→</span>
                        <div className="text-xs font-mono font-semibold"
                          style={{ color: ins.usandoGlobal ? '#4a5f7a' : (ins.pct > 5 ? '#ff6b80' : ins.pct < -5 ? '#40c4ff' : '#00e676') }}>
                          {ins.midAdaptado.toFixed(1)} g/día
                        </div>
                        {!ins.usandoGlobal && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                            style={{
                              background: ins.pct > 5 ? 'rgba(255,107,128,0.10)' : ins.pct < -5 ? 'rgba(64,196,255,0.10)' : 'rgba(0,230,118,0.08)',
                              color: ins.pct > 5 ? '#ff6b80' : ins.pct < -5 ? '#40c4ff' : '#00e676',
                            }}>
                            {ins.pct > 0 ? '+' : ''}{Math.round(ins.pct)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono font-bold shrink-0" style={{ color: ins.color }}>
                        {ins.totalAdaptado >= 1000
                          ? `${(ins.totalAdaptado / 1000).toFixed(2)} kg/día`
                          : `${Math.round(ins.totalAdaptado)} g/día`}
                        <span className="font-normal ml-1" style={{ color: '#3d5068' }}>total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Desglose por bioterio ── */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
                Desglose por bioterio y categoría
              </h2>
              <div className="space-y-3">
                {TODOS_BIOTERIOS.map(({ id, especie }) => {
                  const cfg = BIOTERIOS_CONFIG[id]
                  const d = datosBioterios[id]
                  const tasas = TASAS[especie]
                  const tieneData = d.totalMid > 0

                  return (
                    <div key={id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.6)', border: `1px solid ${cfg.color}25` }}>
                      <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}07` }}>
                        <span className="text-lg">{cfg.icon}</span>
                        <div className="flex-1">
                          <span className="font-bold text-sm text-white">{cfg.label}</span>
                          <span className="ml-2 text-xs font-mono" style={{ color: '#4a5f7a' }}>
                            Rango: {Math.round(d.totalMin)} – {Math.round(d.totalMax)} g/día
                          </span>
                        </div>
                        <div className="font-bold font-mono text-base" style={{ color: cfg.color }}>
                          {d.totalMid >= 1000
                            ? `${(d.totalMid / 1000).toFixed(2)} kg/día`
                            : `${Math.round(d.totalMid)} g/día`}
                        </div>
                      </div>

                      {tieneData ? (
                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <FilaCategoria label="Hembras lactantes"     dato={d.reproLactantes} tasaMin={tasas.lactante.min} tasaMax={tasas.lactante.max} color="#ce93d8" />
                          <FilaCategoria label="Reproductores (resto)" dato={d.reproOtros}     tasaMin={tasas.repro.min}    tasaMax={tasas.repro.max}    color="#40c4ff" />
                          <FilaCategoria label="Crías en stock"        dato={d.stockCrias}     tasaMin={tasas.crias.min}    tasaMax={tasas.crias.max}    color="#00e676" />
                          <FilaCategoria label="Jóvenes en stock"      dato={d.stockJovenes}   tasaMin={tasas.jovenes.min}  tasaMax={tasas.jovenes.max}  color="#ffb300" />
                          <FilaCategoria label="Adultos en stock"      dato={d.stockAdultos}   tasaMin={tasas.adultos.min}  tasaMax={tasas.adultos.max}  color="#ff6b80" />
                        </div>
                      ) : (
                        <div className="px-5 py-4 text-xs font-mono" style={{ color: '#3d5068' }}>
                          Sin animales registrados en este bioterio
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Movimientos de stock ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(167,139,250,0.18)' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.04)' }}>
                <ClipboardList size={18} style={{ color: '#a78bfa' }} />
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">Movimientos de stock</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    Censos = fuente del cálculo real · Ingresos = compras que suman al stock
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setModalCenso(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold"
                    style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.1)' }}
                  >
                    <ClipboardList size={13} />
                    Registrar censo
                  </button>
                  <button
                    onClick={() => setModalIngreso(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold"
                    style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.08)' }}
                  >
                    <ShoppingBag size={13} />
                    Registrar ingreso
                  </button>
                  <button
                    onClick={() => setModalReposicion(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold"
                    style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.25)', color: '#40c4ff' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,196,255,0.14)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,196,255,0.07)' }}
                  >
                    ✅ Confirmar reposición
                  </button>
                </div>
              </div>

              {/* Nota explicativa */}
              <div className="px-6 py-3 text-xs font-mono space-y-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', color: '#4a5f7a' }}>
                <div>
                  <span style={{ color: '#a78bfa' }}>📊 Censo</span>
                  {' '}— pesaje real del stock disponible. Es la fuente del aprendizaje adaptativo.
                </div>
                <div>
                  <span style={{ color: '#00e676' }}>📦 Ingreso</span>
                  {' '}— compra o reposición de bolsas. Suma al stock sin alterar el historial de consumo.
                </div>
                <div>
                  <span style={{ color: '#40c4ff' }}>✅ Reposición confirmada</span>
                  {' '}— alimento trasladado a jaulas. Separa "consumido" de "almacenado en jaulas".
                </div>
                <div style={{ color: '#3d5068' }}>
                  Consumo real = censo anterior + ingresos − censo actual − reposición en jaulas
                </div>
              </div>

              {/* Timeline */}
              {movimientos.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm font-mono" style={{ color: '#3d5068' }}>
                  Aún no hay registros. Empezá con un censo del alimento disponible.
                </div>
              ) : (
                <div className="px-6 py-4 space-y-2 max-h-80 overflow-y-auto">
                  {movimientos.map((mov) => {
                    if (mov.tipo === 'reposicion') {
                      const bios = (mov.bioterios ?? []).map(b => OPCIONES_BIOTERIOS.find(o => o.id === b)?.label ?? b).join(' · ')
                      const cats = (mov.categorias ?? []).map(c => OPCIONES_CATEGORIAS.find(o => o.id === c)?.label ?? c).join(' · ')
                      return (
                        <div key={mov.id} className="rounded-xl px-4 py-3 flex items-start gap-3"
                          style={{ background: 'rgba(64,196,255,0.05)', border: '1px solid rgba(64,196,255,0.2)' }}>
                          <div className="text-base mt-0.5">✅</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold font-mono" style={{ color: '#40c4ff' }}>Reposición confirmada</span>
                              <span className="text-xs font-mono text-white">{(mov.kg ?? 0).toFixed(1)} kg en jaulas</span>
                              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{formatFecha(mov.fecha)}</span>
                              {mov.hora && <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{mov.hora} hs</span>}
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.25)', color: '#40c4ff' }}>
                                {mov.tipo_reposicion === 'parcial' ? 'Parcial' : 'Completa'}
                              </span>
                            </div>
                            {bios && <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>Bioterios: {bios}</div>}
                            {cats && <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Categorías: {cats}</div>}
                            {mov.notas && <div className="text-xs font-mono mt-0.5" style={{ color: '#3d5068' }}>{mov.notas}</div>}
                          </div>
                          <button onClick={() => eliminarReposicionItem(mov.id)} className="text-xs shrink-0 mt-0.5" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                        </div>
                      )
                    }
                    if (mov.tipo === 'censo') {
                      const idxEnOrden = censosOrdenados.findIndex(c => c.id === mov.id)
                      const consumo    = consumoPorCenso(mov, idxEnOrden)
                      const probInfo   = mov.hora ? probRellenoPorHorario(mov.fecha, mov.hora) : null
                      const tieneRelleno = consumo && consumo.rellenoG > 0
                      const tieneConfirmacion = reposiciones.some(r => r.fecha === mov.fecha)
                      // Mostrar botón "Confirmar reposición" si es lun/vie con alta prob y sin confirmación aún
                      const mostrarConfirmarBtn = probInfo?.nivel === 'alto' && !tieneConfirmacion

                      const colorFuente = consumo?.fuenteRelleno === 'confirmado' ? '#40c4ff'
                        : consumo?.fuenteRelleno === 'declarado' ? '#ffb300' : null

                      return (
                        <div key={mov.id} className="rounded-xl px-4 py-3 flex items-start gap-3"
                          style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
                          <div className="text-base mt-0.5">📊</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold font-mono" style={{ color: '#a78bfa' }}>Censo</span>
                              <span className="text-xs font-mono text-white">{mov.kg.toFixed(1)} kg</span>
                              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{formatFecha(mov.fecha)}</span>
                              {mov.hora && (
                                <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{mov.hora} hs</span>
                              )}
                              {/* Badge fuente de relleno */}
                              {tieneRelleno && colorFuente && (
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                  style={{ background: `${colorFuente}12`, border: `1px solid ${colorFuente}35`, color: colorFuente }}>
                                  {consumo.fuenteRelleno === 'confirmado' ? '✅ reposición confirmada' : '⚠ relleno declarado'}
                                  {' '}−{(consumo.rellenoG / 1000).toFixed(1)} kg
                                </span>
                              )}
                              {/* Badge posible relleno sin confirmar */}
                              {probInfo?.nivel === 'alto' && !tieneRelleno && !tieneConfirmacion && (
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(255,179,0,0.12)', border: '1px solid rgba(255,179,0,0.3)', color: '#ffb300' }}>
                                  ⚠ posible relleno
                                </span>
                              )}
                            </div>
                            {consumo && (
                              <div className="mt-1.5 space-y-0.5">
                                {tieneRelleno ? (
                                  <>
                                    <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                                      Observado: <span style={{ color: '#c9d4e0' }}>{(consumo.consumidoObservadoG / 1000).toFixed(2)} kg</span>
                                      <span style={{ color: '#3d5068' }}> en {consumo.dias} días</span>
                                    </div>
                                    <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                                      Reposición en jaulas: <span style={{ color: '#ffb300' }}>−{(consumo.rellenoG / 1000).toFixed(2)} kg</span>
                                    </div>
                                    <div className="text-xs font-mono font-semibold" style={{ color: '#00e676' }}>
                                      Consumo real: {(consumo.consumidoG / 1000).toFixed(2)} kg
                                      <span className="font-normal" style={{ color: '#4a5f7a' }}> · {Math.round(consumo.realGDia)} g/día</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs font-mono" style={{ color: '#6a8099' }}>
                                    Consumo del período: {(consumo.consumidoG / 1000).toFixed(2)} kg en {consumo.dias} días
                                    {' · '}{Math.round(consumo.realGDia)} g/día
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Botón de confirmación rápida */}
                            {mostrarConfirmarBtn && (
                              <button
                                onClick={() => confirmarReposicionRapida(mov.fecha, mov.hora)}
                                className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                                style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,196,255,0.16)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,196,255,0.08)' }}
                              >
                                ✅ Confirmar reposición de este día
                              </button>
                            )}
                          </div>
                          <button onClick={() => eliminarCensoItem(mov.id)} className="text-xs shrink-0 mt-0.5" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                        </div>
                      )
                    }
                    // ingreso
                    return (
                      <div key={mov.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.12)' }}>
                        <div className="text-base">📦</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold font-mono" style={{ color: '#00e676' }}>Ingreso</span>
                            <span className="text-xs font-mono text-white">+{mov.kg.toFixed(1)} kg</span>
                            <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{formatFecha(mov.fecha)}</span>
                          </div>
                        </div>
                        <button onClick={() => eliminarIngresoItem(mov.id)} className="text-xs shrink-0" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Gráfico histórico ── */}
            {datosGrafico.length >= 2 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="font-bold text-sm text-white">Consumo estimado vs. real — histórico</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>kg/día por par de censos</div>
                </div>
                <div className="px-4 py-4" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosGrafico} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="fecha" tick={{ fill: '#4a5f7a', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4a5f7a', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit=" kg" />
                      <Tooltip
                        contentStyle={{ background: '#0d1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                        labelStyle={{ color: '#c9d4e0' }}
                        itemStyle={{ color: '#c9d4e0' }}
                        formatter={(v, name) => [`${v} kg/día`, name === 'estimado' ? 'Estimado' : 'Real']}
                      />
                      <Legend formatter={v => v === 'estimado' ? 'Estimado' : 'Real'} wrapperStyle={{ fontSize: 12, fontFamily: 'monospace', color: '#6a8099' }} />
                      <Bar dataKey="estimado" fill="rgba(255,179,0,0.5)"  radius={[4,4,0,0]} />
                      <Bar dataKey="real"      fill="rgba(0,230,118,0.6)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Nota / leyenda del sistema adaptativo */}
            <div className="rounded-xl px-5 py-4 text-xs font-mono space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5f7a' }}>
              <div className="font-semibold" style={{ color: '#6a8099' }}>Sistema adaptativo de aprendizaje por categoría</div>
              <div>
                Cada categoría construye su propio modelo. Solo se actualiza cuando tuvo animal-días observados
                entre dos censos consecutivos — las categorías ausentes mantienen el valor bibliográfico sin cambios.
              </div>
              <div className="space-y-0.5 pt-1" style={{ color: '#3d5068' }}>
                <div><span style={{ color: '#4a5f7a' }}>Ratas:</span> crías 5–14g · jóvenes 10–20g · adultos 20–35g · lactantes 30–40g</div>
                <div><span style={{ color: '#4a5f7a' }}>Ratones:</span> crías 3–5g · jóvenes 5–7g · adultos 6–8g · lactantes 10–15g</div>
              </div>
              <div style={{ color: '#2a3a50' }}>
                Pesos EWMA — los últimos 3 meses pesan el doble que los de hace 6 meses ·
                Confianza: 20% por período observado + hasta 15% por volumen de animal-días acumulados
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      {modalCenso && (
        <ModalCensoAlimento
          stockActualKg={stockActualKg}
          rellenoAprendido={rellenoAprendido}
          onConfirmar={registrarCenso}
          onConfirmarReposicion={registrarReposicion}
          onCerrar={() => setModalCenso(false)}
        />
      )}
      {modalIngreso && (
        <ModalIngreso
          stockActualKg={stockActualKg}
          onConfirmar={registrarIngreso}
          onCerrar={() => setModalIngreso(false)}
        />
      )}
      {modalReposicion && (
        <ModalReposicion
          fechaInicial={typeof modalReposicion === 'object' ? modalReposicion.fecha : hoy()}
          horaInicial={typeof modalReposicion === 'object' ? modalReposicion.hora : null}
          onConfirmar={registrarReposicion}
          onCerrar={() => setModalReposicion(false)}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function FilaCategoria({ label, dato, tasaMin, tasaMax, color }) {
  if (dato.count === 0) return null
  return (
    <div className="px-5 py-2.5 flex items-center gap-3">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs flex-1" style={{ color: '#8a9bb0' }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
        {dato.count} × {tasaMin}–{tasaMax} g
      </span>
      <span className="text-xs font-mono font-semibold w-24 text-right" style={{ color }}>
        {Math.round(dato.mid)} g/día
      </span>
    </div>
  )
}

function ModalCensoAlimento({ stockActualKg, rellenoAprendido, onConfirmar, onConfirmarReposicion, onCerrar }) {
  const horaActual = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const [fecha,           setFecha]           = useState(hoy())
  const [hora,            setHora]            = useState(horaActual)
  const [kg,              setKg]              = useState('')
  const [rellenoKg,       setRellenoKg]       = useState('')
  // Prompt Mon/Fri: null = sin mostrar, 'si'|'no'|'parcial'
  const [respReposicion,  setRespReposicion]  = useState(null)
  const [repBioterios,    setRepBioterios]    = useState(OPCIONES_BIOTERIOS.map(b => b.id))
  const [repCategorias,   setRepCategorias]   = useState([])
  const [repKg,           setRepKg]           = useState('')

  const kgNum      = parseFloat(kg)      || 0
  const rellenoNum = parseFloat(rellenoKg) || 0
  const repKgNum   = parseFloat(repKg) || 0
  const probInfo   = probRellenoPorHorario(fecha, hora)

  // Es lunes o viernes con alta prob → mostrar prompt
  const mostrarPrompt = probInfo.nivel === 'alto'

  const probColor  = probInfo.nivel === 'alto'  ? '#ff6b80'
    : probInfo.nivel === 'medio' ? '#ffb300' : '#00e676'
  const probBg     = probInfo.nivel === 'alto'  ? 'rgba(255,61,87,0.08)'
    : probInfo.nivel === 'medio' ? 'rgba(255,179,0,0.07)' : 'rgba(0,230,118,0.04)'
  const probBorder = probInfo.nivel === 'alto'  ? 'rgba(255,61,87,0.25)'
    : probInfo.nivel === 'medio' ? 'rgba(255,179,0,0.22)' : 'rgba(0,230,118,0.18)'

  const PRESETS = [0, 1, 2, 3, 5]

  function toggleBioterio(id) {
    setRepBioterios(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }
  function toggleCategoria(id) {
    setRepCategorias(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function confirmar(e) {
    e.preventDefault()
    const v = parseFloat(kg)
    if (isNaN(v) || v < 0) return

    // Si declaró relleno en la sección clásica, usar eso como rellenoKg del censo
    const finalRellenoKg = rellenoNum > 0 ? rellenoNum
      : (respReposicion === 'si' || respReposicion === 'parcial') ? repKgNum
      : 0

    onConfirmar(fecha, v, hora || null, finalRellenoKg)

    // Si confirmó reposición en el prompt, también guardar entrada independiente
    if ((respReposicion === 'si' || respReposicion === 'parcial') && repKgNum > 0) {
      onConfirmarReposicion?.({
        fecha,
        hora: hora || null,
        tipo_reposicion: respReposicion === 'si' ? 'completa' : 'parcial',
        kg: repKgNum,
        bioterios: repBioterios,
        categorias: repCategorias,
        notas: '',
      })
    }
  }

  const inputSt = { background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 0 60px rgba(167,139,250,0.12)' }}>

        {/* Header */}
        <div className="px-6 py-5"
          style={{ borderBottom: '1px solid rgba(167,139,250,0.15)', background: 'rgba(167,139,250,0.05)' }}>
          <div className="font-bold text-white text-sm">📊 Registrar censo de alimento</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Pesá el alimento disponible en bolsas/depósito ahora mismo
          </div>
        </div>

        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">

          {/* Fecha + hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" style={inputSt} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" style={inputSt} />
            </div>
          </div>

          {/* Banner probabilidad de relleno */}
          {probInfo.label && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono"
              style={{ background: probBg, border: `1px solid ${probBorder}`, color: probColor }}>
              <div className="font-semibold">⚠ {probInfo.label}</div>
              <div className="mt-1" style={{ color: '#6a8099' }}>
                Prob. de reposición: {Math.round(probInfo.prob * 100)}%
              </div>
            </div>
          )}

          {/* Alimento disponible */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
              Alimento en bolsas / depósito (kg)
            </label>
            <input type="number" min="0" step="0.5" value={kg}
              onChange={e => setKg(e.target.value)}
              placeholder="Ej: 18.5" required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" style={inputSt} />
          </div>

          {/* ── Prompt ¿Se repuso alimento? (solo lun/vie alta prob) ── */}
          {mostrarPrompt && (
            <div className="rounded-xl overflow-hidden"
              style={{ border: '1.5px solid rgba(64,196,255,0.3)', background: 'rgba(64,196,255,0.05)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(64,196,255,0.15)' }}>
                <div className="text-sm font-bold" style={{ color: '#40c4ff' }}>
                  ¿Se repuso alimento en las jaulas hoy?
                </div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                  Es día de reposición habitual ({probInfo.label})
                </div>
              </div>
              <div className="px-4 py-3 flex gap-2">
                {[
                  { v: 'si',      label: '✅ Sí',      bg: 'rgba(0,230,118,0.12)', border: 'rgba(0,230,118,0.4)', color: '#00e676' },
                  { v: 'parcial', label: '⚠️ Parcial', bg: 'rgba(255,179,0,0.12)', border: 'rgba(255,179,0,0.4)', color: '#ffb300' },
                  { v: 'no',      label: '❌ No',      bg: 'rgba(255,61,87,0.08)', border: 'rgba(255,61,87,0.3)', color: '#ff6b80' },
                ].map(op => (
                  <button key={op.v} type="button"
                    onClick={() => setRespReposicion(respReposicion === op.v ? null : op.v)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: respReposicion === op.v ? op.bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${respReposicion === op.v ? op.border : 'rgba(30,51,82,0.6)'}`,
                      color: respReposicion === op.v ? op.color : '#4a5f7a',
                    }}>
                    {op.label}
                  </button>
                ))}
              </div>

              {/* Detalles si respondió Sí o Parcial */}
              {(respReposicion === 'si' || respReposicion === 'parcial') && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(64,196,255,0.12)' }}>
                  <div className="pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
                      ¿Cuántos kg repusiste en las jaulas?
                    </label>
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {[1, 2, 3, 5, 8].map(p => (
                        <button key={p} type="button"
                          onClick={() => setRepKg(p.toString())}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono"
                          style={{
                            background: repKgNum === p ? 'rgba(64,196,255,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${repKgNum === p ? 'rgba(64,196,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            color: repKgNum === p ? '#40c4ff' : '#4a5f7a',
                          }}>
                          {p} kg
                        </button>
                      ))}
                    </div>
                    <input type="number" min="0" step="0.5" value={repKg}
                      onChange={e => setRepKg(e.target.value)}
                      placeholder="Ej: 2.5 kg"
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" style={inputSt} />
                  </div>

                  {respReposicion === 'parcial' && (
                    <>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
                          ¿Qué bioterios?
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {OPCIONES_BIOTERIOS.map(b => (
                            <button key={b.id} type="button"
                              onClick={() => toggleBioterio(b.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{
                                background: repBioterios.includes(b.id) ? `${b.color}18` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${repBioterios.includes(b.id) ? `${b.color}50` : 'rgba(30,51,82,0.6)'}`,
                                color: repBioterios.includes(b.id) ? b.color : '#4a5f7a',
                              }}>
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
                          ¿Qué categorías? (opcional)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {OPCIONES_CATEGORIAS.map(c => (
                            <button key={c.id} type="button"
                              onClick={() => toggleCategoria(c.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{
                                background: repCategorias.includes(c.id) ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${repCategorias.includes(c.id) ? 'rgba(167,139,250,0.45)' : 'rgba(30,51,82,0.6)'}`,
                                color: repCategorias.includes(c.id) ? '#a78bfa' : '#4a5f7a',
                              }}>
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {repKgNum > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
                      style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}>
                      ✅ Reposición confirmada: {repKgNum.toFixed(1)} kg en jaulas (se guardará separado del censo)
                    </div>
                  )}
                </div>
              )}

              {respReposicion === 'no' && (
                <div className="px-4 pb-3 text-xs font-mono" style={{ color: '#4a5f7a' }}>
                  Sin reposición — el consumo calculado incluye todo el alimento faltante.
                </div>
              )}
            </div>
          )}

          {/* Relleno manual (si no usó el prompt o quiere ajustar) */}
          {!mostrarPrompt && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a5f7a' }}>
                Alimento repuesto en jaulas — opcional
              </label>
              <div className="text-xs font-mono mb-2" style={{ color: '#3d5068' }}>
                ¿Trasladaste alimento de las bolsas a las jaulas hoy?
              </div>
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {PRESETS.map(p => {
                  const isActive = p === 0 ? rellenoKg === '' || rellenoKg === '0' : rellenoNum === p
                  return (
                    <button key={p} type="button"
                      onClick={() => setRellenoKg(p === 0 ? '' : p.toString())}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono"
                      style={{
                        background: isActive ? 'rgba(255,179,0,0.15)' : 'rgba(255,255,255,0.04)',
                        border:     `1px solid ${isActive ? 'rgba(255,179,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color:      isActive ? '#ffb300' : '#4a5f7a',
                      }}>
                      {p === 0 ? 'Sin relleno' : `${p} kg`}
                    </button>
                  )
                })}
              </div>
              <input type="number" min="0" step="0.5" value={rellenoKg}
                onChange={e => setRellenoKg(e.target.value)}
                placeholder={rellenoAprendido ? `Típico: ${rellenoAprendido.avg.toFixed(1)} kg` : 'Ej: 2.5 kg'}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" style={inputSt} />
              {rellenoAprendido && (
                <div className="mt-1.5 text-xs font-mono" style={{ color: '#3d5068' }}>
                  Promedio histórico: {rellenoAprendido.avg.toFixed(1)} kg
                  <span style={{ color: '#2a3a50' }}> ({rellenoAprendido.n} censos)</span>
                </div>
              )}
            </div>
          )}

          {/* Vista previa */}
          {stockActualKg !== null && kg && !isNaN(kgNum) && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono space-y-1"
              style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
              <div style={{ color: '#a78bfa' }}>Vista previa del período</div>
              {(() => {
                const efectivoRelleno = respReposicion === 'si' || respReposicion === 'parcial'
                  ? repKgNum : rellenoNum
                return stockActualKg - kgNum > 0 ? (
                  <>
                    <div style={{ color: '#8a9bb0' }}>
                      Variación observada: <span style={{ color: '#ff6b80' }}>−{(stockActualKg - kgNum).toFixed(1)} kg</span>
                    </div>
                    {efectivoRelleno > 0 && (
                      <div style={{ color: '#8a9bb0' }}>
                        Reposición en jaulas: <span style={{ color: '#ffb300' }}>−{efectivoRelleno.toFixed(1)} kg</span>
                        {(respReposicion === 'si' || respReposicion === 'parcial') && (
                          <span style={{ color: '#40c4ff' }}> ✅ confirmada</span>
                        )}
                      </div>
                    )}
                    <div style={{ color: efectivoRelleno > 0 ? '#00e676' : '#6a8099' }} className="font-semibold">
                      Consumo real: {Math.max(0, stockActualKg - kgNum - efectivoRelleno).toFixed(1)} kg
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#3d5068' }}>Sin variación de stock</div>
                )
              })()}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa' }}>
              Guardar censo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalReposicion({ fechaInicial, horaInicial, onConfirmar, onCerrar }) {
  const [fecha,      setFecha]      = useState(fechaInicial ?? hoy())
  const [hora,       setHora]       = useState(() => {
    if (horaInicial) return horaInicial
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [tipo,        setTipo]       = useState('completa')
  const [kg,          setKg]         = useState('')
  const [bioterios,   setBioterios]  = useState(OPCIONES_BIOTERIOS.map(b => b.id))
  const [categorias,  setCategorias] = useState([])
  const [notas,       setNotas]      = useState('')

  const kgNum = parseFloat(kg) || 0

  function toggleBioterio(id) {
    setBioterios(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }
  function toggleCategoria(id) {
    setCategorias(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function confirmar(e) {
    e.preventDefault()
    if (!kgNum || kgNum <= 0) return
    onConfirmar({
      fecha,
      hora,
      tipo_reposicion: tipo,
      kg: kgNum,
      bioterios: tipo === 'parcial' ? bioterios : OPCIONES_BIOTERIOS.map(b => b.id),
      categorias,
      notas: notas.trim(),
    })
  }

  const inputSt = { background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(64,196,255,0.25)', boxShadow: '0 0 60px rgba(64,196,255,0.08)' }}>

        {/* Header */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(64,196,255,0.12)', background: 'rgba(64,196,255,0.04)' }}>
          <div className="font-bold text-white text-sm">✅ Confirmar reposición de alimento</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Registra alimento repuesto en jaulas — mejora la calibración del modelo
          </div>
        </div>

        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">

          {/* Fecha + Hora */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                style={inputSt}
              />
            </div>
            <div style={{ width: '110px' }}>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Hora</label>
              <input
                type="time"
                value={hora}
                onChange={e => setHora(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                style={inputSt}
              />
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Tipo de reposición</label>
            <div className="flex gap-2">
              {[{ v: 'completa', label: 'Completa (todos los bioterios)' }, { v: 'parcial', label: 'Parcial' }].map(op => (
                <button
                  key={op.v}
                  type="button"
                  onClick={() => setTipo(op.v)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: tipo === op.v ? 'rgba(64,196,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tipo === op.v ? 'rgba(64,196,255,0.45)' : 'rgba(30,51,82,0.6)'}`,
                    color: tipo === op.v ? '#40c4ff' : '#4a5f7a',
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Kg */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
              Alimento repuesto en jaulas (kg)
            </label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {[1, 2, 3, 5, 8].map(p => (
                <button key={p} type="button"
                  onClick={() => setKg(p.toString())}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono"
                  style={{
                    background: kgNum === p ? 'rgba(64,196,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${kgNum === p ? 'rgba(64,196,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: kgNum === p ? '#40c4ff' : '#4a5f7a',
                  }}>
                  {p} kg
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={kg}
              onChange={e => setKg(e.target.value)}
              placeholder="Ej: 2.5"
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={inputSt}
            />
          </div>

          {/* Bioterios (solo si parcial) */}
          {tipo === 'parcial' && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
                ¿Qué bioterios?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {OPCIONES_BIOTERIOS.map(b => (
                  <button key={b.id} type="button"
                    onClick={() => toggleBioterio(b.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: bioterios.includes(b.id) ? `${b.color}18` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${bioterios.includes(b.id) ? `${b.color}50` : 'rgba(30,51,82,0.6)'}`,
                      color: bioterios.includes(b.id) ? b.color : '#4a5f7a',
                    }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Categorías (opcional, siempre disponible) */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
              ¿Qué categorías? <span style={{ color: '#2a3a50', fontWeight: 400 }}>(opcional)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OPCIONES_CATEGORIAS.map(c => (
                <button key={c.id} type="button"
                  onClick={() => toggleCategoria(c.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: categorias.includes(c.id) ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${categorias.includes(c.id) ? 'rgba(167,139,250,0.45)' : 'rgba(30,51,82,0.6)'}`,
                    color: categorias.includes(c.id) ? '#a78bfa' : '#4a5f7a',
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: relleno previo al finde"
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={inputSt}
            />
          </div>

          {/* Preview */}
          {kgNum > 0 && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono"
              style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)' }}>
              <span style={{ color: '#4a5f7a' }}>✅ Se registrarán </span>
              <span style={{ color: '#40c4ff' }} className="font-bold">{kgNum.toFixed(1)} kg</span>
              <span style={{ color: '#4a5f7a' }}> como reposición confirmada el {fecha}{hora ? ` a las ${hora}` : ''}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}>
              Cancelar
            </button>
            <button type="submit" disabled={!kgNum}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: kgNum ? 'rgba(64,196,255,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${kgNum ? 'rgba(64,196,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: kgNum ? '#40c4ff' : '#4a5f7a',
                cursor: kgNum ? 'pointer' : 'not-allowed',
              }}>
              ✅ Confirmar reposición
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalIngreso({ stockActualKg, onConfirmar, onCerrar }) {
  const [fecha, setFecha] = useState(hoy())
  const [kg, setKg]       = useState('')

  const nuevoStock = stockActualKg !== null && kg
    ? (stockActualKg + parseFloat(kg || 0)).toFixed(1)
    : null

  function confirmar(e) {
    e.preventDefault()
    const v = parseFloat(kg)
    if (!v || v <= 0) return
    onConfirmar(fecha, v)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(0,230,118,0.25)', boxShadow: '0 0 60px rgba(0,230,118,0.08)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,230,118,0.12)', background: 'rgba(0,230,118,0.04)' }}>
          <div className="font-bold text-white text-sm">📦 Registrar ingreso de alimento</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Suma al stock disponible · No modifica el historial de consumo
          </div>
        </div>
        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha del ingreso</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
              Cantidad ingresada (kg)
            </label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={kg}
              onChange={e => setKg(e.target.value)}
              placeholder="Ej: 25"
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }}
            />
          </div>

          {nuevoStock && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <span style={{ color: '#4a5f7a' }}>Stock después del ingreso: </span>
              <span className="font-bold" style={{ color: '#00e676' }}>{nuevoStock} kg</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }}
            >
              Guardar ingreso
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
