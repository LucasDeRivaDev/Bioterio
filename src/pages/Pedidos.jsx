// ─────────────────────────────────────────────────────────────────────────────
// Pedidos.jsx — Gestión estratégica de pedidos de producción
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { useBioterio }        from '../context/BiotheriumContext'
import { useBioterioActivo }  from '../context/BioterioActivoContext'
import { useTheme }           from '../context/ThemeContext'
import { getBio }             from '../utils/constants'
import { formatFecha }        from '../utils/calculos'
import {
  calcularParejasNecesarias, calcularFechasOptimas,
  seleccionarReproductoresOptimos, detectarAnimalesListos,
  evaluarCapacidadFutura, evaluarImpactoColonia, calcularIndiceViabilidad,
  generarCalendarioPedido,
  evaluarImpactoEstrategico, calcularIndiceImpactoFuturo, simularEscenariosEstrategicos,
  detectarSuperavit, detectarReproductoresProximos,
  nivelViabilidad, labelBioterio, labelSexo, labelUso, colorEstadoPedido,
} from '../utils/motorPedidos'
import { reservarAnimal } from '../utils/motorDecisiones'
import { calcularIndiceSanitario } from '../utils/sanitario'

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
const LABEL_STYLE = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a5f7a', marginBottom: '6px',
}

// ─── Badge de viabilidad ────────────────────────────────────────────────────
function ViabilidadBadge({ score, small = false }) {
  const nivel = nivelViabilidad(score)
  return (
    <span className="inline-flex items-center gap-1 font-bold rounded-lg"
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

// ─── Modal formulario ───────────────────────────────────────────────────────
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, boxShadow: '0 0 60px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${tema.bgCardBorde}`, background: 'rgba(0,230,118,0.03)' }}>
          <div>
            <div className="font-bold text-base" style={{ color: tema.textPrimary }}>
              {form.id ? '✏️ Editar pedido' : '📦 Nuevo pedido'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
              Completá los datos para calcular la estrategia automática
            </div>
          </div>
          <button onClick={onCerrar}
            style={{ background: 'none', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={guardar} className="px-6 py-5 space-y-4">
          <div>
            <label style={LABEL_STYLE}>Colonia / línea</label>
            <select value={form.bioterioId}
              onChange={e => setForm(f => ({ ...f, bioterioId: e.target.value }))} style={INPUT_STYLE}>
              {BIOTERIOS_OPCIONES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={LABEL_STYLE}>Cantidad requerida</label>
              <input type="number" min="1" value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                placeholder="Ej: 40" style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Edad (semanas)</label>
              <input type="number" min="1" max="52" value={form.edadSemanas}
                onChange={e => setForm(f => ({ ...f, edadSemanas: e.target.value }))}
                placeholder="Ej: 8" style={INPUT_STYLE} />
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>Sexo requerido</label>
            <div className="flex gap-2">
              {[
                { id: 'machos', label: '♂ Machos' },
                { id: 'hembras', label: '♀ Hembras' },
                { id: 'ambos', label: '♂♀ Ambos' },
              ].map(s => (
                <button key={s.id} type="button"
                  onClick={() => setForm(f => ({ ...f, sexo: s.id }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: form.sexo === s.id ? 'rgba(0,230,118,0.12)' : 'rgba(8,13,26,0.6)',
                    border: form.sexo === s.id ? '1.5px solid rgba(0,230,118,0.4)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.sexo === s.id ? '#00e676' : '#4a5f7a', cursor: 'pointer',
                  }}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>Fecha de entrega</label>
            <input type="date" value={form.fechaEntrega}
              onChange={e => setForm(f => ({ ...f, fechaEntrega: e.target.value }))} style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Uso destino</label>
            <div className="flex gap-2">
              {[
                { id: 'investigacion', label: '🔬 Investigación' },
                { id: 'produccion',    label: '🏭 Producción' },
                { id: 'stock',         label: '📦 Stock' },
              ].map(u => (
                <button key={u.id} type="button"
                  onClick={() => setForm(f => ({ ...f, uso: u.id }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: form.uso === u.id ? 'rgba(64,196,255,0.1)' : 'rgba(8,13,26,0.6)',
                    border: form.uso === u.id ? '1.5px solid rgba(64,196,255,0.35)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.uso === u.id ? '#40c4ff' : '#4a5f7a', cursor: 'pointer',
                  }}>{u.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={LABEL_STYLE}>Solicitante (opcional)</label>
            <input type="text" value={form.solicitante}
              onChange={e => setForm(f => ({ ...f, solicitante: e.target.value }))}
              placeholder="Nombre del investigador o laboratorio" style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Notas</label>
            <textarea rows={2} value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observaciones adicionales..."
              style={{ ...INPUT_STYLE, resize: 'none' }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={!esValido}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: esValido ? 'rgba(0,230,118,0.15)' : 'rgba(30,51,82,0.3)',
                border: `1.5px solid ${esValido ? 'rgba(0,230,118,0.4)' : 'rgba(30,51,82,0.5)'}`,
                color: esValido ? '#00e676' : '#4a5f7a',
                cursor: esValido ? 'pointer' : 'not-allowed',
              }}>{form.id ? '✓ Guardar cambios' : '+ Crear pedido'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tarjeta de pedido en la lista ─────────────────────────────────────────
function TarjetaPedido({ pedido, seleccionado, onSeleccionar, onEditar, onEliminar, score, tema }) {
  const nivel    = nivelViabilidad(score ?? 0)
  const colorEst = colorEstadoPedido(pedido.estado)
  const estadoObj = ESTADOS_PEDIDO.find(e => e.id === pedido.estado)

  return (
    <div onClick={() => onSeleccionar(pedido.id)}
      className="rounded-xl p-3 cursor-pointer transition-all"
      style={{
        background: seleccionado ? 'rgba(0,230,118,0.06)' : tema.bgCard,
        border: `1.5px solid ${seleccionado ? 'rgba(0,230,118,0.3)' : tema.bgCardBorde}`,
        boxShadow: seleccionado ? '0 0 16px rgba(0,230,118,0.08)' : 'none',
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold" style={{ color: tema.textMuted }}>
          {labelBioterio(pedido.bioterioId)}
        </span>
        <ViabilidadBadge score={score ?? '—'} small />
      </div>
      <div className="font-bold text-sm mb-1" style={{ color: tema.textPrimary }}>
        {pedido.cantidad} {labelSexo(pedido.sexo)}
        <span className="font-normal text-xs ml-2" style={{ color: tema.textMuted }}>· {pedido.edadSemanas} sem</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-xs" style={{ color: tema.textMuted }}>📅 {formatFecha(pedido.fechaEntrega)}</span>
        <span className="text-xs" style={{ color: tema.textMuted }}>· {labelUso(pedido.uso)}</span>
      </div>
      {pedido.solicitante && (
        <div className="text-xs mb-2" style={{ color: tema.textMuted }}>👤 {pedido.solicitante}</div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
          style={{ background: colorEst.bg, border: `1px solid ${colorEst.borde}`, color: colorEst.color }}>
          {estadoObj?.label ?? pedido.estado}
        </span>
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation(); onEditar(pedido) }}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'rgba(30,51,82,0.5)', border: '1px solid rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); onEliminar(pedido.id) }}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80', cursor: 'pointer' }}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel de análisis unificado ───────────────────────────────────────────
function AnalisisPedido({ pedido, analisis, onCambiarEstado, onReservarReproductores, modoSostenible, tema }) {
  const [secAbierta, setSecAbierta] = useState('cronograma')

  const {
    parejasNecesarias, fechasOptimas, reproductoresSeleccionados, animalesListos,
    capacidadFutura, impactoColonia, indiceSanitario, viabilidad,
    escenariosEstrategicos, impactoEstrategico, indiceImpactoFuturo,
    reproductoresProximos,
  } = analisis

  const nivel    = nivelViabilidad(viabilidad.score)
  const colorEst = colorEstadoPedido(pedido.estado)

  // ── Respuestas a las 4 preguntas clave ────────────────────────────────────
  const sinHembras = reproductoresSeleccionados.hembrasDisponibles === 0
  const hayProximas = (reproductoresProximos?.hembrasProximas?.length ?? 0) > 0
  const diasProxima = reproductoresProximos?.hembrasProximas?.[0]?.diasParaMadurar

  const respuestas = [
    {
      q: '¿Se puede hacer?',
      ok: fechasOptimas?.viable && (!sinHembras || hayProximas),
      warn: fechasOptimas?.urgente || (sinHembras && hayProximas),
      txt: !fechasOptimas
        ? 'Sin datos de entrega'
        : !fechasOptimas.viable
        ? `No — faltan ${fechasOptimas.diasMinimos - fechasOptimas.diasHastaEntrega}d para el ciclo`
        : sinHembras && hayProximas
        ? `Sí — hembras disponibles en ${diasProxima}d`
        : sinHembras
        ? 'Sin reproductoras disponibles'
        : fechasOptimas.urgente
        ? `Urgente — iniciar en ${fechasOptimas.diasHastaCopula}d`
        : `Sí — cópulas en ${fechasOptimas.diasHastaCopula}d`,
    },
    {
      q: '¿Conviene hacerlo?',
      ok: impactoEstrategico.nCriticos === 0,
      warn: impactoEstrategico.nCriticos === 0 && impactoEstrategico.nAdvertencias > 0,
      txt: impactoEstrategico.nCriticos > 0
        ? `${impactoEstrategico.nCriticos} riesgo(s) crítico(s) detectados`
        : impactoEstrategico.nAdvertencias > 0
        ? `Con ${impactoEstrategico.nAdvertencias} advertencia(s)`
        : 'Sin riesgos detectados',
    },
    {
      q: '¿Qué estrategia usar?',
      ok: true,
      warn: false,
      txt: `${escenariosEstrategicos.optima.emoji} ${escenariosEstrategicos.optima.label}`,
    },
    {
      q: '¿La colonia seguirá estable?',
      ok: impactoColonia.riesgoNivel === 'ok',
      warn: impactoColonia.riesgoNivel === 'advertencia',
      txt: impactoColonia.riesgoNivel === 'ok'
        ? 'Sí — mínimos respetados'
        : impactoColonia.riesgoNivel === 'advertencia'
        ? 'Al límite mínimo'
        : impactoColonia.impactos[0]?.mensaje ?? 'Rompe mínimos',
    },
  ]

  function Sec({ id, titulo, children, defaultOpen = false }) {
    const open = secAbierta === id
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tema.bgCardBorde}` }}>
        <button onClick={() => setSecAbierta(open ? null : id)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: open ? 'rgba(0,230,118,0.04)' : tema.bgCard, cursor: 'pointer', border: 'none' }}>
          <span className="text-sm font-semibold" style={{ color: open ? '#00e676' : tema.textSecondary }}>{titulo}</span>
          <span style={{ color: open ? '#00e676' : tema.textMuted }}>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="px-4 pb-4 pt-2" style={{ background: tema.bgCard, borderTop: `1px solid ${tema.bgCardBorde}` }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* ── Header: score + estado + acciones ─────────────────────────────── */}
      <div className="rounded-2xl p-4" style={{ background: tema.bgCard, border: `1px solid ${nivel.borde}`, boxShadow: `0 0 20px ${nivel.bg}` }}>
        {/* Fila superior */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base" style={{ color: tema.textPrimary }}>
                {pedido.cantidad} {labelSexo(pedido.sexo)} · {pedido.edadSemanas} sem
              </span>
              <span className="text-xs px-2 py-0.5 rounded-lg"
                style={{ background: colorEst.bg, border: `1px solid ${colorEst.borde}`, color: colorEst.color }}>
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
          <div className="text-center px-4 py-2 rounded-xl"
            style={{ background: nivel.bg, border: `1.5px solid ${nivel.borde}` }}>
            <div className="font-mono font-bold text-2xl" style={{ color: nivel.color }}>{viabilidad.score}</div>
            <div className="text-xs font-semibold" style={{ color: nivel.color }}>{nivel.emoji} Viabilidad</div>
          </div>
        </div>

        {/* Modo sostenible banner */}
        {modoSostenible && (
          <div className="rounded-lg px-3 py-1.5 text-xs mb-3"
            style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
            🌱 Modo sostenible activo — estrategia prioriza estabilidad de la colonia sobre producción máxima
          </div>
        )}

        {/* Alerta sanitaria */}
        {indiceSanitario < 80 && (
          <div className="rounded-lg px-3 py-1.5 text-xs mb-3"
            style={{
              background: indiceSanitario < 50 ? 'rgba(255,61,87,0.07)' : 'rgba(255,179,0,0.06)',
              border: `1px solid ${indiceSanitario < 50 ? 'rgba(255,61,87,0.2)' : 'rgba(255,179,0,0.18)'}`,
              color: indiceSanitario < 50 ? '#ff6b80' : '#ffb300',
            }}>
            {indiceSanitario < 50 ? '🔴' : '🟡'} Índice sanitario: <strong>{indiceSanitario}/100</strong> — penaliza la viabilidad
          </div>
        )}

        {/* 4 respuestas rápidas */}
        <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${tema.bgCardBorde}` }}>
          {respuestas.map((r, i) => (
            <div key={i}
              className="flex items-center justify-between px-3 py-2 text-xs"
              style={{
                borderBottom: i < respuestas.length - 1 ? `1px solid ${tema.bgCardBorde}` : 'none',
                background: 'rgba(8,13,26,0.25)',
              }}>
              <span style={{ color: '#4a5f7a' }}>{r.q}</span>
              <span className="font-semibold" style={{ color: r.ok ? '#00e676' : r.warn ? '#ffb300' : '#ff6b80' }}>
                {r.ok ? '✅' : r.warn ? '⚠️' : '🔴'} {r.txt}
              </span>
            </div>
          ))}
        </div>

        {/* Acciones de estado */}
        <div className="flex gap-2 flex-wrap">
          {pedido.estado === 'pendiente' && (
            <>
              <button onClick={() => onCambiarEstado(pedido.id, 'en_proceso')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff', cursor: 'pointer' }}>
                ▶ Iniciar pedido
              </button>
              {reproductoresSeleccionados.suficientesHembras && (
                <button onClick={() => onReservarReproductores(pedido)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: '#ffb300', cursor: 'pointer' }}>
                  🔒 Reservar reproductores
                </button>
              )}
            </>
          )}
          {pedido.estado === 'en_proceso' && (
            <button onClick={() => onCambiarEstado(pedido.id, 'completado')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', cursor: 'pointer' }}>
              ✓ Marcar completado
            </button>
          )}
          {!['cancelado', 'completado'].includes(pedido.estado) && (
            <button onClick={() => onCambiarEstado(pedido.id, 'cancelado')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80', cursor: 'pointer' }}>
              ✕ Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ── 1: Estado estratégico (unificado) ─────────────────────────────── */}
      <Sec id="estrategico" titulo={`🧠 Estado estratégico${impactoEstrategico.nCriticos > 0 ? ' 🔴' : impactoEstrategico.nAdvertencias > 0 ? ' ⚠️' : ' ✅'}`}>
        {/* Grid 6 indicadores */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            {
              label: 'Sustentabilidad',
              val: indiceImpactoFuturo.emoji + ' ' + indiceImpactoFuturo.label,
              color: indiceImpactoFuturo.color,
              bg: indiceImpactoFuturo.bg,
              borde: indiceImpactoFuturo.borde,
            },
            {
              label: 'Saturación',
              val: capacidadFutura.saturada
                ? `🔴 ${capacidadFutura.porcentajeUso}%`
                : capacidadFutura.porcentajeUso > 75
                ? `⚠️ ${capacidadFutura.porcentajeUso}%`
                : `🟢 ${capacidadFutura.porcentajeUso}%`,
              color: capacidadFutura.saturada ? '#ff6b80' : capacidadFutura.porcentajeUso > 75 ? '#ffb300' : '#00e676',
              bg: 'rgba(8,13,26,0.35)', borde: tema.bgCardBorde,
            },
            {
              label: 'Mínimos',
              val: impactoColonia.riesgoNivel === 'critico'
                ? `🔴 ♀${impactoColonia.hembrasDespues} ♂${impactoColonia.machosDespues}`
                : impactoColonia.riesgoNivel === 'advertencia'
                ? `⚠️ ♀${impactoColonia.hembrasDespues} ♂${impactoColonia.machosDespues}`
                : `🟢 ♀${impactoColonia.hembrasDespues} ♂${impactoColonia.machosDespues}`,
              color: impactoColonia.riesgoNivel === 'critico' ? '#ff6b80' : impactoColonia.riesgoNivel === 'advertencia' ? '#ffb300' : '#00e676',
              bg: 'rgba(8,13,26,0.35)', borde: tema.bgCardBorde,
            },
            {
              label: 'Genética',
              val: impactoEstrategico.dimensiones.genetica === 'critico'
                ? '🔴 Alta consanguinidad'
                : impactoEstrategico.dimensiones.genetica === 'advertencia'
                ? '⚠️ Consang. moderada'
                : '🟢 OK',
              color: impactoEstrategico.dimensiones.genetica === 'critico' ? '#ff6b80' : impactoEstrategico.dimensiones.genetica === 'advertencia' ? '#ffb300' : '#00e676',
              bg: 'rgba(8,13,26,0.35)', borde: tema.bgCardBorde,
            },
            {
              label: 'Sanitario',
              val: indiceSanitario < 50 ? `🔴 ${indiceSanitario}/100` : indiceSanitario < 75 ? `⚠️ ${indiceSanitario}/100` : `🟢 ${indiceSanitario}/100`,
              color: indiceSanitario < 50 ? '#ff6b80' : indiceSanitario < 75 ? '#ffb300' : '#00e676',
              bg: 'rgba(8,13,26,0.35)', borde: tema.bgCardBorde,
            },
            {
              label: 'Tiempo',
              val: !fechasOptimas ? '— Sin datos'
                : !fechasOptimas.viable ? '🔴 Inviable'
                : fechasOptimas.urgente ? `⚠️ Urgente`
                : `🟢 ${fechasOptimas.diasHastaCopula}d para cópula`,
              color: !fechasOptimas ? '#4a5f7a' : !fechasOptimas.viable ? '#ff6b80' : fechasOptimas.urgente ? '#ffb300' : '#00e676',
              bg: 'rgba(8,13,26,0.35)', borde: tema.bgCardBorde,
            },
          ].map(({ label, val, color, bg, borde }) => (
            <div key={label} className="rounded-lg p-2 text-center"
              style={{ background: bg, border: `1px solid ${borde}` }}>
              <div className="text-xs font-semibold" style={{ color }}>{val}</div>
              <div style={{ color: '#4a5f7a', fontSize: '10px', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Riesgos detectados */}
        {impactoEstrategico.riesgos.length > 0 && (
          <div className="space-y-1.5">
            {impactoEstrategico.riesgos.map((r, i) => (
              <div key={i} className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: r.nivel === 'critico' ? 'rgba(255,61,87,0.07)' : 'rgba(255,179,0,0.05)',
                  border: `1px solid ${r.nivel === 'critico' ? 'rgba(255,61,87,0.22)' : 'rgba(255,179,0,0.18)'}`,
                  color: r.nivel === 'critico' ? '#ff6b80' : '#ffb300',
                }}>
                {r.nivel === 'critico' ? '🔴' : '⚠️'} <strong>{r.dimension.replace(/_/g, ' ')}:</strong> {r.mensaje}
              </div>
            ))}
          </div>
        )}

        {impactoEstrategico.riesgos.length === 0 && (
          <div className="rounded-lg px-3 py-2 text-xs text-center"
            style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}>
            ✅ Ningún riesgo estratégico detectado — el pedido es compatible con la estabilidad de la colonia
          </div>
        )}
      </Sec>

      {/* ── 2: Cronograma biológico (unificado) ───────────────────────────── */}
      <Sec id="cronograma" titulo="📅 Cronograma biológico">
        {fechasOptimas ? (
          <>
            {!fechasOptimas.viable && (
              <div className="rounded-lg px-3 py-2 text-xs mb-3"
                style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
                ⚠ Tiempo insuficiente — mínimo {fechasOptimas.diasMinimos}d, disponibles {fechasOptimas.diasHastaEntrega}d
              </div>
            )}
            {fechasOptimas.urgente && (
              <div className="rounded-lg px-3 py-2 text-xs mb-3"
                style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffb300' }}>
                ⚡ Cópula urgente — quedan {fechasOptimas.diasHastaCopula} días para iniciar
              </div>
            )}
            <div className="space-y-1">
              {[
                { label: '🔗 Iniciar cópulas', fecha: fechasOptimas.fechaCopula, dias: fechasOptimas.diasHastaCopula, desc: `${parejasNecesarias.hembrasNecesarias}♀ + ${parejasNecesarias.machosNecesarios}♂` },
                { label: '↗️ Separar parejas', fecha: fechasOptimas.fechaSeparacion, dias: null, desc: 'Inicio de gestación' },
                { label: '🐣 Partos esperados', fecha: fechasOptimas.fechaNacimiento, dias: null, desc: `~${parejasNecesarias.animalesEstimados} crías estimadas` },
                { label: '🧬 Destete', fecha: fechasOptimas.fechaDestete, dias: null, desc: 'Separar crías → stock' },
                { label: '📦 Entrega', fecha: fechasOptimas.fechaEntrega, dias: fechasOptimas.diasHastaEntrega, desc: `${pedido.cantidad} ${labelSexo(pedido.sexo)}`, importante: true },
              ].map((ev, i) => (
                <div key={i}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{
                    background: ev.importante ? 'rgba(0,230,118,0.05)' : 'rgba(8,13,26,0.3)',
                    border: `1px solid ${ev.importante ? 'rgba(0,230,118,0.2)' : tema.bgCardBorde}`,
                  }}>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: ev.importante ? '#00e676' : tema.textSecondary }}>
                      {ev.label}
                    </span>
                    <span className="text-xs ml-2" style={{ color: '#3a5068' }}>{ev.desc}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono" style={{ color: '#c9d4e0' }}>{formatFecha(ev.fecha)}</div>
                    {ev.dias != null && (
                      <div className="text-xs" style={{
                        color: ev.dias < 0 ? '#ff6b80' : ev.dias <= 14 ? '#ffb300' : '#4a5f7a',
                      }}>
                        {ev.dias < 0 ? `vencido ${Math.abs(ev.dias)}d` : ev.dias === 0 ? 'hoy' : `en ${ev.dias}d`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs text-center py-4" style={{ color: tema.textMuted }}>
            Completá fecha de entrega y edad para generar el cronograma
          </div>
        )}
      </Sec>

      {/* ── 3: Estrategias posibles (unificado) ───────────────────────────── */}
      <Sec id="estrategias" titulo="⚡ Estrategias posibles">
        {/* Estrategia recomendada */}
        <div className="rounded-xl px-3 py-2 mb-3"
          style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)' }}>
          <span className="text-xs font-bold" style={{ color: '#40c4ff' }}>
            🏆 Óptima: {escenariosEstrategicos.optima.emoji} {escenariosEstrategicos.optima.label}
            {modoSostenible && ' (modo sostenible)'}
          </span>
          <span className="text-xs ml-2" style={{ color: '#4a5f7a' }}>{escenariosEstrategicos.optima.razon}</span>
        </div>

        <div className="space-y-2">
          {escenariosEstrategicos.escenarios.map((esc) => {
            const esOptimo = esc.id === escenariosEstrategicos.optima.id
            const esModoSost = modoSostenible && esc.id === 'b' // modo sostenible prefiere el mínimo
            const resaltado = modoSostenible ? esModoSost : esOptimo
            return (
              <div key={esc.id} className="rounded-xl p-3"
                style={{
                  background: resaltado ? 'rgba(0,230,118,0.05)' : 'rgba(8,13,26,0.3)',
                  border: `1.5px solid ${resaltado ? 'rgba(0,230,118,0.25)' : tema.bgCardBorde}`,
                }}>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{esc.emoji}</span>
                    <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>{esc.label}</span>
                    {resaltado && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}>
                        {modoSostenible ? '🌱 sostenible' : '✦ óptimo'}
                      </span>
                    )}
                    {esc.retraso > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.2)', color: '#40c4ff' }}>
                        +{esc.retraso}d
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold" style={{ color: esc.probabilidad >= 85 ? '#00e676' : esc.probabilidad >= 70 ? '#ffb300' : '#ff6b80' }}>
                    {esc.probabilidad}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span style={{ color: '#ce93d8' }}>♀ {esc.hembras}</span>
                  <span style={{ color: '#40c4ff' }}>♂ {esc.machos}</span>
                  <span style={{ color: '#c9d4e0' }}>📦 {esc.jaulasNuevas} jaulas</span>
                  <span style={{ color: '#c9d4e0' }}>~{esc.animalesEstimados} crías</span>
                  {esc.rompeMinimo && <span style={{ color: '#ff6b80' }}>🔴 rompe mínimos</span>}
                  {esc.saturada && !esc.rompeMinimo && <span style={{ color: '#ffb300' }}>⚠ saturación</span>}
                  {!esc.rompeMinimo && !esc.saturada && <span style={{ color: '#00e676' }}>🟢 colonia segura</span>}
                </div>
                <div className="mt-1.5">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${esc.probabilidad}%`, background: esc.probabilidad >= 85 ? '#00e676' : esc.probabilidad >= 70 ? '#ffb300' : '#ff6b80' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Sec>

      {/* ── 4: Reproductores sugeridos ────────────────────────────────────── */}
      <Sec id="reproductores" titulo="🔬 Reproductores sugeridos">
        {/* Disponibilidad */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            {
              sexo: '♀ Hembras', disp: reproductoresSeleccionados.hembrasDisponibles,
              nec: reproductoresSeleccionados.hembrasNecesarias,
              ok: reproductoresSeleccionados.suficientesHembras,
              proximos: reproductoresProximos?.hembrasProximas ?? [],
              color: '#ce93d8',
            },
            {
              sexo: '♂ Machos', disp: reproductoresSeleccionados.machosDisponibles,
              nec: reproductoresSeleccionados.machosNecesarios,
              ok: reproductoresSeleccionados.suficientesMachos,
              proximos: reproductoresProximos?.machosProximos ?? [],
              color: '#40c4ff',
            },
          ].map(({ sexo, disp, nec, ok, proximos, color }) => (
            <div key={sexo} className="rounded-lg p-2"
              style={{
                background: ok ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.05)',
                border: `1px solid ${ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
              }}>
              <div className="text-xs font-bold mb-0.5" style={{ color }}>
                {sexo}: {disp}/{nec}
              </div>
              {!ok && proximos.length > 0 ? (
                <div className="text-xs" style={{ color: '#ffb300' }}>
                  🟡 {proximos.length} disponible{proximos.length > 1 ? 's' : ''} en {proximos[0].diasParaMadurar}d
                </div>
              ) : !ok ? (
                <div className="text-xs" style={{ color: '#ff6b80' }}>Sin candidatos</div>
              ) : (
                <div className="text-xs" style={{ color: '#00e676' }}>✓ Suficientes</div>
              )}
            </div>
          ))}
        </div>

        {/* Listas compactas */}
        {reproductoresSeleccionados.hembrasSugeridas.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-semibold mb-1" style={{ color: '#ce93d8' }}>♀ Recomendadas</div>
            <div className="space-y-1">
              {reproductoresSeleccionados.hembrasSugeridas.map(({ animal, scoreRepro, fPorc, nivelF, score }) => (
                <div key={animal.id} className="flex items-center justify-between rounded px-2 py-1"
                  style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#ce93d8' }}>{animal.codigo}</span>
                  <div className="flex gap-2 text-xs" style={{ color: '#4a5f7a' }}>
                    <span>Score <span style={{ color: '#c9d4e0' }}>{scoreRepro}</span></span>
                    <span>F <span style={{ color: nivelF === 'alto' ? '#ff6b80' : nivelF === 'moderado' ? '#ffb300' : '#4a5f7a' }}>{fPorc}</span></span>
                    <span style={{ color: '#00e676' }}>{score}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {reproductoresSeleccionados.machosSugeridos.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: '#40c4ff' }}>♂ Recomendados</div>
            <div className="space-y-1">
              {reproductoresSeleccionados.machosSugeridos.map(({ animal, scoreRepro, fPorc, nivelF, score }) => (
                <div key={animal.id} className="flex items-center justify-between rounded px-2 py-1"
                  style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}>
                  <span className="text-xs font-mono font-semibold" style={{ color: '#40c4ff' }}>{animal.codigo}</span>
                  <div className="flex gap-2 text-xs" style={{ color: '#4a5f7a' }}>
                    <span>Score <span style={{ color: '#c9d4e0' }}>{scoreRepro}</span></span>
                    <span>F <span style={{ color: nivelF === 'alto' ? '#ff6b80' : nivelF === 'moderado' ? '#ffb300' : '#4a5f7a' }}>{fPorc}</span></span>
                    <span style={{ color: '#00e676' }}>{score}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {reproductoresSeleccionados.hembrasDisponibles === 0 && !hayProximas && (
          <div className="text-xs text-center py-2" style={{ color: tema.textMuted }}>
            Sin reproductoras libres — revisá estados o cambiá de bioterio
          </div>
        )}
      </Sec>

      {/* ── 5: Producción estimada (compact) ─────────────────────────────── */}
      <Sec id="produccion" titulo="📊 Producción estimada">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: '♀ Hembras', val: parejasNecesarias.hembrasNecesarias, color: '#ce93d8' },
            { label: '♂ Machos',  val: parejasNecesarias.machosNecesarios,  color: '#40c4ff' },
            { label: '~Crías',    val: parejasNecesarias.animalesEstimados, color: '#c9d4e0' },
            { label: 'Prob.',     val: `${parejasNecesarias.probabilidad}%`, color: '#00e676' },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-lg p-2 text-center"
              style={{ background: 'rgba(8,13,26,0.35)', border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="font-mono font-bold text-base" style={{ color }}>{val}</div>
              <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Stock ya disponible */}
        <div className="rounded-lg p-2"
          style={{
            background: animalesListos.cubiertoConStock ? 'rgba(0,230,118,0.05)' : 'rgba(8,13,26,0.3)',
            border: `1px solid ${animalesListos.cubiertoConStock ? 'rgba(0,230,118,0.2)' : tema.bgCardBorde}`,
          }}>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#4a5f7a' }}>📦 Stock disponible</span>
            <span style={{ color: animalesListos.cubiertoConStock ? '#00e676' : animalesListos.porcentajeCubierto > 50 ? '#ffb300' : '#ff6b80' }}>
              {animalesListos.cubiertoConStock
                ? '✅ Cubierto con stock actual'
                : `${animalesListos.disponibles}/${animalesListos.necesarios} disponibles (${animalesListos.porcentajeCubierto}%)`}
            </span>
          </div>
        </div>

        {!parejasNecesarias.hist.conDatos && (
          <div className="rounded-lg px-3 py-1.5 text-xs mt-2"
            style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.18)', color: '#ffb300' }}>
            ⚠ Valores bibliográficos — registrá más camadas para mayor precisión
          </div>
        )}
      </Sec>

    </div>
  )
}

// ─── Componente principal: Pedidos ─────────────────────────────────────────
export default function Pedidos() {
  const { animales, camadas, jaulas, sacrificios, entregas, incidentes,
          pedidos, agregarPedido, editarPedido, eliminarPedido: eliminarPedidoCtx,
        } = useBioterio()
  const { bioterioActivo } = useBioterioActivo()
  const { tema } = useTheme()

  const [pedidoSelId,       setPedidoSelId]       = useState(null)
  const [modalFormAbierto,  setModalFormAbierto]  = useState(false)
  const [pedidoEditando,    setPedidoEditando]    = useState(null)
  const [confirmEliminarId, setConfirmEliminarId] = useState(null)
  const [filtroEstado,      setFiltroEstado]      = useState('todos')
  const [modoSostenible,    setModoSostenible]    = useState(false)

  const pedidoSeleccionado = pedidos.find(p => p.id === pedidoSelId) ?? null

  const pedidosFiltrados = pedidos.filter(p =>
    filtroEstado === 'todos' || p.estado === filtroEstado
  )

  // ── Análisis del pedido seleccionado ──────────────────────────────────────
  const analisis = useMemo(() => {
    if (!pedidoSeleccionado) return null
    const bioPedido = getBio(pedidoSeleccionado.bioterioId)

    const parejasNecesarias          = calcularParejasNecesarias(pedidoSeleccionado, camadas, bioPedido)
    const fechasOptimas              = calcularFechasOptimas(pedidoSeleccionado, bioPedido)
    const reproductoresSeleccionados = seleccionarReproductoresOptimos(pedidoSeleccionado, animales, camadas)
    const animalesListos             = detectarAnimalesListos(pedidoSeleccionado, jaulas, camadas, sacrificios, entregas)
    const capacidadFutura            = evaluarCapacidadFutura(parejasNecesarias, (jaulas ?? []).length)
    const impactoColonia             = evaluarImpactoColonia(pedidoSeleccionado, reproductoresSeleccionados, animales)
    const indiceSanitario            = calcularIndiceSanitario(camadas, incidentes, pedidoSeleccionado.bioterioId)
    const viabilidad                 = calcularIndiceViabilidad({
      fechasOptimas, parejasNecesarias, reproductoresSeleccionados,
      animalesListos, impactoColonia, capacidadFutura, indiceSanitario,
    })
    const impactoEstrategico         = evaluarImpactoEstrategico({
      pedido: pedidoSeleccionado, animales, camadas, jaulas,
      reproductoresSeleccionados, capacidadFutura, impactoColonia,
      indiceSanitario, pedidosTodos: pedidos,
    })
    const indiceImpactoFuturo        = calcularIndiceImpactoFuturo(
      impactoEstrategico, indiceSanitario, detectarSuperavit(animales, pedidoSeleccionado.bioterioId)
    )
    const escenariosEstrategicos     = simularEscenariosEstrategicos(
      pedidoSeleccionado, camadas, animales, jaulas, indiceSanitario
    )
    const reproductoresProximos      = detectarReproductoresProximos(pedidoSeleccionado, animales)

    return {
      bio: bioPedido, parejasNecesarias, fechasOptimas,
      reproductoresSeleccionados, animalesListos, capacidadFutura,
      impactoColonia, indiceSanitario, viabilidad,
      impactoEstrategico, indiceImpactoFuturo, escenariosEstrategicos,
      reproductoresProximos,
    }
  }, [pedidoSeleccionado, animales, camadas, jaulas, sacrificios, entregas, incidentes, pedidos])

  // ── Scores de viabilidad para todas las tarjetas ──────────────────────────
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
        const viab      = calcularIndiceViabilidad({
          fechasOptimas: fechas, parejasNecesarias: parejas,
          reproductoresSeleccionados: repros, animalesListos: aListos,
          impactoColonia: impacto, capacidadFutura: capac,
        })
        result[p.id] = viab.score
      } catch { result[p.id] = 0 }
    }
    return result
  }, [pedidos, animales, camadas, jaulas, sacrificios, entregas])

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleGuardar(form) {
    try {
      if (form.id) {
        await editarPedido({ ...form, updated_at: new Date().toISOString().split('T')[0] })
      } else {
        await agregarPedido(form)
      }
    } catch (e) {
      console.error('Error al guardar pedido:', e)
    }
    setModalFormAbierto(false)
    setPedidoEditando(null)
  }

  async function handleEliminar(id) {
    await eliminarPedidoCtx(id)
    if (pedidoSelId === id) setPedidoSelId(null)
    setConfirmEliminarId(null)
  }

  async function handleCambiarEstado(id, nuevoEstado) {
    const pedido = pedidos.find(p => p.id === id)
    if (!pedido) return
    await editarPedido({ ...pedido, estado: nuevoEstado, updated_at: new Date().toISOString().split('T')[0] })
  }

  function handleReservarReproductores(pedido) {
    if (!analisis) return
    const { hembrasSugeridas, machosSugeridos } = analisis.reproductoresSeleccionados
    for (const { animal } of [...hembrasSugeridas, ...machosSugeridos]) {
      reservarAnimal(animal.id, 'pedido', `Pedido ${pedido.id}`, pedido.bioterioId)
    }
    alert(`${hembrasSugeridas.length + machosSugeridos.length} reproductores reservados para este pedido.`)
  }

  const stats = useMemo(() => ({
    total:       pedidos.length,
    pendientes:  pedidos.filter(p => p.estado === 'pendiente').length,
    enProceso:   pedidos.filter(p => p.estado === 'en_proceso').length,
    completados: pedidos.filter(p => p.estado === 'completado').length,
  }), [pedidos])

  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: '14px' }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: tema.textPrimary }}>📦 Pedidos de producción</h1>
          <p className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
            Estrategia automática · Cronograma reproductivo · Análisis de impacto
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle modo sostenible */}
          <button
            onClick={() => setModoSostenible(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: modoSostenible ? 'rgba(0,230,118,0.1)' : 'rgba(8,13,26,0.4)',
              border: `1px solid ${modoSostenible ? 'rgba(0,230,118,0.3)' : 'rgba(30,51,82,0.7)'}`,
              color: modoSostenible ? '#00e676' : '#4a5f7a',
              cursor: 'pointer',
            }}>
            🌱 {modoSostenible ? 'Sostenible ✓' : 'Modo sostenible'}
          </button>
          <button
            onClick={() => { setPedidoEditando(null); setModalFormAbierto(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.35)', color: '#00e676', cursor: 'pointer' }}>
            + Nuevo pedido
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
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

      {/* ── Layout: lista + análisis ───────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Lista de pedidos */}
        <div className="shrink-0" style={{ width: pedidoSeleccionado ? '300px' : '100%' }}>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {[{ id: 'todos', label: 'Todos' }, ...ESTADOS_PEDIDO].map(f => (
              <button key={f.id} onClick={() => setFiltroEstado(f.id)}
                className="px-3 py-1 rounded-lg text-xs font-semibold"
                style={{
                  background: filtroEstado === f.id ? 'rgba(0,230,118,0.1)' : 'rgba(8,13,26,0.4)',
                  border: filtroEstado === f.id ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(30,51,82,0.7)',
                  color: filtroEstado === f.id ? '#00e676' : '#4a5f7a',
                  cursor: 'pointer',
                }}>
                {f.label ?? f.id}
              </button>
            ))}
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={cardStyle}>
              <div className="text-3xl mb-3">📋</div>
              <div className="font-semibold mb-1" style={{ color: tema.textPrimary }}>Sin pedidos</div>
              <div className="text-xs mb-4" style={{ color: tema.textMuted }}>
                {filtroEstado !== 'todos'
                  ? 'No hay pedidos con este estado.'
                  : 'Creá el primer pedido para generar la estrategia de producción automáticamente.'}
              </div>
              {filtroEstado === 'todos' && (
                <button onClick={() => setModalFormAbierto(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(0,230,118,0.1)', border: '1.5px solid rgba(0,230,118,0.3)', color: '#00e676', cursor: 'pointer' }}>
                  + Crear primer pedido
                </button>
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
              modoSostenible={modoSostenible}
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

      {/* ── Confirmar eliminación ────────────────────────────────────────── */}
      {confirmEliminarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: tema.bgCard, border: '1px solid rgba(255,61,87,0.3)' }}>
            <div className="text-3xl mb-3">🗑️</div>
            <div className="font-bold mb-2" style={{ color: tema.textPrimary }}>¿Eliminar pedido?</div>
            <div className="text-xs mb-5" style={{ color: tema.textMuted }}>Esta acción no se puede deshacer.</div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEliminarId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => handleEliminar(confirmEliminarId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.12)', border: '1.5px solid rgba(255,61,87,0.35)', color: '#ff6b80', cursor: 'pointer' }}>
                ✕ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
