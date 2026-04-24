import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { formatFecha, calcularLatencia } from '../utils/calculos'
import { TrendingUp, Microscope, Dna, BarChart2, Archive, Skull, PackageCheck, Thermometer, FileWarning, Printer, Calendar, CalendarDays } from 'lucide-react'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const SECCIONES = [
  { key: 'estadisticas',    label: 'Estadísticas',    icon: <TrendingUp size={14} />,    color: '#ffb300', rgb: '255,179,0',   printBg: '#fefae8', printBorder: '#b8860b' },
  { key: 'reproductores',   label: 'Reproductores',   icon: <Microscope size={14} />,    color: '#ce93d8', rgb: '206,147,216', printBg: '#f5f0ff', printBorder: '#9d4edd' },
  { key: 'emparejamientos', label: 'Emparejamientos', icon: <Dna size={14} />,           color: '#40c4ff', rgb: '64,196,255',  printBg: '#e8f4fd', printBorder: '#0277bd' },
  { key: 'rendimiento',     label: 'Rendimiento',     icon: <BarChart2 size={14} />,     color: '#00e676', rgb: '0,230,118',   printBg: '#e8f8f0', printBorder: '#2e7d52' },
  { key: 'stock',           label: 'Stock',           icon: <Archive size={14} />,       color: '#00e676', rgb: '0,230,118',   printBg: '#e8f8f0', printBorder: '#2e7d52' },
  { key: 'sacrificios',     label: 'Sacrificios',     icon: <Skull size={14} />,         color: '#ff6b80', rgb: '255,107,128', printBg: '#fde8ec', printBorder: '#c62828' },
  { key: 'entregas',        label: 'Entregas',        icon: <PackageCheck size={14} />,  color: '#ffb300', rgb: '255,179,0',   printBg: '#fefae8', printBorder: '#b8860b' },
  { key: 'temperaturas',    label: 'Temperaturas',    icon: <Thermometer size={14} />,   color: '#40c4ff', rgb: '64,196,255',  printBg: '#e8f4fd', printBorder: '#0277bd' },
  { key: 'incidentes',      label: 'Incidentes',      icon: <FileWarning size={14} />,   color: '#ce93d8', rgb: '206,147,216', printBg: '#f5f0ff', printBorder: '#9d4edd' },
]

function inicioSemana() {
  const d = new Date()
  const day = d.getDay()
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return lunes.toISOString().split('T')[0]
}

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

export default function Reportes() {
  const { animales, camadas, jaulas, sacrificios, entregas, temperaturas, incidentes } = useBioterio()
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
        const lats = sus.map(c => calcularLatencia(c)).filter(l => l !== null && l >= 0)
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

    return {
      reproducPeriodo, camPeriodo, machoRanking,
      efectivos, fallidos, enCurso, totalCrias, totalDest, supervRate,
      stockActual:  jaulas,
      sacrPeriodo:  sacrificios.filter(s => enPeriodo(s.fecha)),
      entPeriodo:   entregas.filter(e => enPeriodo(e.fecha)),
      tempPeriodo:  temperaturas.filter(t => enPeriodo(t.date)).sort((a,b) => a.date.localeCompare(b.date)),
      incPeriodo:   incidentes.filter(i => enPeriodo(i.fecha)),
    }
  }, [animales, camadas, jaulas, sacrificios, entregas, temperaturas, incidentes, periodo, anio, mes, semDesde])

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
    <div className="min-h-screen" style={{ background: '#050810' }}>

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
            <div className="w-1.5 h-7 rounded-full" style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.5)' }} />
            <div>
              <h1 className="text-xl font-bold text-white">Informes e Impresión</h1>
              <p className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                {secActivas}/{SECCIONES.length} secciones activas · {tituloPeriodo}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.4)', color: '#00e676', boxShadow: '0 0 20px rgba(0,230,118,0.1)' }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>

        {/* Período */}
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Período del informe</div>
          <div className="flex gap-2">
            {[{ val:'mensual', label: <><Calendar size={13} style={{ display:'inline', marginRight:4 }} />Por mes</> },{ val:'semanal', label: <><CalendarDays size={13} style={{ display:'inline', marginRight:4 }} />Por semana</> }].map(({ val, label }) => (
              <button key={val} onClick={() => setPeriodo(val)}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={periodo === val
                  ? { background: 'rgba(0,230,118,0.12)', border: '1.5px solid rgba(0,230,118,0.4)', color: '#00e676' }
                  : { background: 'rgba(30,51,82,0.3)', border: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a' }
                }>{label}</button>
            ))}
          </div>

          {periodo === 'mensual' ? (
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#4a5f7a' }}>Mes</label>
                <select value={mes} onChange={e => setMes(Number(e.target.value))}
                  className="px-3 py-2 text-sm rounded-xl focus:outline-none"
                  style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }}>
                  {MESES.map((m,i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#4a5f7a' }}>Año</label>
                <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))}
                  className="px-3 py-2 text-sm rounded-xl focus:outline-none w-28 font-mono"
                  style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }} />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#4a5f7a' }}>Inicio de semana</label>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="date" value={semDesde} onChange={e => setSemDesde(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl focus:outline-none font-mono"
                  style={{ background: 'rgba(8,13,26,0.8)', border: '1px solid rgba(30,51,82,0.8)', color: '#c9d4e0' }} />
                <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>→ {tituloPeriodo}</span>
              </div>
            </div>
          )}
        </div>

        {/* Secciones toggle */}
        <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4a5f7a' }}>Secciones a imprimir</div>
            <div className="flex gap-2">
              <button onClick={() => setSecciones(Object.fromEntries(SECCIONES.map(s=>[s.key,true])))}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ color: '#00e676', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)' }}>
                ✓ Todo
              </button>
              <button onClick={() => setSecciones(Object.fromEntries(SECCIONES.map(s=>[s.key,false])))}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ color: '#ff6b80', background: 'rgba(255,107,128,0.08)', border: '1px solid rgba(255,107,128,0.25)' }}>
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
                  : { background: 'rgba(30,51,82,0.2)', border: '1px solid rgba(30,51,82,0.4)', color: '#4a5f7a' }
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
            { label: 'Reproductores',    val: datos.reproducPeriodo.length,                                 color: '#ce93d8' },
            { label: 'Emparejamientos',  val: datos.camPeriodo.length,                                      color: '#40c4ff' },
            { label: 'Sacrificios',      val: datos.sacrPeriodo.reduce((s,x) => s + (x.cantidad || 1), 0), color: '#ff6b80' },
            { label: 'Temp. registradas',val: datos.tempPeriodo.length,                                     color: '#ffb300' },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={cardStyle}>
              <div className="text-2xl font-bold font-mono" style={{ color }}>{val}</div>
              <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>{label}</div>
            </div>
          ))}
        </div>

        <p className="text-xs" style={{ color: '#4a5f7a' }}>
          💡 En el diálogo de impresión seleccioná <strong style={{ color: '#c9d4e0' }}>"Guardar como PDF"</strong> y tamaño <strong style={{ color: '#c9d4e0' }}>A4</strong>.
        </p>
      </div>

      {/* ── ZONA DE IMPRESIÓN ── */}
      <div className="rpt-printzone">
        <DocImprimible
          tituloPeriodo={tituloPeriodo}
          datos={datos}
          animales={animales}
          camadas={camadas}
          secciones={secciones}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Documento imprimible
// ─────────────────────────────────────────────────────────────────────────────

function DocImprimible({ tituloPeriodo, datos, animales, camadas, secciones }) {
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
  const secActivas = SECCIONES.filter(s => secciones[s.key])

  const base = { fontFamily: "'Segoe UI', Arial, sans-serif", color: '#111', background: '#fff', fontSize: '9pt', lineHeight: 1.45 }

  return (
    <div style={{ ...base, padding: '0' }}>

      {/* ── Encabezado del documento ── */}
      <div style={{ borderBottom: '2pt solid #111', paddingBottom: '10pt', marginBottom: '12pt', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '7pt', color: '#666', fontFamily: 'monospace', marginBottom: '3pt', letterSpacing: '0.5pt' }}>
            BIOTERIO · SISTEMA DE GESTIÓN DE COLONIA · Mus musculus
          </div>
          <div style={{ fontSize: '15pt', fontWeight: 900, color: '#111', letterSpacing: '-0.3pt', marginBottom: '2pt' }}>
            INFORME DE COLONIA — {tituloPeriodo.toUpperCase()}
          </div>
          <div style={{ fontSize: '7.5pt', color: '#555', fontFamily: 'monospace' }}>
            Generado: {ahora} &nbsp;·&nbsp; Secciones: {secActivas.map(s => s.label).join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16pt', fontWeight: 900, color: '#111', letterSpacing: '-0.5pt' }}>
            Gen<span style={{ color: '#2e7d52' }}>E</span>R<span style={{ color: '#0277bd' }}>ats</span>
          </div>
          <div style={{ fontSize: '7pt', color: '#666' }}>Sistema de Bioterio</div>
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
                      <td>{s.camada_id ? parejaStr(s.camada_id) : '—'}</td>
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
                <thead><tr><th style={{ width: '75pt' }}>Fecha</th><th>Descripción</th></tr></thead>
                <tbody>
                  {incPeriodo.map(i => (
                    <tr key={i.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatFecha(i.fecha)||'—'}</td>
                      <td>{i.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Seccion>
      )}

      {/* Footer */}
      <div style={{ borderTop: '0.5pt solid #bbb', marginTop: '16pt', paddingTop: '5pt', fontSize: '7pt', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
        <span>BIOTERIO — Sistema de Gestión de Colonia · GenERats</span>
        <span>Mus musculus (Ratón doméstico) · Documento de uso interno</span>
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
