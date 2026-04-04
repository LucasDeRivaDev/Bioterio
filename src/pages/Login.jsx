import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [cargando, setCargando] = useState(false)
  const [verPass, setVerPass]   = useState(false)

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

  const inputStyle = {
    width: '100%',
    background: 'rgba(8,13,26,0.9)',
    border: '1px solid rgba(30,51,82,0.9)',
    color: '#c9d4e0',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,230,118,0.04) 0%, #050810 60%)',
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
            background: 'rgba(13,21,40,0.95)',
            border: '1px solid rgba(0,230,118,0.2)',
            boxShadow: '0 0 60px rgba(0,230,118,0.06), 0 32px 64px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            className="px-8 py-7 text-center"
            style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.03)' }}
          >
            {/* Logo animado */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{
                  background: 'rgba(0,230,118,0.1)',
                  border: '1.5px solid rgba(0,230,118,0.3)',
                  boxShadow: '0 0 24px rgba(0,230,118,0.15)',
                }}
              >
                🧬
              </div>
            </div>

            <h1 className="text-xl font-bold text-white tracking-wide">BIOTERIO</h1>
            <p className="text-xs mt-1 font-mono" style={{ color: 'rgba(0,230,118,0.6)' }}>
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
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
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
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
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
            className="px-8 py-4 text-center"
            style={{ borderTop: '1px solid rgba(30,51,82,0.6)' }}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs" style={{ color: 'rgba(74,95,122,0.6)' }}>
              <span>🐀</span>
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
