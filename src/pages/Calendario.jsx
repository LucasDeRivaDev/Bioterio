import { useState, useMemo, useEffect } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { generarEventosCalendario, parseDate, difDias, hoy } from '../utils/calculos'

const TIPOS = {
  nacimiento:       { label: 'Nacimiento',          color: '#00e676', bg: 'rgba(0,230,118,0.12)',   borde: 'rgba(0,230,118,0.3)'   },
  destete:          { label: 'Destete',             color: '#ffb300', bg: 'rgba(255,179,0,0.12)',   borde: 'rgba(255,179,0,0.3)'   },
  madurez:          { label: 'Madurez',             color: '#ce93d8', bg: 'rgba(206,147,216,0.12)', borde: 'rgba(206,147,216,0.3)' },
  parto_esperado:   { label: 'Parto esperado',      color: '#40c4ff', bg: 'rgba(64,196,255,0.12)',  borde: 'rgba(64,196,255,0.3)'  },
  separacion:       { label: 'Separación pareja',   color: '#4dd0e1', bg: 'rgba(77,208,225,0.10)',  borde: 'rgba(77,208,225,0.28)' },
  copula:           { label: 'Cópula',              color: '#8a9bb0', bg: 'rgba(138,155,176,0.08)', borde: 'rgba(138,155,176,0.2)' },
  plan_apareamiento:{ label: 'Apareamiento planif.',color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  borde: 'rgba(139,92,246,0.35)' },
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

// ── Helpers localStorage (mismo formato que Stock.jsx) ────────────────────────
function lsKey(bioId) { return `appMosca_apareamientos_${bioId}` }

function cargarPlanes(bioId) {
  try { return JSON.parse(localStorage.getItem(lsKey(bioId)) || '[]') }
  catch { return [] }
}

function guardarPlanes(bioId, planes) {
  localStorage.setItem(lsKey(bioId), JSON.stringify(planes))
}

function edadDias(fechaNac) {
  if (!fechaNac) return null
  return difDias(parseDate(fechaNac), parseDate(hoy()))
}

function formatEdadCorta(dias) {
  if (dias === null) return '—'
  if (dias < 30)  return `${dias}d`
  if (dias < 112) return `${Math.floor(dias / 7)}sem`
  return `${Math.floor(dias / 30)}m`
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Calendario() {
  const { camadas, animales, bio, bioterioActivo } = useBioterio()
  const hoyJs = new Date()
  const [anio, setAnio]       = useState(hoyJs.getFullYear())
  const [mes, setMes]         = useState(hoyJs.getMonth())
  const [diaSelec, setDiaSelec] = useState(null)
  const [planes, setPlanes]   = useState([])
  const [modalPlan, setModalPlan] = useState(false)

  const pad    = (n) => String(n).padStart(2, '0')
  const fStr   = (d) => `${anio}-${pad(mes + 1)}-${pad(d)}`
  const hoyStr = `${hoyJs.getFullYear()}-${pad(hoyJs.getMonth()+1)}-${pad(hoyJs.getDate())}`

  // Cargar planes del bioterio activo desde localStorage
  useEffect(() => {
    setPlanes(cargarPlanes(bioterioActivo).filter((p) => !p.completado))
  }, [bioterioActivo])

  const eventos = useMemo(() => generarEventosCalendario(camadas, animales, bio), [camadas, animales, bio])

  // Mapa fecha → eventos + planes
  const porFecha = useMemo(() => {
    const m = {}
    eventos.forEach((e) => { if (!m[e.fecha]) m[e.fecha] = []; m[e.fecha].push(e) })
    planes.forEach((p) => {
      const f = p.fecha_planificada
      if (!f) return
      if (!m[f]) m[f] = []
      m[f].push({
        id:     `plan-${p.id}`,
        tipo:   'plan_apareamiento',
        titulo: `Apareamiento: ${p.macho?.codigo ?? '?'} × ${p.hembra?.codigo ?? '?'}`,
        plan:   p,
      })
    })
    return m
  }, [eventos, planes])

  function navMes(d) {
    let nm = mes + d, na = anio
    if (nm < 0)  { nm = 11; na-- }
    if (nm > 11) { nm = 0;  na++ }
    setMes(nm); setAnio(na); setDiaSelec(null)
  }

  const totalDias = new Date(anio, mes + 1, 0).getDate()
  const primerDia = new Date(anio, mes, 1).getDay()
  const eventosDia = diaSelec ? (porFecha[fStr(diaSelec)] ?? []) : []

  // Guardar nuevo plan desde el modal
  function handleGuardarPlan({ macho, hembra, observaciones }) {
    const nuevoPlan = {
      id:               Date.now().toString(),
      bioterioActivo,
      fecha_planificada: fStr(diaSelec),
      observaciones:    observaciones || null,
      macho:  { bloqueId: `r-${macho.id}`,  tipo: 'reproductor', codigo: macho.codigo,  total: 1, edad: edadDias(macho.fecha_nacimiento)  },
      hembra: { bloqueId: `r-${hembra.id}`, tipo: 'reproductor', codigo: hembra.codigo, total: 1, edad: edadDias(hembra.fecha_nacimiento) },
      completado:  false,
      created_at:  new Date().toISOString(),
    }
    const todos = [...cargarPlanes(bioterioActivo), nuevoPlan]
    guardarPlanes(bioterioActivo, todos)
    setPlanes((prev) => [...prev, nuevoPlan])
    setModalPlan(false)
  }

  // Descartar un plan desde el panel lateral
  function descartarPlan(planId) {
    const todos    = cargarPlanes(bioterioActivo).filter((p) => p.id !== planId)
    guardarPlanes(bioterioActivo, todos)
    setPlanes((prev) => prev.filter((p) => p.id !== planId))
  }

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
        <h1 className="text-xl font-bold text-white">Calendario</h1>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TIPOS).map(([tipo, cfg]) => (
          <div key={tipo} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }} />
            <span className="text-xs font-medium" style={{ color: '#4a5f7a' }}>{cfg.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-5">

        {/* ── Grilla del calendario ── */}
        <div
          className="flex-1 rounded-2xl p-4 md:p-5"
          style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
        >
          {/* Navegación */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => navMes(-1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(30,51,82,0.5)', color: '#8a9bb0', border: '1px solid rgba(30,51,82,0.8)' }}
            >←</button>
            <h2 className="font-bold text-white tracking-wide">
              {MESES[mes]} <span className="font-mono" style={{ color: '#4a5f7a' }}>{anio}</span>
            </h2>
            <button
              onClick={() => navMes(1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(30,51,82,0.5)', color: '#8a9bb0', border: '1px solid rgba(30,51,82,0.8)' }}
            >→</button>
          </div>

          {/* Cabecera días */}
          <div className="grid grid-cols-7 mb-2">
            {DIAS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold uppercase tracking-widest py-1"
                style={{ color: '#4a5f7a' }}>{d}</div>
            ))}
          </div>

          {/* Días */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: primerDia }).map((_, i) => <div key={`v${i}`} />)}
            {Array.from({ length: totalDias }).map((_, i) => {
              const dia = i + 1
              const fs  = fStr(dia)
              const evs = porFecha[fs] ?? []
              const esHoy = fs === hoyStr
              const esSel = diaSelec === dia
              const tienePlan = evs.some((e) => e.tipo === 'plan_apareamiento')

              return (
                <button
                  key={dia}
                  onClick={() => setDiaSelec(esSel ? null : dia)}
                  className="rounded-xl flex flex-col items-center py-1 px-0.5 min-h-[44px] md:min-h-[52px] transition-all"
                  style={
                    esSel
                      ? { background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.4)' }
                      : esHoy
                      ? { background: 'rgba(64,196,255,0.08)', border: '1.5px solid rgba(64,196,255,0.3)' }
                      : tienePlan
                      ? { background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)' }
                      : { background: 'transparent', border: '1px solid transparent' }
                  }
                >
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: esSel ? '#00e676' : esHoy ? '#40c4ff' : '#8a9bb0' }}
                  >
                    {dia}
                  </span>
                  {evs.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                      {evs.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background:  TIPOS[e.tipo]?.color ?? '#8a9bb0',
                            boxShadow: `0 0 3px ${TIPOS[e.tipo]?.color ?? '#8a9bb0'}`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Panel lateral ── */}
        <div
          className="w-full md:w-72 rounded-2xl p-4 h-fit space-y-3"
          style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
        >
          {diaSelec ? (
            <>
              <div className="font-bold text-white font-mono">
                {pad(diaSelec)}/{pad(mes+1)}/{anio}
              </div>

              {/* Botón planificar apareamiento */}
              <button
                onClick={() => setModalPlan(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: 'rgba(139,92,246,0.12)',
                  border:     '1.5px solid rgba(139,92,246,0.35)',
                  color:      '#a78bfa',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)' }}
              >
                🔗 Planificar apareamiento
              </button>

              {/* Eventos y planes del día */}
              {eventosDia.length === 0 ? (
                <p className="text-sm" style={{ color: '#4a5f7a' }}>Sin eventos este día</p>
              ) : (
                <div className="space-y-2">
                  {eventosDia.map((ev) => {
                    const t = TIPOS[ev.tipo] ?? TIPOS.copula
                    if (ev.tipo === 'plan_apareamiento') {
                      return (
                        <div
                          key={ev.id}
                          className="rounded-xl px-3 py-2.5"
                          style={{ background: t.bg, border: `1px solid ${t.borde}` }}
                        >
                          <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: t.color, opacity: 0.7 }}>
                            {t.label}
                          </div>
                          <div className="text-sm font-medium mb-1" style={{ color: t.color }}>{ev.titulo}</div>
                          {ev.plan?.observaciones && (
                            <div className="text-xs font-mono mb-1.5" style={{ color: '#6a8099' }}>
                              {ev.plan.observaciones}
                            </div>
                          )}
                          <button
                            onClick={() => descartarPlan(ev.plan.id)}
                            className="text-xs font-mono px-2 py-1 rounded-lg"
                            style={{ background: 'rgba(255,61,87,0.08)', color: '#ff6b80', border: '1px solid rgba(255,61,87,0.2)' }}
                          >
                            ✕ Descartar
                          </button>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={ev.id}
                        className="rounded-xl px-3 py-2.5"
                        style={{ background: t.bg, border: `1px solid ${t.borde}` }}
                      >
                        <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: t.color, opacity: 0.7 }}>
                          {t.label}
                        </div>
                        <div className="text-sm font-medium" style={{ color: t.color }}>{ev.titulo}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-bold text-white text-sm uppercase tracking-widest">
                Eventos del mes
              </div>
              {(() => {
                const prefijo = `${anio}-${pad(mes+1)}`
                const del_mes = Object.entries(porFecha)
                  .filter(([f]) => f.startsWith(prefijo))
                  .sort(([a],[b]) => a.localeCompare(b))
                if (del_mes.length === 0)
                  return <p className="text-sm" style={{ color: '#4a5f7a' }}>Sin eventos este mes</p>
                return (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {del_mes.map(([fecha, evs]) => evs.map((e) => {
                      const t = TIPOS[e.tipo] ?? TIPOS.copula
                      return (
                        <div key={e.id} className="rounded-xl px-3 py-2" style={{ background: t.bg, border: `1px solid ${t.borde}` }}>
                          <div className="text-xs font-mono" style={{ color: t.color, opacity: 0.6 }}>
                            Día {parseInt(fecha.split('-')[2])}
                          </div>
                          <div className="text-xs font-semibold" style={{ color: t.color }}>{e.titulo}</div>
                        </div>
                      )
                    }))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {/* Modal planificar apareamiento */}
      {modalPlan && (
        <ModalPlanificarApareamiento
          animales={animales}
          fecha={fStr(diaSelec)}
          onGuardar={handleGuardarPlan}
          onCerrar={() => setModalPlan(false)}
        />
      )}
    </div>
  )
}

// ── Modal de planificación ────────────────────────────────────────────────────

function ModalPlanificarApareamiento({ animales, fecha, onGuardar, onCerrar }) {
  const machos  = animales.filter((a) => a.sexo === 'macho'  && a.estado === 'activo')
  const hembras = animales.filter((a) => a.sexo === 'hembra' && a.estado === 'activo')

  const [machoSel,       setMachoSel]       = useState(null)
  const [hembraSel,      setHembraSel]      = useState(null)
  const [observaciones,  setObservaciones]  = useState('')

  const puedeGuardar = machoSel && hembraSel

  const [d, m, y] = fecha.split('-').reverse()
  const fechaLabel = `${d}/${m}/${y}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background:  'rgba(13,21,40,0.98)',
          border:      '1.5px solid rgba(139,92,246,0.35)',
          boxShadow:   '0 0 60px rgba(139,92,246,0.12)',
          maxHeight:   '88vh',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 shrink-0"
          style={{ borderBottom: '1px solid rgba(139,92,246,0.15)', background: 'rgba(139,92,246,0.06)' }}
        >
          <div className="font-bold text-white text-sm">🔗 Planificar apareamiento</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Fecha programada: <span style={{ color: '#a78bfa' }}>{fechaLabel}</span>
            {' '}· Solo animales activos disponibles
          </div>
        </div>

        {/* Cuerpo — dos columnas */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-0 divide-x" style={{ borderColor: 'rgba(30,51,82,0.5)' }}>

            {/* Machos */}
            <div className="p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#40c4ff' }}>
                ♂ Macho
              </div>
              {machos.length === 0 ? (
                <div className="text-xs font-mono py-4 text-center" style={{ color: '#3d5068' }}>
                  Sin machos activos
                </div>
              ) : machos.map((a) => {
                const sel  = machoSel?.id === a.id
                const edad = formatEdadCorta(edadDias(a.fecha_nacimiento))
                return (
                  <button
                    key={a.id}
                    onClick={() => setMachoSel(sel ? null : a)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: sel ? 'rgba(64,196,255,0.14)' : 'rgba(255,255,255,0.02)',
                      border:    `1.5px solid ${sel ? 'rgba(64,196,255,0.5)' : 'rgba(30,51,82,0.5)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: sel ? '#40c4ff' : 'rgba(30,51,82,0.8)', background: sel ? '#40c4ff' : 'transparent' }}
                      >
                        {sel && <span style={{ color: '#050810', fontSize: '8px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                      <span className="font-bold font-mono text-xs text-white">{a.codigo}</span>
                    </div>
                    <div className="text-xs font-mono mt-0.5 ml-5.5" style={{ color: '#4a5f7a' }}>{edad}</div>
                  </button>
                )
              })}
            </div>

            {/* Hembras */}
            <div className="p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#ce93d8' }}>
                ♀ Hembra
              </div>
              {hembras.length === 0 ? (
                <div className="text-xs font-mono py-4 text-center" style={{ color: '#3d5068' }}>
                  Sin hembras activas
                </div>
              ) : hembras.map((a) => {
                const sel  = hembraSel?.id === a.id
                const edad = formatEdadCorta(edadDias(a.fecha_nacimiento))
                return (
                  <button
                    key={a.id}
                    onClick={() => setHembraSel(sel ? null : a)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: sel ? 'rgba(206,147,216,0.14)' : 'rgba(255,255,255,0.02)',
                      border:    `1.5px solid ${sel ? 'rgba(206,147,216,0.5)' : 'rgba(30,51,82,0.5)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: sel ? '#ce93d8' : 'rgba(30,51,82,0.8)', background: sel ? '#ce93d8' : 'transparent' }}
                      >
                        {sel && <span style={{ color: '#050810', fontSize: '8px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                      <span className="font-bold font-mono text-xs text-white">{a.codigo}</span>
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>{edad}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resumen selección */}
          {(machoSel || hembraSel) && (
            <div
              className="mx-4 mb-2 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-mono"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}
            >
              <span style={{ color: '#40c4ff' }}>♂ {machoSel?.codigo ?? '—'}</span>
              <span style={{ color: '#4a5f7a' }}>×</span>
              <span style={{ color: '#ce93d8' }}>♀ {hembraSel?.codigo ?? '—'}</span>
            </div>
          )}

          {/* Observaciones */}
          <div className="px-4 pb-4">
            <input
              type="text"
              placeholder="Observaciones (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-mono focus:outline-none rounded-xl"
              style={{
                background: 'rgba(8,13,26,0.8)',
                border:     '1px solid rgba(30,51,82,0.8)',
                color:      '#c9d4e0',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center gap-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl text-sm font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => puedeGuardar && onGuardar({ macho: machoSel, hembra: hembraSel, observaciones })}
            disabled={!puedeGuardar}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: puedeGuardar ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.04)',
              border:    `1.5px solid ${puedeGuardar ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color:      puedeGuardar ? '#a78bfa' : '#3d5068',
              cursor:     puedeGuardar ? 'pointer' : 'not-allowed',
            }}
          >
            Guardar planificación
          </button>
        </div>
      </div>
    </div>
  )
}
