import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { BIO_RATAS, BIO_RATONES } from '../utils/constants'
import { difDias, parseDate, hoy, formatFecha } from '../utils/calculos'
import { generarId } from '../utils/storage'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, RefreshCw, Plus, ClipboardList, TrendingDown, Info, Layers, AlertTriangle, ShoppingCart, Calendar, Clock, CheckCircle } from 'lucide-react'

const PESOS = {
  macho_repro:      1.2,
  hembra_lactante:  0.5,
  hembra_repro:     1.0,
  stock_adultos:    1.0,
  stock_jovenes:    0.7,
  stock_crias:      0.5,
  raton_std:        0.5,
}
const CAMBIOS_SEM  = 2
const TASA_DEFAULT = 0.08

const TODOS = [
  { id: 'ratas',            especie: 'rata',  bio: BIO_RATAS,   color: '#00e676', label: 'Bioterio de Ratas',   icon: '🐀' },
  { id: 'ratones_balbc',    especie: 'raton', bio: BIO_RATONES, color: '#40c4ff', label: 'Ratones Balb/C',      icon: '🐭' },
  { id: 'ratones_c57',      especie: 'raton', bio: BIO_RATONES, color: '#a78bfa', label: 'Ratones C57',         icon: '🐭' },
  { id: 'ratones_hibridos', especie: 'raton', bio: BIO_RATONES, color: '#ffb300', label: 'Ratones Híbridos',    icon: '🐭' },
]
const IDS_RATONES = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// ── Helpers ───────────────────────────────────────────────────────────────────

function edadDias(fn) {
  if (!fn) return null
  return difDias(parseDate(fn), parseDate(hoy()))
}

function catStock(dias, bio) {
  if (dias === null) return 'adultos'
  if (dias < 42) return 'crias'
  if (dias < bio.STOCK_ADULTOS_DIAS) return 'jovenes'
  return 'adultos'
}

function stockCamada(camada, sacrificios, entregas) {
  const sac = sacrificios.filter(s => s.camada_id === camada.id).reduce((a, x) => a + x.cantidad, 0)
  const ent = entregas.filter(e => e.camada_id === camada.id).reduce((a, x) => a + x.cantidad, 0)
  return Math.max(0, (camada.total_destetados ?? camada.total_crias ?? 0) - sac - ent)
}

function contarJaulas(especie, bio, animales, camadas, jaulas, sacrificios, entregas) {
  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']
  const machos = animales.filter(a => a.sexo === 'macho' && estadosActivos.includes(a.estado)).length
  const idsLactantes = new Set(
    animales
      .filter(a =>
        a.sexo === 'hembra' && a.estado === 'en_cria' &&
        camadas.some(c => c.id_madre === a.id && c.fecha_nacimiento && !c.fecha_destete && !c.failure_flag)
      )
      .map(a => a.id)
  )
  const hembrasRepro = animales.filter(a =>
    a.sexo === 'hembra' && (a.estado === 'activo' || a.estado === 'en_cria') && !idsLactantes.has(a.id)
  ).length
  const jaulasMap = new Set(jaulas.map(j => j.camada_id))
  let jCrias = 0, jJovenes = 0, jAdultos = 0
  function acumular(fechaNacimiento) {
    const cat = catStock(edadDias(fechaNacimiento), bio)
    if      (cat === 'crias')   jCrias++
    else if (cat === 'jovenes') jJovenes++
    else                        jAdultos++
  }
  jaulas.forEach(j => {
    const c = camadas.find(x => x.id === j.camada_id)
    if (!c || c.incluir_en_stock === false || j.total <= 0) return
    acumular(c.fecha_nacimiento)
  })
  camadas.forEach(c => {
    if (!c.fecha_destete || c.incluir_en_stock === false || jaulasMap.has(c.id)) return
    if (stockCamada(c, sacrificios, entregas) <= 0) return
    acumular(c.fecha_nacimiento)
  })
  return { machos, lactantes: idsLactantes.size, hembrasRepro, jCrias, jJovenes, jAdultos,
    totalJaulas: machos + idsLactantes.size + hembrasRepro + jCrias + jJovenes + jAdultos }
}

function calcUnidades(conteos, especie) {
  if (especie === 'rata') {
    return (
      conteos.machos       * PESOS.macho_repro +
      conteos.lactantes    * PESOS.hembra_lactante +
      conteos.hembrasRepro * PESOS.hembra_repro +
      conteos.jAdultos     * PESOS.stock_adultos +
      conteos.jJovenes     * PESOS.stock_jovenes +
      conteos.jCrias       * PESOS.stock_crias
    ) * CAMBIOS_SEM
  }
  return conteos.totalJaulas * PESOS.raton_std * CAMBIOS_SEM
}

// ── Ciclo de cambios de cama ──────────────────────────────────────────────────

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function horaActual() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function diaLocal(fechaStr) {
  if (!fechaStr) return -1
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function esDiaDeCambio(fechaStr) {
  const d = diaLocal(fechaStr)
  return d === 1 || d === 5
}

function probCambioReciente(fechaStr, horaStr) {
  const day = diaLocal(fechaStr)
  const h   = parseInt((horaStr ?? '12:00').split(':')[0])
  if (day === 1 || day === 5) {
    if (h < 8)  return 0.10
    if (h < 9)  return 0.25
    if (h < 12) return 0.60
    if (h < 18) return 0.85
    return 0.90
  }
  if (day === 2 || day === 6) return 0.10
  if (day === 0)              return 0.08
  return 0.05
}

function proximoCambioDesde(fechaStr, horaStr) {
  if (!fechaStr) return null
  const [y, m, d] = fechaStr.split('-').map(Number)
  const parts     = (horaStr ?? '12:00').split(':').map(Number)
  const ref       = new Date(y, m - 1, d, parts[0] ?? 12, parts[1] ?? 0, 0)
  const day       = ref.getDay()

  function nextDay(target) {
    let ahead = (target - day + 7) % 7
    if (ahead === 0) {
      const ref8 = new Date(ref); ref8.setHours(8, 0, 0, 0)
      ahead = ref >= ref8 ? 7 : 0
    }
    const r = new Date(ref)
    r.setDate(r.getDate() + ahead)
    r.setHours(8, 0, 0, 0)
    return r
  }

  const nextLun = nextDay(1)
  const nextVie = nextDay(5)
  const prox    = nextLun <= nextVie ? nextLun : nextVie
  return {
    dia:           DIAS_SEMANA[prox.getDay()],
    fecha:         `${String(prox.getDate()).padStart(2,'0')}/${String(prox.getMonth()+1).padStart(2,'0')}`,
    diasRestantes: (prox - ref) / (1000 * 60 * 60 * 24),
  }
}

function contextoCiclo(fechaStr, horaStr) {
  const prob = probCambioReciente(fechaStr, horaStr)
  const day  = diaLocal(fechaStr)
  const h    = parseInt((horaStr ?? '12:00').split(':')[0])
  if ((day === 1 || day === 5) && h < 9) return { label: 'Antes del cambio · inminente', color: '#ffb300' }
  if (prob >= 0.55) return { label: 'Probable cambio de cama realizado', color: '#ffb300' }
  if (day === 4)    return { label: 'Víspera del cambio (mañana)', color: '#4a5f7a' }
  if (day === 2 || day === 6 || day === 0) return { label: 'Post-cambio · ciclo activo', color: '#00e676' }
  return { label: 'Mitad del ciclo · sin cambios recientes', color: '#4a5f7a' }
}

// Etiqueta corta del bioterio para mostrar en badges
function labelCorto(id) {
  return { ratas: 'Ratas', ratones_balbc: 'Balb/C', ratones_c57: 'C57', ratones_hibridos: 'Híbridos' }[id] ?? id
}

// ── Mapeo DB ↔ app ────────────────────────────────────────────────────────────
// Supabase usa snake_case; el estado interno usa camelCase (compatibilidad)

function censoFromDB(row) {
  return {
    id:          row.id,
    fecha:       typeof row.fecha === 'string' ? row.fecha : row.fecha?.slice?.(0, 10) ?? row.fecha,
    hora:        row.hora   ?? null,
    bolsas:      row.bolsas ?? 0,
    unidades:    row.unidades ?? 0,
    cambioCama:  row.cambio_cama ?? null,
  }
}

function censoToDB(censo) {
  return {
    id:          censo.id,
    fecha:       censo.fecha,
    hora:        censo.hora   ?? null,
    bolsas:      censo.bolsas,
    unidades:    censo.unidades ?? 0,
    cambio_cama: censo.cambioCama ?? null,
  }
}

function compraFromDB(row) {
  return {
    id:    row.id,
    fecha: typeof row.fecha === 'string' ? row.fecha : row.fecha?.slice?.(0, 10) ?? row.fecha,
    bolsas: row.bolsas ?? 0,
  }
}

// ── Migración automática desde localStorage ───────────────────────────────────
// Sin flags: cada carga verifica si Supabase está vacío y hay datos en LS.
// Cuando migra exitosamente, borra las claves de LS para no repetir.
const LS_CENSOS  = 'appMosca_viruta_censos'
const LS_COMPRAS = 'appMosca_viruta_compras'

async function migrarDesdeLocalStorage() {
  try {
    const censoLS  = JSON.parse(localStorage.getItem(LS_CENSOS)  || '[]')
    const compraLS = JSON.parse(localStorage.getItem(LS_COMPRAS) || '[]')
    if (censoLS.length === 0 && compraLS.length === 0) return  // nada que migrar

    const { data: existentes } = await supabase.from('viruta_censos').select('id').limit(1)
    if (existentes && existentes.length > 0) {
      // Supabase ya tiene datos → limpiar LS para no reintentar
      localStorage.removeItem(LS_CENSOS)
      localStorage.removeItem(LS_COMPRAS)
      return
    }

    if (censoLS.length > 0) {
      const { error: e1 } = await supabase.from('viruta_censos').insert(censoLS.map(censoToDB))
      if (e1) throw new Error('viruta_censos: ' + e1.message)
    }
    if (compraLS.length > 0) {
      const { error: e2 } = await supabase.from('viruta_compras').insert(
        compraLS.map(c => ({ id: c.id, fecha: c.fecha, bolsas: c.bolsas ?? 0 }))
      )
      if (e2) throw new Error('viruta_compras: ' + e2.message)
    }
    localStorage.removeItem(LS_CENSOS)
    localStorage.removeItem(LS_COMPRAS)
    return '✅ Migración completada'
  } catch (e) {
    return '❌ Error: ' + e.message
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsumoViruta() {
  const { limpiarBioterio } = useBioterioActivo()

  const [datos,          setDatos]          = useState(null)
  const [cargando,       setCargando]       = useState(true)
  const [error,          setError]          = useState(null)
  const [censos,         setCensos]         = useState([])
  const [compras,        setCompras]        = useState([])
  const [modal,          setModal]          = useState(false)
  const [modalCompra,    setModalCompra]    = useState(false)
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [censoAConfirmar,setCensoAConfirmar]= useState(null)
  const [msgMigracion,   setMsgMigracion]   = useState(null)  // DEBUG temporal

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      // Migrar localStorage → Supabase si es la primera vez
      const msgMig = await migrarDesdeLocalStorage()
      if (msgMig) setMsgMigracion(msgMig)

      const [
        resAnimales,
        resCensos,
        resCompras,
      ] = await Promise.all([
        Promise.all(
          TODOS.map(({ id }) => Promise.all([
            supabase.from('animales').select('*').eq('bioterio_id', id),
            supabase.from('camadas').select('*').eq('bioterio_id', id),
            supabase.from('jaulas').select('*').eq('bioterio_id', id),
            supabase.from('sacrificios').select('*').eq('bioterio_id', id),
            supabase.from('entregas').select('*').eq('bioterio_id', id),
          ]))
        ),
        supabase.from('viruta_censos').select('*').order('fecha', { ascending: true }),
        supabase.from('viruta_compras').select('*').order('fecha', { ascending: true }),
      ])

      // Datos de animales por bioterio
      const nd = {}
      TODOS.forEach(({ id, especie, bio }, i) => {
        const [{ data: an }, { data: ca }, { data: ja }, { data: sa }, { data: en }] = resAnimales[i]
        const conteos  = contarJaulas(especie, bio, an ?? [], ca ?? [], ja ?? [], sa ?? [], en ?? [])
        const unidades = calcUnidades(conteos, especie)
        nd[id] = { conteos, unidades }
      })
      setDatos(nd)

      // Censos y compras de Supabase
      setCensos((resCensos.data ?? []).map(censoFromDB))
      setCompras((resCompras.data ?? []).map(compraFromDB))

    } catch (e) {
      console.error('Error viruta:', e)
      setError('No se pudo cargar la información. Verificá la conexión.')
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Totales globales ──────────────────────────────────────────────────────
  const totales = useMemo(() => {
    if (!datos) return null
    const totalUnidades = TODOS.reduce((s, { id }) => s + datos[id].unidades, 0)
    const totalJaulas   = TODOS.reduce((s, { id }) => s + datos[id].conteos.totalJaulas, 0)
    const contRatas     = datos['ratas']?.conteos ?? null
    const unidRatas     = datos['ratas']?.unidades ?? 0
    const contRatones   = IDS_RATONES.reduce(
      (acc, id) => {
        const c = datos[id]?.conteos
        if (!c) return acc
        return { machos: acc.machos + c.machos, lactantes: acc.lactantes + c.lactantes,
          hembrasRepro: acc.hembrasRepro + c.hembrasRepro, jCrias: acc.jCrias + c.jCrias,
          jJovenes: acc.jJovenes + c.jJovenes, jAdultos: acc.jAdultos + c.jAdultos,
          totalJaulas: acc.totalJaulas + c.totalJaulas }
      },
      { machos: 0, lactantes: 0, hembrasRepro: 0, jCrias: 0, jJovenes: 0, jAdultos: 0, totalJaulas: 0 }
    )
    const unidRatones = IDS_RATONES.reduce((s, id) => s + (datos[id]?.unidades ?? 0), 0)
    return { totalUnidades, totalJaulas, contRatas, contRatones, unidRatas, unidRatones }
  }, [datos])

  // ── Calibración adaptativa ────────────────────────────────────────────────
  // Periodos confirmados tienen mayor peso en el promedio ponderado.
  const calibracion = useMemo(() => {
    if (censos.length < 2 || !totales) return null
    const tasas = []
    let pesoTotal = 0
    let tasaPonderada = 0
    for (let i = 0; i < censos.length - 1; i++) {
      const prev = censos[i]
      const cur  = censos[i + 1]
      // Peso según confirmaciones: ambos confirmados = 1.5, uno = 1.0, ninguno = 0.6
      const prevConf = prev.cambioCama?.tipo != null
      const curConf  = cur.cambioCama?.tipo  != null
      const peso = prevConf && curConf ? 1.5 : prevConf || curConf ? 1.0 : 0.6
      const comprasEnPeriodo = compras
        .filter(c => c.fecha >= prev.fecha && c.fecha < cur.fecha)
        .reduce((s, c) => s + c.bolsas, 0)
      const consumido = prev.bolsas + comprasEnPeriodo - cur.bolsas
      if (consumido <= 0) continue
      const sem  = difDias(parseDate(prev.fecha), parseDate(cur.fecha)) / 7
      if (sem  <= 0) continue
      const uAvg = ((prev.unidades ?? totales.totalUnidades) + (cur.unidades ?? totales.totalUnidades)) / 2
      if (uAvg <= 0) continue
      const t = consumido / sem / uAvg
      tasas.push(t)
      tasaPonderada += t * peso
      pesoTotal += peso
    }
    if (tasas.length === 0) return null
    const tasa = pesoTotal > 0 ? tasaPonderada / pesoTotal : tasas.reduce((s, t) => s + t, 0) / tasas.length
    return { tasa, periodos: tasas.length, tasas }
  }, [censos, compras, totales])

  const tasa      = calibracion?.tasa ?? TASA_DEFAULT
  const calibrado = !!calibracion

  const bolsasPorSem = totales ? totales.totalUnidades * tasa : 0

  const ultimoCenso = censos.length > 0 ? censos[censos.length - 1] : null

  const comprasPostCenso = ultimoCenso
    ? compras.filter(c => c.fecha >= ultimoCenso.fecha)
    : []
  const stockActual = ultimoCenso !== null
    ? ultimoCenso.bolsas + comprasPostCenso.reduce((s, c) => s + c.bolsas, 0)
    : null

  const duracionSem = (stockActual !== null && bolsasPorSem > 0)
    ? stockActual / bolsasPorSem : null

  // ── Ciclo de cambios de cama ──────────────────────────────────────────────
  const proximoCambioHoy = proximoCambioDesde(hoy(), horaActual())

  // Confianza del modelo: sube a medida que se confirman cambios de cama
  const confianzaModelo = useMemo(() => {
    if (censos.length === 0) return { pct: 0, confirmados: 0, total: 0, suficiente: false }
    const enDiaCambio = censos.filter(c => esDiaDeCambio(c.fecha))
    if (enDiaCambio.length === 0) return { pct: 75, confirmados: 0, total: 0, suficiente: false }
    const confirmados = enDiaCambio.filter(c => c.cambioCama?.tipo).length
    const pct = Math.round(65 + (confirmados / enDiaCambio.length) * 30)
    return { pct, confirmados, total: enDiaCambio.length, suficiente: confirmados >= 3 }
  }, [censos])

  // Aviso relleno: suprimido si el último censo tiene confirmación 'no'
  const avisoRelleno = useMemo(() => {
    if (!ultimoCenso) return null
    const cc = ultimoCenso.cambioCama
    if (cc?.tipo === 'no') return null  // confirmado sin cambio → no hay aviso
    const prob = probCambioReciente(ultimoCenso.fecha, ultimoCenso.hora)
    if (prob < 0.45 && !cc) return null
    return {
      prob,
      dia: DIAS_SEMANA[diaLocal(ultimoCenso.fecha)],
      confirmado: cc?.tipo ?? null,
    }
  }, [ultimoCenso])

  // ¿El último censo está en un día de cambio y sin confirmar?
  const pendienteConfirmacion = useMemo(() => {
    if (!ultimoCenso) return false
    if (ultimoCenso.cambioCama?.tipo) return false
    const prob = probCambioReciente(ultimoCenso.fecha, ultimoCenso.hora)
    return esDiaDeCambio(ultimoCenso.fecha) || prob >= 0.45
  }, [ultimoCenso])

  // ── Alertas ───────────────────────────────────────────────────────────────
  const nivelAlerta = duracionSem === null ? null
    : duracionSem < 2 ? 'critico'
    : duracionSem < 4 ? 'bajo'
    : duracionSem < 8 ? 'ok'
    : 'bien'

  const colorAlerta = { critico: '#ff6b80', bajo: '#ffb300', ok: '#00e676', bien: '#00e676' }[nivelAlerta] ?? '#c49a6a'

  // ── CRUD (Supabase) ───────────────────────────────────────────────────────
  async function registrarCenso(fecha, hora, bolsas, cambioCama) {
    const nuevo = { id: generarId(), fecha, hora, bolsas, unidades: totales?.totalUnidades ?? 0, cambioCama: cambioCama ?? null }
    const { error: e } = await supabase.from('viruta_censos').insert(censoToDB(nuevo))
    if (e) { console.error('Error al guardar censo viruta:', e); return }
    setCensos(prev => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setModal(false)
  }

  async function eliminarCenso(id) {
    const { error: e } = await supabase.from('viruta_censos').delete().eq('id', id)
    if (e) { console.error('Error al eliminar censo viruta:', e); return }
    setCensos(prev => prev.filter(c => c.id !== id))
  }

  async function confirmarCambioCama(censoId, cambioCama) {
    const { error: e } = await supabase
      .from('viruta_censos')
      .update({ cambio_cama: cambioCama })
      .eq('id', censoId)
    if (e) { console.error('Error al confirmar cambio de cama:', e); return }
    setCensos(prev => prev.map(c => c.id === censoId ? { ...c, cambioCama } : c))
    setModalConfirmar(false); setCensoAConfirmar(null)
  }

  async function registrarCompra(fecha, bolsas) {
    const nueva = { id: generarId(), fecha, bolsas }
    const { error: e } = await supabase.from('viruta_compras').insert(nueva)
    if (e) { console.error('Error al guardar compra viruta:', e); return }
    setCompras(prev => [...prev, nueva].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setModalCompra(false)
  }

  async function eliminarCompraItem(id) {
    const { error: e } = await supabase.from('viruta_compras').delete().eq('id', id)
    if (e) { console.error('Error al eliminar compra viruta:', e); return }
    setCompras(prev => prev.filter(c => c.id !== id))
  }

  function abrirConfirmar(censo) {
    setCensoAConfirmar(censo)
    setModalConfirmar(true)
  }

  // ── Datos para gráficos ───────────────────────────────────────────────────
  const datosStock = useMemo(() =>
    censos.map(c => ({ f: c.fecha.slice(5), bolsas: c.bolsas }))
  , [censos])

  const datosConsumo = useMemo(() => {
    if (censos.length < 2) return []
    return censos.slice(0, -1).map((prev, i) => {
      const cur = censos[i + 1]
      const comprasEnPeriodo = compras
        .filter(c => c.fecha >= prev.fecha && c.fecha < cur.fecha)
        .reduce((s, c) => s + c.bolsas, 0)
      const consumido = prev.bolsas + comprasEnPeriodo - cur.bolsas
      const sem = difDias(parseDate(prev.fecha), parseDate(cur.fecha)) / 7
      return {
        f:        cur.fecha.slice(5),
        real:     consumido > 0 ? Math.round(consumido * 100) / 100 : 0,
        estimado: Math.round(bolsasPorSem * sem * 100) / 100,
      }
    }).filter(d => d.real > 0 || d.estimado > 0)
  }, [censos, compras, bolsasPorSem])

  // ── Timeline unificada ────────────────────────────────────────────────────
  const movimientos = useMemo(() => {
    const items = [
      ...censos.map(c => ({ ...c, tipo: 'censo' })),
      ...compras.map(c => ({ ...c, tipo: 'compra' })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha) || (a.tipo === 'censo' ? -1 : 1))
    return items
  }, [censos, compras])

  function consumoPorCenso(censo) {
    const idx  = censos.findIndex(c => c.id === censo.id)
    if (idx <= 0) return null
    const prev = censos[idx - 1]
    const comprasEnPeriodo = compras
      .filter(c => c.fecha >= prev.fecha && c.fecha < censo.fecha)
      .reduce((s, c) => s + c.bolsas, 0)
    const consumido = prev.bolsas + comprasEnPeriodo - censo.bolsas
    const sem = difDias(parseDate(prev.fecha), parseDate(censo.fecha)) / 7
    return consumido > 0
      ? { consumido, porSem: sem > 0 ? (consumido / sem).toFixed(2) : null }
      : null
  }

  // ── Color confianza ───────────────────────────────────────────────────────
  function colorConfianza(pct) {
    if (pct >= 90) return '#00e676'
    if (pct >= 80) return '#40c4ff'
    if (pct >= 70) return '#ffb300'
    return '#4a5f7a'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050810' }}>

      {/* DEBUG migración — borrar después */}
      {msgMigracion && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-mono"
          style={{
            background: msgMigracion.startsWith('✅') ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.15)',
            border: `1px solid ${msgMigracion.startsWith('✅') ? 'rgba(0,230,118,0.4)' : 'rgba(255,61,87,0.4)'}`,
            color: msgMigracion.startsWith('✅') ? '#00e676' : '#ff6b80',
          }}>
          {msgMigracion}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(167,139,250,0.18)', background: 'rgba(13,21,40,0.6)' }}>
        <button onClick={limpiarBioterio}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono"
          style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.07)' }}>
          <ArrowLeft size={14} /> Volver al selector
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white text-base">Consumo de viruta / camas</h1>
          <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
            Ratas + Ratones · predicción adaptativa por tipo de jaula
          </p>
        </div>
        <button onClick={cargarDatos} disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a', cursor: cargando ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-4xl mx-auto w-full space-y-5">

        {error && (
          <div className="rounded-2xl px-5 py-4 text-sm font-mono"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
            ⚠️ {error}
          </div>
        )}

        {cargando && !datos && (
          <div className="flex items-center justify-center gap-3 py-20">
            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
            <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>Contando jaulas activas...</span>
          </div>
        )}

        {datos && totales && (
          <>
            {/* ── Panel principal de predicción ── */}
            <div className="rounded-2xl overflow-hidden" style={{
              background: 'rgba(13,21,40,0.9)',
              border: `1.5px solid ${calibrado ? 'rgba(0,230,118,0.3)' : 'rgba(167,139,250,0.3)'}`,
              boxShadow: `0 0 40px ${calibrado ? 'rgba(0,230,118,0.05)' : 'rgba(167,139,250,0.05)'}`,
            }}>
              <div className="px-6 py-3 flex items-center gap-2"
                style={{ borderBottom: `1px solid ${calibrado ? 'rgba(0,230,118,0.12)' : 'rgba(167,139,250,0.12)'}`, background: calibrado ? 'rgba(0,230,118,0.04)' : 'rgba(167,139,250,0.04)' }}>
                <TrendingDown size={14} style={{ color: calibrado ? '#00e676' : '#a78bfa' }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: calibrado ? '#00e676' : '#a78bfa' }}>
                  Predicción de consumo
                </span>
                {calibrado ? (
                  <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
                    ✓ Calibrado con {calibracion.periodos} período{calibracion.periodos > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>
                    Estimación inicial · sin calibrar
                  </span>
                )}
              </div>

              {/* Tres métricas */}
              <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

                {/* Stock actual */}
                <div className="px-5 py-5 text-center flex flex-col items-center gap-1">
                  <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4a5f7a' }}>Viruta disponible</div>
                  {stockActual !== null ? (
                    <>
                      <div className="text-3xl font-bold font-mono text-white leading-none">{stockActual}</div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>bolsas</div>
                      {comprasPostCenso.length > 0 && (
                        <div className="text-xs font-mono mt-1" style={{ color: '#00e676' }}>
                          +{comprasPostCenso.reduce((s, c) => s + c.bolsas, 0)} desde último censo
                        </div>
                      )}
                      {ultimoCenso && (
                        <div className="text-xs font-mono" style={{ color: '#3d5068' }}>
                          Censo: {formatFecha(ultimoCenso.fecha, { day: '2-digit', month: '2-digit' })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm font-mono" style={{ color: '#3d5068' }}>Sin censos</div>
                  )}
                </div>

                {/* Consumo estimado */}
                <div className="px-5 py-5 text-center flex flex-col items-center gap-1">
                  <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4a5f7a' }}>Consumo estimado</div>
                  <div className="text-3xl font-bold font-mono leading-none" style={{ color: calibrado ? '#00e676' : '#a78bfa' }}>
                    {bolsasPorSem.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>bolsas / semana</div>
                  <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>
                    {totales.totalJaulas} jaulas · {totales.totalUnidades.toFixed(1)} unid.
                  </div>
                </div>

                {/* Duración */}
                <div className="px-5 py-5 text-center flex flex-col items-center gap-1">
                  <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4a5f7a' }}>Duración estimada</div>
                  {duracionSem !== null ? (
                    <>
                      <div className="text-3xl font-bold font-mono leading-none" style={{ color: colorAlerta }}>
                        {duracionSem.toFixed(1)}
                      </div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>semanas</div>
                      <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>
                        ≈ {Math.floor(duracionSem * 7)} días
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-mono mt-2" style={{ color: '#3d5068' }}>Registrá un censo</div>
                  )}
                </div>
              </div>

              {/* Alertas */}
              {nivelAlerta === 'critico' && (
                <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-mono"
                  style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.3)', color: '#ff6b80' }}>
                  <AlertTriangle size={16} />
                  <span>⚠ Stock crítico — menos de 2 semanas. Reponer con urgencia.</span>
                </div>
              )}
              {nivelAlerta === 'bajo' && (
                <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-mono"
                  style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: '#ffb300' }}>
                  <AlertTriangle size={16} />
                  <span>Stock bajo — menos de 4 semanas. Planificá la compra.</span>
                </div>
              )}

              {/* Detalle ratas vs ratones */}
              <div className="grid grid-cols-2 divide-x text-xs font-mono"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="px-5 py-3 flex items-center gap-3">
                  <span>🐀</span>
                  <div>
                    <div style={{ color: '#00e676' }}>Ratas</div>
                    <div style={{ color: '#3d5068' }}>{totales.contRatas?.totalJaulas ?? 0} jaulas · {totales.unidRatas.toFixed(1)} unid.</div>
                  </div>
                  <div className="ml-auto font-bold text-white">{(totales.unidRatas * tasa).toFixed(2)} bol/sem</div>
                </div>
                <div className="px-5 py-3 flex items-center gap-3">
                  <span>🐭</span>
                  <div>
                    <div style={{ color: '#40c4ff' }}>Ratones (3 grupos)</div>
                    <div style={{ color: '#3d5068' }}>{totales.contRatones?.totalJaulas ?? 0} jaulas · {totales.unidRatones.toFixed(1)} unid.</div>
                  </div>
                  <div className="ml-auto font-bold text-white">{(totales.unidRatones * tasa).toFixed(2)} bol/sem</div>
                </div>
              </div>

              {/* Confianza del modelo */}
              {censos.length > 0 && (
                <div className="px-5 py-3 flex items-center gap-3 text-xs font-mono"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <CheckCircle size={12} style={{ color: colorConfianza(confianzaModelo.pct), flexShrink: 0 }} />
                  <span style={{ color: '#4a5f7a' }}>Confianza del modelo:</span>
                  <span className="font-bold" style={{ color: colorConfianza(confianzaModelo.pct) }}>
                    {confianzaModelo.pct}%
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden mx-1" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${confianzaModelo.pct}%`, background: colorConfianza(confianzaModelo.pct) }} />
                  </div>
                  {confianzaModelo.total > 0 ? (
                    <span style={{ color: '#3d5068' }}>
                      {confianzaModelo.confirmados}/{confianzaModelo.total} cambios confirmados
                    </span>
                  ) : (
                    <span style={{ color: '#3d5068' }}>Confirmá cambios de cama para mejorar</span>
                  )}
                </div>
              )}
            </div>

            {/* ── Ciclo de cambios de cama ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,179,0,0.25)' }}>
              <div className="px-6 py-3 flex items-center gap-2"
                style={{ borderBottom: '1px solid rgba(255,179,0,0.12)', background: 'rgba(255,179,0,0.04)' }}>
                <Calendar size={14} style={{ color: '#ffb300' }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#ffb300' }}>
                  Ciclo de cambios de cama
                </span>
                <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}>
                  Lunes · Viernes · 08:00
                </span>
              </div>

              <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

                {/* Próximo cambio desde hoy */}
                <div className="px-5 py-5 text-center flex flex-col items-center gap-1">
                  <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4a5f7a' }}>Próximo cambio estimado</div>
                  {proximoCambioHoy ? (
                    <>
                      <div className="text-2xl font-bold font-mono text-white leading-none">{proximoCambioHoy.dia}</div>
                      <div className="text-sm font-mono mt-0.5" style={{ color: '#ffb300' }}>
                        {proximoCambioHoy.fecha} · 08:00
                      </div>
                      <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
                        en {proximoCambioHoy.diasRestantes < 1
                          ? `${Math.round(proximoCambioHoy.diasRestantes * 24)} hs`
                          : `${proximoCambioHoy.diasRestantes.toFixed(1)} días`}
                      </div>
                    </>
                  ) : <div className="text-sm font-mono" style={{ color: '#3d5068' }}>—</div>}
                </div>

                {/* Contexto del último censo */}
                <div className="px-5 py-5 text-center flex flex-col items-center gap-1">
                  <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4a5f7a' }}>Último censo · posición en ciclo</div>
                  {ultimoCenso ? (() => {
                    const ctx  = contextoCiclo(ultimoCenso.fecha, ultimoCenso.hora)
                    const prob = probCambioReciente(ultimoCenso.fecha, ultimoCenso.hora)
                    const probPct = Math.round(prob * 100)
                    const cc = ultimoCenso.cambioCama
                    return (
                      <>
                        <div className="text-lg font-bold font-mono text-white leading-none">
                          {DIAS_SEMANA[diaLocal(ultimoCenso.fecha)]}
                        </div>
                        <div className="text-sm font-mono flex items-center gap-1.5" style={{ color: '#4a5f7a' }}>
                          <Clock size={11} />
                          {ultimoCenso.hora ?? '—'}
                        </div>
                        {/* Badge: confirmado o inferido */}
                        {cc?.tipo ? (
                          <div className="text-xs font-mono mt-1 px-2 py-0.5 rounded-full"
                            style={{
                              background: cc.tipo === 'si' ? 'rgba(0,230,118,0.1)' : cc.tipo === 'no' ? 'rgba(255,255,255,0.06)' : 'rgba(64,196,255,0.1)',
                              color:      cc.tipo === 'si' ? '#00e676'              : cc.tipo === 'no' ? '#4a5f7a'                : '#40c4ff',
                              border: `1px solid ${cc.tipo === 'si' ? 'rgba(0,230,118,0.25)' : cc.tipo === 'no' ? 'rgba(255,255,255,0.1)' : 'rgba(64,196,255,0.25)'}`,
                            }}>
                            {cc.tipo === 'si' ? '✅ Cambio confirmado'
                             : cc.tipo === 'no' ? '— Sin cambio (confirmado)'
                             : `⚡ Parcial${cc.bioteriosAfectados?.length ? `: ${cc.bioteriosAfectados.map(labelCorto).join(', ')}` : ''}`}
                          </div>
                        ) : (
                          <div className="text-xs font-mono mt-1 px-2 py-0.5 rounded-full"
                            style={{ background: `${ctx.color}15`, color: ctx.color, border: `1px solid ${ctx.color}30` }}>
                            {ctx.label}
                          </div>
                        )}
                        {/* Barra de probabilidad (solo si no confirmado) */}
                        {!cc?.tipo && (
                          <div className="w-full mt-2 px-3">
                            <div className="flex justify-between text-xs font-mono mb-1" style={{ color: '#3d5068' }}>
                              <span>Prob. cambio reciente</span>
                              <span style={{ color: probPct >= 55 ? '#ffb300' : '#4a5f7a' }}>{probPct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${probPct}%`,
                                  background: probPct >= 70 ? '#ffb300' : probPct >= 45 ? '#ff9800' : '#00e676',
                                }} />
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })() : (
                    <div className="text-sm font-mono" style={{ color: '#3d5068' }}>Sin censos registrados</div>
                  )}
                </div>
              </div>

              {/* Botón de confirmación pendiente */}
              {pendienteConfirmacion && ultimoCenso && (
                <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
                  style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.25)' }}>
                  <Calendar size={14} style={{ color: '#ffb300', flexShrink: 0 }} />
                  <div className="flex-1 text-xs font-mono" style={{ color: '#ffb300' }}>
                    El último censo fue tomado el <strong>{DIAS_SEMANA[diaLocal(ultimoCenso.fecha)]}</strong>.
                    Confirmá si se realizó el cambio de cama para mejorar la precisión del modelo.
                  </div>
                  <button onClick={() => abrirConfirmar(ultimoCenso)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold shrink-0"
                    style={{ background: 'rgba(255,179,0,0.14)', border: '1px solid rgba(255,179,0,0.4)', color: '#ffb300' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,179,0,0.22)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,179,0,0.14)' }}>
                    <CheckCircle size={12} /> Confirmar cambio de cama
                  </button>
                </div>
              )}

              {/* Banner aviso cambio reciente sin corregir */}
              {avisoRelleno && !avisoRelleno.confirmado && (
                <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-start gap-3 text-xs font-mono"
                  style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.3)', color: '#ffb300' }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    El último censo fue tomado el <strong>{avisoRelleno.dia}</strong> con{' '}
                    <strong>{Math.round(avisoRelleno.prob * 100)}%</strong> de probabilidad de cambio de cama ese día.
                    El stock observado puede estar por debajo del nivel promedio semanal.
                    Para calibrar mejor, tomá un censo un día neutro (Martes o Miércoles).
                  </span>
                </div>
              )}
              {avisoRelleno?.confirmado === 'si' && (
                <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-mono"
                  style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
                  <CheckCircle size={14} className="shrink-0" />
                  <span>Cambio de cama confirmado en este censo — el modelo usa este dato con mayor peso en la calibración.</span>
                </div>
              )}
              {avisoRelleno?.confirmado === 'parcial' && (
                <div className="mx-4 mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-mono"
                  style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)', color: '#40c4ff' }}>
                  <CheckCircle size={14} className="shrink-0" />
                  <span>
                    Cambio parcial confirmado
                    {ultimoCenso?.cambioCama?.bioteriosAfectados?.length
                      ? `: ${ultimoCenso.cambioCama.bioteriosAfectados.map(labelCorto).join(', ')}`
                      : ''}.
                  </span>
                </div>
              )}
            </div>

            {/* ── Movimientos de stock ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.04)' }}>
                <ClipboardList size={18} style={{ color: '#a78bfa' }} />
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">Movimientos de stock</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    Censos → conteos reales · Compras → ingresos de mercadería
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold"
                    style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.12)' }}>
                    <Plus size={12} /> Registrar censo
                  </button>
                  <button onClick={() => setModalCompra(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold"
                    style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,230,118,0.1)' }}>
                    <ShoppingCart size={12} /> Registrar compra
                  </button>
                </div>
              </div>

              {/* Instrucción */}
              <div className="px-6 pt-4 pb-2">
                <div className="rounded-xl px-4 py-3 text-xs font-mono"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5f7a' }}>
                  <span style={{ color: '#a78bfa' }}>📊 Censo</span>: conteo real de bolsas disponibles (fuente del cálculo de consumo)&nbsp;·&nbsp;
                  <span style={{ color: '#00e676' }}>📦 Compra</span>: bolsas que ingresaron al stock (no alteran el cálculo de consumo histórico)
                </div>
              </div>

              {movimientos.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="text-3xl mb-3">🪵</div>
                  <div className="text-sm font-semibold text-white mb-1">Sin registros</div>
                  <div className="text-xs font-mono" style={{ color: '#3d5068' }}>
                    Registrá un censo para empezar.<br />
                    Si compraste viruta, registrá la compra por separado.
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 space-y-1.5 max-h-80 overflow-y-auto">
                  {movimientos.map((item, idx) => {
                    const esUltimo = idx === 0
                    if (item.tipo === 'compra') {
                      return (
                        <div key={item.id}
                          className="rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"
                          style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)' }}>
                          <span className="text-xs font-mono" style={{ color: '#00e676' }}>📦 Compra</span>
                          <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                            {formatFecha(item.fecha)}
                          </span>
                          <span className="text-sm font-bold font-mono" style={{ color: '#00e676' }}>
                            +{item.bolsas} bolsas
                          </span>
                          <button onClick={() => eliminarCompraItem(item.id)}
                            className="ml-auto text-xs" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                        </div>
                      )
                    }
                    // tipo === 'censo'
                    const consumo = consumoPorCenso(item)
                    const cc = item.cambioCama
                    const necesitaConfirmar = !cc?.tipo && esDiaDeCambio(item.fecha)
                    return (
                      <div key={item.id}
                        className="rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"
                        style={{
                          background: esUltimo ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${esUltimo ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)'}`,
                        }}>
                        {esUltimo && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                            actual
                          </span>
                        )}
                        <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>📊 Censo</span>
                        <span className="text-xs font-mono" style={{ color: '#5a7a9a' }}>
                          {formatFecha(item.fecha)}
                        </span>
                        {item.hora && (
                          <span className="text-xs font-mono flex items-center gap-0.5" style={{ color: '#3d5068' }}>
                            <Clock size={10} /> {item.hora}
                          </span>
                        )}
                        {/* Badge cambio de cama: confirmado o inferido */}
                        {cc?.tipo === 'si' && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}>
                            ✅ Cambio confirmado
                          </span>
                        )}
                        {cc?.tipo === 'no' && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}>
                            — Sin cambio
                          </span>
                        )}
                        {cc?.tipo === 'parcial' && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.25)', color: '#40c4ff' }}>
                            ⚡ Parcial{cc.bioteriosAfectados?.length ? `: ${cc.bioteriosAfectados.map(labelCorto).join(', ')}` : ''}
                          </span>
                        )}
                        {!cc?.tipo && (() => {
                          const prob = probCambioReciente(item.fecha, item.hora)
                          if (prob < 0.45) return null
                          const ctx = contextoCiclo(item.fecha, item.hora)
                          return (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.22)', color: '#ffb300' }}>
                              🔄 Probable cambio
                            </span>
                          )
                        })()}
                        <span className="text-sm font-bold font-mono text-white">{item.bolsas} bolsas</span>
                        {consumo && (
                          <span className="text-xs font-mono" style={{ color: '#ffb300' }}>
                            −{consumo.consumido} consumidas
                            {consumo.porSem && <span style={{ color: '#4a5f7a' }}> ({consumo.porSem} bol/sem)</span>}
                          </span>
                        )}
                        <span className="font-mono text-xs" style={{ color: '#2a3a50' }}>
                          {item.unidades?.toFixed(1)} unid.
                        </span>
                        {/* Botón confirmar cambio (censos en día de cambio sin confirmar) */}
                        {necesitaConfirmar && (
                          <button onClick={() => abrirConfirmar(item)}
                            className="text-xs font-mono px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: '#ffb300' }}
                            title="Confirmar si se realizó el cambio de cama">
                            Confirmar ✓
                          </button>
                        )}
                        <button onClick={() => eliminarCenso(item.id)}
                          className="text-xs ml-auto" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Gráficos ── */}
            {datosStock.length >= 2 && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="font-bold text-xs text-white">Evolución del stock (censos)</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>bolsas disponibles por fecha de censo</div>
                  </div>
                  <div style={{ height: 190, width: '100%', minWidth: 0 }}>
                    <ResponsiveContainer width="99%" height={190}>
                      <AreaChart data={datosStock}>
                        <defs>
                          <linearGradient id="virutaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="f" tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip contentStyle={{ background: '#0d1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                          labelStyle={{ color: '#c9d4e0' }} formatter={v => [`${v} bolsas`, 'Censo']} />
                        <Area type="monotone" dataKey="bolsas" stroke="#a78bfa" strokeWidth={2} fill="url(#virutaGrad)" dot={{ fill: '#a78bfa', r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {datosConsumo.length >= 1 && (
                  <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="font-bold text-xs text-white">Consumo real vs. estimado</div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>bolsas entre censos consecutivos</div>
                    </div>
                    <div style={{ height: 190, width: '100%', minWidth: 0 }}>
                      <ResponsiveContainer width="99%" height={190}>
                        <BarChart data={datosConsumo} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="f" tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip contentStyle={{ background: '#0d1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                            labelStyle={{ color: '#c9d4e0' }}
                            formatter={(v, n) => [`${v} bolsas`, n === 'real' ? 'Real consumido' : 'Estimado']} />
                          <Bar dataKey="real"     fill="rgba(167,139,250,0.6)" radius={[3,3,0,0]} name="real" />
                          <Bar dataKey="estimado" fill="rgba(180,130,80,0.3)"  radius={[3,3,0,0]} name="estimado" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Detalle por tipo de jaula ── */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
                <Layers size={12} style={{ display: 'inline', marginRight: 6 }} />
                Jaulas activas por tipo
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {totales.contRatas && (
                  <TarjetaJaulas label="Bioterio de Ratas" icon="🐀" color="#00e676" unidades={totales.unidRatas} filas={[
                    { tipo: 'Jaula de macho reproductor',    n: totales.contRatas.machos,       peso: PESOS.macho_repro,     color: '#40c4ff' },
                    { tipo: 'Jaula chica (hembra + camada)', n: totales.contRatas.lactantes,    peso: PESOS.hembra_lactante, color: '#ce93d8' },
                    { tipo: 'Jaula grande (hembra repro.)',  n: totales.contRatas.hembrasRepro, peso: PESOS.hembra_repro,    color: '#ce93d8' },
                    { tipo: 'Jaula grande (stock adultos)',  n: totales.contRatas.jAdultos,     peso: PESOS.stock_adultos,   color: '#ff6b80' },
                    { tipo: 'Jaula mediana (stock jóvenes)',n: totales.contRatas.jJovenes,     peso: PESOS.stock_jovenes,   color: '#ffb300' },
                    { tipo: 'Jaula chica (stock crías)',     n: totales.contRatas.jCrias,       peso: PESOS.stock_crias,     color: '#00e676' },
                  ]} />
                )}
                {totales.contRatones && (
                  <TarjetaJaulas label="Ratones (Balb/C · C57 · Híbridos)" icon="🐭" color="#40c4ff" unidades={totales.unidRatones}
                    nota="Jaula estándar única para todos los grupos" filas={[
                    { tipo: 'Jaula estándar (machos repro.)',   n: totales.contRatones.machos,       peso: PESOS.raton_std, color: '#40c4ff' },
                    { tipo: 'Jaula estándar (hembra + camada)',n: totales.contRatones.lactantes,    peso: PESOS.raton_std, color: '#ce93d8' },
                    { tipo: 'Jaula estándar (hembra repro.)',   n: totales.contRatones.hembrasRepro, peso: PESOS.raton_std, color: '#ce93d8' },
                    { tipo: 'Jaula estándar (stock adultos)',   n: totales.contRatones.jAdultos,     peso: PESOS.raton_std, color: '#ff6b80' },
                    { tipo: 'Jaula estándar (stock jóvenes)',   n: totales.contRatones.jJovenes,     peso: PESOS.raton_std, color: '#ffb300' },
                    { tipo: 'Jaula estándar (stock crías)',     n: totales.contRatones.jCrias,       peso: PESOS.raton_std, color: '#00e676' },
                  ]} />
                )}
              </div>
            </div>

            {/* ── Cómo funciona ── */}
            <div className="rounded-xl px-5 py-4 space-y-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#6a8099' }}>
                <Info size={12} /> Cómo funciona el sistema adaptativo
              </div>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono" style={{ color: '#4a5f7a' }}>
                <div className="space-y-1">
                  <div className="font-semibold" style={{ color: '#5a7a9a' }}>Pesos por tipo de jaula</div>
                  <div>Jaula macho reproductor  ×{PESOS.macho_repro}</div>
                  <div>Jaula grande (hembra repro.)  ×{PESOS.hembra_repro}</div>
                  <div>Jaula chica (hembra + camada) ×{PESOS.hembra_lactante}</div>
                  <div>Jaula grande (stock adultos)  ×{PESOS.stock_adultos}</div>
                  <div>Jaula mediana (stock jóvenes) ×{PESOS.stock_jovenes}</div>
                  <div>Jaula chica (stock crías)     ×{PESOS.stock_crias}</div>
                  <div>Jaula estándar ratón          ×{PESOS.raton_std}</div>
                  <div>Cambios de cama por semana    {CAMBIOS_SEM}×</div>
                </div>
                <div className="space-y-2" style={{ color: '#3d5068' }}>
                  <div className="font-semibold" style={{ color: '#5a7a9a' }}>Calibración ponderada</div>
                  <div>consumido = censo_anterior + compras_del_período − censo_actual</div>
                  <div>bolsas/sem = consumido ÷ semanas_entre_censos</div>
                  <div>tasa = bolsas/sem ÷ unidades_ponderadas</div>
                  <div className="pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    Períodos con cambios confirmados tienen mayor peso (×1.5 ambos / ×1.0 uno / ×0.6 ninguno).
                  </div>
                  {calibrado && (
                    <div style={{ color: '#00e676' }}>
                      Tasa aprendida: {tasa.toFixed(4)} bol/unid/sem (promedio ponderado de {calibracion.periodos} períodos)
                    </div>
                  )}
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      {/* Modal censo */}
      {modal && (
        <ModalCenso
          esPrimero={censos.length === 0}
          onConfirmar={registrarCenso}
          onCerrar={() => setModal(false)}
        />
      )}

      {/* Modal compra */}
      {modalCompra && (
        <ModalCompra
          stockActual={stockActual}
          onConfirmar={registrarCompra}
          onCerrar={() => setModalCompra(false)}
        />
      )}

      {/* Modal confirmar cambio de cama */}
      {modalConfirmar && censoAConfirmar && (
        <ModalConfirmarCambio
          censo={censoAConfirmar}
          onConfirmar={confirmarCambioCama}
          onCerrar={() => { setModalConfirmar(false); setCensoAConfirmar(null) }}
        />
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function TarjetaJaulas({ label, icon, color, unidades, filas, nota }) {
  const total = filas.reduce((s, f) => s + f.n, 0)
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.6)', border: `1px solid ${color}20` }}>
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: `1px solid ${color}12`, background: `${color}07` }}>
        <span>{icon}</span>
        <div className="flex-1">
          <div className="font-bold text-sm text-white">{label}</div>
          {nota && <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{nota}</div>}
        </div>
        <div className="text-right">
          <div className="font-bold font-mono text-sm" style={{ color }}>{total} jaulas</div>
          <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{unidades.toFixed(1)} unid./sem.</div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {filas.map(({ tipo, n, peso, color: c }) => n > 0 ? (
          <div key={tipo} className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
            <span className="flex-1 font-mono" style={{ color: '#8a9bb0' }}>{tipo}</span>
            <span className="font-mono font-semibold text-white">{n}</span>
            <span className="font-mono" style={{ color: '#3d5068' }}>×{peso}×{CAMBIOS_SEM}</span>
            <span className="font-mono w-10 text-right" style={{ color: '#4a5f7a' }}>={+(n * peso * CAMBIOS_SEM).toFixed(1)}</span>
          </div>
        ) : null)}
        {filas.every(f => f.n === 0) && (
          <div className="text-xs font-mono" style={{ color: '#2a3a50' }}>Sin jaulas activas</div>
        )}
      </div>
    </div>
  )
}

// ── Modal: Registrar censo ────────────────────────────────────────────────────

function ModalCenso({ esPrimero, onConfirmar, onCerrar }) {
  const [fecha,       setFecha]       = useState(hoy())
  const [hora,        setHora]        = useState(horaActual())
  const [bolsas,      setBolsas]      = useState('')
  const [error,       setError]       = useState('')
  const [cambioCama,  setCambioCama]  = useState(null)   // 'si' | 'no' | 'parcial' | null
  const [bioAfect,    setBioAfect]    = useState([])     // para 'parcial'

  const FRACCIONES = [0, 0.25, 0.5, 0.75]
  const esLunesOViernes = esDiaDeCambio(fecha)

  function toggleBio(id) {
    setBioAfect(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  function confirmar(e) {
    e.preventDefault()
    const b = parseFloat(bolsas)
    if (isNaN(b) || b < 0) { setError('Ingresá una cantidad válida de bolsas.'); return }
    if (Math.round(b * 4) !== b * 4) { setError('Solo se permiten enteros, medias y cuartos de bolsa (0.25).'); return }
    const cc = cambioCama ? { tipo: cambioCama, bioteriosAfectados: cambioCama === 'parcial' ? bioAfect : [] } : null
    onConfirmar(fecha, hora, b, cc)
  }

  function aplicarFraccion(base, fraccion) {
    const entero = Math.floor(parseFloat(base) || 0)
    setBolsas((entero + fraccion).toString())
    setError('')
  }

  const preview   = isNaN(parseFloat(bolsas)) ? null : parseFloat(bolsas)
  const prob      = probCambioReciente(fecha, hora)
  const probPct   = Math.round(prob * 100)
  const proxCamb  = proximoCambioDesde(fecha, hora)

  const bannerCiclo = (() => {
    if (cambioCama === 'si') return {
      color: '#00e676', bg: 'rgba(0,230,118,0.08)', border: 'rgba(0,230,118,0.3)',
      texto: '✅ Cambio confirmado — el modelo usará este dato con mayor peso en la calibración.',
    }
    if (cambioCama === 'no') return {
      color: '#4a5f7a', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
      texto: '— Sin cambio de cama — el stock refleja solo el consumo diario.',
    }
    if (cambioCama === 'parcial') return {
      color: '#40c4ff', bg: 'rgba(64,196,255,0.06)', border: 'rgba(64,196,255,0.25)',
      texto: `⚡ Cambio parcial${bioAfect.length ? ` en: ${bioAfect.map(labelCorto).join(', ')}` : ' — seleccioná los bioterios abajo'}.`,
    }
    if (probPct >= 70) return {
      color: '#ffb300', bg: 'rgba(255,179,0,0.08)', border: 'rgba(255,179,0,0.3)',
      texto: `🔄 Probable cambio de cama realizado (${probPct}%) — el stock refleja la situación post-cambio.`,
    }
    if (probPct >= 45) return {
      color: '#ff9800', bg: 'rgba(255,152,0,0.06)', border: 'rgba(255,152,0,0.25)',
      texto: `⚠ Posible cambio en proceso (${probPct}%) — el stock podría estar variando.`,
    }
    if (esLunesOViernes && parseInt(hora.split(':')[0]) < 9) return {
      color: '#4a5f7a', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
      texto: `📅 Antes del cambio de cama de hoy — el stock aún no fue afectado.`,
    }
    return {
      color: '#00e676', bg: 'rgba(0,230,118,0.05)', border: 'rgba(0,230,118,0.2)',
      texto: `✓ Momento neutro del ciclo (${probPct}% prob.) — buen momento para censar.`,
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 0 60px rgba(167,139,250,0.12)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.05)' }}>
          <div className="font-bold text-white text-sm">📊 Registrar censo de viruta</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            {esPrimero
              ? 'Primer censo — ¿cuántas bolsas tenés disponibles hoy?'
              : 'Conteo real de bolsas disponibles ahora mismo'}
          </div>
        </div>
        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setCambioCama(null); setBioAfect([]) }} required
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
                <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                Hora
              </label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }} />
            </div>
          </div>

          {/* Confirmación cambio de cama (solo Lunes y Viernes) */}
          {esLunesOViernes && (
            <div className="rounded-xl p-3 space-y-2.5"
              style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.2)' }}>
              <div className="text-xs font-semibold" style={{ color: '#ffb300' }}>
                🔄 Hoy es {DIAS_SEMANA[diaLocal(fecha)]} — día de cambio de cama
              </div>
              <div className="text-xs font-mono mb-1" style={{ color: '#6a8099' }}>¿Se realizó el cambio?</div>
              <div className="flex gap-2">
                {[
                  { tipo: 'si',      label: '✅ Sí',      activeColor: '#00e676', activeBg: 'rgba(0,230,118,0.14)' },
                  { tipo: 'no',      label: '❌ No',      activeColor: '#ff6b80', activeBg: 'rgba(255,107,128,0.1)' },
                  { tipo: 'parcial', label: '⚡ Parcial', activeColor: '#40c4ff', activeBg: 'rgba(64,196,255,0.12)' },
                ].map(({ tipo, label, activeColor, activeBg }) => (
                  <button key={tipo} type="button"
                    onClick={() => { setCambioCama(prev => prev === tipo ? null : tipo); if (tipo !== 'parcial') setBioAfect([]) }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all"
                    style={{
                      background: cambioCama === tipo ? activeBg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${cambioCama === tipo ? activeColor + '55' : 'rgba(255,255,255,0.1)'}`,
                      color: cambioCama === tipo ? activeColor : '#4a5f7a',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Selector de bioterios para parcial */}
              {cambioCama === 'parcial' && (
                <div className="space-y-1 pt-1">
                  <div className="text-xs font-mono mb-1.5" style={{ color: '#4a5f7a' }}>Bioterios con cambio:</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {TODOS.map(({ id, label, icon }) => (
                      <label key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer"
                        style={{
                          background: bioAfect.includes(id) ? 'rgba(64,196,255,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${bioAfect.includes(id) ? 'rgba(64,196,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        <input type="checkbox" checked={bioAfect.includes(id)} onChange={() => toggleBio(id)}
                          style={{ accentColor: '#40c4ff' }} />
                        <span className="text-xs font-mono" style={{ color: bioAfect.includes(id) ? '#40c4ff' : '#4a5f7a' }}>
                          {icon} {labelCorto(id)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Banner reactivo de ciclo */}
          <div className="rounded-xl px-3 py-2.5 text-xs font-mono"
            style={{ background: bannerCiclo.bg, border: `1px solid ${bannerCiclo.border}`, color: bannerCiclo.color }}>
            {bannerCiclo.texto}
            {!cambioCama && (
              <div className="mt-2">
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${probPct}%`,
                      background: probPct >= 70 ? '#ffb300' : probPct >= 45 ? '#ff9800' : '#00e676',
                    }} />
                </div>
              </div>
            )}
          </div>

          {/* Próximo cambio */}
          {proxCamb && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-3 text-xs font-mono"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', color: '#4a5f7a' }}>
              <Calendar size={12} style={{ color: '#ffb300' }} />
              <div>
                <span style={{ color: '#6a8099' }}>Próximo cambio de cama: </span>
                <span className="font-bold" style={{ color: '#ffb300' }}>{proxCamb.dia} {proxCamb.fecha} · 08:00</span>
                <span style={{ color: '#3d5068' }}>
                  {' '}(en {proxCamb.diasRestantes < 1
                    ? `${Math.round(proxCamb.diasRestantes * 24)} hs`
                    : `${proxCamb.diasRestantes.toFixed(1)} días`})
                </span>
              </div>
            </div>
          )}

          {/* Bolsas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
              Bolsas disponibles ahora
            </label>
            <input type="number" min="0" step="0.25" value={bolsas}
              onChange={e => { setBolsas(e.target.value); setError('') }}
              placeholder="Ej: 20.25" required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: `1px solid ${error ? 'rgba(255,61,87,0.5)' : 'rgba(30,51,82,0.9)'}`, color: '#c9d4e0', outline: 'none' }} />
            <div className="flex gap-2 mt-2">
              <span className="text-xs font-mono self-center" style={{ color: '#3d5068' }}>Fracción:</span>
              {FRACCIONES.map(f => (
                <button key={f} type="button" onClick={() => aplicarFraccion(bolsas, f)}
                  className="px-2 py-1 rounded-lg text-xs font-mono"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>
                  {f === 0 ? 'Entera' : f === 0.25 ? '¼' : f === 0.5 ? '½' : '¾'}
                </button>
              ))}
            </div>
            {preview !== null && (
              <div className="mt-2 text-xs font-mono" style={{ color: '#5a7a9a' }}>→ {preview} bolsas</div>
            )}
            {error && <div className="mt-1.5 text-xs font-mono" style={{ color: '#ff6b80' }}>⚠ {error}</div>}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(167,139,250,0.14)', border: '1.5px solid rgba(167,139,250,0.45)', color: '#a78bfa' }}>
              Guardar censo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal: Confirmar cambio de cama ───────────────────────────────────────────

function ModalConfirmarCambio({ censo, onConfirmar, onCerrar }) {
  const [tipo,     setTipo]     = useState(censo.cambioCama?.tipo ?? null)
  const [bioAfect, setBioAfect] = useState(censo.cambioCama?.bioteriosAfectados ?? [])

  function toggleBio(id) {
    setBioAfect(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])
  }

  function confirmar() {
    if (!tipo) return
    onConfirmar(censo.id, { tipo, bioteriosAfectados: tipo === 'parcial' ? bioAfect : [] })
  }

  const diaStr = DIAS_SEMANA[diaLocal(censo.fecha)]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(255,179,0,0.3)', boxShadow: '0 0 60px rgba(255,179,0,0.08)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,179,0,0.12)', background: 'rgba(255,179,0,0.04)' }}>
          <div className="font-bold text-white text-sm">🔄 Confirmar cambio de cama</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Censo del {diaStr} {formatFecha(censo.fecha, { day: '2-digit', month: '2-digit' })}
            {censo.hora ? ` · ${censo.hora}` : ''}
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">

          <div className="text-xs font-mono" style={{ color: '#6a8099' }}>
            ¿Se realizó el cambio de cama ese día?
          </div>

          <div className="flex gap-2">
            {[
              { t: 'si',      label: '✅ Sí, completo',  activeColor: '#00e676', activeBg: 'rgba(0,230,118,0.14)' },
              { t: 'no',      label: '❌ No',             activeColor: '#ff6b80', activeBg: 'rgba(255,107,128,0.1)' },
              { t: 'parcial', label: '⚡ Parcial',        activeColor: '#40c4ff', activeBg: 'rgba(64,196,255,0.12)' },
            ].map(({ t, label, activeColor, activeBg }) => (
              <button key={t} type="button"
                onClick={() => { setTipo(prev => prev === t ? null : t); if (t !== 'parcial') setBioAfect([]) }}
                className="flex-1 py-2 rounded-xl text-xs font-mono font-semibold transition-all"
                style={{
                  background: tipo === t ? activeBg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${tipo === t ? activeColor + '55' : 'rgba(255,255,255,0.1)'}`,
                  color: tipo === t ? activeColor : '#4a5f7a',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Selector de bioterios para parcial */}
          {tipo === 'parcial' && (
            <div className="space-y-1.5">
              <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Bioterios con cambio:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {TODOS.map(({ id, label, icon }) => (
                  <label key={id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={{
                      background: bioAfect.includes(id) ? 'rgba(64,196,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${bioAfect.includes(id) ? 'rgba(64,196,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    }}>
                    <input type="checkbox" checked={bioAfect.includes(id)} onChange={() => toggleBio(id)}
                      style={{ accentColor: '#40c4ff' }} />
                    <span className="text-xs font-mono" style={{ color: bioAfect.includes(id) ? '#40c4ff' : '#4a5f7a' }}>
                      {icon} {labelCorto(id)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Descripción del efecto */}
          {tipo && (
            <div className="rounded-xl px-3 py-2.5 text-xs font-mono"
              style={{
                background: tipo === 'si' ? 'rgba(0,230,118,0.06)' : tipo === 'no' ? 'rgba(255,255,255,0.03)' : 'rgba(64,196,255,0.06)',
                border: `1px solid ${tipo === 'si' ? 'rgba(0,230,118,0.2)' : tipo === 'no' ? 'rgba(255,255,255,0.08)' : 'rgba(64,196,255,0.2)'}`,
                color: tipo === 'si' ? '#00e676' : tipo === 'no' ? '#4a5f7a' : '#40c4ff',
              }}>
              {tipo === 'si' && 'El período tiene cambio confirmado — mayor peso (×1.5) en la calibración del modelo.'}
              {tipo === 'no' && 'Sin cambio confirmado — el stock refleja solo consumo diario. Mayor peso en calibración.'}
              {tipo === 'parcial' && `Cambio parcial${bioAfect.length ? ` en ${bioAfect.map(labelCorto).join(', ')}` : ''}. Peso intermedio en calibración.`}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}>
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={!tipo}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: tipo ? 'rgba(255,179,0,0.14)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${tipo ? 'rgba(255,179,0,0.45)' : 'rgba(255,255,255,0.1)'}`,
                color: tipo ? '#ffb300' : '#3d5068',
                cursor: tipo ? 'pointer' : 'not-allowed',
              }}>
              <CheckCircle size={13} style={{ display: 'inline', marginRight: 6 }} />
              Guardar confirmación
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Registrar compra ───────────────────────────────────────────────────

function ModalCompra({ stockActual, onConfirmar, onCerrar }) {
  const [fecha,  setFecha]  = useState(hoy())
  const [bolsas, setBolsas] = useState('')
  const [error,  setError]  = useState('')

  const FRACCIONES = [0, 0.25, 0.5, 0.75]

  function aplicarFraccion(base, fraccion) {
    const entero = Math.floor(parseFloat(base) || 0)
    setBolsas((entero + fraccion).toString())
    setError('')
  }

  function confirmar(e) {
    e.preventDefault()
    const b = parseFloat(bolsas)
    if (isNaN(b) || b <= 0) { setError('Ingresá una cantidad válida mayor a 0.'); return }
    if (Math.round(b * 4) !== b * 4) { setError('Solo se permiten enteros, medias y cuartos de bolsa (0.25).'); return }
    onConfirmar(fecha, b)
  }

  const bolsasNum  = parseFloat(bolsas)
  const nuevoStock = stockActual !== null && !isNaN(bolsasNum) ? stockActual + bolsasNum : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(0,230,118,0.3)', boxShadow: '0 0 60px rgba(0,230,118,0.08)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(0,230,118,0.12)', background: 'rgba(0,230,118,0.04)' }}>
          <div className="font-bold text-white text-sm">📦 Registrar compra / ingreso de viruta</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Bolsas nuevas que ingresaron al stock — no altera el historial de consumo
          </div>
        </div>
        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha de ingreso</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
              Bolsas a agregar al stock
            </label>
            <input type="number" min="0.25" step="0.25" value={bolsas}
              onChange={e => { setBolsas(e.target.value); setError('') }}
              placeholder="Ej: 10" required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: `1px solid ${error ? 'rgba(255,61,87,0.5)' : 'rgba(30,51,82,0.9)'}`, color: '#c9d4e0', outline: 'none' }} />
            <div className="flex gap-2 mt-2">
              <span className="text-xs font-mono self-center" style={{ color: '#3d5068' }}>Fracción:</span>
              {FRACCIONES.map(f => (
                <button key={f} type="button" onClick={() => aplicarFraccion(bolsas, f)}
                  className="px-2 py-1 rounded-lg text-xs font-mono"
                  style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
                  {f === 0 ? 'Entera' : f === 0.25 ? '¼' : f === 0.5 ? '½' : '¾'}
                </button>
              ))}
            </div>
            {error && <div className="mt-1.5 text-xs font-mono" style={{ color: '#ff6b80' }}>⚠ {error}</div>}
          </div>

          {nuevoStock !== null && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono"
              style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <div style={{ color: '#4a5f7a' }}>Stock actual: <span className="text-white">{stockActual} bolsas</span></div>
              <div style={{ color: '#4a5f7a' }}>+ Compra: <span style={{ color: '#00e676' }}>+{bolsasNum} bolsas</span></div>
              <div className="mt-1 font-bold" style={{ color: '#00e676' }}>Nuevo stock: {nuevoStock} bolsas</div>
            </div>
          )}
          {stockActual === null && !isNaN(bolsasNum) && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono"
              style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}>
              ⚠ Sin censos registrados. Registrá un censo después para calcular el consumo correctamente.
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
              style={{ background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.4)', color: '#00e676' }}>
              Registrar compra
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
