import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { calcularRangoParto, calcularDestete, formatFecha, hoy, difDias, parseDate, getAnimalesReservados } from '../utils/calculos'
import { MAX_APAREAMIENTOS } from '../utils/constants'
import { buildPedigree, evaluarApareamientoGenetico, fPorcentaje, LABEL_PARENTESCO, calcularFCoeficiente } from '../utils/genealogia'
import { generarBloqueosSanitarios } from '../utils/sanitario'

const vacioCamada = {
  id_madre: '', id_padre: '', fecha_copula: '', fecha_nacimiento: '',
  gestacion_real: '', total_crias: '', crias_machos: '', crias_hembras: '',
  total_destetados: '', fecha_destete: '', notas: '',
  failure_flag: false, failure_type: '',
  incluir_en_stock: true,
}

const TIPOS_FALLA = [
  { value: 'no_birth',         label: 'Sin parto' },
  { value: 'failed_pregnancy', label: 'Preñez fallida' },
  { value: 'reabsorption',     label: 'Reabsorción sospechada' },
  { value: 'unknown',          label: 'Fallo desconocido' },
]

const ESTADOS_ACTIVOS = ['activo', 'en_apareamiento', 'en_cria']

function esInactivo(animal) {
  return animal && !ESTADOS_ACTIVOS.includes(animal.estado)
}

const inputStyle = {
  background: 'rgba(8,13,26,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '10px',
}

function LabInput({ label, sublabel, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: '#8a9bb0' }}>
        {label}
        {required && <span style={{ color: '#ff6b80' }}>*</span>}
        {sublabel && <span className="normal-case tracking-normal font-normal opacity-50 ml-1">{sublabel}</span>}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#ff6b80' }}>{error}</p>}
    </div>
  )
}

function normalizarCamada(c) {
  return {
    id_madre:        c.id_madre        ?? '',
    id_padre:        c.id_padre        ?? '',
    fecha_copula:    c.fecha_copula    ?? '',
    fecha_separacion: c.fecha_separacion ?? '',
    fecha_nacimiento: c.fecha_nacimiento ?? '',
    gestacion_real:  c.gestacion_real  ?? '',
    total_crias:     c.total_crias     ?? '',
    crias_machos:    c.crias_machos    ?? '',
    crias_hembras:   c.crias_hembras   ?? '',
    total_destetados: c.total_destetados ?? '',
    fecha_destete:   c.fecha_destete   ?? '',
    notas:           c.notas           ?? '',
    failure_flag:      c.failure_flag      ?? false,
    failure_type:      c.failure_type      ?? '',
    incluir_en_stock:  c.incluir_en_stock  ?? true,
  }
}

// Label corto de colonia para animales exportados
function labelColonia(bioId) {
  if (bioId === 'ratones_balbc') return 'BAL/C'
  if (bioId === 'ratones_c57')   return 'C57'
  return null
}

export default function CamadaForm({ camada, onGuardar, onCancelar }) {
  const { animales, animalesExportados, camadas, incidentes, bio, bioterioActivo } = useBioterio()
  const [form, setForm] = useState(camada ? normalizarCamada(camada) : vacioCamada)
  const [errores, setErrores] = useState({})
  const [modoHistorico, setModoHistorico] = useState(false)

  // Mapa de animales con apareamiento planificado futuro
  const animalesReservados = getAnimalesReservados(bioterioActivo)

  // En Híbridos, incluir también los animales exportados de BAL/C y C57
  const esHibridos    = bioterioActivo === 'ratones_hibridos'
  const todosAnimales = esHibridos ? [...animales, ...animalesExportados] : animales

  // En modo normal: solo activos. En modo histórico: todos.
  const hembrasBase = todosAnimales.filter((a) => a.sexo === 'hembra')
  const machosBase  = todosAnimales.filter((a) => a.sexo === 'macho')
  const hembras = modoHistorico ? hembrasBase : hembrasBase.filter((a) => ESTADOS_ACTIVOS.includes(a.estado))
  const machos  = modoHistorico ? machosBase  : machosBase.filter((a)  => ESTADOS_ACTIVOS.includes(a.estado))

  const madreSelec = todosAnimales.find((a) => a.id === form.id_madre)
  const padreSelec = todosAnimales.find((a) => a.id === form.id_padre)
  const fechaEsPasada = form.fecha_copula && form.fecha_copula < hoy()

  // ── Disponibilidad reproductiva ───────────────────────────────────────────
  function dispHembra(a) {
    if (modoHistorico) return { ok: true }
    if (!ESTADOS_ACTIVOS.includes(a.estado))
      return { ok: false, motivo: etiquetaEstado[a.estado] ?? a.estado }

    // Límite de apareamientos — bloquear 4° ciclo
    const totalApareaminetos = camadas.filter((c) => c.id_madre === a.id).length
    if (totalApareaminetos >= MAX_APAREAMIENTOS)
      return { ok: false, motivo: `Hembra finalizó su ciclo reproductivo (${MAX_APAREAMIENTOS} ciclos). No puede ser apareada nuevamente.` }

    if (a.estado === 'en_apareamiento')
      return { ok: false, motivo: 'En pareja activa' }
    if (a.estado === 'en_cria') {
      const act = camadas.find((c) => c.id_madre === a.id && !c.failure_flag && !c.fecha_destete)
      return { ok: false, motivo: act?.fecha_nacimiento ? 'En lactancia' : 'Preñada' }
    }
    // Período de descanso post-destete (30 días)
    const ultimoDestete = camadas
      .filter((c) => c.id_madre === a.id && c.fecha_destete)
      .map((c) => c.fecha_destete)
      .sort()
      .at(-1)
    if (ultimoDestete) {
      const dias = difDias(parseDate(ultimoDestete), parseDate(hoy()))
      if (dias < 30) return { ok: false, motivo: `Descanso post-destete (${30 - dias}d restantes)` }
    }
    return { ok: true }
  }

  function dispMacho(a) {
    if (modoHistorico) return { ok: true }
    if (!ESTADOS_ACTIVOS.includes(a.estado))
      return { ok: false, motivo: etiquetaEstado[a.estado] ?? a.estado }
    if (a.estado === 'en_apareamiento')
      return { ok: false, motivo: 'En apareamiento activo' }
    return { ok: true }
  }

  // Al editar, la madre/padre originales nunca quedan bloqueados
  const esOriginalMadre = (a) => camada && camada.id_madre === a.id
  const esOriginalPadre = (a) => camada && camada.id_padre === a.id

  // Detección de consanguinidad directa
  const consanguinidad = (() => {
    if (!madreSelec || !padreSelec) return null
    if (padreSelec.id === madreSelec.id_padre) return 'padre-hija' // el macho es el padre de la hembra
    if (madreSelec.id === padreSelec.id_madre) return 'madre-hijo' // la hembra es la madre del macho
    return null
  })()
  const [confirmarConsanguinidad, setConfirmarConsanguinidad] = useState(false)

  // Análisis genético del apareamiento (coeficiente F de Wright)
  const pedigree = useMemo(() => buildPedigree(todosAnimales, camadas), [todosAnimales, camadas])
  const analisisGenetico = useMemo(() => {
    if (!madreSelec || !padreSelec) return null
    return evaluarApareamientoGenetico(madreSelec.id, padreSelec.id, pedigree)
  }, [madreSelec, padreSelec, pedigree])

  // Bloqueo sanitario de los animales seleccionados (consulta rápida al map)
  const bloqueosSanitarios = useMemo(() => {
    const candidatos = [madreSelec, padreSelec].filter(Boolean)
    if (candidatos.length === 0) return new Map()
    const fMap = new Map()
    candidatos.forEach(a => {
      try { fMap.set(a.id, calcularFCoeficiente(a.id, pedigree) ?? 0) } catch { fMap.set(a.id, 0) }
    })
    return generarBloqueosSanitarios(candidatos, camadas, incidentes, fMap, bioterioActivo).animalesBloqueados
  }, [madreSelec, padreSelec, camadas, incidentes, pedigree, bioterioActivo])

  const bloqueoMadre = madreSelec ? bloqueosSanitarios.get(madreSelec.id) ?? null : null
  const bloqueoMacho = padreSelec ? bloqueosSanitarios.get(padreSelec.id) ?? null : null

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: '' }))
    if (campo === 'id_madre' || campo === 'id_padre') setConfirmarConsanguinidad(false)
  }

  function validar() {
    const nuevos = {}
    if (!form.id_madre) nuevos.id_madre = 'Seleccioná una hembra'
    if (!form.id_padre) nuevos.id_padre = 'Seleccioná un macho'
    if (!form.fecha_copula) nuevos.fecha_copula = 'La fecha de cópula es obligatoria'

    // Disponibilidad biológica — solo para nuevos apareamientos (no ediciones)
    if (!camada && !modoHistorico) {
      if (madreSelec) {
        const d = dispHembra(madreSelec)
        if (!d.ok) nuevos.id_madre = `Hembra no disponible: ${d.motivo}.`
      }
      if (padreSelec) {
        const d = dispMacho(padreSelec)
        if (!d.ok) nuevos.id_padre = `Macho no disponible: ${d.motivo}.`
      }
    }

    // No permitir apareamiento futuro con animales inactivos
    if (form.fecha_copula && form.fecha_copula >= hoy()) {
      if (esInactivo(madreSelec)) nuevos.id_madre = 'No se puede asignar una hembra inactiva a un apareamiento futuro'
      if (esInactivo(padreSelec)) nuevos.id_padre = 'No se puede asignar un macho inactivo a un apareamiento futuro'
    }

    // Regla 3: La cópula no puede ocurrir antes del nacimiento de ninguno de los animales
    if (form.fecha_copula && madreSelec?.fecha_nacimiento && !nuevos.fecha_copula) {
      if (form.fecha_copula < madreSelec.fecha_nacimiento) {
        nuevos.fecha_copula = `La fecha de cópula es anterior al nacimiento de ${madreSelec.codigo} (nació el ${formatFecha(madreSelec.fecha_nacimiento)}).`
      }
    }
    if (form.fecha_copula && padreSelec?.fecha_nacimiento && !nuevos.fecha_copula) {
      if (form.fecha_copula < padreSelec.fecha_nacimiento) {
        nuevos.fecha_copula = `La fecha de cópula es anterior al nacimiento de ${padreSelec.codigo} (nació el ${formatFecha(padreSelec.fecha_nacimiento)}).`
      }
    }

    // Regla 2: La hembra no puede aparearse antes de la edad reproductiva mínima
    if (form.fecha_copula && madreSelec?.fecha_nacimiento && !nuevos.id_madre && !nuevos.fecha_copula) {
      const edadAlCopular = difDias(parseDate(madreSelec.fecha_nacimiento), parseDate(form.fecha_copula))
      if (edadAlCopular < bio.MADUREZ_DIAS) {
        const semanasMin = Math.round(bio.MADUREZ_DIAS / 7)
        const faltanDias = bio.MADUREZ_DIAS - edadAlCopular
        nuevos.id_madre = `La hembra no ha alcanzado la edad reproductiva mínima (${semanasMin} semanas). Faltan ${faltanDias} días.`
      }
    }

    // Regla 4: El parto no puede ocurrir antes de la cópula
    if (form.fecha_nacimiento && form.fecha_copula && !nuevos.fecha_nacimiento) {
      if (form.fecha_nacimiento < form.fecha_copula) {
        nuevos.fecha_nacimiento = `El parto no puede ser anterior a la cópula (${formatFecha(form.fecha_copula)}).`
      }
    }

    // Regla destete: El destete no puede ocurrir antes del nacimiento
    if (form.fecha_destete && form.fecha_nacimiento && !nuevos.fecha_destete) {
      if (form.fecha_destete < form.fecha_nacimiento) {
        nuevos.fecha_destete = `El destete no puede ser anterior al nacimiento (${formatFecha(form.fecha_nacimiento)}).`
      }
    }
    // También: destete no puede ser antes de la cópula
    if (form.fecha_destete && form.fecha_copula && !nuevos.fecha_destete) {
      if (form.fecha_destete < form.fecha_copula) {
        nuevos.fecha_destete = `El destete no puede ser anterior a la cópula (${formatFecha(form.fecha_copula)}).`
      }
    }

    // Consanguinidad directa sin confirmación
    if (consanguinidad && !confirmarConsanguinidad) {
      nuevos._consanguinidad = 'Confirmá el apareamiento consanguíneo antes de guardar'
    }
    // Consanguinidad moderada/alta sin confirmación (F ≥ 12.5%)
    if (!consanguinidad && analisisGenetico && analisisGenetico.f >= 0.125 && !confirmarConsanguinidad) {
      nuevos._consanguinidad = `Consanguinidad del ${fPorcentaje(analisisGenetico.f)}% — confirmá antes de guardar`
    }

    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  function manejarEnvio(e) {
    e.preventDefault()
    if (!validar()) return
    onGuardar({
      ...form,
      gestacion_real:   form.gestacion_real   ? Number(form.gestacion_real)   : null,
      total_crias:      form.total_crias      ? Number(form.total_crias)      : null,
      crias_machos:     form.crias_machos     ? Number(form.crias_machos)     : null,
      crias_hembras:    form.crias_hembras    ? Number(form.crias_hembras)    : null,
      total_destetados: form.total_destetados ? Number(form.total_destetados) : null,
      failure_flag:     Boolean(form.failure_flag),
      failure_type:     form.failure_flag && form.failure_type ? form.failure_type : null,
    })
  }

  const rango = form.fecha_copula ? calcularRangoParto(form.fecha_copula, bio) : null
  const fechaDestetePred = form.fecha_nacimiento ? calcularDestete(form.fecha_nacimiento, bio) : null

  const selectStyle = { ...inputStyle, width: '100%' }

  const etiquetaEstado = { retirado: 'retirado', fallecido: 'fallecido', en_apareamiento: 'apareamiento', en_cria: 'en cría' }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">

      {/* Toggle modo histórico */}
      <button
        type="button"
        onClick={() => setModoHistorico((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
        style={
          modoHistorico
            ? { background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.35)', color: '#ffb300' }
            : { background: 'rgba(138,155,176,0.06)', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
        }
      >
        <span className="flex items-center gap-2">
          <span>{modoHistorico ? '📋' : '📋'}</span>
          <span className="font-semibold">Carga histórica</span>
          {modoHistorico && <span className="text-xs opacity-70">(incluye animales inactivos y fallecidos)</span>}
        </span>
        <span
          className="w-9 h-5 rounded-full flex items-center transition-all px-0.5"
          style={{ background: modoHistorico ? 'rgba(255,179,0,0.4)' : 'rgba(30,51,82,0.8)' }}
        >
          <span
            className="w-4 h-4 rounded-full transition-all"
            style={{
              background: modoHistorico ? '#ffb300' : '#4a5f7a',
              transform: modoHistorico ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </span>
      </button>

      {/* Pareja reproductora */}
      <div className="grid grid-cols-2 gap-3">
        <LabInput label="Hembra" required error={errores.id_madre}>
          <select
            value={form.id_madre}
            onChange={(e) => cambiar('id_madre', e.target.value)}
            className="px-3 py-2.5 text-sm focus:outline-none"
            style={{ ...selectStyle, borderColor: errores.id_madre ? 'rgba(255,61,87,0.5)' : undefined }}
          >
            <option value="">— Seleccioná —</option>
            {hembras.map((a) => {
              const d        = dispHembra(a)
              const bloqueada = !d.ok && !esOriginalMadre(a)
              const colonia   = labelColonia(a.bioterio_id)
              const reservada = animalesReservados.has(a.id)
              return (
                <option key={a.id} value={a.id} disabled={bloqueada}>
                  {a.codigo}{colonia ? ` (${colonia})` : ''}
                  {bloqueada ? ` — ${d.motivo}` : esInactivo(a) ? ` (${etiquetaEstado[a.estado] ?? a.estado})` : ''}
                  {!bloqueada && reservada ? ` 🗓 Reservada` : ''}
                </option>
              )
            })}
          </select>
          {/* Aviso si la hembra seleccionada no está disponible (edición) */}
          {madreSelec && !esOriginalMadre(madreSelec) && (() => {
            const d = dispHembra(madreSelec)
            return !d.ok ? (
              <p className="text-xs mt-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80' }}>
                ⚠ Hembra no disponible: {d.motivo}
              </p>
            ) : null
          })()}
          {/* Aviso si la hembra seleccionada tiene un apareamiento planificado */}
          {madreSelec && animalesReservados.has(madreSelec.id) && (() => {
            const r = animalesReservados.get(madreSelec.id)
            const [, m, d] = r.fecha.split('-')
            return (
              <p className="text-xs mt-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c' }}>
                🗓 Reservada para apareamiento planificado el {d}/{m}
              </p>
            )
          })()}
          {esInactivo(madreSelec) && fechaEsPasada && (
            <p className="text-xs mt-1" style={{ color: '#ffb300' }}>
              Animal inactivo — permitido solo para carga histórica
            </p>
          )}
        </LabInput>
        <LabInput label="Macho" required error={errores.id_padre}>
          <select
            value={form.id_padre}
            onChange={(e) => cambiar('id_padre', e.target.value)}
            className="px-3 py-2.5 text-sm focus:outline-none"
            style={{ ...selectStyle, borderColor: errores.id_padre ? 'rgba(255,61,87,0.5)' : undefined }}
          >
            <option value="">— Seleccioná —</option>
            {machos.map((a) => {
              const d        = dispMacho(a)
              const bloqueado = !d.ok && !esOriginalPadre(a)
              const colonia   = labelColonia(a.bioterio_id)
              const reservado = animalesReservados.has(a.id)
              return (
                <option key={a.id} value={a.id} disabled={bloqueado}>
                  {a.codigo}{colonia ? ` (${colonia})` : ''}
                  {bloqueado ? ` — ${d.motivo}` : esInactivo(a) ? ` (${etiquetaEstado[a.estado] ?? a.estado})` : ''}
                  {!bloqueado && reservado ? ` 🗓 Reservado` : ''}
                </option>
              )
            })}
          </select>
          {/* Aviso si el macho seleccionado no está disponible (edición) */}
          {padreSelec && !esOriginalPadre(padreSelec) && (() => {
            const d = dispMacho(padreSelec)
            return !d.ok ? (
              <p className="text-xs mt-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80' }}>
                ⚠ Macho no disponible: {d.motivo}
              </p>
            ) : null
          })()}
          {/* Aviso si el macho seleccionado tiene un apareamiento planificado */}
          {padreSelec && animalesReservados.has(padreSelec.id) && (() => {
            const r = animalesReservados.get(padreSelec.id)
            const [, m, d] = r.fecha.split('-')
            return (
              <p className="text-xs mt-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', color: '#fb923c' }}>
                🗓 Reservado para apareamiento planificado el {d}/{m}
              </p>
            )
          })()}
          {esInactivo(padreSelec) && fechaEsPasada && (
            <p className="text-xs mt-1" style={{ color: '#ffb300' }}>
              Animal inactivo — permitido solo para carga histórica
            </p>
          )}
        </LabInput>
      </div>

      {/* Advertencia: hembra en su último ciclo (2 camadas anteriores → esta será la 3°) */}
      {!modoHistorico && madreSelec && (() => {
        const nCamadas = camadas.filter((c) => c.id_madre === madreSelec.id).length
        // Ya tiene MAX_APAREAMIENTOS - 1 camadas → esta sería la última
        if (nCamadas !== MAX_APAREAMIENTOS - 1) return null
        return (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1.5px solid rgba(255,179,0,0.45)', background: 'rgba(255,179,0,0.07)' }}
          >
            <div className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl mt-0.5">🟡</span>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: '#ffb300' }}>
                  Último ciclo reproductivo
                </p>
                <p className="text-xs" style={{ color: '#ffd06e' }}>
                  {madreSelec.codigo} tiene {nCamadas} ciclo{nCamadas !== 1 ? 's' : ''} previo{nCamadas !== 1 ? 's' : ''}.
                  {' '}Este será su último apareamiento permitido. No podrá ser apareada nuevamente.
                  {' '}Preparar reemplazo reproductivo.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Alerta de consanguinidad */}
      {consanguinidad && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1.5px solid rgba(255,61,87,0.5)', background: 'rgba(255,61,87,0.06)' }}
        >
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="text-xl mt-0.5">🧬</span>
            <div className="flex-1">
              <p className="text-sm font-bold mb-0.5" style={{ color: '#ff6b80' }}>
                Consanguinidad detectada
              </p>
              <p className="text-xs" style={{ color: '#ff9aaa' }}>
                {consanguinidad === 'padre-hija'
                  ? `${padreSelec.codigo} es el padre de ${madreSelec.codigo}.`
                  : `${madreSelec.codigo} es la madre de ${padreSelec.codigo}.`}
                {' '}Relación padre-hija o madre-hijo. Apareamiento no recomendado.
              </p>
            </div>
          </div>
          {/* Confirmación explícita */}
          <button
            type="button"
            onClick={() => setConfirmarConsanguinidad((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
            style={{
              borderTop: '1px solid rgba(255,61,87,0.25)',
              background: confirmarConsanguinidad ? 'rgba(255,61,87,0.12)' : 'rgba(255,61,87,0.04)',
              color: confirmarConsanguinidad ? '#ff6b80' : '#a04050',
            }}
          >
            <span
              className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
              style={{
                border: confirmarConsanguinidad ? '1.5px solid #ff6b80' : '1.5px solid rgba(255,61,87,0.4)',
                background: confirmarConsanguinidad ? 'rgba(255,61,87,0.25)' : 'transparent',
              }}
            >
              {confirmarConsanguinidad && <span style={{ color: '#ff6b80', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
            </span>
            <span>Entiendo el riesgo genético y quiero continuar</span>
          </button>
          {errores._consanguinidad && (
            <p className="text-xs px-4 pb-2" style={{ color: '#ff6b80' }}>{errores._consanguinidad}</p>
          )}
        </div>
      )}

      {/* ── Advertencia sanitaria ───────────────────────────────────────────── */}
      {(bloqueoMadre || bloqueoMacho) && (
        <div className="rounded-xl overflow-hidden"
          style={{
            border: `1.5px solid ${(bloqueoMadre?.esBloqueo || bloqueoMacho?.esBloqueo) ? 'rgba(255,107,128,0.4)' : 'rgba(255,179,0,0.4)'}`,
            background: `${(bloqueoMadre?.esBloqueo || bloqueoMacho?.esBloqueo) ? 'rgba(255,107,128,0.05)' : 'rgba(255,179,0,0.04)'}`,
          }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${(bloqueoMadre?.esBloqueo || bloqueoMacho?.esBloqueo) ? 'rgba(255,107,128,0.15)' : 'rgba(255,179,0,0.15)'}` }}>
            <span>{(bloqueoMadre?.esBloqueo || bloqueoMacho?.esBloqueo) ? '🚫' : '⚠️'}</span>
            <span className="text-xs font-bold uppercase tracking-wider"
              style={{ color: (bloqueoMadre?.esBloqueo || bloqueoMacho?.esBloqueo) ? '#ff6b80' : '#ffb300' }}>
              {(bloqueoMadre?.esBloqueo || bloqueoMacho?.esBloqueo)
                ? 'Reproductor(es) en riesgo crítico'
                : 'Advertencia sanitaria'}
            </span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {[{ b: bloqueoMadre, animal: madreSelec }, { b: bloqueoMacho, animal: padreSelec }]
              .filter(({ b }) => b)
              .map(({ b, animal }, i) => (
                <div key={i} className="text-xs font-mono space-y-0.5">
                  <div className="font-semibold" style={{ color: b.esBloqueo ? '#ff6b80' : '#ffb300' }}>
                    {animal?.codigo} — {b.accion}
                  </div>
                  {b.motivos.map((m, j) => (
                    <div key={j} style={{ color: '#8a9bb0' }}>· {m}</div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Panel análisis genético (F de Wright) */}
      {analisisGenetico && analisisGenetico.f > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            border: `1.5px solid ${analisisGenetico.nivel.color}50`,
            background: `${analisisGenetico.nivel.color}08`,
          }}
        >
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="text-xl mt-0.5">🧬</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold" style={{ color: analisisGenetico.nivel.color }}>
                  Riesgo consanguíneo: {fPorcentaje(analisisGenetico.f)}%
                </p>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{
                    background: `${analisisGenetico.nivel.color}18`,
                    border: `1px solid ${analisisGenetico.nivel.color}40`,
                    color: analisisGenetico.nivel.color,
                  }}
                >
                  {analisisGenetico.nivel.label}
                </span>
              </div>
              {analisisGenetico.parentesco && LABEL_PARENTESCO[analisisGenetico.parentesco] && (
                <p className="text-xs mb-1" style={{ color: '#c9d4e0' }}>
                  {LABEL_PARENTESCO[analisisGenetico.parentesco].emoji}{' '}
                  {LABEL_PARENTESCO[analisisGenetico.parentesco].texto}
                </p>
              )}
              {/* Ancestros comunes */}
              {analisisGenetico.comunes && analisisGenetico.comunes.length > 0 && (
                <p className="text-xs mb-1 font-mono" style={{ color: '#8a9bb0' }}>
                  Ancestros comunes: {analisisGenetico.comunes.slice(0, 4).map((c) => c.codigo).join(', ')}
                  {analisisGenetico.comunes.length > 4 ? ` +${analisisGenetico.comunes.length - 4}` : ''}
                </p>
              )}
              {/* Barra visual */}
              <div className="mt-2 h-1.5 rounded-full" style={{ background: 'rgba(30,51,82,0.8)' }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(analisisGenetico.f / 0.5 * 100, 100)}%`,
                    background: analisisGenetico.nivel.color,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs mt-0.5 font-mono" style={{ color: '#3a5068' }}>
                <span>0%</span>
                <span>12.5% (med. hermanos)</span>
                <span>25% (hermanos)</span>
              </div>
            </div>
          </div>
          {analisisGenetico.recomendacion && (
            <div
              className="px-4 py-2 text-xs font-semibold"
              style={{
                borderTop: `1px solid ${analisisGenetico.nivel.color}25`,
                background: `${analisisGenetico.nivel.color}06`,
                color: analisisGenetico.nivel.color,
              }}
            >
              {analisisGenetico.recomendacion.tipo === 'bloqueo' ? '⛔' : analisisGenetico.recomendacion.tipo === 'advertencia' ? '⚠️' : '🟡'}{' '}
              {analisisGenetico.recomendacion.texto}
            </div>
          )}
        </div>
      )}
      {/* Confirmación cuando F es alto y no hay consanguinidad directa */}
      {analisisGenetico && analisisGenetico.f >= 0.125 && !consanguinidad && (
        <button
          type="button"
          onClick={() => setConfirmarConsanguinidad((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all"
          style={{
            background: confirmarConsanguinidad ? 'rgba(255,145,0,0.12)' : 'rgba(255,145,0,0.05)',
            border: confirmarConsanguinidad ? '1px solid rgba(255,145,0,0.5)' : '1px solid rgba(255,145,0,0.25)',
            color: confirmarConsanguinidad ? '#ff9100' : '#7a5a30',
          }}
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center shrink-0"
            style={{
              border: confirmarConsanguinidad ? '1.5px solid #ff9100' : '1.5px solid rgba(255,145,0,0.4)',
              background: confirmarConsanguinidad ? 'rgba(255,145,0,0.25)' : 'transparent',
            }}
          >
            {confirmarConsanguinidad && <span style={{ color: '#ff9100', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
          </span>
          <span>Entiendo el riesgo genético ({fPorcentaje(analisisGenetico.f)}% consanguinidad) y quiero continuar</span>
        </button>
      )}

      {/* Fecha cópula */}
      <LabInput label="Fecha de cópula" required error={errores.fecha_copula}>
        <input
          type="date"
          value={form.fecha_copula}
          onChange={(e) => cambiar('fecha_copula', e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none"
          style={{ ...inputStyle, borderColor: errores.fecha_copula ? 'rgba(255,61,87,0.5)' : undefined }}
        />
      </LabInput>

      {/* Predicción automática */}
      {rango && !form.fecha_nacimiento && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)' }}
        >
          <div className="font-semibold mb-1 text-xs uppercase tracking-widest" style={{ color: '#40c4ff' }}>
            📅 Predicción automática de parto
          </div>
          <div style={{ color: '#40c4ff' }}>
            Ventana:{' '}
            <span className="font-mono font-bold">{formatFecha(rango.partoMin)}</span>
            {' '}—{' '}
            <span className="font-mono font-bold">{formatFecha(rango.partoMax)}</span>
          </div>
          <div className="text-xs mt-0.5 opacity-60" style={{ color: '#40c4ff' }}>
            Más probable: {formatFecha(rango.partoProbable)}
          </div>
        </div>
      )}

      {/* Fecha nacimiento */}
      <LabInput label="Fecha de nacimiento" sublabel="completar cuando ocurra" error={errores.fecha_nacimiento}>
        <input
          type="date"
          value={form.fecha_nacimiento}
          onChange={(e) => cambiar('fecha_nacimiento', e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none"
          style={{ ...inputStyle, borderColor: errores.fecha_nacimiento ? 'rgba(255,61,87,0.5)' : undefined }}
        />
      </LabInput>

      {/* Gestación real */}
      {form.fecha_nacimiento && form.fecha_copula && (
        <LabInput label="Gestación real (días)" sublabel="si conocés el valor exacto">
          <input
            type="number"
            value={form.gestacion_real}
            onChange={(e) => cambiar('gestacion_real', e.target.value)}
            min={18} max={30}
            placeholder="23 (por defecto)"
            className="w-full px-3 py-2.5 text-sm focus:outline-none font-mono"
            style={inputStyle}
          />
        </LabInput>
      )}

      {/* Crías */}
      {form.fecha_nacimiento && (
        <div className="space-y-3">
          <div
            className="text-xs font-semibold uppercase tracking-widest pt-1 pb-1 flex items-center gap-2"
            style={{ color: '#00e676', borderTop: '1px solid rgba(0,230,118,0.12)' }}
          >
            <span>🐀</span> Datos de las crías
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['Total', 'total_crias'], ['Machos', 'crias_machos'], ['Hembras', 'crias_hembras']].map(([lbl, campo]) => (
              <LabInput key={campo} label={lbl}>
                <input
                  type="number"
                  value={form[campo]}
                  onChange={(e) => cambiar(campo, e.target.value)}
                  min={0}
                  className="w-full px-3 py-2.5 text-sm focus:outline-none font-mono"
                  style={inputStyle}
                />
              </LabInput>
            ))}
          </div>

          {fechaDestetePred && (
            <div
              className="rounded-xl px-3 py-2 text-xs"
              style={{ background: 'rgba(255,152,0,0.07)', border: '1px solid rgba(255,152,0,0.2)', color: '#ffb74d' }}
            >
              📦 Destete estimado:{' '}
              <span className="font-mono font-bold">{formatFecha(fechaDestetePred)}</span>
              {' '}(21 días post-nacimiento)
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <LabInput label="Destetados">
              <input
                type="number"
                value={form.total_destetados}
                onChange={(e) => cambiar('total_destetados', e.target.value)}
                min={0}
                className="w-full px-3 py-2.5 text-sm focus:outline-none font-mono"
                style={inputStyle}
              />
            </LabInput>
            <LabInput label="Fecha destete real" error={errores.fecha_destete}>
              <input
                type="date"
                value={form.fecha_destete}
                onChange={(e) => cambiar('fecha_destete', e.target.value)}
                className="w-full px-3 py-2.5 text-sm focus:outline-none"
                style={{ ...inputStyle, borderColor: errores.fecha_destete ? 'rgba(255,61,87,0.5)' : undefined }}
              />
            </LabInput>
          </div>

          {/* Toggle incluir en stock */}
          <button
            type="button"
            onClick={() => cambiar('incluir_en_stock', !form.incluir_en_stock)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
            style={
              form.incluir_en_stock
                ? { background: 'rgba(0,230,118,0.07)', border: '1px solid rgba(0,230,118,0.25)', color: '#00e676' }
                : { background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,179,0,0.3)', color: '#ffb300' }
            }
          >
            <span className="flex items-center gap-2 font-semibold">
              <span>📦</span>
              <span>Incluir crías en el stock</span>
              {!form.incluir_en_stock && (
                <span className="text-xs font-normal opacity-70">(solo registro histórico)</span>
              )}
            </span>
            <span
              className="w-9 h-5 rounded-full flex items-center transition-all px-0.5 shrink-0"
              style={{ background: form.incluir_en_stock ? 'rgba(0,230,118,0.4)' : 'rgba(255,179,0,0.4)' }}
            >
              <span
                className="w-4 h-4 rounded-full transition-all"
                style={{
                  background: form.incluir_en_stock ? '#00e676' : '#ffb300',
                  transform: form.incluir_en_stock ? 'translateX(16px)' : 'translateX(0)',
                }}
              />
            </span>
          </button>
        </div>
      )}

      {/* Notas */}
      <LabInput label="Notas">
        <textarea
          value={form.notas}
          onChange={(e) => cambiar('notas', e.target.value)}
          rows={2}
          placeholder="Observaciones opcionales..."
          className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none"
          style={inputStyle}
        />
      </LabInput>

      {/* Falla reproductiva */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: form.failure_flag ? '1px solid rgba(255,61,87,0.35)' : '1px solid rgba(30,51,82,0.6)' }}
      >
        {/* Toggle */}
        <button
          type="button"
          onClick={() => cambiar('failure_flag', !form.failure_flag)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm transition-all"
          style={
            form.failure_flag
              ? { background: 'rgba(255,61,87,0.08)', color: '#ff6b80' }
              : { background: 'rgba(138,155,176,0.04)', color: '#4a5f7a' }
          }
        >
          <span className="flex items-center gap-2 font-semibold">
            <span>⚠</span> Registrar fallo reproductivo
            {form.failure_flag && <span className="text-xs opacity-70 font-normal">(quedará en el historial de la hembra)</span>}
          </span>
          <span
            className="w-9 h-5 rounded-full flex items-center transition-all px-0.5 shrink-0"
            style={{ background: form.failure_flag ? 'rgba(255,61,87,0.4)' : 'rgba(30,51,82,0.8)' }}
          >
            <span
              className="w-4 h-4 rounded-full transition-all"
              style={{
                background: form.failure_flag ? '#ff6b80' : '#4a5f7a',
                transform: form.failure_flag ? 'translateX(16px)' : 'translateX(0)',
              }}
            />
          </span>
        </button>

        {/* Tipo de falla */}
        {form.failure_flag && (
          <div className="px-3 py-3 space-y-2" style={{ borderTop: '1px solid rgba(255,61,87,0.2)' }}>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
              Tipo de falla
            </label>
            <select
              value={form.failure_type}
              onChange={(e) => cambiar('failure_type', e.target.value)}
              className="w-full px-3 py-2.5 text-sm focus:outline-none"
              style={{ ...inputStyle, width: '100%', borderColor: 'rgba(255,61,87,0.3)' }}
            >
              <option value="">— Seleccioná el tipo —</option>
              {TIPOS_FALLA.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{
            background: 'rgba(0,230,118,0.15)',
            border: '1.5px solid rgba(0,230,118,0.4)',
            color: '#00e676',
            boxShadow: '0 0 16px rgba(0,230,118,0.1)',
          }}
        >
          {camada ? 'Guardar cambios' : '+ Registrar camada'}
        </button>
      </div>
    </form>
  )
}
