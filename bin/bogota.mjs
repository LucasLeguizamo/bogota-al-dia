#!/usr/bin/env node
// CLI + servidor MCP stdio. Uso: bogota <comando> [args] [--json]
import { createInterface } from 'node:readline';
import { estaciones, rutas, recoleccion, localidades, resumen, handleMcpMessage } from '../lib/bogota.mjs';
import { planTrip, tripAsText, nearbyStops, routeStops, coverage } from '../lib/trip.mjs';

const HELP = `bogota — datos públicos de Bogotá

  bogota estaciones [texto] [--troncal X] [--limit N]
  bogota estacion <codigo>
  bogota rutas [texto] [--limit N]
  bogota ruta <codigo>
  bogota recoleccion <localidad|codigo>
  bogota localidades
  bogota trip <origin> <destination> [--time HH:MM] [--date YYYY-MM-DD] [--city X] [--json]
                             plan a transit trip (origin/destination: station, stop,
                             neighborhood or "lat,lon"; quote names with spaces).
                             Prints chat-ready text; --json prints JSON
  bogota nearby <lat> <lon> [--radius M] [--city X]
                             stops near a point with their routes
  bogota route-stops <route> [--city X]
                             ordered stops of a route
  bogota coverage            cities with a transit network
  bogota resumen
  bogota mcp                 servidor MCP por stdio

Salida en JSON.`;

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--json') flags.json = true;
  else if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') ? undefined : rest[++i];
  else pos.push(rest[i]);
}
const text = pos.join(' ') || undefined;
const limit = flags.limit ? Number(flags.limit) : 1000;
const out = (x) => console.log(JSON.stringify(x, null, 2));

switch (cmd) {
  case 'estaciones': out(estaciones({ query: text, troncal: flags.troncal, limit })); break;
  case 'estacion': out(estaciones({ codigo: text })); break;
  case 'rutas': out(rutas({ query: text, limit })); break;
  case 'ruta': out(rutas({ codigo: text })); break;
  case 'recoleccion': out(recoleccion(/^\d+$/.test(text ?? '') ? { codigo: text } : { localidad: text })); break;
  case 'localidades': out(localidades()); break;
  case 'resumen': out(resumen()); break;
  case 'trip': {
    if (pos.length < 2) { console.error('Usage: bogota trip "<origin>" "<destination>"'); process.exit(1); }
    try {
      const v = planTrip({ origin: pos[0], destination: pos[1], time: flags.time, date: flags.date, city: flags.city });
      flags.json ? out(v) : console.log(tripAsText(v));
    } catch (e) { console.error(e.message); process.exit(1); }
    break;
  }
  case 'nearby': out(nearbyStops({ lat: pos[0], lon: pos[1], radius: flags.radius, city: flags.city })); break;
  case 'route-stops': out(routeStops({ route: text, city: flags.city })); break;
  case 'coverage': out(coverage()); break;
  case 'mcp':
    // stdio: un mensaje JSON-RPC por línea; stdout solo lleva respuestas.
    createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      }
      const res = handleMcpMessage(msg);
      if (res) process.stdout.write(JSON.stringify(res) + '\n');
    });
    break;
  default:
    console.log(HELP);
    process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0);
}
