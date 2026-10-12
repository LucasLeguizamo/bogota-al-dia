# Bogotá al Día

Datos públicos del día a día en Bogotá, abiertos y listos para personas y agentes de IA.

## Contenido

- **TransMilenio**: 152 estaciones troncales, 128 rutas con horarios
- **Recolección de Residuos**: 115 zonas en 19 localidades con frecuencias y horarios

## Uso

### Sitio Web

Visita [bogota-al-dia.vercel.app](https://bogota-al-dia.vercel.app) para navegar los datos.

### API JSON

```bash
# Estaciones de TransMilenio
curl https://bogota-al-dia.vercel.app/api/transmilenio/estaciones.json

# Estación específica
curl https://bogota-al-dia.vercel.app/api/transmilenio/estaciones/03003.json

# Rutas
curl https://bogota-al-dia.vercel.app/api/transmilenio/rutas.json

# Zonas de recolección
curl https://bogota-al-dia.vercel.app/api/recoleccion/zonas.json

# Zonas por localidad (Suba = código 11)
curl https://bogota-al-dia.vercel.app/api/recoleccion/localidades/11.json
```

Especificación completa: [openapi.json](https://bogota-al-dia.vercel.app/openapi.json)

### Claude Code (plugin con expertos)

```
/plugin install bogota-al-dia --marketplace LucasLeguizamo/bogota-al-dia
```

Incluye servidor MCP local (sin dependencias), agentes `transmilenio-expert` y `recoleccion-expert`, y la skill `bogota-al-dia`.

### CLI

```bash
npx github:LucasLeguizamo/bogota-al-dia estaciones portal
node bin/bogota.mjs ruta B23
node bin/bogota.mjs recoleccion suba
node bin/bogota.mjs --help
```

### MCP

- Local (stdio): `node bin/bogota.mjs mcp` — ya configurado en `.mcp.json` al abrir el repo con Claude Code.
- Remoto (HTTP): `claude mcp add --transport http bogota-al-dia https://bogota-al-dia.vercel.app/api/mcp`

Herramientas: `estaciones_transmilenio`, `rutas_transmilenio`, `recoleccion_por_zona`, `localidades_recoleccion`, `resumen_datos`.

### Para Agentes de IA

- [llms.txt](https://bogota-al-dia.vercel.app/llms.txt) - Contexto rápido
- [llms-full.txt](https://bogota-al-dia.vercel.app/llms-full.txt) - Documentación completa
- [server.json](https://bogota-al-dia.vercel.app/server.json) - MCP server manifest

## Fuentes de Datos

| Fuente | Datos | Licencia |
|--------|-------|----------|
| [datosabiertos.bogota.gov.co](https://datosabiertos.bogota.gov.co) | TransMilenio, UAESP | CC-BY-SA-4.0 |
| [gis.transmilenio.gov.co](https://gis.transmilenio.gov.co) | Estaciones, Rutas | CC-BY-SA-4.0 |
| [serviciosgis.catastrobogota.gov.co](https://serviciosgis.catastrobogota.gov.co) | Macrorutas recolección | CC-BY-SA-4.0 |

Ver [docs/sources.md](docs/sources.md) para el inventario completo.

## Desarrollo

### Requisitos

- Node.js 20+
- pnpm

### Instalación

```bash
pnpm install
```

### Extraer datos

```bash
# Todos los extractores
pnpm run extract

# Individual
pnpm run extract:estaciones
pnpm run extract:rutas
pnpm run extract:recoleccion
```

### Desarrollo local

```bash
pnpm run dev
```

### Build

```bash
pnpm run build
pnpm run preview
```

## Estructura

```
├── data/                 # Datos extraídos (JSON, CSV)
│   ├── transmilenio/
│   └── recoleccion/
├── schemas/              # JSON Schema de los tipos
├── scripts/              # Extractores
├── src/
│   ├── layouts/
│   ├── pages/            # Páginas Astro y endpoints API
│   └── components/
└── docs/
    ├── sources.md        # Inventario de fuentes
    └── decisions.md      # Log de decisiones
```

## Despliegue

El sitio se despliega automáticamente en Vercel. Para desplegar manualmente:

```bash
pnpm run build
# El directorio dist/ contiene el sitio estático
```

## Licencia

- **Código**: MIT
- **Datos**: CC-BY-SA-4.0 (heredado de las fuentes)

Atribución requerida: "Datos: TransMilenio S.A., UAESP / Alcaldía de Bogotá"
