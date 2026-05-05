/**
 * EspecieContext.jsx — BioteríoPro
 *
 * Reemplaza BioterioActivoContext del proyecto original.
 * En vez de 4 especies hardcodeadas, permite configurar cualquier especie
 * con todos sus parámetros biológicos (o elegir uno de los presets).
 *
 * API expuesta por useEspecie():
 *   especie      — objeto con todos los parámetros de la especie activa
 *   setEspecie   — guardar una especie nueva (y activarla)
 *   limpiarEspecie — borra la especie del localStorage (vuelve al selector)
 *   bio          — objeto BIO con la forma que esperan las funciones de calculos.js
 */

import { createContext, useContext, useState, useCallback } from 'react'

// ─── Presets ──────────────────────────────────────────────────────────────────
export const PRESETS_ESPECIE = [
  {
    id: 'rata',
    nombre: 'Rata',
    nombreCientifico: 'Rattus norvegicus',
    icono: '🐀',
    color: '#a17850',
    gestacion_dias: 23,
    destete_dias: 21,
    madurez_dias: 84,        // 12 semanas
    ciclo_estral_dias: 5,
    ventana_concepcion_min: 1,
    ventana_concepcion_max: 5,
    duracion_apareamiento_dias: 15,
    camadaPromedio: '8–12',
    vidaReproductiva: '6–18 meses',
    orden: 'Rodentia',
  },
  {
    id: 'raton',
    nombre: 'Ratón',
    nombreCientifico: 'Mus musculus',
    icono: '🐭',
    color: '#7b8fa1',
    gestacion_dias: 21,
    destete_dias: 21,
    madurez_dias: 56,        // 8 semanas
    ciclo_estral_dias: 5,
    ventana_concepcion_min: 1,
    ventana_concepcion_max: 5,
    duracion_apareamiento_dias: 15,
    camadaPromedio: '6–12',
    vidaReproductiva: '4–12 meses',
    orden: 'Rodentia',
  },
  {
    id: 'cobayo',
    nombre: 'Cobayo',
    nombreCientifico: 'Cavia porcellus',
    icono: '🐹',
    color: '#c8a96e',
    gestacion_dias: 65,
    destete_dias: 21,
    madurez_dias: 70,        // ~10 semanas
    ciclo_estral_dias: 16,
    ventana_concepcion_min: 1,
    ventana_concepcion_max: 3,
    duracion_apareamiento_dias: 20,
    camadaPromedio: '2–4',
    vidaReproductiva: '6–24 meses',
    orden: 'Rodentia',
  },
  {
    id: 'conejo',
    nombre: 'Conejo',
    nombreCientifico: 'Oryctolagus cuniculus',
    icono: '🐇',
    color: '#e8c9a0',
    gestacion_dias: 31,
    destete_dias: 28,
    madurez_dias: 150,       // ~5 meses (razas pequeñas)
    ciclo_estral_dias: 16,
    ventana_concepcion_min: 1,
    ventana_concepcion_max: 3,
    duracion_apareamiento_dias: 5,
    camadaPromedio: '4–10',
    vidaReproductiva: '6–36 meses',
    orden: 'Lagomorpha',
  },
  {
    id: 'hamster',
    nombre: 'Hamster',
    nombreCientifico: 'Mesocricetus auratus',
    icono: '🐹',
    color: '#d4956a',
    gestacion_dias: 16,
    destete_dias: 21,
    madurez_dias: 42,        // 6 semanas
    ciclo_estral_dias: 4,
    ventana_concepcion_min: 1,
    ventana_concepcion_max: 1,
    duracion_apareamiento_dias: 3,
    camadaPromedio: '6–12',
    vidaReproductiva: '3–14 meses',
    orden: 'Rodentia',
  },
  {
    id: 'personalizada',
    nombre: 'Personalizada',
    nombreCientifico: '',
    icono: '🔬',
    color: '#00e676',
    gestacion_dias: 21,
    destete_dias: 21,
    madurez_dias: 60,
    ciclo_estral_dias: 5,
    ventana_concepcion_min: 1,
    ventana_concepcion_max: 5,
    duracion_apareamiento_dias: 15,
    camadaPromedio: '—',
    vidaReproductiva: '—',
    orden: '—',
  },
]

// ─── localStorage ─────────────────────────────────────────────────────────────
const LS_KEY = 'pro_especie'

function leerEspecie() {
  try {
    const v = localStorage.getItem(LS_KEY)
    return v ? JSON.parse(v) : null
  } catch { return null }
}

function guardarEspecie(esp) {
  localStorage.setItem(LS_KEY, JSON.stringify(esp))
}

// ─── Construir objeto BIO compatible con calculos.js ─────────────────────────
function especieToBio(esp) {
  return {
    GESTACION_DIAS:             esp.gestacion_dias,
    DESTETE_DIAS:               esp.destete_dias,
    MADUREZ_DIAS:               esp.madurez_dias,
    CICLO_ESTRAL_DIAS:          esp.ciclo_estral_dias,
    VENTANA_CONCEPCION_MIN:     esp.ventana_concepcion_min,
    VENTANA_CONCEPCION_MAX:     esp.ventana_concepcion_max,
    DURACION_APAREAMIENTO_DIAS: esp.duracion_apareamiento_dias,
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const EspecieCtx = createContext(null)

export function EspecieProvider({ children }) {
  const [especie, _setEspecie] = useState(() => leerEspecie())

  const setEspecie = useCallback((esp) => {
    guardarEspecie(esp)
    _setEspecie(esp)
  }, [])

  const limpiarEspecie = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    _setEspecie(null)
  }, [])

  const bio = especie ? especieToBio(especie) : especieToBio(PRESETS_ESPECIE[0])

  return (
    <EspecieCtx.Provider value={{ especie, setEspecie, limpiarEspecie, bio }}>
      {children}
    </EspecieCtx.Provider>
  )
}

export function useEspecie() {
  const ctx = useContext(EspecieCtx)
  if (!ctx) throw new Error('useEspecie debe usarse dentro de EspecieProvider')
  return ctx
}
