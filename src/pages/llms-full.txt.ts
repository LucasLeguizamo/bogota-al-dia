import type { APIRoute } from 'astro';
import { ACCESS_METHODS, CLI_COMMANDS, MCP_URL, PLUGIN_INSTALL, PROTOCOL_VERSIONS, REPO, TOOL_DEFS } from '../lib/agentes';
import estacionesData from '../../data/transmilenio/estaciones.json';
import rutasData from '../../data/transmilenio/rutas.json';
import zonasData from '../../data/recoleccion/zonas.json';
import localidadesData from '../../data/recoleccion/localidades.json';

export const GET: APIRoute = () => {
  const llmsFullTxt = `# Bogotá al Día - Documentación Completa

Información pública del día a día en Bogotá, Colombia.

## Resumen de datos

- **TransMilenio**: ${estacionesData.total} estaciones, ${rutasData.total} rutas
- **Recolección**: ${zonasData.total} zonas en ${localidadesData.localidades.length} localidades
- **Última actualización**: ${estacionesData.generado}

## TransMilenio

### Estaciones (${estacionesData.total} total)

Campos disponibles:
- id: Identificador único
- codigo: Código oficial
- nombre: Nombre de la estación
- troncal: Corredor (Caracas, Suba, NQS, etc.)
- tipo: sencilla, intermedia, cabecera, portal
- coordenadas: latitud, longitud
- servicios: biciparqueadero, wifi, accesos

Troncales disponibles:
${[...new Set(estacionesData.estaciones.map(e => e.troncal))].sort().map(t => `- ${t}`).join('\n')}

### Rutas (${rutasData.total} total)

Campos disponibles:
- id: Identificador único
- codigo: Código de ruta (ej: B23, K43)
- nombre: Nombre descriptivo
- origen, destino: Terminales
- tipo_operacion: normal, refuerzo, ciclovia, desconocido
- tipo_bus: articulado, biarticulado, dual, padron, buseton, desconocido
- estado: activa, suspendida, programada
- longitud_km: longitud comercial en km (respaldo: longitud de la geometría oficial)
- horarios: lunes_viernes, sabado, domingo_festivo

## Recolección de Residuos

### Localidades (${localidadesData.localidades.length} total)

${localidadesData.localidades.map(l => `- ${l.localidad} (código ${l.codigo}): ${l.total_zonas} zonas`).join('\n')}

### Zonas (${zonasData.total} total)

Campos disponibles:
- id: Identificador único
- codigo_macroruta: Código de macroruta UAESP
- localidad: código y nombre
- frecuencia: código, días[], descripción
- horario_inicio, horario_fin: formato HH:MM
- vigencia: fecha de vigencia

Frecuencias comunes:
- Código 1: Lunes, miércoles y viernes
- Código 2: Martes, jueves y sábado
- Código 6: Todos los días

## API REST

Base URL: https://bogota-al-dia.vercel.app/api

### Endpoints

GET /api/transmilenio/estaciones.json
  Retorna: { estaciones: EstacionTransmilenio[], total: number }

GET /api/transmilenio/estaciones/{codigo}.json
  Retorna: EstacionTransmilenio
  Errores: 404 si no existe

GET /api/transmilenio/rutas.json
  Retorna: { rutas: RutaTransmilenio[], total: number }

GET /api/transmilenio/rutas/{codigo}.json
  Retorna: RutaTransmilenio
  Errores: 404 si no existe

GET /api/recoleccion/zonas.json
  Retorna: { zonas: ZonaRecoleccion[], total: number }

GET /api/recoleccion/localidades.json
  Retorna: { localidades: { nombre, codigo, total_zonas }[] }

GET /api/recoleccion/localidades/{codigo}.json
  Retorna: { localidad: string, zonas: ZonaRecoleccion[] }
  Errores: 404 si no existe

## Acceso para agentes

${ACCESS_METHODS.map((m) => `- **${m.via}**: ${m.how}`).join('\n')}

### Plugin de Claude Code

    ${PLUGIN_INSTALL}

Incluye el servidor MCP local (node, sin dependencias), los agentes transmilenio-expert y recoleccion-expert y la skill bogota-al-dia.

### MCP

- Remoto: ${MCP_URL} (Streamable HTTP, JSON-RPC 2.0 por POST, sin sesiones ni stream SSE)
- Local: \`node bin/bogota.mjs mcp\` (stdio, un mensaje JSON por línea)
- Versiones de protocolo: ${PROTOCOL_VERSIONS.join(', ')}
- Métodos: initialize, ping, tools/list, tools/call

Herramientas (${TOOL_DEFS.length}):

${TOOL_DEFS.map((t) => `#### ${t.name}

${t.description}

Parámetros:
${Object.entries(t.inputSchema.properties).map(([k, p]) => `- ${k} (${p.type}, opcional): ${p.description}`).join('\n') || '- ninguno'}`).join('\n\n')}

Las herramientas devuelven un bloque de texto con JSON. Herramienta desconocida → error JSON-RPC -32602.

### CLI

Desde un clon de ${REPO}:

${CLI_COMMANDS.map(([c, d]) => `    ${c.padEnd(52)} # ${d}`).join('\n')}

(\`bogota\` = \`node bin/bogota.mjs\`). Salida en JSON.

## OpenAPI

Especificación completa disponible en:
https://bogota-al-dia.vercel.app/openapi.json

## Licencia

Datos bajo CC-BY-SA-4.0
Fuentes: TransMilenio S.A., UAESP / Alcaldía de Bogotá
`;

  return new Response(llmsFullTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
