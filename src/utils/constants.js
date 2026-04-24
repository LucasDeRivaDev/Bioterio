// Constantes biológicas — Ratas (Rattus norvegicus)
export const BIO_RATAS = {
  GESTACION_DIAS: 23,
  DESTETE_DIAS: 21,
  MADUREZ_DIAS: 84,                 // 12 semanas
  CICLO_ESTRAL_DIAS: 5,
  VENTANA_CONCEPCION_MIN: 1,
  VENTANA_CONCEPCION_MAX: 5,
  DURACION_APAREAMIENTO_DIAS: 15,
}

// Constantes biológicas — Ratones (Mus musculus)
export const BIO_RATONES = {
  GESTACION_DIAS: 21,
  DESTETE_DIAS: 21,
  MADUREZ_DIAS: 56,                 // 8 semanas
  CICLO_ESTRAL_DIAS: 5,
  VENTANA_CONCEPCION_MIN: 1,
  VENTANA_CONCEPCION_MAX: 5,
  DURACION_APAREAMIENTO_DIAS: 15,
}

// Alias para compatibilidad con código existente
export const BIO = BIO_RATAS

// Devuelve los parámetros biológicos según el bioterio activo
export function getBio(bioterioId) {
  if (!bioterioId || bioterioId === 'ratas') return BIO_RATAS
  return BIO_RATONES  // todos los subgrupos de ratones comparten parámetros
}

// Máximo de apareamientos permitidos por hembra antes del descarte
export const MAX_APAREAMIENTOS = 3

export const ESTADO_ANIMAL = {
  ACTIVO: 'activo',
  EN_APAREAMIENTO: 'en_apareamiento', // conviviendo con el macho, aún no confirmada preñez
  EN_CRIA: 'en_cria',                 // preñada o amamantando
  RETIRADO: 'retirado',
  FALLECIDO: 'fallecido',
}

export const TIPO_TAREA = {
  SEPARACION: 'separacion',        // separar pareja al fin del período de apareamiento
  CONTROL_PARTO: 'control_parto',
  DESTETE: 'destete',
  MADUREZ: 'madurez',
  REVISION: 'revision',
  EVALUAR_HEMBRA: 'evaluar_hembra', // camada < 8 crías o supervivencia crítica
  FIN_CICLO: 'fin_ciclo',           // 3er apareamiento completado → recomendar descarte
}

export const PRIORIDAD = {
  VENCIDA: 'vencida',
  HOY: 'hoy',
  PROXIMA: 'proxima',
}
