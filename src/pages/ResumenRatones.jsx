import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { difDias, parseDate, hoy } from '../utils/calculos'
import { BIO_RATONES } from '../utils/constants'
import { ArrowLeft, RefreshCw } from 'lucide-react'

// ── Grupos de ratones ─────────────────────────────────────────────────────────
const GRUPOS = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// Cutoffs de edad para ratones (días desde nacimiento) — desde BIO_RATONES
const CUTOFF_JOVENES  = 42                              // 6 semanas — fijo para todas las especies
const CUTOFF_ADULTOS  = BIO_RATONES.STOCK_ADULTOS_DIAS  // 10 semanas para ratones

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
// animales = reproductores activos del grupo (se suman como adultos)
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
    if (camada.incluir_en_stock === false) continue
    if (jaulasIds.has(camada.id)) continue  // ya tiene jaula real

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
  // Hembras en apareamiento: el animal existe pero su jaula está vacía → no suma jaula
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

// ── Componente ────────────────────────────────────────────────────────────────

export default function ResumenRatones() {
  const { limpiarBioterio, setBioterioActivo } = useBioterioActivo()

  const [datos, setDatos]       = useState(null)   // { ratones_balbc: {...}, ... }
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

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
            supabase.from('animales').select('id, sexo, estado, fecha_nacimiento')
              .eq('bioterio_id', gid)
              .in('estado', ['activo', 'en_apareamiento', 'en_cria']),
          ])
        )
      )

      const nuevosDatos = {}
      GRUPOS.forEach((gid, i) => {
        const [{ data: jaulas }, { data: camadas }, { data: sacrificios }, { data: entregas }, { data: animales }] = resultados[i]
        nuevosDatos[gid] = calcularStockGrupo(
          jaulas ?? [],
          camadas ?? [],
          sacrificios ?? [],
          entregas ?? [],
          animales ?? []
        )
      })
      setDatos(nuevosDatos)
    } catch (e) {
      console.error('Error al cargar resumen de ratones:', e)
      setError('No se pudo cargar el resumen. Verificá la conexión.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  // ── Totales globales ──
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050810' }}>

      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: 'rgba(13,21,40,0.6)' }}
      >
        <button
          onClick={limpiarBioterio}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono transition-colors"
          style={{
            background: 'rgba(64,196,255,0.07)',
            border: '1px solid rgba(64,196,255,0.2)',
            color: '#40c4ff',
          }}
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
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#4a5f7a',
            cursor: cargando ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-3xl mx-auto w-full">

        {error && (
          <div
            className="rounded-2xl px-5 py-4 text-sm font-mono"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}
          >
            ⚠️ {error}
          </div>
        )}

        {cargando && !datos && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#40c4ff', borderTopColor: 'transparent' }}
            />
            <span className="text-sm font-mono" style={{ color: '#4a5f7a' }}>
              Cargando datos de las 3 colonias...
            </span>
          </div>
        )}

        {totales && (
          <>
            {/* ── Tarjeta total global ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(13,21,40,0.8)',
                border: '1.5px solid rgba(64,196,255,0.3)',
                boxShadow: '0 0 30px rgba(64,196,255,0.06)',
              }}
            >
              {/* Encabezado */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: 'rgba(64,196,255,0.05)' }}
              >
                <span className="text-2xl">🐭</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">Stock total de ratones</div>
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    {totales.jaulas} {totales.jaulas === 1 ? 'jaula' : 'jaulas'} · Balb/C + C57 + Híbridos
                  </div>
                </div>
                <div
                  className="text-3xl font-bold font-mono"
                  style={{ color: '#40c4ff' }}
                >
                  {totales.total}
                </div>
              </div>

              {/* Desglose por edad */}
              <div className="px-6 py-5 grid grid-cols-3 gap-3">
                <TarjetaEdad
                  label="Crías"
                  subtitulo="< 6 semanas"
                  icono="🐣"
                  cantidad={totales.crias}
                  jaulas={totales.jaulasCrias}
                  color="#00e676"
                />
                <TarjetaEdad
                  label="Jóvenes"
                  subtitulo="6 – 10 semanas"
                  icono="🐭"
                  cantidad={totales.jovenes}
                  jaulas={totales.jaulasJovenes}
                  color="#ffb300"
                />
                <TarjetaEdad
                  label="Adultos"
                  subtitulo="> 10 semanas"
                  icono="🐁"
                  cantidad={totales.adultos}
                  jaulas={totales.jaulasAdultos}
                  color="#ff6b80"
                />
              </div>

              {totales.sin_fecha > 0 && (
                <div
                  className="px-6 py-3 flex items-center gap-2 text-xs font-mono"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#4a5f7a' }}
                >
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
                {GRUPOS.map((gid) => {
                  const cfg   = BIOTERIOS_CONFIG[gid]
                  const grupo = datos[gid]
                  return (
                    <FilaColonia
                      key={gid}
                      cfg={cfg}
                      grupo={grupo}
                      totalGlobal={totales.total}
                      onEntrar={() => setBioterioActivo(gid)}
                    />
                  )
                })}
              </div>
            </div>

            {/* ── Nota de uso ── */}
            <div
              className="rounded-xl px-5 py-4 text-xs font-mono space-y-1"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#4a5f7a',
              }}
            >
              <div className="font-semibold" style={{ color: '#6a8099' }}>Nota</div>
              <div>Los animales siguen perteneciendo a sus colonias originales.</div>
              <div>Este resumen solo unifica visualmente los datos de stock.</div>
              <div>Cliqueá una colonia para entrar y gestionar sus animales.</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function TarjetaEdad({ label, subtitulo, icono, cantidad, jaulas, color }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center gap-1 text-center"
      style={{ background: `${color}09`, border: `1px solid ${color}25` }}
    >
      <span className="text-xl">{icono}</span>
      <div className="text-2xl font-bold font-mono" style={{ color }}>
        {cantidad}
      </div>
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
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(13,21,40,0.6)', border: `1px solid ${cfg.color}25` }}
    >
      {/* Encabezado de colonia */}
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${cfg.color}15`, background: `${cfg.color}07` }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: cfg.color }}
        />
        <span className="font-bold text-sm text-white flex-1">{cfg.labelCorto}</span>
        <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{pct}% del total</span>
        <span className="text-lg font-bold font-mono" style={{ color: cfg.color }}>
          {grupo.total}
        </span>
        <button
          onClick={onEntrar}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
          style={{
            background: `${cfg.color}12`,
            border: `1px solid ${cfg.color}35`,
            color: cfg.color,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${cfg.color}22` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${cfg.color}12` }}
        >
          Entrar ›
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="px-5 py-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: cfg.color }}
          />
        </div>
      </div>

      {/* Desglose por edad */}
      <div className="px-5 py-3 grid grid-cols-3 gap-3 text-center">
        <MiniCat label="Crías" cantidad={grupo.crias} jaulas={grupo.jaulasCrias} color="#00e676" />
        <MiniCat label="Jóvenes" cantidad={grupo.jovenes} jaulas={grupo.jaulasJovenes} color="#ffb300" />
        <MiniCat label="Adultos" cantidad={grupo.adultos} jaulas={grupo.jaulasAdultos} color="#ff6b80" />
      </div>

      {grupo.sin_fecha > 0 && (
        <div
          className="px-5 py-2 text-xs font-mono"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#3d5068' }}
        >
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
          <span className="text-xs font-normal" style={{ color: `${color}80` }}>
            {' '}({jaulas})
          </span>
        )}
      </div>
      <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>{label}</div>
    </div>
  )
}
