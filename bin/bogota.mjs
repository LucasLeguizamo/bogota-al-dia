#!/usr/bin/env node
// CLI + servidor MCP stdio. Uso: bogota <comando> [args] [--json]
import { createInterface } from 'node:readline';
import { estaciones, rutas, recoleccion, localidades, resumen, handleMcp } from '../lib/bogota.mjs';

const HELP = `bogota — datos públicos de Bogotá

  bogota estaciones [texto] [--troncal X] [--limit N]
  bogota estacion <codigo>
  bogota rutas [texto] [--limit N]
  bogota ruta <codigo>
  bogota recoleccion <localidad|codigo>
  bogota localidades
  bogota resumen
  bogota mcp                 servidor MCP por stdio

Salida en JSON.`;

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[++i];
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
  case 'mcp':
    createInterface({ input: process.stdin }).on('line', (line) => {
      if (!line.trim()) return;
      let res;
      try {
        const msg = JSON.parse(line);
        res = Array.isArray(msg) ? msg.map(handleMcp).filter(Boolean) : handleMcp(msg);
      } catch {
        res = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
      }
      if (res && !(Array.isArray(res) && !res.length)) process.stdout.write(JSON.stringify(res) + '\n');
    });
    break;
  default:
    console.log(HELP);
    process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0);
}
