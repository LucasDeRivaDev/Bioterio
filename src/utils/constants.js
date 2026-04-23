// Constantes biológicas del sistema (ratones de laboratorio)
export const BIO = {
  GESTACION_DIAS: 23,               // días de gestación
  DESTETE_DIAS: 21,                 // días después del nacimiento para destetar
  MADUREZ_DIAS: 84,                 // 12 semanas = madurez reproductiva
  CICLO_ESTRAL_DIAS: 5,             // duración del ciclo estral
  VENTANA_CONCEPCION_MIN: 1,        // mínimo días post-cópula para concepción
  VENTANA_CONCEPCION_MAX: 5,        // máximo días post-cópula (1 ciclo)
  DURACION_APAREAMIENTO_DIAS: 15,   // días de convivencia antes de separar la pareja
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
