# 🐀 Bioterio — Sistema de Gestión de Colonia

App web para la gestión de colonias de ratones de laboratorio (*Mus musculus*).
Permite registrar animales, camadas, seguimiento de preñeces y análisis de rendimiento reproductivo.

---

## Stack tecnológico

- **React 19 + Vite** — framework frontend
- **Tailwind CSS** — estilos (CDN)
- **React Router v7** — navegación
- **Supabase** — base de datos PostgreSQL + autenticación
- **date-fns** — manejo de fechas
- **Vercel** — deploy y hosting

---

## Funcionalidades

### Dashboard
- Tareas urgentes del día (partos vencidos, destetes, madurez de crías)
- Stats de la colonia: hembras activas, machos activos, preñeces en curso, camadas con crías
- Tabla de seguimiento de preñeces activas con ventana de parto

### Animales
- ABM completo (agregar, editar, eliminar)
- Filtros por sexo, estado y búsqueda por código
- Cálculo automático de edad
- Registro de progenitores y cantidad de camadas

### Camadas
- Registro de apareamientos con todos los datos del ciclo
- Estados: En preñez / Lactancia / Completada
- Cálculo automático de: ventana de parto, fecha de destete, madurez de crías
- Latencia de fertilización por camada

### Calendario
- Vista mensual con eventos automáticos
- Tipos de eventos: cópula, parto esperado, nacimiento, destete, madurez
- Panel lateral con detalle del día seleccionado

### Rendimiento reproductivo
- Ranking de machos por latencia de fertilización (menor = mejor)
- Score y medallas por desempeño
- Historial de apareamientos por macho
- Tabla de rendimiento de hembras

### Reportes
- Reporte mensual o personalizado
- Filtros por sexo, estado de animal y estado de camada
- Incluye: resumen, lista de animales, camadas, rendimiento de machos, observaciones
- Impresión / exportar a PDF con `window.print()`

---

## Motor predictivo — constantes biológicas

| Parámetro | Valor |
|-----------|-------|
| Gestación | 23 días |
| Ventana de concepción post-cópula | 1 a 5 días |
| Destete | 21 días post-nacimiento |
| Madurez reproductiva | 84 días (12 semanas) |

**Latencia de fertilización:**
```
Concepción estimada = Fecha de nacimiento − 23 días
Latencia = Concepción estimada − Fecha de cópula
```
Menor latencia = mejor rendimiento del macho.

---

## Base de datos (Supabase)

### Tabla `animales`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | TEXT PK | ID único |
| codigo | TEXT | Código identificador |
| sexo | TEXT | `hembra` o `macho` |
| fecha_nacimiento | TEXT | YYYY-MM-DD |
| id_madre | TEXT | Referencia a animales |
| id_padre | TEXT | Referencia a animales |
| estado | TEXT | `activo`, `en_cria`, `retirado`, `fallecido` |
| notas | TEXT | Observaciones libres |

### Tabla `camadas`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | TEXT PK | ID único |
| id_madre | TEXT | Referencia a animales |
| id_padre | TEXT | Referencia a animales |
| fecha_copula | TEXT | YYYY-MM-DD |
| fecha_nacimiento | TEXT | YYYY-MM-DD |
| gestacion_real | INTEGER | Días observados |
| total_crias | INTEGER | Total de crías |
| crias_machos | INTEGER | |
| crias_hembras | INTEGER | |
| total_destetados | INTEGER | |
| fecha_destete | TEXT | YYYY-MM-DD |
| notas | TEXT | |

**Seguridad:** Row Level Security (RLS) activo — solo usuarios autenticados pueden leer y escribir.

---

## Autenticación

- Login con email + contraseña via Supabase Auth
- Invitación de nuevos usuarios desde el panel de Supabase
- Flujo de creación de contraseña al aceptar invitación
- Solo el administrador puede agregar usuarios (no hay registro público)

---

## Variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anon
```

---

## Estructura del proyecto

```
src/
├── components/
│   ├── AnimalForm.jsx      formulario agregar/editar animal
│   ├── CamadaForm.jsx      formulario agregar/editar camada
│   ├── Badge.jsx           badge de colores reutilizable
│   ├── Modal.jsx           modal reutilizable
│   └── Sidebar.jsx         menú lateral de navegación
├── context/
│   ├── AuthContext.jsx     login, logout, sesión, invitaciones
│   └── BiotheriumContext.jsx  estado global con useReducer + Supabase
├── lib/
│   └── supabase.js         cliente de Supabase
├── pages/
│   ├── Login.jsx           pantalla de acceso
│   ├── Dashboard.jsx       panel principal
│   ├── Animales.jsx        gestión de animales
│   ├── Camadas.jsx         gestión de camadas
│   ├── Calendario.jsx      calendario de eventos
│   ├── Rendimiento.jsx     análisis reproductivo
│   └── Reportes.jsx        generación de reportes
└── utils/
    ├── calculos.js         motor predictivo biológico
    ├── constants.js        constantes del sistema
    └── storage.js          generador de IDs
```

---

## Deploy

Proyecto deployado en **Vercel** con deploy automático en cada push a `main`.

**Configurar en Vercel → Settings → Environment Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Configurar en Supabase → Authentication → URL Configuration:**
- Site URL: `https://tu-app.vercel.app`
- Redirect URLs: `https://tu-app.vercel.app`

---

## Cómo correr en local

```bash
npm install
npm run dev
```

Abre en `http://localhost:5173`
