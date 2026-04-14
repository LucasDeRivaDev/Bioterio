import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fechaHoy() {
  return new Date().toISOString().split('T')[0]
}

function horaAhora() {
  return new Date().toTimeString().slice(0, 5)
}

function mesActual() {
  return new Date().toISOString().slice(0, 7)
}

function labelMes(yearMonth) {
  if (!yearMonth) return ''
  const [y, m] = yearMonth.split('-')
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${nombres[parseInt(m, 10) - 1]} ${y}`
}

function formatTemp(v) {
  if (v == null || v === '') return '—'
  return `${Number(v).toFixed(1)}°C`
}

function promedioArr(arr) {
  if (!arr.length) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const PAGE_BG   = '#050810'
const CARD_BG   = 'rgba(13,21,40,0.95)'
const BORDER    = '1px solid rgba(30,51,82,0.7)'
const ACCENT    = '#00e676'
const ACCENT_DIM = 'rgba(0,230,118,0.12)'

function InputField({ label, value, onChange, placeholder, type = 'number' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
        {label}
      </label>
      <input
        type={type}
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg px-3 py-2 text-sm font-mono outline-none"
        style={{
          background: 'rgba(5,8,16,0.6)',
          border: '1px solid rgba(30,51,82,0.8)',
          color: '#e2e8f0',
        }}
      />
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Temperatura() {
  const { temperaturas, agregarTemperatura, eliminarTemperaturasMes } = useBioterio()

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [formAbierto, setFormAbierto] = useState(false)
  const [actual, setActual] = useState('')
  const [minTemp, setMinTemp] = useState('')
  const [maxTemp, setMaxTemp] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Estado de vista mensual ────────────────────────────────────────────────
  const [mesSelec, setMesSelec] = useState(mesActual())
  const [confirmElim, setConfirmElim] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // ── Registros de hoy ───────────────────────────────────────────────────────
  const hoy = fechaHoy()
  const registrosHoy = useMemo(
    () => temperaturas.filter((t) => t.date === hoy).sort((a, b) => b.time.localeCompare(a.time)),
    [temperaturas, hoy]
  )

  // ── Registros del mes seleccionado ────────────────────────────────────────
  const registrosMes = useMemo(
    () => temperaturas
      .filter((t) => t.date?.startsWith(mesSelec))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [temperaturas, mesSelec]
  )

  // Agrupar por día para la vista mensual
  const diasMes = useMemo(() => {
    const mapa = {}
    for (const r of registrosMes) {
      if (!mapa[r.date]) mapa[r.date] = []
      mapa[r.date].push(r)
    }
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  }, [registrosMes])

  // Promedios mensuales
  const promedioMensual = useMemo(() => {
    const currents = registrosMes.map((r) => r.current_temp).filter((v) => v != null)
    const mins     = registrosMes.map((r) => r.min_temp).filter((v) => v != null)
    const maxs     = registrosMes.map((r) => r.max_temp).filter((v) => v != null)
    return {
      actual: promedioArr(currents),
      min:    promedioArr(mins),
      max:    promedioArr(maxs),
    }
  }, [registrosMes])

  // ── Guardar registro ──────────────────────────────────────────────────────
  async function guardar() {
    if (actual === '') { setError('Ingresá la temperatura actual.'); return }
    setError('')
    setGuardando(true)
    try {
      await agregarTemperatura({
        date:         hoy,
        time:         horaAhora(),
        current_temp: parseFloat(actual),
        min_temp:     minTemp !== '' ? parseFloat(minTemp) : null,
        max_temp:     maxTemp !== '' ? parseFloat(maxTemp) : null,
      })
      setActual('')
      setMinTemp('')
      setMaxTemp('')
      setFormAbierto(false)
    } catch {
      setError('No se pudo guardar. Verificá la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar mes ──────────────────────────────────────────────────────────
  async function eliminarMes() {
    setEliminando(true)
    await eliminarTemperaturasMes(mesSelec)
    setEliminando(false)
    setConfirmElim(false)
  }

  // ── Imprimir ──────────────────────────────────────────────────────────────
  function imprimir() {
    window.print()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Estilos de impresión ── */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-table { width: 100%; border-collapse: collapse; font-family: monospace; font-size: 11px; }
          .print-table th, .print-table td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
          .print-table th { background: #f0f0f0; font-weight: bold; }
          .print-header { margin-bottom: 16px; }
          .print-header h1 { font-size: 18px; margin: 0 0 4px; }
          .print-header p { font-size: 12px; margin: 0; color: #555; }
          .print-section { page-break-inside: avoid; margin-bottom: 20px; }
          .print-day-title { font-weight: bold; font-size: 12px; margin: 10px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
          .print-avg-row { background: #f9f9f9; font-style: italic; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* ── Contenido imprimible (oculto en pantalla) ── */}
      <div className="print-only" style={{ padding: '20px' }}>
        <div className="print-header">
          <h1>Registro de Temperatura — {labelMes(mesSelec)}</h1>
          <p>Bioterio · Generado: {new Date().toLocaleDateString('es-AR')}</p>
        </div>

        {diasMes.length === 0 ? (
          <p>Sin registros para este mes.</p>
        ) : (
          diasMes.map(([fecha, regs]) => {
            const currents = regs.map((r) => r.current_temp).filter((v) => v != null)
            const mins     = regs.map((r) => r.min_temp).filter((v) => v != null)
            const maxs     = regs.map((r) => r.max_temp).filter((v) => v != null)
            const avgC = promedioArr(currents)
            const avgMn = promedioArr(mins)
            const avgMx = promedioArr(maxs)
            const [, m, d] = fecha.split('-')
            return (
              <div key={fecha} className="print-section">
                <div className="print-day-title">{d}/{m}/{fecha.slice(0,4)}</div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Actual</th>
                      <th>Mínima</th>
                      <th>Máxima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regs.map((r) => (
                      <tr key={r.id}>
                        <td>{r.time?.slice(0, 5)}</td>
                        <td>{formatTemp(r.current_temp)}</td>
                        <td>{formatTemp(r.min_temp)}</td>
                        <td>{formatTemp(r.max_temp)}</td>
                      </tr>
                    ))}
                    {regs.length > 1 && (
                      <tr className="print-avg-row">
                        <td>Promedio</td>
                        <td>{avgC != null ? formatTemp(avgC.toFixed(1)) : '—'}</td>
                        <td>{avgMn != null ? formatTemp(avgMn.toFixed(1)) : '—'}</td>
                        <td>{avgMx != null ? formatTemp(avgMx.toFixed(1)) : '—'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })
        )}

        {registrosMes.length > 0 && (
          <div className="print-section">
            <div className="print-day-title">Promedio mensual</div>
            <table className="print-table">
              <tbody>
                <tr>
                  <td><strong>Temperatura actual</strong></td>
                  <td>{promedioMensual.actual != null ? formatTemp(promedioMensual.actual.toFixed(1)) : '—'}</td>
                </tr>
                <tr>
                  <td><strong>Temperatura mínima</strong></td>
                  <td>{promedioMensual.min != null ? formatTemp(promedioMensual.min.toFixed(1)) : '—'}</td>
                </tr>
                <tr>
                  <td><strong>Temperatura máxima</strong></td>
                  <td>{promedioMensual.max != null ? formatTemp(promedioMensual.max.toFixed(1)) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── UI principal (visible en pantalla) ── */}
      <div className="no-print flex flex-col gap-6 p-4 md:p-6 max-w-4xl mx-auto" style={{ color: '#e2e8f0' }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">🌡️ Temperatura</h1>
            <p className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
              Registro ambiental de la colonia
            </p>
          </div>
          <button
            onClick={() => setFormAbierto((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: formAbierto ? 'rgba(0,230,118,0.08)' : ACCENT_DIM,
              border: `1px solid ${formAbierto ? 'rgba(0,230,118,0.4)' : 'rgba(0,230,118,0.25)'}`,
              color: ACCENT,
            }}
          >
            {formAbierto ? '✕ Cancelar' : '+ Agregar registro'}
          </button>
        </div>

        {/* Formulario */}
        {formAbierto && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: CARD_BG, border: BORDER }}>
            <div className="text-sm font-semibold text-white">Nuevo registro — hoy {hoy.split('-').reverse().join('/')} · {horaAhora()}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InputField label="Temp. actual *" value={actual} onChange={setActual} placeholder="Ej: 22.5" />
              <InputField label="Temp. mínima"   value={minTemp} onChange={setMinTemp} placeholder="Ej: 20.0" />
              <InputField label="Temp. máxima"   value={maxTemp} onChange={setMaxTemp} placeholder="Ej: 25.5" />
            </div>
            {error && <p className="text-xs font-mono" style={{ color: '#ff6b80' }}>{error}</p>}
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: ACCENT_DIM,
                border: `1px solid rgba(0,230,118,0.35)`,
                color: ACCENT,
                opacity: guardando ? 0.5 : 1,
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar registro'}
            </button>
          </div>
        )}

        {/* Registros de hoy */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: BORDER }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: BORDER, background: ACCENT_DIM }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
              Registros de hoy — {hoy.split('-').reverse().join('/')}
            </span>
            <span
              className="ml-auto text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.2)', color: ACCENT }}
            >
              {registrosHoy.length}
            </span>
          </div>

          {registrosHoy.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-mono" style={{ color: '#4a5f7a' }}>
              Sin registros para hoy
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.4)' }}>
              {registrosHoy.map((r) => (
                <div key={r.id} className="px-4 py-3 flex items-center gap-4 flex-wrap">
                  <span className="font-mono text-sm font-bold" style={{ color: ACCENT, minWidth: '50px' }}>
                    {r.time?.slice(0, 5)}
                  </span>
                  <TempChip label="Actual" value={r.current_temp} color="#00e676" />
                  <TempChip label="Mín"    value={r.min_temp}     color="#40c4ff" />
                  <TempChip label="Máx"    value={r.max_temp}     color="#ff6b80" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vista mensual */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: BORDER }}>
          <div
            className="px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ borderBottom: BORDER, background: 'rgba(255,179,0,0.06)' }}
          >
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ffb300' }}>
              📋 Vista mensual
            </span>
            <input
              type="month"
              value={mesSelec}
              onChange={(e) => { setMesSelec(e.target.value); setConfirmElim(false) }}
              className="ml-auto rounded-lg px-2 py-1 text-xs font-mono outline-none"
              style={{
                background: 'rgba(5,8,16,0.6)',
                border: '1px solid rgba(30,51,82,0.8)',
                color: '#e2e8f0',
              }}
            />
            <button
              onClick={imprimir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: 'rgba(255,179,0,0.1)',
                border: '1px solid rgba(255,179,0,0.3)',
                color: '#ffb300',
              }}
            >
              🖨️ Imprimir
            </button>
          </div>

          {registrosMes.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-mono" style={{ color: '#4a5f7a' }}>
              Sin registros para {labelMes(mesSelec)}
            </div>
          ) : (
            <>
              {/* Promedios del mes */}
              <div className="px-4 py-3 grid grid-cols-3 gap-3" style={{ borderBottom: BORDER }}>
                <PromedioCard label="Promedio actual" value={promedioMensual.actual} color="#00e676" />
                <PromedioCard label="Promedio mínima" value={promedioMensual.min}    color="#40c4ff" />
                <PromedioCard label="Promedio máxima" value={promedioMensual.max}    color="#ff6b80" />
              </div>

              {/* Tabla por día */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      <th className="px-4 py-2 text-left font-semibold" style={{ color: '#4a5f7a' }}>Fecha</th>
                      <th className="px-4 py-2 text-left font-semibold" style={{ color: '#4a5f7a' }}>Hora</th>
                      <th className="px-4 py-2 text-right font-semibold" style={{ color: '#00e676' }}>Actual</th>
                      <th className="px-4 py-2 text-right font-semibold" style={{ color: '#40c4ff' }}>Mín</th>
                      <th className="px-4 py-2 text-right font-semibold" style={{ color: '#ff6b80' }}>Máx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasMes.map(([fecha, regs]) => {
                      const [, m, d] = fecha.split('-')
                      return regs.map((r, i) => (
                        <tr
                          key={r.id}
                          style={{ borderBottom: '1px solid rgba(30,51,82,0.3)' }}
                        >
                          <td className="px-4 py-2" style={{ color: i === 0 ? '#e2e8f0' : 'transparent' }}>
                            {d}/{m}
                          </td>
                          <td className="px-4 py-2" style={{ color: '#8a9bb0' }}>{r.time?.slice(0, 5)}</td>
                          <td className="px-4 py-2 text-right" style={{ color: '#00e676' }}>{formatTemp(r.current_temp)}</td>
                          <td className="px-4 py-2 text-right" style={{ color: '#40c4ff' }}>{formatTemp(r.min_temp)}</td>
                          <td className="px-4 py-2 text-right" style={{ color: '#ff6b80' }}>{formatTemp(r.max_temp)}</td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botón eliminar mes */}
              <div className="px-4 py-4" style={{ borderTop: BORDER }}>
                {!confirmElim ? (
                  <button
                    onClick={() => setConfirmElim(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: 'rgba(255,61,87,0.05)',
                      border: '1px solid rgba(255,61,87,0.2)',
                      color: '#ff6b80',
                    }}
                  >
                    🗑️ Eliminar registros de {labelMes(mesSelec)}
                  </button>
                ) : (
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.25)' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: '#ff6b80' }}>
                      ⚠️ ¿Confirmar eliminación?
                    </p>
                    <p className="text-xs" style={{ color: '#8a9bb0' }}>
                      Se van a borrar permanentemente los {registrosMes.length} registros de {labelMes(mesSelec)}.
                      Asegurate de haber impreso o guardado los datos antes de continuar.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={eliminarMes}
                        disabled={eliminando}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: 'rgba(255,61,87,0.15)',
                          border: '1px solid rgba(255,61,87,0.4)',
                          color: '#ff6b80',
                          opacity: eliminando ? 0.5 : 1,
                        }}
                      >
                        {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                      </button>
                      <button
                        onClick={() => setConfirmElim(false)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: 'rgba(30,51,82,0.4)',
                          border: '1px solid rgba(30,51,82,0.6)',
                          color: '#8a9bb0',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TempChip({ label, value, color }) {
  if (value == null) return null
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs" style={{ color: 'rgba(138,155,176,0.6)' }}>{label}</span>
      <span className="text-sm font-mono font-bold" style={{ color }}>{formatTemp(value)}</span>
    </div>
  )
}

function PromedioCard({ label, value, color }) {
  return (
    <div
      className="rounded-xl px-3 py-2 text-center"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}
    >
      <div className="text-xs font-mono font-bold" style={{ color }}>
        {value != null ? formatTemp(value.toFixed(1)) : '—'}
      </div>
      <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{label}</div>
    </div>
  )
}
