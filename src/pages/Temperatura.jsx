import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generarId } from '../utils/storage'
import { useTheme } from '../context/ThemeContext'
import { hoy } from '../utils/calculos'

// ─────────────────────────────────────────────────────────────────────────────
// IDs fijos en Supabase — independientes del bioterio activo
// Al consultar ratones también incluimos los IDs anteriores por compatibilidad
// con registros creados antes de esta centralización.
// ─────────────────────────────────────────────────────────────────────────────
const BIOTERIO_RATAS    = 'ratas'
const BIOTERIO_RATONES  = 'ratones'
const RATONES_LEGACY    = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fechaHoy()  { return hoy() }
function horaAhora() { return new Date().toTimeString().slice(0, 5) }
function mesActual() { return hoy().slice(0, 7) }

function labelMes(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${MESES[parseInt(m, 10) - 1]} ${y}`
}

function formatTemp(v) {
  if (v == null || v === '') return '—'
  return `${Number(v).toFixed(1)}°C`
}

function promedio(arr) {
  const vals = arr.filter(v => v != null)
  if (!vals.length) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Temperatura() {
  const navigate = useNavigate()
  const { tema } = useTheme()
  const CARD_BG = tema.bgCard
  const BORDER  = `1px solid ${tema.bgCardBorde}`
  const CFG = {
    ratas:   { color: tema.accent, dim: 'rgba(0,230,118,0.1)',  label: 'Bioterio de Ratas',   icon: '🐀' },
    ratones: { color: tema.blue, dim: 'rgba(64,196,255,0.1)', label: 'Bioterio de Ratones', icon: '🐭' },
  }
  // Tab activa
  const [bio, setBio] = useState('ratas')

  // Datos de ambos bioterios
  const [regsRatas,   setRegsRatas]   = useState([])
  const [regsRatones, setRegsRatones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  // Formulario
  const [formAbierto, setFormAbierto] = useState(false)
  const [actual,   setActual]   = useState('')
  const [minTemp,  setMinTemp]  = useState('')
  const [maxTemp,  setMaxTemp]  = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  // Vista mensual
  const [mesSelec,     setMesSelec]    = useState(mesActual())
  const [confirmElim,  setConfirmElim] = useState(false)
  const [eliminando,   setEliminando]  = useState(false)

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargarTodo = useCallback(async () => {
    setCargando(true)
    setErrorCarga('')
    try {
      const [resRatas, resRatones] = await Promise.all([
        // Ratas
        supabase
          .from('temperature_logs')
          .select('*')
          .eq('bioterio_id', BIOTERIO_RATAS)
          .order('date', { ascending: false })
          .order('time', { ascending: false }),

        // Ratones — incluye ID unificado + IDs legacy por compatibilidad
        supabase
          .from('temperature_logs')
          .select('*')
          .in('bioterio_id', [BIOTERIO_RATONES, ...RATONES_LEGACY])
          .order('date', { ascending: false })
          .order('time', { ascending: false }),
      ])

      if (resRatas.error)   throw resRatas.error
      if (resRatones.error) throw resRatones.error

      setRegsRatas(resRatas.data ?? [])
      setRegsRatones(resRatones.data ?? [])
    } catch (e) {
      console.error('Error carga temperaturas:', e)
      setErrorCarga('No se pudo cargar los registros. Verificá la conexión.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  // ── Registros activos según la tab ────────────────────────────────────────
  const regs    = bio === 'ratas' ? regsRatas   : regsRatones
  const setRegs = bio === 'ratas' ? setRegsRatas : setRegsRatones
  const cfg     = CFG[bio]

  // ── Hoy ───────────────────────────────────────────────────────────────────
  const hoy = fechaHoy()

  const registrosHoy = useMemo(
    () => regs.filter(r => r.date === hoy).sort((a, b) => b.time.localeCompare(a.time)),
    [regs, hoy]
  )

  // ── Mes seleccionado ──────────────────────────────────────────────────────
  const registrosMes = useMemo(
    () => regs
      .filter(r => r.date?.startsWith(mesSelec))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [regs, mesSelec]
  )

  const diasMes = useMemo(() => {
    const mapa = {}
    for (const r of registrosMes) {
      if (!mapa[r.date]) mapa[r.date] = []
      mapa[r.date].push(r)
    }
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  }, [registrosMes])

  const promedioMes = useMemo(() => ({
    actual: promedio(registrosMes.map(r => r.current_temp)),
    min:    promedio(registrosMes.map(r => r.min_temp)),
    max:    promedio(registrosMes.map(r => r.max_temp)),
  }), [registrosMes])

  // ── Guardar registro ──────────────────────────────────────────────────────
  async function guardar() {
    if (actual === '') { setErrorForm('Ingresá la temperatura actual.'); return }
    setErrorForm('')
    setGuardando(true)
    try {
      const bioterio_id = bio === 'ratas' ? BIOTERIO_RATAS : BIOTERIO_RATONES
      const payload = {
        bioterio_id,
        date:         hoy,
        time:         horaAhora(),
        current_temp: parseFloat(actual),
        min_temp:     minTemp !== '' ? parseFloat(minTemp) : null,
        max_temp:     maxTemp !== '' ? parseFloat(maxTemp) : null,
      }
      const { data, error } = await supabase
        .from('temperature_logs')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      const nuevo = data ?? { ...payload, id: generarId() }
      setRegs(prev => [nuevo, ...prev])
      setActual('')
      setMinTemp('')
      setMaxTemp('')
      setFormAbierto(false)
    } catch {
      setErrorForm('No se pudo guardar. Verificá la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar mes ──────────────────────────────────────────────────────────
  async function eliminarMes() {
    setEliminando(true)
    try {
      const bioterio_id = bio === 'ratas' ? BIOTERIO_RATAS : BIOTERIO_RATONES
      const { error } = await supabase
        .from('temperature_logs')
        .delete()
        .eq('bioterio_id', bioterio_id)
        .like('date', `${mesSelec}%`)

      if (error) throw error

      setRegs(prev => prev.filter(r => !r.date?.startsWith(mesSelec)))
    } catch (e) {
      console.error('Error eliminando mes:', e)
    } finally {
      setEliminando(false)
      setConfirmElim(false)
    }
  }

  // ── Cambiar tab (limpia estado del form) ──────────────────────────────────
  function cambiarBio(nuevo) {
    setBio(nuevo)
    setFormAbierto(false)
    setActual('')
    setMinTemp('')
    setMaxTemp('')
    setErrorForm('')
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
          .print-header p  { font-size: 12px; margin: 0; color: #555; }
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
          <h1>
            Registro de Temperatura — {cfg.label}
          </h1>
          <p>
            {labelMes(mesSelec)} · Generado: {new Date().toLocaleDateString('es-AR')}
            {bio === 'ratones' && ' · Balb/C + C57 + Híbridos (ambiente compartido)'}
          </p>
        </div>

        {diasMes.length === 0 ? (
          <p>Sin registros para este mes.</p>
        ) : (
          diasMes.map(([fecha, rs]) => {
            const avgC  = promedio(rs.map(r => r.current_temp))
            const avgMn = promedio(rs.map(r => r.min_temp))
            const avgMx = promedio(rs.map(r => r.max_temp))
            const [, m, d] = fecha.split('-')
            return (
              <div key={fecha} className="print-section">
                <div className="print-day-title">{d}/{m}/{fecha.slice(0, 4)}</div>
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
                    {rs.map(r => (
                      <tr key={r.id}>
                        <td>{r.time?.slice(0, 5)}</td>
                        <td>{formatTemp(r.current_temp)}</td>
                        <td>{formatTemp(r.min_temp)}</td>
                        <td>{formatTemp(r.max_temp)}</td>
                      </tr>
                    ))}
                    {rs.length > 1 && (
                      <tr className="print-avg-row">
                        <td>Promedio</td>
                        <td>{avgC  != null ? formatTemp(avgC.toFixed(1))  : '—'}</td>
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
            <div className="print-day-title">Promedio mensual — {labelMes(mesSelec)}</div>
            <table className="print-table">
              <tbody>
                <tr><td><strong>Temperatura actual</strong></td><td>{promedioMes.actual != null ? formatTemp(promedioMes.actual.toFixed(1)) : '—'}</td></tr>
                <tr><td><strong>Temperatura mínima</strong></td><td>{promedioMes.min    != null ? formatTemp(promedioMes.min.toFixed(1))    : '—'}</td></tr>
                <tr><td><strong>Temperatura máxima</strong></td><td>{promedioMes.max    != null ? formatTemp(promedioMes.max.toFixed(1))    : '—'}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── UI principal ── */}
      <div className="no-print flex flex-col gap-5 p-4 md:p-6 max-w-4xl mx-auto" style={{ color: '#e2e8f0' }}>

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            title="Volver al Panel de hoy"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-opacity hover:opacity-70 active:opacity-50 flex-shrink-0"
            style={{ background: tema.bgCard, color: tema.textMuted, border: `1px solid ${tema.border}` }}
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-wide" style={{ color: tema.textPrimary }}>🌡️ Temperatura</h1>
            <p className="text-xs font-mono mt-1" style={{ color: tema.textMuted }}>
              Registro ambiental por bioterio físico
            </p>
          </div>
        </div>

        {/* Error de carga */}
        {errorCarga && (
          <div className="rounded-xl px-4 py-3 text-sm font-mono" style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: tema.red }}>
            ⚠️ {errorCarga}
          </div>
        )}

        {/* ── Tabs de bioterio ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: CARD_BG, border: BORDER }}
        >
          {/* Selector de bioterio */}
          <div
            className="flex"
            style={{ borderBottom: BORDER }}
          >
            {['ratas', 'ratones'].map(b => {
              const c = CFG[b]
              const activo = bio === b
              return (
                <button
                  key={b}
                  onClick={() => cambiarBio(b)}
                  className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all"
                  style={{
                    background: activo ? `${c.color}0d` : 'transparent',
                    borderBottom: activo ? `2px solid ${c.color}` : '2px solid transparent',
                    color: activo ? c.color : tema.textMuted,
                  }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                  {cargando && (
                    <span
                      className="w-3 h-3 rounded-full border border-t-transparent animate-spin ml-1"
                      style={{ borderColor: c.color, borderTopColor: 'transparent' }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Nota ratones */}
          {bio === 'ratones' && (
            <div
              className="px-5 py-2 text-xs font-mono flex items-center gap-2"
              style={{ background: 'rgba(64,196,255,0.04)', borderBottom: '1px solid rgba(64,196,255,0.1)', color: tema.textMuted }}
            >
              <span style={{ color: tema.blue }}>ℹ</span>
              Balb/C · C57 · Híbridos comparten el mismo ambiente físico — un único registro.
            </div>
          )}

          {/* ── Botón agregar + formulario ── */}
          <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: BORDER }}>
            <div className="text-xs font-mono" style={{ color: tema.textMuted }}>
              Hoy · <span style={{ color: tema.textPrimary }}>{hoy.split('-').reverse().join('/')}</span>
              {' · '}
              <span style={{ color: cfg.color }}>{registrosHoy.length} registro{registrosHoy.length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setFormAbierto(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0"
              style={{
                background: formAbierto ? `${cfg.color}10` : `${cfg.color}0d`,
                border: `1px solid ${formAbierto ? cfg.color + '55' : cfg.color + '30'}`,
                color: cfg.color,
              }}
            >
              {formAbierto ? '✕ Cancelar' : '+ Agregar registro'}
            </button>
          </div>

          {formAbierto && (
            <div className="px-5 py-4 space-y-4" style={{ borderBottom: BORDER, background: 'rgba(0,0,0,0.15)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField label="Temp. actual *" value={actual}  onChange={setActual}  placeholder="Ej: 22.5" />
                <InputField label="Temp. mínima"   value={minTemp} onChange={setMinTemp} placeholder="Ej: 20.0" />
                <InputField label="Temp. máxima"   value={maxTemp} onChange={setMaxTemp} placeholder="Ej: 25.5" />
              </div>
              {errorForm && (
                <p className="text-xs font-mono" style={{ color: tema.red }}>{errorForm}</p>
              )}
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: `${cfg.color}15`,
                  border: `1px solid ${cfg.color}45`,
                  color: cfg.color,
                  opacity: guardando ? 0.5 : 1,
                }}
              >
                {guardando ? 'Guardando...' : 'Guardar registro'}
              </button>
            </div>
          )}

          {/* ── Registros de hoy ── */}
          {registrosHoy.length > 0 && (
            <div>
              <div
                className="px-5 py-2 text-xs font-bold uppercase tracking-widest"
                style={{ color: cfg.color, background: `${cfg.color}06`, borderBottom: BORDER }}
              >
                Registros de hoy
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.35)' }}>
                {registrosHoy.map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-5 flex-wrap">
                    <span className="font-mono text-sm font-bold" style={{ color: cfg.color, minWidth: '48px' }}>
                      {r.time?.slice(0, 5)}
                    </span>
                    <TempChip label="Actual" value={r.current_temp} color="#00e676" />
                    <TempChip label="Mín"    value={r.min_temp}     color="#40c4ff" />
                    <TempChip label="Máx"    value={r.max_temp}     color="#ff6b80" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!cargando && registrosHoy.length === 0 && !formAbierto && (
            <div className="px-5 py-6 text-center text-sm font-mono" style={{ color: '#2a3a50' }}>
              Sin registros para hoy — presioná "+ Agregar registro"
            </div>
          )}
        </div>

        {/* ── Vista mensual ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: BORDER }}>

          {/* Header mensual */}
          <div
            className="px-5 py-3 flex items-center gap-3 flex-wrap"
            style={{ borderBottom: BORDER, background: 'rgba(255,179,0,0.06)' }}
          >
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tema.amber }}>
              📋 Planilla mensual — {cfg.label}
            </span>
            <input
              type="month"
              value={mesSelec}
              onChange={e => { setMesSelec(e.target.value); setConfirmElim(false) }}
              className="ml-auto rounded-lg px-2 py-1 text-xs font-mono outline-none"
              style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.8)', color: '#e2e8f0' }}
            />
            <button
              onClick={imprimir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', color: tema.amber }}
            >
              🖨️ Imprimir {bio === 'ratas' ? 'Ratas' : 'Ratones'}
            </button>
          </div>

          {cargando ? (
            <div className="px-5 py-8 text-center">
              <span
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin inline-block"
                style={{ borderColor: cfg.color, borderTopColor: 'transparent' }}
              />
            </div>
          ) : registrosMes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm font-mono" style={{ color: tema.textMuted }}>
              Sin registros para {labelMes(mesSelec)}
            </div>
          ) : (
            <>
              {/* Promedios del mes */}
              <div className="px-5 py-4 grid grid-cols-3 gap-3" style={{ borderBottom: BORDER }}>
                <PromedioCard label="Promedio actual" value={promedioMes.actual} color="#00e676" />
                <PromedioCard label="Promedio mínima" value={promedioMes.min}    color="#40c4ff" />
                <PromedioCard label="Promedio máxima" value={promedioMes.max}    color="#ff6b80" />
              </div>

              {/* Tabla */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr style={{ borderBottom: BORDER }}>
                      <th className="px-5 py-2 text-left font-semibold" style={{ color: tema.textMuted }}>Fecha</th>
                      <th className="px-5 py-2 text-left font-semibold" style={{ color: tema.textMuted }}>Hora</th>
                      <th className="px-5 py-2 text-right font-semibold" style={{ color: tema.accent }}>Actual</th>
                      <th className="px-5 py-2 text-right font-semibold" style={{ color: tema.blue }}>Mín</th>
                      <th className="px-5 py-2 text-right font-semibold" style={{ color: tema.red }}>Máx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diasMes.map(([fecha, rs]) => {
                      const [, m, d] = fecha.split('-')
                      return rs.map((r, i) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.25)' }}>
                          <td className="px-5 py-2" style={{ color: i === 0 ? '#e2e8f0' : 'transparent' }}>
                            {d}/{m}
                          </td>
                          <td className="px-5 py-2" style={{ color: '#6a8099' }}>{r.time?.slice(0, 5)}</td>
                          <td className="px-5 py-2 text-right" style={{ color: tema.accent }}>{formatTemp(r.current_temp)}</td>
                          <td className="px-5 py-2 text-right" style={{ color: tema.blue }}>{formatTemp(r.min_temp)}</td>
                          <td className="px-5 py-2 text-right" style={{ color: tema.red }}>{formatTemp(r.max_temp)}</td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>

              {/* Eliminar mes */}
              <div className="px-5 py-4" style={{ borderTop: BORDER }}>
                {!confirmElim ? (
                  <button
                    onClick={() => setConfirmElim(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(255,61,87,0.05)', border: '1px solid rgba(255,61,87,0.2)', color: tema.red }}
                  >
                    🗑️ Eliminar registros de {labelMes(mesSelec)}
                  </button>
                ) : (
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.25)' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: tema.red }}>⚠️ ¿Confirmar eliminación?</p>
                    <p className="text-xs" style={{ color: tema.textSecondary }}>
                      Se van a borrar los {registrosMes.length} registros de {labelMes(mesSelec)} del {cfg.label}.
                      Asegurate de haber impreso los datos antes de continuar.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={eliminarMes}
                        disabled={eliminando}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.4)', color: tema.red, opacity: eliminando ? 0.5 : 1 }}
                      >
                        {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                      </button>
                      <button
                        onClick={() => setConfirmElim(false)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.6)', color: tema.textSecondary }}
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

// ── Sub-componentes ────────────────────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder }) {
  const { tema } = useTheme()
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>
        {label}
      </label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg px-3 py-2 text-sm font-mono outline-none"
        style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.8)', color: '#e2e8f0' }}
      />
    </div>
  )
}

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
  const { tema } = useTheme()
  return (
    <div
      className="rounded-xl px-3 py-2 text-center"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}
    >
      <div className="text-xs font-mono font-bold" style={{ color }}>
        {value != null ? formatTemp(value.toFixed(1)) : '—'}
      </div>
      <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{label}</div>
    </div>
  )
}
