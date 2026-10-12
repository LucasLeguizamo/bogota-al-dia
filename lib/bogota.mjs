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

export function estaciones({ query, troncal, codigo, limit = 10 } = {}) {
  let r = load('transmilenio/estaciones.json').estaciones;
  if (codigo) r = r.filter((e) => e.codigo === String(codigo));
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
  if (codigo) r = r.filter((z) => z.localidad?.codigo === String(codigo));
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

// JSON-RPC MCP. Devuelve null para notificaciones (sin respuesta).
export function handleMcp(req) {
  if (req.id === undefined) return null;
  const ok = (result) => ({ jsonrpc: '2.0', id: req.id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id: req.id, error: { code, message } });
  switch (req.method) {
    case 'initialize':
      return ok({
        protocolVersion: req.params?.protocolVersion ?? '2024-11-05',
        serverInfo: { name: 'bogota-al-dia', version: '1.1.0' },
        capabilities: { tools: {} },
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === req.params?.name);
      if (!tool) return ok({ content: [{ type: 'text', text: `Herramienta desconocida: ${req.params?.name}` }], isError: true });
      try {
        return ok({ content: [{ type: 'text', text: JSON.stringify(tool.run(req.params.arguments ?? {}), null, 2) }] });
      } catch (e) {
        return ok({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${req.method}`);
  }
}
