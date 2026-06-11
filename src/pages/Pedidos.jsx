// ─────────────────────────────────────────────────────────────────────────────
// Pedidos.jsx — GPS biológico de producción
// Vista principal: qué hacer y cuándo.
// Detalles técnicos: solapas secundarias opcionales.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import { useBioterio }        from '../context/BiotheriumContext'
import { useTheme }           from '../context/ThemeContext'
import { getBio }             from '../utils/constants'
import { formatFecha, hoy }   from '../utils/calculos'
import {
  calcularParejasNecesarias, calcularFechasOptimas,
  seleccionarReproductoresOptimos, detectarAnimalesListos,
  evaluarCapacidadFutura, evaluarImpactoColonia, calcularIndiceViabilidad,
  evaluarImpactoEstrategico, calcularIndiceImpactoFuturo,
  detectarSuperavit, detectarReproductoresProximos,
  calcularProduccionEnCurso, calcularPedidoEscalonado,
  evaluarRiesgoMultifactorialPedido,
  // Nuevas funciones biológicas
  calcularCapacidadReproductivaDinamica, calcularCrecimientoColateral,
  generarEstrategiasBiologicas, generarPlanOperativo, determinarProximaAccion,
  nivelViabilidad, labelBioterio, labelSexo, labelUso, colorEstadoPedido,
} from '../utils/motorPedidos'
import { reservarAnimal } from '../utils/motorDecisiones'
import { calcularIndiceSanitario } from '../utils/sanitario'

// ─── Constantes ──────────────────────────────────────────────────────────────
const BIOTERIOS_OPCIONES = [
  { id: 'ratas',            label: '🐀 Ratas (Rattus norvegicus)' },
  { id: 'ratones_balbc',    label: '🐭 BALB/C' },
  { id: 'ratones_c57',      label: '🐭 C57BL/6' },
  { id: 'ratones_hibridos', label: '🧬 Híbridos F1' },
]
const getEstadosPedido = (tema) => [
  { id: 'pendiente',  label: 'Pendiente',  color: tema.amber },
  { id: 'en_proceso', label: 'En proceso', color: tema.blue },
  { id: 'completado', label: 'Completado', color: tema.accent },
  { id: 'cancelado',  label: 'Cancelado',  color: tema.red },
]
// ─── Badge viabilidad ─────────────────────────────────────────────────────────
function ViabilidadBadge({ score, small = false }) {
  const n = nivelViabilidad(score)
  return (
    <span className="inline-flex items-center gap-1 font-bold rounded-lg"
      style={{ background: n.bg, border: `1px solid ${n.borde}`, color: n.color,
        padding: small ? '2px 8px' : '4px 10px', fontSize: small ? '11px' : '12px' }}>
      <span>{n.emoji}</span><span>{score}</span>
      {!small && <span style={{ fontWeight: 400, opacity: 0.8 }}>{n.label}</span>}
    </span>
  )
}

// ─── PRÓXIMA ACCIÓN ───────────────────────────────────────────────────────────
function ProximaAccionCard({ proximaAccion, tema }) {
  if (!proximaAccion?.existe) {
    return (
      <div className="rounded-2xl p-4" style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
        <div className="text-xs font-bold uppercase mb-1.5" style={{ color: tema.textMuted, letterSpacing: '0.08em' }}>
          Próxima acción
        </div>
        <div className="text-sm" style={{ color: tema.textMuted }}>
          Completá la fecha de entrega y la edad requerida para generar el plan
        </div>
      </div>
    )
  }

  const urgente = proximaAccion.urgente
  const esEntrega = proximaAccion.tipo === 'entrega'
  const color = urgente ? '#ff6b80' : esEntrega ? '#00e676' : '#40c4ff'
  const bg    = urgente ? 'rgba(255,61,87,0.08)'   : esEntrega ? 'rgba(0,230,118,0.07)'  : 'rgba(64,196,255,0.07)'
  const borde = urgente ? 'rgba(255,61,87,0.35)'   : esEntrega ? 'rgba(0,230,118,0.3)'   : 'rgba(64,196,255,0.3)'

  const labelDias = (() => {
    const d = proximaAccion.diasRestantes
    if (d === null) return null
    if (d < 0)  return `hace ${Math.abs(d)} día${Math.abs(d) > 1 ? 's' : ''}`
    if (d === 0) return 'HOY'
    if (d === 1) return 'mañana'
    return `en ${d} días`
  })()

  return (
    <div className="rounded-2xl p-5" style={{ background: bg, border: `2px solid ${borde}` }}>
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0 mt-0.5">{proximaAccion.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
              {urgente ? '⚡ ACCIÓN URGENTE' : 'PRÓXIMA ACCIÓN'}
            </span>
            {labelDias && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ background: urgente ? 'rgba(255,61,87,0.15)' : 'rgba(64,196,255,0.12)', color }}>
                {labelDias}
              </span>
            )}
            {proximaAccion.fecha && (
              <span className="text-xs font-mono" style={{ color: tema.textMuted }}>
                {formatFecha(proximaAccion.fecha)}
              </span>
            )}
          </div>
          <div className="font-bold text-lg leading-tight mb-1.5" style={{ color: tema.textPrimary }}>
            {proximaAccion.accion}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: tema.textMuted }}>
            {proximaAccion.descripcion}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CRONOGRAMA GPS ───────────────────────────────────────────────────────────
function CronogramaGPS({ planOperativo, tema }) {
  if (!planOperativo || planOperativo.length === 0) return null

  return (
    <div className="rounded-2xl p-4" style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
      <div className="text-xs font-bold uppercase mb-3" style={{ color: tema.textMuted, letterSpacing: '0.08em' }}>
        Cronograma
      </div>
      <div className="space-y-0">
        {planOperativo.map((paso, i) => {
          const d = paso.diasRestantes
          const labelD = d === null ? '' : d < 0 ? `hace ${Math.abs(d)}d` : d === 0 ? 'HOY' : `en ${d}d`
          const color = paso.importante ? '#00e676'
            : paso.urgente ? '#ff6b80'
            : d !== null && d <= 14 && d >= 0 ? '#ffb300'
            : tema.textSecondary
          const colorD = d !== null && d < 0 ? '#ff6b80' : d === 0 ? '#00e676' : d !== null && d <= 14 ? '#ffb300' : '#4a5f7a'

          return (
            <div key={i}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: i < planOperativo.length - 1 ? `1px solid ${tema.bgCardBorde}` : 'none' }}>
              <div className="text-base w-6 text-center flex-shrink-0">{paso.emoji}</div>
              <div className="flex-1 text-xs font-semibold truncate" style={{ color }}>{paso.accion}</div>
              {labelD && (
                <div className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: colorD }}>
                  {labelD}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ESTRATEGIA ELEGIDA ───────────────────────────────────────────────────────
function EstrategiaElegidaBanner({ optima, tema }) {
  if (!optima) return null
  return (
    <div className="rounded-2xl px-4 py-3"
      style={{ background: 'rgba(64,196,255,0.07)', border: '1.5px solid rgba(64,196,255,0.25)' }}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{optima.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-bold uppercase" style={{ color: tema.blue, letterSpacing: '0.07em' }}>
              Estrategia óptima
            </span>
            <span className="text-xs font-bold" style={{ color: tema.textPrimary }}>{optima.nombre}</span>
          </div>
          <div className="text-xs" style={{ color: tema.textMuted }}>{optima.razon}</div>
          {optima.estrategia?.porQueElegir && (
            <div className="text-xs mt-0.5" style={{ color: '#3a5068' }}>{optima.estrategia.porQueElegir}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ALERTAS CRÍTICAS ─────────────────────────────────────────────────────────
function AlertasCriticas({ analisis, tema }) {
  const alertas = []
  const { impactoColonia, capacidadReproductiva, indiceSanitario, riesgoMultifactorial } = analisis

  if (impactoColonia?.riesgoNivel === 'critico')
    alertas.push({ nivel: 'critico', msg: impactoColonia.impactos[0]?.mensaje ?? 'Rompe mínimos de la colonia' })

  if (capacidadReproductiva?.generacionRequerida === 'Sin tiempo')
    alertas.push({ nivel: 'critico', msg: 'Tiempo insuficiente — incluso el stock actual no llega a la edad requerida' })

  if (riesgoMultifactorial?.nivel === 'critico')
    alertas.push({ nivel: 'critico', msg: riesgoMultifactorial.factores[0]?.desc ?? 'Riesgo multifactorial crítico' })

  if (indiceSanitario < 50)
    alertas.push({ nivel: 'critico', msg: `Índice sanitario crítico (${indiceSanitario}/100) — no recomendable iniciar nuevas camadas` })

  if (alertas.length === 0) return null

  return (
    <div className="space-y-2">
      {alertas.map((a, i) => (
        <div key={i} className="rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{ background: 'rgba(255,61,87,0.09)', border: '1px solid rgba(255,61,87,0.3)', color: tema.red }}>
          🔴 {a.msg}
        </div>
      ))}
    </div>
  )
}

// ─── ACCIONES DEL PEDIDO ──────────────────────────────────────────────────────
function AccionesPedido({ pedido, analisis, onCambiarEstado, onReservarReproductores, tema }) {
  const { reproductoresSeleccionados } = analisis
  return (
    <div className="flex gap-2 flex-wrap">
      {pedido.estado === 'pendiente' && (
        <>
          <button onClick={() => onCambiarEstado(pedido.id, 'en_proceso')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)', color: tema.blue, cursor: 'pointer' }}>
            ▶ Iniciar pedido
          </button>
          {reproductoresSeleccionados?.suficientesHembras && (
            <button onClick={() => onReservarReproductores(pedido)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', color: tema.amber, cursor: 'pointer' }}>
              🔒 Reservar reproductores
            </button>
          )}
        </>
      )}
      {pedido.estado === 'en_proceso' && (
        <button onClick={() => onCambiarEstado(pedido.id, 'completado')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: tema.accent, cursor: 'pointer' }}>
          ✓ Marcar completado
        </button>
      )}
      {!['cancelado', 'completado'].includes(pedido.estado) && (
        <button onClick={() => onCambiarEstado(pedido.id, 'cancelado')}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.2)', color: tema.red, cursor: 'pointer' }}>
          ✕ Cancelar
        </button>
      )}
    </div>
  )
}

// ─── TAB ESTRATEGIAS ──────────────────────────────────────────────────────────
function TabEstrategias({ estrategiasBiologicas, tema }) {
  const { estrategias, optima } = estrategiasBiologicas
  return (
    <div className="space-y-3">
      {optima && (
        <div className="rounded-xl px-3 py-2"
          style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)' }}>
          <span className="text-xs font-bold" style={{ color: tema.blue }}>
            🏆 Óptima: {optima.emoji} {optima.nombre}
          </span>
          <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{optima.razon}</div>
        </div>
      )}
      <div className="space-y-2">
        {estrategias.map(esc => {
          const esOptima = esc.id === optima?.id
          const noViable = esc.viable === false
          return (
            <div key={esc.id} className="rounded-xl p-3"
              style={{
                background: noViable ? tema.bgCard : esOptima ? 'rgba(0,230,118,0.05)' : tema.bgCard,
                border: `1.5px solid ${noViable ? tema.bgCardBorde : esOptima ? 'rgba(0,230,118,0.25)' : tema.bgCardBorde}`,
                opacity: noViable ? 0.6 : 1,
              }}>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-base">{esc.emoji}</span>
                  <span className="text-sm font-bold" style={{ color: tema.textPrimary }}>{esc.nombre}</span>
                  {esOptima && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: tema.accent }}>
                      ✦ óptima
                    </span>
                  )}
                  {noViable && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: tema.red }}>
                      No viable
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold"
                  style={{ color: esc.probabilidad >= 85 ? '#00e676' : esc.probabilidad >= 70 ? '#ffb300' : '#ff6b80' }}>
                  {esc.probabilidad}%
                </span>
              </div>

              <div className="text-xs mb-2" style={{ color: tema.textMuted }}>{esc.descripcion}</div>

              <div className="flex items-center gap-3 text-xs flex-wrap mb-2">
                <span style={{ color: tema.purple }}>♀ {esc.hembrasNecesarias} hembras</span>
                <span style={{ color: tema.blue }}>♂ {esc.machosNecesarios} machos</span>
                <span style={{ color: tema.textPrimary }}>📦 {esc.jaulasNuevas} jaulas nuevas</span>
                {esc.tiempoExtra > 0 && <span style={{ color: tema.amber }}>⏳ +{esc.tiempoExtra}d</span>}
                {esc.crecimientoColateral?.totalExcedente > 0 && (
                  <span style={{ color: tema.accent }}>+{esc.crecimientoColateral.totalExcedente} excedente</span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap mb-2">
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: esc.rompeMinimos ? 'rgba(255,61,87,0.08)' : 'rgba(0,230,118,0.06)',
                    border: `1px solid ${esc.rompeMinimos ? 'rgba(255,61,87,0.25)' : 'rgba(0,230,118,0.2)'}`,
                    color: esc.rompeMinimos ? '#ff6b80' : '#00e676',
                  }}>
                  {esc.rompeMinimos ? '🔴 rompe mínimos' : '🟢 colonia segura'}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: esc.saturacion ? 'rgba(255,179,0,0.07)' : tema.bgCard,
                    border: `1px solid ${esc.saturacion ? 'rgba(255,179,0,0.2)' : tema.bgCardBorde}`,
                    color: esc.saturacion ? '#ffb300' : '#4a5f7a',
                  }}>
                  {esc.saturacion ? '⚠ saturación' : 'Sin saturación'}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, color: tema.textMuted }}>
                  Impacto: {esc.impactoColonia}
                </span>
              </div>

              {esc.porQueElegir && (
                <div className="text-xs mb-1" style={{ color: tema.textMuted }}>
                  💡 {esc.porQueElegir}
                </div>
              )}
              {esc.riesgos?.length > 0 && (
                <div className="space-y-0.5">
                  {esc.riesgos.map((r, i) => (
                    <div key={i} className="text-xs" style={{ color: tema.red }}>⚠ {r}</div>
                  ))}
                </div>
              )}

              {/* Barra de probabilidad */}
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)' }}>
                <div className="h-full rounded-full"
                  style={{
                    width: `${esc.probabilidad}%`,
                    background: esc.probabilidad >= 85 ? '#00e676' : esc.probabilidad >= 70 ? '#ffb300' : '#ff6b80',
                  }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── TAB MOTOR REPRODUCTIVO ───────────────────────────────────────────────────
function TabMotorReproductivo({ capacidadReproductiva, tema }) {
  if (!capacidadReproductiva) return (
    <div className="text-xs text-center py-4" style={{ color: tema.textMuted }}>
      Completá la fecha de entrega para ver el análisis generacional
    </div>
  )

  const { futurosReproductores, noAptos,
    hembrasProtegidas, machosProtegidos, hembrasDisponiblesRepro, machosDisponiblesRepro,
    stockLibre, futurosEntregables, totalEntregable,
    generacionRequerida, descripcionGeneracion, emoji,
    hembrasActivas, machosActivos, minimoH, minimoM } = capacidadReproductiva

  const seccion = (titulo, items, color, emptyMsg) => (
    <div className="mb-3">
      <div className="text-xs font-bold mb-1.5" style={{ color }}>{titulo} ({items.length})</div>
      {items.length === 0
        ? <div className="text-xs" style={{ color: '#3a5068' }}>{emptyMsg}</div>
        : items.slice(0, 5).map(({ animal, diasVida, razon, diasParaMadurar }, i) => (
          <div key={i} className="flex items-center justify-between rounded px-2 py-1 mb-0.5"
            style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
            <span className="text-xs font-mono" style={{ color }}>
              {animal.sexo === 'hembra' ? '♀' : '♂'} {animal.codigo}
            </span>
            <span className="text-xs" style={{ color: tema.textMuted }}>
              {razon ?? (diasParaMadurar ? `madura en ${diasParaMadurar}d` : `${diasVida}d`)}
            </span>
          </div>
        ))
      }
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Generación requerida */}
      <div className="rounded-xl p-3"
        style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{emoji}</span>
          <span className="text-sm font-bold" style={{ color: tema.blue }}>
            Generación requerida: {generacionRequerida}
          </span>
        </div>
        <div className="text-xs" style={{ color: tema.textMuted }}>{descripcionGeneracion}</div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-center">
          {[
            { label: 'Stock libre', val: stockLibre, color: tema.accent },
            { label: 'En camino', val: futurosEntregables, color: tema.blue },
            { label: 'Total posible', val: totalEntregable, color: tema.textPrimary },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-lg py-1.5"
              style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="font-bold" style={{ color }}>{val}</div>
              <div style={{ color: tema.textMuted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Clasificación de reproductores */}
      <div>
        <div className="text-xs font-bold mb-2 uppercase" style={{ color: tema.textMuted, letterSpacing: '0.07em' }}>
          Clasificación de reproductores
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: '🔒 Protegidos (mínimos)', h: hembrasProtegidas, m: machosProtegidos, color: tema.purple, desc: 'Nunca entregables' },
            { label: '✅ Disponibles', h: hembrasDisponiblesRepro, m: machosDisponiblesRepro, color: tema.accent, desc: 'Para este pedido' },
          ].map(({ label, h, m, color, desc }) => (
            <div key={label} className="rounded-xl p-2.5"
              style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
              <div className="text-xs font-bold mb-1" style={{ color }}>{label}</div>
              <div className="text-xs" style={{ color: tema.textPrimary }}>♀ {h} hembras · ♂ {m} machos</div>
              <div className="text-xs mt-0.5" style={{ color: '#3a5068' }}>{desc}</div>
            </div>
          ))}
        </div>
        {seccion('🟡 Próximos a madurar', futurosReproductores, '#ffb300', 'Ninguno')}
        {noAptos.length > 0 && seccion('⛔ No aptos', noAptos, '#ff6b80', '')}
      </div>

      {/* Total activos */}
      <div className="rounded-xl p-3 text-xs"
        style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
        <div className="font-semibold mb-1" style={{ color: tema.textSecondary }}>Colonia activa total</div>
        <div className="flex gap-4">
          <span style={{ color: tema.purple }}>♀ {hembrasActivas} hembras (mín: {minimoH})</span>
          <span style={{ color: tema.blue }}>♂ {machosActivos} machos (mín: {minimoM})</span>
        </div>
      </div>
    </div>
  )
}

// ─── TAB REPRODUCTORES ────────────────────────────────────────────────────────
function TabReproductores({ reproductoresSeleccionados, reproductoresProximos, tema }) {
  const { hembrasSugeridas, machosSugeridos, hembrasDisponibles, machosDisponibles,
    hembrasNecesarias, machosNecesarios, suficientesHembras, suficientesMachos } = reproductoresSeleccionados

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { sexo: '♀ Hembras', disp: hembrasDisponibles, nec: hembrasNecesarias,
            ok: suficientesHembras, proximos: reproductoresProximos?.hembrasProximas ?? [], color: tema.purple },
          { sexo: '♂ Machos', disp: machosDisponibles, nec: machosNecesarios,
            ok: suficientesMachos, proximos: reproductoresProximos?.machosProximos ?? [], color: tema.blue },
        ].map(({ sexo, disp, nec, ok, proximos, color }) => (
          <div key={sexo} className="rounded-lg p-2.5"
            style={{
              background: ok ? 'rgba(0,230,118,0.05)' : 'rgba(255,61,87,0.05)',
              border: `1px solid ${ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.2)'}`,
            }}>
            <div className="text-xs font-bold mb-0.5" style={{ color }}>{sexo}: {disp}/{nec}</div>
            {!ok && proximos.length > 0 ? (
              <div className="text-xs" style={{ color: tema.amber }}>
                🟡 {proximos.length} en {proximos[0].diasParaMadurar}d
              </div>
            ) : !ok ? (
              <div className="text-xs" style={{ color: tema.red }}>Sin candidatos</div>
            ) : (
              <div className="text-xs" style={{ color: tema.accent }}>✓ Suficientes</div>
            )}
          </div>
        ))}
      </div>

      {(hembrasSugeridas.length > 0 || machosSugeridos.length > 0) && (
        <div className="space-y-1">
          <div className="text-xs font-bold mb-1" style={{ color: tema.textMuted }}>Sugeridos</div>
          {hembrasSugeridas.map(({ animal, scoreRepro, nivelF, fPorc }) => (
            <div key={animal.id} className="flex items-center justify-between rounded px-2 py-1.5"
              style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
              <span className="text-xs font-mono font-semibold" style={{ color: tema.purple }}>♀ {animal.codigo}</span>
              <div className="flex gap-3 text-xs">
                <span style={{ color: tema.textPrimary }}>Score {scoreRepro}</span>
                <span style={{ color: nivelF === 'alto' ? '#ff6b80' : nivelF === 'moderado' ? '#ffb300' : '#4a5f7a' }}>
                  F {fPorc}
                </span>
              </div>
            </div>
          ))}
          {machosSugeridos.map(({ animal, scoreRepro, nivelF, fPorc }) => (
            <div key={animal.id} className="flex items-center justify-between rounded px-2 py-1.5"
              style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
              <span className="text-xs font-mono font-semibold" style={{ color: tema.blue }}>♂ {animal.codigo}</span>
              <div className="flex gap-3 text-xs">
                <span style={{ color: tema.textPrimary }}>Score {scoreRepro}</span>
                <span style={{ color: nivelF === 'alto' ? '#ff6b80' : nivelF === 'moderado' ? '#ffb300' : '#4a5f7a' }}>
                  F {fPorc}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB COLONIA ──────────────────────────────────────────────────────────────
function TabColonia({ impactoColonia, impactoEstrategico, crecimientoColateral, indiceSanitario, tema }) {
  return (
    <div className="space-y-3">
      {/* Antes/después */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Antes del pedido', h: impactoColonia.hembrasActivas, m: impactoColonia.machosActivos, color: tema.textSecondary },
          { label: 'Después del pedido', h: impactoColonia.hembrasDespues, m: impactoColonia.machosDespues,
            color: impactoColonia.riesgoNivel === 'critico' ? '#ff6b80' : impactoColonia.riesgoNivel === 'advertencia' ? '#ffb300' : '#00e676' },
        ].map(({ label, h, m, color }) => (
          <div key={label} className="rounded-xl p-2.5 text-xs"
            style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="font-semibold mb-1" style={{ color: tema.textMuted }}>{label}</div>
            <div style={{ color }}>♀ {h} hembras</div>
            <div style={{ color }}>♂ {m} machos</div>
          </div>
        ))}
      </div>

      {/* Mínimos */}
      <div className="rounded-xl px-3 py-2 text-xs"
        style={{
          background: impactoColonia.riesgoNivel === 'critico' ? 'rgba(255,61,87,0.07)' : impactoColonia.riesgoNivel === 'advertencia' ? 'rgba(255,179,0,0.06)' : 'rgba(0,230,118,0.05)',
          border: `1px solid ${impactoColonia.riesgoNivel === 'critico' ? 'rgba(255,61,87,0.25)' : impactoColonia.riesgoNivel === 'advertencia' ? 'rgba(255,179,0,0.2)' : 'rgba(0,230,118,0.2)'}`,
          color: impactoColonia.riesgoNivel === 'critico' ? '#ff6b80' : impactoColonia.riesgoNivel === 'advertencia' ? '#ffb300' : '#00e676',
        }}>
        {impactoColonia.etiquetaRiesgo} · Mínimos: ♀ {impactoColonia.minimoHembras} / ♂ {impactoColonia.minimoMachos}
      </div>

      {/* Crecimiento colateral */}
      {crecimientoColateral && crecimientoColateral.totalExcedente > 0 && (
        <div className="rounded-xl p-3"
          style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.18)' }}>
          <div className="text-xs font-bold mb-1.5" style={{ color: tema.accent }}>
            🌱 Crecimiento colateral del pedido
          </div>
          <div className="text-xs" style={{ color: tema.textMuted }}>{crecimientoColateral.descripcion}</div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-center">
            {[
              { label: '♀ sobrantes', val: crecimientoColateral.hembrasSobrantes, color: tema.purple },
              { label: '♂ sobrantes', val: crecimientoColateral.machosSobrantes, color: tema.blue },
              { label: 'Futuras repro.', val: crecimientoColateral.futuraReproductorasH, color: tema.accent },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-lg py-1.5"
                style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
                <div className="font-bold" style={{ color }}>{val}</div>
                <div style={{ color: tema.textMuted }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sanitario */}
      <div className="rounded-xl px-3 py-2 text-xs"
        style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
        <span style={{ color: tema.textMuted }}>Índice sanitario: </span>
        <span style={{ color: indiceSanitario >= 75 ? '#00e676' : indiceSanitario >= 50 ? '#ffb300' : '#ff6b80' }}>
          {indiceSanitario}/100
        </span>
      </div>

      {/* Riesgos estratégicos */}
      {impactoEstrategico?.riesgos?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold" style={{ color: tema.textMuted }}>Riesgos estratégicos</div>
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
    </div>
  )
}

// ─── TAB PRODUCCIÓN ───────────────────────────────────────────────────────────
function TabProduccion({ parejasNecesarias, animalesListos, produccionEnCurso, impactoColonia, pedido, tema }) {
  return (
    <div className="space-y-3">
      {/* Colonia base vs Producción */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5"
          style={{ background: 'rgba(156,39,176,0.07)', border: '1px solid rgba(156,39,176,0.2)' }}>
          <div className="text-xs font-bold mb-1" style={{ color: tema.purple }}>🧬 Colonia base</div>
          <div className="text-xs" style={{ color: tema.textMuted }}>
            <div>♀ {impactoColonia.hembrasActivas} reproductoras</div>
            <div>♂ {impactoColonia.machosActivos} reproductores</div>
            <div className="mt-1" style={{ color: '#3a5068' }}>Protegidos — nunca entregables</div>
          </div>
        </div>
        <div className="rounded-lg p-2.5"
          style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.18)' }}>
          <div className="text-xs font-bold mb-1" style={{ color: tema.accent }}>📦 Producción</div>
          <div className="text-xs" style={{ color: tema.textMuted }}>
            <div>Stock ahora: <span style={{ color: tema.textPrimary }}>{animalesListos.disponibles}</span></div>
            <div>En camino: <span style={{ color: tema.textPrimary }}>{produccionEnCurso.totalProyectado}</span></div>
            <div className="mt-1 font-semibold" style={{
              color: (animalesListos.disponibles + produccionEnCurso.totalProyectado) >= (pedido.cantidad ?? 0) ? '#00e676' : '#ffb300',
            }}>
              Total: {animalesListos.disponibles + produccionEnCurso.totalProyectado}/{pedido.cantidad ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Stock actual */}
      <div className="rounded-lg px-3 py-2"
        style={{
          background: animalesListos.cubiertoConStock ? 'rgba(0,230,118,0.05)' : tema.bgCard,
          border: `1px solid ${animalesListos.cubiertoConStock ? 'rgba(0,230,118,0.2)' : tema.bgCardBorde}`,
        }}>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: tema.textMuted }}>📦 Stock disponible ahora</span>
          <span style={{ color: animalesListos.cubiertoConStock ? '#00e676' : animalesListos.porcentajeCubierto > 50 ? '#ffb300' : '#ff6b80' }}>
            {animalesListos.cubiertoConStock
              ? `✅ Cubierto (${animalesListos.disponibles})`
              : `${animalesListos.disponibles}/${animalesListos.necesarios} (${animalesListos.porcentajeCubierto}%)`}
          </span>
        </div>
      </div>

      {/* Camadas en curso */}
      {produccionEnCurso.tandas.length > 0 ? (
        <div className="rounded-lg p-2.5"
          style={{ background: 'rgba(64,196,255,0.05)', border: '1px solid rgba(64,196,255,0.2)' }}>
          <div className="text-xs font-semibold mb-1.5" style={{ color: tema.blue }}>
            🔄 En camino — {produccionEnCurso.totalProyectado} animales proyectados
          </div>
          {produccionEnCurso.tandas.map(t => (
            <div key={t.camadaId} className="flex items-center justify-between text-xs mb-0.5"
              style={{ color: tema.textMuted }}>
              <span>{t.estado === 'en_gestacion' ? '🤰 Gestación' : t.estado === 'en_cria' ? '🐣 En cría' : '✅ Destetada'}</span>
              <span style={{ color: tema.textPrimary }}>{t.dispDelSexo} animales</span>
              <span style={{ color: t.diasHastaDisponible <= 0 ? '#00e676' : t.diasHastaDisponible <= 30 ? '#ffb300' : '#4a5f7a' }}>
                {t.diasHastaDisponible <= 0 ? 'Listo' : `en ${t.diasHastaDisponible}d`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs px-3 py-2 rounded-lg"
          style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, color: '#3a5068' }}>
          Sin camadas activas que produzcan animales en el rango de edad requerido
        </div>
      )}

      {/* Parejas necesarias */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '♀ Hembras', val: parejasNecesarias.hembrasNecesarias, color: tema.purple },
          { label: '♂ Machos',  val: parejasNecesarias.machosNecesarios,  color: tema.blue },
          { label: '~Crías',    val: parejasNecesarias.animalesEstimados,  color: tema.textPrimary },
          { label: 'Prob.',     val: `${parejasNecesarias.probabilidad}%`, color: tema.accent },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-lg p-2 text-center"
            style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="font-mono font-bold" style={{ color }}>{val}</div>
            <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{label}</div>
          </div>
        ))}
      </div>

      {!parejasNecesarias.hist.conDatos && (
        <div className="rounded-lg px-3 py-1.5 text-xs"
          style={{ background: 'rgba(255,179,0,0.05)', border: '1px solid rgba(255,179,0,0.18)', color: tema.amber }}>
          ⚠ Valores bibliográficos — registrá más camadas para mayor precisión
        </div>
      )}
    </div>
  )
}

// ─── TAB ESCALONADO ───────────────────────────────────────────────────────────
function TabEscalonado({ pedidoEscalonado, tema }) {
  if (!pedidoEscalonado) return (
    <div className="text-xs text-center py-4" style={{ color: tema.textMuted }}>
      Este pedido no es escalonado. Cambiá la modalidad para activar esta vista.
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="text-xs mb-2" style={{ color: tema.textMuted }}>
        Cada {pedidoEscalonado.frecuenciaDias} días · {pedidoEscalonado.totalAnimales} animales totales
      </div>
      {pedidoEscalonado.tandas.map(tanda => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
        const diasHasta = tanda.fechas ? Math.round((new Date(tanda.fechaEntrega) - hoy) / 86400000) : null
        return (
          <div key={tanda.numero} className="rounded-xl p-3"
            style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: tema.blue }}>
                📦 Tanda {tanda.numero} — {tanda.cantidad} animales
              </span>
              <span className="text-xs font-mono" style={{ color: tema.textPrimary }}>
                {formatFecha(tanda.fechaEntrega)}
                {diasHasta != null && (
                  <span style={{ color: diasHasta < 0 ? '#ff6b80' : diasHasta <= 14 ? '#ffb300' : '#4a5f7a', marginLeft: '6px' }}>
                    {diasHasta < 0 ? `vencida` : diasHasta === 0 ? 'hoy' : `en ${diasHasta}d`}
                  </span>
                )}
              </span>
            </div>
            {tanda.fechas && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: '#3a5068' }}>
                <span>🔗 Cópulas: <span style={{ color: tema.textPrimary }}>{formatFecha(tanda.fechas.fechaCopula)}</span></span>
                <span>🐣 Parto: <span style={{ color: tema.textPrimary }}>{formatFecha(tanda.fechas.fechaNacimiento)}</span></span>
                {!tanda.fechas.viable && (
                  <span className="col-span-2" style={{ color: tema.red }}>⚠ Tiempo insuficiente para esta tanda</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── PANEL DE ANÁLISIS ────────────────────────────────────────────────────────
function AnalisisPedido({ pedido, analisis, onCambiarEstado, onReservarReproductores, tema }) {
  const ESTADOS_PEDIDO = getEstadosPedido(tema)
  const [tabAbierta, setTabAbierta] = useState(null)

  const {
    parejasNecesarias, reproductoresSeleccionados,
    animalesListos, impactoColonia, indiceSanitario, viabilidad,
    impactoEstrategico,
    reproductoresProximos, produccionEnCurso, pedidoEscalonado,
    // Nuevas
    capacidadReproductiva, crecimientoColateral,
    estrategiasBiologicas, planOperativo, proximaAccion,
  } = analisis

  const nivel    = nivelViabilidad(viabilidad.score)
  const colorEst = colorEstadoPedido(pedido.estado)

  const TABS = [
    { id: 'plan',        label: '📋 Plan completo' },
    { id: 'estrategias', label: '⚡ Estrategias' },
    { id: 'motor',       label: '🧬 Motor' },
    { id: 'repros',      label: '🔬 Reproductores' },
    { id: 'colonia',     label: '🌿 Colonia' },
    { id: 'produccion',  label: '📦 Producción' },
    ...(pedidoEscalonado ? [{ id: 'escalonado', label: '📅 Escalonado' }] : []),
  ]

  function toggleTab(id) {
    setTabAbierta(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-3">

      {/* ── Header: nombre + estado + viabilidad ──────────────────────────────── */}
      <div className="rounded-2xl p-4" style={{ background: tema.bgCard, border: `1.5px solid ${nivel.borde}`, boxShadow: `0 0 24px ${nivel.bg}` }}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base" style={{ color: tema.textPrimary }}>
                {pedido.cantidad} {labelSexo(pedido.sexo)} · {pedido.edadSemanas} sem
              </span>
              <span className="text-xs px-2 py-0.5 rounded-lg"
                style={{ background: colorEst.bg, border: `1px solid ${colorEst.borde}`, color: colorEst.color }}>
                {ESTADOS_PEDIDO.find(e => e.id === pedido.estado)?.label}
              </span>
              {pedido.modalidad && pedido.modalidad !== 'unica' && (
                <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.2)', color: tema.blue }}>
                  {pedido.modalidad === 'escalonada' ? '📅 Escalonada' : '🔄 Flexible'}
                </span>
              )}
              {pedido.soloVirgenes && (
                <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: tema.accent }}>
                  🧬 Solo vírgenes
                </span>
              )}
            </div>
            <div className="flex gap-3 flex-wrap text-xs" style={{ color: tema.textMuted }}>
              <span>{labelBioterio(pedido.bioterioId)}</span>
              <span>📅 {formatFecha(pedido.fechaEntrega)}</span>
              <span>{labelUso(pedido.uso)}</span>
              {pedido.solicitante && <span>👤 {pedido.solicitante}</span>}
            </div>
          </div>
          <div className="text-center px-4 py-2.5 rounded-xl flex-shrink-0"
            style={{ background: nivel.bg, border: `1.5px solid ${nivel.borde}` }}>
            <div className="font-mono font-bold text-2xl" style={{ color: nivel.color }}>{viabilidad.score}</div>
            <div className="text-xs font-semibold" style={{ color: nivel.color }}>{nivel.emoji} Viabilidad</div>
          </div>
        </div>
        <AccionesPedido pedido={pedido} analisis={analisis} onCambiarEstado={onCambiarEstado}
          onReservarReproductores={onReservarReproductores} tema={tema} />
      </div>

      {/* ── Próxima acción ─────────────────────────────────────────────────────── */}
      <ProximaAccionCard proximaAccion={proximaAccion} tema={tema} />

      {/* ── Cronograma GPS ─────────────────────────────────────────────────────── */}
      <CronogramaGPS planOperativo={planOperativo} tema={tema} />

      {/* ── Estrategia elegida ─────────────────────────────────────────────────── */}
      <EstrategiaElegidaBanner optima={estrategiasBiologicas?.optima} tema={tema} />

      {/* ── Alertas críticas ───────────────────────────────────────────────────── */}
      <AlertasCriticas analisis={analisis} tema={tema} />

      {/* ── Tabs secundarias ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tema.bgCardBorde}` }}>
        {/* Fila de tabs */}
        <div className="flex overflow-x-auto" style={{ background: tema.bgCard, borderBottom: `1px solid ${tema.bgCardBorde}` }}>
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => toggleTab(tab.id)}
              className="flex-shrink-0 px-3 py-2.5 text-xs font-semibold whitespace-nowrap"
              style={{
                background: tabAbierta === tab.id ? 'rgba(0,230,118,0.06)' : 'transparent',
                color: tabAbierta === tab.id ? '#00e676' : '#4a5f7a',
                borderBottom: tabAbierta === tab.id ? '2px solid #00e676' : '2px solid transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido del tab */}
        {tabAbierta && (
          <div className="p-4" style={{ background: tema.bgCard }}>
            {tabAbierta === 'plan' && (
              <div className="space-y-2">
                <div className="text-xs font-bold mb-3 uppercase" style={{ color: tema.textMuted, letterSpacing: '0.07em' }}>
                  Plan operativo detallado
                </div>
                {(planOperativo ?? []).length === 0 ? (
                  <div className="text-xs text-center py-4" style={{ color: tema.textMuted }}>
                    Sin datos para generar el plan — completá la fecha de entrega y edad
                  </div>
                ) : (
                  planOperativo.map((paso, i) => {
                    const d = paso.diasRestantes
                    const colorD = d === null ? '#4a5f7a' : d < 0 ? '#ff6b80' : d === 0 ? '#00e676' : d <= 7 ? '#ffb300' : '#4a5f7a'
                    const labelD = d === null ? '' : d < 0 ? `hace ${Math.abs(d)}d` : d === 0 ? 'HOY' : `en ${d}d`
                    return (
                      <div key={i} className="rounded-xl p-3"
                        style={{
                          background: paso.importante ? 'rgba(0,230,118,0.05)' : tema.bgCard,
                          border: `1px solid ${paso.importante ? 'rgba(0,230,118,0.2)' : tema.bgCardBorde}`,
                        }}>
                        <div className="flex items-start gap-3">
                          <div className="text-lg flex-shrink-0">{paso.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold"
                                style={{ color: paso.importante ? '#00e676' : paso.urgente ? '#ff6b80' : tema.textSecondary }}>
                                Paso {paso.numero} · {paso.accion}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {labelD && <span className="text-xs font-mono font-bold" style={{ color: colorD }}>{labelD}</span>}
                                <span className="text-xs font-mono" style={{ color: tema.textMuted }}>{formatFecha(paso.fecha)}</span>
                              </div>
                            </div>
                            <div className="text-xs" style={{ color: tema.textMuted }}>{paso.descripcion}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {tabAbierta === 'estrategias' && estrategiasBiologicas && (
              <TabEstrategias estrategiasBiologicas={estrategiasBiologicas} tema={tema} />
            )}

            {tabAbierta === 'motor' && (
              <TabMotorReproductivo capacidadReproductiva={capacidadReproductiva} pedido={pedido} tema={tema} />
            )}

            {tabAbierta === 'repros' && (
              <TabReproductores reproductoresSeleccionados={reproductoresSeleccionados}
                reproductoresProximos={reproductoresProximos} tema={tema} />
            )}

            {tabAbierta === 'colonia' && (
              <TabColonia impactoColonia={impactoColonia} impactoEstrategico={impactoEstrategico}
                crecimientoColateral={crecimientoColateral} indiceSanitario={indiceSanitario} tema={tema} />
            )}

            {tabAbierta === 'produccion' && (
              <TabProduccion parejasNecesarias={parejasNecesarias} animalesListos={animalesListos}
                produccionEnCurso={produccionEnCurso} impactoColonia={impactoColonia} pedido={pedido} tema={tema} />
            )}

            {tabAbierta === 'escalonado' && (
              <TabEscalonado pedidoEscalonado={pedidoEscalonado} tema={tema} />
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── MODAL FORMULARIO ────────────────────────────────────────────────────────
function ModalFormPedido({ pedido, onGuardar, onCerrar, tema }) {
  const INPUT_STYLE = {
    width: '100%', background: tema.bgInput,
    border: `1px solid ${tema.bgInputBorde}`, color: tema.textPrimary,
    borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none',
  }
  const LABEL_STYLE = {
    display: 'block', fontSize: '11px', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.08em', color: tema.textMuted, marginBottom: '6px',
  }
  const [form, setForm] = useState({
    bioterioId:       pedido?.bioterioId        ?? 'ratas',
    cantidad:         pedido?.cantidad          ?? '',
    sexo:             pedido?.sexo              ?? 'ambos',
    edadSemanas:      pedido?.edadSemanas       ?? '',
    fechaEntrega:     pedido?.fechaEntrega       ?? '',
    uso:              pedido?.uso               ?? 'investigacion',
    solicitante:      pedido?.solicitante        ?? '',
    notas:            pedido?.notas             ?? '',
    modalidad:        pedido?.modalidad          ?? 'unica',
    soloVirgenes:     pedido?.soloVirgenes       ?? false,
    cantidadPorTanda: pedido?.cantidadPorTanda   ?? '',
    frecuenciaDias:   pedido?.frecuenciaDias     ?? '',
    tandasTotal:      pedido?.tandasTotal        ?? '',
    ...(pedido?.id ? { id: pedido.id, estado: pedido.estado } : {}),
  })

  const esEscalonada = form.modalidad === 'escalonada'
  const esValido = form.cantidad > 0 && form.edadSemanas > 0 && form.fechaEntrega &&
    (!esEscalonada || (form.cantidadPorTanda > 0 && form.frecuenciaDias > 0 && form.tandasTotal > 0))

  function guardar(e) {
    e.preventDefault()
    if (!esValido) return
    onGuardar({
      ...form,
      cantidad:         Number(form.cantidad),
      edadSemanas:      Number(form.edadSemanas),
      cantidadPorTanda: form.cantidadPorTanda ? Number(form.cantidadPorTanda) : null,
      frecuenciaDias:   form.frecuenciaDias   ? Number(form.frecuenciaDias)   : null,
      tandasTotal:      form.tandasTotal      ? Number(form.tandasTotal)      : null,
    })
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
              El GPS biológico se genera automáticamente
            </div>
          </div>
          <button onClick={onCerrar}
            style={{ background: 'none', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={guardar} className="px-6 py-5 space-y-4">
          {/* Colonia */}
          <div>
            <label style={LABEL_STYLE}>Colonia / línea</label>
            <select value={form.bioterioId}
              onChange={e => setForm(f => ({ ...f, bioterioId: e.target.value }))} style={INPUT_STYLE}>
              {BIOTERIOS_OPCIONES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>

          {/* Modalidad */}
          <div>
            <label style={LABEL_STYLE}>Modalidad del pedido</label>
            <div className="flex gap-2">
              {[
                { id: 'unica',      label: '📦 Única',     desc: 'Una entrega total' },
                { id: 'escalonada', label: '📅 Escalonada', desc: 'Varias tandas' },
                { id: 'flexible',   label: '🔄 Flexible',   desc: 'Fecha aproximada' },
              ].map(m => (
                <button key={m.id} type="button"
                  onClick={() => setForm(f => ({ ...f, modalidad: m.id }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: form.modalidad === m.id ? 'rgba(64,196,255,0.12)' : tema.bgCard,
                    border: form.modalidad === m.id ? '1.5px solid rgba(64,196,255,0.4)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.modalidad === m.id ? '#40c4ff' : '#4a5f7a', cursor: 'pointer',
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad + Edad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={LABEL_STYLE}>{esEscalonada ? 'Total estimado' : 'Cantidad requerida'}</label>
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

          {/* Campos escalonado */}
          {esEscalonada && (
            <div className="rounded-xl p-3 space-y-3"
              style={{ background: 'rgba(64,196,255,0.05)', border: '1px solid rgba(64,196,255,0.2)' }}>
              <div className="text-xs font-bold" style={{ color: tema.blue }}>📅 Configuración escalonada</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label style={LABEL_STYLE}>Por tanda</label>
                  <input type="number" min="1" value={form.cantidadPorTanda}
                    onChange={e => setForm(f => ({ ...f, cantidadPorTanda: e.target.value }))}
                    placeholder="20" style={INPUT_STYLE} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Cada (días)</label>
                  <input type="number" min="1" value={form.frecuenciaDias}
                    onChange={e => setForm(f => ({ ...f, frecuenciaDias: e.target.value }))}
                    placeholder="15" style={INPUT_STYLE} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Tandas</label>
                  <input type="number" min="2" max="12" value={form.tandasTotal}
                    onChange={e => setForm(f => ({ ...f, tandasTotal: e.target.value }))}
                    placeholder="3" style={INPUT_STYLE} />
                </div>
              </div>
              {form.cantidadPorTanda && form.frecuenciaDias && form.tandasTotal && (
                <div className="text-xs" style={{ color: tema.blue }}>
                  → {form.tandasTotal} entregas de {form.cantidadPorTanda} animales cada {form.frecuenciaDias} días
                  ({Number(form.cantidadPorTanda) * Number(form.tandasTotal)} total)
                </div>
              )}
            </div>
          )}

          {/* Sexo */}
          <div>
            <label style={LABEL_STYLE}>Sexo requerido</label>
            <div className="flex gap-2">
              {[
                { id: 'machos',  label: '♂ Machos' },
                { id: 'hembras', label: '♀ Hembras' },
                { id: 'ambos',   label: '♂♀ Ambos' },
              ].map(s => (
                <button key={s.id} type="button"
                  onClick={() => setForm(f => ({ ...f, sexo: s.id }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: form.sexo === s.id ? 'rgba(0,230,118,0.12)' : tema.bgCard,
                    border: form.sexo === s.id ? '1.5px solid rgba(0,230,118,0.4)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.sexo === s.id ? '#00e676' : '#4a5f7a', cursor: 'pointer',
                  }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Solo vírgenes */}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: form.soloVirgenes ? 'rgba(0,230,118,0.06)' : tema.bgCard, border: `1px solid ${form.soloVirgenes ? 'rgba(0,230,118,0.25)' : 'rgba(30,51,82,0.7)'}` }}>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, soloVirgenes: !f.soloVirgenes }))}
              className="w-10 h-5 rounded-full relative flex-shrink-0"
              style={{ background: form.soloVirgenes ? '#00e676' : 'rgba(30,51,82,0.8)', transition: 'background 0.2s' }}>
              <span className="absolute top-0.5 rounded-full w-4 h-4"
                style={{ background: '#fff', left: form.soloVirgenes ? '22px' : '2px', transition: 'left 0.2s' }} />
            </button>
            <div>
              <div className="text-xs font-bold" style={{ color: form.soloVirgenes ? '#00e676' : '#4a5f7a' }}>
                Solo animales vírgenes
              </div>
              <div className="text-xs" style={{ color: '#3a5068' }}>
                Sin uso reproductivo previo — requerido para protocolos experimentales
              </div>
            </div>
          </div>

          {/* Fecha entrega */}
          <div>
            <label style={LABEL_STYLE}>{esEscalonada ? 'Fecha primera entrega' : 'Fecha de entrega'}</label>
            <input type="date" value={form.fechaEntrega}
              onChange={e => setForm(f => ({ ...f, fechaEntrega: e.target.value }))} style={INPUT_STYLE} />
          </div>

          {/* Uso */}
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
                    background: form.uso === u.id ? 'rgba(64,196,255,0.1)' : tema.bgCard,
                    border: form.uso === u.id ? '1.5px solid rgba(64,196,255,0.35)' : '1px solid rgba(30,51,82,0.8)',
                    color: form.uso === u.id ? '#40c4ff' : '#4a5f7a', cursor: 'pointer',
                  }}>{u.label}</button>
              ))}
            </div>
          </div>

          {/* Solicitante + Notas */}
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
              style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)', color: tema.textMuted, cursor: 'pointer' }}>
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

// ─── TARJETA EN LA LISTA ──────────────────────────────────────────────────────
function TarjetaPedido({ pedido, seleccionado, onSeleccionar, onEditar, onEliminar, score, tema }) {
  const colorEst = colorEstadoPedido(pedido.estado)
  const estadoObj = getEstadosPedido(tema).find(e => e.id === pedido.estado)

  return (
    <div onClick={() => onSeleccionar(pedido.id)}
      className="rounded-xl p-3 cursor-pointer transition-all"
      style={{
        background: seleccionado ? 'rgba(0,230,118,0.06)' : tema.bgCard,
        border: `1.5px solid ${seleccionado ? 'rgba(0,230,118,0.3)' : tema.bgCardBorde}`,
        boxShadow: seleccionado ? '0 0 16px rgba(0,230,118,0.08)' : 'none',
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold" style={{ color: tema.textMuted }}>{labelBioterio(pedido.bioterioId)}</span>
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
      {pedido.solicitante && <div className="text-xs mb-2" style={{ color: tema.textMuted }}>👤 {pedido.solicitante}</div>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
          style={{ background: colorEst.bg, border: `1px solid ${colorEst.borde}`, color: colorEst.color }}>
          {estadoObj?.label ?? pedido.estado}
        </span>
        <div className="flex gap-1">
          <button onClick={e => { e.stopPropagation(); onEditar(pedido) }}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'rgba(30,51,82,0.5)', border: '1px solid rgba(30,51,82,0.8)', color: tema.textMuted, cursor: 'pointer' }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); onEliminar(pedido.id) }}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: tema.red, cursor: 'pointer' }}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Pedidos() {
  const { animales, camadas, jaulas, sacrificios, entregas, incidentes,
          pedidos, agregarPedido, editarPedido, eliminarPedido: eliminarPedidoCtx,
        } = useBioterio()
  const { tema } = useTheme()
  const ESTADOS_PEDIDO = getEstadosPedido(tema)

  const [pedidoSelId,       setPedidoSelId]       = useState(null)
  const [modalFormAbierto,  setModalFormAbierto]  = useState(false)
  const [pedidoEditando,    setPedidoEditando]    = useState(null)
  const [confirmEliminarId, setConfirmEliminarId] = useState(null)
  const [filtroEstado,      setFiltroEstado]      = useState('todos')

  const pedidoSeleccionado = pedidos.find(p => p.id === pedidoSelId) ?? null

  const pedidosFiltrados = pedidos.filter(p =>
    filtroEstado === 'todos' || p.estado === filtroEstado
  )

  // ── Análisis del pedido seleccionado ──────────────────────────────────────
  const analisis = useMemo(() => {
    if (!pedidoSeleccionado) return null
    const bioPedido = getBio(pedidoSeleccionado.bioterioId)

    const parejasNecesarias          = calcularParejasNecesarias(pedidoSeleccionado, camadas)
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
    const reproductoresProximos      = detectarReproductoresProximos(pedidoSeleccionado, animales)
    const produccionEnCurso          = calcularProduccionEnCurso(pedidoSeleccionado, camadas, sacrificios, entregas)
    const pedidoEscalonado           = calcularPedidoEscalonado(pedidoSeleccionado)
    const riesgoMultifactorial       = evaluarRiesgoMultifactorialPedido({
      reproductoresSeleccionados, camadas, temperaturas: [], incidentes,
      bioterioId: pedidoSeleccionado.bioterioId,
    })

    // ── Nuevas funciones ──────────────────────────────────────────────────
    const capacidadReproductiva = calcularCapacidadReproductivaDinamica(
      pedidoSeleccionado, animales, camadas, jaulas, sacrificios, entregas
    )
    const crecimientoColateral = calcularCrecimientoColateral(
      pedidoSeleccionado, parejasNecesarias, parejasNecesarias.hist
    )
    const estrategiasBiologicas = generarEstrategiasBiologicas(
      pedidoSeleccionado, camadas, animales, jaulas, indiceSanitario
    )
    const estrategiaOptima = estrategiasBiologicas?.optima?.estrategia ?? null
    const planOperativo = generarPlanOperativo(
      pedidoSeleccionado, estrategiaOptima, fechasOptimas, parejasNecesarias, bioPedido
    )
    const proximaAccion = determinarProximaAccion(planOperativo)

    return {
      bio: bioPedido, parejasNecesarias, fechasOptimas,
      reproductoresSeleccionados, animalesListos, capacidadFutura,
      impactoColonia, indiceSanitario, viabilidad,
      impactoEstrategico, indiceImpactoFuturo,
      reproductoresProximos, produccionEnCurso, pedidoEscalonado,
      riesgoMultifactorial,
      // Nuevas
      capacidadReproductiva, crecimientoColateral,
      estrategiasBiologicas, planOperativo, proximaAccion,
    }
  }, [pedidoSeleccionado, animales, camadas, jaulas, sacrificios, entregas, incidentes, pedidos])

  // ── Scores para tarjetas ──────────────────────────────────────────────────
  const scoresPorId = useMemo(() => {
    const result = {}
    for (const p of pedidos) {
      try {
        const bioPedido = getBio(p.bioterioId)
        const parejas   = calcularParejasNecesarias(p, camadas)
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
        await editarPedido({ ...form, updated_at: hoy() })
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
    await editarPedido({ ...pedido, estado: nuevoEstado, updated_at: hoy() })
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

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: tema.textPrimary }}>📦 Pedidos de producción</h1>
          <p className="text-xs mt-0.5" style={{ color: tema.textMuted }}>
            GPS biológico · Plan operativo automático · 7 estrategias
          </p>
        </div>
        <button
          onClick={() => { setPedidoEditando(null); setModalFormAbierto(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.35)', color: tema.accent, cursor: 'pointer' }}>
          + Nuevo pedido
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total',       valor: stats.total,       color: tema.textPrimary },
          { label: 'Pendientes',  valor: stats.pendientes,  color: tema.amber },
          { label: 'En proceso',  valor: stats.enProceso,   color: tema.blue },
          { label: 'Completados', valor: stats.completados, color: tema.accent },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={cardStyle}>
            <div className="font-mono font-bold text-xl" style={{ color: s.color }}>{s.valor}</div>
            <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Layout: lista + análisis */}
      <div className="flex gap-4 items-start">

        {/* Lista */}
        <div className="shrink-0" style={{ width: pedidoSeleccionado ? '280px' : '100%' }}>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {[{ id: 'todos', label: 'Todos' }, ...ESTADOS_PEDIDO].map(f => (
              <button key={f.id} onClick={() => setFiltroEstado(f.id)}
                className="px-3 py-1 rounded-lg text-xs font-semibold"
                style={{
                  background: filtroEstado === f.id ? 'rgba(0,230,118,0.1)' : tema.bgCard,
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
                  : 'Creá el primer pedido para generar el plan operativo automáticamente.'}
              </div>
              {filtroEstado === 'todos' && (
                <button onClick={() => setModalFormAbierto(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(0,230,118,0.1)', border: '1.5px solid rgba(0,230,118,0.3)', color: tema.accent, cursor: 'pointer' }}>
                  + Crear primer pedido
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pedidosFiltrados.map(p => (
                <TarjetaPedido
                  key={p.id} pedido={p}
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
              tema={tema}
            />
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {modalFormAbierto && (
        <ModalFormPedido
          pedido={pedidoEditando}
          onGuardar={handleGuardar}
          onCerrar={() => { setModalFormAbierto(false); setPedidoEditando(null) }}
          tema={tema}
        />
      )}

      {/* Confirmar eliminación */}
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
                style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.8)', color: tema.textMuted, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => handleEliminar(confirmEliminarId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.12)', border: '1.5px solid rgba(255,61,87,0.35)', color: tema.red, cursor: 'pointer' }}>
                ✕ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
