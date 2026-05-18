import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { useAuth } from '../context/AuthContext'
import {
  Home, LayoutDashboard, Printer, Bug, Send, LogOut, ChevronUp, ChevronDown,
  Dna, Microscope, Archive, BarChart2, PackageCheck, Skull, TrendingUp,
} from 'lucide-react'
import iterateNavLogo      from '../assets/iterate_nav_logo.png'
import iterateNavLogoLight from '../assets/iterate_icon_light.png'
import { useTheme } from '../context/ThemeContext'

const LINK_INICIO   = { to: '/inicio', label: 'Inicio',       icon: <Home size={15} /> }
const LINK_DASHBOARD = { to: '/',      label: 'Panel de hoy', icon: <LayoutDashboard size={15} /> }

const LINK_REPORTES = { to: '/reportes', label: 'Reportes e impresión', icon: <Printer size={15} /> }

const GRUPOS = [
  {
    to: '/animales',
    label: 'Reproductores',
    icon: <Microscope size={15} />,
    hijos: [
      { to: '/camadas', label: 'Emparejamientos', icon: <Dna size={13} /> },
    ],
  },
  {
    to: '/stock',
    label: 'Stock',
    icon: <Archive size={15} />,
    hijos: [
      { to: '/entregas',    label: 'Entregas',    icon: <PackageCheck size={13} /> },
      { to: '/sacrificios', label: 'Sacrificios', icon: <Skull size={13} /> },
    ],
  },
  {
    to: '/rendimiento',
    label: 'Rendimiento',
    icon: <BarChart2 size={15} />,
    hijos: [
      { to: '/estadisticas', label: 'Estadísticas', icon: <TrendingUp size={13} /> },
    ],
  },
]

function NavGrupo({ grupo, onCerrarMenu }) {
  const location = useLocation()
  const { tema } = useTheme()
  const rutasGrupo = [grupo.to, ...grupo.hijos.map((h) => h.to)]
  const estaActivo = rutasGrupo.some((r) => location.pathname === r)
  const [abierto, setAbierto] = useState(estaActivo)

  const estiloBase = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 12px', borderRadius: '10px',
    border: '1px solid transparent',
    fontSize: '13px', fontWeight: 500, textDecoration: 'none',
  }
  const estiloActivo = {
    ...estiloBase,
    background: tema.greenDim,
    color: tema.green,
    border: `1px solid ${tema.greenBorde}`,
    boxShadow: '0 0 12px rgba(0,180,100,0.1)',
    fontWeight: 600,
  }
  const estiloInactivo = { ...estiloBase, color: tema.textSecondary }

  return (
    <div>
      {/* Fila principal con link + toggle */}
      <div
        className="flex items-center rounded-[10px] overflow-hidden"
        style={estaActivo
          ? { background: tema.greenDim, border: `1px solid ${tema.greenBorde}`, boxShadow: '0 0 12px rgba(0,180,100,0.1)' }
          : { border: '1px solid transparent' }
        }
      >
        <NavLink
          to={grupo.to}
          end
          onClick={onCerrarMenu}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '10px',
            flex: 1, padding: '8px 12px',
            color: estaActivo ? '#00e676' : '#8a9bb0',
            fontSize: '13px', fontWeight: estaActivo ? 600 : 500,
            textDecoration: 'none', background: 'transparent',
          })}
        >
          <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {grupo.icon}
          </span>
          {grupo.label}
        </NavLink>
        <button
          onClick={() => setAbierto(!abierto)}
          className="flex items-center justify-center w-8 h-8 shrink-0"
          style={{ background: 'transparent', border: 'none', color: estaActivo ? '#00e676' : '#4a5f7a', cursor: 'pointer' }}
        >
          {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Sub-items */}
      {abierto && (
        <div className="mt-1 ml-4 space-y-0.5" style={{ borderLeft: `1px solid ${tema.bgCardBorde}`, paddingLeft: '12px' }}>
          {grupo.hijos.map((hijo) => (
            <NavLink
              key={hijo.to}
              to={hijo.to}
              onClick={onCerrarMenu}
              style={({ isActive }) =>
                isActive
                  ? {
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 10px', borderRadius: '8px',
                      background: 'rgba(0,230,118,0.1)',
                      color: '#00e676',
                      border: '1px solid rgba(0,230,118,0.2)',
                      fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                    }
                  : {
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 10px', borderRadius: '8px',
                      color: '#6b7c94',
                      border: '1px solid transparent',
                      fontSize: '12px', fontWeight: 500, textDecoration: 'none',
                    }
              }
            >
              {hijo.icon}
              {hijo.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

const SECCIONES = [
  'Panel de hoy', 'Reproductores', 'Emparejamientos', 'Stock',
  'Entregas', 'Sacrificios', 'Rendimiento', 'Estadísticas',
  'Temperatura', 'Reportes', 'Otra sección',
]

function ReportarError() {
  const [abierto, setAbierto]     = useState(false)
  const [seccion, setSeccion]     = useState('')
  const [descripcion, setDesc]    = useState('')
  const [enviado, setEnviado]     = useState(false)

  function enviar() {
    if (!descripcion.trim()) return
    const asunto = encodeURIComponent(`[AppMosca] Error en: ${seccion || 'sin especificar'}`)
    const cuerpo = encodeURIComponent(
      `Sección: ${seccion || 'sin especificar'}\n\nDescripción:\n${descripcion.trim()}\n\n---\nEnviado desde AppMosca`
    )
    window.location.href = `mailto:LucasDeRiviaDev@gmail.com?subject=${asunto}&body=${cuerpo}`
    setEnviado(true)
    setTimeout(() => {
      setEnviado(false)
      setSeccion('')
      setDesc('')
      setAbierto(false)
    }, 2000)
  }

  return (
    <div className="mx-3 mb-3 rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,61,87,0.25)', background: 'rgba(255,61,87,0.04)' }}
    >
      {/* Encabezado colapsable */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 transition-all"
        style={{ background: 'rgba(255,61,87,0.08)', borderBottom: abierto ? '1px solid rgba(255,61,87,0.2)' : 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2">
          <Bug size={14} style={{ color: '#ff6b80' }} />
          <span className="text-xs font-semibold" style={{ color: '#ff6b80' }}>Reportar error</span>
        </div>
        <span style={{ color: '#ff6b80' }}>{abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

      {/* Formulario */}
      {abierto && (
        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#4a5f7a' }}>¿Dónde ocurrió?</label>
            <select
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none"
              style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(255,61,87,0.25)', color: '#c9d4e0' }}
            >
              <option value="">— Seleccioná una sección —</option>
              {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: '#4a5f7a' }}>Describí el error</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="¿Qué pasó? ¿Qué esperabas que pasara?"
              rows={3}
              className="w-full px-2 py-1.5 rounded-lg text-xs resize-none focus:outline-none"
              style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(255,61,87,0.25)', color: '#c9d4e0' }}
            />
          </div>
          <button
            onClick={enviar}
            disabled={!descripcion.trim() || enviado}
            className="w-full py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: enviado ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.15)',
              border: `1px solid ${enviado ? 'rgba(0,230,118,0.4)' : 'rgba(255,61,87,0.4)'}`,
              color: enviado ? '#00e676' : '#ff6b80',
              cursor: !descripcion.trim() || enviado ? 'not-allowed' : 'pointer',
              opacity: !descripcion.trim() ? 0.5 : 1,
            }}
          >
            {enviado ? '✓ Abriendo...' : <><Send size={12} style={{ display: 'inline', marginRight: 4 }} /> Enviar reporte</>}
          </button>
          <p className="text-xs text-center" style={{ color: 'rgba(74,95,122,0.6)' }}>
            Se abre tu app de correo con el reporte listo para enviar.
          </p>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ onCerrarSesion, onCerrarMenu }) {
  const { animales, camadas, bio } = useBioterio()
  const { config, limpiarBioterio } = useBioterioActivo()
  const { tema, modoBrillo } = useTheme()
  const { sesion } = useAuth()
  const emailUsuario = sesion?.user?.email ?? ''

  const [fichaVisible, setFichaVisible] = useState(() => {
    try { return localStorage.getItem('appMosca_ficha_visible') === 'true' }
    catch { return false }
  })

  function toggleFicha() {
    setFichaVisible(v => {
      const nuevo = !v
      localStorage.setItem('appMosca_ficha_visible', String(nuevo))
      return nuevo
    })
  }

  const datosBio = bio ? [
    { label: 'Gestación',         valor: `${bio.GESTACION_DIAS} días` },
    { label: 'Destete',           valor: `${bio.DESTETE_DIAS} días post-nacimiento` },
    { label: 'Madurez sexual',    valor: `${Math.round(bio.MADUREZ_DIAS / 7)} semanas` },
    { label: 'Ciclo estral',      valor: `~${bio.CICLO_ESTRAL_DIAS} días` },
    { label: 'Camada promedio',   valor: config?.camadaPromedio ?? '—' },
    { label: 'Vida reproductiva', valor: config?.vidaReproductiva ?? '—' },
  ] : []

  const hembrasActivas = animales.filter((a) => a.sexo === 'hembra' && (a.estado === 'activo' || a.estado === 'en_apareamiento' || a.estado === 'en_cria')).length
  const machosActivos  = animales.filter((a) => a.sexo === 'macho'  && (a.estado === 'activo' || a.estado === 'en_apareamiento' || a.estado === 'en_cria')).length
  const prenadas       = camadas.filter((c) => c.fecha_copula && !c.fecha_nacimiento && !c.failure_flag).length

  return (
    <aside
      className="w-64 h-full flex flex-col shrink-0"
      style={{
        background: tema.bgSidebar,
        borderRight: `1px solid ${tema.bgSidebarBorde}`,
      }}
    >
      {/* Logo + bioterio activo */}
      <div className="px-4 py-4" style={{ borderBottom: `1px solid ${tema.bgSidebarBorde}` }}>
        <div className="flex items-center gap-3 mb-3">
          <div style={{
            background: tema.bgCard,
            borderRadius: '10px',
            border: `1.5px solid ${tema.greenBorde}`,
            boxShadow: '0 0 40px rgba(0,230,118,0.12), 0 4px 20px rgba(0,0,0,0.2)',
            padding: '5px 8px',
            display: 'inline-flex',
            flexShrink: 0,
          }}>
            <img
              src={modoBrillo ? iterateNavLogoLight : iterateNavLogo}
              alt="ITeRatE"
              style={{ height: '48px', width: 'auto', display: 'block', filter: modoBrillo ? 'none' : 'drop-shadow(0 0 6px rgba(0,180,100,0.3))', mixBlendMode: modoBrillo ? 'multiply' : 'normal' }}
            />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide" style={{ color: tema.textPrimary }}>BIOTERIO</div>
            <div className="text-xs font-mono" style={{ color: tema.green, opacity: 0.8 }}>v2.0</div>
            <div className="text-xs font-mono" style={{ color: tema.green, opacity: 0.55 }}>ACTIVO</div>
          </div>
        </div>
        {/* Bioterio activo + botón cambiar */}
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
          style={{ background: `${config?.color ?? '#00e676'}10`, border: `1px solid ${config?.color ?? '#00e676'}30` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">{config?.icon ?? '🐀'}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: config?.color ?? '#00e676' }}>
                {config?.labelCorto ?? 'Ratas'}
              </div>
              <div className="text-xs font-mono italic truncate" style={{ color: 'rgba(138,155,176,0.5)', fontSize: '10px' }}>
                {config?.nombreCientifico ?? '—'}
              </div>
            </div>
          </div>
          <button
            onClick={limpiarBioterio}
            className="shrink-0 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ background: tema.greenDim, border: `1px solid ${tema.greenBorde}`, color: tema.textMuted, cursor: 'pointer' }}
          >
            Cambiar
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="px-4 py-3 grid grid-cols-3 gap-1" style={{ borderBottom: `1px solid ${tema.bgCardBorde}` }}>
        {[
          { val: hembrasActivas, label: '♀', color: '#ce93d8' },
          { val: machosActivos,  label: '♂', color: '#40c4ff' },
          { val: prenadas,       label: '🫄', color: '#ffb300' },
        ].map(({ val, label, color }) => (
          <div
            key={label}
            className="rounded-lg py-2 text-center"
            style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}
          >
            <div className="font-mono font-bold text-base" style={{ color }}>{val}</div>
            <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Módulos navegación */}
      <div className="px-4 pt-4 pb-1">
        <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: tema.textMuted, opacity: 0.6 }}>
          Módulos
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {[LINK_INICIO, null, LINK_DASHBOARD].map((item, i) =>
          item === null
            ? <div key="sep-top" style={{ height: "1px", background: tema.bgCardBorde, margin: "6px 4px" }} />
            : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCerrarMenu}
                style={({ isActive }) =>
                  isActive
                    ? {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '10px',
                        background: tema.greenDim,
                        color: '#00e676',
                        border: '1px solid rgba(0,230,118,0.25)',
                        boxShadow: '0 0 12px rgba(0,230,118,0.1)',
                        fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                      }
                    : {
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '10px',
                        color: tema.textSecondary,
                        border: '1px solid transparent',
                        fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                      }
                }
              >
                <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                {item.label}
              </NavLink>
            )
        )}

        {/* Separador */}
        <div style={{ height: "1px", background: tema.bgCardBorde, margin: "6px 4px" }} />

        {/* Grupos con sub-secciones */}
        {GRUPOS.map((grupo) => (
          <NavGrupo key={grupo.to} grupo={grupo} onCerrarMenu={onCerrarMenu} />
        ))}

        {/* Separador */}
        <div style={{ height: "1px", background: tema.bgCardBorde, margin: "6px 4px" }} />

        {/* Reportes al final */}
        <NavLink
          to={LINK_REPORTES.to}
          onClick={onCerrarMenu}
          style={({ isActive }) =>
            isActive
              ? {
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '10px',
                  background: tema.greenDim,
                  color: '#00e676',
                  border: '1px solid rgba(0,230,118,0.25)',
                  boxShadow: '0 0 12px rgba(0,230,118,0.1)',
                  fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                }
              : {
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '10px',
                  color: tema.textSecondary,
                  border: '1px solid transparent',
                  fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                }
          }
        >
          <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {LINK_REPORTES.icon}
          </span>
          {LINK_REPORTES.label}
        </NavLink>
      </nav>

      {/* ── FICHA BIOLÓGICA DE LA ESPECIE ── */}
      {config && bio && (
        <div className="mx-3 mb-3 rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(161,120,80,0.3)', background: 'rgba(161,120,80,0.05)' }}
        >
          {/* Header siempre visible con botón toggle */}
          <button
            onClick={toggleFicha}
            className="w-full px-4 py-3 flex items-center gap-2 text-left"
            style={{
              background: 'rgba(161,120,80,0.1)',
              borderBottom: fichaVisible ? '1px solid rgba(161,120,80,0.2)' : 'none',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <span className="text-xl">{config.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm" style={{ color: '#c9a87a' }}>{config.label}</div>
              <div className="text-xs font-mono italic opacity-60 truncate" style={{ color: '#a17850' }}>{config.nombreCientifico}</div>
            </div>
            <ChevronDown
              size={13}
              style={{
                color: '#a17850',
                flexShrink: 0,
                transition: 'transform 0.2s',
                transform: fichaVisible ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* Contenido colapsable */}
          {fichaVisible && (
            <>
              <div className="px-4 py-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(161,120,80,0.5)' }}>
                  Referencias biológicas
                </div>
                {datosBio.map(({ label, valor }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-xs leading-tight" style={{ color: '#6b7c94' }}>{label}</span>
                    <span className="text-xs font-mono font-semibold text-right" style={{ color: '#a17850' }}>{valor}</span>
                  </div>
                ))}
              </div>

              {config.orden && config.orden !== '—' && (
                <div
                  className="px-4 py-2 text-xs text-center font-mono"
                  style={{ borderTop: '1px solid rgba(161,120,80,0.15)', color: 'rgba(107,124,148,0.5)' }}
                >
                  {config.orden}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Reportar error */}
      <ReportarError />

      {/* Usuario + Cerrar sesión */}
      <div
        className="mx-3 mb-3 rounded-xl px-4 py-3"
        style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#4a5f7a' }}>
              Usuario
            </div>
            <div
              className="text-xs font-mono truncate"
              style={{ color: tema.textSecondary }}
            >
              {emailUsuario}
            </div>
          </div>
          <button
            onClick={onCerrarSesion}
            title="Cerrar sesión"
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: 'rgba(255,61,87,0.08)',
              border: '1px solid rgba(255,61,87,0.2)',
              color: '#ff6b80',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

    </aside>
  )
}
