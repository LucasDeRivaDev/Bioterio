import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { difDias, parseDate, hoy, formatFecha } from '../utils/calculos'
import { BIO } from '../utils/constants'
import Modal from '../components/Modal'

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

function BloqueJaula({ bloque, onClick }) {
  const cfg = CAT[bloque.categoria]
  return (
    <button
      onClick={() => onClick(bloque)}
      className="rounded-xl overflow-hidden text-left w-full transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{ background: 'rgba(13,21,40,0.9)', border: `1px solid ${cfg.borde}`, boxShadow: `0 0 12px ${cfg.bg}` }}
    >
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
        {/* Identificador */}
        <div className="font-mono font-bold text-sm text-white">
          {bloque.tipo === 'reproductor'
            ? bloque.animal.codigo
            : `${bloque.madre?.codigo ?? '?'} × ${bloque.padre?.codigo ?? '?'}`}
        </div>

        {/* Conteo */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {bloque.tipo === 'reproductor' ? (
            <span style={{ color: cfg.color }}>
              {bloque.animal.sexo === 'macho' ? '♂' : '♀'} 1 animal
            </span>
          ) : (
            <span style={{ color: cfg.color }}>
              {bloque.machos != null && bloque.hembras != null
                ? `♂${bloque.machos} ♀${bloque.hembras} = ${bloque.total}`
                : `${bloque.total} animales`}
            </span>
          )}
        </div>

        {/* Edad */}
        <div className="text-xs" style={{ color: '#4a5f7a' }}>
          {bloque.edad != null ? `${formatEdad(bloque.edad)} · ${bloque.edad}d` : '—'}
        </div>
      </div>
    </button>
  )
}

function DetalleModal({ bloque, onCerrar }) {
  const cfg = CAT[bloque.categoria]

  return (
    <Modal titulo="Detalle de jaula" onCerrar={onCerrar} ancho="max-w-sm">
      <div className="space-y-4">
        {/* Categoría */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: cfg.bg, border: `1px solid ${cfg.borde}` }}
        >
          <span className="text-2xl">{cfg.icono}</span>
          <div>
            <div className="font-bold text-sm" style={{ color: cfg.color }}>{cfg.label}</div>
            {bloque.virtual && (
              <div className="text-xs mt-0.5" style={{ color: '#ffb300' }}>
                Sin distribución asignada — editá desde Camadas
              </div>
            )}
          </div>
        </div>

        {/* Datos */}
        <div className="space-y-3">
          {bloque.tipo === 'reproductor' ? (
            <>
              <Row label="Código" valor={bloque.animal.codigo} color={cfg.color} />
              <Row label="Sexo" valor={bloque.animal.sexo === 'macho' ? '♂ Macho' : '♀ Hembra'} color={cfg.color} />
              <Row label="Estado" valor={bloque.animal.estado} />
              <Row label="Nacimiento" valor={formatFecha(bloque.animal.fecha_nacimiento)} />
              <Row label="Edad" valor={bloque.edad != null ? `${bloque.edad} días (${formatEdad(bloque.edad)})` : '—'} />
              <Row label="Tipo" valor="Reproductor registrado" />
              {bloque.animal.notas && <Row label="Notas" valor={bloque.animal.notas} />}
            </>
          ) : (
            <>
              <Row label="Origen" valor={`${bloque.madre?.codigo ?? '?'} × ${bloque.padre?.codigo ?? '?'}`} color={cfg.color} />
              <Row label="Total en jaula" valor={`${bloque.total} animales`} color={cfg.color} />
              {bloque.machos != null && <Row label="Machos" valor={`♂ ${bloque.machos}`} color="#40c4ff" />}
              {bloque.hembras != null && <Row label="Hembras" valor={`♀ ${bloque.hembras}`} color="#ce93d8" />}
              <Row label="Nacimiento" valor={formatFecha(bloque.camada?.fecha_nacimiento)} />
              <Row label="Edad" valor={bloque.edad != null ? `${bloque.edad} días (${formatEdad(bloque.edad)})` : '—'} />
              <Row label="Tipo" valor="Stock / Destete" />
              {bloque.jaula?.notas && <Row label="Notas" valor={bloque.jaula.notas} />}
            </>
          )}
        </div>
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

// ── Página principal ──────────────────────────────────────────────────────────

export default function Stock() {
  const { animales, camadas, sacrificios, jaulas } = useBioterio()
  const [vista, setVista] = useState('jaulas')
  const [detalle, setDetalle] = useState(null)
  const [filtroCat, setFiltroCat] = useState('todas')

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
  const datosResumen = useMemo(() => {
    const hembrasRepro = animales.filter((a) => a.sexo === 'hembra' && (a.estado === 'activo' || a.estado === 'en_cria' || a.estado === 'en_apareamiento'))
    const machosRepro  = animales.filter((a) => a.sexo === 'macho'  && (a.estado === 'activo' || a.estado === 'en_cria' || a.estado === 'en_apareamiento'))
    let crias = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let jovenes = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let adultosNR = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let lactantes = { total: 0, grupos: 0 }

    camadas.filter((c) => c.fecha_nacimiento).forEach((c) => {
      const edad = edadDias(c.fecha_nacimiento)
      if (edad === null) return
      const stock = stockCamada(c, sacrificios)
      if (stock <= 0) return
      const totalBase = c.total_destetados ?? c.total_crias ?? 0
      const ratio = totalBase > 0 ? stock / totalBase : 0
      const m = Math.round((c.crias_machos ?? 0) * ratio)
      const h = Math.round((c.crias_hembras ?? 0) * ratio)
      if (edad < BIO.DESTETE_DIAS) {
        lactantes.total += c.total_crias ?? 0; lactantes.grupos += 1
      } else if (edad < 42) {
        crias.total += stock; crias.grupos += 1; crias.machos += m; crias.hembras += h
      } else if (edad < BIO.MADUREZ_DIAS) {
        jovenes.total += stock; jovenes.grupos += 1; jovenes.machos += m; jovenes.hembras += h
      } else {
        adultosNR.total += stock; adultosNR.grupos += 1; adultosNR.machos += m; adultosNR.hembras += h
      }
    })
    return { hembrasRepro, machosRepro, crias, jovenes, adultosNR, lactantes }
  }, [animales, camadas, sacrificios])

  const bloquesFiltrados = useMemo(() =>
    filtroCat === 'todas' ? bloques : bloques.filter((b) => b.categoria === filtroCat),
  [bloques, filtroCat])

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
    <div className="p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>

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
      <div className="flex gap-2">
        {btnTab('jaulas', '⬛ Vista por jaulas')}
        {btnTab('resumen', '📊 Vista por categorías')}
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
                <BloqueJaula key={b.id} bloque={b} onClick={setDetalle} />
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

      {/* Modal de detalle */}
      {detalle && <DetalleModal bloque={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  )
}
