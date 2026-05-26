// ─────────────────────────────────────────────────────────────────────────────
// Auditoria.jsx — Comparación histórica e inteligencia automática de la colonia
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import {
  getPresetsPeriodo, filtrarPorPeriodo,
  calcularMetricasReproduccion, calcularMetricasProduccion,
  calcularMetricasSanidad, calcularMetricasAmbiente, calcularMetricasGenetica,
  calcularIndiceGlobal, calcularIndiceEstabilidad,
  compararPeriodos, detectarPatronesGlobales,
  motorCausalHistorico, generarResumenAutomatico, generarRecomendaciones,
} from '../utils/auditoria'

// ── Helpers visuales ─────────────────────────────────────────────────────────
const BIOTERIOS = [
  { id: 'ratas',           label: 'Ratas',         icon: '🐀' },
  { id: 'ratones_balbc',   label: 'BALB/c',        icon: '🐁' },
  { id: 'ratones_c57',     label: 'C57BL/6',       icon: '🐁' },
  { id: 'ratones_hibridos', label: 'Híbridos F1',  icon: '🧬' },
]

function señalColor(senal) {
  if (!senal || senal === 'neutro' || senal === 'estable') return '#8a9bb0'
  if (senal.includes('mejora'))    return '#00e676'
  if (senal.includes('deterioro')) return '#ff6b80'
  return '#8a9bb0'
}

function señalIcono(senal, esNumero = true) {
  if (!senal || senal === 'neutro') return '—'
  if (senal === 'estable')          return '→'
  if (senal.includes('mejora'))     return '↑'
  if (senal.includes('deterioro'))  return '↓'
  return '→'
}

function DeltaBadge({ comp, formato = (v) => v?.toFixed != null ? v.toFixed(1) : String(v ?? '—') }) {
  if (!comp) return null
  const color = señalColor(comp.senal)
  const icono = señalIcono(comp.senal)
  const sign  = comp.delta > 0 ? '+' : ''
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {icono} {sign}{formato(comp.delta)}
    </span>
  )
}

function MetricaRow({ label, comp, formato, invertir }) {
  if (!comp) return null
  const color = señalColor(comp.senal)
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs flex-1 min-w-0 truncate" style={{ color: '#8a9bb0' }}>{label}</span>
      <span className="text-xs font-mono w-14 text-right" style={{ color: '#c9d4e0' }}>
        {formato ? formato(comp.A) : (comp.A?.toFixed?.(1) ?? '—')}
      </span>
      <span className="text-xs w-4 text-center" style={{ color: '#4a5f7a' }}>→</span>
      <span className="text-xs font-mono w-14 text-right" style={{ color: '#c9d4e0' }}>
        {formato ? formato(comp.B) : (comp.B?.toFixed?.(1) ?? '—')}
      </span>
      <div className="w-16 flex justify-end">
        <DeltaBadge comp={comp} formato={formato ? (v) => formato(Math.abs(v)) : undefined} />
      </div>
    </div>
  )
}

function GaugeCircle({ valor, label, color = '#00e676' }) {
  const pct   = Math.max(0, Math.min(100, valor ?? 0))
  const r     = 38
  const circ  = 2 * Math.PI * r
  const stroke = circ * (1 - pct / 100)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={stroke}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)`, transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono" style={{ color }}>{pct}</span>
          <span className="text-xs" style={{ color: '#4a5f7a' }}>/ 100</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-center" style={{ color: '#8a9bb0' }}>{label}</span>
    </div>
  )
}

function Seccion({ titulo, children }) {
  const { tema } = useTheme()
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${tema.bgCardBorde}`, background: 'rgba(0,230,118,0.03)' }}>
        <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>{titulo}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

const TABS_LABELS = ['Reproducción', 'Producción', 'Sanidad', 'Ambiente', 'Genética']
const NIVEL_COLORES = { positivo: '#00e676', alerta: '#ffb300', critico: '#ff6b80', riesgo: '#ff6b80', estable: '#8a9bb0' }

// ── Componente principal ──────────────────────────────────────────────────────
export default function Auditoria() {
  const { tema } = useTheme()
  const { bioterioActivo } = useBioterioActivo()
  const presets = getPresetsPeriodo()

  // Bioterio seleccionado para la auditoría (por defecto el activo)
  const [bioterio, setBioterio]   = useState(bioterioActivo ?? 'ratas')
  const [presetId, setPresetId]   = useState('trimestre')
  const [customA, setCustomA]     = useState({ desde: '', hasta: '' })
  const [customB, setCustomB]     = useState({ desde: '', hasta: '' })
  const [tab, setTab]             = useState(0)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError]         = useState(null)
  const [resultado, setResultado] = useState(null)

  // Períodos efectivos
  const preset = presets.find(p => p.id === presetId)
  const periodosEfectivos = presetId === 'custom'
    ? { desdeA: customA.desde, hastaA: customA.hasta, desdeB: customB.desde, hastaB: customB.hasta }
    : preset
      ? { desdeA: preset.desdeA, hastaA: preset.hastaA, desdeB: preset.desdeB, hastaB: preset.hastaB }
      : null

  // ── Fetch + cálculo ──────────────────────────────────────────────────────────
  const analizar = useCallback(async () => {
    if (!periodosEfectivos?.desdeA || !periodosEfectivos?.desdeB) {
      setError('Seleccioná un período válido para comparar.')
      return
    }
    setAnalizando(true)
    setError(null)
    setResultado(null)

    try {
      const { desdeA, hastaA, desdeB, hastaB } = periodosEfectivos

      // Fetch en paralelo de todas las tablas para ambos períodos
      const [
        { data: todasCamadas },
        { data: todosAnimales },
        { data: sacA },  { data: sacB },
        { data: entA },  { data: entB },
        { data: incA },  { data: incB },
        { data: tempA }, { data: tempB },
      ] = await Promise.all([
        supabase.from('camadas').select('*').eq('bioterio_id', bioterio).order('fecha_copula'),
        supabase.from('animales').select('*').eq('bioterio_id', bioterio),
        supabase.from('sacrificios').select('*').eq('bioterio_id', bioterio).gte('fecha', desdeA).lte('fecha', hastaA),
        supabase.from('sacrificios').select('*').eq('bioterio_id', bioterio).gte('fecha', desdeB).lte('fecha', hastaB),
        supabase.from('entregas').select('*').eq('bioterio_id', bioterio).gte('fecha', desdeA).lte('fecha', hastaA),
        supabase.from('entregas').select('*').eq('bioterio_id', bioterio).gte('fecha', desdeB).lte('fecha', hastaB),
        supabase.from('incidentes').select('*').eq('bioterio_id', bioterio).gte('fecha', desdeA).lte('fecha', hastaA),
        supabase.from('incidentes').select('*').eq('bioterio_id', bioterio).gte('fecha', desdeB).lte('fecha', hastaB),
        supabase.from('temperature_logs').select('*').gte('date', desdeA).lte('date', hastaA).order('date'),
        supabase.from('temperature_logs').select('*').gte('date', desdeB).lte('date', hastaB).order('date'),
      ])

      // Filtrar camadas por período usando fecha_copula
      const camA = filtrarPorPeriodo(todasCamadas || [], 'fecha_copula', desdeA, hastaA)
      const camB = filtrarPorPeriodo(todasCamadas || [], 'fecha_copula', desdeB, hastaB)

      // Calcular métricas para cada período
      const reproA    = calcularMetricasReproduccion(camA)
      const reproB    = calcularMetricasReproduccion(camB)
      const prodA     = calcularMetricasProduccion(camA, sacA || [], entA || [])
      const prodB     = calcularMetricasProduccion(camB, sacB || [], entB || [])
      const sanidadA  = calcularMetricasSanidad(incA || [], camA, bioterio)
      const sanidadB  = calcularMetricasSanidad(incB || [], camB, bioterio)
      const ambienteA = calcularMetricasAmbiente(tempA || [], bioterio)
      const ambienteB = calcularMetricasAmbiente(tempB || [], bioterio)
      const geneticaA = calcularMetricasGenetica(todosAnimales || [], todasCamadas || [])
      const geneticaB = geneticaA // Genética es estado actual — no varía por período

      const igA = calcularIndiceGlobal({ repro: reproA, prod: prodA, sanidad: sanidadA, ambiente: ambienteA })
      const igB = calcularIndiceGlobal({ repro: reproB, prod: prodB, sanidad: sanidadB, ambiente: ambienteB })
      const ieA = calcularIndiceEstabilidad({ repro: reproA, sanidad: sanidadA, ambiente: ambienteA, genetica: geneticaA })
      const ieB = calcularIndiceEstabilidad({ repro: reproB, sanidad: sanidadB, ambiente: ambienteB, genetica: geneticaB })

      const mA = { repro: reproA, prod: prodA, sanidad: sanidadA, ambiente: ambienteA, genetica: geneticaA, indiceGlobal: igA, indiceEstabilidad: ieA }
      const mB = { repro: reproB, prod: prodB, sanidad: sanidadB, ambiente: ambienteB, genetica: geneticaB, indiceGlobal: igB, indiceEstabilidad: ieB }

      const comp         = compararPeriodos(mA, mB)
      const patrones     = detectarPatronesGlobales(comp)
      const hipotesis    = motorCausalHistorico(comp)
      const resumen      = generarResumenAutomatico(comp, hipotesis)
      const recomendaciones = generarRecomendaciones(comp, hipotesis)

      setResultado({ mA, mB, comp, patrones, hipotesis, resumen, recomendaciones, periodoA: { desde: desdeA, hasta: hastaA }, periodoB: { desde: desdeB, hasta: hastaB } })
    } catch (err) {
      setError('Error al cargar datos: ' + (err.message || 'Error desconocido'))
    } finally {
      setAnalizando(false)
    }
  }, [bioterio, periodosEfectivos])

  const estiloCard = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: '16px', padding: '16px' }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto" style={{ color: tema.textPrimary }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tema.textPrimary }}>Auditoría histórica</h1>
        <p className="text-sm mt-1" style={{ color: tema.textMuted }}>
          Compará dos períodos y detectá mejoras, deterioros, patrones y causas automáticamente.
        </p>
      </div>

      {/* ── Panel de configuración ─────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 space-y-4" style={estiloCard}>

        {/* Bioterio */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: tema.textMuted }}>Colonia a auditar</label>
          <div className="flex flex-wrap gap-2">
            {BIOTERIOS.map(b => (
              <button
                key={b.id}
                onClick={() => setBioterio(b.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={bioterio === b.id
                  ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }
                  : { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
                }
              >{b.icon} {b.label}</button>
            ))}
          </div>
        </div>

        {/* Presets de período */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: tema.textMuted }}>Período a comparar</label>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={presetId === p.id
                  ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }
                  : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
                }
              >{p.label}</button>
            ))}
            <button
              onClick={() => setPresetId('custom')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={presetId === 'custom'
                ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }
                : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
              }
            >Personalizado</button>
          </div>
        </div>

        {/* Custom dates */}
        {presetId === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Período A (anterior)</div>
              <div className="flex gap-2">
                <input type="date" value={customA.desde} onChange={e => setCustomA(p => ({ ...p, desde: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
                <input type="date" value={customA.hasta} onChange={e => setCustomA(p => ({ ...p, hasta: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
              </div>
            </div>
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#00e676' }}>Período B (actual)</div>
              <div className="flex gap-2">
                <input type="date" value={customB.desde} onChange={e => setCustomB(p => ({ ...p, desde: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
                <input type="date" value={customB.hasta} onChange={e => setCustomB(p => ({ ...p, hasta: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
              </div>
            </div>
          </div>
        )}

        {/* Descripción de qué períodos se van a comparar */}
        {periodosEfectivos && presetId !== 'custom' && (
          <div className="flex flex-wrap gap-3 text-xs" style={{ color: tema.textMuted }}>
            <span>Período A: <b style={{ color: '#c9d4e0' }}>{periodosEfectivos.desdeA}</b> → <b style={{ color: '#c9d4e0' }}>{periodosEfectivos.hastaA}</b></span>
            <span style={{ color: '#4a5f7a' }}>vs</span>
            <span>Período B: <b style={{ color: '#00e676' }}>{periodosEfectivos.desdeB}</b> → <b style={{ color: '#00e676' }}>{periodosEfectivos.hastaB}</b></span>
          </div>
        )}

        <button
          onClick={analizar}
          disabled={analizando}
          className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: analizando ? 'rgba(0,230,118,0.08)' : 'rgba(0,230,118,0.15)',
            border: '1px solid rgba(0,230,118,0.4)',
            color: '#00e676',
            cursor: analizando ? 'not-allowed' : 'pointer',
            opacity: analizando ? 0.7 : 1,
          }}
        >
          {analizando ? '⏳ Analizando...' : '🔬 Analizar y comparar'}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Resultados ─────────────────────────────────────────────────────── */}
      {resultado && (() => {
        const { mA, mB, comp, patrones, hipotesis, resumen, recomendaciones, periodoA, periodoB } = resultado
        const { repro: rA, prod: pA, sanidad: sA, ambiente: aA } = mA
        const { repro: rB, prod: pB, sanidad: sB, ambiente: aB } = mB

        return (
          <div className="space-y-5">

            {/* ── Índices globales ─────────────────────────────────────────── */}
            <div className="rounded-2xl p-5" style={estiloCard}>
              <div className="text-sm font-bold mb-4" style={{ color: tema.textPrimary }}>Índices globales</div>
              <div className="flex flex-wrap justify-around gap-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="text-xs uppercase tracking-widest" style={{ color: tema.textMuted }}>Rendimiento</div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <GaugeCircle valor={mA.indiceGlobal} label="Período A" color="#4a5f7a" />
                    </div>
                    <div className="text-center">
                      <GaugeCircle valor={mB.indiceGlobal} label="Período B" color="#00e676" />
                    </div>
                  </div>
                  <DeltaBadge comp={comp.indiceGlobal} formato={v => (v > 0 ? '+' : '') + Math.round(v)} />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="text-xs uppercase tracking-widest" style={{ color: tema.textMuted }}>Estabilidad</div>
                  <div className="flex gap-4">
                    <GaugeCircle valor={mA.indiceEstabilidad} label="Período A" color="#4a5f7a" />
                    <GaugeCircle valor={mB.indiceEstabilidad} label="Período B" color="#a78bfa" />
                  </div>
                  <DeltaBadge comp={comp.indiceEstabilidad} formato={v => (v > 0 ? '+' : '') + Math.round(v)} />
                </div>
              </div>
              {/* Mini KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                {[
                  { label: 'Fertilidad', vA: (rA.fertilidad * 100).toFixed(0) + '%', vB: (rB.fertilidad * 100).toFixed(0) + '%', comp: comp.fertilidad },
                  { label: 'Nacidos',    vA: pA.nacidos, vB: pB.nacidos, comp: comp.nacidos },
                  { label: 'Índice sanitario', vA: sA.indiceSanitario, vB: sB.indiceSanitario, comp: comp.indiceSanitario },
                  { label: 'Índice ambiental', vA: aA.indiceAmbiental, vB: aB.indiceAmbiental, comp: comp.indiceAmbiental },
                ].map(({ label, vA, vB, comp: c }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                    <div className="text-xs mb-1" style={{ color: tema.textMuted }}>{label}</div>
                    <div className="text-sm font-mono font-bold" style={{ color: '#c9d4e0' }}>{vA} → {vB}</div>
                    <div className="mt-1"><DeltaBadge comp={c} formato={v => (typeof v === 'number' ? (v > 0 ? '+' : '') + v.toFixed(1) : String(v ?? '—'))} /></div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Patrones detectados ──────────────────────────────────────── */}
            <div className="rounded-2xl p-5 space-y-2" style={estiloCard}>
              <div className="text-sm font-bold mb-3" style={{ color: tema.textPrimary }}>Patrones detectados</div>
              {patrones.map((p, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: `${NIVEL_COLORES[p.nivel] || '#8a9bb0'}10`, border: `1px solid ${NIVEL_COLORES[p.nivel] || '#8a9bb0'}25` }}>
                  <span className="font-semibold text-sm shrink-0" style={{ color: NIVEL_COLORES[p.nivel] }}>{p.patron}</span>
                  <span className="text-xs" style={{ color: tema.textMuted }}>{p.descripcion}</span>
                </div>
              ))}
            </div>

            {/* ── Tabs de dimensiones ───────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden" style={estiloCard}>
              {/* Tab bar */}
              <div className="flex gap-1 flex-wrap mb-4">
                {TABS_LABELS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={tab === i
                      ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.35)', color: '#00e676' }
                      : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }
                    }
                  >{t}</button>
                ))}
              </div>

              {/* Encabezado de columnas */}
              <div className="flex items-center gap-2 px-0 mb-2">
                <span className="text-xs flex-1" style={{ color: tema.textMuted }}>Métrica</span>
                <span className="text-xs w-14 text-right font-semibold" style={{ color: '#4a5f7a' }}>Per. A</span>
                <span className="text-xs w-4" />
                <span className="text-xs w-14 text-right font-semibold" style={{ color: '#00e676' }}>Per. B</span>
                <span className="text-xs w-16 text-right" style={{ color: tema.textMuted }}>Δ</span>
              </div>

              {/* TAB 0: Reproducción */}
              {tab === 0 && (
                <div>
                  <MetricaRow label="Emparejamientos totales" comp={{ A: rA.total, B: rB.total, delta: rB.total - rA.total, senal: 'neutro' }} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Partos exitosos" comp={comp.exitosos} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Partos fallidos" comp={comp.fallidos} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Fertilidad (%)" comp={{ ...comp.fertilidad, A: rA.fertilidad * 100, B: rB.fertilidad * 100, delta: comp.fertilidad.delta * 100 }} formato={v => v?.toFixed(1) + '%'} />
                  <MetricaRow label="Latencia media (días)" comp={comp.latenciaMedia} formato={v => v?.toFixed(1) ?? '—'} />
                  <MetricaRow label="Tamaño de camada (media)" comp={comp.tamanoCamada} formato={v => v?.toFixed(1) ?? '—'} />
                  <MetricaRow label="Supervivencia al destete" comp={{ ...comp.supervivencia, A: rA.supervivenciaMedio * 100, B: rB.supervivenciaMedio * 100, delta: comp.supervivencia.delta * 100 }} formato={v => v?.toFixed(1) + '%'} />
                  <MetricaRow label="Proporción sexual (♀%)" comp={{ ...comp.proporcionSexual, A: rA.proporcionSexual * 100, B: rB.proporcionSexual * 100, delta: comp.proporcionSexual.delta * 100 }} formato={v => v?.toFixed(1) + '%'} />
                  <MetricaRow label="Eficiencia reproductiva" comp={comp.eficienciaRepro} formato={v => v?.toFixed(1) + '%'} />
                  <MetricaRow label="Abortos / reabsorciones" comp={comp.abortos} formato={v => v?.toFixed(0) ?? '—'} />
                  {/* Gráfico comparativo */}
                  <div className="mt-5">
                    <div className="text-xs font-semibold mb-3" style={{ color: tema.textMuted }}>Comparación visual</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Partos exitosos', A: rA.exitosos, B: rB.exitosos },
                        { name: 'Camada media', A: +rA.tamanoCamadaMedio.toFixed(1), B: +rB.tamanoCamadaMedio.toFixed(1) },
                        { name: 'Superv. %', A: +(rA.supervivenciaMedio * 100).toFixed(0), B: +(rB.supervivenciaMedio * 100).toFixed(0) },
                      ]} barGap={4} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4a5f7a' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#4a5f7a' }} />
                        <Tooltip contentStyle={{ background: '#0d1528', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="A" fill="#4a5f7a" radius={[4, 4, 0, 0]} name="Período A" />
                        <Bar dataKey="B" fill="#00e676" radius={[4, 4, 0, 0]} name="Período B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* TAB 1: Producción */}
              {tab === 1 && (
                <div>
                  <MetricaRow label="Nacidos" comp={comp.nacidos} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Destetados" comp={comp.destetados} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Entregados" comp={comp.entregados} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Sacrificados" comp={comp.sacrificados} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Eficiencia (destetados/nacidos)" comp={comp.eficienciaProd} formato={v => v?.toFixed(1) + '%'} />
                  <div className="mt-5">
                    <div className="text-xs font-semibold mb-3" style={{ color: tema.textMuted }}>Comparación visual</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Nacidos', A: pA.nacidos, B: pB.nacidos },
                        { name: 'Destetados', A: pA.destetados, B: pB.destetados },
                        { name: 'Entregados', A: pA.entregados, B: pB.entregados },
                        { name: 'Sacrificados', A: pA.sacrificados, B: pB.sacrificados },
                      ]} barGap={4} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4a5f7a' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#4a5f7a' }} />
                        <Tooltip contentStyle={{ background: '#0d1528', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="A" fill="#4a5f7a" radius={[4, 4, 0, 0]} name="Período A" />
                        <Bar dataKey="B" fill="#00e676" radius={[4, 4, 0, 0]} name="Período B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* TAB 2: Sanidad */}
              {tab === 2 && (
                <div>
                  <MetricaRow label="Índice sanitario (0–100)" comp={comp.indiceSanitario} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Incidentes totales" comp={comp.incidentesTotal} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Incidentes graves" comp={comp.graves} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Incidentes moderados" comp={{ A: sA.moderados, B: sB.moderados, delta: sB.moderados - sA.moderados, senal: sB.moderados > sA.moderados ? 'deterioro' : sB.moderados < sA.moderados ? 'mejora' : 'estable' }} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Malformaciones en crías" comp={comp.malformaciones} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Mortalidad neonatal" comp={comp.mortalidadNeonatal} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Incidentes abiertos" comp={{ A: sA.abiertos, B: sB.abiertos, delta: sB.abiertos - sA.abiertos, senal: sB.abiertos > sA.abiertos ? 'deterioro' : 'mejora' }} formato={v => v?.toFixed(0) ?? '—'} />
                </div>
              )}

              {/* TAB 3: Ambiente */}
              {tab === 3 && (
                <div>
                  <MetricaRow label="Índice ambiental (0–100)" comp={comp.indiceAmbiental} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Temperatura media (°C)" comp={comp.tempMedia} formato={v => v?.toFixed(1) + ' °C'} />
                  <MetricaRow label="Días fuera de rango" comp={comp.diasFueraRango} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Días en atención" comp={{ A: aA.diasAtencion, B: aB.diasAtencion, delta: aB.diasAtencion - aA.diasAtencion, senal: aB.diasAtencion > aA.diasAtencion ? 'deterioro' : 'mejora' }} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Estabilidad térmica (%)" comp={comp.estabilidadTemp} formato={v => v?.toFixed(0) + '%'} />
                  <MetricaRow label="Registros de temperatura" comp={{ A: aA.totalRegistros, B: aB.totalRegistros, delta: aB.totalRegistros - aA.totalRegistros, senal: 'neutro' }} formato={v => v?.toFixed(0) ?? '—'} />
                  {aA.totalRegistros === 0 && aB.totalRegistros === 0 && (
                    <p className="text-xs text-center mt-3" style={{ color: tema.textMuted }}>Sin registros de temperatura en estos períodos.</p>
                  )}
                </div>
              )}

              {/* TAB 4: Genética */}
              {tab === 4 && (
                <div>
                  <div className="rounded-xl px-4 py-3 mb-3 text-xs" style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}>
                    ℹ️ Las métricas genéticas reflejan el estado actual de la colonia activa. No varían por período ya que el árbol genealógico es continuo.
                  </div>
                  <MetricaRow label="F media (consanguinidad)" comp={{ ...comp.fMedia, A: mA.genetica.fMedia * 100, B: mB.genetica.fMedia * 100, delta: comp.fMedia.delta * 100 }} formato={v => v?.toFixed(2) + '%'} />
                  <MetricaRow label="Diversidad estimada" comp={{ ...comp.diversidad, A: mA.genetica.diversidadEstimada, B: mB.genetica.diversidadEstimada }} formato={v => v?.toFixed(1) + '%'} />
                  <MetricaRow label="Animales con F alto (>12.5%)" comp={comp.animalesAltoF} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Animales sin ancestros registrados" comp={{ A: mA.genetica.animalesSinAncestros, B: mB.genetica.animalesSinAncestros, delta: 0, senal: 'neutro' }} formato={v => v?.toFixed(0) ?? '—'} />
                  <MetricaRow label="Total animales activos" comp={{ A: mA.genetica.totalAnimales, B: mB.genetica.totalAnimales, delta: 0, senal: 'neutro' }} formato={v => v?.toFixed(0) ?? '—'} />
                </div>
              )}
            </div>

            {/* ── Motor causal ─────────────────────────────────────────────── */}
            {hipotesis.length > 0 && (
              <Seccion titulo="🔬 Motor causal — ¿Por qué cambiaron los indicadores?">
                <div className="space-y-3">
                  {hipotesis.map((h, i) => {
                    const color = h.nivel === 'critico' ? '#ff6b80' : h.nivel === 'alerta' ? '#ffb300' : h.nivel === 'positivo' ? '#00e676' : '#8a9bb0'
                    return (
                      <div key={i} className="rounded-xl p-4 space-y-2" style={{ background: `${color}08`, border: `1px solid ${color}25` }}>
                        <div className="font-semibold text-sm" style={{ color }}>{h.problema}</div>
                        <ul className="text-xs space-y-0.5" style={{ color: tema.textMuted }}>
                          {h.factores.map((f, j) => <li key={j}>• {f}</li>)}
                        </ul>
                        <div className="text-xs font-semibold mt-1" style={{ color: '#c9d4e0' }}>→ {h.recomendacion}</div>
                      </div>
                    )
                  })}
                </div>
              </Seccion>
            )}

            {/* ── Resumen automático ───────────────────────────────────────── */}
            <Seccion titulo="📋 Resumen automático">
              <div className="rounded-xl px-4 py-4" style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.12)' }}>
                <pre className="text-xs whitespace-pre-wrap" style={{ color: '#c9d4e0', fontFamily: 'inherit', lineHeight: 1.8 }}>
                  {resumen}
                </pre>
              </div>
            </Seccion>

            {/* ── Recomendaciones ──────────────────────────────────────────── */}
            {recomendaciones.length > 0 && (
              <Seccion titulo="✅ Recomendaciones">
                <div className="space-y-2">
                  {recomendaciones.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                      <span className="text-lg shrink-0">{r.icono}</span>
                      <span className="text-sm" style={{ color: '#c9d4e0' }}>{r.texto}</span>
                    </div>
                  ))}
                </div>
              </Seccion>
            )}

            {/* Botón imprimir */}
            <div className="flex justify-end pb-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }}
              >
                🖨️ Imprimir informe
              </button>
            </div>
          </div>
        )
      })()}

      {/* Estado inicial */}
      {!resultado && !analizando && !error && (
        <div className="text-center py-16" style={{ color: tema.textMuted }}>
          <div className="text-5xl mb-4">📊</div>
          <div className="text-base font-semibold mb-1" style={{ color: tema.textSecondary }}>
            Seleccioná el período y hacé clic en "Analizar"
          </div>
          <div className="text-sm">Compará la colonia en dos momentos diferentes y detectá patrones automáticamente.</div>
        </div>
      )}
    </div>
  )
}
