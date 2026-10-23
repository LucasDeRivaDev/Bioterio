import { useNavigate } from 'react-router-dom'
import { useBioterioActivo, BIOTERIOS_CONFIG } from '../context/BioterioActivoContext'
import { BarChart3, ChevronRight, Gauge, GitBranch, Layers, Wheat } from 'lucide-react'
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

const ACCESOS_GLOBALES = [
  { id: 'alimento_global',   icono: Wheat,       titulo: 'Consumo global de alimento',  detalle: 'Ratas + ratones · estimación diaria y duración del stock' },
  { id: 'viruta_global',     icono: Layers,      titulo: 'Consumo de viruta y camas',   detalle: 'Ratas + ratones · calculado por jaulas activas' },
  { id: 'capacidad_global',  icono: Gauge,       titulo: 'Capacidad y predicción',      detalle: 'Saturación estimada · candidatos a sacrificio · simulador' },
  { id: 'genealogia_global', icono: GitBranch,   titulo: 'Genealogía y consanguinidad', detalle: 'Árbol genealógico · coeficiente F · simulador de apareamiento' },
]

const COLONIAS = ['ratas', ...GRUPOS_RATONES]

function IconoAcceso({ icono }) {
  const Icono = icono
  return <Icono size={18} className="shrink-0 text-ink-soft" />
}

function EstadoSanitario({ estado }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium"
      style={{
        color: estado.color,
        background: `color-mix(in srgb, ${estado.color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${estado.color} 35%, transparent)`,
      }}
    >
      {estado.label}{estado.count > 0 ? ` · ${estado.count}` : ''}
    </span>
  )
}

export default function SelectorBioterio() {
  const { setBioterioActivo } = useBioterioActivo()
  const { tema } = useTheme()
  const navigate = useNavigate()
  const [incidentesSalud, setIncidentesSalud] = useState([])

  useEffect(() => {
    const hace90 = haceDias(90)
    supabase
      .from('incidentes')
      .select('bioterio_id, severidad, resuelto, fecha')
      .gte('fecha', hace90)
      .eq('resuelto', false)
      .then(({ data }) => { if (data) setIncidentesSalud(data) })
  }, [])

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src="/apple-touch-icon.png" alt="" width="56" height="56" className="h-14 w-14 rounded-lg" />
            <div>
              <h1 className="font-cond text-3xl font-semibold text-ink">Seleccioná el bioterio</h1>
              <p className="text-ink-soft">¿Con qué colonia vas a trabajar hoy?</p>
            </div>
          </div>
          <button onClick={() => navigate('/inicio')} className="self-start text-sm text-ink-soft hover:text-ink sm:self-auto">
            ← Ver página de inicio
          </button>
        </header>

        {/* Colonias: el color de cada una es su identidad en toda la app */}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLONIAS.map((id) => {
            const cfg = BIOTERIOS_CONFIG[id]
            const esRata = id === 'ratas'
            return (
              <li key={id}>
                <button
                  onClick={() => setBioterioActivo(id)}
                  className="group flex h-full w-full flex-col rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:bg-raised"
                  style={{ boxShadow: `inset 0 3px 0 ${cfg.color}` }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-2xl" aria-hidden="true">{cfg.icon}</span>
                    <EstadoSanitario estado={badgeSanitario(incidentesSalud, id, tema)} />
                  </span>
                  <span className="mt-3 font-cond text-xl font-semibold text-ink">{esRata ? 'Ratas' : cfg.labelCorto}</span>
                  <span className="text-sm italic text-ink-soft">{cfg.nombreCientifico}</span>
                  <span className="mt-3 text-xs text-ink-faint">
                    Gestación {esRata ? '23' : '21'} d · Madurez {esRata ? '12' : '8'} sem.
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ink">
                    Ingresar <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <button
          onClick={() => setBioterioActivo('resumen_ratones')}
          className="mt-3 flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left hover:bg-raised"
        >
          <BarChart3 size={18} className="shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Resumen total de ratones</span>
            <span className="block text-xs text-ink-soft">Stock unificado de Balb/C, C57 e Híbridos</span>
          </span>
          <ChevronRight size={16} className="text-ink-faint" />
        </button>

        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-ink">Vista global</h2>
          <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line bg-surface">
            {ACCESOS_GLOBALES.map(({ id, icono, titulo, detalle }) => (
              <li key={id}>
                <button onClick={() => setBioterioActivo(id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-raised">
                  <IconoAcceso icono={icono} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{titulo}</span>
                    <span className="block text-xs text-ink-soft">{detalle}</span>
                  </span>
                  <ChevronRight size={16} className="text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
