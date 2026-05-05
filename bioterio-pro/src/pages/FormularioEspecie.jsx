/**
 * FormularioEspecie.jsx — BioteríoPro
 *
 * Pantalla de onboarding: elige un preset de especie o configura una personalizada.
 * Aparece cuando no hay especie guardada en localStorage.
 * Una vez confirmada, se guarda y se redirige al Dashboard.
 */
import { useState } from 'react'
import { useEspecie, PRESETS_ESPECIE } from '../context/EspecieContext'
import { ChevronDown, ChevronUp, Dna } from 'lucide-react'

const CAMPO = ({ label, nombre, valor, onChange, tipo = 'number', min, sufijo }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-rat-gray font-medium">{label}</label>
    <div className="flex items-center gap-1">
      <input
        type={tipo}
        value={valor}
        min={min}
        onChange={(e) => onChange(nombre, tipo === 'number' ? Number(e.target.value) : e.target.value)}
        className="bg-lab-700 border border-lab-border rounded px-2 py-1.5 text-sm text-rat-light w-full focus:outline-none focus:border-neon-green"
      />
      {sufijo && <span className="text-xs text-rat-gray whitespace-nowrap">{sufijo}</span>}
    </div>
  </div>
)

export default function FormularioEspecie() {
  const { setEspecie } = useEspecie()

  const [presetId, setPresetId] = useState(null)
  const [form, setForm] = useState(null)
  const [expanded, setExpanded] = useState(false)

  function elegirPreset(preset) {
    setPresetId(preset.id)
    setForm({ ...preset })
    setExpanded(false)
  }

  function updateField(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }))
  }

  function confirmar() {
    if (!form) return
    setEspecie({ ...form })
  }

  const presets = PRESETS_ESPECIE.filter((p) => p.id !== 'personalizada')

  return (
    <div className="min-h-screen bg-lab-950 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <Dna size={28} className="text-neon-green" />
          <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Bioterio<span className="text-neon-green">Pro</span>
          </span>
        </div>
        <p className="text-rat-gray text-sm">Seleccioná la especie de tu colonia para comenzar</p>
      </div>

      {/* Grid de presets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 w-full max-w-2xl">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => elegirPreset(p)}
            className={`flex flex-col items-start gap-1 p-4 rounded-lg border text-left transition-all ${
              presetId === p.id
                ? 'border-neon-green bg-neon-greenGlow'
                : 'border-lab-border bg-lab-800 hover:border-lab-muted'
            }`}
          >
            <span className="text-2xl">{p.icono}</span>
            <span className="font-semibold text-rat-light text-sm">{p.nombre}</span>
            <span className="text-xs text-rat-gray italic">{p.nombreCientifico}</span>
            <span className="text-xs text-rat-gray mt-1">
              Gestación: <span className="text-rat-light">{p.gestacion_dias}d</span>
            </span>
          </button>
        ))}

        {/* Personalizada */}
        <button
          onClick={() => elegirPreset(PRESETS_ESPECIE.find((p) => p.id === 'personalizada'))}
          className={`flex flex-col items-start gap-1 p-4 rounded-lg border text-left transition-all ${
            presetId === 'personalizada'
              ? 'border-neon-green bg-neon-greenGlow'
              : 'border-dashed border-lab-muted bg-lab-800 hover:border-neon-green'
          }`}
        >
          <span className="text-2xl">🔬</span>
          <span className="font-semibold text-rat-light text-sm">Personalizada</span>
          <span className="text-xs text-rat-gray">Configurá tus propios parámetros</span>
        </button>
      </div>

      {/* Panel de edición de parámetros */}
      {form && (
        <div className="w-full max-w-2xl bg-lab-800 border border-lab-border rounded-xl overflow-hidden mb-6">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm text-rat-gray hover:text-rat-light transition-colors"
          >
            <span>
              {presetId === 'personalizada' ? 'Configurar parámetros biológicos' : `Ver / editar parámetros de ${form.nombre}`}
            </span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expanded && (
            <div className="border-t border-lab-border p-5 space-y-5">
              {/* Nombre e ícono */}
              <div className="grid grid-cols-2 gap-4">
                <CAMPO label="Nombre de la especie" nombre="nombre" valor={form.nombre} onChange={updateField} tipo="text" />
                <CAMPO label="Nombre científico" nombre="nombreCientifico" valor={form.nombreCientifico} onChange={updateField} tipo="text" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CAMPO label="Ícono (emoji)" nombre="icono" valor={form.icono} onChange={updateField} tipo="text" />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-rat-gray font-medium">Color de acento</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => updateField('color', e.target.value)}
                      className="h-9 w-12 rounded cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-xs text-rat-gray">{form.color}</span>
                  </div>
                </div>
              </div>

              {/* Parámetros biológicos */}
              <div>
                <p className="text-xs text-neon-green font-semibold uppercase tracking-widest mb-3">Parámetros biológicos</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <CAMPO label="Gestación" nombre="gestacion_dias" valor={form.gestacion_dias} onChange={updateField} min={1} sufijo="días" />
                  <CAMPO label="Destete" nombre="destete_dias" valor={form.destete_dias} onChange={updateField} min={1} sufijo="días" />
                  <CAMPO label="Madurez sexual" nombre="madurez_dias" valor={form.madurez_dias} onChange={updateField} min={1} sufijo="días" />
                  <CAMPO label="Ciclo estral" nombre="ciclo_estral_dias" valor={form.ciclo_estral_dias} onChange={updateField} min={1} sufijo="días" />
                  <CAMPO label="Apareamiento" nombre="duracion_apareamiento_dias" valor={form.duracion_apareamiento_dias} onChange={updateField} min={1} sufijo="días" />
                  <CAMPO label="Ventana concepción" nombre="ventana_concepcion_max" valor={form.ventana_concepcion_max} onChange={updateField} min={1} sufijo="días" />
                </div>
              </div>

              {/* Datos informativos */}
              <div>
                <p className="text-xs text-neon-green font-semibold uppercase tracking-widest mb-3">Datos informativos (opcionales)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <CAMPO label="Camada promedio" nombre="camadaPromedio" valor={form.camadaPromedio} onChange={updateField} tipo="text" />
                  <CAMPO label="Vida reproductiva" nombre="vidaReproductiva" valor={form.vidaReproductiva} onChange={updateField} tipo="text" />
                  <CAMPO label="Orden taxonómico" nombre="orden" valor={form.orden} onChange={updateField} tipo="text" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botón confirmar */}
      <button
        onClick={confirmar}
        disabled={!form}
        className="px-8 py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: form ? '#00e676' : undefined,
          color: form ? '#050810' : undefined,
          backgroundColor: form ? undefined : '#1e2f55',
        }}
      >
        {form ? `Comenzar con ${form.nombre}` : 'Seleccioná una especie'}
      </button>

      <p className="text-xs text-rat-gray mt-4 text-center max-w-sm">
        Los datos se guardan localmente en tu navegador. Podés cambiar la especie en cualquier momento desde el sidebar.
      </p>
    </div>
  )
}
