# AppMosca — Bioterio 🧬

## Qué es
Sistema web de gestión de una colonia de ratones de laboratorio (*Mus musculus*). Permite registrar animales reproductores, hacer seguimiento de camadas, predecir partos y controlar el stock de crías.

---

## Qué hace

| Módulo | Función |
|---|---|
| **Dashboard** | Alertas del día, tareas vencidas/próximas, tabla de preñeces activas |
| **Animales** | CRUD de reproductores con filtros por sexo y estado |
| **Camadas** | Registro de cópulas, seguimiento de preñez, destete y separación de pareja |
| **Calendario** | Vista mensual con todos los eventos reproductivos coloreados |
| **Stock** | Bloques visuales por jaula, edición/división/movimiento de animales entre jaulas |
| **Sacrificios** | Selección múltiple de jaulas desde stock para registrar sacrificios en masa |
| **Rendimiento** | Ranking de machos por latencia de fertilización (menor = mejor) |
| **Reportes** | Impresión de datos de la colonia |

**Motor predictivo:** calcula automáticamente fechas de parto (gestación 23d), destete (21d), madurez sexual (84d) y genera tareas con prioridad.

**Flujo reproductivo:** Cópula → Estado "en apareamiento" (15d) → Separación → Preñez → Parto → Destete → Stock por jaulas.

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
├── context/BiotheriumContext.jsx    — Estado global (animales, camadas, jaulas, sacrificios)
├── utils/calculos.js                — Motor predictivo y cálculos de fechas
├── utils/constants.js               — Constantes biológicas (BIO, ESTADO_ANIMAL, TIPO_TAREA)
├── components/
│   ├── Sidebar.jsx                  — Navegación (drawer en mobile)
│   ├── Modal.jsx, Badge.jsx
│   ├── AnimalForm.jsx, CamadaForm.jsx
└── pages/
    ├── Dashboard.jsx, Animales.jsx, Camadas.jsx
    ├── Calendario.jsx, Stock.jsx, Sacrificios.jsx
    ├── Rendimiento.jsx, Reportes.jsx
```

---

## Tablas en Supabase

- `animales` — reproductores (id, codigo, sexo, estado, fecha_nacimiento, notas)
- `camadas` — apareamientos (id, id_madre, id_padre, fecha_copula, fecha_separacion, fecha_nacimiento, fecha_destete, total_crias, etc.)
- `jaulas` — distribución de stock (id, camada_id, total, machos, hembras, notas)
- `sacrificios` — historial (id, camada_id, cantidad, fecha, categoria, notas)

Estados posibles de un animal: `activo` → `en_apareamiento` → `en_cria` → `retirado` / `fallecido`

---

## Qué falta / pendiente

- [ ] Notificaciones push o por email cuando hay tareas vencidas
- [ ] Módulo de reportes con exportación real (PDF/Excel)
- [ ] Sacrificio parcial de jaulas (hoy solo se puede sacrificar la jaula entera)
- [ ] Historial de cambios por animal/camada (auditoría)
- [ ] Multi-colonia o multi-usuario con roles
- [ ] Modo offline con sincronización posterior
- [ ] Gráficos de evolución de stock a lo largo del tiempo
