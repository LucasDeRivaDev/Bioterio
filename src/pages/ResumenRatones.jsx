import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import {
  difDias, parseDate, hoy, formatFecha,
  generarTareas, generarAlertasMachos,
} from '../utils/calculos'
import { BIO_RATONES } from '../utils/constants'
import { generarId } from '../utils/storage'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { getPlanes, getNotas } from '../utils/db'
import { useTheme } from '../context/ThemeContext'

// ── Grupos de ratones ─────────────────────────────────────────────────────────
const GRUPOS = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

const CUTOFF_JOVENES = 42
const CUTOFF_ADULTOS = BIO_RATONES.STOCK_ADULTOS_DIAS

const COLOR_COLONIA = {
  ratones_balbc:    BIOTERIOS_CONFIG.ratones_balbc.color,
  ratones_c57:      BIOTERIOS_CONFIG.ratones_c57.color,
  ratones_hibridos: BIOTERIOS_CONFIG.ratones_hibridos.color,
}

const LABEL_CATEGORIA = {
  cria: 'Cría', joven: 'Joven', adulto_nr: 'Adulto NR', reproductor: 'Reproductor', otro: 'Otro',
}

// ── Config visual de notificaciones ──────────────────────────────────────────

const TIPO_CONFIG = {
  separacion:        { icono: '✂',  label: 'Separar pareja'      },
  control_parto:     { icono: '🐣', label: 'Parto próximo'       },
  destete:           { icono: '🍼', label: 'Destete'             },
  renovacion_machos: { icono: '♻',  label: 'Renovar machos'      },
  SACRIFICIO_F1:     { icono: '🗡', label: 'Sacrificio F1'       },
  edad_limite:       { icono: '⚠',  label: 'Macho: límite edad'  },
  edad_proxima:      { icono: '⏰', label: 'Macho: edad próxima'  },
  baja_performance:  { icono: '📉', label: 'Baja performance'     },
  nota:              { icono: '📝', label: 'Recordatorio'         },
  apareamiento_plan: { icono: '🔗', label: 'Apareamiento plan.'   },
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
  const sacCount = sacrificios.filter((s) => s.camada_id === camada.id).reduce((sum, s) => sum + s.cantidad, 0)
  const entCount = entregas.filter((e) => e.camada_id === camada.id && !e.devuelta).reduce((sum, e) => sum + e.cantidad, 0)
  const base = camada.total_destetados ?? camada.total_crias ?? 0
  return Math.max(0, base - sacCount - entCount)
}

function calcularStockGrupo(jaulas, camadas, sacrificios, entregas, animalesActivos = []) {
  const result = {
    crias: 0, jovenes: 0, adultos: 0, sin_fecha: 0, total: 0, jaulas: 0,
    jaulasCrias: 0, jaulasJovenes: 0, jaulasAdultos: 0, jaulasSin_fecha: 0,
  }
  const camadasMap = Object.fromEntries(camadas.map((c) => [c.id, c]))
  const jaulasIds  = new Set(jaulas.map((j) => j.camada_id))

  for (const jaula of jaulas) {
    const camada = camadasMap[jaula.camada_id]
    if (!camada || camada.incluir_en_stock === false) continue
    const edad = edadDias(camada.fecha_nacimiento)
    const cat  = clasificarEdad(edad)
    result[cat] += jaula.total; result.total += jaula.total; result.jaulas++
    result[`jaulas${cat.charAt(0).toUpperCase()}${cat.slice(1)}`]++
  }

  for (const camada of camadas) {
    if (!camada.fecha_destete || camada.failure_flag || camada.incluir_en_stock === false) continue
    if (jaulasIds.has(camada.id)) continue
    const stock = stockCamada(camada, sacrificios, entregas)
    if (stock <= 0) continue
    const edad = edadDias(camada.fecha_nacimiento)
    const cat  = clasificarEdad(edad)
    result[cat] += stock; result.total += stock; result.jaulas++
    result[`jaulas${cat.charAt(0).toUpperCase()}${cat.slice(1)}`]++
  }

  for (const animal of animalesActivos) {
    result.adultos += 1; result.total += 1
    const jaulaVacia = animal.sexo === 'hembra' && animal.estado === 'en_apareamiento'
    if (!jaulaVacia) { result.jaulas++; result.jaulasAdultos++ }
  }
  return result
}

// Lee planes desde el cache en memoria (cargado desde Supabase al iniciar)
function leerPlanesApareamiento(bioId) { return getPlanes(bioId) }

// Lee notas pendientes desde el cache en memoria
function leerNotasPendientes(bioId) {
  const hoyStr = hoy()
  return getNotas(bioId).filter((n) => !n.completada && n.fecha <= hoyStr)
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function OrigenBadge({ bioterioId }) {
  const cfg = BIOTERIOS_CONFIG[bioterioId]
  if (!cfg) return null
  return (
    <span
      className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, color: cfg.color, whiteSpace: 'nowrap' }}
    >
      {cfg.labelCorto}
    </span>
  )
}

function MenuRestaurar({ labelRestaurar, onRestaurar, onSoloBorrar, onCerrar }) {
  const { tema } = useTheme()
  return (
    <div
      className="absolute right-0 top-8 z-50 rounded-xl overflow-hidden shadow-2xl"
      style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.9)', minWidth: '230px' }}
    >
      <button onClick={onRestaurar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(30,51,82,0.8)', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,230,118,0.07)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="font-semibold" style={{ color: tema.accent }}>{labelRestaurar}</div>
        <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>El animal vuelve a su estado anterior</div>
      </button>
      <button onClick={onSoloBorrar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: '#e2e8f0', cursor: 'pointer', background: 'transparent' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,61,87,0.07)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div className="font-semibold" style={{ color: '#ff5252' }}>✕ Solo borrar registro</div>
        <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>Borra solo el registro, sin restaurar</div>
      </button>
      <button onClick={onCerrar}
        className="w-full text-left px-4 py-3 text-sm transition-colors"
        style={{ color: tema.textMuted, borderTop: '1px solid rgba(30,51,82,0.6)', cursor: 'pointer', background: 'transparent' }}
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
  const { tema, modoBrillo } = useTheme()
  const PRIORIDAD_CONFIG = {
    vencida: { label: 'Vencida', color: '#ff5252', bg: 'rgba(255,82,82,0.12)',    borde: 'rgba(255,82,82,0.35)',   orden: 0 },
    hoy:     { label: 'Hoy',     color: '#ff9800', bg: 'rgba(255,152,0,0.12)',    borde: 'rgba(255,152,0,0.35)',   orden: 1 },
    proxima: { label: 'Próxima', color: tema.amber, bg: 'rgba(255,179,0,0.10)',    borde: 'rgba(255,179,0,0.30)',   orden: 2 },
    info:    { label: 'Info',    color: tema.textSecondary, bg: 'rgba(138,155,176,0.08)', borde: 'rgba(138,155,176,0.25)', orden: 3 },
  }
  const { limpiarBioterio, setBioterioActivo } = useBioterioActivo()

  const [datos,    setDatos]    = useState(null)
  const [rawData,  setRawData]  = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  // Sacrificios
  const [filtroColonia, setFiltroColonia] = useState('todas')
  const [menuAbierto,   setMenuAbierto]   = useState(null)
  const [cargandoSac,   setCargandoSac]   = useState(null)

  // Notificaciones
  const [filtroNotif, setFiltroNotif] = useState('todas')

  async function cargarDatos() {
    setCargando(true)
    setError(null)
    try {
      const resultados = await Promise.all(
        GRUPOS.map((gid) =>
          Promise.all([
            supabase.from('jaulas').select('*').eq('bioterio_id', gid),
            supabase.from('camadas').select('*').eq('bioterio_id', gid),
            supabase.from('sacrificios').select('*').eq('bioterio_id', gid),
            supabase.from('entregas').select('*').eq('bioterio_id', gid),
            supabase.from('animales')
              .select('id, sexo, estado, fecha_nacimiento, codigo, id_madre, id_padre')
              .eq('bioterio_id', gid)
              .in('estado', ['activo', 'en_apareamiento', 'en_cria']),
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

        nuevosDatos[gid] = calcularStockGrupo(
          jaulas ?? [], camadas ?? [], sacrificios ?? [], entregas ?? [], animalesActivos ?? []
        )
        nuevoRaw[gid] = {
          sacrificios:     sacrificios     ?? [],
          camadas:         camadas         ?? [],
          animalesActivos: animalesActivos ?? [],
          animalesTodos:   animalesTodos   ?? [],
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
        acc.crias   += g.crias;   acc.jovenes += g.jovenes; acc.adultos += g.adultos
        acc.sin_fecha += g.sin_fecha; acc.total += g.total; acc.jaulas  += g.jaulas
        acc.jaulasCrias += g.jaulasCrias; acc.jaulasJovenes += g.jaulasJovenes
        acc.jaulasAdultos += g.jaulasAdultos; acc.jaulasSin_fecha += g.jaulasSin_fecha
        return acc
      },
      { crias:0, jovenes:0, adultos:0, sin_fecha:0, total:0, jaulas:0,
        jaulasCrias:0, jaulasJovenes:0, jaulasAdultos:0, jaulasSin_fecha:0 }
    )
  }, [datos])

  // ── Notificaciones unificadas ─────────────────────────────────────────────
  const notificaciones = useMemo(() => {
    if (!rawData) return []
    const hoyStr  = hoy()
    const lista   = []

    // Para híbridos los progenitores viven en BAL/c o C57 — necesitamos todos los animales
    const todosAnimalesRatones = GRUPOS.flatMap((gid) => rawData[gid].animalesTodos ?? [])

    GRUPOS.forEach((gid) => {
      const { camadas, animalesActivos } = rawData[gid]
      const animalesParaBusqueda = gid === 'ratones_hibridos' ? todosAnimalesRatones : animalesActivos

      // 1. Tareas reproductivas (separación, parto, destete)
      generarTareas(camadas, animalesParaBusqueda, BIO_RATONES).forEach((t) => {
        lista.push({ ...t, bioterioId: gid })
      })

      // 2. Alertas de machos (edad, performance)
      generarAlertasMachos(animalesActivos, camadas).forEach((a) => {
        lista.push({
          id:          `macho-${a.machoId}-${gid}`,
          tipo:        a.tipo,
          prioridad:   a.tipo === 'edad_limite' ? 'vencida' : 'proxima',
          descripcion: a.mensaje,
          detalle:     a.detalle ?? null,
          fecha:       null,
          bioterioId:  gid,
        })
      })

      // 3. Notas pendientes del calendario (localStorage)
      leerNotasPendientes(gid).forEach((n) => {
        const prioridad = n.fecha < hoyStr ? 'vencida' : n.fecha === hoyStr ? 'hoy' : 'proxima'
        lista.push({
          id:          `nota-${n.id}`,
          tipo:        'nota',
          prioridad,
          descripcion: n.titulo,
          detalle:     n.descripcion || null,
          fecha:       n.fecha,
          bioterioId:  gid,
        })
      })

      // 4. Planes de apareamiento próximos ≤7 días (localStorage)
      leerPlanesApareamiento(gid).forEach((p) => {
        if (!p.fechaPlanificada) return
        const diasHasta = difDias(parseDate(hoyStr), parseDate(p.fechaPlanificada))
        if (diasHasta < 0 || diasHasta > 7) return
        lista.push({
          id:          `plan-${p.id ?? p.fechaPlanificada}-${gid}`,
          tipo:        'apareamiento_plan',
          prioridad:   diasHasta === 0 ? 'hoy' : 'proxima',
          descripcion: `Apareamiento planificado — ${formatFecha(p.fechaPlanificada)}`,
          detalle:     p.observaciones || null,
          fecha:       p.fechaPlanificada,
          bioterioId:  gid,
        })
      })
    })

    // Ordenar: vencida → hoy → proxima → info
    lista.sort((a, b) => {
      const oa = PRIORIDAD_CONFIG[a.prioridad]?.orden ?? 9
      const ob = PRIORIDAD_CONFIG[b.prioridad]?.orden ?? 9
      return oa !== ob ? oa - ob : (a.fecha ?? '').localeCompare(b.fecha ?? '')
    })

    return lista
  }, [rawData])

  const notifFiltradas = useMemo(() =>
    filtroNotif === 'todas' ? notificaciones : notificaciones.filter((n) => n.bioterioId === filtroNotif),
  [notificaciones, filtroNotif])

  const notifPorColonia = useMemo(() => {
    const map = {}
    GRUPOS.forEach((gid) => { map[gid] = 0 })
    notificaciones.forEach((n) => { map[n.bioterioId] = (map[n.bioterioId] ?? 0) + 1 })
    return map
  }, [notificaciones])

  // ── Sacrificios enriquecidos ──────────────────────────────────────────────
  const sacEnriquecidos = useMemo(() => {
    if (!rawData) return []
    const animalesMap = {}
    GRUPOS.forEach((gid) => {
      ;(rawData[gid].animalesTodos ?? []).forEach((a) => { animalesMap[a.id] = a })
    })
    const lista = []
    GRUPOS.forEach((gid) => {
      const { sacrificios, camadas } = rawData[gid]
      const camadasMap = Object.fromEntries(camadas.map((c) => [c.id, c]))
      sacrificios.forEach((s) => {
        let animalInfo = null, madre = null, padre = null
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
    lista.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    return lista
  }, [rawData])

  const sacFiltrados = useMemo(() =>
    filtroColonia === 'todas' ? sacEnriquecidos : sacEnriquecidos.filter((s) => s.bioterioId === filtroColonia),
  [sacEnriquecidos, filtroColonia])

  // ── Restaurar sacrificio ─────────────────────────────────────────────────
  async function handleRestaurarSac(sacrificio, restaurar) {
    setCargandoSac(sacrificio.id)
    setMenuAbierto(null)
    try {
      const { error: errDel } = await supabase.from('sacrificios').delete().eq('id', sacrificio.id)
      if (errDel) { console.error('Error al borrar sacrificio:', errDel); return }
      if (restaurar) {
        if (sacrificio.categoria === 'reproductor' && sacrificio.animal_id) {
          await supabase.from('animales').update({ estado: 'activo', fecha_sacrificio: null, motivo_sacrificio: null }).eq('id', sacrificio.animal_id)
        } else if (sacrificio.camada_id && sacrificio.cantidad > 0) {
          await supabase.from('jaulas').insert({ id: generarId(), camada_id: sacrificio.camada_id, total: sacrificio.cantidad, machos: null, hembras: null, notas: 'Sacrificio revertido', bioterio_id: sacrificio.bioterio_id })
        }
      }
      await cargarDatos()
    } finally { setCargandoSac(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: tema.bgMain }}
      onClick={() => setMenuAbierto(null)}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: tema.bgCard }}>
        <button onClick={limpiarBioterio}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono transition-colors"
          style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)', color: tema.blue }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(64,196,255,0.14)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(64,196,255,0.07)' }}
        >
          <ArrowLeft size={14} /> Volver al selector
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white text-base">Resumen total de ratones</h1>
          <p className="text-xs font-mono" style={{ color: tema.textMuted }}>Balb/C · C57 · Híbridos — Stock · Notificaciones · Sacrificios</p>
        </div>
        <button onClick={cargarDatos} disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: tema.textMuted, cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl mx-auto w-full">

        {error && (
          <div className="rounded-2xl px-5 py-4 text-sm font-mono"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: tema.red }}>
            ⚠️ {error}
          </div>
        )}

        {cargando && !datos && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#40c4ff', borderTopColor: 'transparent' }} />
            <span className="text-sm font-mono" style={{ color: tema.textMuted }}>Cargando datos de las 3 colonias...</span>
          </div>
        )}

        {totales && (
          <>
            {/* ── STOCK TOTAL ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: tema.bgCard, border: '1.5px solid rgba(64,196,255,0.3)', boxShadow: '0 0 30px rgba(64,196,255,0.06)' }}>
              <div className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: 'rgba(64,196,255,0.05)' }}>
                <span className="text-2xl">🐭</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Stock total de ratones</div>
                  <div className="text-xs font-mono" style={{ color: tema.textMuted }}>
                    {totales.jaulas} {totales.jaulas === 1 ? 'jaula' : 'jaulas'} · Balb/C + C57 + Híbridos
                  </div>
                </div>
                <div className="text-3xl font-bold font-mono" style={{ color: tema.blue }}>{totales.total}</div>
              </div>
              <div className="px-6 py-5 grid grid-cols-3 gap-3">
                <TarjetaEdad label="Crías"   subtitulo="< 6 semanas"    icono="🐣" cantidad={totales.crias}   jaulas={totales.jaulasCrias}   color="#00e676" />
                <TarjetaEdad label="Jóvenes" subtitulo="6 – 10 semanas" icono="🐭" cantidad={totales.jovenes} jaulas={totales.jaulasJovenes} color="#ffb300" />
                <TarjetaEdad label="Adultos" subtitulo="> 10 semanas"   icono="🐁" cantidad={totales.adultos} jaulas={totales.jaulasAdultos} color="#ff6b80" />
              </div>
              {totales.sin_fecha > 0 && (
                <div className="px-6 py-3 flex items-center gap-2 text-xs font-mono"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: tema.textMuted }}>
                  <span>⚠</span>
                  <span>{totales.sin_fecha} animales sin fecha de nacimiento — no clasificados por edad</span>
                </div>
              )}
            </div>

            {/* ── DISTRIBUCIÓN POR COLONIA ── */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: tema.textMuted }}>Distribución por colonia</h2>
              <div className="space-y-3">
                {GRUPOS.map((gid) => (
                  <FilaColonia key={gid} cfg={BIOTERIOS_CONFIG[gid]} grupo={datos[gid]} totalGlobal={totales.total} onEntrar={() => setBioterioActivo(gid)} />
                ))}
              </div>
            </div>

            {/* ── PANEL DE NOTIFICACIONES UNIFICADO ── */}
            <div>
              {/* Header sección */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: '#ffb300' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tema.amber }}>
                    🔔 Notificaciones
                  </span>
                  {notificaciones.length > 0 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,179,0,0.12)', color: tema.amber, border: '1px solid rgba(255,179,0,0.3)' }}>
                      {notificaciones.length} pendientes
                    </span>
                  )}
                </div>
              </div>

              {/* Filtros */}
              <div className="flex gap-2 flex-wrap mb-4">
                {[
                  { id: 'todas', label: 'Todas', color: tema.textSecondary, count: notificaciones.length },
                  ...GRUPOS.map((gid) => ({
                    id: gid, label: BIOTERIOS_CONFIG[gid].labelCorto,
                    color: COLOR_COLONIA[gid], count: notifPorColonia[gid],
                  })),
                ].map(({ id, label, color, count }) => (
                  <button key={id} onClick={() => setFiltroNotif(id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={filtroNotif === id
                      ? { background: `${color}18`, border: `1px solid ${color}50`, color }
                      : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: tema.textMuted }}
                  >
                    {label}
                    <span className="ml-1.5 font-mono opacity-60">({count})</span>
                  </button>
                ))}
              </div>

              {/* Lista de notificaciones */}
              {notifFiltradas.length === 0 ? (
                <div className="rounded-2xl p-10 text-center"
                  style={{ background: 'rgba(255,179,0,0.03)', border: '1px dashed rgba(255,179,0,0.2)' }}>
                  <div className="text-2xl mb-2">✅</div>
                  <div className="font-semibold text-sm" style={{ color: tema.amber }}>
                    {notificaciones.length === 0 ? 'Sin notificaciones pendientes' : 'Sin notificaciones en esta colonia'}
                  </div>
                  <div className="text-xs mt-1" style={{ color: tema.textMuted }}>Todas las colonias están al día</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifFiltradas.map((n) => {
                    const pCfg = PRIORIDAD_CONFIG[n.prioridad] ?? PRIORIDAD_CONFIG.info
                    const tCfg = TIPO_CONFIG[n.tipo] ?? { icono: '🔔', label: n.tipo }
                    return (
                      <div key={n.id}
                        className="rounded-xl px-4 py-3 flex items-start gap-3"
                        style={{ background: tema.bgCard, border: `1px solid ${pCfg.borde}` }}
                      >
                        {/* Icono de tipo */}
                        <span className="text-lg shrink-0 mt-0.5">{tCfg.icono}</span>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-white">{n.descripcion}</span>
                          </div>
                          {n.detalle && (
                            <div className="text-xs mt-0.5" style={{ color: tema.textMuted }}>{n.detalle}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                              style={{ background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.borde}` }}>
                              {pCfg.label}
                            </span>
                            <span className="text-xs font-mono" style={{ color: tema.textMuted }}>{tCfg.label}</span>
                            {n.fecha && (
                              <span className="text-xs font-mono" style={{ color: tema.textMuted }}>· {formatFecha(n.fecha)}</span>
                            )}
                          </div>
                        </div>

                        {/* Badge de colonia */}
                        <OrigenBadge bioterioId={n.bioterioId} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── SACRIFICIOS UNIFICADOS ── */}
            <div>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: '#ff6b80' }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: tema.red }}>
                    🗡 Sacrificios de ratones
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,61,87,0.1)', color: tema.red, border: '1px solid rgba(255,61,87,0.25)' }}>
                    {sacEnriquecidos.reduce((s, x) => s + x.cantidad, 0)} animales · {sacEnriquecidos.length} registros
                  </span>
                </div>
              </div>

              {/* Filtros sacrificios */}
              <div className="flex gap-2 flex-wrap mb-4">
                {[
                  { id: 'todas', label: 'Todos', color: tema.textSecondary, count: sacEnriquecidos.length },
                  ...GRUPOS.map((gid) => ({
                    id: gid, label: BIOTERIOS_CONFIG[gid].labelCorto,
                    color: COLOR_COLONIA[gid], count: sacEnriquecidos.filter(s => s.bioterioId === gid).length,
                  })),
                ].map(({ id, label, color, count }) => (
                  <button key={id} onClick={() => setFiltroColonia(id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={filtroColonia === id
                      ? { background: `${color}18`, border: `1px solid ${color}50`, color }
                      : { background: 'transparent', border: '1px solid rgba(30,51,82,0.6)', color: tema.textMuted }}
                  >
                    {label} <span className="ml-1.5 font-mono opacity-60">({count})</span>
                  </button>
                ))}
              </div>

              {sacFiltrados.length === 0 ? (
                <div className="rounded-2xl p-10 text-center"
                  style={{ background: 'rgba(255,107,128,0.04)', border: '1px dashed rgba(255,107,128,0.2)' }}>
                  <div className="text-2xl mb-2">📋</div>
                  <div className="font-semibold text-sm" style={{ color: tema.red }}>
                    {sacEnriquecidos.length === 0 ? 'Sin sacrificios registrados' : 'Sin sacrificios en esta colonia'}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: tema.bgCard, border: '1px solid rgba(30,51,82,0.8)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: '580px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(30,51,82,0.6)', background: 'rgba(0,0,0,0.1)' }}>
                          {['Fecha', 'Colonia', 'Animal / Grupo', 'Cant.', 'Categoría', 'Notas', ''].map((h, i) => (
                            <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sacFiltrados.map((s) => {
                          const enProceso = cargandoSac === s.id
                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid rgba(30,51,82,0.4)' }}>
                              <td className="px-4 py-3 font-mono text-xs" style={{ color: tema.textSecondary, whiteSpace: 'nowrap' }}>{formatFecha(s.fecha)}</td>
                              <td className="px-4 py-3"><OrigenBadge bioterioId={s.bioterioId} /></td>
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
                                    <span style={{ color: tema.purple }}>{s.madre?.codigo ?? '?'}</span>
                                    <span style={{ color: tema.textMuted }}> × </span>
                                    <span style={{ color: tema.blue }}>{s.padre?.codigo ?? '?'}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: tema.textMuted }}>—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-lg" style={{ color: tema.red }}>{s.cantidad}</td>
                              <td className="px-4 py-3 text-xs" style={{ color: tema.textSecondary }}>
                                {s.categoria ? (LABEL_CATEGORIA[s.categoria] ?? s.categoria) : '—'}
                              </td>
                              <td className="px-4 py-3 text-xs" style={{ color: tema.textMuted, maxWidth: '180px' }}>{s.notas ?? '—'}</td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="relative inline-block">
                                  <button
                                    onClick={() => { if (!enProceso) setMenuAbierto(prev => prev === s.id ? null : s.id) }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                      background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.3)',
                                      color: enProceso ? '#4a5f7a' : '#00e676',
                                      cursor: enProceso ? 'default' : 'pointer', whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {enProceso ? '...' : '↩ Restaurar'}
                                  </button>
                                  {menuAbierto === s.id && (
                                    <MenuRestaurar
                                      labelRestaurar={s.categoria === 'reproductor' ? '↩ Restaurar como activo' : '↩ Restaurar al stock'}
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

            {/* ── NOTA DE USO ── */}
            <div className="rounded-xl px-5 py-4 text-xs font-mono space-y-1"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', color: tema.textMuted }}>
              <div className="font-semibold" style={{ color: '#6a8099' }}>Nota</div>
              <div>Las notificaciones también siguen apareciendo dentro de cada colonia individual.</div>
              <div>Este panel las centraliza para ver el estado global sin entrar a cada una.</div>
              <div>Cliqueá en una colonia para gestionar sus animales.</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes de stock ───────────────────────────────────────────────────

function TarjetaEdad({ label, subtitulo, icono, cantidad, jaulas, color }) {
  const { tema } = useTheme()
  return (
    <div className="rounded-xl p-4 flex flex-col items-center gap-1 text-center"
      style={{ background: `${color}09`, border: `1px solid ${color}25` }}>
      <span className="text-xl">{icono}</span>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{cantidad}</div>
      {jaulas > 0 && <div className="text-xs font-mono" style={{ color: `${color}99` }}>{jaulas} {jaulas === 1 ? 'jaula' : 'jaulas'}</div>}
      <div className="text-xs font-semibold" style={{ color: tema.textPrimary }}>{label}</div>
      <div className="text-xs font-mono" style={{ color: tema.textMuted }}>{subtitulo}</div>
    </div>
  )
}

function FilaColonia({ cfg, grupo, totalGlobal, onEntrar }) {
  const { tema } = useTheme()
  const pct = totalGlobal > 0 ? Math.round((grupo.total / totalGlobal) * 100) : 0
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: tema.bgCard, border: `1px solid ${cfg.color}25` }}>
      <div className="px-5 py-3 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}07` }}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        <span className="font-bold text-sm text-white flex-1">{cfg.labelCorto}</span>
        <span className="text-xs font-mono" style={{ color: tema.textMuted }}>{pct}% del total</span>
        <span className="text-lg font-bold font-mono" style={{ color: cfg.color }}>{grupo.total}</span>
        <button onClick={onEntrar}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
          style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}35`, color: cfg.color }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${cfg.color}22` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${cfg.color}12` }}
        >Entrar ›</button>
      </div>
      <div className="px-5 py-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.color }} />
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
  const { tema } = useTheme()
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-base font-bold font-mono" style={{ color: cantidad > 0 ? color : '#2a3a50' }}>
        {cantidad}
        {jaulas > 0 && <span className="text-xs font-normal" style={{ color: `${color}80` }}> ({jaulas})</span>}
      </div>
      <div className="text-xs font-mono" style={{ color: tema.textMuted }}>{label}</div>
    </div>
  )
}
