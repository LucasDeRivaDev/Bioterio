# BioteríoPro — Plan de implementación

## Qué es esto

Una evolución de AppMosca donde el bioterio **define su propia especie** con sus propios
parámetros biológicos. En vez de tener Ratas / Ratones Balb-C / C57 hardcodeados,
cualquier bioterio puede configurar su colonia: cobayos, conejos, hámsters, jerbos, etc.

**Idea central:** la app se adapta a la especie, no la especie a la app.

---

## Por qué es valioso

Los sistemas actuales de bioterio son específicos para una especie (generalmente ratas o ratones).
Un bioterio que trabaje con cobayos (gestación 68 días, camadas de 1-4, madurez 10 semanas)
hoy no tiene herramientas digitales accesibles.

BioteríoPro resuelve eso: **una sola app, cualquier especie, parámetros configurables**.

---

## Cómo funciona la mecánica

### Al entrar por primera vez
1. El usuario ve una pantalla "¿Con qué especie trabajás?"
2. Puede elegir entre **plantillas predefinidas** (Rattus norvegicus, Mus musculus, Cavia porcellus, Oryctolagus cuniculus) o crear una **especie personalizada**
3. Completa o ajusta los parámetros biológicos
4. La app queda configurada con esos parámetros
5. Todo el motor predictivo usa esos valores desde ese momento

### Parámetros configurables por especie

| Parámetro | Ejemplo Rata | Ejemplo Cobayo | Tipo |
|---|---|---|---|
| Nombre común | Rata de laboratorio | Cobayo | texto |
| Nombre científico | Rattus norvegicus | Cavia porcellus | texto |
| Nombre macho | Macho | Macho | texto |
| Nombre hembra | Hembra | Hembra | texto |
| Días de gestación | 23 | 68 | número |
| Rango de gestación (±) | 1 | 3 | número |
| Días de lactancia/destete | 21 | 14 | número |
| Días hasta madurez sexual | 84 | 70 | número |
| Tamaño promedio de camada | 10 | 3 | número |
| Camada grande (score alto) | ≥10 | ≥4 | número |
| Camada chica (score bajo) | <8 | <2 | número |
| Ícono/emoji | 🐀 | 🐹 | emoji/texto |
| Color de identidad | #ef4444 | #f59e0b | color hex |
| Ciclo estral (días) | 4-5 | 16 | número |
| ¿Tiene ciclo estral detectable? | sí | sí | bool |

### Plantillas predefinidas incluidas

- **Rattus norvegicus** — configuración actual de AppMosca (ratas)
- **Mus musculus** — configuración actual de AppMosca (ratones)
- **Cavia porcellus** — cobayos (gestación 68d, destete 14d, madurez 10sem)
- **Oryctolagus cuniculus** — conejos (gestación 31d, destete 28d, madurez 16sem)
- **Mesocricetus auratus** — hámster dorado (gestación 16d, destete 21d)
- **Especie personalizada** — el usuario completa todo desde cero

---

## Base de datos — cambios respecto a AppMosca

### Nueva tabla `especies`

```sql
CREATE TABLE especies (
  id          text PRIMARY KEY,        -- slug: 'cobayo', 'rata', 'custom_1'
  bioterio_id text NOT NULL,           -- a qué bioterio pertenece
  nombre      text NOT NULL,           -- "Cobayo"
  nombre_cientifico text,
  nombre_macho text DEFAULT 'Macho',
  nombre_hembra text DEFAULT 'Hembra',
  icono       text DEFAULT '🐾',
  color       text DEFAULT '#6366f1',
  
  -- Parámetros reproductivos
  dias_gestacion      int NOT NULL,
  rango_gestacion     int DEFAULT 1,
  dias_destete        int NOT NULL,
  dias_madurez        int NOT NULL,
  
  -- Parámetros de scoring
  camada_grande_min   int NOT NULL,    -- ≥ este valor → score alto
  camada_chica_max    int NOT NULL,    -- < este valor → score bajo
  
  -- Ciclo estral
  tiene_ciclo_estral  bool DEFAULT true,
  dias_ciclo_estral   int DEFAULT 4,
  
  -- Meta
  es_plantilla  bool DEFAULT false,    -- true = viene predefinida
  created_at    timestamptz DEFAULT now()
);
```

### Tabla `bioterios` (nueva)

```sql
CREATE TABLE bioterios (
  id            text PRIMARY KEY,
  nombre        text NOT NULL,         -- "Bioterio FCQ UNL"
  especie_id    text REFERENCES especies(id),  -- especie activa
  owner_id      uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);
```

### Cambio en las demás tablas

Agregar `especie_id text` a: `animales`, `camadas`, `jaulas`, `sacrificios`, `entregas`, `temperature_logs`, `extendidos`.

Esto permite que un mismo bioterio maneje **múltiples especies simultáneamente** si lo necesita.

---

## Cambios en el código

### Nuevo flujo de onboarding

```
Login
  └─> ¿Tiene bioterio configurado?
        ├─ No → PantallaCrearBioterio → FormularioEspecie → Dashboard
        └─ Sí → SelectorEspecie (si tiene varias) → Dashboard
```

### `EspecieContext.jsx` (nuevo contexto)

Reemplaza `BioterioActivoContext.jsx`. Expone:
- `especie` — objeto completo con todos los parámetros
- `setEspecie(id)` — cambia la especie activa
- `bio` — objeto equivalente al BIO actual, derivado de los parámetros de la especie
- `crearEspecie(datos)` — inserta nueva especie en Supabase
- `editarEspecie(id, datos)` — modifica parámetros

### `calculos.js` — sin cambios de firma

Las funciones ya aceptan `bio` como parámetro:
```js
calcularRangoParto(camada, bio)
calcularDestete(camada, bio)
// etc.
```
Solo cambia qué objeto `bio` se pasa — ahora viene de `EspecieContext` en vez de `constants.js`.

El objeto `bio` que se construye desde la especie:
```js
const bio = {
  GESTACION_DIAS: especie.dias_gestacion,
  GESTACION_RANGO: especie.rango_gestacion,
  DESTETE_DIAS: especie.dias_destete,
  MADUREZ_DIAS: especie.dias_madurez,
  CAMADA_GRANDE_MIN: especie.camada_grande_min,
  CAMADA_CHICA_MAX: especie.camada_chica_max,
}
```

### `FormularioEspecie.jsx` (nuevo componente)

Pantalla de configuración de especie con:
- Selector de plantilla (con preview de parámetros)
- Form de edición para cada parámetro con tooltips explicativos
- Preview en tiempo real de cómo afecta el sistema (ej: "Con estos parámetros el parto se espera entre el día X y el día Y")
- Botón guardar → inserta en Supabase y activa la especie

### Página de configuración de bioterio

Ruta `/configuracion` (ícono ⚙️ en sidebar al fondo):
- Ver y editar parámetros de la especie activa
- Agregar nuevas especies
- Cambiar entre especies
- Datos del bioterio (nombre, responsable)

---

## Diferencias con AppMosca actual

| Aspecto | AppMosca | BioteríoPro |
|---|---|---|
| Especies | Ratas + 3 subgrupos ratones | Cualquier especie |
| Parámetros biológicos | Hardcodeados en constants.js | Configurables por el usuario |
| Onboarding | SelectorBioterio simple | Formulario de configuración guiado |
| Multi-especie | Simulado con IDs fijos | Real, desde la base de datos |
| Scoring | Umbrales fijos (≥10, <8) | Umbrales configurables por especie |
| Ciclo estral | Solo para ratas/ratones | Configurable (o desactivable) |

---

## Qué NO cambia

- El motor predictivo (`calculos.js`) — solo cambia el `bio` que recibe
- Todos los módulos (Dashboard, Camadas, Stock, etc.) — sin cambios
- La UI entera — sin cambios
- Supabase como backend — mismo setup
- El sistema de scores reproductivos — mismo algoritmo

---

## Monetización posible

BioteríoPro puede ser una versión de pago de AppMosca:

| Plan | Características | Precio sugerido |
|---|---|---|
| **Básico (gratis)** | 1 especie, máx 50 animales | — |
| **Pro** | Especies ilimitadas, animales ilimitados, exportación PDF | USD 15/mes |
| **Institucional** | Multi-usuario, roles, auditoría | USD 40/mes |

---

## Orden de implementación sugerido

1. [ ] Clonar AppMosca en repo nuevo `BioteríoPro`
2. [ ] Crear tabla `especies` en Supabase con las plantillas predefinidas
3. [ ] Crear tabla `bioterios` en Supabase
4. [ ] Crear `EspecieContext.jsx` que lee especie de Supabase
5. [ ] Crear `FormularioEspecie.jsx` con las plantillas
6. [ ] Modificar `App.jsx` para el nuevo flujo de onboarding
7. [ ] Conectar `bio` desde contexto en todas las páginas
8. [ ] Agregar página `/configuracion`
9. [ ] Testear con cobayos (caso más diferente de ratas)
10. [ ] Deploy en Vercel con URL separada

---

## Notas importantes

- El ciclo estral es específico de ratas/ratones — para otras especies se puede **desactivar** la sección completa de CicloEstral con `especie.tiene_ciclo_estral = false`
- Los nombres "Macho" / "Hembra" se pueden personalizar (ej: para conejos podría ser "Conejo" / "Coneja")
- La detección de consanguinidad funciona igual — es lógica de padres/hijos, no depende de la especie
- Los gráficos de Estadísticas no necesitan cambios — trabajan con fechas y conteos, no con parámetros biológicos
