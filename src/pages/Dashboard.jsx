import { useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { generarTareas, formatFecha, calcularRangoParto, difDias, parseDate, hoy } from '../utils/calculos'
import Badge from '../components/Badge'

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
  },
  hoy: {
    bg: 'rgba(255,179,0,0.08)',
    border: 'rgba(255,179,0,0.25)',
    titulo: '#ffb300',
    badge: 'amarillo',
    label: 'HOY',
    icono: '⚠️',
    glow: 'rgba(255,179,0,0.1)',
  },
  proxima: {
    bg: 'rgba(64,196,255,0.06)',
    border: 'rgba(64,196,255,0.2)',
    titulo: '#40c4ff',
    badge: 'azul',
    label: 'PRÓXIMA',
    icono: '📅',
    glow: 'transparent',
  },
}

const ICONO_TIPO = {
  control_parto: '🐣',
  destete: '📦',
  madurez: '🐀',
  revision: '🔬',
}

function TarjetaTarea({ tarea }) {
  const est = PRIORIDAD[tarea.prioridad]
  return (
    <div
      className="rounded-xl p-4 flex items-start justify-between gap-3"
      style={{
        background: est.bg,
        border: `1px solid ${est.border}`,
        boxShadow: `0 0 16px ${est.glow}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{ICONO_TIPO[tarea.tipo]}</span>
        <div>
          <div className="font-semibold text-sm" style={{ color: est.titulo }}>{tarea.descripcion}</div>
          <div className="text-xs mt-0.5 opacity-70" style={{ color: est.titulo }}>{tarea.detalle}</div>
          <div className="text-xs mt-1 font-mono" style={{ color: 'rgba(138,155,176,0.5)' }}>
            {formatFecha(tarea.fecha)}
          </div>
        </div>
      </div>
      <Badge color={est.badge} size="sm">{est.label}</Badge>
    </div>
  )
}

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

export default function Dashboard() {
  const { animales, camadas } = useBioterio()

  const tareas = useMemo(() => generarTareas(camadas, animales), [camadas, animales])
  const vencidas = tareas.filter((t) => t.prioridad === 'vencida')
  const deHoy = tareas.filter((t) => t.prioridad === 'hoy')
  const proximas = tareas.filter((t) => t.prioridad === 'proxima')

  const activas = animales.filter((a) => a.estado === 'activo' || a.estado === 'en_cria')
  const hembrasActivas = activas.filter((a) => a.sexo === 'hembra').length
  const machosActivos = activas.filter((a) => a.sexo === 'macho').length
  const camadasPendientes = camadas.filter((c) => c.fecha_copula && !c.fecha_nacimiento).length
  const camadasConCrias = camadas.filter((c) => c.fecha_nacimiento && !c.fecha_destete).length

  const hoyDate = parseDate(hoy())
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
    <div className="p-6 space-y-6 bg-dots min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-2 h-8 rounded-full"
              style={{ background: '#00e676', boxShadow: '0 0 10px rgba(0,230,118,0.6)' }}
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">Panel de hoy</h1>
          </div>
          <p className="text-sm ml-5 capitalize" style={{ color: '#4a5f7a' }}>{fechaHoy}</p>
        </div>
        {/* Indicador de estado */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard valor={hembrasActivas} label="Hembras activas" icono="♀" color="violeta" />
        <StatCard valor={machosActivos} label="Machos activos" icono="♂" color="azul" />
        <StatCard valor={camadasPendientes} label="Preñeces en curso" icono="🫄" color="naranja" />
        <StatCard valor={camadasConCrias} label="Camadas con crías" icono="🪺" color="verde" />
      </div>

      {/* Alertas urgentes */}
      {(vencidas.length > 0 || deHoy.length > 0) && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#ff6b80' }}>
            <span className="pulse-soft">●</span> Atención inmediata
          </div>
          <div className="space-y-2">
            {vencidas.map((t) => <TarjetaTarea key={t.id} tarea={t} />)}
            {deHoy.map((t) => <TarjetaTarea key={t.id} tarea={t} />)}
          </div>
        </div>
      )}

      {/* Sin tareas urgentes */}
      {vencidas.length === 0 && deHoy.length === 0 && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)' }}
        >
          <div className="text-3xl mb-2">✅</div>
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
            {proximas.map((t) => <TarjetaTarea key={t.id} tarea={t} />)}
          </div>
        </div>
      )}

      {/* Seguimiento de preñeces */}
      {proximosPartos.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
            🔬 Seguimiento de preñeces activas
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
          >
            <table className="w-full text-sm">
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
      )}

      {/* Estado vacío */}
      {animales.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'rgba(13,21,40,0.5)', border: '1px dashed rgba(30,51,82,0.8)' }}
        >
          <div className="text-5xl mb-4">🐀</div>
          <div className="font-semibold text-white mb-1">Bioterio vacío</div>
          <div className="text-sm" style={{ color: '#4a5f7a' }}>
            Empezá agregando animales en la sección{' '}
            <span style={{ color: '#00e676' }}>Animales</span>
          </div>
        </div>
      )}
    </div>
  )
}
