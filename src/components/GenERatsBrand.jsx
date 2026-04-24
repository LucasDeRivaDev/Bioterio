import GenERatsIcon from './GenERatsIcon'

export default function GenERatsBrand({
  iconSize = 56,
  nameSize = 44,
  sloganSize = 18,
  sublineSize = 12,
  gap = 14,
  align = 'center',
  showSubline = true,
  iconPrefix = 'brand',
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${gap}px`,
        ...style,
      }}
    >
      <GenERatsIcon size={iconSize} prefix={iconPrefix} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: align === 'center' ? 'center' : 'flex-start',
          textAlign: align,
          lineHeight: 1,
        }}
      >
        <div
          style={{
            fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
            fontSize: `${nameSize}px`,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: '#d8e4ef',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: '#7fd8ff' }}>Gen</span>
          <span style={{ color: '#b7ef74' }}>E</span>
          <span style={{ color: '#d8e4ef' }}>Rats</span>
        </div>
        <div
          style={{
            marginTop: '6px',
            fontFamily: '"IBM Plex Sans", "Source Sans 3", sans-serif',
            fontSize: `${sloganSize}px`,
            fontWeight: 500,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            color: '#8bc7ea',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Genetically </span>
          <span style={{ color: '#b7ef74' }}>Evolving </span>
          <span>Rats</span>
        </div>
        {showSubline && (
          <div
            style={{
              marginTop: '8px',
              fontFamily: '"IBM Plex Sans", "Source Sans 3", sans-serif',
              fontSize: `${sublineSize}px`,
              fontWeight: 400,
              letterSpacing: '0.015em',
              color: '#5d85a8',
              whiteSpace: 'nowrap',
            }}
          >
            Colony management & genetic optimization system
          </div>
        )}
      </div>
    </div>
  )
}
