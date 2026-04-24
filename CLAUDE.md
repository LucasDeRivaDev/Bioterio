# AppMosca — Bioterio 🧬

## Qué es
Sistema web de gestión de una colonia de ratones de laboratorio (*Mus musculus*). Permite registrar animales reproductores, hacer seguimiento de camadas, predecir partos, controlar stock de crías, registrar temperatura ambiental y evaluar el desempeño reproductivo de los animales.

---

## Qué hace

| Módulo | Función |
|---|---|
| **Dashboard** | Alertas del día, tareas vencidas/próximas, tabla de preñeces activas |
| **Animales** | CRUD de reproductores con filtros por sexo y estado |
| **Camadas** | Registro de cópulas, seguimiento de preñez, destete, separación de pareja, scores reproductivos, análisis de confiabilidad de hembras y detección de fallos |
| **Calendario** | Vista mensual con todos los eventos reproductivos coloreados |
| **Stock** | Bloques visuales por jaula con display de sexo coloreado (♂ azul / ♀ violeta / mixto bicolor), edición/división/movimiento de animales, entrega y sacrificio en masa. Cada bloque muestra calidad de padres (Alta/Media/Baja) sin necesidad de abrir el modal |
| **Sacrificios** | Selección múltiple de jaulas desde stock para registrar sacrificios en masa |
| **Entregas** | Historial de animales entregados a investigadores, con buscador y resumen numérico |
| **Rendimiento** | Ranking de machos por latencia de fertilización (menor = mejor) con scores |
| **Estadísticas** | Dashboard visual con 4 gráficos: partos vs fallas, calidad de madres, supervivencia de camadas, eficiencia de apareamiento. KPIs resumen + filtros por fecha y reproductor |
| **Temperatura** | Registro diario de temperatura (actual/mín/máx), vista mensual, exportación imprimible y limpieza de datos por mes |
| **Reportes** | Impresión de datos de la colonia |

**Motor predictivo:** calcula automáticamente fechas de parto (gestación 23d), destete (21d), madurez sexual (84d) y genera tareas con prioridad.

**Flujo reproductivo:** Cópula → Estado "en apareamiento" (15d) → Separación → Preñez → Parto → Destete → Stock por jaulas.

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
├── App.jsx                          — Router + layout responsive (drawer mobile)
├── context/BiotheriumContext.jsx    — Estado global (animales, camadas, jaulas, sacrificios, entregas, temperaturas)
├── utils/calculos.js                — Motor predictivo, scores reproductivos, confiabilidad de hembras
├── utils/constants.js               — Constantes biológicas (BIO, ESTADO_ANIMAL, TIPO_TAREA)
├── components/
│   ├── Sidebar.jsx                  — Navegación (drawer en mobile, incluye link Temperatura)
│   ├── Modal.jsx, Badge.jsx
│   ├── AnimalForm.jsx
│   └── CamadaForm.jsx               — Formulario de camada + registro de fallos reproductivos
└── pages/
    ├── Dashboard.jsx
    ├── Animales.jsx
    ├── Camadas.jsx                  — Lista + detalle expandible + AnalisisReproductivo
    ├── Calendario.jsx
    ├── Stock.jsx                    — Jaulas con SexoDisplay coloreado + calidad de padres en cada bloque
    ├── Sacrificios.jsx
    ├── Entregas.jsx                 — Historial de entregas con buscador y tarjetas resumen
    ├── Rendimiento.jsx
    ├── Estadisticas.jsx             — Dashboard visual: 4 gráficos reproductivos + KPIs + filtros
    ├── Temperatura.jsx              — Registro ambiental diario + exportación mensual
    └── Reportes.jsx
```

---

## Tablas en Supabase

```
animales
  id, codigo, sexo, estado, fecha_nacimiento, notas,
  fecha_sacrificio, motivo_sacrificio

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

---

## Comportamientos de datos importantes

- **scoreSupervivencia** tiene tope en 10 — si `total_destetados > total_crias` por error de carga, no genera scores imposibles.
- **stockCamada (bloques virtuales)** descuenta tanto `sacrificios` como `entregas` de la misma `camada_id`.
- **Tasa de éxito** en Estadísticas se calcula sobre `efectivos / (efectivos + fallidos)`, excluyendo apareamientos en curso del denominador.
- **Madres con solo fallos** (sin ningún parto exitoso) aparecen como calidad "Baja" en el gráfico, no como "En proceso".
- **Conteo de animales activos** en sidebar y Dashboard usa el mismo criterio: `activo | en_apareamiento | en_cria`.

---

## Qué falta / pendiente

- [ ] Notificaciones push o por email cuando hay tareas vencidas
- [ ] Módulo de reportes con exportación real (PDF/Excel)
- [ ] Historial de cambios por animal/camada (auditoría)
- [ ] Multi-colonia o multi-usuario con roles
- [ ] Modo offline con sincronización posterior
