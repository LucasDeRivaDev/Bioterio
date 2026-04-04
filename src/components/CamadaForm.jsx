import { useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { calcularRangoParto, calcularDestete, formatFecha } from '../utils/calculos'

const vacioCamada = {
  id_madre: '', id_padre: '', fecha_copula: '', fecha_nacimiento: '',
  gestacion_real: '', total_crias: '', crias_machos: '', crias_hembras: '',
  total_destetados: '', fecha_destete: '', notas: '',
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

export default function CamadaForm({ camada, onGuardar, onCancelar }) {
  const { animales } = useBioterio()
  const [form, setForm] = useState(camada ?? vacioCamada)
  const [errores, setErrores] = useState({})

  const hembras = animales.filter((a) => a.sexo === 'hembra' && a.estado !== 'fallecido')
  const machos = animales.filter((a) => a.sexo === 'macho' && a.estado !== 'fallecido')

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: '' }))
  }

  function validar() {
    const nuevos = {}
    if (!form.id_madre) nuevos.id_madre = 'Seleccioná una hembra'
    if (!form.id_padre) nuevos.id_padre = 'Seleccioná un macho'
    if (!form.fecha_copula) nuevos.fecha_copula = 'La fecha de cópula es obligatoria'
    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  function manejarEnvio(e) {
    e.preventDefault()
    if (!validar()) return
    onGuardar({
      ...form,
      gestacion_real: form.gestacion_real ? Number(form.gestacion_real) : null,
      total_crias: form.total_crias ? Number(form.total_crias) : null,
      crias_machos: form.crias_machos ? Number(form.crias_machos) : null,
      crias_hembras: form.crias_hembras ? Number(form.crias_hembras) : null,
      total_destetados: form.total_destetados ? Number(form.total_destetados) : null,
    })
  }

  const rango = form.fecha_copula ? calcularRangoParto(form.fecha_copula) : null
  const fechaDestetePred = form.fecha_nacimiento ? calcularDestete(form.fecha_nacimiento) : null

  const selectStyle = { ...inputStyle, width: '100%' }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
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
            {hembras.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </LabInput>
        <LabInput label="Macho" required error={errores.id_padre}>
          <select
            value={form.id_padre}
            onChange={(e) => cambiar('id_padre', e.target.value)}
            className="px-3 py-2.5 text-sm focus:outline-none"
            style={{ ...selectStyle, borderColor: errores.id_padre ? 'rgba(255,61,87,0.5)' : undefined }}
          >
            <option value="">— Seleccioná —</option>
            {machos.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
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
