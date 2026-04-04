import { useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { calcularRendimientoMacho, calcularLatencia, interpretarLatencia, formatFecha } from '../utils/calculos'
import Badge from '../components/Badge'

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
  if (score === null) return <Badge color="gris">Sin datos</Badge>
  if (score >= 8) return <Badge color="verde">Excelente</Badge>
  if (score >= 6) return <Badge color="azul">Bueno</Badge>
  if (score >= 4) return <Badge color="amarillo">Regular</Badge>
  return <Badge color="rojo">Lento</Badge>
}

function Medalla({ pos }) {
  if (pos === 1) return <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 6px gold)' }}>🥇</span>
  if (pos === 2) return <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 4px silver)' }}>🥈</span>
  if (pos === 3) return <span className="text-2xl">🥉</span>
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

export default function Rendimiento() {
  const { animales, camadas } = useBioterio()
  const machos = animales.filter((a) => a.sexo === 'macho')

  const ranking = useMemo(() =>
    machos
      .map((macho) => ({ macho, m: calcularRendimientoMacho(macho.id, camadas) }))
      .sort((a, b) => {
        if (a.m.promedio_latencia === null && b.m.promedio_latencia === null) return 0
        if (a.m.promedio_latencia === null) return 1
        if (b.m.promedio_latencia === null) return -1
        return a.m.promedio_latencia - b.m.promedio_latencia
      }),
  [machos, camadas])

  const maxLat = useMemo(() => {
    const vals = ranking.map((r) => r.m.promedio_latencia).filter(Boolean)
    return vals.length ? Math.max(...vals) : 10
  }, [ranking])

  function historial(machoId) {
    return camadas
      .filter((c) => c.id_padre === machoId)
      .map((c) => ({ ...c, madre: animales.find((a) => a.id === c.id_madre), lat: calcularLatencia(c) }))
      .sort((a, b) => (a.fecha_copula ?? '').localeCompare(b.fecha_copula ?? ''))
  }

  const hembraStats = useMemo(() =>
    animales.filter((a) => a.sexo === 'hembra')
      .map((h) => {
        const sus = camadas.filter((c) => c.id_madre === h.id && c.fecha_nacimiento)
        const lats = sus.map((c) => calcularLatencia(c)).filter((l) => l !== null)
        const prom = lats.length ? Math.round(lats.reduce((a,b)=>a+b,0)/lats.length*10)/10 : null
        return { h, total: sus.length, prom, crias: sus.reduce((s,c)=>s+(c.total_crias??0),0) }
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => (a.prom ?? 99) - (b.prom ?? 99)),
  [animales, camadas])

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
        <div>
          <h1 className="text-xl font-bold text-white">Rendimiento reproductivo</h1>
          <p className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
            Menor latencia = mejor desempeño del macho
          </p>
        </div>
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
          <span>🏆</span> Ranking de machos reproductores
        </div>

        {ranking.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={cardStyle}>
            <div className="text-3xl mb-2">♂</div>
            <div style={{ color: '#4a5f7a' }}>No hay machos registrados</div>
          </div>
        ) : (
          <div className="space-y-3">
            {ranking.map(({ macho, m }, idx) => {
              const hist = historial(macho.id)
              return (
                <div key={macho.id} className="rounded-xl overflow-hidden" style={cardStyle}>
                  {/* Fila principal */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 flex justify-center">
                      <Medalla pos={idx + 1} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-lg" style={{ color: '#40c4ff' }}>
                          {macho.codigo}
                        </span>
                        <ScoreBadge score={m.score} />
                      </div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                        {m.total_camadas} apareamiento{m.total_camadas !== 1 ? 's' : ''} con resultado
                      </div>
                    </div>
                    {/* Métricas numéricas */}
                    <div className="hidden md:flex items-center divide-x" style={{ divideColor: 'rgba(30,51,82,0.6)' }}>
                      <Metric label="Promedio" valor={m.promedio_latencia} color="#40c4ff" />
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
                            <th className="text-left pb-1.5 font-medium">Crías</th>
                            <th className="text-left pb-1.5 font-medium">Latencia</th>
                            <th className="text-left pb-1.5 font-medium">Interpretación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hist.map((c) => {
                            const latColor = c.lat === null ? '#4a5f7a'
                              : c.lat <= 2 ? '#00e676'
                              : c.lat <= 5 ? '#40c4ff'
                              : c.lat <= 10 ? '#ffb300' : '#ff6b80'
                            return (
                              <tr key={c.id} style={{ borderTop: '1px solid rgba(30,51,82,0.4)' }}>
                                <td className="py-1.5 font-mono font-semibold" style={{ color: '#ce93d8' }}>
                                  {c.madre?.codigo ?? '?'}
                                </td>
                                <td className="py-1.5 font-mono" style={{ color: '#8a9bb0' }}>{formatFecha(c.fecha_copula)}</td>
                                <td className="py-1.5 font-mono" style={{ color: c.fecha_nacimiento ? '#8a9bb0' : '#ffb300' }}>
                                  {c.fecha_nacimiento ? formatFecha(c.fecha_nacimiento) : 'Pendiente'}
                                </td>
                                <td className="py-1.5 font-mono" style={{ color: '#8a9bb0' }}>{c.total_crias ?? '?'}</td>
                                <td className="py-1.5 font-mono font-bold" style={{ color: latColor }}>
                                  {c.lat !== null ? `${c.lat}d` : '—'}
                                </td>
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
            <span>♀</span> Rendimiento de hembras
          </div>
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.02)' }}>
                  {['Hembra','Partos','Total crías','Latencia promedio','Rendimiento'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                      style={{ color: '#4a5f7a' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hembraStats.map(({ h, total, crias, prom }) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: '#ce93d8' }}>{h.codigo}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: '#8a9bb0' }}>{total}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: '#8a9bb0' }}>{crias}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: prom !== null ? '#40c4ff' : '#4a5f7a' }}>
                      {prom !== null ? `${prom}d` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={prom !== null ? Math.max(0, 10 - prom) : null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
