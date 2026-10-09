/**
 * Extractor de Macrorutas de Recolección de Residuos
 * Fuente: serviciosgis.catastrobogota.gov.co (ArcGIS REST)
 * Licencia: CC-BY-SA-4.0
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_URL = 'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/serviciospublicos/aseobogota/MapServer/5/query';

interface ArcGISFeature {
  attributes: {
    OBJECTID: number;
    IDMACRUT: string;
    IDFRECUE_: string;
    FECVIGDES: string;
    LOCALIDAD: string;
    HORAINICIO1: number;
    HORAFIN1: number;
  };
}

interface ZonaNormalizada {
  id: string;
  codigo_macroruta: string;
  localidad: {
    codigo: string;
    nombre: string;
  };
  frecuencia: {
    codigo: string;
    dias: string[];
    descripcion: string;
  };
  horario_inicio: string;
  horario_fin: string;
  vigencia: string;
  fuente: string;
  ultima_actualizacion: string;
}

const LOCALIDADES: Record<string, string> = {
  '1': 'Usaquén',
  '2': 'Chapinero',
  '3': 'Santa Fe',
  '4': 'San Cristóbal',
  '5': 'Usme',
  '6': 'Tunjuelito',
  '7': 'Bosa',
  '8': 'Kennedy',
  '9': 'Fontibón',
  '10': 'Engativá',
  '11': 'Suba',
  '12': 'Barrios Unidos',
  '13': 'Teusaquillo',
  '14': 'Los Mártires',
  '15': 'Antonio Nariño',
  '16': 'Puente Aranda',
  '17': 'La Candelaria',
  '18': 'Rafael Uribe Uribe',
  '19': 'Ciudad Bolívar',
  '20': 'Sumapaz'
};

const FRECUENCIA_MAP: Record<string, { dias: string[]; descripcion: string }> = {
  '1': { dias: ['lunes', 'miercoles', 'viernes'], descripcion: 'Lunes, miércoles y viernes' },
  '2': { dias: ['martes', 'jueves', 'sabado'], descripcion: 'Martes, jueves y sábado' },
  '3': { dias: ['lunes', 'miercoles', 'viernes', 'domingo'], descripcion: 'Lunes, miércoles, viernes y domingo' },
  '4': { dias: ['martes', 'jueves', 'sabado', 'domingo'], descripcion: 'Martes, jueves, sábado y domingo' },
  '5': { dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'], descripcion: 'Lunes a sábado' },
  '6': { dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'], descripcion: 'Todos los días' },
  '7': { dias: ['domingo'], descripcion: 'Solo domingos' }
};

function formatHora(horaInt: number): string {
  if (!horaInt && horaInt !== 0) return '00:00';
  const str = String(horaInt).padStart(4, '0');
  return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
}

function parseVigencia(vigencia: string): string {
  if (!vigencia) return '';
  const match = vigencia.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

async function fetchMacrorutas(): Promise<ArcGISFeature[]> {
  const params = new URLSearchParams({
    where: 'OBJECTID>0',
    outFields: 'OBJECTID,IDMACRUT,IDFRECUE_,LOCALIDAD,HORAINICIO1,HORAFIN1,FECVIGDES',
    returnGeometry: 'false',
    f: 'json',
    resultRecordCount: '1000'
  });

  console.log('  Consultando API...');
  const response = await fetch(`${API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  if (!data.features) {
    console.error('Respuesta sin features:', JSON.stringify(data).slice(0, 500));
    return [];
  }

  return data.features;
}

function normalizeZona(feature: ArcGISFeature): ZonaNormalizada {
  const attr = feature.attributes;
  const now = new Date().toISOString();

  const frecInfo = FRECUENCIA_MAP[attr.IDFRECUE_] || {
    dias: [],
    descripcion: `Frecuencia código ${attr.IDFRECUE_}`
  };

  const localidadCodigo = (attr.LOCALIDAD || '').trim();
  
  return {
    id: `zona-${attr.IDMACRUT}-${attr.OBJECTID}`,
    codigo_macroruta: attr.IDMACRUT || String(attr.OBJECTID),
    localidad: {
      codigo: localidadCodigo,
      nombre: LOCALIDADES[localidadCodigo] || `Localidad ${localidadCodigo}`
    },
    frecuencia: {
      codigo: attr.IDFRECUE_ || '',
      dias: frecInfo.dias,
      descripcion: frecInfo.descripcion
    },
    horario_inicio: formatHora(attr.HORAINICIO1),
    horario_fin: formatHora(attr.HORAFIN1),
    vigencia: parseVigencia(attr.FECVIGDES),
    fuente: 'UAESP - datosabiertos.bogota.gov.co',
    ultima_actualizacion: now
  };
}

async function main() {
  console.log('Extrayendo macrorutas de recolección...');

  try {
    const features = await fetchMacrorutas();
    console.log(`Obtenidas ${features.length} macrorutas desde la API`);

    const zonas = features
      .map(normalizeZona)
      .filter(z => z.codigo_macroruta)
      .sort((a, b) => {
        const locComp = a.localidad.nombre.localeCompare(b.localidad.nombre, 'es');
        if (locComp !== 0) return locComp;
        return a.codigo_macroruta.localeCompare(b.codigo_macroruta);
      });

    console.log(`Normalizadas ${zonas.length} zonas válidas`);

    const porLocalidad: Record<string, ZonaNormalizada[]> = {};
    for (const zona of zonas) {
      const loc = zona.localidad.nombre;
      if (!porLocalidad[loc]) {
        porLocalidad[loc] = [];
      }
      porLocalidad[loc].push(zona);
    }

    const outputDir = join(process.cwd(), 'data', 'recoleccion');
    mkdirSync(outputDir, { recursive: true });

    const output = {
      $schema: '../schemas/zona-recoleccion.schema.json',
      generado: new Date().toISOString(),
      total: zonas.length,
      localidades: Object.keys(porLocalidad).length,
      fuente: 'https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/serviciospublicos/aseobogota/MapServer/5',
      licencia: 'CC-BY-SA-4.0',
      zonas
    };

    writeFileSync(
      join(outputDir, 'zonas.json'),
      JSON.stringify(output, null, 2)
    );

    console.log(`Guardado: data/recoleccion/zonas.json`);

    const indice = Object.entries(porLocalidad).map(([nombre, zonas]) => ({
      localidad: nombre,
      codigo: zonas[0].localidad.codigo,
      total_zonas: zonas.length,
      frecuencias: [...new Set(zonas.map(z => z.frecuencia.descripcion))]
    }));

    writeFileSync(
      join(outputDir, 'localidades.json'),
      JSON.stringify({ localidades: indice, generado: new Date().toISOString() }, null, 2)
    );

    console.log(`Guardado: data/recoleccion/localidades.json`);

    const csvHeader = 'id,codigo_macroruta,localidad_codigo,localidad_nombre,frecuencia_codigo,dias,horario_inicio,horario_fin,vigencia\n';
    const csvRows = zonas.map(z =>
      `"${z.id}","${z.codigo_macroruta}","${z.localidad.codigo}","${z.localidad.nombre}","${z.frecuencia.codigo}","${z.frecuencia.dias.join(';')}","${z.horario_inicio}","${z.horario_fin}","${z.vigencia}"`
    ).join('\n');

    writeFileSync(join(outputDir, 'zonas.csv'), csvHeader + csvRows);
    console.log(`Guardado: data/recoleccion/zonas.csv`);

  } catch (error) {
    console.error('Error extrayendo macrorutas:', error);
    process.exit(1);
  }
}

main();
