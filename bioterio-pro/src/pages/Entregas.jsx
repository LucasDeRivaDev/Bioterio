import { useMemo, useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha } from '../utils/calculos'

export default function Entregas() {
  const { entregas, camadas, animales, devolverEntrega } = useBioterio()
  const [busqueda, setBusqueda] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(null)   // id de la entrega con menú visible
  const [cargando, setCargando] = useState(null)          // id de la entrega en proceso

  const lista = useMemo(() => {
    return [...entregas]
      .sort((a, b) => (b.fecha ?? b.created_at ?? '').localeCompare(a.fecha ?? a.created_at ?? ''))
      .filter((e) => {
        if (!busqueda) return true
        const q = busqueda.toLowerCase()
        const obs = (e.observaciones ?? '').toLowerCase()
        const camada = camadas.find((c) => c.id === e.camada_id)
        const madre = camada ? animales.find((a) => a.id === camada.id_madre) : null
        const padre = camada ? animales.find((a) => a.id === camada.id_padre) : null
        return (
          obs.includes(q) ||
          (madre?.codigo ?? '').toLowerCase().includes(q) ||
          (padre?.codigo ?? '').toLowerCase().includes(q) ||
          (e.fecha ?? '').includes(q)
        )
      })
  }, [entregas, camadas, animales, busqueda])

  const totalAnimales = entregas.reduce((s, e) => s + (e.cantidad ?? 0), 0)

  async function handleDevolver(entrega, mantenerHistorial) {
    setCargando(entrega.id)
    setMenuAbierto(null)
    try {
      await devolverEntrega(entrega, mantenerHistorial)
    } finally {
      setCargando(null)
    }
  }

  const iStyle = {
    background: 'rgba(5,8,16,0.6)', border: '1px solid rgba(30,51,82,0.8)',
    color: '#e2e8f0', borderRadius: '0.6rem', padding: '0.45rem 0.75rem',
    fontSize: '0.8125rem', outline: 'none', width: '100%',
  }

  return (
    <div
      className="p-4 md:p-6 space-y-5 min-h-screen"
      style={{ background: '#050810' }}
      onClick={() => setMenuAbierto(null)}
    >

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full" style={{ background: '#ffb300', boxShadow: '0 0 8px rgba(255,179,0,0.5)' }} />
        <h1 className="text-xl font-bold text-white">Entregas</h1>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Total entregas',          val: entregas.length,  color: '#ffb300' },
          { label: 'Animales entregados',      val: totalAnimales,    color: '#00e676' },
          { label: 'Último mes',               val: entregas.filter((e) => {
            if (!e.fecha) return false
            const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)
            return new Date(e.fecha + 'T12:00:00') >= hace30
          }).reduce((s, e) => s + (e.cantidad ?? 0), 0), color: '#40c4ff' },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-xl px-4 py-3 text-center"
            style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <div className="font-mono font-bold text-2xl" style={{ color }}>{val}</div>
            <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar por observaciones, código de animal, fecha..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={iStyle}
      />

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,179,0,0.04)', border: '1px solid rgba(255,179,0,0.15)' }}>
          <div className="text-3xl mb-3">📦</div>
          <div className="font-semibold text-sm" style={{ color: '#ffb300' }}>
            {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin entregas registradas'}
          </div>
          <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
            {!busqueda && 'Usá el botón "📦 Entregar" desde Stock para registrar una entrega.'}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((e) => {
            const camada = camadas.find((c) => c.id === e.camada_id)
            const madre  = camada ? animales.find((a) => a.id === camada.id_madre) : null
            const padre  = camada ? animales.find((a) => a.id === camada.id_padre) : null
            const esRepro = !e.camada_id
            const estaEnProceso = cargando === e.id

            return (
              <div
                key={e.id}
                className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
                style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)', opacity: estaEnProceso ? 0.5 : 1 }}
              >
                {/* Fecha */}
                <div className="font-mono text-sm font-semibold" style={{ color: '#ffb300', minWidth: '90px' }}>
                  {formatFecha(e.fecha) ?? '—'}
                </div>

                {/* Tipo + origen */}
                <div className="flex-1 min-w-0">
                  {esRepro ? (
                    <span className="text-sm font-semibold" style={{ color: '#ce93d8' }}>
                      Reproductor
                    </span>
                  ) : (
                    <span className="text-sm font-semibold" style={{ color: '#00e676' }}>
                      {madre?.codigo ?? '?'} × {padre?.codigo ?? '?'}
                    </span>
                  )}
                  {e.observaciones && (
                    <span className="ml-2 text-xs" style={{ color: '#4a5f7a' }}>— {e.observaciones}</span>
                  )}
                </div>

                {/* Cantidad */}
                <div className="font-mono font-bold text-base" style={{ color: '#ffb300' }}>
                  {e.cantidad} {e.cantidad === 1 ? 'animal' : 'animales'}
                </div>

                {/* Botón devolver */}
                <div className="relative" onClick={(ev) => ev.stopPropagation()}>
                  <button
                    disabled={estaEnProceso}
                    onClick={() => setMenuAbierto(menuAbierto === e.id ? null : e.id)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: 'rgba(64,196,255,0.08)',
                      border: '1px solid rgba(64,196,255,0.3)',
                      color: '#40c4ff',
                      cursor: estaEnProceso ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {estaEnProceso ? '...' : '↩ Devolver'}
                  </button>

                  {menuAbierto === e.id && (
                    <div
                      className="absolute right-0 z-50 rounded-xl overflow-hidden"
                      style={{
                        top: 'calc(100% + 6px)',
                        minWidth: '220px',
                        background: '#0d1528',
                        border: '1px solid rgba(64,196,255,0.25)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}
                    >
                      {/* Opción 1: mantener historial */}
                      <button
                        onClick={() => handleDevolver(e, true)}
                        className="w-full text-left px-4 py-3 text-sm"
                        style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(30,51,82,0.8)', cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={(ev) => ev.currentTarget.style.background = 'rgba(64,196,255,0.08)'}
                        onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                      >
                        <div className="font-semibold" style={{ color: '#40c4ff' }}>↩ Devolver al stock</div>
                        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>Mantiene el registro en el historial</div>
                      </button>

                      {/* Opción 2: borrar historial */}
                      <button
                        onClick={() => handleDevolver(e, false)}
                        className="w-full text-left px-4 py-3 text-sm"
                        style={{ color: '#e2e8f0', cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={(ev) => ev.currentTarget.style.background = 'rgba(255,82,82,0.08)'}
                        onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                      >
                        <div className="font-semibold" style={{ color: '#ff5252' }}>↩ Devolver y borrar del historial</div>
                        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>Como si la entrega no hubiera existido</div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
