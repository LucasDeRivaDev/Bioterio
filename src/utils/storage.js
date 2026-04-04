// Helpers para persistir datos en localStorage

const KEYS = {
  ANIMALES: 'bioterio_animales',
  CAMADAS: 'bioterio_camadas',
}

export function cargarAnimales() {
  try {
    const data = localStorage.getItem(KEYS.ANIMALES)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function guardarAnimales(animales) {
  localStorage.setItem(KEYS.ANIMALES, JSON.stringify(animales))
}

export function cargarCamadas() {
  try {
    const data = localStorage.getItem(KEYS.CAMADAS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function guardarCamadas(camadas) {
  localStorage.setItem(KEYS.CAMADAS, JSON.stringify(camadas))
}

// Genera un ID único simple
export function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
