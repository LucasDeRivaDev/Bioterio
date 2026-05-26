import { useMemo, useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { useTheme } from '../context/ThemeContext'
import { calcularIndiceSanitario } from '../utils/sanitario'
import { buildPedigree } from '../utils/genealogia'
import {
  calcularStockReal,
  verificarMinimosCriticos,
  calcularProyeccion,
  calcularCandidatosRenovacion,
  calcularIndiceEstabilidad,
  calcularIndiceGeneticoRenovacion,
  calcularDeficitFuturo,
  getMinimosCriticos,
  nivelEstabilidad,
  colorNivelF,
  reservarAnimal,
  liberarReserva,
  getReservas,
  esReservado,
  calcularMotorRenovacionUnificado,
  calcularProyeccionAvanzada,
  sugerirPromocionesAutomaticas,
  evaluarSostenibilidadColonia,
  generarAccionesHoyPlanificacion,
  PATRON_APAREAMIENTO_DEFAULT,
} from '../utils/motorDecisiones'
import { formatFecha, difDias } from '../utils/calculos'
import {
  Shield, AlertTriangle, TrendingUp, Dna, Activity, BarChart2,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Zap,
  Users, Package, RefreshCcw, Target, Layers, Info,
} from 'lucide-react'

// ── Helpers de formato ──────────────────────────────────────────────────────

function BarraProgreso({ valor, max = 100, color = '#00e676', height = 6 }) {
  const pct = Math.min(100, Math.max(0, (valor / max) * 100))
  return (
    <div style={{ width: '100%', height, borderRadius: height / 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height / 2, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function GaugeScore({ score, size = 90 }) {
  const nivel = nivelEstabilidad(score)
  const pct   = score / 100
  const circunf = Math.PI * 2 * 36
  const stroke  = circunf * (1 - pct)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={36} fill="none" strokeWidth={8} stroke="rgba(255,255,255,0.06)" />
        <circle cx={size/2} cy={size/2} r={36} fill="none" strokeWidth={8}
          stroke={nivel.color}
          strokeDasharray={circunf}
          strokeDashoffset={stroke}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: nivel.color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: '#4a5f7a', fontFamily: 'monospace' }}>/ 100</span>
      </div>
    </div>
  )
}

function Chip({ children, color = '#00e676' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
      background: `${color}18`, border: `1px solid ${color}40`, color,
    }}>{children}</span>
  )
}

function SeccionTitulo({ icono, titulo, subtitulo }) {
  const { tema } = useTheme()
  return (
    <div className="flex items-center gap-3 mb-4">
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icono}
      </div>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: tema.textPrimary, margin: 0 }}>{titulo}</h2>
        {subtitulo && <p style={{ fontSize: 12, color: tema.textMuted, margin: 0 }}>{subtitulo}</p>}
      </div>
    </div>
  )
}

// ── Tarjeta de horizonte temporal ───────────────────────────────────────────

function TarjetaHorizonte({ dias, data, config }) {
  const { tema } = useTheme()
  const color = data.ok ? '#00e676' : data.alertas.some(a => a.tipo.includes('machos') || a.tipo.includes('hembras')) ? '#ff6b80' : '#ffb300'
  const emoji = data.ok ? '🟢' : '🔴'

  return (
    <div style={{
      background: tema.bgCard, border: `1px solid ${data.ok ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.2)'}`,
      borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{dias}d</div>
          <div style={{ fontSize: 10, color: tema.textMuted, fontFamily: 'monospace' }}>horizonte</div>
        </div>
        <span style={{ fontSize: 18 }}>{emoji}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tema.textMuted }}>
          <span>♂ colonia</span>
          <span style={{ color: data.machosFuturos < (config?.machos_colonia ?? 0) ? '#ff6b80' : '#c9d4e0', fontWeight: 600 }}>
            {data.machosFuturos}/{config?.machos_colonia ?? '?'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tema.textMuted }}>
          <span>♀ colonia</span>
          <span style={{ color: data.hembrasFuturas < (config?.hembras_colonia ?? 0) ? '#ff6b80' : '#c9d4e0', fontWeight: 600 }}>
            {data.hembrasFuturas}/{config?.hembras_colonia ?? '?'}
          </span>
        </div>
        {data.vencenMachos > 0 && (
          <div style={{ fontSize: 10, color: '#ffb300', fontFamily: 'monospace' }}>
            ⚠ {data.vencenMachos} macho(s) alcanzan límite
          </div>
        )}
        {data.vencenHembras > 0 && (
          <div style={{ fontSize: 10, color: '#ffb300', fontFamily: 'monospace' }}>
            ⚠ {data.vencenHembras} hembra(s) alcanzan límite
          </div>
        )}
        {data.partosEsperados > 0 && (
          <div style={{ fontSize: 10, color: '#00e676', fontFamily: 'monospace' }}>
            ✦ {data.partosEsperados} parto(s) esperado(s)
          </div>
        )}
        {data.alertas.map((a, i) => (
          <div key={i} style={{ fontSize: 10, color: '#ff6b80', marginTop: 2 }}>
            ✕ {a.mensaje}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tarjeta de candidato a renovación ──────────────────────────────────────

function TarjetaCandidato({ candidato, index, onReservar, onLiberar, reservado, camadas }) {
  const { tema } = useTheme()
  const colorF = colorNivelF(candidato.nivelF)
  const camada = camadas.find(c => c.id === candidato.camadaId)

  return (
    <div style={{
      background: tema.bgCard,
      border: `1px solid ${candidato.advertencia ? 'rgba(255,179,0,0.2)' : candidato.recomendado ? 'rgba(0,230,118,0.15)' : tema.bgCardBorde}`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: index === 0 ? 'rgba(255,215,0,0.12)' : 'rgba(0,230,118,0.08)',
            border: `1px solid ${index === 0 ? 'rgba(255,215,0,0.3)' : 'rgba(0,230,118,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: index === 0 ? '#ffd740' : '#00e676',
          }}>
            {index === 0 ? '⭐' : `#${index + 1}`}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tema.textPrimary }}>
              {candidato.machos > 0 && candidato.hembras > 0
                ? `${candidato.machos}♂ + ${candidato.hembras}♀`
                : candidato.machos > 0
                ? `${candidato.machos} macho(s)`
                : `${candidato.hembras} hembra(s)`}
            </div>
            <div style={{ fontSize: 10, color: tema.textMuted, fontFamily: 'monospace' }}>
              {candidato.diasVida}d · {camada?.fecha_nacimiento ? formatFecha(camada.fecha_nacimiento) : '—'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#00e676' }}>{candidato.priorityScore}</div>
          <div style={{ fontSize: 9, color: tema.textMuted }}>score</div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colorF }}>{candidato.fPorcentaje}</div>
          <div style={{ fontSize: 9, color: tema.textMuted }}>F padres</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#40c4ff' }}>{candidato.scoreFamiliar}</div>
          <div style={{ fontSize: 9, color: tema.textMuted }}>fam. score</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: candidato.tiempoHastaUtilidad === 0 ? '#00e676' : '#ffb300' }}>
            {candidato.tiempoHastaUtilidad === 0 ? 'Listo' : `${candidato.tiempoHastaUtilidad}d`}
          </div>
          <div style={{ fontSize: 9, color: tema.textMuted }}>hasta útil</div>
        </div>
      </div>

      {/* Advertencia si la hay */}
      {candidato.advertencia && (
        <div style={{ fontSize: 10, color: '#ffb300', background: 'rgba(255,179,0,0.08)', borderRadius: 6, padding: '4px 8px', marginBottom: 8 }}>
          ⚠ {candidato.advertencia}
        </div>
      )}

      {/* Botón reservar/liberar */}
      <button
        onClick={() => reservado ? onLiberar(candidato.jaulaId) : onReservar(candidato.jaulaId, 'renovacion', `Candidato #${index + 1} — score ${candidato.priorityScore}`)}
        style={{
          width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: reservado ? 'rgba(0,230,118,0.1)' : 'rgba(64,196,255,0.08)',
          border: `1px solid ${reservado ? 'rgba(0,230,118,0.3)' : 'rgba(64,196,255,0.25)'}`,
          color: reservado ? '#00e676' : '#40c4ff',
        }}
      >
        {reservado ? '✓ Reservado para renovación' : 'Reservar para renovación'}
      </button>
    </div>
  )
}

// ── Motor de renovación unificado — panel de acciones ───────────────────────

function PanelMotorUnificado({ motorUnificado }) {
  const { tema } = useTheme()

  if (motorUnificado.accionesRecomendadas.length === 0) {
    return (
      <div style={{ background: tema.bgCard, border: '1px solid rgba(0,230,118,0.15)', borderRadius: 16, padding: '18px 20px' }}>
        <SeccionTitulo icono={<Target size={16} color="#00e676" />} titulo="Motor de renovación" subtitulo="Déficit · Reemplazo · Candidato · Impacto" />
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 13, color: '#00e676', fontWeight: 600 }}>Sin acciones urgentes</div>
          <div style={{ fontSize: 12, color: tema.textMuted, marginTop: 4 }}>La colonia no tiene déficit ni reproductores críticos</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: tema.bgCard, border: `1px solid ${motorUnificado.hayDeficit ? 'rgba(255,61,87,0.2)' : tema.bgCardBorde}`, borderRadius: 16, padding: '18px 20px' }}>
      <SeccionTitulo
        icono={<Target size={16} color={motorUnificado.hayDeficit ? '#ff6b80' : '#ffb300'} />}
        titulo="Motor de renovación"
        subtitulo="Acciones conectadas: Déficit → Reemplazo → Candidato → Impacto en índice"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {motorUnificado.accionesRecomendadas.map((accion, i) => {
          const colorPrio = accion.prioridad === 0 ? '#ff6b80'
            : accion.prioridad === 1 ? '#ff9100'
            : accion.prioridad === 2 ? '#ffb300'
            : '#40c4ff'
          const labelPrio = accion.prioridad === 0 ? 'URGENTE'
            : accion.prioridad === 1 ? 'CRÍTICO'
            : accion.prioridad === 2 ? 'ALERTA'
            : 'INFO'

          const sexoLabel = accion.sexo === 'macho' ? '♂' : '♀'
          const tipoLabel = accion.tipo === 'deficit' ? 'Déficit' : 'Reemplazo'

          return (
            <div key={i} style={{
              background: `${colorPrio}08`, border: `1px solid ${colorPrio}28`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Chip color={colorPrio}>{labelPrio}</Chip>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colorPrio }}>
                    {sexoLabel} {tipoLabel}
                    {accion.animalSaliente ? ` — ${accion.animalSaliente.codigo}` : ''}
                  </span>
                </div>
                {accion.resolucionPosible
                  ? <Chip color="#00e676">✓ Candidato listo</Chip>
                  : <Chip color="#ff6b80">Sin candidato</Chip>}
              </div>

              {/* Motivos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                {accion.motivosPrincipales.map((m, j) => (
                  <div key={j} style={{ fontSize: 11, color: tema.textMuted }}>• {m}</div>
                ))}
              </div>

              {/* Flecha candidato → impacto */}
              {accion.candidato ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, background: 'rgba(0,230,118,0.06)', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ color: '#00e676', fontWeight: 600 }}>→ Promover:</span>
                  <span style={{ color: tema.textSecondary }}>
                    {accion.candidato.diasVida}d · {accion.candidato.machos || 0}♂ {accion.candidato.hembras || 0}♀
                  </span>
                  {accion.impactoEnIndice && <Chip color="#00e676">{accion.impactoEnIndice}</Chip>}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#ffb300', background: 'rgba(255,179,0,0.06)', borderRadius: 8, padding: '6px 10px' }}>
                  ⏳ Esperando nuevas camadas para cubrir esta posición
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Índice de renovación */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, borderTop: `1px solid ${tema.bgCardBorde}`, paddingTop: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: tema.textMuted, marginBottom: 5 }}>
            Índice de renovación
            {motorUnificado.hayDeficit && (
              <span style={{ color: '#ff6b80', marginLeft: 8 }}>(máx. 80 con déficit activo)</span>
            )}
          </div>
          <BarraProgreso
            valor={motorUnificado.indiceRenovacion}
            max={100}
            color={motorUnificado.hayDeficit ? '#ff6b80' : motorUnificado.indiceRenovacion >= 80 ? '#00e676' : '#ffb300'}
            height={8}
          />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: motorUnificado.hayDeficit ? '#ff6b80' : motorUnificado.indiceRenovacion >= 80 ? '#00e676' : '#ffb300', lineHeight: 1 }}>
            {motorUnificado.indiceRenovacion}
          </div>
          <div style={{ fontSize: 9, color: tema.textMuted }}>/ 100</div>
        </div>
      </div>
    </div>
  )
}

// ── Simulador de impacto unificado ──────────────────────────────────────────
// Corregido: H31 (hembra) NO afecta el conteo de machos.
// Solo se bloquea la acción si ÉSTA provoca el déficit, no si ya existía.

function SimuladorImpacto({ animales, stockReal, bioterioId, motorUnificado }) {
  const { tema } = useTheme()
  const [animalSeleccionado, setAnimalSeleccionado] = useState('')
  const minimos = getMinimosCriticos(bioterioId)

  const estadosActivos = ['activo', 'en_apareamiento', 'en_cria']
  const reproductores = animales.filter(
    a => a.bioterio_id === bioterioId && estadosActivos.includes(a.estado)
  )

  const animal = reproductores.find(a => a.id === animalSeleccionado)

  // Perfil completo del animal seleccionado (viene del motor unificado)
  const perfil = animal
    ? motorUnificado.perfiles.find(p => p.animal.id === animal.id) ?? null
    : null

  const resultado = useMemo(() => {
    if (!animal) return null

    const machosColonia  = stockReal.reproductores.machos.filter(m => !m.exportado_hibridos)
    const hembrasColonia = stockReal.reproductores.hembras.filter(h => !h.exportado_hibridos)

    // Solo el sexo del animal seleccionado cambia — el otro queda igual
    const despuesMachos  = animal.sexo === 'macho'  && !animal.exportado_hibridos
      ? machosColonia.length  - 1 : machosColonia.length
    const despuesHembras = animal.sexo === 'hembra' && !animal.exportado_hibridos
      ? hembrasColonia.length - 1 : hembrasColonia.length

    const bloqueos    = []
    const advertencias = []

    // ── Bloqueo solo si ESTA acción provoca el déficit ────────────────────
    if (animal.sexo === 'macho' && !animal.exportado_hibridos) {
      if (machosColonia.length >= minimos.machos_colonia && despuesMachos < minimos.machos_colonia) {
        bloqueos.push({ critico: true, razon: `Quedarían ${despuesMachos} machos — mínimo: ${minimos.machos_colonia}` })
      } else if (machosColonia.length < minimos.machos_colonia) {
        advertencias.push({ razon: `Déficit de machos preexistente (${machosColonia.length}/${minimos.machos_colonia}) — no causado por esta acción` })
      }
    }
    if (animal.sexo === 'hembra' && !animal.exportado_hibridos) {
      if (hembrasColonia.length >= minimos.hembras_colonia && despuesHembras < minimos.hembras_colonia) {
        bloqueos.push({ critico: true, razon: `Quedarían ${despuesHembras} hembras — mínimo: ${minimos.hembras_colonia}` })
      } else if (hembrasColonia.length < minimos.hembras_colonia) {
        advertencias.push({ razon: `Déficit de hembras preexistente (${hembrasColonia.length}/${minimos.hembras_colonia}) — no causado por esta acción` })
      }
    }

    if (animal.exportado_hibridos) {
      bloqueos.push({ critico: false, razon: 'Reservado para híbridos F1' })
    }

    const reservas = getReservas()
    if (reservas[animal.id]?.tipo === 'renovacion') {
      advertencias.push({ razon: 'Reservado para renovación de la colonia' })
    }

    // Candidato de reemplazo sugerido por el motor
    const accionMotor = motorUnificado.accionesRecomendadas.find(
      a => a.animalSaliente?.id === animal.id
    )
    const candidatoReemplazo = accionMotor?.candidato ?? null

    return {
      permitir: bloqueos.filter(b => b.critico).length === 0,
      bloqueos, advertencias,
      antes:   { machos: machosColonia.length,  hembras: hembrasColonia.length },
      despues: { machos: despuesMachos,          hembras: despuesHembras },
      candidatoReemplazo,
    }
  }, [animal, stockReal, minimos, motorUnificado])

  const ICONO_TIPO = { edad: '⏳', fertilidad: '🔬', consanguinidad: '🧬', familia: '👨‍👩‍👧', sanidad: '🏥' }

  return (
    <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 14, padding: '18px 20px' }}>
      <SeccionTitulo icono={<Zap size={16} color="#ffb300" />} titulo="Simulador de impacto" subtitulo="Perfil del animal + consecuencias de retirarlo" />

      {/* Selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: tema.textMuted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Seleccioná un reproductor
        </label>
        <select
          value={animalSeleccionado}
          onChange={e => setAnimalSeleccionado(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
            background: 'rgba(8,13,26,0.8)', border: `1px solid ${tema.bgCardBorde}`,
            color: tema.textPrimary, outline: 'none',
          }}
        >
          <option value="">— Elegí un animal —</option>
          <optgroup label="Machos">
            {reproductores.filter(a => a.sexo === 'macho').map(a => {
              const p = motorUnificado.perfiles.find(p => p.animal.id === a.id)
              const ico = p?.nivelAlerta === 'critico' ? '⚫' : p?.nivelAlerta === 'alerta' ? '🔴' : p?.nivelAlerta === 'info' ? '🟡' : '🟢'
              return <option key={a.id} value={a.id}>{ico} {a.codigo} — {a.estado}{a.exportado_hibridos ? ' [H]' : ''}</option>
            })}
          </optgroup>
          <optgroup label="Hembras">
            {reproductores.filter(a => a.sexo === 'hembra').map(a => {
              const p = motorUnificado.perfiles.find(p => p.animal.id === a.id)
              const ico = p?.nivelAlerta === 'critico' ? '⚫' : p?.nivelAlerta === 'alerta' ? '🔴' : p?.nivelAlerta === 'info' ? '🟡' : '🟢'
              return <option key={a.id} value={a.id}>{ico} {a.codigo} — {a.estado}{a.exportado_hibridos ? ' [H]' : ''}</option>
            })}
          </optgroup>
        </select>
      </div>

      {/* Perfil del animal seleccionado */}
      {perfil && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${tema.bgCardBorde}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: tema.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Perfil del animal
          </div>
          {/* Datos clave */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Sexo',   valor: perfil.animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra', color: perfil.animal.sexo === 'macho' ? '#40c4ff' : '#ce93d8' },
              { label: 'Edad',   valor: perfil.diasVida ? `${perfil.diasVida}d` : '—',             color: perfil.diasHastaLimite !== null && perfil.diasHastaLimite < 30 ? '#ff6b80' : tema.textPrimary },
              { label: 'Estado', valor: perfil.animal.estado.replace('_', ' '),                    color: perfil.animal.exportado_hibridos ? '#ffd740' : '#00e676' },
              { label: 'Rol',    valor: perfil.animal.exportado_hibridos ? 'Híbridos F1' : 'Colonia', color: perfil.animal.exportado_hibridos ? '#ffd740' : tema.textSecondary },
            ].map(({ label, valor, color }) => (
              <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '6px 4px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color }}>{valor}</div>
                <div style={{ fontSize: 9, color: tema.textMuted }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Motivos */}
          {perfil.motivos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {perfil.motivos.map((m, i) => {
                const color = m.nivel === 'critico' ? '#ff6b80' : m.nivel === 'alerta' ? '#ffb300' : '#40c4ff'
                return (
                  <div key={i} style={{ fontSize: 11, color, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ flexShrink: 0 }}>{ICONO_TIPO[m.tipo] ?? 'ℹ'}</span>
                    <span><strong style={{ textTransform: 'capitalize' }}>{m.tipo}:</strong> {m.descripcion}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#00e676' }}>✓ Sin alertas activas — animal en buen estado</div>
          )}
        </div>
      )}

      {/* Resultado del impacto */}
      {resultado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* ANTES / DESPUÉS — solo muestra el sexo afectado como destacado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'ANTES',   data: resultado.antes,   color: '#40c4ff' },
              { label: 'DESPUÉS', data: resultado.despues, color: resultado.permitir ? '#00e676' : '#ff6b80' },
            ].map(({ label, data, color }) => {
              const esDespues = label === 'DESPUÉS'
              const cambioMachos  = esDespues && data.machos  !== resultado.antes.machos
              const cambioHembras = esDespues && data.hembras !== resultado.antes.hembras
              return (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px', border: `1px solid ${color}22` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'monospace', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 12, color: cambioMachos ? '#ff6b80' : tema.textSecondary, fontWeight: cambioMachos ? 700 : 400 }}>
                    ♂ {data.machos} machos{cambioMachos ? ' ▼' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: cambioHembras ? '#ff6b80' : tema.textSecondary, fontWeight: cambioHembras ? 700 : 400 }}>
                    ♀ {data.hembras} hembras{cambioHembras ? ' ▼' : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Veredicto */}
          <div style={{
            borderRadius: 10, padding: '10px 14px',
            background: resultado.permitir ? 'rgba(0,230,118,0.06)' : 'rgba(255,61,87,0.08)',
            border: `1px solid ${resultado.permitir ? 'rgba(0,230,118,0.2)' : 'rgba(255,61,87,0.3)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (resultado.bloqueos.length + resultado.advertencias.length) > 0 ? 8 : 0 }}>
              {resultado.permitir
                ? <CheckCircle2 size={15} color="#00e676" />
                : <XCircle size={15} color="#ff6b80" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: resultado.permitir ? '#00e676' : '#ff6b80' }}>
                {resultado.permitir ? 'Operación segura' : 'Operación bloqueada'}
              </span>
            </div>
            {resultado.bloqueos.map((b, i) => (
              <div key={i} style={{ fontSize: 11, color: b.critico ? '#ff6b80' : '#ffb300', marginTop: 4, paddingLeft: 22 }}>
                {b.critico ? '✕' : '⚠'} {b.razon}
              </div>
            ))}
            {resultado.advertencias.map((a, i) => (
              <div key={i} style={{ fontSize: 11, color: '#40c4ff', marginTop: 4, paddingLeft: 22 }}>
                ℹ {a.razon}
              </div>
            ))}
          </div>

          {/* Candidato de reemplazo sugerido */}
          {resultado.candidatoReemplazo && (
            <div style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#00e676', marginBottom: 4 }}>
                🔄 Candidato de reemplazo disponible
              </div>
              <div style={{ fontSize: 11, color: tema.textSecondary }}>
                Jaula · {resultado.candidatoReemplazo.diasVida}d de vida
                {resultado.candidatoReemplazo.machos  ? ` · ${resultado.candidatoReemplazo.machos}♂` : ''}
                {resultado.candidatoReemplazo.hembras ? ` · ${resultado.candidatoReemplazo.hembras}♀` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {!animal && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: tema.textMuted, fontSize: 13 }}>
          Seleccioná un reproductor para ver su perfil y el impacto de retirarlo
        </div>
      )}
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────

export default function PlanificacionColonia() {
  const { animales, camadas, jaulas, sacrificios, entregas, incidentes, animalesExportados, camadasF1 } = useBioterio()
  const { bioterioActivo, bio } = useBioterioActivo()
  const { tema } = useTheme()

  const [tabHorizonte, setTabHorizonte] = useState(90)
  const [reservasKey, setReservasKey]   = useState(0) // fuerza re-render al reservar

  // Combinar animales propios + exportados para pedigree completo
  const todosAnimales = useMemo(() => [...animales, ...animalesExportados], [animales, animalesExportados])
  const todasCamadas  = useMemo(() => [...camadas, ...camadasF1], [camadas, camadasF1])

  // Stock real
  const stockReal = useMemo(
    () => calcularStockReal(todosAnimales, todasCamadas, jaulas, sacrificios, entregas, bio, bioterioActivo),
    [todosAnimales, todasCamadas, jaulas, sacrificios, entregas, bio, bioterioActivo]
  )

  // Mínimos críticos
  const minimos = useMemo(
    () => verificarMinimosCriticos(stockReal, bioterioActivo),
    [stockReal, bioterioActivo]
  )

  // Índice genético
  const indiceGenetico = useMemo(
    () => calcularIndiceGeneticoRenovacion(todosAnimales, todasCamadas, bioterioActivo),
    [todosAnimales, todasCamadas, bioterioActivo]
  )

  // Índice sanitario (usando datos de incidentes)
  const indiceSanitario = useMemo(
    () => calcularIndiceSanitario(todasCamadas, incidentes, bioterioActivo),
    [todasCamadas, incidentes, bioterioActivo]
  )

  // Candidatos a renovación
  const candidatos = useMemo(
    () => calcularCandidatosRenovacion(stockReal, todosAnimales, todasCamadas, bio, bioterioActivo, todosAnimales),
    [stockReal, todosAnimales, todasCamadas, bio, bioterioActivo]
  )

  // Motor unificado de renovación (conecta: déficit + edad + candidatos + consanguinidad)
  const motorUnificado = useMemo(
    () => calcularMotorRenovacionUnificado(
      stockReal, animales, todasCamadas, bio, bioterioActivo,
      indiceGenetico, indiceSanitario, incidentes, todosAnimales
    ),
    [stockReal, animales, todasCamadas, bio, bioterioActivo, indiceGenetico, indiceSanitario, incidentes, todosAnimales]
  )

  // Índice de estabilidad — usa el motor unificado para la componente renovación
  const indiceEstabilidad = useMemo(
    () => calcularIndiceEstabilidad({
      stockReal,
      minimos,
      candidatosRenovacion: candidatos,
      indiceGenetico,
      indiceSanitario,
      camadas: todasCamadas,
      bioterioId: bioterioActivo,
      motorUnificado,
    }),
    [stockReal, minimos, candidatos, indiceGenetico, indiceSanitario, todasCamadas, bioterioActivo, motorUnificado]
  )

  // Déficit futuro en 4 horizontes
  const deficitFuturo = useMemo(
    () => calcularDeficitFuturo(todosAnimales, todasCamadas, jaulas, sacrificios, entregas, bio, bioterioActivo),
    [todosAnimales, todasCamadas, jaulas, sacrificios, entregas, bio, bioterioActivo]
  )

  // Proyección seleccionada (detalle de partos/destetes en el horizonte elegido)
  const proyeccion = useMemo(
    () => calcularProyeccion(todasCamadas, todosAnimales, bio, bioterioActivo, tabHorizonte),
    [todasCamadas, todosAnimales, bio, bioterioActivo, tabHorizonte]
  )

  // Patrón de apareamiento configurable (estado local)
  const [parejasCadaDias, setParejasCadaDias] = useState(PATRON_APAREAMIENTO_DEFAULT.parejasCada)

  // Proyección avanzada — simulación completa con patrón + partos + crías + saturación + déficit
  const proyeccionAvanzada = useMemo(
    () => calcularProyeccionAvanzada(
      todosAnimales, todasCamadas, jaulas, sacrificios, entregas, bio, bioterioActivo,
      { parejasCada: parejasCadaDias }
    ),
    [todosAnimales, todasCamadas, jaulas, sacrificios, entregas, bio, bioterioActivo, parejasCadaDias]
  )

  // Sugerencias automáticas de promoción
  const sugerenciasPromocion = useMemo(
    () => sugerirPromocionesAutomaticas(proyeccionAvanzada, candidatos, todosAnimales, todasCamadas, bio, bioterioActivo),
    [proyeccionAvanzada, candidatos, todosAnimales, todasCamadas, bio, bioterioActivo]
  )

  // ¿Puede la colonia sostener producción?
  const sostenibilidad = useMemo(
    () => evaluarSostenibilidadColonia(proyeccionAvanzada, stockReal, bioterioActivo),
    [proyeccionAvanzada, stockReal, bioterioActivo]
  )

  // Índice genético enriquecido (incluye déficit, candidatos y proyección)
  const indiceGeneticoEnriquecido = useMemo(
    () => calcularIndiceGeneticoRenovacion(todosAnimales, todasCamadas, bioterioActivo, {
      stockReal, candidatos, proyeccionAvanzada,
    }),
    [todosAnimales, todasCamadas, bioterioActivo, stockReal, candidatos, proyeccionAvanzada]
  )

  // Motor "¿qué hacer hoy?"
  const accionesHoy = useMemo(
    () => generarAccionesHoyPlanificacion(proyeccionAvanzada, sugerenciasPromocion, getMinimosCriticos(bioterioActivo), stockReal, bioterioActivo),
    [proyeccionAvanzada, sugerenciasPromocion, stockReal, bioterioActivo]
  )

  const minimosCfg = getMinimosCriticos(bioterioActivo)
  const reservas   = getReservas() // recalcula al cambiar reservasKey

  function handleReservar(id, tipo, motivo) {
    reservarAnimal(id, tipo, motivo, bioterioActivo)
    setReservasKey(k => k + 1)
  }
  function handleLiberar(id) {
    liberarReserva(id)
    setReservasKey(k => k + 1)
  }

  const nivelEst = nivelEstabilidad(indiceEstabilidad.score)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" style={{ color: tema.textPrimary }}>

      {/* ── ENCABEZADO ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: tema.textPrimary, margin: 0, lineHeight: 1.2 }}>
            Planificación de colonia
          </h1>
          <p style={{ fontSize: 13, color: tema.textMuted, margin: '4px 0 0' }}>
            Saturación · Renovación · Genética · Producción futura
          </p>
        </div>
        <Chip color={nivelEst.color}>{nivelEst.emoji} {nivelEst.label}</Chip>
      </div>

      {/* ── ÍNDICE DE ESTABILIDAD ───────────────────────────────────────────── */}
      <div style={{
        background: tema.bgCard,
        border: `1px solid ${nivelEst.borde}`,
        borderRadius: 16, padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <GaugeScore score={indiceEstabilidad.score} size={100} />

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: nivelEst.color, marginBottom: 2 }}>
              {nivelEst.emoji} {nivelEst.label}
            </div>
            <div style={{ fontSize: 12, color: tema.textMuted, marginBottom: 16 }}>
              Índice de estabilidad de la colonia
            </div>

            {/* Desglose por componente */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Renovación',  valor: indiceEstabilidad.detalle.renovacion, max: 25, color: '#a78bfa' },
                { label: 'Genética',    valor: indiceEstabilidad.detalle.genetica,   max: 20, color: '#40c4ff' },
                { label: 'Producción',  valor: indiceEstabilidad.detalle.produccion, max: 20, color: '#00e676' },
                { label: 'Híbridos',    valor: indiceEstabilidad.detalle.hibridos,   max: 15, color: '#ffd740' },
                { label: 'Sanitario',   valor: indiceEstabilidad.detalle.sanitario,  max: 10, color: '#ff9100' },
                { label: 'Saturación',  valor: indiceEstabilidad.detalle.saturacion, max: 10, color: '#ce93d8' },
              ].map(({ label, valor, max, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 72, fontSize: 11, color: tema.textMuted, flexShrink: 0 }}>{label}</div>
                  <div style={{ flex: 1 }}>
                    <BarraProgreso valor={valor} max={max} color={color} height={5} />
                  </div>
                  <div style={{ width: 44, fontSize: 11, textAlign: 'right', color, fontFamily: 'monospace', flexShrink: 0 }}>
                    {valor}/{max}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MÍNIMOS CRÍTICOS ─────────────────────────────────────────────────── */}
      <div style={{ background: tema.bgCard, border: `1px solid ${minimos.critico ? 'rgba(255,61,87,0.25)' : tema.bgCardBorde}`, borderRadius: 16, padding: '18px 20px' }}>
        <SeccionTitulo
          icono={<Shield size={16} color={minimos.critico ? '#ff6b80' : '#00e676'} />}
          titulo="Mínimos obligatorios"
          subtitulo="Reproductores mínimos para garantizar la supervivencia de la colonia"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: 'Machos colonia',  actual: stockReal.reproductores.machos.filter(m => !m.exportado_hibridos).length, minimo: minimosCfg.machos_colonia, color: '#40c4ff' },
            { label: 'Hembras colonia', actual: stockReal.reproductores.hembras.filter(h => !h.exportado_hibridos).length, minimo: minimosCfg.hembras_colonia, color: '#ce93d8' },
            ...(minimosCfg.machos_hibridos > 0 ? [{ label: 'Machos F1', actual: stockReal.reproductores.machosHibridos.length, minimo: minimosCfg.machos_hibridos, color: '#ffd740' }] : []),
            ...(minimosCfg.hembras_hibridos > 0 ? [{ label: 'Hembras F1', actual: stockReal.reproductores.hembrasHibridos.length, minimo: minimosCfg.hembras_hibridos, color: '#ffd740' }] : []),
          ].map(({ label, actual, minimo, color }) => {
            const ok = actual >= minimo
            return (
              <div key={label} style={{
                background: ok ? 'rgba(0,230,118,0.04)' : 'rgba(255,61,87,0.06)',
                border: `1px solid ${ok ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.2)'}`,
                borderRadius: 12, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: ok ? color : '#ff6b80', lineHeight: 1 }}>
                  {actual}
                </div>
                <div style={{ fontSize: 10, color: ok ? color : '#ff6b80', fontFamily: 'monospace', margin: '2px 0' }}>
                  mín. {minimo}
                </div>
                <div style={{ fontSize: 11, color: tema.textMuted }}>{label}</div>
                <div style={{ marginTop: 6 }}>
                  {ok
                    ? <Chip color="#00e676">✓ OK</Chip>
                    : <Chip color="#ff6b80">✕ Déficit {minimo - actual}</Chip>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Alertas de mínimos */}
        {minimos.alertas.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {minimos.alertas.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: a.critico ? 'rgba(255,61,87,0.08)' : 'rgba(255,179,0,0.08)',
                border: `1px solid ${a.critico ? 'rgba(255,61,87,0.25)' : 'rgba(255,179,0,0.2)'}`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <AlertTriangle size={15} color={a.critico ? '#ff6b80' : '#ffb300'} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: a.critico ? '#ff6b80' : '#ffb300' }}>{a.mensaje}</div>
                  <div style={{ fontSize: 11, color: tema.textMuted, marginTop: 2 }}>
                    Jerarquía {a.jerarquia} — {a.critico ? 'Bloquea sacrificios y entregas' : 'Advertencia'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PROYECCIÓN AVANZADA ──────────────────────────────────────────────── */}
      <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <SeccionTitulo
            icono={<Clock size={16} color="#40c4ff" />}
            titulo="Proyección temporal"
            subtitulo="Partos · Crías · Jaulas · Déficit · Saturación — simulación completa"
          />
          {/* Patrón configurable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: tema.textMuted }}>1 pareja /</span>
            <input
              type="number" min={7} max={60} value={parejasCadaDias}
              onChange={e => setParejasCadaDias(Math.max(7, Math.min(60, Number(e.target.value))))}
              style={{
                width: 52, padding: '4px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)',
                color: '#40c4ff', textAlign: 'center', outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: tema.textMuted }}>días</span>
          </div>
        </div>

        {/* Patrones históricos usados */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: `~${proyeccionAvanzada.patrones.promCrias} crías/parto`, color: '#00e676' },
            { label: `${proyeccionAvanzada.patrones.tasaSupervivencia}% superv.`, color: '#40c4ff' },
            { label: `${proyeccionAvanzada.patrones.tasaFallo}% fallos`, color: proyeccionAvanzada.patrones.tasaFallo > 25 ? '#ff6b80' : '#ffb300' },
            { label: `${proyeccionAvanzada.patrones.parejasLibres} par${proyeccionAvanzada.patrones.parejasLibres !== 1 ? 'ejas' : 'eja'} libre${proyeccionAvanzada.patrones.parejasLibres !== 1 ? 's' : ''}`, color: '#a78bfa' },
          ].map(({ label, color }) => (
            <Chip key={label} color={color}>{label}</Chip>
          ))}
        </div>

        {/* Tarjetas de 4 horizontes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[30, 60, 90, 180].map(h => {
            const d = proyeccionAvanzada.horizontes[h]
            const colorBorde = d.ok ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.2)'
            const colorTit   = d.ok ? '#00e676' : '#ff6b80'
            return (
              <div key={h} style={{
                background: tema.bgCard, border: `1px solid ${colorBorde}`,
                borderRadius: 14, padding: '12px 14px',
              }}>
                {/* Encabezado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: colorTit, lineHeight: 1 }}>{h}d</div>
                    <div style={{ fontSize: 9, color: tema.textMuted, fontFamily: 'monospace' }}>horizonte</div>
                  </div>
                  <span style={{ fontSize: 16 }}>{d.ok ? '🟢' : d.deficit.puedeCubrirConStock ? '🟡' : '🔴'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Reproductores futuros */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tema.textMuted }}>
                    <span>♂ colonia</span>
                    <span style={{ color: d.deficit.machos > 0 ? '#ff6b80' : '#c9d4e0', fontWeight: 600 }}>
                      {d.reproductores.machosFuturos}/{minimosCfg.machos_colonia}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tema.textMuted }}>
                    <span>♀ colonia</span>
                    <span style={{ color: d.deficit.hembras > 0 ? '#ff6b80' : '#c9d4e0', fontWeight: 600 }}>
                      {d.reproductores.hembrasFuturas}/{minimosCfg.hembras_colonia}
                    </span>
                  </div>
                  {/* Partos */}
                  <div style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, marginTop: 3, paddingTop: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tema.textMuted }}>
                      <span>partos</span>
                      <span style={{ color: '#00e676', fontWeight: 600 }}>
                        {d.partos.deActivos}✦ +{d.partos.dePatron}⊕
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tema.textMuted }}>
                      <span>crías</span>
                      <span style={{ color: '#40c4ff', fontWeight: 600 }}>~{d.crias.total}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tema.textMuted }}>
                      <span>+jaulas</span>
                      <span style={{ color: d.jaulas.saturacion === 'alta' ? '#ff6b80' : '#c9d4e0', fontWeight: 600 }}>
                        +{d.jaulas.nuevas} {d.jaulas.saturacion === 'alta' ? '⚠' : ''}
                      </span>
                    </div>
                  </div>
                  {/* Bajas + candidatos */}
                  {(d.reproductores.machosBajas > 0 || d.reproductores.hembrasBajas > 0) && (
                    <div style={{ fontSize: 9, color: '#ffb300', fontFamily: 'monospace' }}>
                      ⚠ {d.reproductores.machosBajas + d.reproductores.hembrasBajas} reprod. alcanzan límite
                    </div>
                  )}
                  {d.reproductores.candidatosMaduran > 0 && (
                    <div style={{ fontSize: 9, color: '#a78bfa', fontFamily: 'monospace' }}>
                      ↑ {d.reproductores.candidatosMaduran} candidato(s) maduran
                    </div>
                  )}
                  {/* Déficit */}
                  {d.deficit.hayDeficit && (
                    <div style={{
                      marginTop: 4, fontSize: 10, fontWeight: 600, textAlign: 'center',
                      background: d.deficit.puedeCubrirConStock ? 'rgba(255,179,0,0.1)' : 'rgba(255,61,87,0.1)',
                      border: `1px solid ${d.deficit.puedeCubrirConStock ? 'rgba(255,179,0,0.3)' : 'rgba(255,61,87,0.3)'}`,
                      borderRadius: 6, padding: '3px 6px',
                      color: d.deficit.puedeCubrirConStock ? '#ffb300' : '#ff6b80',
                    }}>
                      {d.deficit.machos > 0 ? `−${d.deficit.machos}♂` : ''}
                      {d.deficit.machos > 0 && d.deficit.hembras > 0 ? ' ' : ''}
                      {d.deficit.hembras > 0 ? `−${d.deficit.hembras}♀` : ''}
                      {d.deficit.puedeCubrirConStock ? ' (stock ↑)' : ' sin cobertura'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 10, color: tema.textMuted, marginBottom: 14 }}>
          <span>✦ partos activos en curso</span>
          <span>⊕ partos del patrón ({parejasCadaDias}d)</span>
          <span>↑ candidatos maduran en el horizonte</span>
        </div>

        {/* Selector de horizonte + detalle de partos/destetes */}
        <div style={{ borderTop: `1px solid ${tema.bgCardBorde}`, paddingTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[30, 60, 90, 180].map(d => (
              <button
                key={d}
                onClick={() => setTabHorizonte(d)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: tabHorizonte === d ? 'rgba(64,196,255,0.15)' : 'transparent',
                  border: `1px solid ${tabHorizonte === d ? 'rgba(64,196,255,0.4)' : tema.bgCardBorde}`,
                  color: tabHorizonte === d ? '#40c4ff' : tema.textMuted,
                }}
              >
                {d}d
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Partos confirmados */}
            <div>
              <div style={{ fontSize: 11, color: tema.textMuted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Partos en curso ({proyeccion.partosPendientes.length})
              </div>
              {proyeccion.partosPendientes.length === 0
                ? <div style={{ fontSize: 12, color: tema.textMuted, padding: '8px 0' }}>Sin apareamientos activos</div>
                : proyeccion.partosPendientes.slice(0, 5).map((p, i) => (
                  <div key={p.camadaId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                    background: p.vencido ? 'rgba(255,61,87,0.06)' : 'rgba(0,230,118,0.04)',
                    border: `1px solid ${p.vencido ? 'rgba(255,61,87,0.15)' : 'rgba(0,230,118,0.1)'}`,
                  }}>
                    <span style={{ fontSize: 11, color: tema.textSecondary }}>Parto #{i + 1}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: p.vencido ? '#ff6b80' : '#00e676', fontFamily: 'monospace' }}>
                        {p.vencido ? 'Vencido' : `${p.diasRestantes}d`}
                      </div>
                      <div style={{ fontSize: 10, color: tema.textMuted }}>{formatFecha(p.partoProbable)}</div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Destetes */}
            <div>
              <div style={{ fontSize: 11, color: tema.textMuted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Destetes pendientes ({proyeccion.destesPendientes.length})
              </div>
              {proyeccion.destesPendientes.length === 0
                ? <div style={{ fontSize: 12, color: tema.textMuted, padding: '8px 0' }}>Sin camadas en lactancia</div>
                : proyeccion.destesPendientes.slice(0, 5).map((d, i) => (
                  <div key={d.camadaId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 8, marginBottom: 4,
                    background: d.vencido ? 'rgba(255,61,87,0.06)' : 'rgba(64,196,255,0.04)',
                    border: `1px solid ${d.vencido ? 'rgba(255,61,87,0.15)' : 'rgba(64,196,255,0.1)'}`,
                  }}>
                    <div>
                      <span style={{ fontSize: 11, color: tema.textSecondary }}>Destete #{i + 1}</span>
                      {d.totalCrias > 0 && <span style={{ fontSize: 10, color: tema.textMuted, marginLeft: 8 }}>{d.totalCrias} crías</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: d.vencido ? '#ff6b80' : '#40c4ff', fontFamily: 'monospace' }}>
                        {d.vencido ? 'Vencido' : `${d.diasRestantes}d`}
                      </div>
                      <div style={{ fontSize: 10, color: tema.textMuted }}>{formatFecha(d.fechaDestete)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* KPIs de producción en horizonte seleccionado */}
          {(() => {
            const hData = proyeccionAvanzada.horizontes[tabHorizonte]
            return (
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Partos totales', valor: hData.partos.total, color: '#00e676' },
                  { label: 'Crías estimadas', valor: hData.crias.total, color: '#40c4ff' },
                  { label: 'Jaulas nuevas', valor: hData.jaulas.nuevas, color: '#a78bfa' },
                  { label: 'Prom. camada hist.', valor: proyeccionAvanzada.patrones.promCrias, color: '#ffd740' },
                ].map(({ label, valor, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
                    <div style={{ fontSize: 10, color: tema.textMuted, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── ¿PUEDE LA COLONIA SOSTENER PRODUCCIÓN? ──────────────────────────── */}
      <div style={{
        background: tema.bgCard,
        border: `1px solid ${sostenibilidad.nivel === 'critico' ? 'rgba(255,61,87,0.25)' : sostenibilidad.nivel === 'vigilar' ? 'rgba(255,179,0,0.2)' : 'rgba(0,230,118,0.15)'}`,
        borderRadius: 16, padding: '18px 20px',
      }}>
        <SeccionTitulo
          icono={<Target size={16} color={sostenibilidad.nivel === 'critico' ? '#ff6b80' : sostenibilidad.nivel === 'vigilar' ? '#ffb300' : '#00e676'} />}
          titulo="¿Puede la colonia sostener producción?"
          subtitulo="Análisis integrado: genética · renovación · saturación · mínimos"
        />

        {/* Conclusión principal */}
        <div style={{
          borderRadius: 12, padding: '14px 16px', marginBottom: 14,
          background: sostenibilidad.nivel === 'critico' ? 'rgba(255,61,87,0.08)' : sostenibilidad.nivel === 'vigilar' ? 'rgba(255,179,0,0.08)' : 'rgba(0,230,118,0.06)',
          border: `1px solid ${sostenibilidad.nivel === 'critico' ? 'rgba(255,61,87,0.25)' : sostenibilidad.nivel === 'vigilar' ? 'rgba(255,179,0,0.2)' : 'rgba(0,230,118,0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>
              {sostenibilidad.nivel === 'critico' ? '🔴' : sostenibilidad.nivel === 'vigilar' ? '🟡' : '🟢'}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: sostenibilidad.nivel === 'critico' ? '#ff6b80' : sostenibilidad.nivel === 'vigilar' ? '#ffb300' : '#00e676',
            }}>
              {sostenibilidad.conclusion}
            </span>
          </div>
        </div>

        {/* KPIs de producción 90d */}
        {sostenibilidad.produccion90d && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Partos en 90d', valor: sostenibilidad.produccion90d.partos, color: '#00e676' },
              { label: 'Crías en 90d', valor: sostenibilidad.produccion90d.crias, color: '#40c4ff' },
              { label: 'Jaulas proy. 90d', valor: sostenibilidad.produccion90d.jaulas, color: '#a78bfa' },
            ].map(({ label, valor, color }) => (
              <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
                <div style={{ fontSize: 10, color: tema.textMuted, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Riesgos detectados */}
        {sostenibilidad.riesgos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sostenibilidad.riesgos.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 12, color: r.nivel === 'critico' ? '#ff6b80' : r.nivel === 'advertencia' ? '#ffb300' : tema.textMuted,
                background: r.nivel === 'critico' ? 'rgba(255,61,87,0.06)' : r.nivel === 'advertencia' ? 'rgba(255,179,0,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: 8, padding: '6px 10px',
              }}>
                <span>{r.nivel === 'critico' ? '✕' : r.nivel === 'advertencia' ? '⚠' : 'ℹ'}</span>
                <span>{r.mensaje}</span>
                <Chip color={r.nivel === 'critico' ? '#ff6b80' : r.nivel === 'advertencia' ? '#ffb300' : '#4a5f7a'}>
                  {r.horizonte}d
                </Chip>
              </div>
            ))}
          </div>
        )}

        {sostenibilidad.riesgos.length === 0 && (
          <div style={{ fontSize: 12, color: tema.textMuted, textAlign: 'center', padding: '6px 0' }}>
            Sin riesgos detectados en los próximos 180 días
          </div>
        )}
      </div>

      {/* ── MOTOR "¿QUÉ HACER HOY?" ─────────────────────────────────────────── */}
      {accionesHoy.length > 0 && (
        <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '18px 20px' }}>
          <SeccionTitulo
            icono={<Zap size={16} color="#ffd740" />}
            titulo="¿Qué hacer hoy?"
            subtitulo="Acciones concretas para evitar déficits futuros — ordenadas por urgencia"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accionesHoy.map((accion, i) => {
              const colorMapa = { 0: '#ff6b80', 1: '#ff9100', 2: '#ffb300', 3: '#ffd740', 4: '#00e676' }
              const color = colorMapa[accion.prioridad] ?? '#c9d4e0'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: `${color}08`, border: `1px solid ${color}25`,
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 18, flexShrink: 0 }}>{accion.icono}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 3 }}>{accion.titulo}</div>
                    <div style={{ fontSize: 12, color: tema.textSecondary }}>{accion.descripcion}</div>
                  </div>
                  <Chip color={color}>
                    {accion.prioridad === 0 ? 'Urgente' : accion.prioridad === 1 ? 'Esta semana' : accion.prioridad === 2 ? 'Próximamente' : accion.prioridad === 3 ? 'Preventivo' : 'Info'}
                  </Chip>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SUGERENCIAS AUTOMÁTICAS DE PROMOCIÓN ────────────────────────────── */}
      {sugerenciasPromocion.length > 0 && (
        <div style={{ background: tema.bgCard, border: '1px solid rgba(167,139,250,0.2)', borderRadius: 16, padding: '18px 20px' }}>
          <SeccionTitulo
            icono={<TrendingUp size={16} color="#a78bfa" />}
            titulo="Sugerencias de promoción automática"
            subtitulo="Candidatos del stock para cubrir déficits proyectados — ordenados por urgencia"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sugerenciasPromocion.map((s, i) => {
              const urgColor = s.urgencia === 'urgente' ? '#ff6b80' : s.urgencia === 'importante' ? '#ffb300' : '#a78bfa'
              return (
                <div key={i} style={{
                  background: `${urgColor}06`, border: `1px solid ${urgColor}25`,
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: urgColor, marginBottom: 2 }}>
                        {s.problema}
                      </div>
                      <div style={{ fontSize: 12, color: tema.textSecondary }}>{s.solucion}</div>
                    </div>
                    <Chip color={urgColor}>
                      {s.urgencia === 'urgente' ? '🔴 Urgente' : s.urgencia === 'importante' ? '🟠 Importante' : '🔵 Preventivo'}
                    </Chip>
                  </div>

                  {/* Impacto */}
                  <div style={{
                    background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)',
                    borderRadius: 8, padding: '6px 10px', marginBottom: 8,
                    fontSize: 12, fontWeight: 600, color: '#00e676',
                  }}>
                    Impacto: {s.impacto}
                  </div>

                  {/* Criterios y métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {/* Métricas del candidato */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { label: 'Score', valor: s.candidato.priorityScore + '/100', color: '#00e676' },
                        { label: 'F padres', valor: s.candidato.fPorcentaje, color: colorNivelF(s.candidato.nivelF) },
                        { label: 'Fam. score', valor: s.candidato.scoreFamiliar + '/10', color: '#40c4ff' },
                        { label: s.listo ? 'Listo ahora' : `Listo en ${s.enDias}d`, valor: '', color: s.listo ? '#00e676' : '#ffb300' },
                      ].map(({ label, valor, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: tema.textMuted }}>{label}</span>
                          {valor && <span style={{ color, fontWeight: 600 }}>{valor}</span>}
                        </div>
                      ))}
                    </div>

                    {/* Criterios de selección */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 10, color: tema.textMuted, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Por qué este candidato
                      </div>
                      {s.criterios.map((c, j) => (
                        <div key={j} style={{ fontSize: 11, color: tema.textSecondary }}>✓ {c}</div>
                      ))}
                      <div style={{ fontSize: 11, color: tema.textMuted, marginTop: 4 }}>
                        Padres: {s.padres.madre} × {s.padres.padre}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ÍNDICE GENÉTICO (enriquecido con déficit + proyección) ─────────── */}
      <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '18px 20px' }}>
        <SeccionTitulo
          icono={<Dna size={16} color="#a78bfa" />}
          titulo="Índice de renovación genética"
          subtitulo="Consanguinidad · Tendencia · Déficit reproductivo · Reemplazos disponibles · Riesgo futuro"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <GaugeScore score={indiceGeneticoEnriquecido.score} size={90} />

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: indiceGeneticoEnriquecido.color }}>{indiceGeneticoEnriquecido.nivel}</span>
              {indiceGeneticoEnriquecido.tendencia !== 'estable' && (
                <Chip color={indiceGeneticoEnriquecido.tendencia === 'mejorando' ? '#00e676' : '#ff6b80'}>
                  {indiceGeneticoEnriquecido.tendencia === 'mejorando' ? '↑ Mejorando' : '↓ Deteriorando'}
                </Chip>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>{indiceGeneticoEnriquecido.fPorcentaje}</div>
                <div style={{ fontSize: 9, color: tema.textMuted }}>F promedio</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#40c4ff' }}>
                  {indiceGeneticoEnriquecido.animalesConPadres}/{indiceGeneticoEnriquecido.totalReproductores}
                </div>
                <div style={{ fontSize: 9, color: tema.textMuted }}>con genealogía</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: candidatos.filter(c => c.recomendado && c.tiempoHastaUtilidad === 0).length > 0 ? '#00e676' : '#ffb300' }}>
                  {candidatos.filter(c => c.recomendado && c.tiempoHastaUtilidad === 0).length}
                </div>
                <div style={{ fontSize: 9, color: tema.textMuted }}>reemplazos listos</div>
              </div>
            </div>

            {indiceGeneticoEnriquecido.advertencias.map((adv, i) => (
              <div key={i} style={{ fontSize: 11, color: '#ffb300', marginBottom: 4 }}>⚠ {adv}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CANDIDATOS A RENOVACIÓN ─────────────────────────────────────────── */}
      <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '18px 20px' }}>
        <SeccionTitulo
          icono={<RefreshCcw size={16} color="#00e676" />}
          titulo="Candidatos a renovación"
          subtitulo="Jaulas de stock ordenadas por prioridad de promoción a reproductores"
        />

        {candidatos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: tema.textMuted, fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            No hay crías en edad de renovación actualmente.<br />
            Los candidatos aparecen cuando las crías se acercan a la madurez reproductiva ({bio?.MADUREZ_DIAS ?? 56} días).
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {candidatos.slice(0, 9).map((candidato, i) => (
            <TarjetaCandidato
              key={`${candidato.jaulaId}-${reservasKey}`}
              candidato={candidato}
              index={i}
              camadas={todasCamadas}
              reservado={esReservado(candidato.jaulaId)}
              onReservar={handleReservar}
              onLiberar={handleLiberar}
            />
          ))}
        </div>

        {candidatos.length > 9 && (
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: tema.textMuted }}>
            + {candidatos.length - 9} candidatos adicionales con menor prioridad
          </div>
        )}
      </div>

      {/* ── REPRODUCTORES PRÓXIMOS AL LÍMITE ────────────────────────────────── */}
      {proyeccion.reproProximosLimite.length > 0 && (
        <div style={{ background: tema.bgCard, border: '1px solid rgba(255,179,0,0.2)', borderRadius: 16, padding: '18px 20px' }}>
          <SeccionTitulo
            icono={<AlertTriangle size={16} color="#ffb300" />}
            titulo="Reproductores próximos al límite"
            subtitulo="Animales que alcanzarán o superaron la edad reproductiva máxima"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proyeccion.reproProximosLimite.map(r => {
              const colorAlerta = r.yaLimite ? '#ff6b80' : r.enAlerta ? '#ffb300' : '#40c4ff'
              return (
                <div key={r.animalId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  background: `${colorAlerta}08`, border: `1px solid ${colorAlerta}25`,
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: r.sexo === 'macho' ? '#40c4ff' : '#ce93d8' }}>
                      {r.sexo === 'macho' ? '♂' : '♀'}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colorAlerta }}>{r.codigo}</div>
                      <div style={{ fontSize: 11, color: tema.textMuted }}>{r.diasVida} días de vida</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {r.yaLimite
                      ? <Chip color="#ff6b80">Reemplazar ya</Chip>
                      : r.enAlerta
                      ? <Chip color="#ffb300">⚠ {r.diasHastaLimite}d al límite</Chip>
                      : <Chip color="#40c4ff">{r.diasHastaLimite}d al límite</Chip>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MOTOR DE RENOVACIÓN UNIFICADO ────────────────────────────────────── */}
      <PanelMotorUnificado motorUnificado={motorUnificado} />

      {/* ── SIMULADOR DE IMPACTO ─────────────────────────────────────────────── */}
      <SimuladorImpacto
        animales={animales}
        stockReal={stockReal}
        bioterioId={bioterioActivo}
        motorUnificado={motorUnificado}
      />

    </div>
  )
}
