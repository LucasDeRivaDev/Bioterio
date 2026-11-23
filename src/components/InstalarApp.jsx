// Botón "Descargar app": instala ITeRatE Bioterio ISAL como app (PWA).
// · Si el navegador ofrece la instalación directa (Chrome / Edge / Android:
//   `beforeinstallprompt`, guardado en window.__avisoInstalar desde index.html
//   porque puede llegar antes de que React monte), el botón la abre.
// · Si no la ofrece (Firefox, Safari, Chrome que ya la tuvo rechazada o
//   instalada, iPhone/iPad), el botón igual se ve y muestra los pasos exactos
//   para ese navegador.
// · Solo se oculta cuando la página ya está abierta como app.
import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

function abiertaComoApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function navegador() {
  const ua = window.navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  const movil = ios || /android|mobi/i.test(ua)
  if (ios) return { id: 'ios', movil }
  if (/SamsungBrowser/i.test(ua)) return { id: 'samsung', movil }
  if (/Edg\//.test(ua)) return { id: 'edge', movil }
  if (/OPR\//.test(ua)) return { id: 'otro', movil }
  if (/Firefox\//.test(ua)) return { id: 'firefox', movil }
  if (/Chrome\/|Chromium\//.test(ua)) return { id: 'chrome', movil }
  if (/Safari\//.test(ua) && ua.includes('Macintosh')) return { id: 'safari-mac', movil }
  return { id: 'otro', movil }
}

const B = ({ children }) => <strong className="font-semibold text-ink">{children}</strong>

function pasosPara({ id, movil }) {
  switch (id) {
    case 'ios':
      return { titulo: 'Agregar Bioterio ISAL al inicio', pasos: [
        <>Abrí esta página en <B>Safari</B> y tocá <B>Compartir</B> (el cuadrado con la flecha hacia arriba; abajo en iPhone, arriba en iPad).</>,
        <>Elegí <B>Agregar a inicio</B> y confirmá con <B>Agregar</B>.</>,
      ] }
    case 'chrome':
      return movil
        ? { titulo: 'Instalar Bioterio ISAL', pasos: [
            <>Tocá el menú <B>⋮</B> (arriba a la derecha).</>,
            <>Elegí <B>Instalar aplicación</B> (o <B>Agregar a la pantalla principal</B>) y confirmá.</>,
          ] }
        : { titulo: 'Instalar Bioterio ISAL en la PC', pasos: [
            <>En la barra de direcciones, a la derecha, hacé clic en el ícono de <B>instalar</B> (una pantalla con una flecha) y después en <B>Instalar</B>.</>,
            <>Si no está ese ícono: menú <B>⋮</B> → <B>Transmitir, guardar y compartir</B> → <B>Instalar página como aplicación…</B> (en versiones anteriores, <B>Instalar Bioterio ISAL…</B> directo en el menú).</>,
          ] }
    case 'edge':
      return movil
        ? { titulo: 'Instalar Bioterio ISAL', pasos: [
            <>Tocá el menú <B>…</B> de abajo.</>,
            <>Elegí <B>Agregar al teléfono</B> o <B>Agregar a la pantalla principal</B> y confirmá.</>,
          ] }
        : { titulo: 'Instalar Bioterio ISAL en la PC', pasos: [
            <>En la barra de direcciones, a la derecha, hacé clic en el ícono <B>Aplicación disponible</B> y después en <B>Instalar</B>.</>,
            <>Si no está ese ícono: menú <B>…</B> → <B>Aplicaciones</B> → <B>Instalar este sitio como aplicación</B>.</>,
          ] }
    case 'safari-mac':
      return { titulo: 'Agregar Bioterio ISAL al Dock', pasos: [
        <>En la barra de menú de Safari, elegí <B>Archivo</B> → <B>Agregar al Dock…</B> (Safari 17 o posterior).</>,
        <>Confirmá con <B>Agregar</B>: queda en el Dock y en Aplicaciones.</>,
      ] }
    case 'samsung':
      return { titulo: 'Instalar Bioterio ISAL', pasos: [
        <>Tocá el menú <B>☰</B> de abajo.</>,
        <>Elegí <B>Agregar página a</B> → <B>Pantalla de inicio</B>.</>,
      ] }
    case 'firefox':
      return movil
        ? { titulo: 'Instalar Bioterio ISAL', pasos: [
            <>Tocá el menú <B>⋮</B>.</>,
            <>Elegí <B>Instalar</B> o <B>Agregar a pantalla de inicio</B>.</>,
          ] }
        : { titulo: 'Firefox no instala apps web', pasos: [
            <>Copiá la dirección de esta página y abrila en <B>Google Chrome</B> o <B>Microsoft Edge</B>.</>,
            <>Ahí tocá <B>Descargar app</B> y seguí los pasos.</>,
          ] }
    default:
      return { titulo: 'Instalar Bioterio ISAL', pasos: [
        <>Abrí esta página en <B>Google Chrome</B> o <B>Microsoft Edge</B>.</>,
        <>Tocá <B>Descargar app</B> y seguí los pasos.</>,
      ] }
  }
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

  // Devuelve true si se abrió la instalación directa; false → mostrar los pasos.
  async function instalarDirecto() {
    if (!aviso) return false
    try {
      await aviso.prompt()
      const { outcome } = await aviso.userChoice
      if (outcome === 'accepted') setInstalada(true)
    } catch (e) {
      console.warn('No se pudo abrir la instalación:', e)
      return false
    } finally {
      // El aviso solo se puede usar una vez; si lo rechazan, Chrome manda otro más adelante.
      window.__avisoInstalar = null
      setAviso(null)
    }
    return true
  }

  return { instalada, instalarDirecto }
}

/**
 * @param {'bloque'|'menu'} variante  bloque = pantalla de ingreso · menu = pie del sidebar
 */
export default function InstalarApp({ variante = 'bloque' }) {
  const { instalada, instalarDirecto } = useInstalarApp()
  const [guia, setGuia] = useState(null)
  if (instalada) return null

  async function accion() {
    if (await instalarDirecto()) return
    setGuia(pasosPara(navegador()))
  }

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
            <p className="text-sm text-ink-soft">Instalá Bioterio ISAL en esta PC, celular o tablet y abrilo desde su ícono, a pantalla completa.</p>
          </div>
          <button
            onClick={accion}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-raised px-4 text-sm font-medium text-ink hover:border-ink-faint"
          >
            <Download size={16} /> Descargar app
          </button>
        </div>
      )}

      {guia && (
        <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setGuia(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-instalar"
            className="w-full max-w-md rounded-xl border border-line bg-surface p-5 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="titulo-instalar" className="font-cond text-lg font-semibold text-ink">{guia.titulo}</h2>
              <button onClick={() => setGuia(null)} aria-label="Cerrar" className="-mr-1 rounded p-1 text-ink-soft hover:text-ink"><X size={18} /></button>
            </div>
            <ol className="space-y-3 text-sm text-ink-soft">
              {guia.pasos.map((paso, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised font-cond text-xs font-semibold text-ink">{i + 1}</span>
                  <span>{paso}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line-soft pt-3 text-sm text-ink-faint">
              ¿Ya la instalaste? Abrila desde su ícono: escritorio, menú Inicio o lista de aplicaciones.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
