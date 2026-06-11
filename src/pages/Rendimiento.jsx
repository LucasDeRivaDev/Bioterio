import { useMemo, useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import {
  calcularRendimientoMacho, calcularLatencia, interpretarLatencia,
  scorePorLatencia, formatFecha, difDias, parseDate, hoy,
  calcularPerfilHembra, calcularConfiabilidadHembra,
  detectarBajaPerformanceMacho, calcularTendenciaTamanoCamadas,
  getEstadoCicloHembra,
} from '../utils/calculos'
import { MACHO_EDAD_LIMITE_DIAS, MACHO_EDAD_ALERTA_DIAS } from '../utils/constants'
import Badge from '../components/Badge'
import { Trophy, UserMinus } from 'lucide-react'
import Estadisticas from '../pages/Estadisticas'
import { useTheme } from '../context/ThemeContext'

function BarraLatencia({ valor, max }) {
  const { tema } = useTheme()
  if (valor === null) return <span style={{ color: tema.textMuted }}>—</span>
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0
  const color = valor <= 3 ? '#00e676' : valor <= 6 ? '#ffb300' : '#ff6b80'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(30,51,82,0.8)' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}66` }}
        />
      </div>
      <span className="font-mono text-sm font-bold w-10 text-right" style={{ color }}>{valor}d</span>
    </div>
  )
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <Badge color="gris">Sin datos</Badge>
  if (score >= 8.5) return <Badge color="verde">Excelente</Badge>
  if (score >= 6.5) return <Badge color="azul">Bueno</Badge>
  if (score >= 4.5) return <Badge color="amarillo">Regular</Badge>
  return <Badge color="rojo">Muy lento</Badge>
}

function ScoreChip({ score }) {
  const { tema } = useTheme()
  if (score === null || score === undefined) return <span style={{ color: tema.textMuted }}>—</span>
  const color = score === 10 ? '#00e676' : score === 7 ? '#40c4ff' : score === 5 ? '#ffb300' : '#8a9bb0'
  return (
    <span
      className="inline-flex items-center justify-center font-mono font-bold text-xs px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}
    >
      {score}pts
    </span>
  )
}

function Medalla({ pos }) {
  const { tema } = useTheme()
  if (pos === 1) return <Trophy size={22} style={{ color: '#ffd700', filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.8))' }} />
  if (pos === 2) return <Trophy size={22} style={{ color: '#c0c0c0', filter: 'drop-shadow(0 0 4px rgba(192,192,192,0.6))' }} />
  if (pos === 3) return <Trophy size={22} style={{ color: '#cd7f32' }} />
  return <span className="font-mono font-bold text-sm w-8 text-center" style={{ color: tema.textMuted }}>#{pos}</span>
}

function Metric({ label, valor, color, suffix = 'd' }) {
  const { tema } = useTheme()
  return (
    <div className="text-center px-3">
      <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: tema.textMuted }}>{label}</div>
      <div className="font-mono font-bold text-xl" style={{ color: color ?? '#8a9bb0' }}>
        {valor !== null && valor !== undefined ? `${valor}${suffix}` : '—'}
      </div>
    </div>
  )
}

function TendenciaBadge({ tendencia }) {
  const { tema } = useTheme()
  if (!tendencia) return null
  const cfg = {
    mejorando:    { color: tema.accent, icon: '↑', label: 'Mejorando' },
    estable:      { color: tema.blue, icon: '→', label: 'Estable' },
    disminuyendo: { color: tema.red, icon: '↓', label: 'Disminuyendo' },
  }
  const { color, icon, label } = cfg[tendencia]
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: `${color}15`, border: `1px solid ${color}35`, color }}
    >
      {icon} {label}
    </span>
  )
}

function colorScore(v) {
  if (v == null) return '#4a5f7a'
  if (v >= 8)   return '#00e676'
  if (v >= 6)   return '#ffd740'
  return '#ff6b80'
}

function ScoreCell({ label, value }) {
  const { tema } = useTheme()
  const color = colorScore(value)
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs uppercase tracking-widest font-semibold text-center leading-tight" style={{ color: tema.textMuted }}>{label}</span>
      <span
        className="font-mono font-bold text-sm px-2 py-0.5 rounded-lg"
        style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}
      >
        {value != null ? value : '—'}
      </span>
    </div>
  )
}

const ESTADOS_ACTIVOS = new Set(['activo', 'en_apareamiento', 'en_cria'])

function edadMachoInfo(macho) {
  if (!macho.fecha_nacimiento) return null
  const dias  = difDias(parseDate(macho.fecha_nacimiento), parseDate(hoy()))
  const meses = Math.floor(dias / 30.44)
  const limite  = dias >= MACHO_EDAD_LIMITE_DIAS
  const proxima = !limite && dias >= MACHO_EDAD_ALERTA_DIAS
  return { dias, meses, limite, proxima }
}

function EdadMachoBadge({ macho }) {
  const { tema } = useTheme()
  const info = edadMachoInfo(macho)
  if (!info) return null
  if (info.limite) return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.4)', color: tema.red }}
    >
      <UserMinus size={11} /> Edad avanzada · {info.meses}m
    </span>
  )
  if (info.proxima) return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(255,145,0,0.12)', border: '1px solid rgba(255,145,0,0.35)', color: '#ff9100' }}
    >
      <UserMinus size={11} /> Próximo límite · {info.meses}m
    </span>
  )
  return null
}

const esActivo = (a) => ESTADOS_ACTIVOS.has(a.estado)

function buildRankingMachos(lista, todasCamadas) {
  return lista
    .map((macho) => {
      const m = calcularRendimientoMacho(macho.id, todasCamadas)
      const camadasMacho = todasCamadas.filter((c) => c.id_padre === macho.id && c.fecha_nacimiento)
      const totalMachos  = camadasMacho.reduce((s, c) => s + (c.crias_machos  ?? 0), 0)
      const totalHembras = camadasMacho.reduce((s, c) => s + (c.crias_hembras ?? 0), 0)
      return { macho, m, totalMachos, totalHembras }
    })
    .sort((a, b) => {
      // Ordenar por score total (latencia + camada) de mayor a menor
      const stA = a.m.score_total
      const stB = b.m.score_total
      if (stA === null && stB === null) return 0
      if (stA === null) return 1
      if (stB === null) return -1
      if (stB !== stA) return stB - stA
      // Desempate: mayor cantidad de camadas
      return b.m.total_camadas - a.m.total_camadas
    })
}

function sumaScoresHembra(perfil) {
  if (!perfil) return 0
  return (perfil.avg_time_score       ?? 0)
       + (perfil.avg_litter_size_score ?? 0)
       + (perfil.avg_sex_ratio_score   ?? 0)
       + (perfil.avg_survival_score    ?? 0)
}

function buildHembraStats(lista, todasCamadas) {
  return lista
    .map((h) => {
      const sus    = todasCamadas.filter((c) => c.id_madre === h.id && c.fecha_nacimiento)
      const perfil = calcularPerfilHembra(h.id, todasCamadas)
      const conf   = calcularConfiabilidadHembra(h.id, todasCamadas)
      const crias        = sus.reduce((s, c) => s + (c.total_crias   ?? 0), 0)
      const criasMachos  = sus.reduce((s, c) => s + (c.crias_machos  ?? 0), 0)
      const criasHembras = sus.reduce((s, c) => s + (c.crias_hembras ?? 0), 0)
      const scoreTotal   = perfil ? Math.round(sumaScoresHembra(perfil) * 10) / 10 : null
      const tendencia_camada = calcularTendenciaTamanoCamadas(sus)
      // Criterio eliminatorio: cualquier parto con ≤7 crías → aplazada
      const susInsuf = sus.filter((c) => c.total_crias != null && c.total_crias <= 7)
      const aplazada = susInsuf.length > 0
      const minCrias = aplazada ? Math.min(...susInsuf.map((c) => c.total_crias)) : null
      return { h, total: sus.length, crias, criasMachos, criasHembras, perfil, conf, scoreTotal, tendencia_camada, aplazada, minCrias }
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => {
      // Aplazadas siempre al final del ranking
      if (a.aplazada !== b.aplazada) return a.aplazada ? 1 : -1
      const stA = a.scoreTotal ?? 0
      const stB = b.scoreTotal ?? 0
      if (stB !== stA) return stB - stA
      return b.total - a.total
    })
}

export default function Rendimiento() {
  const { tema } = useTheme()
  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }
  const CONF_CONFIG = {
    ok:       { color: tema.accent, label: 'OK' },
    leve:     { color: '#ffd740', label: 'Leve' },
    moderada: { color: '#ff9100', label: 'Moderada' },
    critica:  { color: '#ff1744', label: 'Crítica' },
  }
  const { animales, animalesExportados, camadas, camadasF1, bio, bioterioActivo } = useBioterio()
  const [vista, setVista] = useState('activos')
  const [subVista, setSubVista] = useState(null)


  // En Híbridos los reproductores reales son los animales exportados de BAL/C y C57,
  // no las crías F1 que están en animales. En los demás bioterios se usa animales normal.
  const esHibridos = bioterioActivo === 'ratones_hibridos'
  const animalesParaRanking = esHibridos ? animalesExportados : animales

  // Para buscar el nombre de la madre en el historial de un macho necesitamos
  // poder buscar en ambos arrays (animales propios + exportados de Híbridos)
  const todosAnimales = useMemo(
    () => esHibridos ? [...animales, ...animalesExportados] : animales,
    [esHibridos, animales, animalesExportados]
  )

  // camadasF1 contiene las camadas F1 de Híbridos donde estos animales participaron
  // (solo tiene datos cuando el bioterio activo es BAL/C o C57)
  const todasCamadas = useMemo(
    () => camadasF1.length > 0 ? [...camadas, ...camadasF1] : camadas,
    [camadas, camadasF1]
  )

  // ── Machos ──────────────────────────────────────────────────────────────────
  const machosHistorico = useMemo(() => animalesParaRanking.filter((a) => a.sexo === 'macho'), [animalesParaRanking])
  const machosActivos   = useMemo(() => machosHistorico.filter(esActivo), [machosHistorico])

  const rankingHistorico = useMemo(() => buildRankingMachos(machosHistorico, todasCamadas), [machosHistorico, todasCamadas])
  const rankingActivos   = useMemo(() => buildRankingMachos(machosActivos, todasCamadas),   [machosActivos,   todasCamadas])
  const ranking = vista === 'activos' ? rankingActivos : rankingHistorico

  const maxLat = useMemo(() => {
    const vals = ranking.map((r) => r.m.promedio_latencia).filter(Boolean)
    return vals.length ? Math.max(...vals) : 10
  }, [ranking])

  function historial(machoId) {
    return todasCamadas
      .filter((c) => c.id_padre === machoId)
      .map((c) => ({ ...c, madre: todosAnimales.find((a) => a.id === c.id_madre), lat: calcularLatencia(c, bio) }))
      .sort((a, b) => (a.fecha_copula ?? '').localeCompare(b.fecha_copula ?? ''))
  }

  // ── Hembras ─────────────────────────────────────────────────────────────────
  const hembraStatsHistorico = useMemo(() =>
    buildHembraStats(animalesParaRanking.filter((a) => a.sexo === 'hembra'), todasCamadas),
  [animalesParaRanking, todasCamadas])

  const hembraStatsActivos = useMemo(() =>
    buildHembraStats(animalesParaRanking.filter((a) => a.sexo === 'hembra' && esActivo(a)), todasCamadas),
  [animalesParaRanking, todasCamadas])

  const hembraStats = vista === 'activos' ? hembraStatsActivos : hembraStatsHistorico

const btnSubTab = (v, label, color) => (
    <button
      onClick={() => setSubVista(v === subVista ? null : v)}
      className="px-4 py-2 rounded-2xl text-xs font-bold transition-all"
      style={
        subVista === v
          ? { background: `${color}18`, border: `1px solid ${color}50`, color }
          : { background: 'transparent', border: `1px solid rgba(30,51,82,0.6)`, color: tema.textMuted }
      }
    >
      {label}
    </button>
  )

  if (subVista === 'estadisticas') {
    return (
      <div className="p-6 space-y-6 min-0" style={{ background: tema.bgMain }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: tema.accent, boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
          <h1 className="text-xl font-bold text-white">Rendimiento reproductivo</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {btnSubTab('estadisticas', '📈 Estadísticas', '#40c4ff')}
          <button
            onClick={() => setSubVista(null)}
            className="px-4 py-2 rounded-2xl text-xs font-bold"
            style={{ background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: tema.textMuted }}
          >
            ← Volver a Rendimiento
          </button>
        </div>
        <Estadisticas />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: tema.bgMain }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: tema.accent, boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Rendimiento reproductivo</h1>
            <p className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
              Mayor score total = mejor posición en ranking
            </p>
          </div>
        </div>

{/* Toggle Activos / Histórico */}
        <div
          className="flex rounded-2xl overflow-hidden text-3xs font-bold"
          style={{ border: '1px solid rgba(30,51,82,0.8)', background: tema.bgInput }}
        >
          <button
            onClick={() => setVista('activos')}
            className="px-4 py-2 transition-all" style={ vista === 'activos' ? { background: 'rgba(0,230,118,0.15)', color: tema.accent, borderRight: '1px solid rgba(30,51,82,0.8)' } : { background: 'transparent', color: tema.textMuted, borderRight: '1px solid rgba(30,51,82,0.8)' } }
          >✦ Activos</button>
          <button
            onClick={() => setVista('historico')}
            className="px-4 py-2 transition-all" style={ vista === 'historico' ? { background: 'rgba(64,196,255,0.12)', color: tema.blue } : { background: 'transparent', color: tema.textMuted } }
>📜 Histórico</button>
        </div>
      </div>

      {/* ── TABS DE SUB-SECCIÓN ──────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {btnSubTab('estadisticas', '📈 Estadísticas', '#40c4ff')}
      </div>

      {/* Indicador de vista */}
      <div
        className="rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={
          vista === 'activos'
            ? { background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }
            : { background: 'rgba(64,196,255,0.05)', border: '1px solid rgba(64,196,255,0.12)' }
        }
      >
        <span className="text-sm">{vista === 'activos' ? '✦' : '📜'}</span>
        <span className="text-xs font-semibold" style={{ color: vista === 'activos' ? '#00e676' : '#40c4ff' }}>
          {vista === 'activos'
            ? 'Mostrando solo animales activos (no sacrificados ni retirados)'
            : 'Mostrando historial completo — incluye animales retirados y fallecidos'}
        </span>
      </div>

      {/* Explicación del cálculo */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.15)' }}
      >
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: tema.blue }}>
          🧮 Cómo se calcula el score total — Machos
        </div>
        <div className="space-y-1 text-sm font-mono" style={{ color: 'rgba(64,196,255,0.7)' }}>
          <div>
            <span style={{ color: tema.textSecondary }}>Score total</span>{' = '}
            <span style={{ color: tema.blue }}>Score latencia</span>{' + '}
            <span style={{ color: tema.accent }}>Score camada</span>
            <span style={{ color: tema.textMuted }}>{' (máx 20 pts)'}</span>
          </div>
          <div className="text-xs mt-1 space-y-0.5">
            <div><span style={{ color: tema.blue }}>Score latencia:</span><span style={{ color: tema.textMuted }}> 0–5d→10pts · 6–10d→7pts · 11–15d→5pts</span></div>
            <div><span style={{ color: tema.accent }}>Score camada:</span><span style={{ color: tema.textMuted }}> ≥10 crías→10pts · 8–9→7pts · &lt;8→0pts</span></div>
          </div>
        </div>
        <div className="text-xs mt-2" style={{ color: 'rgba(64,196,255,0.4)' }}>
          Latencia = (Fecha nacimiento − gestación) − Fecha cópula · Gestación default: {bio.GESTACION_DIAS}d
        </div>
      </div>

      {/* Ranking machos */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: tema.textMuted }}>
          <span>🏆</span>
          {vista === 'activos' ? 'Ranking de machos — solo activos' : 'Ranking histórico de machos'}
        </div>

        {ranking.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={cardStyle}>
            <div className="text-3xl mb-2">♂</div>
            <div style={{ color: tema.textMuted }}>No hay machos registrados</div>
          </div>
        ) : (
          <div className="space-y-3">
            {ranking.map(({ macho, m, totalMachos, totalHembras }, idx) => {
              const hist     = historial(macho.id)
              const bajaPerf = esActivo(macho) ? detectarBajaPerformanceMacho(macho.id, todasCamadas) : null
              return (
                <div key={macho.id} className="rounded-xl overflow-hidden" style={cardStyle}>
                  {/* Fila principal */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 flex justify-center">
                      <Medalla pos={idx + 1} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono font-bold text-lg" style={{ color: macho.notas && macho.nota_tipo === 'critica' ? '#ff6b80' : '#40c4ff' }}>
                          {macho.codigo}
                        </span>
                        {macho.notas && (
                          <span title={macho.notas} style={{ color: macho.nota_tipo === 'critica' ? '#ff1744' : '#ffb300', cursor: 'help' }}>⚠</span>
                        )}
                        <ScoreBadge score={m.score} />
                        {m.tendencia_camada && <TendenciaBadge tendencia={m.tendencia_camada} />}
                        {esActivo(macho) && <EdadMachoBadge macho={macho} />}
                        {vista === 'historico' && !esActivo(macho) && (
                          <Badge color={macho.estado === 'fallecido' ? 'rojo' : 'gris'}>
                            {macho.estado === 'fallecido' ? 'Fallecido' : 'Retirado'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono" style={{ color: tema.textMuted }}>
                        {m.total_camadas} apareamiento{m.total_camadas !== 1 ? 's' : ''} con resultado
                        {m.total_camadas > 0 && (
                          <span className="ml-2">
                            ·{' '}
                            <span style={{ color: tema.blue }}>{totalMachos}♂</span>
                            {' / '}
                            <span style={{ color: tema.purple }}>{totalHembras}♀</span>
                          </span>
                        )}
                        {m.avg_litter_size !== null && (
                          <span className="ml-2">· prom. <span style={{ color: tema.accent }}>{m.avg_litter_size} crías</span></span>
                        )}
                      </div>
                    </div>
                    {/* Métricas numéricas */}
                    <div className="hidden md:flex items-center divide-x" style={{ divideColor: 'rgba(30,51,82,0.6)' }}>
                      <div className="text-center px-3">
                        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: tema.textMuted }}>Score total</div>
                        <div className="font-mono font-bold text-xl" style={{ color: m.score_total !== null ? '#00e676' : '#8a9bb0' }}>
                          {m.score_total !== null ? m.score_total : '—'}
                          <span className="text-xs font-normal ml-0.5" style={{ color: tema.textMuted }}>/20</span>
                        </div>
                      </div>
                      <div className="text-center px-3">
                        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: tema.textMuted }}>Lat. score</div>
                        <div className="font-mono font-bold text-xl" style={{ color: m.score_promedio !== null ? '#40c4ff' : '#8a9bb0' }}>
                          {m.score_promedio !== null ? m.score_promedio : '—'}
                        </div>
                      </div>
                      <Metric label="Camada score" valor={m.avg_litter_score} color="#00e676" suffix="" />
                      <Metric label="Lat. prom." valor={m.promedio_latencia} color="#40c4ff" />
                    </div>
                    {/* Barra */}
                    <div className="w-36">
                      <BarraLatencia valor={m.promedio_latencia} max={maxLat} />
                    </div>
                  </div>

                  {/* Alerta de baja performance */}
                  {bajaPerf && (
                    <div
                      className="mx-5 mb-3 rounded-xl px-4 py-2.5 flex items-start gap-2"
                      style={{ background: 'rgba(255,215,64,0.07)', border: '1px solid rgba(255,215,64,0.25)' }}
                    >
                      <UserMinus size={14} style={{ color: '#ffd740', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div className="text-xs font-bold" style={{ color: '#ffd740' }}>
                          Posible baja de fertilidad — Evaluar reemplazo
                        </div>
                        <div className="text-xs mt-0.5 opacity-75" style={{ color: '#ffd740' }}>
                          {bajaPerf.tipo === 'ambos'
                            ? `Latencia y tamaño de camada en declive`
                            : bajaPerf.tipo === 'latencia'
                              ? `Latencia en aumento: últimas ${bajaPerf.n} → ${bajaPerf.avgLatUltimas}d · previas → ${bajaPerf.avgLatPrevias}d`
                              : `Tamaño cayendo: últimas ${bajaPerf.n} → ${bajaPerf.avgTUltimas} crías · previas → ${bajaPerf.avgTPrevias}`
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historial de apareamientos */}
                  {hist.length > 0 && (
                    <div
                      className="px-5 py-3"
                      style={{ borderTop: '1px solid rgba(0,230,118,0.06)', background: 'rgba(0,0,0,0.15)' }}
                    >
                      <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: tema.textMuted }}>
                        Historial
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ color: tema.textMuted }}>
                            <th className="text-left pb-1.5 font-medium">Hembra</th>
                            <th className="text-left pb-1.5 font-medium">Cópula</th>
                            <th className="text-left pb-1.5 font-medium">Nacimiento</th>
                            <th className="text-left pb-1.5 font-medium">Crías (♂ / ♀)</th>
                            <th className="text-left pb-1.5 font-medium">Latencia</th>
                            <th className="text-left pb-1.5 font-medium">Score</th>
                            <th className="text-left pb-1.5 font-medium">Interpretación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hist.map((c) => {
                            const latColor = c.lat === null ? '#4a5f7a'
                              : c.lat <= 2 ? '#00e676'
                              : c.lat <= 5 ? '#40c4ff'
                              : c.lat <= 10 ? '#ffb300' : '#ff6b80'
                            const scoreInd = scorePorLatencia(c.lat)
                            return (
                              <tr key={c.id} style={{ borderTop: '1px solid rgba(30,51,82,0.4)' }}>
                                <td className="py-1.5 font-mono font-semibold" style={{ color: tema.purple }}>
                                  {c.madre?.codigo ?? '?'}
                                </td>
                                <td className="py-1.5 font-mono" style={{ color: tema.textSecondary }}>{formatFecha(c.fecha_copula)}</td>
                                <td className="py-1.5 font-mono" style={{ color: c.fecha_nacimiento ? '#8a9bb0' : '#ffb300' }}>
                                  {c.fecha_nacimiento ? formatFecha(c.fecha_nacimiento) : 'Pendiente'}
                                </td>
                                <td className="py-1.5 font-mono" style={{ color: tema.textSecondary }}>
                                  {c.crias_machos != null || c.crias_hembras != null
                                    ? <><span style={{ color: tema.blue }}>{c.crias_machos ?? '?'}♂</span>{' / '}<span style={{ color: tema.purple }}>{c.crias_hembras ?? '?'}♀</span></>
                                    : (c.total_crias ?? '?')}
                                </td>
                                <td className="py-1.5 font-mono font-bold" style={{ color: latColor }}>
                                  {c.lat !== null ? `${c.lat}d` : '—'}
                                </td>
                                <td className="py-1.5"><ScoreChip score={scoreInd} /></td>
                                <td className="py-1.5" style={{ color: tema.textMuted }}>{interpretarLatencia(c.lat)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Hembras */}
      {hembraStats.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: tema.textMuted }}>
            <span>♀</span>
            {vista === 'activos' ? 'Perfil de hembras — solo activas' : 'Perfil histórico de hembras'}
          </div>
          <div className="space-y-3">
            {hembraStats.map(({ h, total, crias, criasMachos, criasHembras, perfil, conf, scoreTotal, tendencia_camada, aplazada, minCrias }, idx) => {
              const confCfg = conf ? CONF_CONFIG[conf.nivel] : null
              const estadoCiclo = esActivo(h) ? getEstadoCicloHembra(h.id, todasCamadas) : 'normal'
              return (
                <div key={h.id} className="rounded-xl overflow-hidden"
                  style={{ ...cardStyle, ...(aplazada ? { borderColor: 'rgba(255,61,87,0.35)' } : {}) }}>
                  {/* Banner aplazada */}
                  {aplazada && (
                    <div className="flex items-center gap-2 px-5 py-2"
                      style={{ background: 'rgba(255,61,87,0.08)', borderBottom: '1px solid rgba(255,61,87,0.2)' }}>
                      <span style={{ color: tema.red, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.05em' }}>🔴 APLAZADA</span>
                      <span style={{ color: tema.red, fontSize: '0.7rem', opacity: 0.8 }}>
                        Camada insuficiente — mín. {minCrias} crías (umbral: 8)
                      </span>
                    </div>
                  )}
                  {/* Header */}
                  <div className="flex items-center gap-4 px-5 py-3"
                    style={{ borderBottom: '1px solid rgba(30,51,82,0.4)', background: aplazada ? 'rgba(255,61,87,0.02)' : 'rgba(206,147,216,0.03)' }}>
                    <div className="w-10 flex justify-center">
                      <Medalla pos={idx + 1} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-lg" style={{ color: aplazada ? tema.red : (h.notas && h.nota_tipo === 'critica' ? '#ff6b80' : '#ce93d8') }}>{h.codigo}</span>
                        {h.notas && (
                          <span title={h.notas} style={{ color: h.nota_tipo === 'critica' ? '#ff1744' : '#ffb300', cursor: 'help' }}>⚠</span>
                        )}
                        {confCfg && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${confCfg.color}15`, border: `1px solid ${confCfg.color}40`, color: confCfg.color }}
                          >
                            {conf.nivel !== 'ok' ? `⚠ ${confCfg.label}` : `✓ ${confCfg.label}`}
                          </span>
                        )}
                        {tendencia_camada && <TendenciaBadge tendencia={tendencia_camada} />}
                        {estadoCiclo === 'ultimo_ciclo' && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,179,0,0.12)', border: '1px solid rgba(255,179,0,0.35)', color: tema.amber }}>
                            🟡 Último ciclo
                          </span>
                        )}
                        {estadoCiclo === 'fin_ciclo' && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.3)', color: tema.red }}>
                            🔚 Fin de ciclo
                          </span>
                        )}
                        {vista === 'historico' && !esActivo(h) && (
                          <Badge color={h.estado === 'fallecido' ? 'rojo' : 'gris'}>
                            {h.estado === 'fallecido' ? 'Fallecida' : 'Retirada'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                        {total} parto{total !== 1 ? 's' : ''} · {crias} crías
                        {crias > 0 && (
                          <span className="ml-1">
                            (<span style={{ color: tema.blue }}>{criasMachos}♂</span>
                            {' / '}
                            <span style={{ color: tema.purple }}>{criasHembras}♀</span>)
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Score total hembra */}
                    {scoreTotal !== null && (
                      <div className="text-center px-3 hidden md:block">
                        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: tema.textMuted }}>Score total</div>
                        <div className="font-mono font-bold text-xl" style={{ color: aplazada ? tema.red : tema.purple }}>
                          {scoreTotal}
                          <span className="text-xs font-normal ml-0.5" style={{ color: tema.textMuted }}>/40</span>
                        </div>
                        {aplazada && (
                          <div className="text-xs font-bold mt-0.5" style={{ color: tema.red }}>NO APTA</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Scores de la hembra */}
                  <div className="px-5 py-4">
                    {perfil ? (
                      <div className="grid grid-cols-4 gap-4">
                        <ScoreCell label="Vel. repro." value={perfil.avg_time_score} />
                        <ScoreCell label="Tamaño camada" value={perfil.avg_litter_size_score} />
                        <ScoreCell label="Prop. sexual" value={perfil.avg_sex_ratio_score} />
                        <ScoreCell label="Supervivencia" value={perfil.avg_survival_score} />
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: tema.textMuted }}>Sin camadas con datos completos</div>
                    )}

                    {/* Leyenda de colores */}
                    {perfil && (
                      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(30,51,82,0.4)' }}>
                        <span className="text-xs" style={{ color: tema.textMuted }}>Escala:</span>
                        {[['#00e676','8–10 Excelente'],['#ffd740','6–7.9 Bueno'],['#ff6b80','<6 Bajo']].map(([c,l]) => (
                          <span key={l} className="flex items-center gap-1 text-xs">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                            <span style={{ color: tema.textMuted }}>{l}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sin datos */}
      {todasCamadas.filter((c) => c.fecha_nacimiento).length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.15)' }}
        >
          <div className="text-3xl mb-2">📊</div>
          <div className="font-semibold text-sm" style={{ color: tema.amber }}>Sin datos de rendimiento aún</div>
          <div className="text-xs mt-1" style={{ color: tema.textMuted }}>
            Registrá camadas con fecha de nacimiento para ver el análisis de latencia
          </div>
        </div>
      )}
    </div>
  )
}
