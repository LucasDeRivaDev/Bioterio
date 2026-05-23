import { useState, useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { hoy, formatFecha } from '../utils/calculos'
import {
  CATEGORIAS, SEVERIDADES, LISTA_BIOTERIOS,
  getCategoriaInfo, getTipoLabel, getSeveridadInfo,
  labelBioterio, colorBioterio,
  calcularIndiceSanitario, nivelIndice,
  detectarPatrones, generarTendencias,
} from '../utils/sanitario'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, CheckCircle, Plus, Activity, TrendingUp, TrendingDown } from 'lucide-react'

// ── Constantes UI ─────────────────────────────────────────────────────────────

const BIOTERIOS_SIN_TODOS = LISTA_BIOTERIOS.slice(1)

// ── Componente principal ──────────────────────────────────────────────────────

export default function Incidentes() {
  const { incidentes, animales, camadas, agregarIncidente, editarIncidente, eliminarIncidente } = useBioterio()
  const { bioterioActivo } = useBioterioActivo()

  const [filtroColonia,   setFiltroColonia]   = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [filtroSeveridad, setFiltroSeveridad] = useState('todos')
  const [filtroEstado,    setFiltroEstado]    = useState('abiertos') // 'todos' | 'abiertos' | 'resueltos'
  const [modal,           setModal]           = useState(false)
  const [incAEditar,      setIncAEditar]      = useState(null)
  const [confirmarElim,   setConfirmarElim]   = useState(null)
  const [tabActivo,       setTabActivo]       = useState('lista') // 'lista' | 'estadisticas'

  // ── Índice sanitario global y por colonia ──────────────────────────────────
  const indices = useMemo(() => {
    const global = calcularIndiceSanitario(camadas, incidentes, null)
    const porColonia = {}
    BIOTERIOS_SIN_TODOS.forEach(b => {
      porColonia[b.id] = calcularIndiceSanitario(camadas, incidentes, b.id)
    })
    return { global, porColonia }
  }, [camadas, incidentes])

  // ── Patrones detectados ────────────────────────────────────────────────────
  const patrones = useMemo(() => detectarPatrones(incidentes), [incidentes])

  // ── Tendencias 6 meses ─────────────────────────────────────────────────────
  const { meses: mesesTend, tendencia } = useMemo(
    () => generarTendencias(incidentes, 6),
    [incidentes]
  )

  // ── Filtros ────────────────────────────────────────────────────────────────
  const incidentesFiltrados = useMemo(() => {
    return incidentes.filter(i => {
      if (filtroColonia !== 'todos'   && i.bioterio_id      !== filtroColonia)   return false
      if (filtroCategoria !== 'todos' && i.tipo_categoria   !== filtroCategoria) return false
      if (filtroSeveridad !== 'todos' && i.severidad        !== filtroSeveridad) return false
      if (filtroEstado === 'abiertos'  && i.resuelto)  return false
      if (filtroEstado === 'resueltos' && !i.resuelto) return false
      return true
    })
  }, [incidentes, filtroColonia, filtroCategoria, filtroSeveridad, filtroEstado])

  // ── Stats rápidos ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const abiertos  = incidentes.filter(i => !i.resuelto)
    const graves    = abiertos.filter(i => i.severidad === 'grave')
    const hace30    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const recientes = incidentes.filter(i => i.fecha >= hace30)
    return { total: incidentes.length, abiertos: abiertos.length, graves: graves.length, recientes: recientes.length }
  }, [incidentes])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function abrirNuevo() {
    setIncAEditar(null)
    setModal(true)
  }

  async function toggleResuelto(inc) {
    await editarIncidente({ ...inc, resuelto: !inc.resuelto })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen" style={{ background: '#050810' }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full"
            style={{ background: '#ff6b80', boxShadow: '0 0 8px rgba(255,107,128,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Vigilancia sanitaria</h1>
            <p className="text-xs mt-0.5 font-mono" style={{ color: '#4a5f7a' }}>
              {stats.abiertos} incidentes abiertos · {stats.graves} graves · registrando desde{' '}
              <span style={{ color: colorBioterio(bioterioActivo) }}>{labelBioterio(bioterioActivo)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabActivo(t => t === 'lista' ? 'estadisticas' : 'lista')}
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: tabActivo === 'estadisticas' ? 'rgba(64,196,255,0.15)' : 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.3)', color: '#40c4ff' }}>
            <Activity size={12} style={{ display: 'inline', marginRight: 5 }} />
            {tabActivo === 'estadisticas' ? 'Ver lista' : 'Estadísticas'}
          </button>
          <button onClick={abrirNuevo}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(255,107,128,0.12)', border: '1.5px solid rgba(255,107,128,0.35)', color: '#ff6b80' }}>
            <Plus size={13} style={{ display: 'inline', marginRight: 5 }} />
            Nuevo incidente
          </button>
        </div>
      </div>

      {/* ── Panel de índice sanitario ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,21,40,0.9)', border: '1px solid rgba(255,107,128,0.2)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(255,107,128,0.1)', background: 'rgba(255,107,128,0.04)' }}>
          <Activity size={13} style={{ color: '#ff6b80' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#ff6b80' }}>
            Índice sanitario global
          </span>
          <span className="ml-auto text-xs font-mono" style={{ color: '#4a5f7a' }}>
            Basado en incidentes activos + historial reproductivo
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {/* Global */}
          {(() => {
            const nv = nivelIndice(indices.global)
            return (
              <div className="px-4 py-4 text-center col-span-2 md:col-span-1 flex flex-col items-center gap-1">
                <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#4a5f7a' }}>Global</div>
                <div className="text-4xl font-bold font-mono" style={{ color: nv.color, lineHeight: 1.1 }}>{indices.global}</div>
                <div className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: nv.bg, color: nv.color, border: `1px solid ${nv.border}` }}>
                  {nv.emoji} {nv.label}
                </div>
              </div>
            )
          })()}
          {/* Por colonia */}
          {BIOTERIOS_SIN_TODOS.map(b => {
            const sc = indices.porColonia[b.id] ?? 100
            const nv = nivelIndice(sc)
            return (
              <div key={b.id} className="px-4 py-4 text-center flex flex-col items-center gap-1">
                <div className="text-xs font-mono" style={{ color: b.color }}>{b.label}</div>
                <div className="text-2xl font-bold font-mono" style={{ color: nv.color, lineHeight: 1.1 }}>{sc}</div>
                <div className="text-xs font-mono"
                  style={{ color: nv.color }}>{nv.emoji} {nv.label}</div>
                {incidentes.filter(i => i.bioterio_id === b.id && !i.resuelto).length > 0 && (
                  <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                    {incidentes.filter(i => i.bioterio_id === b.id && !i.resuelto).length} abiertos
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-5 py-2 text-xs font-mono grid grid-cols-3 gap-x-6 gap-y-0.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: '#3d5068' }}>
          <span>🟢 80–100: Estable</span>
          <span>🟡 50–79: Atención</span>
          <span>🔴 &lt;50: Riesgo</span>
        </div>
      </div>

      {/* ── Alertas de patrones ── */}
      {patrones.length > 0 && (
        <div className="space-y-2">
          {patrones.map((p, i) => (
            <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{
                background: p.nivel === 'critico' ? 'rgba(255,107,128,0.08)' : 'rgba(255,179,0,0.07)',
                border: `1px solid ${p.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.25)'}`,
              }}>
              <AlertTriangle size={14} style={{ color: p.nivel === 'critico' ? '#ff6b80' : '#ffb300', flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: p.nivel === 'critico' ? '#ff6b80' : '#ffb300' }}>
                  ⚠ Patrón repetitivo detectado: {p.tipoLabel}
                </div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#6a8099' }}>
                  {p.count} incidentes en los últimos 90 días
                  {p.animalesU >= 2 ? ` · ${p.animalesU} animales distintos` : ''}
                  {p.camadasU >= 2 ? ` · ${p.camadasU} camadas distintas` : ''}
                  {p.bioteriosU.length > 1 ? ` · en ${p.bioteriosU.map(labelBioterio).join(', ')}` : ''}
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: p.nivel === 'critico' ? 'rgba(255,107,128,0.1)' : 'rgba(255,179,0,0.1)',
                  color: p.nivel === 'critico' ? '#ff6b80' : '#ffb300',
                  border: `1px solid ${p.nivel === 'critico' ? 'rgba(255,107,128,0.3)' : 'rgba(255,179,0,0.25)'}`,
                }}>
                {p.nivel === 'critico' ? '🔴 Crítico' : '🟡 Alerta'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Estadísticas ── */}
      {tabActivo === 'estadisticas' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total registros',      v: stats.total,     color: '#8a9bb0' },
              { label: 'Abiertos',             v: stats.abiertos,  color: '#ffb300' },
              { label: 'Graves sin resolver',  v: stats.graves,    color: '#ff6b80' },
              { label: 'Últimos 30 días',      v: stats.recientes, color: '#40c4ff' },
            ].map(k => (
              <div key={k.label} className="rounded-xl px-4 py-4 text-center"
                style={{ background: 'rgba(13,21,40,0.7)', border: `1px solid ${k.color}25` }}>
                <div className="text-3xl font-bold font-mono" style={{ color: k.color, lineHeight: 1 }}>{k.v}</div>
                <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Gráfico tendencias 6 meses */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex-1">
                <div className="font-bold text-xs text-white">Incidentes por mes — últimos 6 meses</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#4a5f7a' }}>
                  Graves · Moderados · Leves
                </div>
              </div>
              <div className="text-xs font-mono flex items-center gap-1"
                style={{ color: tendencia > 0 ? '#ff6b80' : tendencia < 0 ? '#00e676' : '#4a5f7a' }}>
                {tendencia > 0 ? <TrendingUp size={11} /> : tendencia < 0 ? <TrendingDown size={11} /> : null}
                {tendencia > 0 ? `+${tendencia}%` : tendencia < 0 ? `${tendencia}%` : 'Sin cambio'} vs mes anterior
              </div>
            </div>
            <div className="px-2 py-3" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mesesTend} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#4a5f7a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ color: '#c9d4e0' }}
                    formatter={(v, n) => [v, n === 'graves' ? 'Graves' : n === 'moderados' ? 'Moderados' : 'Leves']} />
                  <Bar dataKey="graves"    fill="rgba(255,107,128,0.7)" radius={[2,2,0,0]} stackId="a" />
                  <Bar dataKey="moderados" fill="rgba(255,152,0,0.6)"   radius={[2,2,0,0]} stackId="a" />
                  <Bar dataKey="leves"     fill="rgba(255,179,0,0.4)"   radius={[2,2,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribución por categoría */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(13,21,40,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-bold text-xs text-white">Distribución por categoría</div>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {Object.entries(CATEGORIAS).map(([catId, cat]) => {
                const n = incidentes.filter(i => i.tipo_categoria === catId).length
                const pct = incidentes.length > 0 ? Math.round((n / incidentes.length) * 100) : 0
                return (
                  <div key={catId} className="flex items-center gap-3 text-xs font-mono">
                    <span style={{ width: 16 }}>{cat.icon}</span>
                    <span className="w-24 shrink-0" style={{ color: cat.color }}>{cat.label}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color, transition: 'width 0.4s' }} />
                    </div>
                    <span className="w-8 text-right font-bold text-white">{n}</span>
                    <span style={{ color: '#3d5068' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de incidentes ── */}
      {tabActivo === 'lista' && (
        <>
          {/* Filtros */}
          <div className="space-y-2">
            {/* Fila 1: colonias */}
            <div className="flex flex-wrap gap-1.5">
              {LISTA_BIOTERIOS.map(b => {
                const activo = filtroColonia === b.id
                const count = b.id === 'todos'
                  ? incidentes.filter(i => filtroEstado === 'abiertos' ? !i.resuelto : filtroEstado === 'resueltos' ? i.resuelto : true).length
                  : incidentes.filter(i => i.bioterio_id === b.id && (filtroEstado === 'abiertos' ? !i.resuelto : filtroEstado === 'resueltos' ? i.resuelto : true)).length
                return (
                  <button key={b.id} onClick={() => setFiltroColonia(b.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    style={{
                      background: activo ? `${b.color}22` : 'rgba(13,21,40,0.6)',
                      border: activo ? `1px solid ${b.color}55` : '1px solid rgba(30,51,82,0.6)',
                      color: activo ? b.color : '#4a5f7a',
                    }}>
                    {b.label}
                    {count > 0 && <span className="font-mono text-xs" style={{ color: activo ? b.color : '#3d5068' }}>{count}</span>}
                  </button>
                )
              })}
            </div>
            {/* Fila 2: categoría + severidad + estado */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFiltroCategoria('todos')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: filtroCategoria === 'todos' ? 'rgba(138,155,176,0.2)' : 'rgba(13,21,40,0.6)', border: filtroCategoria === 'todos' ? '1px solid rgba(138,155,176,0.4)' : '1px solid rgba(30,51,82,0.6)', color: filtroCategoria === 'todos' ? '#8a9bb0' : '#4a5f7a' }}>
                Todas las categorías
              </button>
              {Object.entries(CATEGORIAS).map(([catId, cat]) => (
                <button key={catId} onClick={() => setFiltroCategoria(catId)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: filtroCategoria === catId ? `${cat.color}22` : 'rgba(13,21,40,0.6)', border: filtroCategoria === catId ? `1px solid ${cat.color}55` : '1px solid rgba(30,51,82,0.6)', color: filtroCategoria === catId ? cat.color : '#4a5f7a' }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.1)', alignSelf: 'center' }}>|</span>
              {['todos', 'abiertos', 'resueltos'].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{
                    background: filtroEstado === e ? 'rgba(255,255,255,0.1)' : 'rgba(13,21,40,0.6)',
                    border: filtroEstado === e ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(30,51,82,0.6)',
                    color: filtroEstado === e ? '#c9d4e0' : '#4a5f7a',
                  }}>
                  {e === 'todos' ? 'Todos' : e === 'abiertos' ? '🔴 Abiertos' : '✅ Resueltos'}
                </button>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.1)', alignSelf: 'center' }}>|</span>
              {SEVERIDADES.map(s => (
                <button key={s.id} onClick={() => setFiltroSeveridad(prev => prev === s.id ? 'todos' : s.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: filtroSeveridad === s.id ? s.bg : 'rgba(13,21,40,0.6)', border: filtroSeveridad === s.id ? `1px solid ${s.color}55` : '1px solid rgba(30,51,82,0.6)', color: filtroSeveridad === s.id ? s.color : '#4a5f7a' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          {incidentesFiltrados.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(255,107,128,0.03)', border: '1px dashed rgba(255,107,128,0.2)' }}>
              <div className="text-4xl mb-3">📋</div>
              <div className="font-semibold text-sm text-white mb-1">Sin incidentes</div>
              <div className="text-xs" style={{ color: '#4a5f7a' }}>No hay registros con los filtros actuales.</div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }}>
              {/* Encabezado */}
              <div className="hidden md:grid px-5 py-2 text-xs font-semibold uppercase tracking-widest"
                style={{ gridTemplateColumns: '90px 60px 90px 110px 1fr 80px', gap: '8px', borderBottom: '1px solid rgba(30,51,82,0.6)', color: '#4a5f7a', background: 'rgba(0,0,0,0.15)' }}>
                <span>Fecha</span>
                <span>Colonia</span>
                <span>Categoría</span>
                <span>Tipo</span>
                <span>Descripción</span>
                <span>Estado</span>
              </div>

              <div className="divide-y" style={{ borderColor: 'rgba(30,51,82,0.4)' }}>
                {incidentesFiltrados.map((inc) => {
                  const catInfo  = getCategoriaInfo(inc.tipo_categoria)
                  const sevInfo  = getSeveridadInfo(inc.severidad)
                  const tipoLbl  = getTipoLabel(inc.tipo_categoria, inc.tipo_incidente)
                  const animal   = animales.find(a => a.id === inc.animal_id)
                  const camada   = camadas.find(c => c.id === inc.camada_id)

                  return (
                    <div key={inc.id}
                      className="px-5 py-3.5 flex flex-col md:grid md:items-start gap-2 group hover:bg-white/[0.01]"
                      style={{ gridTemplateColumns: '90px 60px 90px 110px 1fr 80px', opacity: inc.resuelto ? 0.6 : 1 }}>

                      {/* Fecha */}
                      <div className="font-mono text-xs font-semibold" style={{ color: '#ffb300' }}>
                        {formatFecha(inc.fecha)}
                      </div>

                      {/* Colonia */}
                      <div>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${colorBioterio(inc.bioterio_id)}18`, color: colorBioterio(inc.bioterio_id), border: `1px solid ${colorBioterio(inc.bioterio_id)}35` }}>
                          {labelBioterio(inc.bioterio_id)}
                        </span>
                      </div>

                      {/* Categoría */}
                      <div className="flex items-center gap-1 text-xs font-mono" style={{ color: catInfo.color }}>
                        <span>{catInfo.icon}</span>
                        <span>{catInfo.label}</span>
                      </div>

                      {/* Tipo + severidad */}
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold" style={{ color: '#c9d4e0' }}>{tipoLbl}</span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded-full self-start"
                          style={{ background: sevInfo.bg, color: sevInfo.color, border: `1px solid ${sevInfo.color}40` }}>
                          {sevInfo.label}
                        </span>
                      </div>

                      {/* Descripción + asociaciones */}
                      <div className="space-y-1">
                        <div className="text-sm leading-relaxed" style={{ color: inc.resuelto ? '#4a5f7a' : '#c9d4e0' }}>
                          {inc.descripcion || <span style={{ color: '#3d5068' }}>Sin descripción</span>}
                        </div>
                        {(animal || camada) && (
                          <div className="flex flex-wrap gap-1.5">
                            {animal && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: animal.sexo === 'macho' ? 'rgba(64,196,255,0.08)' : 'rgba(167,139,250,0.08)', color: animal.sexo === 'macho' ? '#40c4ff' : '#a78bfa', border: `1px solid ${animal.sexo === 'macho' ? 'rgba(64,196,255,0.25)' : 'rgba(167,139,250,0.25)'}` }}>
                                {animal.sexo === 'macho' ? '♂' : '♀'} {animal.codigo ?? `#${animal.id.slice(0,6)}`}
                              </span>
                            )}
                            {camada && (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(255,179,0,0.08)', color: '#ffb300', border: '1px solid rgba(255,179,0,0.25)' }}>
                                Camada {formatFecha(camada.fecha_copula, { day: '2-digit', month: '2-digit' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleResuelto(inc)}
                          title={inc.resuelto ? 'Marcar como abierto' : 'Marcar como resuelto'}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono transition-all"
                          style={{
                            background: inc.resuelto ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${inc.resuelto ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.1)'}`,
                            color: inc.resuelto ? '#00e676' : '#4a5f7a',
                          }}>
                          <CheckCircle size={10} />
                          {inc.resuelto ? 'Resuelto' : 'Resolver'}
                        </button>
                        <button
                          onClick={() => { setIncAEditar(inc); setModal(true) }}
                          className="px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-all"
                          style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.2)', color: '#40c4ff' }}>
                          ✎
                        </button>
                        <button
                          onClick={() => setConfirmarElim(inc)}
                          className="px-2 py-1 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-all"
                          style={{ background: 'rgba(255,61,87,0.06)', border: '1px solid rgba(255,61,87,0.2)', color: '#ff6b80' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal nuevo / editar incidente ── */}
      {modal && (
        <ModalIncidente
          inicial={incAEditar}
          animales={animales}
          camadas={camadas}
          bioterioActivo={bioterioActivo}
          onGuardar={async (datos) => {
            if (incAEditar) {
              await editarIncidente({ ...incAEditar, ...datos })
            } else {
              await agregarIncidente(datos)
            }
            setModal(false)
            setIncAEditar(null)
          }}
          onCerrar={() => { setModal(false); setIncAEditar(null) }}
        />
      )}

      {/* ── Modal confirmar eliminar ── */}
      {confirmarElim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmarElim(null) }}>
          <div className="rounded-2xl p-6 space-y-4 w-full max-w-sm"
            style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(255,61,87,0.3)' }}>
            <div className="text-center space-y-2">
              <div className="text-3xl">🗑️</div>
              <div className="font-bold text-white text-sm">Eliminar incidente</div>
              <div className="text-xs px-3 py-2 rounded-lg text-left leading-relaxed"
                style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.15)', color: '#8a9bb0' }}>
                {confirmarElim.descripcion?.slice(0, 100) || '(sin descripción)'}
              </div>
              <p className="text-xs" style={{ color: '#4a5f7a' }}>Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmarElim(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.2)', color: '#8a9bb0' }}>
                Cancelar
              </button>
              <button onClick={() => { eliminarIncidente(confirmarElim.id); setConfirmarElim(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,61,87,0.15)', border: '1px solid rgba(255,61,87,0.35)', color: '#ff6b80' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal: Registrar / editar incidente ───────────────────────────────────────

function ModalIncidente({ inicial, animales, camadas, bioterioActivo, onGuardar, onCerrar }) {
  const [fecha,         setFecha]         = useState(inicial?.fecha ?? hoy())
  const [categoria,     setCategoria]     = useState(inicial?.tipo_categoria ?? '')
  const [tipoInc,       setTipoInc]       = useState(inicial?.tipo_incidente ?? '')
  const [severidad,     setSeveridad]     = useState(inicial?.severidad ?? 'leve')
  const [descripcion,   setDescripcion]   = useState(inicial?.descripcion ?? '')
  const [animalId,      setAnimalId]      = useState(inicial?.animal_id ?? '')
  const [camadaId,      setCamadaId]      = useState(inicial?.camada_id ?? '')
  const [guardando,     setGuardando]     = useState(false)
  const [error,         setError]         = useState('')

  const tipos = categoria ? CATEGORIAS[categoria]?.tipos ?? [] : []
  const esEdicion = !!inicial

  // Animales y camadas activos del bioterio actual para asociar
  const animalesDisp = animales.filter(a => ['activo','en_apareamiento','en_cria'].includes(a.estado))
  const camadasDisp  = camadas.filter(c => !c.failure_flag && c.fecha_nacimiento && !c.fecha_destete)

  async function guardar(e) {
    e.preventDefault()
    if (!categoria)      { setError('Seleccioná una categoría.'); return }
    if (!tipoInc)        { setError('Seleccioná el tipo de incidente.'); return }
    setGuardando(true); setError('')
    try {
      await onGuardar({
        fecha,
        tipo_categoria: categoria,
        tipo_incidente: tipoInc,
        severidad,
        descripcion: descripcion.trim() || null,
        animal_id:  animalId  || null,
        camada_id:  camadaId  || null,
        resuelto:   inicial?.resuelto ?? false,
      })
    } catch {
      setError('No se pudo guardar. Verificá la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  const inputBase = {
    background: 'rgba(8,13,26,0.9)', border: '1px solid rgba(30,51,82,0.9)',
    color: '#c9d4e0', borderRadius: '10px', padding: '9px 12px',
    fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'monospace',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,16,0.88)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90dvh] overflow-y-auto"
        style={{ background: 'rgba(13,21,40,0.98)', border: '1px solid rgba(255,107,128,0.3)', boxShadow: '0 0 60px rgba(255,107,128,0.1)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,107,128,0.12)', background: 'rgba(255,107,128,0.04)' }}>
          <div className="font-bold text-white text-sm">
            {esEdicion ? '✎ Editar incidente' : '🩺 Registrar incidente'}
          </div>
          <div className="text-xs font-mono mt-1" style={{ color: '#4a5f7a' }}>
            {esEdicion ? 'Modificá los datos del incidente seleccionado' : `Registrando en: ${labelBioterio(bioterioActivo)}`}
          </div>
        </div>

        <form onSubmit={guardar} className="px-6 py-5 space-y-4">

          {/* Fecha + Severidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required style={inputBase} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Severidad</label>
              <div className="flex gap-1.5">
                {SEVERIDADES.map(s => (
                  <button key={s.id} type="button" onClick={() => setSeveridad(s.id)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: severidad === s.id ? s.bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${severidad === s.id ? s.color + '55' : 'rgba(255,255,255,0.1)'}`,
                      color: severidad === s.id ? s.color : '#4a5f7a',
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Categoría</label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
              {Object.entries(CATEGORIAS).map(([catId, cat]) => (
                <button key={catId} type="button"
                  onClick={() => { setCategoria(prev => prev === catId ? '' : catId); setTipoInc('') }}
                  className="py-2 px-1.5 rounded-xl text-xs font-semibold text-center transition-all"
                  style={{
                    background: categoria === catId ? `${cat.color}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${categoria === catId ? cat.color + '55' : 'rgba(255,255,255,0.1)'}`,
                    color: categoria === catId ? cat.color : '#4a5f7a',
                  }}>
                  <div className="text-base">{cat.icon}</div>
                  <div className="leading-tight mt-0.5">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de incidente */}
          {categoria && tipos.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>Tipo de incidente</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {tipos.map(t => (
                  <button key={t.id} type="button" onClick={() => setTipoInc(t.id)}
                    className="text-left py-1.5 px-3 rounded-lg text-xs font-mono transition-all"
                    style={{
                      background: tipoInc === t.id ? `${getCategoriaInfo(categoria).color}18` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tipoInc === t.id ? getCategoriaInfo(categoria).color + '40' : 'rgba(255,255,255,0.07)'}`,
                      color: tipoInc === t.id ? getCategoriaInfo(categoria).color : '#8a9bb0',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
              Descripción / Observaciones <span style={{ color: '#3d5068' }}>(opcional)</span>
            </label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Describí el evento, qué se observó, qué medidas se tomaron..."
              rows={3} style={{ ...inputBase, resize: 'vertical', lineHeight: '1.5' }} />
          </div>

          {/* Asociar animal o camada */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
                Animal <span style={{ color: '#3d5068' }}>(opc.)</span>
              </label>
              <select value={animalId} onChange={e => setAnimalId(e.target.value)} style={inputBase}>
                <option value="">— Ninguno —</option>
                {animalesDisp.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.sexo === 'macho' ? '♂' : '♀'} {a.codigo ?? `#${a.id.slice(0,6)}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#4a5f7a' }}>
                Camada <span style={{ color: '#3d5068' }}>(opc.)</span>
              </label>
              <select value={camadaId} onChange={e => setCamadaId(e.target.value)} style={inputBase}>
                <option value="">— Ninguna —</option>
                {camadasDisp.map(c => (
                  <option key={c.id} value={c.id}>
                    Cópula {formatFecha(c.fecha_copula, { day: '2-digit', month: '2-digit' })}
                    {c.total_crias ? ` · ${c.total_crias} crías` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#4a5f7a' }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,107,128,0.14)', border: '1.5px solid rgba(255,107,128,0.45)', color: '#ff6b80', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : esEdicion ? '✓ Actualizar' : '✓ Registrar incidente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
