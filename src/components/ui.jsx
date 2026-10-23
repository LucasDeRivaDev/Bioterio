// Primitivas de interfaz compartidas con ITeRatE ICIVET.
// Usan las variables CSS de index.css (bg-surface, text-ink, border-line…), así
// funcionan igual en tema oscuro y claro sin depender de tema.*.
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

const cx = (...parts) => parts.filter(Boolean).join(' ')

// Acción primaria en tinta invertida: los colores quedan reservados para estados.
const VARIANTES_BOTON = {
  primario: 'bg-ink text-canvas hover:opacity-90',
  secundario: 'border border-line bg-raised text-ink hover:border-ink-faint',
  fantasma: 'text-ink-soft hover:bg-raised hover:text-ink',
  peligro: 'bg-danger text-[#ffffff] hover:opacity-90',
}

export function Boton({ variante = 'secundario', tamano = 'md', cargando = false, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        tamano === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
        VARIANTES_BOTON[variante],
        className,
      )}
      disabled={cargando || props.disabled}
      {...props}
    >
      {cargando && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

// La etiqueta envuelve al control, así no hacen falta ids.
export function Campo({ etiqueta, ayuda, error, children, className }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{etiqueta}</span>
        {children}
      </label>
      {ayuda && !error && <p className="text-xs text-ink-faint">{ayuda}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

const control =
  'w-full rounded-md border border-line bg-sunken px-3 text-sm text-ink placeholder:text-ink-faint focus:border-focus focus:outline-none disabled:opacity-60'

export function Entrada({ className, ...props }) {
  return <input className={cx(control, 'h-10', className)} {...props} />
}

export function Aviso({ tono = 'danger', children }) {
  const color = tono === 'danger' ? 'var(--danger)' : 'var(--ok)'
  return (
    <p
      role={tono === 'danger' ? 'alert' : 'status'}
      className="rounded-md border px-3 py-2 text-sm"
      style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)`, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      {children}
    </p>
  )
}

export function Panel({ className, children }) {
  return <section className={cx('rounded-lg border border-line bg-surface', className)}>{children}</section>
}

// Encabezado de las vistas sin sidebar (selector, vistas globales).
export function EncabezadoPantalla({ titulo, descripcion, onVolver, textoVolver = 'Bioterios', acciones }) {
  return (
    <header className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {onVolver && (
          <button onClick={onVolver} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
            ← {textoVolver}
          </button>
        )}
        <h1 className="font-cond text-2xl font-semibold text-ink sm:text-[28px]">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  )
}

// Barra superior de las vistas globales (sin sidebar): volver al selector, título y acciones.
export function BarraGlobal({ titulo, subtitulo, onVolver, onActualizar, actualizando, acciones }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <button
          onClick={onVolver}
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-ink-soft hover:bg-raised hover:text-ink"
        >
          <ArrowLeft size={16} /> Bioterios
        </button>
        <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-cond text-xl font-semibold text-ink">{titulo}</h1>
          {subtitulo && <p className="truncate text-xs text-ink-soft">{subtitulo}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onActualizar && (
            <Boton tamano="sm" onClick={onActualizar} disabled={actualizando}>
              <RefreshCw size={14} className={actualizando ? 'animate-spin' : ''} /> Actualizar
            </Boton>
          )}
          {acciones}
        </div>
      </div>
    </header>
  )
}
