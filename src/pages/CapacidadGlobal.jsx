import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { BIO_RATAS, BIO_RATONES } from '../utils/constants'
import {
  difDias, parseDate, hoy,
  calcularRangoParto,
  calcularPerfilHembra, calcularConfiabilidadHembra, calcularRendimientoMacho,
} from '../utils/calculos'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  ArrowLeft, RefreshCw, AlertTriangle, Settings, Users,
  Layers, TrendingUp, ChevronDown, ChevronUp, Check,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

// ── Bioterios ─────────────────────────────────────────────────────────────────

// ── Config (Supabase) ──────────────────────────────────────────────────────────

const CFG0 = { maxAnimales: 0, maxJaulas: 0, diasProyeccion: 60 }

// ── Helpers puros ─────────────────────────────────────────────────────────────

const ACTIVOS = ['activo', 'en_apareamiento', 'en_cria']

function restoStock(c, sac, ent) {
  const s = sac.filter(x => x.camada_id === c.id).reduce((a, x) => a + x.cantidad, 0)
  const e = ent.filter(x => x.camada_id === c.id).reduce((a, x) => a + x.cantidad, 0)
  return Math.max(0, (c.total_destetados ?? c.total_crias ?? 0) - s - e)
}

function calcEstado(animales, camadas, jaulas, sac, ent) {
  const repro    = animales.filter(a => ACTIVOS.includes(a.estado))
  const stockMap = new Set(jaulas.map(j => j.camada_id))
  let nStock = 0, nJaulasStock = 0, nLactantes = 0

  jaulas.forEach(j => {
    const c = camadas.find(x => x.id === j.camada_id)
    if (!c || c.incluir_en_stock === false) return
    const r = restoStock(c, sac, ent)
    if (r > 0) { nStock += r; nJaulasStock++ }
  })
  camadas.forEach(c => {
    if (!c.fecha_destete || c.incluir_en_stock === false || stockMap.has(c.id)) return
    const r = restoStock(c, sac, ent)
    if (r > 0) { nStock += r; nJaulasStock++ }
  })
  camadas.forEach(c => {
    if (!c.fecha_nacimiento || c.fecha_destete || c.failure_flag || c.incluir_en_stock === false) return
    nLactantes += (c.total_crias ?? 0)
  })

  return {
    nAnimales: repro.length + nStock + nLactantes,
    nJaulas:   repro.length + nJaulasStock,
    nRepro: repro.length, nStock, nLactantes, nJaulasStock,
  }
}

function proyectar(animales, camadas, jaulas, sac, ent, bio, cfg, excluidos) {
  const animEf = animales.filter(a => !excluidos.has(a.id))
  const base   = calcEstado(animEf, camadas, jaulas, sac, ent)
  const HOY    = parseDate(hoy())
  const dias   = cfg.diasProyeccion ?? 60

  const conDatos = camadas.filter(c => (c.total_crias ?? 0) > 0)
  const avgLit = conDatos.length > 0
    ? conDatos.reduce((s, c) => s + c.total_crias, 0) / conDatos.length
    : (bio.GESTACION_DIAS < 22 ? 7 : 10)
  const conSv = conDatos.filter(c => c.total_destetados != null)
  const avgSv = conSv.length > 0
    ? conSv.reduce((s, c) => s + (c.total_destetados / Math.max(1, c.total_crias)), 0) / conSv.length
    : 0.80

  function addD(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  function fmt(d)     { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}` }
  function inW(d)     { const df = (d - HOY) / 864e5; return df >= 0 && df <= dias }

  const eventos = []

  // Partos pendientes (en apareamiento, sin fecha_nacimiento)
  camadas.forEach(c => {
    if (c.fecha_nacimiento || c.failure_flag || !c.fecha_copula) return
    const madre = animEf.find(a => a.id === c.id_madre)
    if (!madre) return
    const rango = calcularRangoParto(c.fecha_copula, bio)
    if (!rango || !inW(rango.partoProbable)) return
    const cm = camadas.filter(x => x.id_madre === c.id_madre && (x.total_crias ?? 0) > 0)
    const lit = cm.length > 0 ? cm.reduce((s,x)=>s+x.total_crias,0)/cm.length : avgLit
    const smv = cm.filter(x=>x.total_destetados!=null)
    const sv  = smv.length > 0 ? smv.reduce((s,x)=>s+(x.total_destetados/Math.max(1,x.total_crias)),0)/smv.length : avgSv
    const nC  = Math.max(1, Math.round(lit * sv))
    eventos.push({ fecha: rango.partoProbable, f: fmt(rango.partoProbable), tipo: 'parto',  dA: nC, dJ: 0, desc: `Parto ${madre.codigo||'?'} (~${nC} crías)` })
    const fd = addD(rango.partoProbable, bio.DESTETE_DIAS)
    if (inW(fd)) eventos.push({ fecha: fd, f: fmt(fd), tipo: 'destete', dA: 0, dJ: 1, desc: `Destete ${madre.codigo||'?'} (+1 jaula)` })
  })

  // Destetes pendientes (nacidos, no destetados)
  camadas.forEach(c => {
    if (!c.fecha_nacimiento || c.fecha_destete || c.failure_flag) return
    const fd = addD(parseDate(c.fecha_nacimiento), bio.DESTETE_DIAS)
    if (!inW(fd)) return
    eventos.push({ fecha: fd, f: fmt(fd), tipo: 'destete', dA: 0, dJ: 1, desc: `Destete pendiente (+1 jaula)` })
  })

  eventos.sort((a, b) => a.fecha - b.fecha)

  const puntos = [{ f: 'Hoy', animales: base.nAnimales, jaulas: base.nJaulas }]
  let curA = base.nAnimales, curJ = base.nJaulas
  for (const ev of eventos) {
    curA += ev.dA; curJ += ev.dJ
    puntos.push({ f: ev.f, animales: Math.round(curA), jaulas: Math.round(curJ), tipo: ev.tipo, desc: ev.desc })
  }

  const maxA = cfg.maxAnimales > 0 ? cfg.maxAnimales : Infinity
  const maxJ = cfg.maxJaulas   > 0 ? cfg.maxJaulas   : Infinity
  const satPoint = puntos.find(p => p.animales > maxA || p.jaulas > maxJ)
  const peakA    = Math.max(...puntos.map(p => p.animales))
  const peakJ    = Math.max(...puntos.map(p => p.jaulas))

  return { base, puntos, eventos, satPoint, peakA, peakJ, avgLit: +(avgLit.toFixed(1)), avgSv: Math.round(avgSv * 100) }
}

function calcPrioridad(animal, camadas) {
  if (!ACTIVOS.includes(animal.estado)) return -1
  let sc = 0
  const hoyD = parseDate(hoy())
  if (animal.fecha_nacimiento) {
    const edad = difDias(parseDate(animal.fecha_nacimiento), hoyD)
    if (edad > 300) sc += 20; else if (edad > 240) sc += 12; else if (edad > 180) sc += 6; else if (edad > 120) sc += 2
  }
  if (animal.sexo === 'hembra') {
    const pf = calcularPerfilHembra(animal.id, camadas)
    if (pf?.promedio != null) sc += Math.round((10 - Math.min(10, pf.promedio)) * 2)
    const cf = calcularConfiabilidadHembra(animal.id, camadas)
    if (cf === 'critica') sc += 20; else if (cf === 'moderada') sc += 10; else if (cf === 'leve') sc += 4
  } else {
    const rn = calcularRendimientoMacho(animal.id, camadas)
    if (rn?.promedio != null) sc += Math.round((10 - Math.min(10, rn.promedio)) * 2)
  }
  const camaA = camadas
    .filter(c => c.id_madre === animal.id || c.id_padre === animal.id)
    .sort((a, b) => (b.fecha_copula || '').localeCompare(a.fecha_copula || ''))
  if (camaA.length === 0) sc += 15
  else if (camaA[0].fecha_copula) {
    const d = difDias(parseDate(camaA[0].fecha_copula), hoyD)
    if (d > 120) sc += 12; else if (d > 90) sc += 7; else if (d > 60) sc += 3
  }
  if (animal.estado !== 'activo') sc -= 5
  return Math.max(0, sc)
}

function calcMotivos(animal, camadas) {
  const m = []
  if (animal.fecha_nacimiento) {
    const edad = difDias(parseDate(animal.fecha_nacimiento), parseDate(hoy()))
    if (edad > 300) m.push('Edad límite')
    else if (edad > 240) m.push('Edad avanzada')
  }
  if (animal.sexo === 'hembra') {
    const cf = calcularConfiabilidadHembra(animal.id, camadas)
    if (cf === 'critica') m.push('Confiabilidad crítica')
    else if (cf === 'moderada') m.push('Fallos repetidos')
  }
  const camaA = camadas.filter(c => c.id_madre === animal.id || c.id_padre === animal.id)
  if (camaA.length === 0) m.push('Sin historial')
  else {
    const ult = camaA.sort((a,b) => (b.fecha_copula||'').localeCompare(a.fecha_copula||''))[0]
    if (ult?.fecha_copula) {
      const d = difDias(parseDate(ult.fecha_copula), parseDate(hoy()))
      if (d > 90) m.push(`Inactivo ${d}d`)
    }
  }
  return m.slice(0, 2)
}

function nivelRiesgo(nA, nJ, cfg, tema) {
  if (cfg.maxAnimales <= 0 && cfg.maxJaulas <= 0) return null
  const pA = cfg.maxAnimales > 0 ? nA / cfg.maxAnimales : 0
  const pJ = cfg.maxJaulas   > 0 ? nJ / cfg.maxJaulas   : 0
  const p  = Math.max(pA, pJ)
  if (p >= 1.00) return { nivel: 'saturacion', color: '#ff3d57', label: '⚫ Saturación',     pct: Math.round(p*100) }
  if (p >= 0.95) return { nivel: 'alto',       color: tema.red, label: '🔴 Riesgo alto',    pct: Math.round(p*100) }
  if (p >= 0.80) return { nivel: 'moderado',   color: tema.amber, label: '🟡 Riesgo moderado', pct: Math.round(p*100) }
  if (p >= 0.60) return { nivel: 'bajo',       color: tema.accent, label: '🟢 Atención',        pct: Math.round(p*100) }
  return                { nivel: 'ok',         color: tema.accent, label: '✓ Capacidad OK',     pct: Math.round(p*100) }
}

// ── Componente principal ──────────────────────────────────────────────────────

const IDS_BIOTERIOS = ['ratas', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos']

export default function CapacidadGlobal() {
  const { tema } = useTheme()
  const TODOS = [
    { id: 'ratas',            bio: BIO_RATAS,   color: tema.accent, label: 'Bioterio de Ratas',  icon: '🐀', short: 'Ratas'    },
    { id: 'ratones_balbc',    bio: BIO_RATONES, color: tema.blue,   label: 'Ratones Balb/C',     icon: '🐭', short: 'BAL/C'    },
    { id: 'ratones_c57',      bio: BIO_RATONES, color: '#a78bfa',   label: 'Ratones C57',        icon: '🐭', short: 'C57'      },
    { id: 'ratones_hibridos', bio: BIO_RATONES, color: tema.amber,  label: 'Ratones Híbridos',   icon: '🐭', short: 'Híbridos' },
  ]
  const { limpiarBioterio } = useBioterioActivo()

  const [tab,       setTab]       = useState(TODOS[0].id)
  const [datos,     setDatos]     = useState(null)
  const [cargando,  setCargando]  = useState(true)
  const [error,     setError]     = useState(null)
  const [configs,   setConfigs]   = useState(() => Object.fromEntries(TODOS.map(b => [b.id, { ...CFG0 }])))
  const [excluidos, setExcluidos] = useState(() => Object.fromEntries(TODOS.map(b => [b.id, new Set()])))
  const [cfgOpen,   setCfgOpen]   = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const res = await Promise.all(
        IDS_BIOTERIOS.map((id) => Promise.all([
          supabase.from('animales').select('*').eq('bioterio_id', id),
          supabase.from('camadas').select('*').eq('bioterio_id', id),
          supabase.from('jaulas').select('*').eq('bioterio_id', id),
          supabase.from('sacrificios').select('*').eq('bioterio_id', id),
          supabase.from('entregas').select('*').eq('bioterio_id', id),
        ]))
      )
      const nd = {}
      IDS_BIOTERIOS.forEach((id, i) => {
        const [{ data: an }, { data: ca }, { data: ja }, { data: sa }, { data: en }] = res[i]
        nd[id] = { an: an ?? [], ca: ca ?? [], ja: ja ?? [], sa: sa ?? [], en: en ?? [] }
      })
      setDatos(nd)
    } catch (e) {
      console.error('CapacidadGlobal:', e)
      setError('No se pudo cargar la información. Verificá la conexión.')
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cargar configuración desde Supabase al montar
  useEffect(() => {
    async function cargarConfigs() {
      const claves = IDS_BIOTERIOS.map(id => `capacidad_${id}`)
      const { data } = await supabase.from('configuracion').select('clave, valor').in('clave', claves)
      if (data?.length) {
        setConfigs(prev => {
          const m = { ...prev }
          data.forEach(row => {
            const bioId = row.clave.replace('capacidad_', '')
            m[bioId] = { ...CFG0, ...row.valor }
          })
          return m
        })
      }
    }
    cargarConfigs()
  }, [])

  const bioTab = TODOS.find(b => b.id === tab)
  const cfg    = configs[tab]

  const proyeccion = useMemo(() => {
    if (!datos?.[tab]) return null
    const { an, ca, ja, sa, en } = datos[tab]
    return proyectar(an, ca, ja, sa, en, bioTab.bio, cfg, excluidos[tab])
  }, [datos, tab, cfg, excluidos, bioTab])

  const candidatos = useMemo(() => {
    if (!datos?.[tab]) return []
    const { an, ca } = datos[tab]
    return an
      .filter(a => ACTIVOS.includes(a.estado))
      .map(a => ({ ...a, prio: calcPrioridad(a, ca), motivos: calcMotivos(a, ca) }))
      .filter(a => a.prio > 0)
      .sort((a, b) => b.prio - a.prio)
      .slice(0, 8)
  }, [datos, tab])

  function setCfg(key, val) {
    const nuevo = { ...cfg, [key]: val }
    setConfigs(prev => ({ ...prev, [tab]: nuevo }))
    supabase.from('configuracion').upsert(
      { clave: `capacidad_${tab}`, valor: nuevo, updated_at: new Date().toISOString() },
      { onConflict: 'clave' }
    )
  }

  function toggleExcluido(id) {
    setExcluidos(prev => {
      const s = new Set(prev[tab])
      s.has(id) ? s.delete(id) : s.add(id)
      return { ...prev, [tab]: s }
    })
  }

  function limpiarSim() {
    setExcluidos(prev => ({ ...prev, [tab]: new Set() }))
  }

  const riesgo       = proyeccion ? nivelRiesgo(proyeccion.base.nAnimales, proyeccion.base.nJaulas, cfg, tema) : null
  const nExcluidos   = excluidos[tab]?.size ?? 0
  const limiteActivo = cfg.maxAnimales > 0 || cfg.maxJaulas > 0

  const partosPendientes = proyeccion?.eventos.filter(e => e.tipo === 'parto').length ?? 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: tema.bgMain }}>

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(0,230,118,0.15)', background: tema.bgCard }}>
        <button onClick={limpiarBioterio}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono"
          style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.2)', color: tema.accent }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(0,230,118,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(0,230,118,0.07)'}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white text-base">Capacidad y predicción</h1>
          <p className="text-xs font-mono" style={{ color: tema.textMuted }}>
            Saturación estimada · sugerencias automáticas · simulador de sacrificios
          </p>
        </div>
        <button onClick={cargar} disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: tema.textMuted, cursor: cargando ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: tema.bgCard }}>
        {TODOS.map(b => (
          <button key={b.id} onClick={() => { setTab(b.id); setCfgOpen(false) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tab === b.id ? `${b.color}18` : 'transparent',
              border: `1px solid ${tab === b.id ? `${b.color}50` : 'transparent'}`,
              color: tab === b.id ? b.color : '#4a5f7a',
            }}>
            <span>{b.icon}</span>
            <span className="hidden sm:inline">{b.short}</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-4xl mx-auto w-full space-y-5">

        {error && (
          <div className="rounded-2xl px-5 py-4 text-sm font-mono"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: tema.red }}>
            ⚠️ {error}
          </div>
        )}

        {cargando && !datos && (
          <div className="flex items-center justify-center gap-3 py-20">
            <span className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#00e676', borderTopColor: 'transparent' }} />
            <span className="text-sm font-mono" style={{ color: tema.textMuted }}>Calculando capacidad de la colonia...</span>
          </div>
        )}

        {proyeccion && (
          <>
            {/* ── Panel estado actual + config ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: tema.bgCard, border: `1.5px solid ${bioTab.color}30`, boxShadow: `0 0 40px ${bioTab.color}06` }}>

              {/* Header */}
              <div className="px-6 py-3 flex items-center gap-3"
                style={{ borderBottom: `1px solid ${bioTab.color}12`, background: `${bioTab.color}06` }}>
                <span className="text-base">{bioTab.icon}</span>
                <span className="font-bold text-white text-sm">{bioTab.label}</span>
                {riesgo && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: `${riesgo.color}15`, border: `1px solid ${riesgo.color}40`, color: riesgo.color }}>
                    {riesgo.label} · {riesgo.pct}%
                  </span>
                )}
                <button onClick={() => setCfgOpen(v => !v)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#6a8099' }}>
                  <Settings size={11} /> Configurar {cfgOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              </div>

              {/* Config colapsable */}
              {cfgOpen && (
                <div className="px-6 py-5 border-b space-y-4"
                  style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>
                    Límites de capacidad — {bioTab.label}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                        <Users size={10} /> Máx. animales
                      </label>
                      <input type="number" min="0" value={cfg.maxAnimales || ''}
                        onChange={e => setCfg('maxAnimales', parseInt(e.target.value) || 0)}
                        placeholder="Sin límite"
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                        style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.9)', color: tema.textPrimary, outline: 'none' }} />
                      <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>0 = sin límite</div>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                        <Layers size={10} /> Máx. jaulas
                      </label>
                      <input type="number" min="0" value={cfg.maxJaulas || ''}
                        onChange={e => setCfg('maxJaulas', parseInt(e.target.value) || 0)}
                        placeholder="Sin límite"
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                        style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.9)', color: tema.textPrimary, outline: 'none' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                        Proyección: {cfg.diasProyeccion} días
                      </label>
                      <input type="range" min="15" max="120" step="15" value={cfg.diasProyeccion}
                        onChange={e => setCfg('diasProyeccion', parseInt(e.target.value))}
                        className="w-full mt-2" />
                      <div className="flex justify-between text-xs font-mono mt-1" style={{ color: '#3d5068' }}>
                        <span>15d</span><span>120d</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Métricas actuales */}
              <div className="grid grid-cols-2 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <MetricaPanel
                  label="Animales actuales" valor={proyeccion.base.nAnimales} maximo={cfg.maxAnimales} color={bioTab.color}
                  detalle={[
                    `${proyeccion.base.nRepro} repro`,
                    `${proyeccion.base.nStock} stock`,
                    proyeccion.base.nLactantes > 0 ? `${proyeccion.base.nLactantes} lactantes` : null,
                  ].filter(Boolean).join(' · ')}
                />
                <MetricaPanel
                  label="Jaulas ocupadas" valor={proyeccion.base.nJaulas} maximo={cfg.maxJaulas} color={bioTab.color}
                  detalle={`${proyeccion.base.nRepro} repro · ${proyeccion.base.nJaulasStock} stock`}
                />
              </div>

              {/* Banner simulación activa */}
              {nExcluidos > 0 && (
                <div className="mx-4 mb-4 mt-1 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-mono"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa' }}>
                  🧮 Simulación activa — {nExcluidos} animal{nExcluidos > 1 ? 'es' : ''} excluido{nExcluidos > 1 ? 's' : ''}.
                  La proyección ya refleja el impacto.
                  <button onClick={limpiarSim} className="ml-auto underline" style={{ color: '#a78bfa' }}>
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            {/* ── Proyección ── */}
            {limiteActivo && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: tema.bgCard, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="px-6 py-4 flex items-center gap-2"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <TrendingUp size={14} style={{ color: bioTab.color }} />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white">Proyección a {cfg.diasProyeccion} días</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                      Pico estimado: {proyeccion.peakA} animales · {proyeccion.peakJ} jaulas
                      {proyeccion.eventos.length > 0 && ` · ${partosPendientes} parto${partosPendientes !== 1 ? 's' : ''} pendiente${partosPendientes !== 1 ? 's' : ''}`}
                      {` · Promedio camada: ${proyeccion.avgLit} crías (supervivencia ${proyeccion.avgSv}%)`}
                    </div>
                  </div>
                </div>

                {/* Alerta de saturación proyectada */}
                {proyeccion.satPoint && (
                  <div className="mx-4 mt-4 px-4 py-3 rounded-xl flex items-start gap-3 text-sm font-mono"
                    style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.3)', color: tema.red }}>
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">⚠ Saturación estimada: {proyeccion.satPoint.f}</div>
                      <div className="text-xs mt-1 space-y-0.5" style={{ color: '#ff9090' }}>
                        <div>{proyeccion.satPoint.desc}</div>
                        <div>
                          Proyectado: {proyeccion.satPoint.animales} animales · {proyeccion.satPoint.jaulas} jaulas
                          {cfg.maxAnimales > 0 && proyeccion.satPoint.animales > cfg.maxAnimales &&
                            <span className="ml-2 font-bold">+{proyeccion.satPoint.animales - cfg.maxAnimales} animales sobre el límite</span>}
                          {cfg.maxJaulas > 0 && proyeccion.satPoint.jaulas > cfg.maxJaulas &&
                            <span className="ml-2 font-bold">+{proyeccion.satPoint.jaulas - cfg.maxJaulas} jaulas sobre el límite</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Gráficos */}
                {proyeccion.puntos.length >= 2 && (
                  <div className="grid md:grid-cols-2 gap-4 p-4">
                    <GraficoProyeccion
                      data={proyeccion.puntos} dataKey="animales" label="Animales"
                      color={bioTab.color} maximo={cfg.maxAnimales > 0 ? cfg.maxAnimales : null}
                    />
                    <GraficoProyeccion
                      data={proyeccion.puntos} dataKey="jaulas" label="Jaulas"
                      color="#a78bfa" maximo={cfg.maxJaulas > 0 ? cfg.maxJaulas : null}
                    />
                  </div>
                )}

                {/* Lista de eventos */}
                {proyeccion.eventos.length > 0 ? (
                  <div className="px-4 pb-4 space-y-1">
                    <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#3d5068' }}>
                      Eventos proyectados
                    </div>
                    {proyeccion.eventos.slice(0, 6).map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span>{ev.tipo === 'parto' ? '🐣' : '📦'}</span>
                        <span style={{ color: '#5a7a9a' }}>{ev.f}</span>
                        <span style={{ color: tema.textSecondary }}>{ev.desc}</span>
                      </div>
                    ))}
                    {proyeccion.eventos.length > 6 && (
                      <div className="text-xs font-mono" style={{ color: '#3d5068' }}>
                        +{proyeccion.eventos.length - 6} eventos más en el período
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-4 text-xs font-mono" style={{ color: '#3d5068' }}>
                    ✓ Sin partos ni destetes proyectados en los próximos {cfg.diasProyeccion} días.
                  </div>
                )}
              </div>
            )}

            {/* ── Sugerencias automáticas (si hay riesgo o saturación) ── */}
            {limiteActivo && (proyeccion.satPoint || (riesgo && riesgo.nivel !== 'ok' && riesgo.nivel !== 'bajo')) && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: tema.bgCard, border: '1px solid rgba(255,179,0,0.2)' }}>
                <div className="px-6 py-3"
                  style={{ borderBottom: '1px solid rgba(255,179,0,0.12)', background: 'rgba(255,179,0,0.04)' }}>
                  <div className="font-bold text-sm text-white">💡 Sugerencias automáticas</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                    Acciones para mantener el bioterio dentro del límite
                  </div>
                </div>
                <div className="p-4 grid md:grid-cols-3 gap-3">
                  <TarjetaSugerencia
                    icono="💉" titulo="Sacrificar reproductores" color="#ff6b80"
                    descripcion={
                      candidatos.length > 0
                        ? `Candidatos: ${candidatos.slice(0,3).map(a => a.codigo || a.id.slice(-4)).join(', ')}`
                        : 'Ver candidatos en la lista de abajo'
                    }
                  />
                  <TarjetaSugerencia
                    icono="🔗" titulo="Reducir apareamientos" color="#ffb300"
                    descripcion={
                      partosPendientes > 0
                        ? `Hay ${partosPendientes} parto${partosPendientes > 1 ? 's' : ''} proyectado${partosPendientes > 1 ? 's' : ''}. Reducir ${Math.max(1, Math.ceil(partosPendientes / 2))} apareamiento${Math.ceil(partosPendientes/2) > 1 ? 's' : ''} este mes`
                        : 'Postponé apareamientos hasta reducir el stock actual'
                    }
                  />
                  <TarjetaSugerencia
                    icono="🏠" titulo="Ampliar capacidad" color="#40c4ff"
                    descripcion={
                      cfg.maxJaulas > 0 && proyeccion.peakJ > cfg.maxJaulas
                        ? `Se necesitan ~${proyeccion.peakJ - cfg.maxJaulas} jaulas más para absorber el pico proyectado`
                        : cfg.maxAnimales > 0 && proyeccion.peakA > cfg.maxAnimales
                        ? `Pico proyectado: ${proyeccion.peakA} animales (límite: ${cfg.maxAnimales})`
                        : 'Configurá los límites para ver el exceso proyectado'
                    }
                  />
                </div>
              </div>
            )}

            {/* ── Candidatos a sacrificio ── */}
            {candidatos.length > 0 && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: tema.bgCard, border: '1px solid rgba(255,107,128,0.2)' }}>
                <div className="px-6 py-3 flex items-center gap-2"
                  style={{ borderBottom: '1px solid rgba(255,107,128,0.12)', background: 'rgba(255,107,128,0.04)' }}>
                  <span style={{ fontSize: 14 }}>💉</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white">Candidatos a sacrificio</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                      Ordenados por prioridad calculada · Score: edad + rendimiento + inactividad + confiabilidad
                    </div>
                  </div>
                  {nExcluidos > 0 && (
                    <button onClick={limpiarSim}
                      className="px-3 py-1.5 rounded-xl text-xs font-mono"
                      style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                      Limpiar simulación
                    </button>
                  )}
                </div>

                <div className="px-4 py-3 space-y-2">
                  {/* Leyenda */}
                  <div className="px-3 py-2 rounded-xl text-xs font-mono"
                    style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', color: tema.textMuted }}>
                    🧮 <span style={{ color: '#a78bfa' }}>Simular</span> = recalcular proyección como si ese animal fuera sacrificado
                  </div>

                  {candidatos.map(a => {
                    const sim  = excluidos[tab].has(a.id)
                    const edad = a.fecha_nacimiento ? difDias(parseDate(a.fecha_nacimiento), parseDate(hoy())) : null
                    return (
                      <div key={a.id}
                        className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2"
                        style={{
                          background: sim ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${sim ? 'rgba(167,139,250,0.28)' : 'rgba(255,255,255,0.06)'}`,
                          opacity: sim ? 0.75 : 1,
                        }}>

                        {/* Identidad */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                            style={{ background: a.sexo === 'hembra' ? 'rgba(206,147,216,0.15)' : 'rgba(64,196,255,0.15)', color: a.sexo === 'hembra' ? '#ce93d8' : '#40c4ff' }}>
                            {a.sexo === 'hembra' ? '♀' : '♂'} {a.codigo || a.id.slice(-6)}
                          </span>
                          {edad !== null && (
                            <span className="text-xs font-mono" style={{ color: tema.textMuted }}>
                              {Math.floor(edad/30)}m {edad%30}d
                            </span>
                          )}
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#6a8099' }}>
                            {a.estado.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Motivos */}
                        <div className="flex flex-wrap gap-1.5">
                          {a.motivos.map(m => (
                            <span key={m} className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,107,128,0.08)', border: '1px solid rgba(255,107,128,0.22)', color: tema.red }}>
                              {m}
                            </span>
                          ))}
                        </div>

                        {/* Score + Simular */}
                        <div className="ml-auto flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-mono" style={{ color: '#3d5068' }}>Prioridad</div>
                            <div className="text-sm font-bold font-mono"
                              style={{ color: a.prio >= 35 ? '#ff6b80' : a.prio >= 20 ? '#ffb300' : '#6a8099' }}>
                              {a.prio}
                            </div>
                          </div>
                          <button onClick={() => toggleExcluido(a.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono"
                            style={{
                              background: sim ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.08)',
                              border: '1px solid rgba(167,139,250,0.3)',
                              color: '#a78bfa',
                            }}>
                            {sim ? <><Check size={10} /> Simulado</> : '🧮 Simular'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Prompt para configurar si no hay límites */}
            {!limiteActivo && (
              <div className="rounded-2xl px-6 py-10 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-4xl mb-4">⚙️</div>
                <div className="text-sm font-semibold text-white mb-2">Configurá los límites del bioterio</div>
                <div className="text-xs font-mono max-w-xs mx-auto" style={{ color: '#3d5068' }}>
                  Definí el máximo de animales y/o jaulas para activar la predicción de saturación y las sugerencias automáticas.
                </div>
                <button onClick={() => setCfgOpen(true)}
                  className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold mx-auto"
                  style={{ background: `${bioTab.color}18`, border: `1px solid ${bioTab.color}40`, color: bioTab.color }}>
                  <Settings size={13} /> Abrir configuración
                </button>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function MetricaPanel({ label, valor, maximo, color, detalle }) {
  const { tema } = useTheme()
  const pct = maximo > 0 ? Math.min(100, Math.round(valor / maximo * 100)) : null
  const barColor = pct === null ? color
    : pct >= 100 ? '#ff3d57'
    : pct >= 95  ? '#ff6b80'
    : pct >= 80  ? '#ffb300'
    : color
  return (
    <div className="px-5 py-5 flex flex-col gap-2">
      <div className="text-xs font-mono uppercase tracking-wider" style={{ color: tema.textMuted }}>{label}</div>
      <div className="flex items-end gap-2">
        <div className="text-3xl font-bold font-mono text-white leading-none">{valor}</div>
        {maximo > 0 && <div className="text-sm font-mono mb-0.5" style={{ color: tema.textMuted }}>/ {maximo}</div>}
      </div>
      {pct !== null && (
        <>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
          </div>
          <div className="text-xs font-mono" style={{ color: barColor }}>{pct}% de capacidad</div>
        </>
      )}
      {detalle && <div className="text-xs font-mono" style={{ color: '#3d5068' }}>{detalle}</div>}
    </div>
  )
}

function GraficoProyeccion({ data, dataKey, label, color, maximo }) {
  const { tema } = useTheme()
  const maxVal = Math.max(...data.map(d => d[dataKey] ?? 0))
  const yMax   = maximo ? Math.max(maximo * 1.25, maxVal * 1.1) : maxVal * 1.2
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: tema.bgInput, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="text-xs font-bold text-white">{label}</div>
        {maximo && <div className="text-xs font-mono" style={{ color: tema.textMuted }}>Límite: {maximo}</div>}
      </div>
      <div style={{ height: 165, padding: '8px 4px 4px 4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={`g_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="f" tick={{ fill: '#4a5f7a', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, yMax]} tick={{ fill: '#4a5f7a', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0d1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
              labelStyle={{ color: tema.textPrimary }}
              formatter={v => [`${v}`, label]}
            />
            {maximo && (
              <ReferenceLine y={maximo} stroke="#ff3d57" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: 'Límite', fill: '#ff6b80', fontSize: 9, position: 'insideTopRight' }} />
            )}
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
              fill={`url(#g_${dataKey})`} dot={false} activeDot={{ r: 3, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TarjetaSugerencia({ icono, titulo, descripcion, color }) {
  return (
    <div className="rounded-xl px-4 py-4 flex flex-col gap-2"
      style={{ background: `${color}08`, border: `1px solid ${color}22` }}>
      <div className="flex items-center gap-2">
        <span>{icono}</span>
        <div className="font-semibold text-xs text-white">{titulo}</div>
      </div>
      <div className="text-xs font-mono leading-relaxed" style={{ color: '#5a7a9a' }}>{descripcion}</div>
    </div>
  )
}
