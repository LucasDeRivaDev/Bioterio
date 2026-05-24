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
  estadoGenealogiaAnimal,
  ancestrosComunes,
  getAncestores,
  LABEL_PARENTESCO,
  CONSANGUINIDAD_LINEA,
} from '../utils/genealogia'

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

function BadgeEstado({ estado, emoji, label }) {
  const colores = { completo: '#00e676', parcial: '#ffd740', insuficiente: '#4a5f7a' }
  const color = colores[estado] ?? '#4a5f7a'
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
      style={{ background: `${color}12`, border: `1px solid ${color}35`, color }}
    >
      {emoji} {label}
    </span>
  )
}

// ── Panel histórico de línea ──────────────────────────────────────────────────
function PanelLineaHistorica() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(167,139,250,0.2)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(167,139,250,0.1)', background: 'rgba(167,139,250,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🧬</span>
          <span className="font-bold text-sm text-white">Consanguinidad histórica de línea</span>
          <span className="text-xs font-mono ml-auto" style={{ color: '#4a5f7a' }}>contexto genético</span>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(CONSANGUINIDAD_LINEA).map(([id, info]) => {
          const cfg = BIOTERIOS_CONFIG[id]
          const fDisplay = info.fLinea === null ? '—' : info.fLinea === 0 ? '0%' : `${(info.fLinea * 100).toFixed(1)}%`
          const fColor = info.fLinea === null ? '#4a5f7a' : info.fLinea === 0 ? '#00e676' : info.fLinea > 0.5 ? '#ff9100' : '#ffd740'
          return (
            <div
              key={id}
              className="rounded-xl p-3 space-y-1.5"
              style={{ background: `${info.color}07`, border: `1px solid ${info.color}20` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{cfg?.icon ?? '🐭'}</span>
                <span className="font-bold text-sm" style={{ color: info.color }}>{info.label}</span>
                <span className="ml-auto text-sm font-bold font-mono" style={{ color: fColor }}>
                  F = {fDisplay}
                </span>
              </div>
              <div className="text-xs font-mono" style={{ color: '#8a9bb0' }}>{info.descripcion}</div>
              <div className="text-xs" style={{ color: '#4a5f7a' }}>{info.nota}</div>
            </div>
          )
        })}
      </div>
      <div className="px-5 pb-4 text-xs font-mono" style={{ color: '#3a5068' }}>
        ⚠️ El F de colonia interna calculado arriba es adicional al F histórico de línea — en cepas puras, el F real es ≈ histórico + colonia.
      </div>
    </div>
  )
}

// ── Árbol genealógico compacto ────────────────────────────────────────────────
function ArbolCompacto({ animal, pedigree }) {
  const arbol = getAncestores(animal.id, pedigree, 3)
  if (!arbol) return null

  function Nodo({ nodo, sexo, nivel }) {
    if (!nodo) return null
    const color = sexo === 'hembra' ? '#ce93d8' : '#40c4ff'
    const simbolo = sexo === 'hembra' ? '♀' : '♂'
    const opacity = nivel === 0 ? 1 : nivel === 1 ? 0.85 : 0.65
    return (
      <div className="flex items-center gap-1" style={{ opacity }}>
        <span className="text-xs font-bold" style={{ color }}>{simbolo}</span>
        <span className="text-xs font-mono font-semibold" style={{ color: '#c9d4e0' }}>{nodo.codigo}</span>
      </div>
    )
  }

  const madre = arbol.madre
  const padre = arbol.padre
  const abuelos = [madre?.madre, madre?.padre, padre?.madre, padre?.padre].filter(Boolean)
  const bisabuelos = [
    madre?.madre?.madre, madre?.madre?.padre,
    madre?.padre?.madre, madre?.padre?.padre,
    padre?.madre?.madre, padre?.madre?.padre,
    padre?.padre?.madre, padre?.padre?.padre,
  ].filter(Boolean)

  return (
    <div className="space-y-1 text-xs">
      {(madre || padre) && (
        <div className="flex gap-3">
          {madre && <Nodo nodo={madre} sexo="hembra" nivel={1} />}
          {padre && <Nodo nodo={padre} sexo="macho" nivel={1} />}
        </div>
      )}
      {abuelos.length > 0 && (
        <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
          Abuelos: {abuelos.map((a) => a.codigo).join(' · ')}
        </div>
      )}
      {bisabuelos.length > 0 && (
        <div className="text-xs font-mono" style={{ color: '#3a5068' }}>
          Bisabuelos: {bisabuelos.map((a) => a.codigo).join(' · ')}
        </div>
      )}
    </div>
  )
}

// ── Simulador de apareamiento ─────────────────────────────────────────────────
function SimuladorApareamientoPanel({ animales, pedigree }) {
  const [madreId, setMadreId] = useState('')
  const [padreId, setPadreId] = useState('')
  const [mostrarArbol, setMostrarArbol] = useState(false)

  const hembras = animales.filter((a) => a.sexo === 'hembra' && ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
  const machos  = animales.filter((a) => a.sexo === 'macho'  && ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))

  const resultado = useMemo(() => {
    if (!madreId || !padreId) return null
    return evaluarApareamientoGenetico(madreId, padreId, pedigree)
  }, [madreId, padreId, pedigree])

  const madreAnimal = animales.find((a) => a.id === madreId)
  const padreAnimal = animales.find((a) => a.id === padreId)

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
                <option key={a.id} value={a.id}>{a.codigo} ({BIOTERIOS_CONFIG[a.bioterio_id]?.labelCorto ?? a.bioterio_id})</option>
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
                <option key={a.id} value={a.id}>{a.codigo} ({BIOTERIOS_CONFIG[a.bioterio_id]?.labelCorto ?? a.bioterio_id})</option>
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
            {/* Cruce */}
            {madreAnimal && padreAnimal && (
              <div className="text-xs font-mono" style={{ color: '#8a9bb0' }}>
                Cruce: <span style={{ color: '#ce93d8' }}>♀ {madreAnimal.codigo}</span>
                {' × '}
                <span style={{ color: '#40c4ff' }}>♂ {padreAnimal.codigo}</span>
              </div>
            )}

            {/* F principal */}
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

            {/* Ancestros comunes */}
            {resultado.comunes.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
                  Ancestros comunes: {resultado.comunes.length}
                </div>
                <div className="flex flex-wrap gap-2">
                  {resultado.comunes.slice(0, 6).map((c) => {
                    const color = c.sexo === 'hembra' ? '#ce93d8' : c.sexo === 'macho' ? '#40c4ff' : '#8a9bb0'
                    return (
                      <span
                        key={c.id}
                        className="text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{ background: `${color}12`, border: `1px solid ${color}30`, color }}
                      >
                        {c.sexo === 'hembra' ? '♀' : '♂'} {c.codigo}
                        <span style={{ color: '#4a5f7a' }}> gen.{Math.max(c.profMadre, c.profPadre)}</span>
                      </span>
                    )
                  })}
                  {resultado.comunes.length > 6 && (
                    <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>+{resultado.comunes.length - 6} más</span>
                  )}
                </div>
              </div>
            )}

            {resultado.comunes.length === 0 && resultado.f === 0 && (
              <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                Sin ancestros comunes detectados en las generaciones registradas
              </div>
            )}

            {/* Parentesco */}
            {resultado.parentesco && LABEL_PARENTESCO[resultado.parentesco] && (
              <div className="flex items-center gap-2 text-sm">
                <span>{LABEL_PARENTESCO[resultado.parentesco].emoji}</span>
                <span style={{ color: '#c9d4e0' }}>{LABEL_PARENTESCO[resultado.parentesco].texto}</span>
              </div>
            )}

            {/* Recomendación */}
            {resultado.recomendacion && (
              <div
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: `${resultado.nivel.color}10`, color: resultado.nivel.color }}
              >
                {resultado.recomendacion.tipo === 'bloqueo' ? '⛔' : resultado.recomendacion.tipo === 'advertencia' ? '⚠️' : '🟡'}{' '}
                {resultado.recomendacion.texto}
              </div>
            )}

            {resultado.f === 0 && !resultado.parentesco && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#00e676' }}>
                <span>✓</span>
                <span>Sin consanguinidad detectada en registros — apareamiento genéticamente seguro</span>
              </div>
            )}

            {/* Barra de referencia */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-mono" style={{ color: '#4a5f7a' }}>
                <span>0%</span>
                <span>12.5% (med. hermanos)</span>
                <span>25% (hermanos)</span>
                <span>50%</span>
              </div>
              <div className="relative h-3 rounded-full" style={{ background: 'rgba(30,51,82,0.6)' }}>
                <div className="absolute top-0 bottom-0 w-px" style={{ left: '25%', background: 'rgba(255,215,64,0.4)' }} />
                <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: 'rgba(255,145,0,0.5)' }} />
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(resultado.f / 0.5 * 100, 100)}%`, background: resultado.nivel.color }}
                />
              </div>
            </div>

            {/* Árbol genealógico de cada progenitor */}
            <button
              onClick={() => setMostrarArbol((v) => !v)}
              className="text-xs font-mono underline"
              style={{ color: '#4a5f7a' }}
            >
              {mostrarArbol ? 'Ocultar' : 'Ver'} árbol genealógico de los progenitores
            </button>

            {mostrarArbol && (
              <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: '1px solid rgba(30,51,82,0.5)' }}>
                {madreAnimal && (
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: '#ce93d8' }}>♀ {madreAnimal.codigo}</div>
                    <ArbolCompacto animal={madreAnimal} pedigree={pedigree} />
                  </div>
                )}
                {padreAnimal && (
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: '#40c4ff' }}>♂ {padreAnimal.codigo}</div>
                    <ArbolCompacto animal={padreAnimal} pedigree={pedigree} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function GenealogiaGlobal() {
  const { setBioterioActivo } = useBioterioActivo()
  const [datos, setDatos]       = useState({})
  const [todasCamadas, setTodasCamadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [bioSel, setBioSel]     = useState('todos')
  const [expandidoId, setExpandidoId] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const resultados = {}
        const camadasAll = []
        await Promise.all(
          TODOS.map(async (id) => {
            const [{ data: animales }, { data: camadas }] = await Promise.all([
              supabase.from('animales').select('id,codigo,sexo,estado,fecha_nacimiento,id_madre,id_padre,bioterio_id,notas').eq('bioterio_id', id),
              supabase.from('camadas').select('id,id_madre,id_padre,fecha_copula,fecha_nacimiento,total_crias,failure_flag,bioterio_id').eq('bioterio_id', id),
            ])
            resultados[id] = {
              animales: animales ?? [],
              camadas:  camadas  ?? [],
            }
            camadasAll.push(...(camadas ?? []))
          })
        )
        setDatos(resultados)
        setTodasCamadas(camadasAll)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  // Pedigree GLOBAL (todos los bioterios + recuperación desde notas)
  const todosAnimales = useMemo(
    () => Object.values(datos).flatMap((d) => d.animales),
    [datos]
  )
  const pedigreeGlobal = useMemo(
    () => buildPedigree(todosAnimales, todasCamadas),
    [todosAnimales, todasCamadas]
  )

  // Estadísticas por bioterio usando pedigree GLOBAL (encuentra padres cross-bioterio)
  const statsPorBio = useMemo(() => {
    const result = {}
    for (const [id, d] of Object.entries(datos)) {
      result[id] = estadisticasColonia(d.animales, pedigreeGlobal, pedigreeGlobal)
    }
    return result
  }, [datos, pedigreeGlobal])

  const statsGlobal = useMemo(() => {
    if (!todosAnimales.length) return null
    return estadisticasColonia(todosAnimales, pedigreeGlobal)
  }, [todosAnimales, pedigreeGlobal])

  // Filtro de bioterio para la tabla
  const animalesFiltrados = useMemo(() => {
    const base = bioSel === 'todos'
      ? todosAnimales
      : (datos[bioSel]?.animales ?? [])
    return base.filter((a) => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
  }, [bioSel, todosAnimales, datos])

  const fValuesFiltrados = useMemo(() => {
    return animalesFiltrados.map((a) => {
      const nodo = pedigreeGlobal[a.id]
      const madreId = a.id_madre ?? nodo?.madre_id ?? null
      const padreId = a.id_padre ?? nodo?.padre_id ?? null
      const f = (madreId && padreId) ? calcularFCoeficiente(madreId, padreId, pedigreeGlobal) : 0
      const estadoGen = estadoGenealogiaAnimal(a, pedigreeGlobal)
      return { animal: a, f, estadoGen }
    }).sort((a, b) => b.f - a.f)
  }, [animalesFiltrados, pedigreeGlobal])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3" style={{ background: '#050810' }}>
        <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
        <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>Cargando datos genealógicos...</span>
      </div>
    )
  }

  const DIST_COLORES = { nulo: '#4a5f7a', bajo: '#00e676', leve: '#ffd740', moderado: '#ff9100', alto: '#ff1744' }
  const DIST_LABELS  = { nulo: 'Sin parentesco', bajo: 'Bajo (<6.25%)', leve: 'Leve (6.25–12.5%)', moderado: 'Moderado (12.5–25%)', alto: 'Alto (≥25%)' }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 8px rgba(167,139,250,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Genealogía y consanguinidad</h1>
            <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Análisis genético · todos los bioterios · pedigree global</p>
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
            {
              label: 'F promedio colonia',
              valor: `${fPorcentaje(statsGlobal.fPromedio)}%`,
              color: statsGlobal.fPromedio >= 0.125 ? '#ff9100' : statsGlobal.fPromedio > 0 ? '#ffd740' : '#00e676',
              sub: 'consanguinidad interna media',
            },
            {
              label: 'Información insuficiente',
              valor: statsGlobal.sinAncestros,
              color: '#4a5f7a',
              sub: 'fundadores / sin registros',
            },
            {
              label: 'Con F > 12.5%',
              valor: (statsGlobal.distribucion.moderado ?? 0) + (statsGlobal.distribucion.alto ?? 0),
              color: '#ff6b80',
              sub: 'consanguinidad moderada+',
            },
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

      {/* Panel histórico de línea */}
      <PanelLineaHistorica />

      {/* Distribución por bioterio (usa pedigree global) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TODOS.map((id) => {
          const cfg   = BIOTERIOS_CONFIG[id]
          const stats = statsPorBio[id]
          if (!stats || stats.total === 0) return null
          const dist  = stats.distribucion
          const total = stats.total
          const infoLinea = CONSANGUINIDAD_LINEA[id]
          return (
            <div
              key={id}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.8)', border: `1px solid ${cfg.color}25` }}
            >
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}06` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{cfg.icon ?? '🐭'}</span>
                  <span className="font-bold text-sm text-white">{cfg.label}</span>
                  <span className="ml-auto text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    F interna = {fPorcentaje(stats.fPromedio)}%
                  </span>
                  {infoLinea?.fLinea !== null && (
                    <span className="text-xs font-mono" style={{ color: '#3a5068' }}>
                      · línea = {infoLinea.fLinea === 0 ? '0%' : `~${(infoLinea.fLinea * 100).toFixed(0)}%`}
                    </span>
                  )}
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
                {stats.sinAncestros > 0 && (
                  <div className="text-xs font-mono pt-1" style={{ color: '#3a5068' }}>
                    🔴 {stats.sinAncestros} animal{stats.sinAncestros !== 1 ? 'es' : ''} con información insuficiente (fundadores)
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Simulador (usa pedigree global) */}
      <SimuladorApareamientoPanel animales={todosAnimales} pedigree={pedigreeGlobal} />

      {/* Tabla de animales con F y estado genealógico */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="px-5 py-4 flex items-center gap-4 flex-wrap" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)', background: 'rgba(139,92,246,0.04)' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="font-bold text-sm text-white">Detalle por animal</span>
          </div>
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
          {fValuesFiltrados.map(({ animal, f, estadoGen }) => {
            const n   = nivelConsanguinidad(f)
            const cfg = BIOTERIOS_CONFIG[animal.bioterio_id]
            const expandido = expandidoId === animal.id
            const nodo = pedigreeGlobal[animal.id]
            const madreNodo = nodo?.madre_id ? pedigreeGlobal[nodo.madre_id] : null
            const padreNodo = nodo?.padre_id ? pedigreeGlobal[nodo.padre_id] : null

            return (
              <div key={animal.id}>
                {/* Fila principal */}
                <button
                  className="w-full px-5 py-3 flex items-center gap-3 flex-wrap text-left hover:bg-white/5 transition-colors"
                  onClick={() => setExpandidoId(expandido ? null : animal.id)}
                >
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

                  {/* Bioterio */}
                  {cfg && (
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}35`, color: cfg.color }}
                    >
                      {cfg.labelCorto}
                    </span>
                  )}

                  {/* Estado genealógico */}
                  <BadgeEstado estado={estadoGen.estado} emoji={estadoGen.emoji} label={estadoGen.label} />

                  {/* F */}
                  <div className="flex items-center gap-2 ml-auto">
                    {f === 0 ? (
                      <span className="text-xs font-mono" style={{ color: estadoGen.tienePadres ? '#4a5f7a' : '#3a5068' }}>
                        {estadoGen.tienePadres ? 'F = 0% — Sin consanguinidad' : '—'}
                      </span>
                    ) : (
                      <>
                        <BadgeNivel f={f} />
                        <div style={{ width: 80 }}>
                          <Barra valor={f} max={0.5} color={n.color} height={4} />
                        </div>
                      </>
                    )}
                    <span className="text-xs" style={{ color: '#4a5f7a' }}>{expandido ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Detalle expandido */}
                {expandido && (
                  <div
                    className="px-5 pb-4 space-y-3"
                    style={{ borderTop: '1px solid rgba(30,51,82,0.3)', background: 'rgba(0,0,0,0.2)' }}
                  >
                    {/* Generaciones disponibles */}
                    <div className="flex items-center gap-2 pt-3 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
                        Generaciones conocidas: {estadoGen.generaciones}
                      </span>
                    </div>

                    {/* Padres */}
                    {(madreNodo || padreNodo || nodo?.madre_id || nodo?.padre_id) ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3a5068' }}>Progenitores</div>
                        <div className="flex gap-3 flex-wrap">
                          {madreNodo ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(206,147,216,0.08)', border: '1px solid rgba(206,147,216,0.2)' }}>
                              <span className="text-xs" style={{ color: '#ce93d8' }}>♀</span>
                              <span className="text-xs font-mono font-semibold" style={{ color: '#ce93d8' }}>{madreNodo.codigo}</span>
                            </div>
                          ) : nodo?.madre_id ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(206,147,216,0.04)', border: '1px solid rgba(206,147,216,0.15)' }}>
                              <span className="text-xs" style={{ color: '#4a5f7a' }}>♀</span>
                              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Madre dada de baja</span>
                            </div>
                          ) : null}
                          {padreNodo ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.2)' }}>
                              <span className="text-xs" style={{ color: '#40c4ff' }}>♂</span>
                              <span className="text-xs font-mono font-semibold" style={{ color: '#40c4ff' }}>{padreNodo.codigo}</span>
                            </div>
                          ) : nodo?.padre_id ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(64,196,255,0.04)', border: '1px solid rgba(64,196,255,0.15)' }}>
                              <span className="text-xs" style={{ color: '#4a5f7a' }}>♂</span>
                              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Padre dado de baja</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Árbol completo */}
                        <ArbolCompacto animal={animal} pedigree={pedigreeGlobal} />
                      </div>
                    ) : (
                      <div className="text-xs font-mono py-2" style={{ color: '#3a5068' }}>
                        🔴 Información insuficiente — sin padres registrados (animal fundador o dato no cargado)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
