// ─────────────────────────────────────────────────────────────────────────────
// Pedidos.jsx — Sistema de gestión de pedidos de producción
// Gestión · Análisis automático · Estrategia optimizada · Calendario
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react'
import { useBioterio }        from '../context/BiotheriumContext'
import { useBioterioActivo }  from '../context/BioterioActivoContext'
import { useTheme }           from '../context/ThemeContext'
import { getBio }             from '../utils/constants'
import { formatFecha }        from '../utils/calculos'
import {
  getPedidos, guardarPedido, eliminarPedido, actualizarEstadoPedido,
  calcularParejasNecesarias, calcularFechasOptimas,
  seleccionarReproductoresOptimos, detectarAnimalesListos,
  evaluarCapacidadFutura, evaluarImpactoColonia, calcularIndiceViabilidad,
  simularEscenarios, generarCalendarioPedido, proyeccionHorizontes,
  nivelViabilidad, labelBioterio, labelSexo, labelUso, colorEstadoPedido,
} from '../utils/motorPedidos'
import { reservarAnimal } from '../utils/motorDecisiones'

// ─── Constantes ────────────────────────────────────────────────────────────
const BIOTERIOS_OPCIONES = [
  { id: 'ratas',            label: '🐀 Ratas (Rattus norvegicus)' },
  { id: 'ratones_balbc',    label: '🐭 BALB/C' },
  { id: 'ratones_c57',      label: '🐭 C57BL/6' },
  { id: 'ratones_hibridos', label: '🧬 Híbridos F1' },
]
const ESTADOS_PEDIDO = [
  { id: 'pendiente',   label: 'Pendiente',   color: '#ffb300' },
  { id: 'en_proceso',  label: 'En proceso',  color: '#40c4ff' },
  { id: 'completado',  label: 'Completado',  color: '#00e676' },
  { id: 'cancelado',   label: 'Cancelado',   color: '#ff6b80' },
]

// ─── Estilos inline compartidos ────────────────────────────────────────────
const INPUT_STYLE = {
  width: '100%', background: 'rgba(8,13,26,0.9)',
  border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0',
  borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none',
}
const LABEL_STYLE = { display: 'block', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a5f7a', marginBottom: '6px' }

// ─── Componente: Badge de viabilidad ──────────────────────────────────────
function ViabilidadBadge({ score, small = false }) {
  const nivel = nivelViabilidad(score)
  return (
    <span
      className="inline-flex items-center gap-1 font-bold rounded-lg"
      style={{
        background: nivel.bg, border: `1px solid ${nivel.borde}`, color: nivel.color,
        padding: small ? '2px 8px' : '4px 10px',
        fontSize: small ? '11px' : '12px',
      }}
    >
      <span>{nivel.emoji}</span>
      <span>{score}</span>
      {!small && <span style={{ fontWeight: 400, opacity: 0.8 }}>{nivel.label}</span>}
    </span>
  )
}

// ─── Componente: Modal de formulario ──────────────────────────────────────
function ModalFormPedido({ pedido, onGuardar, onCerrar, tema }) {
  const [form, setForm] = useState({
    bioterioId:   pedido?.bioterioId   ?? 'ratas',
    cantidad:     pedido?.cantidad     ?? '',
    sexo:         pedido?.sexo         ?? 'ambos',
    edadSemanas:  pedido?.edadSemanas  ?? '',
    fechaEntrega: pedido?.fechaEntrega ?? '',
    uso:          pedido?.uso          ?? 'investigacion',
    solicitante:  pedido?.solicitante  ?? '',
    notas:        pedido?.notas        ?? '',
    ...(pedido?.id ? { id: pedido.id, estado: pedido.estado } : {}),
  })

  const esValido = form.cantidad > 0 && form.edadSemanas > 0 && form.fechaEntrega

  function guardar(e) {
    e.preventDefault()
    if (!esValido) return
    onGuardar({ ...form, cantidad: Number(form.cantidad), edadSemanas: Number(form.edadSemanas) })
  }

  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: '14px' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, boxShadow: '0 0 60px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${tema.bgCardBorde}`, background: 'rgba(0,230,118,0.03)' }}
        >
          <div>
            <div className="font-bold text-base" style={{ color: tema.textPrimary }}>
              {form.id ? '✏️ Editar pedido' : '📦 Nuevo pedido'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
              Completá los datos para calcular la estrategia automática
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={guardar} className="px-6 py-5 space-y-4">
          {/* Bioterio */}
          <div>
            <label style={LABEL_STYLE}>Colonia / línea</label>
            <select value={form.bioterioId} onChange={e => setForm(f => ({ ...f, bioterioId: e.target.value }))}
              style={INPUT_STYLE}
            >
              {BIOTERIOS_OPCIONES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>

          {/* Cantidad + Edad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={LABEL_STYLE}>Cantidad requerida</label>
              <input type="number" min="1" value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                placeholder="Ej: 40"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Edad (semanas)</label>
              <input type="number" min="1" max="52" value={form.edadSemanas}
                onChange={e => setForm(f => ({ ...f, edadSemanas: e.target.value }))}
                placeholder="Ej: 8"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Sexo */}
          <div>
            <label style={LABEL_STYLE}>Sexo requerido</label>
            <div className="flex gap-2">
              {[
                { id: 'machos',  label: '♂ Machos'  },
                { id: 'hembras', label: '♀ Hembras' },
                { id: 'ambos',   label: '♂♀ Ambos'  },
              ].map(s => (
                <button key={s.id} type="button"
                  onClick={() => setForm(f => ({ ...f, sexo: s.id }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: form.sexo === s.id ? 'rgba(0,230,118,0.12)' : 'rgba(8,13,26,0.6)',
                    border: form.sexo === s.id ? '1.5px solid rgba(0,230,118,0.4)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.sexo === s.id ? '#00e676' : '#4a5f7a',
                    cursor: 'pointer',
                  }}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Fecha entrega */}
          <div>
            <label style={LABEL_STYLE}>Fecha de entrega</label>
            <input type="date" value={form.fechaEntrega}
              onChange={e => setForm(f => ({ ...f, fechaEntrega: e.target.value }))}
              style={INPUT_STYLE}
            />
          </div>

          {/* Uso */}
          <div>
            <label style={LABEL_STYLE}>Uso destino</label>
            <div className="flex gap-2">
              {[
                { id: 'investigacion', label: '🔬 Investigación' },
                { id: 'produccion',    label: '🏭 Producción'    },
                { id: 'stock',         label: '📦 Stock'          },
              ].map(u => (
                <button key={u.id} type="button"
                  onClick={() => setForm(f => ({ ...f, uso: u.id }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: form.uso === u.id ? 'rgba(64,196,255,0.1)' : 'rgba(8,13,26,0.6)',
                    border: form.uso === u.id ? '1.5px solid rgba(64,196,255,0.35)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.uso === u.id ? '#40c4ff' : '#4a5f7a',
                    cursor: 'pointer',
                  }}
                >{u.label}</button>
              ))}
            </div>
          </div>

          {/* Solicitante + Notas */}
          <div>
            <label style={LABEL_STYLE}>Solicitante (opcional)</label>
            <input type="text" value={form.solicitante}
              onChange={e => setForm(f => ({ ...f, solicitante: e.target.value }))}
              placeholder="Nombre del investigador o laboratorio"
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Notas</label>
            <textarea rows={2} value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observaciones adicionales..."
              style={{ ...INPUT_STYLE, resize: 'none' }}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}
            >Cancelar</button>
            <button type="submit" disabled={!esValido}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: esValido ? 'rgba(0,230,118,0.15)' : 'rgba(30,51,82,0.3)',
                border: `1.5px solid ${esValido ? 'rgba(0,230,118,0.4)' : 'rgba(30,51,82,0.5)'}`,
                color: esValido ? '#00e676' : '#4a5f7a',
                cursor: esValido ? 'pointer' : 'not-allowed',
              }}
            >{form.id ? '✓ Guardar cambios' : '+ Crear pedido'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Componente: Tarjeta de pedido en la lista ─────────────────────────────
function TarjetaPedido({ pedido, seleccionado, onSeleccionar, onEditar, onEliminar, onCambiarEstado, score, tema }) {
  const nivel    = nivelViabilidad(score ?? 0)
  const colorEst = colorEstadoPedido(pedido.estado)
  const estadoObj = ESTADOS_PEDIDO.find(e => e.id === pedido.estado)

  return (
    <div
      onClick={() => onSeleccionar(pedido.id)}
      className="rounded-xl p-3 cursor-pointer transition-all"
      style={{
        background: seleccionado ? 'rgba(0,230,118,0.06)' : tema.bgCard,
        border: `1.5px solid ${seleccionado ? 'rgba(0,230,118,0.3)' : tema.bgCardBorde}`,
        boxShadow: seleccionado ? '0 0 16px rgba(0,230,118,0.08)' : 'none',
      }}
    >
      {/* Fila superior: bioterio + viabilidad */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold" style={{ color: tema.textMuted }}>
          {labelBioterio(pedido.bioterioId)}
        </span>
        <ViabilidadBadge score={score ?? '—'} small />
      </div>

      {/* Info principal */}
      <div className="font-bold text-sm mb-1" style={{ color: tema.textPrimary }}>
        {pedido.cantidad} {labelSexo(pedido.sexo)}
        <span className="font-normal text-xs ml-2" style={{ color: tema.textMuted }}>
          · {pedido.edadSemanas} sem
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-xs" style={{ color: tema.textMuted }}>📅 {formatFecha(pedido.fechaEntrega)}</span>
        <span className="text-xs" style={{ color: tema.textMuted }}>· {labelUso(pedido.uso)}</span>
      </div>

      {pedido.solicitante && (
        <div className="text-xs mb-2" style={{ color: tema.textMuted }}>👤 {pedido.solicitante}</div>
      )}

      {/* Estado + acciones */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
          style={{ background: colorEst.bg, border: `1px solid ${colorEst.borde}`, color: colorEst.color }}
        >
          {estadoObj?.label ?? pedido.estado}
        </span>
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation(); onEditar(pedido) }}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'rgba(30,51,82,0.5)', border: '1px solid rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}
          >✏️</button>
          <button onClick={e => { e.stopPropagation(); onEliminar(pedido.id) }}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80', cursor: 'pointer' }}
          >✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente: Sección de análisis completo ─────────────────────────────
function AnalisisPedido({ pedido, analisis, onCambiarEstado, onReservarReproductores, tema }) {
  const [seccionAbierta, setSeccionAbierta] = useState('general')

  const {
    bio, parejasNecesarias, fechasOptimas, reproductoresSeleccionados,
    animalesListos, capacidadFutura, impactoColonia, viabilidad,
    escenarios, calendario, horizontes,
  } = analisis

  const nivel = nivelViabilidad(viabilidad.score)
  const colorEst = colorEstadoPedido(pedido.estado)

  function SeccionCard({ id, titulo, children }) {
    const abierta = seccionAbierta === id
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tema.bgCardBorde}` }}>
        <button
          onClick={() => setSeccionAbierta(abierta ? null : id)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: abierta ? 'rgba(0,230,118,0.04)' : tema.bgCard, cursor: 'pointer', border: 'none' }}
        >
          <span className="text-sm font-semibold" style={{ color: abierta ? '#00e676' : tema.textSecondary }}>{titulo}</span>
          <span style={{ color: abierta ? '#00e676' : tema.textMuted }}>{abierta ? '▲' : '▼'}</span>
        </button>
        {abierta && (
          <div className="px-4 pb-4 pt-2" style={{ background: tema.bgCard, borderTop: `1px solid ${tema.bgCardBorde}` }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  function KPI({ label, valor, color, sub }) {
    return (
      <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(8,13,26,0.4)', border: `1px solid ${tema.bgCardBorde}` }}>
        <div className="font-mono font-bold text-lg" style={{ color: color ?? '#c9d4e0' }}>{valor}</div>
        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#3a5068' }}>{sub}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header del análisis */}
      <div className="rounded-2xl p-4" style={{ background: tema.bgCard, border: `1px solid ${nivel.borde}`, boxShadow: `0 0 20px ${nivel.bg}` }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base" style={{ color: tema.textPrimary }}>
                {pedido.cantidad} {labelSexo(pedido.sexo)} · {pedido.edadSemanas} sem
              </span>
              <span className="text-xs px-2 py-0.5 rounded-lg"
                style={{ background: colorEst.bg, border: `1px solid ${colorEst.borde}`, color: colorEst.color }}
              >
                {ESTADOS_PEDIDO.find(e => e.id === pedido.estado)?.label}
              </span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <span className="text-xs" style={{ color: tema.textMuted }}>{labelBioterio(pedido.bioterioId)}</span>
              <span className="text-xs" style={{ color: tema.textMuted }}>📅 {formatFecha(pedido.fechaEntrega)}</span>
              <span className="text-xs" style={{ color: tema.textMuted }}>{labelUso(pedido.uso)}</span>
              {pedido.solicitante && <span className="text-xs" style={{ color: tema.textMuted }}>👤 {pedido.solicitante}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-center px-4 py-2 rounded-xl"
              style={{ background: nivel.bg, border: `1.5px solid ${nivel.borde}` }}
            >
              <div className="font-mono font-bold text-2xl" style={{ color: nivel.color }}>{viabilidad.score}</div>
              <div className="text-xs font-semibold" style={{ color: nivel.color }}>{nivel.emoji} {nivel.label}</div>
            </div>
          </div>
        </div>

        {/* Acciones de estado */}
        <div className="flex gap-2 flex-wrap mt-3 pt-3" style={{ borderTop: `1px solid ${tema.bgCardBorde}` }}>
          {pedido.estado === 'pendiente' && (
            <>
              <button onClick={() => onCambiarEstado(pedido.id, 'en_proceso')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff', cursor: 'pointer' }}
              >▶ Iniciar pedido</button>
              {reproductoresSeleccionados.suficientesHembras && (
                <button onClick={() => onReservarReproductores(pedido)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: '#ffb300', cursor: 'pointer' }}
                >🔒 Reservar reproductores</button>
              )}
            </>
          )}
          {pedido.estado === 'en_proceso' && (
            <button onClick={() => onCambiarEstado(pedido.id, 'completado')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', cursor: 'pointer' }}
            >✓ Marcar completado</button>
          )}
          {!['cancelado', 'completado'].includes(pedido.estado) && (
            <button onClick={() => onCambiarEstado(pedido.id, 'cancelado')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80', cursor: 'pointer' }}
            >✕ Cancelar</button>
          )}
        </div>
      </div>

      {/* ─── SECCIÓN: Parejas necesarias ─────────── */}
      <SeccionCard id="parejas" titulo="📊 Parejas necesarias y probabilidad">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <KPI label="♀ Hembras" valor={parejasNecesarias.hembrasNecesarias} color="#ce93d8" />
          <KPI label="♂ Machos"  valor={parejasNecesarias.machosNecesarios}  color="#40c4ff" />
          <KPI label="Prob. cumplimiento" valor={`${parejasNecesarias.probabilidad}%`} color="#00e676" />
          <KPI label="Crías estimadas" valor={parejasNecesarias.animalesEstimados} color="#c9d4e0" />
        </div>
        {!parejasNecesarias.hist.conDatos && (
          <div className="rounded-lg px-3 py-2 text-xs mb-2"
            style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}
          >
            ⚠ Calculado con valores bibliográficos — registrá más camadas para mayor precisión
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(8,13,26,0.4)', border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="font-mono font-semibold" style={{ color: '#c9d4e0' }}>{parejasNecesarias.hist.promedioTamano}</div>
            <div style={{ color: '#4a5f7a' }}>Camada promedio</div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(8,13,26,0.4)', border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="font-mono font-semibold" style={{ color: '#c9d4e0' }}>{Math.round(parejasNecesarias.hist.tasaSupervivencia * 100)}%</div>
            <div style={{ color: '#4a5f7a' }}>Supervivencia</div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(8,13,26,0.4)', border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="font-mono font-semibold" style={{ color: '#c9d4e0' }}>{parejasNecesarias.hist.nCamadas}</div>
            <div style={{ color: '#4a5f7a' }}>Camadas histórico</div>
          </div>
        </div>
      </SeccionCard>

      {/* ─── SECCIÓN: Fechas óptimas ─────────────── */}
      <SeccionCard id="fechas" titulo="📅 Fechas óptimas del ciclo">
        {fechasOptimas ? (
          <>
            {!fechasOptimas.viable && (
              <div className="rounded-lg px-3 py-2 text-xs mb-3"
                style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}
              >
                ⚠ Tiempo insuficiente para completar el ciclo reproductivo ({fechasOptimas.diasMinimos} días mínimos necesarios, disponibles: {fechasOptimas.diasHastaEntrega})
              </div>
            )}
            {fechasOptimas.urgente && (
              <div className="rounded-lg px-3 py-2 text-xs mb-3"
                style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}
              >
                ⚡ Cópula urgente — quedan {fechasOptimas.diasHastaCopula} días para iniciar los apareamientos
              </div>
            )}
            <div className="space-y-2">
              {[
                { label: '🔗 Iniciar cópulas', fecha: fechasOptimas.fechaCopula, dias: fechasOptimas.diasHastaCopula },
                { label: '↗️ Separar parejas',  fecha: fechasOptimas.fechaSeparacion, dias: null },
                { label: '🐣 Partos esperados', fecha: fechasOptimas.fechaNacimiento, dias: null },
                { label: '🧬 Destete',           fecha: fechasOptimas.fechaDestete,    dias: null },
                { label: '📦 Entrega',           fecha: fechasOptimas.fechaEntrega,    dias: fechasOptimas.diasHastaEntrega },
              ].map((ev, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}
                >
                  <span className="text-xs font-semibold" style={{ color: tema.textSecondary }}>{ev.label}</span>
                  <div className="text-right">
                    <span className="text-xs font-mono" style={{ color: '#c9d4e0' }}>{formatFecha(ev.fecha)}</span>
                    {ev.dias != null && (
                      <span className="text-xs ml-2" style={{ color: ev.dias < 0 ? '#ff6b80' : ev.dias <= 14 ? '#ffb300' : '#4a5f7a' }}>
                        {ev.dias < 0 ? `vencido hace ${Math.abs(ev.dias)}d` : ev.dias === 0 ? 'hoy' : `en ${ev.dias}d`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs text-center py-4" style={{ color: tema.textMuted }}>
            Completá fecha de entrega y edad requerida para calcular el calendario
          </div>
        )}
      </SeccionCard>

      {/* ─── SECCIÓN: Reproductores sugeridos ───── */}
      <SeccionCard id="reproductores" titulo="🔬 Reproductores sugeridos">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg p-2 text-center" style={{
            background: reproductoresSeleccionados.suficientesHembras ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.06)',
            border: `1px solid ${reproductoresSeleccionados.suficientesHembras ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
          }}>
            <div className="text-xs font-bold" style={{ color: reproductoresSeleccionados.suficientesHembras ? '#00e676' : '#ff6b80' }}>
              {reproductoresSeleccionados.hembrasDisponibles} / {reproductoresSeleccionados.hembrasNecesarias}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>♀ Hembras disponibles</div>
          </div>
          <div className="rounded-lg p-2 text-center" style={{
            background: reproductoresSeleccionados.suficientesMachos ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.06)',
            border: `1px solid ${reproductoresSeleccionados.suficientesMachos ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
          }}>
            <div className="text-xs font-bold" style={{ color: reproductoresSeleccionados.suficientesMachos ? '#00e676' : '#ff6b80' }}>
              {reproductoresSeleccionados.machosDisponibles} / {reproductoresSeleccionados.machosNecesarios}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>♂ Machos disponibles</div>
          </div>
        </div>

        {/* Lista de hembras sugeridas */}
        {reproductoresSeleccionados.hembrasSugeridas.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold mb-1" style={{ color: '#ce93d8' }}>♀ Hembras recomendadas</div>
            <div className="space-y-1">
              {reproductoresSeleccionados.hembrasSugeridas.map(({ animal, scoreRepro, fPorc, nivelF, score }) => (
                <div key={animal.id} className="flex items-center justify-between rounded-lg px-3 py-1.5"
                  style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}
                >
                  <span className="text-xs font-mono font-semibold" style={{ color: '#ce93d8' }}>{animal.codigo}</span>
                  <div className="flex gap-3 text-xs" style={{ color: '#4a5f7a' }}>
                    <span>Score: <span style={{ color: '#c9d4e0' }}>{scoreRepro}</span></span>
                    <span>F: <span style={{ color: nivelF === 'alto' ? '#ff6b80' : nivelF === 'moderado' ? '#ffb300' : '#4a5f7a' }}>{fPorc}</span></span>
                    <span style={{ color: '#00e676' }}>{score}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de machos sugeridos */}
        {reproductoresSeleccionados.machosSugeridos.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: '#40c4ff' }}>♂ Machos recomendados</div>
            <div className="space-y-1">
              {reproductoresSeleccionados.machosSugeridos.map(({ animal, scoreRepro, fPorc, nivelF, score }) => (
                <div key={animal.id} className="flex items-center justify-between rounded-lg px-3 py-1.5"
                  style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}
                >
                  <span className="text-xs font-mono font-semibold" style={{ color: '#40c4ff' }}>{animal.codigo}</span>
                  <div className="flex gap-3 text-xs" style={{ color: '#4a5f7a' }}>
                    <span>Score: <span style={{ color: '#c9d4e0' }}>{scoreRepro}</span></span>
                    <span>F: <span style={{ color: nivelF === 'alto' ? '#ff6b80' : nivelF === 'moderado' ? '#ffb300' : '#4a5f7a' }}>{fPorc}</span></span>
                    <span style={{ color: '#00e676' }}>{score}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reproductoresSeleccionados.hembrasDisponibles === 0 && (
          <div className="text-xs text-center py-3" style={{ color: tema.textMuted }}>
            Sin reproductoras libres en el bioterio activo — considerá cambiar de bioterio o revisar estados
          </div>
        )}
      </SeccionCard>

      {/* ─── SECCIÓN: Stock ya disponible ────────── */}
      <SeccionCard id="stock" titulo="📦 Animales listos en stock actual">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <KPI label="Disponibles" valor={animalesListos.disponibles} color="#00e676" />
          <KPI label="Necesarios"  valor={animalesListos.necesarios}  color="#c9d4e0" />
          <KPI label="% cubierto"  valor={`${animalesListos.porcentajeCubierto}%`}
            color={animalesListos.cubiertoConStock ? '#00e676' : animalesListos.porcentajeCubierto > 50 ? '#ffb300' : '#ff6b80'} />
        </div>
        {animalesListos.cubiertoConStock ? (
          <div className="rounded-lg px-3 py-2 text-xs text-center"
            style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}
          >
            ✅ El pedido puede cubrirse con animales ya disponibles en stock — no se necesita nueva camada
          </div>
        ) : animalesListos.disponibles > 0 ? (
          <div className="text-xs" style={{ color: tema.textMuted }}>
            Stock cubre {animalesListos.disponibles}/{animalesListos.necesarios} — faltan {animalesListos.deficit} por producir
          </div>
        ) : (
          <div className="text-xs text-center py-1" style={{ color: tema.textMuted }}>
            Sin animales de stock en el rango de edad requerido (±4 semanas)
          </div>
        )}
      </SeccionCard>

      {/* ─── SECCIÓN: Impacto sobre la colonia ───── */}
      <SeccionCard id="impacto" titulo="⚖️ Impacto sobre la colonia">
        {impactoColonia.impactos.length > 0 ? (
          <div className="space-y-2 mb-3">
            {impactoColonia.impactos.map((imp, i) => (
              <div key={i} className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: imp.tipo === 'critico' ? 'rgba(255,61,87,0.08)' : 'rgba(255,179,0,0.06)',
                  border: `1px solid ${imp.tipo === 'critico' ? 'rgba(255,61,87,0.25)' : 'rgba(255,179,0,0.2)'}`,
                  color: imp.tipo === 'critico' ? '#ff6b80' : '#ffb300',
                }}
              >
                {imp.tipo === 'critico' ? '🔴' : '⚠'} {imp.mensaje}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 text-xs mb-3"
            style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}
          >
            ✅ Cumplir este pedido no compromete los mínimos de la colonia
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2" style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: '#ce93d8' }}>♀ Hembras reproductoras</div>
            <div className="text-xs" style={{ color: tema.textMuted }}>
              Ahora: <span style={{ color: '#c9d4e0' }}>{impactoColonia.hembrasActivas}</span>
              <span className="mx-1">→</span>
              Después: <span style={{ color: impactoColonia.rompeHembras ? '#ff6b80' : '#00e676' }}>{impactoColonia.hembrasDespues}</span>
              <span style={{ color: '#3a5068' }}> (mín: {impactoColonia.minimoHembras})</span>
            </div>
          </div>
          <div className="rounded-lg p-2" style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: '#40c4ff' }}>♂ Machos reproductores</div>
            <div className="text-xs" style={{ color: tema.textMuted }}>
              Ahora: <span style={{ color: '#c9d4e0' }}>{impactoColonia.machosActivos}</span>
              <span className="mx-1">→</span>
              Después: <span style={{ color: impactoColonia.rompeMachos ? '#ff6b80' : '#00e676' }}>{impactoColonia.machosDespues}</span>
              <span style={{ color: '#3a5068' }}> (mín: {impactoColonia.minimoMachos})</span>
            </div>
          </div>
        </div>
      </SeccionCard>

      {/* ─── SECCIÓN: Escenarios A/B ──────────────── */}
      <SeccionCard id="escenarios" titulo="🔀 Escenarios de producción">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[escenarios.a, escenarios.b].map((esc, i) => (
            <div key={i} className="rounded-xl p-3" style={{ border: `1px solid ${tema.bgCardBorde}`, background: 'rgba(8,13,26,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{esc.emoji}</span>
                <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>Opción {i === 0 ? 'A' : 'B'}: {esc.label}</span>
              </div>
              <div className="space-y-1 text-xs mb-2" style={{ color: tema.textMuted }}>
                <div>♀ Hembras: <span style={{ color: '#ce93d8', fontWeight: 600 }}>{esc.hembras}</span></div>
                <div>♂ Machos: <span style={{ color: '#40c4ff', fontWeight: 600 }}>{esc.machos}</span></div>
                <div>📦 Jaulas nuevas: <span style={{ color: '#c9d4e0', fontWeight: 600 }}>{esc.jaulasNuevas}</span></div>
                <div>🐭 Animales estimados: <span style={{ color: '#c9d4e0', fontWeight: 600 }}>{esc.animalesEstimados}</span></div>
              </div>
              <div className="flex items-center gap-1 mb-2">
                <div className="h-1.5 rounded-full flex-1 overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)' }}>
                  <div className="h-full rounded-full" style={{ width: `${esc.probabilidad}%`, background: i === 0 ? '#00e676' : '#ffb300' }} />
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: i === 0 ? '#00e676' : '#ffb300' }}>{esc.probabilidad}%</span>
              </div>
              <div className="text-xs italic" style={{ color: '#3a5068' }}>{esc.descripcion}</div>
            </div>
          ))}
        </div>
      </SeccionCard>

      {/* ─── SECCIÓN: Capacidad de jaulas ────────── */}
      <SeccionCard id="capacidad" titulo="🏠 Capacidad futura de jaulas">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <KPI label="Jaulas actuales" valor={capacidadFutura.jaulasActuales} color="#c9d4e0" />
          <KPI label="Jaulas nuevas"   valor={`+${capacidadFutura.jaulasNuevas}`} color="#ffb300" />
          <KPI label="Total estimado"  valor={capacidadFutura.jaulasTotal}
            color={capacidadFutura.saturada ? '#ff6b80' : '#00e676'} />
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1" style={{ color: tema.textMuted }}>
            <span>Uso de capacidad estimada</span>
            <span style={{ color: capacidadFutura.saturada ? '#ff6b80' : capacidadFutura.porcentajeUso > 75 ? '#ffb300' : '#00e676' }}>
              {capacidadFutura.porcentajeUso}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(100, capacidadFutura.porcentajeUso)}%`,
              background: capacidadFutura.saturada ? '#ff6b80' : capacidadFutura.porcentajeUso > 75 ? '#ffb300' : '#00e676',
            }} />
          </div>
        </div>
        {capacidadFutura.advertencia && (
          <div className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}
          >
            ⚠ {capacidadFutura.advertencia}
          </div>
        )}
      </SeccionCard>

      {/* ─── SECCIÓN: Proyección 30/60/90/180d ───── */}
      <SeccionCard id="horizontes" titulo="📈 Proyección temporal">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[30, 60, 90, 180].map(dias => {
            const h = horizontes[dias]
            return (
              <div key={dias} className="rounded-xl p-3 text-center" style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}>
                <div className="text-xl mb-1">{h?.emoji ?? '⏳'}</div>
                <div className="text-xs font-bold mb-0.5" style={{ color: '#c9d4e0' }}>{dias}d</div>
                <div className="text-xs" style={{ color: '#4a5f7a' }}>{h?.label ?? '—'}</div>
              </div>
            )
          })}
        </div>
      </SeccionCard>

      {/* ─── SECCIÓN: Calendario del pedido ──────── */}
      <SeccionCard id="calendario" titulo="🗓 Calendario del pedido">
        {calendario.length > 0 ? (
          <div className="space-y-2">
            {calendario.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                style={{
                  background: ev.importante ? 'rgba(0,230,118,0.05)' : 'rgba(8,13,26,0.35)',
                  border: `1px solid ${ev.importante ? 'rgba(0,230,118,0.2)' : tema.bgCardBorde}`,
                }}
              >
                <span className="text-xl shrink-0">{ev.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold" style={{ color: ev.importante ? '#00e676' : tema.textPrimary }}>{ev.label}</div>
                  <div className="text-xs truncate" style={{ color: '#4a5f7a' }}>{ev.desc}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono" style={{ color: '#c9d4e0' }}>{formatFecha(ev.fecha)}</div>
                  {ev.diasRestantes != null && (
                    <div className="text-xs" style={{
                      color: ev.diasRestantes < 0 ? '#ff6b80'
                        : ev.diasRestantes <= 7 ? '#ffb300'
                        : '#4a5f7a'
                    }}>
                      {ev.diasRestantes < 0 ? `hace ${Math.abs(ev.diasRestantes)}d` : ev.diasRestantes === 0 ? 'hoy' : `en ${ev.diasRestantes}d`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-center py-3" style={{ color: tema.textMuted }}>
            Completá los datos del pedido para generar el calendario
          </div>
        )}
      </SeccionCard>

      {/* ─── SECCIÓN: Desglose índice viabilidad ── */}
      <SeccionCard id="viabilidad_detalle" titulo="🎯 Desglose del índice de viabilidad">
        <div className="space-y-2">
          {[
            { key: 'tiempo',        label: 'Tiempo suficiente',         max: 25 },
            { key: 'reproductores', label: 'Reproductores disponibles', max: 20 },
            { key: 'minimos',       label: 'Mínimos de colonia respetados', max: 20 },
            { key: 'stockActual',   label: 'Stock ya disponible',       max: 15 },
            { key: 'capacidad',     label: 'Capacidad de jaulas',       max: 10 },
            { key: 'sanitario',     label: 'Estado sanitario',          max: 10 },
          ].map(({ key, label, max }) => {
            const val = viabilidad.detalle[key] ?? 0
            const pct = Math.round((val / max) * 100)
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1" style={{ color: tema.textMuted }}>
                  <span>{label}</span>
                  <span style={{ color: '#c9d4e0' }}>{val}/{max}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? '#00e676' : pct >= 50 ? '#ffb300' : '#ff6b80',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: `1px solid ${tema.bgCardBorde}` }}>
          <span className="text-xs font-semibold" style={{ color: tema.textMuted }}>Score total</span>
          <ViabilidadBadge score={viabilidad.score} />
        </div>
      </SeccionCard>
    </div>
  )
}

// ─── Componente principal: Pedidos ────────────────────────────────────────
export default function Pedidos() {
  const { animales, camadas, jaulas, sacrificios, entregas, bio } = useBioterio()
  const { bioterioActivo } = useBioterioActivo()
  const { tema } = useTheme()

  const [pedidos,           setPedidos]           = useState(() => getPedidos())
  const [pedidoSelId,       setPedidoSelId]        = useState(null)
  const [modalFormAbierto,  setModalFormAbierto]   = useState(false)
  const [pedidoEditando,    setPedidoEditando]     = useState(null)
  const [confirmEliminarId, setConfirmEliminarId]  = useState(null)
  const [filtroEstado,      setFiltroEstado]       = useState('todos')

  const pedidoSeleccionado = pedidos.find(p => p.id === pedidoSelId) ?? null

  // ── Pedidos filtrados ──────────────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p =>
    filtroEstado === 'todos' || p.estado === filtroEstado
  )

  // ── Análisis del pedido seleccionado ──────────────────────────────────
  const analisis = useMemo(() => {
    if (!pedidoSeleccionado) return null
    const bioPedido = getBio(pedidoSeleccionado.bioterioId)

    const parejasNecesarias       = calcularParejasNecesarias(pedidoSeleccionado, camadas, bioPedido)
    const fechasOptimas           = calcularFechasOptimas(pedidoSeleccionado, bioPedido)
    const reproductoresSeleccionados = seleccionarReproductoresOptimos(pedidoSeleccionado, animales, camadas)
    const animalesListos          = detectarAnimalesListos(pedidoSeleccionado, jaulas, camadas, sacrificios, entregas)
    const capacidadFutura         = evaluarCapacidadFutura(parejasNecesarias, (jaulas ?? []).length)
    const impactoColonia          = evaluarImpactoColonia(pedidoSeleccionado, reproductoresSeleccionados, animales)
    const viabilidad              = calcularIndiceViabilidad({
      fechasOptimas, parejasNecesarias, reproductoresSeleccionados,
      animalesListos, impactoColonia, capacidadFutura, indiceSanitario: 100,
    })
    const escenarios              = simularEscenarios(pedidoSeleccionado, camadas)
    const calendario              = generarCalendarioPedido(pedidoSeleccionado, fechasOptimas, parejasNecesarias)
    const horizontes              = proyeccionHorizontes(fechasOptimas)

    return {
      bio: bioPedido, parejasNecesarias, fechasOptimas,
      reproductoresSeleccionados, animalesListos, capacidadFutura,
      impactoColonia, viabilidad, escenarios, calendario, horizontes,
    }
  }, [pedidoSeleccionado, animales, camadas, jaulas, sacrificios, entregas])

  // ── Scores de viabilidad para todas las tarjetas ─────────────────────
  const scoresPorId = useMemo(() => {
    const result = {}
    for (const p of pedidos) {
      try {
        const bioPedido = getBio(p.bioterioId)
        const parejas   = calcularParejasNecesarias(p, camadas, bioPedido)
        const fechas    = calcularFechasOptimas(p, bioPedido)
        const repros    = seleccionarReproductoresOptimos(p, animales, camadas)
        const aListos   = detectarAnimalesListos(p, jaulas, camadas, sacrificios, entregas)
        const capac     = evaluarCapacidadFutura(parejas, (jaulas ?? []).length)
        const impacto   = evaluarImpactoColonia(p, repros, animales)
        const viab      = calcularIndiceViabilidad({ fechasOptimas: fechas, parejasNecesarias: parejas, reproductoresSeleccionados: repros, animalesListos: aListos, impactoColonia: impacto, capacidadFutura: capac })
        result[p.id] = viab.score
      } catch { result[p.id] = 0 }
    }
    return result
  }, [pedidos, animales, camadas, jaulas, sacrificios, entregas])

  // ── Handlers ──────────────────────────────────────────────────────────
  function handleGuardar(form) {
    const nuevos = guardarPedido(form)
    setPedidos(nuevos)
    setModalFormAbierto(false)
    setPedidoEditando(null)
    if (!form.id) setPedidoSelId(nuevos[0]?.id ?? null)
  }

  function handleEliminar(id) {
    setPedidos(eliminarPedido(id))
    if (pedidoSelId === id) setPedidoSelId(null)
    setConfirmEliminarId(null)
  }

  function handleCambiarEstado(id, estado) {
    setPedidos(actualizarEstadoPedido(id, estado))
  }

  function handleReservarReproductores(pedido) {
    if (!analisis) return
    const { hembrasSugeridas, machosSugeridos } = analisis.reproductoresSeleccionados
    for (const { animal } of [...hembrasSugeridas, ...machosSugeridos]) {
      reservarAnimal(animal.id, 'pedido', `Pedido ${pedido.id}`, pedido.bioterioId)
    }
    alert(`${hembrasSugeridas.length + machosSugeridos.length} reproductores reservados para este pedido.`)
  }

  // ── Stats para la cabecera ─────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      pedidos.length,
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    enProceso:  pedidos.filter(p => p.estado === 'en_proceso').length,
    completados: pedidos.filter(p => p.estado === 'completado').length,
  }), [pedidos])

  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: '14px' }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: tema.textPrimary }}>📦 Pedidos de producción</h1>
          <p className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
            Gestión automática de pedidos · Estrategia optimizada · Calendario reproductivo
          </p>
        </div>
        <button
          onClick={() => { setPedidoEditando(null); setModalFormAbierto(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.35)', color: '#00e676', cursor: 'pointer' }}
        >
          + Nuevo pedido
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total',       valor: stats.total,       color: '#c9d4e0' },
          { label: 'Pendientes',  valor: stats.pendientes,  color: '#ffb300' },
          { label: 'En proceso',  valor: stats.enProceso,   color: '#40c4ff' },
          { label: 'Completados', valor: stats.completados, color: '#00e676' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={cardStyle}>
            <div className="font-mono font-bold text-xl" style={{ color: s.color }}>{s.valor}</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Layout: lista + análisis ───────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Lista de pedidos */}
        <div className="shrink-0" style={{ width: pedidoSeleccionado ? '320px' : '100%' }}>
          {/* Filtros */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {[{ id: 'todos', label: 'Todos' }, ...ESTADOS_PEDIDO].map(f => (
              <button key={f.id}
                onClick={() => setFiltroEstado(f.id)}
                className="px-3 py-1 rounded-lg text-xs font-semibold"
                style={{
                  background: filtroEstado === f.id ? 'rgba(0,230,118,0.1)' : 'rgba(8,13,26,0.4)',
                  border: filtroEstado === f.id ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(30,51,82,0.7)',
                  color: filtroEstado === f.id ? '#00e676' : '#4a5f7a',
                  cursor: 'pointer',
                }}
              >{f.label ?? f.id}</button>
            ))}
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={cardStyle}>
              <div className="text-3xl mb-3">📋</div>
              <div className="font-semibold mb-1" style={{ color: tema.textPrimary }}>Sin pedidos</div>
              <div className="text-xs mb-4" style={{ color: tema.textMuted }}>
                {filtroEstado !== 'todos' ? 'No hay pedidos con este estado.' : 'Creá el primer pedido para generar la estrategia de producción automáticamente.'}
              </div>
              {filtroEstado === 'todos' && (
                <button onClick={() => setModalFormAbierto(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(0,230,118,0.1)', border: '1.5px solid rgba(0,230,118,0.3)', color: '#00e676', cursor: 'pointer' }}
                >+ Crear primer pedido</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pedidosFiltrados.map(p => (
                <TarjetaPedido
                  key={p.id}
                  pedido={p}
                  seleccionado={pedidoSelId === p.id}
                  onSeleccionar={id => setPedidoSelId(prev => prev === id ? null : id)}
                  onEditar={ped => { setPedidoEditando(ped); setModalFormAbierto(true) }}
                  onEliminar={id => setConfirmEliminarId(id)}
                  onCambiarEstado={handleCambiarEstado}
                  score={scoresPorId[p.id]}
                  tema={tema}
                />
              ))}
            </div>
          )}
        </div>

        {/* Panel de análisis */}
        {pedidoSeleccionado && analisis && (
          <div className="flex-1 min-w-0">
            <AnalisisPedido
              pedido={pedidoSeleccionado}
              analisis={analisis}
              onCambiarEstado={handleCambiarEstado}
              onReservarReproductores={handleReservarReproductores}
              tema={tema}
            />
          </div>
        )}
      </div>

      {/* ── Modal formulario ─────────────────────────────────────────────── */}
      {modalFormAbierto && (
        <ModalFormPedido
          pedido={pedidoEditando}
          onGuardar={handleGuardar}
          onCerrar={() => { setModalFormAbierto(false); setPedidoEditando(null) }}
          tema={tema}
        />
      )}

      {/* ── Modal confirmación de eliminación ────────────────────────────── */}
      {confirmEliminarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: tema.bgCard, border: '1px solid rgba(255,61,87,0.3)' }}
          >
            <div className="text-3xl mb-3">🗑️</div>
            <div className="font-bold mb-2" style={{ color: tema.textPrimary }}>¿Eliminar pedido?</div>
            <div className="text-xs mb-5" style={{ color: tema.textMuted }}>Esta acción no se puede deshacer.</div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEliminarId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}
              >Cancelar</button>
              <button onClick={() => handleEliminar(confirmEliminarId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.12)', border: '1.5px solid rgba(255,61,87,0.35)', color: '#ff6b80', cursor: 'pointer' }}
              >✕ Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
