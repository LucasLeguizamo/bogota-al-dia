import type { APIRoute } from 'astro';

const openapi = {
  "openapi": "3.1.0",
  "info": {
    "title": "Bogotá al Día API",
    "description": "API pública con datos de servicios públicos de Bogotá: TransMilenio y recolección de residuos.",
    "version": "1.0.0",
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
    }
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
