/**
 * Extractor de Estaciones Troncales de TransMilenio
 * Fuente: gis.transmilenio.gov.co (ArcGIS REST)
 * Licencia: CC-BY-SA-4.0
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_URL = 'https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_estaciones_troncales/MapServer/0/query';

interface ArcGISFeature {
  attributes: {
    objectid: number;
    numero_estacion: string;
    nombre_estacion: string;
    ubicacion_estacion: string;
    troncal_estacion: string;
    tipo_estacion: number;
    latitud_estacion: number;
    longitud_estacion: number;
    biciestacion_estacion: string;
    capacidad_biciestacion_estacion: number;
    numero_accesos_estacion: number;
    componente_wifi: string;
  };
}

interface EstacionNormalizada {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  troncal: string;
  tipo: 'sencilla' | 'intermedia' | 'cabecera' | 'portal';
  coordenadas: {
    latitud: number;
    longitud: number;
  };
  servicios: {
    biciparqueadero: boolean;
    capacidad_biciparqueadero: number;
    wifi: boolean;
    accesos: number;
  };
  fuente: string;
  ultima_actualizacion: string;
}

const TIPO_ESTACION_MAP: Record<number, EstacionNormalizada['tipo']> = {
  1: 'sencilla',
  2: 'intermedia',
  3: 'cabecera',
  4: 'portal'
};

async function fetchEstaciones(): Promise<ArcGISFeature[]> {
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

function normalizeEstacion(feature: ArcGISFeature): EstacionNormalizada {
  const attr = feature.attributes;
  const now = new Date().toISOString();

  return {
    id: `estacion-${attr.numero_estacion || attr.objectid}`,
    codigo: attr.numero_estacion || String(attr.objectid),
    nombre: attr.nombre_estacion?.trim() || 'Sin nombre',
    ubicacion: attr.ubicacion_estacion?.trim() || '',
    troncal: attr.troncal_estacion?.trim() || '',
    tipo: TIPO_ESTACION_MAP[attr.tipo_estacion] || 'sencilla',
    coordenadas: {
      latitud: attr.latitud_estacion || 0,
      longitud: attr.longitud_estacion || 0
    },
    servicios: {
      biciparqueadero: attr.biciestacion_estacion?.toLowerCase() === 'si',
      capacidad_biciparqueadero: attr.capacidad_biciestacion_estacion || 0,
      wifi: attr.componente_wifi?.toLowerCase() === 'si',
      accesos: attr.numero_accesos_estacion || 1
    },
    fuente: 'TransMilenio S.A. - datosabiertos.bogota.gov.co',
    ultima_actualizacion: now
  };
}

async function main() {
  console.log('Extrayendo estaciones de TransMilenio...');

  try {
    const features = await fetchEstaciones();
    console.log(`Obtenidas ${features.length} estaciones desde la API`);

    const estaciones = features
      .map(normalizeEstacion)
      .filter(e => e.coordenadas.latitud !== 0 && e.coordenadas.longitud !== 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    console.log(`Normalizadas ${estaciones.length} estaciones válidas`);

    const outputDir = join(process.cwd(), 'data', 'transmilenio');
    mkdirSync(outputDir, { recursive: true });

    const output = {
      $schema: '../schemas/estacion-transmilenio.schema.json',
      generado: new Date().toISOString(),
      total: estaciones.length,
      fuente: 'https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_estaciones_troncales/MapServer/0',
      licencia: 'CC-BY-SA-4.0',
      estaciones
    };

    writeFileSync(
      join(outputDir, 'estaciones.json'),
      JSON.stringify(output, null, 2)
    );

    console.log(`Guardado: data/transmilenio/estaciones.json`);

    // CSV para compatibilidad
    const csvHeader = 'id,codigo,nombre,troncal,tipo,latitud,longitud,biciparqueadero,wifi\n';
    const csvRows = estaciones.map(e =>
      `"${e.id}","${e.codigo}","${e.nombre}","${e.troncal}","${e.tipo}",${e.coordenadas.latitud},${e.coordenadas.longitud},${e.servicios.biciparqueadero},${e.servicios.wifi}`
    ).join('\n');

    writeFileSync(join(outputDir, 'estaciones.csv'), csvHeader + csvRows);
    console.log(`Guardado: data/transmilenio/estaciones.csv`);

  } catch (error) {
    console.error('Error extrayendo estaciones:', error);
    process.exit(1);
  }
}

main();
