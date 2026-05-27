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
| **Planificación** | Índice de estabilidad 0-100, mínimos por bioterio, proyección 30/60/90/180d, candidatos a renovación, simulador de impacto |
| **Pedidos** | Gestión de pedidos de producción con estrategia automática: parejas necesarias, fechas óptimas, reproductores sugeridos, índice de viabilidad 0-100, escenarios A/B, calendario del pedido |
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
- LS keys alimento: `appMosca_alimento_censos` + `appMosca_alimento_ingresos` + `appMosca_alimento_reposiciones`
- **Reposición confirmada vs declarada:** `reposicionesEnPeriodo > 0` (confirmada standalone) toma prioridad total sobre `censoActual.rellenoKg` (declarado en censo). `fuenteRelleno: 'confirmado' | 'declarado' | 'ninguno'`. Pesos EWMA: confirmado → ×1.4; `bonusConfirmados = min(15, nConfirmados × 5)` puntos extra de confianza.
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

### Abril 2026
Perfil reproductivo por animal (4 scores + confiabilidad), sacrificio parcial de jaulas, `failure_flag`/`failure_type` en camadas, toggle `incluir_en_stock`, orden cronológico global, entrega de animales (/entregas + Devolver, columna `animal_id`), prevención consanguinidad directa, calidad de padres en Stock (MiniCalidad), página Estadísticas, RLS en sacrificios/entregas, identidad visual GenERats, promoción stock→reproductor, sistema multi-bioterio completo, módulo ciclo estral.

### Mayo 2026

- **Validaciones temporales (05/05):** 6 reglas en CamadaForm/AnimalForm bloquean secuencia incoherente Nacimiento→Cópula→Parto→Destete. Se omiten si no hay `fecha_nacimiento`.
- **Control de machos (05/05):** límite 270d, alerta 240d, renovación 150d. Sección en Dashboard, badges en Rendimiento/Animales. Solo en animales activos. LS: `appMosca_machos_reno_ts`.
- **Planes de apareamiento (08/05):** seleccionar 1♂+1♀ en Stock → botón "Planificar". LS: `appMosca_apareamientos_{bio}`. Alertas en Dashboard. Hembras `en_apareamiento` → bloque gris, opacidad 60%, no seleccionable, excluida de `totalJaulas`.
- **Exportación a Híbridos (10/05):** columna `exportado_hibridos` en animales. `animalesExportados` en contexto (solo Híbridos). Dispatch `EDITAR_ANIMAL_EXPORTADO`. `CamadaForm` incluye exportados en selects con badge de colonia.
- **ResumenRatones (10/05):** fetch paralelo 3 colonias. `calcularStockGrupo` clasifica <6sem/6–10sem/>10sem. Reproductores incluidos en Adultos.
- **Temperatura centralizada (10/05):** 2 tabs fijos (Ratas/Ratones) independientes del bioterio activo. IDs fijos en queries.
- **Calendario: planes + notas (10/05):** modal de apareamiento al seleccionar día. Notas en LS: `appMosca_notas_{bio}`. Dashboard muestra notas vencidas no completadas.
- **Reconciliación estado hembra (10/05):** `editarCamada` corrige estado madre: `fecha_destete`→`activo` / `fecha_separacion`/`fecha_nacimiento`→`en_cria` / solo `fecha_copula`→`en_apareamiento`.
- **Censos separados viruta/alimento (11/05):** censos = aprendizaje EWMA; ingresos = reposición de stock. `stockActual = ultimoCenso + Σingresos_desde_ultimoCenso`.
- **Reservas (11/05):** badges naranjas en Animales/Stock/modales. No bloquean operaciones. LS: `appMosca_reservas`.
- **Planes F1 desde Calendario (11/05):** en modo Híbridos, carga BAL/C y C57. `bioterioOrigen` en cada plan. `getReservadosParaHibridos` para badges 🧬 en Stock de cada cepa.
- **Sidebar mejoras (12/05):** ficha biológica colapsable (persiste en LS). Contador preñadas excluye `failure_flag: true`.
- **Fix camadasF1 (12/05):** array separado (`SET_CAMADAS_F1`), nunca mezclado con `camadas`. `Rendimiento`/`Estadísticas` usan `todasCamadas = [...camadas, ...camadasF1]`.
- **Alerta crías F1 (12/05):** ≥40d sin destetar → tarea `SACRIFICIO_F1` (40–49d próxima / 50–54d hoy / ≥55d vencida). `tareasF1` useMemo separado en Dashboard.
- **Modo claro biomédico (14/05):** `TEMA_CLARO` en ThemeContext.jsx. Fondos `#F1F5F9`/`#EAF2F7`, verde `#059669`. Clase `.modo-claro` en index.css.
- **ModalEliminarJaula (14/05):** botón ✕ en bloque de stock → overlay con detalle. Estado `jaulaAEliminar` en Stock.
- **Consumo viruta con relleno (22/05):** `probRellenoPorHorario(fecha, hora)` estima prob. lun/vie. `consumidoG = observado − rellenoKg` en EWMA. `avisoRelleno` suprimido si `cambioCama.tipo === 'no'`. Calibración: ×1.5/×1.0/×0.6 según confirmaciones. `confianzaModelo`: 65→95%.
- **Aprendizaje alimento por categoría (22/05):** EWMA independiente por (lactantes/repro/crías/jóvenes/adultos). Censos guardan `composicion:{count,totalGDia}`. Confirmadas tienen prioridad total sobre declaradas (EWMA ×1.4). LS: `appMosca_alimento_reposiciones`.
- **Índice sanitario + incidentes (22/05):** `sanitario.js` con `calcularIndiceSanitario`, `detectarPatrones`, `generarTendencias`. `Incidentes.jsx` rediseñado con panel 0–100 y patrones. `SelectorBioterio` muestra badge sanitario. SQL necesaria: `ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS tipo_categoria text DEFAULT 'otro', tipo_incidente text DEFAULT 'otro', severidad text DEFAULT 'leve', animal_id uuid REFERENCES animales(id) ON DELETE SET NULL, camada_id uuid REFERENCES camadas(id) ON DELETE SET NULL, resuelto boolean DEFAULT false;`
- **Genealogía y consanguinidad (22/05):** `genealogia.js` con F de Wright (`buildPedigree`, `calcularFCoeficiente`). Panel F en CamadaForm (confirmación si F≥12.5%). Sección genealógica en PerfilAnimal. Página GenealogiaGlobal desde SelectorBioterio.
- **Fix genealogía — pedigree global (24/05):** todos los cálculos usan `pedigreeGlobal` (no por bioterio — corrige F=0 falso en híbridos). `buildPedigree` recupera padres desde `notas` de animales promovidos. `estadoGenealogiaAnimal` → completo🟢/parcial🟡/insuficiente🔴. `ancestrosComunes` incluye `profMadre`, `profPadre`, `codigo`.
- **Planificación colonia (24/05):** `motorDecisiones.js` — mínimos críticos por bioterio (ratas: 3♂+2♀ / C57: 2♂+2♀+2♀F1 / BALB: 2♂+2♀+2♂F1), proyección 30/60/90/180d, candidatos renovación (40% genética+30% familiar+20% edad+10% disp.), jerarquía 8 niveles (Supervivencia > Mínimos > Híbridos > Renovación > Calidad > Consanguinidad > Saturación > Sacrificios). Ruta `/planificacion`.
- **Pedidos de producción (24/05):** `motorPedidos.js` — fechas en reversa (Entrega←edad←Destete←Parto←Gestación←Cópula), escenarios A/B, viabilidad 0–100. `Pedidos.jsx` en `/pedidos`. LS: `appMosca_pedidos`.
- **Sistema causal predictivo sanitario+ambiental (25/05):** `sanitario.js` expandido — índice ambiental (riesgo 20–24°C), correlaciones temperatura/incidentes/camadas, motor causal con hipótesis, riesgo genético (F+malformaciones+fallos+supervivencia), alertas multi-nivel (atención🟡/importante🟠/crítico🔴/urgente⚫), recomendaciones del día. `Incidentes.jsx` con 4 tabs: Lista / 🌡️ Ambiente / 🔬 Motor causal / 📊 Estadísticas.
- **Motor causal multifactorial completo (26/05):** cruce de 6 factores simultáneos (temperatura+consanguinidad+saturación+genética+renovación+incidentes). `generarMotorCausalCompleto` en `sanitario.js`. `detectarLineasProblematicas` → penaliza candidatos en renovación. `evaluarBloqueoApareamiento` → bloquea cruzas con F≥25% o malformaciones+F≥12.5%. `calcularCandidatosRenovacion` acepta 7mo param `lineasProblematicas` (penalización: critico=-30/moderado=-15/leve=-7). En `motorDecisiones.js`.
- **Deterioro progresivo (26/05):** `detectarDeterioroProgresivo` en `sanitario.js` — ventanas 30/60/90/180/365d, detecta fertilidad↓ mortalidad↑ malformaciones↑ en tendencia reciente. Panel tabla en tab Motor Causal de Incidentes.
- **Motor "¿Qué hacer hoy?" (26/05):** `generarDecisionesHoy` en `sanitario.js` — acciones concretas priorizadas (0=urgente→4=info). Panel visible en tab Motor Causal. Tipos: sanitario/genético/ambiental/saturación/renovación/reproductivo.
- **Riesgo multifactorial en Pedidos (26/05):** `evaluarRiesgoMultifactorialPedido` en `motorPedidos.js` — evalúa 5 factores (F selección, supervivencia 90d, temperatura 14d, incidentes graves, malformaciones 90d) antes de habilitar pedido. `calcularIndiceViabilidad` aplica penalización (-7 alerta / -15 crítico).
- **Motor unificado de planificación (26/05):**
  - **Fix "Sin candidatos":** `calcularMotorRenovacionUnificado` ahora busca candidatos en rango 85%–100% de madurez, mostrando "promover en Xd" en lugar de "sin candidatos" cuando hay uno próximo. Elimina contradicción con sección de candidatos a renovación.
  - **Fix simulador impacto:** `calcularIndiceViabilidad` capea score a 59 si se rompen mínimos → nunca muestra "Viable" cuando la colonia queda comprometida. `evaluarImpactoColonia` agrega campo `etiquetaRiesgo: '🔴 Riesgo colonia'`.
  - **stockNeto por horizonte:** `calcularProyeccionAvanzada` agrega `stockNeto: { nacidos, sobreviven, mortalidadNatural, sacrificiosEstimados, promocionesEstimadas, neto }` en cada horizonte. Visible en tarjetas y en la sección de detalle.
  - **NUEVA `calcularIndiceSostenibilidad(params) → 0-100`:** 7 factores: genética(20)+renovación(20)+producción(15)+sanidad(15)+saturación(10)+pedidos(10)+capacidad(10). Reglas duras: déficit activo→máx 75, déficit futuro sin cobertura 60d→máx 65. Labels: Sostenible/Intervención/Riesgo.
  - **NUEVA `OBJETIVOS_ESTRATEGIA` + `generarModoEstrategia(objetivo, contexto)`:** 6 modos — mantener/expandir/reducir/hibridos/pedidos/diversidad. Cada modo ajusta recomendaciones, restricciones y parámetros (maxSacrificiosPorPeriodo, umbralSaturacion, prioridadApareamientos).
  - **PlanificacionColonia.jsx:** 2 nuevas secciones — "Índice de Sostenibilidad" (gauge 0-100 + desglose por factor) y "Modo Estrategia" (selector de objetivo + KPIs + recomendaciones dinámicas + restricciones activas).

---

## ⚠️ PENDIENTE CRÍTICO: Migración localStorage → Supabase

> **NUNCA olvidar:** Todo dato de negocio DEBE ir a Supabase, no a localStorage.
> localStorage se pierde al limpiar caché del navegador y no se sincroniza entre dispositivos.

Las siguientes features aún guardan en localStorage y requieren tablas en Supabase:

| Feature | LS Key | Tabla Supabase necesaria |
|---|---|---|
| Notas/recordatorios dashboard | `appMosca_notas_{bioId}` | `notas` |
| Planes de apareamiento | `appMosca_apareamientos_{bioId}` | `planes_apareamiento` |
| Reservas de animales/jaulas | `appMosca_reservas` | `reservas` |
| Censos de viruta | `appMosca_viruta_censos` | `censos_viruta` |
| Compras de viruta | `appMosca_viruta_compras` | `ingresos_viruta` |
| Censos de alimento | `appMosca_alimento_censos` | `censos_alimento` |
| Ingresos de alimento | `appMosca_alimento_ingresos` | `ingresos_alimento` |
| Reposiciones de alimento | `appMosca_alimento_reposiciones` | `reposiciones_alimento` |

SQL completo para crear estas tablas está en `src/utils/sanitario.js` al final del archivo (sección SQL — Referencia para Supabase).

---

## Qué falta / pendiente

- [ ] **Migrar localStorage → Supabase** (ver tabla arriba — PRIORITARIO)
- [ ] Notificaciones push o por email cuando hay tareas vencidas
- [ ] Módulo de reportes con exportación real (PDF/Excel)
- [ ] Historial de cambios por animal/camada (auditoría)
- [ ] Modo offline con sincronización posterior
- [x] ~~Multi-colonia o multi-usuario con roles~~ → implementado como multi-bioterio (ratas + ratones con subgrupos)
