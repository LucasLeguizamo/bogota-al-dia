import type { APIRoute } from 'astro';
import { TOOL_DEFS, TOOL_NAMES, PROTOCOL_VERSIONS, MCP_URL, PLUGIN_INSTALL, REPO } from '../lib/agentes';

const openapi = {
  "openapi": "3.1.0",
  "info": {
    "title": "Bogotá al Día API",
    "description": `API pública con datos de servicios públicos de Bogotá: TransMilenio y recolección de residuos.

Los mismos datos están disponibles para agentes por:
- MCP remoto (Streamable HTTP): POST ${MCP_URL} — herramientas: ${TOOL_NAMES.join(', ')}.
- MCP local (stdio) y CLI sin dependencias: \`node bin/bogota.mjs mcp\` / \`node bin/bogota.mjs <comando>\` desde ${REPO}.
- Plugin de Claude Code: \`${PLUGIN_INSTALL}\`.`,
    "version": "1.2.0",
    "contact": {
      "name": "Bogotá al Día",
      "url": "https://bogota-al-dia.vercel.app"
    },
    "license": {
      "name": "CC-BY-SA-4.0",
      "url": "https://creativecommons.org/licenses/by-sa/4.0/"
    }
  },
  "servers": [
    {
      "url": "https://bogota-al-dia.vercel.app",
      "description": "Producción"
    }
  ],
  "paths": {
    "/api/trip": {
      "get": {
        "operationId": "planTrip",
        "summary": "Plan a public-transit trip from A to B",
        "description": "Optimal routes (fastest ↔ fewest transfers) from the official GTFS schedule of the day, with boarding car and door. Built for bots: `format=text` returns a chat-ready message (Spanish) for WhatsApp/Telegram. Also accepts POST with the same fields as a JSON body. Keys and enum values are English; `notices`, error messages and the text format are Spanish (end-user copy).",
        "tags": ["Trips"],
        "parameters": [
          { "name": "origin", "in": "query", "required": true, "schema": { "type": "string" }, "description": "Station, stop/neighborhood, stop code or \"lat,lon\"" },
          { "name": "destination", "in": "query", "required": true, "schema": { "type": "string" }, "description": "Station, stop/neighborhood, stop code or \"lat,lon\"" },
          { "name": "time", "in": "query", "schema": { "type": "string", "pattern": "^\\d{1,2}:\\d{2}$" }, "description": "HH:MM, Colombia time (default: now)" },
          { "name": "date", "in": "query", "schema": { "type": "string", "format": "date" }, "description": "YYYY-MM-DD (default: today). Holidays are detected" },
          { "name": "city", "in": "query", "schema": { "type": "string", "default": "11001" }, "description": "City name or DIVIPOLA code" },
          { "name": "format", "in": "query", "schema": { "type": "string", "enum": ["json", "text", "html"], "default": "json" } }
        ],
        "responses": {
          "200": { "description": "Trip: { city, municipality, origin, destination, date, time, weekday, holiday, options[{ label, recommended, departs, arrives, duration_min, transfers, walk_min, wait_min, legs[] }], walk_only_min?, no_service?, suggestions?, notices[], source }", "content": { "application/json": { "schema": { "type": "object" } }, "text/plain": { "schema": { "type": "string" } }, "text/html": { "schema": { "type": "string" } } } },
          "400": { "description": "Place not found or invalid parameters", "content": { "application/json": { "schema": { "type": "object", "properties": { "error": { "type": "string" } } } } } }
        }
      }
    },
    "/api/tools/{name}": {
      "post": {
        "operationId": "runTool",
        "summary": "Run a tool (function calling)",
        "description": "Definitions live at /tools.json (OpenAI format, compatible with xAI/Grok and Gemini). Same tools as the MCP server.",
        "tags": ["Agents"],
        "parameters": [{ "name": "name", "in": "path", "required": true, "schema": { "type": "string", "enum": TOOL_NAMES } }],
        "requestBody": { "content": { "application/json": { "schema": { "type": "object" } } } },
        "responses": {
          "200": { "description": "{ result, text? } — `text` is a chat-ready answer when the tool provides one (plan_trip)", "content": { "application/json": { "schema": { "type": "object", "properties": { "result": {}, "text": { "type": "string" } }, "required": ["result"] } } } },
          "400": { "description": "Tool error" },
          "404": { "description": "Unknown tool" }
        }
      }
    },
    "/api/transmilenio/estaciones.json": {
      "get": {
        "operationId": "getEstaciones",
        "summary": "Lista todas las estaciones de TransMilenio",
        "description": "Retorna todas las estaciones troncales del sistema TransMilenio con sus datos completos.",
        "tags": ["TransMilenio"],
        "responses": {
          "200": {
            "description": "Lista de estaciones",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "total": { "type": "integer" },
                    "estaciones": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/Estacion" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/transmilenio/estaciones/{codigo}.json": {
      "get": {
        "operationId": "getEstacion",
        "summary": "Obtiene una estación por código",
        "tags": ["TransMilenio"],
        "parameters": [
          {
            "name": "codigo",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "description": "Código de la estación (ej: 03003)"
          }
        ],
        "responses": {
          "200": {
            "description": "Datos de la estación",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Estacion" }
              }
            }
          },
          "404": {
            "description": "Estación no encontrada",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Error" }
              }
            }
          }
        }
      }
    },
    "/api/transmilenio/rutas.json": {
      "get": {
        "operationId": "getRutas",
        "summary": "Lista todas las rutas de TransMilenio",
        "tags": ["TransMilenio"],
        "responses": {
          "200": {
            "description": "Lista de rutas",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "total": { "type": "integer" },
                    "rutas": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/Ruta" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/transmilenio/rutas/{codigo}.json": {
      "get": {
        "operationId": "getRuta",
        "summary": "Obtiene una ruta por código",
        "tags": ["TransMilenio"],
        "parameters": [
          {
            "name": "codigo",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "description": "Código de la ruta (ej: B23)"
          }
        ],
        "responses": {
          "200": {
            "description": "Datos de la ruta",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Ruta" }
              }
            }
          },
          "404": {
            "description": "Ruta no encontrada",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Error" }
              }
            }
          }
        }
      }
    },
    "/api/recoleccion/zonas.json": {
      "get": {
        "operationId": "getZonas",
        "summary": "Lista todas las zonas de recolección",
        "tags": ["Recolección"],
        "responses": {
          "200": {
            "description": "Lista de zonas de recolección",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "total": { "type": "integer" },
                    "zonas": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/Zona" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/recoleccion/localidades.json": {
      "get": {
        "operationId": "getLocalidades",
        "summary": "Lista localidades con sus zonas",
        "tags": ["Recolección"],
        "responses": {
          "200": {
            "description": "Índice de localidades",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "localidades": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/LocalidadResumen" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/recoleccion/localidades/{codigo}.json": {
      "get": {
        "operationId": "getLocalidad",
        "summary": "Obtiene zonas de una localidad",
        "tags": ["Recolección"],
        "parameters": [
          {
            "name": "codigo",
            "in": "path",
            "required": true,
            "schema": { "type": "string" },
            "description": "Código de la localidad (1-20)"
          }
        ],
        "responses": {
          "200": {
            "description": "Zonas de la localidad",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "localidad": { "type": "string" },
                    "codigo": { "type": "string" },
                    "total_zonas": { "type": "integer" },
                    "zonas": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/Zona" }
                    }
                  }
                }
              }
            }
          },
          "404": {
            "description": "Localidad no encontrada",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Error" }
              }
            }
          }
        }
      }
    },
    "/api/mcp": {
      "post": {
        "operationId": "mcpJsonRpc",
        "summary": "Servidor MCP (JSON-RPC 2.0, Streamable HTTP sin sesiones)",
        "description": `Model Context Protocol. Métodos: initialize, ping, tools/list, tools/call. Versiones: ${PROTOCOL_VERSIONS.join(', ')}. Herramientas: ${TOOL_NAMES.join(', ')}. Las notificaciones reciben 202 sin cuerpo.`,
        "tags": ["MCP"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["jsonrpc", "method"],
                "properties": {
                  "jsonrpc": { "const": "2.0" },
                  "id": { "type": ["string", "integer"] },
                  "method": { "type": "string", "enum": ["initialize", "ping", "tools/list", "tools/call", "notifications/initialized"] },
                  "params": { "type": "object" }
                }
              },
              "example": { "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "estaciones_transmilenio", "arguments": { "query": "portal" } } }
            }
          }
        },
        "responses": {
          "200": { "description": "Respuesta JSON-RPC", "content": { "application/json": { "schema": { "type": "object" } } } },
          "202": { "description": "Notificación aceptada (sin cuerpo)" },
          "400": { "description": "JSON inválido o MCP-Protocol-Version no soportada" }
        }
      },
      "get": {
        "operationId": "mcpInfo",
        "summary": "Descripción del servidor MCP (405 si se pide text/event-stream: no hay stream SSE)",
        "tags": ["MCP"],
        "responses": {
          "200": { "description": "Nombre, versión, versiones de protocolo y herramientas" },
          "405": { "description": "No se ofrece stream SSE de servidor" }
        }
      }
    }
  },
  "x-mcp": {
    "url": MCP_URL,
    "transport": "streamable-http",
    "protocolVersions": PROTOCOL_VERSIONS,
    "tools": TOOL_DEFS,
    "claude_code_plugin": PLUGIN_INSTALL
  },
  "components": {
    "schemas": {
      "Estacion": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "codigo": { "type": "string" },
          "nombre": { "type": "string" },
          "ubicacion": { "type": "string" },
          "troncal": { "type": "string" },
          "tipo": { "type": "string", "enum": ["sencilla", "intermedia", "cabecera", "portal"] },
          "coordenadas": {
            "type": "object",
            "properties": {
              "latitud": { "type": "number" },
              "longitud": { "type": "number" }
            }
          },
          "servicios": {
            "type": "object",
            "properties": {
              "biciparqueadero": { "type": "boolean" },
              "capacidad_biciparqueadero": { "type": "integer" },
              "wifi": { "type": "boolean" },
              "accesos": { "type": "integer" }
            }
          },
          "fuente": { "type": "string" },
          "ultima_actualizacion": { "type": "string", "format": "date-time" }
        }
      },
      "Ruta": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "codigo": { "type": "string" },
          "nombre": { "type": "string" },
          "origen": { "type": "string" },
          "destino": { "type": "string" },
          "tipo_operacion": { "type": "string" },
          "tipo_bus": { "type": "string" },
          "estado": { "type": "string", "enum": ["activa", "suspendida", "programada"] },
          "horarios": {
            "type": "object",
            "properties": {
              "lunes_viernes": { "type": "string" },
              "sabado": { "type": "string" },
              "domingo_festivo": { "type": "string" }
            }
          },
          "longitud_km": { "type": "number" },
          "fuente": { "type": "string" },
          "ultima_actualizacion": { "type": "string", "format": "date-time" }
        }
      },
      "Zona": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "codigo_macroruta": { "type": "string" },
          "localidad": {
            "type": "object",
            "properties": {
              "codigo": { "type": "string" },
              "nombre": { "type": "string" }
            }
          },
          "frecuencia": {
            "type": "object",
            "properties": {
              "codigo": { "type": "string" },
              "dias": { "type": "array", "items": { "type": "string" } },
              "descripcion": { "type": "string" }
            }
          },
          "horario_inicio": { "type": "string" },
          "horario_fin": { "type": "string" },
          "vigencia": { "type": "string" },
          "fuente": { "type": "string" },
          "ultima_actualizacion": { "type": "string", "format": "date-time" }
        }
      },
      "LocalidadResumen": {
        "type": "object",
        "properties": {
          "localidad": { "type": "string" },
          "codigo": { "type": "string" },
          "total_zonas": { "type": "integer" },
          "frecuencias": { "type": "array", "items": { "type": "string" } }
        }
      },
      "Error": {
        "type": "object",
        "properties": {
          "error": { "type": "string" },
          "message": { "type": "string" },
          "available_endpoint": { "type": "string" }
        }
      }
    }
  }
};

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(openapi, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
