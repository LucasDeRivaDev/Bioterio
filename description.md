# ITeRatE — Documentación completa del proyecto

---

## ÍNDICE

- [PARTE 1 — Documento técnico para programadores / desarrolladores](#parte-1)
- [PARTE 2 — Manual de usuario para el bioteristá](#parte-2)

---

# PARTE 1 — DOCUMENTO TÉCNICO PARA PROGRAMADORES / DESARROLLADORES {#parte-1}

## ITeRatE — Ficha técnica del proyecto

---

### ¿Qué es este proyecto?

ITeRatE es una **Single Page Application (SPA)** web para gestión de bioterios (instalaciones de cría de animales de laboratorio). Fue construida desde cero con IA como copiloto principal de desarrollo (Claude Code / Anthropic).

El sistema está en producción, es usado por bioteristás reales y evoluciona continuamente con nuevas funcionalidades.

---

### Stack tecnológico

#### Frontend

**React 19 + Vite 8 (Rolldown bundler)**

- React 19 es la versión más reciente. Usa Concurrent Mode por defecto.
- Vite 8 con el nuevo bundler Rolldown (reescritura en Rust del bundler anterior). Tiempos de build drásticamente menores que webpack.
- No hay Create React App. El proyecto arrancó con `npm create vite@latest`.
- Los componentes son todos funcionales con hooks. No hay clases.

**Estado global: `useReducer` + `Context API`**

Decisión deliberada de no usar Redux, Zustand ni Jotai. La razón:
- El estado es jerárquico y centralizado (todos los datos de una colonia)
- Se lee mucho más de lo que se escribe
- Elimina dependencias externas y hace el código más predecible
- Cuatro contextos separados por responsabilidad: `BiotheriumContext` (datos de negocio), `BioterioActivoContext` (sesión de bioterio), `ThemeContext` (UI), `AuthContext` (sesión de usuario)

**React Router v7**

- Routing declarativo en `App.jsx`
- Sin data loaders (los datos vienen del contexto global, no de rutas)
- `Navigate` para redirects condicionados por auth state

**Tailwind CSS via CDN**

- No está configurado con el CLI de Tailwind. Se carga desde CDN en `index.html`.
- Los estilos custom complejos van inline como objetos de JS (`style={{ ... }}`), no en clases. Esto es intencional porque muchos valores son dinámicos (colores del tema, estados de hover calculados).
- El tema oscuro/claro se maneja inyectando un `<style>` tag dinámicamente con `dangerouslySetInnerHTML` cuando está activo el modo claro.

**Recharts**

- Para los 4 gráficos de Estadísticas
- API basada en composición de componentes React
- SVG-based, no canvas

**Lucide React**

- Íconos SVG tree-shakeable
- Cada ícono se importa individualmente

**date-fns v4**

- Solo se usa para algunas operaciones en módulos específicos
- La mayoría de la lógica de fechas está implementada manualmente en `utils/calculos.js` con getters locales (`getFullYear()`, `getMonth()`, etc.) para evitar el problema de UTC offset después de las 21:00 ART

---

#### Backend / Infraestructura

**Supabase**

No es una API propia. Supabase provee:

1. **PostgreSQL** — Base de datos relacional real con todas las garantías ACID
2. **API REST autogenerada** — Supabase genera endpoints REST automáticamente desde el schema de la BD. El cliente `@supabase/supabase-js` llama a esta API con sintaxis tipo ORM
3. **Auth** — JWT-based, con soporte de invitaciones por email (magic links). Sin contraseñas iniciales: el admin invita, el usuario crea su contraseña al primer ingreso
4. **RLS (Row Level Security)** — Políticas de seguridad definidas en PostgreSQL. Garantizan que cada query solo devuelva filas autorizadas, independientemente del código del frontend
5. **Realtime** — No implementado aún, pero disponible si se necesita

El cliente de Supabase se inicializa una sola vez en `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

Las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) están en `.env` local y configuradas en Vercel para producción.

**Vercel**

- Auto-deploy en push a la rama `main`
- Sin configuración de servidor — es static hosting con SPA fallback (`vercel.json` tiene rewrite de `/*` a `/index.html`)
- HTTPS automático vía Let's Encrypt
- CDN global edge network
- Preview URLs automáticas por branch (útil para mostrar cambios antes de mergear a producción)

**PWA — vite-plugin-pwa**

- Genera Service Worker y Web Manifest automáticamente
- El componente `PWAUpdatePrompt` detecta cuando hay una nueva versión disponible y ofrece actualizar sin recargar manualmente
- Instalable como app nativa en desktop (Chrome/Edge) y móvil (iOS Safari / Android Chrome)

---

### Arquitectura del proyecto

```
src/
├── main.jsx                    — Entry point, monta <App />
├── App.jsx                     — Router root, contextos, layouts, modo claro CSS
├── App.css                     — Estilos base mínimos
├── index.css                   — Tailwind + estilos globales + @media print
│
├── assets/                     — Imágenes del logo ITeRatE (modo oscuro/claro)
│
├── context/
│   ├── AuthContext.jsx          — useAuth: sesion, cargando, necesitaPassword, cerrarSesion
│   ├── BioterioActivoContext.jsx — useBioterioActivo: bioterioActivo, config, bio, setBio, limpiar
│   ├── BiotheriumContext.jsx    — useBioterio: todos los datos + dispatchers + CRUD
│   ├── BiotheriumContextDemo.jsx — Versión con datos simulados para demo sin BD
│   └── ThemeContext.jsx         — useTheme: tema, modoBrillo, toggleBrillo
│
├── components/
│   ├── Sidebar.jsx              — Nav principal + stats + ficha bio + reporte errores
│   ├── Modal.jsx                — Modal genérico reusable
│   ├── Badge.jsx                — Badges de prioridad/estado (colores semánticos)
│   ├── AnimalForm.jsx           — Formulario crear/editar reproductor
│   ├── CamadaForm.jsx           — Formulario camada + validaciones temporales + reducción
│   ├── CicloEstral.jsx          — Sección extendidos vaginales en perfil de hembra
│   ├── ITeRatELogo.jsx          — Logo SVG animado para landing
│   └── PWAUpdatePrompt.jsx      — Toast de actualización disponible
│
├── pages/                      — Una página = una ruta (ver tabla de rutas abajo)
│
├── utils/
│   ├── calculos.js              — Motor predictivo + scoring + alertas + calendario + estral
│   ├── constants.js             — BIO_RATAS, BIO_RATONES, estados, tipos de tarea
│   ├── db.js                    — Acceso a Supabase para notas, planes, reservas + migraciones LS
│   ├── genealogia.js            — Coeficiente de Wright, buildPedigree, consanguinidad de línea
│   ├── motorDecisiones.js       — Mínimos, proyecciones, candidatos, sostenibilidad, estrategia
│   ├── motorPedidos.js          — Pedidos biológicos, escalonado, viabilidad, riesgo
│   ├── sanitario.js             — Índice sanitario, motor causal, decisiones del día
│   ├── auditoria.js             — Registro de operaciones históricas
│   └── storage.js               — Helpers localStorage
│
├── data/
│   └── seedDemo.js              — Datos de ejemplo para modo demo
│
└── lib/
    └── supabase.js              — Cliente Supabase singleton
```

**Tabla de rutas:**

| Ruta | Página | Label en sidebar |
|------|--------|-----------------|
| `/` | Dashboard.jsx | Panel de hoy |
| `/animales` | Animales.jsx | Reproductores |
| `/camadas` | Camadas.jsx | Emparejamientos |
| `/stock` | Stock.jsx | Stock |
| `/entregas` | Entregas.jsx | Entregas |
| `/sacrificios` | Sacrificios.jsx | Sacrificios |
| `/rendimiento` | Rendimiento.jsx | Rendimiento |
| `/estadisticas` | Estadisticas.jsx | Estadísticas |
| `/calendario` | Calendario.jsx | Calendario |
| `/temperatura` | Temperatura.jsx | Temperatura |
| `/incidentes` | Incidentes.jsx | Incidentes |
| `/planificacion` | PlanificacionColonia.jsx | Planificación |
| `/pedidos` | Pedidos.jsx | Pedidos |
| `/auditoria` | Auditoria.jsx | Auditoría |
| `/reportes` | Reportes.jsx | Reportes e impresión |
| `/inicio` | Landing.jsx | Inicio (pública) |
| `/login` | Login.jsx | — |

**Rutas especiales (sin sidebar, activadas por bioterioActivo):**

| bioterioActivo | Componente |
|---------------|------------|
| `resumen_ratones` | ResumenRatones.jsx |
| `alimento_global` | ConsumoAlimento.jsx |
| `viruta_global` | ConsumoViruta.jsx |
| `capacidad_global` | CapacidadGlobal.jsx |
| `genealogia_global` | GenealogiaGlobal.jsx |

---

### Esquema de base de datos

Todas las tablas tienen `bioterio_id text NOT NULL DEFAULT 'ratas'`. Todos los queries filtran por él. Todos los inserts lo incluyen.

IDs posibles de `bioterio_id`: `'ratas'` | `'ratones_balbc'` | `'ratones_c57'` | `'ratones_hibridos'`

```sql
animales (
  id uuid PK DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  sexo text NOT NULL,              -- 'macho' | 'hembra'
  estado text NOT NULL,            -- 'activo' | 'en_apareamiento' | 'en_cria' | 'retirado' | 'fallecido'
  fecha_nacimiento date,
  notas text,
  nota_tipo text,
  fecha_sacrificio date,
  motivo_sacrificio text,
  exportado_hibridos boolean DEFAULT false,
  bioterio_id text NOT NULL DEFAULT 'ratas'
)

camadas (
  id uuid PK,
  id_madre uuid REFERENCES animales(id),
  id_padre uuid REFERENCES animales(id),
  fecha_copula date,
  fecha_separacion date,
  fecha_nacimiento date,
  fecha_destete date,
  gestacion_real integer,
  total_crias integer,
  crias_machos integer,
  crias_hembras integer,
  total_destetados integer,
  failure_flag boolean,
  failure_type text,   -- 'no_birth' | 'failed_pregnancy' | 'reabsorption' | 'unknown'
  notas text,
  incluir_en_stock boolean DEFAULT true,
  crias_reducidas integer,         -- ⚠ PENDING SQL
  reduccion_fecha date,            -- ⚠ PENDING SQL
  reduccion_motivo text,           -- ⚠ PENDING SQL
  reduccion_notas text,            -- ⚠ PENDING SQL
  bioterio_id text NOT NULL DEFAULT 'ratas'
)

jaulas (
  id uuid PK,
  camada_id uuid REFERENCES camadas(id),
  total integer,
  machos integer,
  hembras integer,
  notas text,
  bioterio_id text NOT NULL DEFAULT 'ratas'
)

sacrificios (
  id uuid PK,
  camada_id uuid REFERENCES camadas(id),
  cantidad integer,
  fecha date,
  categoria text,
  notas text,
  bioterio_id text NOT NULL DEFAULT 'ratas'
)

entregas (
  id uuid PK,
  camada_id uuid REFERENCES camadas(id),   -- null si es reproductor
  animal_id uuid REFERENCES animales(id),  -- null si es cría
  cantidad integer,
  machos integer,
  hembras integer,
  fecha date,
  observaciones text,
  devuelta boolean DEFAULT false,          -- ⚠ PENDING SQL
  created_at timestamptz DEFAULT now(),
  bioterio_id text NOT NULL DEFAULT 'ratas'
)

temperature_logs (
  id uuid DEFAULT gen_random_uuid(),  -- NO enviar id al insertar
  date date,
  time time,
  current_temp numeric,
  min_temp numeric,
  max_temp numeric,
  created_at timestamptz DEFAULT now(),
  bioterio_id text NOT NULL DEFAULT 'ratas'
)

incidentes (
  id uuid PK,
  bioterio_id text,
  fecha date,
  tipo_categoria text DEFAULT 'otro',
  tipo_incidente text DEFAULT 'otro',
  severidad text DEFAULT 'leve',      -- 'leve' | 'moderado' | 'grave'
  animal_id uuid REFERENCES animales(id) ON DELETE SET NULL,
  camada_id uuid REFERENCES camadas(id) ON DELETE SET NULL,
  animal_ids text[],                  -- ⚠ PENDING: debe ser text[], no uuid[]
  resuelto boolean DEFAULT false,
  descripcion text,
  acciones text
)

configuracion (
  clave text,      -- PK lógica vía upsert
  valor text,
  bioterio_id text
)

notas (
  id uuid PK,
  bioterio_activo text,
  fecha date,
  titulo text,
  descripcion text,
  completada boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

pedidos (
  id uuid PK,
  bioterio_id text,
  -- ...campos del pedido...
  meta jsonb DEFAULT '{}'  -- ⚠ PENDING SQL: campos extendidos (modalidad, escalonado, etc.)
)

-- Otras tablas:
planes_apareamiento · reservas
viruta_censos · viruta_compras
alimento_censos · alimento_ingresos · alimento_reposiciones · alimento_estimaciones
extendidos  -- citología vaginal
contactos   -- formulario de demo de la landing
```

---

### Migraciones SQL pendientes críticas

Aplicar antes de cualquier demo o presentación a cliente:

```sql
-- 1. Pedidos escalonados (campos extendidos)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}';

-- 2. Devolución de entregas
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS devuelta boolean DEFAULT false;

-- 3. RLS de incidentes (sin esto los incidentes no se pueden crear)
ALTER TABLE incidentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Solo usuarios autenticados" ON incidentes;
CREATE POLICY "Solo usuarios autenticados"
  ON incidentes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Tipo de animal_ids en incidentes (falla con crías en stock)
ALTER TABLE incidentes
  ALTER COLUMN animal_ids TYPE text[] USING animal_ids::text[];

-- 5. Reducción de camada
ALTER TABLE camadas
  ADD COLUMN IF NOT EXISTS crias_reducidas integer,
  ADD COLUMN IF NOT EXISTS reduccion_fecha date,
  ADD COLUMN IF NOT EXISTS reduccion_motivo text,
  ADD COLUMN IF NOT EXISTS reduccion_notas text;
```

---

### Flujo de trabajo de desarrollo

**Ramas:**
- `main` → producción (Vercel auto-deploy)
- `develop` → rama de trabajo activa
- Feature branches opcionales para cambios grandes

**Workflow:**
```
develop → trabajar → commit → develop → merge a main → Vercel despliega
```

**Convención de commits:**
```
tipo(scope): descripción en español

tipos: feat | fix | refactor | style | docs | chore

ejemplos:
  feat(stock): agregar badge "no promover hijas" en bloques de jaula
  fix(calculos): corregir offset UTC en hoy() para ART después de 21:00
  refactor(camadas): extraer AnalisisReproductivo a componente separado
```

Sin tests automatizados actualmente. La verificación es manual + ESLint. El roadmap incluye Vitest para `calculos.js` y `motorDecisiones.js`.

---

### Desarrollo con IA (Claude Code)

Este proyecto se desarrolla con **Claude Code** como copiloto. Prácticas establecidas:

- **CLAUDE.md** en la raíz: documento vivo que Claude lee al inicio de cada sesión. Contiene arquitectura, comportamientos clave y reglas de negocio. Es el equivalente a un README para la IA.
- Las reglas de negocio complejas (scoring, clasificación materna, coeficiente de Wright) están documentadas en CLAUDE.md con suficiente precisión para que la IA no las reinterprete al hacer cambios.
- Después de cada feature nueva se actualiza CLAUDE.md para que la documentación esté siempre sincronizada con el código.
- La IA genera código, el desarrollador revisa y aprueba antes de commitear. Nunca se commitea sin revisión humana.

**Por qué esta combinación funciona:**

La lógica de negocio (biología reproductiva, algoritmos genéticos) es compleja y muy específica del dominio. Claude puede implementarla fielmente cuando tiene contexto suficiente en CLAUDE.md. El desarrollador humano aporta el conocimiento del dominio y la revisión de correctitud. La IA aporta velocidad de implementación y memoria de contexto entre sesiones.

---

### Patrones de código relevantes

**Lectura de Supabase con filtro por bioterio:**
```js
const { data } = await supabase
  .from('camadas')
  .select('*')
  .eq('bioterio_id', bioterioActivo)
  .order('fecha_copula', { ascending: false })
```

**Dispatch de estado global:**
```js
dispatch({ type: 'AGREGAR_CAMADA', payload: nuevaCamada })
dispatch({ type: 'EDITAR_ANIMAL', payload: animalActualizado })
dispatch({ type: 'EDITAR_ANIMAL_EXPORTADO', payload: exportadoActualizado }) // solo Híbridos
```

**Score reproductivo — nunca almacenado en BD, siempre calculado en cliente:**
```js
const scores = calcularScoresCamada(camada)
// → { latencia, tamaño, proporcion, supervivencia, compuesto, loss_count, crias_reducidas }
```

**Manejo de fechas en zona horaria local (ART):**
```js
// CORRECTO — usa getters locales
export function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// INCORRECTO después de las 21:00 ART — salta al día siguiente en UTC
// new Date().toISOString().slice(0, 10)  ← NO usar esto para fechas de hoy
```

**Bloques virtuales de stock** (camadas sin jaula física en BD):
```js
const bloquesVirtuales = camadas.filter(c =>
  c.fecha_destete &&
  !c.failure_flag &&
  c.incluir_en_stock &&
  c.bioterio_id === bioterioActivo &&
  !jaulas.some(j => j.camada_id === c.id)
)
```

---

### Variables de entorno

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Solo estas dos. No hay secrets del servidor porque todo corre en el cliente. La anon key de Supabase es pública por diseño — la seguridad real la hace RLS en la BD.

---

### Comandos de desarrollo

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo con HMR en http://localhost:5173
npm run build     # build de producción en /dist
npm run preview   # sirve el build localmente para verificar
npm run lint      # ESLint con reglas de React Hooks
```

---

### Orden de lectura para nuevos desarrolladores

1. `CLAUDE.md` — reglas de negocio y arquitectura general
2. `src/context/BiotheriumContext.jsx` — el state machine central
3. `src/utils/calculos.js` — el motor predictivo (corazón de la lógica de negocio)
4. `src/utils/constants.js` — los parámetros biológicos por especie
5. `src/App.jsx` — el router y la estructura de layout
6. La página que necesitás modificar en `src/pages/`

---

### Módulos de lógica de negocio — resumen técnico

| Archivo | Responsabilidad principal | Funciones clave |
|---------|--------------------------|-----------------|
| `calculos.js` | Motor predictivo, scoring, alertas, calendario, ciclo estral | `calcularRangoParto`, `generarTareas`, `calcularEvaluacionMaterna`, `scoreSupervivencia`, `generarAlertasMachos`, `esCamadaPreniada` |
| `constants.js` | Parámetros biológicos, estados, tipos | `BIO_RATAS`, `BIO_RATONES`, `getBio()`, `ESTADO_ANIMAL`, `TIPO_TAREA` |
| `genealogia.js` | Coeficiente de Wright, árbol genealógico | `buildPedigree`, `calcularFCoeficiente`, `CONSANGUINIDAD_LINEA` |
| `motorDecisiones.js` | Sostenibilidad de colonia, proyecciones, candidatos | `calcularStockReal`, `calcularProyeccionAvanzada`, `calcularIndiceSostenibilidad`, `generarModoEstrategia` |
| `motorPedidos.js` | Planificación de pedidos biológicos | `calcularProduccionEnCurso`, `calcularPedidoEscalonado`, `calcularIndiceViabilidad`, `evaluarRiesgoMultifactorialPedido` |
| `sanitario.js` | Índice sanitario, motor causal, alertas | `calcularIndiceSanitario`, `generarMotorCausalCompleto`, `generarDecisionesHoy`, `detectarDeterioroProgresivo` |
| `db.js` | Acceso a Supabase para notas/planes/reservas | `getNotas`, `getPlanes`, `dbReady`, migraciones automáticas desde localStorage |

---

### Parámetros biológicos configurados por especie

| Parámetro | Ratas (*R. norvegicus*) | Ratones (*M. musculus*) |
|-----------|------------------------|------------------------|
| Gestación | 23 días | 21 días |
| Destete | 21 días post-nacimiento | 21 días post-nacimiento |
| Madurez sexual | 84 días (12 semanas) | 56 días (8 semanas) |
| Ciclo estral | ~5 días | ~5 días |
| Ventana de concepción | 1–5 días post-cópula | 1–5 días post-cópula |
| Duración apareamiento | 15 días | 15 días |
| Límite de edad macho | 270 días (9 meses) | 270 días (9 meses) |
| Alerta de edad macho | 240 días (8 meses) | 240 días (8 meses) |

---

### Sistema de scoring reproductivo — referencia

Calculado en tiempo real en el cliente. Nunca se almacena en BD.

**Score por latencia de fertilización:**
- 0–5 días → 10 puntos
- 6–10 días → 7 puntos
- 11–15 días → 5 puntos

**Score por tamaño de camada:**
- ≥10 crías → 10 puntos
- 8–9 crías → 7 puntos
- <8 crías → 0 puntos (CRÍTICO — descalificación automática)

**Score por proporción sexual:**
- Equilibrado → 10 puntos
- Más hembras → 8 puntos
- Más machos → 5 puntos

**Score por supervivencia** (evaluado por pérdidas reales, no porcentaje):
- 0 pérdidas → 10 puntos
- 1 pérdida → 7 puntos (9 si camada efectiva = 12)
- ≥2 pérdidas → 0 puntos (CRÍTICO — descalificación automática)
- `objetivo = nacidas − crias_reducidas` (la reducción por manejo no cuenta como mortalidad)

**Clasificación materna** (`calcularEvaluacionMaterna`):
- Composite ponderado: tamaño (0.40) + supervivencia (0.30) + velocidad (0.20) + proporción (0.10)
- Descalificación automática no compensable: tamaño=0 → No apta / supervivencia=0 → Mala madre
- Sin descalificación: ≥9 → Excelente / ≥7.5 → Buena / resto → Aceptable

---

---

# PARTE 2 — MANUAL DE USUARIO PARA EL BIOTERISTÁ {#parte-2}

## ITeRatE — Guía completa de uso

**Para quién es esta guía:** para la persona que trabaja a diario en el bioterio y va a usar el sistema. No necesitás saber nada de programación ni de computación avanzada. Si sabés usar WhatsApp y navegar por internet, podés usar ITeRatE.

---

## ¿Qué es ITeRatE y para qué sirve?

ITeRatE es una aplicación web —como Instagram o Gmail, que se abre en el navegador— diseñada exclusivamente para gestionar colonias de roedores de laboratorio.

**Reemplaza:** el cuaderno físico del bioterio, las planillas de Excel y la memoria del bioteristá.

**Qué hace por vos automáticamente:**
- Te avisa qué animales necesitan atención hoy
- Calcula cuándo va a nacer una camada sin que tengas que hacer ninguna cuenta
- Evalúa si una hembra es buena reproductora o no, basándose en sus registros históricos
- Te dice cuántos animales vas a tener disponibles en el futuro
- Guarda toda la información en la nube para que no se pierda nunca

---

## Cómo ingresar al sistema

Abrís el navegador (Chrome, Firefox, Edge — cualquiera funciona) y entrás a la dirección del sistema.

Si es la primera vez, el administrador te mandó un email de invitación. Hacés click en el link del email y el sistema te pide que crees una contraseña. Eso es todo — a partir de ese momento podés entrar directamente con tu email y contraseña.

---

## La pantalla de elección de bioterio

Lo primero que ves al entrar es una pantalla donde elegís **qué colonia** querés gestionar. Por ejemplo:
- 🐀 **Ratas** — la colonia de *Rattus norvegicus*
- 🐭 **Balb/C** — ratones de la cepa BALB/c
- 🐭 **C57** — ratones de la cepa C57BL/6
- 🐭 **Híbridos** — los cruzamientos F1

Cada colonia tiene sus propios datos y sus propios animales. Al elegir una, el sistema carga todo lo que corresponde a esa colonia.

**En cada bioterio hay un semáforo:**
- 🟢 **Estable** — todo bien en los últimos meses
- 🟡 **Atención** — hay algunos incidentes sin resolver
- 🔴 **Riesgo** — hay incidentes graves sin resolver

Si querés cambiar de colonia, hay un botón "Cambiar" en la barra lateral izquierda.

---

## La barra lateral (el menú)

En la parte izquierda de la pantalla está el menú principal. Desde ahí accedés a todas las secciones.

En la parte superior del menú siempre ves tres números:
- **♀** — cuántas hembras reproductoras activas tenés
- **♂** — cuántos machos reproductores activos tenés
- **🫄** — cuántas hembras están preñadas ahora mismo

Debajo de los números hay una "ficha biológica" de la especie. Si la desplegás (tocando en ella), muestra los datos de la especie: cuántos días dura la gestación, cuándo se desteta, cuándo maduran sexualmente, etc. Es una referencia rápida.

---

## Sección 1: Panel de Hoy

**Cómo llegar:** Menú → "Panel de hoy"

**Para qué sirve:** Es lo primero que tenés que mirar cada mañana. El sistema analiza todos los datos de la colonia y te arma una lista de todo lo que hay que hacer ese día.

### Las tareas y sus colores

🚨 **Fondo rojo — VENCIDA:** Algo que ya debería haberse hecho. Necesita atención inmediata.

⚠️ **Fondo amarillo — HOY:** Hay que hacerlo hoy.

📅 **Fondo azul — PRÓXIMA:** Viene en los próximos días, para que lo tengas en mente.

### Tipos de tareas que genera el sistema automáticamente

| Ícono | Tarea | Qué significa |
|-------|-------|---------------|
| ✂️ | Separar pareja | Ya pasaron los 15 días de apareamiento — hay que separar al macho de la hembra |
| 👶 | Control de parto | La hembra entra en la ventana en la que se espera el parto |
| 📦 | Destete | Ya pasaron 21 días desde el nacimiento — hay que destetar las crías |
| 📊 | Madurez sexual | Las crías de una camada ya tienen edad para ser reproductores |
| 🔬 | Revisión | Una hembra debería haber parido y no hay registro — verificar si hubo fallo |
| ⚠️ | Evaluar hembra | Una camada tuvo pocas crías o muchas bajas — la hembra necesita evaluación |
| 🔄 | Fin de ciclo | La hembra completó su tercer apareamiento — evaluar si se la retira |
| 👤 | Evaluar macho | Un macho llegó a su límite de edad reproductiva (9 meses) |
| 🔄 | Renovar machos | Es momento de revisar si el stock de machos necesita renovación |
| 💀 | Sacrificar crías F1 | Crías híbridas llevan más de 40 días sin ser destetadas |

### Registrar una separación desde el Panel

Cuando hay una tarea de "Separar pareja", podés registrar la separación directamente ahí sin ir a otra pantalla. Tocás el botón de la tarea, confirmás la fecha y listo — el sistema actualiza el estado de la hembra automáticamente.

### Descartar tareas

Si una tarea no corresponde en este momento, podés descartarla con la X. Desaparece por 30 días. Si el problema sigue vigente después de esos 30 días, vuelve a aparecer sola.

### Preñeces activas

Más abajo en el Panel hay una tabla con todas las hembras preñadas actualmente. Para cada una ves la hembra, el macho, la fecha de cópula y la fecha estimada de parto (calculada automáticamente).

### Alertas de machos

Si hay machos próximos al límite de edad o con bajo rendimiento reproductivo, aparecen alertas en esta misma pantalla.

---

## Sección 2: Reproductores

**Cómo llegar:** Menú → "Reproductores"

**Para qué sirve:** El registro de todos los animales que usás para la reproducción.

### Agregar un reproductor nuevo

Botón "Nuevo reproductor" → completás:
- **Código:** el nombre o número que usás en el bioterio (ej: "H-001", "M-A23")
- **Sexo:** macho o hembra
- **Fecha de nacimiento:** importante para que el sistema calcule la edad y las alertas
- **Estado:** generalmente "activo" al empezar
- **Notas:** cualquier observación relevante

### Ver el perfil de una hembra

Al tocar en una hembra ves su perfil completo. Lo más importante:

**Clasificación materna:** Calculada automáticamente con todas sus camadas anteriores:
- 🏆 **Excelente** — rendimiento sobresaliente en todas las métricas
- ✅ **Buena** — buen rendimiento general
- 🟡 **Aceptable** — rendimiento regular
- 🔴 **Mala madre** — tuvo 2 o más bajas al destete en alguna camada
- ⛔ **No apta** — tuvo una camada de menos de 8 crías

**Confiabilidad:**
- ✅ Sin alertas
- 🟡 Leve — 1 evento problemático
- 🟠 Moderada — 2 o más fallos
- 🔴 Crítica — 3 o más eventos combinados (con botón directo a sacrificios)

**Ciclo estral:** Si registrás extendidos vaginales, el sistema predice cuándo va a estar receptiva la hembra.

---

## Sección 3: Emparejamientos

**Cómo llegar:** Menú → "Reproductores" → subtab "Emparejamientos"

**Para qué sirve:** Registrar y hacer seguimiento de cada cópula, desde que juntás los animales hasta que destetás las crías.

### Registrar una cópula nueva

Botón "Nuevo emparejamiento" → elegís hembra, macho y fecha de cópula.

Al guardar, el sistema automáticamente:
- Cambia el estado de la hembra a "en apareamiento"
- Calcula cuándo hay que separar la pareja (15 días después)
- Calcula la ventana de parto esperada
- Crea las tareas en el Panel de Hoy

**Aviso de consanguinidad:** Si la hembra es hija del macho o el macho es hijo de la hembra, el sistema te avisa antes de confirmar.

### Registrar el avance de una camada

Expandís la camada en la lista y podés registrar:

- **Separación:** cuándo separaste al macho
- **Fallo reproductivo:** si el apareamiento no resultó en preñez (sin nacimiento / preñez fallida / reabsorción / desconocido)
- **Parto:** fecha, cuántas crías, cuántos machos y cuántas hembras
- **Destete:** cuántas crías llegaron. Si reduciste la camada por manejo, eso se registra por separado para que no cuente como mortalidad

### Los scores de cada camada

Cada vez que registrás un parto y un destete, el sistema calcula 4 puntajes automáticamente:

| Score | Qué mide | Mejor resultado |
|-------|----------|----------------|
| Velocidad | Cuántos días tardó en quedar preñada | Menos días = mejor |
| Tamaño | Cuántas crías nacieron | 10 o más crías = excelente |
| Proporción | Si nacieron más machos, más hembras o equilibrado | Equilibrado = mejor |
| Supervivencia | Cuántas crías llegaron al destete | Sin bajas = perfecto |

Estos puntajes se acumulan y son los que definen la clasificación de la hembra.

**Flujo completo de una camada:**
```
Cópula registrada
    → Hembra: "en apareamiento" — tarea de separación en 15 días
Separación confirmada
    → Hembra: "en cría" — tarea de control de parto calculada
Parto registrado
    → Tarea de destete en 21 días
Destete registrado
    → Hembra vuelve a: "activo" — lista para nueva cópula
    → Las crías aparecen en Stock (si corresponde)
```

---

## Sección 4: Stock

**Cómo llegar:** Menú → "Stock"

**Para qué sirve:** Ver y gestionar todas las crías disponibles en el bioterio, organizadas por jaula.

### Los bloques de jaula

Cada jaula aparece como un bloque visual. De un vistazo ves:
- Cuántos animales hay en total
- Cuántos machos (azul 💙) y cuántas hembras (violeta 💜)
- Si la jaula es solo machos, solo hembras o mixta
- La edad de las crías en semanas y días
- La calidad de los padres (Alta / Media / Baja)

**Badge "no promover hijas":** Si la madre fue clasificada como "Mala madre" o "No apta", el bloque muestra un aviso. Podés hacer lo que necesités con esas crías, pero el sistema te recuerda que no son ideales para ser nuevas reproductoras.

**Hembras en apareamiento:** Aparecen en gris con opacidad reducida. No se pueden seleccionar — sus crías todavía no nacieron.

### Qué podés hacer con una jaula

- **Editar:** corregir la cantidad de animales
- **Dividir:** separar la jaula en dos (útil para separar machos y hembras al crecer)
- **Mover:** trasladar animales a otra jaula
- **Entregar:** registrar entrega a un investigador (cantidad, sexos, fecha, quién recibe)
- **Sacrificar:** registrar el sacrificio de animales
- **Eliminar jaula:** cerrar la jaula con confirmación previa

### Selección múltiple

Podés seleccionar varias jaulas a la vez para hacer entregas o sacrificios en masa.

### Promover crías a reproductoras

Cuando las crías son buenas candidatas, seleccionás las hembras deseadas y usás "Promover a reproductora". El sistema crea automáticamente la entrada en Reproductores. Si las hembras son hijas de una madre con clasificación mala, el sistema te avisa antes de confirmar.

---

## Sección 5: Entregas

**Cómo llegar:** Menú → "Stock" → subtab "Entregas"

**Para qué sirve:** Historial completo de todos los animales entregados a investigadores.

Podés buscar por nombre del investigador o número de camada.

**Devolver animales:** Si un investigador devuelve animales, usás el botón "Devolver". La entrega queda marcada con ✓ Devuelta en el historial y los animales vuelven a contarse en el stock.

---

## Sección 6: Sacrificios

**Cómo llegar:** Menú → "Stock" → subtab "Sacrificios"

**Para qué sirve:** Registrar sacrificios de crías cuando necesitás reducir el stock.

Seleccionás las jaulas (podés seleccionar varias a la vez), indicás la cantidad parcial por jaula si es necesario, completás fecha y observaciones, y confirmás. El stock se actualiza automáticamente.

---

## Sección 7: Rendimiento

**Cómo llegar:** Menú → "Rendimiento"

**Para qué sirve:** Ver qué machos son los mejores reproductores y cuáles están llegando a su límite.

Los machos aparecen ordenados por velocidad de fertilización: el que tarda menos días en preñar a la hembra aparece primero.

**Alertas de edad:**
- 🟡 **Alerta:** el macho tiene entre 8 y 9 meses — está llegando al límite
- 🔴 **Límite:** el macho tiene más de 9 meses — se recomienda retirarlo

---

## Sección 8: Estadísticas

**Cómo llegar:** Menú → "Rendimiento" → subtab "Estadísticas"

**Para qué sirve:** Ver la evolución histórica de la colonia a través de gráficos. Ideal para reuniones, informes y auditorías.

Cuatro gráficos:
- Partos vs Fallos en el tiempo
- Distribución de calidad de madres
- Supervivencia de camadas
- Eficiencia de apareamiento

Podés filtrar por rango de fechas o por un reproductor específico.

---

## Sección 9: Calendario

**Cómo llegar:** Menú → "Calendario"

**Para qué sirve:** Ver todos los eventos reproductivos del mes y planificar apareamientos futuros.

### El calendario mensual

Cada día muestra los eventos que corresponden: partos esperados, destetes programados, separaciones, madureces sexuales. Los colores indican el tipo de evento.

### Planificar un apareamiento

Tocás un día futuro, elegís hembra y macho, y guardás el plan. El sistema te muestra avisos en el Dashboard cuando se acerca la fecha.

### Notas y recordatorios

En cualquier día podés agregar una nota: "visita del veterinario", "feriado", "revisar jaula 15". Las notas vencidas sin completar aparecen en el Panel de Hoy.

---

## Sección 10: Temperatura

**Cómo llegar:** Menú → "Temperatura"

**Para qué sirve:** Registrar la temperatura ambiental del bioterio diariamente.

Siempre hay dos tabs, sin importar qué colonia estés mirando:
- **Ratas** — temperatura del bioterio de ratas
- **Ratones** — temperatura del bioterio de ratones

Registrás tres valores por día: temperatura actual, mínima y máxima. Hay una vista mensual del histórico y un botón de impresión para auditorías.

---

## Sección 11: Incidentes

**Cómo llegar:** Menú → "Incidentes"

**Para qué sirve:** Registrar y analizar cualquier evento fuera de lo normal.

### Qué es un incidente

Cualquier evento que puede afectar a los animales o la producción:
- **Ambientales:** temperatura fuera de rango, problemas de ventilación, corte de energía, falla de equipo
- **Sanitarios:** muertes inesperadas, alopecia, heridas, canibalismo
- **Reproductivos:** abortos, malformaciones, mortalidad neonatal, infertilidad
- **De manejo:** errores de procedimiento

### Registrar un incidente

Completás categoría, tipo, severidad (leve / moderado / grave), fecha, descripción y acciones tomadas. Opcionalmente lo vinculás a un animal o camada específica. Cuando el problema se resuelve, lo marcás como "Resuelto".

### El Índice Sanitario (0 a 100)

Un número que resume la salud general de la colonia:
- **80-100:** Estable
- **60-79:** Atención — algunos factores de riesgo
- **40-59:** Intervención — necesita acciones correctivas
- **0-39:** Crítico — situación de riesgo

### El Motor Causal

El sistema analiza simultáneamente temperatura, incidentes, estado reproductivo y consanguinidad, y detecta posibles conexiones entre estos factores. En la sección "¿Qué hacer hoy?" te da una lista de acciones concretas priorizadas basadas en ese análisis.

---

## Sección 12: Planificación

**Cómo llegar:** Menú → "Planificación"

**Para qué sirve:** Entender el estado estratégico de la colonia: si tenés suficientes reproductores, cuándo van a faltar y qué crías son las mejores para reemplazarlos.

### El Índice de Estabilidad (0 a 100)

Resume la salud estratégica de la colonia:
- **70-100:** Sostenible
- **50-69:** Intervención — hay que tomar decisiones pronto
- **0-49:** Riesgo — la colonia puede comprometerse

### Mínimos críticos

Si estás por debajo del número mínimo de reproductores necesarios, aparece en rojo. Es urgente conseguir o promover nuevos reproductores.

### Proyecciones futuras

Cuántos animales va a tener la colonia en 30, 60, 90 y 180 días, considerando preñeces actuales, nacimientos esperados y estimaciones de sacrificio.

### Candidatos a renovación

Cuáles crías del stock son las mejores para convertirse en los próximos reproductores, evaluando genética, rendimiento de sus padres y edad óptima.

### Modo Estrategia

Indicás cuál es tu objetivo actual: mantener / expandir / reducir / priorizar híbridos / cumplir pedidos / mejorar diversidad genética. El sistema ajusta sus recomendaciones según el modo elegido.

---

## Sección 13: Pedidos

**Cómo llegar:** Menú → "Pedidos"

**Para qué sirve:** Cuando un investigador necesita animales, el sistema planifica cuándo hay que iniciar las cópulas para tener esos animales listos a tiempo.

### Crear un pedido

Completás:
- Cantidad y sexo de los animales
- Edad que deben tener al momento de entrega
- Fecha de entrega deseada
- Si deben ser vírgenes (sin historia reproductiva previa)

El sistema calcula hacia atrás: para tener esos animales en esa fecha, las cópulas tienen que empezar en tal fecha. También te dice si ya tenés camadas en curso que cubren parte del pedido.

### Modalidades de pedido

- **Única:** todos los animales en una sola entrega
- **Escalonada:** entregas periódicas a lo largo del tiempo
- **Flexible:** el sistema sugiere la distribución óptima

### El Índice de Viabilidad (0 a 100)

Qué tan factible es cumplir el pedido en las condiciones actuales. Si hay factores de riesgo (temperatura alta, incidentes recientes, consanguinidad elevada), el número baja y el sistema te explica por qué.

---

## Sección 14: Auditoría

**Cómo llegar:** Menú → "Auditoría"

**Para qué sirve:** Ver el historial de cambios importantes: quién hizo qué y cuándo. Es el módulo para auditorías e inspecciones externas.

---

## Sección 15: Reportes e Impresión

**Cómo llegar:** Menú → "Reportes e impresión"

**Para qué sirve:** Generar versiones imprimibles de los datos más importantes.

Reportes disponibles: consumo de alimento, consumo de viruta, capacidad de la instalación, genealogía, planificación, pedidos activos, auditoría histórica.

Para imprimir: abrís el reporte y usás el botón de impresión (o Ctrl+P). El sistema prepara una versión limpia lista para imprimir en papel o guardar como PDF.

---

## Vistas globales (para ratones)

Desde la pantalla de selección de bioterio hay accesos a vistas que muestran información de todas las colonias de ratones juntas:

- **Resumen Ratones:** stock total de las 3 colonias dividido por edad (crías / jóvenes / adultos)
- **Consumo de Alimento:** seguimiento y predicción del consumo, con aprendizaje automático basado en el historial de censos
- **Consumo de Viruta:** seguimiento del consumo de cama con proyección de próximo cambio
- **Capacidad Global:** capacidad instalada vs utilización actual
- **Genealogía Global:** árbol genealógico de todas las colonias con coeficientes de consanguinidad

---

## Cambiar entre modo oscuro y modo claro

En la esquina inferior derecha hay un botón con ☀️ o 🌙:
- ☀️ → modo claro (mejor para lugares con mucha luz)
- 🌙 → modo oscuro (mejor para pantallas en el bioterio)

El sistema recuerda tu preferencia.

---

## Reportar un error

Al final de la barra lateral izquierda hay una sección roja "Reportar error". La expandís, elegís en qué sección ocurrió el problema, describís qué pasó y hacés click en "Enviar reporte". El sistema abre tu cliente de email con el reporte ya redactado.

---

## Preguntas frecuentes

**¿Puedo usar el sistema desde mi celular?**
Sí. Funciona en el navegador del celular. En algunos teléfonos podés instalarlo como una app tocando "Agregar a pantalla de inicio".

**¿Qué pasa si no tengo internet?**
Necesitás conexión para guardar cambios. Si la perdés momentáneamente, los datos que ya cargaste siguen visibles pero no podés guardar cambios nuevos hasta que vuelva la conexión.

**¿Si borro algo por error se puede recuperar?**
Para la mayoría de las acciones destructivas el sistema pide confirmación antes de ejecutarlas. Una vez confirmadas, algunas no se pueden revertir automáticamente. Si cometiste un error grave, avisá al administrador del sistema.

**¿Mis datos se pierden si cierro el navegador?**
No. Todo se guarda en la nube en tiempo real. Podés cerrar el navegador, apagar la computadora y volver días después — todo va a estar ahí.

**¿Pueden ver mis datos otras instituciones?**
No. Los datos de cada instalación son completamente privados y separados.

**¿Por qué una hembra aparece en gris en el stock y no la puedo seleccionar?**
Porque está en período de apareamiento (conviviendo con el macho). Sus crías todavía no nacieron, por eso no es stock disponible.

**¿Qué es el "Coeficiente de Consanguinidad"?**
Es un número que indica qué tan emparentados están dos animales que van a aparearse. Cuanto más alto, más riesgo de que las crías tengan problemas genéticos. El sistema lo calcula automáticamente y te avisa cuando el riesgo es alto. No tenés que entender la matemática — solo prestar atención a las advertencias que muestra.

**¿Por qué la hembra aparece como "en cría" y no como "activa" después de la separación?**
Porque está preñada o amamantando. El sistema cambia su estado automáticamente a "activo" recién cuando registrás el destete de la camada, indicando que el ciclo reproductivo terminó y está lista para un nuevo apareamiento.
