import type { APIRoute } from 'astro';
import estaciones from '../../data/transmilenio/estaciones.json';
import rutas from '../../data/transmilenio/rutas.json';
import zonas from '../../data/recoleccion/zonas.json';
import localidades from '../../data/recoleccion/localidades.json';
const B = 'https://bogota-al-dia-ten.vercel.app';
export const GET: APIRoute = () => new Response(`# Bogotá al Día

Información pública del día a día en Bogotá, centralizada y lista para personas y agentes de IA.

## Datos disponibles

- **TransMilenio**: ${(estaciones as any).total} estaciones troncales y ${(rutas as any).total} rutas. [Ver](${B}/transmilenio/)
- **Recolección de residuos**: ${(zonas as any).total} zonas en ${(localidades as any).localidades.length} localidades. [Ver](${B}/recoleccion/)

## Para desarrolladores y agentes

- [Documentación API](${B}/api/)
- [OpenAPI](${B}/openapi.json)
- [MCP Server](${B}/mcp/) (Streamable HTTP en \`POST ${B}/api/mcp\`)
- [llms.txt](${B}/llms.txt) · [llms-full.txt](${B}/llms-full.txt)

## Fuentes

Datos oficiales del Distrito (TransMilenio S.A., UAESP, Catastro Bogotá). Licencia CC-BY-SA-4.0.
`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
