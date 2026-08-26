import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { useTheme } from '../context/ThemeContext'
import { formatFecha } from '../utils/calculos'
import { BIO_RATAS, BIO_RATONES } from '../utils/constants'
import {
  IDS_BIOTERIOS, ESPECIE_CORTO,
  rangoMes, mesAnteriorDe,
  stockEnFecha, promedioAnimalesEnIntervalo,
  resumenReproductivo, resumenEgresos, resumenInsumo,
  clasificarEntregas,
} from '../utils/reportemensual'
import { Printer, RefreshCw, Briefcase } from 'lucide-react'
import iterateTitleLogoLight from '../assets/iterate+logo+sloganfondoclaro.png'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_AB = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

const SIN_DATOS_TXT = 'Sin datos suficientes'

function cutoffDe(bioterioId) {
  return bioterioId === 'ratas' ? BIO_RATAS.STOCK_ADULTOS_DIAS : BIO_RATONES.STOCK_ADULTOS_DIAS
}

const nf = new Intl.NumberFormat('es-AR')
const fInt  = x => (x == null || isNaN(x)) ? '—' : nf.format(Math.round(x))
const fDec1 = x => (x == null || isNaN(x)) ? '—' : nf.format(Math.round(x * 10) / 10)

export default function ReporteMensual() {
  const { tema } = useTheme()
  const { limpiarBioterio } = useBioterioActivo()
  const cardStyle = { background: tema.bgCard, border: `1px solid ${tema.bgCardBorde}` }

  const hoyDate = new Date()
  const mesInicial = hoyDate.getMonth() === 0
    ? { anio: hoyDate.getFullYear() - 1, mes: 11 }
    : { anio: hoyDate.getFullYear(), mes: hoyDate.getMonth() - 1 }

  const [anio, setAnio]     = useState(mesInicial.anio)
  const [mes, setMes]       = useState(mesInicial.mes)
  const [datos, setDatos]   = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [porBio, vCensos, vCompras, aCensos, aIngresos] = await Promise.all([
        Promise.all(IDS_BIOTERIOS.map(id => Promise.all([
          supabase.from('animales').select('id,codigo,sexo,estado,fecha_nacimiento,fecha_sacrificio,created_at,bioterio_id').eq('bioterio_id', id),
          supabase.from('camadas').select('id,id_madre,id_padre,bioterio_id,fecha_nacimiento,fecha_destete,total_crias,crias_machos,crias_hembras,total_destetados,failure_flag,incluir_en_stock').eq('bioterio_id', id),
          supabase.from('jaulas').select('id,camada_id,total,machos,hembras').eq('bioterio_id', id),
          supabase.from('sacrificios').select('id,camada_id,cantidad,fecha,categoria').eq('bioterio_id', id),
          supabase.from('entregas').select('id,camada_id,animal_id,cantidad,machos,hembras,fecha,devuelta,grupo_investigacion,bioterio').eq('bioterio_id', id),
        ]))),
        supabase.from('viruta_censos').select('fecha,bolsas').order('fecha', { ascending: true }),
        supabase.from('viruta_compras').select('fecha,bolsas').order('fecha', { ascending: true }),
        supabase.from('alimento_censos').select('fecha,stock_kg').order('fecha', { ascending: true }),
        supabase.from('alimento_ingresos').select('fecha,kg').order('fecha', { ascending: true }),
      ])
      const bds = {}
      IDS_BIOTERIOS.forEach((id, i) => {
        const [an, ca, ja, sa, en] = porBio[i].map(r => r.data ?? [])
        bds[id] = { animales: an, camadas: ca, jaulas: ja, sacrificios: sa, entregas: en }
      })
      setDatos({
        bds,
        viruta: {
          censos:   (vCensos.data ?? []).map(c => ({ fecha: c.fecha, valor: c.bolsas })),
          ingresos: (vCompras.data ?? []).map(c => ({ fecha: c.fecha, valor: c.bolsas })),
        },
        alimento: {
          censos:   (aCensos.data ?? []).map(c => ({ fecha: c.fecha, valor: c.stock_kg })),
          ingresos: (aIngresos.data ?? []).map(c => ({ fecha: c.fecha, valor: c.kg })),
        },
      })
    } catch (e) {
      console.error('Error reporte mensual:', e)
      setError('No se pudo cargar la información. Verificá la conexión.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // ── Cálculos del período seleccionado ────────────────────────────────────────
  const rango = useMemo(() => rangoMes(anio, mes), [anio, mes])
  const prev  = useMemo(() => mesAnteriorDe(anio, mes), [anio, mes])
  const rangoAnt = useMemo(() => rangoMes(prev.anio, prev.mes), [prev])
  const tituloPeriodo = `${MESES[mes]} ${anio}`
  const etiquetaMesAnt = `${MESES_AB[prev.mes]} ${String(prev.anio).slice(2)}`

  const bdsConCutoff = useMemo(
    () => (!datos ? [] : IDS_BIOTERIOS.map(id => ({ bd: datos.bds[id], cutoffAdultos: cutoffDe(id) }))),
    [datos]
  )

  const stockPorEspecie = useMemo(
    () => (!datos ? [] : IDS_BIOTERIOS.map(id => ({ id, s: stockEnFecha(datos.bds[id], rango.fin, cutoffDe(id)) }))),
    [datos, rango]
  )
  const stockGlobalCierre = useMemo(
    () => stockPorEspecie.reduce((acc, { s }) => acc + s.totalAnimales, 0),
    [stockPorEspecie]
  )

  const reproDe = useCallback(rangoX => {
    if (!datos) return []
    return IDS_BIOTERIOS.map(id => ({ id, r: resumenReproductivo(datos.bds[id], rangoX) }))
  }, [datos])
  const egresosDe = useCallback(rangoX => {
    if (!datos) return []
    return IDS_BIOTERIOS.map(id => ({ id, e: resumenEgresos(datos.bds[id], rangoX) }))
  }, [datos])
  function sumaRepro(lista, key) { return lista.reduce((s, x) => s + x.r[key], 0) }
  function sumaEgr(lista, key)   { return lista.reduce((s, x) => s + x.e[key], 0) }

  const reproAct = useMemo(() => reproDe(rango), [reproDe, rango])
  const reproAnt = useMemo(() => reproDe(rangoAnt), [reproDe, rangoAnt])
  const egreAct  = useMemo(() => egresosDe(rango), [egresosDe, rango])
  const egreAnt  = useMemo(() => egresosDe(rangoAnt), [egresosDe, rangoAnt])

  // Totales actuales y del mes anterior (para comparaciones)
  const rep = {
    partos:          sumaRepro(reproAct, 'partos'),
    criasNacidas:    sumaRepro(reproAct, 'criasNacidas'),
    destetes:        sumaRepro(reproAct, 'destetes'),
    criasDestetadas: sumaRepro(reproAct, 'criasDestetadas'),
  }
  const repAnt = {
    partos:          sumaRepro(reproAnt, 'partos'),
    criasNacidas:    sumaRepro(reproAnt, 'criasNacidas'),
    destetes:        sumaRepro(reproAnt, 'destetes'),
    criasDestetadas: sumaRepro(reproAnt, 'criasDestetadas'),
  }
  const egr = {
    ent:  sumaEgr(egreAct, 'animalesEntregados'),
    entR: sumaEgr(egreAct, 'registrosEntregas'),
    sac:  sumaEgr(egreAct, 'animalesSacrificados'),
    sacR: sumaEgr(egreAct, 'registrosSacrificios'),
    dev:  sumaEgr(egreAct, 'entregasDevueltas'),
  }
  const egrAnt = {
    ent: sumaEgr(egreAnt, 'animalesEntregados'),
    sac: sumaEgr(egreAnt, 'animalesSacrificados'),
  }

  const viruta = useMemo(
    () => (!datos ? null : resumenInsumo(datos.viruta.censos, datos.viruta.ingresos, rango)),
    [datos, rango]
  )
  const virutaAnt = useMemo(
    () => (!datos ? null : resumenInsumo(datos.viruta.censos, datos.viruta.ingresos, rangoAnt)),
    [datos, rangoAnt]
  )
  const alimento = useMemo(
    () => (!datos ? null : resumenInsumo(datos.alimento.censos, datos.alimento.ingresos, rango)),
    [datos, rango]
  )
  const alimentoAnt = useMemo(
    () => (!datos ? null : resumenInsumo(datos.alimento.censos, datos.alimento.ingresos, rangoAnt)),
    [datos, rangoAnt]
  )

  // Relación consumo ↔ animales / jaulas (promedio del intervalo medido por censos)
  const relViruta = useMemo(() => {
    if (!viruta || viruta.porSemana == null || !viruta.medidaDesde) return null
    const prom = promedioAnimalesEnIntervalo(bdsConCutoff, viruta.medidaDesde, viruta.medidaHasta)
    if (!prom || prom.jaulas <= 0) return null
    return { valor: viruta.porSemana / prom.jaulas, contexto: `${fInt(prom.jaulas)} jaulas prom.` }
  }, [viruta, bdsConCutoff])

  const relAlimento = useMemo(() => {
    if (!alimento || alimento.porSemana == null || !alimento.medidaDesde) return null
    const prom = promedioAnimalesEnIntervalo(bdsConCutoff, alimento.medidaDesde, alimento.medidaHasta)
    if (!prom || prom.animales <= 0) return null
    const grDia = (alimento.porSemana * 1000) / 7
    return { valor: grDia / prom.animales, contexto: `${fInt(prom.animales)} animales prom.` }
  }, [alimento, bdsConCutoff])

  const clasifEnt = useMemo(
    () => (!datos ? null : clasificarEntregas(datos.bds)),
    [datos]
  )

  function delta(actual, anterior) {
    if (actual == null || anterior == null) return null
    const d = Math.round((actual - anterior) * 10) / 10
    if (d === 0) return `= ${etiquetaMesAnt}`
    return `${d > 0 ? '+' : ''}${nf.format(d)} vs ${etiquetaMesAnt}`
  }

  const ahora = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const notaMetodo = 'El consumo de insumos se mide por diferencia entre censos de stock registrados en el sistema. Los indicadores sin registros suficientes se informan como "Sin datos suficientes": nunca se estiman.'

  return (
    <div className="min-h-screen" style={{ background: tema.bgMain }}>

      {/* CSS de impresión */}
      <style>{`
        @media screen { .rm-printzone { display: none !important; } }
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm 12mm 14mm; }
          * { visibility: hidden !important; }
          .rm-printzone, .rm-printzone * { visibility: visible !important; }
          .rm-printzone { position: absolute; top: 0; left: 0; width: 100%; }
        }
        .rm-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; color: #111; }
        .rm-table th { background: #efefef; padding: 3pt 5pt; text-align: left; font-weight: 700; font-size: 8pt; border-bottom: 1.5pt solid #999; color: #222; }
        .rm-table td { padding: 3pt 5pt; border-bottom: 0.5pt solid #e0e0e0; vertical-align: top; color: #222; font-size: 8.5pt; }
        .rm-table tr:nth-child(even) td { background: #f8f8f8; }
        .rm-num { text-align: right; font-variant-numeric: tabular-nums; }
        .rm-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 5pt; margin: 5pt 0 6pt; }
        .rm-kpi-box { border: 1pt solid #ddd; border-radius: 3pt; padding: 6pt 4pt; text-align: center; background: #fafafa; }
        .rm-kpi-box .v { font-size: 13pt; font-weight: 800; color: #111; line-height: 1.15; }
        .rm-kpi-box .l { font-size: 6.5pt; color: #666; margin-top: 2pt; text-transform: uppercase; letter-spacing: 0.3pt; }
        .rm-kpi-box .d { font-size: 6.5pt; color: #888; margin-top: 1pt; }
        .rm-empty { font-size: 8.5pt; color: #888; padding: 3pt 0 4pt; font-style: italic; }
        .rm-foot { font-size: 7pt; color: #777; margin-top: 3pt; }
        .rm-subsect { margin-top: 6pt; padding-top: 4pt; border-top: 0.5pt solid #ddd; }
        .rm-subsect-title { font-size: 8pt; font-weight: 700; color: #444; margin-bottom: 3pt; text-transform: uppercase; letter-spacing: 0.4pt; }
        .rm-highlight { background: #f0fdf4; border-left: 3pt solid #16a34a; padding: 4pt 6pt; margin: 4pt 0; }
        .rm-highlight-title { font-size: 7.5pt; font-weight: 700; color: #166534; margin-bottom: 2pt; }
        .rm-kpi-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 5pt; margin: 5pt 0 6pt; }
      `}</style>

      {/* Panel en pantalla */}
      <div className="no-print p-6 space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={limpiarBioterio}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(30,51,82,0.35)', border: '1px solid rgba(30,51,82,0.8)', color: tema.textPrimary }}
              title="Volver">←</button>
            <div className="w-1.5 h-7 rounded-full" style={{ background: tema.accent }} />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: tema.textPrimary }}><Briefcase size={18} /> Reporte Directivo</h1>
              <p className="text-xs font-mono mt-0.5" style={{ color: tema.textMuted }}>
                Resumen ejecutivo para dirección · {tituloPeriodo}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={cargar}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={cardStyle}>
              <RefreshCw size={14} /> Actualizar
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(0,230,118,0.15)', border: '1.5px solid rgba(0,230,118,0.4)', color: tema.accent, boxShadow: '0 0 20px rgba(0,230,118,0.1)' }}>
              <Printer size={15} /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Período */}
        <div className="rounded-2xl p-5 flex flex-wrap items-end gap-4" style={cardStyle}>
          <div>
            <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: tema.textMuted }}>Mes a informar</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))}
              className="px-3 py-2 text-sm rounded-xl focus:outline-none"
              style={{ background: tema.bgInput, border: '1px solid rgba(30,51,82,0.8)', color: tema.textPrimary }}>
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-semibold mb-1.5" style={{ color: tema.textMuted }}>Año</label>
            <input type="number" value={anio} min="2020" max={hoyDate.getFullYear()} onChange={e => setAnio(Number(e.target.value))}
              className="px-3 py-2 text-sm rounded-xl focus:outline-none w-28 font-mono"
              style={{ background: tema.bgInput, border: '1px solid rgba(30,51,82,0.8)', color: tema.textPrimary }} />
          </div>
          <p className="text-xs flex-1 min-w-[220px]" style={{ color: tema.textMuted }}>
            El reporte resume exclusivamente el mes seleccionado. Por defecto se abre con el último mes completo.
          </p>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: '#ff6b80' }}>
            ⚠️ {error}
          </div>
        )}

        {cargando && (
          <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={cardStyle}>
            <span className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: tema.accent, borderTopColor: 'transparent' }} />
            <span className="text-sm font-mono" style={{ color: tema.textMuted }}>Calculando resumen...</span>
          </div>
        )}

        {!cargando && datos && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Animales al cierre', val: fInt(stockGlobalCierre), color: tema.accent },
                { label: 'Partos del mes',     val: fInt(rep.partos), color: tema.blue },
                { label: 'Crías nacidas',      val: fInt(rep.criasNacidas), color: tema.purple },
                { label: 'Entregados',         val: fInt(egr.ent), color: tema.amber },
                { label: 'Sacrificados',       val: fInt(egr.sac), color: tema.red },
                { label: 'Viruta al cierre',   val: viruta?.stockCierre != null ? `${fInt(viruta.stockCierre)} bol.` : SIN_DATOS_TXT, color: '#a78bfa' },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl p-4 text-center" style={cardStyle}>
                  <div className="text-lg font-bold font-mono leading-tight" style={{ color }}>{val}</div>
                  <div className="text-xs mt-1" style={{ color: tema.textMuted }}>{label}</div>
                </div>
              ))}
            </div>

            <p className="text-xs leading-relaxed" style={{ color: tema.textMuted }}>{notaMetodo}</p>
            <p className="text-xs" style={{ color: tema.textMuted }}>
              💡 En el diálogo de impresión seleccioná <strong style={{ color: tema.textPrimary }}>"Guardar como PDF"</strong> y tamaño <strong style={{ color: tema.textPrimary }}>A4</strong>.
            </p>
          </>
        )}
      </div>

      {/* Zona de impresión */}
      {!cargando && !error && (
        <div className="rm-printzone">
          <DocumentoImprimible
            tituloPeriodo={tituloPeriodo}
            ahora={ahora}
            stockPorEspecie={stockPorEspecie}
            stockGlobalCierre={stockGlobalCierre}
            rep={rep} repAnt={repAnt}
            egr={egr} egrAnt={egrAnt}
            reproAct={reproAct}
            egreAct={egreAct}
            viruta={viruta} virutaAnt={virutaAnt}
            alimento={alimento} alimentoAnt={alimentoAnt}
            relViruta={relViruta} relAlimento={relAlimento}
            clasifEnt={clasifEnt}
            delta={delta}
            notaMetodo={notaMetodo}
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Documento imprimible
// ─────────────────────────────────────────────────────────────────────────────

function DocumentoImprimible({
  tituloPeriodo, ahora,
  stockPorEspecie, stockGlobalCierre,
  rep, repAnt, egr, egrAnt,
  reproAct, egreAct,
  viruta, virutaAnt, alimento, alimentoAnt,
  relViruta, relAlimento,
  clasifEnt,
  delta, notaMetodo,
}) {
  const base = { fontFamily: "'Segoe UI', Arial, sans-serif", color: '#111', background: '#fff', fontSize: '9pt', lineHeight: 1.45 }

  const hayPartosSinCrias   = reproAct.some(x => x.r.partosSinRegistroCrias > 0)
  const hayDestetesSinCrias = reproAct.some(x => x.r.destetesSinRegistroCrias > 0)

  return (
    <div style={{ ...base, padding: 0 }}>

      <Encabezado tituloPeriodo={tituloPeriodo} ahora={ahora} />

      {/* Resumen ejecutivo */}
      <Seccion title={`Resumen del mes — ${tituloPeriodo}`} icon="📌" printBg="#eef7ee" printBorder="#2e7d52">
        <div className="rm-kpi-grid">
          <KpiBox v={fInt(stockGlobalCierre)} l="Animales al cierre" />
          <KpiBox v={fInt(rep.partos)} l="Partos (camadas)" d={delta(rep.partos, repAnt.partos)} />
          <KpiBox v={`${fInt(egr.ent)} / ${fInt(egr.sac)}`} l="Entregados / Sacrificados" />
          <KpiBox
            v={viruta?.stockCierre != null ? `${fInt(viruta.stockCierre)} bolsas` : SIN_DATOS_TXT}
            l="Stock de viruta al cierre"
          />
        </div>
      </Seccion>

      <SeccionAnimales stockPorEspecie={stockPorEspecie} stockGlobalCierre={stockGlobalCierre} />
      <SeccionReproduccion rep={rep} repAnt={repAnt} reproAct={reproAct} delta={delta} hayPartosSinCrias={hayPartosSinCrias} hayDestetesSinCrias={hayDestetesSinCrias} />
      <SeccionEgresos egr={egr} egrAnt={egrAnt} egreAct={egreAct} delta={delta} />
      {clasifEnt && clasifEnt.detalle.length > 0 && (
        <>
          <SeccionDetalleEntregas clasifEnt={clasifEnt} />
          <SeccionResumenGrupo clasifEnt={clasifEnt} />
          <SeccionResumenEspecie clasifEnt={clasifEnt} />
        </>
      )}
      <SeccionInsumo
        titulo="4. Consumo de viruta" icon="🪵" printBg="#f3e5f5" printBorder="#7b1fa2"
        unidad="bolsas" fmt={fInt} cortaRel="bol./jaula/sem"
        datos={viruta} datosAnt={virutaAnt} relacion={relViruta} delta={delta}
        textoRelacion="bolsas por jaula por semana"
      />
      <SeccionInsumo
        titulo="5. Consumo de alimento" icon="🌾" printBg="#fff8e1" printBorder="#f9a825"
        unidad="kg" fmt={fDec1} cortaRel="g/an/día"
        datos={alimento} datosAnt={alimentoAnt} relacion={relAlimento} delta={delta}
        textoRelacion="gramos por animal por día"
      />

      <Pie notaMetodo={notaMetodo} ahora={ahora} tituloPeriodo={tituloPeriodo} />
    </div>
  )
}

function Encabezado({ tituloPeriodo, ahora }) {
  return (
    <div style={{ borderBottom: '2pt solid #111', paddingBottom: '10pt', marginBottom: '12pt', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12pt' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '7pt', color: '#666', fontFamily: 'monospace', marginBottom: '3pt', letterSpacing: '0.5pt' }}>
          BIOTERIO · SISTEMA DE GESTIÓN DE COLONIA · INFORME PARA DIRECCIÓN
        </div>
        <div style={{ fontSize: '16pt', fontWeight: 900, letterSpacing: '-0.3pt', marginBottom: '2pt' }}>
          REPORTE DIRECTIVO — {tituloPeriodo.toUpperCase()}
        </div>
        <div style={{ fontSize: '7.5pt', color: '#555', fontFamily: 'monospace' }}>
          Período informado: 01 al fin de {tituloPeriodo.toLowerCase()} · Generado: {ahora}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <img src={iterateTitleLogoLight} alt="ITeRatE" style={{ height: '48pt', width: 'auto', display: 'block', marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

function KpiBox({ v, l, d }) {
  return (
    <div className="rm-kpi-box">
      <div className="v">{v ?? SIN_DATOS_TXT}</div>
      <div className="l">{l}</div>
      {d && <div className="d">{d}</div>}
    </div>
  )
}

function Seccion({ title, icon, printBg, printBorder, children }) {
  return (
    <div style={{ marginBottom: '11pt' }}>
      <div style={{
        fontSize: '9pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7pt',
        background: printBg, padding: '4pt 8pt', borderLeft: `4pt solid ${printBorder}`,
        display: 'flex', alignItems: 'center', gap: '4pt',
      }}>
        <span>{icon}</span><span>{title}</span>
      </div>
      <div style={{ paddingTop: '4pt' }}>{children}</div>
    </div>
  )
}

/* 1 · Animales */
function SeccionAnimales({ stockPorEspecie, stockGlobalCierre }) {
  const hayAlgo = stockPorEspecie.some(({ s }) => s.totalAnimales > 0)
  return (
    <Seccion title="1. Animales al cierre del período" icon="🐀" printBg="#f5f0ff" printBorder="#9d4edd">
      {!hayAlgo ? (
        <p className="rm-empty">Sin registros de animales al cierre del período.</p>
      ) : (
        <>
          <table className="rm-table">
            <thead>
              <tr>
                <th>Especie / Cepa</th><th>Sexo</th>
                <th className="rm-num">Crías (&lt;6 sem)</th>
                <th className="rm-num">Jóvenes</th>
                <th className="rm-num">Adultos</th>
                <th className="rm-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {stockPorEspecie.map(({ id, s }) => {
                const st = s.stock
                const filas = [
                  { label: '♂ Machos',  crias: st.crias.m, jovenes: st.jovenes.m, adultos: st.adultos.m + s.reproMachos },
                  { label: '♀ Hembras', crias: st.crias.h, jovenes: st.jovenes.h, adultos: st.adultos.h + s.reproHembras },
                ]
                const sinSexo = st.crias.s + st.jovenes.s + st.adultos.s
                if (sinSexo > 0) filas.push({ label: 'Sin sexo reg.', crias: st.crias.s, jovenes: st.jovenes.s, adultos: st.adultos.s })
                const subtotal = filas.reduce((a, f) => a + f.crias + f.jovenes + f.adultos, 0)

                const out = []
                filas.forEach((f, i) => {
                  out.push(
                    <tr key={`${id}-${i}`}>
                      {i === 0 && (
                        <td rowSpan={filas.length + 1} style={{ fontWeight: 700, verticalAlign: 'top', borderBottom: 'none' }}>
                          {ESPECIE_CORTO[id]}
                        </td>
                      )}
                      <td>{f.label}</td>
                      <td className="rm-num">{fInt(f.crias)}</td>
                      <td className="rm-num">{fInt(f.jovenes)}</td>
                      <td className="rm-num">{fInt(f.adultos)}</td>
                      <td className="rm-num"><strong>{fInt(f.crias + f.jovenes + f.adultos)}</strong></td>
                    </tr>
                  )
                })
                out.push(
                  <tr key={`${id}-sub`} style={{ fontWeight: 700 }}>
                    <td>Subtotal</td>
                    <td className="rm-num" colSpan={3}></td>
                    <td className="rm-num">{fInt(subtotal)}</td>
                  </tr>
                )
                return out
              })}
              <FilaTotalStock stockPorEspecie={stockPorEspecie} totalGeneral={stockGlobalCierre} />
            </tbody>
          </table>
          <p className="rm-foot">
            * Adultos incluye reproductores activos y stock adulto. Edad al corte: jóvenes = 6 sem hasta adultez
            (ratones ≥10 sem · ratas ≥12 sem). Reproductores exportados a Híbridos se cuentan en su cepa de origen.
          </p>
        </>
      )}
    </Seccion>
  )
}

function FilaTotalStock({ stockPorEspecie, totalGeneral }) {
  let crias = 0, jovenes = 0, adultos = 0
  for (const { s } of stockPorEspecie) {
    crias   += s.stock.crias.total
    jovenes += s.stock.jovenes.total
    adultos += s.stock.adultos.total + s.totalRepro
  }
  return (
    <tr style={{ fontWeight: 800, background: '#efefef' }}>
      <td colSpan={2}>TOTAL GENERAL</td>
      <td className="rm-num">{fInt(crias)}</td>
      <td className="rm-num">{fInt(jovenes)}</td>
      <td className="rm-num">{fInt(adultos)}</td>
      <td className="rm-num">{fInt(totalGeneral)}</td>
    </tr>
  )
}

/* 2 · Actividad reproductiva */
function SeccionReproduccion({ rep, repAnt, reproAct, delta, hayPartosSinCrias, hayDestetesSinCrias }) {
  const conActividad = reproAct.some(x => x.r.partos > 0 || x.r.destetes > 0)
  function celdaCrias(valor, vacia) {
    if (vacia) return '—'
    return valor > 0 ? fInt(valor) : '0'
  }
  return (
    <Seccion title="2. Actividad reproductiva del mes" icon="🪺" printBg="#e8f4fd" printBorder="#0277bd">
      <div className="rm-kpi-grid">
        <KpiBox v={fInt(rep.partos)} l="Partos (camadas nacidas)" d={delta(rep.partos, repAnt.partos)} />
        <KpiBox v={fInt(rep.criasNacidas)} l="Crías nacidas" d={delta(rep.criasNacidas, repAnt.criasNacidas)} />
        <KpiBox v={fInt(rep.destetes)} l="Destetes realizados" d={delta(rep.destetes, repAnt.destetes)} />
        <KpiBox v={fInt(rep.criasDestetadas)} l="Crías destetadas" d={delta(rep.criasDestetadas, repAnt.criasDestetadas)} />
      </div>
      {!conActividad ? (
        <p className="rm-empty">Sin actividad reproductiva registrada en el período.</p>
      ) : (
        <table className="rm-table">
          <thead>
            <tr>
              <th>Especie / Cepa</th>
              <th className="rm-num">Partos</th>
              <th className="rm-num">Crías nacidas</th>
              <th className="rm-num">Destetes</th>
              <th className="rm-num">Crías destetadas</th>
            </tr>
          </thead>
          <tbody>
            {reproAct.map(({ id, r }) => {
              const marcaNac = r.partosSinRegistroCrias > 0 ? ' *' : ''
              const marcaDest = r.destetesSinRegistroCrias > 0 ? ' *' : ''
              return (
                <tr key={id}>
                  <td>{ESPECIE_CORTO[id]}</td>
                  <td className="rm-num">{r.partos > 0 ? fInt(r.partos) : '—'}</td>
                  <td className="rm-num">{r.partos > 0 ? `${celdaCrias(r.criasNacidas, false)}${marcaNac}` : '—'}</td>
                  <td className="rm-num">{r.destetes > 0 ? fInt(r.destetes) : '—'}</td>
                  <td className="rm-num">{r.destetes > 0 ? `${celdaCrias(r.criasDestetadas, false)}${marcaDest}` : '—'}</td>
                </tr>
              )
            })}
            <tr style={{ fontWeight: 800, background: '#efefef' }}>
              <td>TOTAL</td>
              <td className="rm-num">{fInt(rep.partos)}</td>
              <td className="rm-num">{fInt(rep.criasNacidas)}</td>
              <td className="rm-num">{fInt(rep.destetes)}</td>
              <td className="rm-num">{fInt(rep.criasDestetadas)}</td>
            </tr>
          </tbody>
        </table>
      )}
      {(hayPartosSinCrias || hayDestetesSinCrias) && (
        <p className="rm-foot">* Hay camadas del período sin registro de cantidad: el valor suma solo las crías registradas.</p>
      )}
    </Seccion>
  )
}

/* 3 · Entregas y sacrificios */
function SeccionEgresos({ egr, egrAnt, egreAct, delta }) {
  return (
    <Seccion title="3. Entregas y sacrificios del mes" icon="📤" printBg="#fefae8" printBorder="#b8860b">
      <div className="rm-kpi-grid">
        <KpiBox v={fInt(egr.ent)} l="Animales entregados" d={delta(egr.ent, egrAnt.ent)} />
        <KpiBox v={fInt(egr.entR)} l="Entregas realizadas" />
        <KpiBox v={fInt(egr.sac)} l="Animales sacrificados" d={delta(egr.sac, egrAnt.sac)} />
        <KpiBox v={fInt(egr.sacR)} l="Sacrificios realizados" />
      </div>
      <table className="rm-table">
        <thead>
          <tr>
            <th>Especie / Cepa</th>
            <th className="rm-num">Animales entregados</th>
            <th className="rm-num">Entregas</th>
            <th className="rm-num">Animales sacrificados</th>
            <th className="rm-num">Sacrificios</th>
          </tr>
        </thead>
        <tbody>
          {egreAct.map(({ id, e }) => {
            const vacia = e.animalesEntregados === 0 && e.animalesSacrificados === 0
            return (
              <tr key={id}>
                <td>{ESPECIE_CORTO[id]}</td>
                <td className="rm-num">{!vacia || e.animalesEntregados > 0 ? fInt(e.animalesEntregados) : '—'}</td>
                <td className="rm-num">{!vacia || e.registrosEntregas > 0 ? fInt(e.registrosEntregas) : '—'}</td>
                <td className="rm-num">{!vacia || e.animalesSacrificados > 0 ? fInt(e.animalesSacrificados) : '—'}</td>
                <td className="rm-num">{!vacia || e.registrosSacrificios > 0 ? fInt(e.registrosSacrificios) : '—'}</td>
              </tr>
            )
          })}
          <tr style={{ fontWeight: 800, background: '#efefef' }}>
            <td>TOTAL</td>
            <td className="rm-num">{fInt(egr.ent)}</td>
            <td className="rm-num">{fInt(egr.entR)}</td>
            <td className="rm-num">{fInt(egr.sac)}</td>
            <td className="rm-num">{fInt(egr.sacR)}</td>
          </tr>
        </tbody>
      </table>
      {egr.dev > 0 && <p className="rm-foot">* Excluye {egr.dev} entrega(s) devuelta(s) al stock durante el mes.</p>}
    </Seccion>
  )
}

/* 3.1 · Detalle de animales entregados */
function SeccionDetalleEntregas({ clasifEnt }) {
  const { detalle } = clasifEnt
  if (!detalle || detalle.length === 0) return null
  const totalAnimales = detalle.reduce((s, d) => s + d.cantidad, 0)
  return (
    <div style={{ marginBottom: '8pt' }}>
      <div className="rm-subsect">
        <div className="rm-subsect-title">3.1 Detalle de animales entregados</div>
      </div>
      <div className="rm-highlight">
        <div className="rm-highlight-title">Totales del período</div>
        <span style={{ fontSize: '8.5pt' }}>{fInt(totalAnimales)} animales entregados en {detalle.length} combinación{detalle.length > 1 ? 'es' : ''}</span>
      </div>
      <table className="rm-table">
        <thead>
          <tr>
            <th>Especie / Cepa</th>
            <th>Sexo</th>
            <th>Edad / Categoría</th>
            <th>Grupo de investigación</th>
            <th className="rm-num">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {detalle.map((d, i) => (
            <tr key={i}>
              <td>{ESPECIE_CORTO[d.especie] ?? d.especie}</td>
              <td>{d.sexo === 'mixto' ? 'Mixto' : d.sexo === 'macho' ? '♂ Macho' : d.sexo === 'hembra' ? '♀ Hembra' : d.sexo}</td>
              <td>{d.categoria === 'crias' ? 'Cría' : d.categoria === 'jovenes' ? 'Joven' : 'Adulto'}</td>
              <td>{d.grupo}</td>
              <td className="rm-num"><strong>{fInt(d.cantidad)}</strong></td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800, background: '#efefef' }}>
            <td colSpan={4}>TOTAL</td>
            <td className="rm-num">{fInt(totalAnimales)}</td>
          </tr>
        </tbody>
      </table>
      <p className="rm-foot">* Los datos provienen exclusivamente de los registros reales de entregas del sistema. Sexo determinado por proporción de la camada o registro del reproductor. Categoría por edad al momento de la entrega: Cría (&lt;6 sem), Joven (6–10 sem), Adulto (&gt;10 sem).</p>
    </div>
  )
}

/* 3.2 · Resumen por grupo de investigación */
function SeccionResumenGrupo({ clasifEnt }) {
  const { porGrupo } = clasifEnt
  if (!porGrupo || porGrupo.length === 0) return null
  const totalAnimales = porGrupo.reduce((s, g) => s + g.total, 0)
  const totalRegistros = porGrupo.reduce((s, g) => s + g.registros, 0)
  return (
    <div style={{ marginBottom: '8pt' }}>
      <div className="rm-subsect">
        <div className="rm-subsect-title">3.2 Resumen por grupo de investigación</div>
      </div>
      <div className="rm-highlight">
        <div className="rm-highlight-title">Utilización de la colonia</div>
        <span style={{ fontSize: '8.5pt' }}>{porGrupo.length} grupo{porGrupo.length > 1 ? 's' : ''} receptores · {fInt(totalAnimales)} animales en {fInt(totalRegistros)} entrega{totalRegistros > 1 ? 's' : ''}</span>
      </div>
      <table className="rm-table">
        <thead>
          <tr>
            <th>Grupo de investigación</th>
            <th className="rm-num">Animales recibidos</th>
            <th className="rm-num">Entregas realizadas</th>
          </tr>
        </thead>
        <tbody>
          {porGrupo.map((g, i) => (
            <tr key={i}>
              <td>{g.grupo === 'Sin grupo' ? <em>Sin grupo asignado</em> : g.grupo}</td>
              <td className="rm-num"><strong>{fInt(g.total)}</strong></td>
              <td className="rm-num">{fInt(g.registros)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800, background: '#efefef' }}>
            <td>TOTAL</td>
            <td className="rm-num">{fInt(totalAnimales)}</td>
            <td className="rm-num">{fInt(totalRegistros)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* 3.3 · Resumen por especie / cepa */
function SeccionResumenEspecie({ clasifEnt }) {
  const { porEspecie } = clasifEnt
  if (!porEspecie || porEspecie.length === 0) return null
  const totalGeneral = porEspecie.reduce((s, e) => s + e.total, 0)

  const resumenEspecie = (e) => {
    const partes = []
    if (e.machos > 0) partes.push(`♂ ${fInt(e.machos)}`)
    if (e.hembras > 0) partes.push(`♀ ${fInt(e.hembras)}`)
    if (e.mixto > 0) partes.push(`Mixto ${fInt(e.mixto)}`)
    if (e.sinSexo > 0) partes.push(`s/sexo ${fInt(e.sinSexo)}`)
    return partes.length > 0 ? partes.join(' · ') : '—'
  }

  return (
    <div style={{ marginBottom: '8pt' }}>
      <div className="rm-subsect">
        <div className="rm-subsect-title">3.3 Resumen por especie / cepa</div>
      </div>
      <table className="rm-table">
        <thead>
          <tr>
            <th>Especie / Cepa</th>
            <th className="rm-num">Total entregados</th>
            <th>Desglose por sexo y categoría</th>
          </tr>
        </thead>
        <tbody>
          {porEspecie.map((e, i) => (
            <tr key={i}>
              <td><strong>{ESPECIE_CORTO[e.id] ?? e.id}</strong></td>
              <td className="rm-num"><strong>{fInt(e.total)}</strong></td>
              <td style={{ fontSize: '8pt' }}>{resumenEspecie(e)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800, background: '#efefef' }}>
            <td>TOTAL GENERAL</td>
            <td className="rm-num">{fInt(totalGeneral)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      {porEspecie.some(e => e.mixto > 0) && (
        <p className="rm-foot">* "Mixto": entregas donde la proporción macho/hembra fue igual o no se registró proporción exacta.</p>
      )}
    </div>
  )
}

/* 4 y 5 · Insumos (viruta en bolsas / alimento en kg) */
function SeccionInsumo({ titulo, icon, printBg, printBorder, unidad, fmt, cortaRel, datos, datosAnt, relacion, delta, textoRelacion }) {
  const medido = !!datos && datos.consumo !== null
  return (
    <Seccion title={titulo} icon={icon} printBg={printBg} printBorder={printBorder}>
      <div className="rm-kpi-grid">
        <KpiBox
          v={datos?.stockCierre != null ? `${fmt(datos.stockCierre)} ${unidad}` : null}
          l="Stock físico al cierre"
          d={datos?.fechaStockCierre ? `censo ${formatFecha(datos.fechaStockCierre)}` : null}
        />
        <KpiBox
          v={datos ? `${datos.hayIngresos ? '+' : ''}${fmt(datos.ingresosPeriodo)} ${unidad}` : null}
          l={`Ingresado en el mes (${unidad})`}
        />
        <KpiBox
          v={medido ? `${fmt(datos.consumo)} ${unidad}` : null}
          l={`Consumo registrado (${unidad})`}
          d={medido && datos.diasMedidos != null ? `${datos.diasMedidos} días medidos` : null}
        />
        <KpiBox
          v={datos?.promedioMensual != null ? `${fmt(datos.promedioMensual)} ${unidad}/mes` : null}
          l="Promedio mensual histórico"
          d={delta(datos?.consumo ?? null, datosAnt?.consumo ?? null)}
        />
      </div>

      {(!datos || (!medido && datos.stockCierre == null)) && (
        <p className="rm-empty">Sin censos registrados en el sistema para este insumo.</p>
      )}
      {datos && !medido && datos.stockCierre != null && (
        <p className="rm-empty">Consumo del período: {SIN_DATOS_TXT.toLowerCase()} — se requieren dos censos que acoten el mes.</p>
      )}

      {medido && (
        <table className="rm-table">
          <thead>
            <tr><th>Indicador</th><th className="rm-num">Valor</th><th>Detalle</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Consumo semanal del período</td>
              <td className="rm-num"><strong>{datos.porSemana != null ? `${fmt(datos.porSemana)} ${unidad}/sem` : SIN_DATOS_TXT}</strong></td>
              <td>Medido entre censos del {formatFecha(datos.medidaDesde)} y {formatFecha(datos.medidaHasta)}</td>
            </tr>
            <tr>
              <td>Consumo relativo a la colonia</td>
              <td className="rm-num">
                {relacion ? <strong>≈ {fmt(relacion.valor)} {cortaRel}</strong> : SIN_DATOS_TXT}
              </td>
              <td>{textoRelacion}{relacion ? ` (${relacion.contexto})` : ''}</td>
            </tr>
          </tbody>
        </table>
      )}

      {datos?.stockCierre != null && (
        <p className="rm-foot">
          * El stock físico al cierre proviene del último censo registrado{datos.fechaStockCierre ? ` (${formatFecha(datos.fechaStockCierre)})` : ''} más los ingresos posteriores dentro del mes. Ingresos y consumo son movimientos del período: no deben sumarse al stock.
        </p>
      )}
    </Seccion>
  )
}

function Pie({ notaMetodo, ahora, tituloPeriodo }) {
  return (
    <>
      <p className="rm-foot" style={{ marginTop: '10pt' }}>{notaMetodo}</p>
      <div style={{ borderTop: '0.5pt solid #bbb', marginTop: '10pt', paddingTop: '5pt', fontSize: '7pt', color: '#888', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ITeRatE · Sistema de Gestión de Bioterio</span>
        <span>Reporte Directivo · {tituloPeriodo} · Documento de uso interno</span>
        <span>{ahora}</span>
      </div>
    </>
  )
}
