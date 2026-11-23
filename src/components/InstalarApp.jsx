// Botón "Descargar app": instala ITeRatE Bioterio ISAL como app (PWA).
// · Chrome / Edge / Android: usa el aviso nativo de instalación. El evento
//   `beforeinstallprompt` se guarda en window.__avisoInstalar desde index.html,
//   porque puede llegar antes de que React monte.
// · iPhone / iPad (Safari): Apple no permite instalar desde un botón; se
//   muestran los pasos (Compartir → Agregar a inicio).
// · Ya instalada (abierta como app) o navegador sin soporte: no se muestra.
import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'

function abiertaComoApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function esIOS() {
  const ua = window.navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function useInstalarApp() {
  const [aviso, setAviso] = useState(() => window.__avisoInstalar ?? null)
  const [instalada, setInstalada] = useState(abiertaComoApp)

  useEffect(() => {
    const disponible = () => setAviso(window.__avisoInstalar ?? null)
    const lista = () => { setInstalada(true); setAviso(null) }
    window.addEventListener('app:instalable', disponible)
    window.addEventListener('appinstalled', lista)
    return () => {
      window.removeEventListener('app:instalable', disponible)
      window.removeEventListener('appinstalled', lista)
    }
  }, [])

  const modo = instalada ? null : aviso ? 'nativo' : esIOS() ? 'ios' : null

  async function instalar() {
    if (!aviso) return
    try {
      await aviso.prompt()
      const { outcome } = await aviso.userChoice
      if (outcome === 'accepted') setInstalada(true)
    } catch (e) {
      console.warn('No se pudo abrir la instalación:', e)
    }
    // El aviso solo se puede usar una vez; si lo rechazan, Chrome manda otro más adelante.
    window.__avisoInstalar = null
    setAviso(null)
  }

  return { modo, instalar }
}

/**
 * @param {'bloque'|'menu'} variante  bloque = pantalla de ingreso · menu = pie del sidebar
 */
export default function InstalarApp({ variante = 'bloque' }) {
  const { modo, instalar } = useInstalarApp()
  const [pasosIOS, setPasosIOS] = useState(false)
  if (!modo) return null

  const accion = modo === 'nativo' ? instalar : () => setPasosIOS(true)

  return (
    <>
      {variante === 'menu' ? (
        <button onClick={accion} className="nav-item w-full" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <Download size={16} />
          <span className="truncate">Descargar app</span>
        </button>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="font-medium text-ink">Usalo como app</p>
            <p className="text-sm text-ink-soft">Instalá Bioterio ISAL en este dispositivo y abrilo desde su ícono, a pantalla completa.</p>
          </div>
          <button
            onClick={accion}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-raised px-4 text-sm font-medium text-ink hover:border-ink-faint"
          >
            <Download size={16} /> Descargar app
          </button>
        </div>
      )}

      {pasosIOS && (
        <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setPasosIOS(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-instalar-ios"
            className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="titulo-instalar-ios" className="font-cond text-lg font-semibold text-ink">Agregar Bioterio ISAL al inicio</h2>
              <button onClick={() => setPasosIOS(false)} aria-label="Cerrar" className="-mr-1 rounded p-1 text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <ol className="space-y-3 text-sm text-ink">
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-ink-soft"><Share size={15} /></span>
                <span>Abrí esta página en <strong>Safari</strong> y tocá el botón <strong>Compartir</strong> (abajo, o arriba en iPad).</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-ink-soft"><SquarePlus size={15} /></span>
                <span>Elegí <strong>Agregar a inicio</strong> y confirmá con <strong>Agregar</strong>.</span>
              </li>
            </ol>
            <p className="mt-4 text-sm text-ink-soft">Va a aparecer el ícono de Bioterio ISAL en tu pantalla de inicio.</p>
          </div>
        </div>
      )}
    </>
  )
}
