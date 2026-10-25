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
const MARGEN_TRANSBORDO = 60; // segundos para cambiar de bus en la misma parada (se suma al abordar)
const MIN_MISMA_ESTACION = 120; // cambiar de vagón dentro de una troncal (túnel/pasarela): ≥ 2 min + margen = 3 min
const CRUCE_CALLE = 90; // salir de una estación o parada, cruzar la vía, torniquete/validador
const RADIO_ESTACION = 300; // paradas zonales alrededor de una estación que también sirven para salir/llegar
const MAX_BUSES = 5;
const AHORRO_POR_TRANSBORDO = 240; // un transbordo extra solo vale si ahorra 4 min…
const PESO_CAMINATA_EXTRA = 0.5; // …más medio minuto por cada minuto extra a pie
const SIN_SERVICIO_MIN = 30; // si el primer bus sale 30+ min después de la hora pedida, se avisa
const DIA = 86400;

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

function nombreCorto(nombre, hija) {
  if (!hija) return nombre;
  const h = canon(hija.replace(/\s[A-Z]\s*-.*$/, '').replace(/\s(T-?\d.*|Alim.*|Plat.*)$/i, ''));
  if (!h) return nombre;
  const [primera] = nombre.split(/ [-–] /);
  const cp = canon(primera);
  if (primera !== nombre && (cp === h || cp.endsWith(` ${h}`))) return primera;
  // Sin guion ("Universidades CityU"): las primeras palabras si coinciden con las plataformas
  const palabras = nombre.split(' ');
  const n = h.split(' ').length;
  if (n < palabras.length && canon(palabras.slice(0, n).join(' ')) === h) return palabras.slice(0, n).join(' ');
  return nombre;
}

// Tipo de servicio normalizado a partir de la agencia del GTFS (se conserva `sistema` tal cual)
export function sistemaTipo(agencia, routeType) {
  const a = norm(agencia);
  if (routeType === 6 || /cable/.test(a)) return 'cable';
  if (/dual/.test(a)) return 'dual';
  if (/alimenta/.test(a)) return 'alimentador';
  if (/troncal/.test(a)) return 'troncal';
  if (/complementa/.test(a)) return 'complementario';
  if (/especial/.test(a)) return 'especial';
  if (/zonal|urbano|sitp/.test(a)) return 'zonal';
  return 'otro';
}

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
  // [vecino, segundos de transbordo sin el margen de abordaje, segundos caminando de verdad]
  r.vecinos = P.map((p, i) =>
    p[6] === 0 && r.enParada[i].length
      ? r
          .cerca(p[2], p[3], RADIO_TRANSBORDO)
          .filter(([j]) => j !== i && r.enParada[j].length)
          .map(([j, d]) => {
            const camina = aPie(d);
            const misma = p[4] >= 0 && p[4] === P[j][4];
            return [j, misma ? Math.max(MIN_MISMA_ESTACION, camina) : camina + CRUCE_CALLE, camina];
          })
      : [],
  );
  // Nombre corto de cada estación, sin patrocinio ("Portal Sur - JFK Coop. Financiera" → "Portal Sur").
  // Solo se corta si las plataformas confirman que lo de después del guion es comercial
  // ("Suba - Calle 95" se queda entero porque sus plataformas dicen "Suba - Calle 95").
  const primeraHija = new Map();
  P.forEach((p) => p[4] >= 0 && !primeraHija.has(p[4]) && !esRegulacion(p) && primeraHija.set(p[4], p[1]));
  r.cortos = P.map((p, i) => (p[6] === 1 ? nombreCorto(p[1], primeraHija.get(i)) : p[1]));
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

const otroDia = (fecha, n) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * DIA * 1000).toISOString().slice(0, 10);

// --- Lugares: coordenadas, estación, código de parada o nombre de parada/barrio ---
const esRegulacion = (p) => /regulaci/i.test(p[1]);
// Forma canónica para comparar nombres: sin tildes ni puntuación y con las abreviaturas de la
// nomenclatura bogotana expandidas ("Av. Jiménez" = "Avenida Jiménez", "C.C. Andino" = "Centro Comercial Andino")
const ABREV = { av: 'avenida', avda: 'avenida', ak: 'avenida carrera', ac: 'avenida calle', cl: 'calle', cll: 'calle', clle: 'calle', k: 'carrera', kr: 'carrera', kra: 'carrera', cra: 'carrera', cr: 'carrera', dg: 'diagonal', tv: 'transversal', br: 'barrio', hsp: 'hospital', pq: 'parque', est: 'estacion', u: 'universidad', univ: 'universidad', cc: 'centro comercial', eldorado: 'el dorado' };
const canon = (s) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bc c\b/g, 'cc')
    .replace(/\b(ak|ac|av|cl|cll|kr|cra|k|dg|tv)(\d)/g, '$1 $2')
    .split(' ')
    .map((w) => ABREV[w] ?? w)
    .join(' ')
    .replace(/\bportal (de la|de las|de los|del|de) /g, 'portal ')
    .trim();
// Nombre de la estación sin el patrocinio ("Calle 26 - Atrio" → "calle 26")
const base = (n) => canon(String(n).split(/ [-–] /)[0]);
const sinPrefijo = (c) => c.replace(/^(barrio|centro comercial|estacion|hospital|parque) /, '');
// Coincidencia por inicio de palabra ("norte" sí encuentra "Portal Norte"; "xx" no encuentra "Juan XXIII")
const enPalabra = (c, q) => q.length >= 3 && ` ${c} `.includes(` ${q}`);

// Nombres canónicos precalculados por red (canon() sobre ~8 mil paradas cuesta ~10 ms por consulta)
function indiceLugares(r, usable) {
  const P = r.paradas;
  const hijas = new Map();
  P.forEach((p, j) => p[4] >= 0 && usable(j) && (hijas.get(p[4]) ?? hijas.set(p[4], []).get(p[4])).push(j));
  const nombres = P.map((p, i) => {
    if (p[6] === 1)
      // Nombre corto de las plataformas, sin patrocinio: "Universidades A - 4 ó 6" → "universidades"
      return hijas.has(i) ? { c: canon(p[1]), b: base(p[1]), corto: canon(P[hijas.get(i)[0]][1].replace(/\s[A-Z]\s*-.*$/, '')) } : null;
    return p[4] < 0 && usable(i) ? { c: canon(p[1]), cod: [norm(p[5]).replace(/_tm$/, ''), norm(p[0])] } : null;
  });
  return { hijas, nombres };
}

export function resolverLugar(r, q) {
  const texto = String(q ?? '').trim();
  if (!texto) throw new Error('Falta el lugar (nombre de estación, parada o "lat,lon")');
  const P = r.paradas;
  const m = /^(-?\d{1,2}(?:\.\d+)?)(?:\s*[,;]\s*|\s+)(-?\d{1,3}(?:\.\d+)?)$/.exec(texto);
  if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180 && (m[1].includes('.') || m[2].includes('.'))) {
    const [lat, lon] = [+m[1], +m[2]];
    let c = r.cerca(lat, lon, 700).filter(([j]) => r.enParada[j].length && !esRegulacion(P[j]));
    if (!c.length) c = r.cerca(lat, lon, 1500).filter(([j]) => r.enParada[j].length && !esRegulacion(P[j]));
    if (!c.length) throw new Error(`No hay paradas a menos de 1,5 km de ${texto}`);
    return { nombre: texto, etiqueta: `Cerca de ${plataforma(r, c[0][0]).nombre_corto}`, lat, lon, paradas: c.slice(0, 40).map(([j, d]) => [j, aPie(d)]) };
  }
  const q2 = canon(texto);
  const qCodigo = norm(texto).replace(/_tm$/, '');
  const usable = (j) => r.enParada[j].length && !esRegulacion(P[j]);
  const { hijas, nombres } = (r.indiceLugares ??= indiceLugares(r, usable));

  // Candidatos con su nivel de coincidencia (menor = mejor)
  const cand = [];
  P.forEach((p, i) => {
    const x = nombres[i];
    if (!x) return;
    const { c } = x;
    if (p[6] === 1) {
      const { b, corto } = x;
      const nivel = c === q2 || b === q2 || corto === q2 ? 1 : enPalabra(c, q2) || enPalabra(corto, q2) ? 2 : 0;
      if (nivel) cand.push({ i, nivel, estacion: true, c });
    } else {
      const codigo = x.cod.includes(qCodigo);
      const nivel = codigo ? 0 : c === q2 ? 1.5 : sinPrefijo(c) === sinPrefijo(q2) ? 1.6 : enPalabra(c, q2) ? 3 : -1;
      if (nivel >= 0) cand.push({ i, nivel, estacion: false, c });
    }
  });
  if (!cand.length) throw new Error(`No encontré "${texto}". Prueba con el nombre de una estación, una parada o coordenadas "lat,lon".`);
  // A igual nivel: un portal (para "Usme", "Suba", "Tunal"), luego estación, luego el nombre más corto
  // A igual nivel: estación y luego el nombre más corto. Un portal que contiene la palabra gana a
  // las demás estaciones ("Suba" → Portal Suba, no Suba - Calle 95), con sugerencias de las otras.
  const nv = (x) => (x.estacion && x.nivel <= 2 && x.c.startsWith('portal ') && !q2.startsWith('portal') ? 0.9 : x.nivel);
  cand.sort((a, b) => nv(a) - nv(b) || b.estacion - a.estacion || P[a.i][1].length - P[b.i][1].length);
  const elegido = cand[0];
  const pe = P[elegido.i];

  // Sugerencias: otros lugares que también coinciden y quedan lejos del elegido
  const sugerencias = [];
  if (elegido.nivel > 1.6 || nv(elegido) < elegido.nivel || cand.some((x) => x !== elegido && x.nivel <= 1.6 && metros(P[x.i], pe) > 1000)) {
    const vistos = [pe];
    for (const x of cand.slice(1)) {
      const p = P[x.i];
      if (x.nivel > elegido.nivel + 2 || vistos.some((v) => metros(v, p) < 600 && (canon(v[1]) === x.c || metros(v, p) < 250))) continue;
      vistos.push(p);
      sugerencias.push({ nombre: p[1], tipo: x.estacion ? 'estacion' : 'parada', ...(p[5] && !x.estacion ? { codigo: p[5] } : {}), lat: p[2], lon: p[3] });
      if (sugerencias.length === 5) break;
    }
  }
  const extra = sugerencias.length ? { sugerencias } : {};

  if (elegido.estacion) {
    // Plataformas de la estación + paradas zonales a la salida (cruzar la calle y entrar/salir de la estación)
    const ps = hijas.get(elegido.i).map((j) => [j, 0]);
    const dentro = new Set(ps.map(([j]) => j));
    for (const [j, d] of r.cerca(pe[2], pe[3], RADIO_ESTACION)) if (!dentro.has(j) && usable(j)) ps.push([j, aPie(d) + CRUCE_CALLE]);
    return { nombre: pe[1], etiqueta: r.cortos[elegido.i], lat: pe[2], lon: pe[3], paradas: ps, ...extra };
  }
  const c = r.cerca(pe[2], pe[3], 250).filter(([j]) => usable(j));
  return { nombre: pe[1], etiqueta: pe[1], lat: pe[2], lon: pe[3], ...(pe[5] ? { codigo: pe[5] } : {}), paradas: c.map(([j, d]) => [j, aPie(d)]), ...extra };
}

// --- Salidas de un patrón en el día: horarios fijos + frecuencias (TransMiCable) ---
// `ayer` = servicios del día anterior: sus viajes de después de medianoche (GTFS 24:xx, 25:xx)
// se pasan al día pedido restando 24 h, para que una consulta a las 00:30 los vea.
function salidas(r, pi, dia, cache) {
  if (cache.has(pi)) return cache.get(pi);
  const p = r.patrones[pi];
  const fmax = p.f ? Math.max(1, ...p.f) : 1;
  const fijas = dia.activos.flatMap((s) => p.v[s] ?? []);
  const fq = dia.activos.flatMap((s) => p.fq?.[s] ?? []);
  if (dia.ayer) {
    const dur = p.t.at(-1) * fmax;
    for (const s of dia.ayer) {
      for (const x of p.v[s] ?? []) if (x + dur >= DIA) fijas.push(x - DIA);
      for (const [a, b, h] of p.fq?.[s] ?? []) if (b + p.t.at(-1) > DIA) fq.push([a - DIA, b - DIA, h]);
    }
  }
  fijas.sort((a, b) => a - b);
  const out = { fijas, fq, fmax };
  cache.set(pi, out);
  return out;
}

const factor = (p, inicio) => (p.f ? (p.f[Math.floor(Math.max(0, inicio) / 3600)] ?? 1) : 1);

// Viaje del patrón que pasa antes por la posición i a partir de `desde` (segundos del día).
// El factor horario hace que un viaje pueda adelantar a otro (no FIFO), así que se miran varios.
function primerViaje(r, pi, i, desde, sal) {
  const p = r.patrones[pi];
  let mejor = null;
  const { fijas, fq, fmax } = sal;
  let lo = 0;
  let hi = fijas.length;
  const limite = desde - p.t[i] * fmax; // ningún viaje que sale antes de esto alcanza a pasar después de `desde`
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

// RAPTOR. tau[k][s] = mejor hora en s con ≤ k buses (en bus o caminando); `enBus[k]` guarda solo
// las llegadas en bus de la ronda k: de ahí salen los transbordos a pie y la llegada al destino,
// así nunca se encadenan dos caminatas (bus → caminar → caminar).
function raptor(r, origen, destino, t0, dia) {
  const N = r.paradas.length;
  const tau = [new Float64Array(N).fill(Infinity)];
  const etiqueta = [new Map()];
  const enBus = [new Map()];
  const mejor = new Float64Array(N).fill(Infinity);
  const mejorBus = new Float64Array(N).fill(Infinity);
  let marcadas = new Set();
  for (const [s, w] of origen.paradas) {
    if (t0 + w < tau[0][s]) {
      tau[0][s] = mejor[s] = t0 + w;
      etiqueta[0].set(s, { tipo: 'acceso', w });
      marcadas.add(s);
    }
  }
  const salida = new Map();
  for (const [s, w] of destino.paradas) if (!(salida.get(s) <= w)) salida.set(s, w);
  let cota = Infinity;
  const cache = new Map();
  const rondas = [];
  for (let k = 1; k <= MAX_BUSES && marcadas.size; k++) {
    tau[k] = tau[k - 1].slice();
    etiqueta[k] = new Map();
    enBus[k] = new Map();
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
      const sal = salidas(r, pi, dia, cache);
      let viaje = null;
      let sube = -1;
      for (let i = pos0; i < p.s.length; i++) {
        const s = p.s[i];
        if (viaje) {
          const llega = viaje.inicio + p.t[i] * viaje.f;
          if (llega < mejorBus[s] && llega < cota) {
            const L = { tipo: 'bus', pi, inicio: viaje.inicio, f: viaje.f, i0: sube, i1: i, llega };
            mejorBus[s] = llega;
            enBus[k].set(s, L);
            if (llega < mejor[s]) {
              tau[k][s] = mejor[s] = llega;
              etiqueta[k].set(s, L);
              nuevas.add(s);
            }
          }
        }
        // Se aborda con lo que se logró en la ronda anterior (tau[k-1]); la ronda 1 sale del acceso a pie
        const prev = tau[k - 1][s];
        if (prev === Infinity) continue;
        const listo = prev + (k === 1 ? 0 : MARGEN_TRANSBORDO);
        const actual = viaje ? viaje.inicio + p.t[i] * viaje.f : Infinity;
        if (listo <= actual) {
          const otro = primerViaje(r, pi, i, listo, sal);
          if (otro && otro.pasa < actual) {
            viaje = otro;
            sube = i;
          }
        }
      }
    }
    // Transbordos a pie, solo desde llegadas en bus de esta ronda
    for (const [s, bus] of enBus[k]) {
      for (const [n, w, camina] of r.vecinos[s]) {
        const llega = bus.llega + w;
        if (llega < mejor[n] && llega < cota) {
          tau[k][n] = mejor[n] = llega;
          etiqueta[k].set(n, { tipo: 'pie', desde: s, w, camina, bus });
          nuevas.add(n);
        }
      }
    }
    marcadas = nuevas;
    let best = Infinity;
    let e = -1;
    for (const [s, w] of salida) {
      const L = enBus[k].get(s);
      if (L && L.llega + w < best) (best = L.llega + w), (e = s);
    }
    if (e >= 0 && best < cota) {
      cota = best;
      rondas.push({ k, e, llegada: best });
    }
  }
  return { tau, etiqueta, enBus, rondas, salida };
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
  const parada = padre ? padre[1] : p[1];
  return {
    parada,
    nombre_corto: padre ? r.cortos[p[4]] : parada,
    ...(m ? { vagon: m[1], puerta: m[2].replace(/\s+/g, ' ') } : padre ? { plataforma: p[1] } : {}),
    ...(p[5] && p[5] !== p[1] ? { codigo: p[5] } : {}),
    lat: p[2],
    lon: p[3],
  };
}

// Letrero del bus. En rutas circulares (termina donde empezó: TransMiCable, alimentadores) el
// destino final es el mismo origen, así que mientras va de ida se muestra el punto de retorno.
function hacia(r, p, i1 = 0, corto = false) {
  const nombre = (j) => plataforma(r, p.s[j])[corto ? 'nombre_corto' : 'parada'];
  const n = p.s.length;
  if (n > 2 && nombre(0) === nombre(n - 1) && i1 < Math.floor((n - 1) / 2) + 1) return nombre(Math.floor((n - 1) / 2));
  return nombre(n - 1);
}

function reconstruir(r, res, k, e, t0, origen, destino) {
  const tramos = [];
  let s = e;
  const etiquetaEn = (k, s) => {
    for (let j = k; j >= 0; j--) if (res.etiqueta[j].has(s)) return [j, res.etiqueta[j].get(s)];
    return [-1, null];
  };
  let ronda = k;
  let forzada = res.enBus[k].get(e); // al destino siempre se llega en bus (luego se camina)
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
      const misma = r.paradas[L.desde][4] >= 0 && r.paradas[L.desde][4] === r.paradas[s][4];
      tramos.unshift({ tipo: 'caminar', desde: a.parada, hasta: b.parada, min: minutos(L.w), transbordo: true, ...(misma ? { misma_estacion: true } : {}) });
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
      sistema_tipo: sistemaTipo(ruta[3], ruta[5]),
      color: `#${ruta[4]}`,
      hacia: hacia(r, p, L.i1),
      hacia_corto: hacia(r, p, L.i1, true),
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
  // Transbordo en la misma parada: tramo explícito de 0 min para que la interfaz lo dibuje
  for (let i = tramos.length - 1; i > 0; i--)
    if (tramos[i].tipo === 'bus' && tramos[i - 1].tipo === 'bus')
      tramos.splice(i, 0, { tipo: 'caminar', desde: tramos[i].sube.parada, hasta: tramos[i].sube.parada, min: 0, transbordo: true, misma_parada: true });
  const egreso = res.salida.get(e) ?? 0;
  const ultimo = res.enBus[k].get(e).llega;
  // Egreso de menos de 30 s no se muestra: entonces la llegada es la del bus (no 1 min después)
  if (egreso > 30) tramos.push({ tipo: 'caminar', desde: plataforma(r, e).parada, hasta: destino.nombre, min: minutos(egreso) });
  const llegada = ultimo + (egreso > 30 ? egreso : 0);
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
  return { tramos, salir, llegada };
}

// Opciones de una corrida de RAPTOR. Pareto con tolerancia: un bus más solo entra si ahorra
// AHORRO_POR_TRANSBORDO más PESO_CAMINATA_EXTRA por cada segundo extra a pie.
function opcionesDe(r, res, t0, o, d) {
  const todas = res.rondas.map(({ k, e }) => {
    const { tramos, salir, llegada } = reconstruir(r, res, k, e, t0, o, d);
    const buses = tramos.filter((t) => t.tipo === 'bus');
    return {
      sale: hhmm(salir),
      llega: hhmm(llegada),
      duracion_min: minutos(llegada - salir),
      transbordos: buses.length - 1,
      caminata_min: tramos.filter((t) => t.tipo === 'caminar').reduce((a, t) => a + t.min, 0),
      espera_min: buses.reduce((a, t) => a + t.espera_min, 0),
      tramos,
      _llega: llegada,
      _sale: salir,
    };
  });
  const elegidas = [];
  for (const x of todas) {
    const prev = elegidas.at(-1);
    if (!prev || x._llega <= prev._llega - AHORRO_POR_TRANSBORDO - PESO_CAMINATA_EXTRA * 60 * Math.max(0, x.caminata_min - prev.caminata_min)) elegidas.push(x);
  }
  elegidas.forEach((op, i) => {
    op.etiqueta = elegidas.length === 1 ? 'Recomendada' : i === 0 ? 'Menos transbordos' : i === elegidas.length - 1 ? 'Más rápida' : 'Equilibrada';
  });
  // La que recomendamos: llegar antes, pero cada transbordo "cuesta" 4 min y caminar un cuarto
  const costo = (x) => x._llega + AHORRO_POR_TRANSBORDO * x.transbordos + 15 * x.caminata_min;
  const rec = elegidas.reduce((a, x) => (a && costo(a) <= costo(x) ? a : x), null);
  if (rec) rec.recomendada = true;
  return elegidas;
}

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * Planea un viaje. Devuelve opciones Pareto (más rápida ↔ menos transbordos).
 * Si a esa hora ya no hay servicio, busca la primera salida del día siguiente (`sin_servicio`).
 * @param {{origen:string,destino:string,hora?:string,fecha?:string,ciudad?:string}} q
 */
export function planearViaje(q = {}) {
  // Entradas acotadas: el MCP y /api/tools no recortan, y nombres > 200 caracteres no existen
  const corta = (x) => (x == null ? x : String(x).slice(0, 200));
  let { origen, destino, hora, fecha, ciudad: c } = Object.fromEntries(['origen', 'destino', 'hora', 'fecha', 'ciudad'].map((k) => [k, corta(q[k])]));
  const fuente = ciudad(c);
  if (!fuente) throw new Error(`Ciudad no reconocida: ${c}. Ver cobertura_transporte.`);
  const r = red(fuente.municipio);
  if (!r) throw new Error(`${fuente.ciudad} aún no tiene red publicada${fuente.pendiente ? `: ${fuente.pendiente}` : ''}`);
  const ahora = ahoraColombia();
  fecha ||= ahora.fecha;
  hora ||= ahora.hora;
  // Ida y vuelta por Date: rechaza 2026-02-31 (Date.parse lo corre a marzo)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || new Date(`${fecha}T12:00:00Z`).toISOString?.().slice(0, 10) !== fecha) throw new Error('fecha debe ser AAAA-MM-DD');
  const ymd = fecha.replaceAll('-', '');
  const { desde, hasta } = r.feed ?? {};
  const iso = (x) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6)}`;
  if (desde && hasta && (ymd < desde || ymd > hasta)) throw new Error(`Hay horarios del ${iso(desde)} al ${iso(hasta)}; ${fecha} está fuera de la vigencia del feed.`);
  const mh = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!mh || +mh[1] > 23 || +mh[2] > 59) throw new Error('hora debe ser HH:MM');
  hora = `${mh[1].padStart(2, '0')}:${mh[2]}`;
  const t0 = +mh[1] * 3600 + +mh[2] * 60;
  const o = resolverLugar(r, origen);
  const d = resolverLugar(r, destino);
  const hoy = serviciosDelDia(r, fecha);
  // Antes de las 4 a. m. todavía corren viajes del día anterior (horas GTFS 24:xx)
  const ayer = t0 < 4 * 3600 ? serviciosDelDia(r, otroDia(fecha, -1)).activos : null;
  let opciones = opcionesDe(r, raptor(r, o, d, t0, { activos: hoy.activos, ayer }), t0, o, d);
  const avisos = ['Horarios programados del GTFS oficial: no hay datos en tiempo real de buses en Colombia.'];
  let sinServicio = null;
  // Nada desde esa hora: primera salida de los próximos días (domingo/festivo → hábil puede saltar dos días)
  for (let n = 1; n <= 3 && !opciones.length; n++) {
    const otro = otroDia(fecha, n);
    if (hasta && otro.replaceAll('-', '') > hasta) break;
    const sig = serviciosDelDia(r, otro);
    const ops = opcionesDe(r, raptor(r, o, d, 0, { activos: sig.activos, ayer: null }), 0, o, d);
    if (ops.length) {
      opciones = ops.map((op) => ({ ...op, fecha: otro }));
      const primera = hhmm(Math.min(...opciones.map((x) => x._sale)));
      sinServicio = { hora, reanuda: { fecha: otro, hora: primera, dia: sig.dia } };
      avisos.unshift(`No hay salidas para este viaje desde las ${hora} del ${hoy.dia} ${fecha}. La próxima es el ${sig.dia} ${otro} a las ${primera}.`);
    }
  }
  if (!sinServicio && opciones.length) {
    const primera = Math.min(...opciones.map((x) => x._sale));
    if (primera - t0 >= SIN_SERVICIO_MIN * 60) {
      sinServicio = { hora, reanuda: { fecha, hora: hhmm(primera), dia: hoy.dia } };
      avisos.unshift(`A las ${hora} aún no hay servicio para este viaje: la primera salida es a las ${hhmm(primera)}.`);
    }
  }
  const directo = metros([0, 0, o.lat, o.lon], [0, 0, d.lat, d.lon]);
  if (!opciones.length && directo >= 300) avisos.unshift(`No encontré un viaje con hasta ${MAX_BUSES} buses saliendo a las ${hora} ni en los 3 días siguientes. Prueba un lugar cercano o con coordenadas.`);
  for (const op of opciones) delete op._llega, delete op._sale;
  for (const [x, rol] of [[o, 'origen'], [d, 'destino']])
    if (x.sugerencias) avisos.push(`"${rol === 'origen' ? origen : destino}" coincide con varios lugares; usé ${x.nombre}. Si no era, prueba: ${x.sugerencias.map((s) => (s.nombre === x.nombre && s.codigo ? `${s.nombre} (${s.codigo})` : s.nombre)).join(', ')}.`);
  if (!r.oficial) avisos.push('Feed comunitario, no oficial: los horarios pueden estar desactualizados.');
  // Caminar puede ganarle a todo en trayectos cortos
  const caminar = directo < 2000 ? { caminar_min: minutos(aPie(directo)) } : {};
  // Origen = destino o a una cuadra: nada de buses (el tiempo a pie ya va en caminar_min).
  // ponytail: no se descartan buses más lentos que caminar; de noche o con carga, el bus sigue siendo opción.
  if (directo < 300) {
    opciones = [];
    sinServicio = null;
    avisos.unshift(`Están a ~${Math.round(directo)} m: camina (~${caminar.caminar_min} min).`);
  }
  const lugar = (x) => ({ nombre: x.nombre, etiqueta: x.etiqueta, lat: x.lat, lon: x.lon, ...(x.codigo ? { codigo: x.codigo } : {}) });
  const sugerencias = o.sugerencias || d.sugerencias ? { sugerencias: { ...(o.sugerencias ? { origen: o.sugerencias } : {}), ...(d.sugerencias ? { destino: d.sugerencias } : {}) } } : {};
  return {
    ciudad: r.ciudad,
    municipio: r.municipio,
    origen: lugar(o),
    destino: lugar(d),
    fecha,
    hora,
    dia: hoy.dia,
    opciones,
    ...caminar,
    ...(sinServicio ? { sin_servicio: sinServicio } : {}),
    ...sugerencias,
    avisos,
    fuente: { entidad: r.entidad, licencia: r.licencia, archivo: r.fuente, generado: r.generado, vigencia: r.feed },
  };
}

// Nombres buscables que sí resuelven (para autocompletar): estaciones por su nombre corto y los
// paraderos/barrios con más rutas, sin repetir nombres. Se calcula una vez por red.
export function lugaresSugeridos(c, limite = 400) {
  const fuente = ciudad(c);
  const r = fuente && red(fuente.municipio);
  if (!r) return [];
  if (r.sugeridos) return r.sugeridos.slice(0, limite);
  const P = r.paradas;
  const vistos = new Set();
  const out = [];
  const agrega = (n) => {
    const k = canon(n);
    if (!k || vistos.has(k)) return;
    vistos.add(k);
    out.push(n);
  };
  const conRutas = new Set();
  P.forEach((p, i) => p[4] >= 0 && r.enParada[i].length && conRutas.add(p[4]));
  P.forEach((p, i) => p[6] === 1 && conRutas.has(i) && agrega(r.cortos[i]));
  const zonales = P.map((p, i) => [p, r.enParada[i].length]).filter(([p, n]) => p[6] === 0 && p[4] < 0 && n && !esRegulacion(p) && !/_/.test(p[1]));
  const porNombre = new Map();
  for (const [p, n] of zonales) porNombre.set(p[1], (porNombre.get(p[1]) ?? 0) + n);
  for (const [n] of [...porNombre].sort((a, b) => b[1] - a[1])) agrega(n);
  r.sugeridos = out; // todos salen de paradas con rutas, así que resolverLugar los encuentra (ver test)
  return out.slice(0, limite);
}

// Paradas cercanas a un punto con las rutas que pasan (para "¿qué me sirve aquí?")
export function paradasCercanas({ lat, lon, radio = 400, ciudad: c, limit = 10 } = {}) {
  limit = Math.min(Math.max(1, Math.floor(+limit) || 10), 50);
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
        sistema_tipo: sistemaTipo(x[3], x[5]),
        hacia: hacia(r, p),
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
    out.push('', `${i + 1}. ${op.etiqueta}: sal${op.fecha ? ` el ${op.fecha}` : ''} a las ${op.sale}, llegas ${op.llega} (${op.duracion_min} min, ${op.transbordos} transbordo${op.transbordos === 1 ? '' : 's'}, ${op.caminata_min} min a pie)`);
    for (const t of op.tramos) {
      if (t.misma_parada) out.push(`   🔁 Cambia de bus en ${t.hasta}`);
      else if (t.tipo === 'caminar') out.push(t.misma_estacion ? `   🔁 Cambia de vagón en ${t.hasta} (${t.min} min)` : t.transbordo && t.desde === t.hasta ? `   🚶 Cruza a la otra parada ${t.hasta} (${t.min} min)` : `   🚶 Camina ${t.min} min a ${t.hasta}`);
      else out.push(`   🚍 ${t.ruta} hacia ${t.hacia}: sube en ${lugar(t.sube)} ${t.sale}${t.espera_min ? ` (esperas ~${t.espera_min} min)` : ''}, baja en ${lugar(t.baja)} ${t.llega} · ${t.paradas} paradas`);
    }
  });
  if (v.caminar_min) out.push('', `🚶 A pie directo: ~${v.caminar_min} min.`);
  out.push('', ...v.avisos.map((a) => `ℹ️ ${a}`), `Datos: ${v.fuente.entidad}, ${v.fuente.licencia ?? 'licencia no declarada'}.`);
  return out.join('\n');
}
