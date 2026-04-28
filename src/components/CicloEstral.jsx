import { useState, useMemo, useEffect } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import {
  hoy, formatFecha,
  sugerirFase, calcularPatronEstral, predecirProximoEstro, calcularGestacionEstral,
} from '../utils/calculos'

// ── Configuración visual de fases ─────────────────────────────────────────────
const FASES = {
  L1: { label: 'L1',  desc: 'Diestro temprano',  color: '#40c4ff', bg: 'rgba(64,196,255,0.10)'  },
  L2: { label: 'L2',  desc: 'Diestro medio',      color: '#4fc3f7', bg: 'rgba(79,195,247,0.10)'  },
  L3: { label: 'L3',  desc: 'Diestro tardío',     color: '#81d4fa', bg: 'rgba(129,212,250,0.10)' },
  O:  { label: 'O',   desc: 'Receptiva',          color: '#00e676', bg: 'rgba(0,230,118,0.12)'   },
  E:  { label: 'E',   desc: 'Post-servicio',       color: '#ff9100', bg: 'rgba(255,145,0,0.10)'   },
}

const iStyle = {
  background: 'rgba(8,13,26,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '8px',
  padding: '5px 10px',
  fontSize: '12px',
  width: '100%',
  outline: 'none',
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function FaseTag({ fase }) {
  if (!fase || !FASES[fase]) return <span style={{ color: '#2a3a50' }}>—</span>
  const cfg = FASES[fase]
  return (
    <span
      className="font-bold rounded px-1.5 py-0.5 text-xs"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}35` }}
    >
      {fase}
    </span>
  )
}

function SelectBar({ label, opciones, valor, onChange, colorMap = {} }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs shrink-0 pt-1 w-28" style={{ color: '#4a5f7a' }}>{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {opciones.map(([key, lbl]) => {
          const activo = valor === key
          const color = colorMap[key] || '#8a9bb0'
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(activo ? '' : key)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              style={
                activo
                  ? { background: `${color}20`, border: `1px solid ${color}55`, color }
                  : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
              }
            >
              {lbl}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GestacionPanel({ gestacion }) {
  const { diaActual, confirmadaPorEsperma, predicciones, diasParaParto, partoEsperado } = gestacion
  const pct = Math.min((diaActual / 23) * 100, 100)
  const urgente = diasParaParto <= 3

  const colorBarra = diaActual < 15 ? '#00e676' : diaActual < 20 ? '#ffb300' : '#ff6b80'

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: urgente ? 'rgba(255,61,87,0.06)' : 'rgba(0,230,118,0.06)',
        border: `1px solid ${urgente ? 'rgba(255,61,87,0.3)' : 'rgba(0,230,118,0.25)'}`,
      }}
    >
      {/* Contador */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: urgente ? '#ff6b80' : '#00e676' }}>
            Gestación — Día {diaActual}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
            {confirmadaPorEsperma
              ? 'Preñez confirmada (espermatozoides)'
              : 'Confirmada por cópula observada'}
            {' · '}
            Parto esperado: {formatFecha(new Date(partoEsperado + 'T12:00:00'))}
          </div>
        </div>
        {diasParaParto > 0 ? (
          <div className="text-center">
            <div className="text-xl font-bold font-mono" style={{ color: urgente ? '#ff6b80' : '#ffd740' }}>
              {diasParaParto}d
            </div>
            <div className="text-xs" style={{ color: '#4a5f7a' }}>para parto</div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-sm font-bold" style={{ color: '#ff1744' }}>PARTO</div>
            <div className="text-xs" style={{ color: '#4a5f7a' }}>estimado hoy</div>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,51,82,0.6)' }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${pct}%`, background: colorBarra }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: '#2a3a50' }}>
          <span>Día 0</span>
          <span>Día 18</span>
          <span>Día 23</span>
        </div>
      </div>

      {/* Hitos próximos */}
      <div className="space-y-1">
        {predicciones.filter((p) => !p.pasado || p.diasRestantes >= -1).map((p) => {
          const esHoy = p.diasRestantes === 0
          const esPasado = p.pasado && p.diasRestantes < 0
          const colorHito = esPasado ? '#2a3a50' : esHoy ? '#ff6b80' : p.urgencia === 'critico' ? '#ff9100' : p.urgencia === 'alerta' ? '#ffd740' : '#40c4ff'
          return (
            <div key={p.dia} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span style={{ color: esPasado ? '#2a3a50' : colorHito }}>
                  {esPasado ? '✓' : esHoy ? '⚠' : '○'} Día {p.dia} — {p.label}
                </span>
              </div>
              <span className="font-mono" style={{ color: esPasado ? '#2a3a50' : '#4a5f7a' }}>
                {esPasado ? 'pasado' : esHoy ? 'HOY' : `en ${p.diasRestantes}d`} · {p.fechaFormateada}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrediccionPanel({ prediccion }) {
  const { proximaVentana, longitudPromedio, patron, diasO, ciclos, alertaHoy, alertaMañana } = prediccion

  const alertColor = alertaHoy ? '#ff6b80' : alertaMañana ? '#ffd740' : '#40c4ff'
  const alertMsg = alertaHoy
    ? 'Alta probabilidad de receptividad HOY'
    : alertaMañana
    ? 'Ventana óptima para cruce mañana'
    : `Próxima ventana en ${proximaVentana.diasHasta} día${proximaVentana.diasHasta !== 1 ? 's' : ''}`

  return (
    <div
      className="rounded-xl p-3 space-y-2"
      style={{ background: `${alertColor}08`, border: `1px solid ${alertColor}30` }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold" style={{ color: alertColor }}>
            {alertaHoy ? '🔴 ' : alertaMañana ? '🟡 ' : '🔵 '}{alertMsg}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
            Patrón individual: ~{longitudPromedio}d ({patron}) · {ciclos} ciclo{ciclos !== 1 ? 's' : ''} registrado{ciclos !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono font-bold" style={{ color: alertColor }}>
            {proximaVentana.fechaFormateada}
          </div>
          <div className="text-xs" style={{ color: '#2a3a50' }}>{diasO} días O registrados</div>
        </div>
      </div>
      {/* Próximas 3 ventanas */}
      <div className="flex gap-3 pt-1">
        {prediccion.ventanas.map((v, i) => (
          <div key={i} className="text-center px-2 py-1 rounded-lg flex-1"
            style={{ background: i === 0 ? `${alertColor}12` : 'rgba(30,51,82,0.3)', border: `1px solid ${i === 0 ? alertColor + '30' : 'rgba(30,51,82,0.5)'}` }}>
            <div className="text-xs font-bold font-mono" style={{ color: i === 0 ? alertColor : '#8a9bb0' }}>
              {v.diasHasta === 0 ? 'HOY' : v.diasHasta < 0 ? `−${Math.abs(v.diasHasta)}d` : `+${v.diasHasta}d`}
            </div>
            <div className="text-xs" style={{ color: '#4a5f7a' }}>{v.fechaFormateada}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CicloEstral({ animal }) {
  const { extendidos, agregarExtendido, eliminarExtendido, bio } = useBioterio()

  // Historial de esta hembra, ordenado por fecha ascendente
  const historial = useMemo(
    () => [...extendidos.filter((e) => e.animal_id === animal.id)].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [extendidos, animal.id]
  )

  const patron   = useMemo(() => calcularPatronEstral(historial), [historial])
  const prediccion = useMemo(() => predecirProximoEstro(historial), [historial])
  const gestacion  = useMemo(() => calcularGestacionEstral(historial, bio), [historial, bio])

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [mostrarForm, setMostrarForm]   = useState(false)
  const [verTodo, setVerTodo]           = useState(false)
  const [guardando, setGuardando]       = useState(false)
  const [eliminando, setEliminando]     = useState(null)

  const [fecha, setFecha]         = useState(hoy())
  const [citologia, setCitologia] = useState('')
  const [claridad, setClaridad]   = useState('')
  const [apertura, setApertura]   = useState('')
  const [lordosis, setLordosis]   = useState('')
  const [copula, setCopula]       = useState('')
  const [esperma, setEsperma]     = useState('')
  const [faseManual, setFaseManual] = useState('')
  const [notas, setNotas]         = useState('')

  // Si hay un extendido existente para la fecha seleccionada, cargar sus datos
  const existente = historial.find((e) => e.fecha === fecha)

  useEffect(() => {
    if (existente) {
      setCitologia(existente.citologia || '')
      setClaridad(existente.claridad || '')
      setApertura(existente.apertura_vaginal || '')
      setLordosis(existente.lordosis || '')
      setCopula(existente.copula || '')
      setEsperma(existente.espermatozoides || '')
      setFaseManual(existente.fase_confirmada ? (existente.fase || '') : '')
      setNotas(existente.notas || '')
    } else {
      setCitologia(''); setClaridad(''); setApertura('')
      setLordosis(''); setCopula(''); setEsperma('')
      setFaseManual(''); setNotas('')
    }
  }, [fecha, existente?.id])

  // Fase auto-sugerida a partir de los datos ingresados
  const previos = historial.filter((e) => e.fecha < fecha)
  const faseSugerida = useMemo(
    () => sugerirFase({ citologia, claridad, apertura_vaginal: apertura, copula, espermatozoides: esperma }, previos),
    [citologia, claridad, apertura, copula, esperma]
  )
  const faseEfectiva = faseManual || faseSugerida
  const esDia0 = copula === 'confirmada'

  function resetForm() {
    setFecha(hoy())
    setCitologia(''); setClaridad(''); setApertura('')
    setLordosis(''); setCopula(''); setEsperma('')
    setFaseManual(''); setNotas('')
  }

  async function guardar() {
    if (!fecha) return
    setGuardando(true)
    await agregarExtendido({
      animal_id: animal.id,
      fecha,
      citologia: citologia || null,
      claridad: claridad || null,
      apertura_vaginal: apertura || null,
      lordosis: lordosis || null,
      copula: copula || null,
      espermatozoides: esperma || null,
      fase: faseEfectiva || null,
      fase_confirmada: Boolean(faseManual),
      es_dia_0: esDia0,
      notas: notas || null,
    })
    resetForm()
    setMostrarForm(false)
    setGuardando(false)
  }

  async function borrar(id) {
    setEliminando(id)
    await eliminarExtendido(id)
    setEliminando(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const visibles = verTodo ? historial.slice().reverse() : historial.slice(-8).reverse()

  return (
    <div className="space-y-3 mt-1">
      {/* Título de sección */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#ce93d8' }}>
          🔬 Ciclo Estral y Reproducción Predictiva
        </div>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); if (!mostrarForm) resetForm() }}
          className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
          style={
            mostrarForm
              ? { background: 'rgba(206,147,216,0.08)', border: '1px solid rgba(206,147,216,0.3)', color: '#ce93d8' }
              : { background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.6)', color: '#8a9bb0' }
          }
        >
          {mostrarForm ? '✕ Cerrar' : existente ? '✏ Editar hoy' : '+ Agregar extendido'}
        </button>
      </div>

      {/* Panel de estado: gestación O predicción */}
      {gestacion && <GestacionPanel gestacion={gestacion} />}
      {!gestacion && prediccion && <PrediccionPanel prediccion={prediccion} />}
      {!gestacion && !prediccion && historial.length > 0 && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(30,51,82,0.3)', color: '#4a5f7a', border: '1px solid rgba(30,51,82,0.5)' }}>
          {patron.suficientesDatos === false && patron.diasO < 2
            ? `Cargá más extendidos con fase O para activar la predicción (${patron.diasO ?? 0} días O registrados — necesitás 2)`
            : 'Datos insuficientes para predicción.'}
        </div>
      )}
      {historial.length === 0 && !mostrarForm && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(30,51,82,0.3)', color: '#4a5f7a', border: '1px solid rgba(30,51,82,0.5)' }}>
          Sin extendidos registrados. Usá el botón "Agregar extendido" para empezar el seguimiento.
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.9)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#ce93d8' }}>
            {existente ? 'Editar extendido' : 'Nuevo extendido'}
            {existente && <span className="ml-2 font-normal normal-case text-xs" style={{ color: '#4a5f7a' }}>(sobreescribe el registro de esta fecha)</span>}
          </div>

          {/* Fecha */}
          <div className="flex items-center gap-2">
            <span className="text-xs w-28 shrink-0" style={{ color: '#4a5f7a' }}>Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...iStyle, width: 'auto' }} />
          </div>

          {/* Divider */}
          <div className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: '#4a5f7a', borderTop: '1px solid rgba(30,51,82,0.5)', paddingTop: '8px' }}>
            Citología vaginal
          </div>

          <SelectBar
            label="Células"
            opciones={[
              ['leucocitos', 'Leucocitos'],
              ['celulas_ovales', 'Células ovales'],
              ['celulas_escamosas', 'Células escamosas'],
            ]}
            valor={citologia}
            onChange={setCitologia}
            colorMap={{ leucocitos: '#40c4ff', celulas_ovales: '#ce93d8', celulas_escamosas: '#00e676' }}
          />

          <SelectBar
            label="Claridad"
            opciones={[['claro', 'Claro'], ['poco_claro', 'Poco claro']]}
            valor={claridad}
            onChange={setClaridad}
          />

          <div className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: '#4a5f7a', borderTop: '1px solid rgba(30,51,82,0.5)', paddingTop: '8px' }}>
            Signos externos
          </div>

          <SelectBar
            label="Apertura vaginal"
            opciones={[['si', 'Sí'], ['no', 'No'], ['dudosa', 'Dudosa']]}
            valor={apertura}
            onChange={setApertura}
            colorMap={{ si: '#00e676', no: '#ff6b80', dudosa: '#ffd740' }}
          />

          <div className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: '#4a5f7a', borderTop: '1px solid rgba(30,51,82,0.5)', paddingTop: '8px' }}>
            Cruce con macho
          </div>

          <SelectBar
            label="Lordosis"
            opciones={[['si', 'Sí'], ['no', 'No'], ['dudosa', 'Dudosa']]}
            valor={lordosis}
            onChange={setLordosis}
            colorMap={{ si: '#00e676', no: '#ff6b80', dudosa: '#ffd740' }}
          />

          <SelectBar
            label="Cópula"
            opciones={[['confirmada', 'Confirmada'], ['no_confirmada', 'No confirmada'], ['no_observado', 'No observado']]}
            valor={copula}
            onChange={setCopula}
            colorMap={{ confirmada: '#00e676', no_confirmada: '#ff6b80', no_observado: '#4a5f7a' }}
          />

          {copula === 'confirmada' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }}>
              ✓ Este día queda marcado como Día 0 de gestación
            </div>
          )}

          <div className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: '#4a5f7a', borderTop: '1px solid rgba(30,51,82,0.5)', paddingTop: '8px' }}>
            Espermatozoides (extendido del día siguiente)
          </div>

          <SelectBar
            label="Espermatozoides"
            opciones={[['encontrados', 'Encontrados'], ['no_encontrados', 'No encontrados'], ['dudoso', 'Dudoso']]}
            valor={esperma}
            onChange={setEsperma}
            colorMap={{ encontrados: '#00e676', no_encontrados: '#ff6b80', dudoso: '#ffd740' }}
          />

          {esperma === 'encontrados' && !gestacion && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }}>
              ✓ Confirma la cópula del día anterior — preñez probable
            </div>
          )}

          {/* Fase auto-sugerida */}
          <div className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: '#4a5f7a', borderTop: '1px solid rgba(30,51,82,0.5)', paddingTop: '8px' }}>
            Fase del ciclo
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs w-28 shrink-0" style={{ color: '#4a5f7a' }}>Auto-sugerida</span>
            {faseSugerida ? (
              <FaseTag fase={faseSugerida} />
            ) : (
              <span className="text-xs" style={{ color: '#2a3a50' }}>— (completá los datos de arriba)</span>
            )}
          </div>

          <SelectBar
            label="Override manual"
            opciones={Object.entries(FASES).map(([k, v]) => [k, `${k} ${v.desc}`])}
            valor={faseManual}
            onChange={setFaseManual}
            colorMap={Object.fromEntries(Object.entries(FASES).map(([k, v]) => [k, v.color]))}
          />

          {/* Notas */}
          <div className="flex items-center gap-2">
            <span className="text-xs w-28 shrink-0" style={{ color: '#4a5f7a' }}>Notas</span>
            <input
              type="text"
              placeholder="Observaciones opcionales..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              style={iStyle}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setMostrarForm(false); resetForm() }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(30,51,82,0.4)', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }}
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 py-2 rounded-lg text-xs font-bold"
              style={{
                background: guardando ? 'rgba(206,147,216,0.05)' : 'rgba(206,147,216,0.12)',
                border: '1px solid rgba(206,147,216,0.35)',
                color: '#ce93d8',
                opacity: guardando ? 0.6 : 1,
              }}
            >
              {guardando ? 'Guardando...' : existente ? 'Actualizar' : 'Registrar extendido'}
            </button>
          </div>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>
            Historial ({historial.length} registros)
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(30,51,82,0.6)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(8,13,26,0.8)', borderBottom: '1px solid rgba(30,51,82,0.6)' }}>
                  {['Fecha', 'Citología', 'Apertura', 'Cópula', 'Esperma', 'Fase', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-widest" style={{ color: '#2a3a50' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const cfg = e.fase ? FASES[e.fase] : null
                  return (
                    <tr
                      key={e.id}
                      style={{
                        borderBottom: '1px solid rgba(30,51,82,0.3)',
                        background: e.es_dia_0
                          ? 'rgba(0,230,118,0.04)'
                          : e.fase === 'O'
                          ? 'rgba(0,230,118,0.02)'
                          : 'transparent',
                      }}
                    >
                      <td className="px-3 py-2 font-mono" style={{ color: '#8a9bb0' }}>
                        {formatFecha(new Date(e.fecha + 'T12:00:00'), { day: '2-digit', month: '2-digit' })}
                        {e.es_dia_0 && (
                          <span className="ml-1 font-bold" style={{ color: '#00e676' }}>D0</span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: '#4a5f7a' }}>
                        {e.citologia === 'leucocitos' && <span style={{ color: '#40c4ff' }}>Leuc.</span>}
                        {e.citologia === 'celulas_ovales' && <span style={{ color: '#ce93d8' }}>Oval.</span>}
                        {e.citologia === 'celulas_escamosas' && <span style={{ color: '#00e676' }}>Escam.</span>}
                        {!e.citologia && <span style={{ color: '#2a3a50' }}>—</span>}
                      </td>
                      <td className="px-3 py-2" style={{ color: '#4a5f7a' }}>
                        {e.apertura_vaginal === 'si' && <span style={{ color: '#00e676' }}>Sí</span>}
                        {e.apertura_vaginal === 'no' && <span style={{ color: '#4a5f7a' }}>No</span>}
                        {e.apertura_vaginal === 'dudosa' && <span style={{ color: '#ffd740' }}>Dud.</span>}
                        {!e.apertura_vaginal && <span style={{ color: '#2a3a50' }}>—</span>}
                      </td>
                      <td className="px-3 py-2" style={{ color: '#4a5f7a' }}>
                        {e.copula === 'confirmada' && <span style={{ color: '#00e676', fontWeight: 700 }}>✓ Conf.</span>}
                        {e.copula === 'no_confirmada' && <span style={{ color: '#ff6b80' }}>No conf.</span>}
                        {e.copula === 'no_observado' && <span style={{ color: '#4a5f7a' }}>No obs.</span>}
                        {!e.copula && <span style={{ color: '#2a3a50' }}>—</span>}
                      </td>
                      <td className="px-3 py-2" style={{ color: '#4a5f7a' }}>
                        {e.espermatozoides === 'encontrados' && <span style={{ color: '#00e676', fontWeight: 700 }}>✓ Enc.</span>}
                        {e.espermatozoides === 'no_encontrados' && <span style={{ color: '#4a5f7a' }}>No enc.</span>}
                        {e.espermatozoides === 'dudoso' && <span style={{ color: '#ffd740' }}>Dud.</span>}
                        {!e.espermatozoides && <span style={{ color: '#2a3a50' }}>—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {e.fase ? (
                          <span style={{ fontWeight: 700, color: cfg?.color ?? '#8a9bb0' }}>
                            {e.fase}
                            {e.fase_confirmada && <span title="Fase confirmada manualmente" style={{ color: '#4a5f7a', marginLeft: 2 }}>*</span>}
                          </span>
                        ) : (
                          <span style={{ color: '#2a3a50' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => borrar(e.id)}
                          disabled={eliminando === e.id}
                          className="text-xs font-semibold"
                          style={{ color: '#ff6b80', opacity: eliminando === e.id ? 0.4 : 1 }}
                        >
                          {eliminando === e.id ? '...' : 'Borrar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {historial.length > 8 && (
            <button
              onClick={() => setVerTodo(!verTodo)}
              className="text-xs font-semibold mt-1"
              style={{ color: '#4a5f7a' }}
            >
              {verTodo ? '▲ Ver menos' : `▼ Ver todo (${historial.length} registros)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
