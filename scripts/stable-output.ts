/**
 * Salida estable para los extractores: conserva los timestamps anteriores
 * (`generado` del archivo y `ultima_actualizacion` de cada registro) cuando
 * el contenido real no cambió. Así, misma fuente → mismo archivo, y el
 * workflow semanal solo commitea cuando hay cambios reales.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';

type Json = Record<string, any>;

const sinCampo = (obj: Json, campo: string): string => {
  const { [campo]: _omit, ...resto } = obj;
  return JSON.stringify(resto);
};

/**
 * Escribe `output` como JSON en `path`.
 * - Si `arrayKey` se indica, cada registro de `output[arrayKey]` cuyo `id`
 *   exista en el archivo previo con el mismo contenido (ignorando
 *   `ultima_actualizacion`) recupera su `ultima_actualizacion` anterior.
 * - Si todo lo demás es igual, `generado` recupera su valor anterior.
 * Devuelve true si el contenido cambió.
 */
export function writeJsonStable(path: string, output: Json, arrayKey?: string): boolean {
  let prev: Json | null = null;
  if (existsSync(path)) {
    try {
      prev = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      prev = null;
    }
  }

  if (prev && arrayKey && Array.isArray(prev[arrayKey]) && Array.isArray(output[arrayKey])) {
    const previos = new Map<string, Json>(prev[arrayKey].map((r: Json) => [r.id, r]));
    for (const rec of output[arrayKey] as Json[]) {
      const anterior = previos.get(rec.id);
      if (
        anterior?.ultima_actualizacion &&
        sinCampo(anterior, 'ultima_actualizacion') === sinCampo(rec, 'ultima_actualizacion')
      ) {
        rec.ultima_actualizacion = anterior.ultima_actualizacion;
      }
    }
  }

  const cambio = !prev || sinCampo(prev, 'generado') !== sinCampo(output, 'generado');
  if (!cambio && prev?.generado) {
    output.generado = prev.generado;
  }

  writeFileSync(path, JSON.stringify(output, null, 2));
  return cambio;
}
