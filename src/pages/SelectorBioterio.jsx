import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import iterateTitleLogo      from '../assets/iterate_logo.png'
import iterateTitleLogoLight from '../assets/iterate_logo_light.png'
import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'

const GRUPOS_RATONES = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// ── Badge sanitario simplificado (sin camadas, solo incidentes) ───────────────
function badgeSanitario(incidentes, bioterioId) {
  const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const inc = incidentes.filter(i => i.bioterio_id === bioterioId && (i.fecha ?? '') >= hace90 && !i.resuelto)
  const graves    = inc.filter(i => i.severidad === 'grave').length
  const moderados = inc.filter(i => i.severidad === 'moderado').length
  if (graves > 0)    return { emoji: '🔴', label: 'Riesgo',   color: '#ff6b80', count: inc.length }
  if (moderados > 1) return { emoji: '🟡', label: 'Atención', color: '#ffb300', count: inc.length }
  if (inc.length > 0) return { emoji: '🟡', label: 'Atención', color: '#ffb300', count: inc.length }
  return               { emoji: '🟢', label: 'Estable',   color: '#00e676', count: 0 }
}

const CSS = `
  @keyframes floatSelector { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
`

export default function SelectorBioterio() {
  const { setBioterioActivo } = useBioterioActivo()
  const { tema, modoBrillo } = useTheme()
  const [logoW, setLogoW] = useState(340)
  const [incidentesSalud, setIncidentesSalud] = useState([])

  useEffect(() => {
    const update = () => setLogoW(window.innerWidth < 480 ? 200 : window.innerWidth < 768 ? 260 : 340)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Carga ligera de incidentes abiertos en los últimos 90 días para badges
  useEffect(() => {
    const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    supabase
      .from('incidentes')
      .select('bioterio_id, severidad, resuelto, fecha')
      .gte('fecha', hace90)
      .eq('resuelto', false)
      .then(({ data }) => { if (data) setIncidentesSalud(data) })
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 gap-6 md:gap-10"
      style={{ background: tema.bgMain, backgroundImage: tema.bgMainGrad, backgroundSize: '40px 40px' }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Logo + Título juntos */}
      <div className="flex flex-col items-center" style={{ gap: '20px' }}>
        {/* Logo con mismo estilo que el hero de Landing */}
        <div style={{ position: 'relative', animation: 'floatSelector 4s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: '-40px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <img
            src={modoBrillo ? iterateTitleLogoLight : iterateTitleLogo}
            alt="ITeRatE"
            style={{
              width: `${logoW}px`,
              height: 'auto',
              display: 'block',
              filter: modoBrillo ? 'none' : 'drop-shadow(0 0 30px rgba(0,230,118,0.25))',
              mixBlendMode: modoBrillo ? 'multiply' : 'normal',
            }}
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: tema.textPrimary }}>Seleccioná el bioterio</h1>
          <p className="text-sm" style={{ color: tema.textMuted }}>¿Con qué colonia vas a trabajar hoy?</p>
        </div>
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
                {(() => {
                  const b = badgeSanitario(incidentesSalud, 'ratas')
                  return (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: `${b.color}18`, color: b.color, border: `1px solid ${b.color}40` }}>
                      {b.emoji} {b.label}{b.count > 0 ? ` · ${b.count}` : ''}
                    </span>
                  )
                })()}
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
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Bioterio de Ratones</div>
              <div className="text-xs font-mono italic" style={{ color: 'rgba(64,196,255,0.6)' }}>
                <span className="hidden sm:inline">Mus musculus · </span>Gestación 21d · Madurez 8 sem.
              </div>
            </div>
            <button
              onClick={() => setBioterioActivo('resumen_ratones')}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'rgba(64,196,255,0.12)', border: '1px solid rgba(64,196,255,0.35)', color: '#40c4ff' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(64,196,255,0.22)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(64,196,255,0.12)' }}
            >
              📊 Resumen
            </button>
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
                  {(() => {
                    const b = badgeSanitario(incidentesSalud, id)
                    return (
                      <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded-full font-mono" style={{ background: `${b.color}15`, color: b.color, border: `1px solid ${b.color}35` }}>
                        {b.emoji}{b.count > 0 ? ` ${b.count}` : ''}
                      </span>
                    )
                  })()}
                  <span className="ml-auto text-xs" style={{ color: cfg.color }}>›</span>
                </button>
              )
            })}

          </div>
        </div>

        {/* ── Sección vista global ── */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ background: 'rgba(13,21,40,0.4)', border: '1px solid rgba(255,179,0,0.2)' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,179,0,0.12)', background: 'rgba(255,179,0,0.04)' }}>
            <span className="text-base">🌾</span>
            <span className="text-xs font-semibold text-white">Vista global</span>
            <span className="text-xs font-mono" style={{ color: '#4a5f7a' }}>· Todos los bioterios</span>
          </div>
          <div className="p-3 space-y-2">
            <button
              onClick={() => setBioterioActivo('alimento_global')}
              className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,179,0,0.25)', color: '#c9d4e0' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,179,0,0.08)'
                e.currentTarget.style.border = '1px solid rgba(255,179,0,0.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.border = '1px solid rgba(255,179,0,0.25)'
              }}
            >
              <span className="text-sm">🌾</span>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: '#ffb300' }}>
                  Consumo global de alimento
                </div>
                <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                  Ratas + Ratones · estimación diaria + predicción de duración
                </div>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,179,0,0.5)' }}>›</span>
            </button>

            <button
              onClick={() => setBioterioActivo('viruta_global')}
              className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(139,92,246,0.25)', color: '#c9d4e0' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(139,92,246,0.08)'
                e.currentTarget.style.border = '1px solid rgba(139,92,246,0.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.border = '1px solid rgba(139,92,246,0.25)'
              }}
            >
              <span className="text-sm">🪵</span>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: '#a78bfa' }}>
                  Consumo de viruta / camas
                </div>
                <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                  Ratas + Ratones · calculado por jaulas activas
                </div>
              </div>
              <span className="text-xs" style={{ color: 'rgba(139,92,246,0.5)' }}>›</span>
            </button>

            <button
              onClick={() => setBioterioActivo('capacidad_global')}
              className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,61,87,0.25)', color: '#c9d4e0' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,61,87,0.08)'
                e.currentTarget.style.border = '1px solid rgba(255,61,87,0.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.border = '1px solid rgba(255,61,87,0.25)'
              }}
            >
              <span className="text-sm">📊</span>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: '#ff6b80' }}>
                  Capacidad y predicción
                </div>
                <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                  Saturación estimada · candidatos a sacrificio · simulador
                </div>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,61,87,0.5)' }}>›</span>
            </button>

            <button
              onClick={() => setBioterioActivo('genealogia_global')}
              className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(167,139,250,0.25)', color: '#c9d4e0' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(167,139,250,0.08)'
                e.currentTarget.style.border = '1px solid rgba(167,139,250,0.5)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.border = '1px solid rgba(167,139,250,0.25)'
              }}
            >
              <span className="text-sm">🧬</span>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: '#a78bfa' }}>
                  Genealogía y consanguinidad
                </div>
                <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>
                  Árbol genealógico · coeficiente F · simulador de apareamiento
                </div>
              </div>
              <span className="text-xs" style={{ color: 'rgba(167,139,250,0.5)' }}>›</span>
            </button>
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
