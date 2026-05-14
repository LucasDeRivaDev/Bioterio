import { useState, useEffect } from 'react'
import iterateIconOnly from '../assets/iterate_icon_only.jpg'
import iterateTextLogo from '../assets/iterate_text_logo.png'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Login() {
  const { iniciarSesion, actualizarPassword, sesion } = useAuth()
  const { tema } = useTheme()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [cargando, setCargando] = useState(false)
  const [verPass, setVerPass]   = useState(false)
  const [esInvitado, setEsInvitado] = useState(false)
  const [passNuevo, setPassNuevo]   = useState('')
  const [passOk, setPassOk]         = useState(false)

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
    } catch (err) {
      setError('Email o contraseña incorrectos. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function manejarCrearPassword(e) {
    e.preventDefault()
    if (passNuevo.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setError('')
    setCargando(true)
    try {
      await actualizarPassword(passNuevo)
      setPassOk(true)
      // Limpiar el hash de la URL
      window.history.replaceState(null, '', window.location.pathname)
    } catch (err) {
      setError('No se pudo guardar la contraseña. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: tema.bgCard,
    border: `1px solid ${tema.bgCardBorde}`,
    color: tema.textPrimary,
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  }

  // Si viene de invitación y ya tiene sesión activa → mostrar formulario de crear contraseña
  if (esInvitado && sesion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#050810', backgroundImage: 'linear-gradient(rgba(0,230,118,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.95)', border: '1px solid rgba(0,230,118,0.2)', boxShadow: '0 0 60px rgba(0,230,118,0.06)' }}>
          <div className="px-8 py-7 text-center" style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.03)' }}>
            <div className="text-3xl mb-3">🔑</div>
            <h1 className="text-xl font-bold text-white">Crear contraseña</h1>
            <p className="text-xs mt-1" style={{ color: '#4a5f7a' }}>Elegí una contraseña para tu cuenta</p>
          </div>
          {passOk ? (
            <div className="px-8 py-10 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <div className="font-bold text-white">¡Contraseña creada!</div>
              <div className="text-sm" style={{ color: '#4a5f7a' }}>Ya podés usar el sistema normalmente.</div>
            </div>
          ) : (
            <form onSubmit={manejarCrearPassword} className="px-8 py-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Nueva contraseña</label>
                <input
                  type={verPass ? 'text' : 'password'}
                  value={passNuevo}
                  onChange={(e) => { setPassNuevo(e.target.value); setError('') }}
                  placeholder="Mínimo 6 caracteres"
                  required
                  style={{ width: '100%', background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', outline: 'none' }}
                />
              </div>
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
                  <span>⚠️</span> {error}
                </div>
              )}
              <button type="submit" disabled={cargando} className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.4)', color: '#00e676', cursor: cargando ? 'not-allowed' : 'pointer' }}>
                {cargando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: tema.bgMain,
        backgroundImage: tema.bgMainGrad,
        backgroundSize: '40px 40px',
      }}
    >
      {/* Patrón de puntos de fondo */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(30,51,82,0.6) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card principal */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: tema.bgCard,
            border: `1px solid ${tema.greenBorde}`,
            boxShadow: '0 0 60px rgba(0,180,100,0.06), 0 32px 64px rgba(0,0,0,0.15)',
          }}
        >
          {/* Header */}
          <div
            className="px-8 py-7 text-center"
            style={{ borderBottom: `1px solid ${tema.greenBorde}`, background: tema.greenDim }}
          >
            {/* Logo */}
            <style>{`
              @keyframes floatLogin { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
              @media (max-width: 480px) { .login-logo-img { height: 130px !important; } }
            `}</style>
            <div className="flex justify-center mb-4">
              <div style={{
                borderRadius: '24px',
                border: '1.5px solid rgba(0,230,118,0.2)',
                boxShadow: '0 0 60px rgba(0,230,118,0.18), 0 8px 40px rgba(0,0,0,0.5)',
                animation: 'floatLogin 4s ease-in-out infinite',
                overflow: 'hidden',
                display: 'inline-flex',
              }}>
                <img
                  src={iterateIconOnly}
                  alt="ITeRatE"
                  className="login-logo-img"
                  style={{
                    height: '200px',
                    width: 'auto',
                    display: 'block',
                    marginTop: '-30px',
                  }}
                />
              </div>
            </div>

            <h1 className="text-xl font-bold tracking-wide" style={{ color: tema.textPrimary }}>BIOTERIO</h1>
            <p className="text-xs mt-1 font-mono" style={{ color: tema.green, opacity: 0.8 }}>
              Sistema de Gestión de Colonia
            </p>

            {/* Indicador de acceso restringido */}
            <div
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}
            >
              🔒 Acceso restringido
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={manejarLogin} className="px-8 py-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="tu@email.com"
                required
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tema.textMuted }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={verPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle, paddingRight: '48px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVerPass(!verPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: '#4a5f7a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  {verPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}
              >
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all mt-2"
              style={
                cargando
                  ? { background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', color: '#4a5f7a', cursor: 'not-allowed' }
                  : {
                      background: 'rgba(0,230,118,0.15)',
                      border: '1.5px solid rgba(0,230,118,0.4)',
                      color: '#00e676',
                      boxShadow: '0 0 20px rgba(0,230,118,0.1)',
                      cursor: 'pointer',
                    }
              }
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                'Ingresar al sistema'
              )}
            </button>
          </form>

          {/* Footer */}
          <div
            className="px-8 py-5 text-center"
            style={{ borderTop: `1px solid ${tema.bgCardBorde}` }}
          >
            <img
              src={iterateTextLogo}
              alt="ITeRatE"
              style={{ width: '160px', maxWidth: '100%', height: 'auto', margin: '0 auto 8px', display: 'block', opacity: 0.6, filter: 'drop-shadow(0 0 8px rgba(0,230,118,0.15))' }}
            />
            <div className="flex items-center justify-center gap-1.5 text-xs" style={{ color: 'rgba(74,95,122,0.5)' }}>
              <span className="font-mono italic">Mus musculus · Ratón doméstico</span>
            </div>
          </div>
        </div>

        {/* Texto de ayuda */}
        <p className="text-center text-xs mt-5" style={{ color: 'rgba(74,95,122,0.5)' }}>
          Solo el personal autorizado puede acceder.<br />
          Contactá al administrador si no podés ingresar.
        </p>
      </div>
    </div>
  )
}
