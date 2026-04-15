import { useMemo, useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha, hoy } from '../utils/calculos'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

const labelCategoria = {
  cria: 'Cría',
  joven: 'Joven',
  adulto_nr: 'Adulto NR',
  reproductor: 'Reproductor',
  otro: 'Otro',
}

const iStyle = {
  background: 'rgba(5,8,16,0.6)', border: '1px solid rgba(30,51,82,0.8)',
  color: '#e2e8f0', borderRadius: '0.5rem', padding: '0.3rem 0.5rem',
  fontSize: '0.8rem', outline: 'none',
}

function RegistrarFechaRepro({ animal, onGuardar }) {
  const [editando, setEditando] = useState(false)
  const [fecha, setFecha]       = useState(hoy())
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!fecha) return
    setGuardando(true)
    await onGuardar(animal, fecha)
    setEditando(false)
    setGuardando(false)
  }

  if (!editando) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="text-xs px-2 py-1 rounded-lg transition-all"
        style={{ background: 'rgba(206,147,216,0.08)', border: '1px solid rgba(206,147,216,0.25)', color: '#ce93d8' }}
      >
        + Registrar fecha
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={iStyle} />
      <button
        onClick={guardar} disabled={guardando || !fecha}
        className="text-xs px-2 py-1 rounded-lg font-bold"
        style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', cursor: guardando ? 'wait' : 'pointer' }}
      >
        {guardando ? '...' : '✓'}
      </button>
      <button
        onClick={() => setEditando(false)}
        className="text-xs px-2 py-1 rounded-lg"
        style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#4a5f7a' }}
      >
        ✕
      </button>
    </div>
  )
}

export default function Sacrificios() {
  const { animales, camadas, sacrificios, eliminarSacrificio, registrarSacrificio } = useBioterio()

  // ── Reproductores sacrificados (estado === 'fallecido') ───────────────────
  const reproductoresSacrificados = useMemo(() =>
    [...animales]
      .filter((a) => a.estado === 'fallecido')
      .sort((a, b) => (b.fecha_sacrificio ?? b.fecha_nacimiento ?? '').localeCompare(a.fecha_sacrificio ?? a.fecha_nacimiento ?? '')),
  [animales])

  // ── Historial de camadas sacrificadas ─────────────────────────────────────
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

  const totalSacrificados = sacrificios.filter(s => s.categoria !== 'reproductor').reduce((sum, s) => sum + s.cantidad, 0)

  async function registrarFechaRepro(animal, fecha) {
    await registrarSacrificio({
      camada_id: null,
      cantidad: 1,
      fecha,
      categoria: 'reproductor',
      notas: `Reproductor ${animal.codigo}`,
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#ff6b80', boxShadow: '0 0 8px rgba(255,107,128,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Historial de sacrificios</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
              Seleccioná animales o jaulas desde Stock para registrar sacrificios
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {reproductoresSacrificados.length > 0 && (
            <div className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(206,147,216,0.07)', border: '1px solid rgba(206,147,216,0.2)' }}>
              <span className="font-mono font-bold text-lg" style={{ color: '#ce93d8' }}>{reproductoresSacrificados.length}</span>
              <span className="text-xs ml-1.5" style={{ color: '#4a5f7a' }}>reproductores</span>
            </div>
          )}
          {totalSacrificados > 0 && (
            <div className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,107,128,0.07)', border: '1px solid rgba(255,107,128,0.2)' }}>
              <span className="font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>{totalSacrificados}</span>
              <span className="text-xs ml-1.5" style={{ color: '#4a5f7a' }}>crías/stock</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN: Reproductores sacrificados ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#ce93d8' }}>
            🐀 Reproductores sacrificados
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(206,147,216,0.1)', color: '#ce93d8', border: '1px solid rgba(206,147,216,0.25)' }}>
            {reproductoresSacrificados.length}
          </span>
        </div>

        {reproductoresSacrificados.length === 0 ? (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(206,147,216,0.03)', border: '1px dashed rgba(206,147,216,0.15)' }}>
            <div className="text-2xl mb-2">🐀</div>
            <div className="text-sm font-semibold" style={{ color: '#ce93d8' }}>Sin reproductores sacrificados</div>
            <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
              Seleccioná reproductores desde Stock → Seleccionar para registrar
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                    {['Código', 'Sexo', 'Fecha sacrificio', 'Progenitores', 'Notas / Motivo', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                        style={{ color: '#4a5f7a' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reproductoresSacrificados.map((a) => {
                    const madre = animales.find(x => x.id === a.id_madre)
                    const padre = animales.find(x => x.id === a.id_padre)
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color: '#c9d4e0' }}>
                          {a.codigo}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          <span style={{ color: a.sexo === 'hembra' ? '#ce93d8' : '#40c4ff' }}>
                            {a.sexo === 'hembra' ? '♀ Hembra' : '♂ Macho'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8a9bb0' }}>
                          {a.fecha_sacrificio ? formatFecha(a.fecha_sacrificio) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#4a5f7a' }}>
                          {(madre || padre)
                            ? <span>{madre?.codigo ?? '?'} × {padre?.codigo ?? '?'}</span>
                            : <span style={{ opacity: 0.3 }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#4a5f7a', maxWidth: '200px' }}>
                          {a.motivo_sacrificio ?? a.notas ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {!a.fecha_sacrificio && (
                            <RegistrarFechaRepro animal={a} onGuardar={registrarFechaRepro} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN: Sacrificios de stock / camadas ──────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#ff6b80' }}>
            🗡 Sacrificios de stock
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,61,87,0.1)', color: '#ff6b80', border: '1px solid rgba(255,61,87,0.25)' }}>
            {listaEnriquecida.length}
          </span>
        </div>

        {listaEnriquecida.length === 0 ? (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,107,128,0.04)', border: '1px dashed rgba(255,107,128,0.2)' }}>
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-sm" style={{ color: '#ff6b80' }}>Sin sacrificios de stock registrados</div>
            <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
              Seleccioná jaulas desde la vista de Stock para registrar
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '520px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                    {['Fecha', 'Grupo / Emparejamiento', 'Cantidad', 'Categoría', 'Notas', ''].map((h) => (
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
          </div>
        )}
      </div>
    </div>
  )
}
