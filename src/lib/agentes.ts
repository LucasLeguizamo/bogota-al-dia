// Superficie para agentes, derivada del núcleo lib/bogota.mjs (única fuente de verdad).
// La usan server.json, las server-cards, openapi.json, llms*.txt y /mcp/.
import { toolDefs, VERSION, PROTOCOL_VERSIONS } from '../../lib/bogota.mjs';

export const SITE = 'https://bogota-al-dia.vercel.app';
export const MCP_URL = `${SITE}/api/mcp`;
export const REPO = 'https://github.com/LucasLeguizamo/bogota-al-dia';
export const PLUGIN_INSTALL = '/plugin install bogota-al-dia --marketplace LucasLeguizamo/bogota-al-dia';
export const MCP_ADD_HTTP = `claude mcp add --transport http bogota-al-dia ${MCP_URL}`;

export { VERSION, PROTOCOL_VERSIONS };

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, { type: string; description: string }> };
};
export const TOOL_DEFS: ToolDef[] = toolDefs();
export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

// Comandos del CLI (bin/bogota.mjs). Mantener en sincronía con su HELP.
export const CLI_COMMANDS = [
  ['bogota estaciones [texto] [--troncal X] [--limit N]', 'Busca estaciones troncales'],
  ['bogota estacion <codigo>', 'Una estación por código'],
  ['bogota rutas [texto] [--limit N]', 'Busca rutas troncales'],
  ['bogota ruta <codigo>', 'Una ruta por código'],
  ['bogota recoleccion <localidad|codigo>', 'Horarios de recolección de una localidad'],
  ['bogota localidades', 'Localidades con datos de recolección'],
  ['bogota resumen', 'Metadatos de los datasets'],
  ['bogota mcp', 'Servidor MCP por stdio'],
] as const;

// Las cuatro vías de acceso, en texto para llms.txt y similares.
export const ACCESS_METHODS = [
  { via: 'MCP remoto (Streamable HTTP)', how: `POST JSON-RPC a ${MCP_URL} — o \`${MCP_ADD_HTTP}\`` },
  { via: 'MCP local (stdio)', how: '`node bin/bogota.mjs mcp` (sin dependencias, desde un clon del repo)' },
  { via: 'Plugin de Claude Code', how: `\`${PLUGIN_INSTALL}\` (MCP local + agentes transmilenio-expert y recoleccion-expert + skill)` },
  { via: 'CLI', how: '`node bin/bogota.mjs <comando>` (o `bogota <comando>` si se instala el paquete); salida JSON' },
  { via: 'REST', how: `GET ${SITE}/api/... (ver /openapi.json)` },
];

export const toolsMarkdown = () =>
  TOOL_DEFS.map((t) => {
    const params = Object.entries(t.inputSchema.properties)
      .map(([k, p]) => `${k}: ${p.type}`)
      .join(', ');
    return `- \`${t.name}\`(${params || 'sin parámetros'}) — ${t.description}`;
  }).join('\n');
