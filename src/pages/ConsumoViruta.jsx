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
import { ArrowLeft, RefreshCw, Plus, ClipboardList, TrendingDown, Info, Layers, AlertTriangle, ShoppingCart } from 'lucide-react'

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

// ── localStorage ──────────────────────────────────────────────────────────────
// Censos: snapshot de stock actual  { id, fecha, bolsas, unidades }
// Compras: ingreso de mercadería    { id, fecha, bolsas }

const LS_CENSOS  = 'appMosca_viruta_censos'
const LS_COMPRAS = 'appMosca_viruta_compras'

function cargarCensos()   { try { return JSON.parse(localStorage.getItem(LS_CENSOS)  || '[]') } catch { return [] } }
function guardarCensos(l) { localStorage.setItem(LS_CENSOS,  JSON.stringify(l)) }
function cargarCompras()  { try { return JSON.parse(localStorage.getItem(LS_COMPRAS) || '[]') } catch { return [] } }
function guardarCompras(l){ localStorage.setItem(LS_COMPRAS, JSON.stringify(l)) }

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsumoViruta() {
  const { limpiarBioterio } = useBioterioActivo()

  const [datos,       setDatos]       = useState(null)
  const [cargando,    setCargando]    = useState(true)
  const [error,       setError]       = useState(null)
  const [censos,      setCensos]      = useState(() => cargarCensos())
  const [compras,     setCompras]     = useState(() => cargarCompras())
  const [modal,       setModal]       = useState(false)   // modal censo
  const [modalCompra, setModalCompra] = useState(false)   // modal compra

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const res = await Promise.all(
        TODOS.map(({ id }) => Promise.all([
          supabase.from('animales').select('*').eq('bioterio_id', id),
          supabase.from('camadas').select('*').eq('bioterio_id', id),
          supabase.from('jaulas').select('*').eq('bioterio_id', id),
          supabase.from('sacrificios').select('*').eq('bioterio_id', id),
          supabase.from('entregas').select('*').eq('bioterio_id', id),
        ]))
      )
      const nd = {}
      TODOS.forEach(({ id, especie, bio }, i) => {
        const [{ data: an }, { data: ca }, { data: ja }, { data: sa }, { data: en }] = res[i]
        const conteos  = contarJaulas(especie, bio, an ?? [], ca ?? [], ja ?? [], sa ?? [], en ?? [])
        const unidades = calcUnidades(conteos, especie)
        nd[id] = { conteos, unidades }
      })
      setDatos(nd)
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
  // Solo usa censos. Las compras entre dos censos se suman al stock inicial
  // para calcular el consumo real del período.
  const calibracion = useMemo(() => {
    if (censos.length < 2 || !totales) return null
    const tasas = []
    for (let i = 0; i < censos.length - 1; i++) {
      const prev = censos[i]
      const cur  = censos[i + 1]
      // Compras que ingresaron durante este período (>= prev.fecha y < cur.fecha)
      const comprasEnPeriodo = compras
        .filter(c => c.fecha >= prev.fecha && c.fecha < cur.fecha)
        .reduce((s, c) => s + c.bolsas, 0)
      const consumido = prev.bolsas + comprasEnPeriodo - cur.bolsas
      if (consumido <= 0) continue
      const sem  = difDias(parseDate(prev.fecha), parseDate(cur.fecha)) / 7
      if (sem  <= 0) continue
      const uAvg = ((prev.unidades ?? totales.totalUnidades) + (cur.unidades ?? totales.totalUnidades)) / 2
      if (uAvg <= 0) continue
      tasas.push(consumido / sem / uAvg)
    }
    if (tasas.length === 0) return null
    const tasa = tasas.reduce((s, t) => s + t, 0) / tasas.length
    return { tasa, periodos: tasas.length, tasas }
  }, [censos, compras, totales])

  const tasa      = calibracion?.tasa ?? TASA_DEFAULT
  const calibrado = !!calibracion

  const bolsasPorSem = totales ? totales.totalUnidades * tasa : 0

  const ultimoCenso = censos.length > 0 ? censos[censos.length - 1] : null

  // Stock actual = último censo + compras ingresadas desde ese censo
  const comprasPostCenso = ultimoCenso
    ? compras.filter(c => c.fecha >= ultimoCenso.fecha)
    : []
  const stockActual = ultimoCenso !== null
    ? ultimoCenso.bolsas + comprasPostCenso.reduce((s, c) => s + c.bolsas, 0)
    : null

  const duracionSem = (stockActual !== null && bolsasPorSem > 0)
    ? stockActual / bolsasPorSem : null

  // ── Alertas ───────────────────────────────────────────────────────────────
  const nivelAlerta = duracionSem === null ? null
    : duracionSem < 2 ? 'critico'
    : duracionSem < 4 ? 'bajo'
    : duracionSem < 8 ? 'ok'
    : 'bien'

  const colorAlerta = { critico: '#ff6b80', bajo: '#ffb300', ok: '#00e676', bien: '#00e676' }[nivelAlerta] ?? '#c49a6a'

  // ── CRUD ──────────────────────────────────────────────────────────────────
  function registrarCenso(fecha, bolsas) {
    const nuevo  = { id: generarId(), fecha, bolsas, unidades: totales?.totalUnidades ?? 0 }
    const nuevos = [...censos, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha))
    setCensos(nuevos); guardarCensos(nuevos); setModal(false)
  }

  function eliminarCenso(id) {
    const nuevos = censos.filter(c => c.id !== id)
    setCensos(nuevos); guardarCensos(nuevos)
  }

  function registrarCompra(fecha, bolsas) {
    const nueva  = { id: generarId(), fecha, bolsas }
    const nuevas = [...compras, nueva].sort((a, b) => a.fecha.localeCompare(b.fecha))
    setCompras(nuevas); guardarCompras(nuevas); setModalCompra(false)
  }

  function eliminarCompraItem(id) {
    const nuevas = compras.filter(c => c.id !== id)
    setCompras(nuevas); guardarCompras(nuevas)
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

  // ── Timeline unificada (censos + compras, más reciente primero) ───────────
  const movimientos = useMemo(() => {
    const items = [
      ...censos.map(c => ({ ...c, tipo: 'censo' })),
      ...compras.map(c => ({ ...c, tipo: 'compra' })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha) || (a.tipo === 'censo' ? -1 : 1))
    return items
  }, [censos, compras])

  // Para cada censo, calcular consumo desde el censo anterior
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050810' }}>

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
                        <span className="text-sm font-bold font-mono text-white">{item.bolsas} bolsas</span>
                        {consumo && (
                          <span className="text-xs font-mono" style={{ color: '#ffb300' }}>
                            −{consumo.consumido} consumidas
                            {consumo.porSem && <span style={{ color: '#4a5f7a' }}> ({consumo.porSem} bol/sem)</span>}
                          </span>
                        )}
                        <span className="ml-auto text-xs font-mono" style={{ color: '#2a3a50' }}>
                          {item.unidades?.toFixed(1)} unid.
                        </span>
                        <button onClick={() => eliminarCenso(item.id)}
                          className="text-xs" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
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
                  <div className="px-2 py-3" style={{ height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={datosStock}>
                        <defs>
                          <linearGradient id="virutaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="f" tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
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
                    <div className="px-2 py-3" style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosConsumo} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="f" tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
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
                  <div className="font-semibold" style={{ color: '#5a7a9a' }}>Cálculo de consumo real</div>
                  <div>consumido = censo_anterior + compras_del_período − censo_actual</div>
                  <div>bolsas/sem = consumido ÷ semanas_entre_censos</div>
                  <div>tasa = bolsas/sem ÷ unidades_ponderadas</div>
                  <div className="pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    Las compras no alteran el historial de consumo. Solo los censos son la fuente de aprendizaje.
                  </div>
                  {calibrado && (
                    <div style={{ color: '#00e676' }}>
                      Tasa aprendida: {tasa.toFixed(4)} bol/unid/sem (promedio de {calibracion.periodos} períodos)
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
    if (isNaN(b) || b < 0) { setError('Ingresá una cantidad válida de bolsas.'); return }
    if (Math.round(b * 4) !== b * 4) { setError('Solo se permiten enteros, medias y cuartos de bolsa (0.25).'); return }
    onConfirmar(fecha, b)
  }

  const preview = isNaN(parseFloat(bolsas)) ? null : parseFloat(bolsas)

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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha del censo</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }} />
          </div>
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

          {/* Preview del nuevo stock */}
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
