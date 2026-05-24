// ─────────────────────────────────────────────────────────────────────────────
// genealogia.js — árbol genealógico y coeficiente de consanguinidad (Wright)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consanguinidad histórica de línea por bioterio.
 * Las cepas consanguíneas establecidas (BALB/c, C57BL/6) tienen F ≈ 99.9%
 * por décadas de hermano-hermana. Los F1 son heterocigotos totales (F ≈ 0).
 */
export const CONSANGUINIDAD_LINEA = {
  ratones_balbc: {
    label: 'BALB/c',
    fLinea: 0.999,
    descripcion: 'Cepa consanguínea establecida — F histórica ≈ 99.9%',
    nota: 'Más de 200 generaciones de apareamiento entre hermanos',
    color: '#a78bfa',
  },
  ratones_c57: {
    label: 'C57BL/6',
    fLinea: 0.999,
    descripcion: 'Cepa consanguínea establecida — F histórica ≈ 99.9%',
    nota: 'Alta homocigosidad en todos los loci; fenotipo muy estable',
    color: '#40c4ff',
  },
  ratones_hibridos: {
    label: 'F1 (BALB/c × C57BL/6)',
    fLinea: 0,
    descripcion: 'Cruce entre cepas puras — heterocigosis total (F ≈ 0)',
    nota: 'Los híbridos F1 son uniformes y más vigorosos (heterosis)',
    color: '#00e676',
  },
  ratas: {
    label: 'Ratas (colonia cerrada)',
    fLinea: null,
    descripcion: 'Colonia cerrada — consanguinidad calculada desde registros',
    nota: 'El F real depende del historial reproductivo registrado',
    color: '#ffd740',
  },
}

/**
 * Construye un mapa id → nodo a partir del array de animales.
 * Acepta opcionalmente un array de camadas para recuperar parentesco
 * de animales cuya nota contiene el sufijo de camada origen.
 */
export function buildPedigree(animales, camadas = []) {
  // Índice rápido de camadas por los últimos 6 chars del ID
  const camadaPorSufijo = {}
  for (const c of camadas) {
    if (c.id) camadaPorSufijo[c.id.slice(-6)] = c
  }

  const pedigree = {}
  for (const a of animales) {
    let madreId = a.id_madre ?? null
    let padreId = a.id_padre ?? null

    // Intento de recuperación desde notas si faltan padres
    // Formato: "Stock → reproductor · camada ...XXXXXX"
    if ((!madreId || !padreId) && a.notas) {
      const match = a.notas.match(/camada \.\.\.([a-z0-9]{6})/i)
      if (match) {
        const camada = camadaPorSufijo[match[1]]
        if (camada) {
          madreId = madreId ?? (camada.id_madre || null)
          padreId = padreId ?? (camada.id_padre || null)
        }
      }
    }

    pedigree[a.id] = {
      id:               a.id,
      codigo:           a.codigo,
      sexo:             a.sexo,
      estado:           a.estado,
      bioterio_id:      a.bioterio_id ?? null,
      fecha_nacimiento: a.fecha_nacimiento ?? null,
      madre_id:         madreId,
      padre_id:         padreId,
    }
  }
  return pedigree
}

// ── Mapa de ancestros con profundidades ──────────────────────────────────────
// Devuelve Map<id, Set<depth>> — el mismo ancestro puede aparecer a distintas
// profundidades si el pedigree está cruzado.
export function buildAncestorMap(id, pedigree, maxDepth = 8) {
  const result  = new Map()
  const visited = new Set()

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
 */
export function calcularFCoeficiente(madreId, padreId, pedigree, maxDepth = 8) {
  if (!madreId || !padreId) return 0
  if (madreId === padreId) return 1.0

  const mapSire = buildAncestorMap(padreId, pedigree, maxDepth)
  const mapDam  = buildAncestorMap(madreId, pedigree, maxDepth)

  let F = 0

  for (const [ancestorId, depthsSire] of mapSire) {
    if (!mapDam.has(ancestorId)) continue
    const depthsDam = mapDam.get(ancestorId)
    for (const d1 of depthsSire) {
      for (const d2 of depthsDam) {
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
  const madreId = animal?.id_madre ?? pedigree[animal?.id]?.madre_id
  const padreId = animal?.id_padre ?? pedigree[animal?.id]?.padre_id
  if (!madreId || !padreId) return 0
  return calcularFCoeficiente(madreId, padreId, pedigree)
}

// ── Descripción en porcentaje ────────────────────────────────────────────────
export function fPorcentaje(f) {
  return (f * 100).toFixed(1)
}

export function nivelConsanguinidad(f) {
  if (f === 0)     return { nivel: 'nulo',     color: '#4a5f7a', label: 'Sin consanguinidad' }
  if (f < 0.0625)  return { nivel: 'bajo',     color: '#00e676', label: 'Bajo (<6.25%)' }
  if (f < 0.125)   return { nivel: 'leve',     color: '#ffd740', label: 'Leve (6.25–12.5%)' }
  if (f < 0.25)    return { nivel: 'moderado', color: '#ff9100', label: 'Moderado (12.5–25%)' }
  return              { nivel: 'alto',     color: '#ff1744', label: 'Alto (≥25%)' }
}

// ── Estado genealógico del animal ────────────────────────────────────────────
/**
 * Devuelve el estado del árbol genealógico de un animal:
 * - 'completo'      🟢 Tiene padres Y abuelos registrados
 * - 'parcial'       🟡 Tiene padres pero sin abuelos (o solo uno de cada lado)
 * - 'insuficiente'  🔴 Sin padres registrados (fundador o dato faltante)
 */
export function estadoGenealogiaAnimal(animal, pedigree) {
  const nodo = pedigree[animal?.id]
  const madreId = animal?.id_madre ?? nodo?.madre_id ?? null
  const padreId = animal?.id_padre ?? nodo?.padre_id ?? null

  if (!madreId && !padreId) {
    return { estado: 'insuficiente', generaciones: 0, label: 'Información insuficiente', emoji: '🔴', tienePadres: false }
  }

  // Verificar abuelos
  const nodMadre = madreId ? pedigree[madreId] : null
  const nodPadre = padreId ? pedigree[padreId] : null

  const tieneAbuelos = !!(
    nodMadre?.madre_id || nodMadre?.padre_id ||
    nodPadre?.madre_id || nodPadre?.padre_id
  )

  // Verificar bisabuelos
  let tieneBisabuelos = false
  if (tieneAbuelos) {
    const abuelos = [
      nodMadre?.madre_id ? pedigree[nodMadre.madre_id] : null,
      nodMadre?.padre_id ? pedigree[nodMadre.padre_id] : null,
      nodPadre?.madre_id ? pedigree[nodPadre.madre_id] : null,
      nodPadre?.padre_id ? pedigree[nodPadre.padre_id] : null,
    ].filter(Boolean)
    tieneBisabuelos = abuelos.some((a) => a.madre_id || a.padre_id)
  }

  if (tieneAbuelos) {
    return {
      estado: 'completo',
      generaciones: tieneBisabuelos ? 4 : 3,
      label: 'Árbol completo',
      emoji: '🟢',
      tienePadres: true,
    }
  }

  return {
    estado: 'parcial',
    generaciones: 2,
    label: 'Árbol parcial',
    emoji: '🟡',
    tienePadres: true,
  }
}

// ── Ancestros comunes entre dos animales ─────────────────────────────────────
/**
 * Retorna la lista de ancestros comunes entre dos progenitores,
 * con su profundidad en cada árbol. Usado para el simulador de apareamiento.
 */
export function ancestrosComunes(madreId, padreId, pedigree) {
  if (!madreId || !padreId) return []

  const mapMadre = buildAncestorMap(madreId, pedigree, 8)
  const mapPadre = buildAncestorMap(padreId, pedigree, 8)

  const comunes = []
  for (const [ancestorId, depthsMadre] of mapMadre) {
    if (!mapPadre.has(ancestorId)) continue
    const depthsPadre = mapPadre.get(ancestorId)

    // Descartamos el caso donde ambos progenitores son el mismo animal
    const tieneParValido = [...depthsMadre].some((d1) =>
      [...depthsPadre].some((d2) => !(d1 === 0 && d2 === 0))
    )
    if (!tieneParValido) continue

    const nodo = pedigree[ancestorId]
    comunes.push({
      id: ancestorId,
      codigo: nodo?.codigo ?? '?',
      sexo: nodo?.sexo ?? null,
      profMadre: Math.min(...depthsMadre),
      profPadre: Math.min(...depthsPadre),
    })
  }

  // Ordenar por cercanía (menor suma de profundidades primero)
  return comunes.sort((a, b) => (a.profMadre + a.profPadre) - (b.profMadre + b.profPadre))
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

  if (n1.madre_id === id2 || n1.padre_id === id2) return 'padre_hijo'
  if (n2.madre_id === id1 || n2.padre_id === id1) return 'padre_hijo'

  if (n1.madre_id && n1.padre_id &&
      n1.madre_id === n2.madre_id && n1.padre_id === n2.padre_id) return 'hermanos_completos'

  if (n1.madre_id && n1.madre_id === n2.madre_id) return 'medio_hermanos'
  if (n1.padre_id && n1.padre_id === n2.padre_id) return 'medio_hermanos'

  const abuelos1 = [pedigree[n1.madre_id], pedigree[n1.padre_id]].filter(Boolean)
  for (const a of abuelos1) {
    if (a.madre_id === id2 || a.padre_id === id2) return 'abuelo_nieto'
  }
  const abuelos2 = [pedigree[n2.madre_id], pedigree[n2.padre_id]].filter(Boolean)
  for (const a of abuelos2) {
    if (a.madre_id === id1 || a.padre_id === id1) return 'abuelo_nieto'
  }

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

  const abuelos1ids = abuelos1.flatMap((a) => [a.madre_id, a.padre_id]).filter(Boolean)
  const abuelos2ids = abuelos2.flatMap((a) => [a.madre_id, a.padre_id]).filter(Boolean)
  if (abuelos1ids.some((id) => abuelos2ids.includes(id))) return 'primos'

  return null
}

export const LABEL_PARENTESCO = {
  padre_hijo:         { texto: 'Padre/Madre — Hijo/a', emoji: '⛔' },
  hermanos_completos: { texto: 'Hermanos completos',    emoji: '⛔' },
  medio_hermanos:     { texto: 'Medio hermanos',        emoji: '⚠️' },
  abuelo_nieto:       { texto: 'Abuelo/a — Nieto/a',   emoji: '⚠️' },
  tio_sobrino:        { texto: 'Tío/a — Sobrino/a',    emoji: '⚠️' },
  primos:             { texto: 'Primos',                emoji: '🟡' },
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
 * Acepta un pedigree opcional separado para usar el global en lugar del local.
 */
export function estadisticasColonia(animales, pedigree, pedigreeExtendido = null) {
  const ped = pedigreeExtendido ?? pedigree

  const activos = animales.filter((a) =>
    ['activo', 'en_apareamiento', 'en_cria'].includes(a.estado)
  )

  const fValues = activos.map((a) => {
    const nodo = ped[a.id]
    const madreId = a.id_madre ?? nodo?.madre_id ?? null
    const padreId = a.id_padre ?? nodo?.padre_id ?? null
    return {
      animal: a,
      f: (madreId && padreId) ? calcularFCoeficiente(madreId, padreId, ped) : 0,
      tieneAncestros: !!(madreId || padreId),
    }
  })

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
    total: activos.length,
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
 * Retorna { f, nivel, parentesco, recomendacion, comunes }.
 */
export function evaluarApareamientoGenetico(madreId, padreId, pedigree) {
  if (!madreId || !padreId) return null

  const f          = calcularFCoeficiente(madreId, padreId, pedigree)
  const nivel      = nivelConsanguinidad(f)
  const parentesco = detectarParentesco(madreId, padreId, pedigree)
  const comunes    = ancestrosComunes(madreId, padreId, pedigree)

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

  return { f, nivel, parentesco, recomendacion, comunes }
}
