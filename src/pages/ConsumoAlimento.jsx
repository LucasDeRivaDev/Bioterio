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

// ── localStorage ──────────────────────────────────────────────────────────────
const LS_CENSOS   = 'appMosca_alimento_censos'
const LS_INGRESOS = 'appMosca_alimento_ingresos'

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

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsumoAlimento() {
  const { limpiarBioterio } = useBioterioActivo()

  const [datosBioterios, setDatosBioterios] = useState(null)
  const [cargando, setCargando]             = useState(true)
  const [error, setError]                   = useState(null)

  const [censos,   setCensos]   = useState(() => cargarLS(LS_CENSOS))
  const [ingresos, setIngresos] = useState(() => cargarLS(LS_INGRESOS))

  const [modalCenso,   setModalCenso]   = useState(false)
  const [modalIngreso, setModalIngreso] = useState(false)

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

  // ── Stock actual: último censo + ingresos posteriores ──
  const ingresosPostCenso = ultimoCenso
    ? ingresos.filter(i => i.fecha >= ultimoCenso.fecha)
    : []

  const stockActualKg = ultimoCenso !== null
    ? ultimoCenso.kg + ingresosPostCenso.reduce((s, i) => s + i.kg, 0)
    : null

  // ── Calibración adaptativa ──
  const calibracion = useMemo(() => {
    if (censosOrdenados.length < 2) return null
    const pares = []
    for (let i = 0; i < censosOrdenados.length - 1; i++) {
      const prev = censosOrdenados[i]
      const cur  = censosOrdenados[i + 1]
      const dias = difDias(parseDate(prev.fecha), parseDate(cur.fecha))
      if (dias <= 0) continue

      // Ingresos realizados entre este par de censos
      const ingresosEnPeriodo = ingresos
        .filter(c => c.fecha >= prev.fecha && c.fecha < cur.fecha)
        .reduce((s, c) => s + c.kg, 0)

      const consumidoG = (prev.kg + ingresosEnPeriodo - cur.kg) * 1000
      if (consumidoG <= 0) continue  // censo sin sentido (compras superan consumo)

      const realGDia = consumidoG / dias
      if (!prev.consumoEstimadoGDia || prev.consumoEstimadoGDia <= 0) continue

      pares.push({
        fechaInicio: prev.fecha,
        fechaFin: cur.fecha,
        dias,
        realGDia,
        estimadoGDia: prev.consumoEstimadoGDia,
        factor: realGDia / prev.consumoEstimadoGDia,
      })
    }
    if (pares.length === 0) return null
    const factorPromedio = pares.reduce((s, p) => s + p.factor, 0) / pares.length
    return { factor: factorPromedio, muestras: pares.length, pares }
  }, [censosOrdenados, ingresos])

  const consumoBase     = global?.mid ?? 0
  const consumoAjustado = global && calibracion
    ? global.mid * calibracion.factor
    : consumoBase

  // ── Predicción de duración basada en stock actual ──
  const diasEstimados = useMemo(() => {
    if (stockActualKg === null || stockActualKg <= 0 || consumoBase <= 0) return null
    const consumoFinal = calibracion ? consumoBase * calibracion.factor : consumoBase
    return Math.floor((stockActualKg * 1000) / consumoFinal)
  }, [stockActualKg, consumoBase, calibracion])

  const fechaAgotamiento = useMemo(() => {
    if (!diasEstimados) return null
    const d = new Date()
    d.setDate(d.getDate() + diasEstimados)
    return formatFecha(d)
  }, [diasEstimados])

  // ── Línea temporal de movimientos ──
  const movimientos = useMemo(() => {
    const items = [
      ...censos.map(c => ({ ...c, tipo: 'censo' })),
      ...ingresos.map(i => ({ ...i, tipo: 'ingreso' })),
    ]
    return items.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [censos, ingresos])

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
  function consumoPorCenso(censoActual, idx) {
    const prev = censosOrdenados[idx - 1]
    if (!prev) return null
    const dias = difDias(parseDate(prev.fecha), parseDate(censoActual.fecha))
    if (dias <= 0) return null
    const ingresosG = ingresos
      .filter(c => c.fecha >= prev.fecha && c.fecha < censoActual.fecha)
      .reduce((s, c) => s + c.kg, 0) * 1000
    const consumidoG = (prev.kg + ingresosG / 1000 - censoActual.kg) * 1000
    if (consumidoG <= 0) return null
    return { consumidoG, dias, realGDia: consumidoG / dias }
  }

  // ── Registrar censo ──
  function registrarCenso(fecha, kg) {
    const consumoEstimadoGDia = Math.round(consumoAjustado)
    const nuevo = {
      id: generarId(),
      fecha,
      kg,
      consumoEstimadoGDia,
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
                  <div className="font-bold text-white text-sm">Consumo diario estimado — todos los bioterios</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    Rango: {Math.round(global.min)} – {Math.round(global.max)} g/día
                    {calibracion && <span style={{ color: '#40c4ff' }}> · Ajustado por {calibracion.muestras} pares de censos</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono" style={{ color: '#ffb300' }}>
                    {consumoAjustado >= 1000
                      ? `${(consumoAjustado / 1000).toFixed(2)} kg`
                      : `${Math.round(consumoAjustado)} g`}
                  </div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>por día</div>
                </div>
              </div>

              {/* Desglose rápido por bioterio */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {TODOS_BIOTERIOS.map(({ id }) => {
                  const cfg = BIOTERIOS_CONFIG[id]
                  const d = datosBioterios[id]
                  return (
                    <div key={id} className="px-4 py-3 text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <div className="text-xs font-mono mb-1" style={{ color: cfg.color }}>{cfg.labelCorto}</div>
                      <div className="font-bold font-mono" style={{ color: '#c9d4e0' }}>
                        {d.totalMid >= 1000
                          ? `${(d.totalMid / 1000).toFixed(2)} kg`
                          : `${Math.round(d.totalMid)} g`}
                      </div>
                      <div className="text-xs" style={{ color: '#3d5068' }}>/día</div>
                    </div>
                  )
                })}
              </div>

              {calibracion && (
                <div className="px-6 py-2 flex items-center gap-2 text-xs font-mono" style={{ borderTop: '1px solid rgba(64,196,255,0.1)', background: 'rgba(64,196,255,0.03)', color: '#40c4ff' }}>
                  <TrendingUp size={12} />
                  Factor de calibración: ×{calibracion.factor.toFixed(2)}
                  {calibracion.factor > 1
                    ? ' — los animales consumen más de lo estimado'
                    : ' — los animales consumen menos de lo estimado'}
                </div>
              )}
            </div>

            {/* ── Panel de stock y predicción ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,230,118,0.12)', background: 'rgba(0,230,118,0.04)' }}>
                <div className="font-bold text-sm text-white">Stock y predicción de duración</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                  Basado en el último censo más los ingresos registrados
                </div>
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
                </div>
              )}
            </div>

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
                <div className="flex items-center gap-2">
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
                </div>
              </div>

              {/* Nota explicativa */}
              <div className="px-6 py-3 text-xs font-mono space-y-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', color: '#4a5f7a' }}>
                <div>
                  <span style={{ color: '#a78bfa' }}>📊 Censo</span>
                  {' '}— pesaje real del stock actual. Es la fuente del aprendizaje adaptativo.
                </div>
                <div>
                  <span style={{ color: '#00e676' }}>📦 Ingreso</span>
                  {' '}— compra o reposición. Suma al stock disponible sin alterar el historial de consumo.
                </div>
                <div style={{ color: '#3d5068' }}>
                  Consumo real = censo anterior + ingresos del período − censo actual
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
                    if (mov.tipo === 'censo') {
                      const idxEnOrden = censosOrdenados.findIndex(c => c.id === mov.id)
                      const consumo = consumoPorCenso(mov, idxEnOrden)
                      return (
                        <div key={mov.id} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
                          <div className="text-base mt-0.5">📊</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold font-mono" style={{ color: '#a78bfa' }}>Censo</span>
                              <span className="text-xs font-mono text-white">{mov.kg.toFixed(1)} kg</span>
                              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{formatFecha(mov.fecha)}</span>
                            </div>
                            {consumo && (
                              <div className="text-xs font-mono mt-1" style={{ color: '#6a8099' }}>
                                Consumo del período: {(consumo.consumidoG / 1000).toFixed(2)} kg en {consumo.dias} días
                                {' · '}{Math.round(consumo.realGDia)} g/día
                              </div>
                            )}
                          </div>
                          <button onClick={() => eliminarCensoItem(mov.id)} className="text-xs shrink-0" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                        </div>
                      )
                    } else {
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
                    }
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

            {/* Nota */}
            <div className="rounded-xl px-5 py-4 text-xs font-mono space-y-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5f7a' }}>
              <div className="font-semibold" style={{ color: '#6a8099' }}>Acerca de los valores</div>
              <div>Los rangos de consumo son promedios de referencia. Variaciones por temperatura, estado reproductivo y tipo de alimento son normales.</div>
              <div>Ratas lactantes: 30–40 g/día · Ratones lactantes: 10–15 g/día · Reproductores ratas: 20–35 g/día · Reproductores ratones: 6–8 g/día</div>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      {modalCenso && (
        <ModalCensoAlimento
          stockActualKg={stockActualKg}
          onConfirmar={registrarCenso}
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

function ModalCensoAlimento({ stockActualKg, onConfirmar, onCerrar }) {
  const [fecha, setFecha] = useState(hoy())
  const [kg, setKg]       = useState('')

  function confirmar(e) {
    e.preventDefault()
    const v = parseFloat(kg)
    if (!v || v < 0) return
    onConfirmar(fecha, v)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 0 60px rgba(167,139,250,0.12)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(167,139,250,0.15)', background: 'rgba(167,139,250,0.05)' }}>
          <div className="font-bold text-white text-sm">📊 Registrar censo de alimento</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Pesá el alimento disponible ahora mismo
          </div>
        </div>
        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha del censo</label>
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
              Alimento disponible (kg)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={kg}
              onChange={e => setKg(e.target.value)}
              placeholder="Ej: 18.5"
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }}
            />
          </div>

          {stockActualKg !== null && kg && parseFloat(kg) >= 0 && (
            <div className="rounded-xl px-4 py-3 text-xs font-mono space-y-1"
              style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.18)' }}>
              <div style={{ color: '#a78bfa' }}>Vista previa</div>
              <div style={{ color: '#8a9bb0' }}>
                Stock anterior: <span className="text-white">{stockActualKg.toFixed(1)} kg</span>
                {' → '}
                Nuevo stock: <span className="text-white">{parseFloat(kg || 0).toFixed(1)} kg</span>
              </div>
              {stockActualKg - parseFloat(kg || 0) > 0 && (
                <div style={{ color: '#6a8099' }}>
                  Consumo registrado: {(stockActualKg - parseFloat(kg)).toFixed(1)} kg
                </div>
              )}
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
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', color: '#a78bfa' }}
            >
              Guardar censo
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
