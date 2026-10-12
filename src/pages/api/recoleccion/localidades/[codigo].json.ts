import type { APIRoute, GetStaticPaths } from 'astro';
import zonasData from '../../../../../data/recoleccion/zonas.json';
import localidadesData from '../../../../../data/recoleccion/localidades.json';

export const getStaticPaths: GetStaticPaths = () => {
  return localidadesData.localidades.map(loc => ({
    params: { codigo: loc.codigo }
  }));
};

export const GET: APIRoute = ({ params }) => {
  const localidad = localidadesData.localidades.find(l => l.codigo === params.codigo);
  
  if (!localidad) {
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `Localidad con código '${params.codigo}' no encontrada`,
      available_endpoint: '/api/recoleccion/localidades.json'
    }, null, 2), {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
  
  const zonas = zonasData.zonas.filter(z => z.localidad.codigo === params.codigo);
  
  return new Response(JSON.stringify({
    localidad: localidad.localidad,
    codigo: localidad.codigo,
    total_zonas: zonas.length,
    zonas
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
