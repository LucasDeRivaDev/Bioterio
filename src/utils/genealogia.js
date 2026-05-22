// ─────────────────────────────────────────────────────────────────────────────
// genealogia.js — árbol genealógico y coeficiente de consanguinidad (Wright)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye un mapa id → nodo a partir del array de animales.
 * Cada nodo guarda solo los campos que necesita el motor genealógico.
 */
export function buildPedigree(animales) {
  const pedigree = {}
  for (const a of animales) {
    pedigree[a.id] = {
      id:       a.id,
      codigo:   a.codigo,
      sexo:     a.sexo,
      estado:   a.estado,
      fecha_nacimiento: a.fecha_nacimiento ?? null,
      madre_id: a.id_madre ?? null,
      padre_id: a.id_padre ?? null,
    }
  }
  return pedigree
}

// ── Mapa de ancestros con profundidades ──────────────────────────────────────
// Devuelve Map<id, Set<depth>> — el mismo ancestro puede aparecer a distintas
// profundidades si el pedigree está cruzado.
function buildAncestorMap(id, pedigree, maxDepth = 8) {
  const result  = new Map()
  const visited = new Set() // evita ciclos en pedigrees inbredeados

  function traverse(currentId, depth) {
    if (!currentId || depth > maxDepth) return
    const key = `${currentId}@${depth}`
    if (visited.has(key)) return
    visited.add(key)

    if (!result.has(currentId)) result.set(currentId, new Set())
    result.get(currentId).add(depth)

    const node = pedigree[currentId]
    if (!node) return
    if (node.madre_id) traverse(node.madre_id, depth + 1)
    if (node.padre_id) traverse(node.padre_id, depth + 1)
  }

  traverse(id, 0)
  return result
}

// ── Coeficiente de consanguinidad de Wright ──────────────────────────────────
/**
 * Calcula el coeficiente F esperado para la cría del apareamiento madreId × padreId.
 * Retorna un valor entre 0 y 1 (0 = sin consanguinidad, 0.25 = hermanos completos, etc.)
 *
 * Fórmula: F = Σ_A Σ_{d1∈sire,d2∈dam} (1/2)^(d1+d2+1)
 * donde A recorre los ancestros comunes de ambos progenitores (incluyendo a
 * cada progenitor mismo, a profundidad 0, para detectar apareamientos
 * padre-hija / madre-hijo / abuelo-nieta, etc.)
 */
export function calcularFCoeficiente(madreId, padreId, pedigree, maxDepth = 8) {
  if (!madreId || !padreId) return 0
  if (madreId === padreId) return 1.0 // idénticos

  const mapSire = buildAncestorMap(padreId, pedigree, maxDepth)
  const mapDam  = buildAncestorMap(madreId, pedigree, maxDepth)

  let F = 0

  for (const [ancestorId, depthsSire] of mapSire) {
    if (!mapDam.has(ancestorId)) continue
    const depthsDam = mapDam.get(ancestorId)
    for (const d1 of depthsSire) {
      for (const d2 of depthsDam) {
        // Si el ancestro ES uno de los progenitores (depth 0), solo cuenta si
        // aparece con depth > 0 en el otro progenitor (ej: padre-hija).
        // Si ambos tienen depth 0, sería el mismo animal × sí mismo → excluir.
        if (d1 === 0 && d2 === 0) continue
        F += Math.pow(0.5, d1 + d2 + 1)
      }
    }
  }

  return Math.min(parseFloat(F.toFixed(6)), 1.0)
}

/**
 * Calcula el F individual del propio animal (basado en sus padres).
 * Retorna 0 si no tiene padres conocidos.
 */
export function calcularFIndividual(animal, pedigree) {
  if (!animal?.id_madre || !animal?.id_padre) return 0
  return calcularFCoeficiente(animal.id_madre, animal.id_padre, pedigree)
}

// ── Descripción en porcentaje ────────────────────────────────────────────────
export function fPorcentaje(f) {
  return (f * 100).toFixed(1)
}

export function nivelConsanguinidad(f) {
  if (f === 0)    return { nivel: 'nulo',   color: '#4a5f7a', label: 'Sin consanguinidad' }
  if (f < 0.0625) return { nivel: 'bajo',   color: '#00e676', label: 'Bajo (<6.25%)' }
  if (f < 0.125)  return { nivel: 'leve',   color: '#ffd740', label: 'Leve (6.25–12.5%)' }
  if (f < 0.25)   return { nivel: 'moderado', color: '#ff9100', label: 'Moderado (12.5–25%)' }
  return             { nivel: 'alto',    color: '#ff1744', label: 'Alto (≥25%)' }
}

// ── Detección de parentesco ──────────────────────────────────────────────────
/**
 * Detecta el tipo de parentesco entre dos animales.
 * Retorna null si no hay parentesco conocido en las generaciones disponibles.
 */
export function detectarParentesco(id1, id2, pedigree) {
  if (!id1 || !id2 || id1 === id2) return null
  const n1 = pedigree[id1]
  const n2 = pedigree[id2]
  if (!n1 || !n2) return null

  // Padre/madre — hijo
  if (n1.madre_id === id2 || n1.padre_id === id2) return 'padre_hijo'
  if (n2.madre_id === id1 || n2.padre_id === id1) return 'padre_hijo'

  // Hermanos completos
  if (n1.madre_id && n1.padre_id &&
      n1.madre_id === n2.madre_id && n1.padre_id === n2.padre_id) return 'hermanos_completos'

  // Medios hermanos (un progenitor en común)
  if (n1.madre_id && n1.madre_id === n2.madre_id) return 'medio_hermanos'
  if (n1.padre_id && n1.padre_id === n2.padre_id) return 'medio_hermanos'

  // Abuelo/abuela — nieto
  const abuelos1 = [
    pedigree[n1.madre_id],
    pedigree[n1.padre_id],
  ].filter(Boolean)
  for (const a of abuelos1) {
    if (a.madre_id === id2 || a.padre_id === id2) return 'abuelo_nieto'
  }
  const abuelos2 = [
    pedigree[n2.madre_id],
    pedigree[n2.padre_id],
  ].filter(Boolean)
  for (const a of abuelos2) {
    if (a.madre_id === id1 || a.padre_id === id1) return 'abuelo_nieto'
  }

  // Tío/tía — sobrino (comparten uno de los padres con un progenitor del otro)
  const padres1 = [n1.madre_id, n1.padre_id].filter(Boolean)
  const padres2 = [n2.madre_id, n2.padre_id].filter(Boolean)
  for (const p of padres1) {
    const np = pedigree[p]
    if (!np) continue
    for (const p2 of padres2) {
      if (np.madre_id === p2 || np.padre_id === p2) return 'tio_sobrino'
      const np2 = pedigree[p2]
      if (!np2) continue
      if (np2.madre_id === p || np2.padre_id === p) return 'tio_sobrino'
    }
  }

  // Primos (abuelos comunes)
  const abuelos1ids = abuelos1.flatMap((a) => [a.madre_id, a.padre_id]).filter(Boolean)
  const abuelos2ids = abuelos2.flatMap((a) => [a.madre_id, a.padre_id]).filter(Boolean)
  if (abuelos1ids.some((id) => abuelos2ids.includes(id))) return 'primos'

  return null
}

export const LABEL_PARENTESCO = {
  padre_hijo:        { texto: 'Padre/Madre — Hijo/a', emoji: '⛔' },
  hermanos_completos: { texto: 'Hermanos completos',   emoji: '⛔' },
  medio_hermanos:    { texto: 'Medio hermanos',         emoji: '⚠️' },
  abuelo_nieto:      { texto: 'Abuelo/a — Nieto/a',   emoji: '⚠️' },
  tio_sobrino:       { texto: 'Tío/a — Sobrino/a',    emoji: '⚠️' },
  primos:            { texto: 'Primos',                emoji: '🟡' },
}

// ── Árbol genealógico ─────────────────────────────────────────────────────────
/**
 * Construye un árbol de ancestros para un animal.
 * Retorna { id, codigo, sexo, madre: {...}, padre: {...} } hasta maxDepth generaciones.
 */
export function getAncestores(id, pedigree, maxDepth = 3) {
  if (!id || !pedigree[id] || maxDepth < 0) return null
  const node = pedigree[id]
  return {
    id:     node.id,
    codigo: node.codigo,
    sexo:   node.sexo,
    madre:  node.madre_id ? getAncestores(node.madre_id, pedigree, maxDepth - 1) : null,
    padre:  node.padre_id ? getAncestores(node.padre_id, pedigree, maxDepth - 1) : null,
  }
}

/**
 * Retorna las camadas donde este animal aparece como madre o padre.
 */
export function getDescendientes(id, camadas) {
  return camadas.filter((c) => c.id_madre === id || c.id_padre === id)
}

// ── Estadísticas de la colonia ────────────────────────────────────────────────
/**
 * Calcula estadísticas globales de consanguinidad para todos los animales activos.
 * Requiere el array de animales ya cargado + el pedigree construido.
 */
export function estadisticasColonia(animales, pedigree) {
  const activos = animales.filter((a) =>
    ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado)
  )

  const fValues = activos.map((a) => ({
    animal: a,
    f:      calcularFIndividual(a, pedigree),
    tieneAncestros: !!(a.id_madre || a.id_padre),
  }))

  const conAncestros = fValues.filter((v) => v.tieneAncestros)
  const sinAncestros = fValues.length - conAncestros.length

  const fPromedio = conAncestros.length
    ? conAncestros.reduce((s, v) => s + v.f, 0) / conAncestros.length
    : 0

  const distribucion = {
    nulo:     fValues.filter((v) => v.f === 0).length,
    bajo:     fValues.filter((v) => v.f > 0 && v.f < 0.0625).length,
    leve:     fValues.filter((v) => v.f >= 0.0625 && v.f < 0.125).length,
    moderado: fValues.filter((v) => v.f >= 0.125 && v.f < 0.25).length,
    alto:     fValues.filter((v) => v.f >= 0.25).length,
  }

  const masConsanguineos = [...fValues]
    .filter((v) => v.f > 0)
    .sort((a, b) => b.f - a.f)
    .slice(0, 10)

  return {
    total:          activos.length,
    sinAncestros,
    fPromedio,
    distribucion,
    masConsanguineos,
    fValues,
  }
}

// ── Evaluación de un apareamiento ────────────────────────────────────────────
/**
 * Evaluación completa de un apareamiento propuesto (madreId × padreId).
 * Retorna { f, nivel, parentesco, recomendacion }.
 */
export function evaluarApareamientoGenetico(madreId, padreId, pedigree) {
  if (!madreId || !padreId) return null

  const f          = calcularFCoeficiente(madreId, padreId, pedigree)
  const nivel      = nivelConsanguinidad(f)
  const parentesco = detectarParentesco(madreId, padreId, pedigree)

  let recomendacion = null
  if (parentesco === 'padre_hijo' || parentesco === 'hermanos_completos') {
    recomendacion = { tipo: 'bloqueo', texto: 'Apareamiento bloqueado — parentesco directo detectado' }
  } else if (f >= 0.25) {
    recomendacion = { tipo: 'bloqueo', texto: 'Consanguinidad muy alta — no recomendado' }
  } else if (f >= 0.125) {
    recomendacion = { tipo: 'advertencia', texto: 'Consanguinidad moderada — evaluar alternativas' }
  } else if (f > 0) {
    recomendacion = { tipo: 'aviso', texto: 'Consanguinidad leve — documentar' }
  }

  return { f, nivel, parentesco, recomendacion }
}
