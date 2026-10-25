// Compatibilidad MCP con el SDK oficial (@modelcontextprotocol/sdk).
// Prueba stdio (bin/bogota.mjs mcp) y Streamable HTTP (api/mcp.ts servido localmente)
// contra cada versión de protocolo. Uso: pnpm test:mcp  (corre con tsx para importar api/mcp.ts)
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import handler from '../api/mcp.ts';
import { TOOLS } from '../lib/bogota.mjs';

const BIN = fileURLToPath(new URL('../bin/bogota.mjs', import.meta.url));
const VERSIONS = [...new Set(['2024-11-05', '2025-03-26', '2025-06-18', LATEST_PROTOCOL_VERSION, '2099-01-01'])];
let fails = 0;
setTimeout(() => { console.log('timeout: el servidor no respondió'); process.exit(1); }, 60_000).unref();
const check = (cond, label) => { if (!cond) { fails++; console.log('  FAIL', label); } };

// node:http → firma de Vercel (req.body parseado, res.status().json()).
const server = createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  let body;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
  Object.assign(req, { body });
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (o) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
  await handler(req, res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_HTTP = new URL(`http://127.0.0.1:${server.address().port}/api/mcp`);

// Reescribe la versión pedida en initialize y captura la que contesta el servidor.
class Wrap {
  constructor(inner, version) { Object.assign(this, { inner, version, negotiated: undefined }); }
  set onmessage(fn) { this.inner.onmessage = (m, e) => { if (m.result?.protocolVersion) this.negotiated = m.result.protocolVersion; fn(m, e); }; }
  set onclose(fn) { this.inner.onclose = fn; }
  set onerror(fn) { this.inner.onerror = fn; }
  get sessionId() { return this.inner.sessionId; }
  setProtocolVersion(v) { this.inner.setProtocolVersion?.(v); }
  start() { return this.inner.start(); }
  close() { return this.inner.close(); }
  send(m, o) { return this.inner.send(m.method === 'initialize' ? { ...m, params: { ...m.params, protocolVersion: this.version } } : m, o); }
}

const transports = {
  stdio: () => new StdioClientTransport({ command: process.execPath, args: [BIN, 'mcp'] }),
  http: () => new StreamableHTTPClientTransport(URL_HTTP),
};
const call = async (c, name, args) => {
  const r = await c.callTool({ name, arguments: args });
  return r.isError ? r : JSON.parse(r.content[0].text);
};

const rows = [];
for (const [kind, mk] of Object.entries(transports)) {
  for (const v of VERSIONS) {
    const t = new Wrap(mk(), v);
    const c = new Client({ name: 'mcp-compat', version: '0' });
    const before = fails;
    try {
      await c.connect(t);
      const expected = v === '2099-01-01' ? LATEST_PROTOCOL_VERSION : v;
      check(t.negotiated === expected, `${kind} ${v}: negoció ${t.negotiated}`);
      await c.ping();
      const { tools } = await c.listTools();
      check(tools.length === TOOLS.length && tools.every((x) => x.inputSchema?.type === 'object'), `${kind} ${v}: tools/list`);
      check((await call(c, 'estaciones_transmilenio', { query: 'portal', limit: 3 })).estaciones.length === 3, 'estaciones query+limit');
      check((await call(c, 'rutas_transmilenio', { codigo: 'B23' })).total === 1, 'ruta B23');
      check((await call(c, 'recoleccion_por_zona', { codigo: 11 })).total_zonas > 0, 'recolección código numérico');
      check(!(await call(c, 'localidades_recoleccion', {})).isError, 'localidades');
      check((await call(c, 'resumen_datos')).length === 3, 'resumen sin arguments');
      check((await call(c, 'estaciones_transmilenio', { codigo: 3003 })).total === 1, 'estación código numérico');
      check((await call(c, 'estaciones_transmilenio', { query: 'zzzz' })).total === 0, 'sin coincidencias');
      const a = await call(c, 'estaciones_transmilenio', { query: 'Ángeles' });
      check(a.total > 0 && a.total === (await call(c, 'estaciones_transmilenio', { query: 'angeles' })).total, 'tildes');
      const trip = await c.callTool({ name: 'plan_trip', arguments: { origin: 'Portal Norte', destination: 'Calle 26', time: '07:30', date: '2026-10-27' } });
      check(!trip.isError && trip.structuredContent?.options?.length > 0, 'plan_trip structuredContent');
      const uri = tools.find((x) => x.name === 'plan_trip')?._meta?.ui?.resourceUri;
      const view = await c.readResource({ uri });
      check(view.contents[0]?.mimeType === 'text/html;profile=mcp-app', 'MCP App view (resources/read)');
      const unknown = await c.callTool({ name: 'no_existe', arguments: {} }).catch((e) => e);
      check(unknown?.code === -32602, 'herramienta desconocida → -32602');
      await new Promise((r) => setTimeout(r, 200)); // deja correr el GET SSE opcional (HTTP)
    } catch (e) {
      fails++;
      console.log(`  EXC ${kind} ${v}: ${e.message}`);
    } finally {
      await c.close().catch(() => {});
    }
    rows.push({ transport: kind, pide: v, negociada: t.negotiated, resultado: fails === before ? 'OK' : 'FALLA' });
  }
}

// GET con Accept SSE debe ser 405 (si no, el SDK reabre el stream en bucle).
const get = await fetch(URL_HTTP, { headers: { accept: 'text/event-stream' } });
check(get.status === 405, `GET SSE → ${get.status}`);
const bad = await fetch(URL_HTTP, { method: 'POST', headers: { 'content-type': 'application/json', 'mcp-protocol-version': '1999-01-01' }, body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' });
check(bad.status === 400, `MCP-Protocol-Version no soportada → ${bad.status}`);

server.close();
console.table(rows);
console.log(fails ? `${fails} fallos` : 'compatibilidad MCP OK');
process.exit(fails ? 1 : 0);
