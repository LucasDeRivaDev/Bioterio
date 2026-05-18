import { useState, useRef, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { hoy, formatFecha } from '../utils/calculos'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

const inputStyle = {
  background: 'rgba(5,8,16,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
}

const BIOTERIOS = [
  { id: 'todos',            label: 'Todos',    color: '#8a9bb0' },
  { id: 'ratas',            label: 'Ratas',    color: '#40c4ff' },
  { id: 'ratones_balbc',    label: 'BALB/C',   color: '#a78bfa' },
  { id: 'ratones_c57',      label: 'C57',      color: '#34d399' },
  { id: 'ratones_hibridos', label: 'Híbridos', color: '#fb923c' },
]

function labelBioterio(id) {
  return BIOTERIOS.find((b) => b.id === id)?.label ?? id ?? '—'
}

function colorBioterio(id) {
  return BIOTERIOS.find((b) => b.id === id)?.color ?? '#8a9bb0'
}

export default function Incidentes() {
  const { incidentes, agregarIncidente, eliminarIncidente } = useBioterio()
  const { bioterioActivo } = useBioterioActivo()

  const [filtro, setFiltro]             = useState('todos')
  const [mostrarForm, setMostrarForm]   = useState(false)
  const [fecha, setFecha]               = useState(hoy())
  const [descripcion, setDescripcion]   = useState('')
  const [guardando, setGuardando]       = useState(false)
  const [error, setError]               = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const textareaRef = useRef(null)

  const incidentesFiltrados = useMemo(() => {
    if (filtro === 'todos') return incidentes
    return incidentes.filter((i) => i.bioterio_id === filtro)
  }, [incidentes, filtro])

  // Conteo por bioterio para los tabs
  const conteos = useMemo(() => {
    const map = { todos: incidentes.length }
    for (const b of BIOTERIOS.slice(1)) {
      map[b.id] = incidentes.filter((i) => i.bioterio_id === b.id).length
    }
    return map
  }, [incidentes])

  function abrirForm() {
    setFecha(hoy())
    setDescripcion('')
    setError('')
    setMostrarForm(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setDescripcion('')
    setError('')
  }

  async function guardar(e) {
    e.preventDefault()
    if (!descripcion.trim()) { setError('La descripción no puede estar vacía.'); return }
    setGuardando(true)
    setError('')
    try {
      await agregarIncidente({ fecha, descripcion: descripcion.trim() })
      cerrarForm()
    } catch {
      setError('No se pudo guardar. Verificá la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  const labelFiltroActual = BIOTERIOS.find((b) => b.id === filtro)?.label ?? 'Todos'

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#ffb300', boxShadow: '0 0 8px rgba(255,179,0,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Registro global de incidentes</h1>
            <p className="text-xs mt-0.5 font-mono" style={{ color: '#4a5f7a' }}>
              {incidentes.length} registro{incidentes.length !== 1 ? 's' : ''} en todos los bioterios
              {' · '}registrando desde{' '}
              <span style={{ color: colorBioterio(bioterioActivo) }}>{labelBioterio(bioterioActivo)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {incidentes.length > 0 && (
            <button
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.25)', color: '#40c4ff' }}
            >
              🖨 Imprimir
            </button>
          )}
          <button
            onClick={abrirForm}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'rgba(255,179,0,0.12)',
              border: '1.5px solid rgba(255,179,0,0.35)',
              color: '#ffb300',
              boxShadow: '0 0 12px rgba(255,179,0,0.08)',
            }}
          >
            + Nuevo incidente
          </button>
        </div>
      </div>

      {/* Filtros por bioterio */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {BIOTERIOS.map((b) => {
          const activo = filtro === b.id
          const count = conteos[b.id] ?? 0
          return (
            <button
              key={b.id}
              onClick={() => setFiltro(b.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: activo ? `${b.color}22` : 'rgba(13,21,40,0.6)',
                border: activo ? `1px solid ${b.color}55` : '1px solid rgba(30,51,82,0.6)',
                color: activo ? b.color : '#4a5f7a',
              }}
            >
              {b.label}
              {count > 0 && (
                <span
                  className="text-xs font-mono px-1 rounded"
                  style={{ background: activo ? `${b.color}33` : 'rgba(74,95,122,0.2)', color: activo ? b.color : '#4a5f7a' }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Formulario nuevo incidente */}
      {mostrarForm && (
        <form
          onSubmit={guardar}
          className="rounded-2xl p-5 space-y-4 print:hidden"
          style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.25)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ffb300' }}>
              📝 Nuevo incidente
            </div>
            <div className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: `${colorBioterio(bioterioActivo)}22`, border: `1px solid ${colorBioterio(bioterioActivo)}44`, color: colorBioterio(bioterioActivo) }}>
              📍 Origen: {labelBioterio(bioterioActivo)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
            </div>

            {/* Descripción */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
                Descripción / Observaciones
              </label>
              <textarea
                ref={textareaRef}
                value={descripcion}
                onChange={(e) => { setDescripcion(e.target.value); setError('') }}
                placeholder="Ej: Problema con alimentación en jaula 3, temperatura fuera de rango, hembra no parió..."
                rows={3}
                required
                style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              />
            </div>
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={guardando || !descripcion.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,179,0,0.15)',
                border: '1px solid rgba(255,179,0,0.4)',
                color: '#ffb300',
                cursor: guardando || !descripcion.trim() ? 'not-allowed' : 'pointer',
                opacity: guardando || !descripcion.trim() ? 0.6 : 1,
              }}
            >
              {guardando ? 'Guardando...' : '✓ Guardar incidente'}
            </button>
            <button
              type="button"
              onClick={cerrarForm}
              className="px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#4a5f7a' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista de incidentes */}
      {incidentesFiltrados.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'rgba(255,179,0,0.03)', border: '1px dashed rgba(255,179,0,0.2)' }}
        >
          <div className="text-4xl mb-3">📋</div>
          <div className="font-semibold text-sm text-white mb-1">
            {filtro === 'todos' ? 'Sin incidentes registrados' : `Sin incidentes en ${labelFiltroActual}`}
          </div>
          <div className="text-xs" style={{ color: '#4a5f7a' }}>
            Registrá cualquier evento imprevisto u observación relevante del bioterio
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          {/* Encabezado tabla — solo visible al imprimir */}
          <div
            className="hidden print:block px-6 py-4"
            style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}
          >
            <div className="font-bold text-lg text-white">Bioterio — Registro global de incidentes</div>
            <div className="text-sm mt-0.5" style={{ color: '#4a5f7a' }}>
              Impreso el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {' '}· {incidentesFiltrados.length} registro{incidentesFiltrados.length !== 1 ? 's' : ''}
              {filtro !== 'todos' && ` · Filtro: ${labelFiltroActual}`}
            </div>
          </div>

          {/* Encabezado columnas */}
          <div
            className="hidden md:grid px-5 py-2 text-xs font-semibold uppercase tracking-widest print:grid"
            style={{
              gridTemplateColumns: '2rem 7rem 6rem 1fr 2rem',
              borderBottom: '1px solid rgba(30,51,82,0.6)',
              color: '#4a5f7a',
              background: 'rgba(0,0,0,0.15)',
            }}
          >
            <span>#</span>
            <span>Fecha</span>
            <span>Origen</span>
            <span>Descripción</span>
            <span className="print:hidden" />
          </div>

          <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.4)' }}>
            {incidentesFiltrados.map((inc, idx) => (
              <div
                key={inc.id}
                className="px-5 py-4 flex items-start gap-3 group transition-colors hover:bg-white/[0.01]"
              >
                {/* Número */}
                <span
                  className="font-mono text-xs font-bold mt-0.5 shrink-0 w-6 text-right"
                  style={{ color: 'rgba(74,95,122,0.4)' }}
                >
                  {incidentesFiltrados.length - idx}
                </span>

                {/* Fecha */}
                <div
                  className="font-mono text-sm font-semibold shrink-0 mt-0.5"
                  style={{ color: '#ffb300', minWidth: '88px' }}
                >
                  {formatFecha(inc.fecha)}
                </div>

                {/* Badge origen */}
                <div className="shrink-0 mt-0.5">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      background: `${colorBioterio(inc.bioterio_id)}18`,
                      border: `1px solid ${colorBioterio(inc.bioterio_id)}40`,
                      color: colorBioterio(inc.bioterio_id),
                      minWidth: '56px',
                      display: 'inline-block',
                      textAlign: 'center',
                    }}
                  >
                    {labelBioterio(inc.bioterio_id)}
                  </span>
                </div>

                {/* Descripción */}
                <div className="flex-1 text-sm leading-relaxed" style={{ color: '#c9d4e0' }}>
                  {inc.descripcion}
                </div>

                {/* Botón eliminar */}
                <button
                  onClick={() => setConfirmarEliminar(inc)}
                  title="Eliminar incidente"
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all print:hidden opacity-0 group-hover:opacity-100"
                  style={{
                    background: 'rgba(255,61,87,0.08)',
                    border: '1px solid rgba(255,61,87,0.2)',
                    color: '#ff6b80',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmarEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmarEliminar(null) }}
        >
          <div
            className="rounded-2xl p-6 space-y-4 w-full max-w-sm"
            style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(255,61,87,0.3)', boxShadow: '0 0 40px rgba(255,61,87,0.1)' }}
          >
            <div className="text-center space-y-2">
              <div className="text-3xl">🗑️</div>
              <div className="font-bold text-white text-sm">Eliminar incidente</div>
              <div
                className="text-xs px-3 py-2 rounded-lg text-left leading-relaxed space-y-1"
                style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.15)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold" style={{ color: '#ffb300' }}>{formatFecha(confirmarEliminar.fecha)}</span>
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${colorBioterio(confirmarEliminar.bioterio_id)}20`, color: colorBioterio(confirmarEliminar.bioterio_id) }}
                  >
                    {labelBioterio(confirmarEliminar.bioterio_id)}
                  </span>
                </div>
                <div style={{ color: '#8a9bb0' }}>
                  {confirmarEliminar.descripcion.length > 80
                    ? confirmarEliminar.descripcion.slice(0, 80) + '...'
                    : confirmarEliminar.descripcion}
                </div>
              </div>
              <p className="text-xs" style={{ color: '#4a5f7a' }}>Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarEliminar(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { eliminarIncidente(confirmarEliminar.id); setConfirmarEliminar(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.35)', color: '#ff6b80' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:grid { display: grid !important; }
        }
      `}</style>
    </div>
  )
}
