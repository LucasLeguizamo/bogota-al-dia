// Planeador de viajes en transporte público sobre el índice GTFS de cada municipio
// (data/transporte/<divipola>/red.json, generado por scripts/extract-transporte.ts).
// Algoritmo: RAPTOR (Delling, Pajor y Werneck, 2012) con horarios programados. Cada ronda
// permite un bus más, así que en una sola corrida salen la opción más rápida y la de menos
// transbordos. Cero dependencias, igual que lib/bogota.mjs.
import { existsSync, readFileSync } from 'node:fs';

const dataUrl = (f) => new URL(`../data/${f}`, import.meta.url);
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const CAMINA_MS = 1.2; // velocidad a pie (m/s)
const DESVIO = 1.25; // las calles no van en línea recta
const RADIO_TRANSBORDO = 400; // metros entre paradas para transbordo a pie
const MARGEN_TRANSBORDO = 60; // segundos para cambiar de bus
const MAX_BUSES = 5;
const AHORRO_POR_TRANSBORDO = 240; // un transbordo extra solo vale si ahorra 4 min

export const fuentes = () => JSON.parse(readFileSync(dataUrl('transporte/fuentes.json'), 'utf-8')).fuentes;

// Ciudad por nombre o código DIVIPOLA. Bogotá por defecto.
export function ciudad(q) {
  const f = fuentes();
  if (q == null || q === '') return f[0];
  return f.find((x) => x.municipio === String(q).padStart(5, '0') || norm(x.ciudad) === norm(q));
}

export function cobertura() {
  return fuentes().map(({ municipio, ciudad: c, sistema, entidad, oficial, licencia, publicar, pendiente }) => ({
    municipio,
    ciudad: c,
    sistema,
    entidad,
    oficial,
    licencia,
    disponible: publicar && existsSync(dataUrl(`transporte/${municipio}/red.json`)),
    ...(pendiente ? { pendiente } : {}),
  }));
}

const metros = (a, b) => {
  const dy = (a[2] - b[2]) * 110540;
  const dx = (a[3] - b[3]) * 111320 * Math.cos((a[2] * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
const aPie = (m) => Math.round((m * DESVIO) / CAMINA_MS);

const redes = {};
export function red(municipio = '11001') {
  if (redes[municipio]) return redes[municipio];
  const file = dataUrl(`transporte/${municipio}/red.json`);
  if (!existsSync(file)) return null;
  const r = JSON.parse(readFileSync(file, 'utf-8'));
  const P = r.paradas;
  // Rutas que pasan por cada parada
  r.enParada = P.map(() => []);
  r.patrones.forEach((p, pi) => p.s.forEach((s, i) => r.enParada[s].push(pi, i)));
  // Transbordos a pie: grilla de ~450 m para no comparar todas contra todas
  const celda = (p) => `${Math.floor(p[2] / 0.004)},${Math.floor(p[3] / 0.004)}`;
  const grilla = new Map();
  P.forEach((p, i) => p[6] === 0 && (grilla.get(celda(p)) ?? grilla.set(celda(p), []).get(celda(p))).push(i));
  r.cerca = (lat, lon, radio) => {
    const out = [];
    const cy = Math.floor(lat / 0.004);
    const cx = Math.floor(lon / 0.004);
    const k = Math.ceil(radio / 440);
    for (let y = cy - k; y <= cy + k; y++)
      for (let x = cx - k; x <= cx + k; x++)
        for (const j of grilla.get(`${y},${x}`) ?? []) {
          const d = metros([0, 0, lat, lon], P[j]);
          if (d <= radio) out.push([j, d]);
        }
    return out.sort((a, b) => a[1] - b[1]);
  };
  r.vecinos = P.map((p, i) =>
    p[6] === 0 && r.enParada[i].length ? r.cerca(p[2], p[3], RADIO_TRANSBORDO).filter(([j]) => j !== i && r.enParada[j].length).map(([j, d]) => [j, aPie(d) + MARGEN_TRANSBORDO]) : [],
  );
  return (redes[municipio] = r);
}

// --- Fecha y hora en Colombia (UTC-5, sin horario de verano) ---
function ahoraColombia() {
  const d = new Date(Date.now() - 5 * 3600e3);
  return { fecha: d.toISOString().slice(0, 10), hora: d.toISOString().slice(11, 16) };
}

function serviciosDelDia(r, fecha) {
  const ymd = fecha.replaceAll('-', '');
  const dow = (new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const activos = [];
  let festivo = false;
  for (const [id, s] of Object.entries(r.servicios)) {
    if (s.mas.includes(ymd)) festivo = festivo || s.d[dow] === '0';
    const on = s.menos.includes(ymd) ? false : s.mas.includes(ymd) ? true : s.d[dow] === '1' && (!s.desde || s.desde <= ymd) && (!s.hasta || ymd <= s.hasta);
    if (on) activos.push(id);
  }
  const dia = festivo ? 'festivo' : ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][dow];
  return { activos, dia };
}

// --- Lugares: coordenadas, estación, código de parada o nombre de parada/barrio ---
const esRegulacion = (p) => /regulaci/i.test(p[1]);
// Coincidencia por inicio de palabra ("norte" sí encuentra "Portal Norte"; "xx" no encuentra "Juan XXIII")
const enPalabra = (nombre, q) => q.length >= 3 && ` ${norm(nombre).replace(/[^a-z0-9 ]/g, ' ')}`.includes(` ${q.replace(/[^a-z0-9 ]/g, ' ')}`);

export function resolverLugar(r, q) {
  const texto = String(q ?? '').trim();
  if (!texto) throw new Error('Falta el lugar (nombre de estación, parada o "lat,lon")');
  const P = r.paradas;
  const m = /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(texto);
  if (m) {
    const [lat, lon] = [+m[1], +m[2]];
    let c = r.cerca(lat, lon, 700).filter(([j]) => r.enParada[j].length);
    if (!c.length) c = r.cerca(lat, lon, 1500).filter(([j]) => r.enParada[j].length);
    if (!c.length) throw new Error(`No hay paradas a menos de 1,5 km de ${texto}`);
    return { nombre: texto, lat, lon, paradas: c.slice(0, 40).map(([j, d]) => [j, aPie(d)]) };
  }
  const q2 = norm(texto);
  const hijas = (i) => P.flatMap((p, j) => (p[4] === i && !esRegulacion(p) && r.enParada[j].length ? [[j, 0]] : []));
  // 1) Estación (padre) por nombre exacto, luego por prefijo, luego por contenido
  const est = P.map((p, i) => [p, i]).filter(([p]) => p[6] === 1);
  const base = (n) => norm(n.split(' - ')[0]);
  const hit =
    est.find(([p]) => norm(p[1]) === q2 || base(p[1]) === q2) ??
    est.find(([p]) => base(p[1]).startsWith(q2)) ??
    est.filter(([p]) => enPalabra(p[1], q2)).sort((a, b) => a[0][1].length - b[0][1].length)[0];
  if (hit) {
    const ps = hijas(hit[1]);
    if (ps.length) return { nombre: hit[0][1], lat: hit[0][2], lon: hit[0][3], paradas: ps };
  }
  // 2) Parada por código exacto o por nombre ("Br. San Joaquín", "C.C. Andino"): ambos sentidos de la vía
  const paradas = P.map((p, i) => [p, i]).filter(([p, i]) => p[6] === 0 && r.enParada[i].length && !esRegulacion(p));
  const sinPrefijo = (n) => norm(n).replace(/^(br|barrio|c\.?c|centro comercial|est|estacion)\.?\s+/, '');
  const encontrada =
    paradas.find(([p]) => norm(p[5]) === q2 || norm(p[0]) === q2) ??
    paradas.find(([p]) => sinPrefijo(p[1]) === sinPrefijo(texto)) ??
    paradas.filter(([p]) => enPalabra(p[1], q2)).sort((a, b) => a[0][1].length - b[0][1].length)[0];
  if (!encontrada) throw new Error(`No encontré "${texto}". Prueba con el nombre de una estación, una parada o coordenadas "lat,lon".`);
  const [p] = encontrada;
  const c = r.cerca(p[2], p[3], 250).filter(([j]) => r.enParada[j].length);
  return { nombre: p[1], lat: p[2], lon: p[3], paradas: c.map(([j, d]) => [j, aPie(d)]) };
}

// --- Salidas de un patrón en el día: horarios fijos + frecuencias (TransMiCable) ---
function salidas(r, pi, activos, cache) {
  const key = pi;
  if (cache.has(key)) return cache.get(key);
  const p = r.patrones[pi];
  const fijas = activos.flatMap((s) => p.v[s] ?? []).sort((a, b) => a - b);
  const fq = activos.flatMap((s) => p.fq?.[s] ?? []);
  const fmax = p.f ? Math.max(...p.f) : 1;
  const out = { fijas, fq, fmax };
  cache.set(key, out);
  return out;
}

const factor = (p, inicio) => (p.f ? (p.f[Math.floor(inicio / 3600)] ?? 1) : 1);

// Primer viaje del patrón que pasa por la posición i a partir de `desde` (segundos del día)
function primerViaje(r, pi, i, desde, sal) {
  const p = r.patrones[pi];
  let mejor = null;
  const { fijas, fq, fmax } = sal;
  // Búsqueda binaria del primer inicio candidato y barrido corto (el factor horario no es monótono)
  let lo = 0;
  let hi = fijas.length;
  const limite = desde - p.t[i] * fmax;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (fijas[mid] < limite) lo = mid + 1;
    else hi = mid;
  }
  for (let k = lo, vistos = 0; k < fijas.length && vistos < 4; k++) {
    const f = factor(p, fijas[k]);
    const pasa = fijas[k] + p.t[i] * f;
    if (pasa < desde) continue;
    vistos++;
    if (!mejor || pasa < mejor.pasa) mejor = { inicio: fijas[k], f, pasa };
  }
  for (const [a, b, h] of fq) {
    const ini = Math.max(a, a + Math.ceil((desde - p.t[i] - a) / h) * h);
    if (ini >= b) continue;
    const pasa = ini + p.t[i];
    if (!mejor || pasa < mejor.pasa) mejor = { inicio: ini, f: 1, pasa };
  }
  return mejor;
}

function raptor(r, origen, destino, t0, activos) {
  const N = r.paradas.length;
  const tau = [new Float64Array(N).fill(Infinity)];
  const etiqueta = [new Map()];
  const mejor = new Float64Array(N).fill(Infinity);
  let marcadas = new Set();
  for (const [s, w] of origen.paradas) {
    if (t0 + w < tau[0][s]) {
      tau[0][s] = mejor[s] = t0 + w;
      etiqueta[0].set(s, { tipo: 'acceso', w });
      marcadas.add(s);
    }
  }
  const salida = new Map(destino.paradas.map(([s, w]) => [s, w]));
  const llegadaDestino = (k) => {
    let best = Infinity;
    let e = -1;
    for (const [s, w] of salida) if (tau[k][s] + w < best) (best = tau[k][s] + w), (e = s);
    return { best, e };
  };
  let cota = Infinity;
  const cache = new Map();
  const rondas = [];
  for (let k = 1; k <= MAX_BUSES && marcadas.size; k++) {
    tau[k] = tau[k - 1].slice();
    etiqueta[k] = new Map();
    // Patrones a revisar, desde la primera parada marcada de cada uno
    const cola = new Map();
    for (const s of marcadas) {
      const lista = r.enParada[s];
      for (let j = 0; j < lista.length; j += 2) {
        const pi = lista[j];
        const pos = lista[j + 1];
        if (!cola.has(pi) || pos < cola.get(pi)) cola.set(pi, pos);
      }
    }
    const nuevas = new Set();
    for (const [pi, pos0] of cola) {
      const p = r.patrones[pi];
      const sal = salidas(r, pi, activos, cache);
      let viaje = null;
      let sube = -1;
      for (let i = pos0; i < p.s.length; i++) {
        const s = p.s[i];
        if (viaje) {
          const llega = viaje.inicio + p.t[i] * viaje.f;
          if (llega < mejor[s] && llega < cota) {
            tau[k][s] = mejor[s] = llega;
            etiqueta[k].set(s, { tipo: 'bus', pi, inicio: viaje.inicio, f: viaje.f, i0: sube, i1: i });
            nuevas.add(s);
          }
        }
        const listo = tau[k - 1][s] + (k > 1 ? MARGEN_TRANSBORDO : 0);
        if (listo < Infinity && (!viaje || listo <= viaje.inicio + p.t[i] * viaje.f)) {
          const otro = primerViaje(r, pi, i, listo, sal);
          if (otro && (!viaje || otro.pasa < viaje.inicio + p.t[i] * viaje.f)) {
            viaje = otro;
            sube = i;
          }
        }
      }
    }
    // Transbordos a pie desde las paradas a las que se llegó en bus en esta ronda
    // (se toma la llegada en bus antes de relajar, para no encadenar dos caminatas)
    const enBus = [...nuevas].map((s) => [s, tau[k][s], etiqueta[k].get(s)]);
    for (const [s, llegoBus, bus] of enBus) {
      for (const [n, w] of r.vecinos[s]) {
        const llega = llegoBus + w;
        if (llega < mejor[n] && llega < cota) {
          tau[k][n] = mejor[n] = llega;
          etiqueta[k].set(n, { tipo: 'pie', desde: s, w, bus });
          nuevas.add(n);
        }
      }
    }
    marcadas = nuevas;
    const { best, e } = llegadaDestino(k);
    if (e >= 0 && best < cota) {
      cota = best;
      rondas.push({ k, e, llegada: best });
    }
  }
  return { tau, etiqueta, rondas, salida };
}

const hhmm = (s) => {
  const m = Math.round(s / 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const minutos = (s) => Math.max(1, Math.round(s / 60));

// "Calle 72 A - 2" → "vagón A, puerta 2" (convención de las estaciones troncales)
function plataforma(r, s) {
  const p = r.paradas[s];
  const padre = p[4] >= 0 ? r.paradas[p[4]] : null;
  const m = /\s([A-Z])\s*-\s*(\d+(?:\s*ó\s*\d+)?)\.?$/.exec(p[1]);
  return {
    parada: padre ? padre[1] : p[1],
    ...(m ? { vagon: m[1], puerta: m[2].replace(/\s+/g, ' ') } : padre ? { plataforma: p[1] } : {}),
    ...(p[5] && p[5] !== p[1] ? { codigo: p[5] } : {}),
    lat: p[2],
    lon: p[3],
  };
}

function reconstruir(r, res, k, e, t0, origen, destino) {
  const tramos = [];
  let s = e;
  const etiquetaEn = (k, s) => {
    for (let j = k; j >= 0; j--) if (res.etiqueta[j].has(s)) return [j, res.etiqueta[j].get(s)];
    return [-1, null];
  };
  let ronda = k;
  let forzada = null; // etiqueta de bus guardada por una caminata
  for (let guard = 0; guard < 50; guard++) {
    const [j, L] = forzada ? [ronda, forzada] : etiquetaEn(ronda, s);
    forzada = null;
    if (!L) break;
    ronda = j;
    if (L.tipo === 'acceso') {
      if (L.w > 30) tramos.unshift({ tipo: 'caminar', desde: origen.nombre, hasta: plataforma(r, s).parada, min: minutos(L.w) });
      break;
    }
    if (L.tipo === 'pie') {
      const [a, b] = [plataforma(r, L.desde), plataforma(r, s)];
      tramos.unshift({ tipo: 'caminar', desde: a.parada, hasta: b.parada, min: minutos(L.w - MARGEN_TRANSBORDO), transbordo: true, ...(a.parada === b.parada ? { misma_estacion: true } : {}) });
      s = L.desde;
      forzada = L.bus;
      continue;
    }
    const p = r.patrones[L.pi];
    const ruta = r.rutas[p.r];
    const sale = L.inicio + p.t[L.i0] * L.f;
    const llega = L.inicio + p.t[L.i1] * L.f;
    tramos.unshift({
      tipo: 'bus',
      ruta: ruta[1],
      nombre: ruta[2],
      sistema: ruta[3],
      color: `#${ruta[4]}`,
      hacia: plataforma(r, p.s.at(-1)).parada,
      sube: plataforma(r, p.s[L.i0]),
      baja: plataforma(r, p.s[L.i1]),
      sale: hhmm(sale),
      llega: hhmm(llega),
      paradas: L.i1 - L.i0,
      min: minutos(llega - sale),
      _sale: sale,
    });
    s = p.s[L.i0];
    ronda = j - 1;
  }
  const egreso = res.salida.get(e) ?? 0;
  if (egreso > 30) tramos.push({ tipo: 'caminar', desde: plataforma(r, e).parada, hasta: destino.nombre, min: minutos(egreso) });
  // Hora de salir: justo a tiempo para el primer bus (sin esperar de más en la parada)
  const primero = tramos.findIndex((t) => t.tipo === 'bus');
  const antes = tramos.slice(0, Math.max(primero, 0)).reduce((a, t) => a + t.min * 60, 0);
  const salir = primero >= 0 ? Math.max(t0, tramos[primero]._sale - antes) : t0;
  // Esperas: entre la llegada a la parada y la salida del bus
  let reloj = salir;
  for (const t of tramos) {
    if (t.tipo === 'caminar') reloj += t.min * 60;
    else {
      t.espera_min = Math.max(0, Math.round((t._sale - reloj) / 60));
      reloj = t._sale + t.min * 60;
      delete t._sale;
    }
  }
  return { tramos, salir };
}

/**
 * Planea un viaje. Devuelve opciones Pareto (más rápida ↔ menos transbordos).
 * @param {{origen:string,destino:string,hora?:string,fecha?:string,ciudad?:string}} q
 */
export function planearViaje({ origen, destino, hora, fecha, ciudad: c } = {}) {
  const fuente = ciudad(c);
  if (!fuente) throw new Error(`Ciudad no reconocida: ${c}. Ver cobertura_transporte.`);
  const r = red(fuente.municipio);
  if (!r) throw new Error(`${fuente.ciudad} aún no tiene red publicada${fuente.pendiente ? `: ${fuente.pendiente}` : ''}`);
  const ahora = ahoraColombia();
  fecha ||= ahora.fecha;
  hora ||= ahora.hora;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('fecha debe ser AAAA-MM-DD');
  const mh = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!mh) throw new Error('hora debe ser HH:MM');
  const t0 = +mh[1] * 3600 + +mh[2] * 60;
  const o = resolverLugar(r, origen);
  const d = resolverLugar(r, destino);
  const { activos, dia } = serviciosDelDia(r, fecha);
  const res = raptor(r, o, d, t0, activos);

  // Pareto con tolerancia: un bus más solo entra si ahorra AHORRO_POR_TRANSBORDO
  const elegidas = [];
  for (const x of res.rondas) if (!elegidas.length || x.llegada <= elegidas.at(-1).llegada - AHORRO_POR_TRANSBORDO) elegidas.push(x);
  const opciones = elegidas.map(({ k, e, llegada }) => {
    const { tramos, salir } = reconstruir(r, res, k, e, t0, o, d);
    const buses = tramos.filter((t) => t.tipo === 'bus');
    return {
      sale: hhmm(salir),
      llega: hhmm(llegada),
      duracion_min: minutos(llegada - salir),
      transbordos: buses.length - 1,
      caminata_min: tramos.filter((t) => t.tipo === 'caminar').reduce((a, t) => a + t.min, 0),
      espera_min: buses.reduce((a, t) => a + t.espera_min, 0),
      tramos,
    };
  });
  opciones.forEach((op, i) => {
    op.etiqueta = opciones.length === 1 ? 'Recomendada' : i === 0 ? 'Menos transbordos' : i === opciones.length - 1 ? 'Más rápida' : 'Equilibrada';
  });
  // Caminar puede ganarle a todo en trayectos cortos
  const directo = metros([0, 0, o.lat, o.lon], [0, 0, d.lat, d.lon]);
  const caminar = directo < 2000 ? { caminar_min: minutos(aPie(directo)) } : {};

  const avisos = ['Horarios programados del GTFS oficial: no hay datos en tiempo real de buses en Colombia.'];
  if (!opciones.length) avisos.unshift(`No encontré un viaje con hasta ${MAX_BUSES} buses saliendo a las ${hora}. Prueba otra hora o un lugar cercano.`);
  if (!r.oficial) avisos.push('Feed comunitario, no oficial: los horarios pueden estar desactualizados.');
  return {
    ciudad: r.ciudad,
    municipio: r.municipio,
    origen: { nombre: o.nombre, lat: o.lat, lon: o.lon },
    destino: { nombre: d.nombre, lat: d.lat, lon: d.lon },
    fecha,
    hora,
    dia,
    opciones,
    ...caminar,
    avisos,
    fuente: { entidad: r.entidad, licencia: r.licencia, archivo: r.fuente, generado: r.generado, vigencia: r.feed },
  };
}

// Paradas cercanas a un punto con las rutas que pasan (para "¿qué me sirve aquí?")
export function paradasCercanas({ lat, lon, radio = 400, ciudad: c, limit = 10 } = {}) {
  const fuente = ciudad(c);
  const r = fuente && red(fuente.municipio);
  if (!r) throw new Error('Ciudad sin red publicada. Ver cobertura_transporte.');
  if (!Number.isFinite(+lat) || !Number.isFinite(+lon)) throw new Error('lat y lon son obligatorios');
  return r
    .cerca(+lat, +lon, Math.min(+radio || 400, 2000))
    .filter(([j]) => r.enParada[j].length)
    .slice(0, limit)
    .map(([j, dm]) => {
      const rutas = new Set();
      for (let k = 0; k < r.enParada[j].length; k += 2) rutas.add(r.rutas[r.patrones[r.enParada[j][k]].r][1]);
      return { ...plataforma(r, j), distancia_m: Math.round(dm), camina_min: minutos(aPie(dm)), rutas: [...rutas].sort() };
    });
}

// Recorrido de una ruta: paradas en orden por cada patrón (sentido/variante)
export function recorridoRuta({ ruta, ciudad: c } = {}) {
  const fuente = ciudad(c);
  const r = fuente && red(fuente.municipio);
  if (!r) throw new Error('Ciudad sin red publicada. Ver cobertura_transporte.');
  const q = norm(ruta);
  const ids = new Set(r.rutas.map((x, i) => [x, i]).filter(([x]) => norm(x[1]) === q || norm(x[0]) === q).map(([, i]) => i));
  if (!ids.size) throw new Error(`Ruta no encontrada: ${ruta}`);
  return r.patrones
    .filter((p) => ids.has(p.r))
    .map((p) => {
      const x = r.rutas[p.r];
      const viajes = Object.values(p.v).reduce((a, v) => a + v.length, 0);
      return {
        ruta: x[1],
        nombre: x[2],
        sistema: x[3],
        hacia: plataforma(r, p.s.at(-1)).parada,
        duracion_min: minutos(p.t.at(-1)),
        viajes_programados: viajes,
        paradas: p.s.map((s, i) => ({ ...plataforma(r, s), min: Math.round(p.t[i] / 60) })),
      };
    })
    .sort((a, b) => b.viajes_programados - a.viajes_programados);
}

// Texto plano para bots de chat (WhatsApp, Telegram, Grok...)
export function viajeComoTexto(v) {
  const lugar = (x) => `${x.parada}${x.vagon ? ` (vagón ${x.vagon}, puerta ${x.puerta})` : x.plataforma ? ` (${x.plataforma})` : ''}`;
  const out = [`🚌 ${v.origen.nombre} → ${v.destino.nombre} · ${v.dia} ${v.fecha} ${v.hora}`];
  v.opciones.forEach((op, i) => {
    out.push('', `${i + 1}. ${op.etiqueta}: sal a las ${op.sale}, llegas ${op.llega} (${op.duracion_min} min, ${op.transbordos} transbordo${op.transbordos === 1 ? '' : 's'}, ${op.caminata_min} min a pie)`);
    for (const t of op.tramos) {
      if (t.tipo === 'caminar') out.push(t.misma_estacion ? `   🔁 Cambia de vagón en ${t.hasta} (${t.min} min)` : `   🚶 Camina ${t.min} min a ${t.hasta}`);
      else out.push(`   🚍 ${t.ruta} hacia ${t.hacia}: sube en ${lugar(t.sube)} ${t.sale}${t.espera_min ? ` (esperas ~${t.espera_min} min)` : ''}, baja en ${lugar(t.baja)} ${t.llega} · ${t.paradas} paradas`);
    }
  });
  if (v.caminar_min) out.push('', `🚶 A pie directo: ~${v.caminar_min} min.`);
  out.push('', ...v.avisos.map((a) => `ℹ️ ${a}`), `Datos: ${v.fuente.entidad}, ${v.fuente.licencia ?? 'licencia no declarada'}.`);
  return out.join('\n');
}
