import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { useAuth } from '../context/AuthContext'
import {
  Home, LayoutDashboard, Printer, Bug, Send, LogOut, ChevronUp, ChevronDown,
  Dna, RefreshCw, Archive, GitMerge, Skull, TrendingUp, BarChart2,
  Thermometer, CalendarDays,
} from 'lucide-react'
import GenERatsBrand from './GenERatsBrand'

const NAV = [
  { to: '/inicio', label: 'Inicio', icon: <Home size={15} /> },
  {
    to: '/animales', label: 'Reproductores', icon: <Dna size={15} />,
    hijos: [
      { to: '/camadas', label: 'Emparejamientos', icon: <GitMerge size={13} /> },
    ],
  },
  {
    to: '/stock', label: 'Stock', icon: <Archive size={15} />,
    hijos: [
      { to: '/entregas',    label: 'Entregas',    icon: <Send size={13} /> },
      { to: '/sacrificios', label: 'Sacrificios', icon: <Skull size={13} /> },
    ],
  },
  {
    to: '/rendimiento', label: 'Rendimiento', icon: <TrendingUp size={15} />,
    hijos: [
      { to: '/',             label: 'Panel de hoy',  icon: <LayoutDashboard size={13} />, end: true },
      { to: '/estadisticas', label: 'Estadísticas',  icon: <BarChart2 size={13} /> },
    ],
  },
  { to: '/temperatura', label: 'Temperatura', icon: <Thermometer size={15} /> },
  { to: '/calendario',  label: 'Calendario',  icon: <CalendarDays size={15} /> },
  { to: '/reportes',    label: 'Reportes',    icon: <Printer size={15} /> },
]

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
  const { sesion } = useAuth()
  const emailUsuario = sesion?.user?.email ?? ''

  const datosBio = bio ? [
    { label: 'Gestación',         valor: `${bio.GESTACION_DIAS} días` },
    { label: 'Destete',           valor: `${bio.DESTETE_DIAS} días post-nacimiento` },
    { label: 'Madurez sexual',    valor: `${bio.MADUREZ_DIAS / 7} semanas` },
    { label: 'Ciclo estral',      valor: `~${bio.CICLO_ESTRAL_DIAS} días` },
    { label: 'Camada promedio',   valor: config?.camadaPromedio ?? '—' },
    { label: 'Vida reproductiva', valor: config?.vidaReproductiva ?? '—' },
  ] : []

  const hembrasActivas = animales.filter((a) => a.sexo === 'hembra' && (a.estado === 'activo' || a.estado === 'en_apareamiento' || a.estado === 'en_cria')).length
  const machosActivos  = animales.filter((a) => a.sexo === 'macho'  && (a.estado === 'activo' || a.estado === 'en_apareamiento' || a.estado === 'en_cria')).length
  const prenadas       = camadas.filter((c) => c.fecha_copula && !c.fecha_nacimiento).length

  return (
    <aside
      className="w-64 h-full flex flex-col shrink-0"
      style={{
        background: 'linear-gradient(180deg, #080d1a 0%, #050810 100%)',
        borderRight: '1px solid rgba(0,230,118,0.12)',
      }}
    >
      {/* Logo + bioterio activo */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(0,230,118,0.1)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(0,230,118,0.1)',
              border: '1px solid rgba(0,230,118,0.3)',
              boxShadow: '0 0 12px rgba(0,230,118,0.15)',
            }}
          >
            <Dna size={18} style={{ color: '#00e676' }} />
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-wide">BIOTERIO</div>
            <div className="text-xs font-mono" style={{ color: 'rgba(0,230,118,0.6)' }}>v1.0 · ACTIVO</div>
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
            title="Cambiar bioterio"
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a', cursor: 'pointer' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2" style={{ borderBottom: '1px solid rgba(30,51,82,0.6)' }}>
        {[
          { val: hembrasActivas, label: '♀', color: '#ce93d8' },
          { val: machosActivos,  label: '♂', color: '#40c4ff' },
          { val: prenadas,       label: '🫄', color: '#ffb300' },
        ].map(({ val, label, color }) => (
          <div
            key={label}
            className="rounded-lg py-2 text-center"
            style={{ background: 'rgba(30,51,82,0.3)', border: '1px solid rgba(30,51,82,0.6)' }}
          >
            <div className="font-mono font-bold text-base" style={{ color }}>{val}</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Módulos navegación */}
      <div className="px-4 pt-4 pb-1">
        <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(138,155,176,0.4)' }}>
          Módulos
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {NAV.map((item) => {
          const linkStyle = (isActive) =>
            isActive
              ? {
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '10px',
                  background: 'rgba(0,230,118,0.12)', color: '#00e676',
                  border: '1px solid rgba(0,230,118,0.25)',
                  boxShadow: '0 0 12px rgba(0,230,118,0.1)',
                  fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                }
              : {
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '10px',
                  color: '#8a9bb0', border: '1px solid transparent',
                  fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                }

          const iconSlot = (icon) => (
            <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </span>
          )

          if (!item.hijos) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onCerrarMenu}
                style={({ isActive }) => linkStyle(isActive)}
              >
                {iconSlot(item.icon)}
                {item.label}
              </NavLink>
            )
          }

          return (
            <div key={item.to}>
              <NavLink
                to={item.to}
                onClick={onCerrarMenu}
                style={({ isActive }) => linkStyle(isActive)}
              >
                {iconSlot(item.icon)}
                {item.label}
              </NavLink>
              <div
                className="ml-4 mt-0.5 space-y-0.5 pl-3"
                style={{ borderLeft: '1px solid rgba(30,51,82,0.6)' }}
              >
                {item.hijos.map((hijo) => (
                  <NavLink
                    key={hijo.to}
                    to={hijo.to}
                    end={hijo.end}
                    onClick={onCerrarMenu}
                    style={({ isActive }) => ({
                      ...linkStyle(isActive),
                      fontSize: '12px',
                      padding: '6px 10px',
                    })}
                  >
                    {iconSlot(hijo.icon)}
                    {hijo.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── FICHA BIOLÓGICA DE LA ESPECIE ── */}
      {config && bio && (
        <div className="mx-3 mb-3 rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(161,120,80,0.3)', background: 'rgba(161,120,80,0.05)' }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ background: 'rgba(161,120,80,0.1)', borderBottom: '1px solid rgba(161,120,80,0.2)' }}
          >
            <span className="text-xl">{config.icon}</span>
            <div>
              <div className="font-bold text-sm" style={{ color: '#c9a87a' }}>{config.label}</div>
              <div className="text-xs font-mono italic opacity-60" style={{ color: '#a17850' }}>{config.nombreCientifico}</div>
            </div>
          </div>

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

          <div
            className="px-4 py-2 text-xs text-center font-mono"
            style={{ borderTop: '1px solid rgba(161,120,80,0.15)', color: 'rgba(107,124,148,0.5)' }}
          >
            {config.orden}
          </div>
        </div>
      )}

      {/* Reportar error */}
      <ReportarError />

      {/* Usuario + Cerrar sesión */}
      <div
        className="mx-3 mb-3 rounded-xl px-4 py-3"
        style={{ background: 'rgba(30,51,82,0.2)', border: '1px solid rgba(30,51,82,0.5)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#4a5f7a' }}>
              Usuario
            </div>
            <div
              className="text-xs font-mono truncate"
              style={{ color: '#8a9bb0' }}
              title={emailUsuario}
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

      {/* Footer — Logo GenERats */}
      <div
        style={{
          borderTop: '1px solid rgba(0,230,118,0.08)',
          padding: '14px 12px 18px',
          overflow: 'visible',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <GenERatsBrand
          iconSize={52}
          nameSize={30}
          sloganSize={11}
          sublineSize={0}
          gap={10}
          align="left"
          showSubline={false}
          allowWrap
          iconPrefix="sidebarFooterBrand"
          style={{ width: '100%', maxWidth: '100%' }}
        />
      </div>
    </aside>
  )
}
