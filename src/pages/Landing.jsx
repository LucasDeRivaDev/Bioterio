import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { Aviso, Boton, Campo, Entrada } from '../components/ui'
import {
  Dna, BarChart2, Archive, Calendar, Skull, Printer, GraduationCap, Microscope, FlaskConical, Building2, Check, ArrowRight,
} from 'lucide-react'

const FUNCIONES = [
  { icono: Dna,       titulo: 'Motor predictivo reproductivo',  desc: 'Calcula automáticamente las ventanas de parto, fechas de destete y madurez reproductiva con precisión científica.', pie: 'Gestación · Destete · Madurez' },
  { icono: BarChart2, titulo: 'Scoring de rendimiento',          desc: 'Evalúa la eficiencia reproductiva de cada macho por latencia de fertilización. Ranking automático con puntajes por apareamiento.', pie: 'Score 10 · 7 · 5 pts por latencia' },
  { icono: Archive,   titulo: 'Control de stock por categorías', desc: 'Clasificación automática por edad: reproductores, crías, jóvenes y adultos. Se actualiza en tiempo real sin intervención manual.', pie: '5 categorías · Actualización automática' },
  { icono: Calendar,  titulo: 'Calendario de eventos',           desc: 'Visualizá partos esperados, destetes y madurez reproductiva en un calendario mensual con alertas de vencimiento.', pie: 'Alertas · Vencidas · Próximas' },
  { icono: Skull,     titulo: 'Registro de sacrificios',         desc: 'Registrá los sacrificios por grupo con fecha, categoría y notas. El stock se descuenta automáticamente y queda el historial completo.', pie: 'Trazabilidad completa · Sin errores' },
  { icono: Printer,   titulo: 'Reportes e impresión',            desc: 'Generá reportes mensuales o personalizados listos para imprimir o exportar como PDF. Ideales para auditorías y registros institucionales.', pie: 'PDF · Impresión directa · Filtros' },
]

const PASOS = [
  ['01', 'Cargás tus animales', 'Registrás machos y hembras reproductoras con su código, fecha de nacimiento y linaje.'],
  ['02', 'Registrás los apareamientos', 'Con la fecha de cópula, el sistema calcula automáticamente la ventana de parto esperada.'],
  ['03', 'El sistema trabaja solo', 'Alertas automáticas, stock actualizado, ranking de reproductores y reportes listos para imprimir.'],
]

const PUBLICO = [
  [GraduationCap, 'Universidades', 'Facultades de medicina, biología y veterinaria con bioterios propios'],
  [Microscope, 'Institutos de investigación', 'CONICET, INTA, ANLIS y centros de investigación biomédica'],
  [FlaskConical, 'Laboratorios farmacéuticos', 'Empresas que requieren modelos animales para sus estudios'],
  [Building2, 'Hospitales y clínicas', 'Centros con unidades de investigación y bioterios satelitales'],
]

function Icono({ icono, size = 20, className }) {
  const I = icono
  return <I size={size} className={className} />
}

function Seccion({ id, titulo, descripcion, alterna, children }) {
  return (
    <section id={id} className={`px-4 py-16 sm:px-6 sm:py-24 ${alterna ? 'border-y border-line bg-surface' : ''}`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-cond text-3xl font-semibold text-ink sm:text-4xl">{titulo}</h2>
          {descripcion && <p className="mt-3 text-ink-soft">{descripcion}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}

// El ciclo reproductivo que el sistema sigue solo, con los colores de estado de la app.
function CicloReproductivo() {
  const { tema } = useTheme()
  const pasos = [
    [tema.purple, 'Cópula', 'Se registra la fecha y la pareja'],
    [tema.blue, 'Preñez', 'Separación y seguimiento automático'],
    [tema.amber, 'Parto', 'Ventana de 21–23 días según especie'],
    [tema.green, 'Destete', 'A los 21 días, pasa a stock por jaula'],
    [tema.textSecondary, 'Stock', 'Por categoría de edad, hasta la entrega'],
  ]
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line-soft px-5 py-4">
        <img src="/apple-touch-icon.png" alt="" width="32" height="32" className="h-8 w-8 rounded-md" />
        <div>
          <p className="font-cond text-lg font-semibold text-ink">Ciclo reproductivo</p>
          <p className="text-xs text-ink-soft">Cada paso genera sus tareas y alertas</p>
        </div>
      </div>
      <ol className="divide-y divide-line-soft">
        {pasos.map(([color, paso, detalle], i) => (
          <li key={paso} className="flex items-center gap-4 px-5 py-3.5" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
            <span className="w-5 font-cond text-sm text-ink-faint">{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-medium text-ink">{paso}</span>
              <span className="block text-sm text-ink-soft">{detalle}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function FormularioDemo() {
  const [estado, setEstado] = useState('inicial') // inicial | enviando | ok | error

  // Guarda la solicitud de demo en la tabla `contactos` de Supabase (insert público vía RLS, ver CLAUDE.md).
  async function handleSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const datos = {
      nombre:      form.nombre.value.trim(),
      institucion: form.institucion.value.trim() || null,
      email:       form.email.value.trim(),
      mensaje:     form.mensaje.value.trim() || null,
    }
    setEstado('enviando')
    const { error } = await supabase.from('contactos').insert(datos)
    if (error) {
      console.error('Error al enviar solicitud de demo:', error)
      setEstado('error')
    } else {
      setEstado('ok')
    }
  }

  if (estado === 'ok') return <Aviso tono="ok">¡Mensaje recibido! Te contactamos a la brevedad.</Aviso>

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre"><Entrada name="nombre" required placeholder="Tu nombre" /></Campo>
        <Campo etiqueta="Institución"><Entrada name="institucion" placeholder="Nombre de tu institución" /></Campo>
      </div>
      <Campo etiqueta="Email"><Entrada type="email" name="email" required placeholder="tu@institucion.edu.ar" /></Campo>
      <Campo etiqueta="Mensaje (opcional)">
        <textarea
          name="mensaje"
          rows={3}
          placeholder="¿Cuántos animales manejan? ¿Qué herramienta usan actualmente?"
          className="w-full resize-none rounded-md border border-line bg-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-focus focus:outline-none"
        />
      </Campo>
      {estado === 'error' && <Aviso>No se pudo enviar el mensaje. Probá de nuevo o escribinos por email.</Aviso>}
      <Boton type="submit" variante="primario" cargando={estado === 'enviando'} className="w-full sm:w-auto">
        {estado === 'enviando' ? 'Enviando…' : 'Solicitar demo gratuito'}
      </Boton>
    </form>
  )
}

export default function Landing() {
  const { sesion } = useAuth()

  useEffect(() => {
    const prev = document.title
    document.title = 'ITeRatE — Sistema de Gestión de Bioterio'
    return () => { document.title = prev }
  }, [])

  const btnPrimario = 'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-canvas hover:opacity-90'
  const btnSecundario = 'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-raised px-5 text-sm font-medium text-ink hover:border-ink-faint'

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-ink">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2.5 no-underline">
            <img src="/apple-touch-icon.png" alt="" width="32" height="32" className="h-8 w-8 rounded-md" />
            <span className="font-cond text-lg font-semibold text-ink">ITeRatE</span>
          </a>
          <div className="hidden items-center gap-1 md:flex">
            {[['#features', 'Funciones'], ['#como-funciona', '¿Cómo funciona?'], ['#pricing', 'Planes']].map(([href, label]) => (
              <a key={href} href={href} className="rounded-md px-3 py-2 text-sm text-ink-soft no-underline hover:bg-raised hover:text-ink">{label}</a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="#contacto" className="hidden h-9 items-center rounded-md border border-line px-3 text-sm font-medium text-ink no-underline hover:bg-raised sm:inline-flex">
              Solicitar demo
            </a>
            <Link to={sesion ? '/' : '/login'} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3 text-sm font-medium text-canvas no-underline hover:opacity-90">
              {sesion ? 'Ir al bioterio' : 'Ingresar'} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-medium text-ink-soft">Software de gestión de bioterio</p>
            <h1 className="font-cond text-4xl font-semibold leading-tight text-ink sm:text-5xl lg:text-[56px]">
              Gestión inteligente de tu colonia de laboratorio
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              ITeRatE centraliza el control de tu bioterio: reproductores, camadas, predicciones de parto, stock y reportes — todo en tiempo real, desde cualquier dispositivo.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#contacto" className={`${btnPrimario} no-underline`}>Solicitar demo gratuito</a>
              <a href="#features" className={`${btnSecundario} no-underline`}>Ver funciones</a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 items-end gap-6 border-t border-line pt-6">
              {[['100%', 'Digital, sin papel'], ['24/7', 'Acceso desde cualquier lugar'], ['∞', 'Historial de datos']].map(([valor, etiqueta]) => (
                <div key={etiqueta} className="flex flex-col-reverse">
                  <dt className="text-xs text-ink-soft">{etiqueta}</dt>
                  <dd className="font-cond text-3xl font-semibold text-ink">{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
          <CicloReproductivo />
        </div>
      </section>

      {/* ── FUNCIONES ── */}
      <Seccion
        id="features"
        alterna
        titulo="Todo lo que necesita tu bioterio"
        descripcion={<>Diseñado específicamente para la gestión de colonias de <em className="text-ink">Mus musculus</em>, con parámetros biológicos incorporados.</>}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONES.map(({ icono, titulo, desc, pie }) => (
            <li key={titulo} className="flex flex-col rounded-lg border border-line bg-canvas p-5">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-line bg-raised text-ink">
                <Icono icono={icono} />
              </span>
              <h3 className="text-base font-semibold text-ink">{titulo}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{desc}</p>
              <p className="mt-4 border-t border-line-soft pt-3 text-xs text-ink-faint">{pie}</p>
            </li>
          ))}
        </ul>
      </Seccion>

      {/* ── CÓMO FUNCIONA ── */}
      <Seccion id="como-funciona" titulo="¿Cómo funciona?" descripcion="Simple desde el primer día.">
        <ol className="grid gap-4 md:grid-cols-3">
          {PASOS.map(([n, titulo, desc]) => (
            <li key={n} className="rounded-lg border border-line bg-surface p-5">
              <span className="font-cond text-3xl font-semibold text-ink-faint">{n}</span>
              <h3 className="mt-3 text-base font-semibold text-ink">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{desc}</p>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* ── PARA QUIÉN ── */}
      <Seccion
        alterna
        titulo="¿Para quién es ITeRatE?"
        descripcion="Diseñado para instituciones que trabajan con colonias de ratones de laboratorio."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLICO.map(([icono, titulo, desc]) => (
            <li key={titulo} className="rounded-lg border border-line bg-canvas p-5">
              <Icono icono={icono} size={24} className="text-ink-soft" />
              <p className="mt-3 font-medium text-ink">{titulo}</p>
              <p className="mt-1 text-sm text-ink-soft">{desc}</p>
            </li>
          ))}
        </ul>
      </Seccion>

      {/* ── PLANES ── */}
      <Seccion
        id="pricing"
        titulo="Elegí el modelo que mejor te funciona"
        descripcion="Consultoría personalizada sin compromiso. Ajustamos el plan a las necesidades de tu institución."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              nombre: 'Licencia única', detalle: 'Pago único · sin mensualidades', destacado: false,
              items: ['Sistema completo instalado', 'Capacitación incluida', '3 meses de soporte técnico', 'Acceso multiusuario'],
              extra: 'Updates futuros opcionales',
            },
            {
              nombre: 'Suscripción mensual', detalle: 'Por mes · sin contrato de permanencia', destacado: true,
              items: ['Todo lo del plan licencia', 'Updates automáticos incluidos', 'Soporte técnico continuo', 'Nuevas funciones sin costo extra', 'Backup automático de datos'],
            },
          ].map((plan) => (
            <div
              key={plan.nombre}
              className="flex flex-col rounded-lg border border-line bg-surface p-6"
              style={plan.destacado ? { boxShadow: 'inset 0 3px 0 var(--ink)' } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">{plan.nombre}</p>
                {plan.destacado && <span className="rounded border border-line px-1.5 py-0.5 text-xs font-medium text-ink">Recomendado</span>}
              </div>
              <p className="mt-3 font-cond text-4xl font-semibold text-ink">A consultar</p>
              <p className="mt-1 text-sm text-ink-soft">{plan.detalle}</p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-line-soft pt-5">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-ink">
                    <Check size={16} className="shrink-0 text-ok" /> {item}
                  </li>
                ))}
                {plan.extra && <li className="flex items-center gap-2.5 text-sm text-ink-faint"><span className="w-4 text-center">—</span> {plan.extra}</li>}
              </ul>
              <a href="#contacto" className={`${plan.destacado ? btnPrimario : btnSecundario} mt-6 no-underline`}>Consultar precio</a>
            </div>
          ))}
        </div>
      </Seccion>

      {/* ── CONTACTO ── */}
      <Seccion
        id="contacto"
        alterna
        titulo="Pedí tu demo gratuito"
        descripcion="Te mostramos el sistema en funcionamiento con datos reales. Sin compromiso, sin tarjeta de crédito."
      >
        <div className="max-w-2xl rounded-lg border border-line bg-canvas p-5 sm:p-6">
          <FormularioDemo />
        </div>
      </Seccion>

      {/* ── FOOTER ── */}
      <footer className="px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <img src="/apple-touch-icon.png" alt="" width="24" height="24" className="h-6 w-6 rounded" />
            <span className="font-cond font-semibold text-ink">ITeRatE</span>
            <span className="hidden text-sm text-ink-faint sm:inline">Intelligence Telemetry for Rats Evaluation</span>
          </span>
          <span className="text-sm text-ink-faint">© 2026 ITeRatE</span>
        </div>
      </footer>
    </div>
  )
}
