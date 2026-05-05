/**
 * BiotheriumContextPro.jsx — BioteríoPro
 *
 * Misma lógica que BiotheriumContextDemo.jsx pero usa useEspecie()
 * en lugar de useBioterioActivo(). Sin Supabase — todo en localStorage.
 *
 * Contrato idéntico al contexto original: mismos estados y funciones.
 */
import { createContext, useContext, useReducer } from 'react'
import { generarId } from '../utils/storage'
import { useEspecie } from './EspecieContext'

// ─── Keys de localStorage ─────────────────────────────────────────────────────
const LS = {
  animales:     'pro_animales',
  camadas:      'pro_camadas',
  jaulas:       'pro_jaulas',
  sacrificios:  'pro_sacrificios',
  entregas:     'pro_entregas',
  temperaturas: 'pro_temperaturas',
  incidentes:   'pro_incidentes',
  extendidos:   'pro_extendidos',
}

function leer(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function guardar(key, valor) {
  localStorage.setItem(key, JSON.stringify(valor))
}

function inicializar() {
  return {
    animales:     leer(LS.animales,     []),
    camadas:      leer(LS.camadas,      []),
    jaulas:       leer(LS.jaulas,       []),
    sacrificios:  leer(LS.sacrificios,  []),
    entregas:     leer(LS.entregas,     []),
    temperaturas: leer(LS.temperaturas, []),
    incidentes:   leer(LS.incidentes,   []),
    extendidos:   leer(LS.extendidos,   []),
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(estado, accion) {
  let lista
  switch (accion.type) {
    case 'SET_ANIMALES':         return { ...estado, animales:     accion.payload }
    case 'SET_CAMADAS':          return { ...estado, camadas:      accion.payload }
    case 'SET_SACRIFICIOS':      return { ...estado, sacrificios:  accion.payload }
    case 'SET_ENTREGAS':         return { ...estado, entregas:     accion.payload }
    case 'SET_JAULAS':           return { ...estado, jaulas:       accion.payload }
    case 'SET_TEMPERATURAS':     return { ...estado, temperaturas: accion.payload }
    case 'SET_INCIDENTES':       return { ...estado, incidentes:   accion.payload }
    case 'SET_EXTENDIDOS':       return { ...estado, extendidos:   accion.payload }

    case 'AGREGAR_EXTENDIDO': {
      lista = estado.extendidos.filter((e) => !(e.animal_id === accion.payload.animal_id && e.fecha === accion.payload.fecha))
      lista.push(accion.payload)
      lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
      return { ...estado, extendidos: lista }
    }
    case 'EDITAR_EXTENDIDO':   return { ...estado, extendidos: estado.extendidos.map((e) => e.id === accion.payload.id ? accion.payload : e) }
    case 'ELIMINAR_EXTENDIDO': return { ...estado, extendidos: estado.extendidos.filter((e) => e.id !== accion.payload) }

    case 'AGREGAR_ANIMAL': {
      lista = [...estado.animales, accion.payload]
      lista.sort((a, b) => (a.fecha_nacimiento ?? '').localeCompare(b.fecha_nacimiento ?? ''))
      return { ...estado, animales: lista }
    }
    case 'EDITAR_ANIMAL':   return { ...estado, animales: estado.animales.map((a) => a.id === accion.payload.id ? accion.payload : a) }
    case 'ELIMINAR_ANIMAL': return { ...estado, animales: estado.animales.filter((a) => a.id !== accion.payload) }

    case 'AGREGAR_CAMADA': {
      lista = [...estado.camadas, accion.payload]
      lista.sort((a, b) => (a.fecha_copula ?? '').localeCompare(b.fecha_copula ?? ''))
      return { ...estado, camadas: lista }
    }
    case 'EDITAR_CAMADA':   return { ...estado, camadas: estado.camadas.map((c) => c.id === accion.payload.id ? accion.payload : c) }
    case 'ELIMINAR_CAMADA': return { ...estado, camadas: estado.camadas.filter((c) => c.id !== accion.payload) }

    case 'AGREGAR_SACRIFICIO': {
      lista = [...estado.sacrificios, accion.payload]
      lista.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
      return { ...estado, sacrificios: lista }
    }
    case 'ELIMINAR_SACRIFICIO': return { ...estado, sacrificios: estado.sacrificios.filter((s) => s.id !== accion.payload) }

    case 'AGREGAR_ENTREGA': {
      lista = [...estado.entregas, accion.payload]
      lista.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
      return { ...estado, entregas: lista }
    }
    case 'ELIMINAR_ENTREGA': return { ...estado, entregas: estado.entregas.filter((e) => e.id !== accion.payload) }

    case 'AGREGAR_JAULA':   return { ...estado, jaulas: [...estado.jaulas, accion.payload] }
    case 'EDITAR_JAULA':    return { ...estado, jaulas: estado.jaulas.map((j) => j.id === accion.payload.id ? accion.payload : j) }
    case 'ELIMINAR_JAULA':  return { ...estado, jaulas: estado.jaulas.filter((j) => j.id !== accion.payload) }

    case 'AGREGAR_TEMPERATURA':       return { ...estado, temperaturas: [...estado.temperaturas, accion.payload] }
    case 'ELIMINAR_TEMPERATURA':      return { ...estado, temperaturas: estado.temperaturas.filter((t) => t.id !== accion.payload) }
    case 'ELIMINAR_TEMPERATURAS_MES': return { ...estado, temperaturas: estado.temperaturas.filter((t) => !t.date?.startsWith(accion.payload)) }

    case 'AGREGAR_INCIDENTE': {
      lista = [...estado.incidentes, accion.payload]
      lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
      return { ...estado, incidentes: lista }
    }
    case 'ELIMINAR_INCIDENTE': return { ...estado, incidentes: estado.incidentes.filter((i) => i.id !== accion.payload) }

    default: return estado
  }
}

const BiotheriumCtx = createContext(null)

export function BiotheriumProProvider({ children }) {
  const { especie, bio } = useEspecie()
  const especieId = especie?.id ?? 'personalizada'
  const [estado, dispatch] = useReducer(reducer, undefined, inicializar)

  // ── ANIMALES ───────────────────────────────────────────────────────────────
  async function agregarAnimal(datos) {
    const nuevo = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.animales, nuevo].sort((a, b) => (a.fecha_nacimiento ?? '').localeCompare(b.fecha_nacimiento ?? ''))
    dispatch({ type: 'SET_ANIMALES', payload: siguientes })
    guardar(LS.animales, siguientes)
  }

  async function editarAnimal(datos) {
    const siguientes = estado.animales.map((a) => a.id === datos.id ? datos : a)
    dispatch({ type: 'SET_ANIMALES', payload: siguientes })
    guardar(LS.animales, siguientes)
  }

  async function eliminarAnimal(id) {
    const siguientes = estado.animales.filter((a) => a.id !== id)
    dispatch({ type: 'SET_ANIMALES', payload: siguientes })
    guardar(LS.animales, siguientes)
  }

  // ── JAULAS ─────────────────────────────────────────────────────────────────
  async function agregarJaula(datos) {
    const nueva = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.jaulas, nueva]
    dispatch({ type: 'SET_JAULAS', payload: siguientes })
    guardar(LS.jaulas, siguientes)
  }

  async function editarJaula(datos) {
    const siguientes = estado.jaulas.map((j) => j.id === datos.id ? datos : j)
    dispatch({ type: 'SET_JAULAS', payload: siguientes })
    guardar(LS.jaulas, siguientes)
  }

  async function eliminarJaula(id) {
    const siguientes = estado.jaulas.filter((j) => j.id !== id)
    dispatch({ type: 'SET_JAULAS', payload: siguientes })
    guardar(LS.jaulas, siguientes)
  }

  // ── CAMADAS ────────────────────────────────────────────────────────────────
  async function agregarCamada(datos) {
    const nueva = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.camadas, nueva].sort((a, b) => (a.fecha_copula ?? '').localeCompare(b.fecha_copula ?? ''))
    dispatch({ type: 'SET_CAMADAS', payload: siguientes })
    guardar(LS.camadas, siguientes)
    if (datos.id_madre) {
      const madre = estado.animales.find((a) => a.id === datos.id_madre)
      if (madre && madre.estado === 'activo') {
        await editarAnimal({ ...madre, estado: 'en_apareamiento' })
      }
    }
  }

  async function confirmarSeparacion(camadaId, fechaSeparacion) {
    const camada = estado.camadas.find((c) => c.id === camadaId)
    if (!camada) return
    await editarCamada({ ...camada, fecha_separacion: fechaSeparacion })
    if (camada.id_madre) {
      const madre = estado.animales.find((a) => a.id === camada.id_madre)
      if (madre && madre.estado === 'en_apareamiento') {
        await editarAnimal({ ...madre, estado: 'en_cria' })
      }
    }
  }

  async function editarCamada(datos) {
    const antigua = estado.camadas.find((c) => c.id === datos.id)
    const siguientes = estado.camadas.map((c) => c.id === datos.id ? datos : c)
    dispatch({ type: 'SET_CAMADAS', payload: siguientes })
    guardar(LS.camadas, siguientes)

    const stockActivado   = datos.incluir_en_stock !== false && antigua?.incluir_en_stock === false
    const stockDesactivado = datos.incluir_en_stock === false && antigua?.incluir_en_stock !== false

    if (stockDesactivado) {
      const jaulasCamada = estado.jaulas.filter((j) => j.camada_id === datos.id)
      for (const jaula of jaulasCamada) await eliminarJaula(jaula.id)
    }

    const desteteNuevo = datos.fecha_destete && !antigua?.fecha_destete
    if ((desteteNuevo || stockActivado) && datos.incluir_en_stock !== false && datos.fecha_destete) {
      const jaulaExiste = estado.jaulas.some((j) => j.camada_id === datos.id)
      if (!jaulaExiste) {
        const total = datos.total_destetados ?? datos.total_crias ?? 0
        if (total > 0) {
          await agregarJaula({ camada_id: datos.id, total, machos: datos.crias_machos ?? null, hembras: datos.crias_hembras ?? null, notas: '' })
        }
      }
    }
  }

  async function eliminarCamada(id) {
    const siguientes = estado.camadas.filter((c) => c.id !== id)
    dispatch({ type: 'SET_CAMADAS', payload: siguientes })
    guardar(LS.camadas, siguientes)
  }

  // ── SACRIFICIOS ────────────────────────────────────────────────────────────
  async function registrarSacrificio(datos) {
    const nuevo = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.sacrificios, nuevo].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
    dispatch({ type: 'SET_SACRIFICIOS', payload: siguientes })
    guardar(LS.sacrificios, siguientes)
  }

  async function sacrificarReproductor(animal, fecha, motivo) {
    const actualizado = { ...animal, estado: 'fallecido', fecha_sacrificio: fecha, motivo_sacrificio: motivo || null }
    await editarAnimal(actualizado)
    const sacrificioRepro = { id: generarId(), camada_id: null, animal_id: animal.id, cantidad: 1, fecha, categoria: 'reproductor', notas: motivo || null, especie_id: especieId }
    const siguientes = [...estado.sacrificios, sacrificioRepro].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
    dispatch({ type: 'SET_SACRIFICIOS', payload: siguientes })
    guardar(LS.sacrificios, siguientes)
  }

  async function eliminarSacrificio(id, restaurar = false) {
    const respaldo = estado.sacrificios.find((s) => s.id === id)
    const siguientes = estado.sacrificios.filter((s) => s.id !== id)
    dispatch({ type: 'SET_SACRIFICIOS', payload: siguientes })
    guardar(LS.sacrificios, siguientes)
    if (restaurar && respaldo?.camada_id) {
      await agregarJaula({ camada_id: respaldo.camada_id, total: respaldo.cantidad, machos: null, hembras: null, notas: 'Sacrificio revertido' })
    }
  }

  async function eliminarSacrificioReproductor(animal, restaurar) {
    const sacRepro = estado.sacrificios.find((s) => s.categoria === 'reproductor' && (s.animal_id === animal.id || s.notas === `Reproductor ${animal.codigo}`))
    if (sacRepro) {
      const siguientes = estado.sacrificios.filter((s) => s.id !== sacRepro.id)
      dispatch({ type: 'SET_SACRIFICIOS', payload: siguientes })
      guardar(LS.sacrificios, siguientes)
    }
    if (restaurar) {
      await editarAnimal({ ...animal, estado: 'activo', fecha_sacrificio: null, motivo_sacrificio: null })
    } else {
      await editarAnimal({ ...animal, fecha_sacrificio: null, motivo_sacrificio: null })
    }
  }

  // ── ENTREGAS ───────────────────────────────────────────────────────────────
  async function registrarEntrega(datos) {
    const nuevo = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.entregas, nuevo].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
    dispatch({ type: 'SET_ENTREGAS', payload: siguientes })
    guardar(LS.entregas, siguientes)
  }

  async function entregarReproductor(animal, fecha, observaciones) {
    await editarAnimal({ ...animal, estado: 'retirado' })
    const entrega = { id: generarId(), camada_id: null, animal_id: animal.id, cantidad: 1, fecha, observaciones: observaciones || null, especie_id: especieId }
    const siguientes = [...estado.entregas, entrega].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
    dispatch({ type: 'SET_ENTREGAS', payload: siguientes })
    guardar(LS.entregas, siguientes)
  }

  async function devolverEntrega(entrega, mantenerHistorial) {
    if (entrega.camada_id) {
      await agregarJaula({ camada_id: entrega.camada_id, total: entrega.cantidad, machos: null, hembras: null, notas: 'Devuelto' })
    } else if (entrega.animal_id) {
      const animal = estado.animales.find((a) => a.id === entrega.animal_id)
      if (animal) await editarAnimal({ ...animal, estado: 'activo' })
    }
    if (!mantenerHistorial) {
      const siguientes = estado.entregas.filter((e) => e.id !== entrega.id)
      dispatch({ type: 'SET_ENTREGAS', payload: siguientes })
      guardar(LS.entregas, siguientes)
    }
  }

  // ── INCIDENTES ─────────────────────────────────────────────────────────────
  async function agregarIncidente(datos) {
    const nuevo = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.incidentes, nuevo].sort((a, b) => b.fecha.localeCompare(a.fecha))
    dispatch({ type: 'SET_INCIDENTES', payload: siguientes })
    guardar(LS.incidentes, siguientes)
  }

  async function eliminarIncidente(id) {
    const siguientes = estado.incidentes.filter((i) => i.id !== id)
    dispatch({ type: 'SET_INCIDENTES', payload: siguientes })
    guardar(LS.incidentes, siguientes)
  }

  // ── TEMPERATURAS ──────────────────────────────────────────────────────────
  async function agregarTemperatura(datos) {
    const nuevo = { ...datos, id: generarId(), especie_id: especieId }
    const siguientes = [...estado.temperaturas, nuevo]
    dispatch({ type: 'SET_TEMPERATURAS', payload: siguientes })
    guardar(LS.temperaturas, siguientes)
  }

  async function eliminarTemperaturasMes(yearMonth) {
    const siguientes = estado.temperaturas.filter((t) => !t.date?.startsWith(yearMonth))
    dispatch({ type: 'SET_TEMPERATURAS', payload: siguientes })
    guardar(LS.temperaturas, siguientes)
  }

  // ── EXTENDIDOS ─────────────────────────────────────────────────────────────
  async function agregarExtendido(datos) {
    const existente = estado.extendidos.find((e) => e.animal_id === datos.animal_id && e.fecha === datos.fecha)
    if (existente) return editarExtendido({ ...existente, ...datos })
    const nuevo = { ...datos, id: generarId(), especie_id: especieId }
    const lista = estado.extendidos.filter((e) => !(e.animal_id === nuevo.animal_id && e.fecha === nuevo.fecha))
    lista.push(nuevo)
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
    dispatch({ type: 'SET_EXTENDIDOS', payload: lista })
    guardar(LS.extendidos, lista)
  }

  async function editarExtendido(datos) {
    const siguientes = estado.extendidos.map((e) => e.id === datos.id ? datos : e)
    dispatch({ type: 'SET_EXTENDIDOS', payload: siguientes })
    guardar(LS.extendidos, siguientes)
  }

  async function eliminarExtendido(id) {
    const siguientes = estado.extendidos.filter((e) => e.id !== id)
    dispatch({ type: 'SET_EXTENDIDOS', payload: siguientes })
    guardar(LS.extendidos, siguientes)
  }

  return (
    <BiotheriumCtx.Provider value={{
      animales:     estado.animales,
      camadas:      estado.camadas,
      sacrificios:  estado.sacrificios,
      entregas:     estado.entregas,
      jaulas:       estado.jaulas,
      temperaturas: estado.temperaturas,
      incidentes:   estado.incidentes,
      extendidos:   estado.extendidos,
      cargando: false,
      error: null,
      bio,
      bioterioActivo: especieId,
      agregarAnimal, editarAnimal, eliminarAnimal, sacrificarReproductor,
      agregarCamada, editarCamada, eliminarCamada, confirmarSeparacion,
      registrarSacrificio, eliminarSacrificio, eliminarSacrificioReproductor,
      registrarEntrega, entregarReproductor, devolverEntrega,
      agregarJaula, editarJaula, eliminarJaula,
      agregarTemperatura, eliminarTemperaturasMes,
      agregarIncidente, eliminarIncidente,
      agregarExtendido, editarExtendido, eliminarExtendido,
    }}>
      {children}
    </BiotheriumCtx.Provider>
  )
}

export function useBioterio() {
  const ctx = useContext(BiotheriumCtx)
  if (!ctx) throw new Error('useBioterio debe usarse dentro de BiotheriumProProvider')
  return ctx
}
