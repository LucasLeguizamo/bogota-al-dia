// Vista del viaje. Una sola función de render para tres superficies:
// - MCP Apps (`ui://bogota-al-dia/viaje.html`): el host pasa el resultado por postMessage.
// - /api/viaje?formato=html: página completa con formulario, sin JS.
// - Cualquier bot que quiera HTML.
// `renderViaje` no usa nada externo porque se serializa con toString() dentro del iframe.
import { lugaresSugeridos } from './viaje.mjs';

export function renderViaje(v) {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const aMin = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
    return m ? +m[1] * 60 + +m[2] : 0;
  };
  // GTFS permite 24:10, 25:05… para viajes que cruzan la medianoche
  const hora = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
    return m ? `${String(+m[1] % 24).padStart(2, '0')}:${m[2]}` : e(hhmm);
  };
  const dur = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`);
  const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;

  // El color del GTFS es crudo (#00ff00 no pasa contraste con texto blanco): el sistema manda.
  const SIS = {
    'Transmilenio-Troncal': ['tr', 'Troncal'],
    'Transmilenio-Alimentadores': ['al', 'Alimentador'],
    'Transmilenio-Dual': ['du', 'Dual'],
    'Zonal-Urbano': ['zo', 'SITP zonal'],
    'Zonal-Complementario': ['co', 'SITP complementario'],
    'Zonal-Especial': ['es', 'SITP especial'],
    TransMiCable: ['ca', 'TransMiCable'],
  };
  const TIPO = { troncal: SIS['Transmilenio-Troncal'], alimentador: SIS['Transmilenio-Alimentadores'], dual: SIS['Transmilenio-Dual'], zonal: SIS['Zonal-Urbano'], complementario: SIS['Zonal-Complementario'], especial: SIS['Zonal-Especial'], cable: SIS.TransMiCable };
  const sis = (t) => TIPO[t.sistema_tipo] ?? SIS[t.sistema] ?? (/cable/i.test(t.sistema ?? '') ? SIS.TransMiCable : ['ot', t.sistema || 'Bus']);
  const k = (t) => (t.tipo === 'bus' ? sis(t)[0] : 'pie');
  const badge = (t) => {
    const [c, label] = sis(t);
    // "TransMiCable CABLE" sobra: si el código no agrega nada, basta el sistema
    const cod = /^cable$/i.test(t.ruta ?? '') ? '' : ` <b>${e(t.ruta)}</b>`;
    return `<span class="rt s-${c}"><span class="sy">${e(label)}</span>${cod}</span>`;
  };

  // Dónde pararse: vagón y puerta (troncal), plataforma (portales) o código de paradero (SITP)
  const donde = (x, sube) => {
    if (x.vagon) return `<span class="vg"><b>Vagón ${e(x.vagon)}</b>${x.puerta ? ` · puerta ${e(x.puerta)}` : ''}</span>`;
    if (x.plataforma) {
      const m = /\s(T\d*[A-Z]?)$/.exec(x.plataforma);
      return `<span class="vg"><b>Plataforma ${e(m ? m[1] : x.plataforma)}</b></span>`;
    }
    const cod = String(x.codigo ?? '').replace(/_TM$/, '');
    if (sube && /^\d{3}[A-Z]\d{2}$/.test(cod)) return `<span class="vg vg-s">Paradero <b>${e(cod)}</b></span>`;
    return '';
  };

  // Recomendada: la que el modelo marque; si no, llegar antes pesa más que un transbordo (~4 min)
  const ops = v.opciones ?? [];
  let rec = ops.findIndex((o) => /recomendad/i.test(o.etiqueta ?? '') || o.recomendada);
  if (rec < 0) {
    const score = (o) => aMin(o.llega) + 4 * o.transbordos + 0.25 * (o.caminata_min ?? 0);
    rec = ops.reduce((best, o, i) => (score(o) < score(ops[best]) ? i : best), 0);
  }

  // Línea de tiempo: filas de parada (punto) y filas de tramo (riel del color del sistema)
  const parada = (cls, a, b, t, texto, extra = '') =>
    `<li class="p ${cls} a-${a} b-${b}"><span class="t">${t ? hora(t) : ''}</span><span class="r" aria-hidden="true"></span><div>${texto}${extra}</div></li>`;
  const timeline = (op) => {
    const T = op.tramos ?? [];
    const out = [];
    if (T[0]?.tipo !== 'bus') out.push(parada('ini', 'no', k(T[0] ?? {}), op.sale, `<b>Sal de ${e(v.origen.etiqueta ?? v.origen.nombre)}</b>`));
    T.forEach((t, i) => {
      const antes = i ? k(T[i - 1]) : 'no';
      const despues = T[i + 1] ? k(T[i + 1]) : 'no';
      if (t.tipo !== 'bus') {
        const txt = t.misma_parada
          ? `Cambia de bus en ${e(t.hasta)}`
          : t.misma_estacion
            ? `Cambia de vagón en ${e(t.hasta)}${T[i + 1]?.sube?.vagon ? ` → vagón ${e(T[i + 1].sube.vagon)}` : ''}`
            : t.transbordo && t.desde === t.hasta
              ? `Cruza a la otra parada ${e(t.hasta)}`
              : `Camina hasta ${e(t.hasta)}`;
        const ic = t.misma_parada || t.misma_estacion ? '⇄' : '🚶';
        out.push(`<li class="s pie"><span class="t"></span><span class="r" aria-hidden="true"></span><div class="mu"><span aria-hidden="true">${ic}</span> ${txt}${t.min ? ` · ${dur(t.min)}` : ''}</div></li>`);
        return;
      }
      const c = k(t);
      out.push(
        parada(
          i === 0 ? 'ini' : 'mid',
          antes,
          c,
          t.sale,
          `<b>Sube en ${e(t.sube.parada)}</b>`,
          `${donde(t.sube, true) ? `<div class="dd">${donde(t.sube, true)}</div>` : ''}${t.espera_min ? `<div class="mu">Espera ~${dur(t.espera_min)}</div>` : ''}`,
        ),
      );
      out.push(
        `<li class="s s-${c}"><span class="t"></span><span class="r" aria-hidden="true"></span><div>${badge(t)} <span class="hacia">hacia <b title="${e(t.hacia)}">${e(t.hacia_corto ?? t.hacia)}</b></span><div class="mu">${plural(t.paradas, 'parada')} · ${dur(t.min)}</div></div></li>`,
      );
      const fin = !T[i + 1];
      out.push(
        parada(
          fin ? 'fin' : 'mid',
          c,
          despues,
          t.llega,
          `<b>${fin ? 'Baja y llegas a' : 'Baja en'} ${e(t.baja.parada)}</b>`,
          donde(t.baja, false) ? `<div class="dd">${donde(t.baja, false)}</div>` : '',
        ),
      );
    });
    if (T.length && T.at(-1).tipo !== 'bus') out.push(parada('fin', 'pie', 'no', op.llega, `<b>Llegas a ${e(v.destino.etiqueta ?? v.destino.nombre)}</b>`));
    return `<ol class="tl">${out.join('')}</ol>`;
  };

  const chips = (op) =>
    (op.tramos ?? [])
      .filter((t) => t.tipo === 'bus' || (t.min >= 3 && !t.misma_estacion))
      .map((t) =>
        t.tipo === 'bus' ? badge(t) : `<span class="pw"><span aria-hidden="true">🚶</span><span class="sr">a pie</span> ${t.min}</span>`,
      )
      .join('<span class="sep" aria-hidden="true">›</span>');

  const opcion = (op, i) => {
    const meta = [
      op.transbordos ? plural(op.transbordos, 'transbordo') : 'Directo',
      op.caminata_min ? `${dur(op.caminata_min)} a pie` : '',
      op.espera_min ? `espera ${dur(op.espera_min)}` : '',
    ].filter(Boolean);
    const tags = [i === rec ? '<span class="rec">Recomendada</span>' : '', op.etiqueta && !/recomendad/i.test(op.etiqueta) ? `<span class="tag">${e(op.etiqueta)}</span>` : '']
      .filter(Boolean)
      .join('');
    return `
    <details class="op${i === rec ? ' top' : ''}" id="op-${i + 1}"${i === rec ? ' open' : ''}>
      <summary>
        <span class="row1"><span class="big"><span class="sr">Sale a las </span>${hora(op.sale)} <span aria-hidden="true">→</span><span class="sr">, llega a las</span> ${hora(op.llega)}</span><span class="dur">${dur(op.duracion_min)}</span></span>
        ${tags ? `<span class="tags">${tags}</span>` : ''}
        <span class="chips">${chips(op)}</span>
        <span class="mu">${meta.join(' · ')}</span>
      </summary>
      ${timeline(op)}
    </details>`;
  };

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.fecha ?? '');
  const fecha = f ? `${+f[3]} de ${MESES[+f[2] - 1]}` : e(v.fecha);
  const avisos = v.avisos ?? [];

  return `
    <div class="viaje">
      <h2><span>${e(v.origen?.nombre)}</span> <span class="flecha" aria-label="a">→</span> <span>${e(v.destino?.nombre)}</span></h2>
      <p class="mu">${v.ciudad ? `${e(v.ciudad)} · ` : ''}${e(v.dia)} ${fecha} · saliendo ${hora(v.hora)}${ops.length > 1 ? ` · ${ops.length} opciones` : ''}</p>
      ${ops.length ? ops.map(opcion).join('') : '<p class="op vacio">No encontré buses a esta hora. Prueba otra hora o una parada cercana.</p>'}
      ${v.caminar_min ? `<p class="mu"><span aria-hidden="true">🚶</span> A pie directo: ~${dur(v.caminar_min)}.</p>` : ''}
      <footer class="mu">${avisos.map((a) => `<p>${e(a)}</p>`).join('')}
        ${v.fuente ? `<p>Datos: ${e(v.fuente.entidad)} (${e(v.fuente.licencia ?? 'licencia no declarada')}), normalizados por Bogotá al Día. Sin afiliación oficial.</p>` : ''}</footer>
    </div>`;
}

// Colores por sistema (texto blanco ≥ 4.5:1 en todos). El nombre del sistema siempre va escrito.
export const ESTILOS = `
  :root { --bg:#f8f9fa; --card:#fff; --tx:#212529; --mu:#596069; --pri:#1e3a5f; --bd:#dee2e6; --pie:#9aa3ad;
    --hl:#fff3c4; --hlb:#d9a800; --hlt:#3d2e00; --err:#b02a1d;
    --k-tr:#b3141c; --k-al:#1b7a3a; --k-du:#5b3c99; --k-zo:#1f5fae; --k-co:#a34700; --k-es:#7a1f3d; --k-ca:#00707a; --k-ot:#495057;
    color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme=light]) { --bg:#111418; --card:#1a1f25; --tx:#e9ecef; --mu:#a3adb7; --pri:#8fb8e8; --bd:#2c333b; --pie:#6b7580; --hl:#3a3000; --hlb:#b38f00; --hlt:#ffe48a; --err:#ff8a80; } }
  :root[data-theme=dark] { --bg:#111418; --card:#1a1f25; --tx:#e9ecef; --mu:#a3adb7; --pri:#8fb8e8; --bd:#2c333b; --pie:#6b7580; --hl:#3a3000; --hlb:#b38f00; --hlt:#ffe48a; --err:#ff8a80; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--tx); line-height:1.45; -webkit-text-size-adjust:100%; }
  a { color:var(--pri); }
  .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
  .viaje { max-width:720px; margin:0 auto; padding:16px; }
  .viaje h2 { margin:0 0 2px; font-size:1.15rem; line-height:1.3; color:var(--tx); }
  .flecha { color:var(--mu); }
  .mu { color:var(--mu); font-size:.875rem; }
  .op { display:block; background:var(--card); border:1px solid var(--bd); border-radius:12px; margin:12px 0; }
  .op.top { border:2px solid var(--pri); }
  .vacio { padding:14px; }
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
  .pw { font-size:.8rem; color:var(--mu); white-space:nowrap; }
  .rt { display:inline-flex; align-items:baseline; gap:4px; color:#fff; background:var(--c); border-radius:6px; padding:2px 7px; font-size:.8rem; line-height:1.3; white-space:nowrap; }
  .rt b { font-size:.95rem; }
  .rt .sy { font-size:.7rem; font-weight:600; opacity:.95; }
  .s-tr { --c:var(--k-tr); } .s-al { --c:var(--k-al); } .s-du { --c:var(--k-du); } .s-zo { --c:var(--k-zo); }
  .s-co { --c:var(--k-co); } .s-es { --c:var(--k-es); } .s-ca { --c:var(--k-ca); } .s-ot { --c:var(--k-ot); }
  .tl { list-style:none; margin:0; padding:2px 14px 14px; border-top:1px solid var(--bd); }
  .tl li { display:grid; grid-template-columns:3.1rem 16px 1fr; column-gap:10px; min-height:1.4rem; }
  .tl .t { text-align:right; font-weight:700; font-variant-numeric:tabular-nums; padding-top:10px; }
  .tl li > div { padding:10px 0 6px; min-width:0; overflow-wrap:anywhere; }
  .tl .r { position:relative; }
  .tl .r::before { content:''; position:absolute; left:6px; width:4px; top:0; bottom:0; }
  .tl .s .r::before { background:var(--c); }
  .tl .s.pie .r::before { left:7px; width:2px; background:repeating-linear-gradient(var(--pie) 0 4px, transparent 4px 8px); }
  .tl .s > div { padding:8px 0 10px; }
  .tl .p .r::before { background:linear-gradient(var(--a, transparent) 0 18px, var(--b, transparent) 18px); }
  .tl .p .r::after { content:''; position:absolute; left:1px; top:12px; width:14px; height:14px; border-radius:50%; background:var(--card); border:3px solid var(--tx); }
  .tl .ini .r::after, .tl .fin .r::after { background:var(--tx); }
  .a-tr { --a:var(--k-tr); } .a-al { --a:var(--k-al); } .a-du { --a:var(--k-du); } .a-zo { --a:var(--k-zo); } .a-co { --a:var(--k-co); } .a-es { --a:var(--k-es); } .a-ca { --a:var(--k-ca); } .a-ot { --a:var(--k-ot); } .a-pie { --a:var(--pie); }
  .b-tr { --b:var(--k-tr); } .b-al { --b:var(--k-al); } .b-du { --b:var(--k-du); } .b-zo { --b:var(--k-zo); } .b-co { --b:var(--k-co); } .b-es { --b:var(--k-es); } .b-ca { --b:var(--k-ca); } .b-ot { --b:var(--k-ot); } .b-pie { --b:var(--pie); }
  .hacia { font-size:.95rem; }
  .dd { margin-top:4px; }
  .vg { display:inline-block; background:var(--hl); color:var(--hlt); border:1px solid var(--hlb); border-radius:6px; padding:1px 8px; font-size:.875rem; }
  .vg-s { background:transparent; color:var(--tx); border-color:var(--bd); }
  .viaje footer { margin-top:16px; }
  .viaje footer p { margin:4px 0; }
  .err { max-width:720px; margin:0 auto; padding:0 16px; color:var(--err); font-weight:600; }
  @media (prefers-reduced-motion: reduce) { .op summary::after { transition:none; } }
`;

// Recurso MCP App: recibe el CallToolResult del host (ui/notifications/tool-result) y lo pinta.
export function appHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Viaje</title><style>${ESTILOS} body{background:transparent}</style></head><body><div id="app"><p class="mu" style="padding:16px">Calculando viaje…</p></div>
<script>
const renderViaje = ${renderViaje.toString()};
const app = document.getElementById('app');
const send = (m) => parent.postMessage({ jsonrpc: '2.0', ...m }, '*');
const tema = (ctx) => ctx && ctx.theme && document.documentElement.setAttribute('data-theme', ctx.theme);
let alto = 0;
const tam = () => { const h = document.documentElement.scrollHeight; if (h !== alto) { alto = h; send({ method: 'ui/notifications/size-changed', params: { width: document.body.scrollWidth, height: h } }); } };
// Abrir/cerrar una opción cambia la altura: el host debe enterarse
if (window.ResizeObserver) new ResizeObserver(tam).observe(document.body); else document.addEventListener('toggle', tam, true);
window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (!m || m.jsonrpc !== '2.0') return;
  if (m.id === 1 && m.result) { tema(m.result.hostContext); send({ method: 'ui/notifications/initialized', params: {} }); }
  if (m.method === 'ui/notifications/host-context-changed') tema(m.params);
  if (m.method === 'ui/notifications/tool-result') {
    const v = m.params && m.params.structuredContent;
    app.innerHTML = v && v.opciones ? renderViaje(v) : '<p class="err" style="padding:16px">' + ((m.params && m.params.content && m.params.content[0] && m.params.content[0].text) || 'Sin resultado').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>';
    tam();
  }
});
send({ id: 1, method: 'ui/initialize', params: { protocolVersion: '2026-01-26', appInfo: { name: 'bogota-al-dia-viaje', version: '1' }, appCapabilities: {} } });
</script></body></html>`;
}

// Sugerencias para el <datalist> (autocompletar sin JS): estaciones del GTFS con servicio,
// las mismas que resuelve planearViaje, así ninguna sugerencia termina en "No encontré".
// ponytail: 400 nombres basta para el datalist; lugaresSugeridos garantiza que todos resuelven
const nombresEstaciones = () => lugaresSugeridos();

const EJEMPLOS = [
  ['Portal Norte', 'Calle 26'],
  ['Portal Suba', 'Universidades'],
  ['Portal 80', 'Museo del Oro'],
  ['Portal Usme', 'Calle 72'],
  ['Portal Tunal', 'Mirador del Paraíso'],
];

const ESTILOS_PAGINA = `
  .barra { background:var(--pri); }
  .barra nav { max-width:720px; margin:0 auto; padding:10px 16px; display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
  .barra a { color:var(--bg); text-decoration:none; font-size:.9rem; }
  .barra a:first-child { font-weight:700; margin-right:auto; }
  .barra a:hover, .barra a:focus-visible { text-decoration:underline; }
  .cab { max-width:720px; margin:0 auto; padding:20px 16px 0; }
  .cab h1 { margin:0; font-size:1.5rem; color:var(--tx); }
  .cab p { margin:4px 0 0; }
  form { max-width:720px; margin:0 auto; padding:16px; display:grid; gap:12px; grid-template-columns:1fr 1fr; }
  form label { display:grid; gap:4px; font-size:.9rem; font-weight:600; }
  form label.w { grid-column:1/-1; }
  form small { font-weight:400; color:var(--mu); font-size:.8rem; }
  form input { font:inherit; font-weight:400; font-size:1rem; padding:11px 12px; border:1px solid var(--pie); border-radius:8px; background:var(--card); color:var(--tx); min-width:0; width:100%; }
  form input:focus-visible, form button:focus-visible { outline:3px solid var(--pri); outline-offset:1px; }
  form button { grid-column:1/-1; font:inherit; font-weight:700; font-size:1rem; padding:13px; border:0; border-radius:8px; background:var(--pri); color:var(--bg); cursor:pointer; }
  .cambiar { max-width:720px; margin:12px auto 0; padding:0 16px; }
  .cambiar summary { cursor:pointer; font-weight:600; color:var(--pri); padding:10px 12px; border:1px solid var(--bd); border-radius:8px; background:var(--card); }
  .cambiar summary:focus-visible { outline:3px solid var(--pri); outline-offset:2px; }
  .cambiar form { padding:12px 0 4px; }
  .acc { max-width:720px; margin:12px auto 0; padding:0 16px; display:flex; flex-wrap:wrap; gap:8px 16px; font-size:.9rem; }
  .ej { max-width:720px; margin:0 auto; padding:8px 16px 32px; }
  .ej h2 { font-size:1rem; margin:8px 0; color:var(--tx); }
  .ej ul { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
  .ej a { display:inline-block; padding:8px 12px; border:1px solid var(--bd); border-radius:999px; background:var(--card); text-decoration:none; font-size:.9rem; }
  .ej a:hover, .ej a:focus-visible { border-color:var(--pri); }
  .leyenda { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:16px; }
`;

// Página completa para /api/viaje?formato=html: formulario GET + resultado, cero JS.
export function paginaHtml({ v, q = {}, error } = {}) {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const url = (p, formato = 'html') => `/api/viaje?${new URLSearchParams({ ...Object.fromEntries(Object.entries(p).filter(([, x]) => x)), formato })}`;
  const campo = (name, label, ph, { type = 'text', ayuda = '', w = false } = {}) =>
    `<label${w ? ' class="w"' : ''}>${label}${ayuda ? ` <small id="ay-${name}">${ayuda}</small>` : ''}<input id="${name}" name="${name}" type="${type}" value="${e(q[name])}"${ph ? ` placeholder="${e(ph)}"` : ''}${
      type === 'text' ? ` list="paradas" autocomplete="off" autocapitalize="words" enterkeyhint="next"` : ''
    }${ayuda ? ` aria-describedby="ay-${name}"` : ''}${name === 'origen' || name === 'destino' ? ' required' : ''}></label>`;
  const titulo = v ? `${v.origen.nombre} → ${v.destino.nombre}` : 'Cómo llegar en TransMilenio y SITP';
  const ejemplos = `<section class="ej" aria-labelledby="ej-h"><h2 id="ej-h">${v ? 'Otros viajes' : 'Viajes frecuentes'}</h2><ul>${EJEMPLOS.map(
    ([o, d]) => `<li><a href="${e(url({ origen: o, destino: d, hora: q.hora, fecha: q.fecha }))}">${e(o)} → ${e(d)}</a></li>`,
  ).join('')}</ul>${
    v
      ? ''
      : `<div class="leyenda"><span class="mu">Cada ruta dice su sistema:</span>${[
          ['tr', 'Troncal'],
          ['al', 'Alimentador'],
          ['zo', 'SITP zonal'],
          ['ca', 'TransMiCable'],
        ]
          .map(([c, l]) => `<span class="rt s-${c}"><span class="sy">${l}</span></span>`)
          .join('')}</div>`
  }</section>`;
  return `<!doctype html><html lang="es-CO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(titulo)} · Bogotá al Día</title><meta name="description" content="Cómo llegar en TransMilenio, SITP y TransMiCable con horarios oficiales: a qué hora salir, en qué vagón y puerta subir y dónde bajarte.">
<meta name="color-scheme" content="light dark"><style>${ESTILOS}${ESTILOS_PAGINA}</style></head><body>
<header class="barra"><nav aria-label="Navegación principal"><a href="/">Bogotá al Día</a><a href="/transmilenio/">TransMilenio</a><a href="/alertas/">Alertas</a></nav></header>
<main>
<div class="cab"><h1>¿Cómo llego?</h1>${v ? '' : '<p class="mu">TransMilenio, SITP y TransMiCable con horarios oficiales. Te decimos a qué hora salir, en qué vagón esperar y dónde bajarte.</p>'}</div>
${v ? '<details class="cambiar"><summary>Cambiar búsqueda</summary>' : ''}<form method="get" action="/api/viaje">
  ${campo('origen', 'Desde', 'Portal Norte', { ayuda: 'Estación, paradero (Br. San Joaquín) o coordenadas', w: true })}
  ${campo('destino', 'Hasta', 'Calle 26', { w: true })}
  ${campo('hora', 'Hora de salida', '', { type: 'time', ayuda: 'Vacío = ahora' })}
  ${campo('fecha', 'Fecha', '', { type: 'date', ayuda: 'Vacío = hoy' })}
  <input type="hidden" name="formato" value="html"><button type="submit">Buscar ruta</button>
</form>${v ? '</details>' : ''}
<datalist id="paradas">${nombresEstaciones()
    .map((n) => `<option value="${e(n)}">`)
    .join('')}</datalist>
${error ? `<p class="err" role="alert">${e(error)}</p>` : ''}
${v ? `<p class="acc"><a href="${e(url({ origen: q.destino, destino: q.origen, hora: q.hora, fecha: q.fecha }))}">⇅ Ver el viaje de vuelta</a><a href="${e(url({ origen: q.origen, destino: q.destino, hora: q.hora, fecha: q.fecha }, 'texto'))}">Versión texto (para compartir)</a></p>` : ''}
${v ? renderViaje(v) : ''}
${ejemplos}
</main>
</body></html>`;
}
