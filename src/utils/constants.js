// Constantes biológicas del sistema (ratones de laboratorio)
export const BIO = {
  GESTACION_DIAS: 23,        // días de gestación
  DESTETE_DIAS: 21,          // días después del nacimiento para destetar
  MADUREZ_DIAS: 84,          // 12 semanas = madurez reproductiva
  CICLO_ESTRAL_DIAS: 5,      // duración del ciclo estral
  VENTANA_CONCEPCION_MIN: 1, // mínimo días post-cópula para concepción
  VENTANA_CONCEPCION_MAX: 5, // máximo días post-cópula (1 ciclo)
}

export const ESTADO_ANIMAL = {
  ACTIVO: 'activo',
  RETIRADO: 'retirado',
  FALLECIDO: 'fallecido',
  EN_CRIA: 'en_cria',
}

export const TIPO_TAREA = {
  CONTROL_PARTO: 'control_parto',
  DESTETE: 'destete',
  MADUREZ: 'madurez',
  REVISION: 'revision',
}

export const PRIORIDAD = {
  VENCIDA: 'vencida',
  HOY: 'hoy',
  PROXIMA: 'proxima',
}
