/**
 * Extractor GTFS → índice de viajes por municipio.
 * Lee data/transporte/fuentes.json, descarga cada feed con `publicar: true` y escribe
 * data/transporte/<municipio>/red.json: paradas, rutas, patrones (secuencia de paradas
 * con tiempos promedio) y salidas por servicio. Lo consume lib/viaje.mjs.
 *
 * Uso: tsx scripts/extract-transporte.ts [--municipio 11001] [--gtfs archivo.zip]
 * Requiere `unzip`: stop_times.txt de Bogotá pesa ~600 MB y se lee en streaming,
 * nunca se commitea crudo.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const UA = 'bogota-al-dia (+https://github.com/LucasLeguizamo/bogota-al-dia)';
const ROOT = join(import.meta.dirname, '..', 'data', 'transporte');

type Fuente = {
  municipio: string;
  ciudad: string;
  sistema: string;
  entidad: string;
  oficial: boolean;
  licencia: string | null;
  descarga: { tipo: 'gcs-ultimo'; bucket: string; prefijo: string } | { tipo: 'url'; url: string };
  publicar: boolean;
};

// CSV con comillas (RFC 4180, sin saltos de línea dentro de campos: GTFS no los usa en la práctica)
function parseLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') out.push(cur), (cur = '');
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Recorre un archivo del zip fila por fila. `*archivo` tolera feeds empaquetados en subcarpeta.
async function csv(zip: string, file: string, onRow: (r: string[], ix: Record<string, number>) => void) {
  const p = spawn('unzip', ['-p', zip, `*${file}`]);
  const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
  let ix: Record<string, number> | null = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = parseLine(line);
    if (!ix) {
      ix = Object.fromEntries(cols.map((c, i) => [c.replace(/^﻿/, '').trim(), i]));
      continue;
    }
    onRow(cols, ix);
  }
}

const val = (r: string[], ix: Record<string, number>, k: string) => (ix[k] === undefined ? '' : (r[ix[k]] ?? '').trim());
const secs = (t: string) => {
  const m = /^(\d+):(\d\d):(\d\d)$/.exec(t);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN;
};

async function descargar(f: Fuente): Promise<{ zip: string; archivo: string }> {
  let url: string;
  let archivo: string;
  if (f.descarga.tipo === 'gcs-ultimo') {
    const { bucket, prefijo } = f.descarga;
    const ahora = new Date();
    let nombres: string[] = [];
    // El bucket guarda un zip por día; se lista el mes actual y, si está vacío, el anterior.
    for (let atras = 0; atras < 2 && !nombres.length; atras++) {
      const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - atras, 1));
      const mes = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${prefijo}${mes}`, { headers: { 'User-Agent': UA } });
      nombres = ((await res.json()).items ?? []).map((o: { name: string }) => o.name);
    }
    if (!nombres.length) throw new Error(`Sin archivos GTFS en ${bucket}/${prefijo}`);
    archivo = nombres.sort().at(-1)!;
    url = `https://storage.googleapis.com/${bucket}/${archivo}`;
  } else {
    url = f.descarga.url;
    archivo = url;
  }
  const zip = join(tmpdir(), `gtfs-${f.municipio}.zip`);
  console.log(`  descargando ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  return { zip, archivo };
}

async function construir(f: Fuente, zip: string, archivo: string) {
  // --- Tablas pequeñas ---
  const agencias = new Map<string, string>();
  await csv(zip, 'agency.txt', (r, ix) => agencias.set(val(r, ix, 'agency_id') || '_', val(r, ix, 'agency_name')));

  const stopIdx = new Map<string, number>();
  const stops: { id: string; nombre: string; lat: number; lon: number; padre: string; codigo: string; tipo: number }[] = [];
  await csv(zip, 'stops.txt', (r, ix) => {
    stopIdx.set(val(r, ix, 'stop_id'), stops.length);
    stops.push({
      id: val(r, ix, 'stop_id'),
      nombre: val(r, ix, 'stop_name').replace(/\s+/g, ' '),
      lat: +val(r, ix, 'stop_lat'),
      lon: +val(r, ix, 'stop_lon'),
      padre: val(r, ix, 'parent_station'),
      codigo: val(r, ix, 'stop_code'),
      tipo: +(val(r, ix, 'location_type') || 0),
    });
  });

  const routeIdx = new Map<string, number>();
  const rutas: (string | number)[][] = [];
  await csv(zip, 'routes.txt', (r, ix) => {
    routeIdx.set(val(r, ix, 'route_id'), rutas.length);
    const ag = val(r, ix, 'agency_id') || '_';
    rutas.push([
      val(r, ix, 'route_id'),
      val(r, ix, 'route_short_name'),
      val(r, ix, 'route_long_name').replace(/\s+/g, ' '),
      agencias.get(ag) ?? agencias.values().next().value ?? '',
      val(r, ix, 'route_color') || '666666',
      +(val(r, ix, 'route_type') || 3),
    ]);
  });

  const servicios: Record<string, { d: string; desde: string; hasta: string; mas: string[]; menos: string[] }> = {};
  const svc = (id: string) => (servicios[id] ??= { d: '0000000', desde: '', hasta: '', mas: [], menos: [] });
  const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  await csv(zip, 'calendar.txt', (r, ix) => {
    const s = svc(val(r, ix, 'service_id'));
    s.d = DIAS.map((d) => val(r, ix, d) || '0').join('');
    s.desde = val(r, ix, 'start_date');
    s.hasta = val(r, ix, 'end_date');
  });
  await csv(zip, 'calendar_dates.txt', (r, ix) => {
    const s = svc(val(r, ix, 'service_id'));
    (val(r, ix, 'exception_type') === '1' ? s.mas : s.menos).push(val(r, ix, 'date'));
  });

  const tripIdx = new Map<string, number>();
  const trips: { ruta: number; svc: string }[] = [];
  await csv(zip, 'trips.txt', (r, ix) => {
    const ruta = routeIdx.get(val(r, ix, 'route_id'));
    if (ruta === undefined) return;
    tripIdx.set(val(r, ix, 'trip_id'), trips.length);
    trips.push({ ruta, svc: val(r, ix, 'service_id') });
  });

  const frecuencias = new Map<number, number[][]>();
  await csv(zip, 'frequencies.txt', (r, ix) => {
    const t = tripIdx.get(val(r, ix, 'trip_id'));
    if (t === undefined) return;
    const fq = frecuencias.get(t) ?? [];
    fq.push([secs(val(r, ix, 'start_time')), secs(val(r, ix, 'end_time')), +val(r, ix, 'headway_secs')]);
    frecuencias.set(t, fq);
  });

  let feed = { version: '', desde: '', hasta: '' };
  await csv(zip, 'feed_info.txt', (r, ix) => {
    feed = { version: val(r, ix, 'feed_version'), desde: val(r, ix, 'feed_start_date'), hasta: val(r, ix, 'feed_end_date') };
  });

  // --- stop_times: no viene agrupado por viaje, así que se ordena por conteo en dos pasadas ---
  const cuenta = new Int32Array(trips.length + 1);
  await csv(zip, 'stop_times.txt', (r, ix) => {
    const t = tripIdx.get(r[ix.trip_id]);
    if (t !== undefined) cuenta[t + 1]++;
  });
  for (let i = 1; i <= trips.length; i++) cuenta[i] += cuenta[i - 1];
  const n = cuenta[trips.length];
  const seq = new Int32Array(n);
  const parada = new Int32Array(n);
  const hora = new Float64Array(n);
  const lleno = cuenta.slice(0, trips.length);
  await csv(zip, 'stop_times.txt', (r, ix) => {
    const t = tripIdx.get(r[ix.trip_id]);
    const s = stopIdx.get(r[ix.stop_id]);
    if (t === undefined || s === undefined) return;
    const k = lleno[t]++;
    seq[k] = +r[ix.stop_sequence];
    parada[k] = s;
    hora[k] = secs((r[ix.departure_time] || r[ix.arrival_time] || '').trim());
  });

  // --- Patrones: viajes de la misma ruta con la misma secuencia de paradas ---
  type Patron = { r: number; s: number[]; suma: Float64Array; n: number; viajes: [number, number, string][]; fq: Record<string, number[][]> };
  const patrones = new Map<string, Patron>();
  for (let t = 0; t < trips.length; t++) {
    const a = cuenta[t];
    const b = lleno[t];
    if (b - a < 2) continue;
    const orden = Array.from({ length: b - a }, (_, i) => a + i).sort((x, y) => seq[x] - seq[y]);
    const st = orden.map((k) => parada[k]);
    const tm = orden.map((k) => hora[k]);
    // Paradas sin hora (timepoint=0 en otros feeds): interpolación lineal por posición
    for (let i = 0; i < tm.length; i++) {
      if (!Number.isNaN(tm[i])) continue;
      let j = i;
      while (j < tm.length && Number.isNaN(tm[j])) j++;
      const prev = i > 0 ? tm[i - 1] : NaN;
      if (Number.isNaN(prev) || j === tm.length) break;
      for (let k = i; k < j; k++) tm[k] = prev + ((tm[j] - prev) * (k - i + 1)) / (j - i + 1);
    }
    if (tm.some(Number.isNaN)) continue;
    const key = `${trips[t].ruta}:${st.join('.')}`;
    let p = patrones.get(key);
    if (!p) patrones.set(key, (p = { r: trips[t].ruta, s: st, suma: new Float64Array(st.length), n: 0, viajes: [], fq: {} }));
    for (let i = 0; i < tm.length; i++) p.suma[i] += tm[i] - tm[0];
    p.n++;
    const fq = frecuencias.get(t);
    if (fq) (p.fq[trips[t].svc] ??= []).push(...fq);
    else p.viajes.push([tm[0], tm.at(-1)! - tm[0], trips[t].svc]);
  }

  // --- Salida compacta: solo paradas usadas (y sus estaciones padre) ---
  const usadas = new Set<number>();
  for (const p of patrones.values()) for (const s of p.s) usadas.add(s);
  for (const s of [...usadas]) if (stops[s].padre && stopIdx.has(stops[s].padre)) usadas.add(stopIdx.get(stops[s].padre)!);
  const nuevo = new Map<number, number>();
  [...usadas].sort((a, b) => a - b).forEach((s, i) => nuevo.set(s, i));
  const paradas = [...nuevo.keys()].map((s) => {
    const x = stops[s];
    const padre = x.padre && stopIdx.has(x.padre) ? (nuevo.get(stopIdx.get(x.padre)!) ?? -1) : -1;
    return [x.id, x.nombre, +x.lat.toFixed(6), +x.lon.toFixed(6), padre, x.codigo, x.tipo];
  });

  const salida = [...patrones.values()]
    .map((p) => {
      const t = Array.from(p.suma, (x) => Math.round(x / p.n));
      const v: Record<string, number[]> = {};
      // Factor horario de congestión: duración real / promedio, por hora de salida
      const porHora: number[][] = Array.from({ length: 30 }, () => []);
      for (const [ini, dur, s] of p.viajes) {
        (v[s] ??= []).push(Math.round(ini));
        if (t.at(-1)! > 0) porHora[Math.floor(ini / 3600)]?.push(dur / t.at(-1)!);
      }
      for (const s in v) v[s].sort((a, b) => a - b);
      const f = porHora.map((xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 1));
      const out: Record<string, unknown> = { r: p.r, s: p.s.map((s) => nuevo.get(s)), t, v };
      if (f.some((x) => Math.abs(x - 1) > 0.03)) out.f = f;
      if (Object.keys(p.fq).length) out.fq = p.fq;
      return out;
    })
    .sort((a, b) => (a.r as number) - (b.r as number) || String(a.s).localeCompare(String(b.s)));

  return {
    municipio: f.municipio,
    ciudad: f.ciudad,
    sistema: f.sistema,
    entidad: f.entidad,
    oficial: f.oficial,
    licencia: f.licencia,
    fuente: archivo,
    feed,
    generado: new Date().toISOString(),
    totales: { paradas: paradas.length, rutas: rutas.length, patrones: salida.length, viajes: trips.length },
    servicios,
    rutas,
    paradas,
    patrones: salida,
  };
}

// Un registro por línea: diffs legibles y archivo compacto.
function serializar(o: Record<string, unknown>): string {
  const partes = Object.entries(o).map(([k, v]) =>
    Array.isArray(v) ? `"${k}":[\n${v.map((x) => JSON.stringify(x)).join(',\n')}\n]` : `"${k}":${JSON.stringify(v)}`,
  );
  return `{\n${partes.join(',\n')}\n}\n`;
}

// Misma red → mismo archivo: si solo cambia `generado`/`fuente` (zip del día), no se reescribe.
function escribirEstable(path: string, o: Record<string, unknown>): boolean {
  const sinFecha = ({ generado, fuente, ...resto }: Record<string, unknown>) => JSON.stringify(resto);
  if (existsSync(path)) {
    const prev = JSON.parse(readFileSync(path, 'utf8'));
    if (sinFecha(prev) === sinFecha(o)) return false;
  }
  writeFileSync(path, serializar(o));
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  const { fuentes } = JSON.parse(readFileSync(join(ROOT, 'fuentes.json'), 'utf8')) as { fuentes: Fuente[] };
  const municipio = flag('municipio');
  const lista = fuentes.filter((f) => (municipio ? f.municipio === municipio : f.publicar));
  for (const f of lista) {
    console.log(`🚌 ${f.ciudad} (${f.municipio})`);
    const local = flag('gtfs');
    const { zip, archivo } = local ? { zip: local, archivo: local.split('/').at(-1)! } : await descargar(f);
    const red = await construir(f, zip, archivo);
    const dir = join(ROOT, f.municipio);
    mkdirSync(dir, { recursive: true });
    const cambio = escribirEstable(join(dir, 'red.json'), red);
    console.log(`  ${JSON.stringify(red.totales)} ${cambio ? '→ red.json actualizado' : '→ sin cambios'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
