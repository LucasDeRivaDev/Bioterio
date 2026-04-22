import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { calcularLatencia, calcularPerfilHembra } from '../utils/calculos'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  verde:    '#00e676',
  azul:     '#40c4ff',
  amarillo: '#ffb300',
  rojo:     '#ff6b80',
  violeta:  '#ce93d8',
  gris:     '#4a5f7a',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function scorePromedioHembra(id, camadas) {
  const perfil = calcularPerfilHembra(id, camadas)
  if (!perfil) return null
  const vals = [
    perfil.avg_time_score,
    perfil.avg_litter_size_score,
    perfil.avg_sex_ratio_score,
    perfil.avg_survival_score,
  ].filter((v) => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function nivelScore(s) {
  if (s === null) return 'Sin datos'
  if (s >= 8) return 'Alta'
  if (s >= 6) return 'Media'
  return 'Baja'
}

// ── Estilos reutilizables ──────────────────────────────────────────────────────
const card = {
  background: 'rgba(13,21,40,0.9)',
  border: '1px solid rgba(30,51,82,0.8)',
  borderRadius: '16px',
  padding: '20px',
}

const inputStyle = {
  background: 'rgba(8,13,26,0.8)',
  border: '1px solid rgba(30,51,82,0.8)',
  color: '#c9d4e0',
  borderRadius: '10px',
  padding: '6px 10px',
  fontSize: '13px',
  outline: 'none',
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function TooltipOscuro({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{ background: 'rgba(8,13,26,0.97)', border: '1px solid rgba(30,51,82,0.9)', color: '#c9d4e0' }}
    >
      {label && <div className="font-bold mb-1" style={{ color: '#8a9bb0' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill ?? p.color }} />
          <span style={{ color: p.fill ?? p.color }}>{p.name ?? p.dataKey}</span>
          <span className="font-mono font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function KPI({ label, valor, color = '#c9d4e0', sub }) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-center"
      style={{ background: 'rgba(13,21,40,0.8)', border: `1px solid ${color}28` }}
    >
      <div className="text-2xl font-mono font-bold" style={{ color }}>{valor}</div>
      <div className="text-xs mt-1 font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#2a3a50' }}>{sub}</div>}
    </div>
  )
}

// ── Encabezado de cada gráfico ────────────────────────────────────────────────
function GraficoCard({ titulo, subtitulo, children, color = C.azul }) {
  return (
    <div style={card}>
      <div className="mb-4">
        <div className="text-sm font-bold" style={{ color }}>{titulo}</div>
        {subtitulo && <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{subtitulo}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Etiqueta personalizada para pie ──────────────────────────────────────────
function LabelPie({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#e2e8f0" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700} fontFamily="monospace">
      {value}
    </text>
  )
}

// ── Leyenda manual ────────────────────────────────────────────────────────────
function Leyenda({ items }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3 justify-center">
      {items.map(({ label, color, valor }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
          <span style={{ color: '#6a7f95' }}>{label}</span>
          {valor != null && <span className="font-mono font-bold" style={{ color }}>{valor}</span>}
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function SinDatos() {
  return (
    <div className="flex items-center justify-center h-40 text-xs" style={{ color: '#2a3a50' }}>
      Sin datos para el período seleccionado
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function Estadisticas() {
  const { camadas, animales } = useBioterio()

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [desde,         setDesde]         = useState('')
  const [hasta,         setHasta]         = useState('')
  const [filtroMadreId, setFiltroMadreId] = useState('')
  const [filtroPadreId, setFiltroPadreId] = useState('')

  const hembras = animales.filter((a) => a.sexo === 'hembra')
  const machos  = animales.filter((a) => a.sexo === 'macho')

  // ── Camadas filtradas ──────────────────────────────────────────────────────
  const camadasFiltradas = useMemo(() => {
    return camadas.filter((c) => {
      if (!c.fecha_copula) return false
      if (desde && c.fecha_copula < desde) return false
      if (hasta && c.fecha_copula > hasta) return false
      if (filtroMadreId && c.id_madre !== filtroMadreId) return false
      if (filtroPadreId && c.id_padre !== filtroPadreId) return false
      return true
    })
  }, [camadas, desde, hasta, filtroMadreId, filtroPadreId])

  // ── 1. Partos vs Fallas ────────────────────────────────────────────────────
  const dataPartos = useMemo(() => {
    const efectivos = camadasFiltradas.filter((c) => c.fecha_nacimiento && !c.failure_flag).length
    const fallidos  = camadasFiltradas.filter((c) => c.failure_flag).length
    const enCurso   = camadasFiltradas.filter((c) => !c.fecha_nacimiento && !c.failure_flag).length
    return {
      pie: [
        { name: 'Efectivos', value: efectivos, color: C.verde   },
        { name: 'Fallidos',  value: fallidos,  color: C.rojo    },
        { name: 'En curso',  value: enCurso,   color: C.amarillo },
      ].filter((d) => d.value > 0),
      efectivos,
      fallidos,
      enCurso,
      total: camadasFiltradas.length,
      tasaExito: (efectivos + fallidos) > 0
        ? Math.round((efectivos / (efectivos + fallidos)) * 100)
        : null,
    }
  }, [camadasFiltradas])

  // ── 2. Calidad de Madres ───────────────────────────────────────────────────
  const dataCalidad = useMemo(() => {
    const idsMadres = [...new Set(camadasFiltradas.map((c) => c.id_madre).filter(Boolean))]
    const niveles = { Alta: 0, Media: 0, Baja: 0, 'Sin datos': 0 }
    idsMadres.forEach((id) => {
      const s = scorePromedioHembra(id, camadas) // score histórico completo
      niveles[nivelScore(s)]++
    })
    return [
      { name: 'Alta',      value: niveles['Alta'],      fill: C.verde    },
      { name: 'Media',     value: niveles['Media'],     fill: C.amarillo },
      { name: 'Baja',      value: niveles['Baja'],      fill: C.rojo     },
      { name: 'Sin datos', value: niveles['Sin datos'], fill: C.gris     },
    ].filter((d) => d.value > 0)
  }, [camadasFiltradas, camadas])

  // ── 3. Supervivencia ───────────────────────────────────────────────────────
  const dataSupervivencia = useMemo(() => {
    const conDatos = camadasFiltradas.filter(
      (c) => c.fecha_nacimiento && c.total_crias > 0 && c.total_destetados != null
    )
    const sinPerdida  = conDatos.filter((c) => c.total_destetados >= c.total_crias).length
    const conPerdida  = conDatos.filter((c) => c.total_destetados < c.total_crias).length
    const tasaPromedio = conDatos.length > 0
      ? Math.round(
          conDatos.reduce((s, c) => s + (c.total_destetados / c.total_crias), 0)
          / conDatos.length * 100
        )
      : null
    return {
      pie: [
        { name: '100% destetados', value: sinPerdida, color: C.verde },
        { name: 'Con pérdidas',    value: conPerdida, color: C.rojo  },
      ].filter((d) => d.value > 0),
      sinPerdida,
      conPerdida,
      tasaPromedio,
      total: conDatos.length,
    }
  }, [camadasFiltradas])

  // ── 4. Eficiencia de Apareamiento ─────────────────────────────────────────
  const dataEficiencia = useMemo(() => {
    const grupos = { '0–5d': 0, '6–10d': 0, '>10d': 0, 'Sin dato': 0 }
    camadasFiltradas.forEach((c) => {
      const lat = calcularLatencia(c)
      if (lat === null)       grupos['Sin dato']++
      else if (lat <= 5)      grupos['0–5d']++
      else if (lat <= 10)     grupos['6–10d']++
      else                    grupos['>10d']++
    })
    return [
      { name: '0–5d (óptimo)',  value: grupos['0–5d'],   fill: C.verde    },
      { name: '6–10d (normal)', value: grupos['6–10d'],  fill: C.amarillo },
      { name: '>10d (lento)',   value: grupos['>10d'],   fill: C.rojo     },
      { name: 'Sin dato',       value: grupos['Sin dato'], fill: C.gris   },
    ].filter((d) => d.value > 0)
  }, [camadasFiltradas])

  const hayFiltros = desde || hasta || filtroMadreId || filtroPadreId

  return (
    <div className="p-4 md:p-6 space-y-6" style={{ background: '#050810', minHeight: '100vh' }}>

      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Estadísticas</h1>
          <p className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
            Indicadores reproductivos de la colonia
          </p>
        </div>
        {hayFiltros && (
          <button
            onClick={() => { setDesde(''); setHasta(''); setFiltroMadreId(''); setFiltroPadreId('') }}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80', cursor: 'pointer' }}
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Filtros */}
      <div
        className="rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3"
        style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.6)' }}
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
            Desde
          </label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="w-full" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
            Hasta
          </label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="w-full" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#ce93d8' }}>
            ♀ Madre
          </label>
          <select value={filtroMadreId} onChange={(e) => setFiltroMadreId(e.target.value)}
            className="w-full" style={inputStyle}>
            <option value="">— Todas —</option>
            {hembras.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#40c4ff' }}>
            ♂ Padre
          </label>
          <select value={filtroPadreId} onChange={(e) => setFiltroPadreId(e.target.value)}
            className="w-full" style={inputStyle}>
            <option value="">— Todos —</option>
            {machos.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label="Apareamientos"
          valor={dataPartos.total}
          color={C.azul}
        />
        <KPI
          label="Tasa de éxito"
          valor={dataPartos.tasaExito !== null ? `${dataPartos.tasaExito}%` : '—'}
          color={dataPartos.tasaExito >= 80 ? C.verde : dataPartos.tasaExito >= 60 ? C.amarillo : C.rojo}
          sub="partos efectivos / total"
        />
        <KPI
          label="Supervivencia"
          valor={dataSupervivencia.tasaPromedio !== null ? `${dataSupervivencia.tasaPromedio}%` : '—'}
          color={dataSupervivencia.tasaPromedio >= 90 ? C.verde : dataSupervivencia.tasaPromedio >= 70 ? C.amarillo : C.rojo}
          sub="destetados / nacidos (prom.)"
        />
        <KPI
          label="Lat. óptima"
          valor={dataEficiencia.find((d) => d.name.startsWith('0–5'))?.value ?? 0}
          color={C.verde}
          sub="apareamientos 0–5 días"
        />
      </div>

      {/* Gráficos — 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Partos vs Fallas */}
        <GraficoCard
          titulo="Partos vs Fallas"
          subtitulo="Resultado de cada apareamiento registrado"
          color={C.verde}
        >
          {dataPartos.pie.length === 0 ? <SinDatos /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dataPartos.pie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={LabelPie}
                  >
                    {dataPartos.pie.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipOscuro />} />
                </PieChart>
              </ResponsiveContainer>
              <Leyenda items={dataPartos.pie.map((d) => ({ label: d.name, color: d.color, valor: d.value }))} />
            </>
          )}
        </GraficoCard>

        {/* 2. Calidad de Madres */}
        <GraficoCard
          titulo="Calidad de Madres"
          subtitulo="Score histórico promedio por reproductora activa en el período"
          color={C.violeta}
        >
          {dataCalidad.length === 0 ? <SinDatos /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dataCalidad} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,51,82,0.5)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#4a5f7a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a5f7a', fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipOscuro />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" name="Madres" radius={[6, 6, 0, 0]}>
                    {dataCalidad.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Leyenda items={dataCalidad.map((d) => ({ label: d.name, color: d.fill, valor: d.value }))} />
            </>
          )}
        </GraficoCard>

        {/* 3. Supervivencia de Camadas */}
        <GraficoCard
          titulo="Supervivencia de Camadas"
          subtitulo="Camadas con 100% destete vs. camadas con pérdidas"
          color={C.amarillo}
        >
          {dataSupervivencia.pie.length === 0 ? <SinDatos /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dataSupervivencia.pie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={LabelPie}
                  >
                    {dataSupervivencia.pie.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipOscuro />} />
                </PieChart>
              </ResponsiveContainer>
              <Leyenda items={dataSupervivencia.pie.map((d) => ({ label: d.name, color: d.color, valor: d.value }))} />
            </>
          )}
        </GraficoCard>

        {/* 4. Eficiencia de Apareamiento */}
        <GraficoCard
          titulo="Eficiencia de Apareamiento"
          subtitulo="Latencia entre cópula y nacimiento (días)"
          color={C.azul}
        >
          {dataEficiencia.length === 0 ? <SinDatos /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dataEficiencia} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,51,82,0.5)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#4a5f7a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a5f7a', fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipOscuro />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" name="Apareamientos" radius={[6, 6, 0, 0]}>
                    {dataEficiencia.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Leyenda items={dataEficiencia.map((d) => ({ label: d.name, color: d.fill, valor: d.value }))} />
            </>
          )}
        </GraficoCard>

      </div>

      {/* Nota al pie */}
      <p className="text-xs text-center pb-2" style={{ color: '#1e3352' }}>
        Los filtros aplican sobre la fecha de cópula · La calidad de madres usa el historial completo del animal
      </p>

    </div>
  )
}
