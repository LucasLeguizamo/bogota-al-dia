/**
 * GTFS extractor → per-municipality trip-planning index.
 * Reads data/transit/sources.json, downloads every feed with `publish: true` and writes
 * data/transit/<municipality>/network.json: stops, routes, patterns (stop sequence with
 * average times) and departures per service. Consumed by lib/trip.mjs.
 *
 * Usage: tsx scripts/extract-transit.ts [--municipality 11001] [--gtfs file.zip] [--force]
 * Requires `unzip`: Bogotá's stop_times.txt is ~600 MB and is streamed,
 * never committed raw.
 *
 * network.json layout (compact on purpose: it ships inside the Vercel function):
 * - stops:    [stop_id, name, lat, lon, parent_index (-1 = none), stop_code, location_type]
 * - routes:   [route_id, short_name, long_name, agency_name, color, route_type]
 * - services: { service_id: { days: "1111100" (Mon..Sun), start, end, added: [YYYYMMDD], removed: [YYYYMMDD] } }
 * - patterns: { r: route index, s: stop indices, t: average seconds from the first stop,
 *               v: { service_id: departure seconds }, f?: hourly congestion factor (index = departure hour),
 *               fq?: { service_id: [[start, end, headway_secs]] } (frequencies.txt, e.g. TransMiCable) }
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const UA = 'bogota-al-dia (+https://github.com/LucasLeguizamo/bogota-al-dia)';
const ROOT = join(import.meta.dirname, '..', 'data', 'transit');

type Source = {
  municipality: string;
  city: string;
  system: string;
  publisher: string;
  official: boolean;
  license: string | null;
  download: { type: 'gcs-latest'; bucket: string; prefix: string } | { type: 'url'; url: string };
  publish: boolean;
};

// Quoted CSV (RFC 4180, no line breaks inside fields: GTFS does not use them in practice)
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

// Streams one file of the zip row by row. `*file` tolerates feeds packed in a subfolder.
// Optional files: if missing, unzip exits with 11 and we carry on without them.
const OPTIONAL = new Set(['frequencies.txt', 'feed_info.txt', 'calendar.txt', 'calendar_dates.txt', 'agency.txt']);

async function csv(zip: string, file: string, onRow: (r: string[], ix: Record<string, number>) => void) {
  const p = spawn('unzip', ['-p', zip, `*${file}`]);
  const exit = new Promise<number>((ok) => p.on('close', (code) => ok(code ?? 1)));
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
  // Corrupt zip or missing required file: fail instead of writing an empty network
  const code = await exit;
  if (code !== 0 && !(code === 11 && OPTIONAL.has(file))) throw new Error(`unzip ${file} exited with code ${code}`);
  if (!ix && !OPTIONAL.has(file)) throw new Error(`${file} empty or missing in ${zip}`);
}

const val = (r: string[], ix: Record<string, number>, k: string) => (ix[k] === undefined ? '' : (r[ix[k]] ?? '').trim());
const secs = (t: string) => {
  const m = /^(\d+):(\d\d):(\d\d)$/.exec(t);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN;
};

async function download(f: Source): Promise<{ zip: string; file: string }> {
  let url: string;
  let file: string;
  if (f.download.type === 'gcs-latest') {
    const { bucket, prefix } = f.download;
    const now = new Date();
    let names: string[] = [];
    // The bucket keeps one zip per day; list the current month and, if empty, the previous one.
    for (let back = 0; back < 2 && !names.length; back++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      const month = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${prefix}${month}`, { headers: { 'User-Agent': UA } });
      names = ((await res.json()).items ?? []).map((o: { name: string }) => o.name);
    }
    if (!names.length) throw new Error(`No GTFS files in ${bucket}/${prefix}`);
    file = names.sort().at(-1)!;
    url = `https://storage.googleapis.com/${bucket}/${file}`;
  } else {
    url = f.download.url;
    file = url;
  }
  const zip = join(tmpdir(), `gtfs-${f.municipality}.zip`);
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  return { zip, file };
}

async function build(f: Source, zip: string, file: string) {
  // --- Small tables ---
  const agencies = new Map<string, string>();
  await csv(zip, 'agency.txt', (r, ix) => agencies.set(val(r, ix, 'agency_id') || '_', val(r, ix, 'agency_name')));

  const stopIdx = new Map<string, number>();
  const stops: { id: string; name: string; lat: number; lon: number; parent: string; code: string; type: number }[] = [];
  await csv(zip, 'stops.txt', (r, ix) => {
    stopIdx.set(val(r, ix, 'stop_id'), stops.length);
    stops.push({
      id: val(r, ix, 'stop_id'),
      name: val(r, ix, 'stop_name').replace(/\s+/g, ' '),
      lat: +val(r, ix, 'stop_lat'),
      lon: +val(r, ix, 'stop_lon'),
      parent: val(r, ix, 'parent_station'),
      code: val(r, ix, 'stop_code'),
      type: +(val(r, ix, 'location_type') || 0),
    });
  });

  const routeIdx = new Map<string, number>();
  const routes: (string | number)[][] = [];
  await csv(zip, 'routes.txt', (r, ix) => {
    routeIdx.set(val(r, ix, 'route_id'), routes.length);
    const ag = val(r, ix, 'agency_id') || '_';
    routes.push([
      val(r, ix, 'route_id'),
      val(r, ix, 'route_short_name'),
      val(r, ix, 'route_long_name').replace(/\s+/g, ' '),
      agencies.get(ag) ?? agencies.values().next().value ?? '',
      val(r, ix, 'route_color') || '666666',
      +(val(r, ix, 'route_type') || 3),
    ]);
  });

  const services: Record<string, { days: string; start: string; end: string; added: string[]; removed: string[] }> = {};
  const svc = (id: string) => (services[id] ??= { days: '0000000', start: '', end: '', added: [], removed: [] });
  const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  await csv(zip, 'calendar.txt', (r, ix) => {
    const s = svc(val(r, ix, 'service_id'));
    s.days = WEEKDAYS.map((d) => val(r, ix, d) || '0').join('');
    s.start = val(r, ix, 'start_date');
    s.end = val(r, ix, 'end_date');
  });
  await csv(zip, 'calendar_dates.txt', (r, ix) => {
    const s = svc(val(r, ix, 'service_id'));
    (val(r, ix, 'exception_type') === '1' ? s.added : s.removed).push(val(r, ix, 'date'));
  });

  const tripIdx = new Map<string, number>();
  const trips: { route: number; svc: string }[] = [];
  await csv(zip, 'trips.txt', (r, ix) => {
    const route = routeIdx.get(val(r, ix, 'route_id'));
    if (route === undefined) return;
    tripIdx.set(val(r, ix, 'trip_id'), trips.length);
    trips.push({ route, svc: val(r, ix, 'service_id') });
  });

  const frequencies = new Map<number, number[][]>();
  await csv(zip, 'frequencies.txt', (r, ix) => {
    const t = tripIdx.get(val(r, ix, 'trip_id'));
    if (t === undefined) return;
    const fq = frequencies.get(t) ?? [];
    fq.push([secs(val(r, ix, 'start_time')), secs(val(r, ix, 'end_time')), +val(r, ix, 'headway_secs')]);
    frequencies.set(t, fq);
  });

  let feed = { version: '', start: '', end: '' };
  await csv(zip, 'feed_info.txt', (r, ix) => {
    feed = { version: val(r, ix, 'feed_version'), start: val(r, ix, 'feed_start_date'), end: val(r, ix, 'feed_end_date') };
  });

  // --- stop_times is not grouped by trip, so it is counting-sorted in two passes ---
  const count = new Int32Array(trips.length + 1);
  await csv(zip, 'stop_times.txt', (r, ix) => {
    const t = tripIdx.get(r[ix.trip_id]);
    if (t !== undefined) count[t + 1]++;
  });
  for (let i = 1; i <= trips.length; i++) count[i] += count[i - 1];
  const n = count[trips.length];
  const seq = new Int32Array(n);
  const stopAt = new Int32Array(n);
  const timeAt = new Float64Array(n);
  const fill = count.slice(0, trips.length);
  await csv(zip, 'stop_times.txt', (r, ix) => {
    const t = tripIdx.get(r[ix.trip_id]);
    const s = stopIdx.get(r[ix.stop_id]);
    if (t === undefined || s === undefined) return;
    const k = fill[t]++;
    seq[k] = +r[ix.stop_sequence];
    stopAt[k] = s;
    timeAt[k] = secs((r[ix.departure_time] || r[ix.arrival_time] || '').trim());
  });

  // --- Patterns: trips of the same route with the same stop sequence ---
  type Pattern = { r: number; s: number[]; sum: Float64Array; n: number; trips: [number, number, string][]; fq: Record<string, number[][]> };
  const patterns = new Map<string, Pattern>();
  for (let t = 0; t < trips.length; t++) {
    const a = count[t];
    const b = fill[t];
    if (b - a < 2) continue;
    const order = Array.from({ length: b - a }, (_, i) => a + i).sort((x, y) => seq[x] - seq[y]);
    const st = order.map((k) => stopAt[k]);
    const tm = order.map((k) => timeAt[k]);
    // Stops without a time (timepoint=0 in other feeds): linear interpolation by position
    for (let i = 0; i < tm.length; i++) {
      if (!Number.isNaN(tm[i])) continue;
      let j = i;
      while (j < tm.length && Number.isNaN(tm[j])) j++;
      const prev = i > 0 ? tm[i - 1] : NaN;
      if (Number.isNaN(prev) || j === tm.length) break;
      for (let k = i; k < j; k++) tm[k] = prev + ((tm[j] - prev) * (k - i + 1)) / (j - i + 1);
    }
    if (tm.some(Number.isNaN)) continue;
    const key = `${trips[t].route}:${st.join('.')}`;
    let p = patterns.get(key);
    if (!p) patterns.set(key, (p = { r: trips[t].route, s: st, sum: new Float64Array(st.length), n: 0, trips: [], fq: {} }));
    for (let i = 0; i < tm.length; i++) p.sum[i] += tm[i] - tm[0];
    p.n++;
    const fq = frequencies.get(t);
    if (fq) (p.fq[trips[t].svc] ??= []).push(...fq);
    else p.trips.push([tm[0], tm.at(-1)! - tm[0], trips[t].svc]);
  }

  // --- Compact output: only stops in use (and their parent stations) ---
  const used = new Set<number>();
  for (const p of patterns.values()) for (const s of p.s) used.add(s);
  for (const s of [...used]) if (stops[s].parent && stopIdx.has(stops[s].parent)) used.add(stopIdx.get(stops[s].parent)!);
  const remap = new Map<number, number>();
  [...used].sort((a, b) => a - b).forEach((s, i) => remap.set(s, i));
  const outStops = [...remap.keys()].map((s) => {
    const x = stops[s];
    const parent = x.parent && stopIdx.has(x.parent) ? (remap.get(stopIdx.get(x.parent)!) ?? -1) : -1;
    return [x.id, x.name, +x.lat.toFixed(6), +x.lon.toFixed(6), parent, x.code, x.type];
  });

  const outPatterns = [...patterns.values()]
    .map((p) => {
      const t = Array.from(p.sum, (x) => Math.round(x / p.n));
      const v: Record<string, number[]> = {};
      // Hourly congestion factor: real duration / average, by departure hour
      const byHour: number[][] = Array.from({ length: 30 }, () => []);
      for (const [start, dur, s] of p.trips) {
        (v[s] ??= []).push(Math.round(start));
        if (t.at(-1)! > 0) byHour[Math.floor(start / 3600)]?.push(dur / t.at(-1)!);
      }
      for (const s in v) v[s].sort((a, b) => a - b);
      const f = byHour.map((xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 1));
      const out: Record<string, unknown> = { r: p.r, s: p.s.map((s) => remap.get(s)), t, v };
      if (f.some((x) => Math.abs(x - 1) > 0.03)) out.f = f;
      if (Object.keys(p.fq).length) out.fq = p.fq;
      return out;
    })
    .sort((a, b) => (a.r as number) - (b.r as number) || String(a.s).localeCompare(String(b.s)));

  return {
    municipality: f.municipality,
    city: f.city,
    system: f.system,
    publisher: f.publisher,
    official: f.official,
    license: f.license,
    source: file,
    feed,
    generated: new Date().toISOString(),
    totals: { stops: outStops.length, routes: routes.length, patterns: outPatterns.length, trips: trips.length },
    services,
    routes,
    stops: outStops,
    patterns: outPatterns,
  };
}

// One record per line: readable diffs and a compact file.
function serialize(o: Record<string, unknown>): string {
  const parts = Object.entries(o).map(([k, v]) =>
    Array.isArray(v) ? `"${k}":[\n${v.map((x) => JSON.stringify(x)).join(',\n')}\n]` : `"${k}":${JSON.stringify(v)}`,
  );
  return `{\n${parts.join(',\n')}\n}\n`;
}

// Same network → same file: if only `generated`/`source` change (the daily zip), do not rewrite.
function writeStable(path: string, o: Record<string, unknown>): boolean {
  const withoutDate = ({ generated, source, ...rest }: Record<string, unknown>) => JSON.stringify(rest);
  if (existsSync(path)) {
    const prev = JSON.parse(readFileSync(path, 'utf8'));
    if (withoutDate(prev) === withoutDate(o)) return false;
    // Guard: a drop of more than half is almost always a broken feed, not a real change
    for (const k of ['stops', 'patterns'] as const) {
      const [before, now] = [prev.totals?.[k] ?? 0, (o.totals as Record<string, number>)[k]];
      if (before && now < before / 2 && !process.argv.includes('--force'))
        throw new Error(`${k} drops from ${before} to ${now}: not writing ${path}. Check the feed or use --force.`);
    }
  }
  writeFileSync(path, serialize(o));
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (k: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : undefined);
  const { sources } = JSON.parse(readFileSync(join(ROOT, 'sources.json'), 'utf8')) as { sources: Source[] };
  const municipality = flag('municipality');
  const list = sources.filter((f) => (municipality ? f.municipality === municipality : f.publish));
  for (const f of list) {
    console.log(`🚌 ${f.city} (${f.municipality})`);
    const local = flag('gtfs');
    const { zip, file } = local ? { zip: local, file: local.split('/').at(-1)! } : await download(f);
    const network = await build(f, zip, file);
    const dir = join(ROOT, f.municipality);
    mkdirSync(dir, { recursive: true });
    const changed = writeStable(join(dir, 'network.json'), network);
    console.log(`  ${JSON.stringify(network.totals)} ${changed ? '→ network.json updated' : '→ unchanged'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
