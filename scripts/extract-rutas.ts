/**
 * Extractor de Rutas Troncales de TransMilenio
 * Fuente: gis.transmilenio.gov.co (ArcGIS REST)
 * Licencia: CC-BY-SA-4.0
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { writeJsonStable } from './stable-output';

const API_URL = 'https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_rutas_troncales/MapServer/0/query';

interface ArcGISFeature {
  attributes: {
    objectid: number;
    route_name_ruta_troncal: string;
    nombre_ruta_troncal: string;
    origen_ruta_troncal: string;
    destino_ruta_troncal: string;
    tipo_operacion: string;
    horario_lunes_viernes: string;
    horario_sabado: string;
    horario_domingo_festivo: string;
    estado_ruta_troncal: string;
    longitud_comercial: number | null;
    longitud_ruta_troncal: number | null;
    tipo_ruta_troncal: number;
    tipo_bus_ruta_troncal: number | null;
    'st_length(shape)'?: number | null;
  };
}

interface RutaNormalizada {
  id: string;
  codigo: string;
  nombre: string;
  origen: string;
  destino: string;
  tipo_operacion: 'normal' | 'refuerzo' | 'ciclovia' | 'desconocido';
  tipo_bus: 'articulado' | 'biarticulado' | 'dual' | 'padron' | 'buseton' | 'desconocido';
  estado: 'activa' | 'suspendida' | 'programada';
  horarios: {
    lunes_viernes: string;
    sabado: string;
    domingo_festivo: string;
  };
  longitud_km: number;
  fuente: string;
  ultima_actualizacion: string;
}

// Valores que publica la capa en `tipo_operacion` (texto libre): Normal, Refuerzo, Ciclovia.
// Se normalizan a snake_case sin tildes. Vacío → 'desconocido'. Un valor nuevo
// se publica tal cual (slug) para que `pnpm validate` falle y se revise el enum.
const slug = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');

function normalizeTipoOperacion(v: string | null | undefined): RutaNormalizada['tipo_operacion'] {
  const s = v ? slug(v) : '';
  return (s || 'desconocido') as RutaNormalizada['tipo_operacion'];
}

// Dominio oficial TIPO_BUS de la capa (codedValues): 1 ARTICULADO, 2 BIARTICULADO,
// 3 DUAL, 4 PADRON, 5 BUSETON. Sin dato → 'desconocido' (no se asume articulado).
const TIPO_BUS_MAP: Record<number, RutaNormalizada['tipo_bus']> = {
  1: 'articulado',
  2: 'biarticulado',
  3: 'dual',
  4: 'padron',
  5: 'buseton'
};

// La capa ya publica las longitudes en kilómetros (ej. 15.028), no en metros.
// Se usa `longitud_comercial`; si falta o es inverosímil (> 100 km, ej. 1252 en
// "L81 Ref CL72"), se cae a `longitud_ruta_troncal` del mismo registro, y como
// último respaldo a la longitud de la geometría oficial de la capa
// (`st_length(shape)`, metros en EPSG:3116 → km). Si no hay nada, 0.
// Ver docs/decisions.md.
const MAX_KM_PLAUSIBLE = 100;

function longitudKm(attr: ArcGISFeature['attributes']): number {
  const valida = (v: number | null | undefined) =>
    typeof v === 'number' && v > 0 && v <= MAX_KM_PLAUSIBLE;
  const km = valida(attr.longitud_comercial)
    ? attr.longitud_comercial!
    : valida(attr.longitud_ruta_troncal)
      ? attr.longitud_ruta_troncal!
      : valida((attr['st_length(shape)'] ?? 0) / 1000)
        ? attr['st_length(shape)']! / 1000
        : 0;
  return Math.round(km * 100) / 100;
}

function normalizeEstado(estado: string): RutaNormalizada['estado'] {
  const lower = estado?.toLowerCase() || '';
  // La fuente publica 'OPERATIVA' para todas las rutas en servicio.
  if (lower.includes('activ') || lower.includes('operativ')) return 'activa';
  if (lower.includes('suspend')) return 'suspendida';
  return 'programada';
}

async function fetchRutas(): Promise<ArcGISFeature[]> {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    f: 'json',
    resultRecordCount: '500'
  });

  const response = await fetch(`${API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.features) {
    throw new Error('No features in response');
  }

  return data.features;
}

function normalizeRuta(feature: ArcGISFeature): RutaNormalizada {
  const attr = feature.attributes;
  const now = new Date().toISOString();

  return {
    id: `ruta-${attr.route_name_ruta_troncal || attr.objectid}`,
    codigo: attr.route_name_ruta_troncal?.trim() || String(attr.objectid),
    nombre: attr.nombre_ruta_troncal?.trim() || attr.route_name_ruta_troncal?.trim() || '',
    origen: attr.origen_ruta_troncal?.trim() || '',
    destino: attr.destino_ruta_troncal?.trim() || '',
    tipo_operacion: normalizeTipoOperacion(attr.tipo_operacion),
    tipo_bus: (attr.tipo_bus_ruta_troncal != null && TIPO_BUS_MAP[attr.tipo_bus_ruta_troncal]) || 'desconocido',
    estado: normalizeEstado(attr.estado_ruta_troncal),
    horarios: {
      lunes_viernes: attr.horario_lunes_viernes?.trim() || '',
      sabado: attr.horario_sabado?.trim() || '',
      domingo_festivo: attr.horario_domingo_festivo?.trim() || ''
    },
    longitud_km: longitudKm(attr),
    fuente: 'TransMilenio S.A. - datosabiertos.bogota.gov.co',
    ultima_actualizacion: now
  };
}

async function main() {
  console.log('Extrayendo rutas de TransMilenio...');

  try {
    const features = await fetchRutas();
    console.log(`Obtenidas ${features.length} rutas desde la API`);

    // Algunos códigos vienen dos veces (un registro por sentido, ej. G45).
    // Para esos, el id incluye el objectid de ArcGIS para que sea único y estable.
    const porCodigo = new Map<string, number>();
    for (const f of features) {
      const c = f.attributes.route_name_ruta_troncal?.trim() || String(f.attributes.objectid);
      porCodigo.set(c, (porCodigo.get(c) ?? 0) + 1);
    }

    const rutas = features
      .map(f => {
        const r = normalizeRuta(f);
        if ((porCodigo.get(r.codigo) ?? 0) > 1) r.id = `ruta-${r.codigo}-${f.attributes.objectid}`;
        return r;
      })
      .filter(r => r.codigo)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es') || a.id.localeCompare(b.id, 'es'));

    console.log(`Normalizadas ${rutas.length} rutas válidas`);

    const outputDir = join(process.cwd(), 'data', 'transmilenio');
    mkdirSync(outputDir, { recursive: true });

    const output = {
      $schema: '../schemas/ruta-transmilenio.schema.json',
      generado: new Date().toISOString(),
      total: rutas.length,
      fuente: 'https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_rutas_troncales/MapServer/0',
      licencia: 'CC-BY-SA-4.0',
      rutas
    };

    writeJsonStable(join(outputDir, 'rutas.json'), output, 'rutas');

    console.log(`Guardado: data/transmilenio/rutas.json`);

    // CSV
    const csvHeader = 'id,codigo,nombre,origen,destino,tipo_operacion,estado,horario_lv,horario_sab,horario_dom\n';
    const csvRows = rutas.map(r =>
      `"${r.id}","${r.codigo}","${r.nombre}","${r.origen}","${r.destino}","${r.tipo_operacion}","${r.estado}","${r.horarios.lunes_viernes}","${r.horarios.sabado}","${r.horarios.domingo_festivo}"`
    ).join('\n');

    writeFileSync(join(outputDir, 'rutas.csv'), csvHeader + csvRows);
    console.log(`Guardado: data/transmilenio/rutas.csv`);

  } catch (error) {
    console.error('Error extrayendo rutas:', error);
    process.exit(1);
  }
}

main();
