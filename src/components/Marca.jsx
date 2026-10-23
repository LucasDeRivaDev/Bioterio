// Piezas de marca de ITeRatE (generadas por scripts/generar-marca.mjs a partir de
// los logos originales: fondo transparente, recortadas). Cada una elige la versión
// para fondo oscuro o claro según el tema activo.
import { useTheme } from '../context/ThemeContext'
import isotipoOscuro from '../assets/marca/isotipo-oscuro.png'
import isotipoClaro from '../assets/marca/isotipo-claro.png'
import iconoOscuro from '../assets/marca/icono-oscuro.png'
import iconoClaro from '../assets/marca/icono-claro.png'
import logotipoOscuro from '../assets/marca/logotipo-oscuro.png'
import logotipoClaro from '../assets/marca/logotipo-claro.png'
import completoOscuro from '../assets/marca/logo-completo-oscuro.png'
import completoClaro from '../assets/marca/logo-completo-claro.png'

const PIEZAS = {
  isotipo: [isotipoOscuro, isotipoClaro, 256 / 274],     // antena sola
  icono: [iconoOscuro, iconoClaro, 360 / 214],           // antena con líneas de circuito
  logotipo: [logotipoOscuro, logotipoClaro, 900 / 250],  // "ITeRatE" + eslogan
  completo: [completoOscuro, completoClaro, 760 / 588],  // antena + nombre + eslogan
}

// `alto` en px; el ancho sale de la proporción de cada pieza.
export default function Marca({ pieza = 'logotipo', alto, className, decorativa = false }) {
  const { modoBrillo } = useTheme()
  const [oscuro, claro, proporcion] = PIEZAS[pieza]
  return (
    <img
      src={modoBrillo ? claro : oscuro}
      alt={decorativa ? '' : 'ITeRatE — Intelligence Telemetry for Rats Evaluation'}
      height={alto}
      width={Math.round(alto * proporcion)}
      className={className}
      style={{ height: alto, width: 'auto', display: 'block' }}
      draggable={false}
    />
  )
}
