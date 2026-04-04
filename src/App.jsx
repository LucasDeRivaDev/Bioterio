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

  if (!sesion) return <Navigate to="/login" replace />

  return (
    <BiotheriumProvider>
      <div className="flex min-h-screen">
        <Sidebar onCerrarSesion={cerrarSesion} />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/animales"   element={<Animales />} />
            <Route path="/camadas"    element={<Camadas />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/rendimiento" element={<Rendimiento />} />
            <Route path="/reportes"   element={<Reportes />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BiotheriumProvider>
  )
}

// ── Root del router con manejo de auth ──────────────────────────────────────
function RutaRaiz() {
  const { sesion, cargando } = useAuth()
  if (cargando) return <PantallaCarga />
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
