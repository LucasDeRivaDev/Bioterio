import { useState } from 'react'
import { useBioterio } from '../context/BiotheriumContext'

const estadoOpciones = [
  { value: 'activo', label: 'Activo' },
  { value: 'en_cria', label: 'En cría' },
  { value: 'retirado', label: 'Retirado' },
  { value: 'fallecido', label: 'Fallecido' },
]

const vacioAnimal = {
  codigo: '',
  sexo: 'hembra',
  fecha_nacimiento: '',
  id_madre: '',
  id_padre: '',
  estado: 'activo',
  notas: '',
  nota_tipo: 'normal',
}

// Estilos de input oscuros reutilizables
const inputStyle = {
  background: 'rgba(8,13,26,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '10px',
}
const inputFocusClass = 'focus:outline-none'

function LabInput({ label, sublabel, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
        {label} {sublabel && <span className="normal-case tracking-normal font-normal opacity-60">{sublabel}</span>}
      </label>
      {children}
      {error && <p className="text-xs mt-1" style={{ color: '#ff6b80' }}>{error}</p>}
    </div>
  )
}

export default function AnimalForm({ animal, onGuardar, onCancelar }) {
  const { animales } = useBioterio()
  const [form, setForm] = useState(animal ?? vacioAnimal)
  const [errores, setErrores] = useState({})

  const hembras = animales.filter((a) => a.sexo === 'hembra' && a.id !== animal?.id)
  const machos = animales.filter((a) => a.sexo === 'macho' && a.id !== animal?.id)

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: '' }))
  }

  function validar() {
    const nuevos = {}
    if (!form.codigo.trim()) nuevos.codigo = 'El código es obligatorio'
    if (!form.fecha_nacimiento) nuevos.fecha_nacimiento = 'La fecha de nacimiento es obligatoria'
    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  function manejarEnvio(e) {
    e.preventDefault()
    if (!validar()) return
    onGuardar(form)
  }

  function sugerirCodigo() {
    if (form.codigo) return
    const prefijo = form.sexo === 'hembra' ? 'A' : 'M'
    const usados = animales
      .filter((a) => a.sexo === form.sexo)
      .map((a) => parseInt(a.codigo.replace(/\D/g, '')) || 0)
    const siguiente = usados.length > 0 ? Math.max(...usados) + 1 : 1
    cambiar('codigo', `${prefijo}${siguiente}`)
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      {/* Sexo */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8a9bb0' }}>
          Sexo
        </label>
        <div className="flex gap-3">
          {[
            { value: 'hembra', label: '♀ Hembra', color: '#ce93d8' },
            { value: 'macho', label: '♂ Macho', color: '#40c4ff' },
          ].map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => cambiar('sexo', value)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={
                form.sexo === value
                  ? {
                      background: `${color}18`,
                      border: `1.5px solid ${color}55`,
                      color: color,
                      boxShadow: `0 0 10px ${color}22`,
                    }
                  : {
                      background: 'rgba(8,13,26,0.5)',
                      border: '1px solid rgba(30,51,82,0.6)',
                      color: '#4a5f7a',
                    }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Código */}
      <LabInput label="Código" sublabel="ej: A1, M3" error={errores.codigo}>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.codigo}
            onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())}
            onBlur={sugerirCodigo}
            placeholder={form.sexo === 'hembra' ? 'A1' : 'M1'}
            className={`flex-1 px-3 py-2.5 text-sm ${inputFocusClass} font-mono`}
            style={{
              ...inputStyle,
              borderColor: errores.codigo ? 'rgba(255,61,87,0.5)' : undefined,
            }}
          />
          <button
            type="button"
            onClick={sugerirCodigo}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', color: '#00e676' }}
          >
            Auto
          </button>
        </div>
      </LabInput>

      {/* Fecha de nacimiento */}
      <LabInput label="Fecha de nacimiento" error={errores.fecha_nacimiento}>
        <input
          type="date"
          value={form.fecha_nacimiento}
          onChange={(e) => cambiar('fecha_nacimiento', e.target.value)}
          className={`w-full px-3 py-2.5 text-sm ${inputFocusClass}`}
          style={{
            ...inputStyle,
            borderColor: errores.fecha_nacimiento ? 'rgba(255,61,87,0.5)' : undefined,
          }}
        />
      </LabInput>

      {/* Progenitores */}
      <div className="grid grid-cols-2 gap-3">
        <LabInput label="Madre">
          <select
            value={form.id_madre}
            onChange={(e) => cambiar('id_madre', e.target.value)}
            className={`w-full px-3 py-2.5 text-sm ${inputFocusClass}`}
            style={inputStyle}
          >
            <option value="">— Sin registro —</option>
            {hembras.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </LabInput>
        <LabInput label="Padre">
          <select
            value={form.id_padre}
            onChange={(e) => cambiar('id_padre', e.target.value)}
            className={`w-full px-3 py-2.5 text-sm ${inputFocusClass}`}
            style={inputStyle}
          >
            <option value="">— Sin registro —</option>
            {machos.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </LabInput>
      </div>

      {/* Estado */}
      <LabInput label="Estado">
        <select
          value={form.estado}
          onChange={(e) => cambiar('estado', e.target.value)}
          className={`w-full px-3 py-2.5 text-sm ${inputFocusClass}`}
          style={inputStyle}
        >
          {estadoOpciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </LabInput>

      {/* Notas */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
          Notas / Observaciones
        </label>
        <textarea
          value={form.notas}
          onChange={(e) => {
            cambiar('notas', e.target.value)
            if (!e.target.value.trim()) cambiar('nota_tipo', 'normal')
          }}
          rows={2}
          placeholder="Observaciones opcionales..."
          className={`w-full px-3 py-2.5 text-sm resize-none ${inputFocusClass}`}
          style={{
            ...inputStyle,
            borderColor: form.nota_tipo === 'critica' && form.notas.trim() ? 'rgba(255,23,68,0.5)' : undefined,
          }}
        />
        {/* Tipo de nota — solo visible si hay texto */}
        {form.notas.trim() && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs" style={{ color: '#4a5f7a' }}>Tipo:</span>
            {[
              { value: 'normal',  label: '⚠ Normal',  color: '#ffb300' },
              { value: 'critica', label: '🔴 Crítica', color: '#ff1744' },
            ].map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => cambiar('nota_tipo', value)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={form.nota_tipo === value
                  ? { background: `${color}18`, border: `1px solid ${color}55`, color }
                  : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
                }
              >
                {label}
              </button>
            ))}
            {form.nota_tipo === 'critica' && (
              <span className="text-xs" style={{ color: '#ff1744' }}>Prioridad máxima</span>
            )}
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{
            background: 'rgba(0,230,118,0.15)',
            border: '1.5px solid rgba(0,230,118,0.4)',
            color: '#00e676',
            boxShadow: '0 0 16px rgba(0,230,118,0.1)',
          }}
        >
          {animal ? 'Guardar cambios' : '+ Agregar animal'}
        </button>
      </div>
    </form>
  )
}
