import { useEffect } from 'react'

export default function Modal({ titulo, onCerrar, children, ancho = 'max-w-lg' }) {
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
        style={{ background: 'rgba(5,8,16,0.85)' }}
        onClick={onCerrar}
      />
      {/* Panel */}
      <div
        className={`relative w-full ${ancho} max-h-[90vh] flex flex-col rounded-2xl overflow-hidden`}
        style={{
          background: '#0d1528',
          border: '1px solid rgba(0,230,118,0.2)',
          boxShadow: '0 0 40px rgba(0,230,118,0.08), 0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(0,230,118,0.12)', background: 'rgba(0,230,118,0.03)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-1.5 h-5 rounded-full"
              style={{ background: '#00e676', boxShadow: '0 0 8px rgba(0,230,118,0.6)' }}
            />
            <h2 className="text-base font-semibold text-white tracking-wide">{titulo}</h2>
          </div>
          <button
            onClick={onCerrar}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ color: '#8a9bb0', background: 'rgba(138,155,176,0.08)', border: '1px solid rgba(138,155,176,0.15)' }}
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
