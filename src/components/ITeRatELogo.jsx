import iterateLogo from '../assets/iterate_logo.jpg'

/**
 * Logo de ITeRatE — usa la imagen original con mix-blend-mode: screen
 * para que el fondo oscuro desaparezca sobre cualquier fondo oscuro.
 *
 * Props:
 *   height    — alto en px (el ancho escala proporcional). Default: 60
 *   style     — estilos adicionales en el contenedor
 */
export default function ITeRatELogo({ height = 60, style = {} }) {
  return (
    <img
      src={iterateLogo}
      alt="ITeRatE"
      style={{
        height: `${height}px`,
        width: 'auto',
        mixBlendMode: 'screen',
        display: 'block',
        ...style,
      }}
    />
  )
}
