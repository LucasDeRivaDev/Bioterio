// Informe Directivo — reporte periódico del bioterio para la Dirección.
// Recopila de los módulos (Camadas, Incidentes, Temperatura, Entregas, Pedidos,
// Sacrificios) solo lo ocurrido en el período elegido y lo arma como documento
// A4 listo para imprimir o guardar en PDF. La lógica vive en utils/informeDirectivo.js.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBioterioActivo } from '../context/BioterioActivoContext'
import { BarraGlobal, Boton, Campo, Entrada, Aviso, Panel } from '../components/ui'
import { formatFecha } from '../utils/calculos'
import { BIO_RATAS, BIO_RATONES } from '../utils/constants'
import { IDS_BIOTERIOS, rangoMes, stockEnFecha, resumenInsumo } from '../utils/reportemensual'
import {
  SIN_REG, RANGO_TEMP_OK,
  validarRango, diasDelRango, coloniaLabel, mapaAnimales,
  detalleApareamientos, detalleCamadas, detalleIncidentes, resumenTemperaturas,
  detalleEntregas, detallePedidos, detalleSacrificios,
} from '../utils/informeDirectivo'
import { FileDown } from 'lucide-react'
import iterateTitleLogoLight from '../assets/iterate+logo+sloganfondoclaro.png'

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CAP = MESES.map(m => m[0].toUpperCase() + m.slice(1))

const nf = new Intl.NumberFormat('es-AR')
const fInt  = x => (x == null || isNaN(x)) ? '—' : nf.format(Math.round(x))
const fDec1 = x => (x == null || isNaN(x)) ? '—' : nf.format(Math.round(x * 10) / 10)
const fTemp = x => (x == null || isNaN(x)) ? '—' : `${fDec1(x)} °C`
const fFecha = f => formatFecha(f)
const nOrDash = x => (x == null ? '—' : fInt(x))

const control = 'w-full rounded-md border border-line bg-sunken px-3 text-sm text-ink focus:border-focus focus:outline-none h-10'

function fechaLarga(f) {
  const [a, m, d] = f.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

function textoPeriodo(r) {
  const [ai, mi, di] = r.inicio.split('-').map(Number)
  const [af, mf, df] = r.fin.split('-').map(Number)
  if (ai === af && mi === mf) return `${di} al ${df} de ${MESES[mi - 1]} de ${ai}`
  if (ai === af) return `${di} de ${MESES[mi - 1]} al ${df} de ${MESES[mf - 1]} de ${ai}`
  return `${fechaLarga(r.inicio)} al ${fechaLarga(r.fin)}`
}

function cutoffDe(id) {
  return id === 'ratas' ? BIO_RATAS.STOCK_ADULTOS_DIAS : BIO_RATONES.STOCK_ADULTOS_DIAS
}

export default function InformeDirectivo() {
  const { limpiarBioterio } = useBioterioActivo()

  const hoy = new Date()
  const mesInicial = hoy.getMonth() === 0
    ? { anio: hoy.getFullYear() - 1, mes: 11 }
    : { anio: hoy.getFullYear(), mes: hoy.getMonth() - 1 }
  const rangoInicial = rangoMes(mesInicial.anio, mesInicial.mes)

  const [modo, setModo]   = useState('mes')          // 'mes' | 'rango'
  const [anio, setAnio]   = useState(mesInicial.anio)
  const [mes, setMes]     = useState(mesInicial.mes)
  const [desde, setDesde] = useState(rangoInicial.inicio)
  const [hasta, setHasta] = useState(rangoInicial.fin)
  const [anexo, setAnexo] = useState(false)

  const errorRango = modo === 'rango' ? validarRango(desde, hasta) : null
  const rango = useMemo(() => {
    if (modo === 'mes') return rangoMes(anio, mes)
    return errorRango ? null : { inicio: desde, fin: hasta }
  }, [modo, anio, mes, desde, hasta, errorRango])

  const [datos, setDatos]       = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)
  const pedido = useRef(0)

  // Historial completo por colonia (las edades y el stock al cierre lo necesitan)
  // + incidentes, temperaturas y pedidos acotados al período en la consulta.
  const cargar = useCallback(async () => {
    if (!rango) return
    const nro = ++pedido.current
    setCargando(true)
    setError(null)
    try {
      const [porBio, inc, temp, ped, vCensos, vCompras, aCensos, aIngresos] = await Promise.all([
        Promise.all(IDS_BIOTERIOS.map(id => Promise.all([
          supabase.from('animales').select('id,codigo,sexo,estado,fecha_nacimiento,fecha_sacrificio,motivo_sacrificio,created_at,bioterio_id').eq('bioterio_id', id),
          supabase.from('camadas').select('id,id_madre,id_padre,bioterio_id,fecha_copula,fecha_separacion,fecha_nacimiento,fecha_destete,gestacion_real,total_crias,crias_machos,crias_hembras,total_destetados,crias_reducidas,failure_flag,failure_type,incluir_en_stock').eq('bioterio_id', id),
          supabase.from('jaulas').select('id,camada_id,total,machos,hembras').eq('bioterio_id', id),
          supabase.from('sacrificios').select('id,camada_id,animal_id,cantidad,fecha,categoria,notas').eq('bioterio_id', id),
          supabase.from('entregas').select('id,camada_id,animal_id,cantidad,machos,hembras,fecha,devuelta,grupo_investigacion,observaciones').eq('bioterio_id', id),
        ]))),
        supabase.from('incidentes').select('*').gte('fecha', rango.inicio).lte('fecha', rango.fin),
        supabase.from('temperature_logs').select('date,time,current_temp,min_temp,max_temp,bioterio_id').gte('date', rango.inicio).lte('date', rango.fin),
        supabase.from('pedidos').select('id,bioterio_id,cantidad,sexo,edad_semanas,fecha_entrega,solicitante,estado').gte('fecha_entrega', rango.inicio).lte('fecha_entrega', rango.fin),
        supabase.from('viruta_censos').select('fecha,bolsas'),
        supabase.from('viruta_compras').select('fecha,bolsas'),
        supabase.from('alimento_censos').select('fecha,stock_kg'),
        supabase.from('alimento_ingresos').select('fecha,kg'),
      ])
      if (nro !== pedido.current) return   // llegó tarde: el período ya cambió
      const fallo = [...porBio.flat(), inc, temp, ped].find(r => r.error)
      if (fallo) throw fallo.error
      const bds = {}
      IDS_BIOTERIOS.forEach((id, i) => {
        const [an, ca, ja, sa, en] = porBio[i].map(r => r.data ?? [])
        bds[id] = { animales: an, camadas: ca, jaulas: ja, sacrificios: sa, entregas: en }
      })
      setDatos({
        bds,
        incidentes: inc.data ?? [],
        temperaturas: temp.data ?? [],
        pedidos: ped.data ?? [],
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
      if (nro !== pedido.current) return
      console.error('Error informe directivo:', e)
      setError('No se pudo cargar la información. Verificá la conexión y probá de nuevo.')
    } finally {
      if (nro === pedido.current) setCargando(false)
    }
  }, [rango])

  useEffect(() => { cargar() }, [cargar])

  const informe = useMemo(() => {
    if (!datos || !rango) return null
    const animales = mapaAnimales(datos.bds)
    return {
      rango,
      apareamientos: detalleApareamientos(datos.bds, animales, rango),
      camadas:       detalleCamadas(datos.bds, animales, rango),
      incidentes:    detalleIncidentes(datos.incidentes, animales, rango),
      temperaturas:  resumenTemperaturas(datos.temperaturas, rango),
      entregas:      detalleEntregas(datos.bds, animales, rango),
      pedidos:       detallePedidos(datos.pedidos, rango),
      sacrificios:   detalleSacrificios(datos.bds, animales, rango),
      anexo: {
        stock: IDS_BIOTERIOS.map(id => ({ id, s: stockEnFecha(datos.bds[id], rango.fin, cutoffDe(id)) })),
        viruta: resumenInsumo(datos.viruta.censos, datos.viruta.ingresos, rango),
        alimento: resumenInsumo(datos.alimento.censos, datos.alimento.ingresos, rango),
      },
    }
  }, [datos, rango])

  const periodoTxt = rango ? textoPeriodo(rango) : ''

  function generarPDF() {
    // El nombre del archivo PDF sale del título del documento
    const tituloPrevio = document.title
    document.title = `Informe directivo ${rango.inicio} a ${rango.fin}`
    const restaurar = () => { document.title = tituloPrevio; window.removeEventListener('afterprint', restaurar) }
    window.addEventListener('afterprint', restaurar)
    window.print()
  }

  const listo = !cargando && !error && informe

  return (
    <div className="min-h-screen bg-canvas">
      <style>{CSS_DOCUMENTO}</style>

      <BarraGlobal
        titulo="Informe directivo"
        subtitulo={rango ? `Reporte del bioterio para la Dirección · ${periodoTxt}` : 'Reporte del bioterio para la Dirección'}
        onVolver={limpiarBioterio}
        onActualizar={cargar}
        actualizando={cargando}
        acciones={
          <Boton variante="primario" tamano="sm" onClick={generarPDF} disabled={!listo}>
            <FileDown size={15} /> Generar PDF
          </Boton>
        }
      />

      <div className="no-print mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <Panel className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-medium text-ink">Período a informar</span>
            {[{ id: 'mes', label: 'Mes completo' }, { id: 'rango', label: 'Rango personalizado' }].map(o => (
              <button key={o.id} type="button" onClick={() => setModo(o.id)} className="chip rounded-md border px-3 py-1.5 text-sm"
                style={modo === o.id
                  ? { background: 'var(--raised)', borderColor: 'var(--ink-faint)', color: 'var(--ink)' }
                  : { borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                {o.label}
              </button>
            ))}
          </div>

          {modo === 'mes' ? (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <Campo etiqueta="Mes">
                <select value={mes} onChange={e => setMes(Number(e.target.value))} className={control}>
                  {MESES_CAP.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Año">
                <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={control}>
                  {Array.from({ length: hoy.getFullYear() - 2023 }, (_, i) => hoy.getFullYear() - i).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Campo>
            </div>
          ) : (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <Campo etiqueta="Desde">
                <Entrada type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} />
              </Campo>
              <Campo etiqueta="Hasta (inclusive)">
                <Entrada type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} />
              </Campo>
            </div>
          )}

          {errorRango && <Aviso>{errorRango}</Aviso>}

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={anexo} onChange={e => setAnexo(e.target.checked)} />
            Agregar anexo: animales en la colonia al cierre y stock de viruta y alimento
          </label>

          {rango && (
            <p className="text-sm text-ink-soft">
              Se informa del <strong className="text-ink">{periodoTxt}</strong> ({diasDelRango(rango)} días). Cada actividad se cuenta por su propia fecha y solo si cae dentro del período.
              Al generar el PDF, elegí <strong className="text-ink">Guardar como PDF</strong> y tamaño <strong className="text-ink">A4</strong>.
            </p>
          )}
        </Panel>

        {error && <Aviso>{error}</Aviso>}
        {cargando && rango && <p className="text-sm text-ink-soft">Recopilando los registros del período…</p>}
      </div>

      {listo && (
        <div className="id-hoja-wrap px-2 pb-10 sm:px-6">
          <div className="id-hoja">
            <Documento informe={informe} periodoTxt={periodoTxt} anexo={anexo} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Documento
// ─────────────────────────────────────────────────────────────────────────────

export function Documento({ informe, periodoTxt, anexo }) {
  const { rango, apareamientos: ap, camadas: ca, incidentes: inc, temperaturas: temp, entregas: ent, pedidos: ped, sacrificios: sac } = informe
  const ahora = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const diasFuera = temp.reduce((s, t) => s + t.diasFueraDeRango, 0)
  const hayTemp = temp.some(t => t.registros > 0)

  return (
    <div className="id-doc">
      {/* Encabezado */}
      <div className="id-encabezado">
        <div style={{ flex: 1 }}>
          <div className="id-sobretitulo">ITeRatE Bioterio ISAL · Informe para la Dirección del Instituto</div>
          <div className="id-titulo">Informe directivo del bioterio</div>
          <div className="id-periodo">Período: {periodoTxt} · {diasDelRango(rango)} días</div>
          <div className="id-generado">Generado el {ahora} a partir de los registros del sistema</div>
        </div>
        <img src={iterateTitleLogoLight} alt="ITeRatE" className="id-logo" />
      </div>

      {/* Resumen */}
      <Seccion n="" titulo="Resumen del período">
        <div className="id-kpis">
          <Kpi v={fInt(ap.total)} l="Apareamientos" />
          <Kpi v={fInt(ca.totalPartos)} l="Partos" />
          <Kpi v={fInt(ca.criasNacidas)} l="Crías nacidas" d={ca.partosSinCantidad ? `${ca.partosSinCantidad} parto(s) sin cantidad` : null} />
          <Kpi v={fInt(ca.criasDestetadas)} l="Crías destetadas" d={`${fInt(ca.totalDestetes)} destete(s)`} />
          <Kpi v={fInt(inc.total)} l="Incidentes" d={inc.graves ? `${inc.graves} grave(s)` : null} />
          <Kpi v={hayTemp ? fInt(diasFuera) : 'Sin registros'} l={`Días fuera de ${RANGO_TEMP_OK.min}–${RANGO_TEMP_OK.max} °C`} />
          <Kpi v={fInt(ent.totalAnimales)} l="Animales entregados" d={`${fInt(ent.totalEntregas)} entrega(s) · ${fInt(ent.porGrupo.length)} grupo(s)`} />
          <Kpi v={fInt(sac.totalAnimales)} l="Animales sacrificados" d={sac.reproductores ? `${sac.reproductores} reproductor(es)` : null} />
        </div>
      </Seccion>

      {/* 1 · Apareamientos */}
      <Seccion n="1" titulo="Apareamientos">
        <Linea>
          {fInt(ap.total)} apareamiento(s) iniciados en el período
          {ap.total > 0 && <> · {ap.porColonia.map(c => `${coloniaLabel(c.clave)}: ${c.cantidad}`).join(' · ')}</>}
          {ap.total > 0 && <> · {fInt(ap.conParto)} ya con parto · {fInt(ap.fallidos)} con fallo registrado</>}
        </Linea>
        {ap.total === 0 ? <Vacio>No se registraron apareamientos (cópulas) en el período.</Vacio> : (
          <table className="id-tabla">
            <thead><tr><th>Fecha</th><th>Colonia</th><th>Hembra</th><th>Macho</th><th>Separación</th><th>Parto</th><th>Estado actual</th></tr></thead>
            <tbody>
              {ap.filas.map(f => (
                <tr key={f.id}>
                  <td>{fFecha(f.fecha)}</td><td>{coloniaLabel(f.colonia)}</td><td>{f.hembra}</td><td>{f.macho}</td>
                  <td>{f.separacion ? fFecha(f.separacion) : '—'}</td><td>{f.parto ? fFecha(f.parto) : '—'}</td><td>{f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Nota>Se cuenta cada apareamiento por su fecha de cópula. El estado es el que figura hoy en el sistema.</Nota>
      </Seccion>

      {/* 2 · Camadas */}
      <Seccion n="2" titulo="Camadas: nacimientos y destetes">
        <Sub titulo="2.1 Nacimientos del período" />
        <Linea>
          {fInt(ca.totalPartos)} parto(s) · {fInt(ca.criasNacidas)} crías nacidas
          {(ca.nacidosMachos + ca.nacidosHembras) > 0 && <> ({fInt(ca.nacidosMachos)} ♂ · {fInt(ca.nacidosHembras)} ♀ sexadas)</>}
          {ca.promedioCrias != null && <> · promedio {fDec1(ca.promedioCrias)} crías por camada</>}
        </Linea>
        {ca.totalPartos === 0 ? <Vacio>No se registraron partos en el período.</Vacio> : (
          <table className="id-tabla">
            <thead><tr><th>Fecha</th><th>Colonia</th><th>Madre</th><th>Padre</th><th className="n">Nacidas</th><th className="n">♂</th><th className="n">♀</th><th className="n">Gestación</th></tr></thead>
            <tbody>
              {ca.partos.map(p => (
                <tr key={p.id}>
                  <td>{fFecha(p.fecha)}</td><td>{coloniaLabel(p.colonia)}</td><td>{p.madre}</td><td>{p.padre}</td>
                  <td className="n">{p.nacidas == null ? SIN_REG : fInt(p.nacidas)}</td>
                  <td className="n">{nOrDash(p.machos)}</td><td className="n">{nOrDash(p.hembras)}</td>
                  <td className="n">{p.gestacion != null ? `${p.gestacion} d` : '—'}</td>
                </tr>
              ))}
              <tr className="total"><td colSpan={4}>Total</td><td className="n">{fInt(ca.criasNacidas)}</td><td className="n">{fInt(ca.nacidosMachos)}</td><td className="n">{fInt(ca.nacidosHembras)}</td><td /></tr>
            </tbody>
          </table>
        )}

        <Sub titulo="2.2 Destetes del período" />
        <Linea>
          {fInt(ca.totalDestetes)} destete(s) · {fInt(ca.criasDestetadas)} crías destetadas · {fInt(ca.perdidas)} pérdida(s) en lactancia
        </Linea>
        {ca.totalDestetes === 0 ? <Vacio>No se registraron destetes en el período.</Vacio> : (
          <table className="id-tabla">
            <thead><tr><th>Fecha</th><th>Colonia</th><th>Madre</th><th>Nacimiento</th><th className="n">Nacidas</th><th className="n">Reducidas</th><th className="n">Destetadas</th><th className="n">Pérdidas</th></tr></thead>
            <tbody>
              {ca.destetes.map(d => (
                <tr key={d.id}>
                  <td>{fFecha(d.fecha)}</td><td>{coloniaLabel(d.colonia)}</td><td>{d.madre}</td><td>{d.nacimiento ? fFecha(d.nacimiento) : '—'}</td>
                  <td className="n">{nOrDash(d.nacidas)}</td><td className="n">{d.reducidas ? fInt(d.reducidas) : '—'}</td>
                  <td className="n">{d.destetadas == null ? SIN_REG : fInt(d.destetadas)}</td><td className="n">{nOrDash(d.perdidas)}</td>
                </tr>
              ))}
              <tr className="total"><td colSpan={6}>Total</td><td className="n">{fInt(ca.criasDestetadas)}</td><td className="n">{fInt(ca.perdidas)}</td></tr>
            </tbody>
          </table>
        )}
        <Nota>Las camadas con fallo reproductivo no se cuentan como partos. Pérdidas = nacidas − reducidas por manejo − destetadas (la reducción no es mortalidad).</Nota>
      </Seccion>

      {/* 3 · Incidentes */}
      <Seccion n="3" titulo="Incidentes">
        <Linea>
          {fInt(inc.total)} incidente(s)
          {inc.total > 0 && <> · {fInt(inc.graves)} grave(s) · {fInt(inc.moderados)} moderado(s) · {fInt(inc.leves)} leve(s) · {fInt(inc.abiertos)} sin resolver</>}
        </Linea>
        {inc.total === 0 ? <Vacio>No se registraron incidentes en el período.</Vacio> : (
          <table className="id-tabla">
            <thead><tr><th>Fecha</th><th>Colonia</th><th>Categoría / tipo</th><th>Severidad</th><th>Animales</th><th style={{ width: '34%' }}>Descripción</th><th>Estado</th></tr></thead>
            <tbody>
              {inc.filas.map(f => (
                <tr key={f.id}>
                  <td>{fFecha(f.fecha)}</td><td>{f.colonia ? coloniaLabel(f.colonia) : '—'}</td>
                  <td>{f.categoria} · {f.tipo}</td><td>{f.severidad}</td><td>{f.animales || '—'}</td>
                  <td>{f.descripcion || '—'}{f.duracion ? ` (duración ${f.duracion} d)` : ''}</td>
                  <td>{f.resuelto ? 'Resuelto' : 'Abierto'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Seccion>

      {/* 4 · Temperaturas */}
      <Seccion n="4" titulo="Temperaturas">
        <table className="id-tabla">
          <thead><tr><th>Sala</th><th className="n">Registros</th><th className="n">Días con registro</th><th className="n">Promedio</th><th className="n">Mínima</th><th className="n">Máxima</th><th className="n">Días fuera de rango</th></tr></thead>
          <tbody>
            {temp.map(t => (
              <tr key={t.id}>
                <td>{t.label}</td><td className="n">{fInt(t.registros)}</td><td className="n">{fInt(t.diasConRegistro)} / {diasDelRango(rango)}</td>
                <td className="n">{fTemp(t.promedio)}</td><td className="n">{fTemp(t.minima)}</td><td className="n">{fTemp(t.maxima)}</td>
                <td className="n">{t.registros ? fInt(t.diasFueraDeRango) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hayTemp ? <TablaTemperaturaDiaria temp={temp} /> : <Vacio>No hay registros de temperatura en el período.</Vacio>}
        <Nota>Rango de referencia {RANGO_TEMP_OK.min}–{RANGO_TEMP_OK.max} °C. Por día: promedio de las lecturas y extremos entre lecturas y mín./máx. del termómetro. Los días marcados con * salieron del rango.</Nota>
      </Seccion>

      {/* 5 · Pedidos y entregas */}
      <Seccion n="5" titulo="Pedidos y entregas">
        <Sub titulo="5.1 Animales entregados por grupo de investigación" />
        <Linea>
          {fInt(ent.totalAnimales)} animales en {fInt(ent.totalEntregas)} entrega(s)
          {ent.devueltas > 0 && <> · no se cuentan {ent.devueltas} entrega(s) devuelta(s) al stock</>}
        </Linea>
        {ent.totalEntregas === 0 ? <Vacio>No se registraron entregas en el período.</Vacio> : (
          <>
            <table className="id-tabla">
              <thead><tr><th>Grupo receptor</th><th className="n">Entregas</th><th className="n">Animales</th><th>Por cepa</th></tr></thead>
              <tbody>
                {ent.porGrupo.map(g => (
                  <tr key={g.grupo}><td>{g.grupo}</td><td className="n">{fInt(g.entregas)}</td><td className="n"><strong>{fInt(g.animales)}</strong></td><td>{g.detalle}</td></tr>
                ))}
                <tr className="total"><td>Total</td><td className="n">{fInt(ent.totalEntregas)}</td><td className="n">{fInt(ent.totalAnimales)}</td><td /></tr>
              </tbody>
            </table>

            <Sub titulo="5.2 Detalle de cada entrega" />
            <table className="id-tabla">
              <thead><tr><th>Fecha</th><th>Grupo receptor</th><th>Especie</th><th>Cepa</th><th>Origen</th><th>Sexo</th><th>Edad</th><th>Categoría</th><th className="n">Cant.</th></tr></thead>
              <tbody>
                {ent.filas.map(f => (
                  <tr key={f.id}>
                    <td>{fFecha(f.fecha)}</td><td>{f.grupo}</td><td>{f.especie}</td><td>{f.cepa}</td><td>{f.tipo}</td>
                    <td>{f.sexo}</td><td>{f.edad}</td><td>{f.categoria}</td><td className="n"><strong>{fInt(f.cantidad)}</strong></td>
                  </tr>
                ))}
                <tr className="total"><td colSpan={8}>Total</td><td className="n">{fInt(ent.totalAnimales)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        <Sub titulo="5.3 Pedidos con entrega programada en el período" />
        {ped.total === 0 ? <Vacio>No hay pedidos con fecha de entrega en el período.</Vacio> : (
          <table className="id-tabla">
            <thead><tr><th>Entrega</th><th>Colonia</th><th>Solicitante</th><th className="n">Cant.</th><th>Sexo</th><th>Edad</th><th>Estado</th></tr></thead>
            <tbody>
              {ped.filas.map(p => (
                <tr key={p.id}>
                  <td>{fFecha(p.fecha)}</td><td>{p.colonia ? coloniaLabel(p.colonia) : '—'}</td><td>{p.solicitante}</td>
                  <td className="n">{nOrDash(p.cantidad)}</td><td>{p.sexo}</td><td>{p.edad}</td><td>{p.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Nota>El sexo se informa solo si quedó registrado en la entrega (reproductor individual o machos/hembras cargados); nunca se deduce de la camada. Edad y categoría al día de la entrega: cría &lt; 6 semanas, joven hasta 10 semanas (ratones) o 12 semanas (ratas), adulto después.</Nota>
      </Seccion>

      {/* 6 · Sacrificios */}
      <Seccion n="6" titulo="Sacrificios">
        <Linea>{fInt(sac.totalAnimales)} animales en {fInt(sac.totalRegistros)} registro(s)</Linea>
        {sac.totalRegistros === 0 ? <Vacio>No se registraron sacrificios en el período.</Vacio> : (
          <>
            <table className="id-tabla">
              <thead><tr><th>Colonia</th><th className="n">Registros</th><th className="n">De stock</th><th className="n">Reproductores</th><th className="n">Total</th></tr></thead>
              <tbody>
                {sac.porColonia.map(c => (
                  <tr key={c.colonia}><td>{coloniaLabel(c.colonia)}</td><td className="n">{fInt(c.registros)}</td><td className="n">{fInt(c.stock)}</td><td className="n">{fInt(c.reproductores)}</td><td className="n"><strong>{fInt(c.total)}</strong></td></tr>
                ))}
                <tr className="total"><td>Total</td><td className="n">{fInt(sac.totalRegistros)}</td><td className="n">{fInt(sac.totalAnimales - sac.reproductores)}</td><td className="n">{fInt(sac.reproductores)}</td><td className="n">{fInt(sac.totalAnimales)}</td></tr>
              </tbody>
            </table>
            <Sub titulo="Detalle" />
            <table className="id-tabla">
              <thead><tr><th>Fecha</th><th>Colonia</th><th>Categoría</th><th className="n">Cant.</th><th style={{ width: '40%' }}>Motivo / notas</th></tr></thead>
              <tbody>
                {sac.filas.map(f => (
                  <tr key={f.id}><td>{fFecha(f.fecha)}</td><td>{coloniaLabel(f.colonia)}</td><td>{f.categoria}</td><td className="n">{fInt(f.cantidad)}</td><td>{f.motivo || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Seccion>

      {anexo && <Anexo anexo={informe.anexo} />}

      {/* Firma y pie */}
      <div className="id-firmas">
        <div><div className="id-firma-linea" />Responsable del bioterio</div>
        <div><div className="id-firma-linea" />Recibido por la Dirección</div>
      </div>
      <div className="id-pie">
        <span>ITeRatE Bioterio ISAL · Informe directivo</span>
        <span>{fFecha(rango.inicio)} – {fFecha(rango.fin)} · Documento de uso interno</span>
      </div>
    </div>
  )
}

function TablaTemperaturaDiaria({ temp }) {
  const fechas = [...new Set(temp.flatMap(t => t.dias.map(d => d.fecha)))].sort()
  const porSala = Object.fromEntries(temp.map(t => [t.id, new Map(t.dias.map(d => [d.fecha, d]))]))
  const celdas = (d) => d
    ? [<td key="p" className="n">{fTemp(d.actual)}</td>, <td key="mi" className="n">{fTemp(d.min)}</td>, <td key="ma" className="n">{fTemp(d.max)}{d.fuera ? ' *' : ''}</td>]
    : [<td key="p" className="n">—</td>, <td key="mi" className="n">—</td>, <td key="ma" className="n">—</td>]
  return (
    <>
      <Sub titulo="Registro diario" />
      <table className="id-tabla id-tabla-compacta">
        <thead>
          <tr><th rowSpan={2}>Fecha</th>{temp.map(t => <th key={t.id} colSpan={3} className="c">{t.label}</th>)}</tr>
          <tr>{temp.map(t => [<th key={`${t.id}p`} className="n">Prom.</th>, <th key={`${t.id}mi`} className="n">Mín.</th>, <th key={`${t.id}ma`} className="n">Máx.</th>])}</tr>
        </thead>
        <tbody>
          {fechas.map(f => (
            <tr key={f}><td>{fFecha(f)}</td>{temp.map(t => celdas(porSala[t.id].get(f)))}</tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Anexo({ anexo }) {
  const total = anexo.stock.reduce((s, x) => s + x.s.totalAnimales, 0)
  const insumo = (nombre, d, unidad, fmt) => (
    <tr>
      <td>{nombre}</td>
      <td className="n">{d.stockCierre != null ? `${fmt(d.stockCierre)} ${unidad}` : 'Sin datos suficientes'}</td>
      <td className="n">{d.hayIngresos ? `${fmt(d.ingresosPeriodo)} ${unidad}` : '—'}</td>
      <td className="n">{d.consumo != null ? `${fmt(d.consumo)} ${unidad}` : 'Sin datos suficientes'}</td>
      <td>{d.consumo != null ? `censos del ${fFecha(d.medidaDesde)} al ${fFecha(d.medidaHasta)}` : 'faltan dos censos que acoten el período'}</td>
    </tr>
  )
  return (
    <Seccion n="Anexo" titulo="Colonia e insumos al cierre del período">
      <table className="id-tabla">
        <thead><tr><th>Colonia</th><th className="n">Reproductores</th><th className="n">Stock</th><th className="n">Total animales</th></tr></thead>
        <tbody>
          {anexo.stock.map(({ id, s }) => (
            <tr key={id}><td>{coloniaLabel(id)}</td><td className="n">{fInt(s.totalRepro)}</td><td className="n">{fInt(s.totalStock)}</td><td className="n"><strong>{fInt(s.totalAnimales)}</strong></td></tr>
          ))}
          <tr className="total"><td colSpan={3}>Total</td><td className="n">{fInt(total)}</td></tr>
        </tbody>
      </table>
      <table className="id-tabla" style={{ marginTop: '6pt' }}>
        <thead><tr><th>Insumo</th><th className="n">Stock al cierre</th><th className="n">Ingresos</th><th className="n">Consumo medido</th><th>Medición</th></tr></thead>
        <tbody>
          {insumo('Viruta', anexo.viruta, 'bolsas', fInt)}
          {insumo('Alimento', anexo.alimento, 'kg', fDec1)}
        </tbody>
      </table>
      <Nota>Animales reconstruidos a la fecha de cierre desde los registros. Consumo medido por diferencia entre censos; sin censos suficientes no se estima.</Nota>
    </Seccion>
  )
}

function Seccion({ n, titulo, children }) {
  return (
    <section className="id-seccion">
      <h2 className="id-h2">{n && <span className="id-num">{n}</span>}{titulo}</h2>
      {children}
    </section>
  )
}
const Sub   = ({ titulo }) => <h3 className="id-h3">{titulo}</h3>
const Linea = ({ children }) => <p className="id-linea">{children}</p>
const Vacio = ({ children }) => <p className="id-vacio">{children}</p>
const Nota  = ({ children }) => <p className="id-nota">{children}</p>
function Kpi({ v, l, d }) {
  return (
    <div className="id-kpi">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
      {d && <div className="d">{d}</div>}
    </div>
  )
}

// Estilos del documento: hoja blanca en pantalla (vista previa) y A4 al imprimir.
export const CSS_DOCUMENTO = `
  .id-hoja { max-width: 210mm; margin: 0 auto; background: #fff; color: #111; padding: 14mm 12mm; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
  .id-doc { font-family: 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif; font-size: 9pt; line-height: 1.45; color: #111; }
  .id-doc * { text-transform: none; }
  .id-encabezado { display: flex; gap: 12pt; align-items: flex-start; border-bottom: 2pt solid #111; padding-bottom: 9pt; margin-bottom: 10pt; }
  .id-sobretitulo { font-size: 7.5pt; letter-spacing: .3pt; color: #555; }
  .id-titulo { font-size: 17pt; font-weight: 800; letter-spacing: -.2pt; margin: 1pt 0 2pt; }
  .id-periodo { font-size: 10pt; font-weight: 600; }
  .id-generado { font-size: 7.5pt; color: #666; }
  .id-logo { height: 46pt; width: auto; flex-shrink: 0; }
  .id-seccion { margin-bottom: 11pt; }
  .id-h2 { font-size: 10.5pt; font-weight: 800; background: #eef2f6; border-left: 4pt solid #1e3352; padding: 3.5pt 8pt; margin: 0 0 5pt; display: flex; gap: 6pt; break-after: avoid; page-break-after: avoid; }
  .id-num { color: #1e3352; }
  .id-h3 { font-size: 8.5pt; font-weight: 700; color: #333; margin: 7pt 0 3pt; border-bottom: .5pt solid #ccc; padding-bottom: 1.5pt; break-after: avoid; page-break-after: avoid; }
  .id-linea { font-size: 8.5pt; margin: 0 0 4pt; }
  .id-vacio { font-size: 8.5pt; color: #777; font-style: italic; margin: 2pt 0 4pt; }
  .id-nota { font-size: 7pt; color: #666; margin: 3pt 0 0; }
  .id-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5pt; }
  .id-kpi { border: .75pt solid #d5d9de; border-radius: 3pt; padding: 5pt 4pt; text-align: center; background: #fafbfc; break-inside: avoid; }
  .id-kpi .v { font-size: 13pt; font-weight: 800; line-height: 1.15; }
  .id-kpi .l { font-size: 7pt; color: #555; margin-top: 1pt; }
  .id-kpi .d { font-size: 6.5pt; color: #888; }
  .id-tabla { width: 100%; border-collapse: collapse; font-size: 8pt; }
  .id-tabla th { background: #eef0f2; text-align: left; font-weight: 700; padding: 2.5pt 4pt; border-bottom: 1pt solid #999; }
  .id-tabla td { padding: 2.5pt 4pt; border-bottom: .5pt solid #e2e2e2; vertical-align: top; }
  .id-tabla tr:nth-child(even) td { background: #f8f9fa; }
  .id-tabla .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .id-tabla .c { text-align: center; }
  .id-tabla tr.total td { font-weight: 800; background: #eef0f2; border-top: 1pt solid #999; }
  .id-tabla thead { display: table-header-group; }
  .id-tabla tr { break-inside: avoid; page-break-inside: avoid; }
  .id-tabla-compacta td, .id-tabla-compacta th { padding: 1.5pt 4pt; font-size: 7.5pt; }
  .id-firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 30pt; margin-top: 28pt; font-size: 8pt; color: #444; text-align: center; break-inside: avoid; }
  .id-firma-linea { border-top: .75pt solid #555; margin: 0 10pt 3pt; height: 0; }
  .id-pie { display: flex; justify-content: space-between; border-top: .5pt solid #bbb; margin-top: 12pt; padding-top: 4pt; font-size: 7pt; color: #888; }
  @media print {
    @page { size: A4 portrait; margin: 12mm 11mm 13mm 12mm; }
    * { visibility: hidden !important; }
    .id-hoja, .id-hoja * { visibility: visible !important; }
    .id-hoja-wrap { padding: 0 !important; }
    .id-hoja { position: absolute; top: 0; left: 0; width: 100%; max-width: none; padding: 0; box-shadow: none; border-radius: 0; }
    .id-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`
