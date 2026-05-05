import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { EspecieProvider, useEspecie } from './context/EspecieContext'
import { BiotheriumProProvider } from './context/BiotheriumContextPro'
import Sidebar from './components/Sidebar'
import FormularioEspecie from './pages/FormularioEspecie'
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

// ── Layout principal ──────────────────────────────────────────────────────────
function AppLayout() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const { especie } = useEspecie()
  function cerrarSidebar() { setSidebarAbierto(false) }

  return (
    <div className="flex" style={{ minHeight: '100dvh' }}>
      {/* Overlay móvil */}
      {sidebarAbierto && (
        <div
          className="fixed inset-0 z-30 md:hidden backdrop-blur-sm"
          style={{ background: 'rgba(5,8,16,0.75)' }}
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
        <Sidebar onCerrarMenu={cerrarSidebar} />
      </div>

      {/* Contenido */}
      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        {/* Topbar móvil */}
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
          <span className="font-bold text-white text-sm tracking-wide">
            {especie?.icono ?? '🔬'} {especie?.nombre ?? 'BIOTERIO'}
          </span>
          <div
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono shrink-0"
            style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e676' }} />
            PRO
          </div>
        </div>

        {/* Rutas */}
        <div className="flex-1">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/animales"     element={<Animales />} />
            <Route path="/camadas"      element={<Camadas />} />
            <Route path="/calendario"   element={<Calendario />} />
            <Route path="/rendimiento"  element={<Rendimiento />} />
            <Route path="/stock"        element={<Stock />} />
            <Route path="/sacrificios"  element={<Sacrificios />} />
            <Route path="/entregas"     element={<Entregas />} />
            <Route path="/temperatura"  element={<Temperatura />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
            <Route path="/incidentes"   element={<Incidentes />} />
            <Route path="/reportes"     element={<Reportes />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

// ── Root: decide si mostrar el selector de especie o el layout ─────────────────
function ProRoot() {
  const { especie } = useEspecie()

  if (!especie) return <FormularioEspecie />

  return (
    <BiotheriumProProvider>
      <AppLayout />
    </BiotheriumProProvider>
  )
}

// ── Punto de entrada ──────────────────────────────────────────────────────────
export default function AppPro() {
  return (
    <EspecieProvider>
      <BrowserRouter>
        <ProRoot />
      </BrowserRouter>
    </EspecieProvider>
  )
}
