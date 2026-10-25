import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { estaciones, rutas, recoleccion, handleMcp, handleMcpMessage, PROTOCOL_VERSIONS, TOOLS } from './bogota.mjs';

test('búsqueda sin tildes', () => assert.equal(estaciones({ query: 'angeles' }).estaciones[0].codigo, '03003'));
test('ruta por código', () => assert.equal(rutas({ codigo: 'b23' }).total, 1));
test('recolección por nombre y código coinciden', () =>
  assert.equal(recoleccion({ localidad: 'suba' }).total_zonas, recoleccion({ codigo: '11' }).total_zonas));
test('MCP: notificación sin respuesta, tools/list sin run', () => {
  assert.equal(handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const { result } = handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(result.tools.length, TOOLS.length);
  assert.ok(!('run' in result.tools[0]));
});

// --- Compatibilidad de protocolo MCP (ver scripts/mcp-compat.mjs para la prueba con el SDK oficial) ---
const init = (protocolVersion) =>
  handleMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 't', version: '0' } } }).result;

test('MCP: negocia cada versión soportada y propone la última si no la conoce', () => {
  for (const v of ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']) assert.equal(init(v).protocolVersion, v);
  assert.equal(init('2099-01-01').protocolVersion, PROTOCOL_VERSIONS[0]);
  assert.equal(init(undefined).protocolVersion, PROTOCOL_VERSIONS[0]);
  assert.deepEqual(init('2025-06-18').capabilities, { tools: {}, resources: {} });
});

test('MCP: herramienta desconocida es error JSON-RPC -32602; método desconocido -32601', () => {
  assert.equal(handleMcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nope' } }).error.code, -32602);
  assert.equal(handleMcp({ jsonrpc: '2.0', id: 3, method: 'prompts/list' }).error.code, -32601);
});

test('MCP: tools/call tolera arguments ausente, null o no-objeto', () => {
  for (const args of [undefined, null, 'x', [1]]) {
    const r = handleMcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'estaciones_transmilenio', arguments: args } }).result;
    assert.ok(!r.isError);
    assert.equal(JSON.parse(r.content[0].text).estaciones.length, 10);
  }
});

test('códigos numéricos: 3003 → "03003", 11 → localidad "11"', () => {
  assert.equal(estaciones({ codigo: 3003 }).estaciones[0]?.codigo, '03003');
  assert.equal(recoleccion({ codigo: 11 }).total_zonas, recoleccion({ codigo: '11' }).total_zonas);
});

test('MCP: respuestas del cliente se ignoran; lote vacío e id null son Invalid Request', () => {
  assert.equal(handleMcp({ jsonrpc: '2.0', id: 9, result: {} }), null);
  assert.equal(handleMcpMessage([]).error.code, -32600);
  assert.equal(handleMcp({ jsonrpc: '2.0', id: null, method: 'ping' }).error.code, -32600);
  assert.equal(handleMcpMessage([{ jsonrpc: '2.0', method: 'notifications/initialized' }]), null);
  assert.deepEqual(handleMcpMessage([{ jsonrpc: '2.0', id: 1, method: 'ping' }, 7]).map((r) => r.error?.code ?? 'ok'), ['ok', -32600]);
});

test('MCP stdio: handshake completo por bin/bogota.mjs mcp', async () => {
  const bin = new URL('../bin/bogota.mjs', import.meta.url).pathname;
  const p = spawn(process.execPath, [bin, 'mcp'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = [];
  let buf = '';
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); }
  });
  const send = (m) => p.stdin.write((typeof m === 'string' ? m : JSON.stringify(m)) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'recoleccion_por_zona', arguments: { localidad: 'suba' } } });
  send('{roto');
  p.stdin.end();
  await new Promise((r) => p.on('close', r));
  assert.deepEqual(lines.map((l) => l.id), [1, 2, 3, null]); // la notificación no produce línea
  assert.equal(lines[0].result.protocolVersion, '2025-06-18');
  assert.equal(lines[1].result.tools.length, TOOLS.length);
  assert.ok(JSON.parse(lines[2].result.content[0].text).total_zonas > 0);
  assert.equal(lines[3].error.code, -32700);
});
