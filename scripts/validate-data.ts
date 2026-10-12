/**
 * Valida los datos publicados contra sus JSON Schemas.
 * Los schemas describen UN registro; los archivos son un sobre
 * ({ generado, total, ..., <arrayKey>: [...] }), así que se valida cada
 * registro del arreglo y además que `total` coincida con su longitud.
 * Sale con código 1 si algo falla.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const ROOT = process.cwd();

const TARGETS = [
  { data: 'data/transmilenio/estaciones.json', schema: 'schemas/estacion-transmilenio.schema.json', key: 'estaciones' },
  { data: 'data/transmilenio/rutas.json', schema: 'schemas/ruta-transmilenio.schema.json', key: 'rutas' },
  { data: 'data/recoleccion/zonas.json', schema: 'schemas/zona-recoleccion.schema.json', key: 'zonas' }
];

const MAX_ERRORES_POR_ARCHIVO = 20;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const readJson = (rel: string) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

let fallos = 0;

for (const t of TARGETS) {
  const errores: string[] = [];
  let registros: any[] = [];

  try {
    const file = readJson(t.data);
    const validate = ajv.compile(readJson(t.schema));
    registros = file[t.key];

    if (!Array.isArray(registros)) {
      errores.push(`falta el arreglo "${t.key}"`);
    } else {
      if (file.total !== registros.length) {
        errores.push(`total=${file.total} pero hay ${registros.length} registros`);
      }
      if (typeof file.generado !== 'string' || Number.isNaN(Date.parse(file.generado))) {
        errores.push(`"generado" no es una fecha válida: ${JSON.stringify(file.generado)}`);
      }
      const ids = new Set<string>();
      registros.forEach((rec, i) => {
        const ref = `[${i}] ${rec?.id ?? '(sin id)'}`;
        if (rec?.id && ids.has(rec.id)) errores.push(`${ref}: id duplicado`);
        ids.add(rec?.id);
        if (!validate(rec)) {
          for (const e of validate.errors ?? []) {
            errores.push(`${ref}${e.instancePath || ''}: ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`);
          }
        }
      });
    }
  } catch (err) {
    errores.push(`no se pudo leer/compilar: ${(err as Error).message}`);
  }

  if (errores.length === 0) {
    console.log(`✓ ${t.data}: ${registros.length} registros válidos (${t.schema})`);
  } else {
    fallos += errores.length;
    console.error(`✗ ${t.data}: ${errores.length} error(es) contra ${t.schema}`);
    for (const e of errores.slice(0, MAX_ERRORES_POR_ARCHIVO)) console.error(`  - ${e}`);
    if (errores.length > MAX_ERRORES_POR_ARCHIVO) {
      console.error(`  … y ${errores.length - MAX_ERRORES_POR_ARCHIVO} más`);
    }
  }
}

if (fallos > 0) {
  console.error(`\nValidación fallida: ${fallos} error(es).`);
  process.exit(1);
}
console.log('\nValidación OK.');
