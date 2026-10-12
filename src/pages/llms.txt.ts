import type { APIRoute } from 'astro';
import { ACCESS_METHODS, CLI_COMMANDS, MCP_URL, PLUGIN_INSTALL, REPO, toolsMarkdown } from '../lib/agentes';

export const GET: APIRoute = () => {
  const llmsTxt = `# Bogotá al Día

Información pública del día a día en Bogotá, Colombia, centralizada y lista para personas y agentes de IA.

## Contenido

Este sitio proporciona datos abiertos sobre servicios públicos de Bogotá:

1. **TransMilenio**: Estaciones troncales, rutas y horarios del sistema de transporte masivo.
2. **Recolección de residuos**: Horarios y frecuencias de recolección de basura por localidad y zona.

## Páginas principales

- [Inicio](https://bogota-al-dia.vercel.app/)
- [TransMilenio - Estaciones y Rutas](https://bogota-al-dia.vercel.app/transmilenio/)
- [Recolección de Residuos](https://bogota-al-dia.vercel.app/recoleccion/)
- [Documentación API](https://bogota-al-dia.vercel.app/api/)

## Para agentes de IA

### Cómo acceder

${ACCESS_METHODS.map((m) => `- **${m.via}**: ${m.how}`).join('\n')}

Instalar en Claude Code:

    ${PLUGIN_INSTALL}

### Herramientas MCP (${MCP_URL})

${toolsMarkdown()}

### CLI (bin/bogota.mjs, salida JSON)

${CLI_COMMANDS.map(([c, d]) => `- \`${c}\` — ${d}`).join('\n')}

### Descubrimiento

- [OpenAPI Specification](https://bogota-al-dia.vercel.app/openapi.json)
- [API Catalog RFC 9727](https://bogota-al-dia.vercel.app/.well-known/api-catalog)
- [MCP Server](https://bogota-al-dia.vercel.app/mcp/)
- [server.json](https://bogota-al-dia.vercel.app/server.json) y [server card](https://bogota-al-dia.vercel.app/.well-known/mcp/server-card.json)
- [llms-full.txt con detalles](https://bogota-al-dia.vercel.app/llms-full.txt)

## Endpoints de datos

### TransMilenio
- GET /api/transmilenio/estaciones.json - Todas las estaciones
- GET /api/transmilenio/estaciones/{codigo}.json - Estación específica
- GET /api/transmilenio/rutas.json - Todas las rutas
- GET /api/transmilenio/rutas/{codigo}.json - Ruta específica

### Recolección
- GET /api/recoleccion/zonas.json - Todas las zonas
- GET /api/recoleccion/localidades.json - Índice de localidades
- GET /api/recoleccion/localidades/{codigo}.json - Zonas de una localidad

## Fuentes de datos

Todos los datos provienen de fuentes oficiales del Distrito de Bogotá:
- TransMilenio S.A. (datosabiertos.bogota.gov.co)
- UAESP (datosabiertos.bogota.gov.co)

Licencia: CC-BY-SA-4.0

## Contacto

Repositorio: ${REPO}
`;

  return new Response(llmsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
