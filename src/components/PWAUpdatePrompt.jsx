import { useRegisterSW } from 'virtual:pwa-register/react'

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Poll for updates every 60s so Vercel deploys propagate quickly
      r && setInterval(() => r.update(), 60_000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid #00e676',
        background: '#0d1528',
        boxShadow: '0 0 24px rgba(0,230,118,0.25)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#c9d4e0' }}>
        ✦ Nueva versión disponible
      </span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          background: '#00e676',
          color: '#050810',
        }}
      >
        Actualizar
      </button>
    </div>
  )
}
