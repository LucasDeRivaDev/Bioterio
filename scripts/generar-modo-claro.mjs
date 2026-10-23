// Genera src/styles/modo-claro-colores.css.
// Las páginas usan muchos colores inline pensados para fondo oscuro (neón, grises claros).
// En modo claro, en vez de forzar todo el texto a negro, cada color se remapea a una
// variante legible sobre blanco, conservando su significado (verde = ok, rojo = crítico…).
// Los selectores matchean el atributo style tal como lo serializa el navegador: rgb(r, g, b).
// Uso: node scripts/generar-modo-claro.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../src/', import.meta.url).pathname
const OUT = join(SRC, 'styles/modo-claro-colores.css')

function archivos(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? archivos(p) : /\.jsx?$/.test(f) ? [p] : []
  })
}

const colores = new Map() // 'r, g, b' → [r, g, b]
for (const f of archivos(SRC)) {
  const txt = readFileSync(f, 'utf8')
  for (const m of txt.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g)) {
    let h = m[1]
    if (h.length === 3) h = [...h].map((c) => c + c).join('')
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    colores.set(rgb.join(', '), rgb)
  }
  for (const m of txt.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    const rgb = [m[1], m[2], m[3]].map(Number)
    colores.set(rgb.join(', '), rgb)
  }
}

function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

const hex = (h, s, l) => {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Color de texto legible sobre blanco, o null si ya lo es.
function textoClaro(rgb) {
  const [h, s, l] = hsl(rgb)
  if (s < 0.28) {
    if (l > 0.72) return 'var(--ink)'
    if (l > 0.45) return 'var(--ink-soft)'
    if (l > 0.12) return 'var(--ink-faint)'
    return null
  }
  if (l <= 0.42) return null
  // Amarillos y verdes necesitan oscurecerse más para llegar a contraste AA.
  const lObjetivo = h >= 40 && h <= 170 ? 0.3 : 0.4
  return hex(h, Math.min(s, 0.85), lObjetivo)
}

// Fondos y bordes oscuros (superficies del tema oscuro escritas a mano).
const esSuperficieOscura = (rgb) => { const [, s, l] = hsl(rgb); return l < 0.22 && s < 0.6 && l > 0.005 }

const sel = (prop, rgb, extra = '') => [
  `html.modo-claro [style^="${prop}: rgb(${rgb})${extra}"]`,
  `html.modo-claro [style*="; ${prop}: rgb(${rgb})${extra}"]`,
  `html.modo-claro [style^="${prop}: rgba(${rgb},"]`,
  `html.modo-claro [style*="; ${prop}: rgba(${rgb},"]`,
]

const reglas = []
for (const [clave, rgb] of [...colores].sort()) {
  const t = textoClaro(rgb)
  if (t) reglas.push(`${sel('color', clave).join(',\n')} { color: ${t} !important; }`)
  if (esSuperficieOscura(rgb)) {
    reglas.push(`${[...sel('background', clave), ...sel('background-color', clave)].join(',\n')} { background: var(--surface) !important; }`)
    reglas.push(`html.modo-claro [style*="solid rgb(${clave})"],\nhtml.modo-claro [style*="solid rgba(${clave},"] { border-color: var(--line) !important; }`)
  }
}

// Colores con nombre: el navegador los serializa tal cual ("color: white").
reglas.push(`${['white', '#fff'].flatMap((c) => [
  `html.modo-claro [style^="color: ${c}"]`,
  `html.modo-claro [style*="; color: ${c}"]`,
]).join(',\n')} { color: var(--ink) !important; }`)

mkdirSync(join(SRC, 'styles'), { recursive: true })
writeFileSync(OUT, `/* Generado por scripts/generar-modo-claro.mjs — no editar a mano. */\n\n${reglas.join('\n\n')}\n`)
console.log(`${reglas.length} reglas → ${OUT}`)
