import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { difDias, parseDate, hoy, formatFecha } from '../utils/calculos'
import { BIO } from '../utils/constants'
import Modal from '../components/Modal'
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ── Helpers ──────────────────────────────────────────────────────────────────

function edadDias(fechaNacimiento) {
  if (!fechaNacimiento) return null
  return difDias(parseDate(fechaNacimiento), parseDate(hoy()))
}

function stockCamada(camada, sacrificios) {
  const sacCount = sacrificios
    .filter((s) => s.camada_id === camada.id)
    .reduce((sum, s) => sum + s.cantidad, 0)
  const base = camada.total_destetados ?? camada.total_crias ?? 0
  return Math.max(0, base - sacCount)
}

function formatEdad(dias) {
  if (dias === null || dias === undefined) return '—'
  if (dias < 21) return `${dias}d`
  if (dias < 84) return `${Math.floor(dias / 7)}sem`
  return `${Math.floor(dias / 30)}m`
}

// ── Configuración de categorías ───────────────────────────────────────────────

const CAT = {
  macho_repro:  { label: 'Macho reproductor',  color: '#40c4ff', bg: 'rgba(64,196,255,0.1)',   borde: 'rgba(64,196,255,0.3)',   icono: '♂' },
  hembra_repro: { label: 'Hembra reproductora', color: '#ce93d8', bg: 'rgba(206,147,216,0.1)',  borde: 'rgba(206,147,216,0.3)', icono: '♀' },
  crias:        { label: 'Crías',               color: '#00e676', bg: 'rgba(0,230,118,0.08)',   borde: 'rgba(0,230,118,0.25)',  icono: '🐣' },
  jovenes:      { label: 'Jóvenes',             color: '#ffb300', bg: 'rgba(255,179,0,0.08)',   borde: 'rgba(255,179,0,0.25)',  icono: '🐭' },
  adultos:      { label: 'Adultos',             color: '#ff6b80', bg: 'rgba(255,61,87,0.08)',   borde: 'rgba(255,61,87,0.25)', icono: '🐀' },
}

function categoriaStock(edad) {
  if (edad < 42) return 'crias'
  if (edad < BIO.MADUREZ_DIAS) return 'jovenes'
  return 'adultos'
}

// ── Componentes ───────────────────────────────────────────────────────────────

function ChipCategoria({ label, animales, jaulas, color }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono"
      style={{ background: `${color}10`, border: `1px solid ${color}28` }}
    >
      <span style={{ color, opacity: 0.7 }}>{label}</span>
      <span className="font-bold" style={{ color }}>{animales}</span>
      <span style={{ color: '#4a5f7a' }}>({jaulas})</span>
    </div>
  )
}

const COLOR_MACHO  = '#40c4ff'
const COLOR_HEMBRA = '#ce93d8'

function SexoDisplay({ bloque, cfg }) {
  const { tipo, animal, machos, hembras, total } = bloque

  if (tipo === 'reproductor') {
    const esMacho = animal.sexo === 'macho'
    return (
      <div className="flex items-center gap-1 text-xs font-mono font-semibold">
        <span style={{ color: esMacho ? COLOR_MACHO : COLOR_HEMBRA }}>
          {esMacho ? '♂ 1 Macho' : '♀ 1 Hembra'}
        </span>
      </div>
    )
  }

  // Jaula de stock — ambos sexos conocidos
  if (machos != null && hembras != null) {
    if (machos === 0) {
      return (
        <div className="flex items-center gap-1 text-xs font-mono font-semibold">
          <span style={{ color: COLOR_HEMBRA }}>♀ {hembras} {hembras === 1 ? 'Hembra' : 'Hembras'}</span>
        </div>
      )
    }
    if (hembras === 0) {
      return (
        <div className="flex items-center gap-1 text-xs font-mono font-semibold">
          <span style={{ color: COLOR_MACHO }}>♂ {machos} {machos === 1 ? 'Macho' : 'Machos'}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-xs font-mono font-semibold">
        <span style={{ color: COLOR_MACHO }}>♂{machos}M</span>
        <span style={{ color: '#4a5f7a' }}>/</span>
        <span style={{ color: COLOR_HEMBRA }}>♀{hembras}H</span>
        <span style={{ color: '#4a5f7a', fontWeight: 400 }}>= {total}</span>
      </div>
    )
  }

  // Solo uno de los dos conocido
  if (machos != null) {
    return (
      <div className="flex items-center gap-1 text-xs font-mono font-semibold">
        <span style={{ color: COLOR_MACHO }}>♂{machos}M</span>
        <span style={{ color: '#4a5f7a' }}>/</span>
        <span style={{ color: COLOR_HEMBRA }}>♀?</span>
        <span style={{ color: '#4a5f7a', fontWeight: 400 }}>= {total}</span>
      </div>
    )
  }
  if (hembras != null) {
    return (
      <div className="flex items-center gap-1 text-xs font-mono font-semibold">
        <span style={{ color: COLOR_MACHO }}>♂?</span>
        <span style={{ color: '#4a5f7a' }}>/</span>
        <span style={{ color: COLOR_HEMBRA }}>♀{hembras}H</span>
        <span style={{ color: '#4a5f7a', fontWeight: 400 }}>= {total}</span>
      </div>
    )
  }

  // Sin datos de sexo — mostrar total con aviso
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-xs font-mono font-semibold" style={{ color: cfg.color }}>
        {total} {total === 1 ? 'animal' : 'animales'}
      </div>
      <div className="text-xs" style={{ color: '#4a5f7a' }}>sexo sin registrar</div>
    </div>
  )
}

function BloqueJaula({ bloque, onClick, modoSeleccion = false, seleccionada = false }) {
  const cfg = CAT[bloque.categoria]
  const esSeleccionable = modoSeleccion && !bloque.virtual
  return (
    <button
      onClick={() => onClick(bloque)}
      disabled={false}
      className="rounded-xl overflow-hidden text-left w-full transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: seleccionada ? 'rgba(255,61,87,0.08)' : 'rgba(13,21,40,0.9)',
        border: seleccionada ? '2px solid rgba(255,61,87,0.7)' : `1px solid ${cfg.borde}`,
        boxShadow: seleccionada ? '0 0 16px rgba(255,61,87,0.15)' : `0 0 12px ${cfg.bg}`,
        opacity: modoSeleccion && !esSeleccionable ? 0.35 : 1,
        position: 'relative',
        cursor: modoSeleccion && !esSeleccionable ? 'default' : 'pointer',
      }}
    >
      {/* Indicador de selección */}
      {modoSeleccion && esSeleccionable && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10"
          style={seleccionada
            ? { background: '#ff6b80', color: '#050810' }
            : { border: '2px solid rgba(255,61,87,0.4)', background: 'rgba(5,8,16,0.6)' }}
        >
          {seleccionada && '✓'}
        </div>
      )}

      {/* Header coloreado */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.borde}` }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
          {cfg.icono} {cfg.label}
        </span>
        {bloque.virtual && (
          <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(255,179,0,0.2)', color: '#ffb300' }}>
            sin asignar
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="px-3 py-3 space-y-1.5">
        <div className="font-mono font-bold text-sm text-white">
          {bloque.tipo === 'reproductor'
            ? bloque.animal.codigo
            : `${bloque.madre?.codigo ?? '?'} × ${bloque.padre?.codigo ?? '?'}`}
        </div>
        <SexoDisplay bloque={bloque} cfg={cfg} />
        <div className="text-xs" style={{ color: '#4a5f7a' }}>
          {bloque.edad != null ? `${formatEdad(bloque.edad)} · ${bloque.edad}d` : '—'}
        </div>
      </div>
    </button>
  )
}

const labelEstadoRepro = { activo: 'Activo', en_apareamiento: 'En apareamiento', en_cria: 'En cría', retirado: 'Retirado', fallecido: 'Fallecido' }

function JaulaModal({ bloque, jaulas, camadas, animales, onCerrar, editarJaula, agregarJaula }) {
  const cfg       = CAT[bloque.categoria]
  const esRepro   = bloque.tipo === 'reproductor'
  const esVirtual = Boolean(bloque.virtual)
  const esReal    = bloque.tipo === 'stock' && !esVirtual

  const [modo, setModo] = useState('ver')

  // ── Editar ────────────────────────────────────────────────────────
  const [eTotal,   setETotal]   = useState(String(bloque.total))
  const [eMachos,  setEMachos]  = useState(bloque.machos  != null ? String(bloque.machos)  : '')
  const [eHembras, setEHembras] = useState(bloque.hembras != null ? String(bloque.hembras) : '')
  const [eNotas,   setENotas]   = useState(bloque.jaula?.notas ?? '')

  // ── Dividir ───────────────────────────────────────────────────────
  const [parts, setParts] = useState([
    { total: String(bloque.total), machos: bloque.machos != null ? String(bloque.machos) : '', hembras: bloque.hembras != null ? String(bloque.hembras) : '' },
    { total: '0', machos: '', hembras: '' },
  ])
  const sumaParts = parts.reduce((s, p) => s + (parseInt(p.total) || 0), 0)
  const partsOk   = sumaParts === bloque.total && parts.every((p) => (parseInt(p.total) || 0) >= 0)

  // ── Mover ─────────────────────────────────────────────────────────
  const jaulasDestino = jaulas.filter((j) => j.id !== bloque.jaula?.id)
  const [destinoId, setDestinoId] = useState(jaulasDestino[0]?.id ?? '')
  const [cantMover, setCantMover] = useState('1')
  const cantN   = parseInt(cantMover) || 0
  const moverOk = destinoId && cantN > 0 && cantN <= bloque.total

  // ── Estilos comunes ───────────────────────────────────────────────
  const iStyle = {
    background: 'rgba(5,8,16,0.6)', border: '1px solid rgba(30,51,82,0.8)',
    color: '#e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.6rem',
    fontSize: '0.8125rem', fontFamily: 'monospace', width: '100%', outline: 'none',
  }
  const btnTab = (m, label) => (
    <button
      key={m} onClick={() => setModo(m)}
      style={modo === m
        ? { background: `${cfg.color}18`, border: `1px solid ${cfg.color}45`, color: cfg.color, borderRadius: '0.5rem', padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600 }
        : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a', borderRadius: '0.5rem', padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600 }}
    >{label}</button>
  )

  // ── Handlers ──────────────────────────────────────────────────────
  async function guardarEdicion() {
    const total   = Math.max(0, parseInt(eTotal) || 0)
    const machos  = eMachos  !== '' ? parseInt(eMachos)  : null
    const hembras = eHembras !== '' ? parseInt(eHembras) : null
    await editarJaula({ ...bloque.jaula, total, machos, hembras, notas: eNotas })
    onCerrar()
  }

  async function guardarDividir() {
    if (!partsOk) return
    const validas = parts.filter((p) => (parseInt(p.total) || 0) > 0)
    await editarJaula({
      ...bloque.jaula,
      total:   parseInt(validas[0].total),
      machos:  validas[0].machos  !== '' ? parseInt(validas[0].machos)  : null,
      hembras: validas[0].hembras !== '' ? parseInt(validas[0].hembras) : null,
    })
    for (const p of validas.slice(1)) {
      await agregarJaula({
        camada_id: bloque.camada.id,
        total:   parseInt(p.total),
        machos:  p.machos  !== '' ? parseInt(p.machos)  : null,
        hembras: p.hembras !== '' ? parseInt(p.hembras) : null,
        notas: '',
      })
    }
    onCerrar()
  }

  async function guardarMover() {
    if (!moverOk) return
    const destino = jaulas.find((j) => j.id === destinoId)
    if (!destino) return
    await editarJaula({ ...bloque.jaula, total: bloque.jaula.total - cantN })
    await editarJaula({ ...destino,       total: destino.total       + cantN })
    onCerrar()
  }

  async function convertirAJaula() {
    await agregarJaula({
      camada_id: bloque.camada.id,
      total:   bloque.total,
      machos:  bloque.machos  ?? null,
      hembras: bloque.hembras ?? null,
      notas: '',
    })
    onCerrar()
  }

  return (
    <Modal titulo="Jaula" onCerrar={onCerrar} ancho="max-w-sm">
      <div className="space-y-4">

        {/* Badge de categoría */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: cfg.bg, border: `1px solid ${cfg.borde}` }}>
          <span className="text-2xl">{cfg.icono}</span>
          <div>
            <div className="font-bold text-sm" style={{ color: cfg.color }}>{cfg.label}</div>
            {esVirtual && <div className="text-xs mt-0.5" style={{ color: '#ffb300' }}>Sin distribución asignada</div>}
            {esRepro   && <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>Reproductor registrado</div>}
          </div>
        </div>

        {/* Tabs — solo para jaulas reales */}
        {esReal && (
          <div className="flex gap-2 flex-wrap">
            {btnTab('ver', 'Ver')}
            {btnTab('editar', '✏ Editar')}
            {btnTab('dividir', '✂ Dividir')}
            {jaulasDestino.length > 0 && btnTab('mover', '→ Mover')}
          </div>
        )}

        {/* ── VER ─────────────────────────────────────────────────── */}
        {(modo === 'ver' || esRepro || esVirtual) && (
          <div className="space-y-3">
            {esRepro ? (
              <>
                <Row label="Código"     valor={bloque.animal.codigo} color={cfg.color} />
                <Row label="Sexo"       valor={bloque.animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'} color={cfg.color} />
                <Row label="Estado"     valor={labelEstadoRepro[bloque.animal.estado] ?? bloque.animal.estado} />
                <Row label="Nacimiento" valor={formatFecha(bloque.animal.fecha_nacimiento)} />
                <Row label="Edad"       valor={bloque.edad != null ? `${bloque.edad} días (${formatEdad(bloque.edad)})` : '—'} />
                {(bloque.animal.id_madre || bloque.animal.id_padre) && (
                  <Row label="Progenitores" valor={
                    `${animales?.find(a => a.id === bloque.animal.id_madre)?.codigo ?? '?'} × ${animales?.find(a => a.id === bloque.animal.id_padre)?.codigo ?? '?'}`
                  } color="#8a9bb0" />
                )}
                {bloque.animal.notas && <Row label="Notas" valor={bloque.animal.notas} />}
              </>
            ) : (
              <>
                <Row label="Progenitores" valor={`${bloque.madre?.codigo ?? '?'} × ${bloque.padre?.codigo ?? '?'}`} color={cfg.color} />
                <Row label="Total"      valor={`${bloque.total} animales`} color={cfg.color} />
                {bloque.machos  != null && <Row label="Machos"  valor={`♂ ${bloque.machos}`}  color="#40c4ff" />}
                {bloque.hembras != null && <Row label="Hembras" valor={`♀ ${bloque.hembras}`} color="#ce93d8" />}
                <Row label="Nacimiento" valor={formatFecha(bloque.camada?.fecha_nacimiento)} />
                <Row label="Edad"       valor={bloque.edad != null ? `${bloque.edad} días (${formatEdad(bloque.edad)})` : '—'} />
                {bloque.jaula?.notas && <Row label="Notas" valor={bloque.jaula.notas} />}
              </>
            )}
          </div>
        )}

        {/* ── EDITAR ──────────────────────────────────────────────── */}
        {modo === 'editar' && esReal && (
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#4a5f7a' }}>Total animales</label>
              <input type="number" min="0" value={eTotal} onChange={(e) => setETotal(e.target.value)} style={iStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#40c4ff' }}>♂ Machos</label>
                <input type="number" min="0" placeholder="—" value={eMachos} onChange={(e) => setEMachos(e.target.value)} style={iStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#ce93d8' }}>♀ Hembras</label>
                <input type="number" min="0" placeholder="—" value={eHembras} onChange={(e) => setEHembras(e.target.value)} style={iStyle} />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#4a5f7a' }}>Notas</label>
              <input type="text" placeholder="—" value={eNotas} onChange={(e) => setENotas(e.target.value)} style={iStyle} />
            </div>
            <button onClick={guardarEdicion} className="w-full py-2 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', cursor: 'pointer' }}>
              Guardar cambios
            </button>
          </div>
        )}

        {/* ── DIVIDIR ─────────────────────────────────────────────── */}
        {modo === 'dividir' && esReal && (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: '#4a5f7a' }}>
              Repartí los <span style={{ color: cfg.color, fontWeight: 700 }}>{bloque.total} animales</span> en nuevas jaulas.
              La primera actualiza la actual; las demás se crean nuevas.
            </p>
            {parts.map((p, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2"
                style={{ background: 'rgba(5,8,16,0.5)', border: '1px solid rgba(30,51,82,0.6)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: i === 0 ? cfg.color : '#8a9bb0' }}>
                    {i === 0 ? 'Jaula actual' : `Nueva jaula ${i}`}
                  </span>
                  {i > 1 && (
                    <button onClick={() => setParts((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ color: '#ff6b80', fontSize: '0.7rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ✕ quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['total', 'Total', '#8a9bb0'], ['machos', '♂', '#40c4ff'], ['hembras', '♀', '#ce93d8']].map(([field, lbl, col]) => (
                    <div key={field}>
                      <div className="text-xs mb-1 font-semibold" style={{ color: col }}>{lbl}</div>
                      <input
                        type="number" min="0" placeholder={field !== 'total' ? '—' : ''}
                        value={p[field]}
                        onChange={(e) => setParts((prev) => prev.map((x, idx) => idx === i ? { ...x, [field]: e.target.value } : x))}
                        style={{ ...iStyle }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-xs font-mono text-center py-1.5 rounded-lg"
              style={{ color: partsOk ? '#00e676' : '#ff6b80', background: partsOk ? 'rgba(0,230,118,0.06)' : 'rgba(255,61,87,0.06)' }}>
              {sumaParts} / {bloque.total} animales asignados
              {!partsOk && sumaParts > bloque.total && ' — excede el total'}
              {!partsOk && sumaParts < bloque.total && ' — faltan asignar'}
            </div>
            <button onClick={() => setParts((prev) => [...prev, { total: '0', machos: '', hembras: '' }])}
              className="w-full py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'transparent', border: '1px dashed rgba(30,51,82,0.8)', color: '#4a5f7a', cursor: 'pointer' }}>
              + Agregar jaula
            </button>
            <button onClick={guardarDividir} disabled={!partsOk} className="w-full py-2 rounded-xl text-sm font-bold"
              style={{ background: partsOk ? 'rgba(0,230,118,0.12)' : 'rgba(30,51,82,0.3)', border: `1px solid ${partsOk ? 'rgba(0,230,118,0.3)' : 'rgba(30,51,82,0.5)'}`, color: partsOk ? '#00e676' : '#4a5f7a', cursor: partsOk ? 'pointer' : 'not-allowed' }}>
              Confirmar división
            </button>
          </div>
        )}

        {/* ── MOVER ───────────────────────────────────────────────── */}
        {modo === 'mover' && esReal && jaulasDestino.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: '#4a5f7a' }}>
              Mover animales de esta jaula (<span style={{ color: cfg.color }}>{bloque.total} en total</span>) a otra existente.
            </p>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#4a5f7a' }}>Jaula destino</label>
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} style={{ ...iStyle }}>
                {jaulasDestino.map((j) => {
                  const c = camadas.find((x) => x.id === j.camada_id)
                  return (
                    <option key={j.id} value={j.id}>
                      {c ? `Camada ...${c.id.slice(-4)}` : `Jaula ...${j.id.slice(-4)}`} — {j.total} animales
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#4a5f7a' }}>
                Cantidad a mover (máx. {bloque.total})
              </label>
              <input type="number" min="1" max={bloque.total} value={cantMover}
                onChange={(e) => setCantMover(e.target.value)} style={iStyle} />
              {cantN > bloque.total && (
                <p className="text-xs mt-1" style={{ color: '#ff6b80' }}>No podés mover más de {bloque.total} animales</p>
              )}
            </div>
            <button onClick={guardarMover} disabled={!moverOk} className="w-full py-2 rounded-xl text-sm font-bold"
              style={{ background: moverOk ? 'rgba(0,230,118,0.12)' : 'rgba(30,51,82,0.3)', border: `1px solid ${moverOk ? 'rgba(0,230,118,0.3)' : 'rgba(30,51,82,0.5)'}`, color: moverOk ? '#00e676' : '#4a5f7a', cursor: moverOk ? 'pointer' : 'not-allowed' }}>
              Confirmar movimiento
            </button>
          </div>
        )}

        {/* Virtual → registrar como jaula real */}
        {esVirtual && (
          <button onClick={convertirAJaula} className="w-full py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', color: '#ffb300', cursor: 'pointer' }}>
            Asignar a jaula registrada
          </button>
        )}

      </div>
    </Modal>
  )
}

function Row({ label, valor, color = '#8a9bb0' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#4a5f7a' }}>{label}</span>
      <span className="font-mono font-semibold" style={{ color }}>{valor}</span>
    </div>
  )
}

function ModalSacrificio({ bloques, onConfirmar, onCerrar }) {
  const [fecha, setFecha]       = useState(hoy())
  const [notas, setNotas]       = useState('')
  const [guardando, setGuardando] = useState(false)
  // cantidad editable por bloque (solo stock, repros siempre = 1)
  const [cantidades, setCantidades] = useState(() =>
    Object.fromEntries(bloques.map((b) => [b.id, b.total]))
  )

  const tieneRepros = bloques.some(b => b.tipo === 'reproductor')
  const tieneStock  = bloques.some(b => b.tipo === 'stock')
  const total       = bloques.reduce((s, b) => s + (parseInt(cantidades[b.id]) || 0), 0)
  const cantOk      = bloques.every((b) => {
    const v = parseInt(cantidades[b.id]) || 0
    return v >= 1 && v <= b.total
  })

  const iStyle = {
    background: 'rgba(5,8,16,0.6)', border: '1px solid rgba(30,51,82,0.8)',
    color: '#e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.6rem',
    fontSize: '0.8125rem', width: '100%', outline: 'none',
  }

  async function confirmar() {
    if (!cantOk) return
    setGuardando(true)
    try { await onConfirmar(fecha, notas || null, cantidades) }
    finally { setGuardando(false) }
  }

  const mensajeAccion = tieneRepros && tieneStock
    ? 'Los reproductores seleccionados pasarán a estado "Fallecido". Las jaulas de stock se reducirán (o eliminarán si sacrificás el total).'
    : tieneRepros
    ? 'Los reproductores seleccionados pasarán a estado "Fallecido" y dejarán de aparecer en listas activas. Su historial queda conservado.'
    : 'Se registrará el sacrificio. Si sacrificás menos del total, la jaula queda con el resto.'

  return (
    <Modal titulo="Confirmar sacrificio" onCerrar={onCerrar} ancho="max-w-md">
      <div className="space-y-4">

        {/* Advertencia */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)' }}>
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <div className="font-bold text-sm" style={{ color: '#ff6b80' }}>Esta acción no se puede deshacer</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{mensajeAccion}</div>
          </div>
        </div>

        {/* Lista de seleccionados con cantidad editable */}
        <div>
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#4a5f7a' }}>
            Seleccionados para sacrificio ({bloques.length})
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {bloques.map((b) => {
              const cfg = CAT[b.categoria]
              const esRepro = b.tipo === 'reproductor'
              const cant = parseInt(cantidades[b.id]) || 0
              const parcial = !esRepro && cant < b.total && cant > 0
              const error   = !esRepro && (cant < 1 || cant > b.total)
              return (
                <div key={b.id} className="px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(5,8,16,0.5)', border: `1px solid ${error ? 'rgba(255,61,87,0.5)' : cfg.borde}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span>{cfg.icono}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-semibold truncate" style={{ color: cfg.color }}>
                          {esRepro
                            ? `${b.animal.sexo === 'macho' ? '♂' : '♀'} ${b.animal.codigo}`
                            : `${b.madre?.codigo ?? '?'} × ${b.padre?.codigo ?? '?'}`}
                        </div>
                        <div className="text-xs" style={{ color: '#4a5f7a' }}>
                          {cfg.label}{b.edad != null ? ` · ${b.edad}d` : ''}
                          {!esRepro && <span style={{ color: '#4a5f7a' }}> · total: {b.total}</span>}
                        </div>
                      </div>
                    </div>
                    {esRepro ? (
                      <div className="font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>1</div>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="number" min="1" max={b.total}
                          value={cantidades[b.id]}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [b.id]: e.target.value }))}
                          style={{ ...iStyle, width: '5rem', textAlign: 'center', color: error ? '#ff6b80' : '#e2e8f0' }}
                        />
                        {parcial && (
                          <span className="text-xs" style={{ color: '#ffd740' }}>parcial — quedan {b.total - cant}</span>
                        )}
                        {error && (
                          <span className="text-xs" style={{ color: '#ff6b80' }}>1 – {b.total}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between items-center mt-3 px-1">
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#4a5f7a' }}>Total a sacrificar</span>
            <span className="font-mono font-bold text-xl" style={{ color: '#ff6b80' }}>{total} animales</span>
          </div>
        </div>

        {/* Fecha */}
        <div>
          <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#4a5f7a' }}>Fecha del sacrificio</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={iStyle} />
        </div>

        {/* Notas */}
        <div>
          <label className="text-xs uppercase tracking-widest font-semibold mb-1 block" style={{ color: '#4a5f7a' }}>
            Notas <span className="normal-case font-normal opacity-60">(opcional)</span>
          </label>
          <input type="text" placeholder="Motivo, protocolo, observaciones..."
            value={notas} onChange={(e) => setNotas(e.target.value)}
            style={{ ...iStyle, fontFamily: 'monospace' }} />
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button onClick={onCerrar} disabled={guardando}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}>
            Cancelar
          </button>
          <button onClick={confirmar} disabled={guardando || !cantOk}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: (!cantOk || guardando) ? 'rgba(30,51,82,0.3)' : 'rgba(255,61,87,0.15)',
              border: `1.5px solid ${(!cantOk || guardando) ? 'rgba(30,51,82,0.5)' : 'rgba(255,61,87,0.4)'}`,
              color: (!cantOk || guardando) ? '#4a5f7a' : '#ff6b80',
              cursor: (!cantOk || guardando) ? 'not-allowed' : 'pointer',
            }}>
            {guardando ? 'Registrando...' : `🗡 Sacrificar ${total} animales`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Componentes de la vista Resumen (existentes, sin cambios) ─────────────────

function CategoriaCard({ icono, titulo, subtitulo, total, grupos, gruposLabel, machos, hembras, color, descripcion }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: `${color}08`, borderBottom: `1px solid ${color}18` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          {icono}
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm text-white">{titulo}</div>
          <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{subtitulo}</div>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold text-3xl" style={{ color }}>{total}</div>
          <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>animales</div>
        </div>
      </div>
      <div className="px-5 py-3 flex flex-wrap gap-4">
        {grupos !== undefined && (
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a5f7a' }}>{gruposLabel ?? 'Grupos'}</div>
            <div className="font-mono font-bold text-lg text-white">{grupos}</div>
          </div>
        )}
        {machos !== undefined && (
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a5f7a' }}>♂ Machos</div>
            <div className="font-mono font-bold text-lg" style={{ color: '#40c4ff' }}>{machos}</div>
          </div>
        )}
        {hembras !== undefined && (
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a5f7a' }}>♀ Hembras</div>
            <div className="font-mono font-bold text-lg" style={{ color: '#ce93d8' }}>{hembras}</div>
          </div>
        )}
        {descripcion && <div className="ml-auto self-center text-xs text-right" style={{ color: '#4a5f7a' }}>{descripcion}</div>}
      </div>
    </div>
  )
}

// ── Gráfico de evolución de stock ─────────────────────────────────────────────

function mesStr(fecha) {
  // Retorna "YYYY-MM" desde un string "YYYY-MM-DD"
  return fecha ? fecha.slice(0, 7) : null
}

function GraficoEvolucion({ camadas, sacrificios, animales }) {
  const [rango, setRango] = useState('todo')

  const datos = useMemo(() => {
    // 1. Recolectar todos los eventos con fecha
    const eventos = []

    camadas.filter(c => c.fecha_nacimiento && !c.failure_flag && c.incluir_en_stock !== false).forEach(c => {
      const destetados = c.fecha_destete ? (c.total_destetados ?? c.total_crias ?? 0) : (c.total_crias ?? 0)
      const nacidos    = c.total_crias ?? 0
      const mortalidad = c.fecha_destete ? Math.max(0, nacidos - destetados) : 0
      const fechaStock = c.fecha_destete ?? c.fecha_nacimiento
      eventos.push({ fecha: fechaStock, nacimientos: destetados, sacrificados: 0, mortalidad, repros: 0 })
    })

    // Todos los sacrificios vienen de la tabla sacrificios
    // Si fecha es null, usamos created_at como respaldo (Supabase lo guarda automáticamente)
    sacrificios.forEach(s => {
      const fecha = s.fecha || (s.created_at ? s.created_at.slice(0, 10) : null)
      if (!fecha) return
      if (s.categoria === 'reproductor') {
        eventos.push({ fecha, nacimientos: 0, sacrificados: 0, mortalidad: 0, repros: s.cantidad })
      } else {
        eventos.push({ fecha, nacimientos: 0, sacrificados: s.cantidad, mortalidad: 0, repros: 0 })
      }
    })

    if (eventos.length === 0) return []

    // 2. Agrupar por mes
    const porMes = {}
    eventos.forEach(({ fecha, nacimientos, sacrificados, mortalidad, repros }) => {
      const mes = mesStr(fecha)
      if (!mes) return
      if (!porMes[mes]) porMes[mes] = { mes, nacimientos: 0, sacrificados: 0, mortalidad: 0, repros: 0 }
      porMes[mes].nacimientos  += nacimientos
      porMes[mes].sacrificados += sacrificados
      porMes[mes].mortalidad   += mortalidad
      porMes[mes].repros       += repros
    })

    // 3. Ordenar meses cronológicamente
    const meses = Object.keys(porMes).sort()
    if (meses.length === 0) return []

    // 4. Filtrar por rango
    const hoyMes = hoy().slice(0, 7)
    let desde = meses[0]
    if (rango === '12m') {
      const d = new Date(hoyMes + '-01T12:00:00')
      d.setMonth(d.getMonth() - 11)
      desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    } else if (rango === '6m') {
      const d = new Date(hoyMes + '-01T12:00:00')
      d.setMonth(d.getMonth() - 5)
      desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    // 5. Calcular total acumulado ANTES del rango para arrancar desde el valor correcto
    let totalAntes = 0
    meses.filter(m => m < desde).forEach(m => {
      totalAntes += porMes[m].nacimientos - porMes[m].sacrificados
    })

    // 6. Generar secuencia completa de meses (incluso sin eventos)
    const resultado = []
    let cursor = new Date(desde + '-01T12:00:00')
    const fin   = new Date(hoyMes + '-01T12:00:00')
    let acumulado = totalAntes

    while (cursor <= fin) {
      const mesKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      const d = porMes[mesKey] ?? { nacimientos: 0, sacrificados: 0, mortalidad: 0, repros: 0 }
      acumulado = Math.max(0, acumulado + d.nacimientos - d.sacrificados)
      resultado.push({
        mes: mesKey,
        label: cursor.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
        total: acumulado,
        nacimientos:  d.nacimientos,
        sacrificados: d.sacrificados,
        mortalidad:   d.mortalidad,
        repros:       d.repros,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    return resultado
  }, [camadas, sacrificios, rango])

  // Estadísticas de resumen derivadas de todas las camadas (sin filtro de rango)
  const stats = useMemo(() => {
    const hoyMes = hoy().slice(0, 7)
    let desde = ''
    if (rango === '12m') {
      const d = new Date(hoyMes + '-01T12:00:00'); d.setMonth(d.getMonth() - 11)
      desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    } else if (rango === '6m') {
      const d = new Date(hoyMes + '-01T12:00:00'); d.setMonth(d.getMonth() - 5)
      desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    const enPeriodo = camadas.filter(c =>
      c.fecha_nacimiento && !c.failure_flag &&
      (rango === 'todo' || mesStr(c.fecha_nacimiento) >= desde)
    )

    const conDestete = enPeriodo.filter(c => c.fecha_destete && c.total_crias > 0 && c.total_destetados != null)
    const tasaSup = conDestete.length > 0
      ? Math.round(conDestete.reduce((s, c) => s + c.total_destetados / c.total_crias, 0) / conDestete.length * 100)
      : null

    const conCrias = enPeriodo.filter(c => c.total_crias > 0)
    const promCrias = conCrias.length > 0
      ? Math.round(conCrias.reduce((s, c) => s + c.total_crias, 0) / conCrias.length * 10) / 10
      : null

    // Total reproductores sacrificados — independiente del rango y de fecha_sacrificio
    const totalReprosSacrificados = (animales ?? []).filter(a => a.estado === 'fallecido').length

    return { nCamadas: enPeriodo.length, tasaSup, promCrias, totalReprosSacrificados }
  }, [camadas, animales, rango])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="rounded-xl px-4 py-3 space-y-1.5"
        style={{ background: '#0d1528', border: '1px solid rgba(30,51,82,0.9)', minWidth: 170 }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#4a5f7a' }}>{d?.label}</div>
        <div className="flex justify-between gap-4 text-xs">
          <span style={{ color: '#40c4ff' }}>Stock total</span>
          <span className="font-mono font-bold" style={{ color: '#40c4ff' }}>{d?.total ?? 0}</span>
        </div>
        {d?.nacimientos > 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span style={{ color: '#00e676' }}>Destetados</span>
            <span className="font-mono font-bold" style={{ color: '#00e676' }}>+{d.nacimientos}</span>
          </div>
        )}
        {d?.sacrificados > 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span style={{ color: '#ff6b80' }}>Sacrificados</span>
            <span className="font-mono font-bold" style={{ color: '#ff6b80' }}>-{d.sacrificados}</span>
          </div>
        )}
        {d?.mortalidad > 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span style={{ color: '#ffb300' }}>Mort. pre-destete</span>
            <span className="font-mono font-bold" style={{ color: '#ffb300' }}>{d.mortalidad}</span>
          </div>
        )}
        {d?.repros > 0 && (
          <div className="flex justify-between gap-4 text-xs">
            <span style={{ color: '#ce93d8' }}>Reproductores</span>
            <span className="font-mono font-bold" style={{ color: '#ce93d8' }}>-{d.repros}</span>
          </div>
        )}
      </div>
    )
  }

  const btnRango = (v, label) => (
    <button
      key={v} onClick={() => setRango(v)}
      className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
      style={rango === v
        ? { background: 'rgba(64,196,255,0.15)', border: '1px solid rgba(64,196,255,0.4)', color: '#40c4ff' }
        : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }}
    >{label}</button>
  )

  if (datos.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center"
        style={{ background: 'rgba(64,196,255,0.04)', border: '1px solid rgba(64,196,255,0.15)' }}>
        <div className="text-3xl mb-3">📈</div>
        <div className="font-semibold text-sm" style={{ color: '#40c4ff' }}>Sin datos para mostrar</div>
        <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>Registrá camadas y sacrificios para ver la evolución</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Selector de rango */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Rango</span>
        {btnRango('6m', 'Últimos 6 meses')}
        {btnRango('12m', 'Últimos 12 meses')}
        {btnRango('todo', 'Todo el historial')}
      </div>

      {/* Gráfico principal — stock total */}
      <div className="rounded-2xl px-4 pt-5 pb-3"
        style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#4a5f7a' }}>
          Stock total en colonia
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={datos} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#40c4ff" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#40c4ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,51,82,0.5)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#4a5f7a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4a5f7a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="total" stroke="#40c4ff" strokeWidth={2}
              fill="url(#gradTotal)" dot={false} activeDot={{ r: 4, fill: '#40c4ff' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de entradas y salidas + mortalidad */}
      <div className="rounded-2xl px-4 pt-5 pb-3"
        style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#4a5f7a' }}>
          Destetados · Sacrificados · Mortalidad pre-destete
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={datos} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,51,82,0.5)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#4a5f7a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4a5f7a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(v) => {
                const map = { nacimientos: 'Destetados', sacrificados: 'Sacrificados (stock)', repros: 'Reproductores', mortalidad: 'Mort. pre-destete' }
                return <span style={{ color: '#8a9bb0', fontSize: 11 }}>{map[v] ?? v}</span>
              }}
              wrapperStyle={{ paddingTop: 8 }}
            />
            <Bar dataKey="nacimientos"  fill="#00e676" fillOpacity={0.7} radius={[3,3,0,0]} maxBarSize={20} />
            <Bar dataKey="sacrificados" fill="#ff6b80" fillOpacity={0.7} radius={[3,3,0,0]} maxBarSize={20} />
            <Bar dataKey="repros"       fill="#ce93d8" fillOpacity={0.7} radius={[3,3,0,0]} maxBarSize={20} />
            <Line type="monotone" dataKey="mortalidad" stroke="#ffb300" strokeWidth={2}
              dot={false} activeDot={{ r: 3, fill: '#ffb300' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen numérico — totales globales (independientes del rango) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Stock actual',       val: datos[datos.length - 1]?.total ?? 0,                                                                                                  fmt: v => v,        color: '#40c4ff' },
          { label: 'Total destetados',   val: camadas.filter(c => !c.failure_flag && c.incluir_en_stock !== false && c.fecha_destete).reduce((s, c) => s + (c.total_destetados ?? c.total_crias ?? 0), 0), fmt: v => v, color: '#00e676' },
          { label: 'Sac. de stock',      val: sacrificios.filter(s => s.categoria !== 'reproductor').reduce((s, r) => s + r.cantidad, 0),                                           fmt: v => v,        color: '#ff6b80' },
          { label: 'Reproductores sac.', val: stats.totalReprosSacrificados,                                                                                                         fmt: v => v,        color: '#ce93d8' },
          { label: 'Mort. pre-destete',  val: camadas.filter(c => !c.failure_flag && c.fecha_destete).reduce((s, c) => s + Math.max(0, (c.total_crias ?? 0) - (c.total_destetados ?? c.total_crias ?? 0)), 0), fmt: v => v, color: '#ffb300' },
          { label: 'Prom. crías/camada', val: stats.promCrias,                                                                                                                       fmt: v => v ?? '—', color: '#80cbc4' },
        ].map(({ label, val, fmt, color }) => (
          <div key={label} className="rounded-xl px-4 py-3 text-center"
            style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <div className="font-mono font-bold text-2xl" style={{ color }}>{fmt(val)}</div>
            <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tasa de supervivencia al destete */}
      {stats.tasaSup != null && (
        <div className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Tasa de supervivencia al destete</div>
            <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>Promedio de crías que llegan al destete sobre el total nacido</div>
          </div>
          <div className="text-3xl font-mono font-bold ml-6" style={{
            color: stats.tasaSup >= 80 ? '#00e676' : stats.tasaSup >= 60 ? '#ffb300' : '#ff6b80'
          }}>
            {stats.tasaSup}%
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Stock() {
  const { animales, camadas, sacrificios, jaulas, editarAnimal, sacrificarReproductor, editarJaula, agregarJaula, eliminarJaula, registrarSacrificio } = useBioterio()
  const [vista, setVista] = useState('jaulas')
  const [detalle, setDetalle] = useState(null)
  const [filtroCat, setFiltroCat] = useState('todas')
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [modalSacrificio, setModalSacrificio] = useState(false)

  // ── Bloques de jaulas (reproductores + stock) ─────────────────────────────
  const bloques = useMemo(() => {
    const result = []

    // 1. Animales reproductores activos (1 bloque por animal)
    animales
      .filter((a) => ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado))
      .forEach((animal) => {
        result.push({
          tipo: 'reproductor',
          id: `r-${animal.id}`,
          animal,
          edad: animal.fecha_nacimiento ? edadDias(animal.fecha_nacimiento) : null,
          categoria: animal.sexo === 'macho' ? 'macho_repro' : 'hembra_repro',
          total: 1,
        })
      })

    // 2. Jaulas de stock (de la tabla jaulas)
    jaulas.forEach((jaula) => {
      const camada = camadas.find((c) => c.id === jaula.camada_id)
      if (!camada?.fecha_nacimiento || jaula.total <= 0) return
      const edad = edadDias(camada.fecha_nacimiento)
      const madre = animales.find((a) => a.id === camada.id_madre)
      const padre = animales.find((a) => a.id === camada.id_padre)
      result.push({
        tipo: 'stock',
        id: `j-${jaula.id}`,
        jaula,
        camada,
        madre,
        padre,
        edad,
        categoria: categoriaStock(edad),
        total: jaula.total,
        machos: jaula.machos,
        hembras: jaula.hembras,
      })
    })

    // 3. Bloques virtuales — camadas destetadas sin jaulas asignadas (datos históricos)
    camadas.forEach((camada) => {
      if (!camada.fecha_nacimiento || !camada.fecha_destete) return
      if (camada.incluir_en_stock === false) return
      if (jaulas.some((j) => j.camada_id === camada.id)) return
      const stock = stockCamada(camada, sacrificios)
      if (stock <= 0) return
      const edad = edadDias(camada.fecha_nacimiento)
      const madre = animales.find((a) => a.id === camada.id_madre)
      const padre = animales.find((a) => a.id === camada.id_padre)
      result.push({
        tipo: 'stock',
        id: `v-${camada.id}`,
        virtual: true,
        camada,
        madre,
        padre,
        edad,
        categoria: categoriaStock(edad),
        total: stock,
        machos: camada.crias_machos,
        hembras: camada.crias_hembras,
      })
    })

    return result
  }, [animales, camadas, jaulas, sacrificios])

  // ── Resumen por categoría ─────────────────────────────────────────────────
  const resumen = useMemo(() => {
    const cats = Object.fromEntries(Object.keys(CAT).map((k) => [k, { animales: 0, jaulas: 0 }]))
    bloques.forEach((b) => {
      cats[b.categoria].animales += b.total
      cats[b.categoria].jaulas += 1
    })
    const totalAnimales = Object.values(cats).reduce((s, c) => s + c.animales, 0)
    const totalJaulas = Object.values(cats).reduce((s, c) => s + c.jaulas, 0)
    return { ...cats, totalAnimales, totalJaulas }
  }, [bloques])

  // ── Datos para la vista "Resumen" (categorías) ────────────────────────────
  // Usa `bloques` como fuente única de verdad — siempre en sync con Vista por jaulas
  const datosResumen = useMemo(() => {
    const hembrasRepro = animales.filter((a) => a.sexo === 'hembra' && ['activo', 'en_cria', 'en_apareamiento'].includes(a.estado))
    const machosRepro  = animales.filter((a) => a.sexo === 'macho'  && ['activo', 'en_cria', 'en_apareamiento'].includes(a.estado))
    let crias     = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let jovenes   = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let adultosNR = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let lactantes = { total: 0, grupos: 0 }

    // Lactantes (pre-destete) — no están en bloques todavía, los sacamos de camadas
    camadas.filter((c) => c.fecha_nacimiento && !c.failure_flag && c.incluir_en_stock !== false).forEach((c) => {
      const edad = edadDias(c.fecha_nacimiento)
      if (edad === null || edad >= BIO.DESTETE_DIAS) return
      lactantes.total += c.total_crias ?? 0
      lactantes.grupos += 1
    })

    // Stock por edad — directamente desde bloques (ya descontados jaulas editadas y sacrificios)
    bloques.filter((b) => b.tipo === 'stock').forEach((b) => {
      const edad = b.edad
      if (edad === null) return
      const total = b.total
      const m = b.machos ?? 0
      const h = b.hembras ?? 0
      if (edad < 42) {
        crias.total += total; crias.grupos += 1; crias.machos += m; crias.hembras += h
      } else if (edad < BIO.MADUREZ_DIAS) {
        jovenes.total += total; jovenes.grupos += 1; jovenes.machos += m; jovenes.hembras += h
      } else {
        adultosNR.total += total; adultosNR.grupos += 1; adultosNR.machos += m; adultosNR.hembras += h
      }
    })

    return { hembrasRepro, machosRepro, crias, jovenes, adultosNR, lactantes }
  }, [animales, camadas, bloques])

  const bloquesFiltrados = useMemo(() =>
    filtroCat === 'todas' ? bloques : bloques.filter((b) => b.categoria === filtroCat),
  [bloques, filtroCat])

  // ── Selección + sacrificio ────────────────────────────────────────────────
  const totalSeleccionado = useMemo(() =>
    bloques.filter((b) => seleccionadas.has(b.id)).reduce((s, b) => s + b.total, 0),
  [bloques, seleccionadas])

  function toggleSeleccion(bloque) {
    if (bloque.virtual) return
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      next.has(bloque.id) ? next.delete(bloque.id) : next.add(bloque.id)
      return next
    })
  }

  function salirModoSeleccion() {
    setModoSeleccion(false)
    setSeleccionadas(new Set())
  }

  async function ejecutarSacrificio(fecha, notas, cantidades) {
    const bloquesSel = bloques.filter((b) => seleccionadas.has(b.id))
    for (const b of bloquesSel) {
      if (b.tipo === 'reproductor') {
        await sacrificarReproductor(b.animal, fecha, notas)
      } else {
        const cant = parseInt(cantidades?.[b.id]) || b.total
        await registrarSacrificio({
          camada_id: b.camada.id,
          cantidad: cant,
          fecha,
          categoria: b.categoria === 'crias' ? 'cria' : b.categoria === 'jovenes' ? 'joven' : b.categoria === 'adultos' ? 'adulto_nr' : null,
          notas,
        })
        if (!b.virtual && b.jaula?.id) {
          const resto = b.jaula.total - cant
          if (resto <= 0) {
            await eliminarJaula(b.jaula.id)
          } else {
            // sacrificio parcial: reducir la jaula
            const nuevosMachos  = b.jaula.machos  != null ? Math.max(0, b.jaula.machos  - Math.round(cant * (b.jaula.machos  / b.jaula.total))) : null
            const nuevasHembras = b.jaula.hembras != null ? Math.max(0, b.jaula.hembras - Math.round(cant * (b.jaula.hembras / b.jaula.total))) : null
            await editarJaula({ ...b.jaula, total: resto, machos: nuevosMachos, hembras: nuevasHembras })
          }
        }
      }
    }
    setModalSacrificio(false)
    salirModoSeleccion()
  }

  const btnTab = (v, label) => (
    <button
      onClick={() => setVista(v)}
      className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
      style={
        vista === v
          ? { background: 'rgba(64,196,255,0.15)', border: '1px solid rgba(64,196,255,0.4)', color: '#40c4ff' }
          : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
      }
    >
      {label}
    </button>
  )

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-7 rounded-full" style={{ background: '#40c4ff', boxShadow: '0 0 8px rgba(64,196,255,0.5)' }} />
        <h1 className="text-xl font-bold text-white">Stock</h1>
      </div>

      {/* ── RESUMEN SUPERIOR ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4 space-y-3"
        style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
      >
        {/* Totales */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-white">
            Total: <span style={{ color: '#40c4ff' }}>{resumen.totalAnimales}</span> animales
            {' '}/ <span style={{ color: '#00e676' }}>{resumen.totalJaulas}</span> jaulas
          </span>
        </div>
        {/* Chips por categoría */}
        <div className="flex flex-wrap gap-2">
          <ChipCategoria label="Machos"   animales={resumen.macho_repro.animales}  jaulas={resumen.macho_repro.jaulas}  color="#40c4ff" />
          <ChipCategoria label="Hembras"  animales={resumen.hembra_repro.animales} jaulas={resumen.hembra_repro.jaulas} color="#ce93d8" />
          <ChipCategoria label="Crías"    animales={resumen.crias.animales}         jaulas={resumen.crias.jaulas}         color="#00e676" />
          <ChipCategoria label="Jóvenes"  animales={resumen.jovenes.animales}       jaulas={resumen.jovenes.jaulas}       color="#ffb300" />
          <ChipCategoria label="Adultos"  animales={resumen.adultos.animales}       jaulas={resumen.adultos.jaulas}       color="#ff6b80" />
        </div>
      </div>

      {/* ── TOGGLE VISTA ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {btnTab('jaulas', '⬛ Vista por jaulas')}
        {btnTab('resumen', '📊 Vista por categorías')}
        {btnTab('evolucion', '📈 Evolución')}
        {vista === 'jaulas' && (
          <button
            onClick={() => modoSeleccion ? salirModoSeleccion() : setModoSeleccion(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all ml-auto"
            style={modoSeleccion
              ? { background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.4)', color: '#ff6b80' }
              : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }}
          >
            {modoSeleccion ? '✕ Cancelar selección' : '☑ Seleccionar'}
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {vista === 'jaulas' && (
        <>
          {/* Filtro por categoría */}
          <div className="flex flex-wrap gap-2">
            {[['todas', 'Todas', '#8a9bb0'], ...Object.entries(CAT).map(([k, v]) => [k, v.icono + ' ' + v.label, v.color])].map(([k, label, color]) => {
              const count = k === 'todas' ? bloques.length : bloques.filter(b => b.categoria === k).length
              const activo = filtroCat === k
              return (
                <button
                  key={k}
                  onClick={() => setFiltroCat(k)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={
                    activo
                      ? { background: `${color}18`, border: `1px solid ${color}45`, color }
                      : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
                  }
                >
                  {label} <span className="font-mono opacity-60">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Grid de bloques */}
          {bloquesFiltrados.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#4a5f7a' }}>
              <div className="text-4xl mb-3">📦</div>
              <div className="text-sm">Sin jaulas en esta categoría</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {bloquesFiltrados.map((b) => (
                <BloqueJaula
                  key={b.id}
                  bloque={b}
                  onClick={modoSeleccion ? toggleSeleccion : setDetalle}
                  modoSeleccion={modoSeleccion}
                  seleccionada={seleccionadas.has(b.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {vista === 'resumen' && (
        <div className="space-y-5">
          {/* Lactantes */}
          {datosResumen.lactantes.total > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)' }}
            >
              <span className="text-lg">🍼</span>
              <div>
                <span className="font-semibold" style={{ color: '#ffb300' }}>{datosResumen.lactantes.total} crías lactantes</span>
                <span className="ml-2" style={{ color: '#4a5f7a' }}>
                  en {datosResumen.lactantes.grupos} camada{datosResumen.lactantes.grupos !== 1 ? 's' : ''} — aún no destetadas
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>Reproductores registrados</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CategoriaCard icono="♀" titulo="Hembras reproductoras" subtitulo="Estado activo, en apareamiento o en cría" total={datosResumen.hembrasRepro.length} color="#ce93d8" />
              <CategoriaCard icono="♂" titulo="Machos reproductores"  subtitulo="Estado activo, en apareamiento o en cría" total={datosResumen.machosRepro.length}  color="#40c4ff" />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>Stock de camadas — por edad</div>
            <div className="space-y-3">
              <CategoriaCard icono="🐣" titulo="Crías (post-destete)" subtitulo="21 días hasta 6 semanas" total={datosResumen.crias.total} grupos={datosResumen.crias.grupos} gruposLabel="Camadas" machos={datosResumen.crias.machos || undefined} hembras={datosResumen.crias.hembras || undefined} color="#00e676" descripcion="Destete completado · hasta 42 días" />
              <CategoriaCard icono="🐭" titulo="Jóvenes" subtitulo="6 semanas hasta 12 semanas" total={datosResumen.jovenes.total} grupos={datosResumen.jovenes.grupos} gruposLabel="Camadas" machos={datosResumen.jovenes.machos || undefined} hembras={datosResumen.jovenes.hembras || undefined} color="#ffb300" descripcion="42 a 84 días · pre-madurez" />
              <CategoriaCard icono="🐀" titulo="Adultos (no reproductores)" subtitulo="Más de 12 semanas" total={datosResumen.adultosNR.total} grupos={datosResumen.adultosNR.grupos} gruposLabel="Camadas" machos={datosResumen.adultosNR.machos || undefined} hembras={datosResumen.adultosNR.hembras || undefined} color="#ff6b80" descripcion="> 84 días · aptos para reproducción o retiro" />
            </div>
          </div>

          {resumen.totalAnimales === 0 && (
            <div className="rounded-xl p-10 text-center" style={{ background: 'rgba(64,196,255,0.04)', border: '1px solid rgba(64,196,255,0.15)' }}>
              <div className="text-3xl mb-2">📦</div>
              <div className="font-semibold text-sm" style={{ color: '#40c4ff' }}>Sin stock registrado</div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {vista === 'evolucion' && (
        <GraficoEvolucion camadas={camadas} sacrificios={sacrificios} animales={animales} />
      )}

      {/* ── BARRA FLOTANTE DE SELECCIÓN ─────────────────────────────────────── */}
      {modoSeleccion && seleccionadas.size > 0 && (() => {
        const reproSel   = bloques.filter(b => seleccionadas.has(b.id) && b.tipo === 'reproductor')
        const jaulasSel  = bloques.filter(b => seleccionadas.has(b.id) && b.tipo === 'stock')
        return (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 rounded-2xl"
            style={{
              background: '#0d1528',
              border: '1px solid rgba(255,61,87,0.45)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(255,61,87,0.1)',
              whiteSpace: 'nowrap',
            }}
          >
            <div className="flex items-center gap-3 text-sm font-mono">
              {reproSel.length > 0 && (
                <span>
                  <span style={{ color: '#ff6b80', fontWeight: 700 }}>{reproSel.length}</span>
                  <span style={{ color: '#4a5f7a' }}> reproductor{reproSel.length !== 1 ? 'es' : ''}</span>
                </span>
              )}
              {reproSel.length > 0 && jaulasSel.length > 0 && (
                <span style={{ color: 'rgba(30,51,82,0.8)' }}>·</span>
              )}
              {jaulasSel.length > 0 && (
                <span>
                  <span style={{ color: '#ff6b80', fontWeight: 700 }}>{jaulasSel.length}</span>
                  <span style={{ color: '#4a5f7a' }}> jaula{jaulasSel.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: '#4a5f7a' }}> ({jaulasSel.reduce((s,b) => s + b.total, 0)} animales)</span>
                </span>
              )}
            </div>
            <div style={{ width: '1px', height: '20px', background: 'rgba(30,51,82,0.8)' }} />
            <button
              onClick={() => setModalSacrificio(true)}
              className="px-4 py-1.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.5)', color: '#ff6b80', cursor: 'pointer' }}
            >
              🗡 Sacrificar seleccionados
            </button>
          </div>
        )
      })()}

      {/* Modal de jaula */}
      {detalle && (
        <JaulaModal
          bloque={detalle}
          jaulas={jaulas}
          camadas={camadas}
          animales={animales}
          onCerrar={() => setDetalle(null)}
          editarJaula={editarJaula}
          agregarJaula={agregarJaula}
        />
      )}

      {/* Modal sacrificio */}
      {modalSacrificio && (
        <ModalSacrificio
          bloques={bloques.filter((b) => seleccionadas.has(b.id))}
          onConfirmar={ejecutarSacrificio}
          onCerrar={() => setModalSacrificio(false)}
        />
      )}
    </div>
  )
}
