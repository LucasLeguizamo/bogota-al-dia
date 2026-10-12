// Núcleo compartido: datos + consultas + MCP JSON-RPC.
// Lo usan api/mcp.ts (HTTP en Vercel), bin/bogota.mjs (CLI y MCP stdio) y el plugin de Claude Code.
// Cero dependencias a propósito: el plugin corre con `node` sin instalar nada.
import { readFileSync } from 'node:fs';

const cache = {};
export function load(file) {
  return (cache[file] ??= JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf-8')));
}

// "angeles" encuentra "Ángeles"
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const has = (q, ...fields) => fields.some((f) => norm(f).includes(q));
// "3003" (o el número 3003) encuentra "03003"; "01" encuentra la localidad "1"
const sameCode = (a, b) => String(a).trim().replace(/^0+(?=\d)/, '') === String(b).trim().replace(/^0+(?=\d)/, '');

export function estaciones({ query, troncal, codigo, limit = 10 } = {}) {
  let r = load('transmilenio/estaciones.json').estaciones;
  if (codigo != null && codigo !== '') r = r.filter((e) => sameCode(e.codigo, codigo));
  if (troncal) r = r.filter((e) => has(norm(troncal), e.troncal));
  if (query) r = r.filter((e) => has(norm(query), e.nombre, e.codigo, e.troncal, e.ubicacion));
  return { total: r.length, estaciones: r.slice(0, limit) };
}

export function rutas({ codigo, query, limit = 10 } = {}) {
  let r = load('transmilenio/rutas.json').rutas;
  if (codigo) r = r.filter((x) => norm(x.codigo) === norm(codigo) || norm(x.nombre) === norm(codigo));
  if (query) r = r.filter((x) => has(norm(query), x.codigo, x.nombre, x.origen, x.destino));
  return { total: r.length, rutas: r.slice(0, limit) };
}

export function recoleccion({ localidad, codigo } = {}) {
  let r = load('recoleccion/zonas.json').zonas;
  if (codigo != null && codigo !== '') r = r.filter((z) => z.localidad?.codigo != null && sameCode(z.localidad.codigo, codigo));
  if (localidad) r = r.filter((z) => has(norm(localidad), z.localidad?.nombre));
  return { total_zonas: r.length, zonas: r };
}

export function localidades() {
  return load('recoleccion/localidades.json');
}

export function resumen() {
  const meta = (f, k) => {
    const { generado, fuente, licencia, total } = load(f);
    return { dataset: k, total, generado, fuente, licencia };
  };
  return [
    meta('transmilenio/estaciones.json', 'estaciones'),
    meta('transmilenio/rutas.json', 'rutas'),
    meta('recoleccion/zonas.json', 'zonas_recoleccion'),
  ];
}

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });

export const TOOLS = [
  {
    name: 'estaciones_transmilenio',
    description: 'Lista o busca estaciones troncales de TransMilenio (nombre, código, troncal, ubicación). Incluye coordenadas y servicios.',
    inputSchema: { type: 'object', properties: { query: str('Texto libre: nombre, código, troncal o dirección'), troncal: str('Filtra por troncal (ej: Suba, Caracas)'), codigo: str('Código exacto (ej: 03003)'), limit: num('Máximo de resultados (default 10)') } },
    run: estaciones,
  },
  {
    name: 'rutas_transmilenio',
    description: 'Lista o busca rutas troncales de TransMilenio por código, nombre, origen o destino. Incluye horarios.',
    inputSchema: { type: 'object', properties: { codigo: str('Código o nombre exacto (ej: B23, 1-1)'), query: str('Texto libre en código, nombre, origen o destino'), limit: num('Máximo de resultados (default 10)') } },
    run: rutas,
  },
  {
    name: 'recoleccion_por_zona',
    description: 'Horarios y frecuencias de recolección de basura por localidad de Bogotá.',
    inputSchema: { type: 'object', properties: { localidad: str('Nombre de localidad (ej: Suba, Kennedy)'), codigo: str('Código de localidad (1-20)') } },
    run: recoleccion,
  },
  {
    name: 'localidades_recoleccion',
    description: 'Lista las localidades con datos de recolección, su código, número de zonas y frecuencias.',
    inputSchema: { type: 'object', properties: {} },
    run: localidades,
  },
  {
    name: 'resumen_datos',
    description: 'Metadatos de los datasets: totales, fecha de generación, fuente oficial y licencia.',
    inputSchema: { type: 'object', properties: {} },
    run: resumen,
  },
];

export const VERSION = '1.1.0';
// Versiones del protocolo MCP que este servidor habla (la primera es la preferida).
// Solo expone tools sin sesión ni notificaciones del servidor, así que todas son compatibles.
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

// Definiciones públicas (sin `run`), para tools/list y los manifiestos del sitio.
export const toolDefs = () => TOOLS.map(({ run, ...t }) => t);

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

// JSON-RPC MCP. Devuelve null cuando no hay nada que responder
// (notificaciones y respuestas del cliente).
export function handleMcp(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) return rpcError(null, -32600, 'Invalid Request');
  if (typeof req.method !== 'string') {
    // Respuesta del cliente a algo que nunca pedimos: se ignora.
    if (req.id !== undefined && ('result' in req || 'error' in req)) return null;
    return rpcError(req.id ?? null, -32600, 'Invalid Request');
  }
  if (req.id === undefined) return null; // notificación
  if (req.id === null) return rpcError(null, -32600, 'Invalid Request: id no puede ser null');
  const ok = (result) => ({ jsonrpc: '2.0', id: req.id, result });
  const fail = (code, message) => rpcError(req.id, code, message);
  switch (req.method) {
    case 'initialize': {
      // Si el cliente pide una versión que soportamos, la usamos; si no, proponemos la más reciente.
      const asked = req.params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        serverInfo: { name: 'bogota-al-dia', version: VERSION },
        capabilities: { tools: {} },
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: toolDefs() });
    case 'tools/call': {
      const name = req.params?.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return fail(-32602, `Herramienta desconocida: ${name}`);
      const args = req.params.arguments;
      try {
        const result = tool.run(args && typeof args === 'object' && !Array.isArray(args) ? args : {});
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${req.method}`);
  }
}

// Procesa un mensaje o lote ya parseado. null = no hay respuesta que enviar.
export function handleMcpMessage(msg) {
  if (!Array.isArray(msg)) return handleMcp(msg);
  if (!msg.length) return rpcError(null, -32600, 'Invalid Request');
  const out = msg.map(handleMcp).filter(Boolean);
  return out.length ? out : null;
}
