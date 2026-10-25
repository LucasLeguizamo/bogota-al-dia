// Trip view. A single render function for three surfaces:
// - MCP Apps (`ui://bogota-al-dia/trip.html`): the host passes the result via postMessage.
// - /api/trip?format=html (public page /viaje/): full page with a form, no JS.
// - Any bot that wants HTML.
// `renderTrip` uses nothing external because it is serialized with toString() inside the iframe.
// Data comes in English (keys and enums); everything shown to the rider is Spanish.
import { suggestedPlaces } from './trip.mjs';

export function renderTrip(v) {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toMin = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
    return m ? +m[1] * 60 + +m[2] : 0;
  };
  // GTFS allows 24:10, 25:05… for trips that cross midnight
  const clock = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
    return m ? `${String(+m[1] % 24).padStart(2, '0')}:${m[2]}` : e(hhmm);
  };
  const dur = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`);
  const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;

  // Presentation maps: English enums → Spanish labels
  const WEEKDAY_ES = { monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo' };
  const LABEL_ES = { fastest: 'Más rápida', fewest_transfers: 'Menos transbordos', balanced: 'Equilibrada', recommended: 'Recomendada' };
  // The GTFS color is raw (#00ff00 fails contrast with white text): the system decides.
  // Keyed by `system` (normalized), with the raw GTFS agency name as fallback.
  const SYSTEM = {
    trunk: ['tr', 'Troncal'],
    feeder: ['fe', 'Alimentador'],
    dual: ['du', 'Dual'],
    zonal: ['zo', 'SITP zonal'],
    complementary: ['co', 'SITP complementario'],
    special: ['sp', 'SITP especial'],
    cable: ['ca', 'TransMiCable'],
  };
  const AGENCY = {
    'Transmilenio-Troncal': SYSTEM.trunk,
    'Transmilenio-Alimentadores': SYSTEM.feeder,
    'Transmilenio-Dual': SYSTEM.dual,
    'Zonal-Urbano': SYSTEM.zonal,
    'Zonal-Complementario': SYSTEM.complementary,
    'Zonal-Especial': SYSTEM.special,
    TransMiCable: SYSTEM.cable,
  };
  const sys = (t) => SYSTEM[t.system] ?? AGENCY[t.agency] ?? (/cable/i.test(t.agency ?? '') ? SYSTEM.cable : ['ot', t.agency || 'Bus']);
  const kind = (t) => (t.type === 'ride' ? sys(t)[0] : 'walk');
  const badge = (t) => {
    const [c, label] = sys(t);
    // "TransMiCable CABLE" is redundant: if the code adds nothing, the system is enough
    const code = /^cable$/i.test(t.route ?? '') ? '' : ` <b>${e(t.route)}</b>`;
    return `<span class="rt s-${c}"><span class="sy">${e(label)}</span>${code}</span>`;
  };

  // Where to stand: car and door (trunk), platform (portals) or stop code (SITP)
  const where = (x, boarding) => {
    if (x.car) return `<span class="car"><b>Vagón ${e(x.car)}</b>${x.door ? ` · puerta ${e(x.door)}` : ''}</span>`;
    if (x.platform) {
      const m = /\s(T\d*[A-Z]?)$/.exec(x.platform);
      return `<span class="car"><b>Plataforma ${e(m ? m[1] : x.platform)}</b></span>`;
    }
    const code = String(x.code ?? '').replace(/_TM$/, '');
    if (boarding && /^\d{3}[A-Z]\d{2}$/.test(code)) return `<span class="car car-s">Paradero <b>${e(code)}</b></span>`;
    return '';
  };

  // Recommended: whatever the model marks; otherwise arriving earlier outweighs a transfer (~4 min)
  const ops = v.options ?? [];
  let rec = ops.findIndex((o) => o.recommended || o.label === 'recommended');
  if (rec < 0) {
    const score = (o) => toMin(o.arrives) + 4 * o.transfers + 0.25 * (o.walk_min ?? 0);
    rec = ops.reduce((best, o, i) => (score(o) < score(ops[best]) ? i : best), 0);
  }

  // Timeline: stop rows (dot) and leg rows (rail in the system color)
  const stopRow = (cls, a, b, t, text, extra = '') =>
    `<li class="p ${cls} a-${a} b-${b}"><span class="t">${t ? clock(t) : ''}</span><span class="r" aria-hidden="true"></span><div>${text}${extra}</div></li>`;
  const timeline = (op) => {
    const L = op.legs ?? [];
    const out = [];
    if (L[0]?.type !== 'ride') out.push(stopRow('start', 'no', kind(L[0] ?? {}), op.departs, `<b>Sal de ${e(v.origin.label ?? v.origin.name)}</b>`));
    L.forEach((t, i) => {
      const before = i ? kind(L[i - 1]) : 'no';
      const after = L[i + 1] ? kind(L[i + 1]) : 'no';
      if (t.type !== 'ride') {
        const txt = t.same_stop
          ? `Cambia de bus en ${e(t.to)}`
          : t.same_station
            ? `Cambia de vagón en ${e(t.to)}${L[i + 1]?.board?.car ? ` → vagón ${e(L[i + 1].board.car)}` : ''}`
            : t.transfer && t.from === t.to
              ? `Cruza a la otra parada ${e(t.to)}`
              : `Camina hasta ${e(t.to)}`;
        const ic = t.same_stop || t.same_station ? '⇄' : '🚶';
        out.push(`<li class="s walk"><span class="t"></span><span class="r" aria-hidden="true"></span><div class="mu"><span aria-hidden="true">${ic}</span> ${txt}${t.min ? ` · ${dur(t.min)}` : ''}</div></li>`);
        return;
      }
      const c = kind(t);
      out.push(
        stopRow(
          i === 0 ? 'start' : 'mid',
          before,
          c,
          t.departs,
          `<b>Sube en ${e(t.board.stop)}</b>`,
          `${where(t.board, true) ? `<div class="dd">${where(t.board, true)}</div>` : ''}${t.wait_min ? `<div class="mu">Espera ~${dur(t.wait_min)}</div>` : ''}`,
        ),
      );
      out.push(
        `<li class="s s-${c}"><span class="t"></span><span class="r" aria-hidden="true"></span><div>${badge(t)} <span class="hs">hacia <b title="${e(t.headsign)}">${e(t.headsign_short ?? t.headsign)}</b></span><div class="mu">${plural(t.stops, 'parada')} · ${dur(t.min)}</div></div></li>`,
      );
      const last = !L[i + 1];
      out.push(
        stopRow(
          last ? 'end' : 'mid',
          c,
          after,
          t.arrives,
          `<b>${last ? 'Baja y llegas a' : 'Baja en'} ${e(t.alight.stop)}</b>`,
          where(t.alight, false) ? `<div class="dd">${where(t.alight, false)}</div>` : '',
        ),
      );
    });
    if (L.length && L.at(-1).type !== 'ride') out.push(stopRow('end', 'walk', 'no', op.arrives, `<b>Llegas a ${e(v.destination.label ?? v.destination.name)}</b>`));
    return `<ol class="tl">${out.join('')}</ol>`;
  };

  const chips = (op) =>
    (op.legs ?? [])
      .filter((t) => t.type === 'ride' || (t.min >= 3 && !t.same_station))
      .map((t) =>
        t.type === 'ride' ? badge(t) : `<span class="wk"><span aria-hidden="true">🚶</span><span class="sr">a pie</span> ${t.min}</span>`,
      )
      .join('<span class="sep" aria-hidden="true">›</span>');

  const option = (op, i) => {
    const meta = [
      op.transfers ? plural(op.transfers, 'transbordo') : 'Directo',
      op.walk_min ? `${dur(op.walk_min)} a pie` : '',
      op.wait_min ? `espera ${dur(op.wait_min)}` : '',
    ].filter(Boolean);
    const tags = [i === rec ? '<span class="rec">Recomendada</span>' : '', op.label && op.label !== 'recommended' ? `<span class="tag">${e(LABEL_ES[op.label] ?? op.label)}</span>` : '']
      .filter(Boolean)
      .join('');
    return `
    <details class="op${i === rec ? ' top' : ''}" id="op-${i + 1}"${i === rec ? ' open' : ''}>
      <summary>
        <span class="row1"><span class="big"><span class="sr">Sale a las </span>${clock(op.departs)} <span aria-hidden="true">→</span><span class="sr">, llega a las</span> ${clock(op.arrives)}</span><span class="dur">${dur(op.duration_min)}</span></span>
        ${tags ? `<span class="tags">${tags}</span>` : ''}
        <span class="chips">${chips(op)}</span>
        <span class="mu">${meta.join(' · ')}</span>
      </summary>
      ${timeline(op)}
    </details>`;
  };

  const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.date ?? '');
  const date = f ? `${+f[3]} de ${MONTHS_ES[+f[2] - 1]}` : e(v.date);
  const day = v.holiday ? 'festivo' : (WEEKDAY_ES[v.weekday] ?? v.weekday);
  const notices = v.notices ?? [];

  return `
    <div class="trip">
      <h2><span>${e(v.origin?.name)}</span> <span class="arrow" aria-label="a">→</span> <span>${e(v.destination?.name)}</span></h2>
      <p class="mu">${v.city ? `${e(v.city)} · ` : ''}${e(day)} ${date} · saliendo ${clock(v.time)}${ops.length > 1 ? ` · ${ops.length} opciones` : ''}</p>
      ${ops.length ? ops.map(option).join('') : '<p class="op empty">No encontré buses a esta hora. Prueba otra hora o una parada cercana.</p>'}
      ${v.walk_only_min ? `<p class="mu"><span aria-hidden="true">🚶</span> A pie directo: ~${dur(v.walk_only_min)}.</p>` : ''}
      <footer class="mu">${notices.map((a) => `<p>${e(a)}</p>`).join('')}
        ${v.source ? `<p>Datos: ${e(v.source.publisher)} (${e(v.source.license ?? 'licencia no declarada')}), normalizados por Bogotá al Día. Sin afiliación oficial.</p>` : ''}</footer>
    </div>`;
}

// Colors per system (white text ≥ 4.5:1 on all of them). The system name is always written out.
export const STYLES = `
  :root { --bg:#f8f9fa; --card:#fff; --tx:#212529; --mu:#596069; --pri:#1e3a5f; --bd:#dee2e6; --walk:#9aa3ad;
    --hl:#fff3c4; --hlb:#d9a800; --hlt:#3d2e00; --err:#b02a1d;
    --k-tr:#b3141c; --k-fe:#1b7a3a; --k-du:#5b3c99; --k-zo:#1f5fae; --k-co:#a34700; --k-sp:#7a1f3d; --k-ca:#00707a; --k-ot:#495057;
    color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme=light]) { --bg:#111418; --card:#1a1f25; --tx:#e9ecef; --mu:#a3adb7; --pri:#8fb8e8; --bd:#2c333b; --walk:#6b7580; --hl:#3a3000; --hlb:#b38f00; --hlt:#ffe48a; --err:#ff8a80; } }
  :root[data-theme=dark] { --bg:#111418; --card:#1a1f25; --tx:#e9ecef; --mu:#a3adb7; --pri:#8fb8e8; --bd:#2c333b; --walk:#6b7580; --hl:#3a3000; --hlb:#b38f00; --hlt:#ffe48a; --err:#ff8a80; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--tx); line-height:1.45; -webkit-text-size-adjust:100%; }
  a { color:var(--pri); }
  .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
  .trip { max-width:720px; margin:0 auto; padding:16px; }
  .trip h2 { margin:0 0 2px; font-size:1.15rem; line-height:1.3; color:var(--tx); }
  .arrow { color:var(--mu); }
  .mu { color:var(--mu); font-size:.875rem; }
  .op { display:block; background:var(--card); border:1px solid var(--bd); border-radius:12px; margin:12px 0; }
  .op.top { border:2px solid var(--pri); }
  .empty { padding:14px; }
  .op summary { list-style:none; cursor:pointer; padding:14px 40px 14px 14px; display:grid; gap:6px; position:relative; border-radius:12px; }
  .op summary::-webkit-details-marker { display:none; }
  .op summary::after { content:''; position:absolute; right:16px; top:20px; width:9px; height:9px; border:solid var(--mu); border-width:0 2px 2px 0; transform:rotate(45deg); transition:transform .15s; }
  .op[open] summary::after { transform:rotate(-135deg); top:24px; }
  .op summary:focus-visible { outline:3px solid var(--pri); outline-offset:2px; }
  .row1 { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; }
  .big { font-size:1.4rem; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
  .dur { font-weight:600; }
  .tags { display:flex; flex-wrap:wrap; gap:6px; }
  .rec, .tag { font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border-radius:999px; padding:1px 8px; }
  .rec { background:var(--pri); color:var(--card); }
  .tag { color:var(--pri); border:1px solid currentColor; }
  .chips { display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
  .sep { color:var(--mu); padding:0 1px; }
  .wk { font-size:.8rem; color:var(--mu); white-space:nowrap; }
  .rt { display:inline-flex; align-items:baseline; gap:4px; color:#fff; background:var(--c); border-radius:6px; padding:2px 7px; font-size:.8rem; line-height:1.3; white-space:nowrap; }
  .rt b { font-size:.95rem; }
  .rt .sy { font-size:.7rem; font-weight:600; opacity:.95; }
  .s-tr { --c:var(--k-tr); } .s-fe { --c:var(--k-fe); } .s-du { --c:var(--k-du); } .s-zo { --c:var(--k-zo); }
  .s-co { --c:var(--k-co); } .s-sp { --c:var(--k-sp); } .s-ca { --c:var(--k-ca); } .s-ot { --c:var(--k-ot); }
  .tl { list-style:none; margin:0; padding:2px 14px 14px; border-top:1px solid var(--bd); }
  .tl li { display:grid; grid-template-columns:3.1rem 16px 1fr; column-gap:10px; min-height:1.4rem; }
  .tl .t { text-align:right; font-weight:700; font-variant-numeric:tabular-nums; padding-top:10px; }
  .tl li > div { padding:10px 0 6px; min-width:0; overflow-wrap:anywhere; }
  .tl .r { position:relative; }
  .tl .r::before { content:''; position:absolute; left:6px; width:4px; top:0; bottom:0; }
  .tl .s .r::before { background:var(--c); }
  .tl .s.walk .r::before { left:7px; width:2px; background:repeating-linear-gradient(var(--walk) 0 4px, transparent 4px 8px); }
  .tl .s > div { padding:8px 0 10px; }
  .tl .p .r::before { background:linear-gradient(var(--a, transparent) 0 18px, var(--b, transparent) 18px); }
  .tl .p .r::after { content:''; position:absolute; left:1px; top:12px; width:14px; height:14px; border-radius:50%; background:var(--card); border:3px solid var(--tx); }
  .tl .start .r::after, .tl .end .r::after { background:var(--tx); }
  .a-tr { --a:var(--k-tr); } .a-fe { --a:var(--k-fe); } .a-du { --a:var(--k-du); } .a-zo { --a:var(--k-zo); } .a-co { --a:var(--k-co); } .a-sp { --a:var(--k-sp); } .a-ca { --a:var(--k-ca); } .a-ot { --a:var(--k-ot); } .a-walk { --a:var(--walk); }
  .b-tr { --b:var(--k-tr); } .b-fe { --b:var(--k-fe); } .b-du { --b:var(--k-du); } .b-zo { --b:var(--k-zo); } .b-co { --b:var(--k-co); } .b-sp { --b:var(--k-sp); } .b-ca { --b:var(--k-ca); } .b-ot { --b:var(--k-ot); } .b-walk { --b:var(--walk); }
  .hs { font-size:.95rem; }
  .dd { margin-top:4px; }
  .car { display:inline-block; background:var(--hl); color:var(--hlt); border:1px solid var(--hlb); border-radius:6px; padding:1px 8px; font-size:.875rem; }
  .car-s { background:transparent; color:var(--tx); border-color:var(--bd); }
  .trip footer { margin-top:16px; }
  .trip footer p { margin:4px 0; }
  .err { max-width:720px; margin:0 auto; padding:0 16px; color:var(--err); font-weight:600; }
  @media (prefers-reduced-motion: reduce) { .op summary::after { transition:none; } }
`;

// MCP App resource: receives the host's CallToolResult (ui/notifications/tool-result) and renders it.
export function appHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Viaje</title><style>${STYLES} body{background:transparent}</style></head><body><div id="app"><p class="mu" style="padding:16px">Calculando viaje…</p></div>
<script>
const renderTrip = ${renderTrip.toString()};
const app = document.getElementById('app');
const send = (m) => parent.postMessage({ jsonrpc: '2.0', ...m }, '*');
const theme = (ctx) => ctx && ctx.theme && document.documentElement.setAttribute('data-theme', ctx.theme);
let height = 0;
const resize = () => { const h = document.documentElement.scrollHeight; if (h !== height) { height = h; send({ method: 'ui/notifications/size-changed', params: { width: document.body.scrollWidth, height: h } }); } };
// Opening/closing an option changes the height: the host must know
if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body); else document.addEventListener('toggle', resize, true);
window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (ev.source !== window.parent || !m || m.jsonrpc !== '2.0') return;
  if (m.method === 'ui/resource-teardown') return send({ id: m.id, result: {} });
  if (m.id === 1 && m.error) { app.innerHTML = '<p class="err">' + String(m.error.message || 'Error').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>'; return; }
  if (m.id === 1 && m.result) { theme(m.result.hostContext); send({ method: 'ui/notifications/initialized', params: {} }); }
  if (m.method === 'ui/notifications/host-context-changed') theme(m.params);
  if (m.method === 'ui/notifications/tool-result') {
    const v = m.params && m.params.structuredContent;
    app.innerHTML = v && v.options ? renderTrip(v) : '<p class="err" style="padding:16px">' + ((m.params && m.params.content && m.params.content[0] && m.params.content[0].text) || 'Sin resultado').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>';
    resize();
  }
});
send({ id: 1, method: 'ui/initialize', params: { protocolVersion: '2026-01-26', appInfo: { name: 'bogota-al-dia-trip', version: '1' }, appCapabilities: {} } });
</script></body></html>`;
}

// Suggestions for the <datalist> (no-JS autocomplete): GTFS stations with service, the same
// ones planTrip resolves, so no suggestion ends in "No encontré".
// ponytail: 400 names is enough for the datalist; suggestedPlaces guarantees they all resolve
const stationNames = () => suggestedPlaces();

const EXAMPLES = [
  ['Portal Norte', 'Calle 26'],
  ['Portal Suba', 'Universidades'],
  ['Portal 80', 'Museo del Oro'],
  ['Portal Usme', 'Calle 72'],
  ['Portal Tunal', 'Mirador del Paraíso'],
];

const PAGE_STYLES = `
  .topbar { background:var(--pri); }
  .topbar nav { max-width:720px; margin:0 auto; padding:10px 16px; display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
  .topbar a { color:var(--bg); text-decoration:none; font-size:.9rem; }
  .topbar a:first-child { font-weight:700; margin-right:auto; }
  .topbar a:hover, .topbar a:focus-visible { text-decoration:underline; }
  .head { max-width:720px; margin:0 auto; padding:20px 16px 0; }
  .head h1 { margin:0; font-size:1.5rem; color:var(--tx); }
  .head p { margin:4px 0 0; }
  form { max-width:720px; margin:0 auto; padding:16px; display:grid; gap:12px; grid-template-columns:1fr 1fr; }
  form label { display:grid; gap:4px; font-size:.9rem; font-weight:600; }
  form label.wide { grid-column:1/-1; }
  form small { font-weight:400; color:var(--mu); font-size:.8rem; }
  form input { font:inherit; font-weight:400; font-size:1rem; padding:11px 12px; border:1px solid var(--walk); border-radius:8px; background:var(--card); color:var(--tx); min-width:0; width:100%; }
  form input:focus-visible, form button:focus-visible { outline:3px solid var(--pri); outline-offset:1px; }
  form button { grid-column:1/-1; font:inherit; font-weight:700; font-size:1rem; padding:13px; border:0; border-radius:8px; background:var(--pri); color:var(--bg); cursor:pointer; }
  .change { max-width:720px; margin:12px auto 0; padding:0 16px; }
  .change summary { cursor:pointer; font-weight:600; color:var(--pri); padding:10px 12px; border:1px solid var(--bd); border-radius:8px; background:var(--card); }
  .change summary:focus-visible { outline:3px solid var(--pri); outline-offset:2px; }
  .change form { padding:12px 0 4px; }
  .actions { max-width:720px; margin:12px auto 0; padding:0 16px; display:flex; flex-wrap:wrap; gap:8px 16px; font-size:.9rem; }
  .examples { max-width:720px; margin:0 auto; padding:8px 16px 32px; }
  .examples h2 { font-size:1rem; margin:8px 0; color:var(--tx); }
  .examples ul { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
  .examples a { display:inline-block; padding:8px 12px; border:1px solid var(--bd); border-radius:999px; background:var(--card); text-decoration:none; font-size:.9rem; }
  .examples a:hover, .examples a:focus-visible { border-color:var(--pri); }
  .legend { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:16px; }
`;

// Full page for /api/trip?format=html (served at /viaje/): GET form + result, zero JS.
// Query params are English (origin, destination, time, date, format); the copy is Spanish.
export function pageHtml({ v, q = {}, error } = {}) {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const url = (p, format = 'html') => `${format === 'html' ? '/viaje/' : '/api/trip/'}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter(([, x]) => x)), format })}`;
  const field = (name, label, ph, { type = 'text', hint = '', wide = false } = {}) =>
    `<label${wide ? ' class="wide"' : ''}>${label}${hint ? ` <small id="hint-${name}">${hint}</small>` : ''}<input id="${name}" name="${name}" type="${type}" value="${e(q[name])}"${ph ? ` placeholder="${e(ph)}"` : ''}${
      type === 'text' ? ` list="stops" autocomplete="off" autocapitalize="words" enterkeyhint="next"` : ''
    }${hint ? ` aria-describedby="hint-${name}"` : ''}${name === 'origin' || name === 'destination' ? ' required' : ''}></label>`;
  const title = v ? `${v.origin.name} → ${v.destination.name}` : 'Cómo llegar en TransMilenio y SITP';
  const examples = `<section class="examples" aria-labelledby="ex-h"><h2 id="ex-h">${v ? 'Otros viajes' : 'Viajes frecuentes'}</h2><ul>${EXAMPLES.map(
    ([o, d]) => `<li><a href="${e(url({ origin: o, destination: d, time: q.time, date: q.date }))}">${e(o)} → ${e(d)}</a></li>`,
  ).join('')}</ul>${
    v
      ? ''
      : `<div class="legend"><span class="mu">Cada ruta dice su sistema:</span>${[
          ['tr', 'Troncal'],
          ['fe', 'Alimentador'],
          ['zo', 'SITP zonal'],
          ['ca', 'TransMiCable'],
        ]
          .map(([c, l]) => `<span class="rt s-${c}"><span class="sy">${l}</span></span>`)
          .join('')}</div>`
  }</section>`;
  return `<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)} · Bogotá al Día</title><meta name="description" content="Cómo llegar en TransMilenio, SITP y TransMiCable con horarios oficiales: a qué hora salir, en qué vagón y puerta subir y dónde bajarte.">
<meta name="color-scheme" content="light dark"><style>${STYLES}${PAGE_STYLES}</style></head><body>
<header class="topbar"><nav aria-label="Navegación principal"><a href="/">Bogotá al Día</a><a href="/transmilenio/">TransMilenio</a><a href="/alertas/">Alertas</a></nav></header>
<main>
<div class="head"><h1>¿Cómo llego?</h1>${v ? '' : '<p class="mu">TransMilenio, SITP y TransMiCable con horarios oficiales. Te decimos a qué hora salir, en qué vagón esperar y dónde bajarte.</p>'}</div>
${v ? '<details class="change"><summary>Cambiar búsqueda</summary>' : ''}<form method="get" action="/viaje/">
  ${field('origin', 'Desde', 'Portal Norte', { hint: 'Estación, paradero (Br. San Joaquín) o coordenadas', wide: true })}
  ${field('destination', 'Hasta', 'Calle 26', { wide: true })}
  ${field('time', 'Hora de salida', '', { type: 'time', hint: 'Vacío = ahora' })}
  ${field('date', 'Fecha', '', { type: 'date', hint: 'Vacío = hoy' })}
  <input type="hidden" name="format" value="html"><button type="submit">Buscar ruta</button>
</form>${v ? '</details>' : ''}
<datalist id="stops">${stationNames()
    .map((n) => `<option value="${e(n)}">`)
    .join('')}</datalist>
${error ? `<p class="err" role="alert">${e(error)}</p>` : ''}
${v ? `<p class="actions"><a href="${e(url({ origin: q.destination, destination: q.origin, time: q.time, date: q.date }))}">⇅ Ver el viaje de vuelta</a><a href="${e(url({ origin: q.origin, destination: q.destination, time: q.time, date: q.date }, 'text'))}">Versión texto (para compartir)</a></p>` : ''}
${v ? renderTrip(v) : ''}
${examples}
</main>
</body></html>`;
}
