import { createContext, useContext, useState } from 'react'
import { getBio } from '../utils/constants'

// ─── Configuración de cada bioterio ─────────────────────────────────────────
export const BIOTERIOS_CONFIG = {
  ratas: {
    id: 'ratas',
    especie: 'rata',
    label: 'Ratas',
    labelCorto: 'Ratas',
    subgrupo: null,
    icon: '🐀',
    nombreCientifico: 'Rattus norvegicus',
    orden: 'Rodentia · Fam. Muridae',
    color: '#00e676',
    camadaPromedio: '8–12 crías',
    vidaReproductiva: '~14 meses',
  },
  ratones_balbc: {
    id: 'ratones_balbc',
    especie: 'raton',
    label: 'Ratones — Balb/C',
    labelCorto: 'Balb/C',
    subgrupo: 'balbc',
    icon: '🐭',
    nombreCientifico: 'Mus musculus (Balb/C)',
    orden: 'Rodentia · Fam. Muridae',
    color: '#40c4ff',
    camadaPromedio: '6–10 crías',
    vidaReproductiva: '~12 meses',
  },
  ratones_c57: {
    id: 'ratones_c57',
    especie: 'raton',
    label: 'Ratones — C57',
    labelCorto: 'C57',
    subgrupo: 'c57',
    icon: '🐭',
    nombreCientifico: 'Mus musculus (C57)',
    orden: 'Rodentia · Fam. Muridae',
    color: '#a78bfa',
    camadaPromedio: '5–8 crías',
    vidaReproductiva: '~12 meses',
  },
  ratones_hibridos: {
    id: 'ratones_hibridos',
    especie: 'raton',
    label: 'Ratones — Híbridos',
    labelCorto: 'Híbridos',
    subgrupo: 'hibrido',
    icon: '🐭',
    nombreCientifico: 'Mus musculus (F1)',
    orden: 'Rodentia · Fam. Muridae',
    color: '#ffb300',
    camadaPromedio: '7–11 crías',
    vidaReproductiva: '~12 meses',
  },
}

const BioterioActivoCtx = createContext(null)

export function BioterioActivoProvider({ children }) {
  const [bioterioActivo, setBioterioActivoInterno] = useState(
    () => localStorage.getItem('bioterio_activo') || null
  )

  function setBioterioActivo(id) {
    localStorage.setItem('bioterio_activo', id)
    setBioterioActivoInterno(id)
  }

  function limpiarBioterio() {
    localStorage.removeItem('bioterio_activo')
    setBioterioActivoInterno(null)
  }

  const config = bioterioActivo ? (BIOTERIOS_CONFIG[bioterioActivo] ?? null) : null
  const bio    = bioterioActivo ? getBio(bioterioActivo) : null

  return (
    <BioterioActivoCtx.Provider value={{ bioterioActivo, setBioterioActivo, limpiarBioterio, config, bio }}>
      {children}
    </BioterioActivoCtx.Provider>
  )
}

export function useBioterioActivo() {
  const ctx = useContext(BioterioActivoCtx)
  if (!ctx) throw new Error('useBioterioActivo debe usarse dentro de BioterioActivoProvider')
  return ctx
}
