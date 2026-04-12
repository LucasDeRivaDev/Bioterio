import { useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha } from '../utils/calculos'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

const labelCategoria = {
  cria: 'Cría',
  joven: 'Joven',
  adulto_nr: 'Adulto NR',
  reproductor: 'Reproductor',
  otro: 'Otro',
}

export default function Sacrificios() {
  const { animales, camadas, sacrificios, eliminarSacrificio } = useBioterio()

  const listaEnriquecida = useMemo(() =>
    [...sacrificios]
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
      .map((s) => {
        const camada = camadas.find((c) => c.id === s.camada_id)
        const madre  = camada ? animales.find((a) => a.id === camada.id_madre) : null
        const padre  = camada ? animales.find((a) => a.id === camada.id_padre) : null
        return { ...s, camada, madre, padre }
      }),
  [sacrificios, camadas, animales])

  const totalSacrificados = sacrificios.reduce((sum, s) => sum + s.cantidad, 0)

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#ff6b80', boxShadow: '0 0 8px rgba(255,107,128,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Historial de sacrificios</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
              Registrá sacrificios desde la vista de Stock → Seleccionar
            </p>
          </div>
        </div>
        {totalSacrificados > 0 && (
          <div className="px-4 py-2 rounded-xl text-center"
            style={{ background: 'rgba(255,107,128,0.07)', border: '1px solid rgba(255,107,128,0.2)' }}>
            <span className="font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>{totalSacrificados}</span>
            <span className="text-xs ml-1.5" style={{ color: '#4a5f7a' }}>sacrificados total</span>
          </div>
        )}
      </div>

      {/* Lista */}
      {listaEnriquecida.length === 0 ? (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: 'rgba(255,107,128,0.04)', border: '1px dashed rgba(255,107,128,0.2)' }}>
          <div className="text-3xl mb-2">📋</div>
          <div className="font-semibold text-sm" style={{ color: '#ff6b80' }}>Sin sacrificios registrados</div>
          <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
            Seleccioná jaulas desde la vista de Stock para registrar un sacrificio
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(30,51,82,0.8)', background: 'rgba(0,0,0,0.15)' }}>
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
              Registros
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                {['Fecha', 'Grupo / Camada', 'Cantidad', 'Categoría', 'Notas', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: '#4a5f7a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaEnriquecida.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: '#8a9bb0' }}>
                    {formatFecha(s.fecha)}
                  </td>
                  <td className="px-4 py-3">
                    {s.madre && s.padre ? (
                      <span className="font-mono font-semibold">
                        <span style={{ color: '#ce93d8' }}>{s.madre.codigo}</span>
                        <span style={{ color: '#4a5f7a' }}> × </span>
                        <span style={{ color: '#40c4ff' }}>{s.padre.codigo}</span>
                      </span>
                    ) : (
                      <span style={{ color: '#4a5f7a' }}>—</span>
                    )}
                    {s.camada?.fecha_nacimiento && (
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                        nac. {formatFecha(s.camada.fecha_nacimiento)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>
                    {s.cantidad}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8a9bb0' }}>
                    {s.categoria ? labelCategoria[s.categoria] ?? s.categoria : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#4a5f7a', maxWidth: '200px' }}>
                    {s.notas ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Eliminar este registro de ${s.cantidad} sacrificios? Esto restaurará el stock de la camada.`))
                          eliminarSacrificio(s.id)
                      }}
                      className="text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
