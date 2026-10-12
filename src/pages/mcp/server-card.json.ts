import type { APIRoute } from 'astro';
import { TOOL_NAMES, VERSION, PROTOCOL_VERSIONS, MCP_URL, PLUGIN_INSTALL } from '../../lib/agentes';

const serverCard = {
  "name": "bogota-al-dia",
  "version": VERSION,
  "description": "Datos públicos de Bogotá: estaciones y rutas de TransMilenio, horarios de recolección de residuos.",
  "vendor": {
    "name": "Bogotá al Día",
    "url": "https://bogota-al-dia.vercel.app"
  },
  "server": {
    "url": MCP_URL,
    "protocol": "json-rpc-http",
    "transport": "streamable-http",
    "protocolVersions": PROTOCOL_VERSIONS
  },
  "install": {
    "claude_code_plugin": PLUGIN_INSTALL,
    "stdio": "node bin/bogota.mjs mcp",
    "cli": "node bin/bogota.mjs <comando>"
  },
  "authentication": {
    "type": "none"
  },
  "capabilities": {
    "tools": true,
    "resources": false
  },
  "tools": TOOL_NAMES,
  "links": {
    "documentation": "https://bogota-al-dia.vercel.app/mcp/",
    "manifest": "https://bogota-al-dia.vercel.app/server.json",
    "openapi": "https://bogota-al-dia.vercel.app/openapi.json"
  }
};

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(serverCard, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
