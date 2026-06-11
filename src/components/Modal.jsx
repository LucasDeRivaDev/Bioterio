import { useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function Modal({ titulo, onCerrar, children, ancho = 'max-w-lg' }) {
  const { tema, modoBrillo } = useTheme()
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onCerrar}
      />
      {/* Panel */}
      <div
        className={`relative w-full ${ancho} max-h-[90vh] flex flex-col rounded-2xl overflow-hidden`}
        style={{
          background: modoBrillo ? '#FFFFFF' : '#0d1528',
          border: modoBrillo ? `1px solid ${tema.bgCardBorde}` : '1px solid rgba(0,230,118,0.2)',
          boxShadow: modoBrillo
            ? '0 24px 48px rgba(0,0,0,0.25)'
            : '0 0 40px rgba(0,230,118,0.08), 0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${tema.accentBorde}`, background: tema.accentDim }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-1.5 h-5 rounded-full"
              style={{ background: tema.accent, boxShadow: modoBrillo ? 'none' : '0 0 8px rgba(0,230,118,0.6)' }}
            />
            <h2 className="text-base font-semibold tracking-wide" style={{ color: tema.textPrimary }}>{titulo}</h2>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ color: tema.textSecondary, background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.15)' }}
          >
            ✕
          </button>
        </div>
        {/* Contenido */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
