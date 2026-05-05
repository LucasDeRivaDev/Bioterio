// Datos de ejemplo para la demo de GenERats
// Representan una colonia real con historial reproductivo de 4 meses

// ─── ANIMALES ────────────────────────────────────────────────────────────────
export const ANIMALES_SEED = [
  // Hembras activas
  { id: 'hembra-001', codigo: 'H-001', sexo: 'hembra', estado: 'activo',     fecha_nacimiento: '2025-08-01', notas: 'Muy buena productora. Primera generación.',  fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'hembra-002', codigo: 'H-002', sexo: 'hembra', estado: 'activo',     fecha_nacimiento: '2025-08-15', notas: 'Segundo apareamiento. Supervivencia media.',   fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'hembra-003', codigo: 'H-003', sexo: 'hembra', estado: 'activo',     fecha_nacimiento: '2025-09-01', notas: 'Camada grande. Excelente temperamento.',       fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'hembra-004', codigo: 'H-004', sexo: 'hembra', estado: 'activo',     fecha_nacimiento: '2025-09-15', notas: 'Tuvo parto fallido. En observación.',          fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'hembra-005', codigo: 'H-005', sexo: 'hembra', estado: 'en_cria',    fecha_nacimiento: '2025-07-15', notas: 'En gestación. Día 0 confirmado 14/04.',         fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'hembra-006', codigo: 'H-006', sexo: 'hembra', estado: 'activo',     fecha_nacimiento: '2025-11-01', notas: 'Primera generación joven. Aún no apareada.',   fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  // Machos activos
  { id: 'macho-001',  codigo: 'M-001', sexo: 'macho',  estado: 'activo',     fecha_nacimiento: '2025-07-01', notas: 'Alta fertilidad. Latencia promedio 2 días.',   fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'macho-002',  codigo: 'M-002', sexo: 'macho',  estado: 'activo',     fecha_nacimiento: '2025-08-01', notas: 'Fertilidad normal.',                           fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  { id: 'macho-003',  codigo: 'M-003', sexo: 'macho',  estado: 'activo',     fecha_nacimiento: '2025-09-01', notas: 'Primera generación. Primer apareamiento.',     fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
  // Macho retirado (entregado a investigador)
  { id: 'macho-004',  codigo: 'M-004', sexo: 'macho',  estado: 'retirado',   fecha_nacimiento: '2025-06-01', notas: 'Entregado a Farmacología el 05/02/2026.',      fecha_sacrificio: null, motivo_sacrificio: null, bioterio_id: 'ratas' },
]

// ─── CAMADAS ─────────────────────────────────────────────────────────────────
export const CAMADAS_SEED = [
  // C-001: completa, en stock
  {
    id: 'camada-001',
    id_madre: 'hembra-001', id_padre: 'macho-001',
    fecha_copula: '2026-01-08', fecha_separacion: '2026-01-23',
    fecha_nacimiento: '2026-01-31', fecha_destete: '2026-02-21',
    gestacion_real: 23,
    total_crias: 11, crias_machos: 5, crias_hembras: 6,
    total_destetados: 11,
    failure_flag: false, failure_type: null,
    incluir_en_stock: true,
    notas: 'Parto sin complicaciones. Todos los animales saludables.',
    bioterio_id: 'ratas',
  },
  // C-002: completa, en stock (con entrega parcial ya registrada)
  {
    id: 'camada-002',
    id_madre: 'hembra-002', id_padre: 'macho-002',
    fecha_copula: '2026-01-15', fecha_separacion: '2026-01-30',
    fecha_nacimiento: '2026-02-07', fecha_destete: '2026-02-28',
    gestacion_real: 23,
    total_crias: 9, crias_machos: 5, crias_hembras: 4,
    total_destetados: 8,
    failure_flag: false, failure_type: null,
    incluir_en_stock: true,
    notas: '1 cría muerta pre-destete. Resto bien.',
    bioterio_id: 'ratas',
  },
  // C-003: completa, en stock (camada grande)
  {
    id: 'camada-003',
    id_madre: 'hembra-003', id_padre: 'macho-001',
    fecha_copula: '2026-02-10', fecha_separacion: '2026-02-25',
    fecha_nacimiento: '2026-03-05', fecha_destete: '2026-03-26',
    gestacion_real: 23,
    total_crias: 13, crias_machos: 6, crias_hembras: 7,
    total_destetados: 12,
    failure_flag: false, failure_type: null,
    incluir_en_stock: true,
    notas: 'Camada numerosa. 1 pérdida tardía.',
    bioterio_id: 'ratas',
  },
  // C-004: parto fallido
  {
    id: 'camada-004',
    id_madre: 'hembra-004', id_padre: 'macho-002',
    fecha_copula: '2026-02-20', fecha_separacion: '2026-03-07',
    fecha_nacimiento: null, fecha_destete: null,
    gestacion_real: null,
    total_crias: null, crias_machos: null, crias_hembras: null,
    total_destetados: null,
    failure_flag: true, failure_type: 'no_birth',
    incluir_en_stock: true,
    notas: 'Sin signos de parto en los 30 días post-cópula. Posible reabsorción.',
    bioterio_id: 'ratas',
  },
  // C-005: en gestación (día 16 de gestación al 30/04/2026)
  {
    id: 'camada-005',
    id_madre: 'hembra-005', id_padre: 'macho-003',
    fecha_copula: '2026-04-14', fecha_separacion: '2026-04-29',
    fecha_nacimiento: null, fecha_destete: null,
    gestacion_real: null,
    total_crias: null, crias_machos: null, crias_hembras: null,
    total_destetados: null,
    failure_flag: false, failure_type: null,
    incluir_en_stock: true,
    notas: 'Día 0 confirmado por extendido vaginal. Parto esperado ~07/05.',
    bioterio_id: 'ratas',
  },
  // C-006: completa, SIN stock (destinada a otro protocolo)
  {
    id: 'camada-006',
    id_madre: 'hembra-001', id_padre: 'macho-003',
    fecha_copula: '2026-03-05', fecha_separacion: '2026-03-20',
    fecha_nacimiento: '2026-03-28', fecha_destete: '2026-04-18',
    gestacion_real: 23,
    total_crias: 10, crias_machos: 5, crias_hembras: 5,
    total_destetados: 9,
    failure_flag: false, failure_type: null,
    incluir_en_stock: false,
    notas: 'Crías destinadas directamente al protocolo de Dr. García. No ingresan a stock general.',
    bioterio_id: 'ratas',
  },
]

// ─── JAULAS ───────────────────────────────────────────────────────────────────
// Los totales ya reflejan sacrificios y entregas previas
export const JAULAS_SEED = [
  // C-001: 11 destetados − 3 sacrificados = 8 restantes
  { id: 'jaula-001', camada_id: 'camada-001', total: 8,  machos: 4, hembras: 4, notas: '', bioterio_id: 'ratas' },
  // C-002: 8 destetados − 3 entregados = 5 restantes
  { id: 'jaula-002', camada_id: 'camada-002', total: 5,  machos: 3, hembras: 2, notas: '', bioterio_id: 'ratas' },
  // C-003: 12 destetados, sin tocar
  { id: 'jaula-003', camada_id: 'camada-003', total: 12, machos: 5, hembras: 7, notas: 'Jaula grande. Separar pronto.', bioterio_id: 'ratas' },
]

// ─── SACRIFICIOS ─────────────────────────────────────────────────────────────
export const SACRIFICIOS_SEED = [
  // Sacrificio parcial de crías de C-001
  {
    id: 'sacrificio-001',
    camada_id: 'camada-001', animal_id: null,
    cantidad: 3, fecha: '2026-03-15',
    categoria: 'stock',
    notas: 'Control de densidad poblacional.',
    bioterio_id: 'ratas',
  },
]

// ─── ENTREGAS ─────────────────────────────────────────────────────────────────
export const ENTREGAS_SEED = [
  // Entrega de crías de C-002 a investigador
  {
    id: 'entrega-001',
    camada_id: 'camada-002', animal_id: null,
    cantidad: 3, fecha: '2026-04-10',
    observaciones: 'Dra. Martínez — Experimento 042 — Fisiología renal',
    bioterio_id: 'ratas',
  },
  // Entrega del reproductor M-004
  {
    id: 'entrega-002',
    camada_id: null, animal_id: 'macho-004',
    cantidad: 1, fecha: '2026-02-05',
    observaciones: 'Dr. Pérez — Cátedra Farmacología',
    bioterio_id: 'ratas',
  },
]

// ─── TEMPERATURAS ─────────────────────────────────────────────────────────────
// 30 días de abril 2026 con variación realista
function genTemp(dia, base) {
  const v = base + (Math.sin(dia * 0.8) * 0.8).toFixed(1) * 1
  return {
    id: `temp-abril-${String(dia).padStart(2, '0')}`,
    date: `2026-04-${String(dia).padStart(2, '0')}`,
    time: '08:00',
    current_temp: parseFloat((v).toFixed(1)),
    min_temp:     parseFloat((v - 1.2).toFixed(1)),
    max_temp:     parseFloat((v + 1.5).toFixed(1)),
    bioterio_id: 'ratas',
  }
}

const bases = [21.8,21.5,22.0,22.3,21.9,22.1,22.4,21.7,21.6,22.0,22.2,21.8,21.5,22.0,22.3,21.9,22.1,22.4,21.7,21.6,22.0,22.2,21.8,22.0,22.1,21.9,22.3,22.0,21.7,22.1]

export const TEMPERATURAS_SEED = bases.map((b, i) => genTemp(i + 1, b))

// ─── EXTENDIDOS ──────────────────────────────────────────────────────────────
// Registros de ciclo estral para H-005 (con cópula confirmada el 14/04)
export const EXTENDIDOS_SEED = [
  { id: 'ext-001', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-10', citologia: 'leucocitos',       claridad: 'claro',       apertura_vaginal: 'no',    lordosis: 'no',    copula: 'no_observado', espermatozoides: 'no_encontrados', fase: 'L1', fase_confirmada: true,  es_dia_0: false, notas: 'Inicio del ciclo.' },
  { id: 'ext-002', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-11', citologia: 'celulas_ovales',   claridad: 'claro',       apertura_vaginal: 'dudosa', lordosis: 'no',    copula: 'no_observado', espermatozoides: 'no_encontrados', fase: 'L2', fase_confirmada: true,  es_dia_0: false, notas: '' },
  { id: 'ext-003', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-12', citologia: 'celulas_ovales',   claridad: 'poco_claro',  apertura_vaginal: 'si',    lordosis: 'dudosa', copula: 'no_observado', espermatozoides: 'no_encontrados', fase: 'L3', fase_confirmada: true,  es_dia_0: false, notas: '' },
  { id: 'ext-004', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-13', citologia: 'celulas_escamosas', claridad: 'claro',      apertura_vaginal: 'si',    lordosis: 'si',    copula: 'no_observado', espermatozoides: 'no_encontrados', fase: 'O',  fase_confirmada: true,  es_dia_0: false, notas: 'Pico de estro.' },
  { id: 'ext-005', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-14', citologia: 'celulas_escamosas', claridad: 'poco_claro', apertura_vaginal: 'si',    lordosis: 'si',    copula: 'confirmada',   espermatozoides: 'encontrados',    fase: 'E',  fase_confirmada: true,  es_dia_0: true,  notas: 'Cópula confirmada. Día 0 de gestación.' },
  { id: 'ext-006', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-15', citologia: 'leucocitos',       claridad: 'claro',       apertura_vaginal: 'no',    lordosis: 'no',    copula: 'no_observado', espermatozoides: 'encontrados',    fase: 'L1', fase_confirmada: true,  es_dia_0: false, notas: 'Espermatozoides presentes. Preñez probable.' },
  { id: 'ext-007', animal_id: 'hembra-005', bioterio_id: 'ratas', fecha: '2026-04-16', citologia: 'leucocitos',       claridad: 'claro',       apertura_vaginal: 'no',    lordosis: 'no',    copula: 'no_observado', espermatozoides: 'no_encontrados', fase: 'L1', fase_confirmada: false, es_dia_0: false, notas: '' },
]

// ─── INCIDENTES ──────────────────────────────────────────────────────────────
export const INCIDENTES_SEED = [
  {
    id: 'incidente-001',
    fecha: '2026-03-18',
    tipo: 'temperatura',
    descripcion: 'Corte de luz de 3 horas. Temperatura bajó a 18°C. Se monitoreó sin consecuencias.',
    resolucion: 'Se revisaron todos los neonatos. Sin bajas.',
    bioterio_id: 'ratas',
  },
  {
    id: 'incidente-002',
    fecha: '2026-04-05',
    tipo: 'animal',
    descripcion: 'H-003 mostró signos de agresividad con crías. Se separó preventivamente.',
    resolucion: 'Comportamiento normalizado al día siguiente.',
    bioterio_id: 'ratas',
  },
]

// ─── FUNCIÓN DE RESET ────────────────────────────────────────────────────────
// Devuelve el estado inicial completo de la demo
export function getSeedInicial() {
  return {
    animales:     JSON.parse(JSON.stringify(ANIMALES_SEED)),
    camadas:      JSON.parse(JSON.stringify(CAMADAS_SEED)),
    jaulas:       JSON.parse(JSON.stringify(JAULAS_SEED)),
    sacrificios:  JSON.parse(JSON.stringify(SACRIFICIOS_SEED)),
    entregas:     JSON.parse(JSON.stringify(ENTREGAS_SEED)),
    temperaturas: JSON.parse(JSON.stringify(TEMPERATURAS_SEED)),
    incidentes:   JSON.parse(JSON.stringify(INCIDENTES_SEED)),
    extendidos:   JSON.parse(JSON.stringify(EXTENDIDOS_SEED)),
  }
}
