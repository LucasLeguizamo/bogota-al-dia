import type { APIRoute } from 'astro';

const serverJson = {
  "name": "bogota-al-dia",
  "version": "1.0.0",
  "description": "Datos públicos de Bogotá: TransMilenio y recolección de residuos",
  "vendor": {
    "name": "Bogotá al Día"
  },
  "protocol": "json-rpc-http",
  "url": "https://bogota-al-dia.vercel.app/api/mcp",
  "authentication": {
    "type": "none"
  },
  "tools": [
    {
      "name": "estaciones_transmilenio",
      "description": "Lista o busca estaciones de TransMilenio por nombre, código o troncal",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Búsqueda por nombre, código o troncal (opcional)"
          },
          "limit": {
            "type": "number",
            "description": "Número máximo de resultados (default: 10)"
          }
        }
      }
    },
    {
      "name": "rutas_transmilenio",
      "description": "Lista o busca rutas de TransMilenio por código",
      "inputSchema": {
        "type": "object",
        "properties": {
          "codigo": {
            "type": "string",
            "description": "Código de la ruta (ej: B23, K43)"
          },
          "limit": {
            "type": "number",
            "description": "Número máximo de resultados (default: 10)"
          }
        }
      }
    },
    {
      "name": "recoleccion_por_zona",
      "description": "Consulta horarios de recolección de basura por localidad",
      "inputSchema": {
        "type": "object",
        "properties": {
          "localidad": {
            "type": "string",
            "description": "Nombre de la localidad (ej: Suba, Kennedy)"
          },
          "codigo": {
            "type": "string",
            "description": "Código de localidad (1-20)"
          }
        }
      }
    }
  ],
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
