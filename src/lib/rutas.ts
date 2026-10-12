import rutasData from '../../data/transmilenio/rutas.json';

type Ruta = (typeof rutasData.rutas)[number];

const repeticiones = new Map<string, number>();
for (const r of rutasData.rutas) repeticiones.set(r.codigo, (repeticiones.get(r.codigo) ?? 0) + 1);

/**
 * Slug de URL de una ruta: el código, salvo cuando el código se repite en la
 * fuente (ej. G45, un registro por sentido); ahí se usa el id sin el prefijo
 * 'ruta-' (ej. G45-15, G45-41) para que una página no tape a la otra.
 */
export function rutaSlug(ruta: Pick<Ruta, 'id' | 'codigo'>): string {
  return (repeticiones.get(ruta.codigo) ?? 0) > 1 ? ruta.id.replace(/^ruta-/, '') : ruta.codigo;
}
