// Ícono SVG de GenERats — rat + ADN, sin texto, sin fondo
// Usar prop `prefix` único por instancia para evitar conflictos de IDs SVG
export default function GenERatsIcon({ size = 100, prefix = 'gr', style = {} }) {
  const rg = `${prefix}Rat`
  const dg = `${prefix}Dna`
  const gl = `${prefix}Glow`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <defs>
        <linearGradient id={rg} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#40c4ff" />
          <stop offset="60%" stopColor="#00e676" />
          <stop offset="100%" stopColor="#a8e063" />
        </linearGradient>
        <linearGradient id={dg} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00e676" />
          <stop offset="100%" stopColor="#a8e063" />
        </linearGradient>
        <filter id={gl} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Cuerpo del ratón ── */}
      <path
        d="M50 8 C18 8, 4 28, 4 55 C4 76, 18 92, 42 95 C57 98, 78 91, 88 76 C98 61, 95 36, 82 22"
        fill="none"
        stroke={`url(#${rg})`}
        strokeWidth="3.8"
        strokeLinecap="round"
        filter={`url(#${gl})`}
      />

      {/* ── Cabeza ── */}
      <ellipse
        cx="82" cy="18" rx="14" ry="11"
        fill="rgba(5,8,16,0.92)"
        stroke={`url(#${rg})`}
        strokeWidth="3.4"
      />

      {/* ── Oreja ── */}
      <ellipse
        cx="74" cy="9" rx="6" ry="7"
        fill="rgba(5,8,16,0.92)"
        stroke={`url(#${rg})`}
        strokeWidth="3"
      />
      <ellipse cx="74" cy="9" rx="3" ry="4" fill="rgba(0,230,118,0.18)" />

      {/* ── Ojo ── */}
      <circle cx="87" cy="15" r="2.8" fill="#40c4ff" filter={`url(#${gl})`} />
      <circle cx="87" cy="15" r="1.1" fill="white" />

      {/* ── Nariz ── */}
      <circle cx="95" cy="21" r="2" fill="#00e676" filter={`url(#${gl})`} />

      {/* ── Bigotes ── */}
      <line x1="96" y1="19.5" x2="100" y2="16" stroke="#40c4ff" strokeWidth="0.9" opacity="0.7" strokeLinecap="round" />
      <line x1="96" y1="21"   x2="100" y2="21" stroke="#40c4ff" strokeWidth="0.9" opacity="0.7" strokeLinecap="round" />
      <line x1="96" y1="22.5" x2="100" y2="26" stroke="#40c4ff" strokeWidth="0.9" opacity="0.7" strokeLinecap="round" />

      {/* ── Cola ── */}
      <path
        d="M42 95 C30 100, 13 96, 6 88"
        fill="none"
        stroke={`url(#${rg})`}
        strokeWidth="3"
        strokeLinecap="round"
        filter={`url(#${gl})`}
      />

      {/* ── Hebras del ADN ── */}
      <path
        d="M34 28 Q43 39, 34 50 Q25 61, 34 72"
        fill="none"
        stroke={`url(#${dg})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        filter={`url(#${gl})`}
      />
      <path
        d="M56 28 Q47 39, 56 50 Q65 61, 56 72"
        fill="none"
        stroke={`url(#${dg})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        filter={`url(#${gl})`}
      />

      {/* ── Peldaños del ADN ── */}
      <line x1="34.5" y1="33"   x2="55.5" y2="33"   stroke="#00e676" strokeWidth="1.8" opacity="0.85" strokeLinecap="round" />
      <line x1="27"   y1="43.5" x2="63"   y2="43.5" stroke="#00e676" strokeWidth="1.8" opacity="0.85" strokeLinecap="round" />
      <line x1="27"   y1="56.5" x2="63"   y2="56.5" stroke="#a8e063" strokeWidth="1.8" opacity="0.85" strokeLinecap="round" />
      <line x1="34.5" y1="67"   x2="55.5" y2="67"   stroke="#a8e063" strokeWidth="1.8" opacity="0.85" strokeLinecap="round" />

      {/* ── Puntos en las uniones de los peldaños ── */}
      {[
        [34.5, 33,   '#00e676'],
        [55.5, 33,   '#00e676'],
        [27,   43.5, '#40c4ff'],
        [63,   43.5, '#40c4ff'],
        [27,   56.5, '#40c4ff'],
        [63,   56.5, '#40c4ff'],
        [34.5, 67,   '#a8e063'],
        [55.5, 67,   '#a8e063'],
      ].map(([cx, cy, fill]) => (
        <circle key={`${prefix}-${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill={fill} />
      ))}
    </svg>
  )
}
