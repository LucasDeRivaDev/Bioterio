import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { BIO_RATAS, BIO_RATONES } from '../utils/constants'
import { difDias, parseDate, hoy, formatFecha } from '../utils/calculos'
import { generarId } from '../utils/storage'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowLeft, RefreshCw, Plus, CheckCircle, Package, TrendingUp, Wheat } from 'lucide-react'

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
  { id: 'ratas',          especie: 'rata',  bio: BIO_RATAS },
  { id: 'ratones_balbc',  especie: 'raton', bio: BIO_RATONES },
  { id: 'ratones_c57',    especie: 'raton', bio: BIO_RATONES },
  { id: 'ratones_hibridos', especie: 'raton', bio: BIO_RATONES },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Calcula consumo de un grupo {count} con tasa {tasa}
function consumoGrupo(count, tasa) {
  return { count, min: count * tasa.min, max: count * tasa.max, mid: count * mid(tasa) }
}

// Suma dos objetos de consumo
function sumarConsumo(a, b) {
  return { count: a.count + b.count, min: a.min + b.min, max: a.max + b.max, mid: a.mid + b.mid }
}

const VACIO = { count: 0, min: 0, max: 0, mid: 0 }

// ── Cálculo principal por bioterio ────────────────────────────────────────────

function calcularConsumo(bioId, especie, bio, animales, camadas, jaulas, sacrificios, entregas) {
  const tasas = TASAS[especie]
  const activos = ['activo', 'en_apareamiento', 'en_cria']

  // ── Reproductores ──
  // Hembras lactantes: en_cria + camada con nacimiento pero sin destete
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

  // ── Stock de jaulas ──
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

  // Jaulas reales
  jaulas.forEach(jaula => {
    const camada = camadas.find(c => c.id === jaula.camada_id)
    if (!camada || camada.incluir_en_stock === false || jaula.total <= 0) return
    acumularStock(jaula.total, camada.fecha_nacimiento)
  })

  // Bloques virtuales
  camadas.forEach(camada => {
    if (!camada.fecha_destete || camada.incluir_en_stock === false) return
    if (jaulasIds.has(camada.id)) return
    const stock = stockCamada(camada, sacrificios, entregas)
    if (stock <= 0) return
    acumularStock(stock, camada.fecha_nacimiento)
  })

  // ── Total ──
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

// ── localStorage para el historial de compras ─────────────────────────────────
const LS_KEY = 'appMosca_alimento_compras'

function cargarCompras() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') }
  catch { return [] }
}
function guardarCompras(lista) {
  localStorage.setItem(LS_KEY, JSON.stringify(lista))
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsumoAlimento() {
  const { limpiarBioterio } = useBioterioActivo()

  const [datosBioterios, setDatosBioterios] = useState(null)
  const [cargando, setCargando]             = useState(true)
  const [error, setError]                   = useState(null)
  const [alimentoKg, setAlimentoKg]         = useState('')
  const [compras, setCompras]               = useState(() => cargarCompras())
  const [modalCompra, setModalCompra]       = useState(false)

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

  // ── Factor de calibración (basado en compras cerradas) ──
  const calibracion = useMemo(() => {
    const cerradas = compras.filter(c => c.cerrado && c.dias_reales > 0 && c.consumo_estimado_g_dia > 0)
    if (cerradas.length === 0) return null
    const ratios = cerradas.map(c => {
      const realGDia = (c.cantidad_kg * 1000) / c.dias_reales
      return realGDia / c.consumo_estimado_g_dia
    })
    const factorPromedio = ratios.reduce((s, r) => s + r, 0) / ratios.length
    return { factor: factorPromedio, muestras: cerradas.length }
  }, [compras])

  // Consumo ajustado con calibración
  const consumoAjustado = global && calibracion
    ? global.mid * calibracion.factor
    : global?.mid ?? 0

  // Consumo base (midpoint) para los cálculos
  const consumoBase = global?.mid ?? 0

  // ── Calculadora de duración ──
  const diasEstimados = useMemo(() => {
    const kg = parseFloat(alimentoKg)
    if (!kg || kg <= 0 || consumoBase <= 0) return null
    const consumoFinal = calibracion ? consumoBase * calibracion.factor : consumoBase
    return Math.floor((kg * 1000) / consumoFinal)
  }, [alimentoKg, consumoBase, calibracion])

  const fechaAgotamiento = useMemo(() => {
    if (!diasEstimados) return null
    const d = new Date()
    d.setDate(d.getDate() + diasEstimados)
    return formatFecha(d)
  }, [diasEstimados])

  // ── Registrar compra ──
  function registrarCompra(fecha, cantidadKg) {
    const consumoEstimado = Math.round(consumoBase)
    const diasEst = consumoEstimado > 0 ? Math.floor((cantidadKg * 1000) / consumoEstimado) : 0

    const nuevas = [...compras]

    // Cerrar el registro abierto anterior
    const abierto = nuevas.find(c => !c.cerrado)
    if (abierto) {
      const diasReales = difDias(parseDate(abierto.fecha), parseDate(fecha))
      abierto.cerrado = true
      abierto.fecha_cierre = fecha
      abierto.dias_reales = Math.max(1, diasReales)
    }

    // Agregar nueva compra
    nuevas.push({
      id: generarId(),
      fecha,
      cantidad_kg: cantidadKg,
      consumo_estimado_g_dia: consumoEstimado,
      dias_estimados: diasEst,
      cerrado: false,
      fecha_cierre: null,
      dias_reales: null,
    })

    setCompras(nuevas)
    guardarCompras(nuevas)
    setModalCompra(false)
    setAlimentoKg(String(cantidadKg))
  }

  function cerrarCompraActual() {
    const nuevas = [...compras]
    const abierto = nuevas.find(c => !c.cerrado)
    if (!abierto) return
    const hoyStr = hoy()
    const diasReales = difDias(parseDate(abierto.fecha), parseDate(hoyStr))
    abierto.cerrado = true
    abierto.fecha_cierre = hoyStr
    abierto.dias_reales = Math.max(1, diasReales)
    setCompras(nuevas)
    guardarCompras(nuevas)
  }

  function eliminarCompra(id) {
    const nuevas = compras.filter(c => c.id !== id)
    setCompras(nuevas)
    guardarCompras(nuevas)
  }

  // ── Datos para el gráfico ──
  const datosGrafico = useMemo(() => {
    return compras
      .filter(c => c.cerrado && c.dias_reales > 0)
      .map(c => ({
        fecha: formatFecha(c.fecha, { month: '2-digit', day: '2-digit', year: undefined }),
        estimado: Math.round(c.consumo_estimado_g_dia / 100) / 10,  // kg
        real: Math.round((c.cantidad_kg * 1000 / c.dias_reales) / 100) / 10,
      }))
      .slice(-8)  // últimas 8 entradas
  }, [compras])

  const compraAbierta = compras.find(c => !c.cerrado) ?? null

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
                    {calibracion && <span style={{ color: '#40c4ff' }}> · Ajustado por {calibracion.muestras} períodos reales</span>}
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

            {/* ── Calculadora de duración ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(0,230,118,0.2)' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(0,230,118,0.12)', background: 'rgba(0,230,118,0.04)' }}>
                <Package size={18} style={{ color: '#00e676' }} />
                <div className="font-bold text-sm text-white">Calculadora de duración</div>
              </div>
              <div className="px-6 py-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-mono uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Alimento disponible</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={alimentoKg}
                      onChange={e => setAlimentoKg(e.target.value)}
                      placeholder="0"
                      className="w-24 px-3 py-2 rounded-xl text-sm font-mono font-bold text-center"
                      style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.25)', color: '#c9d4e0', outline: 'none' }}
                    />
                    <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>kg</span>
                  </div>
                </div>

                {diasEstimados ? (
                  <div className="flex gap-6">
                    <div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Duración estimada</div>
                      <div className="text-2xl font-bold font-mono" style={{ color: '#00e676' }}>
                        {diasEstimados} días
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Se agota el</div>
                      <div className="text-base font-bold font-mono" style={{ color: diasEstimados < 7 ? '#ff6b80' : diasEstimados < 14 ? '#ffb300' : '#00e676' }}>
                        {fechaAgotamiento}
                      </div>
                    </div>
                    {calibracion && (
                      <div>
                        <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Sin ajuste</div>
                        <div className="text-base font-mono" style={{ color: '#4a5f7a' }}>
                          {Math.floor((parseFloat(alimentoKg) * 1000) / consumoBase)} días
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm font-mono" style={{ color: '#3d5068' }}>
                    Ingresá la cantidad disponible para ver cuántos días dura
                  </div>
                )}
              </div>
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
                      {/* Encabezado */}
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

                      {/* Categorías */}
                      {tieneData ? (
                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                          <FilaCategoria label="Hembras lactantes" dato={d.reproLactantes} tasaMin={tasas.lactante.min} tasaMax={tasas.lactante.max} color="#ce93d8" />
                          <FilaCategoria label="Reproductores (resto)" dato={d.reproOtros} tasaMin={tasas.repro.min} tasaMax={tasas.repro.max} color="#40c4ff" />
                          <FilaCategoria label="Crías en stock" dato={d.stockCrias} tasaMin={tasas.crias.min} tasaMax={tasas.crias.max} color="#00e676" />
                          <FilaCategoria label="Jóvenes en stock" dato={d.stockJovenes} tasaMin={tasas.jovenes.min} tasaMax={tasas.jovenes.max} color="#ffb300" />
                          <FilaCategoria label="Adultos en stock" dato={d.stockAdultos} tasaMin={tasas.adultos.min} tasaMax={tasas.adultos.max} color="#ff6b80" />
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

            {/* ── Sistema adaptativo ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(64,196,255,0.18)' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(64,196,255,0.12)', background: 'rgba(64,196,255,0.04)' }}>
                <TrendingUp size={18} style={{ color: '#40c4ff' }} />
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">Sistema adaptativo</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    Registrá cada compra para calibrar el consumo real con el tiempo
                  </div>
                </div>
                <button
                  onClick={() => setModalCompra(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold"
                  style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(64,196,255,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(64,196,255,0.1)' }}
                >
                  <Plus size={13} />
                  Registrar compra
                </button>
              </div>

              {/* Compra activa */}
              {compraAbierta && (
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Período actual</div>
                  <div className="rounded-xl px-4 py-3 flex items-center gap-4" style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)' }}>
                    <div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Desde</div>
                      <div className="font-bold text-sm text-white">{formatFecha(compraAbierta.fecha)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Cantidad</div>
                      <div className="font-bold text-sm" style={{ color: '#00e676' }}>{compraAbierta.cantidad_kg} kg</div>
                    </div>
                    <div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Días transcurridos</div>
                      <div className="font-bold text-sm text-white">
                        {difDias(parseDate(compraAbierta.fecha), parseDate(hoy()))} días
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Duración estimada</div>
                      <div className="font-bold text-sm text-white">{compraAbierta.dias_estimados} días</div>
                    </div>
                    <button
                      onClick={cerrarCompraActual}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono"
                      style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}
                    >
                      <CheckCircle size={12} />
                      Se agotó hoy
                    </button>
                  </div>
                </div>
              )}

              {/* Historial de compras */}
              {compras.filter(c => c.cerrado).length > 0 && (
                <div className="px-6 py-4">
                  <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>Historial de períodos</div>
                  <div className="space-y-2">
                    {[...compras].filter(c => c.cerrado).reverse().slice(0, 6).map(c => {
                      const realGDia = (c.cantidad_kg * 1000) / c.dias_reales
                      const diferencia = realGDia - c.consumo_estimado_g_dia
                      const pct = Math.round(Math.abs(diferencia) / c.consumo_estimado_g_dia * 100)
                      return (
                        <div key={c.id} className="rounded-lg px-4 py-2.5 flex items-center gap-3 text-xs font-mono" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#6a8099' }}>{formatFecha(c.fecha)}</div>
                          <div className="text-white font-semibold">{c.cantidad_kg} kg</div>
                          <div style={{ color: '#4a5f7a' }}>{c.dias_reales} días reales / {c.dias_estimados} estimados</div>
                          <div style={{ color: diferencia > 0 ? '#ff6b80' : '#00e676' }}>
                            {diferencia > 0 ? `+${pct}%` : `-${pct}%`}
                          </div>
                          <button onClick={() => eliminarCompra(c.id)} className="ml-auto" style={{ color: '#2a3a50' }} title="Eliminar">✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {compras.length === 0 && (
                <div className="px-6 py-8 text-center text-sm font-mono" style={{ color: '#3d5068' }}>
                  Aún no hay registros. Registrá tu próxima compra de alimento para empezar a calibrar el sistema.
                </div>
              )}
            </div>

            {/* ── Gráfico histórico ── */}
            {datosGrafico.length >= 2 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="font-bold text-sm text-white">Consumo estimado vs. real — histórico</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>kg/día por período de compra</div>
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
                      <Bar dataKey="real"      fill="rgba(0,230,118,0.6)"  radius={[4,4,0,0]} />
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

      {/* Modal: Registrar compra */}
      {modalCompra && (
        <ModalRegistrarCompra
          onConfirmar={registrarCompra}
          onCerrar={() => setModalCompra(false)}
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

function ModalRegistrarCompra({ onConfirmar, onCerrar }) {
  const [fecha, setFecha]       = useState(hoy())
  const [cantidad, setCantidad] = useState('')

  function confirmar(e) {
    e.preventDefault()
    const kg = parseFloat(cantidad)
    if (!kg || kg <= 0) return
    onConfirmar(fecha, kg)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(64,196,255,0.25)', boxShadow: '0 0 60px rgba(64,196,255,0.1)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(64,196,255,0.12)', background: 'rgba(64,196,255,0.04)' }}>
          <div className="font-bold text-white text-sm">Registrar compra de alimento</div>
          <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
            Esto cierra el período anterior y abre uno nuevo
          </div>
        </div>
        <form onSubmit={confirmar} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Fecha de compra</label>
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
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Cantidad (kg)</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="Ej: 25"
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', outline: 'none' }}
            />
          </div>
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
              style={{ background: 'rgba(64,196,255,0.12)', border: '1px solid rgba(64,196,255,0.4)', color: '#40c4ff' }}
            >
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
