import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BiotheriumProvider } from './context/BiotheriumContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Animales from './pages/Animales'
import Camadas from './pages/Camadas'
import Calendario from './pages/Calendario'
import Rendimiento from './pages/Rendimiento'
import Reportes from './pages/Reportes'
import Stock from './pages/Stock'
import Sacrificios from './pages/Sacrificios'
import Entregas from './pages/Entregas'
import Temperatura from './pages/Temperatura'
import Login from './pages/Login'

// ── Pantalla de carga mientras verifica la sesión ────────────────────────────
function PantallaCarga() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: '#050810' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: 'rgba(0,230,118,0.1)',
          border: '1px solid rgba(0,230,118,0.3)',
          boxShadow: '0 0 20px rgba(0,230,118,0.15)',
        }}
      >
        🧬
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#00e676', borderTopColor: 'transparent' }}
        />
        <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>Verificando acceso...</span>
      </div>
    </div>
  )
}

// ── Pantalla de carga de datos ───────────────────────────────────────────────
function PantallaCargaDatos() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-4"
      style={{ background: '#050810' }}
    >
      <span
        className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: '#00e676', borderTopColor: 'transparent' }}
      />
      <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>Cargando datos de la colonia...</span>
    </div>
  )
}

// ── Layout principal (solo si hay sesión) ────────────────────────────────────
function AppLayout() {
  const { sesion, cerrarSesion } = useAuth()
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  if (!sesion) return <Navigate to="/login" replace />

  function cerrarSidebar() { setSidebarAbierto(false) }

  return (
    <BiotheriumProvider>
      <div className="flex min-h-screen">

        {/* Overlay oscuro en mobile cuando el sidebar está abierto */}
        {sidebarAbierto && (
          <div
            className="fixed inset-0 z-30 md:hidden backdrop-blur-sm"
            style={{ background: 'rgba(5,8,16,0.75)' }}
            onClick={cerrarSidebar}
          />
        )}

        {/* Sidebar — drawer en mobile, estático en desktop */}
        <div
          className={`fixed md:static top-0 left-0 z-40 h-full md:h-auto transition-transform duration-300 ease-in-out ${
            sidebarAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
          style={{ height: '100dvh' }}
        >
          <Sidebar onCerrarSesion={cerrarSesion} onCerrarMenu={cerrarSidebar} />
        </div>

        {/* Contenido principal */}
        <main className="flex-1 overflow-auto min-w-0 flex flex-col">

          {/* Topbar solo en mobile */}
          <div
            className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 md:hidden shrink-0"
            style={{ background: '#050810', borderBottom: '1px solid rgba(0,230,118,0.12)' }}
          >
            <button
              onClick={() => setSidebarAbierto(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}
            >
              ☰
            </button>
            <span className="font-bold text-white text-sm tracking-wide">BIOTERIO</span>
            <div
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono shrink-0"
              style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e676' }} />
              ACTIVO
            </div>
          </div>

          {/* Rutas */}
          <div className="flex-1">
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/animales"    element={<Animales />} />
              <Route path="/camadas"     element={<Camadas />} />
              <Route path="/calendario"  element={<Calendario />} />
              <Route path="/rendimiento" element={<Rendimiento />} />
              <Route path="/stock"       element={<Stock />} />
              <Route path="/sacrificios"  element={<Sacrificios />} />
              <Route path="/entregas"     element={<Entregas />} />
              <Route path="/temperatura"  element={<Temperatura />} />
              <Route path="/reportes"     element={<Reportes />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BiotheriumProvider>
  )
}

// ── Pantalla para crear contraseña (invitación) ─────────────────────────────
function PantallaCrearPassword() {
  const { actualizarPassword } = useAuth()
  const [pass, setPass]         = useState('')
  const [error, setError]       = useState('')
  const [listo, setListo]       = useState(false)
  const [cargando, setCargando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    if (pass.length < 6) { setError('Mínimo 6 caracteres.'); return }
    setCargando(true)
    try {
      await actualizarPassword(pass)
      setListo(true)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#050810' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.95)', border: '1px solid rgba(0,230,118,0.2)', boxShadow: '0 0 60px rgba(0,230,118,0.06)' }}>
        <div className="px-8 py-7 text-center" style={{ borderBottom: '1px solid rgba(0,230,118,0.1)', background: 'rgba(0,230,118,0.03)' }}>
          <div className="text-3xl mb-3">🔑</div>
          <h1 className="text-xl font-bold text-white">Crear contraseña</h1>
          <p className="text-xs mt-1" style={{ color: '#4a5f7a' }}>Elegí una contraseña para tu cuenta</p>
        </div>
        {listo ? (
          <div className="px-8 py-10 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <div className="font-bold text-white">¡Contraseña creada!</div>
            <div className="text-sm" style={{ color: '#4a5f7a' }}>Ya podés usar el sistema normalmente.</div>
          </div>
        ) : (
          <form onSubmit={guardar} className="px-8 py-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>Nueva contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => { setPass(e.target.value); setError('') }}
                placeholder="Mínimo 6 caracteres"
                required
                style={{ width: '100%', background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', outline: 'none' }}
              />
            </div>
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
                ⚠️ {error}
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

// ── Root del router con manejo de auth ──────────────────────────────────────
function RutaRaiz() {
  const { sesion, cargando, necesitaPassword } = useAuth()
  if (cargando) return <PantallaCarga />
  // Si viene de invitación y ya tiene sesión → mostrar pantalla de crear contraseña
  if (necesitaPassword && sesion) return <PantallaCrearPassword />
  return (
    <Routes>
      <Route
        path="/login"
        element={sesion ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  )
}

// ── App principal ────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RutaRaiz />
      </BrowserRouter>
    </AuthProvider>
  )
}
