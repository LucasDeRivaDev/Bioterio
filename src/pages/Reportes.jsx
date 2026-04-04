import { useState, useMemo, useRef } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import {
  formatFecha, calcularLatencia, interpretarLatencia,
  calcularDestete, calcularMadurez, difDias, parseDate,
} from '../utils/calculos'

const MESES_NOMBRE = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

// ── Helpers ─────────────────────────────────────────────────────────────────

function dentroDelMes(fechaStr, anio, mes) {
  if (!fechaStr) return false
  const [y, m] = fechaStr.split('-').map(Number)
  return y === anio && m === mes + 1
}

function dentroDelAnio(fechaStr, anio) {
  if (!fechaStr) return false
  return parseInt(fechaStr.split('-')[0]) === anio
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function Reportes() {
  const { animales, camadas } = useBioterio()
  const hoy = new Date()

  const [anio, setAnio]       = useState(hoy.getFullYear())
  const [mes, setMes]         = useState(hoy.getMonth())
  const [modo, setModo]       = useState('mensual')   // 'mensual' | 'personalizado'
  const [secciones, setSecciones] = useState({
    resumen: true,
    animales: true,
    camadas: true,
    latencias: true,
    tareas: true,
  })
  // Filtros personalizados
  const [filtSexo, setFiltSexo]     = useState('todos')
  const [filtEstado, setFiltEstado] = useState('todos')
  const [filtCEstado, setFiltCEstado] = useState('todas')

  const printRef = useRef()

  // ── Datos filtrados para el reporte ────────────────────────────────────────

  const datosReporte = useMemo(() => {
    // Animales del reporte
    let aniReporte = animales
    if (modo === 'personalizado') {
      if (filtSexo !== 'todos') aniReporte = aniReporte.filter((a) => a.sexo === filtSexo)
      if (filtEstado !== 'todos') aniReporte = aniReporte.filter((a) => a.estado === filtEstado)
    }

    // Camadas del periodo
    let camReporte = camadas
    if (modo === 'mensual') {
      camReporte = camadas.filter((c) =>
        dentroDelMes(c.fecha_copula, anio, mes) ||
        dentroDelMes(c.fecha_nacimiento, anio, mes) ||
        dentroDelMes(c.fecha_destete, anio, mes)
      )
    } else {
      if (filtCEstado !== 'todas') {
        camReporte = camadas.filter((c) => {
          if (filtCEstado === 'preñez') return c.fecha_copula && !c.fecha_nacimiento
          if (filtCEstado === 'lactancia') return c.fecha_nacimiento && !c.fecha_destete
          if (filtCEstado === 'completada') return !!c.fecha_destete
          return true
        })
      }
    }

    // Enriquecer camadas
    const camEnriq = camReporte.map((c) => {
      const madre = animales.find((a) => a.id === c.id_madre)
      const padre = animales.find((a) => a.id === c.id_padre)
      const lat = calcularLatencia(c)
      const destEst = c.fecha_nacimiento ? calcularDestete(c.fecha_nacimiento) : null
      const madEst = c.fecha_nacimiento ? calcularMadurez(c.fecha_nacimiento) : null
      let estado = 'preñez'
      if (c.fecha_destete) estado = 'completada'
      else if (c.fecha_nacimiento) estado = 'lactancia'
      return { ...c, madre, padre, lat, destEst, madEst, estado }
    })

    // Estadísticas resumen
    const totalCrias = camEnriq.reduce((s, c) => s + (c.total_crias ?? 0), 0)
    const totalDestetados = camEnriq.reduce((s, c) => s + (c.total_destetados ?? 0), 0)
    const latsValidas = camEnriq.map((c) => c.lat).filter((l) => l !== null)
    const latProm = latsValidas.length
      ? Math.round(latsValidas.reduce((a, b) => a + b, 0) / latsValidas.length * 10) / 10
      : null

    // Ranking machos para el periodo
    const machoStats = animales
      .filter((a) => a.sexo === 'macho')
      .map((m) => {
        const sus = camEnriq.filter((c) => c.id_padre === m.id && c.lat !== null)
        if (!sus.length) return null
        const lats = sus.map((c) => c.lat)
        return {
          codigo: m.codigo,
          camadas: sus.length,
          prom: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length * 10) / 10,
          min: Math.min(...lats),
          max: Math.max(...lats),
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.prom - b.prom)

    return { aniReporte, camEnriq, totalCrias, totalDestetados, latProm, machoStats }
  }, [animales, camadas, anio, mes, modo, filtSexo, filtEstado, filtCEstado])

  // ── Imprimir ────────────────────────────────────────────────────────────────

  function imprimir() {
    window.print()
  }

  const tituloReporte = modo === 'mensual'
    ? `Reporte mensual — ${MESES_NOMBRE[mes]} ${anio}`
    : 'Reporte personalizado'

  const { aniReporte, camEnriq, totalCrias, totalDestetados, latProm, machoStats } = datosReporte

  // ── UI de configuración (no se imprime) ────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#050810' }}>

      {/* ── Panel de configuración (no se imprime) ─────── */}
      <div className="no-print p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
            <div>
              <h1 className="text-xl font-bold text-white">Reportes e impresión</h1>
              <p className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                Generá reportes para imprimir o guardar
              </p>
            </div>
          </div>
          <button
            onClick={imprimir}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'rgba(0,230,118,0.15)',
              border: '1.5px solid rgba(0,230,118,0.4)',
              color: '#00e676',
              boxShadow: '0 0 20px rgba(0,230,118,0.1)',
            }}
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>

        {/* Tipo de reporte */}
        <div className="flex gap-3">
          {[
            { val: 'mensual', label: '📅 Reporte mensual', sub: 'Todos los datos del mes seleccionado' },
            { val: 'personalizado', label: '🔧 Personalizado', sub: 'Elegí qué incluir manualmente' },
          ].map(({ val, label, sub }) => (
            <button
              key={val}
              onClick={() => setModo(val)}
              className="flex-1 p-4 rounded-xl text-left transition-all"
              style={
                modo === val
                  ? { background: 'rgba(0,230,118,0.1)', border: '1.5px solid rgba(0,230,118,0.35)', color: '#00e676' }
                  : { ...cardStyle, color: '#4a5f7a' }
              }
            >
              <div className="font-semibold text-sm">{label}</div>
              <div className="text-xs mt-0.5 opacity-70">{sub}</div>
            </button>
          ))}
        </div>

        {/* Config mensual */}
        {modo === 'mensual' && (
          <div className="flex gap-3 p-4 rounded-xl" style={cardStyle}>
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#4a5f7a' }}>Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="px-3 py-2 text-sm focus:outline-none rounded-xl"
                style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }}
              >
                {MESES_NOMBRE.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#4a5f7a' }}>Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="px-3 py-2 text-sm focus:outline-none rounded-xl w-28 font-mono"
                style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }}
              />
            </div>
            <div className="ml-auto flex flex-col justify-end">
              <div
                className="px-4 py-2 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.15)', color: '#00e676' }}
              >
                {camEnriq.length} camadas · {aniReporte.length} animales
              </div>
            </div>
          </div>
        )}

        {/* Config personalizado */}
        {modo === 'personalizado' && (
          <div className="p-4 rounded-xl space-y-4" style={cardStyle}>
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
              Filtros de animales
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>Sexo</label>
                <select value={filtSexo} onChange={(e) => setFiltSexo(e.target.value)}
                  className="px-3 py-1.5 text-sm focus:outline-none rounded-lg"
                  style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }}>
                  <option value="todos">Todos</option>
                  <option value="hembra">Hembras</option>
                  <option value="macho">Machos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>Estado animal</label>
                <select value={filtEstado} onChange={(e) => setFiltEstado(e.target.value)}
                  className="px-3 py-1.5 text-sm focus:outline-none rounded-lg"
                  style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }}>
                  <option value="todos">Todos</option>
                  <option value="activo">Activos</option>
                  <option value="en_cria">En cría</option>
                  <option value="retirado">Retirados</option>
                  <option value="fallecido">Fallecidos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>Estado camada</label>
                <select value={filtCEstado} onChange={(e) => setFiltCEstado(e.target.value)}
                  className="px-3 py-1.5 text-sm focus:outline-none rounded-lg"
                  style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }}>
                  <option value="todas">Todas</option>
                  <option value="preñez">En preñez</option>
                  <option value="lactancia">Lactancia</option>
                  <option value="completada">Completadas</option>
                </select>
              </div>
            </div>

            {/* Secciones a incluir */}
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
              Secciones a incluir
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'resumen', label: 'Resumen' },
                { key: 'animales', label: 'Lista de animales' },
                { key: 'camadas', label: 'Camadas' },
                { key: 'latencias', label: 'Rendimiento machos' },
                { key: 'tareas', label: 'Observaciones' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSecciones((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={
                    secciones[key]
                      ? { background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }
                      : { background: 'rgba(30,51,82,0.3)', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
                  }
                >
                  {secciones[key] ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vista previa del reporte */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(0,230,118,0.04)', border: '1px dashed rgba(0,230,118,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: '#00e676' }}>👁</span>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
              Vista previa del reporte
            </span>
          </div>
          <div className="space-y-1 text-xs font-mono" style={{ color: '#4a5f7a' }}>
            <div>📄 {tituloReporte}</div>
            <div>🐀 {aniReporte.length} animales</div>
            <div>🪺 {camEnriq.length} camadas</div>
            <div>👶 {totalCrias} crías registradas</div>
            {latProm !== null && <div>⏱ Latencia promedio: {latProm} días</div>}
          </div>
        </div>

        <div className="text-xs" style={{ color: '#4a5f7a' }}>
          💡 Al hacer clic en <strong style={{ color: '#00e676' }}>Imprimir / Guardar PDF</strong>, el navegador abre el diálogo de impresión.
          Podés elegir "Guardar como PDF" para tener un archivo digital.
        </div>
      </div>

      {/* ── ÁREA DE IMPRESIÓN (siempre renderizada, visible en print) ──────── */}
      <div ref={printRef} className="print-area" style={{ display: 'none' }}>
        <ReporteImprimible
          titulo={tituloReporte}
          animales={aniReporte}
          camadas={camEnriq}
          machoStats={machoStats}
          totalCrias={totalCrias}
          totalDestetados={totalDestetados}
          latProm={latProm}
          secciones={modo === 'mensual' ? { resumen:true, animales:true, camadas:true, latencias:true, tareas:true } : secciones}
          modo={modo}
          mes={mes}
          anio={anio}
        />
      </div>

      {/* Este div SÍ se imprime, el de arriba no */}
      <style>{`
        @media print {
          .print-area { display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <ReporteImprimible
        titulo={tituloReporte}
        animales={aniReporte}
        camadas={camEnriq}
        machoStats={machoStats}
        totalCrias={totalCrias}
        totalDestetados={totalDestetados}
        latProm={latProm}
        secciones={modo === 'mensual' ? { resumen:true, animales:true, camadas:true, latencias:true, tareas:true } : secciones}
        modo={modo}
        mes={mes}
        anio={anio}
        soloImpresion
      />
    </div>
  )
}

// ── Componente del reporte (se renderiza invisible y se muestra al imprimir) ──

function ReporteImprimible({ titulo, animales, camadas, machoStats, totalCrias, totalDestetados, latProm, secciones, modo, mes, anio, soloImpresion }) {
  const fechaGeneracion = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const labelEstado = { activo:'Activo', en_cria:'En cría', retirado:'Retirado', fallecido:'Fallecido' }
  const labelCamada = { preñez:'En preñez', lactancia:'Lactancia', completada:'Completada' }

  const hembras = animales.filter((a) => a.sexo === 'hembra')
  const machos  = animales.filter((a) => a.sexo === 'macho')

  return (
    <div
      className={soloImpresion ? 'print-area' : ''}
      style={soloImpresion ? { display: 'none' } : {}}
    >
      {/* Encabezado del reporte */}
      <div className="print-header">
        <h1>🐀 BIOTERIO — {titulo.toUpperCase()}</h1>
        <p>Generado: {fechaGeneracion} · Sistema de Gestión de Colonia</p>
      </div>

      {/* Resumen estadístico */}
      {secciones.resumen && (
        <div className="print-section">
          <h2>Resumen del periodo</h2>
          <div className="print-stat-grid">
            <div className="print-stat-box">
              <div className="val">{animales.length}</div>
              <div className="lbl">Animales</div>
            </div>
            <div className="print-stat-box">
              <div className="val">{camadas.length}</div>
              <div className="lbl">Camadas</div>
            </div>
            <div className="print-stat-box">
              <div className="val">{totalCrias}</div>
              <div className="lbl">Crías registradas</div>
            </div>
            <div className="print-stat-box">
              <div className="val">{latProm !== null ? `${latProm}d` : '—'}</div>
              <div className="lbl">Latencia promedio</div>
            </div>
          </div>
          <table className="print-table">
            <tbody>
              <tr>
                <td><strong>Hembras:</strong> {hembras.length}</td>
                <td><strong>Machos:</strong> {machos.length}</td>
                <td><strong>Preñeces activas:</strong> {camadas.filter((c) => c.estado === 'preñez').length}</td>
                <td><strong>Destetados:</strong> {totalDestetados}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Lista de animales */}
      {secciones.animales && animales.length > 0 && (
        <div className="print-section">
          <h2>Registro de animales ({animales.length})</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Sexo</th>
                <th>Nacimiento</th>
                <th>Madre</th>
                <th>Padre</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {animales.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.codigo}</strong></td>
                  <td>{a.sexo === 'hembra' ? '♀ Hembra' : '♂ Macho'}</td>
                  <td>{formatFecha(a.fecha_nacimiento)}</td>
                  <td>{a.id_madre ? (animales.find((x) => x.id === a.id_madre)?.codigo ?? '?') : '—'}</td>
                  <td>{a.id_padre ? (animales.find((x) => x.id === a.id_padre)?.codigo ?? '?') : '—'}</td>
                  <td>{labelEstado[a.estado] ?? a.estado}</td>
                  <td>{a.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Camadas */}
      {secciones.camadas && camadas.length > 0 && (
        <div className="print-section">
          <h2>Registro de camadas ({camadas.length})</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Madre</th>
                <th>Padre</th>
                <th>Cópula</th>
                <th>Nacimiento</th>
                <th>Crías</th>
                <th>♂</th>
                <th>♀</th>
                <th>Destetados</th>
                <th>Destete</th>
                <th>Latencia</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {camadas.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.madre?.codigo ?? '?'}</strong></td>
                  <td>{c.padre?.codigo ?? '?'}</td>
                  <td>{formatFecha(c.fecha_copula)}</td>
                  <td>{c.fecha_nacimiento ? formatFecha(c.fecha_nacimiento) : 'Pendiente'}</td>
                  <td>{c.total_crias ?? '—'}</td>
                  <td>{c.crias_machos ?? '—'}</td>
                  <td>{c.crias_hembras ?? '—'}</td>
                  <td>{c.total_destetados ?? '—'}</td>
                  <td>{c.fecha_destete ? formatFecha(c.fecha_destete) : (c.destEst ? `Est. ${formatFecha(c.destEst)}` : '—')}</td>
                  <td>{c.lat !== null ? `${c.lat}d` : '—'}</td>
                  <td>{labelCamada[c.estado] ?? c.estado}</td>
                  <td>{c.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rendimiento machos */}
      {secciones.latencias && machoStats.length > 0 && (
        <div className="print-section">
          <h2>Rendimiento de machos</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Código</th>
                <th>Camadas</th>
                <th>Lat. promedio</th>
                <th>Lat. mínima</th>
                <th>Lat. máxima</th>
                <th>Calificación</th>
              </tr>
            </thead>
            <tbody>
              {machoStats.map((m, i) => {
                const score = Math.max(0, 10 - m.prom)
                const cal = score >= 8 ? 'Excelente' : score >= 6 ? 'Bueno' : score >= 4 ? 'Regular' : 'Lento'
                return (
                  <tr key={m.codigo}>
                    <td>#{i + 1}</td>
                    <td><strong>{m.codigo}</strong></td>
                    <td>{m.camadas}</td>
                    <td>{m.prom}d</td>
                    <td>{m.min}d</td>
                    <td>{m.max}d</td>
                    <td>{cal}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ fontSize: '8pt', color: '#666', marginTop: '4pt' }}>
            * Latencia = días desde cópula hasta concepción estimada (nac. − 23d). Menor = mejor.
          </p>
        </div>
      )}

      {/* Sección de observaciones */}
      {secciones.tareas && (
        <div className="print-section">
          <h2>Observaciones y notas del periodo</h2>
          {camadas.filter((c) => c.notas).length === 0 ? (
            <p style={{ color: '#666', fontSize: '10pt' }}>Sin observaciones registradas para este periodo.</p>
          ) : (
            <table className="print-table">
              <thead>
                <tr><th>Pareja</th><th>Observaciones</th></tr>
              </thead>
              <tbody>
                {camadas.filter((c) => c.notas).map((c) => (
                  <tr key={c.id}>
                    <td>{c.madre?.codigo ?? '?'} × {c.padre?.codigo ?? '?'}</td>
                    <td>{c.notas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Espacio para anotaciones manuales */}
          <div style={{ marginTop: '12pt' }}>
            <strong style={{ fontSize: '10pt' }}>Anotaciones adicionales:</strong>
            <div style={{
              marginTop: '6pt', border: '1px solid #ccc', minHeight: '60pt',
              padding: '6pt', fontSize: '10pt', color: '#aaa',
            }}>
              &nbsp;
            </div>
          </div>
        </div>
      )}

      {/* Footer del reporte */}
      <div className="print-footer">
        <strong>BIOTERIO — Sistema de Gestión de Colonia</strong> · {fechaGeneracion}<br />
        Mus musculus (Ratón doméstico) · Este documento es de uso interno del laboratorio.
      </div>
    </div>
  )
}
