// ─────────────────────────────────────────────────────────────────────────────
// Auditoria.jsx — Sistema estratégico de auditoría histórica de colonia
// Rediseño v2: interpretativo, contextual, ejecutivo y mobile-first
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import {
  getPresetsPeriodo, filtrarPorPeriodo,
  calcularMetricasReproduccion, calcularMetricasProduccion,
  calcularMetricasSanidad, calcularMetricasAmbiente, calcularMetricasGenetica,
  calcularMetricasRenovacion, calcularMetricasHibridos, calcularTendencias,
  calcularIndiceGlobal, calcularIndiceEstabilidad,
  proyectarTendenciaLineal, compararPeriodos,
  motorCausalHistorico,
  // v2 — motor estratégico
  detectarPerfilOperativo, interpretarCambioContextual,
  generarAlertasReales, calcularIndiceSustentabilidad,
  etiquetaEstado, generarAccionesRecomendadas,
} from '../utils/auditoria'

// ── Constantes ────────────────────────────────────────────────────────────────
const BIOTERIOS = [
  { id: 'ratas',            label: 'Ratas',       icon: '🐀' },
  { id: 'ratones_balbc',    label: 'BALB/c',      icon: '🐁' },
  { id: 'ratones_c57',      label: 'C57BL/6',     icon: '🐁' },
  { id: 'ratones_hibridos', label: 'Híbridos F1', icon: '🧬' },
]

const TABS_TECNICO = ['Reproducción', 'Producción', 'Sanidad', 'Ambiente', 'Genética', 'Renovación', 'Híbridos F1']

// ── Componentes visuales auxiliares ──────────────────────────────────────────

function GaugeCircle({ valor, color = '#00e676', size = 88 }) {
  const pct   = Math.max(0, Math.min(100, valor ?? 0))
  const r     = size * 0.4
  const circ  = 2 * Math.PI * r
  const cx    = size / 2
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ filter: `drop-shadow(0 0 5px ${color}50)`, transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold font-mono" style={{ color, fontSize: size * 0.22 }}>{pct}</span>
        <span style={{ color: '#4a5f7a', fontSize: size * 0.12 }}>/100</span>
      </div>
    </div>
  )
}

function MiniKpi({ label, valor, color = '#c9d4e0' }) {
  return (
    <div className="text-center px-3 py-2">
      <div className="text-sm font-bold font-mono" style={{ color }}>{valor}</div>
      <div className="text-xs mt-0.5" style={{ color: '#6a7f9a' }}>{label}</div>
    </div>
  )
}

function ColapsableSeccion({ titulo, children, defaultOpen = false }) {
  const { tema } = useTheme()
  const [abierto, setAbierto] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ borderBottom: abierto ? `1px solid ${tema.bgCardBorde}` : 'none' }}
      >
        <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>{titulo}</span>
        <span style={{ color: '#4a5f7a', fontSize: 18, lineHeight: 1 }}>{abierto ? '−' : '+'}</span>
      </button>
      {abierto && <div className="p-5">{children}</div>}
    </div>
  )
}

function NivelBadge({ nivel }) {
  const cfg = {
    critico:    { bg: 'rgba(255,61,87,0.1)',  borde: 'rgba(255,61,87,0.3)',  color: '#ff6b80' },
    importante: { bg: 'rgba(255,152,0,0.1)',  borde: 'rgba(255,152,0,0.3)', color: '#ff9800' },
    atencion:   { bg: 'rgba(255,179,0,0.08)', borde: 'rgba(255,179,0,0.25)',color: '#ffb300' },
  }[nivel] ?? { bg: 'rgba(138,155,176,0.08)', borde: 'rgba(138,155,176,0.2)', color: '#8a9bb0' }
  return (
    <span className="px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide"
      style={{ background: cfg.bg, border: `1px solid ${cfg.borde}`, color: cfg.color }}>
      {nivel}
    </span>
  )
}

// Tabla de métricas comparativas (para sección técnica)
function FilaMetrica({ label, vA, vB, senal, formato = v => v?.toFixed?.(1) ?? '—' }) {
  const { tema } = useTheme()
  const colorSenal = senal?.includes('mejora') ? '#00e676' : senal?.includes('deterioro') ? '#ff6b80' : '#8a9bb0'
  const icono      = senal?.includes('mejora') ? '↑' : senal?.includes('deterioro') ? '↓' : '→'
  const delta      = vB != null && vA != null ? vB - vA : null
  const pct        = delta != null && vA !== 0 ? Math.round((delta / Math.abs(vA)) * 100) : null
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${tema.bgCardBorde}30` }}>
      <span className="text-xs flex-1 min-w-0 truncate" style={{ color: '#8a9bb0' }}>{label}</span>
      <span className="text-xs font-mono w-14 text-right" style={{ color: '#4a5f7a' }}>{vA != null ? formato(vA) : '—'}</span>
      <span className="text-xs w-4 text-center" style={{ color: '#4a5f7a' }}>→</span>
      <span className="text-xs font-mono w-14 text-right" style={{ color: tema.textPrimary }}>{vB != null ? formato(vB) : '—'}</span>
      <span className="text-xs font-mono font-bold w-14 text-right" style={{ color: pct != null && pct !== 0 ? colorSenal : '#4a5f7a' }}>
        {pct != null ? (pct > 0 ? '+' : '') + pct + '%' : '—'}
      </span>
      <span className="w-5 text-center text-sm" style={{ color: colorSenal }}>{icono}</span>
    </div>
  )
}

// ── Sección técnica colapsable ────────────────────────────────────────────────
function SeccionTecnica({ resultado, bioterio }) {
  const { tema } = useTheme()
  const { mA, mB, comp, tendencias } = resultado
  const [tab, setTab]         = useState(0)
  const [horizonte, setHz]    = useState(12)

  const rA = mA.repro, rB = mB.repro
  const pA = mA.prod,  pB = mB.prod
  const sA = mA.sanidad, sB = mB.sanidad
  const aA = mA.ambiente, aB = mB.ambiente
  const rnA = mA.renovacion, rnB = mB.renovacion

  const tooltipStyle = { background: '#0d1528', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 10, fontSize: 11 }
  const xTick = { fontSize: 9, fill: '#4a5f7a' }
  const yTick = { fontSize: 9, fill: '#4a5f7a' }

  return (
    <div className="space-y-4">
      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Fertilidad', vA: (rA.fertilidad * 100).toFixed(0) + '%', vB: (rB.fertilidad * 100).toFixed(0) + '%', comp: comp.fertilidad },
          { label: 'Nacidos',    vA: pA.nacidos, vB: pB.nacidos, comp: comp.nacidos },
          { label: 'Sanidad',    vA: sA.indiceSanitario, vB: sB.indiceSanitario, comp: comp.indiceSanitario },
          { label: 'Supervivencia', vA: (rA.supervivenciaMedio * 100).toFixed(0) + '%', vB: (rB.supervivenciaMedio * 100).toFixed(0) + '%', comp: comp.supervivencia },
        ].map(({ label, vA, vB, comp: c }) => {
          const color = c?.senal?.includes('mejora') ? '#00e676' : c?.senal?.includes('deterioro') ? '#ff6b80' : '#8a9bb0'
          return (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="text-xs mb-1" style={{ color: tema.textMuted }}>{label}</div>
              <div className="text-xs font-mono" style={{ color: '#8a9bb0' }}>{vA}</div>
              <div className="text-sm font-mono font-bold" style={{ color }}>{vB}</div>
            </div>
          )
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS_TECNICO.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tab === i
              ? { background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)', color: '#00e676' }
              : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }
            }
          >{t}</button>
        ))}
      </div>

      {/* Cabecera columnas */}
      <div className="flex items-center gap-2">
        <span className="text-xs flex-1" style={{ color: tema.textMuted }}>Métrica</span>
        <span className="text-xs w-14 text-right font-semibold" style={{ color: '#4a5f7a' }}>Per. A</span>
        <span className="text-xs w-4" />
        <span className="text-xs w-14 text-right font-semibold" style={{ color: '#00e676' }}>Per. B</span>
        <span className="text-xs w-14 text-right" style={{ color: '#8a9bb0' }}>Cambio</span>
        <span className="w-5" />
      </div>

      {/* TAB 0: Reproducción */}
      {tab === 0 && (
        <div>
          <FilaMetrica label="Emparejamientos"       vA={rA.total} vB={rB.total} senal="neutro" formato={v => Math.round(v)} />
          <FilaMetrica label="Partos exitosos"        vA={rA.exitosos} vB={rB.exitosos} senal={comp.exitosos?.senal} formato={v => Math.round(v)} />
          <FilaMetrica label="Partos fallidos"        vA={rA.fallidos} vB={rB.fallidos} senal={comp.fallidos?.senal} formato={v => Math.round(v)} />
          <FilaMetrica label="Fertilidad"             vA={rA.fertilidad * 100} vB={rB.fertilidad * 100} senal={comp.fertilidad?.senal} formato={v => v.toFixed(1) + '%'} />
          <FilaMetrica label="Latencia media (días)"  vA={rA.latenciaMedia} vB={rB.latenciaMedia} senal={comp.latenciaMedia?.senal} formato={v => v?.toFixed(1) ?? '—'} />
          <FilaMetrica label="Camada media (crías)"   vA={rA.tamanoCamadaMedio} vB={rB.tamanoCamadaMedio} senal={comp.tamanoCamada?.senal} formato={v => v?.toFixed(1) ?? '—'} />
          <FilaMetrica label="Supervivencia destete"  vA={rA.supervivenciaMedio * 100} vB={rB.supervivenciaMedio * 100} senal={comp.supervivencia?.senal} formato={v => v.toFixed(1) + '%'} />
          <FilaMetrica label="Eficiencia reproductiva" vA={rA.eficienciaRepro} vB={rB.eficienciaRepro} senal={comp.eficienciaRepro?.senal} formato={v => v?.toFixed(1) + '%'} />
          <FilaMetrica label="Abortos/reabsorciones"  vA={rA.abortos} vB={rB.abortos} senal={comp.abortos?.senal} formato={v => Math.round(v)} />
          <div className="mt-5">
            <div className="text-xs font-semibold mb-3" style={{ color: tema.textMuted }}>Comparación visual</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { name: 'Partos exitosos', A: rA.exitosos, B: rB.exitosos },
                { name: 'Camada media',    A: +rA.tamanoCamadaMedio.toFixed(1), B: +rB.tamanoCamadaMedio.toFixed(1) },
                { name: 'Superv. %',       A: +(rA.supervivenciaMedio * 100).toFixed(0), B: +(rB.supervivenciaMedio * 100).toFixed(0) },
              ]} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={xTick} />
                <YAxis tick={yTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="A" fill="#4a5f7a" radius={[4,4,0,0]} name="Período A" />
                <Bar dataKey="B" fill="#00e676" radius={[4,4,0,0]} name="Período B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB 1: Producción */}
      {tab === 1 && (
        <div>
          <FilaMetrica label="Nacidos"       vA={pA.nacidos}     vB={pB.nacidos}     senal={comp.nacidos?.senal}     formato={v => Math.round(v)} />
          <FilaMetrica label="Destetados"    vA={pA.destetados}  vB={pB.destetados}  senal={comp.destetados?.senal}  formato={v => Math.round(v)} />
          <FilaMetrica label="Entregados"    vA={pA.entregados}  vB={pB.entregados}  senal={comp.entregados?.senal}  formato={v => Math.round(v)} />
          <FilaMetrica label="Sacrificados"  vA={pA.sacrificados} vB={pB.sacrificados} senal="neutro" formato={v => Math.round(v)} />
          <FilaMetrica label="Eficiencia (destetados/nacidos)" vA={pA.eficiencia} vB={pB.eficiencia} senal={comp.eficienciaProd?.senal} formato={v => v?.toFixed(1) + '%'} />
          <div className="mt-4 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}>
            ℹ️ Menor producción no implica deterioro. El contexto operativo determina si el cambio es intencional o problemático.
          </div>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { name: 'Nacidos',     A: pA.nacidos,     B: pB.nacidos },
                { name: 'Destetados',  A: pA.destetados,  B: pB.destetados },
                { name: 'Entregados',  A: pA.entregados,  B: pB.entregados },
                { name: 'Sacrificados',A: pA.sacrificados,B: pB.sacrificados },
              ]} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={xTick} />
                <YAxis tick={yTick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="A" fill="#4a5f7a" radius={[4,4,0,0]} name="Período A" />
                <Bar dataKey="B" fill="#00e676" radius={[4,4,0,0]} name="Período B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TAB 2: Sanidad */}
      {tab === 2 && (
        <div>
          <FilaMetrica label="Índice sanitario (0–100)" vA={sA.indiceSanitario} vB={sB.indiceSanitario} senal={comp.indiceSanitario?.senal} formato={v => Math.round(v)} />
          <FilaMetrica label="Incidentes totales"       vA={sA.total}         vB={sB.total}         senal={comp.incidentesTotal?.senal}  formato={v => Math.round(v)} />
          <FilaMetrica label="Incidentes graves"        vA={sA.graves}        vB={sB.graves}        senal={comp.graves?.senal}           formato={v => Math.round(v)} />
          <FilaMetrica label="Incidentes moderados"     vA={sA.moderados}     vB={sB.moderados}     senal="neutro"                       formato={v => Math.round(v)} />
          <FilaMetrica label="Malformaciones en crías"  vA={sA.malformaciones} vB={sB.malformaciones} senal={comp.malformaciones?.senal} formato={v => Math.round(v)} />
          <FilaMetrica label="Mortalidad neonatal"      vA={sA.mortalidadNeonatal} vB={sB.mortalidadNeonatal} senal={comp.mortalidadNeonatal?.senal} formato={v => Math.round(v)} />
        </div>
      )}

      {/* TAB 3: Ambiente */}
      {tab === 3 && (
        <div>
          <FilaMetrica label="Índice ambiental (0–100)" vA={aA.indiceAmbiental} vB={aB.indiceAmbiental} senal={comp.indiceAmbiental?.senal} formato={v => Math.round(v)} />
          <FilaMetrica label="Temperatura media (°C)"   vA={aA.tempMedia}       vB={aB.tempMedia}       senal="neutro"                      formato={v => v?.toFixed(1) + ' °C'} />
          <FilaMetrica label="Días fuera de rango"      vA={aA.diasFueraRango}  vB={aB.diasFueraRango}  senal={comp.diasFueraRango?.senal}  formato={v => Math.round(v)} />
          <FilaMetrica label="Estabilidad térmica"      vA={aA.estabilidad}     vB={aB.estabilidad}     senal={comp.estabilidadTemp?.senal} formato={v => v?.toFixed(0) + '%'} />
          {aA.totalRegistros === 0 && aB.totalRegistros === 0 && (
            <p className="text-xs text-center mt-4 py-4" style={{ color: tema.textMuted }}>Sin registros de temperatura en estos períodos.</p>
          )}
        </div>
      )}

      {/* TAB 4: Genética */}
      {tab === 4 && (
        <div>
          <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}>
            ℹ️ Las métricas genéticas reflejan el estado actual de la colonia. Son continuas — se muestran para contexto, no para comparación temporal.
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'F media (consanguinidad)', valor: (mB.genetica.fMedia * 100).toFixed(2) + '%', color: mB.genetica.fMedia > 0.125 ? '#ff6b80' : mB.genetica.fMedia > 0.0625 ? '#ffb300' : '#00e676' },
              { label: 'Diversidad estimada',      valor: mB.genetica.diversidadEstimada.toFixed(1) + '%', color: '#c9d4e0' },
              { label: 'Animales con F alto',      valor: mB.genetica.animalesAltoF, color: mB.genetica.animalesAltoF > 0 ? '#ffb300' : '#00e676' },
              { label: 'Total reproductores',      valor: mB.genetica.totalAnimales, color: '#c9d4e0' },
            ].map(({ label, valor, color }) => (
              <div key={label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                <div className="text-lg font-bold font-mono" style={{ color }}>{valor}</div>
                <div className="text-xs mt-1" style={{ color: tema.textMuted }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Renovación */}
      {tab === 5 && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total activos', val: rnA.totalActivos, color: '#c9d4e0' },
              { label: '♂ Machos',      val: rnA.machos,       color: '#40c4ff' },
              { label: '♀ Hembras',     val: rnA.hembras,      color: '#ce93d8' },
              { label: 'Edad media',    val: rnA.edadMedia ? Math.round(rnA.edadMedia) + 'd' : '—', color: '#ffb300' },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                <div className="text-lg font-bold font-mono" style={{ color }}>{val}</div>
                <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{label}</div>
              </div>
            ))}
          </div>
          {(rnA.proximosLimite > 0 || rnA.excedidos > 0) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {rnA.proximosLimite > 0 && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', color: '#ffb300' }}>
                  ⚠️ {rnA.proximosLimite} próximo(s) al límite (≥240d)
                </span>
              )}
              {rnA.excedidos > 0 && (
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.3)', color: '#ff6b80' }}>
                  🔴 {rnA.excedidos} excedido(s) el límite (≥270d)
                </span>
              )}
            </div>
          )}
          <FilaMetrica label="Retirados en el período" vA={rnA.retirados} vB={rnB.retirados} senal="neutro" formato={v => Math.round(v)} />
          <FilaMetrica label="Tasa de renovación"      vA={rnA.tasaRenovacion} vB={rnB.tasaRenovacion} senal="neutro" formato={v => v?.toFixed(1) + '%'} />
        </div>
      )}

      {/* TAB 6: Híbridos F1 */}
      {tab === 6 && (() => {
        const hA = mA.hibridos, hB = mB.hibridos
        const sinDatos = hA.total === 0 && hB.total === 0
        return (
          <div>
            {bioterio !== 'ratones_hibridos' && (
              <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.18)', color: '#00e676' }}>
                🧬 Producción F1 separada — no afecta el análisis de la colonia seleccionada.
              </div>
            )}
            {sinDatos ? (
              <p className="text-xs text-center py-8" style={{ color: tema.textMuted }}>Sin camadas F1 en los períodos seleccionados.</p>
            ) : (
              <>
                <FilaMetrica label="Cruces F1 totales"    vA={hA.total}      vB={hB.total}      senal="neutro" formato={v => Math.round(v)} />
                <FilaMetrica label="Cruces exitosos"      vA={hA.exitosos}   vB={hB.exitosos}   senal={hB.exitosos > hA.exitosos ? 'mejora' : 'neutro'} formato={v => Math.round(v)} />
                <FilaMetrica label="Nacidos F1"           vA={hA.nacidos}    vB={hB.nacidos}    senal={hB.nacidos > hA.nacidos ? 'mejora' : 'neutro'} formato={v => Math.round(v)} />
                <FilaMetrica label="Destetados F1"        vA={hA.destetados} vB={hB.destetados} senal={hB.destetados > hA.destetados ? 'mejora' : 'neutro'} formato={v => Math.round(v)} />
                <FilaMetrica label="Camada media F1"      vA={hA.tamanoCamadaMedio} vB={hB.tamanoCamadaMedio} senal="neutro" formato={v => v?.toFixed(1) ?? '—'} />
                <FilaMetrica label="Eficiencia F1"        vA={hA.eficiencia} vB={hB.eficiencia} senal="neutro" formato={v => v?.toFixed(1) + '%'} />
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={[
                      { name: 'Nacidos',    A: hA.nacidos,    B: hB.nacidos },
                      { name: 'Destetados', A: hA.destetados, B: hB.destetados },
                      { name: 'Exitosos',   A: hA.exitosos,   B: hB.exitosos },
                    ]} barGap={4} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={xTick} />
                      <YAxis tick={yTick} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="A" fill="#4a5f7a" radius={[4,4,0,0]} name="Período A" />
                      <Bar dataKey="B" fill="#00e676" radius={[4,4,0,0]} name="Período B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Tendencias históricas */}
      {tendencias?.length > 0 && (
        <div className="mt-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: tema.textPrimary }}>Tendencias históricas</span>
            <div className="flex gap-1">
              {[3, 6, 12, 24].map(h => (
                <button key={h} onClick={() => setHz(h)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={horizonte === h
                    ? { background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)', color: '#00e676' }
                    : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }
                  }
                >{h}m</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { key: 'fertilidad',   label: 'Fertilidad (%)',                color: '#00e676', domain: [0, 100], fmt: v => v + '%' },
              { key: 'supervivencia',label: 'Supervivencia al destete (%)',  color: '#ffb300', domain: [0, 100], fmt: v => v + '%' },
              { key: 'nacidos',      label: 'Nacidos / mes',                 color: '#40c4ff', domain: [0, null] },
              { key: 'incidentes',   label: 'Incidentes / mes',              color: '#ff9800', domain: [0, null] },
            ].map(({ key, label, color, domain, fmt }) => (
              <div key={key}>
                <div className="text-xs font-semibold mb-2" style={{ color: tema.textMuted }}>{label}</div>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={tendencias.slice(-horizonte)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="mes" tick={xTick} />
                    <YAxis domain={domain} tick={yTick} />
                    <Tooltip contentStyle={tooltipStyle} formatter={fmt ? v => [fmt(v), label] : undefined} />
                    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>

          {/* Proyección lineal */}
          <div>
            <div className="text-xs font-semibold mb-3" style={{ color: tema.textMuted }}>Proyección estimada (últimos 6 meses)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs rounded-xl overflow-hidden" style={{ borderCollapse: 'collapse', background: 'rgba(255,255,255,0.02)', border: `1px solid ${tema.bgCardBorde}` }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tema.bgCardBorde}` }}>
                    {['Métrica', 'Actual', '+3m', '+6m', '+12m', 'Tendencia'].map(h => (
                      <th key={h} className="px-3 py-2 text-right first:text-left" style={{ color: '#4a5f7a', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'fertilidad',   label: 'Fertilidad',   fmt: v => v.toFixed(0) + '%', min: 0, max: 100 },
                    { key: 'supervivencia',label: 'Supervivencia', fmt: v => v.toFixed(0) + '%', min: 0, max: 100 },
                    { key: 'nacidos',      label: 'Nacidos',       fmt: v => v.toFixed(0), min: 0 },
                    { key: 'incidentes',   label: 'Incidentes',    fmt: v => v.toFixed(0), min: 0 },
                  ].map(({ key, label, fmt, min, max }) => {
                    const last  = tendencias.length > 0 ? tendencias[tendencias.length - 1][key] : null
                    const p3    = proyectarTendenciaLineal(tendencias, key, 3,  min ?? 0, max ?? Infinity)
                    const p6    = proyectarTendenciaLineal(tendencias, key, 6,  min ?? 0, max ?? Infinity)
                    const p12   = proyectarTendenciaLineal(tendencias, key, 12, min ?? 0, max ?? Infinity)
                    const slope = p3[0]?.slope ?? 0
                    const trendColor = slope > 0.3 ? '#00e676' : slope < -0.3 ? '#ff6b80' : '#8a9bb0'
                    const trendIcon  = slope > 0.3 ? '↑' : slope < -0.3 ? '↓' : '→'
                    const val = arr => arr.length > 0 ? fmt(arr[arr.length - 1].valor) : '—'
                    return (
                      <tr key={key} style={{ borderBottom: `1px solid ${tema.bgCardBorde}20` }}>
                        <td className="px-3 py-2" style={{ color: '#8a9bb0' }}>{label}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#c9d4e0' }}>{last != null ? fmt(last) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#00e676' }}>{val(p3)}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#00e676' }}>{val(p6)}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: '#00e676' }}>{val(p12)}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color: trendColor }}>{trendIcon} {slope >= 0 ? '+' : ''}{slope.toFixed(1)}/mes</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Auditoria() {
  const { tema }         = useTheme()
  const { bioterioActivo } = useBioterioActivo()
  const presets          = getPresetsPeriodo()

  const [bioterio, setBioterio]   = useState(bioterioActivo ?? 'ratas')
  const [presetId, setPresetId]   = useState('trimestre')
  const [customA, setCustomA]     = useState({ desde: '', hasta: '' })
  const [customB, setCustomB]     = useState({ desde: '', hasta: '' })
  const [analizando, setAnalizando] = useState(false)
  const [error, setError]           = useState(null)
  const [resultado, setResultado]   = useState(null)

  const preset = presets.find(p => p.id === presetId)
  const periodosEfectivos = presetId === 'custom'
    ? { desdeA: customA.desde, hastaA: customA.hasta, desdeB: customB.desde, hastaB: customB.hasta }
    : preset ? { desdeA: preset.desdeA, hastaA: preset.hastaA, desdeB: preset.desdeB, hastaB: preset.hastaB } : null

  // ── Fetch + cálculo (sin cambios en la lógica) ───────────────────────────
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
      const hace24m = new Date()
      hace24m.setMonth(hace24m.getMonth() - 24)
      const hace24mStr = hace24m.toISOString().split('T')[0]

      const [
        { data: todasCamadas },
        { data: todosAnimales },
        { data: sacA }, { data: sacB },
        { data: entA }, { data: entB },
        { data: incA }, { data: incB },
        { data: tempA }, { data: tempB },
        { data: todosIncidentes },
        { data: todasTemperaturas },
        { data: camadasF1 },
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
        supabase.from('incidentes').select('*').eq('bioterio_id', bioterio).gte('fecha', hace24mStr),
        supabase.from('temperature_logs').select('*').gte('date', hace24mStr).order('date'),
        bioterio !== 'ratones_hibridos'
          ? supabase.from('camadas').select('*').eq('bioterio_id', 'ratones_hibridos').order('fecha_copula')
          : Promise.resolve({ data: [] }),
      ])

      const camF1todas = bioterio === 'ratones_hibridos' ? (todasCamadas || []) : (camadasF1 || [])
      const camA = filtrarPorPeriodo(todasCamadas || [], 'fecha_copula', desdeA, hastaA)
      const camB = filtrarPorPeriodo(todasCamadas || [], 'fecha_copula', desdeB, hastaB)

      const reproA    = calcularMetricasReproduccion(camA)
      const reproB    = calcularMetricasReproduccion(camB)
      const prodA     = calcularMetricasProduccion(camA, sacA || [], entA || [])
      const prodB     = calcularMetricasProduccion(camB, sacB || [], entB || [])
      const sanidadA  = calcularMetricasSanidad(incA || [], camA, bioterio)
      const sanidadB  = calcularMetricasSanidad(incB || [], camB, bioterio)
      const ambienteA = calcularMetricasAmbiente(tempA || [], bioterio)
      const ambienteB = calcularMetricasAmbiente(tempB || [], bioterio)
      const geneticaA = calcularMetricasGenetica(todosAnimales || [], todasCamadas || [])
      const geneticaB = geneticaA

      const retiradosA = (todosAnimales || []).filter(a => a.fecha_sacrificio && a.fecha_sacrificio >= desdeA && a.fecha_sacrificio <= hastaA)
      const retiradosB = (todosAnimales || []).filter(a => a.fecha_sacrificio && a.fecha_sacrificio >= desdeB && a.fecha_sacrificio <= hastaB)
      const renovacionA = calcularMetricasRenovacion(todosAnimales || [], retiradosA)
      const renovacionB = calcularMetricasRenovacion(todosAnimales || [], retiradosB)

      const hibridosA = calcularMetricasHibridos(filtrarPorPeriodo(camF1todas, 'fecha_copula', desdeA, hastaA))
      const hibridosB = calcularMetricasHibridos(filtrarPorPeriodo(camF1todas, 'fecha_copula', desdeB, hastaB))

      const tendencias = calcularTendencias(todasCamadas || [], todosIncidentes || [], todasTemperaturas || [], bioterio, 24)

      const igA = calcularIndiceGlobal({ repro: reproA, prod: prodA, sanidad: sanidadA, ambiente: ambienteA })
      const igB = calcularIndiceGlobal({ repro: reproB, prod: prodB, sanidad: sanidadB, ambiente: ambienteB })
      const ieA = calcularIndiceEstabilidad({ repro: reproA, sanidad: sanidadA, ambiente: ambienteA, genetica: geneticaA })
      const ieB = calcularIndiceEstabilidad({ repro: reproB, sanidad: sanidadB, ambiente: ambienteB, genetica: geneticaB })

      const mA = { repro: reproA, prod: prodA, sanidad: sanidadA, ambiente: ambienteA, genetica: geneticaA, renovacion: renovacionA, hibridos: hibridosA, indiceGlobal: igA, indiceEstabilidad: ieA }
      const mB = { repro: reproB, prod: prodB, sanidad: sanidadB, ambiente: ambienteB, genetica: geneticaB, renovacion: renovacionB, hibridos: hibridosB, indiceGlobal: igB, indiceEstabilidad: ieB }

      const comp     = compararPeriodos(mA, mB)
      const hipotesis = motorCausalHistorico(comp)

      setResultado({ mA, mB, comp, hipotesis, tendencias, periodoA: { desde: desdeA, hasta: hastaA }, periodoB: { desde: desdeB, hasta: hastaB } })
    } catch (err) {
      setError('Error al cargar datos: ' + (err.message || 'Error desconocido'))
    } finally {
      setAnalizando(false)
    }
  }, [bioterio, periodosEfectivos])

  const card = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: '16px' }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto" style={{ color: tema.textPrimary }}>

      {/* ── Header de página ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tema.textPrimary }}>Auditoría histórica</h1>
        <p className="text-sm mt-1" style={{ color: tema.textMuted }}>Interpretación estratégica de la colonia — compará dos períodos y entendé qué ocurrió y por qué.</p>
      </div>

      {/* ── Panel de configuración ────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 space-y-4" style={card}>
        {/* Bioterio */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: tema.textMuted }}>Colonia a auditar</label>
          <div className="flex flex-wrap gap-2">
            {BIOTERIOS.map(b => (
              <button key={b.id} onClick={() => setBioterio(b.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={bioterio === b.id
                  ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }
                  : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
                }
              >{b.icon} {b.label}</button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: tema.textMuted }}>Período</label>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={presetId === p.id
                  ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }
                  : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
                }
              >{p.label}</button>
            ))}
            <button onClick={() => setPresetId('custom')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={presetId === 'custom'
                ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676' }
                : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
              }
            >Personalizado</button>
          </div>
        </div>

        {presetId === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Período A (anterior)</div>
              <div className="flex gap-2">
                <input type="date" value={customA.desde} onChange={e => setCustomA(p => ({ ...p, desde: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
                <input type="date" value={customA.hasta} onChange={e => setCustomA(p => ({ ...p, hasta: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
              </div>
            </div>
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#00e676' }}>Período B (actual)</div>
              <div className="flex gap-2">
                <input type="date" value={customB.desde} onChange={e => setCustomB(p => ({ ...p, desde: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
                <input type="date" value={customB.hasta} onChange={e => setCustomB(p => ({ ...p, hasta: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`, color: '#c9d4e0' }} />
              </div>
            </div>
          </div>
        )}

        {periodosEfectivos && presetId !== 'custom' && (
          <div className="flex flex-wrap gap-3 text-xs" style={{ color: tema.textMuted }}>
            <span>Período A: <b style={{ color: '#8a9bb0' }}>{periodosEfectivos.desdeA}</b> → <b style={{ color: '#8a9bb0' }}>{periodosEfectivos.hastaA}</b></span>
            <span style={{ color: '#4a5f7a' }}>vs</span>
            <span>Período B: <b style={{ color: '#00e676' }}>{periodosEfectivos.desdeB}</b> → <b style={{ color: '#00e676' }}>{periodosEfectivos.hastaB}</b></span>
          </div>
        )}

        <button onClick={analizar} disabled={analizando}
          className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: analizando ? 'rgba(0,230,118,0.06)' : 'rgba(0,230,118,0.15)',
            border: '1px solid rgba(0,230,118,0.4)', color: '#00e676',
            cursor: analizando ? 'not-allowed' : 'pointer', opacity: analizando ? 0.7 : 1,
          }}
        >{analizando ? '⏳ Analizando...' : '🔬 Analizar y comparar'}</button>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Resultados ────────────────────────────────────────────────────── */}
      {resultado && (() => {
        const { mA, mB, comp, hipotesis } = resultado

        // Motor estratégico v2
        const perfil        = detectarPerfilOperativo(comp, mA, mB)
        const alertas       = generarAlertasReales(comp, mA, mB)
        const interpretacion = interpretarCambioContextual(comp, perfil, mA, mB)
        const acciones      = generarAccionesRecomendadas(comp, perfil, mA, mB, hipotesis)
        const scoreSust     = calcularIndiceSustentabilidad(mA, mB, comp)
        const estado        = etiquetaEstado(scoreSust)

        // Tendencia del índice global
        const deltaIG = comp.indiceGlobal?.delta ?? 0
        const tendIcon = deltaIG > 2 ? '↑' : deltaIG < -2 ? '↓' : '→'
        const tendColor = deltaIG > 2 ? '#00e676' : deltaIG < -2 ? '#ff6b80' : '#8a9bb0'

        return (
          <div className="space-y-4">

            {/* ── HEADER EJECUTIVO ────────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden" style={card}>
              {/* Badge del perfil operativo */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Izquierda: perfil + estado + interpretación */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Perfil */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                        style={{ background: `${perfil.color}15`, border: `1px solid ${perfil.color}40`, color: perfil.color }}>
                        {perfil.emoji} {perfil.label}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: `${estado.color}12`, border: `1px solid ${estado.color}35`, color: estado.color }}>
                        {estado.emoji} {estado.label}
                      </span>
                    </div>

                    {/* Interpretación automática — frase principal */}
                    <p className="text-sm leading-relaxed" style={{ color: tema.textPrimary, maxWidth: '520px' }}>
                      {interpretacion}
                    </p>

                    {/* Mini métricas clave */}
                    <div className="flex flex-wrap gap-0 divide-x" style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${tema.bgCardBorde}` }}>
                      <MiniKpi label="Fertilidad"     valor={(mB.repro.fertilidad * 100).toFixed(0) + '%'} color={mB.repro.fertilidad >= 0.7 ? '#00e676' : mB.repro.fertilidad >= 0.5 ? '#ffb300' : '#ff6b80'} />
                      <MiniKpi label="Supervivencia"  valor={(mB.repro.supervivenciaMedio * 100).toFixed(0) + '%'} color={mB.repro.supervivenciaMedio >= 0.8 ? '#00e676' : '#ffb300'} />
                      <MiniKpi label="Sanidad"        valor={Math.round(mB.sanidad.indiceSanitario)} color={mB.sanidad.indiceSanitario >= 70 ? '#00e676' : mB.sanidad.indiceSanitario >= 50 ? '#ffb300' : '#ff6b80'} />
                      <MiniKpi label="Tendencia"      valor={tendIcon + ' ' + (deltaIG > 0 ? '+' : '') + Math.round(deltaIG) + ' pts'} color={tendColor} />
                    </div>
                  </div>

                  {/* Derecha: gauge de sustentabilidad */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <GaugeCircle valor={scoreSust} color={estado.color} size={100} />
                    <span className="text-xs font-semibold text-center" style={{ color: tema.textMuted }}>Sustentabilidad</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── BLOQUE 2 — ALERTAS REALES ────────────────────────────── */}
            {alertas.length > 0 ? (
              <div className="rounded-2xl p-5 space-y-3" style={card}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>Alertas importantes</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(255,61,87,0.1)', color: '#ff6b80' }}>{alertas.length}</span>
                </div>
                {alertas.map((alerta, i) => {
                  const cfg = {
                    critico:    { bg: 'rgba(255,61,87,0.08)',  borde: 'rgba(255,61,87,0.25)',  color: '#ff6b80' },
                    importante: { bg: 'rgba(255,152,0,0.08)',  borde: 'rgba(255,152,0,0.25)',  color: '#ff9800' },
                    atencion:   { bg: 'rgba(255,179,0,0.06)',  borde: 'rgba(255,179,0,0.2)',   color: '#ffb300' },
                  }[alerta.nivel] ?? {}
                  return (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.borde}` }}>
                      <span className="text-lg shrink-0 mt-0.5">{alerta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm" style={{ color: tema.textPrimary }}>{alerta.texto}</div>
                        <NivelBadge nivel={alerta.nivel} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={card}>
                <span className="text-2xl">✅</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#00e676' }}>Sin alertas críticas</div>
                  <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>No se detectaron problemas reales en el período analizado.</div>
                </div>
              </div>
            )}

            {/* ── BLOQUE 3 — ACCIONES RECOMENDADAS ─────────────────────── */}
            <div className="rounded-2xl p-5 space-y-3" style={card}>
              <div className="text-sm font-bold mb-1" style={{ color: tema.textPrimary }}>Acciones recomendadas</div>
              {acciones.map((accion, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                  <span className="text-base shrink-0 mt-0.5">{accion.icono}</span>
                  <span className="text-sm" style={{ color: tema.textPrimary }}>{accion.texto}</span>
                </div>
              ))}
            </div>

            {/* ── BLOQUE 4 — DETALLE TÉCNICO (colapsable) ──────────────── */}
            <ColapsableSeccion titulo="📊 Detalle técnico — métricas completas, gráficos y tendencias">
              <SeccionTecnica resultado={resultado} bioterio={bioterio} />
            </ColapsableSeccion>

            {/* Imprimir */}
            <div className="flex justify-end pb-2">
              <button onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }}>
                🖨️ Imprimir informe
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Estado inicial ────────────────────────────────────────────────── */}
      {!resultado && !analizando && !error && (
        <div className="text-center py-16" style={{ color: tema.textMuted }}>
          <div className="text-5xl mb-4">📊</div>
          <div className="text-base font-semibold mb-2" style={{ color: tema.textSecondary }}>
            Seleccioná la colonia y el período
          </div>
          <div className="text-sm max-w-xs mx-auto">
            El sistema interpreta automáticamente qué ocurrió, si es esperado y qué hacer.
          </div>
        </div>
      )}
    </div>
  )
}
