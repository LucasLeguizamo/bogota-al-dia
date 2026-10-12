import type { APIRoute } from 'astro';

const serverCard = {
  "name": "bogota-al-dia",
  "version": "1.0.0",
  "description": "Datos públicos de Bogotá: estaciones y rutas de TransMilenio, horarios de recolección de residuos.",
  "vendor": {
    "name": "Bogotá al Día",
    "url": "https://bogota-al-dia-ten.vercel.app"
  },
  "server": {
    "url": "https://bogota-al-dia-ten.vercel.app/api/mcp",
    "protocol": "json-rpc-http"
  },
  "authentication": {
    "type": "none"
  },
  "capabilities": {
    "tools": true,
    "resources": true
  },
  "tools": [
    "estaciones_transmilenio",
    "rutas_transmilenio", 
    "recoleccion_por_zona"
  ],
  "links": {
    "documentation": "https://bogota-al-dia-ten.vercel.app/mcp/",
    "manifest": "https://bogota-al-dia-ten.vercel.app/server.json",
    "openapi": "https://bogota-al-dia-ten.vercel.app/openapi.json",
    "llms_txt": "https://bogota-al-dia-ten.vercel.app/llms.txt"
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
