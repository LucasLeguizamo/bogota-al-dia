import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTrip, nearbyStops, routeStops, coverage, tripAsText, resolvePlace, network, suggestedPlaces } from './trip.mjs';
import { renderTrip } from './trip-ui.mjs';
import { handleMcp } from './bogota.mjs';

const TUESDAY = '2026-10-27';
const min = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

test('trunk trip: Pareto options (more buses ⇒ arrives earlier) and consistent times', () => {
  const v = planTrip({ origin: 'Portal Norte', destination: 'Calle 26', time: '07:30', date: TUESDAY });
  assert.equal(v.weekday, 'tuesday');
  assert.equal(v.holiday, false);
  assert.ok(v.options.length >= 1);
  for (let i = 1; i < v.options.length; i++) {
    assert.ok(v.options[i].transfers > v.options[i - 1].transfers);
    assert.ok(min(v.options[i].arrives) < min(v.options[i - 1].arrives));
  }
  for (const op of v.options) {
    assert.ok(min(op.departs) >= min('07:30'));
    const rides = op.legs.filter((t) => t.type === 'ride');
    assert.equal(rides.length, op.transfers + 1);
    let clock = min(op.departs);
    for (const b of rides) {
      assert.ok(min(b.departs) >= clock, `${b.route} departs before reaching the stop`);
      assert.ok(min(b.arrives) >= min(b.departs));
      clock = min(b.arrives);
    }
  }
  assert.match(v.options[0].legs.at(-1).alight?.stop ?? v.destination.name, /Calle 26/);
});

test('holiday: 2 November 2026 uses the Sunday service', () => {
  const v = planTrip({ origin: 'Portal Suba', destination: 'Universidades', time: '10:00', date: '2026-11-02' });
  assert.equal(v.holiday, true);
  assert.equal(v.weekday, 'monday');
  assert.match(tripAsText(v), /festivo/);
});

test('accepts coordinates and zonal stops by neighborhood', () => {
  const v = planTrip({ origin: '4.6097,-74.0817', destination: 'Br. San Joaquín', time: '09:00', date: TUESDAY });
  assert.ok(v.options.length >= 1);
  assert.equal(v.origin.lat, 4.6097);
});

test('unknown place gives a clear error', () => assert.throws(() => planTrip({ origin: 'zzzz no existe', destination: 'Calle 26' }), /No encontré/));

test('nearby stops and route stops', () => {
  const [p] = nearbyStops({ lat: 4.6584, lon: -74.0621, limit: 1 });
  assert.match(p.stop, /Calle 72/);
  assert.ok(p.routes.length > 0);
  assert.ok(p.distance_m >= 0 && p.walk_min >= 1);
  const [b23] = routeStops({ route: 'B23' });
  assert.ok(b23.stops.length > 5);
  assert.equal(b23.stops[0].min, 0);
  assert.equal(b23.system, 'trunk');
});

test('coverage: Bogotá available, Medellín pending a license', () => {
  const c = coverage();
  assert.equal(c.find((x) => x.municipality === '11001').available, true);
  assert.equal(c.find((x) => x.municipality === '05001').available, false);
});

test('text and HTML escape input and show the car (vagón)', () => {
  const v = planTrip({ origin: 'Portal Norte', destination: 'Calle 26', time: '07:30', date: TUESDAY });
  const text = tripAsText(v);
  assert.match(text, /vagón [A-Z]/);
  assert.match(text, /Más rápida|Menos transbordos|Recomendada/);
  const html = renderTrip({ ...v, origin: { name: '<script>' } });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /Vagón/);
  assert.match(html, /martes/);
});

test('MCP: plan_trip returns structuredContent, text and a ui:// view', () => {
  const { result } = handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'plan_trip', arguments: { origin: 'Portal Usme', destination: 'Calle 72', time: '18:00', date: TUESDAY } } });
  assert.ok(!result.isError);
  assert.ok(result.structuredContent.options.length >= 1);
  assert.match(result.content[0].text, /Portal Usme/);
  const tool = handleMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.find((t) => t.name === 'plan_trip');
  assert.equal(tool.text, undefined, 'tools/list does not leak the text hook');
  const uri = tool._meta.ui.resourceUri;
  assert.equal(uri, 'ui://bogota-al-dia/trip.html');
  const [c] = handleMcp({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri } }).result.contents;
  assert.equal(c.mimeType, 'text/html;profile=mcp-app');
  assert.match(c.text, /ui\/initialize/);
  assert.equal(handleMcp({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ui://nope' } }).error.code, -32002);
});

// --- Route audit (Oct 2026). Fixed dates; assertions on shape and order, not exact minutes ---
const invariants = (v) => {
  for (const op of v.options) {
    let clock = min(op.departs);
    for (let i = 0; i < op.legs.length; i++) {
      const t = op.legs[i];
      if (t.type === 'walk') {
        assert.ok(op.legs[i - 1]?.type !== 'walk', `two walks in a row in ${v.origin.name} → ${v.destination.name}`);
        clock += t.min;
      } else {
        assert.ok(min(t.departs) >= clock - 1, `${t.route} departs ${t.departs} before reaching the stop (${clock})`);
        clock = min(t.arrives);
      }
    }
    const last = op.legs.at(-1);
    assert.equal(op.arrives, last.type === 'ride' ? last.arrives : op.arrives, 'without a walking egress, arrival is the last bus arrival');
  }
};

test('TransMiCable: from Portal Tunal you walk to the cable (no feeder back-and-forth) and the headsign says Mirador', () => {
  const v = planTrip({ origin: 'Portal Tunal', destination: 'Mirador del Paraíso', time: '08:00', date: TUESDAY });
  invariants(v);
  const op = v.options.find((o) => o.recommended);
  const cable = op.legs.find((t) => t.type === 'ride' && t.system === 'cable');
  assert.ok(cable, 'the recommended option uses the cable');
  assert.equal(op.transfers, 0);
  assert.notEqual(cable.headsign, cable.board.stop);
  assert.match(cable.headsign, /Mirador/);
  assert.ok(op.duration_min < 40);
});

test('never bus → walk → walk to the destination (before: 27 of 300 random trips)', () => {
  for (const [o, d, h] of [['Calle 127', '705A08_TM', '11:22'], ['Bicentenario', '170A06_TM', '14:29'], ['Portal Tunal', '488A12_TM', '11:46'], ['059A13_TM', '578A03_TM', '09:39']])
    invariants(planTrip({ origin: o, destination: d, time: h, date: TUESDAY }));
});

test("early morning: at 00:20 the previous day's 24:xx trips are visible (before: waited until 04:00)", () => {
  const v = planTrip({ origin: 'Portal Américas', destination: 'Hsp. del Sur Britalia', time: '00:20', date: TUESDAY });
  assert.ok(v.options.length);
  assert.ok(min(v.options[0].departs) < min('03:00'), `departs ${v.options[0].departs}`);
  invariants(v);
});

test("night without service: returns tomorrow's first departure with no_service and a clear notice", () => {
  const v = planTrip({ origin: 'Portal Norte', destination: 'Portal Usme', time: '23:30', date: TUESDAY });
  assert.ok(v.options.length, "includes next day's options");
  assert.equal(v.no_service.resumes.date, '2026-10-28');
  assert.equal(v.no_service.resumes.weekday, 'wednesday');
  assert.ok(v.options.every((o) => o.date === '2026-10-28'));
  assert.match(v.notices[0], /No hay salidas.*próxima es el miércoles/);
  assert.match(tripAsText(v), /sal el 2026-10-28/);
});

test('early morning before the first bus: tells when service starts', () => {
  // Museo del Oro and Calle 72 are downtown/Caracas trunk stations: no night buses at 03:00
  const v = planTrip({ origin: 'Museo del Oro', destination: 'Calle 72', time: '03:00', date: TUESDAY });
  assert.ok(v.no_service);
  assert.equal(v.no_service.resumes.date, TUESDAY);
  assert.ok(min(v.no_service.resumes.time) >= min('03:30'));
  assert.match(v.notices[0], /^A las 03:00 aún no hay servicio/);
});

test('transfers: platform change ≥ 2 min, explicit same-stop leg with 0 min', () => {
  const a = planTrip({ origin: 'Portal Norte', destination: 'Calle 26', time: '07:30', date: TUESDAY });
  for (const op of a.options) for (const t of op.legs) if (t.same_station) assert.ok(t.min >= 2);
  const b = planTrip({ origin: '4.6097,-74.0817', destination: 'Br. San Joaquín', time: '09:00', date: TUESDAY });
  invariants(b);
  for (const op of b.options)
    op.legs.forEach((t, i) => {
      if (t.type === 'ride' && op.legs[i + 1]?.type === 'ride') assert.fail('two rides in a row without a transfer leg');
      if (t.same_stop) assert.equal(t.min, 0);
    });
  assert.match(b.origin.label, /^Cerca de /);
});

test('UI fields: single recommended option, short_name, system, English labels', () => {
  const v = planTrip({ origin: 'Portal Norte', destination: 'Portal Sur', time: '07:00', date: TUESDAY });
  assert.equal(v.options.filter((o) => o.recommended).length, 1);
  assert.equal(v.origin.label, 'Portal Norte');
  const labels = new Set(['fastest', 'fewest_transfers', 'balanced', 'recommended']);
  const systems = new Set(['trunk', 'feeder', 'dual', 'zonal', 'complementary', 'special', 'cable', 'other']);
  for (const op of v.options) {
    assert.ok(labels.has(op.label), op.label);
    for (const t of op.legs.filter((x) => x.type === 'ride')) {
      assert.ok(systems.has(t.system), t.system);
      assert.ok(t.board.short_name && t.alight.short_name && t.headsign_short);
      assert.ok(!/JFK|Unicervantes/.test(t.headsign_short + t.board.short_name + t.alight.short_name));
    }
  }
});

test('place resolution: abbreviations, aliases, codes and ambiguity with suggestions', () => {
  const r = network();
  const n = (q) => resolvePlace(r, q).name;
  assert.equal(n('Av. Jiménez'), 'Avenida Jiménez');
  assert.equal(n('AV Rojas'), n('Avenida Rojas'));
  assert.equal(n('Portal de la 80'), 'Portal 80');
  assert.equal(n('Universidades'), 'Universidades CityU'); // the station, not the homonymous zonal stop
  assert.equal(n('U. Nacional'), 'Universidad Nacional');
  assert.equal(n('Juan Pablo II'), 'Juan Pablo II'); // cable station, not "Br. Juan Pablo II"
  assert.equal(n('375A09'), n('375A09_TM'));
  assert.match(n('Calle 26'), /^Calle 26 - Atrio$/);
  const suba = resolvePlace(r, 'Suba');
  assert.equal(suba.name, 'Portal Suba');
  assert.ok(suba.suggestions.some((s) => /Calle 95/.test(s.name)));
  assert.ok(suba.suggestions.every((s) => s.type === 'station' || s.type === 'stop'));
  assert.equal(resolvePlace(r, 'Ricaurte').suggestions, undefined);
  const v = planTrip({ origin: 'Suba', destination: 'Calle 26', time: '09:00', date: TUESDAY });
  assert.ok(v.suggestions.origin.length);
  assert.ok(v.notices.some((a) => /coincide con varios lugares/.test(a)));
});

test('suggestedPlaces: all resolve and stations come first', () => {
  const r = network();
  const l = suggestedPlaces();
  assert.ok(l.length > 150);
  assert.ok(l.includes('Portal Norte') && l.includes('Calle 26'));
  for (const x of l) assert.doesNotThrow(() => resolvePlace(r, x), x);
});

// --- QA findings ---
test('huge inputs do not hang (ReDoS) and are trimmed', () => {
  const t = Date.now();
  assert.throws(() => planTrip({ origin: `1${' '.repeat(100000)}x`, destination: 'Calle 26', time: '08:00', date: TUESDAY }));
  assert.ok(Date.now() - t < 500, `took ${Date.now() - t} ms`);
});

test('origin = destination: walk, no buses', () => {
  const v = planTrip({ origin: 'Portal Norte', destination: 'Portal Norte', time: '08:00', date: TUESDAY });
  assert.equal(v.options.length, 0);
  assert.ok(v.walk_only_min >= 1);
});

test('impossible dates or dates outside the feed validity give a clear error', () => {
  assert.throws(() => planTrip({ origin: 'Portal Norte', destination: 'Calle 26', time: '08:00', date: '2026-02-31' }), /AAAA-MM-DD/);
  assert.throws(() => planTrip({ origin: 'Portal Norte', destination: 'Calle 26', time: '08:00', date: '2027-06-01' }), /vigencia/);
});

test('nearby_stops bounds limit', () => {
  assert.equal(nearbyStops({ lat: 4.6584, lon: -74.0621, limit: -1 }).length, 1);
  assert.ok(nearbyStops({ lat: 4.6584, lon: -74.0621, radius: 2000, limit: 1e9 }).length <= 50);
});
