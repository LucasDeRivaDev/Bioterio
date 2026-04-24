import { useMemo, useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import {
  calcularRendimientoMacho, calcularLatencia, interpretarLatencia,
  scorePorLatencia, formatFecha,
  calcularPerfilHembra, calcularConfiabilidadHembra,
} from '../utils/calculos'
import Badge from '../components/Badge'
import { Trophy } from 'lucide-react'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

function BarraLatencia({ valor, max }) {
  if (valor === null) return <span style={{ color: '#4a5f7a' }}>—</span>
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
  if (score === null || score === undefined) return <span style={{ color: '#4a5f7a' }}>—</span>
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
  if (pos === 1) return <Trophy size={22} style={{ color: '#ffd700', filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.8))' }} />
  if (pos === 2) return <Trophy size={22} style={{ color: '#c0c0c0', filter: 'drop-shadow(0 0 4px rgba(192,192,192,0.6))' }} />
  if (pos === 3) return <Trophy size={22} style={{ color: '#cd7f32' }} />
  return <span className="font-mono font-bold text-sm w-8 text-center" style={{ color: '#4a5f7a' }}>#{pos}</span>
}

function Metric({ label, valor, color }) {
  return (
    <div className="text-center px-3">
      <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>{label}</div>
      <div className="font-mono font-bold text-xl" style={{ color: color ?? '#8a9bb0' }}>
        {valor !== null && valor !== undefined ? `${valor}d` : '—'}
      </div>
    </div>
  )
}

function colorScore(v) {
  if (v == null) return '#4a5f7a'
  if (v >= 8)   return '#00e676'
  if (v >= 6)   return '#ffd740'
  return '#ff6b80'
}

function ScoreCell({ label, value }) {
  const color = colorScore(value)
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs uppercase tracking-widest font-semibold text-center leading-tight" style={{ color: '#4a5f7a' }}>{label}</span>
      <span
        className="font-mono font-bold text-sm px-2 py-0.5 rounded-lg"
        style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}
      >
        {value != null ? value : '—'}
      </span>
    </div>
  )
}

const CONF_CONFIG = {
  ok:       { color: '#00e676', label: 'OK' },
  leve:     { color: '#ffd740', label: 'Leve' },
  moderada: { color: '#ff9100', label: 'Moderada' },
  critica:  { color: '#ff1744', label: 'Crítica' },
}

const ESTADOS_ACTIVOS = new Set(['activo', 'en_apareamiento', 'en_cria'])

export default function Rendimiento() {
  const { animales, camadas, bio } = useBioterio()
  const [vista, setVista] = useState('activos')

  const esActivo = (a) => ESTADOS_ACTIVOS.has(a.estado)

  // ── Machos ──────────────────────────────────────────────────────────────────
  const machosHistorico = animales.filter((a) => a.sexo === 'macho')
  const machosActivos   = machosHistorico.filter(esActivo)

  function buildRankingMachos(lista) {
    return lista
      .map((macho) => {
        const m = calcularRendimientoMacho(macho.id, camadas)
        const camadasMacho = camadas.filter((c) => c.id_padre === macho.id && c.fecha_nacimiento)
        const totalMachos  = camadasMacho.reduce((s, c) => s + (c.crias_machos  ?? 0), 0)
        const totalHembras = camadasMacho.reduce((s, c) => s + (c.crias_hembras ?? 0), 0)
        return { macho, m, totalMachos, totalHembras }
      })
      .sort((a, b) => {
        if (a.m.promedio_latencia === null && b.m.promedio_latencia === null) return 0
        if (a.m.promedio_latencia === null) return 1
        if (b.m.promedio_latencia === null) return -1
        return a.m.promedio_latencia - b.m.promedio_latencia
      })
  }

  const rankingHistorico = useMemo(() => buildRankingMachos(machosHistorico), [machosHistorico, camadas])
  const rankingActivos   = useMemo(() => buildRankingMachos(machosActivos),   [machosActivos,   camadas])
  const ranking = vista === 'activos' ? rankingActivos : rankingHistorico

  const maxLat = useMemo(() => {
    const vals = ranking.map((r) => r.m.promedio_latencia).filter(Boolean)
    return vals.length ? Math.max(...vals) : 10
  }, [ranking])

  function historial(machoId) {
    return camadas
      .filter((c) => c.id_padre === machoId)
      .map((c) => ({ ...c, madre: animales.find((a) => a.id === c.id_madre), lat: calcularLatencia(c, bio) }))
      .sort((a, b) => (a.fecha_copula ?? '').localeCompare(b.fecha_copula ?? ''))
  }

  // ── Hembras ─────────────────────────────────────────────────────────────────
  function buildHembraStats(lista) {
    return lista
      .map((h) => {
        const sus    = camadas.filter((c) => c.id_madre === h.id && c.fecha_nacimiento)
        const perfil = calcularPerfilHembra(h.id, camadas)
        const conf   = calcularConfiabilidadHembra(h.id, camadas)
        const crias        = sus.reduce((s, c) => s + (c.total_crias   ?? 0), 0)
        const criasMachos  = sus.reduce((s, c) => s + (c.crias_machos  ?? 0), 0)
        const criasHembras = sus.reduce((s, c) => s + (c.crias_hembras ?? 0), 0)
        return { h, total: sus.length, crias, criasMachos, criasHembras, perfil, conf }
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => {
        const avgA = a.perfil ? [a.perfil.avg_time_score, a.perfil.avg_litter_size_score, a.perfil.avg_survival_score].filter(Boolean) : []
        const avgB = b.perfil ? [b.perfil.avg_time_score, b.perfil.avg_litter_size_score, b.perfil.avg_survival_score].filter(Boolean) : []
        const scoreA = avgA.length ? avgA.reduce((s,v) => s+v, 0) / avgA.length : 0
        const scoreB = avgB.length ? avgB.reduce((s,v) => s+v, 0) / avgB.length : 0
        return scoreB - scoreA
      })
  }

  const hembraStatsHistorico = useMemo(() =>
    buildHembraStats(animales.filter((a) => a.sexo === 'hembra')),
  [animales, camadas])

  const hembraStatsActivos = useMemo(() =>
    buildHembraStats(animales.filter((a) => a.sexo === 'hembra' && esActivo(a))),
  [animales, camadas])

  const hembraStats = vista === 'activos' ? hembraStatsActivos : hembraStatsHistorico

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Rendimiento reproductivo</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
              Menor latencia = mejor desempeño del macho
            </p>
          </div>
        </div>

        {/* Toggle Activos / Histórico */}
        <div
          className="flex rounded-xl overflow-hidden text-xs font-bold"
          style={{ border: '1px solid rgba(30,51,82,0.8)', background: 'rgba(8,13,26,0.8)' }}
        >
          <button
            onClick={() => setVista('activos')}
            className="px-4 py-2 transition-all"
            style={
              vista === 'activos'
                ? { background: 'rgba(0,230,118,0.15)', color: '#00e676', borderRight: '1px solid rgba(30,51,82,0.8)' }
                : { background: 'transparent', color: '#4a5f7a', borderRight: '1px solid rgba(30,51,82,0.8)' }
            }
          >
            ✦ Activos
          </button>
          <button
            onClick={() => setVista('historico')}
            className="px-4 py-2 transition-all"
            style={
              vista === 'historico'
                ? { background: 'rgba(64,196,255,0.12)', color: '#40c4ff' }
                : { background: 'transparent', color: '#4a5f7a' }
            }
          >
            📜 Histórico
          </button>
        </div>
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
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#40c4ff' }}>
          🧮 Cómo se calcula la latencia
        </div>
        <div className="space-y-1 text-sm font-mono" style={{ color: 'rgba(64,196,255,0.7)' }}>
          <div>
            <span style={{ color: '#8a9bb0' }}>Concepción estimada</span>{' = '}
            <span style={{ color: '#40c4ff' }}>Fecha de nacimiento</span>{' − '}
            <span style={{ color: '#ce93d8' }}>23 días</span>
          </div>
          <div>
            <span style={{ color: '#8a9bb0' }}>Latencia</span>{' = '}
            <span style={{ color: '#40c4ff' }}>Concepción estimada</span>{' − '}
            <span style={{ color: '#ce93d8' }}>Fecha de cópula</span>
          </div>
        </div>
        <div className="text-xs mt-2" style={{ color: 'rgba(64,196,255,0.4)' }}>
          Ejemplo: cópula día 1 · nacimiento día 26 → concepción día 3 → latencia 2 días (🥇 excelente)
        </div>
      </div>

      {/* Ranking machos */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#4a5f7a' }}>
          <span>🏆</span>
          {vista === 'activos' ? 'Ranking de machos — solo activos' : 'Ranking histórico de machos'}
        </div>

        {ranking.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={cardStyle}>
            <div className="text-3xl mb-2">♂</div>
            <div style={{ color: '#4a5f7a' }}>No hay machos registrados</div>
          </div>
        ) : (
          <div className="space-y-3">
            {ranking.map(({ macho, m, totalMachos, totalHembras }, idx) => {
              const hist = historial(macho.id)
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
                        {vista === 'historico' && !esActivo(macho) && (
                          <Badge color={macho.estado === 'fallecido' ? 'rojo' : 'gris'}>
                            {macho.estado === 'fallecido' ? 'Fallecido' : 'Retirado'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                        {m.total_camadas} apareamiento{m.total_camadas !== 1 ? 's' : ''} con resultado
                        {m.total_camadas > 0 && (
                          <span className="ml-2">
                            ·{' '}
                            <span style={{ color: '#40c4ff' }}>{totalMachos}♂</span>
                            {' / '}
                            <span style={{ color: '#ce93d8' }}>{totalHembras}♀</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Métricas numéricas */}
                    <div className="hidden md:flex items-center divide-x" style={{ divideColor: 'rgba(30,51,82,0.6)' }}>
                      <div className="text-center px-3">
                        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>Score prom.</div>
                        <div className="font-mono font-bold text-xl" style={{ color: m.score_promedio !== null ? '#00e676' : '#8a9bb0' }}>
                          {m.score_promedio !== null ? m.score_promedio : '—'}
                        </div>
                      </div>
                      <Metric label="Lat. prom." valor={m.promedio_latencia} color="#40c4ff" />
                      <Metric label="Mínimo" valor={m.min_latencia} color="#00e676" />
                      <Metric label="Máximo" valor={m.max_latencia} color="#ff6b80" />
                    </div>
                    {/* Barra */}
                    <div className="w-36">
                      <BarraLatencia valor={m.promedio_latencia} max={maxLat} />
                    </div>
                  </div>

                  {/* Historial de apareamientos */}
                  {hist.length > 0 && (
                    <div
                      className="px-5 py-3"
                      style={{ borderTop: '1px solid rgba(0,230,118,0.06)', background: 'rgba(0,0,0,0.15)' }}
                    >
                      <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#4a5f7a' }}>
                        Historial
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ color: '#4a5f7a' }}>
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
                                <td className="py-1.5 font-mono font-semibold" style={{ color: '#ce93d8' }}>
                                  {c.madre?.codigo ?? '?'}
                                </td>
                                <td className="py-1.5 font-mono" style={{ color: '#8a9bb0' }}>{formatFecha(c.fecha_copula)}</td>
                                <td className="py-1.5 font-mono" style={{ color: c.fecha_nacimiento ? '#8a9bb0' : '#ffb300' }}>
                                  {c.fecha_nacimiento ? formatFecha(c.fecha_nacimiento) : 'Pendiente'}
                                </td>
                                <td className="py-1.5 font-mono" style={{ color: '#8a9bb0' }}>
                                  {c.crias_machos != null || c.crias_hembras != null
                                    ? <><span style={{ color: '#40c4ff' }}>{c.crias_machos ?? '?'}♂</span>{' / '}<span style={{ color: '#ce93d8' }}>{c.crias_hembras ?? '?'}♀</span></>
                                    : (c.total_crias ?? '?')}
                                </td>
                                <td className="py-1.5 font-mono font-bold" style={{ color: latColor }}>
                                  {c.lat !== null ? `${c.lat}d` : '—'}
                                </td>
                                <td className="py-1.5"><ScoreChip score={scoreInd} /></td>
                                <td className="py-1.5" style={{ color: '#4a5f7a' }}>{interpretarLatencia(c.lat)}</td>
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
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#4a5f7a' }}>
            <span>♀</span>
            {vista === 'activos' ? 'Perfil de hembras — solo activas' : 'Perfil histórico de hembras'}
          </div>
          <div className="space-y-3">
            {hembraStats.map(({ h, total, crias, criasMachos, criasHembras, perfil, conf }, idx) => {
              const confCfg = conf ? CONF_CONFIG[conf.nivel] : null
              return (
                <div key={h.id} className="rounded-xl overflow-hidden" style={cardStyle}>
                  {/* Header */}
                  <div className="flex items-center gap-4 px-5 py-3"
                    style={{ borderBottom: '1px solid rgba(30,51,82,0.4)', background: 'rgba(206,147,216,0.03)' }}>
                    <div className="w-10 flex justify-center">
                      <Medalla pos={idx + 1} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-lg" style={{ color: h.notas && h.nota_tipo === 'critica' ? '#ff6b80' : '#ce93d8' }}>{h.codigo}</span>
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
                        {vista === 'historico' && !esActivo(h) && (
                          <Badge color={h.estado === 'fallecido' ? 'rojo' : 'gris'}>
                            {h.estado === 'fallecido' ? 'Fallecida' : 'Retirada'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                        {total} parto{total !== 1 ? 's' : ''} · {crias} crías
                        {crias > 0 && (
                          <span className="ml-1">
                            (<span style={{ color: '#40c4ff' }}>{criasMachos}♂</span>
                            {' / '}
                            <span style={{ color: '#ce93d8' }}>{criasHembras}♀</span>)
                          </span>
                        )}
                      </div>
                    </div>
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
                      <div className="text-xs" style={{ color: '#4a5f7a' }}>Sin camadas con datos completos</div>
                    )}

                    {/* Leyenda de colores */}
                    {perfil && (
                      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(30,51,82,0.4)' }}>
                        <span className="text-xs" style={{ color: '#4a5f7a' }}>Escala:</span>
                        {[['#00e676','8–10 Excelente'],['#ffd740','6–7.9 Bueno'],['#ff6b80','<6 Bajo']].map(([c,l]) => (
                          <span key={l} className="flex items-center gap-1 text-xs">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                            <span style={{ color: '#4a5f7a' }}>{l}</span>
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
      {camadas.filter((c) => c.fecha_nacimiento).length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.15)' }}
        >
          <div className="text-3xl mb-2">📊</div>
          <div className="font-semibold text-sm" style={{ color: '#ffb300' }}>Sin datos de rendimiento aún</div>
          <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
            Registrá camadas con fecha de nacimiento para ver el análisis de latencia
          </div>
        </div>
      )}
    </div>
  )
}
