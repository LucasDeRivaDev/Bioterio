import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generarId } from '../utils/storage'

// ─── Reducer (igual que antes, maneja el estado local) ────────────────────────
function reducer(estado, accion) {
  switch (accion.type) {
    case 'SET_ANIMALES':
      return { ...estado, animales: accion.payload }
    case 'SET_CAMADAS':
      return { ...estado, camadas: accion.payload }
    case 'SET_SACRIFICIOS':
      return { ...estado, sacrificios: accion.payload }

    case 'AGREGAR_ANIMAL':
      return { ...estado, animales: [...estado.animales, accion.payload] }
    case 'EDITAR_ANIMAL':
      return { ...estado, animales: estado.animales.map((a) => a.id === accion.payload.id ? accion.payload : a) }
    case 'ELIMINAR_ANIMAL':
      return { ...estado, animales: estado.animales.filter((a) => a.id !== accion.payload) }

    case 'AGREGAR_CAMADA':
      return { ...estado, camadas: [...estado.camadas, accion.payload] }
    case 'EDITAR_CAMADA':
      return { ...estado, camadas: estado.camadas.map((c) => c.id === accion.payload.id ? accion.payload : c) }
    case 'ELIMINAR_CAMADA':
      return { ...estado, camadas: estado.camadas.filter((c) => c.id !== accion.payload) }

    case 'AGREGAR_SACRIFICIO':
      return { ...estado, sacrificios: [...estado.sacrificios, accion.payload] }
    case 'ELIMINAR_SACRIFICIO':
      return { ...estado, sacrificios: estado.sacrificios.filter((s) => s.id !== accion.payload) }

    default:
      return estado
  }
}

const BiotheriumCtx = createContext(null)

export function BiotheriumProvider({ children }) {
  const [estado, dispatch] = useReducer(reducer, { animales: [], camadas: [], sacrificios: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  // ── Cargar datos al iniciar ────────────────────────────────────────────────
  useEffect(() => {
    async function cargarDatos() {
      setCargando(true)
      setError(null)
      try {
        const [{ data: animales, error: errA }, { data: camadas, error: errC }, { data: sacrificios, error: errS }] = await Promise.all([
          supabase.from('animales').select('*').order('created_at', { ascending: true }),
          supabase.from('camadas').select('*').order('created_at', { ascending: true }),
          supabase.from('sacrificios').select('*').order('created_at', { ascending: true }),
        ])
        if (errA) throw errA
        if (errC) throw errC
        // sacrificios: si la tabla no existe aún, no bloquear la carga
        dispatch({ type: 'SET_ANIMALES', payload: animales ?? [] })
        dispatch({ type: 'SET_CAMADAS', payload: camadas ?? [] })
        dispatch({ type: 'SET_SACRIFICIOS', payload: sacrificios ?? [] })
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
    // Actualizar UI inmediatamente (optimistic)
    dispatch({ type: 'AGREGAR_ANIMAL', payload: nuevo })
    const { error } = await supabase.from('animales').insert(nuevo)
    if (error) {
      console.error('Error al guardar animal:', error)
      // Revertir si falla
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
    // Cambiar la hembra a 'en_cria' (preñada) si estaba 'en_apareamiento'
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
    dispatch({ type: 'EDITAR_CAMADA', payload: datos })
    const { error } = await supabase.from('camadas').update(datos).eq('id', datos.id)
    if (error) console.error('Error al editar camada:', error)
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

  async function eliminarSacrificio(id) {
    const respaldo = estado.sacrificios.find((s) => s.id === id)
    dispatch({ type: 'ELIMINAR_SACRIFICIO', payload: id })
    const { error } = await supabase.from('sacrificios').delete().eq('id', id)
    if (error) {
      console.error('Error al eliminar sacrificio:', error)
      if (respaldo) dispatch({ type: 'AGREGAR_SACRIFICIO', payload: respaldo })
    }
  }

  return (
    <BiotheriumCtx.Provider value={{
      animales: estado.animales,
      camadas: estado.camadas,
      sacrificios: estado.sacrificios,
      cargando,
      error,
      agregarAnimal, editarAnimal, eliminarAnimal,
      agregarCamada, editarCamada, eliminarCamada, confirmarSeparacion,
      registrarSacrificio, eliminarSacrificio,
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
