import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBioterio } from '../context/BiotheriumContext'
import { generarTareas, formatFecha, calcularRangoParto, difDias, parseDate, hoy, generarAlertasEstrales, generarAlertasMachos } from '../utils/calculos'
import { INTERVALO_RENOVACION_DIAS } from '../utils/constants'
import Badge from '../components/Badge'
import {
  Scissors, Baby, Package, Activity, FlaskConical, AlertCircle, RefreshCcw,
  Calendar, FileWarning, Thermometer, Microscope,
  CheckCircle2, Layers, Link2, UserMinus,
} from 'lucide-react'

// Estilos por prioridad
const PRIORIDAD = {
  vencida: {
    bg: 'rgba(255,61,87,0.08)',
    border: 'rgba(255,61,87,0.25)',
    titulo: '#ff6b80',
    badge: 'rojo',
    label: 'VENCIDA',
    icono: '🚨',
    glow: 'rgba(255,61,87,0.12)',
    accion: 'rgba(255,61,87,0.15)',
    accionBorde: 'rgba(255,61,87,0.4)',
  },
  hoy: {
    bg: 'rgba(255,179,0,0.08)',
    border: 'rgba(255,179,0,0.25)',
    titulo: '#ffb300',
    badge: 'amarillo',
    label: 'HOY',
    icono: '⚠️',
    glow: 'rgba(255,179,0,0.1)',
    accion: 'rgba(255,179,0,0.15)',
    accionBorde: 'rgba(255,179,0,0.4)',
  },
  proxima: {
    bg: 'rgba(64,196,255,0.06)',
    border: 'rgba(64,196,255,0.2)',
    titulo: '#40c4ff',
    badge: 'azul',
    label: 'PRÓXIMA',
    icono: '📅',
    glow: 'transparent',
    accion: 'rgba(64,196,255,0.12)',
    accionBorde: 'rgba(64,196,255,0.35)',
  },
}

const ICONO_TIPO = {
  separacion:     <Scissors size={17} />,
  control_parto:  <Baby size={17} />,
  destete:        <Package size={17} />,
  madurez:        <Activity size={17} />,
  revision:       <FlaskConical size={17} />,
  evaluar_hembra: <AlertCircle size={17} />,
  fin_ciclo:      <RefreshCcw size={17} />,
  evaluar_macho:  <UserMinus size={17} />,
  renovar_machos: <RefreshCcw size={17} />,
}

// ── Tarjeta de tarea con acción inline para separaciones ─────────────────────

function TarjetaTarea({ tarea, onConfirmarSeparacion, onDescartar }) {
  const est          = PRIORIDAD[tarea.prioridad]
  const esSeparacion = tarea.tipo === 'separacion'

  const [confirmando, setConfirmando] = useState(false)
  const [fechaSep,    setFechaSep]    = useState(hoy())
  const [guardando,   setGuardando]   = useState(false)

  async function confirmar() {
    if (!fechaSep) return
    setGuardando(true)
    try {
      await onConfirmarSeparacion(tarea.camadaId, fechaSep)
    } finally {
      setGuardando(false)
      setConfirmando(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: est.bg,
        border: `1px solid ${est.border}`,
        boxShadow: `0 0 16px ${est.glow}`,
      }}
    >
      {/* Fila principal: icono + texto + badge + ✕ */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-1 shrink-0" style={{ color: est.titulo }}>{ICONO_TIPO[tarea.tipo]}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm" style={{ color: est.titulo }}>{tarea.descripcion}</div>
            <div className="text-xs mt-0.5 opacity-70" style={{ color: est.titulo }}>{tarea.detalle}</div>
            <div className="text-xs mt-1 font-mono" style={{ color: 'rgba(138,155,176,0.5)' }}>
              {formatFecha(tarea.fecha)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge color={est.badge} size="sm">{est.label}</Badge>
          {onDescartar && (
            <button
              onClick={() => onDescartar(tarea.id)}
              title="Marcar como completada / descartar"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: 'rgba(74,95,122,0.12)',
                border: '1px solid rgba(74,95,122,0.25)',
                color: '#4a5f7a',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Fila de acción — solo para separaciones */}
      {esSeparacion && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${est.border}` }}>
          {confirmando ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: est.titulo }}>
                Fecha real de separación:
              </span>
              <input
                type="date"
                value={fechaSep}
                onChange={(e) => setFechaSep(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg font-mono focus:outline-none"
                style={{
                  background: 'rgba(8,13,26,0.8)',
                  border: `1px solid ${est.accionBorde}`,
                  color: '#c9d4e0',
                }}
              />
              <button
                onClick={confirmar}
                disabled={!fechaSep || guardando}
                className="px-3 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: est.accion,
                  border: `1px solid ${est.accionBorde}`,
                  color: est.titulo,
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  opacity: guardando ? 0.6 : 1,
                }}
              >
                {guardando ? '...' : '✓ Confirmar'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="px-2 py-1 rounded-lg text-xs"
                style={{ background: 'transparent', color: '#4a5f7a', border: '1px solid rgba(30,51,82,0.5)' }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setFechaSep(hoy()); setConfirmando(true) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: est.accion,
                border: `1px solid ${est.accionBorde}`,
                color: est.titulo,
                cursor: 'pointer',
              }}
            >
              ✓ Confirmar separación
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ valor, label, icono, color }) {
  const colores = {
    verde:   { bg: 'rgba(0,230,118,0.08)',   borde: 'rgba(0,230,118,0.2)',   texto: '#00e676' },
    azul:    { bg: 'rgba(64,196,255,0.08)',  borde: 'rgba(64,196,255,0.2)',  texto: '#40c4ff' },
    violeta: { bg: 'rgba(206,147,216,0.08)', borde: 'rgba(206,147,216,0.2)', texto: '#ce93d8' },
    naranja: { bg: 'rgba(255,179,0,0.08)',   borde: 'rgba(255,179,0,0.2)',   texto: '#ffb300' },
    rojo:    { bg: 'rgba(255,61,87,0.08)',   borde: 'rgba(255,61,87,0.2)',   texto: '#ff6b80' },
    marron:  { bg: 'rgba(161,120,80,0.1)',   borde: 'rgba(161,120,80,0.25)', texto: '#a17850' },
  }
  const c = colores[color] ?? colores.azul
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4"
      style={{ background: 'rgba(13,21,40,0.8)', border: `1px solid ${c.borde}` }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
        style={{ background: c.bg, border: `1px solid ${c.borde}` }}
      >
        {icono}
      </div>
      <div>
        <div className="text-2xl font-bold font-mono" style={{ color: c.texto }}>{valor}</div>
        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{label}</div>
      </div>
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────

// Clave de localStorage para las tareas descartadas (permanente)
const LS_KEY = 'appMosca_tareas_descartadas'

// Clave para el recordatorio periódico de renovación de machos
const LS_RENO_KEY = 'appMosca_machos_reno_ts'

function debesMostrarRenovacion() {
  try {
    const last = localStorage.getItem(LS_RENO_KEY)
    if (!last) return true
    return difDias(parseDate(last), parseDate(hoy())) >= INTERVALO_RENOVACION_DIAS
  } catch { return false }
}

function cargarDescartadas() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    // Soporte formato viejo { fecha, ids } → migrar a array simple
    if (Array.isArray(raw)) return new Set(raw)
    if (Array.isArray(raw.ids)) return new Set(raw.ids)
  } catch {}
  return new Set()
}

export default function Dashboard() {
  const { animales, camadas, extendidos, confirmarSeparacion, bio } = useBioterio()

  // IDs de tareas descartadas por el usuario hoy (se resetean el día siguiente)
  const [descartadas, setDescartadas] = useState(() => cargarDescartadas())

  function descartarTarea(id) {
    setDescartadas((prev) => {
      const nuevo = new Set(prev)
      nuevo.add(id)
      localStorage.setItem(LS_KEY, JSON.stringify([...nuevo]))
      return nuevo
    })
  }

  const [mostrarRenovacion, setMostrarRenovacion] = useState(() => debesMostrarRenovacion())

  function descartarRenovacion() {
    localStorage.setItem(LS_RENO_KEY, hoy())
    setMostrarRenovacion(false)
  }

  const todasTareas = useMemo(() => generarTareas(camadas, animales, bio), [camadas, animales, bio])
  const alertasEstrales = useMemo(() => generarAlertasEstrales(animales, extendidos, bio), [animales, extendidos, bio])
  const alertasMachos   = useMemo(() => generarAlertasMachos(animales, camadas), [animales, camadas])
  const tareas   = todasTareas.filter((t) => !descartadas.has(t.id))
  const vencidas = tareas.filter((t) => t.prioridad === 'vencida')
  const deHoy    = tareas.filter((t) => t.prioridad === 'hoy')
  const proximas = tareas.filter((t) => t.prioridad === 'proxima')

  const activas        = animales.filter((a) => a.estado === 'activo' || a.estado === 'en_apareamiento' || a.estado === 'en_cria')
  const hembrasActivas = activas.filter((a) => a.sexo === 'hembra').length
  const machosActivos  = activas.filter((a) => a.sexo === 'macho').length
  const hoyDate        = parseDate(hoy())

  const enApareamiento = camadas.filter((c) => {
    if (c.fecha_nacimiento || c.fecha_destete || c.fecha_separacion || c.failure_flag) return false
    if (!c.fecha_copula) return false
    return difDias(parseDate(c.fecha_copula), hoyDate) < 15
  }).length

  const enPreñez = camadas.filter((c) => {
    if (c.fecha_nacimiento || c.fecha_destete || c.failure_flag) return false
    if (!c.fecha_copula) return false
    if (c.fecha_separacion) return true
    return difDias(parseDate(c.fecha_copula), hoyDate) >= 15
  }).length

  const camadasConCrias = camadas.filter((c) => c.fecha_nacimiento && !c.fecha_destete).length

  const proximosPartos = camadas
    .filter((c) => c.fecha_copula && !c.fecha_nacimiento)
    .map((c) => {
      const rango = calcularRangoParto(c.fecha_copula)
      if (!rango) return null
      const madre = animales.find((a) => a.id === c.id_madre)
      return { camada: c, rango, madre, diasHasta: difDias(hoyDate, rango.partoMin) }
    })
    .filter(Boolean)
    .filter((p) => p.diasHasta <= 14 && p.diasHasta >= -5)
    .sort((a, b) => a.diasHasta - b.diasHasta)
    .slice(0, 6)

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="p-4 md:p-6 space-y-5 bg-dots min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <div
              className="w-2 h-8 rounded-full shrink-0"
              style={{ background: '#00e676', boxShadow: '0 0 10px rgba(0,230,118,0.6)' }}
            />
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Panel de hoy</h1>
            {/* Links independientes */}
            <Link to="/calendario"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.25)', color: '#40c4ff', textDecoration: 'none' }}
            >
              <Calendar size={13} /> Calendario
            </Link>
            <Link to="/incidentes"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: '#ffb300', textDecoration: 'none' }}
            >
              <FileWarning size={13} /> Incidentes
            </Link>
            <Link to="/temperatura"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(255,87,51,0.08)', border: '1px solid rgba(255,87,51,0.25)', color: '#ff7043', textDecoration: 'none' }}
            >
              <Thermometer size={13} /> Temperatura
            </Link>

          </div>
          <p className="text-sm ml-5 capitalize" style={{ color: '#4a5f7a' }}>{fechaHoy}</p>
        </div>
        <div
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono shrink-0"
          style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}
        >
          <span
            className="w-2 h-2 rounded-full pulse-soft"
            style={{ background: '#00e676', boxShadow: '0 0 6px rgba(0,230,118,0.8)' }}
          />
          SISTEMA ACTIVO
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard valor={hembrasActivas} label="Hembras activas"    icono="♀"  color="violeta" />
        <StatCard valor={machosActivos}  label="Machos activos"     icono="♂"  color="azul"    />
        <StatCard valor={enApareamiento}  label="En apareamiento"    icono={<Link2 size={20} />}    color="azul"   />
        <StatCard valor={enPreñez}        label="Preñadas"           icono={<Activity size={20} />} color="naranja" />
        <StatCard valor={camadasConCrias} label="Camadas con crías" icono={<Layers size={20} />}   color="verde"   />
      </div>

      {/* Alertas de ciclo estral y gestación */}
      {alertasEstrales.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#ce93d8' }}>
            🔬 Ciclo estral / gestación
          </div>
          <div className="space-y-2">
            {alertasEstrales.map((a, i) => {
              const color = a.tipo === 'critico' ? '#ff1744' : a.tipo === 'alerta' ? '#ff9100' : a.tipo === 'alta' ? '#ff6b80' : a.tipo === 'media' ? '#ffd740' : '#40c4ff'
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                  style={{ background: `${color}08`, border: `1px solid ${color}30` }}>
                  <span style={{ color, fontSize: '16px' }}>
                    {a.tipo === 'critico' || a.tipo === 'alta' ? '⚠' : '○'}
                  </span>
                  <span style={{ color: '#c9d4e0' }}>{a.mensaje}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Control de machos reproductores ──────────────────────────────────── */}
      {(mostrarRenovacion || alertasMachos.length > 0) && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#40c4ff' }}>
            <UserMinus size={13} /> Control de machos
          </div>
          <div className="space-y-2">

            {/* Recordatorio de renovación periódica */}
            {mostrarRenovacion && (
              <div
                className="rounded-xl p-4 flex items-start justify-between gap-3"
                style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <RefreshCcw size={17} style={{ color: '#40c4ff', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#40c4ff' }}>
                      Revisar y renovar stock de machos reproductores
                    </div>
                    <div className="text-xs mt-0.5 opacity-70" style={{ color: '#40c4ff' }}>
                      Recordatorio periódico (cada 5 meses) · Rango óptimo: 3–9 meses de edad
                    </div>
                  </div>
                </div>
                <button
                  onClick={descartarRenovacion}
                  title="Marcar como revisado"
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                  style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.25)', color: '#40c4ff' }}
                >
                  ✓
                </button>
              </div>
            )}

            {/* Alertas por animal */}
            {alertasMachos.map((a, i) => {
              const esLimite     = a.tipo === 'edad_limite'
              const esProxima    = a.tipo === 'edad_proxima'
              const esPerf       = a.tipo === 'baja_performance'
              const color = esLimite ? '#ff6b80' : esProxima ? '#ff9100' : '#ffd740'
              return (
                <div
                  key={`${a.tipo}-${a.machoId}-${i}`}
                  className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: `${color}09`, border: `1px solid ${color}30` }}
                >
                  <UserMinus size={16} style={{ color, flexShrink: 0, marginTop: '2px' }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color }}>{a.mensaje}</div>
                    {esPerf && a.detalle && (
                      <div className="text-xs mt-0.5 opacity-80" style={{ color }}>{a.detalle}</div>
                    )}
                    {esLimite && (
                      <div className="text-xs mt-0.5 opacity-70" style={{ color }}>
                        Edad avanzada · fuera del rango óptimo reproductivo
                      </div>
                    )}
                    {esProxima && (
                      <div className="text-xs mt-0.5 opacity-70" style={{ color }}>
                        Planificar reemplazo antes de que supere los 9 meses
                      </div>
                    )}
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 self-start"
                    style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}
                  >
                    {esLimite ? 'LÍMITE' : esProxima ? 'PRÓXIMO' : 'RENDIMIENTO'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas urgentes */}
      {(vencidas.length > 0 || deHoy.length > 0) && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#ff6b80' }}>
            <span className="pulse-soft">●</span> Atención inmediata
          </div>
          <div className="space-y-2">
            {vencidas.map((t) => (
              <TarjetaTarea key={t.id} tarea={t} onConfirmarSeparacion={confirmarSeparacion} onDescartar={descartarTarea} />
            ))}
            {deHoy.map((t) => (
              <TarjetaTarea key={t.id} tarea={t} onConfirmarSeparacion={confirmarSeparacion} onDescartar={descartarTarea} />
            ))}
          </div>
        </div>
      )}

      {/* Sin tareas urgentes */}
      {vencidas.length === 0 && deHoy.length === 0 && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}
        >
          <div className="flex justify-center mb-2"><CheckCircle2 size={32} style={{ color: '#00e676' }} /></div>
          <div className="font-semibold text-sm" style={{ color: '#00e676' }}>Sin tareas urgentes hoy</div>
          <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>La colonia está bajo control</div>
        </div>
      )}

      {/* Próximas tareas */}
      {proximas.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
            Próximos 7 días
          </div>
          <div className="space-y-2">
            {proximas.map((t) => (
              <TarjetaTarea key={t.id} tarea={t} onConfirmarSeparacion={confirmarSeparacion} />
            ))}
          </div>
        </div>
      )}

      {/* Seguimiento de preñeces */}
      {proximosPartos.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
            <FlaskConical size={13} style={{ display: 'inline', marginRight: '4px' }} />
            Seguimiento de preñeces activas
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.03)' }}>
                    {['Hembra', 'Cópula', 'Ventana de parto', 'Estado'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                        style={{ color: '#4a5f7a' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proximosPartos.map(({ camada, rango, madre, diasHasta }) => (
                    <tr
                      key={camada.id}
                      style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}
                      className="transition-colors hover:bg-white/[0.01]"
                    >
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: '#ce93d8' }}>
                        {madre?.codigo ?? '?'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#4a5f7a' }}>
                        {formatFecha(camada.fecha_copula)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8a9bb0' }}>
                        {formatFecha(rango.partoMin)} — {formatFecha(rango.partoMax)}
                      </td>
                      <td className="px-4 py-3">
                        {diasHasta < 0 ? (
                          <Badge color="rojo">Controlar ahora</Badge>
                        ) : diasHasta === 0 ? (
                          <Badge color="amarillo">Hoy</Badge>
                        ) : diasHasta <= 3 ? (
                          <Badge color="naranja">En {diasHasta}d</Badge>
                        ) : (
                          <Badge color="azul">En {diasHasta}d</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {animales.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'rgba(13,21,40,0.5)', border: '1px dashed rgba(30,51,82,0.8)' }}
        >
          <div className="flex justify-center mb-4"><Microscope size={48} style={{ color: '#4a5f7a' }} /></div>
          <div className="font-semibold text-white mb-1">Bioterio vacío</div>
          <div className="text-sm" style={{ color: '#4a5f7a' }}>
            Empezá agregando animales en la sección{' '}
            <span style={{ color: '#00e676' }}>Reproductores</span>
          </div>
        </div>
      )}
    </div>
  )
}
