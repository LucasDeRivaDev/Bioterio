import { useState, useEffect } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Aviso, Boton, Campo, Entrada, Panel } from '../components/ui'
import Marca from '../components/Marca'

// Logo completo de la marca (antena + nombre + eslogan) sobre el formulario.
function Encabezado({ subtitulo }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <Marca pieza="completo" alto={190} />
      <p className="mt-3 text-sm text-ink-soft">{subtitulo}</p>
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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Encabezado subtitulo="Activá tu cuenta" />
        <Panel>
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
        </Panel>
      </div>
    </div>
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
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Encabezado subtitulo="Gestión de colonias de laboratorio" />
        <Panel>
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">Ingresar</h2>
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <Lock size={14} /> Acceso solo para personal autorizado
            </p>
          </div>
          <form onSubmit={manejarLogin} className="space-y-4 px-5 py-5">
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
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" variante="primario" cargando={cargando} className="w-full">
              {cargando ? 'Verificando…' : 'Ingresar al sistema'}
            </Boton>
          </form>
        </Panel>
        <p className="mt-5 text-center text-sm text-ink-faint">
          ¿No podés ingresar? Contactá al administrador.
        </p>
      </div>
    </div>
  )
}
