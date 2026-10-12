import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

function loadData(file: string): unknown {
  try {
    const path = join(process.cwd(), 'data', file);
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const TOOLS = [
  {
    name: 'estaciones_transmilenio',
    description: 'Lista o busca estaciones de TransMilenio por nombre, código o troncal',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Búsqueda por nombre, código o troncal (opcional)' },
        limit: { type: 'number', description: 'Número máximo de resultados (default: 10)' }
      }
    }
  },
  {
    name: 'rutas_transmilenio',
    description: 'Lista o busca rutas de TransMilenio por código, origen o destino',
    inputSchema: {
      type: 'object',
      properties: {
        codigo: { type: 'string', description: 'Código de ruta (ej: B23)' },
        limit: { type: 'number', description: 'Número máximo de resultados (default: 10)' }
      }
    }
  },
  {
    name: 'recoleccion_por_zona',
    description: 'Consulta horarios de recolección de basura por localidad',
    inputSchema: {
      type: 'object',
      properties: {
        localidad: { type: 'string', description: 'Nombre de localidad (ej: Suba, Kennedy)' },
        codigo: { type: 'string', description: 'Código de localidad (1-20)' }
      }
    }
  }
];

function handleInitialize(): MCPResponse['result'] {
  return {
    protocolVersion: '2024-11-05',
    serverInfo: {
      name: 'bogota-al-dia',
      version: '1.0.0'
    },
    capabilities: {
      tools: {}
    }
  };
}

function handleListTools(): MCPResponse['result'] {
  return { tools: TOOLS };
}

function handleCallTool(params: { name: string; arguments?: Record<string, unknown> }): MCPResponse['result'] {
  const args = params.arguments || {};

  switch (params.name) {
    case 'estaciones_transmilenio': {
      const data = loadData('transmilenio/estaciones.json') as { estaciones: Array<Record<string, unknown>> } | null;
      if (!data) return { content: [{ type: 'text', text: 'Error: datos no disponibles' }] };

      let results = data.estaciones;
      const query = (args.query as string)?.toLowerCase();
      
      if (query) {
        results = results.filter((e: Record<string, unknown>) =>
          (e.nombre as string)?.toLowerCase().includes(query) ||
          (e.codigo as string)?.toLowerCase().includes(query) ||
          (e.troncal as string)?.toLowerCase().includes(query)
        );
      }
      
      const limit = (args.limit as number) || 10;
      results = results.slice(0, limit);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ total: results.length, estaciones: results }, null, 2)
        }]
      };
    }

    case 'rutas_transmilenio': {
      const data = loadData('transmilenio/rutas.json') as { rutas: Array<Record<string, unknown>> } | null;
      if (!data) return { content: [{ type: 'text', text: 'Error: datos no disponibles' }] };

      let results = data.rutas;
      const codigo = (args.codigo as string)?.toUpperCase();
      
      if (codigo) {
        results = results.filter((r: Record<string, unknown>) =>
          (r.codigo as string)?.toUpperCase() === codigo
        );
      }
      
      const limit = (args.limit as number) || 10;
      results = results.slice(0, limit);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ total: results.length, rutas: results }, null, 2)
        }]
      };
    }

    case 'recoleccion_por_zona': {
      const data = loadData('recoleccion/zonas.json') as { zonas: Array<Record<string, unknown>> } | null;
      const localidadesData = loadData('recoleccion/localidades.json') as { localidades: Array<Record<string, unknown>> } | null;
      
      if (!data) return { content: [{ type: 'text', text: 'Error: datos no disponibles' }] };

      const localidadNombre = (args.localidad as string)?.toLowerCase();
      const localidadCodigo = args.codigo as string;
      
      let results = data.zonas;
      
      if (localidadNombre) {
        results = results.filter((z: Record<string, unknown>) => {
          const loc = z.localidad as { nombre?: string };
          return loc?.nombre?.toLowerCase().includes(localidadNombre);
        });
      } else if (localidadCodigo) {
        results = results.filter((z: Record<string, unknown>) => {
          const loc = z.localidad as { codigo?: string };
          return loc?.codigo === localidadCodigo;
        });
      }
      
      const localidades = localidadesData?.localidades || [];
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total_zonas: results.length,
            localidades_disponibles: localidades.map((l: Record<string, unknown>) => l.localidad),
            zonas: results
          }, null, 2)
        }]
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Error: herramienta '${params.name}' no encontrada` }],
        isError: true
      };
  }
}

function processRequest(req: MCPRequest): MCPResponse {
  const response: MCPResponse = { jsonrpc: '2.0', id: req.id };

  try {
    switch (req.method) {
      case 'initialize':
        response.result = handleInitialize();
        break;
      case 'tools/list':
        response.result = handleListTools();
        break;
      case 'tools/call':
        response.result = handleCallTool(req.params as { name: string; arguments?: Record<string, unknown> });
        break;
      case 'notifications/initialized':
        response.result = {};
        break;
      default:
        response.error = { code: -32601, message: `Method not found: ${req.method}` };
    }
  } catch (error) {
    response.error = { code: -32603, message: String(error) };
  }

  return response;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'bogota-al-dia',
      version: '1.0.0',
      description: 'MCP server para datos públicos de Bogotá',
      protocol: 'JSON-RPC over HTTP',
      tools: TOOLS.map(t => t.name),
      usage: 'POST JSON-RPC requests to this endpoint'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as MCPRequest | MCPRequest[];
    
    if (Array.isArray(body)) {
      const responses = body.map(processRequest);
      return res.status(200).json(responses);
    }
    
    const response = processRequest(body);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' }
    });
  }
}
