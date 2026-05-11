import React, { useState, useMemo, useEffect } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { supabase } from '../lib/supabase'
import { formatFecha, difDias, parseDate, hoy, calcularPerfilHembra, calcularConfiabilidadHembra, calcularRendimientoMacho, detectarBajaPerformanceMacho, getAnimalesReservados } from '../utils/calculos'
import { MAX_APAREAMIENTOS, MACHO_EDAD_LIMITE_DIAS, MACHO_EDAD_ALERTA_DIAS } from '../utils/constants'
import Modal from '../components/Modal'
import AnimalForm from '../components/AnimalForm'
import Badge from '../components/Badge'
import CicloEstral from '../components/CicloEstral'
import Camadas from '../pages/Camadas'

const colorEstado = { activo:'verde', en_apareamiento:'azul', en_cria:'violeta', retirado:'gris', fallecido:'rojo' }
const labelEstado = { activo:'Activo', en_apareamiento:'En apareamiento', en_cria:'En cría', retirado:'Retirado', fallecido:'Fallecido' }

const cardStyle = {
  background: 'rgba(13,21,40,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
}

// Labels de colonia para mostrar el origen de animales exportados
const LABEL_COLONIA = {
  ratones_balbc: 'BAL/C',
  ratones_c57:   'C57',
}

export default function Animales() {
  const {
    animales, animalesExportados, camadas,
    agregarAnimal, editarAnimal, eliminarAnimal,
    exportarAHibridos, devolverDeHibridos,
    bioterioActivo,
  } = useBioterio()

  const esHibridos = bioterioActivo === 'ratones_hibridos'

  const [modal,            setModal]            = useState(null)
  const [expandido,        setExpandido]        = useState(null)
  const [filtroSexo,       setFiltroSexo]       = useState('todos')
  const [filtroEstado,     setFiltroEstado]     = useState('todos')
  const [busqueda,         setBusqueda]         = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [subVista,         setSubVista]         = useState(null)
  const [modalExportar,    setModalExportar]    = useState(false)
  const hoyStr = hoy()

  // Mapa de animales con apareamiento planificado futuro
  const animalesReservados = useMemo(
    () => getAnimalesReservados(bioterioActivo),
    [bioterioActivo, animales] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const filtrados = useMemo(() => {
    return animales.filter((a) => {
      if (filtroSexo !== 'todos' && a.sexo !== filtroSexo) return false
      if (filtroEstado !== 'todos' && a.estado !== filtroEstado) return false
      if (busqueda && !a.codigo.toLowerCase().includes(busqueda.toLowerCase())) return false
      return true
    })
  }, [animales, filtroSexo, filtroEstado, busqueda])

  function calcularEdad(fechaNac) {
    if (!fechaNac) return '—'
    const dias = difDias(parseDate(fechaNac), parseDate(hoyStr))
    if (dias < 0) return '—'
    if (dias < 30) return `${dias}d`
    if (dias < 112) return `${Math.floor(dias / 7)}sem`
    return `${Math.floor(dias / 30)}m`
  }

  function contarCamadas(id) {
    return camadas.filter((c) => c.id_madre === id || c.id_padre === id).length
  }

  function nombreAnimal(id) {
    return animales.find((a) => a.id === id)?.codigo ?? '—'
  }

  const colorConfiabilidad = { ok: '#00e676', leve: '#ffd740', moderada: '#ff9100', critica: '#ff1744' }
  const labelConfiabilidad = { ok: 'OK', leve: 'Leve', moderada: 'Moderada', critica: 'Crítica' }

  const btnSubTab = (v, label, color) => (
    <button
      onClick={() => setSubVista(v === subVista ? null : v)}
      className="px-4 py-2 rounded-2xl text-3xs font-bold transition-all"
      style={
        subVista === v
          ? { background: `${color}18`, border: `1px solid ${color}50`, color }
          : { background: 'transparent', border: `1px solid rgba(30,51,82,0.6)`, color: '#4a5f7a' }
      }
    >
      {label}
    </button>
  )

  if (subVista === 'emparejamientos') {
    return (
      <div className="p-4 md:p-6 space-y-5 min-0" style={{ background: '#050810' }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
          <h1 className="text-2xl font-bold text-white">Reproductores</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {btnSubTab('emparejamientos', '🔄 Emparejamientos', '#00e676')}
          <button
            onClick={() => setSubVista(null)}
            className="px-4 py-2 rounded-2xl text-3xs font-bold"
            style={{ background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }}
          >
            ← Volver a Reproductores
          </button>
        </div>
        <Camadas />
      </div>
    )
  }

  function ScoreBarra({ label, valor, max = 10 }) {
    if (valor == null) return (
      <div className="flex items-center gap-2">
        <span className="text-xs w-32" style={{ color: '#4a5f7a' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>—</span>
      </div>
    )
    const pct = Math.min((valor / max) * 100, 100)
    const color = valor >= 8 ? '#00e676' : valor >= 6 ? '#ffd740' : '#ff6b80'
    const esCritico = valor === 0
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs w-32" style={{ color: '#8a9bb0' }}>{label}</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(30,51,82,0.8)', minWidth: 60 }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs font-mono font-bold w-8 text-right" style={{ color }}>{valor}</span>
        {esCritico && (
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#ff1744' }}>CRÍTICO</span>
        )}
      </div>
    )
  }

  function PerfilAnimal({ animal }) {
    if (animal.sexo === 'hembra') {
      const totalApareaminetos = camadas.filter((c) => c.id_madre === animal.id).length
      const finCiclo = totalApareaminetos >= MAX_APAREAMIENTOS
      const perfil = calcularPerfilHembra(animal.id, camadas)
      const conf   = calcularConfiabilidadHembra(animal.id, camadas)
      if (!perfil) return (
        <div className="space-y-2">
          {finCiclo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.3)', color: '#ff6b80' }}>
              🔚 Fin de ciclo reproductivo — {totalApareaminetos} apareamientos completados. Recomendada para sacrificio.
            </div>
          )}
          <div className="text-xs py-2" style={{ color: '#4a5f7a' }}>Sin camadas con parto registrado</div>
        </div>
      )
      return (
        <div className="space-y-2">
          {/* Badge fin de ciclo */}
          {finCiclo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.3)', color: '#ff6b80' }}>
              🔚 Fin de ciclo reproductivo — {totalApareaminetos} apareamientos completados. Recomendada para sacrificio.
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold" style={{ color: '#8a9bb0' }}>{perfil.total_camadas} camada{perfil.total_camadas !== 1 ? 's' : ''} analizadas</span>
            {conf && conf.nivel !== 'ok' && (
              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${colorConfiabilidad[conf.nivel]}18`, color: colorConfiabilidad[conf.nivel], border: `1px solid ${colorConfiabilidad[conf.nivel]}40` }}>
                ⚠ {labelConfiabilidad[conf.nivel]} — {conf.mensaje}
              </span>
            )}
            {conf && conf.nivel === 'ok' && (
              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(0,230,118,0.08)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}>
                ✓ Confiabilidad OK
              </span>
            )}
          </div>
          <ScoreBarra label="Velocidad fertiliz." valor={perfil.avg_time_score} />
          <ScoreBarra label="Tamaño camada" valor={perfil.avg_litter_size_score} />
          <ScoreBarra label="Proporción sexual" valor={perfil.avg_sex_ratio_score} />
          <ScoreBarra label="Supervivencia" valor={perfil.avg_survival_score} />
        </div>
      )
    } else {
      const rend     = calcularRendimientoMacho(animal.id, camadas)
      const bajaPerf = detectarBajaPerformanceMacho(animal.id, camadas)
      if (rend.total_camadas === 0) return (
        <div className="text-xs py-2" style={{ color: '#4a5f7a' }}>Sin camadas con parto registrado</div>
      )
      return (
        <div className="space-y-2">
          {/* Alerta de baja performance */}
          {bajaPerf && (
            <div
              className="rounded-xl px-4 py-2.5 flex items-start gap-2"
              style={{ background: 'rgba(255,215,64,0.07)', border: '1px solid rgba(255,215,64,0.25)' }}
            >
              <span style={{ color: '#ffd740', flexShrink: 0 }}>⚠</span>
              <div>
                <div className="text-xs font-bold" style={{ color: '#ffd740' }}>
                  Posible baja de fertilidad — Evaluar reemplazo
                </div>
                <div className="text-xs mt-0.5 opacity-75" style={{ color: '#ffd740' }}>
                  {bajaPerf.tipo === 'ambos'
                    ? `Latencia y tamaño de camada en declive (últimas ${bajaPerf.n} camadas)`
                    : bajaPerf.tipo === 'latencia'
                      ? `Latencia en aumento: últimas ${bajaPerf.n} → ${bajaPerf.avgLatUltimas}d · previas → ${bajaPerf.avgLatPrevias}d`
                      : `Tamaño cayendo: últimas ${bajaPerf.n} → ${bajaPerf.avgTUltimas} crías · previas → ${bajaPerf.avgTPrevias}`
                  }
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold" style={{ color: '#8a9bb0' }}>{rend.total_camadas} camada{rend.total_camadas !== 1 ? 's' : ''} analizadas</span>
            {rend.promedio_latencia != null && (
              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Latencia prom: <span className="font-bold text-white">{rend.promedio_latencia}d</span></span>
            )}
          </div>
          <ScoreBarra label="Score fertilización" valor={rend.score_promedio} />
        </div>
      )
    }
  }

  function guardar(datos) {
    if (modal === 'nuevo') agregarAnimal(datos)
    else editarAnimal({ ...datos, id: modal.id })
    setModal(null)
  }

  function FiltroBtn({ activo, onClick, children }) {
    return (
      <button
        onClick={onClick}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={
          activo
            ? { background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }
            : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
        }
      >
        {children}
      </button>
    )
  }

return (
    <div className="p-4 md:p-6 space-y-5 min-0" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Reproductores</h1>
            <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{animales.length} registros</p>
          </div>
        </div>
        <button
          onClick={() => setModal('nuevo')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: 'rgba(0,230,118,0.12)',
            border: '1.5px solid rgba(0,230,118,0.35)',
            color: '#00e676',
            boxShadow: '0 0 16px rgba(0,230,118,0.08)',
          }}
        >
          + Agregar reproductor
        </button>
      </div>

      {/* ── TABS DE SUB-SECCIÓN ──────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {btnSubTab('emparejamientos', '🔄 Emparejamientos', '#00e676')}
      </div>

      {/* ── SECCIÓN HÍBRIDOS: reproductores compartidos ── */}
      {esHibridos && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(13,21,40,0.85)', border: '1.5px solid rgba(139,92,246,0.3)', boxShadow: '0 0 30px rgba(139,92,246,0.05)' }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center gap-3"
            style={{ borderBottom: '1px solid rgba(139,92,246,0.15)', background: 'rgba(139,92,246,0.06)' }}
          >
            <span className="text-lg">🧬</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-white">Reproductores compartidos desde otras colonias</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                Machos BAL/C × Hembras C57 para producir F1 · Las crías híbridas no pueden ser promovidas a reproductores
              </div>
            </div>
            <button
              onClick={() => setModalExportar(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0"
              style={{ background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.14)' }}
            >
              + Exportar reproductor
            </button>
          </div>

          {/* Lista de exportados */}
          {animalesExportados.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-2xl mb-2">🔬</div>
              <div className="text-sm font-mono" style={{ color: '#3d5068' }}>
                Sin reproductores compartidos todavía.
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: '#2a3a50' }}>
                Usá "+ Exportar reproductor" para traer machos BAL/C o hembras C57.
              </div>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(139,92,246,0.1)' }}>
              {animalesExportados.map((a) => {
                const colonia   = LABEL_COLONIA[a.bioterio_id] ?? a.bioterio_id
                const colorCol  = a.bioterio_id === 'ratones_balbc' ? '#40c4ff' : '#ce93d8'
                const edad      = calcularEdad(a.fecha_nacimiento)
                const perfil    = a.sexo === 'hembra'
                  ? calcularPerfilHembra(a.id, camadas)
                  : calcularRendimientoMacho(a.id, camadas)
                const scoreVal  = a.sexo === 'hembra'
                  ? perfil?.avg_time_score
                  : perfil?.score_promedio

                return (
                  <div
                    key={a.id}
                    className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
                  >
                    {/* Sexo */}
                    <span
                      className="text-xs font-bold font-mono px-2 py-0.5 rounded-full"
                      style={{
                        background: a.sexo === 'macho' ? 'rgba(64,196,255,0.1)' : 'rgba(206,147,216,0.1)',
                        border:     `1px solid ${a.sexo === 'macho' ? 'rgba(64,196,255,0.3)' : 'rgba(206,147,216,0.3)'}`,
                        color:      a.sexo === 'macho' ? '#40c4ff' : '#ce93d8',
                      }}
                    >
                      {a.sexo === 'macho' ? '♂' : '♀'}
                    </span>

                    {/* Código + colonia */}
                    <div>
                      <span className="font-bold text-sm text-white">{a.codigo}</span>
                      <span
                        className="ml-1.5 text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${colorCol}18`, color: colorCol, border: `1px solid ${colorCol}35` }}
                      >
                        {colonia}
                      </span>
                    </div>

                    {/* Edad */}
                    <span className="text-xs font-mono" style={{ color: '#6a8099' }}>{edad}</span>

                    {/* Estado */}
                    <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{labelEstado[a.estado] ?? a.estado}</span>

                    {/* Score */}
                    {scoreVal != null && (
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{
                          background: scoreVal >= 8 ? 'rgba(0,230,118,0.08)' : scoreVal >= 6 ? 'rgba(255,215,64,0.08)' : 'rgba(255,107,128,0.08)',
                          color:      scoreVal >= 8 ? '#00e676'              : scoreVal >= 6 ? '#ffd740'              : '#ff6b80',
                        }}
                      >
                        Score {scoreVal}
                      </span>
                    )}

                    {/* Botón devolver */}
                    <button
                      onClick={() => devolverDeHibridos(a.id)}
                      className="ml-auto text-xs font-mono px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,61,87,0.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,61,87,0.06)' }}
                      title="Devolver a su colonia original"
                    >
                      ↩ Devolver
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl" style={cardStyle}>
        <input
          type="text"
          placeholder="Buscar código..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="px-3 py-1.5 text-sm focus:outline-none rounded-lg font-mono"
          style={{
            background: 'rgba(8,13,26,0.8)',
            border: '1px solid rgba(30,51,82,0.8)',
            color: '#c9d4e0',
          }}
        />
        <div className="flex gap-1.5">
          <FiltroBtn activo={filtroSexo === 'todos'} onClick={() => setFiltroSexo('todos')}>Todos</FiltroBtn>
          <FiltroBtn activo={filtroSexo === 'hembra'} onClick={() => setFiltroSexo('hembra')}>♀ Hembras</FiltroBtn>
          <FiltroBtn activo={filtroSexo === 'macho'} onClick={() => setFiltroSexo('macho')}>♂ Machos</FiltroBtn>
        </div>
        <div className="flex gap-1.5">
          {['todos','activo','en_cria','retirado'].map((e) => (
            <FiltroBtn key={e} activo={filtroEstado === e} onClick={() => setFiltroEstado(e)}>
              {e === 'todos' ? 'Todos' : labelEstado[e]}
            </FiltroBtn>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#4a5f7a' }}>
          <div className="text-4xl mb-3">🔬</div>
          <div className="text-sm">No se encontraron reproductores</div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
          <table className="w-full text-sm table-lab" style={{ minWidth: '560px' }}>
            <thead>
              <tr>
                {['Código','Sexo','Nacimiento','Edad','Progenitores','Emparejamientos','Estado',''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: '#4a5f7a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((animal) => (
                <React.Fragment key={animal.id}>
                  <tr
                    style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}
                    className="transition-colors hover:bg-white/[0.01]"
                  >
                    <td className="px-4 py-3 font-mono font-bold">
                      <span style={{ color: animal.notas && animal.nota_tipo === 'critica' ? '#ff6b80' : '#c9d4e0' }}>
                        {animal.codigo}
                      </span>
                      {animal.notas && (
                        <span
                          title={animal.notas}
                          style={{ color: animal.nota_tipo === 'critica' ? '#ff1744' : '#ffb300', marginLeft: '5px', cursor: 'help' }}
                        >⚠</span>
                      )}
                      {/* Badge: animal compartido con Híbridos */}
                      {animal.exportado_hibridos && (
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)', fontSize: '10px' }}
                          title="Compartido con Bioterio de Híbridos"
                        >
                          🧬 Híbridos
                        </span>
                      )}
                      {/* Badge: reservado para apareamiento planificado */}
                      {animalesReservados.has(animal.id) && (() => {
                        const r = animalesReservados.get(animal.id)
                        const [, m, d] = r.fecha.split('-')
                        return (
                          <span
                            className="ml-2 text-xs px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)', fontSize: '10px' }}
                            title={`Reservado para apareamiento planificado el ${d}/${m}`}
                          >
                            🗓 Reservado · {d}/{m}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 font-medium text-xs">
                      <span style={{ color: animal.sexo === 'hembra' ? '#ce93d8' : '#40c4ff' }}>
                        {animal.sexo === 'hembra' ? '♀ Hembra' : '♂ Macho'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8a9bb0' }}>
                      {formatFecha(animal.fecha_nacimiento)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {(() => {
                        const edad = calcularEdad(animal.fecha_nacimiento)
                        if (animal.sexo === 'macho' && animal.fecha_nacimiento) {
                          const dias = difDias(parseDate(animal.fecha_nacimiento), parseDate(hoyStr))
                          if (dias >= MACHO_EDAD_LIMITE_DIAS) return (
                            <span
                              className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.35)', color: '#ff6b80', fontSize: '10px' }}
                            >
                              ⚠ Edad avanzada · {edad}
                            </span>
                          )
                          if (dias >= MACHO_EDAD_ALERTA_DIAS) return (
                            <span
                              className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,145,0,0.12)', border: '1px solid rgba(255,145,0,0.3)', color: '#ff9100', fontSize: '10px' }}
                            >
                              ⚠ Próx. límite · {edad}
                            </span>
                          )
                        }
                        return <span style={{ color: '#4a5f7a' }}>{edad}</span>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#4a5f7a' }}>
                      {animal.id_madre || animal.id_padre ? (
                        <span className="font-mono">
                          {animal.id_madre ? nombreAnimal(animal.id_madre) : '?'} ×{' '}
                          {animal.id_padre ? nombreAnimal(animal.id_padre) : '?'}
                        </span>
                      ) : <span style={{ color: 'rgba(74,95,122,0.3)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold" style={{ color: '#8a9bb0' }}>
                      {contarCamadas(animal.id)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={colorEstado[animal.estado] ?? 'gris'}>
                        {labelEstado[animal.estado] ?? animal.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setExpandido(expandido === animal.id ? null : animal.id)}
                        className="text-xs font-semibold mr-3 transition-colors"
                        style={{ color: expandido === animal.id ? '#ffd740' : '#8a9bb0' }}
                      >{expandido === animal.id ? '▲ Perfil' : '▼ Perfil'}</button>
                      <button
                        onClick={() => setModal(animal)}
                        className="text-xs font-semibold mr-3 transition-colors"
                        style={{ color: '#40c4ff' }}
                      >Editar</button>
                      <button
                        onClick={() => setConfirmarEliminar(animal)}
                        className="text-xs font-semibold transition-colors"
                        style={{ color: '#ff6b80' }}
                      >Eliminar</button>
                    </td>
                  </tr>
                  {expandido === animal.id && (
                    <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.4)', background: 'rgba(8,13,26,0.6)' }}>
                      <td colSpan={8} className="px-6 py-4 space-y-4">
                        {/* Nota del animal */}
                        {animal.notas && (
                          <div
                            className="rounded-xl px-4 py-3 flex items-start gap-3"
                            style={{
                              background: animal.nota_tipo === 'critica' ? 'rgba(255,23,68,0.07)' : 'rgba(255,179,0,0.06)',
                              border: animal.nota_tipo === 'critica' ? '1px solid rgba(255,23,68,0.35)' : '1px solid rgba(255,179,0,0.25)',
                            }}
                          >
                            <span style={{ color: animal.nota_tipo === 'critica' ? '#ff1744' : '#ffb300', fontSize: '16px' }}>⚠</span>
                            <div>
                              <div className="text-xs font-bold uppercase tracking-widest mb-1"
                                style={{ color: animal.nota_tipo === 'critica' ? '#ff1744' : '#ffb300' }}>
                                {animal.nota_tipo === 'critica' ? 'Observación crítica' : 'Observación'}
                              </div>
                              <div className="text-sm leading-relaxed" style={{ color: '#c9d4e0' }}>{animal.notas}</div>
                            </div>
                          </div>
                        )}
                        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#ffd740' }}>
                          Perfil reproductivo — {animal.codigo}
                        </div>
                        <PerfilAnimal animal={animal} />
                        {animal.sexo === 'hembra' && (
                          <CicloEstral animal={animal} />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {modal && (
        <Modal titulo={modal === 'nuevo' ? 'Registrar reproductor' : `Editar ${modal.codigo}`} onCerrar={() => setModal(null)}>
          <AnimalForm animal={modal === 'nuevo' ? null : modal} onGuardar={guardar} onCancelar={() => setModal(null)} />
        </Modal>
      )}

      {confirmarEliminar && (
        <Modal titulo="Eliminar reproductor" onCerrar={() => setConfirmarEliminar(null)} ancho="max-w-sm">
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <p style={{ color: '#8a9bb0' }}>
              ¿Eliminás a{' '}
              <span className="font-mono font-bold text-white">{confirmarEliminar.codigo}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarEliminar(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}
              >Cancelar</button>
              <button
                onClick={() => { eliminarAnimal(confirmarEliminar.id); setConfirmarEliminar(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.35)', color: '#ff6b80' }}
              >Eliminar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal exportar reproductor a Híbridos */}
      {modalExportar && (
        <ModalExportarReproductor
          animalesYaExportados={animalesExportados}
          onExportar={(animal) => { exportarAHibridos(animal); setModalExportar(false) }}
          onCerrar={() => setModalExportar(false)}
        />
      )}
    </div>
  )
}

// ── Modal para exportar reproductores a Híbridos ──────────────────────────────

function ModalExportarReproductor({ animalesYaExportados, onExportar, onCerrar }) {
  const [origen,    setOrigen]    = useState('ratones_balbc')
  const [animales,  setAnimales]  = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [seleccionado, setSelec]  = useState(null)

  const idsYaExportados = new Set(animalesYaExportados.map((a) => a.id))

  useEffect(() => {
    setSelec(null)
    cargar()
  }, [origen])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('animales')
      .select('*')
      .eq('bioterio_id', origen)
      .in('estado', ['activo', 'en_cria'])
      .order('fecha_nacimiento', { ascending: true })
    setAnimales(data ?? [])
    setCargando(false)
  }

  const disponibles = animales.filter((a) => !idsYaExportados.has(a.id))

  const colorOrigen = origen === 'ratones_balbc' ? '#40c4ff' : '#ce93d8'
  const labelOrigen = origen === 'ratones_balbc' ? 'BAL/C' : 'C57'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1.5px solid rgba(139,92,246,0.3)', boxShadow: '0 0 60px rgba(139,92,246,0.12)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 shrink-0"
          style={{ borderBottom: '1px solid rgba(139,92,246,0.15)', background: 'rgba(139,92,246,0.06)' }}
        >
          <div className="font-bold text-white text-sm">🧬 Exportar reproductor a Híbridos</div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            Seleccioná un animal de BAL/C o C57 para usarlo en Híbridos. El animal sigue perteneciendo a su colonia original.
          </div>
        </div>

        {/* Selector de colonia origen */}
        <div
          className="px-6 py-4 flex gap-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {[
            { id: 'ratones_balbc', label: 'Machos BAL/C',   color: '#40c4ff', nota: 'Típicamente los machos' },
            { id: 'ratones_c57',   label: 'Hembras C57',    color: '#ce93d8', nota: 'Típicamente las hembras' },
          ].map(({ id, label, color, nota }) => (
            <button
              key={id}
              onClick={() => setOrigen(id)}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-left transition-all"
              style={{
                background: origen === id ? `${color}14` : 'rgba(255,255,255,0.02)',
                border:     `1.5px solid ${origen === id ? color + '55' : 'rgba(30,51,82,0.6)'}`,
                color:      origen === id ? color : '#4a5f7a',
              }}
            >
              <div>{label}</div>
              <div className="text-xs font-normal mt-0.5 opacity-70">{nota}</div>
            </button>
          ))}
        </div>

        {/* Lista de animales disponibles */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {cargando ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colorOrigen, borderTopColor: 'transparent' }} />
              <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Cargando reproductores de {labelOrigen}...</span>
            </div>
          ) : disponibles.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm font-mono" style={{ color: '#3d5068' }}>
                Sin reproductores disponibles de {labelOrigen}.
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: '#2a3a50' }}>
                Solo se muestran animales activos que aún no fueron exportados.
              </div>
            </div>
          ) : (
            disponibles.map((a) => {
              const activo   = seleccionado?.id === a.id
              const diasNac  = a.fecha_nacimiento
                ? Math.floor((Date.now() - new Date(a.fecha_nacimiento + 'T12:00:00').getTime()) / 86400000)
                : null
              const edad     = diasNac == null ? '—' : diasNac < 30 ? `${diasNac}d` : diasNac < 112 ? `${Math.floor(diasNac / 7)}sem` : `${Math.floor(diasNac / 30)}m`
              const colorSexo = a.sexo === 'macho' ? '#40c4ff' : '#ce93d8'

              return (
                <button
                  key={a.id}
                  onClick={() => setSelec(activo ? null : a)}
                  className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-4 transition-all"
                  style={{
                    background: activo ? `${colorOrigen}14` : 'rgba(255,255,255,0.02)',
                    border:     `1.5px solid ${activo ? colorOrigen + '55' : 'rgba(30,51,82,0.5)'}`,
                  }}
                >
                  {/* Check */}
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: activo ? colorOrigen : 'rgba(30,51,82,0.8)', background: activo ? colorOrigen : 'transparent' }}
                  >
                    {activo && <span style={{ color: '#050810', fontSize: '9px', fontWeight: 'bold' }}>✓</span>}
                  </div>

                  {/* Sexo */}
                  <span className="text-xs font-bold" style={{ color: colorSexo }}>
                    {a.sexo === 'macho' ? '♂' : '♀'}
                  </span>

                  {/* Código */}
                  <span className="font-bold font-mono text-sm text-white">{a.codigo}</span>

                  {/* Edad */}
                  <span className="text-xs font-mono" style={{ color: '#6a8099' }}>{edad}</span>

                  {/* Estado */}
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full ml-auto"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5f7a' }}
                  >
                    {a.estado === 'activo' ? 'Activo' : a.estado === 'en_cria' ? 'En cría' : a.estado}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Botones */}
        <div
          className="px-6 py-4 flex items-center gap-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {seleccionado && (
            <div className="flex-1 text-xs font-mono" style={{ color: '#a78bfa' }}>
              Seleccionado: <span className="font-bold text-white">{seleccionado.codigo}</span>
              {' '}({seleccionado.sexo === 'macho' ? '♂' : '♀'} · {labelOrigen})
            </div>
          )}
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl text-sm font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => seleccionado && onExportar(seleccionado)}
            disabled={!seleccionado}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: seleccionado ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.04)',
              border:     `1.5px solid ${seleccionado ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color:      seleccionado ? '#a78bfa' : '#3d5068',
              cursor:     seleccionado ? 'pointer' : 'not-allowed',
            }}
          >
            Exportar a Híbridos
          </button>
        </div>
      </div>
    </div>
  )
}
