# AppMosca — Bioterio 🧬

## Protocolo de trabajo

> **Regla:** después de cada commit que agregue una **feature nueva** (no fixes ni refactors), actualizar este CLAUDE.md con:
> - La descripción de la feature en "Implementado recientemente"
> - El comportamiento de datos relevante en "Comportamientos de datos importantes" (si aplica)
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
| **Sacrificios** | Selección múltiple de jaulas desde stock para registrar sacrificios en masa |
| **Entregas** | Historial de animales entregados a investigadores, con buscador y resumen numérico |
| **Rendimiento** | Ranking de machos por latencia de fertilización (menor = mejor) con scores |
| **Estadísticas** | Dashboard visual con 4 gráficos: partos vs fallas, calidad de madres, supervivencia de camadas, eficiencia de apareamiento. KPIs resumen + filtros por fecha y reproductor |
| **Temperatura** | Registro diario de temperatura (actual/mín/máx), vista mensual, exportación imprimible y limpieza de datos por mes |
| **Reportes** | Impresión de datos de la colonia |

**Motor predictivo:** calcula automáticamente fechas de parto (gestación 23d), destete (21d), madurez sexual (84d) y genera tareas con prioridad.

**Flujo reproductivo:** Cópula → Estado "en apareamiento" (15d) → Separación → Preñez → Parto → Destete → Stock por jaulas. Estado de la hembra: `activo` → `en_apareamiento` → `en_cria` → `activo` (ciclo completo automático).

**Sistema de scores reproductivos (calculados en tiempo real, sin DB):**
- Velocidad de reproducción: latencia **0–5d** → 10pts / 6–10d → 7pts / 11–15d → 5pts (latencia 0 = fecundación el mismo día del apareamiento, es score máximo)
- Tamaño de camada: ≥10 → 10pts / 8–9 → 7pts / <8 → 5pts
- Proporción sexual: más hembras → 10pts / igual → 7pts / más machos → 5pts
- Supervivencia al destete: (destetados/nacidos) × 10

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
│   ├── BiotheriumContext.jsx        — Estado global (animales, camadas, jaulas, sacrificios, entregas, temperaturas, extendidos, animalesExportados)
│   └── BioterioActivoContext.jsx    — Bioterio activo en localStorage (bioterioActivo, bio, config)
├── utils/calculos.js                — Motor predictivo, scores reproductivos, confiabilidad de hembras
├── utils/constants.js               — Constantes biológicas (BIO_RATAS, BIO_RATONES, BIO, ESTADO_ANIMAL, TIPO_TAREA)
├── components/
│   ├── Sidebar.jsx                  — Navegación (drawer en mobile, incluye link Temperatura)
│   ├── Modal.jsx, Badge.jsx
│   ├── AnimalForm.jsx
│   ├── CamadaForm.jsx               — Formulario de camada + registro de fallos reproductivos
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
    └── ConsumoViruta.jsx            — Predicción adaptativa de consumo de viruta por tipo de jaula con censo en bolsas (paso 0.25)
```

---

## Tablas en Supabase

```
animales
  id, codigo, sexo, estado, fecha_nacimiento, notas,
  fecha_sacrificio, motivo_sacrificio,
  exportado_hibridos (bool, default false) — marcado cuando el reproductor se comparte con la colonia Híbridos

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
  id, date, time, current_temp, min_temp, max_temp, created_at

extendidos
  id, animal_id, bioterio_id, fecha (date),
  citologia (leucocitos|celulas_ovales|celulas_escamosas),
  claridad (claro|poco_claro),
  apertura_vaginal (si|no|dudosa),
  lordosis (si|no|dudosa),
  copula (confirmada|no_confirmada|no_observado),
  espermatozoides (encontrados|no_encontrados|dudoso),
  fase (L1|L2|L3|O|E), fase_confirmada (bool),
  es_dia_0 (bool — día de cópula confirmada = inicio gestación),
  notas, created_at
  UNIQUE(animal_id, fecha)
```

**Estados de un animal:** `activo` → `en_apareamiento` → `en_cria` → `retirado` / `fallecido`

**Tipos de fallo reproductivo (failure_type):**
`no_birth` / `failed_pregnancy` / `reabsorption` / `unknown`

---

## Funciones clave en calculos.js

| Función | Descripción |
|---|---|
| `calcularLatencia(camada)` | Días entre cópula y concepción estimada |
| `scorePorLatencia(dias)` | 10/7/5 según latencia |
| `scoreTamanoCamada(n)` | 10/7/5 según crías nacidas |
| `scoreProporcionSexual(m,h)` | 10/7/5 según distribución sexual |
| `scoreSupervivencia(nacidas, destetadas)` | tasa × 10 |
| `calcularScoresCamada(camada)` | Todos los scores + loss_count + survival_rate |
| `calcularPerfilHembra(id, camadas)` | Promedios históricos de los 4 scores |
| `calcularConfiabilidadHembra(id, camadas)` | Nivel de alerta (ok/leve/moderada/critica) |
| `calcularRendimientoMacho(id, camadas)` | Score promedio + latencia promedio del macho |
| `generarTareas(camadas, animales)` | Tareas del día con prioridad |
| `generarEventosCalendario(camadas, animales)` | Eventos para el calendario |

---

## Nomenclatura UI vs rutas

| Ruta | Label en sidebar |
|---|---|
| `/animales` | Reproductores |
| `/camadas` | Emparejamientos |

El código interno y Supabase usan `animales`/`camadas`. El usuario ve "Reproductores"/"Emparejamientos".

---

## Comportamientos importantes

- **Carga histórica en CamadaForm:** toggle que habilita animales inactivos/fallecidos para registros del pasado
- **Separación de pareja:** inline desde la lista de camadas, sin abrir modal
- **Scores son calculados en tiempo real** — no se guardan en DB, se derivan de los datos existentes
- **Temperatura:** la impresión usa `window.print()` con `@media print` CSS para ocultar la UI y mostrar solo la tabla limpia
- **Jaulas en stock:** `SexoDisplay` muestra 4 variantes según datos disponibles: solo hembras, solo machos, mixto (♂M/♀H), o "X animales — sexo sin registrar" cuando faltan datos. Funciona para jaulas reales y bloques virtuales.
- **failure_flag en camada:** cuando está activo, la camada muestra estado `fallida` con badge rojo "✕ Parto fallido" en la lista y alimenta el cálculo de confiabilidad de la hembra. Hay filtro "Fallidas" en la barra de filtros.
- **incluir_en_stock en camada:** controla si las crías se agregan al stock al registrar el destete. Default `true`. Si es `false`, la jaula NO se crea automáticamente y aparece badge amarillo "Sin stock". Botones "Agregar al stock" / "Remover del stock" en el detalle expandido permiten cambiarlo después. Scores y estadísticas no se ven afectados.
- **normalizarCamada en CamadaForm:** al editar una camada existente, los campos `null` de Supabase se convierten a `''` o `false` para que los inputs React queden siempre controlados y los cambios se capturen correctamente.
- **AnalisisReproductivo en Camadas:** siempre visible al expandir una camada si hay padres identificados. Si no hay historial previo muestra "Sin camadas previas con parto registrado". No depende de datos históricos para renderizar.
- **temperature_logs en Supabase:** usa `id uuid` (auto-generado por Supabase). Al insertar, NO se manda el `id` — se deja que Supabase lo genere y luego se reemplaza el registro temporal en el estado local. Las otras tablas usan `id text` generado por `generarId()`.

---

## Implementado recientemente

- **Perfil reproductivo en Animales (14/04/2026):** fila expandible por animal con botón "▼ Perfil". Hembras: 4 scores promedio (velocidad fertiliz., tamaño camada, proporción sexual, supervivencia) + badge de confiabilidad. Machos: score de fertilización + latencia promedio. Calculado en tiempo real con `calcularPerfilHembra`, `calcularConfiabilidadHembra`, `calcularRendimientoMacho`.
- **Gráficos de evolución de stock (14/04/2026):** nueva tab "📈 Evolución" en Stock. Usa recharts (instalado). Muestra: área de stock total acumulado en el tiempo + barras de nacimientos vs. sacrificios por mes + resumen numérico (stock actual / total nacidos / total sacrificados). Filtros de rango: 6 meses, 12 meses, todo el historial. Construido en tiempo real desde `camadas` y `sacrificios` sin datos extra en DB.
- **Sacrificio parcial de jaulas (14/04/2026):** en `ModalSacrificio` cada jaula de stock ahora tiene un input editable de cantidad (1 hasta el total). Si sacrificás menos del total, la jaula queda con el resto (se actualiza con `editarJaula`); si sacrificás todo, se elimina. Los machos/hembras se reducen proporcionalmente. Reproductores siempre sacrifican 1 (sin cambio).
- **Fix edición de parto fallido (15/04/2026):** columnas `failure_flag` y `failure_type` faltaban en la tabla `camadas` de Supabase — se agregaron con ALTER TABLE. `normalizarCamada()` en CamadaForm convierte nulos a vacíos para evitar inputs no controlados.
- **Estado visual "Parto fallido" (15/04/2026):** camadas con `failure_flag: true` muestran estado `fallida` con badge rojo "✕ Parto fallido" y filtro "Fallidas" en Emparejamientos.
- **Control de stock para apareamientos históricos (15/04/2026):** toggle "Incluir crías en el stock" en CamadaForm. Si desactivado: no se crea jaula al destetar, badge amarillo "Sin stock" en la lista, botones "Agregar/Remover del stock" en detalle expandido. Columna `incluir_en_stock` en Supabase.

- **Orden cronológico global (15/04/2026):** datos de camadas, animales y sacrificios se ordenan por fecha real del evento tanto en la carga inicial desde Supabase como al agregar registros nuevos. Emparejamientos ordenados por `fecha_copula` descendente.

- **Gráfico de evolución mejorado (15/04/2026):** múltiples correcciones y mejoras al gráfico Stock → Evolución:
  - Bug crítico corregido: campo `jaula` en `registrarSacrificio` causaba fallo silencioso en Supabase — eliminado
  - Bug corregido: `sacrificarReproductor` ahora también inserta en tabla `sacrificios` con `categoria: 'reproductor'` → aparece en el gráfico
  - Bug corregido: sacrificios sin `fecha` usan `created_at` de Supabase como respaldo para ubicarlos en la línea temporal
  - Rango por defecto cambiado a "Todo el historial"
  - Tarjetas de resumen calculan totales globales desde arrays crudos (independientes del rango seleccionado)
  - Nuevas métricas: mortalidad pre-destete (línea naranja), reproductores sacrificados, promedio crías/camada, tasa de supervivencia al destete con semáforo de color
  - Nacimientos usan `total_destetados` (stock real) en lugar de `total_crias`
  - Respeta `incluir_en_stock: false` en el cálculo de nacimientos

- **Vista por categorías sincronizada (15/04/2026):** `datosResumen` ahora usa `bloques` como fuente única de verdad — mismo dato que Vista por jaulas. Elimina desincronización cuando jaulas son editadas directamente. Lactantes siguen calculándose desde camadas pre-destete.

- **Bloques virtuales respetan incluir_en_stock (15/04/2026):** camadas marcadas como "Sin stock" ya no generan bloque virtual en la vista de jaulas.

- **Registrar fecha de sacrificio en reproductores históricos (15/04/2026):** en Sacrificios → sección Reproductores, cada animal sin fecha muestra botón "+ Registrar fecha" con input inline. Al guardar crea registro en tabla `sacrificios` con `categoria: 'reproductor'` y la fecha correcta → aparece inmediatamente en el gráfico.

- **Fix latencia 0 en score de machos (16/04/2026):** `scorePorLatencia` ahora acepta latencia = 0 (fecundación el mismo día del apareamiento) como score máximo (10 pts). Latencias negativas devuelven `null` como error de datos.

- **Fix timezone en gráfico de evolución (16/04/2026):** `new Date('YYYY-MM-01')` se parseaba como UTC medianoche → en Argentina (UTC-3) caía el día anterior → los labels del eje X mostraban el mes equivocado (abril aparecía como marzo). Solución: usar `T12:00:00` al construir las fechas y `getFullYear()`/`getMonth()` para armar la clave del mes.

- **Acción "Entregar animales" desde selección múltiple (16/04/2026):** en Stock, al seleccionar jaulas aparece botón "📦 Entregar" (amarillo) junto al de sacrificio. Abre `ModalEntrega` con cantidad editable por jaula, fecha y campo observaciones (ej: iniciales de investigador). Stock de crías: se reduce o elimina la jaula igual que en sacrificio. Reproductores: pasan a estado `retirado` en vez de `fallecido`. Todo queda registrado en la tabla `entregas` de Supabase.

- **Página Entregas (16/04/2026):** nueva ruta `/entregas` en sidebar (📦). Lista cronológica de todas las entregas con tarjetas de resumen (total entregas, total animales, últimos 30 días) y buscador por observaciones/código/fecha.

- **Botón "Devolver" en historial de entregas (17/04/2026):** cada registro del historial tiene un botón "↩ Devolver" que abre un menú con 2 opciones:
  - **"Devolver al stock"** → restaura la jaula/animal y mantiene el registro en el historial
  - **"Devolver y borrar del historial"** → restaura la jaula/animal y elimina el registro como si nunca hubiera existido
  - Crías: se recrea la jaula con la cantidad devuelta (machos/hembras sin registrar)
  - Reproductores: el animal vuelve a estado `activo` (requiere columna `animal_id` en tabla `entregas`)
  - ⚠️ Requiere ejecutar en Supabase: `ALTER TABLE entregas ADD COLUMN animal_id text;`
  - Entregas de reproductores anteriores a este cambio no tienen `animal_id`, por lo que no pueden restaurar el estado del animal automáticamente

- **Prevención de consanguinidad directa (21/04/2026):** en `CamadaForm`, al seleccionar la pareja se detecta automáticamente si hay relación padre-hija o madre-hijo (usando `id_madre`/`id_padre` del animal). Si se detecta: aparece un banner rojo 🧬 con los códigos involucrados y un checkbox de confirmación explícita. El botón guardar se bloquea hasta que el usuario confirme el riesgo. Si se cambia la pareja, la confirmación se resetea. Solo detecta relaciones si los progenitores están registrados en el animal.

- **Calidad de padres en modal de jaula (21/04/2026):** en Stock → modal de jaula → pestaña "Ver", se muestran dos filas de calidad debajo de "Progenitores". Hembra: promedio de los 4 scores históricos (`calcularPerfilHembra`). Macho: score de latencia (`calcularRendimientoMacho`). Badge de color verde/amarillo/rojo (Alta/Media/Baja) con score numérico y cantidad de camadas en que se basa.

- **Calidad de padres visible en cada bloque de jaula (21/04/2026):** sin necesidad de abrir el modal, cada bloque de stock muestra al pie dos filas: `♀ H12 Alta` / `♂ M5 Media`. Implementado en el componente `BloqueJaula` con el sub-componente `MiniCalidad`. Si el animal no tiene historial, muestra `—`. Solo aparece en bloques de tipo stock (no en reproductores sueltos).

- **Página de Estadísticas visuales (21/04/2026):** nueva ruta `/estadisticas` (📈 en sidebar). 4 KPIs + 4 gráficos con recharts:
  - **Partos vs Fallas** (torta): efectivos / fallidos / en curso
  - **Calidad de Madres** (barras): cantidad de madres Alta / Media / Baja / Sin datos
  - **Supervivencia de Camadas** (torta): 100% destetados vs. con pérdidas
  - **Eficiencia de Apareamiento** (barras): latencia 0–5d / 6–10d / >10d
  - Filtros: rango de fechas (desde/hasta) + madre específica + padre específico
  - La calidad de madres usa historial completo del animal (no solo el rango filtrado)

- **Eliminación de tab Evolución en Stock (21/04/2026):** la sección "📈 Evolución" fue removida de Stock ya que la página de Estadísticas cubre esa función. Se eliminaron `GraficoEvolucion`, `mesStr` y los imports de recharts de Stock.jsx (−298 líneas).

- **Fix sidebar — sección Ratón doméstico no visible (22/04/2026):** el `nav` tenía `flex-1` sin `overflow-y-auto`, por lo que los links se desbordaban visualmente y tapaban la ficha biológica. Fix: `nav` scrollea internamente con `overflow-y-auto`; se eliminaron `min-h-screen` y `overflow-y-auto` del `aside` que eran redundantes.

- **RLS activado en tablas sacrificios y entregas (22/04/2026):** Supabase Security Advisor reportaba RLS desactivado en esas dos tablas. Se ejecutaron `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + políticas `FOR ALL TO authenticated` en el SQL Editor de Supabase.

- **Corrección de 6 bugs de coherencia de datos (22/04/2026):**
  - **Sidebar vs Dashboard:** sidebar ahora incluye `en_apareamiento` en el conteo de hembras/machos activos — mismo criterio que el Dashboard.
  - **Sacrificios page:** la tabla "Sacrificios de stock" filtra `categoria = 'reproductor'`, ya no muestra filas en blanco mezcladas con el stock.
  - **stockCamada en bloques virtuales:** ahora descuenta entregas además de sacrificios — antes mostraba animales ya entregados como disponibles.
  - **scoreSupervivencia capeado a 10:** evita scores imposibles si por error de datos `total_destetados > total_crias`.
  - **Tasa de éxito en Estadísticas:** el denominador es ahora `efectivos + fallidos` (solo camadas completadas) en lugar del total que incluye las "en curso".
  - **Dashboard "Preñadas" / "En apareamiento":** ahora excluyen camadas con `failure_flag: true` para no inflar esos contadores.

- **Fix eficiencia de apareamiento — totales no cuadraban (22/04/2026):** el gráfico filtraba solo camadas con `fecha_nacimiento`, dejando afuera las en curso o fallidas sin parto. Ahora itera todas las camadas del período; las sin nacimiento van al segmento "En proceso/Parto fallido", haciendo que la suma coincida con el KPI total de apareamientos.

- **Fix calidad de madres — fallos sin partos exitosos (22/04/2026):** `scorePromedioHembra` devolvía `null` (→ "En proceso") para madres que solo tenían `failure_flag` sin ningún parto exitoso. Ahora devuelve score `0` (→ "Baja") cuando hay fallos registrados pero ninguna camada con `fecha_nacimiento`.

- **Etiquetas de estadísticas renombradas (22/04/2026):**
  - Eficiencia de apareamiento: "Sin dato" → "En proceso/Parto fallido"
  - Supervivencia de camadas: agrega segmento "Parto fallido/En proceso/Lactancia" para camadas sin datos de destete completos
  - Calidad de madres: "Sin datos" → "En proceso"

- **Identidad visual GenERats y reemplazo total de emojis (24/04/2026):**
  - Creado componente `GenERatsBrand.jsx`: logo compuesto (ícono SVG + nombre + slogan + sublinea), configurable con props `iconSize`, `nameSize`, `sloganSize`, `gap`, `align`, `showSlogan`, `showSubline`, `iconPrefix`. Usa Google Fonts Space Grotesk + IBM Plex Sans.
  - Footer del Sidebar reemplazado: de `<img src={logoGenERats} mixBlendMode='screen'>` a `<GenERatsBrand>` — sin fondo oscuro, sin JPEG.
  - Landing completamente renovada: navbar usa `GenERatsBrand` (solo ícono+nombre), hero usa `GenERatsBrand` grande centrado (ícono 182px + nombre 64px + slogan + sublinea), footer usa `GenERatsBrand` mediano.
  - Todos los emojis de Landing reemplazados por Lucide React: features (🧬→`Dna`, 📊→`BarChart2`, 📦→`Archive`, 📅→`Calendar`, 🗡️→`Skull`, 🖨️→`Printer`), para quién (🎓→`GraduationCap`, 🔬→`Microscope`, 💊→`FlaskConical`, 🏥→`Building2`) cada uno con su color distintivo, contacto (🧬→`Dna`).
  - `logoGenERats` JPEG ya no se importa en Landing ni Sidebar.

- **Promover animal de stock a reproductor (24/04/2026):** nueva funcionalidad en `Stock.jsx`:
  - **Desde modal de jaula individual:** tab "↑ Promover" (solo en jaulas reales de stock, no en reproductores ni virtuales). Formulario: sexo selector + código con sugerencia automática (`H-XXXX` / `M-XXXX` donde XXXX son las últimas 4 letras del ID de la camada). Código se actualiza automáticamente al cambiar sexo mientras no haya sido editado manualmente. Validación en tiempo real de código duplicado.
  - **Desde selección múltiple:** botón verde "↑ Promover" en la barra flotante cuando hay jaulas de stock no virtuales seleccionadas. Abre `ModalPromoverReproductor` con una fila por jaula (sexo + código por animal).
  - **Lógica de promoción (`ejecutarPromoverDesdeModal` / `ejecutarPromoverMasivo`):** crea un nuevo animal con `estado: 'activo'`, heredando `fecha_nacimiento`, `id_madre` e `id_padre` de la camada de origen. Nota automática: `Stock → reproductor · camada ...XXXXXX`. Reduce la jaula en 1 (o la elimina si era el último animal). Los machos/hembras de la jaula se decrementan según el sexo elegido.
  - **Datos que hereda el reproductor:** fecha de nacimiento, padre y madre (disponibles para anti-consanguinidad automática en futuros apareamientos).

- **Sistema multi-bioterio — Ratas y Ratones (24/04/2026):** arquitectura completa para gestionar múltiples colonias separadas dentro de la misma app.
  - **SQL ejecutado en Supabase:** columna `bioterio_id text NOT NULL DEFAULT 'ratas'` agregada a las 7 tablas (animales, camadas, jaulas, sacrificios, entregas, temperature_logs, incidentes). Datos existentes quedan como `'ratas'` automáticamente.
  - **`BioterioActivoContext.jsx` (nuevo):** contexto que guarda el bioterio activo en `localStorage`. Expone `bioterioActivo`, `setBioterioActivo`, `limpiarBioterio`, `config` (metadata de la especie) y `bio` (parámetros biológicos). IDs posibles: `ratas`, `ratones_balbc`, `ratones_c57`, `ratones_hibridos`.
  - **`SelectorBioterio.jsx` (nuevo):** pantalla de selección que aparece al entrar si no hay bioterio activo. Card para Ratas (1 grupo) y card para Ratones con 3 botones de subgrupo (Balb/C / C57 / Híbridos). La selección persiste en localStorage.
  - **`constants.js`:** `BIO_RATAS` (gestación 23d, madurez 12 sem) y `BIO_RATONES` (gestación 21d, madurez 8 sem). `BIO` sigue apuntando a `BIO_RATAS` para compatibilidad. Función `getBio(bioterioId)` devuelve el BIO correcto.
  - **`BiotheriumContext.jsx`:** usa `useBioterioActivo()` internamente. Todas las queries de Supabase filtran por `.eq('bioterio_id', bioterioActivo)`. Todos los inserts incluyen `bioterio_id: bioterioActivo`. Recarga datos cuando cambia el bioterio activo.
  - **`calculos.js`:** todas las funciones BIO-dependientes (`calcularFechaSeparacion`, `calcularRangoParto`, `calcularDestete`, `calcularMadurez`, `calcularLatencia`, `generarTareas`, `generarEventosCalendario`) aceptan `bio = BIO` como parámetro con default para compatibilidad.
  - **`Sidebar.jsx`:** muestra el bioterio activo con su ícono y color. Botón `↻` para cambiar de bioterio (llama a `limpiarBioterio()`). Ficha biológica dinámica con los parámetros reales de la especie activa.
  - **Páginas actualizadas:** Dashboard, Calendario, Camadas, CamadaForm, Reportes, Rendimiento, Estadisticas — todas pasan `bio` a las funciones de cálculo.
  - **Flujo:** Login → si no hay bioterio en localStorage → SelectorBioterio → Dashboard. Cambiar bioterio desde sidebar → SelectorBioterio → datos se recargan limpios.

- **Responsive Landing y SelectorBioterio (24/04/2026):**
  - **Landing:** media queries en el CSS string para `<900px` y `<480px`. Nav links se ocultan en mobile (queda logo + botón Ingresar). Hero colapsa a 1 columna, logo flotante oculto. h1 baja de 52px → 38px → 30px. Features, steps, para quién, pricing y formulario de contacto colapsan a 1 columna (para quién a 2 col en tablet). Títulos de sección bajan a 28px.
  - **SelectorBioterio:** badges con `flex-wrap`, nombre científico oculto en xs con `hidden sm:inline`.

- **Fix emojis de categorías en Stock (28/04/2026):** `SexoDisplay` ahora usa `cfg.icono` de la categoría en vez de `🐀` hardcodeado para bloques de stock: crías → 🐣, jóvenes → 🐭, adultos → 🐁. Reproductores siguen con 🐀.

- **Módulo de ciclo estral y seguimiento gestacional (28/04/2026):** sistema completo de predicción estral dentro del perfil de cada hembra.
  - **Nueva tabla Supabase `extendidos`:** un registro por hembra por día con citología, signos externos, datos de servicio y espermatozoides. Constraint `UNIQUE(animal_id, fecha)`.
  - **Nuevo componente `CicloEstral.jsx`:** sección "🔬 Ciclo Estral y Reproducción Predictiva" en el perfil expandible de cada hembra en Animales.
  - **Formulario diario:** registro de citología vaginal (leucocitos/células ovales/células escamosas), claridad, apertura vaginal, lordosis, cópula y espermatozoides. Botones visuales por opción.
  - **Auto-sugerencia de fase:** el sistema sugiere L1/L2/L3/O/E en tiempo real según los datos ingresados y el historial previo. El usuario puede confirmar o sobrescribir manualmente.
  - **Día 0:** cópula confirmada marca automáticamente el registro como Día 0 de gestación con banner verde.
  - **Confirmación por espermatozoides:** registro de espermatozoides "encontrados" al día siguiente confirma la preñez.
  - **Panel de gestación:** cuando hay un Día 0 activo, muestra día actual de gestación, barra de progreso, hitos con cuenta regresiva (día 18 preparar nido / día 20 parto posible / día 21 parto probable / día 23 parto esperado).
  - **Predicción de ciclo individual:** con ≥2 días O registrados calcula longitud promedio del ciclo, mín/máx, patrón (4d/5d) y predice las próximas 3 ventanas fértiles con cuenta de días.
  - **Alertas en Dashboard:** sección morada 🔬 con alertas de receptividad inminente (hoy/mañana) y partos próximos en ≤2 días.
  - **Historial:** tabla compacta con los últimos 8 registros (expandible al historial completo), con colores por fase y marcador "D0" para el día del servicio.
  - **Funciones en `calculos.js`:** `sugerirFase`, `calcularPatronEstral`, `predecirProximoEstro`, `calcularGestacionEstral`, `generarAlertasEstrales`.

- **Validaciones temporales en datos reproductivos (05/05/2026):** seis reglas de coherencia cronológica en los formularios que garantizan la secuencia lógica `Nacimiento → Apareamiento → Gestación → Parto → Destete`:
  - **Regla 1 — Progenitor más joven que la cría (`AnimalForm`):** al asignar madre o padre, si `fecha_nacimiento` del progenitor ≥ `fecha_nacimiento` de la cría → error rojo bajo el selector. Los selects de madre/padre ahora muestran `error` prop y borde rojo.
  - **Regla 2 — Edad reproductiva mínima de la hembra (`CamadaForm`):** si la hembra no alcanzó `bio.MADUREZ_DIAS` al momento de la cópula → error en el campo hembra con días faltantes y semanas mínimas (dinámico según especie).
  - **Regla 3 — Cópula antes del nacimiento de los reproductores (`CamadaForm`):** si `fecha_copula < fecha_nacimiento` de la hembra o el macho → error en el campo fecha con el código del animal y su fecha de nacimiento. Se omite si el animal no tiene `fecha_nacimiento` registrado (no rompe nada).
  - **Regla 4 — Parto antes de la cópula (`CamadaForm`):** si `fecha_nacimiento < fecha_copula` → error rojo en el campo fecha de nacimiento con la fecha de cópula de referencia.
  - **Regla 5 — Destete antes del nacimiento (`CamadaForm`):** si `fecha_destete < fecha_nacimiento` → error rojo en el campo fecha destete real con la fecha de nacimiento de referencia.
  - **Regla 6 — Destete antes de la cópula (`CamadaForm`):** si `fecha_destete < fecha_copula` (y no hay nacimiento registrado) → error rojo en el campo fecha destete con la fecha de cópula de referencia.
  - Todas las reglas bloquean el guardado, muestran mensaje claro con la fecha de referencia en formato legible, y resaltan el campo con borde rojo. Las validaciones respetan el orden: si ya hay un error en el campo, no lo pisan.

- **Sistema de control de machos reproductores (05/05/2026):** gestión completa del ciclo de vida de los machos.
  - **Constantes nuevas en `constants.js`:** `MACHO_EDAD_OPTIMA_MIN_DIAS=90`, `MACHO_EDAD_LIMITE_DIAS=270`, `MACHO_EDAD_ALERTA_DIAS=240`, `INTERVALO_RENOVACION_DIAS=150`. Nuevos tipos en `TIPO_TAREA`: `EVALUAR_MACHO`, `RENOVAR_MACHOS`.
  - **`detectarBajaPerformanceMacho(machoId, camadas, n=3)` en `calculos.js`:** compara latencia promedio y tamaño de camada de las últimas N camadas vs. el historial previo. Alerta si latencia aumentó >2d o tamaño cayó >1.5 crías. Requiere mínimo N+1 camadas. Retorna `{ tipo: 'latencia'|'camada'|'ambos', avgLatUltimas, avgLatPrevias, avgTUltimas, avgTPrevias }` o `null`.
  - **`generarAlertasMachos(animales, camadas, n=3)` en `calculos.js`:** genera alertas para todos los machos activos: `edad_limite` (≥9m), `edad_proxima` (8–9m con días restantes), `baja_performance` (declive detectado con descripción).
  - **`generarTareas` (modificado):** nuevo bloque que genera tareas tipo `evaluar_macho` para machos que alcanzan o se acercan a 9 meses — aparecen como vencida/hoy/próxima en el panel de tareas del Dashboard y son descartables con ✕.
  - **Dashboard — sección "♂ Control de machos":** aparece cuando hay alertas activas. Incluye: banner azul de renovación periódica cada 5 meses (localStorage key `appMosca_machos_reno_ts`, botón ✓ descarta y reinicia el contador), y una fila por macho con alerta (rojo=límite, naranja=próximo, amarillo=rendimiento). Icono `UserMinus` de Lucide React.
  - **Rendimiento — tarjetas de machos:** badge "Edad avanzada · Xm" (rojo) o "Próximo límite · Xm" (naranja) junto al código del macho. Banner amarillo de baja performance con detalle de qué métrica está cayendo y valores concretos (últimas N vs. previas).
  - **Animales — columna Edad:** para machos con ≥8 meses, el valor de edad se reemplaza por un badge con borde rojo/naranja. El perfil expandible del macho muestra el mismo banner de baja performance cuando corresponde.

- **Fix display de hembras en Stock (05/05/2026):** bug de typo en `SexoDisplay` — desestructuraba `hembra` (singular) del bloque pero el campo se llama `hembras` (plural). JavaScript retornaba `undefined`, que en comparación loose `!= null` da `false`, haciendo que todas las jaulas con hembras cayeran al caso "sexo sin registrar". Fix: renombrar a `hembras` en la desestructuración y todas las referencias internas. También corregido el plural del label ("Hembra" → "Hembras" cuando hay más de una).

- **Sistema de planificación de apareamientos desde Stock (08/05/2026):** permite reservar cruces futuros directamente desde la vista de jaulas, sin crear el emparejamiento real todavía.
  - **Detección automática de sexo:** función `sexoBloque(b)` determina si un bloque es fuente de machos o hembras (por categoría para reproductores, por campos `machos`/`hembras` para stock).
  - **Activación:** en modo selección, al elegir exactamente 2 bloques — uno de machos y uno de hembras — aparece el botón azul "🔗 Planificar apareamiento" en la barra flotante.
  - **Modal `ModalPlanificarApareamiento`:** muestra fuente de machos (azul) y fuente de hembras (violeta) con total y edad, campo de fecha requerida y observaciones opcionales.
  - **Storage en localStorage:** key `appMosca_apareamientos_{bioterioActivo}`. Cada plan guarda `{ id, bioterioActivo, fecha_planificada, observaciones, macho: { bloqueId, tipo, codigo, total, edad }, hembra: { ... }, completado, created_at }`.
  - **Alertas en Dashboard:** sección "🔗 Apareamientos planificados" con dos niveles: hoy/vencidos (amarillo/rojo) con botones "✓ Hecho" y "✕ Descartar"; próximos 7 días (azul) con botón ✕. La sección solo aparece cuando hay planes activos. Se carga con `useEffect` al montar el Dashboard y al cambiar de bioterio.

- **Visualización de jaulas vacías durante apareamientos (08/05/2026):** refleja correctamente la ocupación real de jaulas cuando una hembra reproductora está en período de apareamiento.
  - **Función `esFemEnApareamiento(b)`:** retorna `true` si el bloque es un reproductor hembra con `estado === 'en_apareamiento'`.
  - **BloqueJaula:** hembras en apareamiento se renderizan con colores grises apagados (`cfgEfectivo`), badge "En apareamiento" en el header, badge "Jaula temporalmente vacía" en el cuerpo y opacidad 60%. No son seleccionables en modo selección múltiple.
  - **Conteo de jaulas:** `resumen.totalJaulas` excluye las jaulas de hembras en apareamiento. El resumen superior muestra "X jaulas ocupadas · Y jaulas temporalmente vacías (hembras en apareamiento)" cuando hay hembras en ese estado. Los animales siguen contándose igual en `totalAnimales`.
  - **Reactivación automática:** cuando se confirma la separación de la pareja, la hembra pasa a `en_cria` → el bloque vuelve a verse normal sin ninguna acción adicional.

- **Sistema adaptativo de predicción de consumo de viruta (10/05/2026):** nueva página `ConsumoViruta.jsx`, accesible desde SelectorBioterio → "🪵 Consumo de viruta / camas" (botón violeta, `bioterioActivo = 'viruta_global'`).
  - **Tipos de jaula con peso de viruta por cambio:** macho reproductor (1.2 kg), hembra repro / adultos stock (1.0 kg), jóvenes stock (0.7 kg), crías stock / ratón estándar (0.5 kg). Cambios: 2 por semana.
  - **Modal de censo:** entrada en bolsas con `step="0.25"`. Botones de fracción rápida: Entera / ¼ / ½ / ¾. Preview de kg antes de guardar. Historial de censos en localStorage.
  - **Panel predictivo (3 métricas):** viruta disponible (bolsas + kg) / consumo estimado por semana (bolsas) / duración estimada (semanas). Alertas de color: crítico <2 sem (rojo), bajo <4 sem (naranja), ok/bien (verde).
  - **Tarjetas por tipo de jaula:** fórmula visible `n × peso × 2 cambios/sem = result`. Jaulas de ratas: grande/mediana/chica/macho; ratones: estándar.
  - **Calibración adaptativa:** aprende la tasa real de consumo comparando pares de censos. Tasa = `(bolsas_consumidas / semanas) / uAvg`. Persiste en localStorage. Fallback a `TASA_DEFAULT = 0.08` si no hay historial.

- **Temperatura centralizada por bioterio físico (10/05/2026):** `Temperatura.jsx` rediseñada para gestionar temperatura por espacio físico real, no por subcolonia.
  - **2 tabs fijos:** "🐀 Bioterio de Ratas" y "🐭 Bioterio de Ratones" — independientes del bioterio activo actual.
  - **Queries directas a Supabase:** ratas = `eq('bioterio_id', 'ratas')`; ratones = `in('bioterio_id', ['ratones', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos'])` (incluye registros legacy de subgrupos).
  - **Inserción:** nuevos registros usan `bioterio_id = 'ratas'` o `bioterio_id = 'ratones'` fijos.
  - **Cambio de tab** resetea formulario + estado de confirmación de eliminación.
  - **Impresión:** aplica al tab activo + mes seleccionado.

- **Exportación de reproductores hacia sección de Híbridos (10/05/2026):** permite usar reproductores de BAL/C y C57 en cruzas F1 sin duplicar el animal en la base de datos.
  - **Columna `exportado_hibridos boolean`** en tabla `animales` (Supabase). Animal queda en su bioterio original, marcado como compartido.
  - **`animalesExportados` en contexto:** array separado cargado solo cuando `bioterioActivo === 'ratones_hibridos'`. Queries de BAL/C y C57 filtradas por `exportado_hibridos: true`.
  - **Reducción en reducer:** `SET_ANIMALES_EXPORTADOS`, `AGREGAR_ANIMAL_EXPORTADO`, `REMOVER_ANIMAL_EXPORTADO`, `EDITAR_ANIMAL_EXPORTADO`.
  - **`agregarCamada` y `confirmarSeparacion`:** buscan la madre en `animales` Y `animalesExportados`. Dispatch correcto según array de origen.
  - **`exportarAHibridos(animal)` y `devolverDeHibridos(animalId)`:** funciones con update optimista + rollback en el contexto.
  - **Animales.jsx en Híbridos:** sección "Reproductores compartidos" con reproductores exportados (badge de colonia, score, botón ↩ Devolver). Badge 🧬 en la tabla de animales propios de BAL/C y C57. `ModalExportarReproductor` para elegir animal de una colonia y exportarlo.
  - **CamadaForm en Híbridos:** `todosAnimales = [...animales, ...animalesExportados]`. Etiqueta de colonia (BAL/C / C57) junto al código del reproductor en los selects.
  - **Stock en Híbridos:** tab "↑ Promover" oculto. Banner "🧬 Crías F1 — No pueden ser promovidas". Botón Promover oculto en selección múltiple.

- **ResumenRatones — vista unificada de stock (10/05/2026):** nueva página accesible desde SelectorBioterio → "📊 Resumen global de ratones" (`bioterioActivo = 'resumen_ratones'`).
  - **Fetch paralelo** de las 3 colonias (jaulas + camadas + sacrificios + entregas por `bioterio_id`).
  - **`calcularStockGrupo`:** clasifica stock por edad (crías <6 sem, jóvenes 6–10 sem, adultos >10 sem) usando `BIO_RATONES.STOCK_ADULTOS_DIAS`. Incluye bloques virtuales (camadas con destete sin jaula en DB).
  - **Tarjeta total global:** KPI grande + desglose por categoría con `TarjetaEdad`.
  - **Distribución por colonia:** `FilaColonia` por BAL/C / C57 / Híbridos con barra de porcentaje y botón "Entrar ›".
  - **Desglose de jaulas por categoría (10/05/2026):** `calcularStockGrupo` retorna `jaulasCrias`, `jaulasJovenes`, `jaulasAdultos`. `TarjetaEdad` muestra "N jaulas" bajo el número grande. `MiniCat` muestra "cantidad (jaulas)" inline en las filas de colonia.

- **Fix: reactivación automática de jaula de hembra después de separación (10/05/2026):** `editarCamada` ahora actualiza el estado de la madre en tres momentos del ciclo reproductivo.
  - **Raíz del bug:** si el usuario no usaba el botón inline "Confirmar separación" de Camadas (usaba el form o dejaba que el sistema auto-detectara por días), `confirmarSeparacion` nunca se llamaba y la madre quedaba atrapada en `en_apareamiento` indefinidamente → bloque gris en Stock para siempre.
  - **Fix 1 — Separación (`fecha_separacion` nueva):** madre `en_apareamiento` → `en_cria`. Jaula deja de ser gris inmediatamente.
  - **Fix 2 — Parto (`fecha_nacimiento` nueva, safety net):** si la madre sigue `en_apareamiento` al registrar el parto → `en_cria`. Cubre el caso donde el usuario saltea el paso de separación.
  - **Fix 3 — Destete (`fecha_destete` nueva):** madre `en_cria` → `activo`. Completa el ciclo: la hembra queda disponible para un nuevo apareamiento sin intervención manual.
  - Los tres triggers aplican tanto a animales propios como a exportados (`EDITAR_ANIMAL` vs `EDITAR_ANIMAL_EXPORTADO`). No hay acción si no hay `id_madre` o si el estado ya es el correcto.

- **Fix: dispatch correcto en operaciones sobre reproductores exportados (10/05/2026):** `sacrificarReproductor`, `entregarReproductor`, `eliminarSacrificioReproductor` y `devolverEntrega` ahora detectan si el animal pertenece a `animalesExportados` y despachan `EDITAR_ANIMAL_EXPORTADO` en lugar de `EDITAR_ANIMAL`. Antes, operar sobre un exportado desde Híbridos dejaba el estado local desincronizado.
  - **SQL ejecutado:** `ALTER TABLE animales ADD COLUMN IF NOT EXISTS exportado_hibridos boolean DEFAULT false;` ✅

- **Fix: reconciliación de estado de hembra al editar/crear camada (10/05/2026):** reemplaza la lógica de "campo nuevo" por reconciliación declarativa en `editarCamada` y `agregarCamada`. Cada vez que se guarda una camada, el sistema calcula el estado que DEBERÍA tener la madre según el progreso real y lo corrige si no coincide. Elimina hembras atascadas en `en_apareamiento` aunque la separación/parto ya estuviera guardada de antes.
  - Regla: `fecha_destete` → `activo` | `fecha_separacion` o `fecha_nacimiento` → `en_cria` | solo `fecha_copula` → `en_apareamiento`
  - **SQL ejecutado para arreglar registros viejos:** UPDATE animales SET estado según camada más reciente donde estado = 'en_apareamiento' y camada ya tiene separación/parto/destete. ✅

- **ResumenRatones: reproductores incluidos en conteo de adultos (10/05/2026):** `calcularStockGrupo` ahora recibe y suma los reproductores activos de cada colonia dentro de la categoría Adultos. Cada reproductor = 1 animal + 1 jaula, excepto hembras en `en_apareamiento` (su jaula está vacía → suman animal pero no jaula). Fetch de `animales` agregado en paralelo en `cargarDatos`.
  - **SQL necesario:** ninguno — solo cambia el fetch y el cálculo en el frontend.

- **Calendario: planificación de apareamientos (10/05/2026):** permite planificar cruces futuros directamente desde el calendario sin crear el apareamiento real.
  - Seleccionando un día → aparece botón violeta "🔗 Planificar apareamiento"
  - Modal con dos columnas: machos activos (celeste) y hembras activas (violeta), selección con checkmark, campo de observaciones
  - Solo muestra animales con `estado === 'activo'` — excluye `en_apareamiento` y `en_cria`
  - Guarda en localStorage con el mismo formato que Stock → planes visibles en Dashboard como recordatorio
  - Días con planes muestran borde violeta + punto violeta en la grilla del mes
  - Panel lateral muestra el plan con botón "✕ Descartar"
  - Nueva entrada en leyenda: "Apareamiento planif." (violeta `#a78bfa`)
  - **SQL necesario:** ninguno — usa localStorage igual que Stock.

- **Sistema de notas y recordatorios en el calendario (10/05/2026):** permite agregar notas y recordatorios personalizados a cualquier día del calendario.
  - Nueva entrada `nota` en `TIPOS` con color ámbar (`#fbbf24`)
  - Storage en localStorage: key `appMosca_notas_{bioterioActivo}`, separado por colonia
  - Botón amarillo "📝 Agregar nota / recordatorio" en el panel lateral al seleccionar cualquier día
  - `ModalNota`: título opcional + descripción requerida. Enter guarda, Esc cierra
  - Acciones por nota en el panel lateral: ✓ Hecho / ↩ Reabrir / ✕ Eliminar
  - Notas completadas se muestran tachadas con opacidad reducida (visibles pero no molestas)
  - Punto ámbar en el grid del calendario para días con notas pendientes
  - Vista de mes (sin día seleccionado): sección "Notas pendientes" al tope con acciones rápidas
  - Dashboard: sección "📝 Recordatorios" con notas del día y notas vencidas. Notas vencidas en rojo, notas de hoy en amarillo
  - **SQL necesario:** ninguno — localStorage igual que planes de apareamiento.
  - **Estructura de una nota:** `{ id, bioterioActivo, fecha, titulo, descripcion, completada, created_at }`

- **Marcado de animales reservados para apareamientos futuros (11/05/2026):** identifica visualmente animales que ya fueron seleccionados para un apareamiento planificado, para evitar sacrificios o movimientos no intencionales.
  - Nueva función `getAnimalesReservados(bioterioActivo)` en `calculos.js` — lee el localStorage y devuelve `Map<animalId, { fecha, planId }>`. Solo incluye planes no completados con `fecha_planificada >= hoy`.
  - La reserva desaparece automáticamente cuando el plan se marca como ✓ Hecho o se descarta.
  - **Animales.jsx:** badge naranja `🗓 Reservado · DD/MM` junto al código del animal en la tabla
  - **Stock.jsx (BloqueJaula):** badge naranja en la tarjeta del reproductor con fecha del apareamiento
  - **Stock.jsx (ModalSacrificio / ModalEntrega):** banner de advertencia naranja si algún reproductor seleccionado está reservado. Muestra código y fecha. Permite continuar (no bloquea).
  - **CamadaForm.jsx:** la opción en el select dice `H12 🗓 Reservada`; aviso naranja bajo el selector cuando el animal seleccionado tiene plan futuro.
  - **SQL necesario:** ninguno — todo derivado del localStorage.

- **Planificación de apareamientos desde jaulas de stock (11/05/2026):** expande el sistema de planificación para incluir jaulas y bloques de stock como fuentes de futuros reproductores, además de los reproductores actuales.
  - **Calendario — `ModalPlanificarApareamiento` expandido:** cada columna (♂ Fuente de machos / ♀ Fuente de hembras) tiene dos tabs: "Reproductor" y "📦 Jaula de stock". Al elegir "Jaula de stock" se muestran todas las jaulas reales y bloques virtuales filtrados por disponibilidad de ese sexo (`machos > 0` o sin sexar para machos; ídem hembras). Cada item muestra categoría (Crías/Jóvenes/Adultos), código de padres, total de animales, distribución de sexo y edad.
  - **Plan mixto:** se puede combinar un reproductor activo con una jaula de stock (p. ej. macho reproductor × jaula de jóvenes hembras). El plan item para stock usa `tipo: 'stock'` y `bloqueId` con prefijo `j-` (real) o `v-` (virtual), igual que los bloques de Stock.
  - **`getJaulasReservadas(bioterioActivo)` en `calculos.js`:** nueva función paralela a `getAnimalesReservados`. Lee los planes del localStorage y devuelve `Map<bloqueId, { fecha, planId }>` para todos los bloques de `tipo: 'stock'` en planes activos. Solo planes `!completado && fecha >= hoy`.
  - **Stock — `BloqueJaula`:** nuevo prop `jaulasReservadas`. Si el bloque de stock está en el mapa, muestra badge naranja `🟡 Destino reproductivo · DD/MM`.
  - **Stock — `ModalSacrificio` / `ModalEntrega`:** nuevo prop `jaulasReservadas`. Detectan jaulas con destino reproductivo (`stockReservados`) y muestran banner de advertencia naranja `🟡 Jaula con destino reproductivo` con la fecha del plan. No bloquean la acción — solo avisan.
  - **Retrocompatibilidad:** planes existentes (creados desde Stock con bloques de stock) ya tenían `tipo: 'stock'`, así que `getJaulasReservadas` los detecta automáticamente. Planes de reproductores existentes siguen funcionando sin cambios.
  - **SQL necesario:** ninguno — todo localStorage y frontend.

---

## Comportamientos de datos importantes

- **scoreSupervivencia** tiene tope en 10 — si `total_destetados > total_crias` por error de carga, no genera scores imposibles.
- **stockCamada (bloques virtuales)** descuenta tanto `sacrificios` como `entregas` de la misma `camada_id`.
- **Tasa de éxito** en Estadísticas se calcula sobre `efectivos / (efectivos + fallidos)`, excluyendo apareamientos en curso del denominador.
- **Madres con solo fallos** (sin ningún parto exitoso) aparecen como calidad "Baja" en el gráfico, no como "En proceso".
- **Conteo de animales activos** en sidebar y Dashboard usa el mismo criterio: `activo | en_apareamiento | en_cria`.
- **bioterio_id** está presente en todas las tablas. Todos los inserts lo incluyen automáticamente desde el contexto. Todas las queries filtran por él. Los datos existentes tienen `bioterio_id = 'ratas'`.
- **getBio(bioterioId)** devuelve `BIO_RATAS` para `'ratas'` y `BIO_RATONES` para cualquier subgrupo de ratones. El `bio` se expone desde `useBioterio()` para que las páginas lo pasen a las funciones de cálculo.
- **detectarBajaPerformanceMacho** requiere mínimo N+1 camadas con `fecha_nacimiento` para poder comparar. Con menos datos retorna `null` sin lanzar error.
- **Validaciones temporales en formularios** se omiten silenciosamente si el animal no tiene `fecha_nacimiento` registrado — no bloquean el guardado en ese caso.
- **Recordatorio de renovación de machos** se maneja en el frontend con localStorage. Se resetea al hacer clic en ✓. Si el key no existe (primera vez), muestra el banner de inmediato.
- **Alertas de machos en Dashboard** son informativas (no descartables individualmente) — las tareas de edad sí son descartables desde el panel de tareas.
- **Planes de apareamiento** se guardan en localStorage por bioterio (`appMosca_apareamientos_{bioterioActivo}`). No usan Supabase. Al marcar "Hecho" se setea `completado: true`; al descartar se elimina del array. El Dashboard los carga con `useEffect` al montar y al cambiar de bioterio.
- **Hembras en apareamiento en Stock:** `esFemEnApareamiento(b)` es el punto único de verdad. Su jaula no cuenta en `totalJaulas` ni en `resumen.hembra_repro.jaulas`, pero sí en `totalAnimales` y `resumen.hembra_repro.animales`. La función `toggleSeleccion` las ignora en modo selección múltiple.
- **Ciclo de estado de la madre (automático desde `editarCamada`):** al guardar `fecha_separacion` nueva → madre pasa de `en_apareamiento` a `en_cria` (jaula se reactiva). Al guardar `fecha_nacimiento` nueva → mismo cambio como safety net. Al guardar `fecha_destete` nueva → madre pasa de `en_cria` a `activo` (disponible para nuevo ciclo). Aplica tanto a animales propios como a exportados (Híbridos).
- **animalesExportados en contexto:** array separado cargado solo cuando `bioterioActivo === 'ratones_hibridos'`. Contiene reproductores de BAL/C y C57 marcados con `exportado_hibridos: true`. `agregarCamada` y `confirmarSeparacion` buscan la madre en ambos arrays.
- **Temperatura sin dependencia de bioterio activo:** `Temperatura.jsx` hace queries directas a Supabase con IDs fijos (`'ratas'` e `IN ['ratones', 'ratones_balbc', 'ratones_c57', 'ratones_hibridos']`). Registros nuevos siempre usan `'ratas'` o `'ratones'`. Datos legacy de subgrupos siguen apareciendo en la tab de Ratones.
- **ConsumoViruta — tasa adaptativa:** aprende del consumo real comparando pares de censos consecutivos. Tasa calibrada = `(consumo_bolsas / semanas) / uAvg`. Se guarda en localStorage. Si no hay historial suficiente, usa `TASA_DEFAULT = 0.08`. Predicción: disponible / consumo_estimado_sem / duración_semanas con alertas de color (crítico <2 sem, bajo <4 sem, ok).
- **ResumenRatones — jaulas por categoría:** `calcularStockGrupo` devuelve `jaulasCrias`, `jaulasJovenes`, `jaulasAdultos` además del total. `TarjetaEdad` muestra "N jaulas" bajo el número. `MiniCat` muestra "cantidad (jaulas)" inline.
- **Notas del calendario** se guardan en localStorage key `appMosca_notas_{bioterioActivo}`. Estructura: `{ id, bioterioActivo, fecha, titulo, descripcion, completada, created_at }`. Las notas completadas no generan punto en el grid pero siguen visibles en el panel lateral del día. El Dashboard solo muestra notas con `fecha <= hoy` y `completada: false`.
- **getAnimalesReservados(bioterioActivo)** lee los planes de apareamiento del localStorage y devuelve un `Map<animalId, {fecha, planId}>` con animales reservados. Solo planes `!completado && fecha_planificada >= hoy`. Extrae el animal ID de `bloqueId.slice(2)` cuando `tipo === 'reproductor'`. Usada en Animales.jsx, Stock.jsx (BloqueJaula + ModalSacrificio + ModalEntrega) y CamadaForm.jsx. No bloquea operaciones — solo avisa.
- **getJaulasReservadas(bioterioActivo)** lee los mismos planes y devuelve `Map<bloqueId, {fecha, planId}>` para bloques de `tipo === 'stock'`. `bloqueId` tiene prefijo `j-` (jaula real) o `v-` (bloque virtual). Usada en Stock.jsx (BloqueJaula + ModalSacrificio + ModalEntrega). Los planes de reproductores no están en este mapa — solo los de stock.

---

## Qué falta / pendiente

- [ ] Notificaciones push o por email cuando hay tareas vencidas
- [ ] Módulo de reportes con exportación real (PDF/Excel)
- [ ] Historial de cambios por animal/camada (auditoría)
- [ ] Modo offline con sincronización posterior
- [x] ~~Multi-colonia o multi-usuario con roles~~ → implementado como multi-bioterio (ratas + ratones con subgrupos)
