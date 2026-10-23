import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import PWAUpdatePrompt from './components/PWAUpdatePrompt'
import { BiotheriumProvider } from './context/BiotheriumContext'
import { BioterioActivoProvider, useBioterioActivo } from './context/BioterioActivoContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import { Loader2, Menu, Moon, Sun } from 'lucide-react'
import SelectorBioterio from './pages/SelectorBioterio'
import ResumenRatones from './pages/ResumenRatones'
import ConsumoAlimento from './pages/ConsumoAlimento'
import ConsumoViruta from './pages/ConsumoViruta'
import CapacidadGlobal from './pages/CapacidadGlobal'
import GenealogiaGlobal from './pages/GenealogiaGlobal'
import ReporteMensual from './pages/ReporteMensual'
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
import Pedidos from './pages/Pedidos'
import Auditoria from './pages/Auditoria'
import Login, { CrearPassword } from './pages/Login'
import Landing from './pages/Landing'

// ── Pantalla de carga mientras verifica la sesión ────────────────────────────
function PantallaCarga() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--canvas)' }}>
      <img src="/apple-touch-icon.png" alt="" width="48" height="48" className="h-12 w-12 rounded-lg" />
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }} role="status">
        <Loader2 size={16} className="animate-spin" />
        Verificando acceso…
      </div>
    </div>
  )
}

// ── Layout principal (solo si hay sesión) ────────────────────────────────────
function AppLayout() {
  const { sesion, cerrarSesion } = useAuth()
  const { bioterioActivo } = useBioterioActivo()
  const { tema } = useTheme()
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

  if (!sesion) return <Navigate to="/login" replace />

  // Sin bioterio activo → mostrar selector
  if (!bioterioActivo) return <SelectorBioterio />

  // Resumen global de ratones → página especial sin sidebar
  if (bioterioActivo === 'resumen_ratones') return <ResumenRatones />

  // Consumo global de alimento → página especial sin sidebar
  if (bioterioActivo === 'alimento_global') return <ConsumoAlimento />

  // Consumo de viruta → página especial sin sidebar
  if (bioterioActivo === 'viruta_global') return <ConsumoViruta />

  // Capacidad y predicción → página especial sin sidebar
  if (bioterioActivo === 'capacidad_global') return <CapacidadGlobal />

  // Genealogía global → página especial sin sidebar
  if (bioterioActivo === 'genealogia_global') return <GenealogiaGlobal />

  // Reporte mensual ejecutivo → página especial sin sidebar
  if (bioterioActivo === 'reporte_mensual') return <ReporteMensual />

  function cerrarSidebar() { setSidebarAbierto(false) }

  return (
    <BiotheriumProvider>
      <div className="flex min-h-screen" style={{ background: tema.bgMain }}>
        <OcultarBotonBrilloEnEscritorio />

        {/* Overlay oscuro en mobile cuando el sidebar está abierto */}
        {sidebarAbierto && (
          <div
            className="fixed inset-0 z-30 md:hidden backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.5)' }}
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
          <TopbarMovil onMenu={() => setSidebarAbierto(true)} />

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
              <Route path="/temperatura"   element={<Temperatura />} />
              <Route path="/estadisticas" element={<Estadisticas />} />
              <Route path="/incidentes"     element={<Incidentes />} />
              <Route path="/planificacion" element={<PlanificacionColonia />} />
              <Route path="/pedidos"       element={<Pedidos />} />
              <Route path="/auditoria"     element={<Auditoria />} />
              <Route path="/reportes"      element={<Reportes />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </BiotheriumProvider>
  )
}

// ── Topbar mobile (compartida con la demo) ──────────────────────────────────
export function TopbarMovil({ onMenu, children }) {
  const { tema } = useTheme()
  return (
    <div
      className="sticky top-0 z-20 flex h-14 items-center gap-2 px-2 md:hidden shrink-0"
      style={{ background: tema.bgTopbar, borderBottom: `1px solid ${tema.bgTopbarBorde}` }}
    >
      <button
        onClick={onMenu}
        aria-label="Abrir menú"
        className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
        style={{ color: tema.textSecondary }}
      >
        <Menu size={20} />
      </button>
      <img src="/apple-touch-icon.png" alt="" width="28" height="28" className="h-7 w-7 rounded" />
      <span className="font-cond font-semibold text-base" style={{ color: tema.textPrimary }}>ITeRatE</span>
      {children}
    </div>
  )
}

// En escritorio el cambio de tema vive en el sidebar; el botón flotante queda para mobile
// y para las pantallas sin sidebar (landing, login, selector, vistas globales).
export function OcultarBotonBrilloEnEscritorio() {
  return <style>{'@media (min-width: 768px) { .boton-brillo-flotante { display: none !important; } }'}</style>
}

// ── Botón de tema flotante ──────────────────────────────────────────────────
export function BotonBrillo() {
  const { modoBrillo, toggleBrillo } = useTheme()
  return (
    <button
      onClick={toggleBrillo}
      aria-label={modoBrillo ? 'Usar tema oscuro' : 'Usar tema claro'}
      title={modoBrillo ? 'Usar tema oscuro' : 'Usar tema claro'}
      className="boton-brillo-flotante no-print fixed bottom-5 right-5 z-[9999] w-10 h-10 rounded-full flex items-center justify-center"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-soft)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
    >
      {modoBrillo ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}

// ── Root del router con manejo de auth ──────────────────────────────────────
function RutaRaiz() {
  const { sesion, cargando, necesitaPassword } = useAuth()

  function renderContenido() {
    if (cargando) return <PantallaCarga />
    if (necesitaPassword && sesion) return <CrearPassword />
    if (!sesion) {
      return (
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )
    }
    return (
      <Routes>
        <Route path="/login"  element={<Navigate to="/" replace />} />
        <Route path="/inicio" element={<Landing />} />
        <Route path="/*"      element={<AppLayout />} />
      </Routes>
    )
  }

  return (
    <>
      {renderContenido()}
      <BotonBrillo />
    </>
  )
}

// ── App principal ────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BioterioActivoProvider>
          <BrowserRouter>
            <RutaRaiz />
          </BrowserRouter>
        </BioterioActivoProvider>
      </AuthProvider>
      <PWAUpdatePrompt />
    </ThemeProvider>
  )
}
