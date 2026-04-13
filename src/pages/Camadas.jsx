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

// ── Editor de distribución de jaulas ─────────────────────────────────────────

const inputJaulaStyle = {
  background: 'rgba(8,13,26,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '8px',
}

function JaulasDistribucion({ camada, jaulas, agregarJaula, editarJaula, eliminarJaula }) {
  const jaulasCamada = jaulas.filter((j) => j.camada_id === camada.id)
  const totalJaulas  = jaulasCamada.reduce((s, j) => s + (j.total ?? 0), 0)
  const target       = camada.total_destetados ?? 0
  const equilibrio   = totalJaulas === target

  const [editando, setEditando] = useState(null) // id de jaula en edición
  const [formEdit, setFormEdit] = useState({})
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [formNueva, setFormNueva] = useState({ total: '', machos: '', hembras: '', notas: '' })

  function iniciarEdicion(j) {
    setEditando(j.id)
    setFormEdit({ total: j.total ?? '', machos: j.machos ?? '', hembras: j.hembras ?? '', notas: j.notas ?? '' })
  }

  function guardarEdicion(j) {
    editarJaula({
      ...j,
      total:   Number(formEdit.total)  || 0,
      machos:  formEdit.machos !== '' ? Number(formEdit.machos)  : null,
      hembras: formEdit.hembras !== '' ? Number(formEdit.hembras) : null,
      notas:   formEdit.notas || '',
    })
    setEditando(null)
  }

  function guardarNueva() {
    const total = Number(formNueva.total) || 0
    if (total <= 0) return
    agregarJaula({
      camada_id: camada.id,
      total,
      machos:  formNueva.machos  !== '' ? Number(formNueva.machos)  : null,
      hembras: formNueva.hembras !== '' ? Number(formNueva.hembras) : null,
      notas:   formNueva.notas || '',
    })
    setFormNueva({ total: '', machos: '', hembras: '', notas: '' })
    setMostrarNueva(false)
  }

  return (
    <div className="space-y-3">
      {/* Header de distribución */}
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#4a5f7a' }}>
          Distribución en jaulas
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
            style={
              equilibrio
                ? { background: 'rgba(0,230,118,0.12)', color: '#00e676', border: '1px solid rgba(0,230,118,0.3)' }
                : { background: 'rgba(255,179,0,0.12)', color: '#ffb300', border: '1px solid rgba(255,179,0,0.3)' }
            }
          >
            {totalJaulas}/{target} {equilibrio ? '✓' : '⚠'}
          </span>
          <button
            onClick={() => setMostrarNueva((v) => !v)}
            className="text-xs font-semibold px-2 py-0.5 rounded-lg"
            style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }}
          >
            + Jaula
          </button>
        </div>
      </div>

      {/* Sin jaulas aún */}
      {jaulasCamada.length === 0 && !mostrarNueva && (
        <div className="text-xs py-2 text-center" style={{ color: '#4a5f7a' }}>
          Sin jaulas asignadas — agregá una para organizar el stock
        </div>
      )}

      {/* Lista de jaulas */}
      <div className="space-y-1.5">
        {jaulasCamada.map((j, idx) =>
          editando === j.id ? (
            // Fila en edición
            <div key={j.id} className="rounded-lg p-2.5 space-y-2" style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)' }}>
              <div className="grid grid-cols-3 gap-2">
                {[['Total', 'total'], ['♂ Machos', 'machos'], ['♀ Hembras', 'hembras']].map(([lbl, campo]) => (
                  <div key={campo}>
                    <div className="text-xs mb-1" style={{ color: '#4a5f7a' }}>{lbl}</div>
                    <input
                      type="number"
                      min={0}
                      value={formEdit[campo]}
                      onChange={(e) => setFormEdit((p) => ({ ...p, [campo]: e.target.value }))}
                      className="w-full px-2 py-1 text-xs font-mono focus:outline-none"
                      style={inputJaulaStyle}
                    />
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="Notas (opcional)"
                value={formEdit.notas}
                onChange={(e) => setFormEdit((p) => ({ ...p, notas: e.target.value }))}
                className="w-full px-2 py-1 text-xs focus:outline-none"
                style={inputJaulaStyle}
              />
              <div className="flex gap-2">
                <button onClick={() => guardarEdicion(j)} className="flex-1 py-1 rounded text-xs font-bold" style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.35)', color: '#00e676' }}>
                  Guardar
                </button>
                <button onClick={() => setEditando(null)} className="px-3 py-1 rounded text-xs" style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#4a5f7a' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            // Fila normal
            <div key={j.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(13,21,40,0.6)', border: '1px solid rgba(30,51,82,0.6)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>J{idx + 1}</span>
                <span className="font-mono font-bold text-sm text-white">{j.total ?? 0}</span>
                {(j.machos != null || j.hembras != null) && (
                  <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    {j.machos != null && <span style={{ color: '#40c4ff' }}>♂{j.machos} </span>}
                    {j.hembras != null && <span style={{ color: '#ce93d8' }}>♀{j.hembras}</span>}
                  </span>
                )}
                {j.notas && <span className="text-xs" style={{ color: '#4a5f7a' }}>{j.notas}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => iniciarEdicion(j)} className="text-xs font-semibold" style={{ color: '#40c4ff' }}>Editar</button>
                <button onClick={() => eliminarJaula(j.id)} className="text-xs font-semibold" style={{ color: '#ff6b80' }}>✕</button>
              </div>
            </div>
          )
        )}

        {/* Formulario nueva jaula */}
        {mostrarNueva && (
          <div className="rounded-lg p-2.5 space-y-2" style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.2)' }}>
            <div className="text-xs font-semibold" style={{ color: '#00e676' }}>Nueva jaula</div>
            <div className="grid grid-cols-3 gap-2">
              {[['Total *', 'total'], ['♂ Machos', 'machos'], ['♀ Hembras', 'hembras']].map(([lbl, campo]) => (
                <div key={campo}>
                  <div className="text-xs mb-1" style={{ color: '#4a5f7a' }}>{lbl}</div>
                  <input
                    type="number"
                    min={0}
                    value={formNueva[campo]}
                    onChange={(e) => setFormNueva((p) => ({ ...p, [campo]: e.target.value }))}
                    className="w-full px-2 py-1 text-xs font-mono focus:outline-none"
                    style={inputJaulaStyle}
                  />
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={formNueva.notas}
              onChange={(e) => setFormNueva((p) => ({ ...p, notas: e.target.value }))}
              className="w-full px-2 py-1 text-xs focus:outline-none"
              style={inputJaulaStyle}
            />
            <div className="flex gap-2">
              <button onClick={guardarNueva} className="flex-1 py-1 rounded text-xs font-bold" style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.35)', color: '#00e676' }}>
                + Agregar
              </button>
              <button onClick={() => setMostrarNueva(false)} className="px-3 py-1 rounded text-xs" style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#4a5f7a' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
  const { camadas, animales, jaulas, agregarCamada, editarCamada, eliminarCamada, confirmarSeparacion, agregarJaula, editarJaula, eliminarJaula } = useBioterio()
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
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>
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
                  <>
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

                  {/* Editor de distribución en jaulas (solo si hay destete registrado) */}
                  {camada.fecha_destete && (
                    <div
                      className="px-5 py-4"
                      style={{ borderTop: '1px solid rgba(0,230,118,0.08)', background: 'rgba(0,0,0,0.2)' }}
                    >
                      <JaulasDistribucion
                        camada={camada}
                        jaulas={jaulas}
                        agregarJaula={agregarJaula}
                        editarJaula={editarJaula}
                        eliminarJaula={eliminarJaula}
                      />
                    </div>
                  )}
                  </>
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
