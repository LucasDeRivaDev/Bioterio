import { useState, useMemo, useEffect } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { hoy, formatFecha } from '../utils/calculos'
import { buildPedigree, calcularFCoeficiente } from '../utils/genealogia'
import {
  CATEGORIAS, CATEGORIAS_FORM, SEVERIDADES, LISTA_BIOTERIOS, NIVEL_ALERTA,
  CATS_GENEALOGICAS, getTiposForm,
  getCategoriaInfo, getTipoLabel, getSeveridadInfo,
  labelBioterio, colorBioterio,
  calcularIndiceSanitario, nivelIndice,
  calcularIndiceAmbiental, nivelAmbiental, statsTemperatura, clasificarTemperatura, calcularExposicionTermica,
  calcularIndiceRiesgoGenetico, nivelRiesgoGenetico,
  calcularIndiceEstabilidadGlobal,
  detectarPatrones, detectarCorrelaciones, detectarCorrelacionesMultiventana,
  generarMotorCausalCompleto, generarAlertasSanitarias, generarRecomendacionesHoy,
  generarTendencias, generarBloqueosSanitarios,
  detectarDeterioroProgresivo, generarDecisionesHoy,
  detectarAlertasGenealógicas,
} from '../utils/sanitario'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, CheckCircle, Plus, Activity, TrendingUp, TrendingDown, Thermometer, Dna, Zap, Eye, EyeOff } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

// ── Constantes UI ─────────────────────────────────────────────────────────────

const BIOTERIOS_SIN_TODOS = LISTA_BIOTERIOS.slice(1)

// ── Componente principal ──────────────────────────────────────────────────────

export default function Incidentes() {
  const { tema, modoBrillo } = useTheme()
  const { incidentes, animales, camadas, temperaturas, agregarIncidente, editarIncidente, eliminarIncidente } = useBioterio()
  const { bioterioActivo, bio } = useBioterioActivo()

  const [filtroColonia,   setFiltroColonia]   = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [filtroSeveridad, setFiltroSeveridad] = useState('todos')
  const [filtroEstado,    setFiltroEstado]    = useState('abiertos')
  const [modal,           setModal]           = useState(false)
  const [incAEditar,      setIncAEditar]      = useState(null)
  const [confirmarElim,   setConfirmarElim]   = useState(null)
  const [tabActivo,       setTabActivo]       = useState('lista') // 'lista' | 'estadisticas' | 'ambiental' | 'causal'
  const [mostrarCorrel,   setMostrarCorrel]   = useState(false)
  const [periodoTendencia, setPeriodoTendencia] = useState(6) // 6 | 12

  // ── Pedigree para cálculo de consanguinidad ────────────────────────────────
  const pedigree = useMemo(() => buildPedigree(animales, camadas), [animales, camadas])

  // ── F coeficientes por animal ──────────────────────────────────────────────
  const fCoefMapa = useMemo(() => {
    const mapa = new Map()
    animales.filter(a => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado)).forEach(a => {
      try { mapa.set(a.id, calcularFCoeficiente(a.id, pedigree) ?? 0) } catch { mapa.set(a.id, 0) }
    })
    return mapa
  }, [animales, pedigree])

  // ── Índices ────────────────────────────────────────────────────────────────
  const indices = useMemo(() => {
    const global = calcularIndiceSanitario(camadas, incidentes, null)
    const porColonia = {}
    BIOTERIOS_SIN_TODOS.forEach(b => {
      porColonia[b.id] = calcularIndiceSanitario(camadas, incidentes, b.id)
    })
    return { global, porColonia }
  }, [camadas, incidentes])

  const indiceAmbiental = useMemo(() =>
    calcularIndiceAmbiental(temperaturas, bioterioActivo),
    [temperaturas, bioterioActivo]
  )

  const statsTempActivo = useMemo(() =>
    statsTemperatura(temperaturas, bioterioActivo),
    [temperaturas, bioterioActivo]
  )

  const indiceGenetico = useMemo(() =>
    calcularIndiceRiesgoGenetico(
      animales.filter(a => a.bioterio_id === bioterioActivo || !bioterioActivo),
      camadas.filter(c => c.bioterio_id === bioterioActivo || !bioterioActivo),
      incidentes,
      fCoefMapa
    ),
    [animales, camadas, incidentes, fCoefMapa, bioterioActivo]
  )

  // Tasa de fallos y supervivencia para índice global
  const tasas = useMemo(() => {
    const cam = camadas.filter(c => !bioterioActivo || c.bioterio_id === bioterioActivo)
    const total = cam.filter(c => c.fecha_copula).length
    const fallos = cam.filter(c => c.failure_flag).length
    const conDestete = cam.filter(c => c.total_crias > 0 && c.total_destetados != null)
    const sr = conDestete.length > 0
      ? conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length
      : 0.85
    return { tasaFallos: total > 0 ? fallos / total : 0, tasaSupervivencia: sr }
  }, [camadas, bioterioActivo])

  const indiceGlobal = useMemo(() =>
    calcularIndiceEstabilidadGlobal({
      indiceSanitario: indices.global,
      indiceAmbiental,
      indiceRiesgoGenetico: indiceGenetico,
      tasaFallos: tasas.tasaFallos,
      tasaSupervivencia: tasas.tasaSupervivencia,
    }),
    [indices.global, indiceAmbiental, indiceGenetico, tasas]
  )

  // ── Alertas genealógicas ───────────────────────────────────────────────────
  const alertasGenea = useMemo(() =>
    detectarAlertasGenealógicas(incidentes, animales),
    [incidentes, animales]
  )

  // ── Patrones, correlaciones, motor causal, alertas, recomendaciones ────────
  const patrones = useMemo(() => detectarPatrones(incidentes), [incidentes])

  const correlaciones = useMemo(() =>
    detectarCorrelaciones(temperaturas, incidentes, camadas, 7),
    [temperaturas, incidentes, camadas]
  )

  const correlacionesMultiventana = useMemo(() =>
    detectarCorrelacionesMultiventana(temperaturas, incidentes, camadas),
    [temperaturas, incidentes, camadas]
  )

  const bloqueos = useMemo(() =>
    generarBloqueosSanitarios(animales, camadas, incidentes, fCoefMapa, bioterioActivo),
    [animales, camadas, incidentes, fCoefMapa, bioterioActivo]
  )

  const causas = useMemo(() =>
    generarMotorCausalCompleto(incidentes, temperaturas, camadas, animales, bioterioActivo, fCoefMapa),
    [incidentes, temperaturas, camadas, animales, bioterioActivo, fCoefMapa]
  )

  const deterioro = useMemo(() =>
    detectarDeterioroProgresivo(camadas, incidentes, bioterioActivo, animales, bio),
    [camadas, incidentes, bioterioActivo, animales, bio]
  )

  const decisionesConcretas = useMemo(() =>
    generarDecisionesHoy(incidentes, temperaturas, camadas, animales, bioterioActivo, fCoefMapa),
    [incidentes, temperaturas, camadas, animales, bioterioActivo, fCoefMapa]
  )

  const alertas = useMemo(() =>
    generarAlertasSanitarias(incidentes, temperaturas, camadas, animales, bioterioActivo),
    [incidentes, temperaturas, camadas, animales, bioterioActivo]
  )

  const recomendaciones = useMemo(() =>
    generarRecomendacionesHoy(incidentes, temperaturas, camadas, animales, bioterioActivo),
    [incidentes, temperaturas, camadas, animales, bioterioActivo]
  )

  // ── Tendencias ─────────────────────────────────────────────────────────────
  const { meses: mesesTend, tendencia } = useMemo(
    () => generarTendencias(incidentes, periodoTendencia),
    [incidentes, periodoTendencia]
  )

  // ── Filtros ────────────────────────────────────────────────────────────────
  const incidentesFiltrados = useMemo(() => {
    return incidentes.filter(i => {
      if (filtroColonia !== 'todos'   && i.bioterio_id    !== filtroColonia)   return false
      if (filtroCategoria !== 'todos' && i.tipo_categoria !== filtroCategoria) return false
      if (filtroSeveridad !== 'todos' && i.severidad      !== filtroSeveridad) return false
      if (filtroEstado === 'abiertos'  && i.resuelto)  return false
      if (filtroEstado === 'resueltos' && !i.resuelto) return false
      return true
    })
  }, [incidentes, filtroColonia, filtroCategoria, filtroSeveridad, filtroEstado])

  // ── Stats rápidos ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const abiertos  = incidentes.filter(i => !i.resuelto)
    const graves    = abiertos.filter(i => i.severidad === 'grave')
    const hace30    = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const recientes = incidentes.filter(i => i.fecha >= hace30)
    return { total: incidentes.length, abiertos: abiertos.length, graves: graves.length, recientes: recientes.length }
  }, [incidentes])

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function toggleResuelto(inc) {
    await editarIncidente({ ...inc, resuelto: !inc.resuelto })
  }

  const nvGlobal    = nivelIndice(indiceGlobal)
  const nvAmbiental = nivelAmbiental(indiceAmbiental)
  const nvGenetico  = nivelRiesgoGenetico(indiceGenetico)
  const alertasUrgentes = alertas.filter(a => ['urgente', 'critico'].includes(a.nivel))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#ff6b80', boxShadow: '0 0 8px rgba(255,107,128,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Vigilancia sanitaria</h1>
            <p className="text-xs mt-0.5 font-mono" style={{ color: tema.textMuted }}>
              {stats.abiertos} abiertos · {stats.graves} graves · {alertas.length} alertas activas ·{' '}
              <span style={{ color: colorBioterio(bioterioActivo) }}>{labelBioterio(bioterioActivo)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['lista', 'ambiental', 'causal', 'estadisticas']).map(t => (
            <button key={t} onClick={() => setTabActivo(t)}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: tabActivo === t ? 'rgba(64,196,255,0.15)' : 'rgba(64,196,255,0.06)',
                border: `1px solid ${tabActivo === t ? 'rgba(64,196,255,0.4)' : 'rgba(64,196,255,0.15)'}`,
                color: tabActivo === t ? '#40c4ff' : '#4a5f7a',
              }}>
              {t === 'lista' ? '📋 Lista' : t === 'ambiental' ? '🌡️ Ambiente' : t === 'causal' ? '🔬 Motor causal' : '📊 Estadísticas'}
            </button>
          ))}
          <button onClick={() => { setIncAEditar(null); setModal(true) }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,107,128,0.12)', border: '1.5px solid rgba(255,107,128,0.35)', color: tema.red }}>
            <Plus size={13} style={{ display: 'inline', marginRight: 5 }} />
            Nuevo incidente
          </button>
        </div>
      </div>

      {/* ── ALERTAS MULTI-NIVEL ── */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
            Alertas activas ({alertas.length})
          </div>
          {alertas.map((a, i) => {
            const nv = NIVEL_ALERTA[a.nivel] ?? NIVEL_ALERTA.atencion
            const bg = a.nivel === 'urgente'
              ? 'rgba(40,0,0,0.9)'
              : a.nivel === 'critico' ? 'rgba(255,107,128,0.08)'
              : a.nivel === 'importante' ? 'rgba(255,152,0,0.07)' : 'rgba(255,179,0,0.07)'
            const border = a.nivel === 'urgente'
              ? 'rgba(255,107,128,0.5)'
              : a.nivel === 'critico' ? 'rgba(255,107,128,0.3)'
              : a.nivel === 'importante' ? 'rgba(255,152,0,0.3)' : 'rgba(255,179,0,0.25)'
            return (
              <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <span className="text-base shrink-0 mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2" style={{ color: nv.color }}>
                    {nv.emoji} {a.titulo}
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: `${nv.color}15`, border: `1px solid ${nv.color}35`, color: nv.color }}>
                      {nv.label}
                    </span>
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>{a.descripcion}</div>
                  {a.accion && (
                    <div className="text-xs mt-1 font-semibold" style={{ color: nv.color }}>→ {a.accion}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ALERTAS GENEALÓGICAS ── */}
      {alertasGenea.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(13,21,40,0.85)', border: '1px solid rgba(167,139,250,0.3)' }}>
          <div className="px-5 py-3 flex items-center gap-2 justify-between"
            style={{ borderBottom: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">🧬</span>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
                Alertas genealógicas ({alertasGenea.length})
              </span>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
              {alertasGenea.filter(a => a.nivel === 'critico').length} crítica{alertasGenea.filter(a => a.nivel === 'critico').length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {alertasGenea.map((a, i) => {
              const colores = {
                critico:  { c: '#ff6b80', bg: 'rgba(255,107,128,0.06)', b: 'rgba(255,107,128,0.2)' },
                alerta:   { c: '#ffb300', bg: 'rgba(255,179,0,0.05)',   b: 'rgba(255,179,0,0.2)' },
                atencion: { c: '#a78bfa', bg: 'rgba(167,139,250,0.04)', b: 'rgba(167,139,250,0.15)' },
              }
              const cl = colores[a.nivel] ?? colores.atencion
              const icon = a.tipo === 'malformacion_repetida' ? '🧬'
                : a.tipo === 'linea_problematica' ? '⚠️'
                : a.tipo === 'padre_implicado' ? '♂'
                : a.tipo === 'madre_implicada' ? '♀'
                : a.tipo === 'animal_implicado' ? '🐭'
                : a.tipo === 'familia_implicada' ? '👨‍👩‍👧'
                : '⚠️'
              return (
                <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                  <span className="text-base shrink-0 mt-0.5" style={{ color: cl.c }}>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: cl.c }}>{a.mensaje}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>→ {a.accion}</div>
                    {a.animal && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{ background: a.animal.sexo === 'macho' ? 'rgba(64,196,255,0.1)' : 'rgba(167,139,250,0.1)', color: a.animal.sexo === 'macho' ? '#40c4ff' : '#a78bfa', border: `1px solid ${a.animal.sexo === 'macho' ? 'rgba(64,196,255,0.3)' : 'rgba(167,139,250,0.3)'}` }}>
                          {a.animal.sexo === 'macho' ? '♂' : '♀'} {a.animal.codigo}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{ background: cl.bg, color: cl.c, border: `1px solid ${cl.b}` }}>
                          {a.incidentes.length} incidente{a.incidentes.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-mono px-2 py-0.5 rounded-full self-center"
                    style={{ background: cl.bg, color: cl.c, border: `1px solid ${cl.b}` }}>
                    {a.nivel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── DASHBOARD DE ÍNDICES ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Índice global de estabilidad */}
        <div className="rounded-2xl p-4 flex flex-col items-center gap-1 col-span-2 md:col-span-1"
          style={{ background: `${nvGlobal.bg}`, border: `1px solid ${nvGlobal.border}` }}>
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: tema.textMuted }}>Estabilidad global</div>
          <div className="text-5xl font-bold font-mono" style={{ color: nvGlobal.color, lineHeight: 1.05 }}>{indiceGlobal}</div>
          <div className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: nvGlobal.bg, color: nvGlobal.color, border: `1px solid ${nvGlobal.border}` }}>
            {nvGlobal.emoji} {nvGlobal.label}
          </div>
          <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>Sanitario + Ambiental + Genético</div>
        </div>

        {/* Índice sanitario */}
        {(() => {
          const nv = nivelIndice(indices.global)
          return (
            <div className="rounded-2xl p-4 flex flex-col items-center gap-1"
              style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,107,128,0.2)' }}>
              <div className="text-xs font-mono flex items-center gap-1" style={{ color: tema.red }}>
                <Activity size={10} /> Sanitario
              </div>
              <div className="text-3xl font-bold font-mono" style={{ color: nv.color }}>{indices.global}</div>
              <div className="text-xs font-mono" style={{ color: nv.color }}>{nv.emoji} {nv.label}</div>
            </div>
          )
        })()}

        {/* Índice ambiental */}
        <div className="rounded-2xl p-4 flex flex-col items-center gap-1"
          style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,179,0,0.2)' }}>
          <div className="text-xs font-mono flex items-center gap-1" style={{ color: tema.amber }}>
            <Thermometer size={10} /> Ambiental
          </div>
          <div className="text-3xl font-bold font-mono" style={{ color: nvAmbiental.color }}>{indiceAmbiental}</div>
          <div className="text-xs font-mono" style={{ color: nvAmbiental.color }}>{nvAmbiental.emoji} {nvAmbiental.label}</div>
          {statsTempActivo.promedio && (
            <div className="text-xs font-mono" style={{ color: tema.textMuted }}>Promedio: {statsTempActivo.promedio}°C</div>
          )}
        </div>

        {/* Índice de riesgo genético */}
        <div className="rounded-2xl p-4 flex flex-col items-center gap-1"
          style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div className="text-xs font-mono flex items-center gap-1" style={{ color: '#a78bfa' }}>
            <Dna size={10} /> Riesgo genético
          </div>
          <div className="text-3xl font-bold font-mono" style={{ color: nvGenetico.color }}>{indiceGenetico}</div>
          <div className="text-xs font-mono" style={{ color: nvGenetico.color }}>{nvGenetico.emoji} {nvGenetico.label}</div>
          <div className="text-xs font-mono" style={{ color: '#3d5068' }}>0=bajo · 100=alto</div>
        </div>
      </div>

      {/* ── DISTRIBUCIÓN TÉRMICA — TIEMPO EN RANGO ── */}
      {(() => {
        const exp = calcularExposicionTermica(temperaturas, bioterioActivo, 30)
        if (!exp) return null
        const nvA = nivelAmbiental(indiceAmbiental)
        const rangos = [
          { key: 'frio_extremo', label: '<18°C',   sub: 'Frío extremo',  color: tema.blue, umbralAlerta: 5  },
          { key: 'frio',         label: '18–20°C', sub: 'Frío leve',     color: '#a78bfa', umbralAlerta: 15 },
          { key: 'normal',       label: '20–24°C', sub: '✓ Óptimo',      color: tema.accent, umbralAlerta: null },
          { key: 'calor',        label: '24–26°C', sub: 'Calor leve',    color: tema.amber, umbralAlerta: 20 },
          { key: 'calor_extremo',label: '>26°C',   sub: 'Calor extremo', color: tema.red, umbralAlerta: 5  },
        ]
        return (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,179,0,0.2)' }}>
            <div className="px-5 py-3 flex items-center gap-3"
              style={{ borderBottom: '1px solid rgba(255,179,0,0.1)', background: 'rgba(255,179,0,0.04)' }}>
              <Thermometer size={13} style={{ color: tema.amber }} />
              <div className="flex-1">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.amber }}>
                  Exposición térmica real — tiempo en cada rango
                </span>
                <span className="ml-2 text-xs font-mono" style={{ color: '#3d5068' }}>
                  Últimos 30 días · {exp.totalRegistros} registros
                </span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded-lg"
                style={{ background: nvA.bg, border: `1px solid ${nvA.border}`, color: nvA.color }}>
                {nvA.emoji} {nvA.label}
              </span>
              {exp.confianza === 'baja' && (
                <span className="text-xs font-mono px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: tema.amber }}>
                  ⚠ Baja confianza — pocos datos de min/máx
                </span>
              )}
            </div>

            <div className="px-5 py-4 space-y-2.5">
              {rangos.map(r => {
                const pct = exp[r.key] ?? 0
                const esProblema = r.umbralAlerta !== null && pct >= r.umbralAlerta
                return (
                  <div key={r.key} className="flex items-center gap-3">
                    {/* Etiqueta */}
                    <div className="w-16 shrink-0 text-right">
                      <div className="text-xs font-mono font-bold" style={{ color: r.color }}>{r.label}</div>
                    </div>
                    {/* Barra */}
                    <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(pct, pct > 0 ? 0.5 : 0)}%`,
                          background: r.color,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    {/* Porcentaje */}
                    <div className="w-12 shrink-0 text-right">
                      <span className="text-xs font-mono font-bold" style={{ color: pct > 0 ? r.color : '#3d5068' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    {/* Sub-label + alerta */}
                    <div className="w-28 shrink-0">
                      <span className="text-xs font-mono" style={{ color: esProblema ? r.color : '#4a5f7a' }}>
                        {r.sub}
                        {esProblema && ' ⚠'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Nota explicativa */}
            <div className="px-5 py-2.5 text-xs font-mono space-y-0.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#3d5068', background: 'rgba(255,255,255,0.01)' }}>
              <div>
                <span style={{ color: tema.textMuted }}>Temperatura predominante (70%)</span> = medición del día.
                <span style={{ color: tema.textMuted }}> Mínima (15%) y máxima (15%)</span> = excursiones breves del termostato.
              </div>
              <div>
                Picos de 5–15 min (min/máx) pesan poco. Lo que importa es dónde está{' '}
                <span style={{ color: tema.textPrimary }}>la mayor parte del tiempo</span>.
                {exp.conDatosMinMax < exp.totalRegistros && (
                  <span style={{ color: tema.textMuted }}> · {exp.conDatosMinMax}/{exp.totalRegistros} registros con min/máx</span>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── ÏNDICE SANITARIO POR COLONIA ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,107,128,0.2)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(255,107,128,0.1)', background: 'rgba(255,107,128,0.04)' }}>
          <Activity size={13} style={{ color: tema.red }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.red }}>Índice sanitario por colonia</span>
          <span className="ml-auto text-xs font-mono" style={{ color: tema.textMuted }}>Incidentes activos + historial reproductivo</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {BIOTERIOS_SIN_TODOS.map(b => {
            const sc = indices.porColonia[b.id] ?? 100
            const nv = nivelIndice(sc)
            const abiertos = incidentes.filter(i => i.bioterio_id === b.id && !i.resuelto).length
            return (
              <div key={b.id} className="px-4 py-4 text-center flex flex-col items-center gap-1">
                <div className="text-xs font-mono" style={{ color: b.color }}>{b.label}</div>
                <div className="text-2xl font-bold font-mono" style={{ color: nv.color, lineHeight: 1.1 }}>{sc}</div>
                <div className="text-xs font-mono" style={{ color: nv.color }}>{nv.emoji} {nv.label}</div>
                {abiertos > 0 && (
                  <div className="text-xs font-mono" style={{ color: tema.textMuted }}>{abiertos} abiertos</div>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-5 py-2 text-xs font-mono grid grid-cols-3 gap-x-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#3d5068' }}>
          <span>🟢 80–100: Estable</span>
          <span>🟡 50–79: Atención</span>
          <span>🔴 &lt;50: Riesgo</span>
        </div>
      </div>

      {/* ── ¿QUÉ HACER HOY? ── */}
      {recomendaciones.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(0,230,118,0.2)' }}>
          <div className="px-5 py-3 flex items-center gap-2"
            style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.04)' }}>
            <Zap size={13} style={{ color: tema.accent }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.accent }}>¿Qué hacer hoy?</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {recomendaciones.map((r, i) => {
              const colores = { urgente: '#ff6b80', alta: '#ffb300', media: '#40c4ff', info: '#00e676' }
              const col = colores[r.prioridad] ?? '#8a9bb0'
              return (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-base shrink-0">{r.icono}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold" style={{ color: col }}>{r.accion}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>{r.motivo}</div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0 self-center"
                    style={{ background: `${col}12`, border: `1px solid ${col}35`, color: col }}>
                    {r.prioridad}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ALERTAS DE PATRONES ── */}
      {patrones.length > 0 && (
        <div className="space-y-2">
          {patrones.map((p, i) => (
            <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{
                background: p.nivel === 'critico' ? 'rgba(255,107,128,0.08)' : 'rgba(255,179,0,0.07)',
                border: `1px solid ${p.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.25)'}`,
              }}>
              <AlertTriangle size={14} style={{ color: p.nivel === 'critico' ? '#ff6b80' : '#ffb300', flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: p.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>
                  ⚠ Patrón repetitivo: {p.tipoLabel}
                </div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>
                  {p.count} incidentes en 90 días
                  {p.animalesU >= 2 ? ` · ${p.animalesU} animales` : ''}
                  {p.camadasU >= 2 ? ` · ${p.camadasU} camadas` : ''}
                  {p.bioteriosU.length > 1 ? ` · en ${p.bioteriosU.map(labelBioterio).join(', ')}` : ''}
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: p.nivel === 'critico' ? 'rgba(255,107,128,0.1)' : 'rgba(255,179,0,0.1)',
                  color: p.nivel === 'critico' ? '#ff6b80' : '#ffb300',
                  border: `1px solid ${p.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.25)'}`,
                }}>
                {p.nivel === 'critico' ? '🔴 Crítico' : '🟡 Alerta'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: AMBIENTAL */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'ambiental' && (
        <div className="space-y-4">
          {/* Panel temperatura resumido */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,179,0,0.25)' }}>
            <div className="px-5 py-3 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,179,0,0.12)', background: 'rgba(255,179,0,0.05)' }}>
              <Thermometer size={13} style={{ color: tema.amber }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.amber }}>Estabilidad ambiental — {labelBioterio(bioterioActivo)}</span>
              <span className="ml-auto text-xs font-mono" style={{ color: tema.textMuted }}>Últimos 30 días · Rango ideal 20–24°C</span>
            </div>

            {/* Índice ambiental por bioterio */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {BIOTERIOS_SIN_TODOS.map(b => {
                const idx = calcularIndiceAmbiental(temperaturas, b.id)
                const nv  = nivelAmbiental(idx)
                const st  = statsTemperatura(temperaturas, b.id)
                return (
                  <div key={b.id} className="px-4 py-4 text-center flex flex-col items-center gap-1">
                    <div className="text-xs font-mono" style={{ color: b.color }}>{b.label}</div>
                    <div className="text-2xl font-bold font-mono" style={{ color: nv.color }}>{idx}</div>
                    <div className="text-xs font-mono" style={{ color: nv.color }}>{nv.emoji} {nv.label}</div>
                    {st.promedio != null && (
                      <div className="text-xs font-mono" style={{ color: tema.textMuted }}>
                        {st.promedio}°C prom · {st.diasRiesgo}d riesgo
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Stats del bioterio activo */}
            {statsTempActivo.total > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-0 divide-x divide-y md:divide-y-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.06)' }}>
                {[
                  { label: 'Promedio', val: statsTempActivo.promedio ? `${statsTempActivo.promedio}°C` : '—', color: tema.blue },
                  { label: 'Mínima',  val: statsTempActivo.min != null ? `${statsTempActivo.min}°C` : '—',  color: tema.blue },
                  { label: 'Máxima',  val: statsTempActivo.max != null ? `${statsTempActivo.max}°C` : '—',  color: statsTempActivo.max > 25 ? '#ff6b80' : '#40c4ff' },
                  { label: 'Días riesgo',   val: statsTempActivo.diasRiesgo,   color: statsTempActivo.diasRiesgo > 0 ? '#ff6b80' : '#00e676' },
                  { label: 'Días atención', val: statsTempActivo.diasAtencion, color: statsTempActivo.diasAtencion > 0 ? '#ffb300' : '#00e676' },
                ].map(k => (
                  <div key={k.label} className="px-4 py-3 text-center">
                    <div className="text-lg font-bold font-mono" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>{k.label}</div>
                  </div>
                ))}
              </div>
            )}

            {statsTempActivo.total === 0 && (
              <div className="px-5 py-6 text-center text-xs font-mono" style={{ color: tema.textMuted }}>
                Sin datos de temperatura registrados para {labelBioterio(bioterioActivo)}.<br />
                Registrá temperatura en la sección Temperatura.
              </div>
            )}
          </div>

          {/* Clasificación de rangos */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-bold text-xs text-white">Clasificación de rangos de temperatura</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {[
                { label: '20–24°C', desc: 'Rango ideal — sin estrés fisiológico', color: tema.accent, emoji: '🟢 Normal' },
                { label: '18–20°C / 24–26°C', desc: 'Rango de atención — monitorear de cerca', color: tema.amber, emoji: '🟡 Atención' },
                { label: '<18°C / >26°C', desc: 'Riesgo — impacto reproductivo y bienestar animal', color: tema.red, emoji: '🔴 Riesgo' },
              ].map(r => (
                <div key={r.label} className="px-5 py-4">
                  <div className="text-sm font-bold font-mono" style={{ color: r.color }}>{r.emoji}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: r.color }}>{r.label}</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Correlaciones ambiente → incidentes */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-bold text-xs text-white flex-1">
                Correlaciones detectadas — temperatura vs reproducción/mortalidad
              </div>
              <button onClick={() => setMostrarCorrel(v => !v)}
                className="text-xs font-mono px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: tema.textMuted }}>
                {mostrarCorrel ? <EyeOff size={10} /> : <Eye size={10} />}
                {mostrarCorrel ? 'Ocultar' : 'Ver todas'}
              </button>
            </div>
            {correlaciones.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs font-mono" style={{ color: tema.textMuted }}>
                No se detectaron correlaciones significativas con los datos actuales.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {(mostrarCorrel ? correlaciones : correlaciones.slice(0, 3)).map((c, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <span className="text-base shrink-0">{c.icono}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>
                        {c.label}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>{c.descripcion}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{ background: c.nivel === 'critico' ? 'rgba(255,107,128,0.1)' : 'rgba(255,179,0,0.1)', color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300', border: `1px solid ${c.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.25)'}` }}>
                        {c.fuerza}
                      </div>
                      <div className="text-xs font-mono mt-1" style={{ color: '#3d5068' }}>{c.evidencia}</div>
                    </div>
                  </div>
                ))}
                {!mostrarCorrel && correlaciones.length > 3 && (
                  <div className="px-5 py-2 text-center">
                    <button onClick={() => setMostrarCorrel(true)}
                      className="text-xs font-mono" style={{ color: tema.blue }}>
                      Ver {correlaciones.length - 3} más...
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: MOTOR CAUSAL */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'causal' && (
        <div className="space-y-4">
          {/* Header explicativo */}
          <div className="rounded-xl px-5 py-3 text-xs font-mono"
            style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)', color: '#6a8099' }}>
            🔬 El motor causal cruza incidentes, temperatura, reproducción y genética para detectar patrones y proponer hipótesis sobre por qué están ocurriendo los problemas. No reemplaza el criterio del veterinario — es una guía de diagnóstico.
          </div>

          {/* ── Decisiones concretas del día ─────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(64,196,255,0.25)' }}>
            <div className="px-5 py-3 flex items-center gap-2 justify-between"
              style={{ borderBottom: '1px solid rgba(64,196,255,0.12)', background: 'rgba(64,196,255,0.04)' }}>
              <div className="flex items-center gap-2">
                <Zap size={13} style={{ color: tema.blue }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.blue }}>
                  ¿Qué hacer hoy?
                </span>
              </div>
              {decisionesConcretas.length > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(64,196,255,0.1)', color: tema.blue }}>
                  {decisionesConcretas.filter(d => d.prioridad <= 1).length} urgente{decisionesConcretas.filter(d => d.prioridad <= 1).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="px-5 py-4 space-y-2">
              {decisionesConcretas.length === 0 || (decisionesConcretas.length === 1 && decisionesConcretas[0].prioridad === 99) ? (
                <div className="text-xs font-mono py-2" style={{ color: tema.accent }}>
                  🟢 Sin acciones urgentes hoy — la colonia está dentro de los parámetros normales.
                </div>
              ) : (
                decisionesConcretas.filter(d => d.prioridad !== 99).map((d, i) => {
                  const colores = {
                    urgente:    { c: '#ff6b80', bg: 'rgba(255,107,128,0.08)', b: 'rgba(255,107,128,0.25)' },
                    critico:    { c: '#ff6b80', bg: 'rgba(255,107,128,0.06)', b: 'rgba(255,107,128,0.2)' },
                    importante: { c: '#ffb300', bg: 'rgba(255,179,0,0.06)',   b: 'rgba(255,179,0,0.2)' },
                    atencion:   { c: '#40c4ff', bg: 'rgba(64,196,255,0.05)',  b: 'rgba(64,196,255,0.18)' },
                    info:       { c: '#8a9bb0', bg: 'rgba(138,155,176,0.04)', b: 'rgba(138,155,176,0.15)' },
                  }
                  const cl = colores[d.nivel] ?? colores.info
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl text-xs font-mono"
                      style={{ background: cl.bg, border: `1px solid ${cl.b}` }}>
                      <span className="text-base shrink-0">{d.icono}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold mb-0.5" style={{ color: cl.c }}>{d.accion}</div>
                        <div style={{ color: '#6a8099' }}>{d.motivo}</div>
                      </div>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-xs"
                        style={{ background: cl.bg, color: cl.c, border: `1px solid ${cl.b}` }}>
                        {d.nivel}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Auditoría reproductiva contextual ────────────────────────── */}
          {deterioro && (() => {
            const colorNiv = deterioro.nivel === 'critico' ? '#ff6b80' : deterioro.nivel === 'alerta' ? '#ffb300' : '#00e676'
            const bordeNiv = deterioro.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : deterioro.nivel === 'alerta' ? 'rgba(255,179,0,0.25)' : 'rgba(0,230,118,0.2)'
            const bgNiv    = deterioro.nivel === 'critico' ? 'rgba(255,107,128,0.04)' : deterioro.nivel === 'alerta' ? 'rgba(255,179,0,0.03)' : 'rgba(0,230,118,0.03)'

            // Badge de confianza
            const confColor = deterioro.confianzaGlobal === 'alta' ? '#00e676'
              : deterioro.confianzaGlobal === 'media' ? '#ffb300'
              : '#ff9100'
            const confLabel = deterioro.confianzaGlobal === 'alta' ? '🟢 Confianza alta'
              : deterioro.confianzaGlobal === 'media' ? '🟡 Confianza media'
              : deterioro.confianzaGlobal === 'sin_datos' ? '⚪ Sin datos suficientes'
              : '🟠 Confianza baja'

            return (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(13,21,40,0.9)', border: `1px solid ${bordeNiv}` }}>

                {/* Header */}
                <div className="px-5 py-3 flex items-center gap-2 justify-between"
                  style={{ borderBottom: `1px solid ${bordeNiv.replace('0.3', '0.12').replace('0.25', '0.1').replace('0.2', '0.1')}`, background: bgNiv }}>
                  <div className="flex items-center gap-2">
                    {deterioro.tieneDeterioro
                      ? <TrendingDown size={13} style={{ color: colorNiv }} />
                      : <TrendingUp size={13} style={{ color: colorNiv }} />}
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: colorNiv }}>
                      {deterioro.tieneDeterioro ? 'Deterioro progresivo detectado' : 'Auditoría reproductiva'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{ background: `${confColor}18`, color: confColor, border: `1px solid ${confColor}40` }}>
                      {confLabel}
                    </span>
                    {deterioro.ventanaSignificativa && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{ background: `${colorNiv}18`, color: colorNiv, border: `1px solid ${colorNiv}40` }}>
                        ventana {deterioro.ventanaSignificativa}d
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">

                  {/* Resumen contextual */}
                  <div className="text-xs font-mono px-3 py-2.5 rounded-xl"
                    style={{ background: `${colorNiv}0d`, border: `1px solid ${colorNiv}25`, color: tema.textPrimary }}>
                    {deterioro.resumen}
                  </div>

                  {/* Contexto activo (si hay actividad reproductiva en curso) */}
                  {deterioro.hayContextoActivo && !deterioro.tieneDeterioro && (
                    <div className="flex flex-wrap gap-2">
                      {deterioro.contextoActivo.partosPendientes > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                          style={{ background: 'rgba(64,196,255,0.1)', color: tema.blue, border: '1px solid rgba(64,196,255,0.25)' }}>
                          🍼 {deterioro.contextoActivo.partosPendientes} parto(s) en espera
                        </span>
                      )}
                      {deterioro.contextoActivo.lactanciasActivas > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                          ♀ {deterioro.contextoActivo.lactanciasActivas} en cría
                        </span>
                      )}
                      {deterioro.contextoActivo.apareamientosActivos > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                          style={{ background: 'rgba(0,230,118,0.1)', color: tema.accent, border: '1px solid rgba(0,230,118,0.25)' }}>
                          ⚡ {deterioro.contextoActivo.apareamientosActivos} apareamiento(s) activo(s)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Señales activas (solo si hay deterioro) */}
                  {deterioro.tieneDeterioro && deterioro.señalesActivas.length > 0 && (
                    <div className="space-y-1.5">
                      {deterioro.señalesActivas.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono" style={{ color: tema.textPrimary }}>
                          <span style={{ color: tema.red }}>↘</span>
                          {s}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tabla de ventanas */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr style={{ color: tema.textMuted }}>
                          <th className="text-left py-1.5 pr-3">Ventana</th>
                          <th className="text-right py-1.5 px-2">Fertilidad</th>
                          <th className="text-right py-1.5 px-2">Confianza</th>
                          <th className="text-right py-1.5 px-2">Supervivencia</th>
                          <th className="text-right py-1.5 px-2">Fallos</th>
                          <th className="text-right py-1.5 px-2">Malform.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(deterioro.ventanas ?? []).map((v, i) => {
                          const confC = v.confianza === 'alta' ? '#00e676'
                            : v.confianza === 'media' ? '#ffb300'
                            : v.confianza === 'espera' ? '#40c4ff'
                            : '#ff9100'
                          const fertDisplay = v.fertilidad !== null
                            ? `${(v.fertilidad * 100).toFixed(0)}%`
                            : v.confianza === 'espera' ? '⏳ espera'
                            : v.confianza === 'sin_datos' ? '—'
                            : 'insuf.'
                          const fertColor = v.fertilidad !== null && v.fertilidad < 0.6
                            ? '#ff6b80'
                            : v.fertilidad === null ? '#4a5f7a'
                            : '#c9d4e0'
                          return (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: tema.textSecondary }}>
                              <td className="py-1.5 pr-3 text-white font-bold">{v.dias}d</td>
                              <td className="text-right px-2" style={{ color: fertColor }}>{fertDisplay}</td>
                              <td className="text-right px-2">
                                <span style={{ color: confC, fontSize: 10 }}>{v.confianza}</span>
                                {v.contexto && (
                                  <span className="ml-1" style={{ color: tema.textMuted, fontSize: 9 }} title={v.contexto}>ℹ</span>
                                )}
                              </td>
                              <td className="text-right px-2" style={{ color: v.supervivencia !== null && v.supervivencia < 0.65 ? '#ff6b80' : '#c9d4e0' }}>
                                {v.supervivencia !== null ? `${(v.supervivencia * 100).toFixed(0)}%` : '—'}
                              </td>
                              <td className="text-right px-2" style={{ color: v.fallos > 3 ? '#ffb300' : '#c9d4e0' }}>
                                {v.fallos}
                              </td>
                              <td className="text-right px-2" style={{ color: v.malformaciones > 2 ? '#ffb300' : '#c9d4e0' }}>
                                {v.malformaciones}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Patrón conclusivo */}
                  {deterioro.patron && (
                    <div className="text-xs font-mono px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(255,107,128,0.06)', border: '1px solid rgba(255,107,128,0.15)', color: tema.textSecondary }}>
                      📊 {deterioro.patron}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Causas detectadas */}
          {causas.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(0,230,118,0.03)', border: '1px dashed rgba(0,230,118,0.2)' }}>
              <div className="text-4xl mb-3">🟢</div>
              <div className="font-semibold text-sm text-white mb-1">Sin problemas detectados</div>
              <div className="text-xs" style={{ color: tema.textMuted }}>No se encontraron patrones problemáticos con los datos actuales.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {causas.map((c, i) => (
                <div key={i} className="rounded-2xl overflow-hidden"
                  style={{
                    background: c.nivel === 'critico' ? 'rgba(255,107,128,0.06)' : 'rgba(255,179,0,0.05)',
                    border: `1px solid ${c.nivel === 'critico' ? 'rgba(255,107,128,0.25)' : 'rgba(255,179,0,0.2)'}`,
                  }}>
                  {/* Header causa */}
                  <div className="px-5 py-3 flex items-center gap-3"
                    style={{ borderBottom: `1px solid ${c.nivel === 'critico' ? 'rgba(255,107,128,0.12)' : 'rgba(255,179,0,0.1)'}` }}>
                    <span className="text-xl">{c.icon}</span>
                    <div className="flex-1">
                      <div className="font-bold text-sm" style={{ color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>
                        {c.problema}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>{c.descripcion}</div>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: c.nivel === 'critico' ? 'rgba(255,107,128,0.12)' : 'rgba(255,179,0,0.1)',
                        color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300',
                        border: `1px solid ${c.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.25)'}`,
                      }}>
                      {c.nivel === 'critico' ? '🔴 Crítico' : '🟡 Alerta'}
                    </span>
                  </div>

                  <div className="px-5 py-4 grid md:grid-cols-2 gap-4">
                    {/* Factores */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                        Factores probables
                      </div>
                      <div className="space-y-1">
                        {c.factores.map((f, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs font-mono"
                            style={{ color: tema.textPrimary }}>
                            <span style={{ color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>●</span>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recomendación */}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                        Acción recomendada
                      </div>
                      <div className="text-xs font-mono leading-relaxed" style={{ color: tema.textSecondary }}>
                        {c.recomendacion}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Índice de riesgo genético */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(167,139,250,0.25)' }}>
            <div className="px-5 py-3 flex items-center gap-2"
              style={{ borderBottom: '1px solid rgba(167,139,250,0.12)', background: 'rgba(167,139,250,0.04)' }}>
              <Dna size={13} style={{ color: '#a78bfa' }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Índice de riesgo genético</span>
            </div>
            <div className="px-5 py-5 flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold font-mono" style={{ color: nvGenetico.color }}>{indiceGenetico}</div>
                <div className="text-xs font-mono mt-1 px-2 py-0.5 rounded-full inline-block"
                  style={{ background: nvGenetico.bg, color: nvGenetico.color, border: `1px solid ${nvGenetico.border}` }}>
                  {nvGenetico.emoji} {nvGenetico.label}
                </div>
              </div>
              <div className="flex-1 space-y-2 text-xs font-mono" style={{ color: '#6a8099' }}>
                <div>• <span style={{ color: tema.textPrimary }}>0–20:</span> Riesgo bajo — genética saludable</div>
                <div>• <span style={{ color: tema.textPrimary }}>21–50:</span> Riesgo moderado — vigilar malformaciones</div>
                <div>• <span style={{ color: tema.textPrimary }}>51–100:</span> Riesgo alto — revisar consanguinidad y renovar reproductores</div>
                <div className="mt-2" style={{ color: tema.textMuted }}>Factores: F promedio · malformaciones (180d) · fallos reproductivos (90d) · supervivencia al destete</div>
              </div>
            </div>
          </div>

          {/* Bloqueos sanitarios — reproductores en riesgo */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.9)', border: `1px solid ${bloqueos.totalBloqueados > 0 ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.2)'}` }}>
            <div className="px-5 py-3 flex items-center gap-2 justify-between"
              style={{ borderBottom: `1px solid ${bloqueos.totalBloqueados > 0 ? 'rgba(255,107,128,0.12)' : 'rgba(255,179,0,0.1)'}`, background: `${bloqueos.totalBloqueados > 0 ? 'rgba(255,107,128,0.04)' : 'rgba(255,179,0,0.03)'}` }}>
              <div className="flex items-center gap-2">
                <Zap size={13} style={{ color: bloqueos.totalBloqueados > 0 ? '#ff6b80' : '#ffb300' }} />
                <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: bloqueos.totalBloqueados > 0 ? '#ff6b80' : '#ffb300' }}>
                  Reproductores en riesgo
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                {bloqueos.totalBloqueados > 0 && (
                  <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,107,128,0.12)', color: tema.red, border: '1px solid rgba(255,107,128,0.3)' }}>
                    🔴 {bloqueos.totalBloqueados} bloqueado{bloqueos.totalBloqueados !== 1 ? 's' : ''}
                  </span>
                )}
                {bloqueos.totalAdvertencias > 0 && (
                  <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,179,0,0.1)', color: tema.amber, border: '1px solid rgba(255,179,0,0.25)' }}>
                    🟡 {bloqueos.totalAdvertencias} advertencia{bloqueos.totalAdvertencias !== 1 ? 's' : ''}
                  </span>
                )}
                {bloqueos.totalBloqueados === 0 && bloqueos.totalAdvertencias === 0 && (
                  <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,230,118,0.08)', color: tema.accent, border: '1px solid rgba(0,230,118,0.2)' }}>
                    🟢 Sin bloqueos
                  </span>
                )}
              </div>
            </div>

            {bloqueos.animalesBloqueados.size === 0 ? (
              <div className="px-5 py-4 text-xs font-mono" style={{ color: tema.textMuted }}>
                Todos los reproductores activos pasan los criterios de elegibilidad reproductiva.
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                {/* Lista de animales bloqueados/advertidos */}
                {[...bloqueos.animalesBloqueados.values()].sort((a, b) => {
                  const ord = { critico: 0, alerta: 1 }
                  return (ord[a.nivel] ?? 2) - (ord[b.nivel] ?? 2)
                }).map((b, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{
                      background: b.esBloqueo ? 'rgba(255,107,128,0.06)' : 'rgba(255,179,0,0.04)',
                      border: `1px solid ${b.esBloqueo ? 'rgba(255,107,128,0.2)' : 'rgba(255,179,0,0.15)'}`,
                    }}>
                    <div className="shrink-0 text-base">{b.esBloqueo ? '🚫' : '⚠️'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: b.esBloqueo ? '#ff6b80' : '#ffb300' }}>
                          {b.animal.codigo}
                        </span>
                        <span className="text-xs font-mono" style={{ color: tema.textMuted }}>
                          {b.animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{ background: b.esBloqueo ? 'rgba(255,107,128,0.12)' : 'rgba(255,179,0,0.1)', color: b.esBloqueo ? '#ff6b80' : '#ffb300' }}>
                          {b.accion}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {b.motivos.map((m, j) => (
                          <div key={j} className="text-xs font-mono" style={{ color: '#6a8099' }}>
                            · {m}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Acciones sugeridas */}
                {bloqueos.accionesSugeridas.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>
                      Acciones automáticas sugeridas
                    </div>
                    {bloqueos.accionesSugeridas.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-mono"
                        style={{
                          background: a.nivel === 'urgente' ? 'rgba(255,107,128,0.08)' : a.nivel === 'critico' ? 'rgba(255,107,128,0.05)' : 'rgba(255,179,0,0.04)',
                          border: `1px solid ${a.nivel === 'urgente' ? 'rgba(255,107,128,0.25)' : 'rgba(255,107,128,0.15)'}`,
                          color: tema.textPrimary,
                        }}>
                        <span>{a.nivel === 'urgente' ? '⚫' : a.nivel === 'critico' ? '🔴' : '🟡'}</span>
                        <span className="flex-1">{a.accion}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Correlaciones multi-ventana */}
          {correlacionesMultiventana.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,179,0,0.2)' }}>
              <div className="px-5 py-3 flex items-center gap-2"
                style={{ borderBottom: '1px solid rgba(255,179,0,0.1)', background: 'rgba(255,179,0,0.03)' }}>
                <Activity size={13} style={{ color: tema.amber }} />
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.amber }}>
                  Correlaciones detectadas (1–90 días)
                </span>
                <span className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,179,0,0.1)', color: tema.amber }}>
                  {correlacionesMultiventana.length} señal{correlacionesMultiventana.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="px-5 py-4 space-y-2">
                {correlacionesMultiventana.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs font-mono py-2"
                    style={{ borderBottom: i < correlacionesMultiventana.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span className="text-base shrink-0">{c.icono}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold" style={{ color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>{c.label}</div>
                      <div className="mt-0.5" style={{ color: '#6a8099' }}>{c.descripcion}</div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="px-1.5 py-0.5 rounded text-xs"
                        style={{ background: c.nivel === 'critico' ? 'rgba(255,107,128,0.12)' : 'rgba(255,179,0,0.1)', color: c.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>
                        {c.fuerza}
                      </span>
                      <span style={{ color: '#3d5068' }}>ventana {c.ventana}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: ESTADÍSTICAS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'estadisticas' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total registros',      v: stats.total,     color: tema.textSecondary },
              { label: 'Abiertos',             v: stats.abiertos,  color: tema.amber },
              { label: 'Graves sin resolver',  v: stats.graves,    color: tema.red },
              { label: 'Últimos 30 días',      v: stats.recientes, color: tema.blue },
            ].map(k => (
              <div key={k.label} className="rounded-xl px-4 py-4 text-center"
                style={{ background: 'rgba(13,21,40,0.7)', border: `1px solid ${k.color}25` }}>
                <div className="text-3xl font-bold font-mono" style={{ color: k.color, lineHeight: 1 }}>{k.v}</div>
                <div className="text-xs font-mono mt-1" style={{ color: tema.textMuted }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Gráfico tendencias */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex-1">
                <div className="font-bold text-xs text-white">Incidentes por mes — últimos {periodoTendencia} meses</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>Graves · Moderados · Leves</div>
              </div>
              <div className="flex items-center gap-1 mr-2">
                {[6, 12].map(p => (
                  <button key={p} onClick={() => setPeriodoTendencia(p)}
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      background: periodoTendencia === p ? 'rgba(64,196,255,0.15)' : 'rgba(64,196,255,0.04)',
                      border: `1px solid ${periodoTendencia === p ? 'rgba(64,196,255,0.35)' : 'rgba(64,196,255,0.1)'}`,
                      color: periodoTendencia === p ? '#40c4ff' : '#4a5f7a',
                    }}>
                    {p}m
                  </button>
                ))}
              </div>
              <div className="text-xs font-mono flex items-center gap-1"
                style={{ color: tendencia > 0 ? '#ff6b80' : tendencia < 0 ? '#00e676' : '#4a5f7a' }}>
                {tendencia > 0 ? <TrendingUp size={11} /> : tendencia < 0 ? <TrendingDown size={11} /> : null}
                {tendencia > 0 ? `+${tendencia}%` : tendencia < 0 ? `${tendencia}%` : 'Sin cambio'} vs mes anterior
              </div>
            </div>
            <div className="px-2 py-3" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mesesTend} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ color: tema.textPrimary }}
                    formatter={(v, n) => [v, n === 'graves' ? 'Graves' : n === 'moderados' ? 'Moderados' : 'Leves']} />
                  <Bar dataKey="graves"    fill="rgba(255,107,128,0.7)" radius={[2,2,0,0]} stackId="a" />
                  <Bar dataKey="moderados" fill="rgba(255,152,0,0.6)"   radius={[2,2,0,0]} stackId="a" />
                  <Bar dataKey="leves"     fill="rgba(255,179,0,0.4)"   radius={[2,2,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribución por categoría */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-bold text-xs text-white">Distribución por categoría</div>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {Object.entries(CATEGORIAS).map(([catId, cat]) => {
                const n = incidentes.filter(i => i.tipo_categoria === catId).length
                const pct = incidentes.length > 0 ? Math.round((n / incidentes.length) * 100) : 0
                return (
                  <div key={catId} className="flex items-center gap-3 text-xs font-mono">
                    <span style={{ width: 16 }}>{cat.icon}</span>
                    <span className="w-24 shrink-0" style={{ color: cat.color }}>{cat.label}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color, transition: 'width 0.4s' }} />
                    </div>
                    <span className="w-8 text-right font-bold text-white">{n}</span>
                    <span style={{ color: '#3d5068' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: LISTA */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tabActivo === 'lista' && (
        <>
          {/* Filtros */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {LISTA_BIOTERIOS.map(b => {
                const activo = filtroColonia === b.id
                const count  = b.id === 'todos'
                  ? incidentes.filter(i => filtroEstado === 'abiertos' ? !i.resuelto : filtroEstado === 'resueltos' ? i.resuelto : true).length
                  : incidentes.filter(i => i.bioterio_id === b.id && (filtroEstado === 'abiertos' ? !i.resuelto : filtroEstado === 'resueltos' ? i.resuelto : true)).length
                return (
                  <button key={b.id} onClick={() => setFiltroColonia(b.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    style={{
                      background: activo ? `${b.color}22` : 'rgba(13,21,40,0.6)',
                      border: activo ? `1px solid ${b.color}55` : '1px solid rgba(30,51,82,0.6)',
                      color: activo ? b.color : '#4a5f7a',
                    }}>
                    {b.label}
                    {count > 0 && <span className="font-mono">{count}</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFiltroCategoria('todos')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: filtroCategoria === 'todos' ? 'rgba(138,155,176,0.2)' : 'rgba(13,21,40,0.6)', border: filtroCategoria === 'todos' ? '1px solid rgba(138,155,176,0.4)' : '1px solid rgba(30,51,82,0.6)', color: filtroCategoria === 'todos' ? '#8a9bb0' : '#4a5f7a' }}>
                Todas las categorías
              </button>
              {Object.entries(CATEGORIAS).map(([catId, cat]) => (
                <button key={catId} onClick={() => setFiltroCategoria(catId)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: filtroCategoria === catId ? `${cat.color}22` : 'rgba(13,21,40,0.6)', border: filtroCategoria === catId ? `1px solid ${cat.color}55` : '1px solid rgba(30,51,82,0.6)', color: filtroCategoria === catId ? cat.color : '#4a5f7a' }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.1)', alignSelf: 'center' }}>|</span>
              {['todos', 'abiertos', 'resueltos'].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: filtroEstado === e ? 'rgba(255,255,255,0.1)' : 'rgba(13,21,40,0.6)', border: filtroEstado === e ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(30,51,82,0.6)', color: filtroEstado === e ? '#c9d4e0' : '#4a5f7a' }}>
                  {e === 'todos' ? 'Todos' : e === 'abiertos' ? '🔴 Abiertos' : '✅ Resueltos'}
                </button>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.1)', alignSelf: 'center' }}>|</span>
              {SEVERIDADES.map(s => (
                <button key={s.id} onClick={() => setFiltroSeveridad(prev => prev === s.id ? 'todos' : s.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: filtroSeveridad === s.id ? s.bg : 'rgba(13,21,40,0.6)', border: filtroSeveridad === s.id ? `1px solid ${s.color}55` : '1px solid rgba(30,51,82,0.6)', color: filtroSeveridad === s.id ? s.color : '#4a5f7a' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de incidentes */}
          {incidentesFiltrados.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(255,107,128,0.03)', border: '1px dashed rgba(255,107,128,0.2)' }}>
              <div className="text-4xl mb-3">📋</div>
              <div className="font-semibold text-sm text-white mb-1">Sin incidentes</div>
              <div className="text-xs" style={{ color: tema.textMuted }}>No hay registros con los filtros actuales.</div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}>
              <div className="hidden md:grid px-5 py-2 text-xs font-semibold uppercase tracking-widest"
                style={{ gridTemplateColumns: '90px 60px 90px 110px 1fr 80px', gap: '8px', borderBottom: '1px solid rgba(30,51,82,0.6)', color: tema.textMuted, background: 'rgba(0,0,0,0.15)' }}>
                <span>Fecha</span><span>Colonia</span><span>Categoría</span><span>Tipo</span><span>Descripción</span><span>Estado</span>
              </div>

              <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.4)' }}>
                {incidentesFiltrados.map((inc) => {
                  const catInfo = getCategoriaInfo(inc.tipo_categoria)
                  const sevInfo = getSeveridadInfo(inc.severidad)
                  const tipoLbl = getTipoLabel(inc.tipo_categoria, inc.tipo_incidente)
                  const animal  = animales.find(a => a.id === inc.animal_id)
                  const camada  = camadas.find(c => c.id === inc.camada_id)
                  const padre   = inc.padre_id ? animales.find(a => a.id === inc.padre_id) : null
                  const madre   = inc.madre_id ? animales.find(a => a.id === inc.madre_id) : null
                  const tieneGenea = padre || madre || inc.linea_genetica

                  return (
                    <div key={inc.id}
                      className="px-5 py-3.5 flex flex-col md:grid md:items-start gap-2 group hover:bg-white/[0.01]"
                      style={{ gridTemplateColumns: '90px 60px 90px 110px 1fr 80px', opacity: inc.resuelto ? 0.6 : 1 }}>

                      <div className="font-mono text-xs font-semibold" style={{ color: tema.amber }}>
                        {formatFecha(inc.fecha)}
                      </div>

                      <div>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${colorBioterio(inc.bioterio_id)}18`, color: colorBioterio(inc.bioterio_id), border: `1px solid ${colorBioterio(inc.bioterio_id)}35` }}>
                          {labelBioterio(inc.bioterio_id)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-mono" style={{ color: catInfo.color }}>
                        <span>{catInfo.icon}</span><span>{catInfo.label}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold" style={{ color: tema.textPrimary }}>{tipoLbl}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded-full self-start"
                          style={{ background: sevInfo.bg, color: sevInfo.color, border: `1px solid ${sevInfo.color}40` }}>
                          {sevInfo.label}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm leading-relaxed" style={{ color: inc.resuelto ? '#4a5f7a' : '#c9d4e0' }}>
                          {inc.descripcion || <span style={{ color: '#3d5068' }}>Sin descripción</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {animal && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: animal.sexo === 'macho' ? 'rgba(64,196,255,0.08)' : 'rgba(167,139,250,0.08)', color: animal.sexo === 'macho' ? '#40c4ff' : '#a78bfa', border: `1px solid ${animal.sexo === 'macho' ? 'rgba(64,196,255,0.25)' : 'rgba(167,139,250,0.25)'}` }}>
                              {animal.sexo === 'macho' ? '♂' : '♀'} {animal.codigo ?? `#${animal.id.slice(0,6)}`}
                            </span>
                          )}
                          {camada && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,179,0,0.08)', color: tema.amber, border: '1px solid rgba(255,179,0,0.25)' }}>
                              Camada {formatFecha(camada.fecha_copula, { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                          {tieneGenea && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                              🧬 {[padre && `♂${padre.codigo}`, madre && `♀${madre.codigo}`, inc.linea_genetica].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {inc.duracion_dias && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(138,155,176,0.08)', color: tema.textSecondary, border: '1px solid rgba(138,155,176,0.2)' }}>
                              {inc.duracion_dias}d
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button onClick={() => toggleResuelto(inc)}
                          title={inc.resuelto ? 'Marcar como abierto' : 'Marcar como resuelto'}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono"
                          style={{ background: inc.resuelto ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${inc.resuelto ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.1)'}`, color: inc.resuelto ? '#00e676' : '#4a5f7a' }}>
                          <CheckCircle size={10} />
                          {inc.resuelto ? 'Resuelto' : 'Resolver'}
                        </button>
                        <button onClick={() => { setIncAEditar(inc); setModal(true) }}
                          className="px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100"
                          style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)', color: tema.blue }}>
                          ✎
                        </button>
                        <button onClick={() => setConfirmarElim(inc)}
                          className="px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100"
                          style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.2)', color: tema.red }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal nuevo / editar incidente ── */}
      {modal && (
        <ModalIncidente
          inicial={incAEditar}
          animales={animales}
          camadas={camadas}
          bioterioActivo={bioterioActivo}
          onGuardar={async (datos) => {
            if (incAEditar) {
              await editarIncidente({ ...incAEditar, ...datos })
            } else {
              await agregarIncidente(datos)
            }
            setModal(false)
            setIncAEditar(null)
          }}
          onCerrar={() => { setModal(false); setIncAEditar(null) }}
        />
      )}

      {/* ── Modal confirmar eliminar ── */}
      {confirmarElim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmarElim(null) }}>
          <div className="rounded-2xl p-6 space-y-4 w-full max-w-sm"
            style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(255,61,87,0.3)' }}>
            <div className="text-center space-y-2">
              <div className="text-3xl">🗑️</div>
              <div className="font-bold text-white text-sm">Eliminar incidente</div>
              <div className="text-xs px-3 py-2 rounded-lg text-left leading-relaxed"
                style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.15)', color: tema.textSecondary }}>
                {confirmarElim.descripcion?.slice(0, 100) || '(sin descripción)'}
              </div>
              <p className="text-xs" style={{ color: tema.textMuted }}>Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarElim(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: tema.textSecondary }}>
                Cancelar
              </button>
              <button onClick={() => { eliminarIncidente(confirmarElim.id); setConfirmarElim(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.35)', color: tema.red }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal: Registrar / editar incidente ───────────────────────────────────────

// Categorías que habilitan selector de múltiples animales
const CATS_MULTI_ANIMAL = ['sanitario', 'reproductivo']

function ModalIncidente({ inicial, animales, camadas, bioterioActivo, onGuardar, onCerrar }) {
  const [fecha,          setFecha]          = useState(inicial?.fecha ?? hoy())
  const [categoria,      setCategoria]      = useState(inicial?.tipo_categoria ?? '')
  const [tipoInc,        setTipoInc]        = useState(inicial?.tipo_incidente ?? '')
  const [severidad,      setSeveridad]      = useState(inicial?.severidad ?? 'leve')
  const [descripcion,    setDescripcion]    = useState(inicial?.descripcion ?? '')
  const [camadaId,       setCamadaId]       = useState(inicial?.camada_id ?? '')
  const [padreId,        setPadreId]        = useState(inicial?.padre_id ?? '')
  const [madreId,        setMadreId]        = useState(inicial?.madre_id ?? '')
  const [duracionDias,   setDuracionDias]   = useState(inicial?.duracion_dias ?? '')
  const [lineaGenetica,  setLineaGenetica]  = useState(inicial?.linea_genetica ?? '')
  const [guardando,      setGuardando]      = useState(false)
  const [error,          setError]          = useState('')

  // Multi-select de animales implicados (para Sanitario / Reproductivo)
  const [animalesImplicados, setAnimalesImplicados] = useState(() => {
    if (inicial?.animal_ids?.length > 0) return new Set(inicial.animal_ids)
    if (inicial?.animal_id) return new Set([inicial.animal_id])
    return new Set()
  })
  const [busquedaAnimal, setBusquedaAnimal] = useState('')

  const tipos      = categoria ? getTiposForm(categoria) : []
  const esEdicion  = !!inicial
  const esGenealogica  = CATS_GENEALOGICAS.includes(categoria)
  const esMultiAnimal  = CATS_MULTI_ANIMAL.includes(categoria)

  const machos     = animales.filter(a => a.sexo === 'macho' && ['activo','en_apareamiento','en_cria'].includes(a.estado))
  const hembras    = animales.filter(a => a.sexo === 'hembra' && ['activo','en_apareamiento','en_cria'].includes(a.estado))
  const animalesDisp = animales.filter(a => ['activo','en_apareamiento','en_cria'].includes(a.estado))
  const camadasDisp  = camadas.filter(c => !c.failure_flag && c.fecha_nacimiento && !c.fecha_destete)

  // Lista de animales para el panel multi-select, filtrada por búsqueda
  const animalesFiltrados = useMemo(() => {
    const q = busquedaAnimal.trim().toLowerCase()
    const ACTIVOS = ['activo', 'en_apareamiento', 'en_cria']
    const todos = [...animales].sort((a, b) => {
      const aAct = ACTIVOS.includes(a.estado)
      const bAct = ACTIVOS.includes(b.estado)
      if (aAct && !bAct) return -1
      if (!aAct && bAct) return 1
      return (a.codigo ?? '').localeCompare(b.codigo ?? '')
    })
    if (!q) return todos
    return todos.filter(a =>
      (a.codigo ?? '').toLowerCase().includes(q) ||
      a.id.toLowerCase().startsWith(q)
    )
  }, [animales, busquedaAnimal])

  // Cuando se selecciona una camada: auto-poblar padre/madre en vínculo genealógico
  useEffect(() => {
    if (!camadaId) return
    const camada = camadas.find(c => c.id === camadaId)
    if (!camada) return
    if (camada.id_padre && !padreId) setPadreId(camada.id_padre)
    if (camada.id_madre && !madreId) setMadreId(camada.id_madre)
  }, [camadaId]) // eslint-disable-line

  function toggleAnimal(id) {
    setAnimalesImplicados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function guardar(e) {
    e.preventDefault()
    if (!categoria) { setError('Seleccioná una categoría.'); return }
    if (!tipoInc)   { setError('Seleccioná el tipo de incidente.'); return }
    setGuardando(true); setError('')
    const idsArray = [...animalesImplicados]
    try {
      await onGuardar({
        fecha,
        tipo_categoria: categoria,
        tipo_incidente: tipoInc,
        severidad,
        descripcion:    descripcion.trim() || null,
        animal_id:      idsArray[0] ?? null,
        animal_ids:     idsArray,
        camada_id:      camadaId      || null,
        padre_id:       padreId       || null,
        madre_id:       madreId       || null,
        duracion_dias:  duracionDias !== '' ? Number(duracionDias) : null,
        linea_genetica: lineaGenetica.trim() || null,
        resuelto:       inicial?.resuelto ?? false,
      })
    } catch {
      setError('No se pudo guardar. Verificá la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  const inputBase = {
    background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)',
    color: tema.textPrimary, borderRadius: '10px', padding: '9px 12px',
    fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'monospace',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90dvh] overflow-y-auto"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(255,107,128,0.3)', boxShadow: '0 0 60px rgba(255,107,128,0.1)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,107,128,0.12)', background: 'rgba(255,107,128,0.04)' }}>
          <div className="font-bold text-white text-sm">
            {esEdicion ? '✎ Editar incidente' : '🩺 Registrar incidente'}
          </div>
          <div className="text-xs font-mono mt-1" style={{ color: tema.textMuted }}>
            {esEdicion ? 'Modificá los datos del incidente' : `Registrando en: ${labelBioterio(bioterioActivo)}`}
          </div>
        </div>

        <form onSubmit={guardar} className="px-6 py-5 space-y-4">

          {/* Fecha + Severidad + Duración */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required style={inputBase} />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>
                Duración <span style={{ color: '#3d5068' }}>(días, opc.)</span>
              </label>
              <input type="number" min="1" value={duracionDias}
                onChange={e => setDuracionDias(e.target.value)}
                placeholder="—" style={inputBase} />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>Severidad</label>
              <div className="flex flex-col gap-1">
                {SEVERIDADES.map(s => (
                  <button key={s.id} type="button" onClick={() => setSeveridad(s.id)}
                    className="py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: severidad === s.id ? s.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${severidad === s.id ? s.color + '55' : 'rgba(255,255,255,0.1)'}`, color: severidad === s.id ? s.color : '#4a5f7a' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>Categoría</label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
              {Object.entries(CATEGORIAS_FORM).map(([catId, cat]) => (
                <button key={catId} type="button"
                  onClick={() => { setCategoria(prev => prev === catId ? '' : catId); setTipoInc(''); setPadreId(''); setMadreId('') }}
                  className="py-2 px-1.5 rounded-xl text-xs font-semibold text-center"
                  style={{ background: categoria === catId ? `${cat.color}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${categoria === catId ? cat.color + '55' : 'rgba(255,255,255,0.1)'}`, color: categoria === catId ? cat.color : '#4a5f7a' }}>
                  <div className="text-base">{cat.icon}</div>
                  <div className="leading-tight mt-0.5">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de incidente */}
          {categoria && tipos.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>Tipo de incidente</label>
              <div className="grid grid-cols-2 gap-1">
                {tipos.map(t => (
                  <button key={t.id} type="button" onClick={() => setTipoInc(t.id)}
                    className="text-left py-1.5 px-3 rounded-lg text-xs font-mono"
                    style={{ background: tipoInc === t.id ? `${getCategoriaInfo(categoria).color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${tipoInc === t.id ? getCategoriaInfo(categoria).color + '40' : 'rgba(255,255,255,0.07)'}`, color: tipoInc === t.id ? getCategoriaInfo(categoria).color : '#8a9bb0' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Asociación genealógica — solo Sanitario y Reproductivo */}
          {esGenealogica && (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
                🧬 Vínculo genealógico <span className="font-mono font-normal normal-case" style={{ color: tema.textMuted }}>(opcional — mejora las alertas)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono mb-1" style={{ color: '#6a8099' }}>♂ Padre implicado</label>
                  <select value={padreId} onChange={e => setPadreId(e.target.value)} style={inputBase}>
                    <option value="">— Ninguno —</option>
                    {machos.map(a => (
                      <option key={a.id} value={a.id}>♂ {a.codigo ?? `#${a.id.slice(0,6)}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono mb-1" style={{ color: '#6a8099' }}>♀ Madre implicada</label>
                  <select value={madreId} onChange={e => setMadreId(e.target.value)} style={inputBase}>
                    <option value="">— Ninguna —</option>
                    {hembras.map(a => (
                      <option key={a.id} value={a.id}>♀ {a.codigo ?? `#${a.id.slice(0,6)}`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: '#6a8099' }}>Línea genética <span style={{ color: '#3d5068' }}>(ej: BALB/c F12, C57 lote 3)</span></label>
                <input type="text" value={lineaGenetica} onChange={e => setLineaGenetica(e.target.value)}
                  placeholder="Nombre de la línea o lote..." style={inputBase} />
              </div>
            </div>
          )}

          {/* ── Animales implicados (multi-select) — solo Sanitario / Reproductivo ── */}
          {esMultiAnimal ? (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(255,107,128,0.04)', border: '1px solid rgba(255,107,128,0.2)' }}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.red }}>
                  🐭 Animales implicados
                  {animalesImplicados.size > 0 && (
                    <span className="ml-2 font-mono font-normal normal-case" style={{ color: '#ff9100' }}>
                      {animalesImplicados.size} seleccionado{animalesImplicados.size !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {animalesImplicados.size > 0 && (
                  <button type="button" onClick={() => setAnimalesImplicados(new Set())}
                    className="text-xs font-mono px-2 py-0.5 rounded-lg"
                    style={{ color: tema.textMuted, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    Limpiar todo
                  </button>
                )}
              </div>

              {/* Chips de seleccionados */}
              {animalesImplicados.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...animalesImplicados].map(id => {
                    const a = animales.find(x => x.id === id)
                    if (!a) return null
                    const col = a.sexo === 'macho' ? '#40c4ff' : '#a78bfa'
                    return (
                      <span key={id} className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{ background: `${col}18`, color: col, border: `1px solid ${col}40` }}>
                        {a.sexo === 'macho' ? '♂' : '♀'} {a.codigo ?? a.id.slice(0, 6)}
                        <button type="button" onClick={() => toggleAnimal(id)}
                          style={{ color: 'inherit', opacity: 0.7, marginLeft: 2, lineHeight: 1 }}>×</button>
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Búsqueda */}
              <input type="text" value={busquedaAnimal}
                onChange={e => setBusquedaAnimal(e.target.value)}
                placeholder="Buscar por código (ej: H31, M8)..."
                style={inputBase} />

              {/* Lista scrolleable */}
              <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {animalesFiltrados.length === 0 ? (
                  <div className="py-3 text-center text-xs font-mono" style={{ color: tema.textMuted }}>
                    Sin animales que coincidan.
                  </div>
                ) : animalesFiltrados.map(a => {
                  const sel = animalesImplicados.has(a.id)
                  const col = a.sexo === 'macho' ? '#40c4ff' : '#a78bfa'
                  const ACTIVOS = ['activo', 'en_apareamiento', 'en_cria']
                  const estaActivo = ACTIVOS.includes(a.estado)
                  return (
                    <button key={a.id} type="button" onClick={() => toggleAnimal(a.id)}
                      className="w-full text-left py-1.5 px-3 rounded-lg text-xs font-mono flex items-center gap-2"
                      style={{ background: sel ? `${col}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${sel ? col + '40' : 'rgba(255,255,255,0.07)'}`, color: sel ? col : '#8a9bb0' }}>
                      <span style={{ color: col, minWidth: 12 }}>{a.sexo === 'macho' ? '♂' : '♀'}</span>
                      <span style={{ color: sel ? col : '#c9d4e0', fontWeight: 600 }}>{a.codigo ?? `#${a.id.slice(0, 6)}`}</span>
                      <span style={{ opacity: 0.5, fontSize: 11 }}>
                        {a.estado === 'en_apareamiento' ? 'en apareamiento' : a.estado === 'en_cria' ? 'en cría' : a.estado}
                      </span>
                      {!estaActivo && (
                        <span className="text-xs px-1 rounded"
                          style={{ background: 'rgba(255,255,255,0.06)', color: tema.textMuted, fontSize: 10 }}>
                          inactivo
                        </span>
                      )}
                      {sel && <span className="ml-auto font-bold" style={{ color: col }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              {/* Camada implicada */}
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: '#6a8099' }}>
                  Camada implicada <span style={{ color: '#3d5068' }}>(opc. — auto-completa padre/madre)</span>
                </label>
                <select value={camadaId} onChange={e => setCamadaId(e.target.value)} style={inputBase}>
                  <option value="">— Ninguna —</option>
                  {camadasDisp.map(c => (
                    <option key={c.id} value={c.id}>
                      Cópula {formatFecha(c.fecha_copula, { day: '2-digit', month: '2-digit' })}
                      {c.total_crias ? ` · ${c.total_crias} crías` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            /* ── Single select para otras categorías ── */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>
                  Animal directo <span style={{ color: '#3d5068' }}>(opc.)</span>
                </label>
                <select
                  value={[...animalesImplicados][0] ?? ''}
                  onChange={e => setAnimalesImplicados(e.target.value ? new Set([e.target.value]) : new Set())}
                  style={inputBase}>
                  <option value="">— Ninguno —</option>
                  {animalesDisp.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.sexo === 'macho' ? '♂' : '♀'} {a.codigo ?? `#${a.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>
                  Camada <span style={{ color: '#3d5068' }}>(opc.)</span>
                </label>
                <select value={camadaId} onChange={e => setCamadaId(e.target.value)} style={inputBase}>
                  <option value="">— Ninguna —</option>
                  {camadasDisp.map(c => (
                    <option key={c.id} value={c.id}>
                      Cópula {formatFecha(c.fecha_copula, { day: '2-digit', month: '2-digit' })}
                      {c.total_crias ? ` · ${c.total_crias} crías` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textMuted }}>
              Notas adicionales <span style={{ color: '#3d5068' }}>(opcional)</span>
            </label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Qué se observó, medidas tomadas, contexto..."
              rows={2} style={{ ...inputBase, resize: 'vertical', lineHeight: '1.5' }} />
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: tema.red }}>
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: tema.textMuted }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,107,128,0.14)', border: '1.5px solid rgba(255,107,128,0.45)', color: tema.red, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : esEdicion ? '✓ Actualizar' : '✓ Registrar incidente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
