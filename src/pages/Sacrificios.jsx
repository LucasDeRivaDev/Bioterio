import { useMemo, useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha } from '../utils/calculos'
import { useTheme } from '../context/ThemeContext'

const labelCategoria = {
  cria: 'Cría',
  joven: 'Joven',
  adulto_nr: 'Adulto NR',
  reproductor: 'Reproductor',
  otro: 'Otro',
}

// ── Menú de confirmación de restauración ─────────────────────────────────────

function MenuRestaurar({ onRestaurar, onSoloBorrar, onCerrar, labelRestaurar, labelBorrar }) {
  const { tema } = useTheme()
  return (
    <div
      className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-2xl"
      style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.9)', minWidth: '230px' }}
    >
      {/* Restaurar con stock */}
      <button
        onClick={onRestaurar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(30,51,82,0.8)', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,230,118,0.07)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="font-semibold" style={{ color: tema.accent }}>{labelRestaurar}</div>
        <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>El animal vuelve a su estado anterior</div>
      </button>

      {/* Solo borrar registro */}
      <button
        onClick={onSoloBorrar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#e2e8f0', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,61,87,0.07)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="font-semibold" style={{ color: '#ff5252' }}>{labelBorrar}</div>
        <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>Borra solo el registro, sin restaurar</div>
      </button>

      {/* Cancelar */}
      <button
        onClick={onCerrar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: tema.textMuted, borderTop: '1px solid rgba(30,51,82,0.6)', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(74,95,122,0.06)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        Cancelar
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Sacrificios() {
  const { tema } = useTheme()
  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }
  const {
    animales, animalesExportados, camadas, sacrificios,
    eliminarSacrificio, eliminarSacrificioReproductor,
  } = useBioterio()

  const todosAnimales = useMemo(() => [...animales, ...animalesExportados], [animales, animalesExportados])

  const [menuAbierto, setMenuAbierto] = useState(null)   // id del registro con menú visible
  const [cargando,   setCargando]   = useState(null)   // id en proceso

  // ── Reproductores sacrificados ────────────────────────────────────────────
  const reproductoresSacrificados = useMemo(() =>
    [...animales]
      .filter((a) => a.estado === 'fallecido')
      .sort((a, b) => (b.fecha_sacrificio ?? b.fecha_nacimiento ?? '').localeCompare(a.fecha_sacrificio ?? a.fecha_nacimiento ?? '')),
  [animales])

  // ── Sacrificios de stock / camadas ────────────────────────────────────────
  const listaEnriquecida = useMemo(() =>
    [...sacrificios]
      .filter((s) => s.categoria !== 'reproductor')
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
      .map((s) => {
        const camada = camadas.find((c) => c.id === s.camada_id)
        const madre  = camada ? todosAnimales.find((a) => a.id === camada.id_madre) : null
        const padre  = camada ? todosAnimales.find((a) => a.id === camada.id_padre) : null
        return { ...s, camada, madre, padre }
      }),
  [sacrificios, camadas, animales])

  const totalSacrificados = sacrificios.filter(s => s.categoria !== 'reproductor').reduce((sum, s) => sum + s.cantidad, 0)

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleRestaurarStock(sacrificio, restaurar) {
    setCargando(sacrificio.id)
    setMenuAbierto(null)
    try { await eliminarSacrificio(sacrificio.id, restaurar) }
    finally { setCargando(null) }
  }

  async function handleRestaurarReproductor(animal, restaurar) {
    setCargando(animal.id)
    setMenuAbierto(null)
    try { await eliminarSacrificioReproductor(animal, restaurar) }
    finally { setCargando(null) }
  }

  function toggleMenu(id) {
    setMenuAbierto(prev => prev === id ? null : id)
  }

  return (
    <div
      className="p-4 md:p-6 space-y-6 min-h-screen"
      style={{ background: tema.bgMain }}
      onClick={() => setMenuAbierto(null)}  // cerrar menú al hacer click fuera
    >

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#ff6b80', boxShadow: '0 0 8px rgba(255,107,128,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Historial de sacrificios</h1>
            <p className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
              Seleccioná animales o jaulas desde Stock para registrar sacrificios
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {reproductoresSacrificados.length > 0 && (
            <div className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(206,147,216,0.07)', border: '1px solid rgba(206,147,216,0.2)' }}>
              <span className="font-mono font-bold text-lg" style={{ color: tema.purple }}>{reproductoresSacrificados.length}</span>
              <span className="text-xs ml-1.5" style={{ color: tema.textMuted }}>reproductores</span>
            </div>
          )}
          {totalSacrificados > 0 && (
            <div className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,107,128,0.07)', border: '1px solid rgba(255,107,128,0.2)' }}>
              <span className="font-mono font-bold text-lg" style={{ color: tema.red }}>{totalSacrificados}</span>
              <span className="text-xs ml-1.5" style={{ color: tema.textMuted }}>crías/stock</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SECCIÓN: Reproductores sacrificados ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.purple }}>
            🐀 Reproductores sacrificados
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(206,147,216,0.1)', color: tema.purple, border: '1px solid rgba(206,147,216,0.25)' }}>
            {reproductoresSacrificados.length}
          </span>
        </div>

        {reproductoresSacrificados.length === 0 ? (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(206,147,216,0.03)', border: '1px dashed rgba(206,147,216,0.15)' }}>
            <div className="text-2xl mb-2">🐀</div>
            <div className="text-sm font-semibold" style={{ color: tema.purple }}>Sin reproductores sacrificados</div>
            <div className="text-xs mt-1" style={{ color: tema.textMuted }}>
              Seleccioná reproductores desde Stock → Seleccionar para registrar
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                    {['Código', 'Sexo', 'Fecha sacrificio', 'Progenitores', 'Notas / Motivo', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                        style={{ color: tema.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reproductoresSacrificados.map((a) => {
                    const madre = todosAnimales.find(x => x.id === a.id_madre)
                    const padre = todosAnimales.find(x => x.id === a.id_padre)
                    const enProceso = cargando === a.id
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color: tema.textPrimary }}>
                          {a.codigo}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          <span style={{ color: a.sexo === 'hembra' ? '#ce93d8' : '#40c4ff' }}>
                            {a.sexo === 'hembra' ? '♀ Hembra' : '♂ Macho'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: tema.textSecondary }}>
                          {a.fecha_sacrificio ? formatFecha(a.fecha_sacrificio) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: tema.textMuted }}>
                          {(madre || padre)
                            ? <span>{madre?.codigo ?? '?'} × {padre?.codigo ?? '?'}</span>
                            : <span style={{ opacity: 0.3 }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: tema.textMuted, maxWidth: '200px' }}>
                          {a.motivo_sacrificio ?? a.notas ?? '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block">
                            <button
                              onClick={() => { if (!enProceso) toggleMenu(a.id) }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                background: 'rgba(0,230,118,0.08)',
                                border: '1px solid rgba(0,230,118,0.3)',
                                color: enProceso ? '#4a5f7a' : '#00e676',
                                cursor: enProceso ? 'default' : 'pointer',
                              }}
                            >
                              {enProceso ? '...' : '↩ Restaurar'}
                            </button>
                            {menuAbierto === a.id && (
                              <MenuRestaurar
                                labelRestaurar="↩ Restaurar como activo"
                                labelBorrar="✕ Solo borrar registro"
                                onRestaurar={() => handleRestaurarReproductor(a, true)}
                                onSoloBorrar={() => handleRestaurarReproductor(a, false)}
                                onCerrar={() => setMenuAbierto(null)}
                              />
                            )}
                          </div>
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
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.red }}>
            🗡 Sacrificios de stock
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,61,87,0.1)', color: tema.red, border: '1px solid rgba(255,61,87,0.25)' }}>
            {listaEnriquecida.length}
          </span>
        </div>

        {listaEnriquecida.length === 0 ? (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,107,128,0.04)', border: '1px dashed rgba(255,107,128,0.2)' }}>
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-sm" style={{ color: tema.red }}>Sin sacrificios de stock registrados</div>
            <div className="text-xs mt-1" style={{ color: tema.textMuted }}>
              Seleccioná jaulas desde la vista de Stock para registrar
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '560px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                    {['Fecha', 'Grupo / Emparejamiento', 'Cantidad', 'Categoría', 'Notas', ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                        style={{ color: tema.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaEnriquecida.map((s) => {
                    const enProceso = cargando === s.id
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: tema.textSecondary }}>
                          {formatFecha(s.fecha)}
                        </td>
                        <td className="px-4 py-3">
                          {s.madre && s.padre ? (
                            <span className="font-mono font-semibold">
                              <span style={{ color: tema.purple }}>{s.madre.codigo}</span>
                              <span style={{ color: tema.textMuted }}> × </span>
                              <span style={{ color: tema.blue }}>{s.padre.codigo}</span>
                            </span>
                          ) : (
                            <span style={{ color: tema.textMuted }}>—</span>
                          )}
                          {s.camada?.fecha_nacimiento && (
                            <div className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                              nac. {formatFecha(s.camada.fecha_nacimiento)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-lg" style={{ color: tema.red }}>
                          {s.cantidad}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: tema.textSecondary }}>
                          {s.categoria ? labelCategoria[s.categoria] ?? s.categoria : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: tema.textMuted, maxWidth: '200px' }}>
                          {s.notas ?? '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block">
                            <button
                              onClick={() => { if (!enProceso) toggleMenu(s.id) }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                background: 'rgba(0,230,118,0.08)',
                                border: '1px solid rgba(0,230,118,0.3)',
                                color: enProceso ? '#4a5f7a' : '#00e676',
                                cursor: enProceso ? 'default' : 'pointer',
                              }}
                            >
                              {enProceso ? '...' : '↩ Restaurar'}
                            </button>
                            {menuAbierto === s.id && (
                              <MenuRestaurar
                                labelRestaurar="↩ Restaurar al stock"
                                labelBorrar="✕ Solo borrar registro"
                                onRestaurar={() => handleRestaurarStock(s, true)}
                                onSoloBorrar={() => handleRestaurarStock(s, false)}
                                onCerrar={() => setMenuAbierto(null)}
                              />
                            )}
                          </div>
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
    </div>
  )
}
