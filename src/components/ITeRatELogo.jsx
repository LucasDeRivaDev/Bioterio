import iterateLogo from '../assets/iterate_logo.png'

/**
 * Logo de ITeRatE — imagen con texto "ITeRatE + Intelligence Telemetry for Rats Evaluation".
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
        display: 'block',
        ...style,
      }}
    />
  )
}
