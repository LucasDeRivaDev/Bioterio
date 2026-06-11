// Genera un ID único simple
export function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
