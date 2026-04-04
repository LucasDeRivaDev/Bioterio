// Badge científico oscuro

const estilos = {
  rojo:     { bg: 'rgba(255,61,87,0.15)',   texto: '#ff6b80',  borde: 'rgba(255,61,87,0.3)'   },
  naranja:  { bg: 'rgba(255,152,0,0.15)',   texto: '#ffb74d',  borde: 'rgba(255,152,0,0.3)'   },
  azul:     { bg: 'rgba(64,196,255,0.12)',  texto: '#40c4ff',  borde: 'rgba(64,196,255,0.25)' },
  verde:    { bg: 'rgba(0,230,118,0.12)',   texto: '#00e676',  borde: 'rgba(0,230,118,0.3)'   },
  violeta:  { bg: 'rgba(206,147,216,0.12)', texto: '#ce93d8',  borde: 'rgba(206,147,216,0.3)' },
  gris:     { bg: 'rgba(138,155,176,0.1)',  texto: '#8a9bb0',  borde: 'rgba(138,155,176,0.2)' },
  amarillo: { bg: 'rgba(255,179,0,0.12)',   texto: '#ffb300',  borde: 'rgba(255,179,0,0.3)'   },
  marron:   { bg: 'rgba(161,120,80,0.15)',  texto: '#a17850',  borde: 'rgba(161,120,80,0.3)'  },
}

export default function Badge({ color = 'gris', children, size = 'normal' }) {
  const est = estilos[color] ?? estilos.gris
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full tracking-wide ${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
      style={{
        background: est.bg,
        color: est.texto,
        border: `1px solid ${est.borde}`,
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.03em',
      }}
    >
      {children}
    </span>
  )
}
