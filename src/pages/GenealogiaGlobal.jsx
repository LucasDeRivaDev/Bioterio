import { useState, useMemo } from 'react'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { supabase } from '../lib/supabase'
import { useEffect } from 'react'
import {
  buildPedigree,
  estadisticasColonia,
  calcularFCoeficiente,
  calcularFIndividual,
  fPorcentaje,
  nivelConsanguinidad,
  evaluarApareamientoGenetico,
  LABEL_PARENTESCO,
} from '../utils/genealogia'
import { formatFecha, difDias, parseDate, hoy } from '../utils/calculos'

const TODOS = ['ratas', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Barra({ valor, max = 1, color, height = 6 }) {
  const pct = Math.min((valor / Math.max(max, 0.001)) * 100, 100)
  return (
    <div className="rounded-full overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)', height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function BadgeNivel({ f }) {
  const n = nivelConsanguinidad(f)
  if (f === 0) return null
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full"
      style={{ background: `${n.color}18`, border: `1px solid ${n.color}40`, color: n.color }}
    >
      {fPorcentaje(f)}%
    </span>
  )
}

// ── Simulador de apareamiento ─────────────────────────────────────────────────
function SimuladorApareamientoPanel({ animales, pedigree }) {
  const [madreId, setMadreId] = useState('')
  const [padreId, setPadreId] = useState('')

  const hembras = animales.filter((a) => a.sexo === 'hembra' && ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
  const machos  = animales.filter((a) => a.sexo === 'macho'  && ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))

  const resultado = useMemo(() => {
    if (!madreId || !padreId) return null
    return evaluarApareamientoGenetico(madreId, padreId, pedigree)
  }, [madreId, padreId, pedigree])

  const selectStyle = {
    background: 'rgba(8,13,26,0.8)',
    border: '1px solid rgba(30,51,82,0.8)',
    color: '#c9d4e0',
    borderRadius: '10px',
    padding: '8px 12px',
    width: '100%',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(64,196,255,0.2)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(64,196,255,0.1)', background: 'rgba(64,196,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔬</span>
          <span className="font-bold text-sm text-white">Simulador de apareamiento</span>
          <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>· predicción de F en crías</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
              ♀ Hembra
            </label>
            <select value={madreId} onChange={(e) => setMadreId(e.target.value)} style={selectStyle}>
              <option value="">— Seleccioná —</option>
              {hembras.map((a) => (
                <option key={a.id} value={a.id}>{a.codigo} ({a.bioterio_id})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
              ♂ Macho
            </label>
            <select value={padreId} onChange={(e) => setPadreId(e.target.value)} style={selectStyle}>
              <option value="">— Seleccioná —</option>
              {machos.map((a) => (
                <option key={a.id} value={a.id}>{a.codigo} ({a.bioterio_id})</option>
              ))}
            </select>
          </div>
        </div>

        {resultado && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: `${resultado.nivel.color}08`,
              border: `1.5px solid ${resultado.nivel.color}40`,
            }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold font-mono" style={{ color: resultado.nivel.color }}>
                F = {fPorcentaje(resultado.f)}%
              </span>
              <span
                className="text-sm font-semibold px-3 py-1 rounded-xl"
                style={{ background: `${resultado.nivel.color}15`, color: resultado.nivel.color, border: `1px solid ${resultado.nivel.color}40` }}
              >
                {resultado.nivel.label}
              </span>
            </div>

            {resultado.parentesco && LABEL_PARENTESCO[resultado.parentesco] && (
              <div className="flex items-center gap-2 text-sm">
                <span>{LABEL_PARENTESCO[resultado.parentesco].emoji}</span>
                <span style={{ color: '#c9d4e0' }}>{LABEL_PARENTESCO[resultado.parentesco].texto}</span>
              </div>
            )}

            {resultado.recomendacion && (
              <div
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{
                  background: `${resultado.nivel.color}10`,
                  color: resultado.nivel.color,
                }}
              >
                {resultado.recomendacion.tipo === 'bloqueo' ? '⛔' : resultado.recomendacion.tipo === 'advertencia' ? '⚠️' : '🟡'}{' '}
                {resultado.recomendacion.texto}
              </div>
            )}

            {resultado.f === 0 && !resultado.parentesco && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#00e676' }}>
                <span>✓</span>
                <span>Sin consanguinidad detectada — apareamiento genéticamente seguro</span>
              </div>
            )}

            {/* Barras de referencia */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-mono" style={{ color: '#4a5f7a' }}>
                <span>0% (sin parentesco)</span>
                <span>12.5% (med. hermanos)</span>
                <span>25% (hermanos)</span>
                <span>50%</span>
              </div>
              <div className="relative h-3 rounded-full" style={{ background: 'rgba(30,51,82,0.6)' }}>
                {/* Marcas de referencia */}
                <div className="absolute top-0 bottom-0 w-px" style={{ left: '25%', background: 'rgba(255,215,64,0.4)' }} />
                <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: 'rgba(255,145,0,0.5)' }} />
                {/* Barra de F */}
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(resultado.f / 0.5 * 100, 100)}%`,
                    background: resultado.nivel.color,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {!resultado && madreId && padreId && (
          <div className="text-sm text-center py-4" style={{ color: '#4a5f7a' }}>
            Calculando...
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GenealogiaGlobal() {
  const { setBioterioActivo } = useBioterioActivo()
  const [datos, setDatos]     = useState({}) // bioterioId → { animales, camadas }
  const [cargando, setCargando] = useState(true)
  const [bioSel, setBioSel]   = useState('todos')

  useEffect(() => {
    async function cargar() {
      try {
        const resultados = {}
        await Promise.all(
          TODOS.map(async (id) => {
            const [{ data: animales }, { data: camadas }] = await Promise.all([
              supabase.from('animales').select('id,codigo,sexo,estado,fecha_nacimiento,id_madre,id_padre,bioterio_id').eq('bioterio_id', id),
              supabase.from('camadas').select('id,id_madre,id_padre,fecha_copula,fecha_nacimiento,total_crias,failure_flag,bioterio_id').eq('bioterio_id', id),
            ])
            resultados[id] = {
              animales: animales ?? [],
              camadas:  camadas  ?? [],
            }
          })
        )
        setDatos(resultados)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  // Aplanar todos los animales para el simulador (todos los bioterios juntos)
  const todosAnimales = useMemo(
    () => Object.values(datos).flatMap((d) => d.animales),
    [datos]
  )
  const pedigreeGlobal = useMemo(() => buildPedigree(todosAnimales), [todosAnimales])

  // Estadísticas por bioterio
  const statsPorBio = useMemo(() => {
    const result = {}
    for (const [id, d] of Object.entries(datos)) {
      const ped = buildPedigree(d.animales)
      result[id] = estadisticasColonia(d.animales, ped)
    }
    return result
  }, [datos])

  const statsGlobal = useMemo(() => {
    if (!todosAnimales.length) return null
    return estadisticasColonia(todosAnimales, pedigreeGlobal)
  }, [todosAnimales, pedigreeGlobal])

  // Filtro de bioterio para la tabla de animales
  const animalesFiltrados = useMemo(() => {
    if (bioSel === 'todos') return todosAnimales.filter((a) => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
    return (datos[bioSel]?.animales ?? []).filter((a) => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
  }, [bioSel, todosAnimales, datos])

  const pedigreeFiltrado = useMemo(() => {
    if (bioSel === 'todos') return pedigreeGlobal
    return buildPedigree(datos[bioSel]?.animales ?? [])
  }, [bioSel, pedigreeGlobal, datos])

  const fValuesFiltrados = useMemo(() => {
    return animalesFiltrados.map((a) => ({
      animal: a,
      f: calcularFIndividual(a, pedigreeFiltrado),
    })).sort((a, b) => b.f - a.f)
  }, [animalesFiltrados, pedigreeFiltrado])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3" style={{ background: '#050810' }}>
        <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
        <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>Cargando datos genealógicos...</span>
      </div>
    )
  }

  const DIST_COLORES = {
    nulo:     '#4a5f7a',
    bajo:     '#00e676',
    leve:     '#ffd740',
    moderado: '#ff9100',
    alto:     '#ff1744',
  }
  const DIST_LABELS = {
    nulo:     'Sin parentesco',
    bajo:     'Bajo (<6.25%)',
    leve:     'Leve (6.25–12.5%)',
    moderado: 'Moderado (12.5–25%)',
    alto:     'Alto (≥25%)',
  }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 8px rgba(167,139,250,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Genealogía y consanguinidad</h1>
            <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Análisis genético · todos los bioterios</p>
          </div>
        </div>
        <button
          onClick={() => setBioterioActivo(null)}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
        >
          ← Volver al selector
        </button>
      </div>

      {/* KPIs globales */}
      {statsGlobal && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Animales activos', valor: statsGlobal.total, color: '#a78bfa', sub: 'en todos los bioterios' },
            { label: 'F promedio colonia', valor: `${fPorcentaje(statsGlobal.fPromedio)}%`, color: statsGlobal.fPromedio >= 0.125 ? '#ff9100' : statsGlobal.fPromedio > 0 ? '#ffd740' : '#00e676', sub: 'consanguinidad media' },
            { label: 'Sin ancestros', valor: statsGlobal.sinAncestros, color: '#4a5f7a', sub: 'fundadores / sin registro' },
            { label: 'Con F > 12.5%', valor: (statsGlobal.distribucion.moderado ?? 0) + (statsGlobal.distribucion.alto ?? 0), color: '#ff6b80', sub: 'consanguinidad moderada+' },
          ].map(({ label, valor, color, sub }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: 'rgba(13,21,40,0.8)', border: `1px solid ${color}25` }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4a5f7a' }}>{label}</div>
              <div className="text-2xl font-bold font-mono mb-0.5" style={{ color }}>{valor}</div>
              <div className="text-xs font-mono" style={{ color: '#3a5068' }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Distribución por bioterio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TODOS.map((id) => {
          const cfg   = BIOTERIOS_CONFIG[id]
          const stats = statsPorBio[id]
          if (!stats || stats.total === 0) return null
          const dist = stats.distribucion
          const total = stats.total
          return (
            <div
              key={id}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.8)', border: `1px solid ${cfg.color}25` }}
            >
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}06` }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{cfg.icon ?? '🐭'}</span>
                  <span className="font-bold text-sm text-white">{cfg.label}</span>
                  <span className="ml-auto text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    F̄ = {fPorcentaje(stats.fPromedio)}%
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(dist).map(([key, count]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs w-36" style={{ color: DIST_COLORES[key] }}>{DIST_LABELS[key]}</span>
                    <div className="flex-1">
                      <Barra valor={count} max={total} color={DIST_COLORES[key]} height={6} />
                    </div>
                    <span className="text-xs font-mono w-6 text-right" style={{ color: DIST_COLORES[key] }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Simulador */}
      <SimuladorApareamientoPanel animales={todosAnimales} pedigree={pedigreeGlobal} />

      {/* Tabla de animales con F */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="px-5 py-4 flex items-center gap-4 flex-wrap" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)', background: 'rgba(139,92,246,0.04)' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="font-bold text-sm text-white">Detalle por animal</span>
          </div>
          {/* Filtro de bioterio */}
          <div className="flex gap-1.5 flex-wrap ml-auto">
            {[{ id: 'todos', label: 'Todos' }, ...TODOS.map((id) => ({ id, label: BIOTERIOS_CONFIG[id]?.labelCorto ?? id }))].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setBioSel(id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={
                  bioSel === id
                    ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa' }
                    : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.4)' }}>
          {fValuesFiltrados.length === 0 && (
            <div className="px-5 py-10 text-center text-sm font-mono" style={{ color: '#4a5f7a' }}>
              Sin animales activos en este bioterio
            </div>
          )}
          {fValuesFiltrados.map(({ animal, f }) => {
            const n = nivelConsanguinidad(f)
            const cfg = BIOTERIOS_CONFIG[animal.bioterio_id]
            return (
              <div key={animal.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                {/* Sexo */}
                <span
                  className="text-xs font-bold font-mono px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: animal.sexo === 'macho' ? 'rgba(64,196,255,0.1)' : 'rgba(206,147,216,0.1)',
                    border: `1px solid ${animal.sexo === 'macho' ? 'rgba(64,196,255,0.3)' : 'rgba(206,147,216,0.3)'}`,
                    color: animal.sexo === 'macho' ? '#40c4ff' : '#ce93d8',
                  }}
                >
                  {animal.sexo === 'macho' ? '♂' : '♀'}
                </span>

                {/* Código */}
                <span className="font-bold text-sm text-white">{animal.codigo}</span>

                {/* Bioterio badge */}
                {cfg && (
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}35`, color: cfg.color }}
                  >
                    {cfg.labelCorto}
                  </span>
                )}

                {/* F badge */}
                <div className="flex items-center gap-2 ml-auto">
                  {f === 0 ? (
                    <span className="text-xs font-mono" style={{ color: '#3a5068' }}>F = 0%</span>
                  ) : (
                    <>
                      <BadgeNivel f={f} />
                      <div style={{ width: 80 }}>
                        <Barra valor={f} max={0.5} color={n.color} height={4} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
