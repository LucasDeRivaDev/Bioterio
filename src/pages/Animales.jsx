import React, { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha, difDias, parseDate, hoy, calcularPerfilHembra, calcularConfiabilidadHembra, calcularRendimientoMacho } from '../utils/calculos'
import Modal from '../components/Modal'
import AnimalForm from '../components/AnimalForm'
import Badge from '../components/Badge'

const colorEstado = { activo:'verde', en_apareamiento:'azul', en_cria:'violeta', retirado:'gris', fallecido:'rojo' }
const labelEstado = { activo:'Activo', en_apareamiento:'En apareamiento', en_cria:'En cría', retirado:'Retirado', fallecido:'Fallecido' }

const cardStyle = {
  background: 'rgba(13,21,40,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
}

export default function Animales() {
  const { animales, agregarAnimal, editarAnimal, eliminarAnimal, camadas } = useBioterio()
  const [modal, setModal] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [filtroSexo, setFiltroSexo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const hoyStr = hoy()

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
      const perfil = calcularPerfilHembra(animal.id, camadas)
      const conf   = calcularConfiabilidadHembra(animal.id, camadas)
      if (!perfil) return (
        <div className="text-xs py-2" style={{ color: '#4a5f7a' }}>Sin camadas con parto registrado</div>
      )
      return (
        <div className="space-y-2">
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
      const rend = calcularRendimientoMacho(animal.id, camadas)
      if (rend.total_camadas === 0) return (
        <div className="text-xs py-2" style={{ color: '#4a5f7a' }}>Sin camadas con parto registrado</div>
      )
      return (
        <div className="space-y-2">
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
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
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
                    </td>
                    <td className="px-4 py-3 font-medium text-xs">
                      <span style={{ color: animal.sexo === 'hembra' ? '#ce93d8' : '#40c4ff' }}>
                        {animal.sexo === 'hembra' ? '♀ Hembra' : '♂ Macho'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8a9bb0' }}>
                      {formatFecha(animal.fecha_nacimiento)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#4a5f7a' }}>
                      {calcularEdad(animal.fecha_nacimiento)}
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
    </div>
  )
}
