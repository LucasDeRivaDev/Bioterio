import { useMemo } from 'react'
import { useBioterio } from '../context/BiotheriumContext'
import { difDias, parseDate, hoy } from '../utils/calculos'
import { BIO } from '../utils/constants'

const cardStyle = { background: 'rgba(13,21,40,0.8)', border: '1px solid rgba(30,51,82,0.8)' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function edadDias(fechaNacimiento) {
  if (!fechaNacimiento) return null
  return difDias(parseDate(fechaNacimiento), parseDate(hoy()))
}

// Devuelve el stock vivo de una camada (total - sacrificados)
function stockCamada(camada, sacrificios) {
  const sacCount = sacrificios
    .filter((s) => s.camada_id === camada.id)
    .reduce((sum, s) => sum + s.cantidad, 0)
  const base = camada.total_destetados ?? camada.total_crias ?? 0
  return Math.max(0, base - sacCount)
}

// ── Componente tarjeta de categoría ─────────────────────────────────────────

function CategoriaCard({ icono, titulo, subtitulo, total, grupos, gruposLabel, machos, hembras, color, descripcion }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ background: `${color}08`, borderBottom: `1px solid ${color}18` }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
        >
          {icono}
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm text-white">{titulo}</div>
          <div className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>{subtitulo}</div>
        </div>
        {/* Total grande */}
        <div className="text-right">
          <div className="font-mono font-bold text-3xl" style={{ color }}>{total}</div>
          <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>animales</div>
        </div>
      </div>

      {/* Datos */}
      <div className="px-5 py-3 flex flex-wrap gap-4">
        {grupos !== undefined && (
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a5f7a' }}>
              {gruposLabel ?? 'Grupos'}
            </div>
            <div className="font-mono font-bold text-lg text-white">{grupos}</div>
          </div>
        )}
        {machos !== undefined && (
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a5f7a' }}>♂ Machos</div>
            <div className="font-mono font-bold text-lg" style={{ color: '#40c4ff' }}>{machos}</div>
          </div>
        )}
        {hembras !== undefined && (
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#4a5f7a' }}>♀ Hembras</div>
            <div className="font-mono font-bold text-lg" style={{ color: '#ce93d8' }}>{hembras}</div>
          </div>
        )}
        {descripcion && (
          <div className="ml-auto self-center text-xs text-right" style={{ color: '#4a5f7a' }}>{descripcion}</div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function Stock() {
  const { animales, camadas, sacrificios } = useBioterio()

  const datos = useMemo(() => {
    // ── 1. Reproductores registrados individualmente ──
    const hembrasRepro = animales.filter(
      (a) => a.sexo === 'hembra' && (a.estado === 'activo' || a.estado === 'en_cria')
    )
    const machosRepro = animales.filter(
      (a) => a.sexo === 'macho' && (a.estado === 'activo' || a.estado === 'en_cria')
    )

    // ── 2. Crías de camadas (stock no registrado individualmente) ──
    const camadasConNacimiento = camadas.filter((c) => c.fecha_nacimiento)

    let crias = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let jovenes = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let adultosNR = { total: 0, grupos: 0, machos: 0, hembras: 0 }
    let lactantes = { total: 0, grupos: 0 }

    camadasConNacimiento.forEach((c) => {
      const edad = edadDias(c.fecha_nacimiento)
      if (edad === null) return

      const stock = stockCamada(c, sacrificios)
      if (stock <= 0) return

      // Proporción machos/hembras si está disponible
      const totalBase = c.total_destetados ?? c.total_crias ?? 0
      const ratio = totalBase > 0 ? stock / totalBase : 0
      const m = Math.round((c.crias_machos ?? 0) * ratio)
      const h = Math.round((c.crias_hembras ?? 0) * ratio)

      if (edad < BIO.DESTETE_DIAS) {
        // Antes del destete — lactantes (no se cuentan como stock disponible aún)
        lactantes.total += c.total_crias ?? 0
        lactantes.grupos += 1
      } else if (edad < 42) {
        // Post-destete hasta 6 semanas — crías
        crias.total += stock
        crias.grupos += 1
        crias.machos += m
        crias.hembras += h
      } else if (edad < BIO.MADUREZ_DIAS) {
        // 6 a 12 semanas — jóvenes
        jovenes.total += stock
        jovenes.grupos += 1
        jovenes.machos += m
        jovenes.hembras += h
      } else {
        // Más de 12 semanas, no registrados como reproductores — adultos no reproductores
        adultosNR.total += stock
        adultosNR.grupos += 1
        adultosNR.machos += m
        adultosNR.hembras += h
      }
    })

    const totalStock =
      hembrasRepro.length + machosRepro.length +
      crias.total + jovenes.total + adultosNR.total

    return { hembrasRepro, machosRepro, crias, jovenes, adultosNR, lactantes, totalStock }
  }, [animales, camadas, sacrificios])

  const { hembrasRepro, machosRepro, crias, jovenes, adultosNR, lactantes, totalStock } = datos

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ background: '#050810' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-7 rounded-full" style={{ background: '#40c4ff', boxShadow: '0 0 8px rgba(64,196,255,0.5)' }} />
          <div>
            <h1 className="text-xl font-bold text-white">Stock por categorías</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a5f7a' }}>
              Clasificación automática por edad y rol reproductivo
            </p>
          </div>
        </div>
        {/* Total general */}
        <div
          className="px-5 py-3 rounded-2xl text-center"
          style={{ background: 'rgba(64,196,255,0.07)', border: '1px solid rgba(64,196,255,0.2)' }}
        >
          <div className="font-mono font-bold text-2xl" style={{ color: '#40c4ff' }}>{totalStock}</div>
          <div className="text-xs font-mono" style={{ color: '#4a5f7a' }}>Total en colonia</div>
        </div>
      </div>

      {/* Info: lactantes (no contados en stock disponible) */}
      {lactantes.total > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.2)' }}
        >
          <span className="text-lg">🍼</span>
          <div>
            <span className="font-semibold" style={{ color: '#ffb300' }}>
              {lactantes.total} crías lactantes
            </span>
            <span className="ml-2" style={{ color: '#4a5f7a' }}>
              en {lactantes.grupos} camada{lactantes.grupos !== 1 ? 's' : ''} — aún no destetadas, no incluidas en stock disponible
            </span>
          </div>
        </div>
      )}

      {/* ── Reproductores registrados ── */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
          Reproductores registrados
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategoriaCard
            icono="♀"
            titulo="Hembras reproductoras"
            subtitulo="Código A# · estado activo o en cría"
            total={hembrasRepro.length}
            color="#ce93d8"
          />
          <CategoriaCard
            icono="♂"
            titulo="Machos reproductores"
            subtitulo="Código M# · estado activo o en cría"
            total={machosRepro.length}
            color="#40c4ff"
          />
        </div>
      </div>

      {/* ── Stock de camadas por edad ── */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#4a5f7a' }}>
          Stock de camadas — clasificado por edad
        </div>
        <div className="space-y-3">
          <CategoriaCard
            icono="🐣"
            titulo="Crías (post-destete)"
            subtitulo="21 días hasta 6 semanas de edad"
            total={crias.total}
            grupos={crias.grupos}
            gruposLabel="Camadas"
            machos={crias.machos || undefined}
            hembras={crias.hembras || undefined}
            color="#00e676"
            descripcion="Destete completado · hasta 42 días"
          />
          <CategoriaCard
            icono="🐭"
            titulo="Jóvenes"
            subtitulo="6 semanas hasta 12 semanas de edad"
            total={jovenes.total}
            grupos={jovenes.grupos}
            gruposLabel="Camadas"
            machos={jovenes.machos || undefined}
            hembras={jovenes.hembras || undefined}
            color="#ffb300"
            descripcion="42 a 84 días · pre-madurez"
          />
          <CategoriaCard
            icono="🐀"
            titulo="Adultos (no reproductores)"
            subtitulo="Más de 12 semanas · no registrados como reproductores"
            total={adultosNR.total}
            grupos={adultosNR.grupos}
            gruposLabel="Camadas"
            machos={adultosNR.machos || undefined}
            hembras={adultosNR.hembras || undefined}
            color="#ff6b80"
            descripcion="> 84 días · aptos para reproducción o retiro"
          />
        </div>
      </div>

      {/* Sin datos */}
      {totalStock === 0 && (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: 'rgba(64,196,255,0.04)', border: '1px solid rgba(64,196,255,0.15)' }}
        >
          <div className="text-3xl mb-2">📦</div>
          <div className="font-semibold text-sm" style={{ color: '#40c4ff' }}>Sin stock registrado</div>
          <div className="text-xs mt-1" style={{ color: '#4a5f7a' }}>
            Registrá animales y camadas para ver la clasificación de stock
          </div>
        </div>
      )}

      {/* Nota metodológica */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ background: 'rgba(138,155,176,0.04)', border: '1px solid rgba(30,51,82,0.5)', color: '#4a5f7a' }}
      >
        <span className="font-semibold" style={{ color: '#8a9bb0' }}>Nota: </span>
        Las categorías de crías/jóvenes/adultos se calculan automáticamente desde la fecha de nacimiento de cada camada.
        El stock descontado incluye los sacrificios registrados. Los reproductores son animales registrados individualmente.
      </div>
    </div>
  )
}
