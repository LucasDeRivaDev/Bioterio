import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { useAuth } from '../context/AuthContext'
import {
  Home, LayoutDashboard, Printer, Bug, Send, LogOut, ChevronUp, ChevronDown,
  Dna, Microscope, Archive, BarChart2, PackageCheck, Skull, TrendingUp, Target, ClipboardList, ScanSearch,
  BookOpen, Sun, Moon,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import Marca from './Marca'
import { esCamadaPreniada, parseDate, hoy } from '../utils/calculos'

const LINK_INICIO   = { to: '/inicio', label: 'Inicio',       icon: <Home size={16} /> }
const LINK_DASHBOARD = { to: '/',      label: 'Panel de hoy', icon: <LayoutDashboard size={16} /> }

const LINK_REPORTES       = { to: '/reportes',     label: 'Reportes e impresión', icon: <Printer size={16} /> }
const LINK_PLANIFICACION  = { to: '/planificacion', label: 'Planificación',    icon: <Target size={16} /> }
const LINK_PEDIDOS        = { to: '/pedidos',       label: 'Pedidos',           icon: <ClipboardList size={16} /> }
const LINK_AUDITORIA      = { to: '/auditoria',     label: 'Auditoría',         icon: <ScanSearch size={16} /> }

const GRUPOS = [
  {
    to: '/animales',
    label: 'Reproductores',
    icon: <Microscope size={16} />,
    hijos: [
      { to: '/camadas', label: 'Emparejamientos', icon: <Dna size={13} /> },
    ],
  },
  {
    to: '/stock',
    label: 'Stock',
    icon: <Archive size={16} />,
    hijos: [
      { to: '/entregas',    label: 'Entregas',    icon: <PackageCheck size={13} /> },
      { to: '/sacrificios', label: 'Sacrificios', icon: <Skull size={13} /> },
    ],
  },
  {
    to: '/rendimiento',
    label: 'Rendimiento',
    icon: <BarChart2 size={16} />,
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

  return (
    <div>
      <div className="flex items-center">
        <NavLink to={grupo.to} end onClick={onCerrarMenu} className={({ isActive }) => `nav-item flex-1 ${isActive ? 'activo' : ''}`}>
          <span className="w-5 flex items-center justify-center">{grupo.icon}</span>
          {grupo.label}
        </NavLink>
        <button
          onClick={() => setAbierto(!abierto)}
          aria-label={abierto ? `Contraer ${grupo.label}` : `Expandir ${grupo.label}`}
          className="flex items-center justify-center w-8 h-8 shrink-0 rounded-md"
          style={{ color: tema.textMuted }}
        >
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {abierto && (
        <div className="mt-0.5 ml-[21px] pl-2 space-y-0.5" style={{ borderLeft: `1px solid ${tema.bgCardBorde}` }}>
          {grupo.hijos.map((hijo) => (
            <NavLink key={hijo.to} to={hijo.to} onClick={onCerrarMenu} className={({ isActive }) => `nav-item nav-sub ${isActive ? 'activo' : ''}`}>
              {hijo.icon}
              {hijo.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function NavItem({ item, onCerrarMenu }) {
  return (
    <NavLink to={item.to} end={item.to === '/'} onClick={onCerrarMenu} className={({ isActive }) => `nav-item ${isActive ? 'activo' : ''}`}>
      <span className="w-5 flex items-center justify-center">{item.icon}</span>
      {item.label}
    </NavLink>
  )
}

function Separador() {
  const { tema } = useTheme()
  return <div style={{ height: '1px', background: tema.lineSoft, margin: '8px 4px' }} />
}

const SECCIONES = [
  'Panel de hoy', 'Reproductores', 'Emparejamientos', 'Stock',
  'Entregas', 'Sacrificios', 'Rendimiento', 'Estadísticas',
  'Temperatura', 'Planificación', 'Pedidos', 'Auditoría', 'Reportes', 'Otra sección',
]

function ReportarError() {
  const { tema } = useTheme()
  const [abierto, setAbierto]     = useState(false)
  const [seccion, setSeccion]     = useState('')
  const [descripcion, setDesc]    = useState('')
  const [enviado, setEnviado]     = useState(false)

  function enviar() {
    if (!descripcion.trim()) return
    const asunto = encodeURIComponent(`[ITeRatE] Error en: ${seccion || 'sin especificar'}`)
    const cuerpo = encodeURIComponent(
      `Sección: ${seccion || 'sin especificar'}\n\nDescripción:\n${descripcion.trim()}\n\n---\nEnviado desde ITeRatE`
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
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${abierto ? tema.bgCardBorde : 'transparent'}` }}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="nav-item w-full justify-between"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <span className="flex items-center gap-2.5">
          <Bug size={16} />
          Reportar un error
        </span>
        {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {abierto && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          <label className="block">
            <span className="text-xs font-medium block mb-1" style={{ color: tema.textSecondary }}>¿Dónde ocurrió?</span>
            <select
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
              className="w-full h-9 px-2 rounded-md text-sm focus:outline-none"
              style={{ background: tema.bgInput, border: `1px solid ${tema.bgInputBorde}`, color: tema.textPrimary }}
            >
              <option value="">Seleccioná una sección</option>
              {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium block mb-1" style={{ color: tema.textSecondary }}>Describí el error</span>
            <textarea
              value={descripcion}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="¿Qué pasó? ¿Qué esperabas que pasara?"
              rows={3}
              className="w-full px-2 py-1.5 rounded-md text-sm resize-none focus:outline-none"
              style={{ background: tema.bgInput, border: `1px solid ${tema.bgInputBorde}`, color: tema.textPrimary }}
            />
          </label>
          <button
            onClick={enviar}
            disabled={!descripcion.trim() || enviado}
            className="w-full h-9 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2"
            style={{
              background: tema.textPrimary,
              color: tema.bgMain,
              opacity: !descripcion.trim() ? 0.5 : 1,
            }}
          >
            {enviado ? 'Abriendo correo…' : <><Send size={13} /> Enviar reporte</>}
          </button>
          <p className="text-xs" style={{ color: tema.textMuted }}>
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
  const { tema, modoBrillo, toggleBrillo } = useTheme()
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
  const hoyDate        = parseDate(hoy())
  const prenadas       = camadas.filter((c) => esCamadaPreniada(c, hoyDate, bio)).length

  return (
    <aside
      className="w-64 h-full flex flex-col shrink-0"
      style={{ background: tema.bgSidebar, borderRight: `1px solid ${tema.bgSidebarBorde}` }}
      aria-label="Navegación principal"
    >
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <Marca pieza="isotipo" alto={44} decorativa />
        <Marca pieza="logotipo" alto={42} />
      </div>

      {/* Bioterio activo: el color de la colonia es su identidad */}
      <div className="px-3 pb-3">
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
          style={{ background: tema.bgRaised, border: `1px solid ${tema.bgCardBorde}`, boxShadow: `inset 3px 0 0 ${config?.color ?? tema.accent}` }}
        >
          <span className="text-base shrink-0">{config?.icon ?? '🐀'}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate" style={{ color: tema.textPrimary }}>
              {config?.labelCorto ?? 'Ratas'}
            </div>
            <div className="text-xs italic truncate" style={{ color: tema.textMuted }}>
              {config?.nombreCientifico ?? '—'}
            </div>
          </div>
          <button
            onClick={limpiarBioterio}
            className="shrink-0 h-7 px-2 rounded-md text-xs font-medium"
            style={{ border: `1px solid ${tema.bgCardBorde}`, color: tema.textSecondary, background: tema.bgCard }}
          >
            Cambiar
          </button>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 mt-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${tema.bgCardBorde}` }}>
          {[
            { val: hembrasActivas, label: 'Hembras', color: tema.female },
            { val: machosActivos,  label: 'Machos',  color: tema.male },
            { val: prenadas,       label: 'Preñadas', color: tema.amber },
          ].map(({ val, label, color }, i) => (
            <div key={label} className="py-2 text-center" style={{ borderLeft: i ? `1px solid ${tema.bgCardBorde}` : 'none' }}>
              <div className="font-cond font-semibold text-lg leading-none" style={{ color }}>{val}</div>
              <div className="text-[11px] mt-1" style={{ color: tema.textMuted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5" style={{ borderTop: `1px solid ${tema.lineSoft}`, paddingTop: '10px' }}>
        <NavItem item={LINK_INICIO} onCerrarMenu={onCerrarMenu} />
        <NavItem item={LINK_DASHBOARD} onCerrarMenu={onCerrarMenu} />
        <Separador />
        {GRUPOS.map((grupo) => (
          <NavGrupo key={grupo.to} grupo={grupo} onCerrarMenu={onCerrarMenu} />
        ))}
        <Separador />
        <NavItem item={LINK_PLANIFICACION} onCerrarMenu={onCerrarMenu} />
        <NavItem item={LINK_PEDIDOS} onCerrarMenu={onCerrarMenu} />
        <NavItem item={LINK_AUDITORIA} onCerrarMenu={onCerrarMenu} />
        <Separador />
        <NavItem item={LINK_REPORTES} onCerrarMenu={onCerrarMenu} />

        {/* Ficha biológica de la especie */}
        {config && bio && (
          <>
            <Separador />
            <button onClick={toggleFicha} className="nav-item w-full justify-between" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <BookOpen size={16} />
                <span className="truncate">Ficha biológica</span>
              </span>
              {fichaVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {fichaVisible && (
              <dl className="mx-1 mt-1 rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: tema.bgRaised, border: `1px solid ${tema.bgCardBorde}` }}>
                {datosBio.map(({ label, valor }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <dt className="text-xs leading-tight" style={{ color: tema.textMuted }}>{label}</dt>
                    <dd className="text-xs font-medium text-right" style={{ color: tema.textPrimary }}>{valor}</dd>
                  </div>
                ))}
                {config.orden && config.orden !== '—' && (
                  <div className="text-xs pt-1.5" style={{ borderTop: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }}>
                    {config.orden}
                  </div>
                )}
              </dl>
            )}
          </>
        )}
        <ReportarError />
      </nav>

      {/* Usuario + tema + cerrar sesión */}
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${tema.lineSoft}` }}>
        <p className="truncate text-sm font-medium" style={{ color: tema.textPrimary }}>{emailUsuario}</p>
        <div className="mt-2 flex items-center gap-3">
          <button onClick={toggleBrillo} className="inline-flex items-center gap-1.5 text-sm" style={{ color: tema.textSecondary }}>
            {modoBrillo ? <Moon size={16} /> : <Sun size={16} />}
            {modoBrillo ? 'Tema oscuro' : 'Tema claro'}
          </button>
          <button onClick={onCerrarSesion} className="ml-auto inline-flex items-center gap-1.5 text-sm" style={{ color: tema.textSecondary }}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </div>
    </aside>
  )
}
