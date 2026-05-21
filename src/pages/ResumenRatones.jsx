import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { difDias, parseDate, hoy, formatFecha } from '../utils/calculos'
import { BIO_RATONES } from '../utils/constants'
import { generarId } from '../utils/storage'
import { ArrowLeft, RefreshCw } from 'lucide-react'

// ── Grupos de ratones ─────────────────────────────────────────────────────────
const GRUPOS = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// Cutoffs de edad para ratones (días desde nacimiento) — desde BIO_RATONES
const CUTOFF_JOVENES  = 42                              // 6 semanas — fijo para todas las especies
const CUTOFF_ADULTOS  = BIO_RATONES.STOCK_ADULTOS_DIAS  // 10 semanas para ratones

// Colores de colonia para badges
const COLOR_COLONIA = {
  ratones_balbc:    BIOTERIOS_CONFIG.ratones_balbc.color,    // #40c4ff
  ratones_c57:      BIOTERIOS_CONFIG.ratones_c57.color,      // #a78bfa
  ratones_hibridos: BIOTERIOS_CONFIG.ratones_hibridos.color, // #ffb300
}

const LABEL_CATEGORIA = {
  cria: 'Cría', joven: 'Joven', adulto_nr: 'Adulto NR', reproductor: 'Reproductor', otro: 'Otro',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function edadDias(fechaNacimiento) {
  if (!fechaNacimiento) return null
  return difDias(parseDate(fechaNacimiento), parseDate(hoy()))
}

function clasificarEdad(dias) {
  if (dias === null) return 'sin_fecha'
  if (dias < CUTOFF_JOVENES) return 'crias'
  if (dias < CUTOFF_ADULTOS) return 'jovenes'
  return 'adultos'
}

function stockCamada(camada, sacrificios, entregas) {
  const sacCount = sacrificios
    .filter((s) => s.camada_id === camada.id)
    .reduce((sum, s) => sum + s.cantidad, 0)
  const entCount = entregas
    .filter((e) => e.camada_id === camada.id)
    .reduce((sum, e) => sum + e.cantidad, 0)
  const base = camada.total_destetados ?? camada.total_crias ?? 0
  return Math.max(0, base - sacCount - entCount)
}

// Calcula el desglose de stock por categoría de edad para un grupo
function calcularStockGrupo(jaulas, camadas, sacrificios, entregas, animales = []) {
  const result = {
    crias: 0, jovenes: 0, adultos: 0, sin_fecha: 0, total: 0, jaulas: 0,
    jaulasCrias: 0, jaulasJovenes: 0, jaulasAdultos: 0, jaulasSin_fecha: 0,
  }

  const camadasMap = Object.fromEntries(camadas.map((c) => [c.id, c]))
  const jaulasIds  = new Set(jaulas.map((j) => j.camada_id))

  // ── Jaulas reales ──
  for (const jaula of jaulas) {
    const camada = camadasMap[jaula.camada_id]
    if (!camada || camada.incluir_en_stock === false) continue
    const edad = edadDias(camada.fecha_nacimiento)
    const cat  = clasificarEdad(edad)
    result[cat] += jaula.total
    result.total += jaula.total
    result.jaulas++
    result[`jaulas${cat.charAt(0).toUpperCase()}${cat.slice(1)}`]++
  }

  // ── Bloques virtuales (camadas con destete pero sin jaula en DB) ──
  for (const camada of camadas) {
    if (!camada.fecha_destete) continue
    if (camada.failure_flag) continue
    if (camada.incluir_en_stock === false) continue
    if (jaulasIds.has(camada.id)) continue

    const stock = stockCamada(camada, sacrificios, entregas)
    if (stock <= 0) continue

    const edad = edadDias(camada.fecha_nacimiento)
    const cat  = clasificarEdad(edad)
    result[cat] += stock
    result.total += stock
    result.jaulas++
    result[`jaulas${cat.charAt(0).toUpperCase()}${cat.slice(1)}`]++
  }

  // ── Reproductores activos → siempre cuentan como adultos ──
  for (const animal of animales) {
    result.adultos += 1
    result.total   += 1
    const jaulaVacia = animal.sexo === 'hembra' && animal.estado === 'en_apareamiento'
    if (!jaulaVacia) {
      result.jaulas++
      result.jaulasAdultos++
    }
  }

  return result
}

// ── Sub-componente: badge de colonia ─────────────────────────────────────────

function OrigenBadge({ bioterioId }) {
  const cfg = BIOTERIOS_CONFIG[bioterioId]
  if (!cfg) return null
  return (
    <span
      className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: `${cfg.color}18`,
        border: `1px solid ${cfg.color}40`,
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.labelCorto}
    </span>
  )
}

// ── Sub-componente: menú de confirmación de restauración ─────────────────────

function MenuRestaurar({ labelRestaurar, onRestaurar, onSoloBorrar, onCerrar }) {
  return (
    <div
      className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-2xl"
      style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(30,51,82,0.9)', minWidth: '230px' }}
    >
      <button
        onClick={onRestaurar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(30,51,82,0.8)', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,230,118,0.07)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="font-semibold" style={{ color: '#00e676' }}>{labelRestaurar}</div>
        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>El animal vuelve a su estado anterior</div>
      </button>
      <button
        onClick={onSoloBorrar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#e2e8f0', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,61,87,0.07)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="font-semibold" style={{ color: '#ff5252' }}>✕ Solo borrar registro</div>
        <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>Borra solo el registro, sin restaurar</div>
      </button>
      <button
        onClick={onCerrar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#4a5f7a', borderTop: '1px solid rgba(30,51,82,0.6)', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(74,95,122,0.06)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        Cancelar
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ResumenRatones() {
  const { limpiarBioterio, setBioterioActivo } = useBioterioActivo()

  const [datos,    setDatos]    = useState(null)   // stock calculado por grupo
  const [rawData,  setRawData]  = useState(null)   // datos crudos para sacrificios
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  // ── Estado de la sección sacrificios ──────────────────────────────────────
  const [filtroColonia, setFiltroColonia] = useState('todas')
  const [menuAbierto,   setMenuAbierto]   = useState(null)
  const [cargandoSac,   setCargandoSac]   = useState(null)

  async function cargarDatos() {
    setCargando(true)
    setError(null)
    try {
      // Fetch paralelo para los 3 grupos
      const resultados = await Promise.all(
        GRUPOS.map((gid) =>
          Promise.all([
            supabase.from('jaulas').select('*').eq('bioterio_id', gid),
            supabase.from('camadas').select('*').eq('bioterio_id', gid),
            supabase.from('sacrificios').select('*').eq('bioterio_id', gid),
            supabase.from('entregas').select('*').eq('bioterio_id', gid),
            // Solo activos para el cálculo de stock
            supabase.from('animales')
              .select('id, sexo, estado, fecha_nacimiento')
              .eq('bioterio_id', gid)
              .in('estado', ['activo', 'en_apareamiento', 'en_cria']),
            // Todos (incluye fallecidos) para lookup de sacrificios
            supabase.from('animales')
              .select('id, codigo, sexo, estado, id_madre, id_padre')
              .eq('bioterio_id', gid),
          ])
        )
      )

      const nuevosDatos = {}
      const nuevoRaw    = {}
      GRUPOS.forEach((gid, i) => {
        const [
          { data: jaulas }, { data: camadas }, { data: sacrificios },
          { data: entregas }, { data: animalesActivos }, { data: animalesTodos },
        ] = resultados[i]

        // Stock calculado (para la tarjeta de totales)
        nuevosDatos[gid] = calcularStockGrupo(
          jaulas ?? [], camadas ?? [], sacrificios ?? [], entregas ?? [], animalesActivos ?? []
        )

        // Datos crudos (para la sección de sacrificios)
        nuevoRaw[gid] = {
          sacrificios:   sacrificios ?? [],
          camadas:       camadas ?? [],
          animalesTodos: animalesTodos ?? [],
        }
      })

      setDatos(nuevosDatos)
      setRawData(nuevoRaw)
    } catch (e) {
      console.error('Error al cargar resumen de ratones:', e)
      setError('No se pudo cargar el resumen. Verificá la conexión.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  // ── Totales globales de stock ─────────────────────────────────────────────
  const totales = useMemo(() => {
    if (!datos) return null
    return GRUPOS.reduce(
      (acc, gid) => {
        const g = datos[gid]
        acc.crias          += g.crias
        acc.jovenes        += g.jovenes
        acc.adultos        += g.adultos
        acc.sin_fecha      += g.sin_fecha
        acc.total          += g.total
        acc.jaulas         += g.jaulas
        acc.jaulasCrias    += g.jaulasCrias
        acc.jaulasJovenes  += g.jaulasJovenes
        acc.jaulasAdultos  += g.jaulasAdultos
        acc.jaulasSin_fecha += g.jaulasSin_fecha
        return acc
      },
      {
        crias: 0, jovenes: 0, adultos: 0, sin_fecha: 0, total: 0, jaulas: 0,
        jaulasCrias: 0, jaulasJovenes: 0, jaulasAdultos: 0, jaulasSin_fecha: 0,
      }
    )
  }, [datos])

  // ── Sacrificios enriquecidos y unificados ─────────────────────────────────
  const sacEnriquecidos = useMemo(() => {
    if (!rawData) return []

    // Aplanar todos los animales de los 3 grupos para lookup
    const animalesMap = {}
    GRUPOS.forEach((gid) => {
      ;(rawData[gid].animalesTodos ?? []).forEach((a) => { animalesMap[a.id] = a })
    })

    const lista = []
    GRUPOS.forEach((gid) => {
      const { sacrificios, camadas } = rawData[gid]
      const camadasMap = Object.fromEntries(camadas.map((c) => [c.id, c]))

      sacrificios.forEach((s) => {
        // Lookup según tipo
        let animalInfo = null
        let madre = null
        let padre = null

        if (s.categoria === 'reproductor' && s.animal_id) {
          animalInfo = animalesMap[s.animal_id] ?? null
        } else if (s.camada_id) {
          const camada = camadasMap[s.camada_id]
          if (camada) {
            madre = camada.id_madre ? animalesMap[camada.id_madre] ?? null : null
            padre = camada.id_padre ? animalesMap[camada.id_padre] ?? null : null
          }
        }

        lista.push({ ...s, animalInfo, madre, padre, bioterioId: gid })
      })
    })

    // Ordenar por fecha descendente
    lista.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    return lista
  }, [rawData])

  // Aplica filtro de colonia
  const sacFiltrados = useMemo(() =>
    filtroColonia === 'todas'
      ? sacEnriquecidos
      : sacEnriquecidos.filter((s) => s.bioterioId === filtroColonia),
  [sacEnriquecidos, filtroColonia])

  // Total de animales sacrificados por colonia (para tabs)
  const totalPorColonia = useMemo(() => {
    const map = {}
    GRUPOS.forEach((gid) => { map[gid] = 0 })
    sacEnriquecidos.forEach((s) => { map[s.bioterioId] = (map[s.bioterioId] ?? 0) + s.cantidad })
    return map
  }, [sacEnriquecidos])

  // ── Restaurar sacrificio — Supabase directo (fuera del BiotheriumContext) ──
  async function handleRestaurarSac(sacrificio, restaurar) {
    setCargandoSac(sacrificio.id)
    setMenuAbierto(null)
    try {
      // 1. Borrar el registro de sacrificio
      const { error: errDel } = await supabase.from('sacrificios').delete().eq('id', sacrificio.id)
      if (errDel) { console.error('Error al borrar sacrificio:', errDel); return }

      if (restaurar) {
        if (sacrificio.categoria === 'reproductor' && sacrificio.animal_id) {
          // 2a. Restaurar reproductor: volver a activo
          const { error: errAnimal } = await supabase.from('animales').update({
            estado: 'activo',
            fecha_sacrificio: null,
            motivo_sacrificio: null,
          }).eq('id', sacrificio.animal_id)
          if (errAnimal) console.error('Error al restaurar reproductor:', errAnimal)
        } else if (sacrificio.camada_id && sacrificio.cantidad > 0) {
          // 2b. Restaurar stock: recrear jaula con los animales sacrificados
          const { error: errJaula } = await supabase.from('jaulas').insert({
            id: generarId(),
            camada_id: sacrificio.camada_id,
            total: sacrificio.cantidad,
            machos: null,
            hembras: null,
            notas: 'Sacrificio revertido',
            bioterio_id: sacrificio.bioterio_id,
          })
          if (errJaula) console.error('Error al recrear jaula:', errJaula)
        }
      }

      // Refrescar datos
      await cargarDatos()
    } finally {
      setCargandoSac(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#050810' }}
      onClick={() => setMenuAbierto(null)}
    >

      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: 'rgba(13,21,40,0.6)' }}
      >
        <button
          onClick={limpiarBioterio}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono transition-colors"
          style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)', color: '#40c4ff' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(64,196,255,0.14)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(64,196,255,0.07)' }}
        >
          <ArrowLeft size={14} />
          Volver al selector
        </button>

        <div className="flex-1">
          <h1 className="font-bold text-white text-base">Resumen total de ratones</h1>
          <p className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
            Balb/C · C57 · Híbridos — Stock unificado
          </p>
        </div>

        <button
          onClick={cargarDatos}
          disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl mx-auto w-full">

        {error && (
          <div className="rounded-2xl px-5 py-4 text-sm font-mono"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
            ⚠️ {error}
          </div>
        )}

        {cargando && !datos && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#40c4ff', borderTopColor: 'transparent' }} />
            <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>
              Cargando datos de las 3 colonias...
            </span>
          </div>
        )}

        {totales && (
          <>
            {/* ── Tarjeta total global de stock ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.8)', border: '1.5px solid rgba(64,196,255,0.3)', boxShadow: '0 0 30px rgba(64,196,255,0.06)' }}>
              <div className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: 'rgba(64,196,255,0.05)' }}>
                <span className="text-2xl">🐭</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Stock total de ratones</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    {totales.jaulas} {totales.jaulas === 1 ? 'jaula' : 'jaulas'} · Balb/C + C57 + Híbridos
                  </div>
                </div>
                <div className="text-3xl font-bold font-mono" style={{ color: '#40c4ff' }}>
                  {totales.total}
                </div>
              </div>
              <div className="px-6 py-5 grid grid-cols-3 gap-3">
                <TarjetaEdad label="Crías"   subtitulo="< 6 semanas"    icono="🐣" cantidad={totales.crias}   jaulas={totales.jaulasCrias}   color="#00e676" />
                <TarjetaEdad label="Jóvenes" subtitulo="6 – 10 semanas" icono="🐭" cantidad={totales.jovenes} jaulas={totales.jaulasJovenes} color="#ffb300" />
                <TarjetaEdad label="Adultos" subtitulo="> 10 semanas"   icono="🐁" cantidad={totales.adultos} jaulas={totales.jaulasAdultos} color="#ff6b80" />
              </div>
              {totales.sin_fecha > 0 && (
                <div className="px-6 py-3 flex items-center gap-2 text-xs font-mono"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#4a5f7a' }}>
                  <span>⚠</span>
                  <span>{totales.sin_fecha} animales sin fecha de nacimiento registrada — no clasificados por edad</span>
                </div>
              )}
            </div>

            {/* ── Distribución por colonia ── */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
                Distribución por colonia
              </h2>
              <div className="space-y-3">
                {GRUPOS.map((gid) => (
                  <FilaColonia
                    key={gid}
                    cfg={BIOTERIOS_CONFIG[gid]}
                    grupo={datos[gid]}
                    totalGlobal={totales.total}
                    onEntrar={() => setBioterioActivo(gid)}
                  />
                ))}
              </div>
            </div>

            {/* ── Historial unificado de sacrificios ── */}
            <div>
              {/* Encabezado de sección */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: '#ff6b80' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff6b80' }}>
                    🗡 Sacrificios de ratones
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,61,87,0.1)', color: '#ff6b80', border: '1px solid rgba(255,61,87,0.25)' }}>
                    {sacEnriquecidos.reduce((s, x) => s + x.cantidad, 0)} animales · {sacEnriquecidos.length} registros
                  </span>
                </div>
              </div>

              {/* Filtros por colonia */}
              <div className="flex gap-2 flex-wrap mb-4">
                {[
                  { id: 'todas', label: 'Todos', color: '#8a9bb0' },
                  ...GRUPOS.map((gid) => ({
                    id: gid,
                    label: BIOTERIOS_CONFIG[gid].labelCorto,
                    color: COLOR_COLONIA[gid],
                  })),
                ].map(({ id, label, color }) => {
                  const activo = filtroColonia === id
                  const count = id === 'todas'
                    ? sacEnriquecidos.length
                    : sacEnriquecidos.filter(s => s.bioterioId === id).length
                  return (
                    <button
                      key={id}
                      onClick={() => setFiltroColonia(id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={activo
                        ? { background: `${color}18`, border: `1px solid ${color}50`, color }
                        : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }}
                    >
                      {label}
                      <span className="ml-1.5 font-mono opacity-60">({count})</span>
                    </button>
                  )
                })}
              </div>

              {/* Tabla de sacrificios */}
              {sacFiltrados.length === 0 ? (
                <div className="rounded-2xl p-10 text-center"
                  style={{ background: 'rgba(255,107,128,0.04)', border: '1px dashed rgba(255,107,128,0.2)' }}>
                  <div className="text-2xl mb-2">📋</div>
                  <div className="font-semibold text-sm" style={{ color: '#ff6b80' }}>
                    {sacEnriquecidos.length === 0 ? 'Sin sacrificios registrados' : 'Sin sacrificios en esta colonia'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
                    Los sacrificios se registran desde Stock dentro de cada colonia
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: '580px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                          {['Fecha', 'Colonia', 'Animal / Grupo', 'Cant.', 'Categoría', 'Notas', ''].map((h, i) => (
                            <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                              style={{ color: '#4a5f7a' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sacFiltrados.map((s) => {
                          const enProceso = cargandoSac === s.id
                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>

                              {/* Fecha */}
                              <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8a9bb0', whiteSpace: 'nowrap' }}>
                                {formatFecha(s.fecha)}
                              </td>

                              {/* Colonia */}
                              <td className="px-4 py-3">
                                <OrigenBadge bioterioId={s.bioterioId} />
                              </td>

                              {/* Animal o progenitores */}
                              <td className="px-4 py-3">
                                {s.categoria === 'reproductor' && s.animalInfo ? (
                                  <div>
                                    <span className="font-mono font-semibold text-white">{s.animalInfo.codigo}</span>
                                    <span className="ml-1.5 text-xs" style={{ color: s.animalInfo.sexo === 'hembra' ? '#ce93d8' : '#40c4ff' }}>
                                      {s.animalInfo.sexo === 'hembra' ? '♀' : '♂'}
                                    </span>
                                  </div>
                                ) : s.madre || s.padre ? (
                                  <span className="font-mono text-sm">
                                    <span style={{ color: '#ce93d8' }}>{s.madre?.codigo ?? '?'}</span>
                                    <span style={{ color: '#4a5f7a' }}> × </span>
                                    <span style={{ color: '#40c4ff' }}>{s.padre?.codigo ?? '?'}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#4a5f7a' }}>—</span>
                                )}
                              </td>

                              {/* Cantidad */}
                              <td className="px-4 py-3 font-mono font-bold text-lg" style={{ color: '#ff6b80' }}>
                                {s.cantidad}
                              </td>

                              {/* Categoría */}
                              <td className="px-4 py-3 text-xs" style={{ color: '#8a9bb0' }}>
                                {s.categoria ? (LABEL_CATEGORIA[s.categoria] ?? s.categoria) : '—'}
                              </td>

                              {/* Notas */}
                              <td className="px-4 py-3 text-xs" style={{ color: '#4a5f7a', maxWidth: '180px' }}>
                                {s.notas ?? '—'}
                              </td>

                              {/* Botón Restaurar */}
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block">
                                  <button
                                    onClick={() => { if (!enProceso) setMenuAbierto(prev => prev === s.id ? null : s.id) }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                      background: 'rgba(0,230,118,0.08)',
                                      border: '1px solid rgba(0,230,118,0.3)',
                                      color: enProceso ? '#4a5f7a' : '#00e676',
                                      cursor: enProceso ? 'default' : 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {enProceso ? '...' : '↩ Restaurar'}
                                  </button>
                                  {menuAbierto === s.id && (
                                    <MenuRestaurar
                                      labelRestaurar={
                                        s.categoria === 'reproductor'
                                          ? '↩ Restaurar como activo'
                                          : '↩ Restaurar al stock'
                                      }
                                      onRestaurar={() => handleRestaurarSac(s, true)}
                                      onSoloBorrar={() => handleRestaurarSac(s, false)}
                                      onCerrar={() => setMenuAbierto(null)}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Nota de uso ── */}
            <div className="rounded-xl px-5 py-4 text-xs font-mono space-y-1"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', color: '#4a5f7a' }}>
              <div className="font-semibold" style={{ color: '#6a8099' }}>Nota</div>
              <div>Los animales siguen perteneciendo a sus colonias originales.</div>
              <div>Este resumen unifica visualmente stock y sacrificios de las 3 colonias.</div>
              <div>Cliqueá una colonia para entrar y gestionar sus animales.</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes de stock ───────────────────────────────────────────────────

function TarjetaEdad({ label, subtitulo, icono, cantidad, jaulas, color }) {
  return (
    <div className="rounded-xl p-4 flex flex-col items-center gap-1 text-center"
      style={{ background: `${color}09`, border: `1px solid ${color}25` }}>
      <span className="text-xl">{icono}</span>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{cantidad}</div>
      {jaulas > 0 && (
        <div className="text-xs font-mono" style={{ color: `${color}99` }}>
          {jaulas} {jaulas === 1 ? 'jaula' : 'jaulas'}
        </div>
      )}
      <div className="text-xs font-semibold" style={{ color: '#c9d4e0' }}>{label}</div>
      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{subtitulo}</div>
    </div>
  )
}

function FilaColonia({ cfg, grupo, totalGlobal, onEntrar }) {
  const pct = totalGlobal > 0 ? Math.round((grupo.total / totalGlobal) * 100) : 0
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(13,21,40,0.6)', border: `1px solid ${cfg.color}25` }}>
      <div className="px-5 py-3 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}07` }}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        <span className="font-bold text-sm text-white flex-1">{cfg.labelCorto}</span>
        <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{pct}% del total</span>
        <span className="text-lg font-bold font-mono" style={{ color: cfg.color }}>{grupo.total}</span>
        <button
          onClick={onEntrar}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
          style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}35`, color: cfg.color }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${cfg.color}22` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${cfg.color}12` }}
        >
          Entrar ›
        </button>
      </div>
      <div className="px-5 py-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: cfg.color }} />
        </div>
      </div>
      <div className="px-5 py-3 grid grid-cols-3 gap-3 text-center">
        <MiniCat label="Crías"   cantidad={grupo.crias}   jaulas={grupo.jaulasCrias}   color="#00e676" />
        <MiniCat label="Jóvenes" cantidad={grupo.jovenes} jaulas={grupo.jaulasJovenes} color="#ffb300" />
        <MiniCat label="Adultos" cantidad={grupo.adultos} jaulas={grupo.jaulasAdultos} color="#ff6b80" />
      </div>
      {grupo.sin_fecha > 0 && (
        <div className="px-5 py-2 text-xs font-mono"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#3d5068' }}>
          +{grupo.sin_fecha} sin fecha de nacimiento
        </div>
      )}
    </div>
  )
}

function MiniCat({ label, cantidad, jaulas, color }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-base font-bold font-mono" style={{ color: cantidad > 0 ? color : '#2a3a50' }}>
        {cantidad}
        {jaulas > 0 && (
          <span className="text-xs font-normal" style={{ color: `${color}80` }}> ({jaulas})</span>
        )}
      </div>
      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{label}</div>
    </div>
  )
}
