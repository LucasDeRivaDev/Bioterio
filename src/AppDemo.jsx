import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { BioterioActivoProvider, useBioterioActivo } from './context/BioterioActivoContext'
import { BiotheriumDemoProvider } from './context/BiotheriumContextDemo'
import { useBioterio } from './context/BiotheriumContextDemo'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { BotonBrillo, TopbarMovil, OcultarBotonBrilloEnEscritorio } from './App'
import Sidebar from './components/Sidebar'
import SelectorBioterio from './pages/SelectorBioterio'
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
import Estadisticas from './pages/Estadisticas'
import Incidentes from './pages/Incidentes'
import PlanificacionColonia from './pages/PlanificacionColonia'

// ── Banner de demo ────────────────────────────────────────────────────────────
function BannerDemo() {
  const { resetearDemo } = useBioterio()
  const [confirmando, setConfirmando] = useState(false)

  function handleReset() {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    resetearDemo()
    setConfirmando(false)
  }

  return (
    <div
      style={{
        background: '#f59e0b',
        color: '#1a1200',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '6px 16px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <span>MODO DEMO — Los datos son de ejemplo. No es tu colonia real.</span>
      <button
        onClick={handleReset}
        style={{
          background: confirmando ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.15)',
          border: '1px solid rgba(0,0,0,0.3)',
          borderRadius: '6px',
          color: '#1a1200',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: '11px',
          padding: '3px 10px',
          letterSpacing: '0.02em',
        }}
      >
        {confirmando ? '¿Seguro? Hacé clic de nuevo' : 'Resetear datos'}
      </button>
      {confirmando && (
        <button
          onClick={() => setConfirmando(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1a1200',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '11px',
            textDecoration: 'underline',
          }}
        >
          Cancelar
        </button>
      )}
    </div>
  )
}

// ── Layout principal de la demo ───────────────────────────────────────────────
function DemoAppLayout() {
  const { tema } = useTheme()
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  function cerrarSidebar() { setSidebarAbierto(false) }

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: tema.bgMain }}>
      <OcultarBotonBrilloEnEscritorio />
      {/* Banner siempre visible arriba */}
      <BannerDemo />

      <div className="flex flex-1 min-h-0">
        {/* Overlay oscuro en mobile */}
        {sidebarAbierto && (
          <div
            className="fixed inset-0 z-30 md:hidden backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={cerrarSidebar}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed md:static top-0 left-0 z-40 h-full md:h-auto transition-transform duration-300 ease-in-out ${
            sidebarAbierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
          style={{ height: '100dvh' }}
        >
          <Sidebar onCerrarSesion={() => {}} onCerrarMenu={cerrarSidebar} />
        </div>

        {/* Contenido */}
        <main className="flex-1 overflow-auto min-w-0 flex flex-col">
          {/* Topbar mobile */}
          <TopbarMovil onMenu={() => setSidebarAbierto(true)}>
            <span className="ml-auto mr-2 rounded-md border border-dashed px-2 py-0.5 text-xs" style={{ borderColor: tema.bgCardBorde, color: tema.textSecondary }}>
              Demo
            </span>
          </TopbarMovil>

          {/* Rutas — idénticas al App original */}
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
              <Route path="/temperatura"   element={<Temperatura />} />
              <Route path="/estadisticas" element={<Estadisticas />} />
              <Route path="/incidentes"   element={<Incidentes />} />
              <Route path="/planificacion" element={<PlanificacionColonia />} />
              <Route path="/reportes"     element={<Reportes />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Wrapper que decide si mostrar selector o layout ───────────────────────────
function DemoRoot() {
  const { bioterioActivo } = useBioterioActivo()

  return (
    <>
      {!bioterioActivo ? (
        <SelectorBioterio />
      ) : (
        <BiotheriumDemoProvider>
          <DemoAppLayout />
        </BiotheriumDemoProvider>
      )}
      <BotonBrillo />
    </>
  )
}

// ── App de demo (punto de entrada) ────────────────────────────────────────────
export default function AppDemo() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BioterioActivoProvider>
          <BrowserRouter>
            <DemoRoot />
          </BrowserRouter>
        </BioterioActivoProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
