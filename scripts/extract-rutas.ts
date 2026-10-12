/**
 * Extractor de Rutas Troncales de TransMilenio
 * Fuente: gis.transmilenio.gov.co (ArcGIS REST)
 * Licencia: CC-BY-SA-4.0
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
    longitud_comercial: number;
    tipo_ruta_troncal: number;
    tipo_bus_ruta_troncal: number;
  };
}

interface RutaNormalizada {
  id: string;
  codigo: string;
  nombre: string;
  origen: string;
  destino: string;
  tipo_operacion: 'corriente' | 'facil' | 'super_expreso' | 'expreso';
  tipo_bus: 'articulado' | 'biarticulado' | 'padron';
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

const TIPO_OPERACION_MAP: Record<string, RutaNormalizada['tipo_operacion']> = {
  'corriente': 'corriente',
  'fácil': 'facil',
  'facil': 'facil',
  'súper expreso': 'super_expreso',
  'super expreso': 'super_expreso',
  'expreso': 'expreso'
};

const TIPO_BUS_MAP: Record<number, RutaNormalizada['tipo_bus']> = {
  1: 'articulado',
  2: 'biarticulado',
  3: 'padron'
};

function normalizeEstado(estado: string): RutaNormalizada['estado'] {
  const lower = estado?.toLowerCase() || '';
  if (lower.includes('activ')) return 'activa';
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

  const tipoOpNorm = attr.tipo_operacion?.toLowerCase().trim() || 'corriente';

  return {
    id: `ruta-${attr.route_name_ruta_troncal || attr.objectid}`,
    codigo: attr.route_name_ruta_troncal?.trim() || String(attr.objectid),
    nombre: attr.nombre_ruta_troncal?.trim() || attr.route_name_ruta_troncal?.trim() || '',
    origen: attr.origen_ruta_troncal?.trim() || '',
    destino: attr.destino_ruta_troncal?.trim() || '',
    tipo_operacion: TIPO_OPERACION_MAP[tipoOpNorm] || 'corriente',
    tipo_bus: TIPO_BUS_MAP[attr.tipo_bus_ruta_troncal] || 'articulado',
    estado: normalizeEstado(attr.estado_ruta_troncal),
    horarios: {
      lunes_viernes: attr.horario_lunes_viernes?.trim() || '',
      sabado: attr.horario_sabado?.trim() || '',
      domingo_festivo: attr.horario_domingo_festivo?.trim() || ''
    },
    longitud_km: Math.round((attr.longitud_comercial || 0) / 1000 * 100) / 100,
    fuente: 'TransMilenio S.A. - datosabiertos.bogota.gov.co',
    ultima_actualizacion: now
  };
}

async function main() {
  console.log('Extrayendo rutas de TransMilenio...');

  try {
    const features = await fetchRutas();
    console.log(`Obtenidas ${features.length} rutas desde la API`);

    const rutas = features
      .map(normalizeRuta)
      .filter(r => r.codigo)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));

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

    writeFileSync(
      join(outputDir, 'rutas.json'),
      JSON.stringify(output, null, 2)
    );

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
