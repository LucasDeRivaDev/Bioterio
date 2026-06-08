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
  calcularConfianzaPedigree,
  generarExplicacionF,
} from '../utils/genealogia'
import { useTheme } from '../context/ThemeContext'

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

function BadgeConfianza({ nivel }) {
  const { tema } = useTheme()
  const cfg = {
    alta:  { color: tema.accent, emoji: '🟢', label: 'Confianza alta' },
    media: { color: '#ffd740', emoji: '🟡', label: 'Confianza media' },
    baja:  { color: tema.red, emoji: '🔴', label: 'Confianza baja' },
  }[nivel] ?? { color: tema.textMuted, emoji: '⚪', label: 'Sin datos' }
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
      style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, color: cfg.color }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  )
}

// ── Panel histórico de línea ──────────────────────────────────────────────────
function PanelLineaHistorica() {
  const { tema } = useTheme()

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: tema.bgCard, border: '1px solid rgba(167,139,250,0.2)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(167,139,250,0.1)', background: 'rgba(167,139,250,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🧬</span>
          <span className="font-bold text-sm text-white">Consanguinidad histórica de línea</span>
          <span className="text-xs font-mono ml-auto" style={{ color: tema.textMuted }}>contexto genético</span>
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
              <div className="text-xs font-mono" style={{ color: tema.textSecondary }}>{info.descripcion}</div>
              <div className="text-xs" style={{ color: tema.textMuted }}>{info.nota}</div>
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

// ── Árbol genealógico — nodo individual ──────────────────────────────────────
function NodoArbol({ nodo, size = 'normal' }) {
  const { tema } = useTheme()
  if (!nodo) return null

  if (nodo.desconocido) {
    const sizeClass = size === 'tiny' ? 'text-[9px]' : 'text-[10px]'
    return (
      <div className={`flex items-center gap-0.5 ${sizeClass} font-mono`} style={{ color: '#2a3f58', opacity: 0.7 }}>
        <span>?</span>
        <span style={{ color: '#1e3152' }}>Desconocido</span>
      </div>
    )
  }

  const color = nodo.sexo === 'hembra' ? '#ce93d8' : nodo.sexo === 'macho' ? '#40c4ff' : '#8a9bb0'
  const simbolo = nodo.sexo === 'hembra' ? '♀' : nodo.sexo === 'macho' ? '♂' : '?'
  const sizeClass = size === 'tiny' ? 'text-[9px]' : size === 'small' ? 'text-[10px]' : 'text-xs'

  return (
    <div className={`flex items-center gap-0.5 ${sizeClass}`}>
      <span className="font-bold" style={{ color }}>{simbolo}</span>
      <span className="font-mono font-semibold" style={{ color: tema.textPrimary }}>{nodo.codigo}</span>
    </div>
  )
}

// ── Árbol genealógico completo (4 generaciones) ───────────────────────────────
function ArbolGeneraciones({ animal, pedigree }) {
  const arbol = getAncestores(animal.id, pedigree, 4, true)
  if (!arbol) return null

  const madre = arbol.madre
  const padre = arbol.padre
  const hayPadres = !!(madre || padre)
  if (!hayPadres) return (
    <div className="text-xs font-mono" style={{ color: '#3a5068' }}>Sin progenitores registrados</div>
  )

  // Abuelos (gen 2)
  const abuMM = madre?.madre
  const abuMP = madre?.padre
  const abuPM = padre?.madre
  const abuPP = padre?.padre
  const hayAbuelos = !!(abuMM || abuMP || abuPM || abuPP)

  // Bisabuelos (gen 3)
  const bisabs = [
    abuMM?.madre, abuMM?.padre,
    abuMP?.madre, abuMP?.padre,
    abuPM?.madre, abuPM?.padre,
    abuPP?.madre, abuPP?.padre,
  ]
  const hayBisabuelos = bisabs.some(Boolean)

  // Tatarabuelos (gen 4) — solo count
  const tataKnown = bisabs
    .filter(b => b && !b.desconocido)
    .flatMap(b => [b.madre, b.padre])
    .filter(t => t && !t.desconocido).length
  const tataPosibles = bisabs.filter(b => b && !b.desconocido).length * 2

  const SEP = { borderTop: '1px solid rgba(30,51,82,0.3)', paddingTop: '6px', marginTop: '6px' }

  return (
    <div className="text-xs space-y-0">

      {/* Gen 1 — Padres */}
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2a3f58' }}>
          Padres
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="space-y-0.5">
            <div className="text-[8px] font-mono" style={{ color: '#1e3152' }}>madre</div>
            <NodoArbol nodo={madre} size="normal" />
          </div>
          <div className="space-y-0.5">
            <div className="text-[8px] font-mono" style={{ color: '#1e3152' }}>padre</div>
            <NodoArbol nodo={padre} size="normal" />
          </div>
        </div>
      </div>

      {/* Gen 2 — Abuelos */}
      {hayAbuelos && (
        <div style={SEP}>
          <div className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2a3f58' }}>
            Abuelos
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {[
              { nodo: abuMM, key: 'MM', hint: 'lado madre' },
              { nodo: abuMP, key: 'MP', hint: 'lado madre' },
              { nodo: abuPM, key: 'PM', hint: 'lado padre' },
              { nodo: abuPP, key: 'PP', hint: 'lado padre' },
            ].map(({ nodo, key, hint }) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono w-4" style={{ color: '#1e3152' }}>{key}</span>
                <NodoArbol nodo={nodo ?? { desconocido: true }} size="small" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gen 3 — Bisabuelos */}
      {hayBisabuelos && (
        <div style={SEP}>
          <div className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#2a3f58' }}>
            Bisabuelos
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {bisabs.map((nodo, i) => (
              <NodoArbol key={i} nodo={nodo ?? { desconocido: true }} size="tiny" />
            ))}
          </div>
        </div>
      )}

      {/* Gen 4 — Tatarabuelos (solo count) */}
      {tataPosibles > 0 && (
        <div style={SEP}>
          <div className="text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#2a3f58' }}>
            Tatarabuelos
          </div>
          <div className="text-[10px] font-mono" style={{ color: tataKnown > 0 ? '#4a5f7a' : '#2a3f58' }}>
            {tataKnown > 0
              ? `${tataKnown} de ${tataPosibles} conocidos`
              : `${tataPosibles} posibles — datos no disponibles`}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Árbol genealógico compacto (sidebar del simulador) ───────────────────────
function ArbolCompacto({ animal, pedigree }) {
  return <ArbolGeneraciones animal={animal} pedigree={pedigree} />
}

// ── Simulador de apareamiento ─────────────────────────────────────────────────
function SimuladorApareamientoPanel({ animales, pedigree }) {
  const { tema } = useTheme()
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
    background: tema.bgInput,
    border: '1px solid rgba(30,51,82,0.8)',
    color: tema.textPrimary,
    borderRadius: '10px',
    padding: '8px 12px',
    width: '100%',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: tema.bgCard, border: '1px solid rgba(64,196,255,0.2)' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(64,196,255,0.1)', background: 'rgba(64,196,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔬</span>
          <span className="font-bold text-sm text-white">Simulador de apareamiento</span>
          <span className="text-xs font-mono" style={{ color: tema.textMuted }}>· predicción de F en crías</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textSecondary }}>
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
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: tema.textSecondary }}>
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
              <div className="text-xs font-mono" style={{ color: tema.textSecondary }}>
                Cruce: <span style={{ color: tema.purple }}>♀ {madreAnimal.codigo}</span>
                {' × '}
                <span style={{ color: tema.blue }}>♂ {padreAnimal.codigo}</span>
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
            {/* Explicación principal del F */}
            {resultado.f > 0 && resultado.comunes.length > 0 && (() => {
              const LABEL_GEN = { 1: 'padre/madre', 2: 'abuelo/a', 3: 'bisabuelo/a', 4: 'tatarabuelo/a' }
              const p = resultado.comunes[0]
              const colorP = p.sexo === 'hembra' ? '#ce93d8' : p.sexo === 'macho' ? '#40c4ff' : '#8a9bb0'
              return (
                <div className="rounded-lg px-3 py-2 space-y-1" style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.6)' }}>
                  <div className="text-xs font-semibold" style={{ color: tema.textSecondary }}>Motivo del F:</div>
                  <div className="text-xs font-mono">
                    <span style={{ color: colorP }}>
                      {p.sexo === 'hembra' ? '♀' : p.sexo === 'macho' ? '♂' : '?'} {p.codigo}
                    </span>
                    <span style={{ color: tema.textMuted }}>
                      {' '}— {LABEL_GEN[p.profMadre] ?? `gen.${p.profMadre}`} de la madre
                      {' '}· {LABEL_GEN[p.profPadre] ?? `gen.${p.profPadre}`} del padre
                    </span>
                  </div>
                  {resultado.comunes.length > 1 && (
                    <div className="text-xs font-mono" style={{ color: '#3a5068' }}>
                      +{resultado.comunes.length - 1} ancestro{resultado.comunes.length > 2 ? 's' : ''} común{resultado.comunes.length > 2 ? 'es' : ''} adicional{resultado.comunes.length > 2 ? 'es' : ''}
                    </div>
                  )}
                </div>
              )
            })()}

            {resultado.comunes.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>
                  Todos los ancestros comunes ({resultado.comunes.length})
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
                        <span style={{ color: tema.textMuted }}> gen.{Math.max(c.profMadre, c.profPadre)}</span>
                      </span>
                    )
                  })}
                  {resultado.comunes.length > 6 && (
                    <span className="text-xs font-mono" style={{ color: tema.textMuted }}>+{resultado.comunes.length - 6} más</span>
                  )}
                </div>
              </div>
            )}

            {resultado.comunes.length === 0 && resultado.f === 0 && (
              <div className="text-xs font-mono" style={{ color: tema.textMuted }}>
                Sin ancestros comunes detectados en las generaciones registradas
              </div>
            )}

            {/* Parentesco */}
            {resultado.parentesco && LABEL_PARENTESCO[resultado.parentesco] && (
              <div className="flex items-center gap-2 text-sm">
                <span>{LABEL_PARENTESCO[resultado.parentesco].emoji}</span>
                <span style={{ color: tema.textPrimary }}>{LABEL_PARENTESCO[resultado.parentesco].texto}</span>
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
              <div className="flex items-center gap-2 text-sm" style={{ color: tema.accent }}>
                <span>✓</span>
                <span>Sin consanguinidad detectada en registros — apareamiento genéticamente seguro</span>
              </div>
            )}

            {/* Barra de referencia */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-mono" style={{ color: tema.textMuted }}>
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
              style={{ color: tema.textMuted }}
            >
              {mostrarArbol ? 'Ocultar' : 'Ver'} árbol genealógico de los progenitores
            </button>

            {mostrarArbol && (
              <div className="grid grid-cols-2 gap-4 pt-2" style={{ borderTop: '1px solid rgba(30,51,82,0.5)' }}>
                {madreAnimal && (
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: tema.purple }}>♀ {madreAnimal.codigo}</div>
                    <ArbolCompacto animal={madreAnimal} pedigree={pedigree} />
                  </div>
                )}
                {padreAnimal && (
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: tema.blue }}>♂ {padreAnimal.codigo}</div>
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
  const { tema, modoBrillo } = useTheme()
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
      const estadoGen  = estadoGenealogiaAnimal(a, pedigreeGlobal)
      const confianza  = calcularConfianzaPedigree(a.id, pedigreeGlobal)
      const explicacion = (madreId && padreId && f > 0)
        ? generarExplicacionF(madreId, padreId, pedigreeGlobal)
        : null
      return { animal: a, f, estadoGen, confianza, explicacion, madreId, padreId }
    }).sort((a, b) => b.f - a.f)
  }, [animalesFiltrados, pedigreeGlobal])

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3" style={{ background: tema.bgMain }}>
        <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
        <span className="text-sm font-mono" style={{ color: tema.textMuted }}>Cargando datos genealógicos...</span>
      </div>
    )
  }

  const DIST_COLORES = { nulo: '#4a5f7a', bajo: '#00e676', leve: '#ffd740', moderado: '#ff9100', alto: '#ff1744' }
  const DIST_LABELS  = { nulo: 'Sin parentesco', bajo: 'Bajo (<6.25%)', leve: 'Leve (6.25–12.5%)', moderado: 'Moderado (12.5–25%)', alto: 'Alto (≥25%)' }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6" style={{ background: tema.bgMain }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 8px rgba(167,139,250,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Genealogía y consanguinidad</h1>
            <p className="text-xs font-mono" style={{ color: tema.textMuted }}>Análisis genético · todos los bioterios · pedigree global</p>
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
              color: tema.textMuted,
              sub: 'fundadores / sin registros',
            },
            {
              label: 'Con F > 12.5%',
              valor: (statsGlobal.distribucion.moderado ?? 0) + (statsGlobal.distribucion.alto ?? 0),
              color: tema.red,
              sub: 'consanguinidad moderada+',
            },
          ].map(({ label, valor, color, sub }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: tema.bgCard, border: `1px solid ${color}25` }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: tema.textMuted }}>{label}</div>
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
              style={{ background: tema.bgCard, border: `1px solid ${cfg.color}25` }}
            >
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}06` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{cfg.icon ?? '🐭'}</span>
                  <span className="font-bold text-sm text-white">{cfg.label}</span>
                  <span className="ml-auto text-xs font-mono" style={{ color: tema.textMuted }}>
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
      <div className="rounded-2xl overflow-hidden" style={{ background: tema.bgCard, border: '1px solid rgba(139,92,246,0.2)' }}>
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
                    : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: tema.textMuted }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.4)' }}>
          {fValuesFiltrados.length === 0 && (
            <div className="px-5 py-10 text-center text-sm font-mono" style={{ color: tema.textMuted }}>
              Sin animales activos en este bioterio
            </div>
          )}
          {fValuesFiltrados.map(({ animal, f, estadoGen, confianza, explicacion, madreId, padreId }) => {
            const n         = nivelConsanguinidad(f)
            const cfg       = BIOTERIOS_CONFIG[animal.bioterio_id]
            const infoLinea = CONSANGUINIDAD_LINEA[animal.bioterio_id]
            const expandido = expandidoId === animal.id
            // F=0 sin ancestros en colonia consanguínea → aviso
            const fSubestimado = f === 0 && !estadoGen.tienePadres && infoLinea?.fLinea > 0

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

                  {/* Estado árbol */}
                  <BadgeEstado estado={estadoGen.estado} emoji={estadoGen.emoji} label={estadoGen.label} />

                  {/* F + confianza */}
                  <div className="flex items-center gap-2 ml-auto flex-wrap">
                    {fSubestimado ? (
                      <span className="text-xs font-mono" style={{ color: '#ff9100' }}>
                        ⚠️ F no calculable (sin padres)
                      </span>
                    ) : f === 0 ? (
                      <span className="text-xs font-mono" style={{ color: estadoGen.tienePadres ? '#4a5f7a' : '#3a5068' }}>
                        {estadoGen.tienePadres ? 'F = 0% — Sin ancestros comunes' : '—'}
                      </span>
                    ) : (
                      <>
                        <BadgeNivel f={f} />
                        <div style={{ width: 80 }}>
                          <Barra valor={f} max={0.5} color={n.color} height={4} />
                        </div>
                      </>
                    )}
                    <BadgeConfianza nivel={confianza.nivel} />
                    <span className="text-xs" style={{ color: tema.textMuted }}>{expandido ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Detalle expandido */}
                {expandido && (
                  <div
                    className="px-5 pb-5 space-y-4"
                    style={{ borderTop: '1px solid rgba(30,51,82,0.3)', background: 'rgba(0,0,0,0.2)' }}
                  >
                    {/* Encabezado confianza */}
                    <div className="flex items-center gap-3 pt-3 flex-wrap">
                      <BadgeConfianza nivel={confianza.nivel} />
                      <span className="text-xs font-mono" style={{ color: tema.textMuted }}>
                        {confianza.descripcion}
                      </span>
                      {confianza.generaciones > 0 && (
                        <span className="text-xs font-mono ml-auto" style={{ color: '#3a5068' }}>
                          {confianza.generaciones} generaciones en el árbol
                        </span>
                      )}
                    </div>

                    {/* Alerta colonia cerrada sin padres */}
                    {fSubestimado && (
                      <div
                        className="rounded-xl px-4 py-3 text-xs space-y-1"
                        style={{ background: 'rgba(255,145,0,0.07)', border: '1px solid rgba(255,145,0,0.3)' }}
                      >
                        <div className="font-semibold" style={{ color: '#ff9100' }}>
                          ⚠️ F real no calculable — sin padres registrados
                        </div>
                        <div className="font-mono" style={{ color: tema.textSecondary }}>
                          Esta colonia tiene F histórica de línea ≈{' '}
                          <span style={{ color: '#ffd740' }}>
                            {(infoLinea.fLinea * 100).toFixed(0)}%
                          </span>
                          . Sin padres registrados, el F calculado sería 0% — lo cual es incorrecto.
                        </div>
                        <div className="font-mono" style={{ color: tema.textMuted }}>
                          Para calcular F interna real: registrar ambos padres del animal en la base de datos.
                        </div>
                      </div>
                    )}

                    {/* Explicación del F (si F > 0) */}
                    {explicacion && (
                      <div
                        className="rounded-xl px-4 py-3 space-y-2"
                        style={{ background: `${n.color}07`, border: `1px solid ${n.color}25` }}
                      >
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: n.color }}>
                          Motivo — F = {fPorcentaje(f)}%
                        </div>
                        <div className="text-xs font-mono" style={{ color: tema.textPrimary }}>
                          Ancestro común principal:{' '}
                          <span style={{ color: explicacion.principal.sexo === '♀' ? '#ce93d8' : '#40c4ff' }}>
                            {explicacion.principal.sexo} {explicacion.principal.codigo}
                          </span>
                          {' '}—{' '}
                          <span style={{ color: tema.textSecondary }}>
                            {explicacion.principal.genMadre} de la madre · {explicacion.principal.genPadre} del padre
                          </span>
                        </div>
                        {explicacion.totalComunes > 1 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {explicacion.comunes.slice(1).map((c) => {
                              const nodoC = pedigreeGlobal[c.id]
                              const colorC = nodoC?.sexo === 'hembra' ? '#ce93d8' : '#40c4ff'
                              return (
                                <span
                                  key={c.id}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                                  style={{ background: `${colorC}10`, border: `1px solid ${colorC}25`, color: colorC }}
                                >
                                  {nodoC?.sexo === 'hembra' ? '♀' : '♂'} {c.codigo}
                                  <span style={{ color: '#3a5068' }}> gen.{Math.max(c.profMadre, c.profPadre)}</span>
                                </span>
                              )
                            })}
                            {explicacion.totalComunes > 6 && (
                              <span className="text-[10px] font-mono" style={{ color: '#3a5068' }}>
                                +{explicacion.totalComunes - 6} más
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Árbol genealógico completo (4 generaciones) */}
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{ background: tema.bgInput, border: '1px solid rgba(30,51,82,0.5)' }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#3a5068' }}>
                        Árbol genealógico
                      </div>
                      <ArbolGeneraciones animal={animal} pedigree={pedigreeGlobal} />
                    </div>

                    {/* Contexto colonia cerrada (cuando sí tiene padres) */}
                    {estadoGen.tienePadres && infoLinea?.fLinea > 0 && (
                      <div className="text-xs font-mono" style={{ color: '#3a5068' }}>
                        ℹ️ F calculada ({fPorcentaje(f)}%) es la consanguinidad interna adicional.
                        F real ≈ F línea ({(infoLinea.fLinea * 100).toFixed(0)}%) + F interna = casi 100%.
                      </div>
                    )}
                    {estadoGen.tienePadres && infoLinea?.fLinea === 0 && f === 0 && (
                      <div className="text-xs font-mono" style={{ color: tema.accent }}>
                        ✓ Híbrido F1 — sin consanguinidad interna calculada. Heterocigosis máxima esperada.
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
