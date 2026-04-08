import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha, hoy, difDias, parseDate } from '../utils/calculos'
import { BIO } from '../utils/constants'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

const inputStyle = {
  background: 'rgba(8,13,26,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '10px',
}

const CATEGORIAS = [
  { value: '', label: '— Sin especificar —' },
  { value: 'cria', label: 'Cría (post-destete, < 6 sem)' },
  { value: 'joven', label: 'Joven (6–12 semanas)' },
  { value: 'adulto_nr', label: 'Adulto no reproductor (> 12 sem)' },
  { value: 'reproductor', label: 'Reproductor' },
  { value: 'otro', label: 'Otro' },
]

// Stock disponible de una camada restando sacrificios previos
function calcStockDisponible(camada, sacrificios) {
  const sacCount = sacrificios
    .filter((s) => s.camada_id === camada.id)
    .reduce((sum, s) => sum + s.cantidad, 0)
  const base = camada.total_destetados ?? camada.total_crias ?? 0
  return Math.max(0, base - sacCount)
}

// Categoría automática por edad
function categoriaPorEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const edad = difDias(parseDate(fechaNacimiento), parseDate(hoy()))
  if (edad < BIO.DESTETE_DIAS) return 'cria_lactante'
  if (edad < 42) return 'cria'
  if (edad < BIO.MADUREZ_DIAS) return 'joven'
  return 'adulto_nr'
}

const labelCategoria = {
  cria: 'Cría',
  joven: 'Joven',
  adulto_nr: 'Adulto NR',
  reproductor: 'Reproductor',
  otro: 'Otro',
}

// ── Formulario ───────────────────────────────────────────────────────────────

const formVacio = {
  camada_id: '',
  cantidad: '',
  fecha: hoy(),
  categoria: '',
  jaula: '',
  notas: '',
}

function FormSacrificio({ animales, camadas, sacrificios, onGuardar, onCancelar }) {
  const [form, setForm] = useState(formVacio)
  const [error, setError]       = useState('')
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setError('')
    // Auto-sugerir categoría al seleccionar camada
    if (campo === 'camada_id') {
      const camada = camadas.find((c) => c.id === valor)
      if (camada) {
        const cat = categoriaPorEdad(camada.fecha_nacimiento)
        if (cat && cat !== 'cria_lactante') setForm((prev) => ({ ...prev, camada_id: valor, categoria: cat }))
      }
    }
  }

  // Camadas con stock disponible
  const camadasConStock = useMemo(() =>
    camadas
      .filter((c) => c.fecha_nacimiento)
      .map((c) => {
        const madre = animales.find((a) => a.id === c.id_madre)
        const padre = animales.find((a) => a.id === c.id_padre)
        const stock = calcStockDisponible(c, sacrificios)
        return { ...c, madre, padre, stock }
      })
      .filter((c) => c.stock > 0)
      .sort((a, b) => (b.fecha_nacimiento ?? '').localeCompare(a.fecha_nacimiento ?? '')),
  [animales, camadas, sacrificios])

  const camadaSeleccionada = camadasConStock.find((c) => c.id === form.camada_id)
  const stockDisponible = camadaSeleccionada ? camadaSeleccionada.stock : 0
  const cantidadNum = parseInt(form.cantidad) || 0

  async function manejarEnvio(e) {
    e.preventDefault()
    if (!form.camada_id) { setError('Seleccioná una camada/grupo.'); return }
    if (!form.cantidad || cantidadNum <= 0) { setError('Ingresá una cantidad válida.'); return }
    if (cantidadNum > stockDisponible) {
      setError(`No podés sacrificar más de ${stockDisponible} animales disponibles en esta camada.`)
      return
    }
    setGuardando(true)
    try {
      await onGuardar({
        camada_id: form.camada_id,
        cantidad: cantidadNum,
        fecha: form.fecha,
        categoria: form.categoria || null,
        jaula: form.jaula.trim() || null,
        notas: form.notas.trim() || null,
      })
    } catch {
      setError('No se pudo registrar el sacrificio. Verificá la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      {/* Camada */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
          Grupo / Camada de origen
        </label>
        <select
          value={form.camada_id}
          onChange={(e) => cambiar('camada_id', e.target.value)}
          className="w-full px-3 py-2.5 text-sm focus:outline-none"
          style={inputStyle}
        >
          <option value="">— Seleccioná una camada —</option>
          {camadasConStock.map((c) => (
            <option key={c.id} value={c.id}>
              {c.madre?.codigo ?? '?'} × {c.padre?.codigo ?? '?'} · nac. {formatFecha(c.fecha_nacimiento)} · {c.stock} disponibles
            </option>
          ))}
        </select>
        {camadaSeleccionada && (
          <div
            className="mt-2 px-3 py-2 rounded-lg text-xs font-mono flex gap-4"
            style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.15)' }}
          >
            <span style={{ color: '#00e676' }}>Stock disponible: <strong>{stockDisponible}</strong></span>
            <span style={{ color: '#4a5f7a' }}>Nac: {formatFecha(camadaSeleccionada.fecha_nacimiento)}</span>
            <span style={{ color: '#4a5f7a' }}>Total crías: {camadaSeleccionada.total_crias ?? '?'}</span>
          </div>
        )}
        {camadasConStock.length === 0 && (
          <p className="text-xs mt-1" style={{ color: '#ffb300' }}>
            No hay camadas con stock disponible actualmente.
          </p>
        )}
      </div>

      {/* Cantidad + Fecha */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
            Cantidad a sacrificar
          </label>
          <input
            type="number"
            min="1"
            max={stockDisponible || undefined}
            value={form.cantidad}
            onChange={(e) => cambiar('cantidad', e.target.value)}
            placeholder={stockDisponible ? `Máx. ${stockDisponible}` : '0'}
            className="w-full px-3 py-2.5 text-sm focus:outline-none font-mono"
            style={{
              ...inputStyle,
              borderColor: cantidadNum > stockDisponible && stockDisponible > 0 ? 'rgba(255,61,87,0.5)' : undefined,
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
            Fecha del sacrificio
          </label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => cambiar('fecha', e.target.value)}
            className="w-full px-3 py-2.5 text-sm focus:outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Categoría + Jaula */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
            Categoría <span className="normal-case font-normal opacity-60">(opcional)</span>
          </label>
          <select
            value={form.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)}
            className="w-full px-3 py-2.5 text-sm focus:outline-none"
            style={inputStyle}
          >
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
            Jaula <span className="normal-case font-normal opacity-60">(opcional)</span>
          </label>
          <input
            type="text"
            value={form.jaula}
            onChange={(e) => cambiar('jaula', e.target.value)}
            placeholder="ej: J-01"
            className="w-full px-3 py-2.5 text-sm focus:outline-none font-mono"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#8a9bb0' }}>
          Notas <span className="normal-case font-normal opacity-60">(opcional)</span>
        </label>
        <textarea
          value={form.notas}
          onChange={(e) => cambiar('notas', e.target.value)}
          rows={2}
          placeholder="Motivo, protocolo, observaciones..."
          className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none"
          style={inputStyle}
        />
      </div>

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}
        >
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
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
          disabled={guardando}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
          style={{
            background: 'rgba(255,107,128,0.15)',
            border: '1.5px solid rgba(255,107,128,0.4)',
            color: '#ff6b80',
            opacity: guardando ? 0.6 : 1,
          }}
        >
          {guardando ? 'Registrando...' : '🗡 Registrar sacrificio'}
        </button>
      </div>
    </form>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function Sacrificios() {
  const { animales, camadas, sacrificios, registrarSacrificio, eliminarSacrificio } = useBioterio()
  const [mostrarForm, setMostrarForm] = useState(false)

  // Enriquecer lista de sacrificios con datos de camada
  const listaEnriquecida = useMemo(() =>
    [...sacrificios]
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
      .map((s) => {
        const camada = camadas.find((c) => c.id === s.camada_id)
        const madre = camada ? animales.find((a) => a.id === camada.id_madre) : null
        const padre = camada ? animales.find((a) => a.id === camada.id_padre) : null
        return { ...s, camada, madre, padre }
      }),
  [sacrificios, camadas, animales])

  const totalSacrificados = sacrificios.reduce((sum, s) => sum + s.cantidad, 0)

  async function handleGuardar(datos) {
    await registrarSacrificio(datos)
    setMostrarForm(false)
  }

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#ff6b80', boxShadow: '0 0 8px rgba(255,107,128,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Registro de sacrificios</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
              El stock se actualiza automáticamente al registrar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalSacrificados > 0 && (
            <div
              className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,107,128,0.07)', border: '1px solid rgba(255,107,128,0.2)' }}
            >
              <span className="font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>{totalSacrificados}</span>
              <span className="text-xs ml-1.5" style={{ color: '#4a5f7a' }}>sacrificados total</span>
            </div>
          )}
          {!mostrarForm && (
            <button
              onClick={() => setMostrarForm(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: 'rgba(255,107,128,0.15)',
                border: '1.5px solid rgba(255,107,128,0.4)',
                color: '#ff6b80',
                boxShadow: '0 0 16px rgba(255,107,128,0.1)',
              }}
            >
              + Registrar sacrificio
            </button>
          )}
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,107,128,0.15)', background: 'rgba(255,107,128,0.04)' }}
          >
            <div className="text-sm font-bold" style={{ color: '#ff6b80' }}>🗡 Nuevo registro de sacrificio</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
              El stock de la camada se reducirá automáticamente
            </div>
          </div>
          <div className="px-5 py-5">
            <FormSacrificio
              animales={animales}
              camadas={camadas}
              sacrificios={sacrificios}
              onGuardar={handleGuardar}
              onCancelar={() => setMostrarForm(false)}
            />
          </div>
        </div>
      )}

      {/* Lista de sacrificios */}
      {listaEnriquecida.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: 'rgba(255,107,128,0.04)', border: '1px dashed rgba(255,107,128,0.2)' }}
        >
          <div className="text-3xl mb-2">📋</div>
          <div className="font-semibold text-sm" style={{ color: '#ff6b80' }}>Sin sacrificios registrados</div>
          <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
            Los registros aparecerán acá y descontarán el stock automáticamente
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div
            className="px-5 py-3"
            style={{ borderBottom: '1px solid rgba(30,51,82,0.8)', background: 'rgba(0,0,0,0.15)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>
              Historial de sacrificios
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                {['Fecha', 'Grupo / Camada', 'Cantidad', 'Categoría', 'Jaula', 'Notas', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: '#4a5f7a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaEnriquecida.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: '#8a9bb0' }}>
                    {formatFecha(s.fecha)}
                  </td>
                  <td className="px-4 py-3">
                    {s.madre && s.padre ? (
                      <span className="font-mono font-semibold">
                        <span style={{ color: '#ce93d8' }}>{s.madre.codigo}</span>
                        <span style={{ color: '#4a5f7a' }}> × </span>
                        <span style={{ color: '#40c4ff' }}>{s.padre.codigo}</span>
                      </span>
                    ) : (
                      <span style={{ color: '#4a5f7a' }}>—</span>
                    )}
                    {s.camada?.fecha_nacimiento && (
                      <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                        nac. {formatFecha(s.camada.fecha_nacimiento)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>
                    {s.cantidad}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8a9bb0' }}>
                    {s.categoria ? labelCategoria[s.categoria] ?? s.categoria : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8a9bb0' }}>
                    {s.jaula ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#4a5f7a', maxWidth: '180px' }}>
                    {s.notas ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Eliminar este registro de ${s.cantidad} sacrificios? Esto restaurará el stock de la camada.`))
                          eliminarSacrificio(s.id)
                      }}
                      className="text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
