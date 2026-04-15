import { useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { calcularRangoParto, calcularDestete, formatFecha, hoy } from '../utils/calculos'

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

export default function CamadaForm({ camada, onGuardar, onCancelar }) {
  const { animales } = useBioterio()
  const [form, setForm] = useState(camada ? normalizarCamada(camada) : vacioCamada)
  const [errores, setErrores] = useState({})
  const [modoHistorico, setModoHistorico] = useState(false)

  // En modo normal: solo activos. En modo histórico: todos.
  const hembrasBase = animales.filter((a) => a.sexo === 'hembra')
  const machosBase  = animales.filter((a) => a.sexo === 'macho')
  const hembras = modoHistorico ? hembrasBase : hembrasBase.filter((a) => ESTADOS_ACTIVOS.includes(a.estado))
  const machos  = modoHistorico ? machosBase  : machosBase.filter((a)  => ESTADOS_ACTIVOS.includes(a.estado))

  const madreSelec = animales.find((a) => a.id === form.id_madre)
  const padreSelec = animales.find((a) => a.id === form.id_padre)
  const fechaEsPasada = form.fecha_copula && form.fecha_copula < hoy()

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: '' }))
  }

  function validar() {
    const nuevos = {}
    if (!form.id_madre) nuevos.id_madre = 'Seleccioná una hembra'
    if (!form.id_padre) nuevos.id_padre = 'Seleccioná un macho'
    if (!form.fecha_copula) nuevos.fecha_copula = 'La fecha de cópula es obligatoria'

    // No permitir apareamiento futuro con animales inactivos
    if (form.fecha_copula && form.fecha_copula >= hoy()) {
      if (esInactivo(madreSelec)) nuevos.id_madre = 'No se puede asignar una hembra inactiva a un apareamiento futuro'
      if (esInactivo(padreSelec)) nuevos.id_padre = 'No se puede asignar un macho inactivo a un apareamiento futuro'
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

  const rango = form.fecha_copula ? calcularRangoParto(form.fecha_copula) : null
  const fechaDestetePred = form.fecha_nacimiento ? calcularDestete(form.fecha_nacimiento) : null

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
            {hembras.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo}{esInactivo(a) ? ` (${etiquetaEstado[a.estado] ?? a.estado})` : ''}
              </option>
            ))}
          </select>
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
            {machos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo}{esInactivo(a) ? ` (${etiquetaEstado[a.estado] ?? a.estado})` : ''}
              </option>
            ))}
          </select>
          {esInactivo(padreSelec) && fechaEsPasada && (
            <p className="text-xs mt-1" style={{ color: '#ffb300' }}>
              Animal inactivo — permitido solo para carga histórica
            </p>
          )}
        </LabInput>
      </div>

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
      <LabInput label="Fecha de nacimiento" sublabel="completar cuando ocurra">
        <input
          type="date"
          value={form.fecha_nacimiento}
          onChange={(e) => cambiar('fecha_nacimiento', e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none"
          style={inputStyle}
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
            <LabInput label="Fecha destete real">
              <input
                type="date"
                value={form.fecha_destete}
                onChange={(e) => cambiar('fecha_destete', e.target.value)}
                className="w-full px-3 py-2.5 text-sm focus:outline-none"
                style={inputStyle}
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
