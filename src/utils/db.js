/**
 * db.js — Acceso centralizado a notas, planes de apareamiento y reservas.
 *
 * Estrategia:
 *  - Cache en memoria (Maps/arrays) cargado desde Supabase al iniciar.
 *  - Todas las escrituras van a Supabase y actualizan el cache inmediatamente.
 *  - Las funciones síncronas leen del cache (sin localStorage).
 *  - Llamar `inicializarDB(bioterioId)` al arrancar o cambiar de bioterio.
 */

import { supabase } from '../lib/supabase'
import { generarId } from './storage'

// Fecha de hoy YYYY-MM-DD en hora LOCAL (no usar toISOString: devuelve UTC).
// Duplicado de hoy() en calculos.js — no se importa para evitar import circular.
function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Caches en memoria ─────────────────────────────────────────────────────────

/** @type {Map<string, object>}  animalId → { tipo, motivo, bioterioId, fecha } */
let _reservas = new Map()

/** @type {Map<string, object[]>}  bioterioId → array de planes */
let _planes = new Map()

/** @type {Map<string, object[]>}  bioterioId → array de notas */
let _notas = new Map()

let _inicializado = false

// Promesa que se resuelve cuando el cache está cargado por primera vez.
// Los consumidores (Dashboard, Calendario) esperan dbReady() antes de leer
// getPlanes()/getNotas() para evitar leer el cache vacío en el primer load.
let _resolveReady
const _ready = new Promise((resolve) => { _resolveReady = resolve })

export function dbReady() { return _ready }

// ── Inicialización (cargar desde Supabase) ────────────────────────────────────

/**
 * Carga notas, planes y reservas desde Supabase.
 * Llama a esto en el contexto principal al montar y cuando cambia el bioterio.
 */
export async function inicializarDB() {
  try {
    const [
      { data: reservasDB },
      { data: planesDB },
      { data: notasDB },
    ] = await Promise.all([
      supabase.from('reservas').select('*'),
      supabase.from('planes_apareamiento').select('*').eq('completado', false),
      supabase.from('notas').select('*'),
    ])

    // Reservas → Map<animalId, {...}>
    _reservas = new Map()
    ;(reservasDB ?? []).forEach(r => {
      _reservas.set(r.animal_id, {
        tipo:       r.tipo,
        motivo:     r.motivo ?? '',
        bioterioId: r.bioterio_id,
        fecha:      r.fecha,
      })
    })

    // Planes → Map<bioterioId, []>
    _planes = new Map()
    ;(planesDB ?? []).forEach(p => {
      const bio = p.bioterio_id
      if (!_planes.has(bio)) _planes.set(bio, [])
      _planes.get(bio).push(dbAPlan(p))
    })

    // Notas → Map<bioterioId, []>
    _notas = new Map()
    ;(notasDB ?? []).forEach(n => {
      const bio = n.bioterio_id
      if (!_notas.has(bio)) _notas.set(bio, [])
      _notas.get(bio).push(n)
    })

    _inicializado = true
  } catch (err) {
    console.error('[db] Error inicializando desde Supabase:', err)
  } finally {
    _resolveReady()
  }
}

// ── Conversión DB ↔ JS ────────────────────────────────────────────────────────

function planToDB(p, bioterioId) {
  return {
    id:                    p.id,
    bioterio_id:           bioterioId,
    fecha_planificada:     p.fecha_planificada,
    observaciones:         p.observaciones ?? null,
    macho_bloque_id:       p.macho?.bloqueId ?? p.macho_bloque_id ?? null,
    macho_tipo:            p.macho?.tipo     ?? p.macho_tipo      ?? null,
    macho_codigo:          p.macho?.codigo   ?? p.macho_codigo    ?? null,
    macho_total:           p.macho?.total    ?? p.macho_total     ?? null,
    macho_edad:            p.macho?.edad     ?? p.macho_edad      ?? null,
    hembra_bloque_id:      p.hembra?.bloqueId ?? p.hembra_bloque_id ?? null,
    hembra_tipo:           p.hembra?.tipo     ?? p.hembra_tipo      ?? null,
    hembra_codigo:         p.hembra?.codigo   ?? p.hembra_codigo    ?? null,
    hembra_total:          p.hembra?.total    ?? p.hembra_total     ?? null,
    hembra_edad:           p.hembra?.edad     ?? p.hembra_edad      ?? null,
    bioterio_origen_macho:  p.macho?.bioterioOrigen  ?? p.bioterio_origen_macho  ?? null,
    bioterio_origen_hembra: p.hembra?.bioterioOrigen ?? p.bioterio_origen_hembra ?? null,
    completado:            p.completado ?? false,
    created_at:            p.created_at ?? hoyLocal(),
  }
}

function dbAPlan(row) {
  return {
    id:               row.id,
    bioterioActivo:   row.bioterio_id,
    fecha_planificada: row.fecha_planificada,
    observaciones:    row.observaciones,
    macho: {
      bloqueId:       row.macho_bloque_id,
      tipo:           row.macho_tipo,
      codigo:         row.macho_codigo,
      total:          row.macho_total,
      edad:           row.macho_edad,
      bioterioOrigen: row.bioterio_origen_macho,
    },
    hembra: {
      bloqueId:       row.hembra_bloque_id,
      tipo:           row.hembra_tipo,
      codigo:         row.hembra_codigo,
      total:          row.hembra_total,
      edad:           row.hembra_edad,
      bioterioOrigen: row.bioterio_origen_hembra,
    },
    completado: row.completado,
    created_at: row.created_at,
  }
}

// ── API: RESERVAS ─────────────────────────────────────────────────────────────

/** Retorna el Map completo de reservas (síncrono, desde cache) */
export function getReservas() {
  return Object.fromEntries(_reservas)
}

/** Retorna true si el animalId está reservado */
export function esReservado(animalId) {
  return _reservas.has(animalId)
}

/** Retorna reservas de un tipo específico (síncrono, desde cache) */
export function getReservadosPorTipo(tipo) {
  return [..._reservas.entries()]
    .filter(([, r]) => r.tipo === tipo)
    .map(([id, r]) => ({ id, ...r }))
}

/** Reserva un animal — escribe en Supabase y actualiza cache */
export async function reservarAnimal(animalId, tipo, motivo = '', bioterioId = '') {
  const row = {
    animal_id:  animalId,
    bioterio_id: bioterioId,
    tipo,
    motivo,
    fecha: hoyLocal(),
  }
  const { error } = await supabase
    .from('reservas')
    .upsert(row, { onConflict: 'animal_id' })
  if (error) { console.error('[db] reservarAnimal:', error); return }
  _reservas.set(animalId, { tipo, motivo, bioterioId, fecha: row.fecha })
}

/** Libera la reserva de un animal */
export async function liberarReserva(animalId) {
  const { error } = await supabase.from('reservas').delete().eq('animal_id', animalId)
  if (error) { console.error('[db] liberarReserva:', error); return }
  _reservas.delete(animalId)
}

// ── API: PLANES DE APAREAMIENTO ───────────────────────────────────────────────

/** Retorna los planes activos (no completados) de un bioterio */
export function getPlanes(bioterioId) {
  return (_planes.get(bioterioId) ?? []).filter(p => !p.completado)
}

/** Retorna TODOS los planes (incluyendo completados) de un bioterio */
export function getTodosPlanes(bioterioId) {
  return _planes.get(bioterioId) ?? []
}

/** Guarda un plan nuevo en Supabase y actualiza el cache */
export async function guardarPlan(plan, bioterioId) {
  const id  = plan.id || generarId()
  const row = planToDB({ ...plan, id }, bioterioId)
  const { error } = await supabase.from('planes_apareamiento').insert(row)
  if (error) { console.error('[db] guardarPlan:', error); return null }
  const obj = dbAPlan(row)
  if (!_planes.has(bioterioId)) _planes.set(bioterioId, [])
  _planes.get(bioterioId).push(obj)
  return obj
}

/** Marca un plan como completado */
export async function completarPlan(planId, bioterioId) {
  const { error } = await supabase
    .from('planes_apareamiento')
    .update({ completado: true })
    .eq('id', planId)
  if (error) { console.error('[db] completarPlan:', error); return }
  const lista = _planes.get(bioterioId) ?? []
  const idx   = lista.findIndex(p => p.id === planId)
  if (idx !== -1) lista[idx] = { ...lista[idx], completado: true }
}

/** Elimina un plan */
export async function eliminarPlan(planId, bioterioId) {
  const { error } = await supabase.from('planes_apareamiento').delete().eq('id', planId)
  if (error) { console.error('[db] eliminarPlan:', error); return }
  if (_planes.has(bioterioId)) {
    _planes.set(bioterioId, _planes.get(bioterioId).filter(p => p.id !== planId))
  }
}

// ── API: NOTAS ────────────────────────────────────────────────────────────────

/** Retorna las notas de un bioterio */
export function getNotas(bioterioId) {
  return _notas.get(bioterioId) ?? []
}

/** Guarda una nota nueva */
export async function guardarNota(nota, bioterioId) {
  const row = {
    id:          nota.id || generarId(),
    bioterio_id: bioterioId,
    fecha:       nota.fecha,
    titulo:      nota.titulo ?? null,
    descripcion: nota.descripcion,
    completada:  nota.completada ?? false,
    created_at:  nota.created_at ?? new Date().toISOString(),
  }
  const { error } = await supabase.from('notas').insert(row)
  if (error) { console.error('[db] guardarNota:', error); return null }
  if (!_notas.has(bioterioId)) _notas.set(bioterioId, [])
  _notas.get(bioterioId).push(row)
  return row
}

/** Actualiza campos de una nota */
export async function actualizarNota(notaId, cambios, bioterioId) {
  const { error } = await supabase.from('notas').update(cambios).eq('id', notaId)
  if (error) { console.error('[db] actualizarNota:', error); return }
  const lista = _notas.get(bioterioId) ?? []
  const idx   = lista.findIndex(n => n.id === notaId)
  if (idx !== -1) lista[idx] = { ...lista[idx], ...cambios }
}

/** Elimina una nota */
export async function eliminarNota(notaId, bioterioId) {
  const { error } = await supabase.from('notas').delete().eq('id', notaId)
  if (error) { console.error('[db] eliminarNota:', error); return }
  if (_notas.has(bioterioId)) {
    _notas.set(bioterioId, _notas.get(bioterioId).filter(n => n.id !== notaId))
  }
}

// ── Helpers para calculos.js (lectura síncrona desde cache) ──────────────────

/**
 * Retorna un Map<animalId, {fecha}> de animales en planes activos futuros.
 * Reemplaza la función de calculos.js que leía de localStorage.
 */
export function getAnimalesReservadosDB(bioterioActivo) {
  const hoyStr = hoyLocal()
  const mapa   = new Map()
  const planes = getPlanes(bioterioActivo)
  planes
    .filter(p => !p.completado && p.fecha_planificada >= hoyStr)
    .forEach(p => {
      if (p.macho?.bloqueId)  mapa.set(p.macho.bloqueId,  { fecha: p.fecha_planificada })
      if (p.hembra?.bloqueId) mapa.set(p.hembra.bloqueId, { fecha: p.fecha_planificada })
    })
  return mapa
}

/**
 * Retorna un Map<bloqueId, {fecha}> de jaulas de stock en planes activos futuros.
 */
export function getJaulasReservadasDB(bioterioActivo) {
  const hoyStr = hoyLocal()
  const mapa   = new Map()
  const planes = getPlanes(bioterioActivo)
  planes
    .filter(p => !p.completado && p.fecha_planificada >= hoyStr)
    .forEach(p => {
      if (p.macho?.tipo  === 'jaula_stock' && p.macho?.bloqueId)  mapa.set(p.macho.bloqueId,  { fecha: p.fecha_planificada })
      if (p.hembra?.tipo === 'jaula_stock' && p.hembra?.bloqueId) mapa.set(p.hembra.bloqueId, { fecha: p.fecha_planificada })
    })
  return mapa
}

/**
 * Retorna un Map de animales/jaulas de BAL/C o C57 reservados para F1.
 */
export function getReservadosParaHibridosDB(bioterioId) {
  const hoyStr = hoyLocal()
  const mapa   = new Map()
  const planes = getPlanes('ratones_hibridos')
  planes
    .filter(p => !p.completado && p.fecha_planificada >= hoyStr)
    .forEach(p => {
      if (p.macho?.bioterioOrigen  === bioterioId && p.macho?.bloqueId)
        mapa.set(p.macho.bloqueId,  { fecha: p.fecha_planificada, bioterioOrigen: bioterioId })
      if (p.hembra?.bioterioOrigen === bioterioId && p.hembra?.bloqueId)
        mapa.set(p.hembra.bloqueId, { fecha: p.fecha_planificada, bioterioOrigen: bioterioId })
    })
  return mapa
}
