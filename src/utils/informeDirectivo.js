// ─── Informe Directivo — recopilación por período ───────────────────────────
// Funciones puras: reciben los registros crudos de Supabase y un rango
// { inicio, fin } ('YYYY-MM-DD', ambos inclusive) y devuelven filas listas
// para el documento. Reglas:
//   · Cada evento se cuenta UNA vez, por su propia fecha (cópula, parto,
//     destete, entrega, sacrificio, incidente, registro de temperatura).
//   · Nada fuera del rango. Nada estimado: si falta un dato, se informa
//     "Sin registrar" (nunca se deduce).

import { difDias, parseDate } from './calculos'
import { BIO_RATAS, BIO_RATONES } from './constants'
import { enRango, ESPECIE_CORTO } from './reportemensual'
import { getCategoriaInfo, getTipoLabel, getSeveridadInfo, labelBioterio } from './sanitario'

export { enRango }

export const SIN_REG = 'Sin registrar'

const ORDEN_COLONIA = { ratas: 0, ratones_balbc: 1, ratones_c57: 2, ratones_hibridos: 3 }
const ordenColonia = id => ORDEN_COLONIA[id] ?? 9

export const ESPECIE_DE = {
  ratas:            { especie: 'Rata',  cepa: 'Wistar' },
  ratones_balbc:    { especie: 'Ratón', cepa: 'BALB/c' },
  ratones_c57:      { especie: 'Ratón', cepa: 'C57BL/6' },
  ratones_hibridos: { especie: 'Ratón', cepa: 'Híbrido F1' },
}

export function coloniaLabel(id) {
  return ESPECIE_CORTO[id] ?? labelBioterio(id)
}

const corta = f => (f ? String(f).slice(0, 10) : null)

// ── Período ─────────────────────────────────────────────────────────────────

/** Valida un rango personalizado. Devuelve un mensaje de error o null. */
export function validarRango(inicio, fin) {
  if (!inicio || !fin) return 'Elegí la fecha de inicio y la de fin.'
  if (inicio > fin) return 'La fecha de inicio no puede ser posterior a la de fin.'
  return null
}

/** Días del rango, extremos inclusive. */
export function diasDelRango(rango) {
  return difDias(parseDate(rango.inicio), parseDate(rango.fin)) + 1
}

// ── Edad / categoría ────────────────────────────────────────────────────────
const CUTOFF_CRIAS = 42

function cutoffAdultos(bioId) {
  return bioId === 'ratas' ? BIO_RATAS.STOCK_ADULTOS_DIAS : BIO_RATONES.STOCK_ADULTOS_DIAS
}

export function categoriaPorEdad(edadDias, bioId) {
  if (edadDias == null) return null
  if (edadDias < CUTOFF_CRIAS) return 'Cría'
  if (edadDias < cutoffAdultos(bioId)) return 'Joven'
  return 'Adulto'
}

function edadEn(fechaNac, fecha) {
  if (!fechaNac || !fecha) return null
  const d = difDias(parseDate(corta(fechaNac)), parseDate(corta(fecha)))
  return d >= 0 ? d : null
}

export function textoEdad(dias) {
  if (dias == null) return SIN_REG
  if (dias < 21) return `${dias} d`
  return `${Math.floor(dias / 7)} sem`
}

// ── Índices ─────────────────────────────────────────────────────────────────
/** Mapa global id → animal (todas las colonias: los híbridos usan padres de BALB/c y C57). */
export function mapaAnimales(bds) {
  const m = new Map()
  for (const bd of Object.values(bds)) for (const a of bd.animales ?? []) m.set(a.id, a)
  return m
}

const codigoDe = (animales, id) => (id ? animales.get(id)?.codigo ?? SIN_REG : '—')

// ── 1 · Apareamientos (fecha de cópula en el período) ───────────────────────
const LABEL_FALLO = {
  no_birth: 'Sin parto', failed_pregnancy: 'Preñez fallida',
  reabsorption: 'Reabsorción sospechada', unknown: 'Fallo sin especificar',
}

function estadoApareamiento(c) {
  if (c.failure_flag) return `Fallo: ${LABEL_FALLO[c.failure_type] ?? 'sin especificar'}`
  if (c.fecha_destete) return 'Destetada'
  if (c.fecha_nacimiento) return 'Parto registrado'
  if (c.fecha_separacion) return 'Separada · en gestación'
  return 'En apareamiento'
}

export function detalleApareamientos(bds, animales, rango) {
  const filas = []
  for (const [bioId, bd] of Object.entries(bds)) {
    for (const c of bd.camadas ?? []) {
      if (!enRango(c.fecha_copula, rango)) continue
      filas.push({
        id: c.id,
        colonia: bioId,
        fecha: corta(c.fecha_copula),
        hembra: codigoDe(animales, c.id_madre),
        macho: codigoDe(animales, c.id_padre),
        separacion: corta(c.fecha_separacion),
        parto: corta(c.fecha_nacimiento),
        estado: estadoApareamiento(c),
        fallo: !!c.failure_flag,
      })
    }
  }
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenColonia(a.colonia) - ordenColonia(b.colonia))
  return {
    filas,
    total: filas.length,
    porColonia: contarPor(filas, f => f.colonia),
    conParto: filas.filter(f => f.parto).length,
    fallidos: filas.filter(f => f.fallo).length,
  }
}

// ── 2 · Camadas: partos y destetes del período ──────────────────────────────
export function detalleCamadas(bds, animales, rango) {
  const partos = []
  const destetes = []
  for (const [bioId, bd] of Object.entries(bds)) {
    for (const c of bd.camadas ?? []) {
      if (c.failure_flag) continue
      const base = {
        id: c.id, colonia: bioId,
        madre: codigoDe(animales, c.id_madre),
        padre: codigoDe(animales, c.id_padre),
      }
      if (enRango(c.fecha_nacimiento, rango)) {
        partos.push({
          ...base,
          fecha: corta(c.fecha_nacimiento),
          nacidas: c.total_crias ?? null,
          machos: c.crias_machos ?? null,
          hembras: c.crias_hembras ?? null,
          gestacion: c.gestacion_real ?? null,
          reducidas: c.crias_reducidas ?? null,
        })
      }
      if (enRango(c.fecha_destete, rango)) {
        const nacidas = c.total_crias ?? null
        const destetadas = c.total_destetados ?? null
        const reducidas = c.crias_reducidas ?? 0
        const perdidas = nacidas != null && destetadas != null
          ? Math.max(0, nacidas - reducidas - destetadas)
          : null
        destetes.push({
          ...base,
          fecha: corta(c.fecha_destete),
          nacimiento: corta(c.fecha_nacimiento),
          nacidas, destetadas, perdidas,
          reducidas: c.crias_reducidas ?? null,
        })
      }
    }
  }
  const porFecha = (a, b) => a.fecha.localeCompare(b.fecha) || ordenColonia(a.colonia) - ordenColonia(b.colonia)
  partos.sort(porFecha)
  destetes.sort(porFecha)
  const suma = (arr, k) => arr.reduce((s, x) => s + (x[k] ?? 0), 0)
  return {
    partos, destetes,
    totalPartos: partos.length,
    criasNacidas: suma(partos, 'nacidas'),
    partosSinCantidad: partos.filter(p => p.nacidas == null).length,
    nacidosMachos: suma(partos, 'machos'),
    nacidosHembras: suma(partos, 'hembras'),
    totalDestetes: destetes.length,
    criasDestetadas: suma(destetes, 'destetadas'),
    destetesSinCantidad: destetes.filter(d => d.destetadas == null).length,
    perdidas: suma(destetes, 'perdidas'),
    promedioCrias: partos.filter(p => p.nacidas > 0).length > 0
      ? suma(partos, 'nacidas') / partos.filter(p => p.nacidas > 0).length
      : null,
  }
}

// ── 3 · Incidentes ──────────────────────────────────────────────────────────
export function detalleIncidentes(incidentes, animales, rango) {
  const filas = (incidentes ?? [])
    .filter(i => enRango(i.fecha, rango))
    .map(i => {
      const ids = i.animal_ids?.length ? i.animal_ids : (i.animal_id ? [i.animal_id] : [])
      const codigos = ids
        .filter(id => !String(id).startsWith('stock:'))
        .map(id => animales.get(id)?.codigo)
        .filter(Boolean)
      const deStock = ids.filter(id => String(id).startsWith('stock:')).length
      return {
        id: i.id,
        fecha: corta(i.fecha),
        colonia: i.bioterio_id,
        categoria: getCategoriaInfo(i.tipo_categoria).label,
        tipo: getTipoLabel(i.tipo_categoria, i.tipo_incidente),
        severidad: i.severidad ? getSeveridadInfo(i.severidad).label : SIN_REG,
        severidadId: i.severidad ?? null,
        descripcion: i.descripcion || '',
        animales: [...codigos, ...(deStock ? [`${deStock} jaula${deStock > 1 ? 's' : ''} de stock`] : [])].join(', '),
        duracion: i.duracion_dias ?? null,
        resuelto: !!i.resuelto,
      }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  return {
    filas,
    total: filas.length,
    graves: filas.filter(f => f.severidadId === 'grave').length,
    moderados: filas.filter(f => f.severidadId === 'moderado').length,
    leves: filas.filter(f => f.severidadId === 'leve').length,
    abiertos: filas.filter(f => !f.resuelto).length,
    porCategoria: contarPor(filas, f => f.categoria),
  }
}

// ── 4 · Temperaturas ────────────────────────────────────────────────────────
// Salas físicas: ratas = 'ratas'; ratones = 'ratones' + ids viejos de subgrupos.
export const SALAS_TEMP = [
  { id: 'ratas',   label: 'Sala de ratas',   ids: ['ratas'] },
  { id: 'ratones', label: 'Sala de ratones', ids: ['ratones', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos'] },
]
export const RANGO_TEMP_OK = { min: 20, max: 24 }

const num = x => (x == null || x === '' || isNaN(Number(x)) ? null : Number(x))

export function resumenTemperaturas(logs, rango) {
  return SALAS_TEMP.map(sala => {
    const regs = (logs ?? [])
      .filter(l => sala.ids.includes(l.bioterio_id) && enRango(l.date, rango))
      .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))

    // Un renglón por día: extremos del día y promedio de las lecturas actuales
    const porDia = new Map()
    for (const r of regs) {
      const d = corta(r.date)
      if (!porDia.has(d)) porDia.set(d, { fecha: d, lecturas: [], mins: [], maxs: [] })
      const x = porDia.get(d)
      const cur = num(r.current_temp), mn = num(r.min_temp), mx = num(r.max_temp)
      if (cur != null) x.lecturas.push(cur)
      if (mn != null) x.mins.push(mn)
      if (mx != null) x.maxs.push(mx)
    }
    const dias = [...porDia.values()].map(x => {
      const todosMin = [...x.mins, ...x.lecturas]
      const todosMax = [...x.maxs, ...x.lecturas]
      const min = todosMin.length ? Math.min(...todosMin) : null
      const max = todosMax.length ? Math.max(...todosMax) : null
      const prom = x.lecturas.length ? x.lecturas.reduce((s, v) => s + v, 0) / x.lecturas.length : null
      const fuera = (min != null && min < RANGO_TEMP_OK.min) || (max != null && max > RANGO_TEMP_OK.max)
      return { fecha: x.fecha, registros: x.lecturas.length || x.mins.length || x.maxs.length, actual: prom, min, max, fuera }
    })

    const lecturas = regs.map(r => num(r.current_temp)).filter(v => v != null)
    const mins = dias.map(d => d.min).filter(v => v != null)
    const maxs = dias.map(d => d.max).filter(v => v != null)
    return {
      ...sala,
      registros: regs.length,
      diasConRegistro: dias.length,
      dias,
      promedio: lecturas.length ? lecturas.reduce((s, v) => s + v, 0) / lecturas.length : null,
      minima: mins.length ? Math.min(...mins) : null,
      maxima: maxs.length ? Math.max(...maxs) : null,
      diasFueraDeRango: dias.filter(d => d.fuera).length,
    }
  })
}

// ── 5 · Entregas (una fila por registro de entrega) ─────────────────────────
function textoSexoEntrega(e, animal) {
  if (animal) return animal.sexo === 'macho' ? '♂ Macho' : animal.sexo === 'hembra' ? '♀ Hembra' : SIN_REG
  const m = e.machos != null ? Number(e.machos) : null
  const h = e.hembras != null ? Number(e.hembras) : null
  if (m == null && h == null) return SIN_REG
  const partes = []
  if (m) partes.push(`${m} ♂`)
  if (h) partes.push(`${h} ♀`)
  const resto = (e.cantidad ?? 0) - (m ?? 0) - (h ?? 0)
  if (resto > 0) partes.push(`${resto} sin registrar`)
  return partes.length ? partes.join(' + ') : SIN_REG
}

export function detalleEntregas(bds, animales, rango) {
  const filas = []
  let devueltas = 0
  for (const [bioId, bd] of Object.entries(bds)) {
    const camadas = new Map((bd.camadas ?? []).map(c => [c.id, c]))
    for (const e of bd.entregas ?? []) {
      if (!enRango(e.fecha, rango)) continue
      if (e.devuelta) { devueltas++; continue }
      const cantidad = e.cantidad ?? 0
      if (cantidad <= 0) continue
      const animal = !e.camada_id && e.animal_id ? animales.get(e.animal_id) : null
      const camada = e.camada_id ? camadas.get(e.camada_id) : null
      const fechaNac = animal?.fecha_nacimiento ?? camada?.fecha_nacimiento ?? null
      const edad = edadEn(fechaNac, e.fecha)
      filas.push({
        id: e.id,
        fecha: corta(e.fecha),
        colonia: bioId,
        especie: ESPECIE_DE[bioId]?.especie ?? '—',
        cepa: ESPECIE_DE[bioId]?.cepa ?? coloniaLabel(bioId),
        tipo: animal ? `Reproductor ${animal.codigo ?? ''}`.trim() : 'Stock',
        sexo: textoSexoEntrega(e, animal),
        edad: textoEdad(edad),
        categoria: categoriaPorEdad(edad, bioId) ?? SIN_REG,
        grupo: e.grupo_investigacion || 'Sin grupo asignado',
        cantidad,
        observaciones: e.observaciones || '',
      })
    }
  }
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenColonia(a.colonia) - ordenColonia(b.colonia))

  const porGrupo = [...agrupar(filas, f => f.grupo).entries()]
    .map(([grupo, fs]) => ({
      grupo,
      entregas: fs.length,
      animales: fs.reduce((s, f) => s + f.cantidad, 0),
      detalle: [...agrupar(fs, f => f.cepa).entries()]
        .map(([cepa, xs]) => `${cepa}: ${xs.reduce((s, x) => s + x.cantidad, 0)}`).join(' · '),
    }))
    .sort((a, b) => (a.grupo === 'Sin grupo asignado') - (b.grupo === 'Sin grupo asignado') || b.animales - a.animales)

  return {
    filas,
    porGrupo,
    totalAnimales: filas.reduce((s, f) => s + f.cantidad, 0),
    totalEntregas: filas.length,
    devueltas,
  }
}

// ── 5b · Pedidos con fecha de entrega en el período ─────────────────────────
const ESTADO_PEDIDO = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado', cancelado: 'Cancelado' }
const SEXO_PEDIDO = { machos: '♂ Machos', hembras: '♀ Hembras' }

export function detallePedidos(pedidos, rango) {
  const filas = (pedidos ?? [])
    .filter(p => enRango(p.fecha_entrega, rango))
    .map(p => ({
      id: p.id,
      fecha: corta(p.fecha_entrega),
      colonia: p.bioterio_id,
      cantidad: p.cantidad ?? null,
      sexo: SEXO_PEDIDO[p.sexo] ?? 'Ambos sexos',
      edad: p.edad_semanas ? `${p.edad_semanas} sem` : SIN_REG,
      solicitante: p.solicitante || SIN_REG,
      estado: ESTADO_PEDIDO[p.estado] ?? p.estado ?? SIN_REG,
      estadoId: p.estado,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  return {
    filas,
    total: filas.length,
    completados: filas.filter(f => f.estadoId === 'completado').length,
    cancelados: filas.filter(f => f.estadoId === 'cancelado').length,
  }
}

// ── 6 · Sacrificios ─────────────────────────────────────────────────────────
const CATEGORIA_SAC = { cria: 'Cría', joven: 'Joven', adulto_nr: 'Adulto no reproductor', reproductor: 'Reproductor', otro: 'Otro' }

export function detalleSacrificios(bds, animales, rango) {
  const filas = []
  for (const [bioId, bd] of Object.entries(bds)) {
    for (const s of bd.sacrificios ?? []) {
      if (!enRango(s.fecha, rango)) continue
      const animal = s.animal_id ? animales.get(s.animal_id) : null
      const esRepro = s.categoria === 'reproductor' || !!animal
      filas.push({
        id: s.id,
        fecha: corta(s.fecha),
        colonia: bioId,
        cantidad: s.cantidad ?? 0,
        categoria: esRepro
          ? `Reproductor${animal?.codigo ? ` ${animal.codigo}` : ''}${animal?.sexo === 'macho' ? ' ♂' : animal?.sexo === 'hembra' ? ' ♀' : ''}`
          : (CATEGORIA_SAC[s.categoria] ?? (s.categoria || SIN_REG)),
        reproductor: esRepro,
        motivo: s.notas || (animal?.motivo_sacrificio ?? ''),
      })
    }
  }
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenColonia(a.colonia) - ordenColonia(b.colonia))
  const sum = fs => fs.reduce((s, f) => s + f.cantidad, 0)
  const porColonia = [...agrupar(filas, f => f.colonia).entries()]
    .map(([colonia, fs]) => ({
      colonia,
      registros: fs.length,
      stock: sum(fs.filter(f => !f.reproductor)),
      reproductores: sum(fs.filter(f => f.reproductor)),
      total: sum(fs),
    }))
    .sort((a, b) => ordenColonia(a.colonia) - ordenColonia(b.colonia))
  return {
    filas,
    porColonia,
    totalAnimales: sum(filas),
    totalRegistros: filas.length,
    reproductores: sum(filas.filter(f => f.reproductor)),
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function agrupar(arr, key) {
  const m = new Map()
  for (const x of arr) {
    const k = key(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return m
}

function contarPor(arr, key) {
  return [...agrupar(arr, key).entries()].map(([k, xs]) => ({ clave: k, cantidad: xs.length }))
}
