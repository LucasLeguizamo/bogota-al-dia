import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estaciones, rutas, recoleccion, handleMcp, TOOLS } from './bogota.mjs';

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
