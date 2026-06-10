import { createContext, useContext, useEffect, useReducer, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { generarId } from '../utils/storage'
import { inicializarDB } from '../utils/db'
import { hoy } from '../utils/calculos'
import { useBioterioActivo } from './BioterioActivoContext'

// ─── Reducer ─────────────────────────────────────────────────────────────────
function reducer(estado, accion) {
  switch (accion.type) {
    case 'SET_ANIMALES':         return { ...estado, animales: accion.payload }
    case 'SET_CAMADAS':          return { ...estado, camadas: accion.payload }
    case 'SET_SACRIFICIOS':      return { ...estado, sacrificios: accion.payload }
    case 'SET_ENTREGAS':         return { ...estado, entregas: accion.payload }
    case 'SET_JAULAS':           return { ...estado, jaulas: accion.payload }
    case 'SET_TEMPERATURAS':     return { ...estado, temperaturas: accion.payload }
    case 'SET_INCIDENTES':       return { ...estado, incidentes: accion.payload }
    case 'SET_EXTENDIDOS':       return { ...estado, extendidos: accion.payload }

    // Animales exportados desde BAL/C y C57 hacia Híbridos
    case 'SET_ANIMALES_EXPORTADOS':   return { ...estado, animalesExportados: accion.payload }
    case 'SET_CAMADAS_F1':            return { ...estado, camadasF1: accion.payload }
    case 'AGREGAR_ANIMAL_EXPORTADO':  return { ...estado, animalesExportados: [...estado.animalesExportados, accion.payload] }
    case 'REMOVER_ANIMAL_EXPORTADO':  return { ...estado, animalesExportados: estado.animalesExportados.filter((a) => a.id !== accion.payload) }
    case 'EDITAR_ANIMAL_EXPORTADO':   return { ...estado, animalesExportados: estado.animalesExportados.map((a) => a.id === accion.payload.id ? accion.payload : a) }

    case 'AGREGAR_EXTENDIDO': {
      const lista = estado.extendidos.filter((e) => !(e.animal_id === accion.payload.animal_id && e.fecha === accion.payload.fecha))
      lista.push(accion.payload)
      lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
      return { ...estado, extendidos: lista }
    }
    case 'EDITAR_EXTENDIDO':   return { ...estado, extendidos: estado.extendidos.map((e) => e.id === accion.payload.id ? accion.payload : e) }
    case 'ELIMINAR_EXTENDIDO': return { ...estado, extendidos: estado.extendidos.filter((e) => e.id !== accion.payload) }

    case 'AGREGAR_ANIMAL': {
      const lista = [...estado.animales, accion.payload]
      lista.sort((a, b) => (a.fecha_nacimiento ?? '').localeCompare(b.fecha_nacimiento ?? ''))
      return { ...estado, animales: lista }
    }
    case 'EDITAR_ANIMAL':   return { ...estado, animales: estado.animales.map((a) => a.id === accion.payload.id ? accion.payload : a) }
    case 'ELIMINAR_ANIMAL': return { ...estado, animales: estado.animales.filter((a) => a.id !== accion.payload) }

    case 'AGREGAR_CAMADA': {
      const lista = [...estado.camadas, accion.payload]
      lista.sort((a, b) => (a.fecha_copula ?? '').localeCompare(b.fecha_copula ?? ''))
      return { ...estado, camadas: lista }
    }
    case 'EDITAR_CAMADA':   return { ...estado, camadas: estado.camadas.map((c) => c.id === accion.payload.id ? accion.payload : c) }
    case 'ELIMINAR_CAMADA': return { ...estado, camadas: estado.camadas.filter((c) => c.id !== accion.payload) }

    case 'AGREGAR_SACRIFICIO': {
      const lista = [...estado.sacrificios, accion.payload]
      lista.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
      return { ...estado, sacrificios: lista }
    }
    case 'ELIMINAR_SACRIFICIO': return { ...estado, sacrificios: estado.sacrificios.filter((s) => s.id !== accion.payload) }

    case 'AGREGAR_ENTREGA': {
      const lista = [...estado.entregas, accion.payload]
      lista.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
      return { ...estado, entregas: lista }
    }
    case 'ELIMINAR_ENTREGA': return { ...estado, entregas: estado.entregas.filter((e) => e.id !== accion.payload) }

    case 'AGREGAR_JAULA':   return { ...estado, jaulas: [...estado.jaulas, accion.payload] }
    case 'EDITAR_JAULA':    return { ...estado, jaulas: estado.jaulas.map((j) => j.id === accion.payload.id ? accion.payload : j) }
    case 'ELIMINAR_JAULA':  return { ...estado, jaulas: estado.jaulas.filter((j) => j.id !== accion.payload) }

    case 'AGREGAR_TEMPERATURA':          return { ...estado, temperaturas: [...estado.temperaturas, accion.payload] }
    case 'ELIMINAR_TEMPERATURA':         return { ...estado, temperaturas: estado.temperaturas.filter((t) => t.id !== accion.payload) }
    case 'ELIMINAR_TEMPERATURAS_MES':    return { ...estado, temperaturas: estado.temperaturas.filter((t) => !(t.date?.startsWith(accion.payload))) }

    case 'AGREGAR_INCIDENTE': {
      const lista = [...estado.incidentes, accion.payload]
      lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
      return { ...estado, incidentes: lista }
    }
    case 'EDITAR_INCIDENTE':   return { ...estado, incidentes: estado.incidentes.map((i) => i.id === accion.payload.id ? accion.payload : i) }
    case 'ELIMINAR_INCIDENTE': return { ...estado, incidentes: estado.incidentes.filter((i) => i.id !== accion.payload) }

    case 'SET_PEDIDOS':      return { ...estado, pedidos: accion.payload }
    case 'AGREGAR_PEDIDO': {
      const lista = [accion.payload, ...estado.pedidos]
      return { ...estado, pedidos: lista }
    }
    case 'EDITAR_PEDIDO':   return { ...estado, pedidos: estado.pedidos.map((p) => p.id === accion.payload.id ? accion.payload : p) }
    case 'ELIMINAR_PEDIDO': return { ...estado, pedidos: estado.pedidos.filter((p) => p.id !== accion.payload) }

    default: return estado
  }
}

const BiotheriumCtx = createContext(null)

export function BiotheriumProvider({ children }) {
  const { bioterioActivo, bio } = useBioterioActivo()
  const [estado, dispatch] = useReducer(reducer, { animales: [], animalesExportados: [], camadas: [], camadasF1: [], sacrificios: [], entregas: [], jaulas: [], temperaturas: [], incidentes: [], extendidos: [], pedidos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  // ── Cargar notas / planes / reservas desde Supabase al iniciar ───────────
  useEffect(() => { inicializarDB() }, [])

  // ── Cargar datos al iniciar (o al cambiar de bioterio) ────────────────────
  useEffect(() => {
    if (!bioterioActivo) return
    async function cargarDatos() {
      setCargando(true)
      setError(null)
      // Limpiar estado anterior antes de cargar el nuevo bioterio
      dispatch({ type: 'SET_ANIMALES',             payload: [] })
      dispatch({ type: 'SET_ANIMALES_EXPORTADOS',  payload: [] })
      dispatch({ type: 'SET_CAMADAS',              payload: [] })
      dispatch({ type: 'SET_CAMADAS_F1',           payload: [] })
      dispatch({ type: 'SET_SACRIFICIOS',          payload: [] })
      dispatch({ type: 'SET_ENTREGAS',             payload: [] })
      dispatch({ type: 'SET_JAULAS',               payload: [] })
      dispatch({ type: 'SET_TEMPERATURAS',         payload: [] })
      dispatch({ type: 'SET_INCIDENTES',           payload: [] })
      dispatch({ type: 'SET_EXTENDIDOS',           payload: [] })
      try {
        const [{ data: animales, error: errA }, { data: camadas, error: errC }, { data: sacrificios }, { data: entregas }, { data: jaulas }, { data: temperaturas }, { data: incidentes }, { data: extendidos }, { data: pedidos }] = await Promise.all([
          supabase.from('animales').select('*').eq('bioterio_id', bioterioActivo).order('fecha_nacimiento', { ascending: true }),
          supabase.from('camadas').select('*').eq('bioterio_id', bioterioActivo).order('fecha_copula', { ascending: true }),
          supabase.from('sacrificios').select('*').eq('bioterio_id', bioterioActivo).order('fecha', { ascending: true }),
          supabase.from('entregas').select('*').eq('bioterio_id', bioterioActivo).order('fecha', { ascending: true }),
          supabase.from('jaulas').select('*').eq('bioterio_id', bioterioActivo).order('created_at', { ascending: true }),
          supabase.from('temperature_logs').select('*').eq('bioterio_id', bioterioActivo).order('date', { ascending: false }).order('time', { ascending: false }),
          supabase.from('incidentes').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('extendidos').select('*').eq('bioterio_id', bioterioActivo).order('fecha', { ascending: true }),
          supabase.from('pedidos').select('*').order('created_at', { ascending: false }),
        ])
        if (errA) throw errA
        if (errC) throw errC
        dispatch({ type: 'SET_ANIMALES', payload: animales ?? [] })
        dispatch({ type: 'SET_CAMADAS', payload: camadas ?? [] })
        dispatch({ type: 'SET_SACRIFICIOS', payload: sacrificios ?? [] })
        dispatch({ type: 'SET_ENTREGAS', payload: entregas ?? [] })
        dispatch({ type: 'SET_JAULAS', payload: jaulas ?? [] })
        dispatch({ type: 'SET_TEMPERATURAS', payload: temperaturas ?? [] })
        dispatch({ type: 'SET_INCIDENTES', payload: incidentes ?? [] })
        dispatch({ type: 'SET_EXTENDIDOS', payload: extendidos ?? [] })
        dispatch({ type: 'SET_PEDIDOS', payload: (pedidos ?? []).map(_pedidoFromDb) })

        // Cuando el bioterio activo es Híbridos, cargar también los animales
        // de BAL/C y C57 que fueron marcados como exportados
        if (bioterioActivo === 'ratones_hibridos') {
          const { data: exportados } = await supabase
            .from('animales')
            .select('*')
            .in('bioterio_id', ['ratones_balbc', 'ratones_c57'])
            .eq('exportado_hibridos', true)
            .order('fecha_nacimiento', { ascending: true })
          dispatch({ type: 'SET_ANIMALES_EXPORTADOS', payload: exportados ?? [] })
        }

        // Cuando el bioterio activo es BAL/C o C57, también traer las camadas F1
        // registradas en Híbridos donde esos animales aparecen como padre o madre.
        // Se guardan en camadasF1 (separadas) para que Rendimiento y Estadísticas
        // puedan usarlas, sin que aparezcan como bloques de stock en BAL/C ni C57.
        if (['ratones_balbc', 'ratones_c57'].includes(bioterioActivo)) {
          const exportados = (animales ?? []).filter((a) => a.exportado_hibridos)
          if (exportados.length > 0) {
            const exportadoIds = new Set(exportados.map((a) => a.id))
            const { data: camadasHib } = await supabase
              .from('camadas')
              .select('*')
              .eq('bioterio_id', 'ratones_hibridos')
              .order('fecha_copula', { ascending: true })
            const relevantes = (camadasHib ?? []).filter(
              (c) => exportadoIds.has(c.id_padre) || exportadoIds.has(c.id_madre)
            )
            dispatch({ type: 'SET_CAMADAS_F1', payload: relevantes })
          }
        }
      } catch (e) {
        console.error('Error al cargar datos:', e)
        setError('No se pudieron cargar los datos. Verificá la conexión.')
      } finally {
        setCargando(false)
      }
    }
    cargarDatos()
  }, [bioterioActivo])

  // ── Realtime — sincronización en vivo con otros usuarios ──────────────────
  // Cuando otro usuario hace un cambio, re-carga solo la tabla afectada.
  // Los cambios propios ya aplican optimísticamente, el re-fetch los confirma.

  const recargarTabla = useCallback(async (tabla) => {
    const consultas = {
      animales:         () => supabase.from('animales').select('*').eq('bioterio_id', bioterioActivo).order('fecha_nacimiento', { ascending: true }),
      camadas:          () => supabase.from('camadas').select('*').eq('bioterio_id', bioterioActivo).order('fecha_copula', { ascending: true }),
      jaulas:           () => supabase.from('jaulas').select('*').eq('bioterio_id', bioterioActivo).order('created_at', { ascending: true }),
      sacrificios:      () => supabase.from('sacrificios').select('*').eq('bioterio_id', bioterioActivo).order('fecha', { ascending: true }),
      entregas:         () => supabase.from('entregas').select('*').eq('bioterio_id', bioterioActivo).order('fecha', { ascending: true }),
      temperature_logs: () => supabase.from('temperature_logs').select('*').eq('bioterio_id', bioterioActivo).order('date', { ascending: false }).order('time', { ascending: false }),
      incidentes:       () => supabase.from('incidentes').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      extendidos:       () => supabase.from('extendidos').select('*').eq('bioterio_id', bioterioActivo).order('fecha', { ascending: true }),
    }
    const acciones = {
      animales:         'SET_ANIMALES',
      camadas:          'SET_CAMADAS',
      jaulas:           'SET_JAULAS',
      sacrificios:      'SET_SACRIFICIOS',
      entregas:         'SET_ENTREGAS',
      temperature_logs: 'SET_TEMPERATURAS',
      incidentes:       'SET_INCIDENTES',
      extendidos:       'SET_EXTENDIDOS',
    }
    const query  = consultas[tabla]
    const accion = acciones[tabla]
    if (!query || !accion) return
    const { data } = await query()
    if (data) dispatch({ type: accion, payload: data })
  }, [bioterioActivo])

  useEffect(() => {
    if (!bioterioActivo) return

    const ch = supabase
      .channel(`rt_${bioterioActivo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animales',         filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('animales'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camadas',          filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('camadas'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jaulas',           filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('jaulas'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sacrificios',      filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('sacrificios'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas',         filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('entregas'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'temperature_logs', filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('temperature_logs'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidentes',       filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('incidentes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extendidos',       filter: `bioterio_id=eq.${bioterioActivo}` }, () => recargarTabla('extendidos'))
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [bioterioActivo, recargarTabla])

  // ── ANIMALES ───────────────────────────────────────────────────────────────

  async function agregarAnimal(datos) {
    const nuevo = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_ANIMAL', payload: nuevo })
    const { error } = await supabase.from('animales').insert(nuevo)
    if (error) {
      console.error('Error al guardar animal:', error)
      dispatch({ type: 'ELIMINAR_ANIMAL', payload: nuevo.id })
    }
  }

  async function editarAnimal(datos) {
    dispatch({ type: 'EDITAR_ANIMAL', payload: datos })
    const { error } = await supabase.from('animales').update(datos).eq('id', datos.id)
    if (error) console.error('Error al editar animal:', error)
  }

  async function eliminarAnimal(id) {
    const respaldo = estado.animales.find((a) => a.id === id)
    dispatch({ type: 'ELIMINAR_ANIMAL', payload: id })
    const { error } = await supabase.from('animales').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar animal:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_ANIMAL', payload: respaldo })
    }
  }

  // ── JAULAS (declaradas antes de editarCamada para poder ser llamadas desde ahí) ──

  async function agregarJaula(datos) {
    const nueva = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_JAULA', payload: nueva })
    const { error } = await supabase.from('jaulas').insert(nueva)
    if (error) {
      console.error('Error al guardar jaula:', error)
      dispatch({ type: 'ELIMINAR_JAULA', payload: nueva.id })
    }
  }

  async function editarJaula(datos) {
    dispatch({ type: 'EDITAR_JAULA', payload: datos })
    const { error } = await supabase.from('jaulas').update(datos).eq('id', datos.id)
    if (error) console.error('Error al editar jaula:', error)
  }

  async function eliminarJaula(id) {
    const respaldo = estado.jaulas.find((j) => j.id === id)
    dispatch({ type: 'ELIMINAR_JAULA', payload: id })
    const { error } = await supabase.from('jaulas').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar jaula:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_JAULA', payload: respaldo })
    }
  }

  // ── CAMADAS ────────────────────────────────────────────────────────────────

  async function agregarCamada(datos) {
    const nueva = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_CAMADA', payload: nueva })
    const { error } = await supabase.from('camadas').insert(nueva)
    if (error) {
      console.error('Error al guardar camada:', error)
      dispatch({ type: 'ELIMINAR_CAMADA', payload: nueva.id })
      return
    }
    // Setear el estado de la hembra según el progreso real de la camada creada
    // (si ya tiene separación/parto/destete registrados — ej: carga histórica)
    if (datos.id_madre) {
      const madrePropia      = estado.animales.find((a) => a.id === datos.id_madre)
      const madreExportada   = estado.animalesExportados.find((a) => a.id === datos.id_madre)
      const madre            = madrePropia ?? madreExportada
      if (madre && ['activo', 'en_apareamiento', 'en_cria'].includes(madre.estado)) {
        const estadoMadre = datos.fecha_destete ? 'activo'
          : (datos.fecha_separacion || datos.fecha_nacimiento) ? 'en_cria'
          : 'en_apareamiento'
        if (madre.estado !== estadoMadre) {
          const madreActualizada = { ...madre, estado: estadoMadre }
          dispatch({ type: madrePropia ? 'EDITAR_ANIMAL' : 'EDITAR_ANIMAL_EXPORTADO', payload: madreActualizada })
          const { error: errA } = await supabase.from('animales').update({ estado: estadoMadre }).eq('id', datos.id_madre)
          if (errA) console.error('Error al actualizar estado de madre:', errA)
        }
      }
    }
  }

  async function confirmarSeparacion(camadaId, fechaSeparacion) {
    const camada = estado.camadas.find((c) => c.id === camadaId)
    if (!camada) return
    const camadaActualizada = { ...camada, fecha_separacion: fechaSeparacion }
    dispatch({ type: 'EDITAR_CAMADA', payload: camadaActualizada })
    const { error: errC } = await supabase.from('camadas').update({ fecha_separacion: fechaSeparacion }).eq('id', camadaId)
    if (errC) console.error('Error al confirmar separación:', errC)
    // Cambiar la hembra a 'en_cria' si estaba 'en_apareamiento'
    // Buscar en animales propios y también en exportados (para Híbridos)
    if (camada.id_madre) {
      const madrePropia    = estado.animales.find((a) => a.id === camada.id_madre)
      const madreExportada = estado.animalesExportados.find((a) => a.id === camada.id_madre)
      const madre          = madrePropia ?? madreExportada
      if (madre && madre.estado === 'en_apareamiento') {
        const madreActualizada = { ...madre, estado: 'en_cria' }
        dispatch({ type: madrePropia ? 'EDITAR_ANIMAL' : 'EDITAR_ANIMAL_EXPORTADO', payload: madreActualizada })
        const { error: errA } = await supabase.from('animales').update({ estado: 'en_cria' }).eq('id', camada.id_madre)
        if (errA) console.error('Error al actualizar estado de madre:', errA)
      }
    }
  }

  async function editarCamada(datos) {
    const antigua = estado.camadas.find((c) => c.id === datos.id)
    dispatch({ type: 'EDITAR_CAMADA', payload: datos })
    // Solo mandamos las columnas reales de la DB (sin id ni campos computados como rango, latencia, estado, etc.)
    // || null convierte strings vacíos ("") a null además de undefined/null
    const datosDB = {
      id_madre: datos.id_madre || null,
      id_padre: datos.id_padre || null,
      fecha_copula: datos.fecha_copula || null,
      fecha_separacion: datos.fecha_separacion || null,
      fecha_nacimiento: datos.fecha_nacimiento || null,
      fecha_destete: datos.fecha_destete || null,
      gestacion_real: datos.gestacion_real != null && datos.gestacion_real !== '' ? Number(datos.gestacion_real) : null,
      total_crias: datos.total_crias != null && datos.total_crias !== '' ? Number(datos.total_crias) : null,
      crias_machos: datos.crias_machos != null && datos.crias_machos !== '' ? Number(datos.crias_machos) : null,
      crias_hembras: datos.crias_hembras != null && datos.crias_hembras !== '' ? Number(datos.crias_hembras) : null,
      total_destetados: datos.total_destetados != null && datos.total_destetados !== '' ? Number(datos.total_destetados) : null,
      failure_flag: Boolean(datos.failure_flag),
      failure_type: datos.failure_type || null,
      notas: datos.notas || null,
      incluir_en_stock: datos.incluir_en_stock !== false,
    }
    const { error } = await supabase.from('camadas').update(datosDB).eq('id', datos.id)
    if (error) {
      console.error('Error al editar camada — mensaje:', error.message, '| detalle:', error.details, '| hint:', error.hint)
      if (antigua) dispatch({ type: 'EDITAR_CAMADA', payload: antigua })
      return
    }

    const stockActivado   = datos.incluir_en_stock !== false && antigua?.incluir_en_stock === false
    const stockDesactivado = datos.incluir_en_stock === false && antigua?.incluir_en_stock !== false

    // Si se desactiva el stock → eliminar jaulas existentes de esta camada
    if (stockDesactivado) {
      const jaulasCamada = estado.jaulas.filter((j) => j.camada_id === datos.id)
      for (const jaula of jaulasCamada) {
        await eliminarJaula(jaula.id)
      }
    }

    // Auto-crear jaula cuando se registra el destete por primera vez Y stock activo
    // O cuando se reactiva el stock en una camada que ya tiene destete
    const desteteNuevo = datos.fecha_destete && !antigua?.fecha_destete
    if ((desteteNuevo || stockActivado) && datos.incluir_en_stock !== false && datos.fecha_destete) {
      const jaulaExiste = estado.jaulas.some((j) => j.camada_id === datos.id)
      if (!jaulaExiste) {
        const total = datos.total_destetados ?? datos.total_crias ?? 0
        if (total > 0) {
          await agregarJaula({
            camada_id: datos.id,
            total,
            machos: datos.crias_machos ?? null,
            hembras: datos.crias_hembras ?? null,
            notas: '',
          })
        }
      }
    }

    // ── Reconciliar estado de la madre con el progreso real de la camada ───────
    // Enfoque: calcular qué estado DEBERÍA tener la madre y corregirlo si no
    // coincide. Esto garantiza que cualquier edición de la camada sincronice
    // automáticamente el estado de la hembra, incluso si la separación/parto
    // ya estaba registrada desde antes (evita hembras atascadas en en_apareamiento).
    const madreId = datos.id_madre
    if (madreId) {
      const madrePropia    = estado.animales.find((a) => a.id === madreId)
      const madreExportada = estado.animalesExportados.find((a) => a.id === madreId)
      const madre          = madrePropia ?? madreExportada

      if (madre && ['activo', 'en_apareamiento', 'en_cria'].includes(madre.estado)) {
        const tipoDispatch = madrePropia ? 'EDITAR_ANIMAL' : 'EDITAR_ANIMAL_EXPORTADO'

        // Estado esperado según el progreso de la camada:
        // destete → activo | separación o parto → en_cria | solo cópula → en_apareamiento
        const estadoEsperado = datos.fecha_destete                            ? 'activo'
          : (datos.fecha_separacion || datos.fecha_nacimiento) ? 'en_cria'
          : datos.fecha_copula                                  ? 'en_apareamiento'
          : null

        if (estadoEsperado && madre.estado !== estadoEsperado) {
          const actualizada = { ...madre, estado: estadoEsperado }
          dispatch({ type: tipoDispatch, payload: actualizada })
          const { error: errA } = await supabase.from('animales').update({ estado: estadoEsperado }).eq('id', madreId)
          if (errA) console.error('Error al actualizar estado de madre:', errA)
        }
      }
    }
  }

  async function eliminarCamada(id) {
    const respaldo = estado.camadas.find((c) => c.id === id)
    dispatch({ type: 'ELIMINAR_CAMADA', payload: id })
    const { error } = await supabase.from('camadas').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar camada:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_CAMADA', payload: respaldo })
    }
  }

  // ── SACRIFICIOS ────────────────────────────────────────────────────────────

  async function registrarSacrificio(datos) {
    const nuevo = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_SACRIFICIO', payload: nuevo })
    const { error } = await supabase.from('sacrificios').insert(nuevo)
    if (error) {
      console.error('Error al registrar sacrificio:', error)
      dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: nuevo.id })
      throw error
    }
  }

  // Sacrificio de animales reproductores (actualiza estado + graba en tabla sacrificios)
  async function sacrificarReproductor(animal, fecha, motivo) {
    const actualizado = { ...animal, estado: 'fallecido', fecha_sacrificio: fecha, motivo_sacrificio: motivo || null }
    const esExportado = estado.animalesExportados.some((a) => a.id === animal.id)
    dispatch({ type: esExportado ? 'EDITAR_ANIMAL_EXPORTADO' : 'EDITAR_ANIMAL', payload: actualizado })

    // Grabar en tabla sacrificios con animal_id para poder vincularlo después
    const sacrificioRepro = {
      id: generarId(),
      camada_id: null,
      animal_id: animal.id,
      cantidad: 1,
      fecha,
      categoria: 'reproductor',
      notas: motivo || null,
      bioterio_id: bioterioActivo,
    }
    dispatch({ type: 'AGREGAR_SACRIFICIO', payload: sacrificioRepro })
    const { error: errSac } = await supabase.from('sacrificios').insert(sacrificioRepro)
    if (errSac) {
      console.error('Error al registrar sacrificio de reproductor:', errSac)
      dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: sacrificioRepro.id })
    }

    // Guardar fecha_sacrificio y motivo en la tabla animales también
    const { error } = await supabase.from('animales').update({
      estado: 'fallecido',
      fecha_sacrificio: fecha,
      motivo_sacrificio: motivo || null,
    }).eq('id', animal.id)
    if (error) console.error('Error al actualizar estado de reproductor:', error)
  }

  // restaurar = true → además de borrar el registro, recrea la jaula con los animales sacrificados
  async function eliminarSacrificio(id, restaurar = false) {
    const respaldo = estado.sacrificios.find((s) => s.id === id)
    dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: id })
    const { error } = await supabase.from('sacrificios').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar sacrificio:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_SACRIFICIO', payload: respaldo })
      return
    }
    if (restaurar && respaldo?.camada_id) {
      await agregarJaula({
        camada_id: respaldo.camada_id,
        total: respaldo.cantidad,
        machos: null,
        hembras: null,
        notas: 'Sacrificio revertido',
      })
    }
  }

  // Eliminar sacrificio de un reproductor con opción de devolverlo como vivo
  // restaurar = true  → animal vuelve a 'activo', se limpia fecha y motivo
  // restaurar = false → solo se borra el registro, animal sigue 'fallecido' pero sin fecha (puede re-registrarse)
  async function eliminarSacrificioReproductor(animal, restaurar) {
    // Buscar el registro de sacrificio asociado a este animal
    const sacRepro = estado.sacrificios.find(
      (s) => s.categoria === 'reproductor' && (
        s.animal_id === animal.id ||
        s.notas === `Reproductor ${animal.codigo}`
      )
    )

    if (sacRepro) {
      dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: sacRepro.id })
      const { error: errS } = await supabase.from('sacrificios').delete().eq('id', sacRepro.id)
      if (errS) {
        console.error('Error al eliminar sacrificio de reproductor:', errS)
        dispatch({ type: 'AGREGAR_SACRIFICIO', payload: sacRepro })
      }
    }

    const esExportado = estado.animalesExportados.some((a) => a.id === animal.id)
    if (restaurar) {
      // Devolver vivo: activo + limpiar fecha y motivo
      const restaurado = { ...animal, estado: 'activo', fecha_sacrificio: null, motivo_sacrificio: null }
      dispatch({ type: esExportado ? 'EDITAR_ANIMAL_EXPORTADO' : 'EDITAR_ANIMAL', payload: restaurado })
      const { error } = await supabase.from('animales').update({
        estado: 'activo',
        fecha_sacrificio: null,
        motivo_sacrificio: null,
      }).eq('id', animal.id)
      if (error) console.error('Error al restaurar reproductor:', error)
    } else {
      // Mantener fallecido pero limpiar fecha para poder re-registrar correctamente
      const limpiado = { ...animal, fecha_sacrificio: null, motivo_sacrificio: null }
      dispatch({ type: esExportado ? 'EDITAR_ANIMAL_EXPORTADO' : 'EDITAR_ANIMAL', payload: limpiado })
      const { error } = await supabase.from('animales').update({
        fecha_sacrificio: null,
        motivo_sacrificio: null,
      }).eq('id', animal.id)
      if (error) console.error('Error al limpiar fecha de sacrificio:', error)
    }
  }

  // ── ENTREGAS ───────────────────────────────────────────────────────────────

  async function registrarEntrega(datos) {
    const nuevo = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_ENTREGA', payload: nuevo })
    const { error } = await supabase.from('entregas').insert(nuevo)
    if (error) {
      console.error('Error al registrar entrega:', error)
      dispatch({ type: 'ELIMINAR_ENTREGA', payload: nuevo.id })
      throw error
    }
  }

  // Entrega de reproductor: pasa a estado 'retirado' y queda registrado en tabla entregas
  async function entregarReproductor(animal, fecha, observaciones) {
    const actualizado = { ...animal, estado: 'retirado' }
    const esExportado = estado.animalesExportados.some((a) => a.id === animal.id)
    dispatch({ type: esExportado ? 'EDITAR_ANIMAL_EXPORTADO' : 'EDITAR_ANIMAL', payload: actualizado })
    const { error } = await supabase.from('animales').update({ estado: 'retirado' }).eq('id', animal.id)
    if (error) console.error('Error al actualizar estado de reproductor:', error)

    const entrega = { id: generarId(), camada_id: null, animal_id: animal.id, cantidad: 1, fecha, observaciones: observaciones || null, bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_ENTREGA', payload: entrega })
    const { error: errE } = await supabase.from('entregas').insert(entrega)
    if (errE) {
      console.error('Error al registrar entrega de reproductor:', errE)
      dispatch({ type: 'ELIMINAR_ENTREGA', payload: entrega.id })
    }
  }

  // Devolver entrega al stock
  // mantenerHistorial = true → restaura stock pero NO borra la entrega
  // mantenerHistorial = false → restaura stock Y borra la entrega del historial
  async function devolverEntrega(entrega, mantenerHistorial) {
    if (entrega.camada_id) {
      // Crías → recrear jaula con la cantidad devuelta
      await agregarJaula({
        camada_id: entrega.camada_id,
        total: entrega.cantidad,
        machos: null,
        hembras: null,
        notas: 'Devuelto',
      })
    } else if (entrega.animal_id) {
      // Reproductor → restaurar estado a 'activo'
      const animalPropio    = estado.animales.find((a) => a.id === entrega.animal_id)
      const animalExportado = estado.animalesExportados.find((a) => a.id === entrega.animal_id)
      const animal = animalPropio ?? animalExportado
      if (animal) {
        const restaurado = { ...animal, estado: 'activo' }
        dispatch({ type: animalExportado ? 'EDITAR_ANIMAL_EXPORTADO' : 'EDITAR_ANIMAL', payload: restaurado })
        const { error } = await supabase.from('animales').update({ estado: 'activo' }).eq('id', entrega.animal_id)
        if (error) console.error('Error al restaurar reproductor:', error)
      }
    }

    if (!mantenerHistorial) {
      dispatch({ type: 'ELIMINAR_ENTREGA', payload: entrega.id })
      const { error } = await supabase.from('entregas').delete().eq('id', entrega.id)
      if (error) console.error('Error al eliminar entrega del historial:', error)
    }
  }

  // ── INCIDENTES ────────────────────────────────────────────────────────────

  async function agregarIncidente(datos) {
    const nuevo = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_INCIDENTE', payload: nuevo })
    const { error } = await supabase.from('incidentes').insert(nuevo)
    if (error) {
      console.error('Error al guardar incidente:', error)
      dispatch({ type: 'ELIMINAR_INCIDENTE', payload: nuevo.id })
      throw error
    }
  }

  async function editarIncidente(datos) {
    dispatch({ type: 'EDITAR_INCIDENTE', payload: datos })
    const { error } = await supabase.from('incidentes').update(datos).eq('id', datos.id)
    if (error) console.error('Error al editar incidente:', error)
  }

  async function eliminarIncidente(id) {
    const respaldo = estado.incidentes.find((i) => i.id === id)
    dispatch({ type: 'ELIMINAR_INCIDENTE', payload: id })
    const { error } = await supabase.from('incidentes').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar incidente:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_INCIDENTE', payload: respaldo })
    }
  }

  // ── TEMPERATURAS ──────────────────────────────────────────────────────────

  async function agregarTemperatura(datos) {
    const tempId = generarId()
    const datosConBioterio = { ...datos, bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_TEMPERATURA', payload: { ...datosConBioterio, id: tempId } })
    const { data, error } = await supabase.from('temperature_logs').insert(datosConBioterio).select().single()
    if (error) {
      console.error('Error al guardar temperatura:', error)
      dispatch({ type: 'ELIMINAR_TEMPERATURA', payload: tempId })
      throw error
    }
    // Reemplazar el registro temporal con el real (id UUID de Supabase)
    dispatch({ type: 'ELIMINAR_TEMPERATURA', payload: tempId })
    dispatch({ type: 'AGREGAR_TEMPERATURA', payload: data })
  }

  // ── EXTENDIDOS (ciclo estral) ─────────────────────────────────────────────

  async function agregarExtendido(datos) {
    // Buscar si ya existe un registro para ese animal + fecha (editar en lugar de insertar)
    const existente = estado.extendidos.find(
      (e) => e.animal_id === datos.animal_id && e.fecha === datos.fecha
    )
    if (existente) {
      return editarExtendido({ ...existente, ...datos })
    }
    const nuevo = { ...datos, id: generarId(), bioterio_id: bioterioActivo }
    dispatch({ type: 'AGREGAR_EXTENDIDO', payload: nuevo })
    const { error } = await supabase.from('extendidos').insert(nuevo)
    if (error) {
      console.error('Error al guardar extendido:', error)
      dispatch({ type: 'ELIMINAR_EXTENDIDO', payload: nuevo.id })
    }
  }

  async function editarExtendido(datos) {
    dispatch({ type: 'EDITAR_EXTENDIDO', payload: datos })
    const { error } = await supabase.from('extendidos').update(datos).eq('id', datos.id)
    if (error) console.error('Error al editar extendido:', error)
  }

  async function eliminarExtendido(id) {
    const respaldo = estado.extendidos.find((e) => e.id === id)
    dispatch({ type: 'ELIMINAR_EXTENDIDO', payload: id })
    const { error } = await supabase.from('extendidos').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar extendido:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_EXTENDIDO', payload: respaldo })
    }
  }

  async function eliminarTemperaturasMes(yearMonth) {
    // yearMonth formato: "2026-04"
    dispatch({ type: 'ELIMINAR_TEMPERATURAS_MES', payload: yearMonth })
    const desde = `${yearMonth}-01`
    const hasta = `${yearMonth}-31`
    const { error } = await supabase
      .from('temperature_logs')
      .delete()
      .gte('date', desde)
      .lte('date', hasta)
    if (error) console.error('Error al eliminar temperaturas del mes:', error)
  }

  // ── PEDIDOS ────────────────────────────────────────────────────────────────

  // Convierte el objeto camelCase del frontend a snake_case para Supabase
  function _pedidoToDb(p) {
    return {
      id:           p.id,
      bioterio_id:  p.bioterioId,
      cantidad:     p.cantidad,
      sexo:         p.sexo,
      edad_semanas: p.edadSemanas,
      fecha_entrega: p.fechaEntrega,
      uso:          p.uso,
      solicitante:  p.solicitante ?? '',
      notas:        p.notas ?? '',
      estado:       p.estado,
      created_at:   p.created_at,
      updated_at:   p.updated_at ?? null,
      meta: {
        modalidad:        p.modalidad         ?? 'unica',
        soloVirgenes:     p.soloVirgenes       ?? false,
        cantidadPorTanda: p.cantidadPorTanda   ?? null,
        frecuenciaDias:   p.frecuenciaDias     ?? null,
        tandasTotal:      p.tandasTotal        ?? null,
      },
    }
  }

  // Convierte la fila snake_case de Supabase al objeto camelCase que usa la UI
  function _pedidoFromDb(row) {
    const meta = (row.meta && typeof row.meta === 'object') ? row.meta : {}
    return {
      id:           row.id,
      bioterioId:   row.bioterio_id,
      cantidad:     row.cantidad,
      sexo:         row.sexo,
      edadSemanas:  row.edad_semanas,
      fechaEntrega: row.fecha_entrega,
      uso:          row.uso,
      solicitante:  row.solicitante ?? '',
      notas:        row.notas ?? '',
      estado:       row.estado,
      created_at:   row.created_at,
      updated_at:   row.updated_at,
      modalidad:        meta.modalidad         ?? 'unica',
      soloVirgenes:     meta.soloVirgenes       ?? false,
      cantidadPorTanda: meta.cantidadPorTanda   ?? null,
      frecuenciaDias:   meta.frecuenciaDias     ?? null,
      tandasTotal:      meta.tandasTotal        ?? null,
    }
  }

  async function agregarPedido(datos) {
    const nuevo = {
      ...datos,
      id: generarId(),
      estado: 'pendiente',
      created_at: hoy(),
    }
    dispatch({ type: 'AGREGAR_PEDIDO', payload: nuevo })
    const { error } = await supabase.from('pedidos').insert(_pedidoToDb(nuevo))
    if (error) {
      console.error('Error al guardar pedido:', error)
      dispatch({ type: 'ELIMINAR_PEDIDO', payload: nuevo.id })
      throw error
    }
  }

  async function editarPedido(datos) {
    const antigua = estado.pedidos.find((p) => p.id === datos.id)
    dispatch({ type: 'EDITAR_PEDIDO', payload: datos })
    const { error } = await supabase.from('pedidos').update(_pedidoToDb(datos)).eq('id', datos.id)
    if (error) {
      console.error('Error al editar pedido:', error)
      if (antigua) dispatch({ type: 'EDITAR_PEDIDO', payload: antigua })
    }
  }

  async function eliminarPedido(id) {
    const respaldo = estado.pedidos.find((p) => p.id === id)
    dispatch({ type: 'ELIMINAR_PEDIDO', payload: id })
    const { error } = await supabase.from('pedidos').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar pedido:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_PEDIDO', payload: respaldo })
    }
  }

  // ── EXPORTACIÓN DE REPRODUCTORES A HÍBRIDOS ──────────────────────────────
  // Marca un animal de BAL/C o C57 como disponible en Híbridos.
  // El animal NO se mueve de su bioterio — solo se agrega a animalesExportados.
  async function exportarAHibridos(animal) {
    const actualizado = { ...animal, exportado_hibridos: true }
    dispatch({ type: 'AGREGAR_ANIMAL_EXPORTADO', payload: actualizado })
    const { error } = await supabase
      .from('animales')
      .update({ exportado_hibridos: true })
      .eq('id', animal.id)
    if (error) {
      console.error('Error al exportar animal a Híbridos:', error)
      dispatch({ type: 'REMOVER_ANIMAL_EXPORTADO', payload: animal.id })
    }
  }

  // Devuelve el reproductor a su colonia original — quita el vínculo con Híbridos.
  async function devolverDeHibridos(animalId) {
    const respaldo = estado.animalesExportados.find((a) => a.id === animalId)
    dispatch({ type: 'REMOVER_ANIMAL_EXPORTADO', payload: animalId })
    const { error } = await supabase
      .from('animales')
      .update({ exportado_hibridos: false })
      .eq('id', animalId)
    if (error) {
      console.error('Error al devolver animal de Híbridos:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_ANIMAL_EXPORTADO', payload: respaldo })
    }
  }

  return (
    <BiotheriumCtx.Provider value={{
      animales: estado.animales,
      animalesExportados: estado.animalesExportados,
      camadas: estado.camadas,
      camadasF1: estado.camadasF1,
      sacrificios: estado.sacrificios,
      entregas: estado.entregas,
      jaulas: estado.jaulas,
      temperaturas: estado.temperaturas,
      incidentes: estado.incidentes,
      extendidos: estado.extendidos,
      pedidos: estado.pedidos,
      cargando,
      error,
      bio,
      bioterioActivo,
      exportarAHibridos, devolverDeHibridos,
      agregarAnimal, editarAnimal, eliminarAnimal, sacrificarReproductor,
      agregarCamada, editarCamada, eliminarCamada, confirmarSeparacion,
      registrarSacrificio, eliminarSacrificio, eliminarSacrificioReproductor,
      registrarEntrega, entregarReproductor, devolverEntrega,
      agregarJaula, editarJaula, eliminarJaula,
      agregarTemperatura, eliminarTemperaturasMes,
      agregarIncidente, editarIncidente, eliminarIncidente,
      agregarExtendido, editarExtendido, eliminarExtendido,
      agregarPedido, editarPedido, eliminarPedido,
    }}>
      {children}
    </BiotheriumCtx.Provider>
  )
}

export function useBioterio() {
  const ctx = useContext(BiotheriumCtx)
  if (!ctx) throw new Error('useBioterio debe usarse dentro de BiotheriumProvider')
  return ctx
}
