import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { formatFecha, calcularLatencia } from '../utils/calculos'
import { getMinimosCriticos } from '../utils/motorDecisiones'
import { TrendingUp, Microscope, Dna, BarChart2, Archive, Skull, PackageCheck, Thermometer, FileWarning, Printer, Calendar, CalendarDays, GitBranch, ShoppingCart, ClipboardCheck, Leaf, Layers } from 'lucide-react'
import iterateTitleLogoLight from '../assets/iterate+logo+sloganfondoclaro.png'
import { useTheme } from '../context/ThemeContext'

const LABEL_BIOTERIO = {
  ratas:            'Ratas',
  ratones_balbc:    'BALB/C',
  ratones_c57:      'C57',
  ratones_hibridos: 'Híbridos',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const SECCIONES_BASE = [
  { key: 'estadisticas',    label: 'Estadísticas',    printBg: '#fefae8', printBorder: '#b8860b' },
  { key: 'reproductores',   label: 'Reproductores',   printBg: '#f5f0ff', printBorder: '#9d4edd' },
  { key: 'emparejamientos', label: 'Emparejamientos', printBg: '#e8f4fd', printBorder: '#0277bd' },
  { key: 'rendimiento',     label: 'Rendimiento',     printBg: '#e8f8f0', printBorder: '#2e7d52' },
  { key: 'stock',           label: 'Stock',           printBg: '#e8f8f0', printBorder: '#2e7d52' },
  { key: 'sacrificios',     label: 'Sacrificios',     printBg: '#fde8ec', printBorder: '#c62828' },
  { key: 'entregas',        label: 'Entregas',        printBg: '#fefae8', printBorder: '#b8860b' },
  { key: 'temperaturas',    label: 'Temperaturas',    printBg: '#e8f4fd', printBorder: '#0277bd' },
  { key: 'incidentes',      label: 'Incidentes',      printBg: '#f5f0ff', printBorder: '#9d4edd' },
  { key: 'planificacion',   label: 'Planificación',   printBg: '#e8faf0', printBorder: '#1b5e20' },
  { key: 'pedidos',         label: 'Pedidos',         printBg: '#fffde7', printBorder: '#f57f17' },
  { key: 'auditoria',       label: 'Auditoría',       printBg: '#ede7f6', printBorder: '#4527a0' },
]

const SECCIONES_GLOBAL = [
  { key: 'alimento_global',  label: 'Consumo de alimento',       sub: 'Ratas + Ratones · estimación diaria', icon: '🌾', color: 'rgba(255,179,0,0.6)'  },
  { key: 'viruta_global',    label: 'Consumo de viruta / camas', sub: 'Calculado por jaulas activas',         icon: '🪵', color: 'rgba(139,92,246,0.6)' },
  { key: 'capacidad_global', label: 'Capacidad y predicción',    sub: 'Saturación · candidatos · simulador',  icon: '📊', color: 'rgba(255,61,87,0.6)'  },
  { key: 'genealogia_global',label: 'Genealogía y consanguinidad', sub: 'Árbol genealógico · coeficiente F', icon: '🧬', color: 'rgba(167,139,250,0.6)'},
]

function inicioSemana() {
  const d = new Date()
  const day = d.getDay()
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  // Formato local — toISOString() devuelve UTC y corre la fecha después de las 21:00 (ART)
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`
}

export default function Reportes() {
  const { tema } = useTheme()
  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }
  const { setBioterioActivo } = useBioterioActivo()
  const SECCIONES = [
    { ...SECCIONES_BASE[0],  icon: <TrendingUp size={14} />,    color: tema.amber,  rgb: '255,179,0'   },
    { ...SECCIONES_BASE[1],  icon: <Microscope size={14} />,    color: tema.purple, rgb: '206,147,216' },
    { ...SECCIONES_BASE[2],  icon: <Dna size={14} />,           color: tema.blue,   rgb: '64,196,255'  },
    { ...SECCIONES_BASE[3],  icon: <BarChart2 size={14} />,     color: tema.accent, rgb: '0,230,118'   },
    { ...SECCIONES_BASE[4],  icon: <Archive size={14} />,       color: tema.accent, rgb: '0,230,118'   },
    { ...SECCIONES_BASE[5],  icon: <Skull size={14} />,         color: tema.red,    rgb: '255,107,128' },
    { ...SECCIONES_BASE[6],  icon: <PackageCheck size={14} />,  color: tema.amber,  rgb: '255,179,0'   },
    { ...SECCIONES_BASE[7],  icon: <Thermometer size={14} />,   color: tema.blue,   rgb: '64,196,255'  },
    { ...SECCIONES_BASE[8],  icon: <FileWarning size={14} />,   color: tema.purple, rgb: '206,147,216' },
    { ...SECCIONES_BASE[9],  icon: <Layers size={14} />,        color: tema.accent, rgb: '0,230,118'   },
    { ...SECCIONES_BASE[10], icon: <ShoppingCart size={14} />,  color: tema.amber,  rgb: '255,179,0'   },
    { ...SECCIONES_BASE[11], icon: <ClipboardCheck size={14} />,color: '#a78bfa',   rgb: '167,139,250' },
  ]
  const { animales, camadas, jaulas, sacrificios, entregas, temperaturas, incidentes, pedidos, bio, bioterioActivo } = useBioterio()
  const hoyDate = new Date()

  const [periodo, setPeriodo]   = useState('mensual')
  const [anio, setAnio]         = useState(hoyDate.getFullYear())
  const [mes, setMes]           = useState(hoyDate.getMonth())
  const [semDesde, setSemDesde] = useState(inicioSemana)
  const [secciones, setSecciones] = useState(
    () => Object.fromEntries(SECCIONES.map(s => [s.key, true]))
  )

  function toggleSec(key) { setSecciones(p => ({ ...p, [key]: !p[key] })) }

  const datos = useMemo(() => {
    function enPeriodo(fechaStr) {
      if (!fechaStr) return false
      if (periodo === 'mensual') {
        const [y, m] = fechaStr.split('-').map(Number)
        return y === anio && m === mes + 1
      }
      const [yS, mS, dS] = semDesde.split('-').map(Number)
      const inicio = new Date(yS, mS - 1, dS)
      const fin    = new Date(yS, mS - 1, dS + 6, 23, 59, 59)
      const [yF, mF, dF] = fechaStr.split('-').map(Number)
      return new Date(yF, mF - 1, dF) >= inicio && new Date(yF, mF - 1, dF) <= fin
    }

    const camPeriodo = camadas.filter(c =>
      enPeriodo(c.fecha_copula) || enPeriodo(c.fecha_nacimiento) || enPeriodo(c.fecha_destete)
    )

    const reproducPeriodo = animales.filter(a =>
      ['activo','en_apareamiento','en_cria'].includes(a.estado) ||
      enPeriodo(a.fecha_nacimiento) || enPeriodo(a.fecha_sacrificio)
    )

    const machoRanking = animales
      .filter(a => a.sexo === 'macho')
      .flatMap(m => {
        const sus = camPeriodo.filter(c => c.id_padre === m.id)
        const lats = sus.map(c => calcularLatencia(c, bio)).filter(l => l !== null && l >= 0)
        if (!lats.length) return []
        return [{ codigo: m.codigo, camadas: sus.length,
          latProm: Math.round(lats.reduce((a,b)=>a+b,0)/lats.length*10)/10,
          latMin: Math.min(...lats), latMax: Math.max(...lats) }]
      })
      .sort((a,b) => a.latProm - b.latProm)

    const efectivos  = camPeriodo.filter(c => c.fecha_nacimiento && !c.failure_flag).length
    const fallidos   = camPeriodo.filter(c => c.failure_flag).length
    const enCurso    = camPeriodo.filter(c => !c.fecha_nacimiento && !c.failure_flag).length
    const totalCrias = camPeriodo.reduce((s,c) => s + (c.total_crias ?? 0), 0)
    const totalDest  = camPeriodo.reduce((s,c) => s + (c.total_destetados ?? 0), 0)
    const supervRate = totalCrias > 0 ? Math.round(totalDest / totalCrias * 100) : null

    // Bloques virtuales: camadas con destete pero sin jaula real en DB
    const jaulasIds = new Set(jaulas.map(j => j.camada_id))
    const bloquesVirt = camadas
      .filter(c => c.fecha_destete && c.incluir_en_stock !== false && !c.failure_flag && !jaulasIds.has(c.id))
      .map(c => {
        const sac   = sacrificios.filter(s => s.camada_id === c.id).reduce((s, x) => s + x.cantidad, 0)
        const ent   = entregas.filter(e => e.camada_id === c.id && !e.devuelta).reduce((s, x) => s + x.cantidad, 0)
        const total = Math.max(0, (c.total_destetados ?? c.total_crias ?? 0) - sac - ent)
        if (total <= 0) return null
        return { id: `v-${c.id}`, camada_id: c.id, total, machos: c.crias_machos, hembras: c.crias_hembras, notas: null, virtual: true }
      })
      .filter(Boolean)

    return {
      reproducPeriodo, camPeriodo, machoRanking,
      efectivos, fallidos, enCurso, totalCrias, totalDest, supervRate,
      stockActual:  [...jaulas, ...bloquesVirt],
      sacrPeriodo:  sacrificios.filter(s => enPeriodo(s.fecha)),
      entPeriodo:   entregas.filter(e => enPeriodo(e.fecha)),
      tempPeriodo:  temperaturas.filter(t => enPeriodo(t.date)).sort((a,b) => a.date.localeCompare(b.date)),
      incPeriodo:   incidentes.filter(i => enPeriodo(i.fecha)),
    }
  }, [animales, camadas, jaulas, sacrificios, entregas, temperaturas, incidentes, periodo, anio, mes, semDesde, bio])

  const tituloPeriodo = periodo === 'mensual'
    ? `${MESES[mes]} ${anio}`
    : (() => {
        const [y,m,d] = semDesde.split('-').map(Number)
        const fin = new Date(y, m-1, d+6)
        const dd = n => String(n).padStart(2,'0')
        return `Semana ${dd(d)}/${dd(m)} — ${dd(fin.getDate())}/${dd(fin.getMonth()+1)}/${fin.getFullYear()}`
      })()

  const secActivas = SECCIONES.filter(s => secciones[s.key]).length

  return (
    <div className="min-h-screen" style={{ background: tema.bgMain }}>

      {/* ── CSS de impresión ── */}
      <style>{`
        @media screen { .rpt-printzone { display: none !important; } }
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm 12mm 14mm; }
          * { visibility: hidden !important; }
          .rpt-printzone, .rpt-printzone * { visibility: visible !important; }
          .rpt-printzone { position: absolute; top: 0; left: 0; width: 100%; }
        }
        .rpt-table { width: 100%; border-collapse: collapse; font-size: 8pt; color: #111; }
        .rpt-table th { background: #efefef; padding: 3pt 5pt; text-align: left; font-weight: 700; font-size: 7.5pt; border-bottom: 1.5pt solid #999; color: #222; }
        .rpt-table td { padding: 2.5pt 5pt; border-bottom: 0.5pt solid #e0e0e0; vertical-align: top; color: #222; font-size: 8pt; }
        .rpt-table tr:nth-child(even) td { background: #f8f8f8; }
        .rpt-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 5pt; margin: 5pt 0 8pt; }
        .rpt-kpi-box { border: 1pt solid #ddd; border-radius: 3pt; padding: 5pt 4pt; text-align: center; background: #fafafa; }
        .rpt-kpi-box .v { font-size: 14pt; font-weight: 800; color: #111; line-height: 1.1; }
        .rpt-kpi-box .l { font-size: 6.5pt; color: #666; margin-top: 2pt; text-transform: uppercase; letter-spacing: 0.3pt; }
        .rpt-empty { font-size: 8pt; color: #888; padding: 3pt 0 4pt; font-style: italic; }
        .rpt-ok  { color: #166534; font-weight: 700; }
        .rpt-err { color: #991b1b; font-weight: 700; }
        .rpt-wrn { color: #92400e; font-weight: 700; }
      `}</style>

      {/* ── PANEL DE CONTROL ── */}
      <div className="no-print p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 rounded-full" style={{ background: tema.accent, boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
            <div>
              <h1 className="text-xl font-bold text-white">Informes e Impresión</h1>
              <p className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                {secActivas}/{SECCIONES.length} secciones activas · {tituloPeriodo}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.4)', color: tema.accent, boxShadow: '0 0 20px rgba(0,230,118,0.1)' }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>

        {/* Período */}
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>Período del informe</div>
          <div className="flex gap-2">
            {[{ val:'mensual', label: <><Calendar size={13} style={{ display:'inline', marginRight:4 }} />Por mes</> },{ val:'semanal', label: <><CalendarDays size={13} style={{ display:'inline', marginRight:4 }} />Por semana</> }].map(({ val, label }) => (
              <button key={val} onClick={() => setPeriodo(val)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={periodo === val
                  ? { background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.4)', color: tema.accent }
                  : { background: 'rgba(30,51,82,0.3)', border: '1px solid rgba(30,51,82,0.6)', color: tema.textMuted }
                }>{label}</button>
            ))}
          </div>

          {periodo === 'mensual' ? (
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: tema.textMuted }}>Mes</label>
                <select value={mes} onChange={e => setMes(Number(e.target.value))}
                  className="px-3 py-2 text-sm rounded-xl focus:outline-none"
                  style={{ background: tema.bgInput, border: '1px solid rgba(30,51,82,0.8)', color: tema.textPrimary }}>
                  {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: tema.textMuted }}>Año</label>
                <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
                  className="px-3 py-2 text-sm rounded-xl focus:outline-none w-28 font-mono"
                  style={{ background: tema.bgInput, border: '1px solid rgba(30,51,82,0.8)', color: tema.textPrimary }} />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: tema.textMuted }}>Inicio de semana</label>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="date" value={semDesde} onChange={e => setSemDesde(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl focus:outline-none font-mono"
                  style={{ background: tema.bgInput, border: '1px solid rgba(30,51,82,0.8)', color: tema.textPrimary }} />
                <span className="text-xs font-mono" style={{ color: tema.textMuted }}>→ {tituloPeriodo}</span>
              </div>
            </div>
          )}
        </div>

        {/* Secciones toggle */}
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>Secciones a imprimir</div>
            <div className="flex gap-2">
              <button onClick={() => setSecciones(Object.fromEntries(SECCIONES.map(s=>[s.key,true])))}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ color: tema.accent, background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)' }}>
                ✓ Todo
              </button>
              <button onClick={() => setSecciones(Object.fromEntries(SECCIONES.map(s=>[s.key,false])))}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ color: tema.red, background: 'rgba(255,107,128,0.08)', border: '1px solid rgba(255,107,128,0.25)' }}>
                ✕ Ninguno
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SECCIONES.map(({ key, label, icon, color, rgb }) => (
              <button key={key} onClick={() => toggleSec(key)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-left"
                style={secciones[key]
                  ? { background: `rgba(${rgb},0.1)`, border: `1.5px solid rgba(${rgb},0.5)`, color }
                  : { background: 'rgba(30,51,82,0.2)', border: '1px solid rgba(30,51,82,0.4)', color: tema.textMuted }
                }>
                <span style={{ fontSize: '12px' }}>{secciones[key] ? '✓' : '○'}</span>
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Reproductores',    val: datos.reproducPeriodo.length,                                 color: tema.purple },
            { label: 'Emparejamientos',  val: datos.camPeriodo.length,                                      color: tema.blue },
            { label: 'Sacrificios',      val: datos.sacrPeriodo.reduce((s,x) => s + (x.cantidad || 1), 0), color: tema.red },
            { label: 'Temp. registradas',val: datos.tempPeriodo.length,                                     color: tema.amber },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={cardStyle}>
              <div className="text-2xl font-bold font-mono" style={{ color }}>{val}</div>
              <div className="text-xs mt-1" style={{ color: tema.textMuted }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Vista Global — secciones que se abren fuera del informe */}
        <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: tema.textMuted }}>Vista global — acceso directo</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECCIONES_GLOBAL.map(({ key, label, sub, icon, color }) => (
              <button
                key={key}
                onClick={() => setBioterioActivo(key)}
                className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all"
                style={{ background: tema.bgCard, border: `1px solid rgba(30,51,82,0.5)` }}
              >
                <span style={{ fontSize: '18px' }}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: tema.textPrimary }}>{label}</div>
                  <div className="text-xs font-mono truncate" style={{ color: tema.textMuted }}>{sub}</div>
                </div>
                <span style={{ color: tema.textMuted }}>›</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: tema.textMuted }}>
          💡 En el diálogo de impresión seleccioná <strong style={{ color: tema.textPrimary }}>"Guardar como PDF"</strong> y tamaño <strong style={{ color: tema.textPrimary }}>A4</strong>.
        </p>
      </div>

      {/* ── ZONA DE IMPRESIÓN ── */}
      <div className="rpt-printzone">
        <DocImprimible
          tituloPeriodo={tituloPeriodo}
          datos={datos}
          animales={animales}
          camadas={camadas}
          pedidos={pedidos}
          secciones={secciones}
          bioterioActivo={bioterioActivo}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Documento imprimible
// ─────────────────────────────────────────────────────────────────────────────

function DocImprimible({ tituloPeriodo, datos, animales, camadas, pedidos = [], secciones, bioterioActivo }) {
  const ahora = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const { reproducPeriodo, camPeriodo, machoRanking, efectivos, fallidos, enCurso,
          totalCrias, totalDest, supervRate, stockActual,
          sacrPeriodo, entPeriodo, tempPeriodo, incPeriodo } = datos

  function codigoAnimal(id) { return animales.find(a => a.id === id)?.codigo ?? '—' }
  function parejaStr(camada_id) {
    const c = camadas.find(x => x.id === camada_id)
    return c ? `${codigoAnimal(c.id_madre)} × ${codigoAnimal(c.id_padre)}` : '—'
  }

  const LABEL_EST = { activo:'Activo', en_apareamiento:'Apareamiento', en_cria:'En cría', retirado:'Retirado', fallecido:'Fallecido' }
  const S = (k) => secciones[k] ?? false
  const secActivas = SECCIONES_BASE.filter(s => secciones[s.key])

  const base = { fontFamily: "'Segoe UI', Arial, sans-serif", color: '#111', background: '#fff', fontSize: '9pt', lineHeight: 1.45 }

  return (
    <div style={{ ...base, padding: '0' }}>

      {/* ── Encabezado del documento ── */}
      <div style={{ borderBottom: '2pt solid #111', paddingBottom: '10pt', marginBottom: '12pt', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12pt' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '7pt', color: '#666', fontFamily: 'monospace', marginBottom: '3pt', letterSpacing: '0.5pt' }}>
            BIOTERIO · SISTEMA DE GESTIÓN DE COLONIA
            {bioterioActivo && ` · ${(LABEL_BIOTERIO[bioterioActivo] ?? bioterioActivo).toUpperCase()}`}
          </div>
          <div style={{ fontSize: '15pt', fontWeight: 900, color: '#111', letterSpacing: '-0.3pt', marginBottom: '2pt' }}>
            INFORME DE COLONIA — {tituloPeriodo.toUpperCase()}
          </div>
          <div style={{ fontSize: '7.5pt', color: '#555', fontFamily: 'monospace' }}>
            Generado: {ahora} &nbsp;·&nbsp; Secciones: {secActivas.map(s => s.label).join(' · ')}
          </div>
        </div>
        {/* Logo Iterate */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <img
            src={iterateTitleLogoLight}
            alt="ITeRatE"
            style={{ height: '48pt', width: 'auto', display: 'block', marginLeft: 'auto' }}
          />
        </div>
      </div>

      {/* ── Estadísticas ── */}
      {S('estadisticas') && (
        <Seccion title={`Estadísticas del Período`} icon="📈" printBg="#fefae8" printBorder="#b8860b">
          <div className="rpt-kpi-grid">
            {[
              { v: camPeriodo.length,                              l: 'Apareamientos' },
              { v: efectivos,                                      l: 'Partos exitosos' },
              { v: fallidos,                                       l: 'Fallos reproductivos' },
              { v: enCurso,                                        l: 'En curso' },
              { v: totalCrias,                                     l: 'Crías registradas' },
              { v: totalDest,                                      l: 'Destetados' },
              { v: supervRate !== null ? `${supervRate}%` : '—',  l: 'Tasa supervivencia' },
              { v: machoRanking.length > 0 ? `${machoRanking[0].latProm}d` : '—', l: 'Mejor latencia' },
            ].map(({ v, l }) => (
              <div key={l} className="rpt-kpi-box">
                <div className="v">{v}</div>
                <div className="l">{l}</div>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {/* ── Reproductores ── */}
      {S('reproductores') && (
        <Seccion title={`Reproductores (${reproducPeriodo.length})`} icon="🐀" printBg="#f5f0ff" printBorder="#9d4edd">
          {reproducPeriodo.length === 0
            ? <p className="rpt-empty">Sin reproductores activos o con actividad en el período.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Código</th><th>Sexo</th><th>Estado</th><th>Nacimiento</th><th>Madre</th><th>Padre</th><th>Notas</th>
                </tr></thead>
                <tbody>
                  {reproducPeriodo.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.codigo}</strong></td>
                      <td>{a.sexo === 'hembra' ? '♀ Hembra' : '♂ Macho'}</td>
                      <td className={['fallecido','retirado'].includes(a.estado) ? 'rpt-err' : 'rpt-ok'}>
                        {LABEL_EST[a.estado] ?? a.estado}
                      </td>
                      <td>{formatFecha(a.fecha_nacimiento) || '—'}</td>
                      <td>{codigoAnimal(a.id_madre)}</td>
                      <td>{codigoAnimal(a.id_padre)}</td>
                      <td>{a.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Emparejamientos ── */}
      {S('emparejamientos') && (
        <Seccion title={`Emparejamientos (${camPeriodo.length})`} icon="🪺" printBg="#e8f4fd" printBorder="#0277bd">
          {camPeriodo.length === 0
            ? <p className="rpt-empty">Sin emparejamientos en el período.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Madre</th><th>Padre</th><th>Cópula</th><th>Nacimiento</th>
                  <th>Crías</th><th>♂</th><th>♀</th><th>Destetados</th><th>Destete</th><th>Estado</th><th>Notas</th>
                </tr></thead>
                <tbody>
                  {camPeriodo.map(c => {
                    const est = c.failure_flag ? '✕ Fallido' : c.fecha_destete ? 'Completada' : c.fecha_nacimiento ? 'Lactancia' : 'En curso'
                    return (
                      <tr key={c.id}>
                        <td><strong>{codigoAnimal(c.id_madre)}</strong></td>
                        <td>{codigoAnimal(c.id_padre)}</td>
                        <td>{formatFecha(c.fecha_copula)||'—'}</td>
                        <td>{formatFecha(c.fecha_nacimiento)||'—'}</td>
                        <td>{c.total_crias??'—'}</td>
                        <td>{c.crias_machos??'—'}</td>
                        <td>{c.crias_hembras??'—'}</td>
                        <td>{c.total_destetados??'—'}</td>
                        <td>{formatFecha(c.fecha_destete)||'—'}</td>
                        <td className={c.failure_flag ? 'rpt-err' : ''}>{est}</td>
                        <td>{c.notas||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Rendimiento ── */}
      {S('rendimiento') && (
        <Seccion title="Rendimiento de Reproductores" icon="📊" printBg="#e8f8f0" printBorder="#2e7d52">
          {machoRanking.length === 0
            ? <p className="rpt-empty">Sin datos de rendimiento para el período.</p>
            : (
              <>
                <table className="rpt-table">
                  <thead><tr>
                    <th>#</th><th>Código</th><th>Camadas</th>
                    <th>Lat. promedio</th><th>Lat. mín.</th><th>Lat. máx.</th><th>Calificación</th>
                  </tr></thead>
                  <tbody>
                    {machoRanking.map((m, i) => {
                      const cal = m.latProm <= 5 ? 'Excelente' : m.latProm <= 10 ? 'Bueno' : 'Regular'
                      const cls = m.latProm <= 5 ? 'rpt-ok' : m.latProm <= 10 ? 'rpt-wrn' : 'rpt-err'
                      return (
                        <tr key={m.codigo}>
                          <td>#{i+1}</td><td><strong>{m.codigo}</strong></td><td>{m.camadas}</td>
                          <td>{m.latProm}d</td><td>{m.latMin}d</td><td>{m.latMax}d</td>
                          <td className={cls}>{cal}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p style={{ fontSize: '7pt', color: '#888', marginTop: '3pt' }}>
                  * Latencia = días entre cópula y concepción estimada (nac. − 23d). Menor = mejor fertilización.
                </p>
              </>
            )
          }
        </Seccion>
      )}

      {/* ── Stock ── */}
      {S('stock') && (
        <Seccion title={`Stock actual (${stockActual.length} jaulas)`} icon="📦" printBg="#e8f8f0" printBorder="#2e7d52">
          {stockActual.length === 0
            ? <p className="rpt-empty">Sin jaulas en stock.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Jaula</th><th>Progenitores</th><th>Total</th><th>♂ Machos</th><th>♀ Hembras</th><th>Notas</th>
                </tr></thead>
                <tbody>
                  {stockActual.map(j => (
                    <tr key={j.id}>
                      <td><strong>{j.id.slice(-6).toUpperCase()}</strong></td>
                      <td>{j.camada_id ? parejaStr(j.camada_id) : '—'}</td>
                      <td>{j.total ?? '—'}</td>
                      <td>{j.machos != null ? j.machos : '—'}</td>
                      <td>{j.hembras != null ? j.hembras : '—'}</td>
                      <td>{j.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Sacrificios ── */}
      {S('sacrificios') && (
        <Seccion title={`Sacrificios (${sacrPeriodo.length} registros)`} icon="🗡️" printBg="#fde8ec" printBorder="#c62828">
          {sacrPeriodo.length === 0
            ? <p className="rpt-empty">Sin sacrificios en el período.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Fecha</th><th>Categoría</th><th>Cantidad</th><th>Animal / Camada</th><th>Notas</th>
                </tr></thead>
                <tbody>
                  {sacrPeriodo.map(s => (
                    <tr key={s.id}>
                      <td>{formatFecha(s.fecha)||'—'}</td>
                      <td>{s.categoria === 'reproductor' ? 'Reproductor' : 'Stock'}</td>
                      <td>{s.cantidad ?? '—'}</td>
                      <td>
                        {s.camada_id
                          ? parejaStr(s.camada_id)
                          : s.animal_id
                            ? (animales.find(a => a.id === s.animal_id)?.codigo ?? s.animal_id.slice(-6))
                            : '—'}
                      </td>
                      <td>{s.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Entregas ── */}
      {S('entregas') && (
        <Seccion title={`Entregas (${entPeriodo.length} registros)`} icon="📤" printBg="#fefae8" printBorder="#b8860b">
          {entPeriodo.length === 0
            ? <p className="rpt-empty">Sin entregas en el período.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Animal / Camada</th><th>Observaciones</th>
                </tr></thead>
                <tbody>
                  {entPeriodo.map(e => (
                    <tr key={e.id}>
                      <td>{formatFecha(e.fecha)||'—'}</td>
                      <td>{e.animal_id ? 'Reproductor' : 'Stock'}</td>
                      <td>{e.cantidad ?? '1'}</td>
                      <td>{e.camada_id
                        ? parejaStr(e.camada_id)
                        : e.animal_id
                          ? (animales.find(a => a.id === e.animal_id)?.codigo ?? '—')
                          : '—'
                      }</td>
                      <td>{e.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Temperaturas ── */}
      {S('temperaturas') && (
        <Seccion title={`Temperaturas (${tempPeriodo.length} registros)`} icon="🌡️" printBg="#e8f4fd" printBorder="#0277bd">
          {tempPeriodo.length === 0
            ? <p className="rpt-empty">Sin registros de temperatura en el período.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Fecha</th><th>Hora</th><th>Actual (°C)</th><th>Mín (°C)</th><th>Máx (°C)</th>
                </tr></thead>
                <tbody>
                  {tempPeriodo.map(t => (
                    <tr key={t.id}>
                      <td>{formatFecha(t.date)||'—'}</td>
                      <td>{t.time||'—'}</td>
                      <td><strong>{t.current_temp??'—'}</strong></td>
                      <td>{t.min_temp??'—'}</td>
                      <td>{t.max_temp??'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Incidentes ── */}
      {S('incidentes') && (
        <Seccion title={`Incidentes (${incPeriodo.length} registros)`} icon="📝" printBg="#f5f0ff" printBorder="#9d4edd">
          {incPeriodo.length === 0
            ? <p className="rpt-empty">Sin incidentes en el período.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th style={{ width: '72pt' }}>Fecha</th>
                  <th style={{ width: '50pt' }}>Origen</th>
                  <th>Descripción</th>
                </tr></thead>
                <tbody>
                  {incPeriodo.map(i => (
                    <tr key={i.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(i.fecha)||'—'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {LABEL_BIOTERIO[i.bioterio_id] ?? i.bioterio_id ?? '—'}
                      </td>
                      <td>{i.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Planificación ── */}
      {S('planificacion') && (() => {
        const minimos = getMinimosCriticos(bioterioActivo)
        const estadosVivos = ['activo', 'en_apareamiento', 'en_cria']
        const repros = animales.filter(a => a.bioterio_id === bioterioActivo && estadosVivos.includes(a.estado))
        const machos = repros.filter(a => a.sexo === 'macho').length
        const hembras = repros.filter(a => a.sexo === 'hembra').length
        const filas = [
          { label: 'Machos reproductores', actual: machos, minimo: minimos.machos_colonia },
          { label: 'Hembras reproductoras', actual: hembras, minimo: minimos.hembras_colonia },
          { label: 'Hembras F1 (si aplica)', actual: repros.filter(a => a.sexo === 'hembra' && a.exportado_hibridos).length, minimo: minimos.hembras_hibridos },
          { label: 'Machos F1 (si aplica)', actual: repros.filter(a => a.sexo === 'macho' && a.exportado_hibridos).length, minimo: minimos.machos_hibridos },
        ]
        return (
          <Seccion title="Planificación de Colonia" icon="📋" printBg="#e8faf0" printBorder="#1b5e20">
            <table className="rpt-table">
              <thead><tr><th>Categoría</th><th>Actual</th><th>Mínimo</th><th>Estado</th></tr></thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.label}>
                    <td>{f.label}</td>
                    <td><strong>{f.actual}</strong></td>
                    <td>{f.minimo}</td>
                    <td className={f.actual >= f.minimo ? 'rpt-ok' : 'rpt-err'}>
                      {f.minimo === 0 ? '—' : f.actual >= f.minimo ? '✓ OK' : `⚠ Déficit de ${f.minimo - f.actual}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '7pt', color: '#888', marginTop: '3pt' }}>
              * Para proyecciones avanzadas, escenarios y candidatos a renovación, consultar el módulo Planificación en la app.
            </p>
          </Seccion>
        )
      })()}

      {/* ── Pedidos ── */}
      {S('pedidos') && (
        <Seccion title={`Pedidos de Producción (${pedidos.length} total)`} icon="🛒" printBg="#fffde7" printBorder="#f57f17">
          {pedidos.length === 0
            ? <p className="rpt-empty">Sin pedidos registrados.</p>
            : (
              <table className="rpt-table">
                <thead><tr>
                  <th>Solicitante</th><th>Cant.</th><th>Sexo</th><th>Edad (sem)</th>
                  <th>Uso</th><th>Entrega</th><th>Estado</th><th>Notas</th>
                </tr></thead>
                <tbody>
                  {pedidos.map(p => {
                    const est = { pendiente: 'Pendiente', confirmado: 'Confirmado', entregado: 'Entregado', cancelado: 'Cancelado' }
                    const cls = p.estado === 'entregado' ? 'rpt-ok' : p.estado === 'cancelado' ? 'rpt-err' : ''
                    return (
                      <tr key={p.id}>
                        <td><strong>{p.solicitante || '—'}</strong></td>
                        <td>{p.cantidad ?? '—'}</td>
                        <td>{p.sexo === 'macho' ? '♂' : p.sexo === 'hembra' ? '♀' : 'Ambos'}</td>
                        <td>{p.edadSemanas ?? '—'}</td>
                        <td>{p.uso || '—'}</td>
                        <td>{formatFecha(p.fechaEntrega) || '—'}</td>
                        <td className={cls}>{est[p.estado] ?? p.estado ?? '—'}</td>
                        <td>{p.notas || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* ── Auditoría ── */}
      {S('auditoria') && (
        <Seccion title="Auditoría Comparativa" icon="🔍" printBg="#ede7f6" printBorder="#4527a0">
          <div className="rpt-kpi-grid">
            {[
              { v: animales.filter(a => a.bioterio_id === bioterioActivo && ['activo','en_apareamiento','en_cria'].includes(a.estado)).length, l: 'Reproductores activos' },
              { v: camadas.filter(c => c.bioterio_id === bioterioActivo && !c.failure_flag && c.fecha_nacimiento).length, l: 'Partos exitosos (total)' },
              { v: camadas.filter(c => c.bioterio_id === bioterioActivo && c.failure_flag).length, l: 'Fallos reproductivos (total)' },
              { v: camadas.length > 0 ? `${Math.round(camadas.filter(c => c.bioterio_id === bioterioActivo && !c.failure_flag && c.fecha_nacimiento).length / Math.max(1, camadas.filter(c => c.bioterio_id === bioterioActivo && (c.failure_flag || c.fecha_nacimiento)).length) * 100)}%` : '—', l: 'Tasa éxito histórica' },
            ].map(({ v, l }) => (
              <div key={l} className="rpt-kpi-box">
                <div className="v">{v}</div>
                <div className="l">{l}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '7pt', color: '#888', marginTop: '3pt' }}>
            * Para análisis comparativo por períodos A/B, métricas de tendencia y detalle reproductivo, usar el módulo Auditoría en la app.
          </p>
        </Seccion>
      )}

      {/* Footer */}
      <div style={{ borderTop: '0.5pt solid #bbb', marginTop: '16pt', paddingTop: '5pt', fontSize: '7pt', color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ITeRatE · Sistema de Gestión de Bioterio</span>
        <span>Documento de uso interno · {bioterioActivo ? LABEL_BIOTERIO[bioterioActivo] ?? bioterioActivo : 'Colonia'}</span>
        <span>{ahora}</span>
      </div>
    </div>
  )
}

// ─── Helper: sección del documento imprimible ─────────────────────────────────
function Seccion({ title, icon, printBg, printBorder, children }) {
  return (
    <div style={{ marginBottom: '12pt' }}>
      <div style={{
        fontSize: '9pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7pt',
        color: '#111', background: printBg, padding: '4pt 8pt',
        borderLeft: `4pt solid ${printBorder}`, display: 'flex', alignItems: 'center', gap: '4pt',
        marginBottom: '0',
      }}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <div style={{ paddingTop: '4pt' }}>{children}</div>
    </div>
  )
}
