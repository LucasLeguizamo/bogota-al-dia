import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planearViaje, paradasCercanas, recorridoRuta, cobertura, viajeComoTexto } from './viaje.mjs';
import { renderViaje } from './viaje-ui.mjs';
import { handleMcp } from './bogota.mjs';

const MARTES = '2026-10-27';
const min = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

test('viaje troncal: opciones Pareto (más buses ⇒ llega antes) y horas coherentes', () => {
  const v = planearViaje({ origen: 'Portal Norte', destino: 'Calle 26', hora: '07:30', fecha: MARTES });
  assert.equal(v.dia, 'martes');
  assert.ok(v.opciones.length >= 1);
  for (let i = 1; i < v.opciones.length; i++) {
    assert.ok(v.opciones[i].transbordos > v.opciones[i - 1].transbordos);
    assert.ok(min(v.opciones[i].llega) < min(v.opciones[i - 1].llega));
  }
  for (const op of v.opciones) {
    assert.ok(min(op.sale) >= min('07:30'));
    const buses = op.tramos.filter((t) => t.tipo === 'bus');
    assert.equal(buses.length, op.transbordos + 1);
    let reloj = min(op.sale);
    for (const b of buses) {
      assert.ok(min(b.sale) >= reloj, `${b.ruta} sale antes de llegar a la parada`);
      assert.ok(min(b.llega) >= min(b.sale));
      reloj = min(b.llega);
    }
  }
  assert.match(v.opciones[0].tramos.at(-1).baja?.parada ?? v.destino.nombre, /Calle 26/);
});

test('festivo: el 2 de noviembre de 2026 usa el servicio dominical', () =>
  assert.equal(planearViaje({ origen: 'Portal Suba', destino: 'Universidades', hora: '10:00', fecha: '2026-11-02' }).dia, 'festivo'));

test('acepta coordenadas y paradas zonales por barrio', () => {
  const v = planearViaje({ origen: '4.6097,-74.0817', destino: 'Br. San Joaquín', hora: '09:00', fecha: MARTES });
  assert.ok(v.opciones.length >= 1);
  assert.equal(v.origen.lat, 4.6097);
});

test('lugar desconocido da error claro', () => assert.throws(() => planearViaje({ origen: 'zzzz no existe', destino: 'Calle 26' }), /No encontré/));

test('paradas cercanas y recorrido de ruta', () => {
  const [p] = paradasCercanas({ lat: 4.6584, lon: -74.0621, limit: 1 });
  assert.match(p.parada, /Calle 72/);
  assert.ok(p.rutas.length > 0);
  const [b23] = recorridoRuta({ ruta: 'B23' });
  assert.ok(b23.paradas.length > 5);
  assert.equal(b23.paradas[0].min, 0);
});

test('cobertura: Bogotá disponible, Medellín pendiente por licencia', () => {
  const c = cobertura();
  assert.equal(c.find((x) => x.municipio === '11001').disponible, true);
  assert.equal(c.find((x) => x.municipio === '05001').disponible, false);
});

test('texto y HTML escapan y muestran vagón', () => {
  const v = planearViaje({ origen: 'Portal Norte', destino: 'Calle 26', hora: '07:30', fecha: MARTES });
  assert.match(viajeComoTexto(v), /vagón [A-Z]/);
  const html = renderViaje({ ...v, origen: { nombre: '<script>' } });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /Vagón/);
});

test('MCP: planear_viaje trae structuredContent, texto y vista ui://', () => {
  const { result } = handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'planear_viaje', arguments: { origen: 'Portal Usme', destino: 'Calle 72', hora: '18:00', fecha: MARTES } } });
  assert.ok(!result.isError);
  assert.ok(result.structuredContent.opciones.length >= 1);
  assert.match(result.content[0].text, /Portal Usme/);
  const tool = handleMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.find((t) => t.name === 'planear_viaje');
  const uri = tool._meta.ui.resourceUri;
  const [c] = handleMcp({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri } }).result.contents;
  assert.equal(c.mimeType, 'text/html;profile=mcp-app');
  assert.match(c.text, /ui\/initialize/);
  assert.equal(handleMcp({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ui://nope' } }).error.code, -32002);
});
