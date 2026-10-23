// Genera src/assets/marca/*.png a partir de los logos originales de src/assets.
// Los originales tienen fondo opaco (negro o blanco) y mucho margen, y antes se
// integraban con mix-blend-mode. Acá se les quita el fondo (alfa calculado contra
// el color de fondo, así se conservan el brillo y las líneas finas), se recortan
// al contenido y se reducen de tamaño.
// Uso: node scripts/generar-marca.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const ORIGEN = new URL('../src/assets/', import.meta.url).pathname
const DESTINO = `${ORIGEN}marca/`
mkdirSync(DESTINO, { recursive: true })

const PIEZAS = [
  // [archivo original, salida, ancho máximo, recorte opcional del original]
  // Isotipo: solo la antena, sin las líneas de circuito, para tamaños chicos.
  ['logoiterate.png', 'isotipo-oscuro.png', 256, { left: 395, top: 190, width: 620, height: 680 }],
  ['logoiteratefondoclaro.png', 'isotipo-claro.png', 256, { left: 395, top: 190, width: 620, height: 680 }],
  ['logoiterate.png', 'icono-oscuro.png', 360],
  ['logoiteratefondoclaro.png', 'icono-claro.png', 360],
  ['iterate+slogan.png', 'logotipo-oscuro.png', 900],
  ['iterate+sloganfondoclaro.png', 'logotipo-claro.png', 900],
  ['iterate+logo+slogan.png', 'logo-completo-oscuro.png', 760],
  ['iterate+logo+sloganfondoclaro.png', 'logo-completo-claro.png', 760],
]

async function quitarFondo(archivo, recorte) {
  let base = sharp(ORIGEN + archivo)
  if (recorte) base = base.extract(recorte)
  const { data, info } = await base.removeAlpha().raw().toBuffer({ resolveWithObject: true })
  // Color de fondo = promedio de las cuatro esquinas.
  const px = (x, y) => [0, 1, 2].map((c) => data[(y * info.width + x) * 3 + c])
  const esquinas = [px(2, 2), px(info.width - 3, 2), px(2, info.height - 3), px(info.width - 3, info.height - 3)]
  const fondo = [0, 1, 2].map((c) => esquinas.reduce((s, e) => s + e[c], 0) / 4)
  const claro = fondo[0] + fondo[1] + fondo[2] > 382

  const salida = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i++) {
    const c = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]
    // Alfa mínimo que explica el píxel como (color · a) sobre el fondo.
    let a = 0
    for (let k = 0; k < 3; k++) {
      const d = claro ? (fondo[k] - c[k]) / Math.max(fondo[k], 1) : (c[k] - fondo[k]) / Math.max(255 - fondo[k], 1)
      a = Math.max(a, d)
    }
    a = Math.min(1, Math.max(0, a))
    if (a < 0.04) a = 0 // ruido del fondo
    for (let k = 0; k < 3; k++) {
      const v = a ? (c[k] - fondo[k] * (1 - a)) / a : 0
      salida[i * 4 + k] = Math.round(Math.min(255, Math.max(0, v)))
    }
    salida[i * 4 + 3] = Math.round(a * 255)
  }
  return sharp(salida, { raw: { width: info.width, height: info.height, channels: 4 } })
}

for (const [archivo, nombre, ancho, recorte] of PIEZAS) {
  const img = await quitarFondo(archivo, recorte)
  const recortada = await sharp(await img.png().toBuffer()).trim({ threshold: 1 }).toBuffer()
  const info = await sharp(recortada)
    .resize({ width: ancho, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toFile(DESTINO + nombre)
  console.log(nombre, `${info.width}×${info.height}`, `${Math.round(info.size / 1024)} KB`)
}
