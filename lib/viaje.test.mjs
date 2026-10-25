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

// --- Auditoría de rutas (oct-2026). Fechas fijas; aserciones sobre forma y orden, no sobre minutos exactos ---
import { resolverLugar, red, lugaresSugeridos } from './viaje.mjs';

const invariantes = (v) => {
  for (const op of v.opciones) {
    let reloj = min(op.sale);
    for (let i = 0; i < op.tramos.length; i++) {
      const t = op.tramos[i];
      if (t.tipo === 'caminar') {
        assert.ok(op.tramos[i - 1]?.tipo !== 'caminar', `dos caminatas seguidas en ${v.origen.nombre} → ${v.destino.nombre}`);
        reloj += t.min;
      } else {
        assert.ok(min(t.sale) >= reloj - 1, `${t.ruta} sale ${t.sale} antes de llegar a la parada (${reloj})`);
        reloj = min(t.llega);
      }
    }
    const fin = op.tramos.at(-1);
    assert.equal(op.llega, fin.tipo === 'bus' ? fin.llega : op.llega, 'sin egreso a pie, la llegada es la del último bus');
  }
};

test('TransMiCable: desde Portal Tunal se camina al cable (sin ir y volver en alimentador) y el letrero dice Mirador', () => {
  const v = planearViaje({ origen: 'Portal Tunal', destino: 'Mirador del Paraíso', hora: '08:00', fecha: MARTES });
  invariantes(v);
  const op = v.opciones.find((o) => o.recomendada);
  const cable = op.tramos.find((t) => t.tipo === 'bus' && t.sistema_tipo === 'cable');
  assert.ok(cable, 'la recomendada usa el cable');
  assert.equal(op.transbordos, 0);
  assert.notEqual(cable.hacia, cable.sube.parada);
  assert.match(cable.hacia, /Mirador/);
  assert.ok(op.duracion_min < 40);
});

test('nunca bus → caminar → caminar al destino (antes: 27 de 300 viajes al azar)', () => {
  for (const [o, d, h] of [['Calle 127', '705A08_TM', '11:22'], ['Bicentenario', '170A06_TM', '14:29'], ['Portal Tunal', '488A12_TM', '11:46'], ['059A13_TM', '578A03_TM', '09:39']])
    invariantes(planearViaje({ origen: o, destino: d, hora: h, fecha: MARTES }));
});

test('madrugada: a las 00:20 se ven los viajes 24:xx del día anterior (antes esperaba a las 04:00)', () => {
  const v = planearViaje({ origen: 'Portal Américas', destino: 'Hsp. del Sur Britalia', hora: '00:20', fecha: MARTES });
  assert.ok(v.opciones.length);
  assert.ok(min(v.opciones[0].sale) < min('03:00'), `sale ${v.opciones[0].sale}`);
  invariantes(v);
});

test('noche sin servicio: responde la primera salida de mañana con sin_servicio y aviso claro', () => {
  const v = planearViaje({ origen: 'Portal Norte', destino: 'Portal Usme', hora: '23:30', fecha: MARTES });
  assert.ok(v.opciones.length, 'trae opciones del día siguiente');
  assert.equal(v.sin_servicio.reanuda.fecha, '2026-10-28');
  assert.equal(v.sin_servicio.reanuda.dia, 'miércoles');
  assert.ok(v.opciones.every((o) => o.fecha === '2026-10-28'));
  assert.match(v.avisos[0], /ya no hay servicio.*mañana/);
  assert.match(viajeComoTexto(v), /sal el 2026-10-28/);
});

test('madrugada antes del primer bus: avisa a qué hora empieza', () => {
  // Museo del Oro y Calle 72 son troncales del centro/Caracas: no hay buses nocturnos a las 03:00
  const v = planearViaje({ origen: 'Museo del Oro', destino: 'Calle 72', hora: '03:00', fecha: MARTES });
  assert.ok(v.sin_servicio);
  assert.equal(v.sin_servicio.reanuda.fecha, MARTES);
  assert.ok(min(v.sin_servicio.reanuda.hora) >= min('03:30'));
  assert.match(v.avisos[0], /^A las 03:00 aún no hay servicio/);
});

test('transbordos: cambio de vagón ≥ 2 min, misma parada explícita con 0 min', () => {
  const a = planearViaje({ origen: 'Portal Norte', destino: 'Calle 26', hora: '07:30', fecha: MARTES });
  for (const op of a.opciones) for (const t of op.tramos) if (t.misma_estacion) assert.ok(t.min >= 2);
  const b = planearViaje({ origen: '4.6097,-74.0817', destino: 'Br. San Joaquín', hora: '09:00', fecha: MARTES });
  invariantes(b);
  for (const op of b.opciones)
    op.tramos.forEach((t, i) => {
      if (t.tipo === 'bus' && op.tramos[i + 1]?.tipo === 'bus') assert.fail('dos buses seguidos sin tramo de transbordo');
      if (t.misma_parada) assert.equal(t.min, 0);
    });
  assert.match(b.origen.etiqueta, /^Cerca de /);
});

test('campos para la interfaz: recomendada única, nombre_corto, sistema_tipo', () => {
  const v = planearViaje({ origen: 'Portal Norte', destino: 'Portal Sur', hora: '07:00', fecha: MARTES });
  assert.equal(v.opciones.filter((o) => o.recomendada).length, 1);
  assert.equal(v.origen.etiqueta, 'Portal Norte');
  const tipos = new Set(['troncal', 'alimentador', 'dual', 'zonal', 'complementario', 'especial', 'cable', 'otro']);
  for (const op of v.opciones)
    for (const t of op.tramos.filter((x) => x.tipo === 'bus')) {
      assert.ok(tipos.has(t.sistema_tipo), t.sistema_tipo);
      assert.ok(t.sube.nombre_corto && t.baja.nombre_corto && t.hacia_corto);
      assert.ok(!/JFK|Unicervantes/.test(t.hacia_corto + t.sube.nombre_corto + t.baja.nombre_corto));
    }
});

test('resolución de lugares: abreviaturas, alias, códigos y ambigüedad con sugerencias', () => {
  const r = red();
  const n = (q) => resolverLugar(r, q).nombre;
  assert.equal(n('Av. Jiménez'), 'Avenida Jiménez');
  assert.equal(n('AV Rojas'), n('Avenida Rojas'));
  assert.equal(n('Portal de la 80'), 'Portal 80');
  assert.equal(n('Universidades'), 'Universidades CityU'); // estación, no el paradero zonal homónimo
  assert.equal(n('U. Nacional'), 'Universidad Nacional');
  assert.equal(n('Juan Pablo II'), 'Juan Pablo II'); // estación del cable, no "Br. Juan Pablo II"
  assert.equal(n('375A09'), n('375A09_TM'));
  assert.match(n('Calle 26'), /^Calle 26 - Atrio$/);
  const suba = resolverLugar(r, 'Suba');
  assert.equal(suba.nombre, 'Portal Suba');
  assert.ok(suba.sugerencias.some((s) => /Calle 95/.test(s.nombre)));
  assert.equal(resolverLugar(r, 'Ricaurte').sugerencias, undefined);
  const v = planearViaje({ origen: 'Suba', destino: 'Calle 26', hora: '09:00', fecha: MARTES });
  assert.ok(v.sugerencias.origen.length);
  assert.ok(v.avisos.some((a) => /coincide con varios lugares/.test(a)));
});

test('lugaresSugeridos: todos resuelven y empiezan por estaciones', () => {
  const r = red();
  const l = lugaresSugeridos();
  assert.ok(l.length > 150);
  assert.ok(l.includes('Portal Norte') && l.includes('Calle 26'));
  for (const x of l) assert.doesNotThrow(() => resolverLugar(r, x), x);
});
