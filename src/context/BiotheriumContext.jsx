import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generarId } from '../utils/storage'

// ─── Reducer ─────────────────────────────────────────────────────────────────
function reducer(estado, accion) {
  switch (accion.type) {
    case 'SET_ANIMALES':         return { ...estado, animales: accion.payload }
    case 'SET_CAMADAS':          return { ...estado, camadas: accion.payload }
    case 'SET_SACRIFICIOS':      return { ...estado, sacrificios: accion.payload }
    case 'SET_JAULAS':           return { ...estado, jaulas: accion.payload }
    case 'SET_TEMPERATURAS':     return { ...estado, temperaturas: accion.payload }

    case 'AGREGAR_ANIMAL':  return { ...estado, animales: [...estado.animales, accion.payload] }
    case 'EDITAR_ANIMAL':   return { ...estado, animales: estado.animales.map((a) => a.id === accion.payload.id ? accion.payload : a) }
    case 'ELIMINAR_ANIMAL': return { ...estado, animales: estado.animales.filter((a) => a.id !== accion.payload) }

    case 'AGREGAR_CAMADA':  return { ...estado, camadas: [...estado.camadas, accion.payload] }
    case 'EDITAR_CAMADA':   return { ...estado, camadas: estado.camadas.map((c) => c.id === accion.payload.id ? accion.payload : c) }
    case 'ELIMINAR_CAMADA': return { ...estado, camadas: estado.camadas.filter((c) => c.id !== accion.payload) }

    case 'AGREGAR_SACRIFICIO':  return { ...estado, sacrificios: [...estado.sacrificios, accion.payload] }
    case 'ELIMINAR_SACRIFICIO': return { ...estado, sacrificios: estado.sacrificios.filter((s) => s.id !== accion.payload) }

    case 'AGREGAR_JAULA':   return { ...estado, jaulas: [...estado.jaulas, accion.payload] }
    case 'EDITAR_JAULA':    return { ...estado, jaulas: estado.jaulas.map((j) => j.id === accion.payload.id ? accion.payload : j) }
    case 'ELIMINAR_JAULA':  return { ...estado, jaulas: estado.jaulas.filter((j) => j.id !== accion.payload) }

    case 'AGREGAR_TEMPERATURA':          return { ...estado, temperaturas: [...estado.temperaturas, accion.payload] }
    case 'ELIMINAR_TEMPERATURA':         return { ...estado, temperaturas: estado.temperaturas.filter((t) => t.id !== accion.payload) }
    case 'ELIMINAR_TEMPERATURAS_MES':    return { ...estado, temperaturas: estado.temperaturas.filter((t) => !(t.date?.startsWith(accion.payload))) }

    default: return estado
  }
}

const BiotheriumCtx = createContext(null)

export function BiotheriumProvider({ children }) {
  const [estado, dispatch] = useReducer(reducer, { animales: [], camadas: [], sacrificios: [], jaulas: [], temperaturas: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  // ── Cargar datos al iniciar ────────────────────────────────────────────────
  useEffect(() => {
    async function cargarDatos() {
      setCargando(true)
      setError(null)
      try {
        const [{ data: animales, error: errA }, { data: camadas, error: errC }, { data: sacrificios }, { data: jaulas }, { data: temperaturas }] = await Promise.all([
          supabase.from('animales').select('*').order('created_at', { ascending: true }),
          supabase.from('camadas').select('*').order('created_at', { ascending: true }),
          supabase.from('sacrificios').select('*').order('created_at', { ascending: true }),
          supabase.from('jaulas').select('*').order('created_at', { ascending: true }),
          supabase.from('temperature_logs').select('*').order('date', { ascending: false }).order('time', { ascending: false }),
        ])
        if (errA) throw errA
        if (errC) throw errC
        dispatch({ type: 'SET_ANIMALES', payload: animales ?? [] })
        dispatch({ type: 'SET_CAMADAS', payload: camadas ?? [] })
        dispatch({ type: 'SET_SACRIFICIOS', payload: sacrificios ?? [] })
        dispatch({ type: 'SET_JAULAS', payload: jaulas ?? [] })
        dispatch({ type: 'SET_TEMPERATURAS', payload: temperaturas ?? [] })
      } catch (e) {
        console.error('Error al cargar datos:', e)
        setError('No se pudieron cargar los datos. Verificá la conexión.')
      } finally {
        setCargando(false)
      }
    }
    cargarDatos()
  }, [])

  // ── ANIMALES ───────────────────────────────────────────────────────────────

  async function agregarAnimal(datos) {
    const nuevo = { ...datos, id: generarId() }
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
    const nueva = { ...datos, id: generarId() }
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
    const nueva = { ...datos, id: generarId() }
    dispatch({ type: 'AGREGAR_CAMADA', payload: nueva })
    const { error } = await supabase.from('camadas').insert(nueva)
    if (error) {
      console.error('Error al guardar camada:', error)
      dispatch({ type: 'ELIMINAR_CAMADA', payload: nueva.id })
      return
    }
    // Auto-setear la hembra a 'en_apareamiento' si estaba 'activo'
    if (datos.id_madre) {
      const madre = estado.animales.find((a) => a.id === datos.id_madre)
      if (madre && madre.estado === 'activo') {
        const madreActualizada = { ...madre, estado: 'en_apareamiento' }
        dispatch({ type: 'EDITAR_ANIMAL', payload: madreActualizada })
        const { error: errA } = await supabase.from('animales').update({ estado: 'en_apareamiento' }).eq('id', datos.id_madre)
        if (errA) console.error('Error al actualizar estado de madre:', errA)
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
    if (camada.id_madre) {
      const madre = estado.animales.find((a) => a.id === camada.id_madre)
      if (madre && madre.estado === 'en_apareamiento') {
        const madreActualizada = { ...madre, estado: 'en_cria' }
        dispatch({ type: 'EDITAR_ANIMAL', payload: madreActualizada })
        const { error: errA } = await supabase.from('animales').update({ estado: 'en_cria' }).eq('id', camada.id_madre)
        if (errA) console.error('Error al actualizar estado de madre:', errA)
      }
    }
  }

  async function editarCamada(datos) {
    const antigua = estado.camadas.find((c) => c.id === datos.id)
    dispatch({ type: 'EDITAR_CAMADA', payload: datos })
    // Solo mandamos las columnas reales de la DB (sin campos computados como rango, latencia, estado, etc.)
    const { id, id_madre, id_padre, fecha_copula, fecha_separacion,
            fecha_nacimiento, fecha_destete, gestacion_real,
            total_crias, crias_machos, crias_hembras, total_destetados,
            failure_flag, failure_type, notas } = datos
    const datosDB = { id, id_madre, id_padre, fecha_copula, fecha_separacion,
                      fecha_nacimiento, fecha_destete, gestacion_real,
                      total_crias, crias_machos, crias_hembras, total_destetados,
                      failure_flag, failure_type, notas }
    const { error } = await supabase.from('camadas').update(datosDB).eq('id', datos.id)
    if (error) console.error('Error al editar camada:', error)

    // Auto-crear jaula inicial cuando se registra el destete por primera vez
    if (datos.fecha_destete && !antigua?.fecha_destete) {
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
    const nuevo = { ...datos, id: generarId() }
    dispatch({ type: 'AGREGAR_SACRIFICIO', payload: nuevo })
    const { error } = await supabase.from('sacrificios').insert(nuevo)
    if (error) {
      console.error('Error al registrar sacrificio:', error)
      dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: nuevo.id })
      throw error
    }
  }

  // Sacrificio de animales reproductores (actualiza estado + intenta guardar fecha)
  async function sacrificarReproductor(animal, fecha, motivo) {
    const actualizado = { ...animal, estado: 'fallecido', fecha_sacrificio: fecha, motivo_sacrificio: motivo || null }
    dispatch({ type: 'EDITAR_ANIMAL', payload: actualizado })

    // Intenta actualizar con fecha_sacrificio (requiere migración DB)
    const { error } = await supabase
      .from('animales')
      .update({ estado: 'fallecido', fecha_sacrificio: fecha, motivo_sacrificio: motivo || null })
      .eq('id', animal.id)

    if (error) {
      // Fallback: solo actualiza el estado (funciona sin migración)
      console.warn('Columnas fecha/motivo_sacrificio no disponibles, actualizando solo estado.')
      await supabase.from('animales').update({ estado: 'fallecido' }).eq('id', animal.id)
    }
  }

  async function eliminarSacrificio(id) {
    const respaldo = estado.sacrificios.find((s) => s.id === id)
    dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: id })
    const { error } = await supabase.from('sacrificios').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar sacrificio:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_SACRIFICIO', payload: respaldo })
    }
  }

  // ── TEMPERATURAS ──────────────────────────────────────────────────────────

  async function agregarTemperatura(datos) {
    const tempId = generarId()
    dispatch({ type: 'AGREGAR_TEMPERATURA', payload: { ...datos, id: tempId } })
    const { data, error } = await supabase.from('temperature_logs').insert(datos).select().single()
    if (error) {
      console.error('Error al guardar temperatura:', error)
      dispatch({ type: 'ELIMINAR_TEMPERATURA', payload: tempId })
      throw error
    }
    // Reemplazar el registro temporal con el real (id UUID de Supabase)
    dispatch({ type: 'ELIMINAR_TEMPERATURA', payload: tempId })
    dispatch({ type: 'AGREGAR_TEMPERATURA', payload: data })
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

  return (
    <BiotheriumCtx.Provider value={{
      animales: estado.animales,
      camadas: estado.camadas,
      sacrificios: estado.sacrificios,
      jaulas: estado.jaulas,
      temperaturas: estado.temperaturas,
      cargando,
      error,
      agregarAnimal, editarAnimal, eliminarAnimal, sacrificarReproductor,
      agregarCamada, editarCamada, eliminarCamada, confirmarSeparacion,
      registrarSacrificio, eliminarSacrificio,
      agregarJaula, editarJaula, eliminarJaula,
      agregarTemperatura, eliminarTemperaturasMes,
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
