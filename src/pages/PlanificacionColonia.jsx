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
  calcularIndiceSostenibilidad,
  generarModoEstrategia,
  OBJETIVOS_ESTRATEGIA,
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

  const [tabHorizonte, setTabHorizonte]           = useState(90)
  const [reservasKey, setReservasKey]             = useState(0)
  const [objetivoEstrategia, setObjetivoEstrategia] = useState('mantener')

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

  // Índice de sostenibilidad — mide si la colonia puede sostener producción futura
  const indiceSostenibilidad = useMemo(
    () => calcularIndiceSostenibilidad({
      stockReal, motorRenovacion: motorUnificado,
      indiceSanitario, indiceGenetico: indiceGeneticoEnriquecido,
      proyeccionAvanzada, pedidos: [], bioterioId: bioterioActivo,
    }),
    [stockReal, motorUnificado, indiceSanitario, indiceGeneticoEnriquecido, proyeccionAvanzada, bioterioActivo]
  )

  // Modo estrategia — recomendaciones ajustadas según el objetivo elegido
  const modoEstrategia = useMemo(
    () => generarModoEstrategia(objetivoEstrategia, {
      stockReal, motorRenovacion: motorUnificado,
      candidatos, proyeccionAvanzada,
      animales: todosAnimales, camadas: todasCamadas,
      bioterioId: bioterioActivo, pedidos: [],
    }),
    [objetivoEstrategia, stockReal, motorUnificado, candidatos, proyeccionAvanzada, todosAnimales, todasCamadas, bioterioActivo]
  )

  const minimosCfg = getMinimosCriticos(bioterioActivo)
  const reservas   = getReservas() // recalcula al cambiar reservasKey

  async function handleReservar(id, tipo, motivo) {
    await reservarAnimal(id, tipo, motivo, bioterioActivo)
    setReservasKey(k => k + 1)
  }
  async function handleLiberar(id) {
    await liberarReserva(id)
    setReservasKey(k => k + 1)
  }

  const nivelEst = nivelEstabilidad(indiceEstabilidad.score)
  const [modoAvanzado, setModoAvanzado] = useState(false)
  const [proyExpand, setProyExpand]     = useState(false)

  // ── Capacidad de jaulas ─────────────────────────────────────────────────
  const jaulasAhora = stockReal.stock.bloques.length
  const h180        = proyeccionAvanzada.horizontes[180]
  const jaulasFut   = jaulasAhora + (h180?.jaulas?.nuevas ?? 0)
  const satFut      = h180?.jaulas?.saturacion ?? 'normal'

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto" style={{ color: tema.textPrimary }}>

      {/* ── ENCABEZADO ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: tema.textPrimary, margin: 0, lineHeight: 1.2 }}>
            Planificación de colonia
          </h1>
          <p style={{ fontSize: 12, color: tema.textMuted, margin: '3px 0 0' }}>
            Estado · Acciones · Proyección · Renovación
          </p>
        </div>
        <button
          onClick={() => setModoAvanzado(m => !m)}
          style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: modoAvanzado ? 'rgba(64,196,255,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${modoAvanzado ? 'rgba(64,196,255,0.4)' : tema.bgCardBorde}`,
            color: modoAvanzado ? '#40c4ff' : tema.textMuted,
          }}
        >
          {modoAvanzado ? '⚡ Modo avanzado' : '⚡ Modo avanzado'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. ESTADO GLOBAL                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ background: tema.bgCard, border: `1px solid ${nivelEst.borde}`, borderRadius: 16, padding: '16px 20px' }}>
        {/* Fila: gauge + factores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <GaugeScore score={indiceSostenibilidad.score} size={86} />

          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: indiceSostenibilidad.color, marginBottom: 10 }}>
              {indiceSostenibilidad.emoji} {indiceSostenibilidad.nivel}
            </div>

            {/* 5 factores en fila compacta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Genética',   valor: indiceSostenibilidad.detalle.genetica,   max: 20, color: '#40c4ff',  emoji: indiceSostenibilidad.detalle.genetica   >= 14 ? '🟢' : indiceSostenibilidad.detalle.genetica   >= 8  ? '🟡' : '🔴' },
                { label: 'Renovación', valor: indiceSostenibilidad.detalle.renovacion, max: 20, color: '#a78bfa',  emoji: indiceSostenibilidad.detalle.renovacion >= 14 ? '🟢' : indiceSostenibilidad.detalle.renovacion >= 8  ? '🟡' : '🔴' },
                { label: 'Saturación', valor: indiceSostenibilidad.detalle.saturacion, max: 10, color: '#ce93d8',  emoji: indiceSostenibilidad.detalle.saturacion >= 7  ? '🟢' : indiceSostenibilidad.detalle.saturacion >= 4  ? '🟡' : '🔴' },
                { label: 'Sanidad',    valor: indiceSostenibilidad.detalle.sanidad,    max: 15, color: '#ff9100',  emoji: indiceSostenibilidad.detalle.sanidad    >= 10 ? '🟢' : indiceSostenibilidad.detalle.sanidad    >= 6  ? '🟡' : '🔴' },
                { label: 'Producción', valor: indiceSostenibilidad.detalle.produccion, max: 15, color: '#00e676',  emoji: indiceSostenibilidad.detalle.produccion >= 10 ? '🟢' : indiceSostenibilidad.detalle.produccion >= 6  ? '🟡' : '🔴' },
              ].map(({ label, valor, max, color, emoji }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, width: 14 }}>{emoji}</span>
                  <span style={{ fontSize: 11, color: tema.textMuted, width: 72, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1 }}><BarraProgreso valor={valor} max={max} color={color} height={4} /></div>
                  <span style={{ fontSize: 10, color, fontFamily: 'monospace', width: 36, textAlign: 'right', flexShrink: 0 }}>{valor}/{max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alertas resumen compactas */}
        {(minimos.alertas.length > 0 || sostenibilidad.riesgos.filter(r => r.nivel === 'critico').length > 0) && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {minimos.alertas.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '6px 10px',
                background: a.critico ? 'rgba(255,61,87,0.08)' : 'rgba(255,179,0,0.07)',
                fontSize: 12, color: a.critico ? '#ff6b80' : '#ffb300',
              }}>
                <AlertTriangle size={13} color={a.critico ? '#ff6b80' : '#ffb300'} />
                {a.mensaje}
              </div>
            ))}
            {sostenibilidad.riesgos.filter(r => r.nivel === 'critico').map((r, i) => (
              <div key={`r${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '6px 10px',
                background: 'rgba(255,61,87,0.06)', fontSize: 12, color: '#ff6b80',
              }}>
                <AlertTriangle size={13} color="#ff6b80" />
                {r.mensaje}
                <Chip color="#ff6b80">{r.horizonte}d</Chip>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. ¿QUÉ HACER HOY?                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {accionesHoy.length > 0 && (
        <div style={{ background: tema.bgCard, border: `1px solid ${accionesHoy[0]?.prioridad === 0 ? 'rgba(255,61,87,0.25)' : tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
          <SeccionTitulo icono={<Zap size={16} color="#ffd740" />} titulo="¿Qué hacer hoy?" subtitulo="Urgente → Preventivo → Opcional" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accionesHoy.map((accion, i) => {
              const colorMapa = { 0: '#ff6b80', 1: '#ff9100', 2: '#ffb300', 3: '#ffd740', 4: '#00e676' }
              const labelMapa = { 0: 'Urgente', 1: 'Esta semana', 2: 'Próximamente', 3: 'Preventivo', 4: 'Opcional' }
              const color = colorMapa[accion.prioridad] ?? '#c9d4e0'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: `${color}07`, border: `1px solid ${color}22`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{accion.icono}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color }}>{accion.titulo}</div>
                    <div style={{ fontSize: 11, color: tema.textSecondary, marginTop: 2 }}>{accion.descripcion}</div>
                  </div>
                  <Chip color={color}>{labelMapa[accion.prioridad] ?? 'Info'}</Chip>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. PROYECCIÓN 30/60/90/180d                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
          <SeccionTitulo icono={<Clock size={16} color="#40c4ff" />} titulo="Proyección" subtitulo={`1 pareja / ${parejasCadaDias}d — ~${proyeccionAvanzada.patrones.promCrias} crías/parto`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: tema.textMuted }}>1 par /</span>
            <input
              type="number" min={7} max={60} value={parejasCadaDias}
              onChange={e => setParejasCadaDias(Math.max(7, Math.min(60, Number(e.target.value))))}
              style={{ width: 46, padding: '3px 6px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff', textAlign: 'center', outline: 'none' }}
            />
            <span style={{ fontSize: 11, color: tema.textMuted }}>d</span>
          </div>
        </div>

        {/* 4 horizontes compactos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
          {[30, 60, 90, 180].map(h => {
            const d = proyeccionAvanzada.horizontes[h]
            const ok = d.ok
            const hasDef = d.deficit.hayDeficit
            const sat    = d.jaulas.saturacion === 'alta'
            const colorTit = ok ? '#00e676' : hasDef && !d.deficit.puedeCubrirConStock ? '#ff6b80' : '#ffb300'
            const emoji    = ok ? '🟢' : hasDef && !d.deficit.puedeCubrirConStock ? '🔴' : '🟡'
            return (
              <div key={h} style={{ background: `${colorTit}08`, border: `1px solid ${colorTit}25`, borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: colorTit }}>{h}d</span>
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tema.textMuted }}>
                    <span>partos</span>
                    <span style={{ color: '#00e676', fontWeight: 600 }}>{d.partos.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tema.textMuted }}>
                    <span>crías</span>
                    <span style={{ color: '#40c4ff', fontWeight: 600 }}>~{d.crias.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tema.textMuted }}>
                    <span>saturación</span>
                    <span style={{ color: sat ? '#ff6b80' : '#c9d4e0', fontWeight: 600 }}>{sat ? '⚠ Alta' : 'OK'}</span>
                  </div>
                  {hasDef && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: d.deficit.puedeCubrirConStock ? '#ffb300' : '#ff6b80', marginTop: 2, textAlign: 'center', background: d.deficit.puedeCubrirConStock ? 'rgba(255,179,0,0.1)' : 'rgba(255,61,87,0.1)', borderRadius: 4, padding: '1px 4px' }}>
                      {d.deficit.machos > 0 ? `−${d.deficit.machos}♂` : ''}{d.deficit.machos > 0 && d.deficit.hembras > 0 ? ' ' : ''}{d.deficit.hembras > 0 ? `−${d.deficit.hembras}♀` : ''}
                      {d.deficit.puedeCubrirConStock ? ' (cub.)' : ' ⚠'}
                    </div>
                  )}
                  {d.stockNeto && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: tema.textMuted, borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 2, paddingTop: 2 }}>
                      <span>neto</span>
                      <span style={{ color: d.stockNeto.neto > 0 ? '#a78bfa' : '#ff6b80', fontWeight: 700 }}>~{d.stockNeto.neto}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Expandir: partos/destetes en curso */}
        <button
          onClick={() => setProyExpand(e => !e)}
          style={{ width: '100%', padding: '5px 0', background: 'transparent', border: `1px solid ${tema.bgCardBorde}`, borderRadius: 8, fontSize: 11, color: tema.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {proyExpand ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {proyExpand ? 'Ocultar detalle' : `Ver partos/destetes en curso (${proyeccion.partosPendientes.length + proyeccion.destesPendientes.length})`}
        </button>

        {proyExpand && (
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: tema.textMuted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Partos ({proyeccion.partosPendientes.length})</div>
              {proyeccion.partosPendientes.length === 0
                ? <div style={{ fontSize: 11, color: tema.textMuted }}>Sin apareamientos activos</div>
                : proyeccion.partosPendientes.slice(0, 5).map((p, i) => (
                  <div key={p.camadaId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, marginBottom: 3, background: p.vencido ? 'rgba(255,61,87,0.06)' : 'rgba(0,230,118,0.04)' }}>
                    <span style={{ fontSize: 11, color: tema.textSecondary }}>#{i + 1}</span>
                    <span style={{ fontSize: 11, color: p.vencido ? '#ff6b80' : '#00e676', fontFamily: 'monospace' }}>{p.vencido ? 'Vencido' : `${p.diasRestantes}d`}</span>
                  </div>
                ))
              }
            </div>
            <div>
              <div style={{ fontSize: 10, color: tema.textMuted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Destetes ({proyeccion.destesPendientes.length})</div>
              {proyeccion.destesPendientes.length === 0
                ? <div style={{ fontSize: 11, color: tema.textMuted }}>Sin camadas en lactancia</div>
                : proyeccion.destesPendientes.slice(0, 5).map((d, i) => (
                  <div key={d.camadaId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 7, marginBottom: 3, background: d.vencido ? 'rgba(255,61,87,0.06)' : 'rgba(64,196,255,0.04)' }}>
                    <span style={{ fontSize: 11, color: tema.textSecondary }}>#{i + 1}{d.totalCrias > 0 ? ` · ${d.totalCrias}cr` : ''}</span>
                    <span style={{ fontSize: 11, color: d.vencido ? '#ff6b80' : '#40c4ff', fontFamily: 'monospace' }}>{d.vencido ? 'Vencido' : `${d.diasRestantes}d`}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. CAPACIDAD DE JAULAS                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ background: tema.bgCard, border: `1px solid ${satFut === 'alta' ? 'rgba(255,61,87,0.2)' : tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
        <SeccionTitulo icono={<Package size={16} color="#a78bfa" />} titulo="Capacidad" subtitulo="Jaulas actuales vs proyectadas a 180d" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Ahora',  valor: jaulasAhora, sub: 'jaulas activas',  color: '#a78bfa' },
            { label: '+ 180d', valor: `+${h180?.jaulas?.nuevas ?? 0}`, sub: 'nuevas est.',  color: '#40c4ff' },
            { label: 'Total',  valor: jaulasFut,   sub: satFut === 'alta' ? '⚠ Saturación alta' : 'proyectado', color: satFut === 'alta' ? '#ff6b80' : '#00e676' },
          ].map(({ label, valor, sub, color }) => (
            <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px' }}>
              <div style={{ fontSize: 10, color: tema.textMuted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
              <div style={{ fontSize: 10, color: tema.textMuted, marginTop: 3 }}>{sub}</div>
            </div>
          ))}
        </div>
        {satFut === 'alta' && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#ff6b80', background: 'rgba(255,61,87,0.07)', border: '1px solid rgba(255,61,87,0.2)', borderRadius: 8, padding: '7px 10px' }}>
            ⚠ Riesgo de saturación en 180d — considerar incrementar sacrificios o reducir apareamientos
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5. RENOVACIÓN (mínimos + déficit + candidatos + edad límite)          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ background: tema.bgCard, border: `1px solid ${minimos.critico ? 'rgba(255,61,87,0.25)' : tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
        <SeccionTitulo icono={<RefreshCcw size={16} color={minimos.critico ? '#ff6b80' : '#00e676'} />} titulo="Renovación" subtitulo="Reproductores · Déficit · Candidatos · Edad límite" />

        {/* Fila: machos y hembras con déficit + candidato en una sola vista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              sexo: 'macho', emoji: '♂', colorSexo: '#40c4ff',
              actual: stockReal.reproductores.machos.filter(m => !m.exportado_hibridos).length,
              minimo: minimosCfg.machos_colonia,
            },
            {
              sexo: 'hembra', emoji: '♀', colorSexo: '#ce93d8',
              actual: stockReal.reproductores.hembras.filter(h => !h.exportado_hibridos).length,
              minimo: minimosCfg.hembras_colonia,
            },
            ...(minimosCfg.machos_hibridos > 0 ? [{
              sexo: 'macho', emoji: '♂F1', colorSexo: '#ffd740',
              actual: stockReal.reproductores.machosHibridos.length,
              minimo: minimosCfg.machos_hibridos,
            }] : []),
            ...(minimosCfg.hembras_hibridos > 0 ? [{
              sexo: 'hembra', emoji: '♀F1', colorSexo: '#ffd740',
              actual: stockReal.reproductores.hembrasHibridos.length,
              minimo: minimosCfg.hembras_hibridos,
            }] : []),
          ].map(({ sexo, emoji, colorSexo, actual, minimo }) => {
            const ok      = actual >= minimo
            const deficit = Math.max(0, minimo - actual)
            // Candidato del motor que cubre este sexo
            const accion  = motorUnificado.accionesRecomendadas.find(a => a.sexo === sexo && (a.tipo === 'deficit' || a.tipo === 'reemplazo'))
            const cand    = accion?.candidato ?? null
            // Próximo al límite de este sexo
            const proxLim = proyeccion.reproProximosLimite.filter(r => r.sexo === sexo)
            return (
              <div key={emoji} style={{
                borderRadius: 12, padding: '10px 14px',
                background: ok ? 'rgba(255,255,255,0.02)' : 'rgba(255,61,87,0.05)',
                border: `1px solid ${ok ? tema.bgCardBorde : 'rgba(255,61,87,0.2)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Conteo */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 90 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: ok ? colorSexo : '#ff6b80', lineHeight: 1 }}>{actual}</span>
                    <span style={{ fontSize: 12, color: tema.textMuted }}>/ {minimo} mín</span>
                    <span style={{ fontSize: 16 }}>{emoji}</span>
                  </div>

                  {/* Estado */}
                  {ok
                    ? <Chip color="#00e676">✓ OK</Chip>
                    : <Chip color="#ff6b80">Déficit {deficit}</Chip>}

                  {/* Candidato a promover */}
                  {cand && (
                    <div style={{ fontSize: 11, color: cand.listo ?? cand.tiempoHastaUtilidad === 0 ? '#00e676' : '#ffb300', fontWeight: 600 }}>
                      → Promover {cand.machos ?? 0}♂{cand.hembras ?? 0}♀
                      {(cand.tiempoHastaUtilidad ?? 0) === 0
                        ? ' (listo)'
                        : ` en ${cand.tiempoHastaUtilidad}d`}
                    </div>
                  )}
                  {!cand && !ok && (
                    <span style={{ fontSize: 11, color: '#ffb300' }}>⚠ Sin candidato — aparear de emergencia</span>
                  )}

                  {/* Próximos al límite */}
                  {proxLim.length > 0 && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {proxLim.slice(0, 3).map(r => (
                        <Chip key={r.animalId} color={r.yaLimite ? '#ff6b80' : '#ffb300'}>
                          {r.codigo} {r.yaLimite ? '✕' : `${r.diasHastaLimite}d`}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Motor unificado: acciones de reemplazo */}
        {motorUnificado.accionesRecomendadas.length > 0 && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${tema.bgCardBorde}`, paddingTop: 12 }}>
            <div style={{ fontSize: 10, color: tema.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Acciones de renovación
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {motorUnificado.accionesRecomendadas.map((accion, i) => {
                const colorPrio = accion.prioridad === 0 ? '#ff6b80' : accion.prioridad === 1 ? '#ff9100' : accion.prioridad === 2 ? '#ffb300' : '#40c4ff'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, background: `${colorPrio}07`, border: `1px solid ${colorPrio}22`, borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ color: colorPrio, fontWeight: 700, flexShrink: 0 }}>
                      {accion.prioridad === 0 ? 'URGENTE' : accion.prioridad === 1 ? 'CRÍTICO' : accion.prioridad === 2 ? 'ALERTA' : 'INFO'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: accion.sexo === 'macho' ? '#40c4ff' : '#ce93d8' }}>
                        {accion.sexo === 'macho' ? '♂' : '♀'}
                      </span>{' '}
                      <span style={{ color: colorPrio }}>{accion.tipo === 'deficit' ? 'Déficit' : 'Reemplazo'}</span>
                      {accion.animalSaliente ? ` — ${accion.animalSaliente.codigo}` : ''}
                      {accion.candidato
                        ? <span style={{ color: '#00e676', marginLeft: 8 }}>
                            → {accion.candidato.diasVida}d · {accion.candidato.machos || 0}♂ {accion.candidato.hembras || 0}♀
                            {accion.impactoEnIndice && <Chip color="#00e676" style={{ marginLeft: 4 }}>{accion.impactoEnIndice}</Chip>}
                          </span>
                        : <span style={{ color: '#ffb300', marginLeft: 8 }}>⏳ Sin candidato aún</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODO AVANZADO                                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modoAvanzado && (
        <>
          {/* Modo Estrategia */}
          <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
            <SeccionTitulo icono={<Layers size={16} color="#40c4ff" />} titulo="Modo estrategia" subtitulo="Objetivo → ajusta recomendaciones automáticamente" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(OBJETIVOS_ESTRATEGIA).map(([key, cfg]) => {
                const activo = objetivoEstrategia === key
                return (
                  <button key={key} onClick={() => setObjetivoEstrategia(key)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: activo ? 'rgba(64,196,255,0.18)' : 'transparent', border: `1px solid ${activo ? 'rgba(64,196,255,0.5)' : tema.bgCardBorde}`, color: activo ? '#40c4ff' : tema.textMuted }}>
                    {cfg.emoji} {cfg.label}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#40c4ff', background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.15)', borderRadius: 8, padding: '7px 10px', marginBottom: 12 }}>
              {modoEstrategia.config.emoji} <strong>{modoEstrategia.config.label}:</strong> {modoEstrategia.config.desc}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 7, marginBottom: 12 }}>
              {[
                { label: '♂ activos', valor: modoEstrategia.kpis.machosActivos, color: '#40c4ff' },
                { label: '♀ libres',  valor: modoEstrategia.kpis.libres,        color: '#ce93d8' },
                { label: 'cand. ✓',   valor: modoEstrategia.kpis.candidatosDisp,   color: '#00e676' },
                { label: 'cand. ~',   valor: modoEstrategia.kpis.candidatosPronto, color: '#ffb300' },
                { label: 'partos 90d', valor: modoEstrategia.kpis.partos90d,   color: '#ffd740' },
                { label: 'crías 90d',  valor: modoEstrategia.kpis.crias90d,    color: '#a78bfa' },
              ].map(({ label, valor, color }) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '7px 5px' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
                  <div style={{ fontSize: 9, color: tema.textMuted, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {modoEstrategia.recomendaciones.map((r, i) => {
                const colorMap = { 0: '#ff6b80', 1: '#ff9100', 2: '#ffb300', 3: '#ffd740', 4: '#00e676' }
                const color = colorMap[r.prioridad] ?? '#40c4ff'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: `${color}07`, border: `1px solid ${color}22`, borderRadius: 10, padding: '10px 12px' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icono}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color }}>{r.texto}</div>
                      {r.detalle && <div style={{ fontSize: 11, color: tema.textMuted }}>{r.detalle}</div>}
                    </div>
                    <Chip color={color}>{r.prioridad === 0 ? 'Urgente' : r.prioridad === 1 ? 'Prior.' : r.prioridad === 2 ? 'Recom.' : 'Info'}</Chip>
                  </div>
                )
              })}
            </div>
            {modoEstrategia.restricciones.length > 0 && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${tema.bgCardBorde}`, paddingTop: 10 }}>
                {modoEstrategia.restricciones.map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#ffb300', display: 'flex', gap: 6 }}><span>⚑</span><span>{r}</span></div>
                ))}
              </div>
            )}
          </div>

          {/* Índice genético */}
          <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
            <SeccionTitulo icono={<Dna size={16} color="#a78bfa" />} titulo="Genética" subtitulo="Consanguinidad · Tendencia · Reemplazos disponibles" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <GaugeScore score={indiceGeneticoEnriquecido.score} size={80} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: indiceGeneticoEnriquecido.color }}>{indiceGeneticoEnriquecido.nivel}</span>
                  {indiceGeneticoEnriquecido.tendencia !== 'estable' && (
                    <Chip color={indiceGeneticoEnriquecido.tendencia === 'mejorando' ? '#00e676' : '#ff6b80'}>
                      {indiceGeneticoEnriquecido.tendencia === 'mejorando' ? '↑ Mejorando' : '↓ Deteriorando'}
                    </Chip>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
                  {[
                    { label: 'F prom.',         valor: indiceGeneticoEnriquecido.fPorcentaje, color: '#a78bfa' },
                    { label: 'Con genealogía',  valor: `${indiceGeneticoEnriquecido.animalesConPadres}/${indiceGeneticoEnriquecido.totalReproductores}`, color: '#40c4ff' },
                    { label: 'Reemplazos listos', valor: candidatos.filter(c => c.recomendado && c.tiempoHastaUtilidad === 0).length, color: '#00e676' },
                  ].map(({ label, valor, color }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '7px 9px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{valor}</div>
                      <div style={{ fontSize: 9, color: tema.textMuted }}>{label}</div>
                    </div>
                  ))}
                </div>
                {indiceGeneticoEnriquecido.advertencias.map((adv, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#ffb300', marginTop: 6 }}>⚠ {adv}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Candidatos a renovación */}
          <div style={{ background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}`, borderRadius: 16, padding: '16px 20px' }}>
            <SeccionTitulo icono={<TrendingUp size={16} color="#a78bfa" />} titulo="Candidatos a renovación" subtitulo="Jaulas de stock ordenadas por prioridad de promoción" />
            {candidatos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: tema.textMuted, fontSize: 12 }}>
                📦 Sin crías en edad de renovación — aparecen al acercarse a {bio?.MADUREZ_DIAS ?? 56} días
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                {candidatos.slice(0, 9).map((candidato, i) => (
                  <TarjetaCandidato
                    key={`${candidato.jaulaId}-${reservasKey}`}
                    candidato={candidato} index={i} camadas={todasCamadas}
                    reservado={esReservado(candidato.jaulaId)}
                    onReservar={handleReservar} onLiberar={handleLiberar}
                  />
                ))}
              </div>
            )}
            {candidatos.length > 9 && (
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: tema.textMuted }}>
                + {candidatos.length - 9} candidatos adicionales
              </div>
            )}
          </div>

          {/* Simulador de impacto */}
          <SimuladorImpacto
            animales={animales}
            stockReal={stockReal}
            bioterioId={bioterioActivo}
            motorUnificado={motorUnificado}
          />
        </>
      )}

    </div>
  )
}
