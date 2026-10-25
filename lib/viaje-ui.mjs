// Vista del viaje. Una sola función de render para tres superficies:
// - MCP Apps (`ui://bogota-al-dia/viaje.html`): el host pasa el resultado por postMessage.
// - /api/viaje?formato=html: página completa con formulario, sin JS.
// - Cualquier bot que quiera HTML.
// `renderViaje` no usa nada externo porque se serializa con toString() dentro del iframe.

export function renderViaje(v) {
  const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const lugar = (x) =>
    `${e(x.parada)}${x.vagon ? ` <span class="vg">Vagón ${e(x.vagon)} · puerta ${e(x.puerta)}</span>` : x.plataforma ? ` <span class="vg">${e(x.plataforma)}</span>` : ''}`;
  const tramo = (t) =>
    t.tipo === 'caminar'
      ? `<li class="pie"><span class="ic" aria-hidden="true">${t.misma_estacion ? '🔁' : '🚶'}</span><div>${t.misma_estacion ? `Cambia de vagón en ${e(t.hasta)}` : `Camina a ${e(t.hasta)}`} <span class="mu">${t.min} min</span></div></li>`
      : `<li class="bus"><span class="badge" style="background:${e(t.color)}">${e(t.ruta)}</span><div>
          <div><strong>Hacia ${e(t.hacia)}</strong> <span class="mu">${e(t.sistema)}</span></div>
          <div class="hr"><b>${e(t.sale)}</b> sube en ${lugar(t.sube)}${t.espera_min ? ` <span class="mu">espera ~${t.espera_min} min</span>` : ''}</div>
          <div class="hr"><b>${e(t.llega)}</b> baja en ${lugar(t.baja)} <span class="mu">${t.paradas} paradas · ${t.min} min</span></div>
        </div></li>`;
  const opcion = (op, i) => `
    <section class="op${i === v.opciones.length - 1 ? ' top' : ''}">
      <header><span class="tag">${e(op.etiqueta)}</span><span class="big">${e(op.sale)} → ${e(op.llega)}</span>
        <span class="mu">${op.duracion_min} min · ${op.transbordos} transbordo${op.transbordos === 1 ? '' : 's'} · ${op.caminata_min} min a pie</span></header>
      <div class="linea" aria-hidden="true">${op.tramos
        .map((t) => `<i style="flex:${Math.max(t.min, 2)};background:${t.tipo === 'bus' ? e(t.color) : 'var(--pie)'}"></i>`)
        .join('')}</div>
      <ol>${op.tramos.map(tramo).join('')}</ol>
    </section>`;
  return `
    <div class="viaje">
      <h2>${e(v.origen.nombre)} → ${e(v.destino.nombre)}</h2>
      <p class="mu">${e(v.ciudad)} · ${e(v.dia)} ${e(v.fecha)} · saliendo ${e(v.hora)}</p>
      ${v.opciones.map(opcion).join('')}
      ${v.caminar_min ? `<p class="mu">🚶 A pie directo: ~${v.caminar_min} min.</p>` : ''}
      <footer class="mu">${v.avisos.map((a) => `<p>${e(a)}</p>`).join('')}
        <p>Datos: ${e(v.fuente.entidad)} (${e(v.fuente.licencia ?? 'licencia no declarada')}), normalizados por Bogotá al Día. Sin afiliación oficial.</p></footer>
    </div>`;
}

export const ESTILOS = `
  :root { --bg:#f8f9fa; --card:#fff; --tx:#212529; --mu:#6c757d; --pri:#1e3a5f; --bd:#dee2e6; --pie:#adb5bd; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme=light]) { --bg:#111418; --card:#1a1f25; --tx:#e9ecef; --mu:#9aa4ae; --pri:#8fb8e8; --bd:#2c333b; --pie:#59636e; } }
  :root[data-theme=dark] { --bg:#111418; --card:#1a1f25; --tx:#e9ecef; --mu:#9aa4ae; --pri:#8fb8e8; --bd:#2c333b; --pie:#59636e; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--tx); line-height:1.45; }
  .viaje, form { max-width:720px; margin:0 auto; padding:16px; }
  h2 { margin:0 0 4px; font-size:1.2rem; color:var(--pri); }
  .mu { color:var(--mu); font-size:.875rem; }
  .op { background:var(--card); border:1px solid var(--bd); border-radius:12px; padding:14px; margin:12px 0; }
  .op.top { border-color:var(--pri); }
  .op header { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:baseline; }
  .tag { font-size:.75rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--pri); }
  .big { font-size:1.25rem; font-weight:700; font-variant-numeric:tabular-nums; }
  .linea { display:flex; gap:3px; height:6px; margin:10px 0; } .linea i { border-radius:3px; }
  ol { list-style:none; margin:0; padding:0; display:grid; gap:10px; }
  li { display:grid; grid-template-columns:52px 1fr; gap:10px; align-items:start; }
  .badge { color:#fff; font-weight:700; border-radius:6px; padding:3px 6px; text-align:center; font-size:.85rem; }
  .ic { text-align:center; }
  .hr { font-variant-numeric:tabular-nums; }
  .vg { display:inline-block; font-size:.8rem; border:1px solid var(--bd); border-radius:999px; padding:0 8px; }
  footer p { margin:4px 0; }
  form { display:grid; gap:8px; grid-template-columns:1fr 1fr; }
  form label { display:grid; gap:4px; font-size:.875rem; }
  form input { font:inherit; padding:10px; border:1px solid var(--bd); border-radius:8px; background:var(--card); color:var(--tx); min-width:0; }
  form button { grid-column:1/-1; font:inherit; font-weight:600; padding:12px; border:0; border-radius:8px; background:var(--pri); color:var(--bg); }
  .err { max-width:720px; margin:0 auto; padding:0 16px; color:#c0392b; }
`;

// Recurso MCP App: recibe el CallToolResult del host (ui/notifications/tool-result) y lo pinta.
export function appHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Viaje</title><style>${ESTILOS}</style></head><body><div id="app"><p class="mu" style="padding:16px">Calculando viaje…</p></div>
<script>
const renderViaje = ${renderViaje.toString()};
const app = document.getElementById('app');
const send = (m) => parent.postMessage({ jsonrpc: '2.0', ...m }, '*');
const tema = (ctx) => ctx && ctx.theme && document.documentElement.setAttribute('data-theme', ctx.theme);
const tam = () => send({ method: 'ui/notifications/size-changed', params: { width: document.body.scrollWidth, height: document.body.scrollHeight } });
window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (!m || m.jsonrpc !== '2.0') return;
  if (m.id === 1 && m.result) { tema(m.result.hostContext); send({ method: 'ui/notifications/initialized', params: {} }); }
  if (m.method === 'ui/notifications/host-context-changed') tema(m.params);
  if (m.method === 'ui/notifications/tool-result') {
    const v = m.params && m.params.structuredContent;
    app.innerHTML = v && v.opciones ? renderViaje(v) : '<p class="err">' + ((m.params && m.params.content && m.params.content[0] && m.params.content[0].text) || 'Sin resultado').replace(/</g, '&lt;') + '</p>';
    tam();
  }
});
send({ id: 1, method: 'ui/initialize', params: { protocolVersion: '2026-01-26', appInfo: { name: 'bogota-al-dia-viaje', version: '1' }, appCapabilities: {} } });
</script></body></html>`;
}

// Página completa para /api/viaje?formato=html: formulario GET + resultado, cero JS.
export function paginaHtml({ v, q = {}, error } = {}) {
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const campo = (name, label, ph, type = 'text') =>
    `<label>${label}<input name="${name}" type="${type}" value="${e(q[name])}" placeholder="${ph}"${name === 'origen' || name === 'destino' ? ' required' : ''}></label>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Planear viaje · Bogotá al Día</title><meta name="description" content="Cómo llegar en TransMilenio y SITP con horarios oficiales, vagón y puerta.">
<style>${ESTILOS}</style></head><body>
<form method="get" action="/api/viaje">
  <h2 style="grid-column:1/-1">Planear viaje <a class="mu" href="/">Bogotá al Día</a></h2>
  ${campo('origen', 'Desde', 'Portal Norte, Br. San Joaquín o 4.65,-74.06')}
  ${campo('destino', 'Hasta', 'Calle 26')}
  ${campo('hora', 'Hora', '07:30', 'time')}
  ${campo('fecha', 'Fecha', '', 'date')}
  <input type="hidden" name="formato" value="html"><button>Buscar ruta</button>
</form>
${error ? `<p class="err">${e(error)}</p>` : ''}${v ? renderViaje(v) : ''}
</body></html>`;
}
