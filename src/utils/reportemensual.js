// ─── Reporte Mensual — cálculos puros ────────────────────────────────────────
// Todas las funciones son puras: reciben datos y devuelven números/estructuras.
// Regla del módulo: si un indicador no puede calcularse con registros reales,
// se devuelve null → la UI muestra "Sin datos suficientes". Nunca estimar.
//
// Fórmulas de insumos espejan ConsumoViruta/ConsumoAlimento:
//   stock   = último censo ≤ fecha + Σ movimientos con fecha ≥ censo (y ≤ fin)
//   consumo = prev.valor + Σ movs [prev, cur) − cur.valor   (telescópico entre censos)

import { difDias, parseDate } from './calculos'
import { BIO_RATAS, BIO_RATONES } from './constants'

export const IDS_BIOTERIOS = ['ratas', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos']

export const ESPECIE_LABEL = {
  ratas:            'Ratas Wistar',
  ratones_balbc:    'Ratones BALB/c',
  ratones_c57:      'Ratones C57BL/6',
  ratones_hibridos: 'Ratones híbridos (F1)',
}

export const ESPECIE_CORTO = {
  ratas:            'Ratas Wistar',
  ratones_balbc:    'BALB/c',
  ratones_c57:      'C57BL/6',
  ratones_hibridos: 'Híbridos F1',
}

const CUTOFF_JOVENES = 42 // días — crías → jóvenes (todas las especies)

function clasificarEdadEntrega(edadDias) {
  if (edadDias == null) return 'adultos'
  if (edadDias < CUTOFF_JOVENES) return 'crias'
  if (edadDias < 70) return 'jovenes'
  return 'adultos'
}

export const SIN_DATOS = null

// ── Rango de mes ─────────────────────────────────────────────────────────────
export function rangoMes(anio, mes) {
  const ini = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
  const ultimo = new Date(anio, mes + 1, 0)
  const fin = `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`
  return { inicio: ini, fin }
}

export function enRango(fechaStr, rango) {
  if (!fechaStr) return false
  const f = String(fechaStr).slice(0, 10)
  return f >= rango.inicio && f <= rango.fin
}

export function mesAnteriorDe(anio, mes) {
  return mes === 0 ? { anio: anio - 1, mes: 11 } : { anio, mes: mes - 1 }
}

// ── Stock reconstruido a una fecha T ────────────────────────────────────────
// Reproductores vivos + crías destetadas en stock (jaulas reales o virtuales).
// Categorías por edad al corte: crías <42d / jóvenes <STOCK_ADULTOS_DIAS / adultos ≥.

function fechaRegistroAnimal(a) {
  if (a.created_at) return String(a.created_at).slice(0, 10)
  return a.fecha_nacimiento || null
}

function clasificarEdad(edadDias, cutoffAdultos) {
  if (edadDias == null) return 'adultos'
  if (edadDias < CUTOFF_JOVENES) return 'crias'
  if (edadDias < cutoffAdultos) return 'jovenes'
  return 'adultos'
}

function acumularSexo(bucket, n, machosRef, hembrasRef) {
  const cm = machosRef ?? null
  const ch = hembrasRef ?? null
  const totSexo = (cm ?? 0) + (ch ?? 0)
  if (totSexo > 0 && (cm != null || ch != null)) {
    const m = Math.min(n, Math.round(n * ((cm ?? 0) / totSexo)))
    bucket.m += m
    bucket.h += Math.max(0, n - m)
  } else {
    bucket.s += n
  }
}

function bucketVacio() {
  return { m: 0, h: 0, s: 0, total: 0 }
}

/**
 * Stock del bioterio en la fecha T ('YYYY-MM-DD').
 * @param {object} bd { animales, camadas, jaulas, sacrificios, entregas }
 * @param {string} T fecha de corte
 * @param {number} cutoffAdultos 70 (ratones) | 84 (ratas)
 */
export function stockEnFecha(bd, T, cutoffAdultos) {
  const { animales = [], camadas = [], jaulas = [], sacrificios = [], entregas = [] } = bd

  // Sacrificios / entregas de stock acumulados hasta T, por camada
  const sacPorCamada = new Map()
  for (const s of sacrificios) {
    if (!s.camada_id || !s.fecha || String(s.fecha).slice(0, 10) > T) continue
    sacPorCamada.set(s.camada_id, (sacPorCamada.get(s.camada_id) ?? 0) + (s.cantidad ?? 0))
  }
  const entPorCamada = new Map()
  for (const e of entregas) {
    if (!e.camada_id || !e.fecha || e.devuelta || String(e.fecha).slice(0, 10) > T) continue
    entPorCamada.set(e.camada_id, (entPorCamada.get(e.camada_id) ?? 0) + (e.cantidad ?? 0))
  }

  // Reproductores vivos en T
  let reproMachos = 0
  let reproHembras = 0
  for (const a of animales) {
    const reg = fechaRegistroAnimal(a)
    if (!reg || reg > T) continue
    if (a.fecha_sacrificio && String(a.fecha_sacrificio).slice(0, 10) <= T) continue
    const vivoAhora = ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado)
    if (!vivoAhora && !a.fecha_sacrificio) continue // retirado/fallecido sin fecha de egreso → no datable
    const entregado = entregas.some(
      e => e.animal_id === a.id && !e.devuelta && e.fecha && String(e.fecha).slice(0, 10) <= T
    )
    if (entregado) continue
    if (a.sexo === 'macho') reproMachos++
    else if (a.sexo === 'hembra') reproHembras++
  }

  // Stock de camadas en T
  const jaulaPorCamada = new Map(jaulas.map(j => [j.camada_id, j]))
  const stock = { crias: bucketVacio(), jovenes: bucketVacio(), adultos: bucketVacio() }
  let bloquesStock = 0

  for (const c of camadas) {
    if (c.failure_flag) continue
    if (c.incluir_en_stock === false) continue
    if (!c.fecha_destete || c.fecha_destete > T) continue
    const base = c.total_destetados ?? c.total_crias ?? 0
    if (base <= 0) continue
    const n = Math.max(0, base - (sacPorCamada.get(c.id) ?? 0) - (entPorCamada.get(c.id) ?? 0))
    if (n <= 0) continue

    const edad = c.fecha_nacimiento ? difDias(parseDate(c.fecha_nacimiento), parseDate(T)) : null
    const cat  = clasificarEdad(edad, cutoffAdultos)

    // Fuente del reparto por sexo: proporción de la camada; si no registra,
    // cae a los valores de la jaula real; si tampoco, queda sin sexo.
    let refM = c.crias_machos ?? null
    let refH = c.crias_hembras ?? null
    if (refM == null && refH == null) {
      const j = jaulaPorCamada.get(c.id)
      if (j && (j.machos != null || j.hembras != null)) { refM = j.machos; refH = j.hembras }
    }
    acumularSexo(stock[cat], n, refM, refH)
    bloquesStock++
  }

  for (const k of Object.keys(stock)) stock[k].total = stock[k].m + stock[k].h + stock[k].s

  const totalRepro   = reproMachos + reproHembras
  const totalStock   = stock.crias.total + stock.jovenes.total + stock.adultos.total
  const totalJaulas  = totalRepro + bloquesStock

  return { reproMachos, reproHembras, stock, totalRepro, totalStock, totalAnimales: totalRepro + totalStock, totalJaulas }
}

/** Suma stockEnFecha sobre todos los bioterios para una fecha. */
export function stockGlobalEnFecha(bds, T) {
  const acc = {
    reproMachos: 0, reproHembras: 0,
    stock: { crias: bucketVacio(), jovenes: bucketVacio(), adultos: bucketVacio() },
    totalRepro: 0, totalStock: 0, totalAnimales: 0, totalJaulas: 0,
  }
  for (const { bd, cutoffAdultos } of bds) {
    const s = stockEnFecha(bd, T, cutoffAdultos)
    acc.reproMachos += s.reproMachos; acc.reproHembras += s.reproHembras
    for (const k of Object.keys(acc.stock)) {
      acc.stock[k].m += s.stock[k].m; acc.stock[k].h += s.stock[k].h; acc.stock[k].s += s.stock[k].s
      acc.stock[k].total += s.stock[k].total
    }
    acc.totalRepro += s.totalRepro; acc.totalStock += s.totalStock
    acc.totalAnimales += s.totalAnimales; acc.totalJaulas += s.totalJaulas
  }
  return acc
}

/** Promedio de animales y jaulas entre dos fechas (extremos inclusive), según registros. */
export function promedioAnimalesEnIntervalo(bds, desde, hasta) {
  const a = stockGlobalEnFecha(bds, desde)
  const b = stockGlobalEnFecha(bds, hasta)
  return {
    animales: (a.totalAnimales + b.totalAnimales) / 2,
    jaulas:   (a.totalJaulas + b.totalJaulas) / 2,
  }
}

// ── Actividad reproductiva del período ──────────────────────────────────────
export function resumenReproductivo(bd, rango) {
  const { camadas = [] } = bd
  const partos = camadas.filter(c => !c.failure_flag && enRango(c.fecha_nacimiento, rango))
  const destetes = camadas.filter(c => !c.failure_flag && enRango(c.fecha_destete, rango))

  let criasNacidas = 0
  let partosSinCrias = 0
  for (const c of partos) {
    if (c.total_crias != null) criasNacidas += c.total_crias
    else partosSinCrias++
  }
  let criasDestetadas = 0
  let destetesSinCrias = 0
  for (const c of destetes) {
    if (c.total_destetados != null) criasDestetadas += c.total_destetados
    else destetesSinCrias++
  }

  return {
    partos: partos.length,
    criasNacidas,
    partosSinRegistroCrias: partosSinCrias,
    destetes: destetes.length,
    criasDestetadas,
    destetesSinRegistroCrias: destetesSinCrias,
  }
}

// ── Entregas y sacrificios del período ──────────────────────────────────────
export function resumenEgresos(bd, rango) {
  const { entregas = [], sacrificios = [] } = bd
  const entPeriodo = entregas.filter(e => enRango(e.fecha, rango))
  const entNetas   = entPeriodo.filter(e => !e.devuelta)
  const sacPeriodo = sacrificios.filter(s => enRango(s.fecha, rango))
  return {
    animalesEntregados: entNetas.reduce((s, e) => s + (e.cantidad ?? 0), 0),
    registrosEntregas:  entNetas.length,
    entregasDevueltas:  entPeriodo.length - entNetas.length,
    animalesSacrificados: sacPeriodo.reduce((s, x) => s + (x.cantidad ?? 0), 0),
    registrosSacrificios: sacPeriodo.length,
  }
}

// ── Insumos (viruta en bolsas / alimento en kg) ─────────────────────────────
// censos: [{fecha, valor}] · ingresos: [{fecha, valor}] — normalizados por el llamador.
export function resumenInsumo(censos, ingresos, rango) {
  const cs = (censos ?? [])
    .filter(c => c.fecha && c.valor != null && !isNaN(Number(c.valor)))
    .map(c => ({ fecha: String(c.fecha).slice(0, 10), valor: Number(c.valor) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ing = (ingresos ?? [])
    .filter(i => i.fecha && i.valor != null && !isNaN(Number(i.valor)))
    .map(i => ({ fecha: String(i.fecha).slice(0, 10), valor: Number(i.valor) }))

  // Último censo al cierre del período
  let censoCierre = null
  for (const c of cs) { if (c.fecha <= rango.fin) censoCierre = c; else break }

  const stockCierre = censoCierre !== null
    ? censoCierre.valor +
      ing.filter(i => i.fecha >= censoCierre.fecha && i.fecha <= rango.fin)
         .reduce((s, i) => s + i.valor, 0)
    : SIN_DATOS

  const ingresosPeriodo = ing.filter(i => enRango(i.fecha, rango))
  const totalIngresos = ingresosPeriodo.reduce((s, i) => s + i.valor, 0)
  const hayIngresos = ingresosPeriodo.length > 0

  // Consumo medido por el par de censos que acota el período (telescópico)
  let prev = null
  for (const c of cs) { if (c.fecha < rango.inicio) prev = c; else break }
  if (!prev) prev = cs.find(c => c.fecha >= rango.inicio && censoCierre && c.fecha < censoCierre.fecha) ?? null
  const cur = censoCierre

  let consumo = SIN_DATOS
  let medidaDesde = null
  let medidaHasta = null
  if (prev && cur && cur.fecha > prev.fecha) {
    const movs = ing
      .filter(i => i.fecha >= prev.fecha && i.fecha < cur.fecha)
      .reduce((s, i) => s + i.valor, 0)
    const medido = prev.valor + movs - cur.valor
    if (medido >= 0) {
      consumo = medido
      medidaDesde = prev.fecha
      medidaHasta = cur.fecha
    }
  }

  // Promedio mensual histórico (todos los pares de censos con consumo > 0)
  let promedioMensual = SIN_DATOS
  if (cs.length >= 2) {
    let total = 0
    for (let i = 0; i < cs.length - 1; i++) {
      const p = cs[i]
      const q = cs[i + 1]
      const movs = ing
        .filter(x => x.fecha >= p.fecha && x.fecha < q.fecha)
        .reduce((s, x) => s + x.valor, 0)
      const c = p.valor + movs - q.valor
      if (c > 0) total += c
    }
    const diasSpan = difDias(parseDate(cs[0].fecha), parseDate(cs[cs.length - 1].fecha))
    const mesesSpan = Math.max(1, diasSpan / 30.44)
    if (total > 0) promedioMensual = total / mesesSpan
  }

  // Consumo semanal del intervalo medido (solo si alcanza para una semana completa)
  const diasMedidos = medidaDesde ? difDias(parseDate(medidaDesde), parseDate(medidaHasta)) : null
  const porSemana = diasMedidos != null && diasMedidos >= 7 && consumo !== SIN_DATOS && consumo > 0
    ? consumo / (diasMedidos / 7)
    : SIN_DATOS

  return { stockCierre, fechaStockCierre: censoCierre?.fecha ?? null, ingresosPeriodo: totalIngresos, hayIngresos, consumo, medidaDesde, medidaHasta, promedioMensual, porSemana, diasMedidos }
}

// ── Clasificación de entregas por especie / sexo / edad / grupo ─────────────
export function clasificarEntregas(bds) {
  const entries = []
  for (const [bioId, bd] of Object.entries(bds)) {
    const { entregas = [], animales = [], camadas = [], jaulas = [] } = bd
    const camadaMap = new Map(camadas.map(c => [c.id, c]))
    const jaulaMap = new Map(jaulas.map(j => [j.camada_id, j]))
    const animalMap = new Map(animales.map(a => [a.id, a]))
    const esRatas = bioId === 'ratas'

    for (const e of entregas) {
      if (e.devuelta) continue
      const cantidad = e.cantidad ?? 0
      if (cantidad <= 0) continue

      const esReproductor = !e.camada_id && e.animal_id
      const esStock = !!e.camada_id

      let sexo = null
      let fechaNacimiento = null

      if (esStock) {
        const camada = camadaMap.get(e.camada_id)
        if (!camada) continue
        if (e.machos != null && e.hembras != null) {
          sexo = e.machos > e.hembras ? 'macho' : e.hembras > e.machos ? 'hembra' : 'mixto'
        } else if (camada.crias_machos != null && camada.crias_hembras != null) {
          sexo = camada.crias_machos > camada.crias_hembras ? 'macho'
            : camada.crias_hembras > camada.crias_machos ? 'hembra' : 'mixto'
        } else {
          const jaula = jaulaMap.get(e.camada_id)
          if (jaula && (jaula.machos != null || jaula.hembras != null)) {
            sexo = (jaula.machos ?? 0) > (jaula.hembras ?? 0) ? 'macho'
              : (jaula.hembras ?? 0) > (jaula.machos ?? 0) ? 'hembra' : 'mixto'
          }
        }
        fechaNacimiento = camada.fecha_nacimiento
      } else if (esReproductor) {
        const animal = animalMap.get(e.animal_id)
        if (!animal) continue
        sexo = animal.sexo
        fechaNacimiento = animal.fecha_nacimiento
      } else {
        continue
      }

      const edadDias = (fechaNacimiento && e.fecha)
        ? difDias(parseDate(fechaNacimiento), parseDate(String(e.fecha).slice(0, 10)))
        : null
      const categoria = clasificarEdadEntrega(edadDias)

      entries.push({
        especie: esRatas ? 'ratas' : bioId,
        sexo: sexo || 'sin Sexo',
        categoria,
        grupo: e.grupo_investigacion || 'Sin grupo',
        cantidad,
      })
    }
  }

  const detMap = new Map()
  const grpMap = new Map()
  const espMap = new Map()

  for (const d of entries) {
    const key = `${d.especie}|${d.sexo}|${d.categoria}|${d.grupo}`
    if (detMap.has(key)) { detMap.get(key).cantidad += d.cantidad }
    else { detMap.set(key, { ...d }) }

    const gKey = d.grupo
    if (grpMap.has(gKey)) { grpMap.get(gKey).total += d.cantidad; grpMap.get(gKey).registros++ }
    else { grpMap.set(gKey, { grupo: gKey, total: d.cantidad, registros: 1 }) }

    const eKey = d.especie
    if (!espMap.has(eKey)) espMap.set(eKey, { machos: 0, hembras: 0, mixto: 0, sinSexo: 0, total: 0 })
    const esp = espMap.get(eKey)
    esp.total += d.cantidad
    if (d.sexo === 'macho') esp.machos += d.cantidad
    else if (d.sexo === 'hembra') esp.hembras += d.cantidad
    else if (d.sexo === 'mixto') esp.mixto += d.cantidad
    else esp.sinSexo += d.cantidad
  }

  const detalle = [...detMap.values()].sort((a, b) => {
    const oe = { ratas: 0, ratones_balbc: 1, ratones_c57: 2, ratones_hibridos: 3 }
    const os = { macho: 0, hembra: 1, mixto: 2, 'sin Sexo': 3 }
    const oc = { crias: 0, jovenes: 1, adultos: 2 }
    const dEsp = (oe[a.especie] ?? 9) - (oe[b.especie] ?? 9)
    if (dEsp !== 0) return dEsp
    const dSex = (os[a.sexo] ?? 9) - (os[b.sexo] ?? 9)
    if (dSex !== 0) return dSex
    return (oc[a.categoria] ?? 9) - (oc[b.categoria] ?? 9)
  })

  return {
    detalle,
    porGrupo: [...grpMap.values()].sort((a, b) => b.total - a.total),
    porEspecie: [...espMap.entries()].map(([id, s]) => ({ id, ...s })).sort((a, b) => (oe2(a.id) - oe2(b.id))),
  }
}

function oe2(id) { return { ratas: 0, ratones_balbc: 1, ratones_c57: 2, ratones_hibridos: 3 }[id] ?? 9 }
