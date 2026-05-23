# AppMosca — Bioterio 🧬

## Protocolo de trabajo

> **Regla:** después de cada commit que agregue una **feature nueva** (no fixes ni refactors), actualizar este CLAUDE.md con:
> - La descripción de la feature en "Implementado recientemente"
> - El comportamiento de datos relevante en "Comportamientos clave" (si aplica)
> - La tabla de módulos en "Qué hace" si cambia la funcionalidad visible

---

## Qué es
Sistema web de gestión de una colonia de ratones de laboratorio (*Mus musculus*). Permite registrar animales reproductores, hacer seguimiento de camadas, predecir partos, controlar stock de crías, registrar temperatura ambiental y evaluar el desempeño reproductivo de los animales.

---

## Qué hace

| Módulo | Función |
|---|---|
| **Dashboard** | Alertas del día, tareas vencidas/próximas, tabla de preñeces activas, alertas de ciclo estral y gestación |
| **Animales** | CRUD de reproductores con filtros por sexo y estado. Hembras: sección "Ciclo Estral y Reproducción Predictiva" con registro de extendidos, predicción de receptividad y seguimiento gestacional |
| **Camadas** | Registro de cópulas, seguimiento de preñez, destete, separación de pareja, scores reproductivos, análisis de confiabilidad de hembras y detección de fallos |
| **Calendario** | Vista mensual con eventos reproductivos coloreados + planificación de apareamientos futuros + sistema de notas y recordatorios personalizados |
| **Stock** | Bloques visuales por jaula con display de sexo coloreado (♂ azul / ♀ violeta / mixto bicolor), edición/división/movimiento de animales, entrega y sacrificio en masa. Cada bloque muestra calidad de padres (Alta/Media/Baja) sin necesidad de abrir el modal |
| **Sacrificios** | Selección múltiple de jaulas desde stock para registrar sacrificios en masa, con cantidad parcial por jaula |
| **Entregas** | Historial de animales entregados a investigadores, con buscador, resumen numérico y botón "Devolver" |
| **Rendimiento** | Ranking de machos por latencia de fertilización (menor = mejor) con scores y alertas de edad |
| **Estadísticas** | Dashboard visual con 4 gráficos: partos vs fallas, calidad de madres, supervivencia de camadas, eficiencia de apareamiento. KPIs resumen + filtros por fecha y reproductor |
| **Temperatura** | 2 tabs fijos (Ratas / Ratones), registro diario (actual/mín/máx), vista mensual, exportación imprimible |
| **Reportes** | Impresión de datos de la colonia |

**Motor predictivo:** calcula automáticamente fechas de parto (gestación 23d ratas / 21d ratones), destete (21d), madurez sexual y genera tareas con prioridad.

**Flujo reproductivo:** Cópula → Estado "en apareamiento" (15d) → Separación → Preñez → Parto → Destete → Stock por jaulas. Estado de la hembra: `activo` → `en_apareamiento` → `en_cria` → `activo` (ciclo completo automático vía `editarCamada`).

**Sistema de scores reproductivos (calculados en tiempo real, sin DB):**
- Velocidad de reproducción: latencia **0–5d** → 10pts / 6–10d → 7pts / 11–15d → 5pts (latencia 0 = fecundación el mismo día del apareamiento, es score máximo)
- Tamaño de camada: ≥10 → 10pts / 8–9 → 7pts / <8 → 5pts
- Proporción sexual: más hembras → 10pts / igual → 7pts / más machos → 5pts
- Supervivencia al destete: (destetados/nacidos) × 10, capeado a 10

**Sistema de confiabilidad de hembras:**
- Leve: 1 evento negativo (fallo o camada < 8)
- Moderada: 2+ fallos registrados
- Crítica: 3+ eventos combinados → botón directo a Sacrificios

---

## Stack tecnológico

- **Frontend:** React 18 + Vite (Rolldown bundler)
- **Estilos:** Tailwind CSS (CDN)
- **Routing:** React Router v6
- **Estado global:** useReducer + Context API
- **Base de datos:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel (auto-deploy en push a `main`)
- **Auth:** Supabase Auth con invitaciones por email

---

## Estructura de archivos clave

```
src/
├── App.jsx                          — Router + layout responsive + rutas especiales (resumen_ratones, alimento_global, viruta_global)
├── context/
│   ├── BiotheriumContext.jsx        — Estado global (animales, camadas, jaulas, sacrificios, entregas, temperaturas, extendidos, animalesExportados, camadasF1)
│   ├── BioterioActivoContext.jsx    — Bioterio activo en localStorage (bioterioActivo, bio, config)
│   └── ThemeContext.jsx             — Tema claro/oscuro. TEMA_OSCURO + TEMA_CLARO. Toggle persiste en localStorage ('appMosca_brillo'). Clase 'modo-claro' en <html>
├── utils/calculos.js                — Motor predictivo, scores reproductivos, confiabilidad de hembras
├── utils/constants.js               — Constantes biológicas (BIO_RATAS, BIO_RATONES, BIO, ESTADO_ANIMAL, TIPO_TAREA)
├── components/
│   ├── Sidebar.jsx                  — Navegación (drawer en mobile, ficha biológica colapsable)
│   ├── Modal.jsx, Badge.jsx
│   ├── AnimalForm.jsx
│   ├── CamadaForm.jsx               — Formulario de camada + registro de fallos reproductivos + validaciones temporales
│   └── CicloEstral.jsx              — Sección de ciclo estral dentro del perfil de cada hembra
└── pages/
    ├── Dashboard.jsx
    ├── Animales.jsx                 — Incluye sección "Reproductores compartidos" en Híbridos + ModalExportarReproductor
    ├── Camadas.jsx                  — Lista + detalle expandible + AnalisisReproductivo
    ├── Calendario.jsx
    ├── Stock.jsx                    — Jaulas con SexoDisplay coloreado + calidad de padres + bloqueo de promoción en Híbridos (F1)
    ├── Sacrificios.jsx
    ├── Entregas.jsx                 — Historial de entregas con buscador y tarjetas resumen
    ├── Rendimiento.jsx
    ├── Estadisticas.jsx             — Dashboard visual: 4 gráficos reproductivos + KPIs + filtros
    ├── Temperatura.jsx              — 2 tabs físicos (Bioterio de Ratas / Bioterio de Ratones), sin dependencia de bioterio activo
    ├── Reportes.jsx
    ├── SelectorBioterio.jsx         — Pantalla de selección de bioterio (ratas + 3 subgrupos de ratones + accesos globales)
    ├── ResumenRatones.jsx           — Vista unificada de stock de las 3 colonias de ratones con desglose por categoría + jaulas
    └── ConsumoViruta.jsx            — Predicción adaptativa de consumo de viruta con censos + ingresos separados
```

---

## Tablas en Supabase

```
animales
  id, codigo, sexo, estado, fecha_nacimiento, notas,
  fecha_sacrificio, motivo_sacrificio,
  exportado_hibridos (bool, default false)

camadas
  id, id_madre, id_padre, fecha_copula, fecha_separacion,
  fecha_nacimiento, fecha_destete, gestacion_real,
  total_crias, crias_machos, crias_hembras, total_destetados,
  failure_flag (bool), failure_type (text), notas,
  incluir_en_stock (bool, default true)

jaulas
  id, camada_id, total, machos, hembras, notas

sacrificios
  id, camada_id, cantidad, fecha, categoria, notas

entregas
  id, camada_id, animal_id, cantidad, fecha, observaciones, created_at
  (camada_id es null cuando se entrega un reproductor)
  (animal_id guarda el id del reproductor entregado, para poder revertir la entrega)

temperature_logs
  id (uuid, auto), date, time, current_temp, min_temp, max_temp, created_at, bioterio_id

extendidos
  id, animal_id, bioterio_id, fecha (date),
  citologia (leucocitos|celulas_ovales|celulas_escamosas),
  claridad (claro|poco_claro),
  apertura_vaginal (si|no|dudosa), lordosis (si|no|dudosa),
  copula (confirmada|no_confirmada|no_observado),
  espermatozoides (encontrados|no_encontrados|dudoso),
  fase (L1|L2|L3|O|E), fase_confirmada (bool),
  es_dia_0 (bool), notas, created_at
  UNIQUE(animal_id, fecha)
```

**Todas las tablas tienen `bioterio_id text NOT NULL DEFAULT 'ratas'`.**

**Estados de un animal:** `activo` → `en_apareamiento` → `en_cria` → `retirado` / `fallecido`

**Tipos de fallo reproductivo (failure_type):** `no_birth` / `failed_pregnancy` / `reabsorption` / `unknown`

---

## Funciones clave en calculos.js

| Función | Descripción |
|---|---|
| `calcularLatencia(camada)` | Días entre cópula y concepción estimada |
| `scorePorLatencia(dias)` | 10/7/5 según latencia (0 = score máximo) |
| `scoreTamanoCamada(n)` | 10/7/5 según crías nacidas |
| `scoreProporcionSexual(m,h)` | 10/7/5 según distribución sexual |
| `scoreSupervivencia(nacidas, destetadas)` | tasa × 10, capeado a 10 |
| `calcularScoresCamada(camada)` | Todos los scores + loss_count + survival_rate |
| `calcularPerfilHembra(id, camadas)` | Promedios históricos de los 4 scores |
| `calcularConfiabilidadHembra(id, camadas)` | Nivel de alerta (ok/leve/moderada/critica) |
| `calcularRendimientoMacho(id, camadas)` | Score promedio + latencia promedio del macho |
| `detectarBajaPerformanceMacho(id, camadas, n)` | Compara últimas N vs historial previo |
| `generarAlertasMachos(animales, camadas)` | Alertas edad_limite / edad_proxima / baja_performance |
| `generarTareas(camadas, animales)` | Tareas del día con prioridad |
| `generarEventosCalendario(camadas, animales)` | Eventos para el calendario |
| `sugerirFase` / `calcularPatronEstral` / `predecirProximoEstro` | Ciclo estral predictivo |
| `generarAlertasEstrales(extendidos, animales)` | Alertas de receptividad y parto próximo |
| `getAnimalesReservados(bioterioActivo)` | Map<animalId, {fecha}> de animales en planes activos |
| `getJaulasReservadas(bioterioActivo)` | Map<bloqueId, {fecha}> de jaulas de stock en planes activos |
| `getReservadosParaHibridos(bioterioId)` | Map de animales/jaulas de BAL/C o C57 reservados para F1 |

---

## Nomenclatura UI vs rutas

| Ruta | Label en sidebar |
|---|---|
| `/animales` | Reproductores |
| `/camadas` | Emparejamientos |

---

## Comportamientos clave

**Formularios:**
- **Carga histórica en CamadaForm:** toggle que habilita animales inactivos/fallecidos para registros del pasado
- **normalizarCamada:** al editar, los campos `null` de Supabase se convierten a `''` o `false` para que los inputs React queden controlados
- **Validaciones temporales:** 6 reglas bloquean el guardado si la secuencia `Nacimiento → Cópula → Parto → Destete` no es coherente. Se omiten si el animal no tiene `fecha_nacimiento`.
- **Prevención de consanguinidad:** banner rojo + checkbox en CamadaForm si se detecta relación padre-hija/madre-hijo

**Stock:**
- **SexoDisplay:** 4 variantes — solo machos / solo hembras / mixto / "sexo sin registrar". `SexoDisplay` desestructura `hembras` (plural).
- **Bloque de jaula:** muestra calidad de padres (♀ Alta/Media/Baja · ♂ Alta/Media/Baja) sin abrir modal
- **Bloques virtuales:** camadas con `fecha_destete` pero sin jaula en DB. Solo si `incluir_en_stock: true` y `bioterio_id === bioterioActivo`
- **stockCamada:** descuenta sacrificios Y entregas de la misma `camada_id`
- **incluir_en_stock:** si `false`, no se crea jaula al destetar. Badge amarillo "Sin stock". Botones Agregar/Remover en detalle expandido
- **Hembras en apareamiento:** bloque gris con opacidad 60%, no seleccionable. No cuenta en `totalJaulas` pero sí en `totalAnimales`
- **Eliminar jaula individual (botón ✕):** abre `ModalEliminarJaula` en overlay, no confirmación inline. Solo visible fuera del modo selección y en bloques de stock. Estado `jaulaAEliminar` en `Stock`.
- **Ciclo de estado automático vía `editarCamada`:** `fecha_separacion` → madre `en_cria` | `fecha_nacimiento` → idem (safety net) | `fecha_destete` → madre `activo`

**Multi-bioterio:**
- IDs posibles: `ratas`, `ratones_balbc`, `ratones_c57`, `ratones_hibridos`
- `bioterio_id` en todas las tablas. Todas las queries filtran por él. Todos los inserts lo incluyen
- `getBio(bioterioId)` → `BIO_RATAS` para ratas, `BIO_RATONES` para cualquier subgrupo de ratones
- `animalesExportados`: array separado en contexto, cargado solo en Híbridos. Contiene reproductores BAL/C y C57 con `exportado_hibridos: true`
- `camadasF1`: array separado en contexto, cargado en BAL/C y C57 para mostrar rendimiento cruzado. No se mezcla con `camadas`
- En Híbridos, `agregarCamada` y `confirmarSeparacion` buscan la madre en `[...animales, ...animalesExportados]`
- Operaciones sobre exportados despachan `EDITAR_ANIMAL_EXPORTADO`, no `EDITAR_ANIMAL`
- En Híbridos, Stock oculta tab "↑ Promover" y botón Promover en selección múltiple

**Estadísticas:**
- Tasa de éxito = `efectivos / (efectivos + fallidos)` — excluye "en curso" del denominador
- Madres con solo fallos (sin parto exitoso) → calidad "Baja", no "En proceso"
- Conteo de animales activos en sidebar y Dashboard: `activo | en_apareamiento | en_cria`

**Temperatura:**
- Queries directas con IDs fijos: ratas = `'ratas'`; ratones = `IN ['ratones', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos']`
- Nuevos registros siempre usan `'ratas'` o `'ratones'`
- `temperature_logs` usa `id uuid` auto-generado por Supabase — no enviar `id` al insertar

**Control de machos:**
- Límite de edad: 270d (9m). Alerta desde 240d (8m). Renovación cada 150d
- `detectarBajaPerformanceMacho` requiere mínimo N+1 camadas. Retorna `null` sin lanzar error si no hay datos suficientes
- Badges y alertas de acción ("sacrificar", "reemplazar") solo en `estado ∈ ['activo', 'en_apareamiento', 'en_cria']`
- Recordatorio de renovación en localStorage (`appMosca_machos_reno_ts`). Botón ✓ lo reinicia

**Planes de apareamiento (localStorage):**
- Key: `appMosca_apareamientos_{bioterioActivo}`. Creados desde Stock o Calendario
- `getAnimalesReservados` → reproductores reservados. `getJaulasReservadas` → jaulas de stock reservadas
- `getReservadosParaHibridos(bioterioId)` → animales/jaulas de BAL/C o C57 con destino F1
- Planes F1 en Calendario llevan `bioterioOrigen` en cada fuente y se muestran como `🧬 F1: X × Y`
- Ninguna reserva bloquea operaciones — solo muestra advertencias

**Censos y consumo (viruta/alimento):**
- Censos = única fuente del aprendizaje adaptativo. Ingresos/compras suman al stock sin alterar historial
- `stockActual = ultimoCenso + sum(ingresos donde fecha >= ultimoCenso.fecha)`
- LS keys viruta: `appMosca_viruta_censos` + `appMosca_viruta_compras`
- `cambioCama` embebido en cada censo: `{ tipo: 'si'|'no'|'parcial', bioteriosAfectados: string[] }`
- Calibración ponderada por confirmaciones: ×1.5 (ambos confirmados) / ×1.0 (uno) / ×0.6 (ninguno)
- `confianzaModelo`: 65% base → +30% proporcional a censos en días de cambio que están confirmados
- `avisoRelleno` suprimido si `ultimoCenso.cambioCama.tipo === 'no'`
- LS keys alimento: `appMosca_alimento_censos` + `appMosca_alimento_ingresos`
- **Aprendizaje por categoría (alimento):** cada censo guarda `composicion: { lactantes, repro, crias, jovenes, adultos }` con `{ count, totalGDia }`. El `useMemo calibracion` computa un factor EWMA independiente por categoría. Solo se actualiza cuando la categoría tuvo animal-días > 0 entre los dos censos. Categorías nunca observadas mantienen el valor bibliográfico. `consumoAjustado` suma las contribuciones con sus factores individuales. La UI muestra tabla "Modelo adaptativo por categoría" con Bibliográfico → Adaptado → Confianza → Animal-días.

**Notas del calendario:**
- LS key: `appMosca_notas_{bioterioActivo}`. Estructura: `{ id, bioterioActivo, fecha, titulo, descripcion, completada, created_at }`
- Dashboard muestra notas con `fecha <= hoy` y `completada: false`

**ResumenRatones:**
- `calcularStockGrupo` clasifica stock por edad (crías <6 sem, jóvenes 6–10 sem, adultos >10 sem)
- Reproductores activos se suman en Adultos (1 animal + 1 jaula, excepto hembras `en_apareamiento` que no suman jaula)
- Camadas fallidas (`failure_flag: true`) se excluyen de los bloques virtuales

**Otros:**
- Scores se calculan en tiempo real — no se guardan en DB
- Separación de pareja: inline desde la lista de camadas, sin abrir modal
- Temperatura imprime con `window.print()` + `@media print` CSS

---

## Implementado recientemente

### Abril 2026 (resumen)
- Perfil reproductivo expandible por animal en Animales (4 scores + confiabilidad en tiempo real)
- Sacrificio parcial de jaulas — input de cantidad editable por jaula en ModalSacrificio
- Estado visual "Parto fallido" — badge rojo + filtro "Fallidas" en Emparejamientos. Columnas `failure_flag` / `failure_type` en Supabase
- Toggle `incluir_en_stock` en CamadaForm — controla si se crea jaula al destetar
- Orden cronológico global de camadas, animales y sacrificios
- Entrega de animales desde Stock (ModalEntrega + página /entregas + botón "Devolver"). Columna `animal_id` en tabla `entregas`
- Prevención de consanguinidad directa — banner rojo + checkbox en CamadaForm
- Calidad de padres en modal de jaula y en cada bloque de Stock (MiniCalidad)
- Página Estadísticas — 4 gráficos reproductivos + KPIs + filtros
- RLS activado en tablas `sacrificios` y `entregas`
- Identidad visual GenERats — componente `GenERatsBrand.jsx`, Lucide React en Landing, responsive mobile
- Promoción de animal de stock a reproductor (desde modal individual y desde selección múltiple)
- Sistema multi-bioterio — `bioterio_id` en todas las tablas, `BioterioActivoContext`, `SelectorBioterio`, `BIO_RATAS`/`BIO_RATONES`
- Módulo de ciclo estral (`CicloEstral.jsx`) — formulario diario, auto-sugerencia de fase, panel gestación, predicción de ciclo individual, alertas en Dashboard

### Mayo 2026

- **Validaciones temporales en datos reproductivos (05/05/2026):** 6 reglas bloquean el guardado si la secuencia `Nacimiento → Cópula → Parto → Destete` no es coherente. Aplican en `AnimalForm` (progenitor más joven que cría) y `CamadaForm` (madurez mínima de hembra, fechas fuera de orden). Se omiten si el animal no tiene `fecha_nacimiento`.

- **Sistema de control de machos reproductores (05/05/2026):** constantes de edad en `constants.js`, `detectarBajaPerformanceMacho` y `generarAlertasMachos` en `calculos.js`. Sección "♂ Control de machos" en Dashboard con banner de renovación periódica (localStorage). Badges de edad y performance en Rendimiento y Animales. Alertas solo en animales activos.

- **Sistema de planificación de apareamientos desde Stock (08/05/2026):** seleccionar exactamente 2 bloques (1 macho + 1 hembra) activa botón "🔗 Planificar apareamiento". Guarda en localStorage `appMosca_apareamientos_{bioterioActivo}`. Alertas en Dashboard con niveles hoy/vencidos y próximos 7 días.

- **Visualización de jaulas vacías durante apareamientos (08/05/2026):** hembras `en_apareamiento` se renderizan con colores grises, badge "Jaula temporalmente vacía", opacidad 60%, no seleccionables. `resumen.totalJaulas` las excluye.

- **Exportación de reproductores a Híbridos (10/05/2026):** columna `exportado_hibridos` en `animales`. `animalesExportados` en contexto (solo en Híbridos). Funciones `exportarAHibridos` / `devolverDeHibridos`. Sección "Reproductores compartidos" en Animales. `CamadaForm` en Híbridos incluye exportados en los selects con badge de colonia.

- **ResumenRatones (10/05/2026):** fetch paralelo de 3 colonias, `calcularStockGrupo` con clasificación por edad + jaulas por categoría. Reproductores activos incluidos en Adultos.

- **Temperatura centralizada (10/05/2026):** 2 tabs fijos (Ratas / Ratones) independientes del bioterio activo. Queries directas con IDs fijos.

- **Calendario: planificación de apareamientos y notas (10/05/2026):** botón "🔗 Planificar apareamiento" al seleccionar día, modal con machos/hembras activos. Sistema de notas/recordatorios con `ModalNota`, acciones ✓/↩/✕, punto ámbar en grilla, sección "Recordatorios" en Dashboard.

- **Reconciliación de estado de hembra al editar camada (10/05/2026):** `editarCamada` y `agregarCamada` calculan el estado correcto de la madre según el progreso real y lo corrigen si no coincide. Regla: `fecha_destete` → `activo` | `fecha_separacion`/`fecha_nacimiento` → `en_cria` | solo `fecha_copula` → `en_apareamiento`.

- **Sistema separado de censos y compras — viruta y alimento (11/05/2026):** censos = aprendizaje adaptativo; ingresos = reposición. `stockActual = ultimoCenso + sum(ingresos desde ultimoCenso)`. Duración auto-calculada. Timeline unificado con consumo por par de censos.

- **Marcado de animales y jaulas reservados (11/05/2026):** `getAnimalesReservados` y `getJaulasReservadas` en `calculos.js`. Badges naranjas en Animales, Stock (BloqueJaula), advertencias en ModalSacrificio/ModalEntrega, aviso en CamadaForm. No bloquean operaciones.

- **Planificación de apareamientos desde jaulas de stock (11/05/2026):** tabs "Reproductor" / "📦 Jaula de stock" en el modal. Plan mixto posible (ej: macho reproductor × jaula jóvenes hembras). `bloqueId` con prefijo `j-` (real) o `v-` (virtual).

- **Planificación de cruces F1 desde Calendario en modo Híbridos (11/05/2026):** carga datos de BAL/C y C57 via Promise.all. Columnas fijas: ♂ BALB/C (machos) / ♀ C57 (hembras). `bioterioOrigen` en el plan. `getReservadosParaHibridos` para badges `🧬 Destino F1` en Stock de cada cepa.

- **Mejoras de sidebar (12/05/2026):** ficha biológica colapsable (arranca cerrada, persiste en localStorage). Separadores en nav. Botón "Cambiar" reemplaza ícono `RefreshCw`. Madurez sin decimales. Contador de preñadas excluye `failure_flag: true`.

- **Fix: crías F1 solo visibles en Híbridos (12/05/2026):** `camadasF1` es array separado en el contexto (dispatch `SET_CAMADAS_F1`), no se mezcla con `camadas`. Stock filtra bloques virtuales por `bioterio_id === bioterioActivo`. `Rendimiento` y `Estadísticas` usan `todasCamadas = [...camadas, ...camadasF1]`.

- **Progenitores en bloques de stock (12/05/2026):** `todosAnimales = [...animales, ...animalesExportados]` para buscar padre/madre. Display `♀ H12 [BAL/C]` / `♂ M5 [C57]` con color por sexo y badge de colonia.

- **Alerta de crías F1 listas para sacrificio en Dashboard (12/05/2026):** en Híbridos, camadas F1 con ≥40 días sin destetar ni sacrificar generan tarea `SACRIFICIO_F1` con prioridad según días (40–49 → próxima / 50–54 → hoy / ≥55 → vencida). `tareasF1` useMemo separado en `Dashboard.jsx`.

- **Paleta modo claro biomédica/institucional (14/05/2026):** `TEMA_CLARO` rediseñado en `ThemeContext.jsx`. Fondos: `#F1F5F9` / `#EAF2F7` (gris frío, sin azul cielo). Textos Slate (`#1E293B` / `#64748B` / `#94A3B8`). Verde institucional `#059669` (Emerald 600, legible sobre blanco). Bloque `.modo-claro` en `index.css` cubre scrollbar, selección de texto, `.glow-green` → sombra suave sin neon, `.bg-dots`, `.border-neon` y `color-scheme: light` en inputs nativos.

- **ModalEliminarJaula — confirmación overlay al eliminar jaula individual (14/05/2026):** reemplaza el antiguo "¿Eliminar? ✓ ✕" inline dentro del bloque. El botón ✕ en cada jaula de stock ahora abre `ModalEliminarJaula`: muestra progenitores, categoría, edad y total de animales de la jaula. Advertencia roja "Esta acción no se puede deshacer" con mensaje diferente para jaulas reales vs virtuales. Botones: Cancelar / ✕ Eliminar jaula. Mismo estilo visual que `ModalSacrificio`.

- **Corrección de consumo por relleno de jaulas (22/05/2026):** `probRellenoPorHorario(fecha, hora)` estima prob. de relleno según día+hora (alta en lun/vie tarde 85–90%, media en lun/vie mañana 55–65%). El modal de censo captura hora (auto-completada) y `rellenoKg` con presets y sugerencia del histórico aprendido. Banner reactivo muestra la probabilidad mientras se selecciona la hora. `consumidoG = observado − rellenoKg` en calibración EWMA y helper `consumoPorCenso`. `rellenoAprendido` useMemo aprende el promedio histórico. `avisoRelleno` banner en el panel principal cuando el último censo tiene ≥45% de prob. sin corrección. Timeline muestra desglose Observado / Relleno / Consumo real.

- **Aprendizaje adaptativo por categoría en consumo de alimento (22/05/2026):** cada categoría (lactantes, repro, crías, jóvenes, adultos) construye su propio factor EWMA. Solo se actualiza cuando tuvo animal-días > 0 entre dos censos. Categorías ausentes en todos los períodos mantienen el valor bibliográfico sin modificación. Cada censo ahora guarda campo `composicion: { lactantes, repro, crias, jovenes, adultos }` con `{ count, totalGDia }`. `consumoAjustado` suma contribuciones individuales con sus factores propios. Nueva tabla "Modelo adaptativo por categoría" muestra: Categoría | Bibliográfico | Adaptado | Ajuste% | Confianza (barra) | Animal-días observados. El badge "global" indica que la categoría usa el factor general por falta de observaciones propias.

- **Sistema de confirmación de cambios de cama (22/05/2026):** cada censo puede tener un campo `cambioCama: { tipo: 'si'|'no'|'parcial', bioteriosAfectados: string[] }` guardado en localStorage. Al registrar censo en Lunes o Viernes aparece sección "¿Se realizó cambio de cama?" con botones Sí / No / Parcial; si es Parcial se muestran checkboxes por bioterio (Ratas, Balb/C, C57, Híbridos). `ModalConfirmarCambio` permite confirmar post-hoc desde: botón "Confirmar cambio de cama" en el panel de ciclo (cuando el último censo es de un día de cambio sin confirmar), y botón "Confirmar ✓" inline en cada fila del historial. Efectos: `avisoRelleno` se suprime si `tipo === 'no'`; muestra badge verde/celeste si confirmado. `confianzaModelo` useMemo: escala de 65% (base, sin confirmaciones) a 95% (todos los censos en días de cambio confirmados) — barra de progreso visible en el panel de predicción y en el panel de ciclo. Calibración ponderada: períodos con ambos censos confirmados → peso ×1.5, uno confirmado → ×1.0, ninguno → ×0.6. Timeline muestra badges diferenciados: "✅ Cambio confirmado" / "— Sin cambio" / "⚡ Parcial: [bioterios]" / "🔄 Probable cambio" (inferido).

- **Sistema de genealogía y análisis de consanguinidad (22/05/2026):**
  - `genealogia.js`: motor con `buildPedigree`, `calcularFCoeficiente` (método de Wright), `detectarParentesco`, `getAncestores`, `estadisticasColonia`, `evaluarApareamientoGenetico`. F = Σ (0.5)^(d_sire + d_dam + 1) sobre ancestros comunes incluyendo al progenitor mismo a profundidad 0 (detecta padre-hija, abuelo-nieta, etc.)
  - `CamadaForm`: panel F de Wright al seleccionar pareja — color verde (<6.25%), amarillo (6.25–12.5%), naranja (12.5–25%), rojo (≥25%). Requiere confirmación cuando F ≥ 12.5%. Detección y label de tipo de parentesco (hermanos completos, medios hermanos, abuelo/nieto, tío/sobrino, primos).
  - `Animales` (`PerfilAnimal`): nueva sección "Genealogía" con coeficiente F individual del animal, badges de progenitores con color por sexo (♀ violeta / ♂ celeste), lista de abuelos, barra de nivel de consanguinidad.
  - `GenealogiaGlobal`: página global accesible desde SelectorBioterio. KPIs (F promedio, animales sin ancestros, animales con F>12.5%), distribución de F por bioterio (barras por nivel), simulador interactivo de apareamiento (selección hembra+macho → F predicho + recomendación), tabla completa de animales activos ordenada por F descendente con badge de bioterio.

---

## Qué falta / pendiente

- [ ] Notificaciones push o por email cuando hay tareas vencidas
- [ ] Módulo de reportes con exportación real (PDF/Excel)
- [ ] Historial de cambios por animal/camada (auditoría)
- [ ] Modo offline con sincronización posterior
- [x] ~~Multi-colonia o multi-usuario con roles~~ → implementado como multi-bioterio (ratas + ratones con subgrupos)
