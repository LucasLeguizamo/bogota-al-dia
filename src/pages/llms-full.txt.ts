import type { APIRoute } from 'astro';
import estacionesData from '../../data/transmilenio/estaciones.json';
import rutasData from '../../data/transmilenio/rutas.json';
import zonasData from '../../data/recoleccion/zonas.json';
import localidadesData from '../../data/recoleccion/localidades.json';

export const GET: APIRoute = () => {
  const llmsFullTxt = `# Bogotá al Día - Documentación Completa

Información pública del día a día en Bogotá, Colombia.

## Resumen de datos

- **TransMilenio**: ${estacionesData.total} estaciones, ${rutasData.total} rutas
- **Recolección**: ${zonasData.total} zonas en ${localidadesData.localidades.length} localidades
- **Última actualización**: ${estacionesData.generado}

## TransMilenio

### Estaciones (${estacionesData.total} total)

Campos disponibles:
- id: Identificador único
- codigo: Código oficial
- nombre: Nombre de la estación
- troncal: Corredor (Caracas, Suba, NQS, etc.)
- tipo: sencilla, intermedia, cabecera, portal
- coordenadas: latitud, longitud
- servicios: biciparqueadero, wifi, accesos

Troncales disponibles:
${[...new Set(estacionesData.estaciones.map(e => e.troncal))].sort().map(t => `- ${t}`).join('\n')}

### Rutas (${rutasData.total} total)

Campos disponibles:
- id: Identificador único
- codigo: Código de ruta (ej: B23, K43)
- nombre: Nombre descriptivo
- origen, destino: Terminales
- tipo_operacion: corriente, facil, super_expreso
- estado: activa, suspendida
- horarios: lunes_viernes, sabado, domingo_festivo

## Recolección de Residuos

### Localidades (${localidadesData.localidades.length} total)

${localidadesData.localidades.map(l => `- ${l.localidad} (código ${l.codigo}): ${l.total_zonas} zonas`).join('\n')}

### Zonas (${zonasData.total} total)

Campos disponibles:
- id: Identificador único
- codigo_macroruta: Código de macroruta UAESP
- localidad: código y nombre
- frecuencia: código, días[], descripción
- horario_inicio, horario_fin: formato HH:MM
- vigencia: fecha de vigencia

Frecuencias comunes:
- Código 1: Lunes, miércoles y viernes
- Código 2: Martes, jueves y sábado
- Código 6: Todos los días

## API REST

Base URL: https://bogota-al-dia-ten.vercel.app/api

### Endpoints

GET /api/transmilenio/estaciones.json
  Retorna: { estaciones: EstacionTransmilenio[], total: number }

GET /api/transmilenio/estaciones/{codigo}.json
  Retorna: EstacionTransmilenio
  Errores: 404 si no existe

GET /api/transmilenio/rutas.json
  Retorna: { rutas: RutaTransmilenio[], total: number }

GET /api/transmilenio/rutas/{codigo}.json
  Retorna: RutaTransmilenio
  Errores: 404 si no existe

GET /api/recoleccion/zonas.json
  Retorna: { zonas: ZonaRecoleccion[], total: number }

GET /api/recoleccion/localidades.json
  Retorna: { localidades: { nombre, codigo, total_zonas }[] }

GET /api/recoleccion/localidades/{codigo}.json
  Retorna: { localidad: string, zonas: ZonaRecoleccion[] }
  Errores: 404 si no existe

## OpenAPI

Especificación completa disponible en:
https://bogota-al-dia-ten.vercel.app/openapi.json

## Licencia

Datos bajo CC-BY-SA-4.0
Fuentes: TransMilenio S.A., UAESP / Alcaldía de Bogotá
`;

  return new Response(llmsFullTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
