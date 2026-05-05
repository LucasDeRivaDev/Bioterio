import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { generarEventosCalendario, parseDate } from '../utils/calculos'

const TIPOS = {
  nacimiento:    { label: 'Nacimiento',      color: '#00e676', bg: 'rgba(0,230,118,0.12)',   borde: 'rgba(0,230,118,0.3)'   },
  destete:       { label: 'Destete',          color: '#ffb300', bg: 'rgba(255,179,0,0.12)',   borde: 'rgba(255,179,0,0.3)'   },
  madurez:       { label: 'Madurez',          color: '#ce93d8', bg: 'rgba(206,147,216,0.12)', borde: 'rgba(206,147,216,0.3)' },
  parto_esperado:{ label: 'Parto esperado',   color: '#40c4ff', bg: 'rgba(64,196,255,0.12)',  borde: 'rgba(64,196,255,0.3)'  },
  separacion:    { label: 'Separación pareja',color: '#4dd0e1', bg: 'rgba(77,208,225,0.10)',  borde: 'rgba(77,208,225,0.28)' },
  copula:        { label: 'Cópula',           color: '#8a9bb0', bg: 'rgba(138,155,176,0.08)', borde: 'rgba(138,155,176,0.2)' },
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

export default function Calendario() {
  const { camadas, animales, bio } = useBioterio()
  const hoyJs = new Date()
  const [anio, setAnio] = useState(hoyJs.getFullYear())
  const [mes, setMes] = useState(hoyJs.getMonth())
  const [diaSelec, setDiaSelec] = useState(null)

  const eventos = useMemo(() => generarEventosCalendario(camadas, animales, bio), [camadas, animales, bio])

  const porFecha = useMemo(() => {
    const m = {}
    eventos.forEach((e) => { if (!m[e.fecha]) m[e.fecha] = []; m[e.fecha].push(e) })
    return m
  }, [eventos])

  function navMes(d) {
    let nm = mes + d, na = anio
    if (nm < 0) { nm = 11; na-- }
    if (nm > 11) { nm = 0; na++ }
    setMes(nm); setAnio(na); setDiaSelec(null)
  }

  const totalDias = new Date(anio, mes + 1, 0).getDate()
  const primerDia = new Date(anio, mes, 1).getDay()
  const pad = (n) => String(n).padStart(2, '0')
  const fStr = (d) => `${anio}-${pad(mes + 1)}-${pad(d)}`
  const hoyStr = `${hoyJs.getFullYear()}-${pad(hoyJs.getMonth()+1)}-${pad(hoyJs.getDate())}`

  const eventosDia = diaSelec ? (porFecha[fStr(diaSelec)] ?? []) : []

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
        {/* Grilla del calendario */}
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
              const fs = fStr(dia)
              const evs = porFecha[fs] ?? []
              const esHoy = fs === hoyStr
              const esSel = diaSelec === dia

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
                      : { background: 'transparent', border: '1px solid transparent' }
                  }
                >
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{
                      color: esSel ? '#00e676' : esHoy ? '#40c4ff' : '#8a9bb0',
                    }}
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
                            background: TIPOS[e.tipo]?.color ?? '#8a9bb0',
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

        {/* Panel lateral */}
        <div
          className="w-full md:w-72 rounded-2xl p-4 h-fit"
          style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
        >
          {diaSelec ? (
            <>
              <div className="font-bold text-white mb-3 font-mono">
                {pad(diaSelec)}/{pad(mes+1)}/{anio}
              </div>
              {eventosDia.length === 0 ? (
                <p className="text-sm" style={{ color: '#4a5f7a' }}>Sin eventos este día</p>
              ) : (
                <div className="space-y-2">
                  {eventosDia.map((ev) => {
                    const t = TIPOS[ev.tipo] ?? TIPOS.copula
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
              <div className="font-bold text-white mb-3 text-sm uppercase tracking-widest">
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
    </div>
  )
}
