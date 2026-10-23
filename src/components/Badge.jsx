import { useTheme } from '../context/ThemeContext'

// Pastilla con tinte del color: el color comunica el estado (rojo crítico, verde ok…).
const TONOS = {
  rojo:     (t) => t.red,
  naranja:  (t, claro) => (claro ? '#c25e00' : '#ffa040'),
  azul:     (t) => t.blue,
  verde:    (t) => t.green,
  violeta:  (t) => t.purple,
  gris:     (t) => t.textSecondary,
  amarillo: (t) => t.amber,
  marron:   (t, claro) => (claro ? '#8a5a2b' : '#c09060'),
}

export default function Badge({ color = 'gris', children, size = 'normal' }) {
  const { tema, modoBrillo } = useTheme()
  const tono = (TONOS[color] ?? TONOS.gris)(tema, modoBrillo)
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap font-medium rounded border text-xs ${
        size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
      }`}
      style={{
        background: `color-mix(in srgb, ${tono} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${tono} 35%, transparent)`,
        color: tono,
      }}
    >
      {children}
    </span>
  )
}
