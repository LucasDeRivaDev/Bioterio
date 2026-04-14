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
| **Stock** | Bloques visuales por jaula con display de sexo coloreado (♂ azul / ♀ violeta / mixto bicolor), edición/división/movimiento de animales |
| **Sacrificios** | Selección múltiple de jaulas desde stock para registrar sacrificios en masa |
| **Rendimiento** | Ranking de machos por latencia de fertilización (menor = mejor) con scores |
| **Temperatura** | Registro diario de temperatura (actual/mín/máx), vista mensual, exportación imprimible y limpieza de datos por mes |
| **Reportes** | Impresión de datos de la colonia |

**Motor predictivo:** calcula automáticamente fechas de parto (gestación 23d), destete (21d), madurez sexual (84d) y genera tareas con prioridad.

**Flujo reproductivo:** Cópula → Estado "en apareamiento" (15d) → Separación → Preñez → Parto → Destete → Stock por jaulas.

**Sistema de scores reproductivos (calculados en tiempo real, sin DB):**
- Velocidad de reproducción: latencia 1–5d → 10pts / 6–10d → 7pts / 11–15d → 5pts
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
├── context/BiotheriumContext.jsx    — Estado global (animales, camadas, jaulas, sacrificios, temperaturas)
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
    ├── Stock.jsx                    — Jaulas con SexoDisplay coloreado
    ├── Sacrificios.jsx
    ├── Rendimiento.jsx
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
  failure_flag (bool), failure_type (text), notas

jaulas
  id, camada_id, total, machos, hembras, notas

sacrificios
  id, camada_id, cantidad, fecha, categoria, notas

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
- **failure_flag en camada:** se muestra como badge rojo en el detalle expandido y alimenta el cálculo de confiabilidad de la hembra
- **AnalisisReproductivo en Camadas:** siempre visible al expandir una camada si hay padres identificados. Si no hay historial previo muestra "Sin camadas previas con parto registrado". No depende de datos históricos para renderizar.
- **temperature_logs en Supabase:** usa `id uuid` (auto-generado por Supabase). Al insertar, NO se manda el `id` — se deja que Supabase lo genere y luego se reemplaza el registro temporal en el estado local. Las otras tablas usan `id text` generado por `generarId()`.

---

## Implementado recientemente

- **Perfil reproductivo en Animales (14/04/2026):** fila expandible por animal con botón "▼ Perfil". Hembras: 4 scores promedio (velocidad fertiliz., tamaño camada, proporción sexual, supervivencia) + badge de confiabilidad. Machos: score de fertilización + latencia promedio. Calculado en tiempo real con `calcularPerfilHembra`, `calcularConfiabilidadHembra`, `calcularRendimientoMacho`.
- **Gráficos de evolución de stock (14/04/2026):** nueva tab "📈 Evolución" en Stock. Usa recharts (instalado). Muestra: área de stock total acumulado en el tiempo + barras de nacimientos vs. sacrificios por mes + resumen numérico (stock actual / total nacidos / total sacrificados). Filtros de rango: 6 meses, 12 meses, todo el historial. Construido en tiempo real desde `camadas` y `sacrificios` sin datos extra en DB.
- **Sacrificio parcial de jaulas (14/04/2026):** en `ModalSacrificio` cada jaula de stock ahora tiene un input editable de cantidad (1 hasta el total). Si sacrificás menos del total, la jaula queda con el resto (se actualiza con `editarJaula`); si sacrificás todo, se elimina. Los machos/hembras se reducen proporcionalmente. Reproductores siempre sacrifican 1 (sin cambio).

---

## Qué falta / pendiente

- [ ] Notificaciones push o por email cuando hay tareas vencidas
- [ ] Módulo de reportes con exportación real (PDF/Excel)
- [ ] Historial de cambios por animal/camada (auditoría)
- [ ] Multi-colonia o multi-usuario con roles
- [ ] Modo offline con sincronización posterior
