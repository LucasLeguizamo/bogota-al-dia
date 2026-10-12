import type { APIRoute } from 'astro';
import { TOOL_DEFS, VERSION, PROTOCOL_VERSIONS, MCP_URL, PLUGIN_INSTALL, REPO } from '../lib/agentes';

const serverJson = {
  "name": "bogota-al-dia",
  "version": VERSION,
  "description": "Datos públicos de Bogotá: TransMilenio y recolección de residuos",
  "repository": REPO,
  "vendor": {
    "name": "Bogotá al Día"
  },
  "protocol": "json-rpc-http",
  "transport": "streamable-http",
  "protocolVersions": PROTOCOL_VERSIONS,
  "url": MCP_URL,
  "packages": [
    {
      "transport": "stdio",
      "command": "node",
      "args": ["bin/bogota.mjs", "mcp"],
      "description": "Servidor local sin dependencias, desde un clon del repositorio"
    }
  ],
  "install": {
    "claude_code_plugin": PLUGIN_INSTALL,
    "cli": "node bin/bogota.mjs <comando>"
  },
  "authentication": {
    "type": "none"
  },
  "tools": TOOL_DEFS,
  "resources": [
    {
      "name": "estaciones",
      "description": "Lista completa de estaciones de TransMilenio",
      "uri": "https://bogota-al-dia.vercel.app/api/transmilenio/estaciones.json"
    },
    {
      "name": "rutas",
      "description": "Lista completa de rutas de TransMilenio",
      "uri": "https://bogota-al-dia.vercel.app/api/transmilenio/rutas.json"
    },
    {
      "name": "zonas-recoleccion",
      "description": "Zonas de recolección de residuos",
      "uri": "https://bogota-al-dia.vercel.app/api/recoleccion/zonas.json"
    }
  ]
};

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(serverJson, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
