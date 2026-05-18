import iterateLogo      from '../assets/iterate_logo.png'
import iterateLogoLight from '../assets/iterate_logo_light.png'
import { useTheme } from '../context/ThemeContext'

/**
 * Logo de ITeRatE — cambia automáticamente entre la versión oscura y clara
 * según el modo activo. Modo oscuro: iterate_logo.png · Modo claro: iterate_logo_light.png
 *
 * Props:
 *   height    — alto en px (el ancho escala proporcional). Default: 60
 *   style     — estilos adicionales en el contenedor
 *   forceDark — si true, siempre usa la versión oscura (ej: para impresión)
 */
export default function ITeRatELogo({ height = 60, style = {}, forceDark = false }) {
  const { modoBrillo } = useTheme()
  const src = (!forceDark && modoBrillo) ? iterateLogoLight : iterateLogo

  return (
    <img
      src={src}
      alt="ITeRatE"
      style={{
        height: `${height}px`,
        width: 'auto',
        display: 'block',
        ...style,
      }}
    />
  )
}
