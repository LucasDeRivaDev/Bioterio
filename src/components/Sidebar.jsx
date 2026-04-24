import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useBioterio } from '../context/BiotheriumContext'
import { useAuth } from '../context/AuthContext'
import { BIO } from '../utils/constants'
import { Home, LayoutDashboard, Printer, Bug, Send, LogOut, ChevronUp, ChevronDown, Dna } from 'lucide-react'
import GenERatsBrand from './GenERatsBrand'

const links = [
  { to: '/inicio',   label: 'Inicio',              icon: <Home size={15} /> },
  { to: '/',         label: 'Panel de hoy',         icon: <LayoutDashboard size={15} /> },
  { to: '/reportes', label: 'Reportes e impresión', icon: <Printer size={15} /> },
]

const datosBio = [
  { label: 'Gestación',           valor: `${BIO.GESTACION_DIAS} días` },
  { label: 'Destete',             valor: `${BIO.DESTETE_DIAS} días post-nacimiento` },
  { label: 'Madurez sexual',      valor: `${BIO.MADUREZ_DIAS / 7} semanas` },
  { label: 'Ciclo estral',        valor: `~${BIO.CICLO_ESTRAL_DIAS} días` },
  { label: 'Camada promedio',     valor: '8–12 crías' },
  { label: 'Vida reproductiva',   valor: '~14 meses' },
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
  const { animales, camadas } = useBioterio()
  const { sesion } = useAuth()
  const emailUsuario = sesion?.user?.email ?? ''

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
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(0,230,118,0.1)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(0,230,118,0.1)',
              border: '1px solid rgba(0,230,118,0.3)',
              boxShadow: '0 0 12px rgba(0,230,118,0.15)',
            }}
          >
            <Dna size={22} style={{ color: '#00e676' }} />
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-wide">BIOTERIO</div>
            <div className="text-xs mt-0.5 font-mono" style={{ color: 'rgba(0,230,118,0.7)' }}>
              v1.0 · ACTIVO
            </div>
          </div>
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

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onCerrarMenu}
            style={({ isActive }) =>
              isActive
                ? {
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '10px',
                    background: 'rgba(0,230,118,0.12)',
                    color: '#00e676',
                    border: '1px solid rgba(0,230,118,0.25)',
                    boxShadow: '0 0 12px rgba(0,230,118,0.1)',
                    fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                  }
                : {
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '10px',
                    color: '#8a9bb0',
                    border: '1px solid transparent',
                    fontSize: '13px', fontWeight: 500, textDecoration: 'none',
                  }
            }
          >
            <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── FICHA BIOLÓGICA DE LA ESPECIE ── */}
      <div className="mx-3 mb-3 rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(161,120,80,0.3)', background: 'rgba(161,120,80,0.05)' }}
      >
        {/* Encabezado */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ background: 'rgba(161,120,80,0.1)', borderBottom: '1px solid rgba(161,120,80,0.2)' }}
        >
          <span className="text-xl">🐀</span>
          <div>
            <div className="font-bold text-sm" style={{ color: '#c9a87a' }}>Ratón doméstico</div>
            <div className="text-xs font-mono italic opacity-60" style={{ color: '#a17850' }}>Mus musculus</div>
          </div>
        </div>

        {/* Datos biológicos */}
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

        {/* Footer especie */}
        <div
          className="px-4 py-2 text-xs text-center font-mono"
          style={{ borderTop: '1px solid rgba(161,120,80,0.15)', color: 'rgba(107,124,148,0.5)' }}
        >
          Orden Rodentia · Fam. Muridae
        </div>
      </div>

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
          padding: '14px 0 18px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <GenERatsBrand
          iconSize={88}
          nameSize={50}
          sloganSize={18}
          sublineSize={0}
          gap={14}
          align="left"
          showSubline={false}
          iconPrefix="sidebarFooterBrand"
          style={{ width: 'auto', transform: 'translateX(4%)' }}
        />
      </div>
    </aside>
  )
}
