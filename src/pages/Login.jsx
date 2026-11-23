import { useState, useEffect } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { Aviso, Boton, Campo, Entrada } from '../components/ui'
import Marca from '../components/Marca'
import InstalarApp from '../components/InstalarApp'

// Pantalla de ingreso con la composición de ITeRatE ICIVET: después de la intro
// (index.html) se llega directo acá, sin landing. Encabezado con el ícono de la
// marca y el nombre del bioterio, franja con las colonias de ISAL (con el color
// que las identifica en toda la app) y el panel de acceso.
function Encabezado() {
  return (
    <div className="mb-8 flex items-center gap-4">
      <Marca pieza="icono" alto={56} className="shrink-0" />
      <div className="min-w-0">
        <h1 className="font-cond text-3xl font-semibold text-ink">Bioterio ISAL</h1>
        <p className="text-ink-soft">ITeRatE · Gestión de colonias de laboratorio</p>
      </div>
    </div>
  )
}

const COLONIAS = [
  ['ratas',            'Ratas Wistar', 'Rattus norvegicus'],
  ['ratones_balbc',    'BALB/c',       'Mus musculus'],
  ['ratones_c57',      'C57BL/6',      'Mus musculus'],
  ['ratones_hibridos', 'Híbridos F1',  'BALB/c × C57BL/6'],
]

function FranjaColonias() {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {COLONIAS.map(([id, nombre, detalle]) => (
        <li key={id} className="rounded-lg border border-line bg-surface px-3 py-2.5"
          style={{ boxShadow: `inset 0 3px 0 ${BIOTERIOS_CONFIG[id].color}` }}>
          <p className="font-cond font-semibold text-ink">{nombre}</p>
          <p className="text-xs text-ink-soft">{detalle}</p>
        </li>
      ))}
    </ol>
  )
}

function Pantalla({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-3xl">
        <Encabezado />
        <FranjaColonias />
        <div className="mt-8 rounded-xl border border-line bg-surface">{children}</div>
        <InstalarApp />
        <p className="mt-5 text-center text-sm text-ink-faint">¿No podés ingresar? Contactá al administrador.</p>
      </div>
    </div>
  )
}

function CampoPassword({ etiqueta, valor, onChange, placeholder, autoComplete }) {
  const [ver, setVer] = useState(false)
  return (
    <Campo etiqueta={etiqueta}>
      <div className="relative">
        <Entrada
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={onChange}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVer(!ver)}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-soft hover:text-ink"
        >
          {ver ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Campo>
  )
}

// Alta de contraseña al entrar por una invitación. Se usa acá y en App.jsx.
export function CrearPassword({ onCreada }) {
  const { actualizarPassword } = useAuth()
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setError('')
    setCargando(true)
    try {
      await actualizarPassword(pass)
      setListo(true)
      onCreada?.()
    } catch {
      setError('No se pudo guardar la contraseña. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <Pantalla>
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="text-lg font-semibold text-ink">Crear contraseña</h2>
        <p className="text-sm text-ink-soft">Elegí la contraseña con la que vas a ingresar.</p>
      </div>
      {listo ? (
        <div className="px-5 py-6">
          <Aviso tono="ok">Contraseña creada. Ya podés usar el sistema normalmente.</Aviso>
        </div>
      ) : (
        <form onSubmit={guardar} className="space-y-4 px-5 py-5">
          <CampoPassword
            etiqueta="Nueva contraseña"
            valor={pass}
            onChange={(e) => { setPass(e.target.value); setError('') }}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
          {error && <Aviso>{error}</Aviso>}
          <Boton type="submit" variante="primario" cargando={cargando} className="w-full">
            {cargando ? 'Guardando…' : 'Guardar contraseña'}
          </Boton>
        </form>
      )}
    </Pantalla>
  )
}

export default function Login() {
  const { iniciarSesion, sesion } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [cargando, setCargando] = useState(false)
  const [esInvitado, setEsInvitado] = useState(false)

  // Detectar si viene de un link de invitación
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=signup')) {
      setEsInvitado(true)
    }
  }, [])

  async function manejarLogin(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await iniciarSesion(email.trim(), password)
    } catch {
      setError('Email o contraseña incorrectos. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  // Si viene de invitación y ya tiene sesión activa → crear contraseña
  if (esInvitado && sesion) {
    return <CrearPassword onCreada={() => window.history.replaceState(null, '', window.location.pathname)} />
  }

  return (
    <Pantalla>
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="text-lg font-semibold text-ink">Ingresar</h2>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <Lock size={14} /> Acceso solo para personal autorizado del bioterio
        </p>
      </div>
      <form onSubmit={manejarLogin} className="space-y-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Email">
            <Entrada
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </Campo>
          <CampoPassword
            etiqueta="Contraseña"
            valor={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end">
          <Boton type="submit" variante="primario" cargando={cargando} className="w-full sm:w-auto sm:min-w-48">
            {cargando ? 'Verificando…' : 'Ingresar al sistema'}
          </Boton>
        </div>
      </form>
    </Pantalla>
  )
}
