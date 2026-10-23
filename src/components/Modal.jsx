import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function Modal({ titulo, onCerrar, children, ancho = 'max-w-lg' }) {
  const { tema } = useTheme()
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={typeof titulo === 'string' ? titulo : undefined}>
      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onCerrar} />
      {/* Panel: hoja inferior en mobile, centrado en escritorio */}
      <div
        className={`relative w-full ${ancho} max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl overflow-hidden`}
        style={{
          background: tema.bgCard,
          border: `1px solid ${tema.bgCardBorde}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${tema.lineSoft}` }}>
          <h2 className="text-lg font-semibold" style={{ color: tema.textPrimary }}>{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            title="Cerrar"
            className="-mr-2 -mt-1 w-9 h-9 rounded-md flex items-center justify-center"
            style={{ color: tema.textSecondary }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
