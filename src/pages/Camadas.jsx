import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import {
  formatFecha, calcularRangoParto, calcularDestete, calcularMadurez, calcularFechaSeparacion,
  calcularLatencia, interpretarLatencia, difDias, parseDate, hoy,
} from '../utils/calculos'
import { BIO } from '../utils/constants'
import Modal from '../components/Modal'
import CamadaForm from '../components/CamadaForm'
import Badge from '../components/Badge'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }
const estadoConfig = {
  apareamiento: { badge: 'azul',    label: 'En apareamiento', icono: '💑' },
  preñez:       { badge: 'violeta', label: 'En preñez',       icono: '🫄' },
  lactancia:    { badge: 'naranja', label: 'Lactancia',       icono: '🤱' },
  completada:   { badge: 'verde',   label: 'Completada',      icono: '✅' },
}

function LatenciaBit({ dias }) {
  if (dias === null || dias === undefined) return <span style={{ color: 'rgba(74,95,122,0.4)' }}>—</span>
  const color = dias <= 2 ? '#00e676' : dias <= 5 ? '#40c4ff' : dias <= 10 ? '#ffb300' : '#ff6b80'
  return (
    <span
      className="font-mono font-bold text-sm"
      style={{ color, textShadow: `0 0 8px ${color}55` }}
    >
      {dias}d
    </span>
  )
}

export default function Camadas() {
  const { camadas, animales, agregarCamada, editarCamada, eliminarCamada, confirmarSeparacion } = useBioterio()
  const [modal, setModal] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [expandida, setExpandida] = useState(null)
  const [separando, setSeparando] = useState(null)       // id de camada en proceso de confirmar separación
  const [fechaSepInput, setFechaSepInput] = useState('')

  const hoyDate = parseDate(hoy())

  function nombreAnimal(id) {
    return animales.find((a) => a.id === id)?.codigo ?? '?'
  }

  const camadasEnriquecidas = useMemo(() => {
    return camadas.map((c) => {
      const rango = c.fecha_copula && !c.fecha_nacimiento ? calcularRangoParto(c.fecha_copula) : null
      const fechaDestete = c.fecha_nacimiento ? calcularDestete(c.fecha_nacimiento) : null
      const fechaMadurez = c.fecha_nacimiento ? calcularMadurez(c.fecha_nacimiento) : null
      const fechaSepEsperada = c.fecha_copula && !c.fecha_nacimiento ? calcularFechaSeparacion(c.fecha_copula) : null
      const latencia = calcularLatencia(c)

      let estado
      if (c.fecha_destete) {
        estado = 'completada'
      } else if (c.fecha_nacimiento) {
        estado = 'lactancia'
      } else {
        const tieneSeparacion = !!c.fecha_separacion
        const diasDesdeCopula = c.fecha_copula ? difDias(parseDate(c.fecha_copula), hoyDate) : 0
        const autoSeparada = !c.fecha_separacion && c.fecha_copula && diasDesdeCopula >= BIO.DURACION_APAREAMIENTO_DIAS
        estado = (tieneSeparacion || autoSeparada) ? 'preñez' : 'apareamiento'
      }

      return { ...c, rango, fechaDestete, fechaMadurez, fechaSepEsperada, latencia, estado }
    })
  }, [camadas, hoyDate])

  const filtradas = useMemo(() =>
    filtro === 'todas' ? camadasEnriquecidas : camadasEnriquecidas.filter((c) => c.estado === filtro),
  [camadasEnriquecidas, filtro])

  function guardar(datos) {
    if (modal === 'nueva') agregarCamada(datos)
    else editarCamada({ ...datos, id: modal.id })
    setModal(null)
  }

  function FiltroBtn({ valor, children }) {
    const activo = filtro === valor
    const count = valor === 'todas' ? camadasEnriquecidas.length : camadasEnriquecidas.filter((c) => c.estado === valor).length
    return (
      <button
        onClick={() => setFiltro(valor)}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
        style={
          activo
            ? { background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }
            : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
        }
      >
        {children}
        <span className="font-mono opacity-60">({count})</span>
      </button>
    )
  }

  function DataItem({ label, valor, sub, color = '#8a9bb0' }) {
    return (
      <div>
        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>{label}</div>
        <div className="font-mono font-semibold text-sm" style={{ color }}>{valor}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{sub}</div>}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Camadas</h1>
            <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{camadas.length} registros</p>
          </div>
        </div>
        <button
          onClick={() => setModal('nueva')}
          className="px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{
            background: 'rgba(0,230,118,0.12)',
            border: '1.5px solid rgba(0,230,118,0.35)',
            color: '#00e676',
          }}
        >
          + Registrar apareamiento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <FiltroBtn valor="todas">Todas</FiltroBtn>
        <FiltroBtn valor="apareamiento">En apareamiento</FiltroBtn>
        <FiltroBtn valor="preñez">En preñez</FiltroBtn>
        <FiltroBtn valor="lactancia">Lactancia</FiltroBtn>
        <FiltroBtn valor="completada">Completadas</FiltroBtn>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="text-center py-16" style={{ color: '#4a5f7a' }}>
          <div className="text-4xl mb-3">🪺</div>
          <div className="text-sm">No hay camadas en esta categoría</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((camada) => {
            const cfg = estadoConfig[camada.estado]
            const isExp = expandida === camada.id
            return (
              <div key={camada.id} className="rounded-xl overflow-hidden" style={cardStyle}>
                {/* Fila principal */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{cfg.icono}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono font-bold" style={{ color: '#ce93d8' }}>
                          {nombreAnimal(camada.id_madre)}
                        </span>
                        <span style={{ color: '#4a5f7a' }}>×</span>
                        <span className="font-mono font-bold" style={{ color: '#40c4ff' }}>
                          {nombreAnimal(camada.id_padre)}
                        </span>
                        <Badge color={cfg.badge}>{cfg.label}</Badge>
                      </div>
                      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                        Cópula: {formatFecha(camada.fecha_copula)}
                        {camada.fecha_nacimiento && <> · Parto: {formatFecha(camada.fecha_nacimiento)}</>}
                        {camada.total_crias != null && <> · {camada.total_crias} crías</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {camada.latencia !== null && (
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: '#4a5f7a' }}>Latencia</div>
                        <LatenciaBit dias={camada.latencia} />
                      </div>
                    )}

                    {/* Botón / inline de separación */}
                    {camada.estado === 'apareamiento' && (
                      separando === camada.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={fechaSepInput}
                            onChange={(e) => setFechaSepInput(e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg font-mono focus:outline-none"
                            style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(64,196,255,0.4)', color: '#c9d4e0' }}
                          />
                          <button
                            onClick={() => {
                              if (fechaSepInput) {
                                confirmarSeparacion(camada.id, fechaSepInput)
                                setSeparando(null)
                              }
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ background: 'rgba(64,196,255,0.15)', border: '1px solid rgba(64,196,255,0.4)', color: '#40c4ff' }}
                          >✓</button>
                          <button onClick={() => setSeparando(null)} className="text-xs" style={{ color: '#4a5f7a' }}>✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSeparando(camada.id); setFechaSepInput(hoy()) }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff' }}
                        >
                          ✂ Separar
                        </button>
                      )
                    )}

                    <button
                      onClick={() => setExpandida(isExp ? null : camada.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: 'rgba(30,51,82,0.5)', color: '#4a5f7a' }}
                    >
                      {isExp ? '▲' : '▼'}
                    </button>
                    <button onClick={() => setModal(camada)} className="text-xs font-semibold" style={{ color: '#40c4ff' }}>
                      Editar
                    </button>
                    <button onClick={() => setConfirmarEliminar(camada)} className="text-xs font-semibold" style={{ color: '#ff6b80' }}>
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Detalle */}
                {isExp && (
                  <div
                    className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"
                    style={{ borderTop: '1px solid rgba(0,230,118,0.08)', background: 'rgba(0,0,0,0.2)' }}
                  >
                    {/* Separación */}
                    {camada.fecha_separacion ? (
                      <DataItem label="Separación confirmada" valor={formatFecha(camada.fecha_separacion)} color="#40c4ff" />
                    ) : camada.fechaSepEsperada ? (
                      <DataItem
                        label="Separación esperada"
                        valor={formatFecha(camada.fechaSepEsperada)}
                        sub={`${BIO.DURACION_APAREAMIENTO_DIAS}d post-cópula`}
                        color="#40c4ff"
                      />
                    ) : null}

                    {camada.rango && (
                      <DataItem
                        label="Parto esperado"
                        valor={`${formatFecha(camada.rango.partoMin)} — ${formatFecha(camada.rango.partoMax)}`}
                        sub={`Probable: ${formatFecha(camada.rango.partoProbable)}`}
                        color="#40c4ff"
                      />
                    )}
                    {camada.fechaDestete && (
                      <DataItem
                        label="Destete estimado"
                        valor={formatFecha(camada.fechaDestete)}
                        sub={camada.fecha_destete ? `Real: ${formatFecha(camada.fecha_destete)}` : '21d post-nacimiento'}
                        color="#ffb300"
                      />
                    )}
                    {camada.fechaMadurez && (
                      <DataItem
                        label="Madurez reproductiva"
                        valor={formatFecha(camada.fechaMadurez)}
                        sub="12 semanas"
                        color="#ce93d8"
                      />
                    )}
                    {camada.latencia !== null && (
                      <div>
                        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>
                          Latencia fertilización
                        </div>
                        <div className="font-mono font-bold text-lg">
                          <LatenciaBit dias={camada.latencia} />
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
                          {interpretarLatencia(camada.latencia)}
                        </div>
                      </div>
                    )}
                    {camada.fecha_nacimiento && camada.fecha_copula && (
                      <DataItem
                        label="Gestación observada"
                        valor={`${difDias(parseDate(camada.fecha_copula), parseDate(camada.fecha_nacimiento))} días`}
                        sub="desde cópula"
                        color="#8a9bb0"
                      />
                    )}
                    {camada.total_crias != null && (
                      <DataItem
                        label="Crías"
                        valor={`${camada.total_crias} totales`}
                        sub={[
                          camada.crias_machos != null ? `♂ ${camada.crias_machos}` : '',
                          camada.crias_hembras != null ? `♀ ${camada.crias_hembras}` : '',
                          camada.total_destetados != null ? `Dest. ${camada.total_destetados}` : '',
                        ].filter(Boolean).join(' · ')}
                        color="#00e676"
                      />
                    )}
                    {camada.notas && (
                      <div className="col-span-2">
                        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#4a5f7a' }}>Notas</div>
                        <div className="text-sm" style={{ color: '#8a9bb0' }}>{camada.notas}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modales */}
      {modal && (
        <Modal
          titulo={modal === 'nueva' ? 'Registrar apareamiento' : 'Editar camada'}
          onCerrar={() => setModal(null)}
          ancho="max-w-xl"
        >
          <CamadaForm camada={modal === 'nueva' ? null : modal} onGuardar={guardar} onCancelar={() => setModal(null)} />
        </Modal>
      )}

      {confirmarEliminar && (
        <Modal titulo="Eliminar camada" onCerrar={() => setConfirmarEliminar(null)} ancho="max-w-sm">
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <p style={{ color: '#8a9bb0' }}>
              ¿Eliminás el registro de{' '}
              <span className="font-mono font-bold" style={{ color: '#ce93d8' }}>{nombreAnimal(confirmarEliminar.id_madre)}</span>
              {' '}×{' '}
              <span className="font-mono font-bold" style={{ color: '#40c4ff' }}>{nombreAnimal(confirmarEliminar.id_padre)}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarEliminar(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}>
                Cancelar
              </button>
              <button onClick={() => { eliminarCamada(confirmarEliminar.id); setConfirmarEliminar(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.35)', color: '#ff6b80' }}>
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
