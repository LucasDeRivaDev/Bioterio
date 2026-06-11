// ─────────────────────────────────────────────────────────────────────────────
// Auditoria.jsx — Auditoría histórica ejecutiva v3
// Interpretativa · contextual · mobile-first · sin ruido
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useCallback } from 'react'
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
  compararPeriodos, motorCausalHistorico,
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

const tooltipStyle = {
  background: '#0d1528',
  border: '1px solid rgba(0,230,118,0.18)',
  borderRadius: 10,
  fontSize: 11,
}
const xTick = { fontSize: 9, fill: '#4a5f7a' }
const yTick = { fontSize: 9, fill: '#4a5f7a' }

// ── Gauge de sustentabilidad ──────────────────────────────────────────────────
function GaugeCircle({ valor, color = '#00e676', size = 88 }) {
  const { tema } = useTheme()
  const pct  = Math.max(0, Math.min(100, valor ?? 0))
  const r    = size * 0.4
  const circ = 2 * Math.PI * r
  const cx   = size / 2
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
        <span style={{ color: tema.textMuted, fontSize: size * 0.12 }}>/100</span>
      </div>
    </div>
  )
}

// ── Mini KPI (strip inferior del header) ─────────────────────────────────────
function MiniKpi({ label, valor, color = '#c9d4e0' }) {
  return (
    <div className="flex-1 text-center px-3 py-2.5 min-w-0">
      <div className="text-sm font-bold font-mono leading-tight" style={{ color }}>{valor}</div>
      <div className="text-xs mt-0.5 truncate" style={{ color: '#6a7f9a' }}>{label}</div>
    </div>
  )
}

// ── Sección colapsable ────────────────────────────────────────────────────────
function Colapsable({ titulo, children, defaultOpen = false }) {
  const { tema } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ borderBottom: open ? `1px solid ${tema.bgCardBorde}` : 'none' }}
      >
        <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>{titulo}</span>
        <span style={{ color: tema.textMuted, fontSize: 20, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

// ── Fila de métrica comparativa ───────────────────────────────────────────────
// Solo muestra filas con cambio relevante o condición de alerta.
// Evita "deterioro" como palabra — usa dirección e icono.
function FilaMetrica({ label, vA, vB, invertida = false, formato = v => v?.toFixed?.(1) ?? '—', umbral = 0.08 }) {
  const { tema } = useTheme()
  if (vA == null && vB == null) return null

  const delta = vB != null && vA != null ? vB - vA : null
  const pct   = delta != null && vA !== 0 ? (delta / Math.abs(vA)) : (delta != null && vB !== 0 ? 1 : 0)

  // Filtrar filas sin cambio relevante
  if (Math.abs(pct) < umbral && Math.abs(delta ?? 0) < 1) return null

  // Color basado en dirección + contexto (invertida = menos es mejor, como latencia o incidentes)
  const positivo = invertida ? (delta ?? 0) < 0 : (delta ?? 0) > 0
  const neutro   = Math.abs(delta ?? 0) < 0.5 && Math.abs(pct) < 0.05
  const color    = neutro ? '#8a9bb0' : positivo ? '#00e676' : '#ff9800'
  const icono    = neutro ? '→' : positivo ? '↑' : '↓'

  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${tema.bgCardBorde}20` }}>
      <span className="text-xs flex-1 min-w-0" style={{ color: tema.textSecondary }}>{label}</span>
      <span className="text-xs font-mono" style={{ color: tema.textMuted }}>{vA != null ? formato(vA) : '—'}</span>
      <span className="text-xs" style={{ color: tema.textMuted }}>→</span>
      <span className="text-xs font-mono font-semibold" style={{ color: tema.textPrimary }}>{vB != null ? formato(vB) : '—'}</span>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{icono}</span>
    </div>
  )
}

// ── Badge de nivel de alerta ──────────────────────────────────────────────────
function NivelBadge({ nivel }) {
  const { tema } = useTheme()
  const cfg = {
    critico:    { bg: 'rgba(255,61,87,0.1)',  borde: 'rgba(255,61,87,0.3)',  color: tema.red, label: 'Crítico' },
    importante: { bg: 'rgba(255,152,0,0.1)',  borde: 'rgba(255,152,0,0.3)', color: '#ff9800', label: 'Importante' },
    atencion:   { bg: 'rgba(255,179,0,0.08)', borde: 'rgba(255,179,0,0.25)',color: tema.amber, label: 'Atención' },
  }[nivel] ?? { bg: 'rgba(138,155,176,0.08)', borde: 'rgba(138,155,176,0.2)', color: tema.textSecondary, label: nivel }
  return (
    <span className="px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.borde}`, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

// ── Sección técnica colapsable ────────────────────────────────────────────────
function SeccionTecnica({ resultado, bioterio }) {
  const { tema } = useTheme()
  const { mA, mB, tendencias } = resultado

  const rA = mA.repro,      rB = mB.repro
  const pA = mA.prod,       pB = mB.prod
  const sA = mA.sanidad,    sB = mB.sanidad
  const aA = mA.ambiente,   aB = mB.ambiente
  const rnA = mA.renovacion, rnB = mB.renovacion
  const hA = mA.hibridos,   hB = mB.hibridos

  // ── Tabs dinámicos: solo mostrar los relevantes ──────────────────────────
  const tabs = []
  tabs.push({ id: 'repro',    label: 'Reproducción' })
  tabs.push({ id: 'prod',     label: 'Producción' })
  if (sB.total > 0 || sB.indiceSanitario < 95)
    tabs.push({ id: 'sanidad', label: 'Sanidad' })
  if (aB.totalRegistros > 0)
    tabs.push({ id: 'ambiente', label: 'Temperatura' })
  if ((rnB.excedidos ?? 0) > 0 || (rnB.proximosLimite ?? 0) > 0 || (rnB.retirados ?? 0) > 0)
    tabs.push({ id: 'renovacion', label: 'Reproductores' })
  if (bioterio === 'ratones_hibridos' || (hA.total + hB.total) > 0)
    tabs.push({ id: 'hibridos', label: 'Híbridos F1' })

  const [tabId, setTabId] = useState(tabs[0]?.id ?? 'repro')

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTabId(t.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tabId === t.id
              ? { background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)', color: tema.accent }
              : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }
            }
          >{t.label}</button>
        ))}
      </div>

      {/* ── TAB: Reproducción ────────────────────────────────────────────── */}
      {tabId === 'repro' && (
        <div className="space-y-1">
          <div className="text-xs font-semibold mb-3 pb-2" style={{ color: tema.textMuted, borderBottom: `1px solid ${tema.bgCardBorde}` }}>
            Período A → Período B (solo métricas con cambio)
          </div>
          <FilaMetrica label="Emparejamientos"       vA={rA.total}      vB={rB.total}      formato={v => Math.round(v)} umbral={0.05} />
          <FilaMetrica label="Partos exitosos"        vA={rA.exitosos}   vB={rB.exitosos}   formato={v => Math.round(v)} umbral={0.05} />
          <FilaMetrica label="Fertilidad"             vA={rA.fertilidad * 100} vB={rB.fertilidad * 100} formato={v => v.toFixed(0) + '%'} umbral={0.04} />
          <FilaMetrica label="Camada media (crías)"   vA={rA.tamanoCamadaMedio} vB={rB.tamanoCamadaMedio} formato={v => v?.toFixed(1) ?? '—'} />
          <FilaMetrica label="Supervivencia al destete" vA={rA.supervivenciaMedio * 100} vB={rB.supervivenciaMedio * 100} formato={v => v.toFixed(0) + '%'} umbral={0.05} />
          <FilaMetrica label="Latencia (días cópula→concepción)" vA={rA.latenciaMedia} vB={rB.latenciaMedia} invertida formato={v => v?.toFixed(1) + 'd'} />
          <FilaMetrica label="Partos fallidos"        vA={rA.fallidos}   vB={rB.fallidos}   invertida formato={v => Math.round(v)} umbral={0.05} />
          {rA.total === 0 && rB.total === 0 && (
            <p className="text-xs py-6 text-center" style={{ color: tema.textMuted }}>Sin emparejamientos en estos períodos.</p>
          )}
          {(rA.total > 0 || rB.total > 0) && (
            <div className="pt-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={[
                  { name: 'Partos',      A: rA.exitosos, B: rB.exitosos },
                  { name: 'Camada med.', A: +rA.tamanoCamadaMedio.toFixed(1), B: +rB.tamanoCamadaMedio.toFixed(1) },
                  { name: 'Superv. %',   A: +(rA.supervivenciaMedio * 100).toFixed(0), B: +(rB.supervivenciaMedio * 100).toFixed(0) },
                ]} barGap={4} barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={xTick} />
                  <YAxis tick={yTick} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="A" fill="#4a5f7a" radius={[4,4,0,0]} name="Período A" />
                  <Bar dataKey="B" fill="#00e676" radius={[4,4,0,0]} name="Período B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Producción ──────────────────────────────────────────────── */}
      {tabId === 'prod' && (
        <div className="space-y-1">
          <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', color: '#00c864' }}>
            Menor producción no implica deterioro — el contexto operativo determina si el cambio es intencional o problemático.
          </div>
          <FilaMetrica label="Nacidos"      vA={pA.nacidos}    vB={pB.nacidos}    formato={v => Math.round(v)} umbral={0.05} />
          <FilaMetrica label="Destetados"   vA={pA.destetados} vB={pB.destetados} formato={v => Math.round(v)} umbral={0.05} />
          <FilaMetrica label="Entregados"   vA={pA.entregados} vB={pB.entregados} formato={v => Math.round(v)} umbral={0.05} />
          <FilaMetrica label="Sacrificados" vA={pA.sacrificados} vB={pB.sacrificados} formato={v => Math.round(v)} umbral={0.05} invertida />
          <FilaMetrica label="Eficiencia (destetados/nacidos)" vA={pA.eficiencia} vB={pB.eficiencia} formato={v => v?.toFixed(0) + '%'} umbral={0.04} />
          {pA.nacidos === 0 && pB.nacidos === 0 && (
            <p className="text-xs py-6 text-center" style={{ color: tema.textMuted }}>Sin nacimientos registrados en estos períodos.</p>
          )}
          {(pA.nacidos > 0 || pB.nacidos > 0) && (
            <div className="pt-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={[
                  { name: 'Nacidos',     A: pA.nacidos,     B: pB.nacidos },
                  { name: 'Destetados',  A: pA.destetados,  B: pB.destetados },
                  { name: 'Entregados',  A: pA.entregados,  B: pB.entregados },
                ]} barGap={4} barCategoryGap="32%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={xTick} />
                  <YAxis tick={yTick} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="A" fill="#4a5f7a" radius={[4,4,0,0]} name="Período A" />
                  <Bar dataKey="B" fill="#00e676" radius={[4,4,0,0]} name="Período B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Sanidad ─────────────────────────────────────────────────── */}
      {tabId === 'sanidad' && (
        <div className="space-y-1">
          <FilaMetrica label="Índice sanitario (0–100)" vA={sA.indiceSanitario} vB={sB.indiceSanitario} formato={v => Math.round(v)} umbral={0.03} />
          <FilaMetrica label="Incidentes graves"         vA={sA.graves}         vB={sB.graves}         invertida formato={v => Math.round(v)} umbral={0} />
          <FilaMetrica label="Incidentes moderados"      vA={sA.moderados}      vB={sB.moderados}      invertida formato={v => Math.round(v)} umbral={0} />
          <FilaMetrica label="Mortalidad neonatal"       vA={sA.mortalidadNeonatal} vB={sB.mortalidadNeonatal} invertida formato={v => Math.round(v)} umbral={0} />
          <FilaMetrica label="Malformaciones en crías"   vA={sA.malformaciones} vB={sB.malformaciones} invertida formato={v => Math.round(v)} umbral={0} />
          {sB.total === 0 && sA.total === 0 && (
            <p className="text-xs py-6 text-center" style={{ color: tema.textMuted }}>Sin incidentes registrados en estos períodos. ✅</p>
          )}
          {sB.abiertos > 0 && (
            <div className="mt-3 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: tema.amber }}>
              ⚠️ {sB.abiertos} incidente(s) sin resolver en el período actual. Darles seguimiento.
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Temperatura ─────────────────────────────────────────────── */}
      {tabId === 'ambiente' && (
        <div className="space-y-1">
          {aB.totalRegistros === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: tema.textMuted }}>Sin registros de temperatura en el período actual.</p>
          ) : (
            <>
              <FilaMetrica label="Temperatura media (°C)"  vA={aA.tempMedia}      vB={aB.tempMedia}      formato={v => v?.toFixed(1) + ' °C'} umbral={0.02} />
              <FilaMetrica label="Días fuera de rango"     vA={aA.diasFueraRango} vB={aB.diasFueraRango} invertida formato={v => Math.round(v)} umbral={0} />
              <FilaMetrica label="Estabilidad térmica (%)" vA={aA.estabilidad}    vB={aB.estabilidad}    formato={v => v?.toFixed(0) + '%'} umbral={0.04} />
              <FilaMetrica label="Índice ambiental (0–100)"vA={aA.indiceAmbiental} vB={aB.indiceAmbiental} formato={v => Math.round(v)} umbral={0.03} />
              {aB.diasFueraRango === 0 && (
                <p className="text-xs mt-3" style={{ color: '#00c864' }}>✅ Temperatura dentro del rango óptimo durante todo el período.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: Reproductores ───────────────────────────────────────────── */}
      {tabId === 'renovacion' && (
        <div className="space-y-3">
          {/* Estado actual del plantel */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total activos', val: rnB.totalActivos,              color: tema.textPrimary },
              { label: '♂ Machos',      val: rnB.machos,                    color: tema.blue },
              { label: '♀ Hembras',     val: rnB.hembras,                   color: tema.purple },
              { label: 'Edad media',    val: rnB.edadMedia ? Math.round(rnB.edadMedia) + 'd' : '—', color: tema.amber },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                <div className="text-lg font-bold font-mono" style={{ color }}>{val}</div>
                <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Alertas de edad */}
          {((rnB.proximosLimite ?? 0) > 0 || (rnB.excedidos ?? 0) > 0) && (
            <div className="space-y-2">
              {(rnB.excedidos ?? 0) > 0 && (
                <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: tema.red }}>
                  🔴 {rnB.excedidos} reproductor(es) superaron el límite de edad (≥270d). Reemplazar pronto.
                </div>
              )}
              {(rnB.proximosLimite ?? 0) > 0 && (
                <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: tema.amber }}>
                  ⚠️ {rnB.proximosLimite} reproductor(es) próximos al límite (≥240d). Planificar renovación.
                </div>
              )}
            </div>
          )}

          {/* Cambios de período */}
          <div className="space-y-1 pt-1">
            <FilaMetrica label="Retirados en el período" vA={rnA.retirados}      vB={rnB.retirados}      formato={v => Math.round(v)} umbral={0} />
            <FilaMetrica label="Tasa de renovación"      vA={rnA.tasaRenovacion} vB={rnB.tasaRenovacion} formato={v => v?.toFixed(1) + '%'} umbral={0.04} />
          </div>

          {/* Info genética (solo si es relevante) */}
          {mB.genetica.fMedia > 0.05 && (
            <div className="rounded-xl px-4 py-3 text-xs space-y-1" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="font-semibold mb-1" style={{ color: tema.textMuted }}>Estado genético</div>
              <div className="flex justify-between">
                <span style={{ color: tema.textSecondary }}>Consanguinidad media (F)</span>
                <span className="font-mono font-semibold" style={{ color: mB.genetica.fMedia > 0.125 ? '#ff6b80' : mB.genetica.fMedia > 0.0625 ? '#ffb300' : '#00e676' }}>
                  {(mB.genetica.fMedia * 100).toFixed(1)}%
                </span>
              </div>
              {mB.genetica.animalesAltoF > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: tema.textSecondary }}>Animales con F elevado</span>
                  <span className="font-mono font-semibold" style={{ color: tema.amber }}>{mB.genetica.animalesAltoF}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Híbridos F1 ─────────────────────────────────────────────── */}
      {tabId === 'hibridos' && (
        <div className="space-y-1">
          {hA.total === 0 && hB.total === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: tema.textMuted }}>Sin camadas F1 en los períodos seleccionados.</p>
          ) : (
            <>
              <FilaMetrica label="Cruces F1 totales"  vA={hA.total}              vB={hB.total}              formato={v => Math.round(v)} umbral={0} />
              <FilaMetrica label="Cruces exitosos"     vA={hA.exitosos}           vB={hB.exitosos}           formato={v => Math.round(v)} umbral={0} />
              <FilaMetrica label="Nacidos F1"          vA={hA.nacidos}            vB={hB.nacidos}            formato={v => Math.round(v)} umbral={0.05} />
              <FilaMetrica label="Destetados F1"       vA={hA.destetados}         vB={hB.destetados}         formato={v => Math.round(v)} umbral={0.05} />
              <FilaMetrica label="Camada media F1"     vA={hA.tamanoCamadaMedio}  vB={hB.tamanoCamadaMedio}  formato={v => v?.toFixed(1) ?? '—'} />
              <div className="pt-4">
                <ResponsiveContainer width="100%" height={140}>
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
      )}

      {/* ── Tendencias históricas (colapsado por defecto) ─────────────────── */}
      {tendencias?.length > 0 && (
        <Colapsable titulo="📈 Tendencia histórica (últimos 12 meses)" defaultOpen={false}>
          <TendenciasCompactas tendencias={tendencias} tema={tema} />
        </Colapsable>
      )}
    </div>
  )
}

// ── Tendencias simplificadas: 2 gráficos clave ───────────────────────────────
function TendenciasCompactas({ tendencias, tema }) {
  const [metrica, setMetrica] = useState('fertilidad')
  const opciones = [
    { key: 'fertilidad',    label: 'Fertilidad',   color: tema.accent, fmt: v => v + '%' },
    { key: 'nacidos',       label: 'Nacidos/mes',  color: tema.blue, fmt: v => v },
    { key: 'supervivencia', label: 'Supervivencia',color: tema.amber, fmt: v => v + '%' },
    { key: 'incidentes',    label: 'Incidentes',   color: '#ff9800', fmt: v => v },
  ]
  const sel = opciones.find(o => o.key === metrica)
  const datos = tendencias.slice(-12)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {opciones.map(o => (
          <button key={o.key} onClick={() => setMetrica(o.key)}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={metrica === o.key
              ? { background: `${o.color}15`, border: `1px solid ${o.color}40`, color: o.color }
              : { background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }
            }
          >{o.label}</button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="mes" tick={xTick} />
          <YAxis tick={yTick} />
          <Tooltip contentStyle={tooltipStyle} formatter={v => [sel.fmt(v), sel.label]} />
          <Line type="monotone" dataKey={metrica} stroke={sel.color} strokeWidth={2}
            dot={{ r: 2, fill: sel.color }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-center" style={{ color: tema.textMuted }}>
        {datos.length} meses de historial — datos calculados a partir de la actividad reproductiva registrada.
      </p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Auditoria() {
  const { tema }           = useTheme()
  const { bioterioActivo } = useBioterioActivo()
  const presets            = getPresetsPeriodo()

  const [bioterio, setBioterio]       = useState(bioterioActivo ?? 'ratas')
  const [presetId, setPresetId]       = useState('trimestre')
  const [customA, setCustomA]         = useState({ desde: '', hasta: '' })
  const [customB, setCustomB]         = useState({ desde: '', hasta: '' })
  const [analizando, setAnalizando]   = useState(false)
  const [error, setError]             = useState(null)
  const [resultado, setResultado]     = useState(null)

  const preset = presets.find(p => p.id === presetId)
  const periodosEfectivos = useMemo(() => presetId === 'custom'
    ? { desdeA: customA.desde, hastaA: customA.hasta, desdeB: customB.desde, hastaB: customB.hasta }
    : preset
      ? { desdeA: preset.desdeA, hastaA: preset.hastaA, desdeB: preset.desdeB, hastaB: preset.hastaB }
      : null,
  [presetId, customA, customB, preset])

  // ── Fetch + cálculo ────────────────────────────────────────────────────────
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

      const retiradosA  = (todosAnimales || []).filter(a => a.fecha_sacrificio && a.fecha_sacrificio >= desdeA && a.fecha_sacrificio <= hastaA)
      const retiradosB  = (todosAnimales || []).filter(a => a.fecha_sacrificio && a.fecha_sacrificio >= desdeB && a.fecha_sacrificio <= hastaB)
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

      const comp      = compararPeriodos(mA, mB)
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
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto" style={{ color: tema.textPrimary }}>

      {/* ── Header de página ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tema.textPrimary }}>Auditoría histórica</h1>
        <p className="text-sm mt-1" style={{ color: tema.textMuted }}>
          Compará dos períodos y entendé qué ocurrió, si es esperado, y qué hacer.
        </p>
      </div>

      {/* ── Panel de configuración ────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 space-y-4" style={card}>
        {/* Bioterio */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: tema.textMuted }}>
            Colonia a auditar
          </label>
          <div className="flex flex-wrap gap-2">
            {BIOTERIOS.map(b => (
              <button key={b.id} onClick={() => { setBioterio(b.id); setResultado(null) }}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={bioterio === b.id
                  ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: tema.accent }
                  : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
                }
              >{b.icon} {b.label}</button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: tema.textMuted }}>
            Período de comparación
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={presetId === p.id
                  ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: tema.accent }
                  : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
                }
              >{p.label}</button>
            ))}
            <button onClick={() => setPresetId('custom')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={presetId === 'custom'
                ? { background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: tema.accent }
                : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary }
              }
            >Personalizado</button>
          </div>
        </div>

        {presetId === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Período A (anterior)', data: customA, set: setCustomA, color: tema.textMuted },
              { label: 'Período B (actual)',   data: customB, set: setCustomB, color: tema.accent },
            ].map(({ label, data, set, color }) => (
              <div key={label} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${tema.bgCardBorde}` }}>
                <div className="text-xs font-semibold" style={{ color }}>{label}</div>
                <div className="flex gap-2">
                  <input type="date" value={data.desde} onChange={e => set(p => ({ ...p, desde: e.target.value }))}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs"
                    style={{ background: tema.bgInput, border: `1px solid ${tema.bgCardBorde}`, color: tema.textPrimary }} />
                  <input type="date" value={data.hasta} onChange={e => set(p => ({ ...p, hasta: e.target.value }))}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs"
                    style={{ background: tema.bgInput, border: `1px solid ${tema.bgCardBorde}`, color: tema.textPrimary }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {periodosEfectivos && presetId !== 'custom' && (
          <div className="text-xs space-y-0.5" style={{ color: tema.textMuted }}>
            <div>A (anterior): <b style={{ color: tema.textSecondary }}>{periodosEfectivos.desdeA}</b> → <b style={{ color: tema.textSecondary }}>{periodosEfectivos.hastaA}</b></div>
            <div>B (actual):   <b style={{ color: tema.accent }}>{periodosEfectivos.desdeB}</b> → <b style={{ color: tema.accent }}>{periodosEfectivos.hastaB}</b></div>
          </div>
        )}

        <button onClick={analizar} disabled={analizando}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: analizando ? 'rgba(0,230,118,0.06)' : 'rgba(0,230,118,0.15)',
            border: '1px solid rgba(0,230,118,0.4)', color: tema.accent,
            cursor: analizando ? 'not-allowed' : 'pointer', opacity: analizando ? 0.7 : 1,
          }}
        >{analizando ? '⏳ Analizando...' : '🔬 Analizar y comparar'}</button>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: tema.red }}>
          ⚠️ {error}
        </div>
      )}

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

      {/* ── Resultados ────────────────────────────────────────────────────── */}
      {resultado && (() => {
        const { mA, mB, comp, hipotesis } = resultado

        const perfil        = detectarPerfilOperativo(comp, mA, mB)
        const alertas       = generarAlertasReales(comp, mA, mB)
        const interpretacion = interpretarCambioContextual(comp, perfil, mA, mB)
        const acciones      = generarAccionesRecomendadas(comp, perfil, mA, mB, hipotesis)
        const scoreSust     = calcularIndiceSustentabilidad(mA, mB)
        const estado        = etiquetaEstado(scoreSust)

        const deltaIG   = comp.indiceGlobal?.delta ?? 0
        const tendIcon  = deltaIG > 2 ? '↑' : deltaIG < -2 ? '↓' : '→'
        const tendColor = deltaIG > 2 ? '#00e676' : deltaIG < -2 ? '#ff9800' : '#8a9bb0'

        return (
          <div className="space-y-4">

            {/* ── 1. INTERPRETACIÓN EJECUTIVA ─────────────────────────────── */}
            <div className="rounded-2xl p-5 space-y-4" style={card}>
              {/* Badges de perfil y estado */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: `${perfil.color}15`, border: `1px solid ${perfil.color}40`, color: perfil.color }}>
                    {perfil.emoji} {perfil.label}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: `${estado.color}12`, border: `1px solid ${estado.color}35`, color: estado.color }}>
                    {estado.emoji} {estado.label}
                  </span>
                </div>
                <GaugeCircle valor={scoreSust} color={estado.color} size={72} />
              </div>

              {/* Interpretación automática — frase clave */}
              <p className="text-sm leading-relaxed" style={{ color: tema.textPrimary }}>
                {interpretacion}
              </p>

              {/* Mini KPIs — 4 en grilla 2×2 en mobile, 4 en fila en desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl overflow-hidden"
                style={{ border: `1px solid ${tema.bgCardBorde}` }}>
                <MiniKpi
                  label="Fertilidad"
                  valor={(mB.repro.fertilidad * 100).toFixed(0) + '%'}
                  color={mB.repro.fertilidad >= 0.7 ? '#00e676' : mB.repro.fertilidad >= 0.5 ? '#ffb300' : '#ff6b80'}
                />
                <MiniKpi
                  label="Supervivencia"
                  valor={(mB.repro.supervivenciaMedio * 100).toFixed(0) + '%'}
                  color={mB.repro.supervivenciaMedio >= 0.8 ? '#00e676' : '#ffb300'}
                />
                <MiniKpi
                  label="Sanidad"
                  valor={Math.round(mB.sanidad.indiceSanitario)}
                  color={mB.sanidad.indiceSanitario >= 70 ? '#00e676' : mB.sanidad.indiceSanitario >= 50 ? '#ffb300' : '#ff6b80'}
                />
                <MiniKpi
                  label="Tendencia"
                  valor={tendIcon + ' ' + (deltaIG > 0 ? '+' : '') + Math.round(deltaIG) + ' pts'}
                  color={tendColor}
                />
              </div>
            </div>

            {/* ── 2. ALERTAS ──────────────────────────────────────────────── */}
            {alertas.length > 0 ? (
              <div className="rounded-2xl p-5 space-y-3" style={card}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>Alertas</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(255,61,87,0.1)', color: tema.red }}>
                    {alertas.length}
                  </span>
                </div>
                {alertas.map((alerta, i) => {
                  const cfg = {
                    critico:    { bg: 'rgba(255,61,87,0.08)',  borde: 'rgba(255,61,87,0.25)',  color: tema.red },
                    importante: { bg: 'rgba(255,152,0,0.08)',  borde: 'rgba(255,152,0,0.25)',  color: '#ff9800' },
                    atencion:   { bg: 'rgba(255,179,0,0.06)',  borde: 'rgba(255,179,0,0.2)',   color: tema.amber },
                  }[alerta.nivel] ?? {}
                  return (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.borde}` }}>
                      <span className="text-lg shrink-0 mt-0.5">{alerta.emoji}</span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-sm leading-snug" style={{ color: tema.textPrimary }}>{alerta.texto}</div>
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
                  <div className="text-sm font-semibold" style={{ color: tema.accent }}>Sin alertas críticas</div>
                  <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>No se detectaron problemas reales en el período analizado.</div>
                </div>
              </div>
            )}

            {/* ── 3. ACCIONES RECOMENDADAS ─────────────────────────────────── */}
            {acciones.length > 0 && (
              <div className="rounded-2xl p-5 space-y-3" style={card}>
                <div className="text-sm font-bold" style={{ color: tema.textPrimary }}>Acciones recomendadas</div>
                {acciones.map((accion, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${tema.bgCardBorde}` }}>
                    <span className="text-base shrink-0 mt-0.5">{accion.icono}</span>
                    <span className="text-sm leading-snug" style={{ color: tema.textPrimary }}>{accion.texto}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── 4. DETALLE TÉCNICO (colapsable) ─────────────────────────── */}
            <Colapsable titulo="📊 Detalle por área — métricas y comparación">
              <SeccionTecnica resultado={resultado} bioterio={bioterio} />
            </Colapsable>

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
    </div>
  )
}
