import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import GenERatsBrand from '../components/GenERatsBrand'

const GRUPOS_RATONES = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

export default function SelectorBioterio() {
  const { setBioterioActivo } = useBioterioActivo()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 gap-10"
      style={{ background: '#050810' }}
    >
      {/* Logo */}
      <GenERatsBrand
        iconSize={56}
        nameSize={36}
        sloganSize={12}
        align="center"
        iconPrefix="selectorBrand"
        showSubline={false}
      />

      {/* Título */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Seleccioná el bioterio</h1>
        <p className="text-sm" style={{ color: '#4a5f7a' }}>¿Con qué colonia vas a trabajar hoy?</p>
      </div>

      {/* Cards */}
      <div className="w-full max-w-xl flex flex-col gap-4">

        {/* ── Card Ratas ── */}
        <button
          onClick={() => setBioterioActivo('ratas')}
          className="w-full text-left rounded-2xl overflow-hidden transition-all duration-200"
          style={{
            background: 'rgba(0,230,118,0.05)',
            border: '1.5px solid rgba(0,230,118,0.25)',
            boxShadow: '0 0 0 0 rgba(0,230,118,0)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,230,118,0.1)'
            e.currentTarget.style.border = '1.5px solid rgba(0,230,118,0.5)'
            e.currentTarget.style.boxShadow = '0 0 24px rgba(0,230,118,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,230,118,0.05)'
            e.currentTarget.style.border = '1.5px solid rgba(0,230,118,0.25)'
            e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,230,118,0)'
          }}
        >
          <div className="px-6 py-5 flex items-center gap-4">
            <span className="text-4xl">🐀</span>
            <div className="flex-1">
              <div className="font-bold text-white text-base mb-0.5">Bioterio de Ratas</div>
              <div className="text-xs font-mono italic" style={{ color: 'rgba(0,230,118,0.6)' }}>
                Rattus norvegicus
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}>
                  Gestación 23d
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,230,118,0.1)', color: '#00e676', border: '1px solid rgba(0,230,118,0.2)' }}>
                  Madurez 12 sem.
                </span>
              </div>
            </div>
            <span style={{ color: 'rgba(0,230,118,0.5)', fontSize: '20px' }}>›</span>
          </div>
        </button>

        {/* ── Card Ratones ── */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(13,21,40,0.6)',
            border: '1.5px solid rgba(64,196,255,0.2)',
          }}
        >
          {/* Encabezado ratones */}
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{ borderBottom: '1px solid rgba(64,196,255,0.15)', background: 'rgba(64,196,255,0.04)' }}
          >
            <span className="text-3xl">🐭</span>
            <div>
              <div className="font-bold text-white text-sm">Bioterio de Ratones</div>
              <div className="text-xs font-mono italic" style={{ color: 'rgba(64,196,255,0.6)' }}>
                <span className="hidden sm:inline">Mus musculus · </span>Gestación 21d · Madurez 8 sem.
              </div>
            </div>
          </div>

          {/* Subgrupos */}
          <div className="p-3 space-y-2">
            {GRUPOS_RATONES.map((id) => {
              const cfg = BIOTERIOS_CONFIG[id]
              return (
                <button
                  key={id}
                  onClick={() => setBioterioActivo(id)}
                  className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${cfg.color}30`,
                    color: '#c9d4e0',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${cfg.color}12`
                    e.currentTarget.style.border = `1px solid ${cfg.color}60`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.border = `1px solid ${cfg.color}30`
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: cfg.color }}
                  />
                  <span className="font-semibold text-sm">{cfg.labelCorto}</span>
                  <span className="text-xs font-mono ml-1 hidden sm:inline" style={{ color: '#4a5f7a' }}>
                    {cfg.nombreCientifico}
                  </span>
                  <span className="ml-auto text-xs" style={{ color: cfg.color }}>›</span>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Pie de página */}
      <p className="text-xs font-mono text-center" style={{ color: 'rgba(74,95,122,0.4)' }}>
        Tu selección se recuerda hasta que la cambies
      </p>
    </div>
  )
}
