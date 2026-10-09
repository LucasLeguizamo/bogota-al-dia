import type { APIRoute } from 'astro';

const serverJson = {
  "name": "bogota-al-dia",
  "version": "1.0.0",
  "description": "Datos públicos de Bogotá: TransMilenio y recolección de residuos",
  "vendor": {
    "name": "Bogotá al Día"
  },
  "protocol": "streamable-http",
  "url": "https://bogota-al-dia.vercel.app/mcp",
  "authentication": {
    "type": "none"
  },
  "tools": [
    {
      "name": "buscar_estacion",
      "description": "Busca una estación de TransMilenio por nombre o código",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Nombre o código de la estación"
          }
        },
        "required": ["query"]
      }
    },
    {
      "name": "buscar_ruta",
      "description": "Busca una ruta de TransMilenio por código",
      "inputSchema": {
        "type": "object",
        "properties": {
          "codigo": {
            "type": "string",
            "description": "Código de la ruta (ej: B23, K43)"
          }
        },
        "required": ["codigo"]
      }
    },
    {
      "name": "horario_recoleccion",
      "description": "Consulta horarios de recolección de basura por localidad",
      "inputSchema": {
        "type": "object",
        "properties": {
          "localidad": {
            "type": "string",
            "description": "Nombre de la localidad (ej: Suba, Kennedy)"
          }
        },
        "required": ["localidad"]
      }
    },
    {
      "name": "listar_localidades",
      "description": "Lista todas las localidades de Bogotá con información de recolección",
      "inputSchema": {
        "type": "object",
        "properties": {}
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
