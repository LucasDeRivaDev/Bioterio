import { useNavigate } from 'react-router-dom'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import logoSloganDark   from '../assets/iterate+logo+slogan.png'
import logoSloganLight  from '../assets/iterate+logo+sloganfondoclaro.png'
import sloganDark       from '../assets/iterate+slogan.png'
import sloganLight      from '../assets/iterate+sloganfondoclaro.png'
import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { hoy, parseDate, sumarDias } from '../utils/calculos'

const GRUPOS_RATONES = ['ratones_balbc', 'ratones_c57', 'ratones_hibridos']

// Fecha local de hace N días (YYYY-MM-DD) — parseDate usa T12:00, seguro ante offset UTC
const haceDias = (n) => sumarDias(parseDate(hoy()), -n).toISOString().slice(0, 10)

// ── Badge sanitario simplificado (sin camadas, solo incidentes) ───────────────
function badgeSanitario(incidentes, bioterioId, tema) {
  const hace90 = haceDias(90)
  const inc = incidentes.filter(i => i.bioterio_id === bioterioId && (i.fecha ?? '') >= hace90 && !i.resuelto)
  const graves    = inc.filter(i => i.severidad === 'grave').length
  const moderados = inc.filter(i => i.severidad === 'moderado').length
  if (graves > 0)    return { emoji: '🔴', label: 'Riesgo',   color: tema.red, count: inc.length }
  if (moderados > 1) return { emoji: '🟡', label: 'Atención', color: tema.amber, count: inc.length }
  if (inc.length > 0) return { emoji: '🟡', label: 'Atención', color: tema.amber, count: inc.length }
  return               { emoji: '🟢', label: 'Estable',   color: tema.accent, count: 0 }
}

const CSS = `
  @keyframes floatSelector { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
`

export default function SelectorBioterio() {
  const { setBioterioActivo } = useBioterioActivo()
  const { tema, modoBrillo } = useTheme()
  const navigate = useNavigate()
  const [logoW, setLogoW] = useState(340)
  const [incidentesSalud, setIncidentesSalud] = useState([])
  const [abierto, setAbierto] = useState(null) // 'ratas' | 'ratones' | 'global'

  useEffect(() => {
    const update = () => setLogoW(window.innerWidth < 480 ? 200 : window.innerWidth < 768 ? 260 : 340)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const hace90 = haceDias(90)
    supabase
      .from('incidentes')
      .select('bioterio_id, severidad, resuelto, fecha')
      .gte('fecha', hace90)
      .eq('resuelto', false)
      .then(({ data }) => { if (data) setIncidentesSalud(data) })
  }, [])

  const toggle = (seccion) => setAbierto(abierto === seccion ? null : seccion)

  // Modo claro: valores neutros para borders/fondos (reemplaza colores neon)
  const cl = modoBrillo
  const BL  = cl ? 'rgba(0,0,0,0.10)' : null   // borde leve
  const BA  = cl ? 'rgba(0,0,0,0.22)' : null   // borde activo
  const BT  = cl ? 'rgba(0,0,0,0.06)' : null   // borde divisor top
  const BG  = cl ? 'rgba(0,0,0,0.02)' : null   // fondo card leve
  const BH  = cl ? 'rgba(0,0,0,0.05)' : null   // fondo hover
  const BTN = cl ? 'rgba(0,0,0,0.08)' : null   // fondo botón

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center p-4 md:p-6 gap-6 md:gap-8"
      style={{ background: tema.bgMain, backgroundImage: tema.bgMainGrad, backgroundSize: '40px 40px' }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Botón volver a landing */}
      <button
        onClick={() => navigate('/inicio')}
        style={{
          position: 'absolute', top: '1rem', left: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.85rem', borderRadius: '0.6rem', cursor: 'pointer',
          fontSize: '0.75rem', fontWeight: 600,
          background: 'rgba(0,230,118,0.08)',
          border: '1px solid rgba(0,230,118,0.25)',
          color: '#00e676',
        }}
      >
        ← Ver página de inicio
      </button>

{/* Logo + Título juntos */}
      <div className="flex flex-col items-center" style={{ gap: '16px' }}>
        <div style={{
          position: 'relative',
          animation: 'floatSelector 4s ease-in-out infinite',
          mixBlendMode: modoBrillo ? 'multiply' : 'screen',
          filter: modoBrillo ? 'none' : 'brightness(1.15) saturate(1.1)',
        }}>
          {!cl && <div style={{ position: 'absolute', inset: '-40px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,230,118,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />}
          <img
            src={modoBrillo ? logoSloganLight : logoSloganDark}
            alt="ITeRatE"
            style={{ width: `${logoW}px`, height: 'auto', display: 'block' }}
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1" style={{ color: tema.textPrimary }}>Seleccioná el bioterio</h1>
          <p className="text-sm" style={{ color: tema.textMuted }}>¿Con qué colonia vas a trabajar hoy?</p>
        </div>
      </div>

      {/* Cards acordeón */}
      <div className="w-full max-w-xl flex flex-col gap-3">

        {/* ── Acordeón Ratas ── */}
        <div
          className="w-full rounded-2xl overflow-hidden transition-all duration-200"
          style={{ background: cl ? 'transparent' : 'rgba(0,230,118,0.04)', border: `1.5px solid ${abierto === 'ratas' ? (cl ? BA : 'rgba(0,230,118,0.5)') : (cl ? BL : 'rgba(0,230,118,0.25)')}` }}
        >
          <button
            className="w-full text-left px-6 py-4 flex items-center gap-4"
            onClick={() => toggle('ratas')}
          >
            <span className="text-3xl">🐀</span>
            <div className="flex-1">
              <div className="font-bold text-sm mb-0.5" style={{ color: tema.textPrimary }}>Bioterio de Ratas</div>
              <div className="text-xs font-mono italic">Rattus norvegicus</div>
            </div>
            <span style={{ fontSize: '18px', transition: 'transform 0.2s', transform: abierto === 'ratas' ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
          </button>

          <div style={{ maxHeight: abierto === 'ratas' ? '300px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
            <div className="px-6 pb-5" style={{ borderTop: `1px solid ${cl ? BT : 'rgba(0,230,118,0.12)'}` }}>
              <div className="flex flex-wrap gap-2 pt-3 mb-4">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: cl ? BG : 'rgba(0,230,118,0.1)', border: `1px solid ${cl ? BL : 'rgba(0,230,118,0.2)'}` }}>
                  Gestación 23d
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: cl ? BG : 'rgba(0,230,118,0.1)', border: `1px solid ${cl ? BL : 'rgba(0,230,118,0.2)'}` }}>
                  Madurez 12 sem.
                </span>
                {(() => {
                  const bs = badgeSanitario(incidentesSalud, 'ratas', tema)
                  return (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: cl ? BG : `${bs.color}18`, border: `1px solid ${cl ? BL : `${bs.color}40`}` }}>
                      {bs.emoji} {bs.label}{bs.count > 0 ? ` · ${bs.count}` : ''}
                    </span>
                  )
                })()}
              </div>
              <button
                onClick={() => setBioterioActivo('ratas')}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: cl ? BTN : 'rgba(0,230,118,0.15)', border: `1.5px solid ${cl ? BA : 'rgba(0,230,118,0.4)'}` }}
                onMouseEnter={e => e.currentTarget.style.background = cl ? BH : 'rgba(0,230,118,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = cl ? BTN : 'rgba(0,230,118,0.15)'}
              >
                Ingresar al bioterio →
              </button>
            </div>
          </div>
        </div>

        {/* ── Acordeón Ratones ── */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{ background: tema.bgCard, border: `1.5px solid ${abierto === 'ratones' ? (cl ? BA : 'rgba(64,196,255,0.45)') : (cl ? BL : 'rgba(64,196,255,0.2)')}` }}
        >
          <div
            role="button"
            tabIndex={0}
            className="w-full text-left px-6 py-4 flex items-center gap-3 cursor-pointer"
            onClick={() => toggle('ratones')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('ratones') } }}
          >
            <span className="text-3xl">🐭</span>
            <div className="flex-1">
              <div className="font-bold text-sm" style={{ color: tema.textPrimary }}>Bioterio de Ratones</div>
              <div className="text-xs font-mono italic">
                <span className="hidden sm:inline">Mus musculus · </span>Gestación 21d · Madurez 8 sem.
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setBioterioActivo('resumen_ratones') }}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: cl ? BG : 'rgba(64,196,255,0.12)', border: `1px solid ${cl ? BL : 'rgba(64,196,255,0.35)'}` }}
              onMouseEnter={e => e.currentTarget.style.background = cl ? BH : 'rgba(64,196,255,0.22)'}
              onMouseLeave={e => e.currentTarget.style.background = cl ? BG : 'rgba(64,196,255,0.12)'}
            >
              📊 Resumen
            </button>
            <span style={{ fontSize: '18px', transition: 'transform 0.2s', transform: abierto === 'ratones' ? 'rotate(90deg)' : 'rotate(0deg)', marginLeft: '8px' }}>›</span>
          </div>

          <div style={{ maxHeight: abierto === 'ratones' ? '400px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
            <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${cl ? BT : 'rgba(64,196,255,0.12)'}` }}>
              {GRUPOS_RATONES.map((id) => {
                const cfg = BIOTERIOS_CONFIG[id]
                return (
                  <button
                    key={id}
                    onClick={() => setBioterioActivo(id)}
                    className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
                    style={{ background: cl ? 'transparent' : 'rgba(255,255,255,0.03)', border: `1px solid ${cl ? BL : `${cfg.color}30`}`, color: tema.textPrimary }}
                    onMouseEnter={e => { e.currentTarget.style.background = cl ? BH : `${cfg.color}12`; e.currentTarget.style.border = `1px solid ${cl ? BA : `${cfg.color}60`}` }}
                    onMouseLeave={e => { e.currentTarget.style.background = cl ? 'transparent' : 'rgba(255,255,255,0.03)'; e.currentTarget.style.border = `1px solid ${cl ? BL : `${cfg.color}30`}` }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cl ? 'rgba(0,0,0,0.3)' : cfg.color }} />
                    <span className="font-semibold text-sm">{cfg.labelCorto}</span>
                    <span className="text-xs font-mono ml-1 hidden sm:inline">{cfg.nombreCientifico}</span>
                    {(() => {
                      const bs = badgeSanitario(incidentesSalud, id, tema)
                      return (
                        <span className="hidden sm:inline text-xs px-1.5 py-0.5 rounded-full font-mono" style={{ background: cl ? BG : `${bs.color}15`, border: `1px solid ${cl ? BL : `${bs.color}35`}` }}>
                          {bs.emoji}{bs.count > 0 ? ` ${bs.count}` : ''}
                        </span>
                      )
                    })()}
                    <span className="ml-auto text-xs">›</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Acordeón Vista Global ── */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{ background: tema.bgCard, border: `1px solid ${abierto === 'global' ? (cl ? BA : 'rgba(255,179,0,0.45)') : (cl ? BL : 'rgba(255,179,0,0.2)')}` }}
        >
          <button
            className="w-full text-left px-5 py-3.5 flex items-center gap-2"
            onClick={() => toggle('global')}
            style={{ background: cl ? 'transparent' : 'rgba(255,179,0,0.03)' }}
          >
            <span className="text-base">🌐</span>
            <span className="text-sm font-semibold">Vista global</span>
            <span className="text-xs font-mono">· Todos los bioterios</span>
            <span style={{ fontSize: '18px', marginLeft: 'auto', transition: 'transform 0.2s', transform: abierto === 'global' ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
          </button>

          <div style={{ maxHeight: abierto === 'global' ? '600px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
            <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${cl ? BT : 'rgba(255,179,0,0.1)'}` }}>
              <button
                onClick={() => setBioterioActivo('alimento_global')}
                className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
                style={{ background: cl ? 'transparent' : 'rgba(255,255,255,0.02)', border: `1px solid ${cl ? BL : 'rgba(255,179,0,0.25)'}` }}
                onMouseEnter={e => { e.currentTarget.style.background = cl ? BH : 'rgba(255,179,0,0.08)'; e.currentTarget.style.border = `1px solid ${cl ? BA : 'rgba(255,179,0,0.5)'}` }}
                onMouseLeave={e => { e.currentTarget.style.background = cl ? 'transparent' : 'rgba(255,255,255,0.02)'; e.currentTarget.style.border = `1px solid ${cl ? BL : 'rgba(255,179,0,0.25)'}` }}
              >
                <span className="text-sm">🌾</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">Consumo global de alimento</div>
                  <div className="text-xs font-mono">Ratas + Ratones · estimación diaria + predicción de duración</div>
                </div>
                <span className="text-xs">›</span>
              </button>

              <button
                onClick={() => setBioterioActivo('viruta_global')}
                className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
                style={{ background: cl ? 'transparent' : 'rgba(255,255,255,0.02)', border: `1px solid ${cl ? BL : 'rgba(139,92,246,0.25)'}` }}
                onMouseEnter={e => { e.currentTarget.style.background = cl ? BH : 'rgba(139,92,246,0.08)'; e.currentTarget.style.border = `1px solid ${cl ? BA : 'rgba(139,92,246,0.5)'}` }}
                onMouseLeave={e => { e.currentTarget.style.background = cl ? 'transparent' : 'rgba(255,255,255,0.02)'; e.currentTarget.style.border = `1px solid ${cl ? BL : 'rgba(139,92,246,0.25)'}` }}
              >
                <span className="text-sm">🪵</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">Consumo de viruta / camas</div>
                  <div className="text-xs font-mono">Ratas + Ratones · calculado por jaulas activas</div>
                </div>
                <span className="text-xs">›</span>
              </button>

              <button
                onClick={() => setBioterioActivo('capacidad_global')}
                className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
                style={{ background: cl ? 'transparent' : 'rgba(255,255,255,0.02)', border: `1px solid ${cl ? BL : 'rgba(255,61,87,0.25)'}` }}
                onMouseEnter={e => { e.currentTarget.style.background = cl ? BH : 'rgba(255,61,87,0.08)'; e.currentTarget.style.border = `1px solid ${cl ? BA : 'rgba(255,61,87,0.5)'}` }}
                onMouseLeave={e => { e.currentTarget.style.background = cl ? 'transparent' : 'rgba(255,255,255,0.02)'; e.currentTarget.style.border = `1px solid ${cl ? BL : 'rgba(255,61,87,0.25)'}` }}
              >
                <span className="text-sm">📊</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">Capacidad y predicción</div>
                  <div className="text-xs font-mono">Saturación estimada · candidatos a sacrificio · simulador</div>
                </div>
                <span className="text-xs">›</span>
              </button>

              <button
                onClick={() => setBioterioActivo('genealogia_global')}
                className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-150"
                style={{ background: cl ? 'transparent' : 'rgba(255,255,255,0.02)', border: `1px solid ${cl ? BL : 'rgba(167,139,250,0.25)'}` }}
                onMouseEnter={e => { e.currentTarget.style.background = cl ? BH : 'rgba(167,139,250,0.08)'; e.currentTarget.style.border = `1px solid ${cl ? BA : 'rgba(167,139,250,0.5)'}` }}
                onMouseLeave={e => { e.currentTarget.style.background = cl ? 'transparent' : 'rgba(255,255,255,0.02)'; e.currentTarget.style.border = `1px solid ${cl ? BL : 'rgba(167,139,250,0.25)'}` }}
              >
                <span className="text-sm">🧬</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">Genealogía y consanguinidad</div>
                  <div className="text-xs font-mono">Árbol genealógico · coeficiente F · simulador de apareamiento</div>
                </div>
                <span className="text-xs">›</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Pie de página */}
      <img
        src={modoBrillo ? sloganLight : sloganDark}
        alt="ITeRatE"
        style={{
          width: '520px',
          maxWidth: '90vw',
          height: 'auto',
          display: 'block',
          mixBlendMode: modoBrillo ? 'multiply' : 'screen',
          filter: modoBrillo ? 'none' : 'brightness(1.15) saturate(1.1)',
        }}
      />
    </div>
  )
}
